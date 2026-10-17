import { v } from "convex/values";
import { attribute, OVERLAP_WARNING, summarizePlatformClaims } from "../shared/attribution";
import type { RevenueEvent, Touch } from "../shared/attribution/types";
import { addDays, fillMissingDays, runForecast, type DailyPoint } from "../shared/forecasting";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, requireOrgAccess } from "./lib/tenancy";

const DAY = 86_400_000;

/** Canonical metric definitions. Every number shown carries its definition and source. */
export const METRICS = {
  visits: { label: "Website visits", unit: "count", definition: "Sessions reported by your analytics.", source: "Google Analytics 4" },
  signups: { label: "Sign-ups", unit: "count", definition: "Key events you confirmed as a sign-up (e.g. account created).", source: "Google Analytics 4" },
  paid_conversions: { label: "New paying customers", unit: "count", definition: "Paid orders or first subscription payments from your billing system, deduplicated.", source: "Billing" },
  revenue: { label: "Revenue (net of refunds)", unit: "currency_minor", definition: "Paid billing amounts minus refunds, by the day they happened in your business timezone.", source: "Billing" },
} as const;
export type MetricKey = keyof typeof METRICS;

function dayKey(ms: number, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

export async function upsertDailyImpl(
  ctx: MutationCtx,
  orgId: Id<"organizations">,
  source: string,
  kind: "observed" | "attributed" | "platform_reported",
  rows: { metricKey: string; date: string; value: number; channel?: string }[],
  isFixture = false,
) {
  const now = Date.now();
  for (const r of rows) {
    const existing = await ctx.db
      .query("metricDaily")
      .withIndex("by_org_metric_date", (q) => q.eq("orgId", orgId).eq("metricKey", r.metricKey).eq("date", r.date))
      .take(20);
    const same = existing.find((e) => e.source === source && e.kind === kind && e.channel === r.channel);
    if (same) await ctx.db.patch(same._id, { value: r.value, ingestedAt: now });
    else await ctx.db.insert("metricDaily", { orgId, metricKey: r.metricKey, date: r.date, value: r.value, source, kind, channel: r.channel, isFixture, ingestedAt: now });
  }
}

export const upsertDaily = internalMutation({
  args: {
    orgId: v.id("organizations"),
    source: v.string(),
    kind: v.union(v.literal("observed"), v.literal("attributed"), v.literal("platform_reported")),
    rows: v.array(v.object({ metricKey: v.string(), date: v.string(), value: v.number(), channel: v.optional(v.string()) })),
  },
  handler: async (ctx, { orgId, source, kind, rows }) => upsertDailyImpl(ctx, orgId, source, kind, rows),
});

const revenueEventValidator = v.object({
  source: v.string(),
  sourceEventId: v.string(),
  occurredAt: v.number(),
  customerRef: v.optional(v.string()),
  orderRef: v.optional(v.string()),
  currency: v.string(),
  amountMinor: v.number(),
  refundedMinor: v.number(),
  kind: v.union(v.literal("order"), v.literal("subscription_payment"), v.literal("refund")),
  utmSource: v.optional(v.string()),
  utmMedium: v.optional(v.string()),
  utmCampaign: v.optional(v.string()),
});

/** Deduplicated revenue ingestion + daily materialization for affected days. */
export const ingestRevenue = internalMutation({
  args: { orgId: v.id("organizations"), events: v.array(revenueEventValidator) },
  handler: async (ctx, { orgId, events }) => {
    const org = await ctx.db.get(orgId);
    if (!org) return 0;
    const now = Date.now();
    const days = new Set<string>();
    let inserted = 0;
    for (const e of events) {
      const dup = await ctx.db
        .query("revenueEvents")
        .withIndex("by_org_source_event", (q) => q.eq("orgId", orgId).eq("source", e.source).eq("sourceEventId", e.sourceEventId))
        .first();
      if (dup) {
        // A refund update on a known event: keep the latest refunded amount.
        if (dup.refundedMinor !== e.refundedMinor) {
          await ctx.db.patch(dup._id, { refundedMinor: e.refundedMinor });
          days.add(dayKey(dup.occurredAt, org.timezone));
        }
        continue;
      }
      await ctx.db.insert("revenueEvents", { ...e, currency: e.currency.toUpperCase(), orgId, isFixture: false, ingestedAt: now });
      if (e.customerRef && (e.utmSource || e.utmMedium || e.utmCampaign)) {
        await ctx.db.insert("touches", {
          orgId,
          customerRef: e.customerRef,
          occurredAt: e.occurredAt - 1,
          channel: e.utmMedium === "cpc" ? `${e.utmSource ?? "paid"} ads` : (e.utmSource ?? e.utmMedium ?? "tagged"),
          utmSource: e.utmSource,
          utmMedium: e.utmMedium,
          utmCampaign: e.utmCampaign,
          isFixture: false,
        });
      }
      days.add(dayKey(e.occurredAt, org.timezone));
      inserted++;
    }
    for (const day of days) await rematerializeRevenueDay(ctx, orgId, day, org.timezone, org.currency);
    return inserted;
  },
});

async function rematerializeRevenueDay(ctx: MutationCtx, orgId: Id<"organizations">, day: string, timezone: string, currency: string) {
  // Bounded window around the day to account for timezone offsets.
  const start = Date.parse(`${day}T00:00:00Z`) - DAY;
  const end = start + 3 * DAY;
  const events = await ctx.db
    .query("revenueEvents")
    .withIndex("by_org_occurred", (q) => q.eq("orgId", orgId).gte("occurredAt", start).lt("occurredAt", end))
    .take(10_000);
  let revenue = 0;
  let conversions = 0;
  for (const e of events) {
    if (dayKey(e.occurredAt, timezone) !== day || e.currency !== currency) continue;
    if (e.kind === "refund") revenue -= Math.abs(e.amountMinor);
    else {
      revenue += e.amountMinor - e.refundedMinor;
      conversions++;
    }
  }
  await upsertDailyImpl(ctx, orgId, "billing", "observed", [
    { metricKey: "revenue", date: day, value: revenue },
    { metricKey: "paid_conversions", date: day, value: conversions },
  ]);
}

export const markCsvConnected = internalMutation({
  args: { orgId: v.id("organizations"), userId: v.id("users") },
  handler: async (ctx, { orgId, userId }) => {
    const existing = await ctx.db
      .query("connections")
      .withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", "csv_revenue"))
      .first();
    const now = Date.now();
    if (existing) await ctx.db.patch(existing._id, { status: "connected", lastSyncAt: now, updatedAt: now });
    else
      await ctx.db.insert("connections", { orgId, provider: "csv_revenue", status: "connected", accountLabel: "Uploaded file", scopes: [], isFixture: false, lastSyncAt: now, createdBy: userId, createdAt: now, updatedAt: now });
    await audit(ctx, { orgId, actorType: "user", actorId: userId, action: "revenue.csv_imported", summary: "Revenue file imported." });
  },
});

async function series(ctx: { db: QueryCtx["db"] }, orgId: Id<"organizations">, metricKey: string, from: string, to: string, kind: "observed" = "observed") {
  const rows = await ctx.db
    .query("metricDaily")
    .withIndex("by_org_metric_date", (q) => q.eq("orgId", orgId).eq("metricKey", metricKey).gte("date", from).lte("date", to))
    .take(2000);
  const byDate = new Map<string, number>();
  let freshness = 0;
  let source = "";
  let isFixture = false;
  for (const r of rows) {
    if (r.kind !== kind || r.channel) continue;
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.value);
    freshness = Math.max(freshness, r.ingestedAt);
    source = r.source;
    isFixture = isFixture || r.isFixture;
  }
  const points: DailyPoint[] = [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, value]) => ({ date, value }));
  return { points, freshness, source, isFixture };
}

export const overview = query({
  args: { slug: v.string(), days: v.optional(v.number()) },
  handler: async (ctx, { slug, days }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const span = Math.max(7, Math.min(365, days ?? 30));
    const today = dayKey(Date.now(), org.timezone);
    const from = addDays(today, -span);
    const prevFrom = addDays(today, -2 * span);
    const metrics = [];
    for (const key of Object.keys(METRICS) as MetricKey[]) {
      const cur = await series(ctx, org._id, key, from, addDays(today, -1));
      const prev = await series(ctx, org._id, key, prevFrom, addDays(from, -1));
      const total = cur.points.reduce((s, p) => s + p.value, 0);
      const prevTotal = prev.points.reduce((s, p) => s + p.value, 0);
      metrics.push({
        key,
        ...METRICS[key],
        hasData: cur.points.length > 0,
        total,
        previousTotal: prev.points.length > 0 ? prevTotal : null,
        points: cur.points,
        freshness: cur.freshness || null,
        sourceName: cur.source || null,
        isFixture: cur.isFixture,
        currency: key === "revenue" ? org.currency : null,
        timezone: org.timezone,
      });
    }

    // Attribution: billing revenue is the truth; ad-platform claims shown separately.
    const startMs = Date.parse(`${from}T00:00:00Z`);
    const revenueRows = await ctx.db
      .query("revenueEvents")
      .withIndex("by_org_occurred", (q) => q.eq("orgId", org._id).gte("occurredAt", startMs))
      .take(5000);
    const events: RevenueEvent[] = revenueRows.map((r) => ({
      id: r._id,
      sourceEventId: r.sourceEventId,
      source: r.source,
      occurredAt: r.occurredAt,
      customerRef: r.customerRef,
      orderRef: r.orderRef,
      currency: r.currency,
      amountMinor: r.amountMinor,
      refundedMinor: r.refundedMinor,
      kind: r.kind,
    }));
    const customers = [...new Set(revenueRows.map((r) => r.customerRef).filter((c): c is string => Boolean(c)))].slice(0, 2000);
    const touches: Touch[] = [];
    for (const c of customers) {
      const ts = await ctx.db
        .query("touches")
        .withIndex("by_org_customer", (q) => q.eq("orgId", org._id).eq("customerRef", c))
        .take(20);
      for (const t of ts) touches.push({ customerRef: t.customerRef, occurredAt: t.occurredAt, channel: t.channel, utmSource: t.utmSource, utmMedium: t.utmMedium, utmCampaign: t.utmCampaign });
    }
    const lastTouch = events.length ? attribute(events, touches, { model: "last_touch", lookbackDays: 30 }) : null;
    const firstTouch = events.length ? attribute(events, touches, { model: "first_touch", lookbackDays: 30 }) : null;

    const claimsRows = [];
    for (const platform of ["google_ads", "meta_ads"]) {
      const rows = await ctx.db
        .query("platformClaims")
        .withIndex("by_org_platform_date", (q) => q.eq("orgId", org._id).eq("platform", platform).gte("date", from))
        .take(400);
      claimsRows.push(...rows);
    }
    const claims = claimsRows.length
      ? summarizePlatformClaims(claimsRows.map((c) => ({ platform: c.platform, date: c.date, conversions: c.conversions, conversionValueMinor: c.conversionValueMinor, currency: c.currency })))
      : null;
    const adSpendMinor = claimsRows.reduce((s, c) => s + c.spendMinor, 0);

    const forecasts = await ctx.db
      .query("forecastRuns")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(10);
    const connections = await ctx.db
      .query("connections")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(50);
    const connected = (p: string) => connections.some((c) => c.provider === p && c.status === "connected");
    const gaps: { metric: string; message: string; fix: string }[] = [];
    if (!connected("ga4")) gaps.push({ metric: "visits", message: "Visits and sign-ups need Google Analytics.", fix: "Connect Google Analytics 4" });
    if (!connected("stripe_revenue") && !connected("csv_revenue")) gaps.push({ metric: "revenue", message: "Revenue needs your billing data.", fix: "Connect Stripe (read-only) or upload a revenue CSV" });
    if (!connected("search_console")) gaps.push({ metric: "search", message: "Search performance needs Google Search Console.", fix: "Connect Search Console" });

    return {
      span,
      from,
      to: addDays(today, -1),
      currency: org.currency,
      timezone: org.timezone,
      isDemo: org.kind === "demo",
      metrics,
      attribution: {
        lastTouch: lastTouch ? summarizeAttribution(lastTouch) : null,
        firstTouch: firstTouch ? summarizeAttribution(firstTouch) : null,
        note: "Billing revenue is the source of truth. Channel credit uses tracked links (UTM) within 30 days; revenue with no tracked source stays in “Unattributed”. Attribution shows association, not cause.",
      },
      platformClaims: claims
        ? { platforms: claims.platforms, warning: OVERLAP_WARNING, adSpendMinor }
        : null,
      forecasts: forecasts.map((f) => ({ id: f._id, metricKey: f.metricKey, status: f.status, horizonDays: f.horizonDays, createdAt: f.createdAt, isFixture: f.isFixture })),
      gaps,
    };
  },
});

function summarizeAttribution(res: ReturnType<typeof attribute>) {
  return {
    model: res.model,
    reconciled: res.reconciled,
    byCurrency: Object.values(res.byCurrency).map((c) => ({
      currency: c.currency,
      channels: Object.entries(c.channels)
        .map(([channel, t]) => ({ channel, netRevenueMinor: t.netRevenueMinor, conversions: t.conversions }))
        .sort((a, b) => b.netRevenueMinor - a.netRevenueMinor),
      unattributed: { netRevenueMinor: c.unattributed.netRevenueMinor, conversions: c.unattributed.conversions },
      totalNetBillingMinor: c.totalNetBillingMinor,
      reconciled: c.reconciled,
    })),
  };
}

/** Deterministic forecast + rolling-origin backtest. No language model involved. */
export const createForecast = mutation({
  args: {
    slug: v.string(),
    metricKey: v.union(v.literal("visits"), v.literal("signups"), v.literal("paid_conversions"), v.literal("revenue")),
    horizonDays: v.number(),
  },
  handler: async (ctx, { slug, metricKey, horizonDays }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const horizon = [7, 30, 90].includes(horizonDays) ? horizonDays : 30;
    const today = dayKey(Date.now(), org.timezone);
    const hist = await series(ctx, org._id, metricKey, addDays(today, -1100), addDays(today, -1));
    if (hist.points.length === 0) {
      throw appError("INVALID", `No ${METRICS[metricKey].label.toLowerCase()} data yet. Connect a data source first.`);
    }
    // Missing days for count/revenue metrics from a connected source are true zeros only when the source reported the day;
    // gaps are reported, not invented.
    const filled = fillMissingDays(hist.points, "zero_fill_known_count");
    const result = runForecast({ series: filled.series, horizonDays: horizon, method: "seasonal_naive", nonNegative: true, seed: 7 });
    if (filled.missingDates.length > 0) {
      result.warnings.push(`${filled.missingDates.length} day(s) had no data and were treated as zero.`);
    }
    const forecastId = await ctx.db.insert("forecastRuns", {
      orgId: org._id,
      metricKey,
      method: result.method,
      horizonDays: horizon,
      status: result.status,
      result: JSON.stringify({ points: result.points, calibration: result.calibration, assumptions: result.assumptions, warnings: result.warnings }),
      dataThrough: filled.series[filled.series.length - 1]?.date,
      historyDays: filled.series.length,
      isFixture: hist.isFixture,
      createdAt: Date.now(),
    });
    if (result.backtest) {
      await ctx.db.insert("backtestRuns", { orgId: org._id, forecastRunId: forecastId, metricKey, result: JSON.stringify(result.backtest), createdAt: Date.now() });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "forecast.created", subjectType: "forecast", subjectId: forecastId, summary: `${METRICS[metricKey].label} forecast (${horizon} days): ${result.status}.` });
    return forecastId;
  },
});

export const getForecast = query({
  args: { slug: v.string(), forecastId: v.id("forecastRuns") },
  handler: async (ctx, { slug, forecastId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const f = await ctx.db.get(forecastId);
    if (!f || f.orgId !== org._id) throw appError("NOT_FOUND", "We couldn't find that forecast.");
    const backtest = await ctx.db
      .query("backtestRuns")
      .withIndex("by_forecast", (q) => q.eq("forecastRunId", f._id))
      .first();
    const today = dayKey(Date.now(), org.timezone);
    const hist = await series(ctx, org._id, f.metricKey, addDays(today, -120), addDays(today, -1));
    return {
      id: f._id,
      metricKey: f.metricKey,
      metric: METRICS[f.metricKey as MetricKey],
      method: f.method,
      horizonDays: f.horizonDays,
      status: f.status,
      dataThrough: f.dataThrough ?? null,
      historyDays: f.historyDays,
      isFixture: f.isFixture,
      createdAt: f.createdAt,
      currency: org.currency,
      history: hist.points,
      ...(JSON.parse(f.result) as {
        points: { date: string; value: number; lo80?: number; hi80?: number; lo95?: number; hi95?: number }[];
        calibration: { residualCounts: number[]; heldOutCoverage80: number | null; heldOutCoverage95: number | null; heldOutCount: number; reason: string | null };
        assumptions: string[];
        warnings: string[];
      }),
      backtest: backtest ? JSON.parse(backtest.result) : null,
    };
  },
});
