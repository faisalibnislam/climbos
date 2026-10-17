import { v } from "convex/values";
import type {
  AdDraftsOutput,
  BusinessInsights,
  BusinessProfile,
  ChatIntentOutput,
  EmailSequenceOutput,
  SeoBriefOutput,
  SocialPostsOutput,
  StrategyOutput,
} from "../shared/ai/tasks";
import { findRiskyClaims, validateFactIndexes } from "../shared/ai/tasks";
import type { InsightsV2, StrategyV2 } from "../shared/agents/specs";
import { approvalHash, contentHash } from "../shared/policy";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { AUTO_RUN_KINDS, jobForAction, startCardRun, WISH_AUTO_BUDGET_MICROS } from "./lib/cards";
import { estimateJobMicros, planJob, type JobKind } from "./lib/jobPlans";

const DAY = 86_400_000;

/** Everything a job needs, loaded in one bounded query. Facts are confirmed-only unless noted. */
export const jobContext = internalQuery({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run) return null;
    const org = await ctx.db.get(run.orgId);
    if (!org) return null;
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const facts = business
      ? await ctx.db
          .query("businessFacts")
          .withIndex("by_business", (q) => q.eq("businessId", business._id))
          .take(200)
      : [];
    const usable = facts.filter((f) => f.reviewState === "confirmed" || f.reviewState === "edited");
    const goal = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active"))
      .first();
    const brand = business
      ? await ctx.db
          .query("brandProfiles")
          .withIndex("by_business", (q) => q.eq("businessId", business._id))
          .first()
      : null;
    const strategy = await ctx.db
      .query("strategies")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .first();
    return {
      run,
      org,
      business,
      facts: usable.slice(0, 40).map((f) => ({ id: f._id, statement: f.statement, category: f.category })),
      unconfirmedCount: facts.filter((f) => f.reviewState === "needs_review").length,
      goal,
      brand,
      strategy,
    };
  },
});

async function ensureRunOrg(ctx: MutationCtx, runId: Id<"workflowRuns">) {
  const run = await ctx.db.get(runId);
  if (!run) throw new Error("Run not found");
  return run;
}

export const saveResearch = internalMutation({
  args: {
    runId: v.id("workflowRuns"),
    businessId: v.id("businesses"),
    pages: v.array(
      v.object({
        url: v.string(),
        title: v.optional(v.string()),
        excerpt: v.optional(v.string()),
        status: v.union(v.literal("ok"), v.literal("blocked_by_robots"), v.literal("failed")),
      }),
    ),
    profile: v.optional(v.string()),
  },
  handler: async (ctx, { runId, businessId, pages, profile }) => {
    const run = await ensureRunOrg(ctx, runId);
    const business = await ctx.db.get(businessId);
    if (!business || business.orgId !== run.orgId) throw new Error("Business mismatch");
    const now = Date.now();
    const sourceIds = new Map<string, Id<"factSources">>();
    for (const p of pages) {
      const id = await ctx.db.insert("factSources", {
        orgId: run.orgId,
        businessId,
        kind: run.isFixture ? "demo_fixture" : "website",
        url: p.url,
        title: p.title?.slice(0, 200),
        excerpt: p.excerpt?.slice(0, 1000),
        fetchedAt: now,
        status: p.status,
        expiresAt: now + 30 * DAY, // raw scrape retention
      });
      sourceIds.set(p.url, id);
    }
    if (!profile) {
      await ctx.db.patch(businessId, { researchStatus: pages.some((p) => p.status === "ok") ? "partial" : "failed", updatedAt: now });
      return;
    }
    const parsed = JSON.parse(profile) as BusinessProfile;
    const fallbackSource = [...sourceIds.values()][0];
    for (const f of parsed.facts.slice(0, 15)) {
      const statement = f.statement.trim().slice(0, 400);
      if (!statement) continue;
      const src = sourceIds.get(f.sourceUrl) ?? fallbackSource;
      await ctx.db.insert("businessFacts", {
        orgId: run.orgId,
        businessId,
        category: f.category,
        statement,
        // Researched facts always start as needs-review; low confidence is surfaced.
        confidence: f.confidence,
        reviewState: "needs_review",
        provenance: run.isFixture ? "demo_fixture" : "researched",
        sourceIds: src ? [src] : [],
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(businessId, {
      name: business.name || parsed.name.slice(0, 120),
      summary: parsed.oneLineSummary.slice(0, 300),
      businessType: parsed.businessType,
      researchStatus: "done",
      successEvents:
        business.successEvents.length > 0
          ? business.successEvents
          : parsed.suggestedSuccessEvents.slice(0, 4).map((e) => ({ ...e, confirmed: false })),
      updatedAt: now,
    });
    const brand = await ctx.db
      .query("brandProfiles")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .first();
    if (!brand) {
      await ctx.db.insert("brandProfiles", {
        orgId: run.orgId,
        businessId,
        voice: parsed.brandVoice.slice(0, 200),
        toneWords: [],
        colors: [],
        doNots: ["No invented statistics or testimonials"],
        updatedAt: now,
      });
    }
  },
});

export const saveInsights = internalMutation({
  args: { runId: v.id("workflowRuns"), businessId: v.id("businesses"), insights: v.string() },
  handler: async (ctx, { runId, businessId, insights }) => {
    const run = await ensureRunOrg(ctx, runId);
    const business = await ctx.db.get(businessId);
    if (!business || business.orgId !== run.orgId) throw new Error("Business mismatch");
    const i = JSON.parse(insights) as BusinessInsights;
    await ctx.db.patch(businessId, {
      insights: {
        audiences: i.audiences.slice(0, 5),
        competitors: i.competitors.slice(0, 6).map((c) => ({ name: c.name, url: c.url || undefined, note: c.note, sourceUrl: c.sourceUrl || undefined })),
        positioning: i.positioning,
        pricingNotes: i.pricingNotes,
        swot: {
          strengths: i.swot.strengths.slice(0, 5),
          weaknesses: i.swot.weaknesses.slice(0, 5),
          opportunities: i.swot.opportunities.slice(0, 5),
          threats: i.swot.threats.slice(0, 5),
        },
        journey: i.journey.slice(0, 6),
        opportunities: i.opportunities.slice(0, 6),
        ...("vocPhrases" in i
          ? {
              expert: (() => {
                const x = i as unknown as InsightsV2;
                const url = (u: string) => u || undefined;
                return {
                  alternatives: x.alternatives.slice(0, 10).map((a) => ({ ...a, sourceUrl: url(a.sourceUrl) })),
                  vocPhrases: x.vocPhrases.slice(0, 40).map((a) => ({ ...a, sourceUrl: url(a.sourceUrl) })),
                  objections: x.objections.slice(0, 12).map((a) => ({ ...a, sourceUrl: url(a.sourceUrl) })),
                  gaps: x.gaps.slice(0, 10).map((a) => ({ ...a, sourceUrl: url(a.sourceUrl) })),
                  positioningStatement: x.positioningStatement,
                  confidenceNotes: x.confidenceNotes,
                };
              })(),
            }
          : {}),
        generatedAt: Date.now(),
        runId,
      },
      updatedAt: Date.now(),
    });
  },
});

export const saveStrategy = internalMutation({
  args: { runId: v.id("workflowRuns"), strategy: v.string(), factIds: v.array(v.id("businessFacts")) },
  handler: async (ctx, { runId, strategy, factIds }) => {
    const run = await ensureRunOrg(ctx, runId);
    const s = JSON.parse(strategy) as StrategyOutput;
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", run.orgId))
      .first();
    const goal = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", run.orgId).eq("status", "active"))
      .first();
    if (!business || !goal) throw new Error("Business and goal required");
    const prior = await ctx.db
      .query("strategies")
      .withIndex("by_org", (q) => q.eq("orgId", run.orgId))
      .order("desc")
      .take(5);
    for (const p of prior) if (p.status === "draft" || p.status === "needs_approval") await ctx.db.patch(p._id, { status: "superseded" });
    const version = (prior[0]?.version ?? 0) + 1;
    const now = Date.now();
    const contentPlans: Record<string, JobKind> = {
      seo_content: "content_seo",
      social_organic: "content_social",
      search_ads: "content_ads",
      meta_ads: "content_ads",
      email_lifecycle: "content_email",
      sales_outreach: "sales_sequence",
      conversion_optimization: "conversion_audit",
      retention: "retention_plan",
    };
    const strategyId = await ctx.db.insert("strategies", {
      orgId: run.orgId,
      businessId: business._id,
      goalId: goal._id,
      version,
      status: "needs_approval",
      summary: s.summary,
      audiences: s.audiences.slice(0, 5),
      positioning: s.positioning,
      channels: s.channels
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 6)
        .map((c, i) => {
          const job = contentPlans[c.key];
          const adSpend = Math.max(0, Math.round(c.suggestedMonthlyAdSpend * 100));
          return {
            key: c.key,
            name: c.name,
            why: c.why,
            priority: i + 1,
            status: i < 4 ? ("proposed" as const) : ("parked" as const),
            monthlyCostMicros: job ? estimateJobMicros(planJob(job)) * 4 : 0,
            // Never exceed the owner's stated monthly ad budget.
            adSpendMinor: Math.min(adSpend, goal.monthlyAdBudgetMinor),
            deliverables: c.deliverables.slice(0, 6),
            dependencies: c.dependencies.slice(0, 6),
            measurement: c.measurement,
            capabilityNote:
              c.key === "search_ads" || c.key === "meta_ads"
                ? "Ads are created paused and only go live after you approve the exact campaign and budget."
                : c.key === "sales_outreach"
                  ? "Uses only leads you already have. ClimbOS has no contact database."
                  : undefined,
          };
        }),
      constraints: s.constraints.slice(0, 8),
      measurementPlan: s.measurementPlan,
      ...("diagnosis" in s
        ? {
            expert: (() => {
              const x = s as unknown as StrategyV2;
              return {
                diagnosis: x.diagnosis,
                affordableCac: x.affordableCac,
                notDoing: x.notDoing.slice(0, 10),
                northStar: x.northStar,
                leadingIndicators: x.leadingIndicators.slice(0, 6),
                phases: x.phases.slice(0, 4),
                weekOneChecklist: x.weekOneChecklist.slice(0, 7),
                risks: x.risks.slice(0, 6),
                plays: (x.plays ?? []).slice(0, 4),
              };
            })(),
          }
        : {}),
      reviewDate: new Date(now + 14 * DAY).toISOString().slice(0, 10),
      sourceFactIds: factIds.slice(0, 40),
      generationCostMicros: 0,
      runId,
      createdAt: now,
    });
    for (const e of s.experiments.slice(0, 4)) {
      await ctx.db.insert("experiments", {
        orgId: run.orgId,
        strategyId,
        name: e.name,
        hypothesis: e.hypothesis,
        population: e.population,
        method: e.method,
        primaryMetric: e.primaryMetric,
        guardrails: e.guardrails.slice(0, 4),
        durationDays: Math.max(7, Math.min(120, Math.round(e.durationDays))),
        stoppingRule: e.stoppingRule,
        status: "proposed",
        createdAt: now,
      });
    }
    // Approval request for the initial plan (always required).
    const policyVersion = await activePolicyVersion(ctx, run.orgId);
    const hash = `strategy:${strategyId}:v${version}`;
    const expiresAt = now + 14 * DAY;
    const binding = { orgId: run.orgId, subjectType: "strategy", subjectId: strategyId, actionKind: "approve_plan", contentHash: hash, scope: {}, policyVersion, expiresAt };
    const approvalId = await ctx.db.insert("approvals", {
      orgId: run.orgId,
      subjectType: "strategy",
      subjectId: strategyId,
      actionKind: "approve_plan",
      title: `Growth plan v${version}`,
      contentHash: hash,
      scope: {},
      costEstimateMicros: 0,
      policyVersion,
      approvalHash: await approvalHash(binding),
      status: "pending",
      expiresAt,
      createdAt: now,
    });
    await ctx.db.patch(strategyId, { approvalId });
    // First actions become action cards on Today.
    let priority = 1;
    for (const a of s.firstActions.slice(0, 3)) {
      await ctx.db.insert("actionCards", {
        orgId: run.orgId,
        title: a.title,
        description: a.why,
        proposedEffect: "A suggestion from your plan. Nothing happens until you choose to act on it.",
        kind: "note",
        roles: ["ceo"],
        payload: "{}",
        costEstimateMicros: 0,
        externalEffect: false,
        status: "proposed",
        priority: priority++,
        createdAt: now,
        updatedAt: now,
      });
    }
    await audit(ctx, { orgId: run.orgId, actorType: "agent", actorId: "ceo", action: "strategy.created", subjectType: "strategy", subjectId: strategyId, summary: `Growth plan v${version} drafted and waiting for approval.` });
    return strategyId;
  },
});

export async function activePolicyVersion(ctx: MutationCtx, orgId: Id<"organizations">): Promise<number> {
  const policy = await ctx.db
    .query("autonomyPolicies")
    .withIndex("by_org_active", (q) => q.eq("orgId", orgId).eq("active", true))
    .first();
  return policy?.version ?? 1;
}

type ArtifactInput = {
  kind: Doc<"artifacts">["kind"];
  channel: Doc<"artifacts">["channel"];
  title: string;
  headline?: string;
  body: string;
  callToAction?: string;
  destinationUrl?: string;
  hashtags: string[];
  altText?: string;
  imagePrompt?: string;
  imageStorageId?: Id<"_storage">;
  imageR2Key?: string;
  imageLabel?: string;
  factIndexes: number[];
  scheduledFor?: number;
  role: NonNullable<Doc<"artifacts">["createdByRole"]>;
};

export async function insertArtifact(
  ctx: MutationCtx,
  params: { orgId: Id<"organizations">; businessId: Id<"businesses">; runId?: Id<"workflowRuns">; factIds: Id<"businessFacts">[]; item: ArtifactInput; createdBy?: Id<"users"> },
) {
  const { item } = params;
  const now = Date.now();
  const { valid, invalid } = validateFactIndexes(item.factIndexes, params.factIds.length);
  const risky = findRiskyClaims(`${item.headline ?? ""} ${item.body}`);
  const unsupported = [...risky.map((r) => `Check claim: "${r}"`), ...(invalid.length ? ["References a fact that doesn't exist"] : [])];
  const artifactId = await ctx.db.insert("artifacts", {
    orgId: params.orgId,
    businessId: params.businessId,
    kind: item.kind,
    channel: item.channel,
    title: item.title.slice(0, 140),
    status: "in_review",
    currentVersion: 1,
    scheduledFor: item.scheduledFor,
    createdByRole: item.role,
    createdBy: params.createdBy,
    runId: params.runId,
    createdAt: now,
    updatedAt: now,
  });
  const ch = await contentHash({
    headline: item.headline,
    body: item.body,
    callToAction: item.callToAction,
    destinationUrl: item.destinationUrl,
    hashtags: item.hashtags,
    altText: item.altText,
    imageRef: item.imageR2Key ?? item.imageStorageId,
    channel: item.channel,
  });
  const versionId = await ctx.db.insert("artifactVersions", {
    orgId: params.orgId,
    artifactId,
    version: 1,
    headline: item.headline,
    body: item.body,
    callToAction: item.callToAction,
    destinationUrl: item.destinationUrl,
    hashtags: item.hashtags.slice(0, 12),
    altText: item.altText,
    imageStorageId: item.imageStorageId,
    imageR2Key: item.imageR2Key,
    imagePrompt: item.imagePrompt,
    imageLabel: item.imageStorageId || item.imageR2Key ? (item.imageLabel ?? "AI-generated illustration") : undefined,
    claimFactIds: valid.map((i) => params.factIds[i]),
    unsupportedClaims: unsupported,
    contentHash: ch,
    editedByRole: item.role,
    createdAt: now,
  });
  await ctx.db.patch(artifactId, { currentVersionId: versionId });
  return artifactId;
}

const artifactInputValidator = v.object({
  kind: v.string(),
  channel: v.string(),
  title: v.string(),
  headline: v.optional(v.string()),
  body: v.string(),
  callToAction: v.optional(v.string()),
  destinationUrl: v.optional(v.string()),
  hashtags: v.array(v.string()),
  altText: v.optional(v.string()),
  imagePrompt: v.optional(v.string()),
  imageStorageId: v.optional(v.id("_storage")),
  imageR2Key: v.optional(v.string()),
  /** How the image is labelled to the owner (real screenshot, product photo, AI illustration). */
  imageLabel: v.optional(v.string()),
  factIndexes: v.array(v.number()),
  scheduledFor: v.optional(v.number()),
  role: v.string(),
});

export const saveArtifacts = internalMutation({
  args: { runId: v.id("workflowRuns"), items: v.array(artifactInputValidator), factIds: v.array(v.id("businessFacts")) },
  handler: async (ctx, { runId, items, factIds }) => {
    const run = await ensureRunOrg(ctx, runId);
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", run.orgId))
      .first();
    if (!business) throw new Error("No business");
    const ids: Id<"artifacts">[] = [];
    for (const item of items.slice(0, 12)) {
      ids.push(
        await insertArtifact(ctx, {
          orgId: run.orgId,
          businessId: business._id,
          runId,
          factIds,
          item: item as unknown as ArtifactInput,
          createdBy: run.createdBy,
        }),
      );
    }
    await audit(ctx, { orgId: run.orgId, actorType: "agent", action: "content.drafted", subjectType: "run", subjectId: runId, summary: `${ids.length} draft${ids.length === 1 ? "" : "s"} ready for review.` });
    return ids;
  },
});

/** Convert task outputs into artifact inputs (pure helpers used by jobs). */
export function socialToArtifacts(out: SocialPostsOutput, now: number): Omit<ArtifactInput, "imageStorageId">[] {
  return out.posts.map((p, i) => ({
    kind: "social_post" as const,
    channel: p.channel,
    title: p.title,
    body: p.body,
    hashtags: p.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)),
    altText: p.altText,
    imagePrompt: p.imageIdea,
    factIndexes: p.factIndexes,
    scheduledFor: now + (Math.max(1, Math.round(p.suggestedDay)) + i) * DAY,
    role: "social_media_manager" as const,
  }));
}

export function adsToArtifacts(out: AdDraftsOutput, website?: string): Omit<ArtifactInput, "imageStorageId">[] {
  const items: Omit<ArtifactInput, "imageStorageId">[] = [];
  for (const a of out.searchAds.slice(0, 2)) {
    items.push({
      kind: "ad",
      channel: "google_search_ad",
      title: `Search ad: ${a.headlines[0] ?? "Draft"}`,
      headline: a.headlines.map((h) => h.slice(0, 30)).join(" | "),
      body: a.descriptions.map((d) => d.slice(0, 90)).join("\n"),
      destinationUrl: a.finalUrl || website,
      hashtags: a.keywords.slice(0, 10),
      factIndexes: out.factIndexes,
      role: "ads_manager",
    });
  }
  for (const m of out.metaAds.slice(0, 2)) {
    items.push({
      kind: "ad",
      channel: "meta_ad",
      title: `Social ad: ${m.headline}`,
      headline: m.headline,
      body: `${m.primaryText}\n\n${m.description}`,
      destinationUrl: website,
      hashtags: [],
      imagePrompt: m.imageIdea,
      factIndexes: out.factIndexes,
      role: "ads_manager",
    });
  }
  return items;
}

export function emailToArtifacts(out: EmailSequenceOutput): Omit<ArtifactInput, "imageStorageId">[] {
  return [
    {
      kind: "email_sequence",
      channel: "email",
      title: out.name,
      headline: `${out.emails.length} emails · for ${out.audience}`,
      body: out.emails
        .map((e, i) => `Email ${i + 1} — day ${e.sendAfterDays}\nSubject: ${e.subject}\nPreview: ${e.previewText}\n\n${e.body}\n\n[${e.callToAction}]`)
        .join("\n\n———\n\n"),
      hashtags: [],
      factIndexes: out.factIndexes,
      role: "customer_success_manager",
    },
  ];
}

export function seoToArtifacts(out: SeoBriefOutput): Omit<ArtifactInput, "imageStorageId">[] {
  return [
    {
      kind: "blog_post",
      channel: "blog",
      title: out.title,
      headline: out.metaDescription,
      body: `${out.outline.map((o) => `## ${o.heading}\n${o.points.map((p) => `- ${p}`).join("\n")}`).join("\n\n")}\n\n---\n\n${out.draft}`,
      hashtags: [out.primaryKeyword, ...out.secondaryKeywords].slice(0, 8),
      factIndexes: out.factIndexes,
      role: "seo_specialist",
    },
  ];
}

export const saveChatResult = internalMutation({
  args: { runId: v.id("workflowRuns"), messageId: v.id("chatMessages"), result: v.string(), isFixture: v.boolean() },
  handler: async (ctx, { runId, messageId, result }) => {
    const run = await ensureRunOrg(ctx, runId);
    const org = await ctx.db.get(run.orgId);
    const out = JSON.parse(result) as ChatIntentOutput;
    const now = Date.now();
    const cardIds: Id<"actionCards">[] = [];
    let priority = 1;
    // Say the word and things happen: safe internal work starts at once, within a per-wish budget.
    let autoBudget = WISH_AUTO_BUDGET_MICROS;
    const started: string[] = [];
    const waiting: string[] = [];
    for (const a of out.actions.slice(0, 4)) {
      const job = jobForAction(a.kind, a.channel);
      const plan = job ? planJob(job, { quantity: a.quantity, images: job === "content_social" ? 1 : 0, channel: a.channel }, { fixture: org?.kind === "demo" }) : null;
      const external = a.kind === "ad_change" || a.kind === "email_send" || a.kind === "schedule_content";
      const isLink = a.kind === "connect_account" || a.kind === "set_up_autopilot";
      const cost = plan ? estimateJobMicros(plan) : 0;
      const cardId = await ctx.db.insert("actionCards", {
        orgId: run.orgId,
        title: a.title.slice(0, 120),
        description: a.description.slice(0, 400),
        proposedEffect: external
          ? "Prepares the change for your approval. Nothing goes live until you approve the exact version."
          : isLink
            ? a.kind === "set_up_autopilot"
              ? "Opens autopilot with these settings filled in. Nothing changes until you save."
              : "Opens the connection page."
            : a.kind === "find_customers"
              ? "Finds evidenced prospects and drafts the emails. Nothing is sent until you choose."
              : plan
              ? `Creates drafts only (${plan.title.toLowerCase()}). Nothing is published.`
              : "A note for your team. No cost.",
        kind: a.kind,
        roles: plan?.roles ?? ["coo"],
        payload: JSON.stringify({ job, channel: a.channel, quantity: a.quantity, brief: a.brief?.slice(0, 1500) ?? "" }),
        costEstimateMicros: cost,
        externalEffect: external,
        status: job || a.kind === "note" || isLink ? "proposed" : "blocked",
        blockedReason: job || a.kind === "note" || isLink ? undefined : "This needs a connected account and an approval rule before ClimbOS can prepare it.",
        priority: priority++,
        createdAt: now,
        updatedAt: now,
      });
      cardIds.push(cardId);
      const card = await ctx.db.get(cardId);
      if (org && card && job && !external && AUTO_RUN_KINDS.has(a.kind) && cost <= autoBudget && run.createdBy) {
        try {
          await startCardRun(ctx, { org, card, userId: run.createdBy, auto: true });
          autoBudget -= cost;
          started.push(a.title);
          continue;
        } catch (e) {
          const message = (e as { data?: { message?: string } }).data?.message;
          if (message) await ctx.db.patch(cardId, { blockedReason: message });
        }
      }
      if (job || isLink) waiting.push(a.title);
    }
    await ctx.db.patch(messageId, { status: "done" });
    const status =
      started.length && waiting.length
        ? `\n\nStarted: ${started.join("; ")}. Waiting for your go: ${waiting.join("; ")}.`
        : started.length
          ? ""
          : waiting.length
            ? "\n\nTap Do it on a card to start it."
            : "";
    await ctx.db.insert("chatMessages", {
      orgId: run.orgId,
      author: "climbos",
      text: `${out.reply}${status}${out.followUp ? `\n\n${out.followUp}` : ""}`.slice(0, 1600),
      understood: out.understood?.slice(0, 300) || undefined,
      roles: ["coo"],
      actionCardIds: cardIds,
      status: "done",
      createdAt: now + 1,
    });
  },
});

export { jobForAction } from "./lib/cards";

export const markChatFailed = internalMutation({
  args: { messageId: v.id("chatMessages"), message: v.string() },
  handler: async (ctx, { messageId, message }) => {
    const m = await ctx.db.get(messageId);
    if (!m) return;
    await ctx.db.patch(messageId, { status: "failed" });
    await ctx.db.insert("chatMessages", {
      orgId: m.orgId,
      author: "climbos",
      text: message,
      roles: ["coo"],
      actionCardIds: [],
      status: "failed",
      createdAt: Date.now(),
    });
  },
});

export const updateActionCard = internalMutation({
  args: {
    cardId: v.id("actionCards"),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    runId: v.optional(v.id("workflowRuns")),
  },
  handler: async (ctx, { cardId, status, runId }) => {
    await ctx.db.patch(cardId, { status, ...(runId ? { runId } : {}), updatedAt: Date.now() });
  },
});
