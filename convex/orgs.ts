import { majorToMinor, minorToMajor } from "../shared/economics/currency";
import { isUnlimited } from "../shared/economics/credits";
import { v } from "convex/values";
import { isIndustryBusinessTypeId } from "../shared/knowledge/industryCatalog";
import type { GoalTarget } from "../shared/agents/goal";
import { accountWorkspaces, ensureAccountForOwner } from "./lib/accounts";
import { recordReferral } from "./referrals";
import { activePackage } from "./lib/access";
import { packageOf } from "../shared/economics";
import { getLiveConfig } from "./lib/config";
import { resolveAiMode } from "./lib/aiMode";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { assertNoActiveRun, createRunWithReservation, latestRunOfKind } from "./engine";
import { audit } from "./lib/audit";
import { estimateJobMicros, planJob } from "./lib/jobPlans";
import { createOnboardingPeriod } from "./lib/periods";
import { appError, isOperator, optionalUser, requireOrgAccess, requireUser } from "./lib/tenancy";
import { chargeableAccess, isPaid } from "./lib/access";
import { can } from "../shared/policy";
import { groupExactDuplicateFacts } from "../shared/agents/factDuplicates";
import { BUSINESS_LIFECYCLE_STAGES } from "../shared/agents/lifecycle";
import type { RunPreview } from "./content";
import { defaultModelRoute, resolveModelRoute } from "./lib/modelRoute";
import type { ModelRoute } from "../shared/ai/modelChoice";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "workspace";
}

function randomSuffix(): string {
  const b = new Uint8Array(3);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 5);
}

export async function uniqueSlug(ctx: MutationCtx, name: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const slug = `${slugify(name)}-${randomSuffix()}`;
    const exists = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!exists) return slug;
  }
  throw appError("INVALID", "Couldn't create a workspace address. Please try again.");
}

function normalizeWebsite(input?: string): string | undefined {
  if (!input) return undefined;
  let s = input.trim();
  if (!s) return undefined;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!["http:", "https:"].includes(u.protocol) || !u.hostname.includes(".")) return undefined;
    return u.toString().replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

/** Signed-in user, their workspaces and whether they're an operator. */
/**
 * Before a new workspace exists (onboarding step 1): can its first research run on Expert?
 * New workspaces join the owner's account, so the account's package decides (comps included).
 */
export const newWorkspaceAiMode = query({
  args: {},
  handler: async (ctx) => {
    const user = await optionalUser(ctx);
    if (!user) return { expertUnlocked: false, estimates: { onboarding_research: onboardingResearchEstimates(await defaultModelRoute(ctx)) } };
    const account = await ctx.db.query("accounts").withIndex("by_owner", (q) => q.eq("ownerUserId", user._id)).first();
    if (!account || account.suspendedAt) return { expertUnlocked: false, estimates: { onboarding_research: onboardingResearchEstimates(await defaultModelRoute(ctx)) } };
    const first = (await accountWorkspaces(ctx, account._id))[0];
    return {
      expertUnlocked: first ? await isPaid(ctx, { _id: first._id, accountId: account._id }) : false,
      estimates: { onboarding_research: onboardingResearchEstimates(await defaultModelRoute(ctx)) },
    };
  },
});

function onboardingResearchEstimates(route: ModelRoute) {
  return {
    basic: estimateJobMicros(planJob("onboarding_research", { pages: 3 }, { mode: "basic" }), { route }),
    expert: estimateJobMicros(planJob("onboarding_research", { pages: 3 }, { mode: "expert" }), { route }),
  };
}

export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await optionalUser(ctx);
    if (!user) return null;
    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(50);
    const orgs = [];
    for (const m of memberships) {
      if (m.status !== "active") continue;
      const org = await ctx.db.get(m.orgId);
      if (!org || org.deletedAt) continue;
      orgs.push({ slug: org.slug, name: org.name, kind: org.kind, role: m.role, onboardingStep: org.onboardingStep });
    }
    return {
      userId: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      isAnonymous: Boolean(user.isAnonymous),
      isOperator: await isOperator(ctx),
      orgs,
    };
  },
});

export const createWorkspace = mutation({
  args: {
    businessName: v.string(),
    website: v.optional(v.string()),
    timezone: v.optional(v.string()),
    currency: v.optional(v.string()),
    /** Referral code from a share link (stored by /r/CODE). */
    referralCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.isAnonymous) throw appError("FORBIDDEN", "Create a free account to save your own workspace.");
    const name = args.businessName.trim().slice(0, 80);
    if (!name) throw appError("INVALID", "Please enter your business name.");
    // Check the website before anything is created, so a typo never leaves a half-made workspace.
    if (args.website?.trim() && !normalizeWebsite(args.website)) {
      throw appError("INVALID", "That doesn't look like a website address. Try something like example.com.");
    }
    const name0 = args.businessName.trim().slice(0, 80);
    // Workspaces share the owner's account: free accounts have one, packages allow more.
    const accountId = await ensureAccountForOwner(ctx, user, name0 || "My account");
    const owned = await accountWorkspaces(ctx, accountId);
    const sub = await activePackage(ctx, { _id: owned[0]?._id ?? (accountId as unknown as Id<"organizations">), accountId });
    const config = await getLiveConfig(ctx);
    const allowed = sub ? config.workspaces[packageOf(sub.planKey)] : config.workspaces.free;
    if (!isUnlimited(allowed) && owned.length >= allowed) {
      throw appError(sub ? "LIMIT_REACHED" : "PAYMENT_REQUIRED", sub ? `Your package includes ${allowed} workspaces. Upgrade to add more.` : "Free accounts have one workspace. Choose a package to add more.");
    }
    const now = Date.now();
    const timezone = (args.timezone ?? "UTC").slice(0, 64);
    const currency = (args.currency ?? "USD").toUpperCase().slice(0, 3);
    const slug = await uniqueSlug(ctx, name);
    const orgId = await ctx.db.insert("organizations", {
      name,
      slug,
      kind: "customer",
      createdBy: user._id,
      timezone,
      currency,
      onboardingStep: "research",
      accountId,
      createdAt: now,
    });
    await ctx.db.insert("memberships", { orgId, userId: user._id, role: "owner", status: "active", createdAt: now });
    await ctx.db.insert("businesses", {
      orgId,
      name,
      website: normalizeWebsite(args.website),
      socialUrls: [],
      businessType: "other",
      currency,
      timezone,
      researchStatus: "not_started",
      successEvents: [],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("autonomyPolicies", {
      orgId,
      version: 1,
      mode: "review",
      approvalRoles: ["owner", "admin", "reviewer"],
      allowRecurringPostsUnderCalendar: false,
      allowAdPauseRules: true,
      maxMonthlyAdSpendMinor: 0,
      currency,
      approvalTtlHours: 72,
      createdBy: user._id,
      createdAt: now,
      active: true,
    });
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .unique();
    if (!prefs) await ctx.db.insert("userPreferences", { userId: user._id, digest: "weekly", usageAlerts: true });
    await createOnboardingPeriod(ctx, orgId, accountId);
    if (owned.length === 0) await recordReferral(ctx, accountId, args.referralCode);
    await audit(ctx, { orgId, actorType: "user", actorId: user._id, action: "workspace.created", summary: `Workspace "${name}" created.` });
    return { slug, orgId };
  },
});

/** Start (or restart) business research. Owner-pasted text works when the site can't be read. */
export const startResearch = mutation({
  args: { slug: v.string(), website: v.optional(v.string()), ownerText: v.optional(v.string()), aiMode: v.optional(v.union(v.literal("basic"), v.literal("expert"))), model: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!business) throw appError("NOT_FOUND", "Business not found.");
    const website = args.website !== undefined ? normalizeWebsite(args.website) : business.website;
    if (args.website !== undefined && args.website.trim() && !website) {
      throw appError("INVALID", "That doesn't look like a website address. Try something like example.com.");
    }
    const ownerText = args.ownerText?.trim().slice(0, 6000);
    if (!website && !ownerText) throw appError("INVALID", "Add your website, or describe your business in a few sentences.");
    await assertNoActiveRun(ctx, org._id, "onboarding_research", "Your team is already researching your business.");
    await ctx.db.patch(business._id, {
      website,
      researchStatus: ownerText && !website ? "owner_supplied" : "running",
      updatedAt: Date.now(),
    });
    if (ownerText) {
      // Owner-supplied information is recorded as such, with its own source.
      const sourceId = await ctx.db.insert("factSources", {
        orgId: org._id,
        businessId: business._id,
        kind: "owner_text",
        title: "Described by the owner",
        excerpt: ownerText.slice(0, 1000),
        fetchedAt: Date.now(),
        status: "ok",
        expiresAt: Date.now() + 365 * 86_400_000,
      });
      void sourceId;
    }
    const aiMode = await resolveAiMode(ctx, org, "onboarding_research", args.aiMode);
    const modelRoute = await resolveModelRoute(ctx, user._id, args.model);
    const plan = planJob("onboarding_research", { pages: website ? 3 : 0 }, { fixture: org.kind === "demo", mode: aiMode });
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: plan.kind,
      title: plan.title,
      roles: plan.roles,
      input: { website, hasOwnerText: Boolean(ownerText) },
      steps: website ? plan.steps : plan.steps.filter((s) => s.kind !== "research"),
      meters: website ? plan.meters : { searchCalls: 2 },
      createdBy: user._id,
      isFixture: org.kind === "demo",
      aiMode,
      modelRoute,
    });
    // A research refresh after setup doesn't send the owner back into onboarding.
    if (org.onboardingStep !== "done") await ctx.db.patch(org._id, { onboardingStep: "research" });
    await ctx.scheduler.runAfter(0, internal.jobs.onboardingResearch, { runId, ownerText });
    return { runId };
  },
});

export const onboardingState = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const facts = business
      ? await ctx.db
          .query("businessFacts")
          .withIndex("by_business", (q) => q.eq("businessId", business._id))
          .take(100)
      : [];
    const sourceIds = [...new Set(facts.flatMap((f) => f.sourceIds))];
    const sources = new Map<string, { url?: string; title?: string; kind: string; fetchedAt: number }>();
    for (const id of sourceIds.slice(0, 100)) {
      const s = await ctx.db.get(id);
      if (s) sources.set(id, { url: s.url, title: s.title, kind: s.kind, fetchedAt: s.fetchedAt });
    }
    // By kind, so Climb AI and wish runs never push these out of view.
    const researchRun = await latestRunOfKind(ctx, org._id, "onboarding_research");
    const strategyRun = await latestRunOfKind(ctx, org._id, "strategy");
    const researchSteps = researchRun
      ? await ctx.db
          .query("workflowSteps")
          .withIndex("by_run", (q) => q.eq("runId", researchRun._id))
          .take(20)
      : [];
    let researchPreview: RunPreview | null = null;
    if (researchRun?.preview) {
      try { researchPreview = JSON.parse(researchRun.preview) as RunPreview; } catch { /* A malformed preview must not block fact review. */ }
    }
    const goal = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active"))
      .first();
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    const strategy = await ctx.db
      .query("strategies")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .first();
    const access = await chargeableAccess(ctx, org);
    return {
      org: { slug: org.slug, name: org.name, kind: org.kind, onboardingStep: org.onboardingStep, currency: org.currency, timezone: org.timezone },
      role,
      business: business
        ? {
            id: business._id,
            name: business.name,
            website: business.website ?? null,
            summary: business.summary ?? null,
            businessType: business.businessType,
            industryBusinessTypeId: business.industryBusinessTypeId ?? null,
            lifecycleStage: business.lifecycleStage ?? null,
            researchStatus: business.researchStatus,
            successEvents: business.successEvents,
            currency: business.currency,
            timezone: business.timezone,
            hasInsights: Boolean(business.insights),
            insightsAt: business.insights?.generatedAt ?? null,
          }
        : null,
      facts: facts
        .filter((f) => f.reviewState !== "rejected")
        .map((f) => ({
          id: f._id,
          category: f.category,
          statement: f.statement,
          confidence: f.confidence,
          reviewState: f.reviewState,
          provenance: f.provenance,
          sources: f.sourceIds.map((id) => sources.get(id)).filter(Boolean),
        })),
      research: researchRun
        ? {
            id: researchRun._id,
            status: researchRun.status,
            userMessage: researchRun.userMessage ?? null,
            // Why it failed, so the UI can offer the right way forward.
            failureKind: researchRun.status !== "failed"
              ? null
              : /^(provider_unavailable|provider_error|timeout|rate_limited)/.test(researchRun.error ?? "")
                ? ("ai_unavailable" as const)
                : /^no_content/.test(researchRun.error ?? "")
                  ? ("site_unreadable" as const)
                  : ("other" as const),
            engine: researchRun.engine ?? null,
            preview: researchPreview,
            createdAt: researchRun.createdAt,
            finishedAt: researchRun.finishedAt ?? null,
            steps: researchSteps.filter((s) => s.index < 1000).map((s) => ({ label: s.label, status: s.status, kind: s.kind, startedAt: s.startedAt ?? null, finishedAt: s.finishedAt ?? null })),
          }
        : null,
      strategyRun: strategyRun ? { id: strategyRun._id, status: strategyRun.status, userMessage: strategyRun.userMessage ?? null, createdAt: strategyRun.createdAt } : null,
      firstWinRunIds: org.firstWinRunIds ?? [],
      goal: goal
        ? { kind: goal.kind, statement: goal.statement, target: goal.target ?? null, horizonDays: goal.horizonDays, monthlyAdBudget: minorToMajor(goal.monthlyAdBudgetMinor, goal.currency), currency: goal.currency, reviewDay: goal.reviewDay ?? null }
        : null,
      autonomy: policy?.mode ?? "review",
      /** The ad budget editors may set without an owner or admin (raising it needs one). */
      adCap: (policy?.maxMonthlyAdSpendMinor ?? 0) / 100,
      strategy: strategy ? { id: strategy._id, status: strategy.status, version: strategy.version, createdAt: strategy.createdAt } : null,
      canRunAi: access.allowed,
      accessMessage: access.allowed ? null : access.message,
    };
  },
});

async function requireFactInOrg(ctx: MutationCtx, slug: string, factId: Id<"businessFacts">) {
  const access = await requireOrgAccess(ctx, { slug }, "edit");
  const fact = await ctx.db.get(factId);
  if (!fact || fact.orgId !== access.org._id) throw appError("NOT_FOUND", "We couldn't find that fact.");
  return { ...access, fact };
}

export const reviewFact = mutation({
  args: {
    slug: v.string(),
    factId: v.id("businessFacts"),
    action: v.union(v.literal("confirm"), v.literal("reject"), v.literal("edit")),
    statement: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { fact, user, org } = await requireFactInOrg(ctx, args.slug, args.factId);
    const businessFacts = await ctx.db.query("businessFacts").withIndex("by_business", (q) => q.eq("businessId", fact.businessId)).take(300);
    const group = groupExactDuplicateFacts(businessFacts.map((row) => ({ ...row, id: String(row._id), state: row.reviewState })))
      .find(({ primary, duplicates }) => [primary, ...duplicates].some((row) => row.id === String(fact._id)));
    const reviewTargets = group ? [group.primary, ...group.duplicates].map((row) => businessFacts.find((candidate) => String(candidate._id) === row.id)!).filter((row) => row.orgId === org._id) : [fact];
    const now = Date.now();
    if (args.action === "edit") {
      const statement = args.statement?.trim().slice(0, 400);
      if (!statement) throw appError("INVALID", "The fact can't be empty.");
      for (const target of reviewTargets) await ctx.db.patch(target._id, { statement, reviewState: "edited", confidence: "high", updatedBy: user._id, verifiedAt: now, updatedAt: now });
    } else {
      for (const target of reviewTargets) await ctx.db.patch(target._id, { reviewState: args.action === "confirm" ? "confirmed" : "rejected", updatedBy: user._id, ...(args.action === "confirm" ? { verifiedAt: now } : {}), updatedAt: now });
    }
    if (["product", "audience", "pricing", "offer", "competitor"].includes(fact.category)) {
      const business = await ctx.db.get(fact.businessId);
      if (business?.orgId === org._id) await ctx.db.patch(business._id, { competitorResearchNextAt: Date.now(), competitorResearchStaleAt: Date.now(), updatedAt: Date.now() });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `fact.${args.action}`, subjectType: "fact", subjectId: fact._id, summary: `Fact ${args.action}ed${reviewTargets.length > 1 ? ` with ${reviewTargets.length - 1} duplicate${reviewTargets.length === 2 ? "" : "s"}` : ""}.` });
  },
});

export const confirmAllFacts = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const facts = await ctx.db
      .query("businessFacts")
      .withIndex("by_org_state", (q) => q.eq("orgId", org._id).eq("reviewState", "needs_review"))
      .take(100);
    const now = Date.now();
    for (const f of facts) await ctx.db.patch(f._id, { reviewState: "confirmed", updatedBy: user._id, verifiedAt: now, updatedAt: now });
    if (facts.some((fact) => ["product", "audience", "pricing", "offer", "competitor"].includes(fact.category))) {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
      if (business) {
        const now = Date.now();
        await ctx.db.patch(business._id, { competitorResearchNextAt: now, competitorResearchStaleAt: now, updatedAt: now });
      }
    }
    if (org.onboardingStep !== "done") await ctx.db.patch(org._id, { onboardingStep: "goal" });
    return facts.length;
  },
});

export const addFact = mutation({
  args: {
    slug: v.string(),
    category: v.union(
      v.literal("product"),
      v.literal("audience"),
      v.literal("pricing"),
      v.literal("brand"),
      v.literal("offer"),
      v.literal("proof"),
      v.literal("competitor"),
      v.literal("other"),
    ),
    statement: v.string(),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!business) throw appError("NOT_FOUND", "Business not found.");
    const statement = args.statement.trim().slice(0, 400);
    if (!statement) throw appError("INVALID", "Please write the fact.");
    const now = Date.now();
    const factId = await ctx.db.insert("businessFacts", {
      orgId: org._id,
      businessId: business._id,
      category: args.category,
      statement,
      confidence: "high",
      reviewState: "confirmed",
      provenance: "owner_supplied",
      sourceIds: [],
      updatedBy: user._id,
      verifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    if (["product", "audience", "pricing", "offer", "competitor"].includes(args.category)) {
      await ctx.db.patch(business._id, { competitorResearchNextAt: now, competitorResearchStaleAt: now, updatedAt: now });
    }
    return factId;
  },
});

export const saveBusinessDetails = mutation({
  args: {
    slug: v.string(),
    name: v.optional(v.string()),
    /** Empty string clears it. */
    website: v.optional(v.string()),
    businessType: v.optional(
      v.union(v.literal("saas"), v.literal("ecommerce"), v.literal("services"), v.literal("physical_products"), v.literal("other")),
    ),
    /** Exact owner selection from the curated 500-type catalog; null clears it. */
    industryBusinessTypeId: v.optional(v.union(v.string(), v.null())),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    /** Owner-reported business stage; null clears it. Website copy never sets this field. */
    lifecycleStage: v.optional(v.union(v.literal("idea_validation"), v.literal("pre_launch"), v.literal("early_traction"), v.literal("growth"), v.literal("maturity"), v.literal("decline"), v.null())),
    successEvents: v.optional(v.array(v.object({ key: v.string(), label: v.string(), definition: v.string(), confirmed: v.boolean() }))),
  },
  handler: async (ctx, args) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!business) throw appError("NOT_FOUND", "Business not found.");
    const currency = args.currency?.toUpperCase().slice(0, 3);
    if (currency && !/^[A-Z]{3}$/.test(currency)) throw appError("INVALID", "Currency must be a 3-letter code like USD.");
    const website = args.website === undefined ? undefined : args.website.trim() ? normalizeWebsite(args.website) : "";
    if (website === undefined && args.website?.trim()) throw appError("INVALID", "That doesn't look like a website address. Try something like example.com.");
    const businessChanged = Boolean((args.name && args.name.trim() !== business.name) || (website !== undefined && website !== (business.website ?? "")) || (args.businessType && args.businessType !== business.businessType));
    const stageChanged = args.lifecycleStage !== undefined && args.lifecycleStage !== (business.lifecycleStage?.stage ?? null);
    if (args.lifecycleStage !== undefined && role !== "owner" && role !== "admin") throw appError("FORBIDDEN", "Only a workspace owner or admin can set the business stage.");
    if (args.industryBusinessTypeId !== undefined && args.industryBusinessTypeId !== null && !isIndustryBusinessTypeId(args.industryBusinessTypeId)) throw appError("INVALID", "Choose a business type from the ClimbOS industry catalog.");
    if (args.lifecycleStage !== undefined && args.lifecycleStage !== null && !(BUSINESS_LIFECYCLE_STAGES as readonly string[]).includes(args.lifecycleStage)) throw appError("INVALID", "Choose a valid business stage.");
    const now = Date.now();
    const industryTypeChanged = args.industryBusinessTypeId !== undefined && args.industryBusinessTypeId !== (business.industryBusinessTypeId ?? null);
    await ctx.db.patch(business._id, {
      ...(args.name ? { name: args.name.trim().slice(0, 80) } : {}),
      ...(website !== undefined ? { website: website || undefined } : {}),
      ...(args.businessType ? { businessType: args.businessType } : {}),
      ...(industryTypeChanged ? { industryBusinessTypeId: args.industryBusinessTypeId || undefined } : {}),
      ...(currency ? { currency } : {}),
      ...(args.timezone ? { timezone: args.timezone.slice(0, 64) } : {}),
      ...(stageChanged ? { lifecycleStage: args.lifecycleStage === null ? undefined : { stage: args.lifecycleStage!, provenance: "owner_reported" as const, updatedAt: now } } : {}),
      ...(args.successEvents ? { successEvents: args.successEvents.slice(0, 6) } : {}),
      ...(businessChanged ? { competitorResearchNextAt: Date.now(), competitorResearchStaleAt: Date.now() } : {}),
      updatedAt: now,
    });
    await ctx.db.patch(org._id, {
      ...(args.name ? { name: args.name.trim().slice(0, 80) } : {}),
      ...(currency ? { currency } : {}),
      ...(args.timezone ? { timezone: args.timezone.slice(0, 64) } : {}),
    });
    if (stageChanged) await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "business.lifecycle_stage_changed", summary: args.lifecycleStage === null ? "Cleared the owner-reported business stage." : `Set the owner-reported business stage to ${args.lifecycleStage!.replace(/_/g, " ")}.` });
    if (industryTypeChanged) await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "business.industry_type_changed", summary: args.industryBusinessTypeId ? `Selected industry playbook type ${args.industryBusinessTypeId}.` : "Cleared the selected industry playbook type." });
  },
});

/** Set low-cadence competitor research; 0 stops scheduled refreshes. */
export const setCompetitorResearchRefreshDays = mutation({
  args: { slug: v.string(), days: v.union(v.literal(0), v.literal(30), v.literal(60), v.literal(90), v.literal(180)) },
  handler: async (ctx, { slug, days }) => {
    const { org, role, user } = await requireOrgAccess(ctx, { slug }, "manage_team");
    if (role !== "owner" && role !== "admin") throw appError("FORBIDDEN", "Only an owner or admin can change scheduled research spending.");
    const businesses = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(50);
    await ctx.db.patch(org._id, { competitorResearchRefreshDays: days });
    for (const business of businesses) if (business.insights) {
      const nextAt = days === 0 ? undefined : business.competitorResearchStaleAt ?? (business.competitorResearchCompletedAt ?? business.insights.generatedAt) + days * 86_400_000;
      await ctx.db.patch(business._id, { competitorResearchNextAt: nextAt, competitorResearchLastStatus: undefined });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "competitor_research.cadence_changed", summary: days === 0 ? "Disabled scheduled competitor research." : `Set competitor research to refresh every ${days} days.` });
  },
});

/** A goal target with real numbers only: blanks stay null, never zero. */
function cleanTarget(t: GoalTarget): GoalTarget | undefined {
  const num = (n: number | null) => (n !== null && Number.isFinite(n) && n >= 0 && n <= 1e12 ? n : null);
  const out = { metric: t.metric, mode: t.mode, baseline: num(t.baseline), desired: num(t.desired) };
  if (out.desired !== null && out.desired <= 0) throw appError("INVALID", "The goal number must be above 0.");
  if (out.mode === "total" && out.desired !== null && out.baseline !== null && out.desired <= out.baseline) throw appError("INVALID", "Your goal total must be higher than today's number.");
  return out.desired === null && out.baseline === null ? undefined : out;
}

export const setGoal = mutation({
  args: {
    slug: v.string(),
    kind: v.union(v.literal("more_sales"), v.literal("more_customers"), v.literal("more_reach"), v.literal("custom")),
    statement: v.string(),
    target: v.optional(v.object({ metric: v.union(v.literal("customers"), v.literal("revenue_month"), v.literal("other")), baseline: v.union(v.number(), v.null()), desired: v.union(v.number(), v.null()), mode: v.union(v.literal("total"), v.literal("incremental")) })),
    horizonDays: v.number(),
    monthlyAdBudget: v.number(),
    reviewDay: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!business) throw appError("NOT_FOUND", "Business not found.");
    if (!Number.isFinite(args.monthlyAdBudget) || args.monthlyAdBudget < 0 || args.monthlyAdBudget > 1_000_000) {
      throw appError("INVALID", "Enter a monthly ad budget between 0 and 1,000,000 (0 means no ads).");
    }
    const horizonDays = Math.max(14, Math.min(365, Math.round(args.horizonDays)));
    const statement = args.statement.trim().slice(0, 300);
    if (!statement) throw appError("INVALID", "Tell us your goal in a sentence.");
    const budgetMinor = majorToMinor(args.monthlyAdBudget, business.currency);
    const target = args.target ? cleanTarget(args.target) : undefined;
    // The ad budget is also the spending cap: anyone who edits may lower it, only an owner or admin may raise it.
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    if (policy && budgetMinor > policy.maxMonthlyAdSpendMinor && !can(role, "manage_policies")) {
      throw appError("FORBIDDEN", "Only an owner or admin can raise the ad budget.");
    }
    const active = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active"))
      .take(5);
    for (const g of active) await ctx.db.patch(g._id, { status: "archived" });
    await ctx.db.insert("goals", {
      orgId: org._id,
      businessId: business._id,
      kind: args.kind,
      statement,
      ...(target ? { target } : {}),
      horizonDays,
      monthlyAdBudgetMinor: budgetMinor,
      currency: business.currency,
      reviewDay: args.reviewDay,
      status: "active",
      createdBy: user._id,
      createdAt: Date.now(),
    });
    // The ad envelope in the active policy follows the goal.
    if (policy && policy.maxMonthlyAdSpendMinor !== budgetMinor) {
      await ctx.db.patch(policy._id, { active: false });
      const { _id: _omit, _creationTime: _ct, ...rest } = policy;
      await ctx.db.insert("autonomyPolicies", { ...rest, version: policy.version + 1, maxMonthlyAdSpendMinor: budgetMinor, createdBy: user._id, createdAt: Date.now(), active: true });
    }
    if (org.onboardingStep !== "done") await ctx.db.patch(org._id, { onboardingStep: "preferences" });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "goal.set", summary: `Goal set: ${statement}` });
  },
});

export const setAutonomy = mutation({
  args: { slug: v.string(), mode: v.union(v.literal("copilot"), v.literal("review"), v.literal("bounded_autopilot")) },
  handler: async (ctx, { slug, mode }) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug }, "edit");
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    if (!policy) throw appError("NOT_FOUND", "Policy not found.");
    if (policy.mode !== mode) {
      // Approval rules are policies: owners and admins only. Bounded Autopilot also needs a paid plan.
      if (!can(role, "manage_policies")) throw appError("FORBIDDEN", "Only an owner or admin can change how work is approved.");
      if (mode === "bounded_autopilot" && org.kind !== "demo" && !(await isPaid(ctx, org))) {
        throw appError("PAYMENT_REQUIRED", "Bounded Autopilot comes with a paid plan.");
      }
      await ctx.db.patch(policy._id, { active: false });
      const { _id: _omit, _creationTime: _ct, ...rest } = policy;
      await ctx.db.insert("autonomyPolicies", { ...rest, version: policy.version + 1, mode, createdBy: user._id, createdAt: Date.now(), active: true });
      // A policy change invalidates pending approvals bound to the old version.
      const pending = await ctx.db
        .query("approvals")
        .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "approved"))
        .take(200);
      for (const a of pending) {
        if (a.subjectType !== "strategy") await ctx.db.patch(a._id, { status: "invalidated", invalidatedReason: "Approval rules changed" });
      }
    }
    if (org.onboardingStep === "preferences") await ctx.db.patch(org._id, { onboardingStep: "plan" });
  },
});

export const generatePlan = mutation({
  args: { slug: v.string(), aiMode: v.optional(v.union(v.literal("basic"), v.literal("expert"))), creativeRange: v.optional(v.union(v.literal("balanced"), v.literal("conventional"), v.literal("surprising"), v.literal("ambitious"))), model: v.optional(v.string()) },
  handler: async (ctx, { slug, aiMode: requested, creativeRange, model }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const goal = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active"))
      .first();
    if (!goal) throw appError("INVALID", "Set a goal first.");
    await assertNoActiveRun(ctx, org._id, "strategy", "Your plan is already being built. It'll be ready soon.");
    const aiMode = await resolveAiMode(ctx, org, "strategy", requested);
    const modelRoute = await resolveModelRoute(ctx, user._id, model);
    const plan = planJob("strategy", {}, { fixture: org.kind === "demo", mode: aiMode });
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: plan.kind,
      title: plan.title,
      roles: plan.roles,
      input: { goalId: goal._id, creativeRange: creativeRange ?? "balanced" },
      steps: plan.steps,
      meters: plan.meters,
      createdBy: user._id,
      isFixture: org.kind === "demo",
      aiMode,
      modelRoute,
    });
    if (org.onboardingStep !== "done") await ctx.db.patch(org._id, { onboardingStep: "plan" });
    await ctx.scheduler.runAfter(0, internal.jobs.buildStrategy, { runId });
    return { runId };
  },
});

/** Continue without automatic research (e.g. during an AI outage): the owner adds facts by hand. */
export const skipResearch = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (business) await ctx.db.patch(business._id, { researchStatus: "owner_supplied", updatedAt: Date.now() });
    if (org.onboardingStep !== "done") await ctx.db.patch(org._id, { onboardingStep: "facts" });
  },
});

export const finishOnboarding = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    await ctx.db.patch(org._id, { onboardingStep: "done" });
  },
});

export const renameWorkspace = mutation({
  args: { slug: v.string(), name: v.string() },
  handler: async (ctx, { slug, name }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "manage_team");
    const clean = name.trim().slice(0, 80);
    if (!clean) throw appError("INVALID", "Name can't be empty.");
    await ctx.db.patch(org._id, { name: clean });
  },
});
