import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { audit } from "./lib/audit";
import { planJob } from "./lib/jobPlans";
import { createOnboardingPeriod } from "./lib/periods";
import { appError, isOperator, optionalUser, requireOrgAccess, requireUser } from "./lib/tenancy";
import { chargeableAccess } from "./lib/access";

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
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.isAnonymous) throw appError("FORBIDDEN", "Create a free account to save your own workspace.");
    const name = args.businessName.trim().slice(0, 80);
    if (!name) throw appError("INVALID", "Please enter your business name.");
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(30);
    const owned = existing.filter((m) => m.role === "owner" && m.status === "active");
    if (owned.length >= 10) throw appError("LIMIT_REACHED", "You can own up to 10 workspaces. Contact support for more.");
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
    await createOnboardingPeriod(ctx, orgId);
    await audit(ctx, { orgId, actorType: "user", actorId: user._id, action: "workspace.created", summary: `Workspace "${name}" created.` });
    return { slug, orgId };
  },
});

/** Start (or restart) business research. Owner-pasted text works when the site can't be read. */
export const startResearch = mutation({
  args: { slug: v.string(), website: v.optional(v.string()), ownerText: v.optional(v.string()) },
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
    const plan = planJob("onboarding_research", { pages: website ? 3 : 0 }, { fixture: org.kind === "demo" });
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
    });
    await ctx.db.patch(org._id, { onboardingStep: "research" });
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
    const runs = await ctx.db
      .query("workflowRuns")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(10);
    const researchRun = runs.find((r) => r.kind === "onboarding_research");
    const strategyRun = runs.find((r) => r.kind === "strategy");
    const researchSteps = researchRun
      ? await ctx.db
          .query("workflowSteps")
          .withIndex("by_run", (q) => q.eq("runId", researchRun._id))
          .take(20)
      : [];
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
            researchStatus: business.researchStatus,
            successEvents: business.successEvents,
            currency: business.currency,
            timezone: business.timezone,
            hasInsights: Boolean(business.insights),
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
            finishedAt: researchRun.finishedAt ?? null,
            steps: researchSteps.filter((s) => s.index < 1000).map((s) => ({ label: s.label, status: s.status, kind: s.kind, startedAt: s.startedAt ?? null, finishedAt: s.finishedAt ?? null })),
          }
        : null,
      strategyRun: strategyRun ? { id: strategyRun._id, status: strategyRun.status, userMessage: strategyRun.userMessage ?? null } : null,
      goal: goal
        ? { kind: goal.kind, statement: goal.statement, horizonDays: goal.horizonDays, monthlyAdBudget: goal.monthlyAdBudgetMinor / 100, currency: goal.currency, reviewDay: goal.reviewDay ?? null }
        : null,
      autonomy: policy?.mode ?? "review",
      strategy: strategy ? { id: strategy._id, status: strategy.status, version: strategy.version } : null,
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
    if (args.action === "edit") {
      const statement = args.statement?.trim().slice(0, 400);
      if (!statement) throw appError("INVALID", "The fact can't be empty.");
      await ctx.db.patch(fact._id, { statement, reviewState: "edited", confidence: "high", updatedBy: user._id, updatedAt: Date.now() });
    } else {
      await ctx.db.patch(fact._id, { reviewState: args.action === "confirm" ? "confirmed" : "rejected", updatedBy: user._id, updatedAt: Date.now() });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `fact.${args.action}`, subjectType: "fact", subjectId: fact._id, summary: `Fact ${args.action}ed.` });
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
    for (const f of facts) await ctx.db.patch(f._id, { reviewState: "confirmed", updatedBy: user._id, updatedAt: Date.now() });
    await ctx.db.patch(org._id, { onboardingStep: "goal" });
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
    return ctx.db.insert("businessFacts", {
      orgId: org._id,
      businessId: business._id,
      category: args.category,
      statement,
      confidence: "high",
      reviewState: "confirmed",
      provenance: "owner_supplied",
      sourceIds: [],
      updatedBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const saveBusinessDetails = mutation({
  args: {
    slug: v.string(),
    name: v.optional(v.string()),
    businessType: v.optional(
      v.union(v.literal("saas"), v.literal("ecommerce"), v.literal("services"), v.literal("physical_products"), v.literal("other")),
    ),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    successEvents: v.optional(v.array(v.object({ key: v.string(), label: v.string(), definition: v.string(), confirmed: v.boolean() }))),
  },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!business) throw appError("NOT_FOUND", "Business not found.");
    const currency = args.currency?.toUpperCase().slice(0, 3);
    if (currency && !/^[A-Z]{3}$/.test(currency)) throw appError("INVALID", "Currency must be a 3-letter code like USD.");
    await ctx.db.patch(business._id, {
      ...(args.name ? { name: args.name.trim().slice(0, 80) } : {}),
      ...(args.businessType ? { businessType: args.businessType } : {}),
      ...(currency ? { currency } : {}),
      ...(args.timezone ? { timezone: args.timezone.slice(0, 64) } : {}),
      ...(args.successEvents ? { successEvents: args.successEvents.slice(0, 6) } : {}),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(org._id, {
      ...(args.name ? { name: args.name.trim().slice(0, 80) } : {}),
      ...(currency ? { currency } : {}),
      ...(args.timezone ? { timezone: args.timezone.slice(0, 64) } : {}),
    });
  },
});

export const setGoal = mutation({
  args: {
    slug: v.string(),
    kind: v.union(v.literal("more_sales"), v.literal("more_customers"), v.literal("more_reach"), v.literal("custom")),
    statement: v.string(),
    horizonDays: v.number(),
    monthlyAdBudget: v.number(),
    reviewDay: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
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
    const active = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active"))
      .take(5);
    for (const g of active) await ctx.db.patch(g._id, { status: "archived" });
    const budgetMinor = Math.round(args.monthlyAdBudget * 100);
    await ctx.db.insert("goals", {
      orgId: org._id,
      businessId: business._id,
      kind: args.kind,
      statement,
      horizonDays,
      monthlyAdBudgetMinor: budgetMinor,
      currency: business.currency,
      reviewDay: args.reviewDay,
      status: "active",
      createdBy: user._id,
      createdAt: Date.now(),
    });
    // The ad envelope in the active policy follows the goal; raising it later always needs the owner.
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    if (policy && policy.maxMonthlyAdSpendMinor !== budgetMinor) {
      await ctx.db.patch(policy._id, { active: false });
      const { _id: _omit, _creationTime: _ct, ...rest } = policy;
      await ctx.db.insert("autonomyPolicies", { ...rest, version: policy.version + 1, maxMonthlyAdSpendMinor: budgetMinor, createdBy: user._id, createdAt: Date.now(), active: true });
    }
    await ctx.db.patch(org._id, { onboardingStep: "preferences" });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "goal.set", summary: `Goal set: ${statement}` });
  },
});

export const setAutonomy = mutation({
  args: { slug: v.string(), mode: v.union(v.literal("copilot"), v.literal("review"), v.literal("bounded_autopilot")) },
  handler: async (ctx, { slug, mode }) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug }, "edit");
    if (mode === "bounded_autopilot" && !["owner", "admin"].includes(role)) {
      throw appError("FORBIDDEN", "Only an owner or admin can turn on Bounded Autopilot.");
    }
    const policy = await ctx.db
      .query("autonomyPolicies")
      .withIndex("by_org_active", (q) => q.eq("orgId", org._id).eq("active", true))
      .first();
    if (!policy) throw appError("NOT_FOUND", "Policy not found.");
    if (policy.mode !== mode) {
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
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const goal = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active"))
      .first();
    if (!goal) throw appError("INVALID", "Set a goal first.");
    const plan = planJob("strategy", {}, { fixture: org.kind === "demo" });
    const runId = await createRunWithReservation(ctx, {
      org,
      kind: plan.kind,
      title: plan.title,
      roles: plan.roles,
      input: { goalId: goal._id },
      steps: plan.steps,
      meters: plan.meters,
      createdBy: user._id,
      isFixture: org.kind === "demo",
    });
    await ctx.db.patch(org._id, { onboardingStep: "plan" });
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
    await ctx.db.patch(org._id, { onboardingStep: "facts" });
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
