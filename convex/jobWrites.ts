import { feedbackBrief } from "./feedback";
import { EVIDENCE_KIND_LABEL, evidenceKind } from "../shared/agents/evidenceKind";
import { groupExactDuplicateFacts } from "../shared/agents/factDuplicates";
import { factFreshness } from "../shared/agents/factFreshness";
import { EXPERT_PLAN_SCHEMA_VERSION, LEGACY_EXPERT_PLAN_SCHEMA_VERSION, expertPlaysOf } from "../shared/agents/planCompatibility";
import { buildCurrentExpertGrowthPayload } from "../shared/agents/growthPlanPersistence";
import { planContentHash } from "./lib/planHash";
import { resolveCites } from "../shared/agents/evidence";
import { majorToMinor, minorToMajor } from "../shared/economics/currency";
import { creditsToMicros } from "../shared/economics/credits";
import { AGENT_ARCHETYPE_BY_ID, agentForAction } from "../shared/agents/registry";
import { validateActionDependencies } from "../shared/agents/actionDependencies";
import { sha256Hex } from "../shared/policy";
import { v } from "convex/values";
import { resultsBrief } from "./playResults";
import { customerConcentration } from "../shared/attribution/concentration";
import { refundExposure } from "../shared/attribution/refundExposure";
import { platformConcentration } from "../shared/attribution/platformConcentration";
import { shortenable, utmFor, withUtm } from "../shared/links";
import { createLink } from "./links";
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
import { actionReadinessOf, analyzeDecisionOptions, type CopyBrief, type InsightsV2, type StrategyV2 } from "../shared/agents/specs";
import { approvalHash, contentHash } from "../shared/policy";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { AUTO_RUN_KINDS, CHANNEL_JOBS, jobForAction, startCardRun, WISH_AUTO_BUDGET_MICROS } from "./lib/cards";
import { estimateJobMicros, planJob } from "./lib/jobPlans";
import { notifyOwners } from "./lib/notify";
import { appError } from "./lib/tenancy";

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
    // Keep the canonical, newest version of an exactly repeated fact in model context.
    // The underlying rows and their source history remain untouched for audit/display.
    const usable = groupExactDuplicateFacts(
      facts
        .filter((f) => f.reviewState === "confirmed" || f.reviewState === "edited")
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((f) => ({ ...f, id: String(f._id) })),
    ).map(({ primary }) => primary);
    const factNow = Date.now();
    const freshnessOf = (fact: (typeof usable)[number]) => factFreshness(fact.category, fact.updatedAt, factNow, fact.verifiedAt ?? fact.updatedAt);
    const currentFacts = usable.filter((f) => !freshnessOf(f).reviewSuggested);
    const staleFacts = usable.filter((f) => freshnessOf(f).reviewSuggested);
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
    // The approved plan guides the work; a newer version waiting for approval doesn't yet.
    const recentPlans = await ctx.db
      .query("strategies")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(10);
    let requestedStrategyId: string | undefined;
    try {
      const input = JSON.parse(run.input) as { strategyId?: unknown };
      if (typeof input?.strategyId === "string") requestedStrategyId = input.strategyId;
    } catch {
      // Legacy and non-JSON run inputs do not name a plan.
    }
    const requestedId = requestedStrategyId ? ctx.db.normalizeId("strategies", requestedStrategyId) : null;
    const requestedStrategy = requestedId ? await ctx.db.get(requestedId) : null;
    const strategy = requestedStrategy?.orgId === org._id
      ? requestedStrategy
      : recentPlans.find((s) => s.status === "approved") ?? recentPlans[0] ?? null;
    const marketChanges = await ctx.db.query("competitorChanges")
      .withIndex("by_org_at", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(8);
    // What this workspace can actually run (REQ-ENG-11): live connections and the approval mode.
    const connections = await ctx.db.query("connections").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(50);
    const policy = await ctx.db.query("autonomyPolicies").withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true)).first();
    // Read the immutable rating snapshot captured when this specialist request was created.
    const feedbackSnapshot = run.customAgentFeedbackSnapshot;
    const specialistFeedbackText = feedbackSnapshot?.sampleSize
      ? [
          `WORKSPACE MEMBER-REPORTED SPECIALIST FEEDBACK (last ${feedbackSnapshot.windowDays} days; sample of ${feedbackSnapshot.sampleSize} ratings: ${feedbackSnapshot.helpful} helpful, ${feedbackSnapshot.needsWork} needs work; captured ${new Date(feedbackSnapshot.capturedAt).toISOString()}; these are usefulness reports, not measured business outcomes):`,
          ...feedbackSnapshot.notes.map((r) => `- ${new Date(r.updatedAt).toISOString().slice(0, 10)} · ${r.rating}: ${r.note.slice(0, 400)}`),
        ].join("\n")
      : "";
    const archetypeFeedbackSnapshot = run.agentArchetypeFeedbackSnapshot;
    const agentArchetypeFeedbackText = archetypeFeedbackSnapshot?.sampleSize
      ? [
          `WORKSPACE MEMBER-REPORTED FEEDBACK ABOUT THIS BUILT-IN SPECIALIST (last ${archetypeFeedbackSnapshot.windowDays} days; ${archetypeFeedbackSnapshot.capped ? `at least ${archetypeFeedbackSnapshot.sampleSize}` : archetypeFeedbackSnapshot.sampleSize} ratings: ${archetypeFeedbackSnapshot.helpful} helpful, ${archetypeFeedbackSnapshot.needsWork} needs work; captured ${new Date(archetypeFeedbackSnapshot.capturedAt).toISOString()}; this is usefulness feedback, not measured business performance):`,
          ...archetypeFeedbackSnapshot.notes.map((entry) => `- ${new Date(entry.updatedAt).toISOString().slice(0, 10)} · ${entry.rating}: ${entry.note.slice(0, 400)}`),
        ].join("\n")
      : "";
    // Who the business can email (Book 14 §4: no audience is assumed). Bounded counts; 1,000 means "1,000 or more".
    const contacts = (await ctx.db.query("contacts").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(1000)).filter((c) => !c.deletedAt).length;
    const consented = new Set(
      (await ctx.db.query("consentRecords").withIndex("by_org_contact", (q) => q.eq("orgId", org._id)).take(1000))
        .filter((r) => r.purpose === "marketing_email" && !r.withdrawnAt)
        .map((r) => r.contactId),
    ).size;
    const concentrationToMs = Date.now();
    const concentrationFromMs = concentrationToMs - 365 * DAY;
    const concentrationFromDay = new Date(concentrationFromMs).toISOString().slice(0, 10);
    const concentrationToDay = new Date(concentrationToMs).toISOString().slice(0, 10);
    const revenueRows = await ctx.db
      .query("revenueEvents")
      .withIndex("by_org_occurred", (q) => q.eq("orgId", org._id).lte("occurredAt", concentrationToMs))
      .order("desc")
      .take(10_001);
    const usableRevenueRows = revenueRows.filter((event) => !event.isFixture);
    const concentrationIsPartial = revenueRows.length > 10_000;
    const concentrationCurrency = business?.currency ?? org.currency;
    const concentrationEvents = usableRevenueRows.map((event) => ({
          id: String(event._id), sourceEventId: event.sourceEventId, source: event.source, occurredAt: event.occurredAt,
          customerRef: event.customerRef, orderRef: event.orderRef, currency: event.currency,
          amountMinor: event.amountMinor, refundedMinor: event.refundedMinor, kind: event.kind,
          utmSource: event.utmSource, utmMedium: event.utmMedium,
        }));
    const concentration = concentrationCurrency
      ? customerConcentration(concentrationEvents, { currency: concentrationCurrency, fromMs: concentrationFromMs, toMs: concentrationToMs, partial: concentrationIsPartial })
      : null;
    const spendRows = [];
    let spendPartial = false;
    for (const platform of ["google_ads", "meta_ads"]) {
      const rows = await ctx.db
        .query("platformClaims")
        .withIndex("by_org_platform_date", (q) => q.eq("orgId", org._id).eq("platform", platform).gte("date", concentrationFromDay).lte("date", concentrationToDay))
        .take(401);
      spendPartial ||= rows.length > 400;
      spendRows.push(...rows);
    }
    const platformSourceConcentration = concentrationCurrency
      ? platformConcentration(concentrationEvents, {
          currency: concentrationCurrency,
          fromMs: concentrationFromMs,
          toMs: concentrationToMs,
          partial: concentrationIsPartial,
          spendPartial,
          ...(typeof business?.unitEconomics?.grossMargin === "number" && business.unitEconomics.grossMargin >= 0 && business.unitEconomics.grossMargin <= 1 ? { grossMargin: business.unitEconomics.grossMargin } : {}),
          reportedSpend: spendRows.filter((row) => !row.isFixture).map((row) => ({ platform: row.platform, date: row.date, currency: row.currency, spendMinor: row.spendMinor, ...(row.spendOrigin ? { origin: row.spendOrigin } : {}) })),
        })
      : null;
    const refundExposureSignal = concentrationCurrency
      ? refundExposure(concentrationEvents, { currency: concentrationCurrency, fromMs: concentrationFromMs, toMs: concentrationToMs, partial: concentrationIsPartial })
      : null;
    return {
      customerConcentration: concentration,
      platformSourceConcentration,
      refundExposure: refundExposureSignal,
      audience: { contacts, consented },
      capabilities: { connected: connections.filter((c) => c.status === "connected").map((c) => c.provider), autonomy: policy?.mode ?? "review" },
      run,
      specialist: run.customAgentSnapshot ?? null,
      specialistFeedbackText,
      agentArchetypeFeedbackText,
      agentArchetype: run.agentArchetypeSnapshot ?? (run.agentArchetypeId ? AGENT_ARCHETYPE_BY_ID.get(run.agentArchetypeId) ?? null : null),
      org,
      business,
      /** Recent, source-backed competitor page changes are market signals, not customer evidence. */
      marketChanges: marketChanges.map(({ _id, at, name, summary, bullets, soWhat, sourceUrls, evidence }) => ({ id: String(_id), at, name, summary, bullets, soWhat: soWhat ?? null, sourceUrls: sourceUrls ?? [], evidence: evidence ?? null })),
      /** Plans start from what earlier plays actually did. */
      resultsText: run.kind === "strategy" ? [await resultsBrief(ctx, org._id), await feedbackBrief(ctx, org._id)].filter(Boolean).join("\n\n") : "",
      facts: currentFacts.slice(0, 40).map((f) => ({ id: f._id, statement: f.statement, category: f.category, createdAt: f.createdAt, updatedAt: f.updatedAt, verifiedAt: f.verifiedAt ?? f.updatedAt, kind: EVIDENCE_KIND_LABEL[evidenceKind(f.statement, f.provenance)], evidenceKind: evidenceKind(f.statement, f.provenance), freshness: freshnessOf(f) })),
      staleFacts: staleFacts.slice(0, 40).map((f) => ({ id: f._id, statement: f.statement, category: f.category, updatedAt: f.updatedAt, verifiedAt: f.verifiedAt ?? f.updatedAt, freshness: freshnessOf(f) })),
      unconfirmedCount: facts.filter((f) => f.reviewState === "needs_review").length,
      goal,
      brand,
      strategy,
      /** True when this run was created from a specific plan card while that plan was approved. */
      strategyPinned: Boolean(requestedStrategy && requestedStrategy.orgId === org._id),
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
    const v2 = i as unknown as Partial<InsightsV2>;
    const v2Competitors = v2.competitors;
    const insightsAt = Date.now();
    const org = await ctx.db.get(run.orgId);
    const refreshDays = org?.competitorResearchRefreshDays ?? 90;
    await ctx.db.patch(businessId, {
      insights: {
        audiences: i.audiences.slice(0, 5).map((audience, index) => {
          const profile = v2.audiences?.[index];
          const evidenceItems = (rows: { statement: string; basis: "owner_report" | "measured" | "research" | "inference"; evidenceRefs: string[] }[] | undefined) => rows?.slice(0, 4).map((row) => ({ ...row, statement: row.statement.slice(0, 240), evidenceRefs: row.evidenceRefs.slice(0, 4) }));
          return {
            ...audience,
            ...(profile ? {
              needs: evidenceItems(profile.needs),
              objections: evidenceItems(profile.objections),
              purchasingMotivations: evidenceItems(profile.purchasingMotivations),
              channelPreferences: profile.channelPreferences.slice(0, 4).map((row) => ({ ...row, channel: row.channel.slice(0, 100), rationale: row.rationale.slice(0, 240), evidenceRefs: row.evidenceRefs.slice(0, 4) })),
            } : {}),
          };
        }),
        competitors: i.competitors.slice(0, 6).map((c, index) => ({
          name: c.name,
          url: c.url || undefined,
          note: c.note,
          sourceUrl: c.sourceUrl || undefined,
          kind: v2Competitors?.[index]?.kind,
          comparison: v2Competitors?.[index]?.comparison?.slice(0, 8).map((finding) => ({ ...finding, finding: finding.finding.slice(0, 500), implication: finding.implication.slice(0, 500) })),
        })),
        positioning: i.positioning,
        pricingNotes: i.pricingNotes,
        swot: {
          strengths: i.swot.strengths.slice(0, 5),
          weaknesses: i.swot.weaknesses.slice(0, 5),
          opportunities: i.swot.opportunities.slice(0, 5),
          threats: i.swot.threats.slice(0, 5),
        },
        swotEvidence: i.swotEvidence?.slice(0, 16).map((finding) => ({
          ...finding,
          finding: finding.finding.slice(0, 300),
          evidenceRefs: finding.evidenceRefs.slice(0, 8),
          strategicImplication: finding.strategicImplication.slice(0, 400),
        })),
        swotMoves: i.swotMoves?.slice(0, 8).map((move) => ({
          ...move,
          move: move.move.slice(0, 400),
          firstTest: move.firstTest.slice(0, 300),
          measure: move.measure.slice(0, 200),
        })),
        journey: i.journey.slice(0, 6),
        opportunities: i.opportunities.slice(0, 6),
        ...("vocPhrases" in i
          ? {
              expert: (() => {
                const x = v2 as InsightsV2;
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
        generatedAt: insightsAt,
        runId,
      },
      competitorResearchCompletedAt: insightsAt,
      competitorResearchNextAt: refreshDays > 0 ? insightsAt + refreshDays * 86_400_000 : undefined,
      competitorResearchStaleAt: undefined,
      competitorResearchLastStatus: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.competitorDiscovery.seedFromInsights, { orgId: run.orgId, businessId, insightsAt });
    if (org) await notifyOwners(ctx, org._id, `Research on ${business.name} is done. Check what we learned.`, org.onboardingStep !== "done" ? `/onboarding?workspace=${org.slug}` : "settings/business");
  },
});

/**
 * Stable play IDs (REQ-LEARN-04): a play keeps its ID across plan versions when
 * its name matches an earlier plan's play, so logged results follow the play,
 * not its wording; a later rename keeps the ID.
 */
export function withPlayIds<P extends { name: string; id?: string }>(plays: P[], prior: Doc<"strategies">[]): (P & { id: string })[] {
  const known = new Map<string, string>();
  for (const s of [...prior].reverse()) for (const p of expertPlaysOf(s.expert) as { name?: string; id?: string }[]) if (p.id && p.name) known.set(p.name.trim().toLowerCase(), p.id);
  const used = new Set<string>();
  return plays.map((p) => {
    let id = p.id ?? known.get(p.name.trim().toLowerCase());
    if (!id || used.has(id)) id = `pl_${Math.random().toString(36).slice(2, 10)}`;
    used.add(id);
    return { ...p, id };
  });
}

export const saveStrategy = internalMutation({
  args: { runId: v.id("workflowRuns"), strategy: v.string(), factIds: v.array(v.id("businessFacts")), acquisition: v.optional(v.string()), evidence: v.optional(v.string()) },
  handler: async (ctx, { runId, strategy, factIds, acquisition, evidence }) => {
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
    const contentPlans = CHANNEL_JOBS;
    const acq = acquisition ? (JSON.parse(acquisition) as { libraryVersion: string; profile: { types: string[]; dims: unknown }; adjustments: unknown; summary: string[]; limits?: { ownerHoursPerWeek: number | null } }) : null;
    if (acq) {
      const priorTypesSource = business.acquisition?.typesSource;
      await ctx.db.patch(business._id, { acquisition: { types: priorTypesSource === "owner" ? business.acquisition!.types : acq.profile.types, typesSource: priorTypesSource === "owner" ? "owner" : "inferred", dims: { ...((acq.profile.dims as Record<string, unknown> | undefined) ?? {}), ...((business.acquisition?.dims as Record<string, unknown> | undefined) ?? {}) }, updatedAt: now } });
    }
    // Pages the run read, so cited URLs keep their titles.
    const webSources = ((s as { webSources?: { url: string; title?: string }[] }).webSources ?? []).slice(0, 40);
    const strategyId = await ctx.db.insert("strategies", {
      orgId: run.orgId,
      businessId: business._id,
      goalId: goal._id,
      ...(acq ? { acquisition: { libraryVersion: acq.libraryVersion, profile: acq.profile, adjustments: acq.adjustments, summary: acq.summary, ...(acq.limits ? { limits: acq.limits } : {}) } } : {}),
      version,
      status: "needs_approval",
      summary: s.summary,
      audiences: s.audiences.slice(0, 5).map((a) => {
        const sources = resolveCites((a as { cites?: string[] }).cites, factIds, webSources);
        return { name: a.name, hypothesis: a.hypothesis, evidence: a.evidence, ...(sources.length ? { sources } : {}) };
      }),
      positioning: s.positioning,
      channels: s.channels
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 6)
        .map((c, i) => {
          const job = contentPlans[c.key];
          const adSpend = Math.max(0, majorToMinor(c.suggestedMonthlyAdSpend, goal.currency));
          const sources = resolveCites((c as { cites?: string[] }).cites, factIds, webSources);
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
            ...(sources.length ? { sources } : {}),
            capabilityNote:
              c.key === "search_ads" || c.key === "meta_ads"
                ? "Ads are created paused and only go live after you approve the exact campaign and budget."
                : c.key === "sales_outreach"
                  ? "Follow-ups for leads you already have. To find new ones, use Find customers (published business emails only)."
                  : undefined,
          };
        }),
      constraints: s.constraints.slice(0, 8),
      measurementPlan: s.measurementPlan,
      ...("diagnosis" in s
        ? {
            expert: (() => {
              const x = s as unknown as StrategyV2;
              const savedPlays = (x.plays ?? []).slice(0, 4);
              const expertPlays = withPlayIds(savedPlays.map((play) => ({ ...play, actionReadiness: actionReadinessOf(play.actionContract) })), prior);
              const growthPlanV9 = buildCurrentExpertGrowthPayload(expertPlays, x.economics);
              const ownerEconomics = x.snapshot?.ownerEconomics as { newCustomersPerMonth?: unknown } | undefined;
              const monthlyBudget = typeof x.snapshot?.monthlyAdBudget === "number" ? x.snapshot.monthlyAdBudget : minorToMajor(goal.monthlyAdBudgetMinor, goal.currency);
              const decisionAnalysis = x.decision && x.economics && savedPlays.length
                ? analyzeDecisionOptions(x.decision, savedPlays, x.economics, {
                    ...(typeof x.snapshot?.horizonDays === "number" ? { horizonDays: x.snapshot.horizonDays } : {}),
                    monthlyAdBudgetUsd: monthlyBudget,
                    ...(typeof acq?.limits?.ownerHoursPerWeek === "number" ? { ownerHoursPerWeek: acq.limits.ownerHoursPerWeek } : {}),
                    ...(typeof ownerEconomics?.newCustomersPerMonth === "number" ? { newCustomersPerMonth: ownerEconomics.newCustomersPerMonth } : {}),
                  })
                : undefined;
              return {
                version: growthPlanV9 ? EXPERT_PLAN_SCHEMA_VERSION : LEGACY_EXPERT_PLAN_SCHEMA_VERSION,
                diagnosis: x.diagnosis,
                affordableCac: x.affordableCac,
                notDoing: x.notDoing.slice(0, 10),
                northStar: x.northStar,
                leadingIndicators: x.leadingIndicators.slice(0, 6),
                phases: x.phases.slice(0, 4),
                weekOneChecklist: x.weekOneChecklist.slice(0, 7),
                risks: x.risks.slice(0, 6),
                ...(growthPlanV9 ? { growthPlanV9 } : { plays: expertPlays, economics: x.economics }),
                ...(x.decision ? { decision: x.decision } : {}),
                ...(decisionAnalysis ? { decisionAnalysis: { snapshotId: x.snapshot?.snapshotId ?? null, ...decisionAnalysis } } : {}),
                ...(x.snapshot ? { snapshot: x.snapshot } : {}),
                ...(x.quality ? { quality: x.quality } : {}),
                ...(x.goalGap ? { goalGap: x.goalGap } : {}),
                ...(x.constraintDiagnosis ? { constraintDiagnosis: x.constraintDiagnosis } : {}),
                ...(x.playbooks ? { playbooks: x.playbooks } : {}),
                ...(x.portfolio ? { portfolio: x.portfolio } : {}),
                ...(x.webSources?.length ? { webSources: x.webSources.slice(0, 40).map((w) => ({ url: w.url.slice(0, 500), ...(w.title ? { title: w.title.slice(0, 200) } : {}) })) } : {}),
              };
            })(),
          }
        : {}),
      reviewDate: new Date(now + 14 * DAY).toISOString().slice(0, 10),
      sourceFactIds: factIds.slice(0, 40),
      // What the run had spent when the plan was written (usage still settling after this is small: the final checks).
      generationCostMicros: run.actualMicros,
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
        assignmentUnit: e.assignmentUnit,
        assignmentMethod: e.assignmentMethod,
        primaryMetric: e.primaryMetric,
        primaryMetricType: e.primaryMetricType,
        denominator: e.denominator,
        baselineRate: e.baselineRate,
        baselineProvenance: e.baselineProvenance,
        baselineEvidenceRefs: e.baselineEvidenceRefs.slice(0, 12),
        baselineBasis: e.baselineBasis,
        minimumMeaningfulEffect: e.minimumMeaningfulEffect,
        plannedSamplePerArm: e.plannedSamplePerArm,
        plannedSampleBasis: e.plannedSampleBasis,
        guardrails: e.guardrails.slice(0, 4),
        durationDays: Math.max(7, Math.min(120, Math.round(e.durationDays))),
        stoppingRule: e.stoppingRule,
        status: "proposed",
        createdAt: now,
      });
    }
    // Approval request for the initial plan (always required).
    const policyVersion = await activePolicyVersion(ctx, run.orgId);
    const saved = await ctx.db.get(strategyId);
    const hash = saved ? await planContentHash(saved) : `strategy:${strategyId}:v${version}`;
    // What this version knew (facts, insights, research, versions), kept apart from the plan.
    if (evidence && evidence.length < 900_000) await ctx.db.insert("planEvidence", { orgId: run.orgId, strategyId, runId, data: evidence, hash: await sha256Hex(evidence), createdAt: now });
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
    await notifyOwners(ctx, run.orgId, `Growth plan v${version} is ready for your approval.`, "plan");
    // First win: right after the very first plan, draft 3 posts and a welcome email so the owner has work to approve today.
    const createdBy = run.createdBy;
    if (version === 1 && createdBy) await ctx.scheduler.runAfter(0, internal.content.startFirstWin, { orgId: run.orgId, userId: createdBy });
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

export type ArtifactInput = {
  kind: Doc<"artifacts">["kind"];
  channel: Doc<"artifacts">["channel"];
  title: string;
  headline?: string;
  body: string;
  /** Owner-facing strategy cue; not included in the publishable copy body. */
  contentAngle?: string;
  copyBrief?: CopyBrief;
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

type PersistedCopyBrief = Omit<CopyBrief, "offerFactIndexes" | "proofFactIndexes" | "supportingFactIndexes"> & {
  offerFactIds: Id<"businessFacts">[];
  proofFactIds: Id<"businessFacts">[];
  supportingFactIds: Id<"businessFacts">[];
};

function persistedCopyBrief(brief: CopyBrief | undefined, factIds: Id<"businessFacts">[]): PersistedCopyBrief | undefined {
  if (!brief) return undefined;
  const toIds = (indexes: number[]) => indexes.flatMap((index) => factIds[index] ? [factIds[index]!] : []);
  const { offerFactIndexes, proofFactIndexes, supportingFactIndexes, ...rest } = brief;
  return {
    ...rest,
    offerFactIds: toIds(offerFactIndexes),
    proofFactIds: toIds(proofFactIndexes),
    supportingFactIds: toIds(supportingFactIndexes),
  };
}

async function linkTrackingOn(ctx: MutationCtx, orgId: Id<"organizations">): Promise<boolean> {
  return (await ctx.db.get(orgId))?.linkTracking !== false;
}

export async function insertArtifact(
  ctx: MutationCtx,
  params: { orgId: Id<"organizations">; businessId: Id<"businesses">; runId?: Id<"workflowRuns">; factIds: Id<"businessFacts">[]; item: ArtifactInput; createdBy?: Id<"users"> },
) {
  const { item: raw } = params;
  const now = Date.now();
  // Tracked links: ads keep the real URL with UTM tags; everything else gets a short link.
  let item = raw;
  let linkId: Id<"links"> | null = null;
  if (raw.destinationUrl && (await linkTrackingOn(ctx, params.orgId))) {
    if (!shortenable(raw.kind)) item = { ...raw, destinationUrl: withUtm(raw.destinationUrl, utmFor(raw.channel)) ?? raw.destinationUrl };
    else {
      const made = await createLink(ctx, { orgId: params.orgId, url: raw.destinationUrl, label: raw.title, channel: raw.channel, source: "auto" });
      if (made) {
        linkId = made.id;
        item = { ...raw, destinationUrl: made.shortUrl, body: raw.body.split(raw.destinationUrl).join(made.shortUrl) };
      }
    }
  }
  const { valid, invalid } = validateFactIndexes(item.factIndexes, params.factIds.length);
  const risky = findRiskyClaims([
    item.title,
    item.headline,
    item.body,
    item.callToAction,
    item.altText,
    ...item.hashtags,
  ].filter(Boolean).join(" "));
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
    contentAngle: item.contentAngle,
    copyBrief: persistedCopyBrief(item.copyBrief, params.factIds),
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
    contentAngle: item.contentAngle,
    copyBrief: persistedCopyBrief(item.copyBrief, params.factIds),
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
  if (linkId) await ctx.db.patch(linkId, { artifactId });
  return artifactId;
}

const artifactInputValidator = v.object({
  kind: v.string(),
  channel: v.string(),
  title: v.string(),
  headline: v.optional(v.string()),
  body: v.string(),
  contentAngle: v.optional(v.string()),
  copyBrief: v.optional(v.object({
    reader: v.string(), situation: v.string(), awarenessStage: v.string(), relationshipStage: v.string(), objective: v.string(),
    offerFactIndexes: v.array(v.number()), problemJob: v.string(), trigger: v.string(), centralIdea: v.string(), objection: v.string(),
    proofFactIndexes: v.array(v.number()), prohibitedClaims: v.array(v.string()), channel: v.string(), format: v.string(), deliveryContext: v.string(),
    brandVoice: v.string(), approvedExamples: v.array(v.string()), cta: v.string(), afterAction: v.string(), trackingMetric: v.string(), trackingMethod: v.string(),
    supportingFactIndexes: v.array(v.number()), supportingSourceUrls: v.array(v.string()), unknowns: v.array(v.string()),
  })),
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
    if (ids.length) await notifyOwners(ctx, run.orgId, `${ids.length} new draft${ids.length === 1 ? "" : "s"} ready: ${run.title}.`, ids.length === 1 ? `content/${ids[0]}` : "content?status=in_review");
    return ids;
  },
});

/** Convert task outputs into artifact inputs (pure helpers used by jobs). */
export function socialToArtifacts(out: Omit<SocialPostsOutput, "posts"> & { copyBrief?: CopyBrief; posts: (SocialPostsOutput["posts"][number] & { angle?: string })[] }, now: number): Omit<ArtifactInput, "imageStorageId">[] {
  return out.posts.map((p, i) => ({
    kind: "social_post" as const,
    channel: p.channel,
    title: p.title,
    body: p.body,
    contentAngle: p.angle,
    copyBrief: out.copyBrief,
    hashtags: p.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)),
    altText: p.altText,
    imagePrompt: p.imageIdea,
    factIndexes: p.factIndexes,
    scheduledFor: now + (Math.max(1, Math.round(p.suggestedDay)) + i) * DAY,
    role: "social_media_manager" as const,
  }));
}

export function adsToArtifacts(out: Omit<AdDraftsOutput, "searchAds" | "metaAds"> & {
  copyBrief?: CopyBrief;
  searchAds: (AdDraftsOutput["searchAds"][number] & { angle?: string })[];
  metaAds: (AdDraftsOutput["metaAds"][number] & { angle?: string })[];
}, website?: string): Omit<ArtifactInput, "imageStorageId">[] {
  const items: Omit<ArtifactInput, "imageStorageId">[] = [];
  for (const a of out.searchAds.slice(0, 2)) {
    items.push({
      kind: "ad",
      channel: "google_search_ad",
      title: `Search ad: ${a.headlines[0] ?? "Draft"}`,
      headline: a.headlines.map((h) => h.slice(0, 30)).join(" | "),
      body: a.descriptions.map((d) => d.slice(0, 90)).join("\n"),
      contentAngle: a.angle,
      copyBrief: out.copyBrief,
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
      contentAngle: m.angle,
      copyBrief: out.copyBrief,
      destinationUrl: website,
      hashtags: [],
      imagePrompt: m.imageIdea,
      factIndexes: out.factIndexes,
      role: "ads_manager",
    });
  }
  return items;
}

export function emailToArtifacts(out: Omit<EmailSequenceOutput, "emails"> & { angle?: string; copyBrief?: CopyBrief; emails: (EmailSequenceOutput["emails"][number] & { angle?: string })[] }): Omit<ArtifactInput, "imageStorageId">[] {
  return [
    {
      kind: "email_sequence",
      channel: "email",
      title: out.name,
      headline: `${out.emails.length} emails · for ${out.audience}`,
      body: out.emails
        .map((e, i) => `Email ${i + 1} — day ${e.sendAfterDays}\nSubject: ${e.subject}\nPreview: ${e.previewText}\n\n${e.body}\n\n[${e.callToAction}]`)
        .join("\n\n———\n\n"),
      contentAngle: [out.angle, ...out.emails.map((email, i) => (email.angle ? `Email ${i + 1}: ${email.angle}` : ""))].filter(Boolean).join("\n").slice(0, 500) || undefined,
      copyBrief: out.copyBrief,
      hashtags: [],
      factIndexes: out.factIndexes,
      role: "customer_success_manager",
    },
  ];
}

export function seoToArtifacts(out: SeoBriefOutput): Omit<ArtifactInput, "imageStorageId">[] {
  const linked = (text: string, urls: string[]) => `${text}${urls.length ? ` ${urls.map((url) => `[Source](${url})`).join(" ")}` : ""}`;
  const outline = out.outline.map((o) => `## ${o.heading}\n${o.points.map((p) => `- ${p}`).join("\n")}`).join("\n\n");
  const faqs = out.faqs.length ? `## Frequently asked questions\n\n${out.faqs.map((faq) => `### ${faq.question}\n\n${linked(faq.answer, faq.sourceUrls)}`).join("\n\n")}` : "";
  const citableClaims = out.citableClaims.length ? `## Verified facts\n\n${out.citableClaims.map((claim) => `- ${linked(claim.statement, claim.sourceUrls)}`).join("\n")}` : "";
  const factIndexes = [...new Set([...out.factIndexes, ...out.faqs.flatMap((faq) => faq.factIndexes), ...out.citableClaims.flatMap((claim) => claim.factIndexes)])];
  const recommendation = out.recommendedAction === "refresh_existing_page"
    ? `## Recommended action: refresh existing page\n\nTarget page: ${out.targetPageUrl ?? ""}\n\nWhy: ${out.recommendationReason ?? ""}`
    : out.recommendedAction === "create_new_page"
      ? `## Recommended action: create a new page\n\nWhy: ${out.recommendationReason ?? ""}`
      : "";
  return [
    {
      kind: "blog_post",
      channel: "blog",
      title: out.title,
      headline: out.metaDescription,
      body: [recommendation, `## Quick answer\n\n${out.answerFirst}`, outline, "---", out.draft, faqs, citableClaims].filter(Boolean).join("\n\n"),
      destinationUrl: out.recommendedAction === "refresh_existing_page" && out.targetPageUrl ? out.targetPageUrl : undefined,
      hashtags: [out.primaryKeyword, ...out.secondaryKeywords].slice(0, 8),
      factIndexes,
      role: "seo_specialist",
    },
  ];
}

export const saveChatResult = internalMutation({
  args: { runId: v.id("workflowRuns"), messageId: v.id("chatMessages"), result: v.string(), isFixture: v.boolean(), customAgentId: v.optional(v.id("customAgents")) },
  handler: async (ctx, { runId, messageId, result, customAgentId }) => {
    const run = await ensureRunOrg(ctx, runId);
    const org = await ctx.db.get(run.orgId);
    const out = JSON.parse(result) as ChatIntentOutput;
    if (validateActionDependencies(out.actions).length) {
      throw appError("INVALID", "The action plan has an invalid prerequisite order. Please try again.");
    }
    const profile = customAgentId ? await ctx.db.get(customAgentId) : null;
    if (customAgentId && (!profile || profile.orgId !== run.orgId || profile.status !== "active")) throw appError("NOT_FOUND", "We couldn't find that specialist.");
    const specialist = run.customAgentSnapshot ?? profile;
    const allowedActions = specialist ? new Set(specialist.allowedActions) : null;
    const now = Date.now();
    const cardIds: Id<"actionCards">[] = [];
    let priority = 1;
    // Say the word and things happen: safe internal work starts at once, within a per-wish budget.
    let autoBudget = WISH_AUTO_BUDGET_MICROS;
    const started: string[] = [];
    const waiting: string[] = [];
    const budgetBlocked: string[] = [];
    const permittedActions = out.actions.map((action, sourceIndex) => ({ action, sourceIndex })).filter(({ action }) => !allowedActions || allowedActions.has(action.kind));
    const selectedActions = permittedActions.slice(0, specialist?.maxActionsPerRun ?? 4);
    const restrictedCount = out.actions.length - permittedActions.length;
    const cappedCount = permittedActions.length - selectedActions.length;
    const selectedSourceIndexes = new Set(selectedActions.map(({ sourceIndex }) => sourceIndex));
    const cardsBySourceIndex = new Map<number, Id<"actionCards">>();
    const blockedSourceIndexes = new Set<number>();
    let specialistBudgetMicros = specialist ? creditsToMicros(specialist.maxRunCredits) : Number.POSITIVE_INFINITY;
    if (specialist) specialistBudgetMicros = Math.max(0, specialistBudgetMicros - run.estimateMicros);
    for (const { action: a, sourceIndex } of selectedActions) {
      const unavailablePrerequisite = a.dependsOnActionIndexes.find((index) => !selectedSourceIndexes.has(index) || blockedSourceIndexes.has(index));
      const dependencyIds = a.dependsOnActionIndexes.map((index) => cardsBySourceIndex.get(index)).filter((id): id is Id<"actionCards"> => Boolean(id));
      const job = jobForAction(a.kind, a.channel);
      const builtinAgent = specialist ? null : agentForAction(a.kind, a.channel, a.brief ?? "");
      const plan = job ? planJob(job, { quantity: a.quantity, images: job === "content_social" ? 1 : 0, channel: a.channel }, { fixture: org?.kind === "demo" }) : null;
      const external = a.kind === "ad_change" || a.kind === "email_send" || a.kind === "schedule_content";
      const isLink = a.kind === "connect_account" || a.kind === "set_up_autopilot";
      const cost = plan ? estimateJobMicros(plan) : 0;
      const overSpecialistBudget = Boolean(specialist && cost > specialistBudgetMicros);
      if (specialist && !overSpecialistBudget) specialistBudgetMicros -= cost;
      const prerequisiteReason = unavailablePrerequisite === undefined
        ? undefined
        : `This depends on “${out.actions[unavailablePrerequisite]?.title ?? "an earlier action"}”, which is unavailable under this specialist's action permissions or run limit.`;
      const blockedReason = prerequisiteReason ?? (overSpecialistBudget
        ? `This exceeds ${specialist?.name}'s configured ${specialist?.maxRunCredits}-credit per-run budget.`
        : job || a.kind === "note" || isLink ? undefined : "This needs a connected account and an approval rule before ClimbOS can prepare it.");
      const cardStatus = prerequisiteReason || overSpecialistBudget || (!job && a.kind !== "note" && !isLink) ? "blocked" : "proposed";
      const cardId = await ctx.db.insert("actionCards", {
        orgId: run.orgId,
        ...(dependencyIds.length ? { dependsOnActionCardIds: dependencyIds } : {}),
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
        payload: JSON.stringify({ job, channel: a.channel, quantity: a.quantity, brief: a.brief?.slice(0, 1500) ?? "", ...(customAgentId ? { customAgentId, customAgentParentRunId: run._id } : {}), ...(builtinAgent ? { agentArchetypeId: builtinAgent.id } : {}) }),
        costEstimateMicros: cost,
        externalEffect: external,
        status: cardStatus,
        blockedReason,
        priority: priority++,
        createdAt: now,
        updatedAt: now,
      });
      cardIds.push(cardId);
      cardsBySourceIndex.set(sourceIndex, cardId);
      if (cardStatus === "blocked") blockedSourceIndexes.add(sourceIndex);
      const card = await ctx.db.get(cardId);
      if (!prerequisiteReason && dependencyIds.length === 0 && !specialist && org && card && job && !external && AUTO_RUN_KINDS.has(a.kind) && cost <= autoBudget && run.createdBy) {
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
      if (job || isLink) {
        if (overSpecialistBudget) budgetBlocked.push(a.title);
        else waiting.push(a.title);
      }
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
      customAgentId,
      text: `${specialist ? selectedActions.length ? `${specialist.name} prepared suggestions for your review.` : `${specialist.name} could not prepare an action within its configured capabilities; no work was started.` : out.reply}${specialist && restrictedCount ? ` ${restrictedCount} suggestion${restrictedCount === 1 ? " was" : "s were"} outside the configured capabilities and was not added.` : ""}${specialist && cappedCount ? ` ${cappedCount} additional suggestion${cappedCount === 1 ? " was" : "s were"} left out to stay within the action limit.` : ""}${specialist && budgetBlocked.length ? ` ${budgetBlocked.length} action${budgetBlocked.length === 1 ? " was" : "s were"} blocked by the per-run budget.` : ""}${status}${out.followUp ? `\n\n${out.followUp}` : ""}`.slice(0, 1600),
      understood: out.understood?.slice(0, 300) || undefined,
      roles: [specialist ? AGENT_ARCHETYPE_BY_ID.get(specialist.archetypeId)?.role ?? "coo" : "coo"],
      actionCardIds: cardIds,
      status: "done",
      replyTo: messageId,
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
      replyTo: messageId,
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
