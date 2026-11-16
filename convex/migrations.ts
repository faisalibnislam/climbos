import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { ensureAccountForOwner } from "./lib/accounts";
import { EXPERT_PLAN_JSON_ENVELOPE_VERSION, EXPERT_PLAN_SCHEMA_VERSION } from "../shared/agents/planCompatibility";
import { buildCurrentExpertGrowthPayload, parseCurrentExpertGrowthPayload } from "../shared/agents/growthPlanPersistence";
import { weeklyLearningEligible } from "./playResults";

/** Tenant-scoped, preview-first indexing of existing weekly reports; no report or action is rewritten. */
export const weeklyOutcomeReviewIndex = internalMutation({
  args: { orgId: v.id("organizations"), cursor: v.optional(v.string()), limit: v.optional(v.number()), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { orgId, cursor, limit, dryRun = true }) => {
    const pageSize = Number.isSafeInteger(limit) ? Math.max(1, Math.min(100, limit!)) : 50;
    const page = await ctx.db.query("playResults").withIndex("by_org", q => q.eq("orgId", orgId)).paginate({ numItems: pageSize, cursor: cursor ?? null });
    const updates = new Map<string, { plan: Doc<"strategies">; at: number }>();
    let skipped = 0;
    for (const row of page.page) {
      if (!Number.isFinite(row.updatedAt) || row.updatedAt <= 0 || row.updatedAt > Date.now()) { skipped++; continue; }
      const plan = await ctx.db.get(row.strategyId);
      if (!plan || !await weeklyLearningEligible(ctx, plan, orgId)) { skipped++; continue; }
      const prior = updates.get(plan._id)?.at ?? plan.weeklyReportedAt;
      if (prior !== undefined && Number.isFinite(prior) && prior > 0 && prior <= Date.now() && prior >= row.updatedAt) continue;
      updates.set(plan._id, { plan, at: row.updatedAt });
    }
    if (!dryRun) for (const { plan, at } of updates.values()) await ctx.db.patch(plan._id, { weeklyReportedAt: at });
    return { scanned: page.page.length, eligible: updates.size, updated: dryRun ? 0 : updates.size, skipped, dryRun, done: page.isDone, cursor: page.isDone ? null : page.continueCursor };
  },
});

/**
 * Index existing reports by their saved review time without asking owners to
 * re-enter outcomes. Operator-only, tenant-scoped and paginated. Preview is the
 * default; apply every page with dryRun:false when rollout is authorized.
 * Never changes a report, its history, approval or execution state.
 */
export const experimentOutcomeReviewIndex = internalMutation({
  args: { orgId: v.id("organizations"), cursor: v.optional(v.string()), limit: v.optional(v.number()), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { orgId, cursor, limit, dryRun = true }) => {
    const pageSize = Number.isSafeInteger(limit) ? Math.max(1, Math.min(100, limit!)) : 50;
    const page = await ctx.db.query("experiments").withIndex("by_org", q => q.eq("orgId", orgId)).paginate({ numItems: pageSize, cursor: cursor ?? null });
    let eligible = 0, updated = 0, skipped = 0;
    for (const e of page.page) {
      if (e.outcomeReviewedAt !== undefined) continue;
      const reviewedAt = e.analyses?.at(-1)?.reviewedAt;
      if (reviewedAt === undefined) continue;
      if (!Number.isFinite(reviewedAt) || reviewedAt <= 0 || reviewedAt > Date.now()) { skipped++; continue; }
      const plan = await ctx.db.get(e.strategyId);
      if (!plan || plan.orgId !== orgId) { skipped++; continue; }
      if (plan.runId) {
        const run = await ctx.db.get(plan.runId);
        if (!run || run.orgId !== orgId || run.isFixture) { skipped++; continue; }
      }
      eligible++;
      if (!dryRun) { await ctx.db.patch(e._id, { outcomeReviewedAt: reviewedAt }); updated++; }
    }
    return { scanned: page.page.length, eligible, updated, skipped, dryRun, done: page.isDone, cursor: page.isDone ? null : page.continueCursor };
  },
});

function expertVersion(expert: Record<string, unknown>): number {
  const value = expert.version;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function legacyExpertGrowthPayload(expert: Record<string, unknown>, version: number) {
  return version === EXPERT_PLAN_JSON_ENVELOPE_VERSION
    ? parseCurrentExpertGrowthPayload(expert.growthPlanV8)
    : parseCurrentExpertGrowthPayload({ plays: expert.plays, economics: expert.economics });
}

/**
 * 18 Oct 2026: shared accounts. Give every customer workspace its owner's
 * account and move its billing rows (periods, subscriptions, top-ups, Polar
 * customer, orders) onto the account. Free periods stop expiring. Idempotent;
 * run until it reports done.
 */
export const accountsBackfill = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const orgs = (await ctx.db.query("organizations").take(2000)).filter((o) => o.kind === "customer" && !o.accountId && !o.deletedAt).slice(0, limit ?? 50);
    let migrated = 0;
    for (const org of orgs) {
      const owner = (await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(50)).find((m) => m.role === "owner" && m.status === "active" && m.userId);
      const user = owner?.userId ? await ctx.db.get(owner.userId) : await ctx.db.get(org.createdBy);
      if (!user) continue;
      const accountId = await ensureAccountForOwner(ctx, user, org.name);
      await ctx.db.patch(org._id, { accountId });
      for (const p of await ctx.db.query("usagePeriods").withIndex("by_org_period", (q) => q.eq("orgId", org._id)).take(200)) {
        await ctx.db.patch(p._id, { accountId, ...(p.source === "onboarding" ? { endsAt: Math.max(p.endsAt, Date.now() + 100 * 365 * 86_400_000) } : {}) });
        if (p.source === "onboarding") await ctx.db.patch(accountId, { freeCreditsGrantedAt: p.createdAt });
      }
      for (const s of await ctx.db.query("subscriptions").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(50)) await ctx.db.patch(s._id, { accountId });
      for (const c of await ctx.db.query("creditPurchases").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(200)) await ctx.db.patch(c._id, { accountId });
      for (const c of await ctx.db.query("polarCustomers").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(10)) await ctx.db.patch(c._id, { accountId });
      const orders = (await ctx.db.query("orders").take(5000)).filter((o) => o.orgId === org._id);
      for (const o of orders) await ctx.db.patch(o._id, { accountId });
      migrated++;
    }
    const left = (await ctx.db.query("organizations").take(2000)).filter((o) => o.kind === "customer" && !o.accountId && !o.deletedAt).length;
    return { migrated, left };
  },
});

/**
 * Converts historical expert-plan growth payloads only when the original plays
 * and economics already satisfy the current evidence-bearing schema. This is
 * intentionally lossless: it does not fill missing sources or rewrite facts.
 * Pass the returned cursor to the next invocation until `done` is true.
 */
export const expertGrowthPlansToV9 = internalMutation({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { cursor, limit }) => {
    const pageSize = Number.isSafeInteger(limit) ? Math.max(1, Math.min(500, limit!)) : 100;
    const page = await ctx.db.query("strategies").paginate({ numItems: pageSize, cursor: cursor ?? null });
    let migrated = 0;
    let skippedUnsupported = 0;
    let skippedInvalid = 0;

    for (const strategy of page.page) {
      const expert = strategy.expert as Record<string, unknown> | undefined;
      if (!expert) continue;
      const version = expertVersion(expert);
      if (version === EXPERT_PLAN_SCHEMA_VERSION) continue;
      if (version > EXPERT_PLAN_JSON_ENVELOPE_VERSION) {
        skippedUnsupported++;
        continue;
      }

      const legacyPayload = legacyExpertGrowthPayload(expert, version);
      if (!legacyPayload) {
        skippedInvalid++;
        continue;
      }
      const current = buildCurrentExpertGrowthPayload(legacyPayload.plays, legacyPayload.economics);
      if (!current) {
        skippedInvalid++;
        continue;
      }

      const migratedExpert = {
        ...expert,
        version: EXPERT_PLAN_SCHEMA_VERSION,
        plays: undefined,
        economics: undefined,
        growthPlanV8: undefined,
        growthPlanV9: current,
      };
      await ctx.db.patch(strategy._id, { expert: migratedExpert as never });
      migrated++;
    }

    return {
      scanned: page.page.length,
      migrated,
      skippedUnsupported,
      skippedInvalid,
      done: page.isDone,
      cursor: page.isDone ? null : page.continueCursor,
    };
  },
});

/** Read-only paginated inventory; inspect every page before deciding whether to run the migration. */
export const expertGrowthPlanInventory = internalQuery({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { cursor, limit }) => {
    const pageSize = Number.isSafeInteger(limit) ? Math.max(1, Math.min(500, limit!)) : 100;
    const page = await ctx.db.query("strategies").paginate({ numItems: pageSize, cursor: cursor ?? null });
    const counts = {
      missingExpert: 0,
      currentValid: 0,
      currentInvalid: 0,
      legacyMigratable: 0,
      legacyInvalid: 0,
      futureUnsupported: 0,
    };

    for (const strategy of page.page) {
      const expert = strategy.expert as Record<string, unknown> | undefined;
      if (!expert) {
        counts.missingExpert++;
        continue;
      }
      const version = expertVersion(expert);
      if (version === EXPERT_PLAN_SCHEMA_VERSION) {
        if (parseCurrentExpertGrowthPayload(expert.growthPlanV9)) counts.currentValid++;
        else counts.currentInvalid++;
      } else if (version > EXPERT_PLAN_JSON_ENVELOPE_VERSION) {
        counts.futureUnsupported++;
      } else {
        const legacyPayload = legacyExpertGrowthPayload(expert, version);
        if (legacyPayload && buildCurrentExpertGrowthPayload(legacyPayload.plays, legacyPayload.economics)) counts.legacyMigratable++;
        else counts.legacyInvalid++;
      }
    }

    return { scanned: page.page.length, counts, done: page.isDone, cursor: page.isDone ? null : page.continueCursor };
  },
});
