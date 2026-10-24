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
  detectModelCostAnomalies,
  summarizeModelUsage,
} from "../shared/economics";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { currentPeriod } from "./lib/periods";
import { settleCredits } from "./lib/credits";
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
    const usageRows = await ctx.db
      .query("usageEvents")
      .withIndex("by_created", (q) => q.gt("createdAt", now - 8 * DAY))
      .order("desc")
      .take(25_001);
    const historyCapped = usageRows.length > 25_000;
    const lastDayRows = usageRows.filter((event) => event.createdAt > now - DAY);
    const usageCoverageCapped = lastDayRows.length > 5_000;
    const recentUsage = lastDayRows.slice(0, 5_000);
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
    const verifiedRuns30d = await ctx.db
      .query("workflowRuns")
      .withIndex("by_status_updated", (q) => q.eq("status", "verified").gt("updatedAt", now - 30 * DAY))
      .take(1000);
    const decisions30d = await ctx.db
      .query("engineQuality")
      .withIndex("by_created", (q) => q.gte("createdAt", now - 30 * DAY))
      .order("desc")
      .take(1000);
    const approvedRunIds = new Set<string>();
    for (const row of decisions30d) {
      if (row.agentId !== "owner_decision") continue;
      try {
        const data = JSON.parse(row.data) as { decision?: string };
        if (data.decision === "approve") approvedRunIds.add(String(row.runId));
      } catch {
        // A malformed historical quality row is not an approval record.
      }
    }
    const approvedPlans30d = verifiedRuns30d.filter((run) => run.kind === "strategy" && approvedRunIds.has(String(run._id)));
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
        usage24h: { eventsRead: recentUsage.length, coverageCapped: usageCoverageCapped },
        byProvider: [...byProvider.entries()].map(([provider, x]) => ({ provider, ...x })),
        byModel24h: summarizeModelUsage(recentUsage.map((event) => ({
          provider: event.provider,
          model: event.model,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          reasoningTokens: event.reasoningTokens,
          cacheReadTokens: event.cacheReadTokens,
          cacheWriteTokens: event.cacheWriteTokens,
          costMicros: event.costMicros,
          estimated: event.estimated,
        }))),
        modelCostAnomalies8d: detectModelCostAnomalies(usageRows.slice(0, 25_000).map((event) => ({
          provider: event.provider,
          model: event.model,
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          reasoningTokens: event.reasoningTokens,
          cacheReadTokens: event.cacheReadTokens,
          cacheWriteTokens: event.cacheWriteTokens,
          costMicros: event.costMicros,
          estimated: event.estimated,
          createdAt: event.createdAt,
        })), now, historyCapped),
        estimate7dMicros: estimate,
        actual7dMicros: actual,
        overEstimateRuns: drift.length,
        approvedPlans30d: approvedPlans30d.length,
        approvedPlanCost30dMicros: approvedPlans30d.reduce((sum, run) => sum + run.actualMicros, 0),
        costPerApprovedPlan30dMicros: approvedPlans30d.length
          ? Math.round(approvedPlans30d.reduce((sum, run) => sum + run.actualMicros, 0) / approvedPlans30d.length)
          : null,
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
/** Operator check for actions (the caller's identity is forwarded to queries). */
export const assertOperator = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requireOperator(ctx);
    return true;
  },
});

const PAGE = 4000;
const reconTable = v.union(v.literal("usageEvents"), v.literal("orders"), v.literal("subscriptions"), v.literal("usageReservations"));

/** One page of the rows reconciliation needs, projected to the few fields it sums (keeps every read small). */
export const reconciliationPage = internalQuery({
  args: { table: reconTable, start: v.number(), end: v.number(), cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { table, start, end, cursor }) => {
    const opts = { numItems: PAGE, cursor };
    if (table === "usageEvents") {
      const p = await ctx.db
        .query("usageEvents")
        .withIndex("by_created", (q) => q.gte("createdAt", start).lt("createdAt", end))
        .paginate(opts);
      return { rows: p.page.map((e) => ({ orgId: e.orgId as string, costMicros: e.costMicros })), cursor: p.isDone ? null : p.continueCursor };
    }
    if (table === "orders") {
      const p = await ctx.db.query("orders").paginate(opts);
      return {
        rows: p.page
          .filter((o) => o.createdAt >= start && o.createdAt < end)
          .map((o) => ({ orgId: o.orgId as string, productKey: o.productKey, status: o.status, amountMinor: o.amountMinor, taxMinor: o.taxMinor, refundedMinor: o.refundedMinor })),
        cursor: p.isDone ? null : p.continueCursor,
      };
    }
    if (table === "subscriptions") {
      const p = await ctx.db.query("subscriptions").paginate(opts);
      return { rows: p.page.map((s) => ({ orgId: s.orgId as string, planKey: s.planKey as string })), cursor: p.isDone ? null : p.continueCursor };
    }
    const p = await ctx.db
      .query("usageReservations")
      .withIndex("by_status_created", (q) => q.eq("status", "unresolved"))
      .paginate(opts);
    return { rows: p.page.map((r) => ({ micros: r.walletMicros + r.topupMicros })), cursor: p.isDone ? null : p.continueCursor };
  },
});

type ReconRow = { orgId?: string; costMicros?: number; productKey?: string; status?: string; amountMinor?: number; taxMinor?: number; refundedMinor?: number; planKey?: string; micros?: number };

/** Monthly reconciliation, read in pages (a month's usage events can run far past one query's limits). */
export const reconciliation = action({
  args: { month: v.string() },
  handler: async (ctx, { month }) => {
    await ctx.runQuery(internal.ops.assertOperator, {});
    if (!/^\d{4}-\d{2}$/.test(month)) throw appError("INVALID", "Month must look like 2026-10.");
    const start = Date.parse(`${month}-01T00:00:00Z`);
    const endDate = new Date(start);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    const end = endDate.getTime();
    const all = async (table: "usageEvents" | "orders" | "subscriptions" | "usageReservations") => {
      const rows: ReconRow[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 500; i++) {
        const page: { rows: ReconRow[]; cursor: string | null } = await ctx.runQuery(internal.ops.reconciliationPage, { table, start, end, cursor });
        rows.push(...page.rows);
        cursor = page.cursor;
        if (!cursor) break;
      }
      return rows;
    };
    const subs = await all("subscriptions");
    const planOf = new Map(subs.map((s) => [s.orgId!, s.planKey!]));
    const byPlan = new Map<string, { revenueMinor: number; refundsMinor: number; costMicros: number; orgs: Set<string> }>();
    for (const o of await all("orders")) {
      const k = o.productKey === "boost_29" ? (planOf.get(o.orgId!) ?? "unknown") : o.productKey!;
      const b = byPlan.get(k) ?? { revenueMinor: 0, refundsMinor: 0, costMicros: 0, orgs: new Set() };
      if (o.status === "paid" || o.status === "partially_refunded" || o.status === "refunded") b.revenueMinor += o.amountMinor! - o.taxMinor!;
      b.refundsMinor += o.refundedMinor!;
      b.orgs.add(o.orgId!);
      byPlan.set(k, b);
    }
    for (const e of await all("usageEvents")) {
      const k = planOf.get(e.orgId!) ?? "unpaid";
      const b = byPlan.get(k) ?? { revenueMinor: 0, refundsMinor: 0, costMicros: 0, orgs: new Set() };
      b.costMicros += e.costMicros!;
      byPlan.set(k, b);
    }
    const unresolved = await all("usageReservations");
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
      unresolvedReservationsUsd: microsToUsd(unresolved.reduce((s, r) => s + (r.micros ?? 0), 0)),
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
        // Same settlement as a finished job: charge what it used (monthly credits, then account top-up lots)
        // and release the rest of the hold. Only what wasn't settled by an earlier finish is charged.
        const actual = Math.max(0, run.actualMicros - (run.settled?.micros ?? 0));
        if (period) {
          await settleCredits(ctx, { orgId: run.orgId, period, reservation: { walletMicros: r.walletMicros, topupMicros: r.topupMicros, meters: r.meters }, actualMicros: actual, meters: {} });
        }
        await ctx.db.patch(r._id, { status: "reconciled", actualMicros: actual, reconciledAt: Date.now() });
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
async function grant(ctx: MutationCtx, orgId: Id<"organizations">, usd: number, reason: string, actorId?: string, meters: Record<string, number> = {}) {
  if (!(usd >= 0 && usd <= 500)) throw appError("INVALID", "Grant between $0 and $500 at a time.");
  const org = await ctx.db.get(orgId);
  const period = org ? await currentPeriod(ctx, org) : null;
  if (!period) throw appError("INVALID", "This workspace has no active usage period.");
  const micros = Math.round(usd * 1_000_000);
  // Optional meter top-ups (e.g. web searches), each capped to keep grants deliberate.
  const meterCaps = { ...period.meterCaps } as Record<string, number>;
  const added: string[] = [];
  for (const [k, n] of Object.entries(meters)) {
    if (!(k in meterCaps) || !(n > 0 && n <= 5000)) continue;
    meterCaps[k] = meterCaps[k] + Math.round(n);
    added.push(`${Math.round(n)} ${k}`);
  }
  await ctx.db.patch(period._id, { walletCapMicros: period.walletCapMicros + micros, ...(added.length ? { meterCaps: meterCaps as typeof period.meterCaps } : {}) });
  await audit(ctx, { orgId, actorType: "operator", actorId, action: "ops.grant_capacity", summary: `Granted $${usd.toFixed(2)} of AI capacity${added.length ? ` and ${added.join(", ")}` : ""}: ${reason.slice(0, 200)}` });
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
  args: { slug: v.string(), usd: v.number(), reason: v.string(), meters: v.optional(v.record(v.string(), v.number())) },
  handler: async (ctx, { slug, usd, reason, meters }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) throw appError("NOT_FOUND", "No workspace with that address.");
    await grant(ctx, org._id, usd, reason, undefined, meters ?? {});
  },
});
