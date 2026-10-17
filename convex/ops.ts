import { v } from "convex/values";
import {
  CURRENT_ENTITLEMENTS,
  CURRENT_ROUTING,
  computeAllProfiles,
  currentRateVersion,
  economicsCsv,
  marginGuard,
  microsToUsd,
  RATE_VERSIONS,
} from "../shared/economics";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { currentPeriod } from "./lib/periods";
import { ensureFleet } from "./circuits";
import { audit } from "./lib/audit";
import { appError, requireOperator } from "./lib/tenancy";

/**
 * Operator console. Separately authorized (OPS_EMAILS allowlist) and never
 * derived from customer roles. Every operator action is audited. Customer
 * content, contact lists and secrets are never shown here.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const isOperatorQuery = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireOperator(ctx);
      return true;
    } catch {
      return false;
    }
  },
});

export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireOperator(ctx);
    const now = Date.now();
    const fleet = await ctx.db
      .query("fleetControls")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();

    const failedRuns = await ctx.db
      .query("workflowRuns")
      .withIndex("by_status_updated", (q) => q.eq("status", "failed").gt("updatedAt", now - 7 * DAY))
      .order("desc")
      .take(50);
    const uncertainRuns = await ctx.db
      .query("workflowRuns")
      .withIndex("by_status_updated", (q) => q.eq("status", "uncertain"))
      .take(50);
    const stuck = [];
    for (const status of ["cost_reserved", "preparing", "executing"] as const) {
      stuck.push(
        ...(await ctx.db
          .query("workflowRuns")
          .withIndex("by_status_updated", (q) => q.eq("status", status).lt("updatedAt", now - 10 * 60_000))
          .take(20)),
      );
    }
    const unresolved = await ctx.db
      .query("usageReservations")
      .withIndex("by_status_created", (q) => q.eq("status", "unresolved"))
      .take(50);
    const webhookFailed = await ctx.db
      .query("webhookEvents")
      .withIndex("by_status_received", (q) => q.eq("status", "failed"))
      .take(50);
    const webhookPending = await ctx.db
      .query("webhookEvents")
      .withIndex("by_status_received", (q) => q.eq("status", "received").lt("receivedAt", now - 5 * 60_000))
      .take(50);
    const expiring = await ctx.db
      .query("connections")
      .withIndex("by_expires", (q) => q.gt("expiresAt", 0).lt("expiresAt", now + 7 * DAY))
      .take(50);
    const privacy = await ctx.db
      .query("privacyRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(50);
    const recentUsage = await ctx.db
      .query("usageEvents")
      .withIndex("by_created", (q) => q.gt("createdAt", now - DAY))
      .take(5000);
    const spend24h = recentUsage.reduce((s, e) => s + e.costMicros, 0);
    const byProvider = new Map<string, { calls: number; costMicros: number }>();
    for (const e of recentUsage) {
      const p = byProvider.get(e.provider) ?? { calls: 0, costMicros: 0 };
      p.calls++;
      p.costMicros += e.costMicros;
      byProvider.set(e.provider, p);
    }
    const recentRuns = await ctx.db
      .query("workflowRuns")
      .withIndex("by_status_updated", (q) => q.eq("status", "verified").gt("updatedAt", now - 7 * DAY))
      .take(500);
    const drift = recentRuns.filter((r) => r.actualMicros > r.estimateMicros);
    const estimate = recentRuns.reduce((s, r) => s + r.estimateMicros, 0);
    const actual = recentRuns.reduce((s, r) => s + r.actualMicros, 0);
    const previews = await ctx.db
      .query("previews")
      .withIndex("by_created", (q) => q.gt("createdAt", now - DAY))
      .take(1000);
    const orgs = await ctx.db
      .query("organizations")
      .withIndex("by_kind_created", (q) => q.eq("kind", "customer"))
      .order("desc")
      .take(100);
    const subs = await ctx.db.query("subscriptions").take(500);

    const guard = marginGuard({ rates: currentRateVersion(), routing: CURRENT_ROUTING });
    return {
      fleet: {
        emergencyStop: fleet?.emergencyStop ?? false,
        stopReason: fleet?.stopReason ?? null,
        circuits: fleet?.circuits ?? [],
        previewDailyBudgetMicros: fleet?.previewDailyBudgetMicros ?? 0,
      },
      jobs: {
        failed: failedRuns.map((r) => ({ id: r._id, orgId: r.orgId, title: r.title, error: r.error ?? null, updatedAt: r.updatedAt })),
        uncertain: uncertainRuns.map((r) => ({ id: r._id, orgId: r.orgId, title: r.title, updatedAt: r.updatedAt })),
        stuck: stuck.map((r) => ({ id: r._id, orgId: r.orgId, title: r.title, status: r.status, updatedAt: r.updatedAt })),
        unresolvedReservations: unresolved.map((r) => ({ id: r._id, orgId: r.orgId, walletMicros: r.walletMicros, topupMicros: r.topupMicros, createdAt: r.createdAt })),
      },
      webhooks: {
        failed: webhookFailed.map((w) => ({ id: w._id, source: w.source, type: w.type, error: w.error ?? null, attempts: w.attempts, receivedAt: w.receivedAt })),
        lagging: webhookPending.map((w) => ({ id: w._id, source: w.source, type: w.type, receivedAt: w.receivedAt })),
      },
      connections: { expiring: expiring.map((c) => ({ id: c._id, orgId: c.orgId, provider: c.provider, expiresAt: c.expiresAt ?? null })) },
      privacy: privacy.map((p) => ({ id: p._id, orgId: p.orgId, kind: p.kind, createdAt: p.createdAt })),
      costs: {
        spend24hMicros: spend24h,
        byProvider: [...byProvider.entries()].map(([provider, x]) => ({ provider, ...x })),
        estimate7dMicros: estimate,
        actual7dMicros: actual,
        overEstimateRuns: drift.length,
        previews24h: previews.length,
        previewSpend24hMicros: previews.reduce((s, p) => s + p.costMicros, 0),
      },
      margin: {
        ok: guard.ok,
        failures: guard.failures,
        rateVersion: currentRateVersion().id,
        entitlementVersion: CURRENT_ENTITLEMENTS.id,
        routingVersion: CURRENT_ROUTING.id,
      },
      customers: {
        workspaces: orgs.length,
        subscriptions: subs.map((s) => ({ planKey: s.planKey, status: s.status })),
      },
    };
  },
});

export const economics = query({
  args: { rateVersionId: v.optional(v.string()) },
  handler: async (ctx, { rateVersionId }) => {
    await requireOperator(ctx);
    const rates = RATE_VERSIONS.find((r) => r.id === rateVersionId) ?? currentRateVersion();
    const rows = computeAllProfiles({ rates, routing: CURRENT_ROUTING });
    return {
      rateVersion: rates.id,
      versions: RATE_VERSIONS.map((r) => ({ id: r.id, label: r.label, effectiveFrom: r.effectiveFrom })),
      rows: rows.map((r) => ({
        plan: r.plan,
        profile: r.profile,
        price: microsToUsd(r.listPriceMicros),
        revenue: microsToUsd(r.revenueMicros),
        cogs: microsToUsd(r.totalCogsMicros),
        margin: r.grossMargin,
        stressMargin: r.stress.grossMargin,
        stressFloor: r.stress.minimumListPriceUsd,
        meetsTarget: r.meetsTarget,
      })),
      csv: economicsCsv({ rates, routing: CURRENT_ROUTING }),
      guard: marginGuard({ rates, routing: CURRENT_ROUTING }),
    };
  },
});

/** Monthly reconciliation: predicted vs actual cost, unrealized reservations and realized margin by plan. */
export const reconciliation = query({
  args: { month: v.string() },
  handler: async (ctx, { month }) => {
    await requireOperator(ctx);
    if (!/^\d{4}-\d{2}$/.test(month)) throw appError("INVALID", "Month must look like 2026-10.");
    const start = Date.parse(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const events = await ctx.db
      .query("usageEvents")
      .withIndex("by_created", (q) => q.gte("createdAt", start).lt("createdAt", end.getTime()))
      .take(20_000);
    const orders = (await ctx.db.query("orders").take(5000)).filter((o) => o.createdAt >= start && o.createdAt < end.getTime());
    const subs = await ctx.db.query("subscriptions").take(5000);
    const planOf = new Map(subs.map((s) => [s.orgId, s.planKey]));
    const byPlan = new Map<string, { revenueMinor: number; refundsMinor: number; costMicros: number; orgs: Set<string> }>();
    for (const o of orders) {
      const k = o.productKey === "boost_29" ? (planOf.get(o.orgId) ?? "unknown") : o.productKey;
      const b = byPlan.get(k) ?? { revenueMinor: 0, refundsMinor: 0, costMicros: 0, orgs: new Set() };
      if (o.status === "paid" || o.status === "partially_refunded" || o.status === "refunded") b.revenueMinor += o.amountMinor - o.taxMinor;
      b.refundsMinor += o.refundedMinor;
      b.orgs.add(o.orgId);
      byPlan.set(k, b);
    }
    for (const e of events) {
      const k = planOf.get(e.orgId) ?? "unpaid";
      const b = byPlan.get(k) ?? { revenueMinor: 0, refundsMinor: 0, costMicros: 0, orgs: new Set() };
      b.costMicros += e.costMicros;
      byPlan.set(k, b);
    }
    const unresolved = await ctx.db
      .query("usageReservations")
      .withIndex("by_status_created", (q) => q.eq("status", "unresolved"))
      .take(1000);
    return {
      month,
      note: "Direct variable AI/research/image cost only (provider-reported). Hosting, support, Polar fees and fixed services come from vendor invoices; compare with the economics model.",
      plans: [...byPlan.entries()].map(([plan, b]) => ({
        plan,
        workspaces: b.orgs.size,
        netRevenueUsd: (b.revenueMinor - b.refundsMinor) / 100,
        variableCostUsd: microsToUsd(b.costMicros),
        variableMargin: b.revenueMinor > 0 ? 1 - microsToUsd(b.costMicros) / ((b.revenueMinor - b.refundsMinor) / 100) : null,
      })),
      unresolvedReservationsUsd: microsToUsd(unresolved.reduce((s, r) => s + r.walletMicros + r.topupMicros, 0)),
    };
  },
});

export const setFleetStop = mutation({
  args: { active: v.boolean(), reason: v.optional(v.string()) },
  handler: async (ctx, { active, reason }) => {
    const op = await requireOperator(ctx);
    const fleet = await ensureFleet(ctx);
    await ctx.db.patch(fleet._id, { emergencyStop: active, stopReason: active ? reason?.slice(0, 300) : undefined, updatedAt: Date.now() });
    await audit(ctx, { actorType: "operator", actorId: op._id, action: active ? "fleet.stop" : "fleet.resume", summary: active ? `Fleet stop: ${reason ?? "no reason given"}` : "Fleet resumed." });
  },
});

export const resetCircuit = mutation({
  args: { provider: v.string() },
  handler: async (ctx, { provider }) => {
    const op = await requireOperator(ctx);
    const fleet = await ensureFleet(ctx);
    await ctx.db.patch(fleet._id, { circuits: fleet.circuits.filter((c) => c.provider !== provider), updatedAt: Date.now() });
    await audit(ctx, { actorType: "operator", actorId: op._id, action: "circuit.reset", summary: `Reset circuit breaker for ${provider}.` });
  },
});

export const setPreviewBudget = mutation({
  args: { usd: v.number() },
  handler: async (ctx, { usd }) => {
    const op = await requireOperator(ctx);
    if (!(usd >= 0 && usd <= 500)) throw appError("INVALID", "Budget must be between $0 and $500 per day.");
    const fleet = await ensureFleet(ctx);
    await ctx.db.patch(fleet._id, { previewDailyBudgetMicros: Math.round(usd * 1_000_000), updatedAt: Date.now() });
    await audit(ctx, { actorType: "operator", actorId: op._id, action: "preview.budget", summary: `Preview budget set to $${usd}/day.` });
  },
});

/** Resolve an uncertain run after checking the provider manually. */
export const resolveUncertain = mutation({
  args: { runId: v.id("workflowRuns"), outcome: v.union(v.literal("verified"), v.literal("failed")), note: v.string() },
  handler: async (ctx, { runId, outcome, note }) => {
    const op = await requireOperator(ctx);
    const run = await ctx.db.get(runId);
    if (!run || run.status !== "uncertain") throw appError("INVALID", "That job isn't marked uncertain.");
    await ctx.db.patch(run._id, { status: outcome, updatedAt: Date.now(), userMessage: note.slice(0, 300) });
    if (run.reservationId) {
      const r = await ctx.db.get(run.reservationId);
      if (r && r.status === "unresolved") {
        const period = await ctx.db.get(r.periodId);
        if (period) {
          await ctx.db.patch(period._id, {
            walletReservedMicros: Math.max(0, period.walletReservedMicros - r.walletMicros),
            walletSpentMicros: period.walletSpentMicros + Math.min(run.actualMicros, r.walletMicros),
            topupReservedMicros: Math.max(0, period.topupReservedMicros - r.topupMicros),
            updatedAt: Date.now(),
          });
        }
        await ctx.db.patch(r._id, { status: "reconciled", actualMicros: run.actualMicros, reconciledAt: Date.now() });
      }
    }
    await audit(ctx, { orgId: run.orgId, actorType: "operator", actorId: op._id, action: "run.resolved", subjectType: "run", subjectId: run._id, summary: `Operator marked uncertain run ${outcome}: ${note.slice(0, 200)}` });
  },
});

export const retryWebhook = mutation({
  args: { webhookId: v.id("webhookEvents") },
  handler: async (ctx, { webhookId }) => {
    const op = await requireOperator(ctx);
    const e = await ctx.db.get(webhookId);
    if (!e) throw appError("NOT_FOUND", "Webhook event not found.");
    await ctx.db.patch(e._id, { status: "received" });
    if (e.source === "polar") await ctx.scheduler.runAfter(0, internal.billing.processPolarEvent, { webhookId });
    await audit(ctx, { actorType: "operator", actorId: op._id, action: "webhook.retry", summary: `Retried ${e.source} ${e.type}.` });
  },
});

export const auditLog = query({
  args: {},
  handler: async (ctx) => {
    await requireOperator(ctx);
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_actor_created", (q) => q.eq("actorType", "operator"))
      .order("desc")
      .take(100);
    return rows.map((r) => ({ id: r._id, action: r.action, summary: r.summary, createdAt: r.createdAt }));
  },
});

/** Add AI capacity to a workspace's current period (support credits, testing). Audited. */
async function grant(ctx: MutationCtx, orgId: Id<"organizations">, usd: number, reason: string, actorId?: string) {
  if (!(usd > 0 && usd <= 500)) throw appError("INVALID", "Grant between $0 and $500 at a time.");
  const period = await currentPeriod(ctx, orgId);
  if (!period) throw appError("INVALID", "This workspace has no active usage period.");
  const micros = Math.round(usd * 1_000_000);
  await ctx.db.patch(period._id, { walletCapMicros: period.walletCapMicros + micros });
  await audit(ctx, { orgId, actorType: "operator", actorId, action: "ops.grant_capacity", summary: `Granted $${usd.toFixed(2)} of AI capacity: ${reason.slice(0, 200)}` });
}

export const grantCapacity = mutation({
  args: { slug: v.string(), usd: v.number(), reason: v.string() },
  handler: async (ctx, { slug, usd, reason }) => {
    const op = await requireOperator(ctx);
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) throw appError("NOT_FOUND", "No workspace with that address.");
    await grant(ctx, org._id, usd, reason, op._id);
  },
});

/** CLI-only twin (npx convex run ops:grantCapacityInternal) for operators without the console. */
export const grantCapacityInternal = internalMutation({
  args: { slug: v.string(), usd: v.number(), reason: v.string() },
  handler: async (ctx, { slug, usd, reason }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) throw appError("NOT_FOUND", "No workspace with that address.");
    await grant(ctx, org._id, usd, reason);
  },
});
