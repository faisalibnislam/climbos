import { diagnoseShortfall, shortfallLine } from "../shared/growth/diagnostics";
import { v } from "convex/values";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { forecastCalibration, playActuals, resultsLine, retentionActuals, type PlayActuals, type RetentionActuals } from "../shared/growth/actuals";
import { inferenceOf, isRedefined, outcomeLine, outcomeProblems, sameDefinition } from "../shared/growth/experimentOutcome";
import type { PlayModel } from "../shared/agents/economics";
import { formatMoney, minorToMajor } from "../shared/economics/currency";

/**
 * Learning from outcomes (spec §28): the owner logs what each play did each
 * week; code compares it with the plan, updates the rates, and the next plan
 * starts from these first-party numbers.
 */

const DAY = 86_400_000;

/** Monday 00:00 UTC of the week containing `t`. */
export function weekOf(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY;
}

type SavedPlay = { name: string; id?: string; model?: PlayModel; p10?: number; p50?: number; p90?: number; horizonDays?: number };

function playsOf(s: Doc<"strategies">): SavedPlay[] {
  return ((s.expert?.plays ?? []) as SavedPlay[]).filter((p) => p.model?.steps?.length);
}

async function actualsFor(ctx: QueryCtx, s: Doc<"strategies">): Promise<{ name: string; killIf?: string; actuals: PlayActuals; retention: RetentionActuals; entries: Doc<"playResults">[]; forecast: { p10: number; p90: number }; horizonWeeks: number }[]> {
  const out = [];
  const all = await ctx.db.query("playResults").withIndex("by_strategy", (q) => q.eq("strategyId", s._id)).take(400);
  for (const p of playsOf(s)) {
    // By stable ID when both have one; older rows by name.
    const entries = all.filter((e) => (p.id && e.playId ? e.playId === p.id : e.playName === p.name)).slice(0, 60);
    if (!entries.length) continue;
    const weeks = (p.horizonDays || 90) / 7;
    // Time zero is the week the plan was made: earlier weeks aren't this play's results (Hernán & Robins Ch 22).
    const startWeek = weekOf(s._creationTime);
    out.push({ name: p.name, killIf: (p as { killIf?: string }).killIf, entries, forecast: { p10: p.p10 ?? 0, p90: p.p90 ?? 0 }, horizonWeeks: weeks, actuals: playActuals(p.model!, entries, { p10: p.p10 ?? 0, p50: p.p50 ?? 0, p90: p.p90 ?? 0 }, weeks, { startWeek }), retention: retentionActuals(entries.filter((entry) => entry.weekStart >= startWeek)) });
  }
  return out;
}

/** Results for every play in a plan, for the play cards. */
export const forStrategy = query({
  args: { slug: v.string(), strategyId: v.id("strategies") },
  handler: async (ctx, { slug, strategyId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const s = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    const rows = await actualsFor(ctx, s);
    return Object.fromEntries(rows.map((r) => [r.name, { ...r.actuals, retention: r.retention, entries: r.entries.map((e) => ({ weekStart: e.weekStart, reach: e.reach, steps: e.steps, spendUsd: e.spendUsd, ownerHours: e.ownerHours, ...(e.repeatCustomers !== undefined ? { repeatCustomers: e.repeatCustomers } : {}), ...(e.retainedRevenueMinor !== undefined ? { retainedRevenueMinor: e.retainedRevenueMinor } : {}), ...(e.retainedContributionMinor !== undefined ? { retainedContributionMinor: e.retainedContributionMinor } : {}), ...(e.retentionCurrency ? { retentionCurrency: e.retentionCurrency } : {}) })) }]));
  },
});

/** Log (or correct) one week of a play's results. */
export const log = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), playName: v.string(), weekStart: v.optional(v.number()), reach: v.number(), steps: v.array(v.number()), spendUsd: v.number(), ownerHours: v.number(), repeatCustomers: v.optional(v.number()), retainedRevenueMinor: v.optional(v.number()), retainedContributionMinor: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const s = assertSameOrg(await ctx.db.get(a.strategyId), org._id, "plan");
    const business = await ctx.db.get(s.businessId);
    const play = playsOf(s).find((p) => p.name === a.playName);
    if (!play) throw appError("NOT_FOUND", "That play isn't in this plan.");
    if (a.steps.length !== play.model!.steps.length) throw appError("INVALID", "Give a number for every step.");
    const nums = [a.reach, ...a.steps, a.spendUsd, a.ownerHours];
    if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 10_000_000)) throw appError("INVALID", "Numbers must be zero or more.");
    if (a.repeatCustomers !== undefined && (!Number.isSafeInteger(a.repeatCustomers) || a.repeatCustomers < 0 || a.repeatCustomers > 10_000_000)) throw appError("INVALID", "Repeat-customer count must be a whole number from zero to ten million.");
    if (a.retainedRevenueMinor !== undefined && (!Number.isSafeInteger(a.retainedRevenueMinor) || a.retainedRevenueMinor > 1_000_000_000_000)) throw appError("INVALID", "Retained revenue must be a valid amount in minor currency units.");
    if (a.retainedContributionMinor !== undefined && (!Number.isSafeInteger(a.retainedContributionMinor) || Math.abs(a.retainedContributionMinor) > 1_000_000_000_000)) throw appError("INVALID", "Retained contribution must be a valid amount in minor currency units.");
    if ((a.retainedRevenueMinor !== undefined || a.retainedContributionMinor !== undefined) && !business?.currency) throw appError("INVALID", "Set the business currency before logging retained revenue or contribution.");
    // Each step can't have more people than the one before it.
    const chain = [a.reach, ...a.steps];
    if (chain.some((n, i) => i > 0 && n > chain[i - 1])) throw appError("INVALID", "Each step can't be bigger than the one before it.");
    const weekStart = weekOf(a.weekStart ?? Date.now());
    if (weekStart > Date.now()) throw appError("INVALID", "That week hasn't started yet.");
    if (weekStart < weekOf(s._creationTime)) throw appError("INVALID", "That week is before this plan was made, so it isn't this play's result.");
    const existing = (await ctx.db.query("playResults").withIndex("by_strategy", (q) => q.eq("strategyId", s._id)).take(400)).find((e) => e.weekStart === weekStart && (play.id && e.playId ? e.playId === play.id : e.playName === a.playName));
    const row = { reach: Math.round(a.reach), steps: a.steps.map(Math.round), spendUsd: a.spendUsd, ownerHours: a.ownerHours, repeatCustomers: a.repeatCustomers, retainedRevenueMinor: a.retainedRevenueMinor, retainedContributionMinor: a.retainedContributionMinor, retentionCurrency: a.retainedRevenueMinor !== undefined || a.retainedContributionMinor !== undefined ? business!.currency : undefined, enteredBy: user._id, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("playResults", { orgId: org._id, strategyId: s._id, playName: a.playName, ...(play.id ? { playId: play.id } : {}), weekStart, ...row });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "play.results_logged", subjectType: "strategy", subjectId: s._id, summary: `Logged results for “${a.playName}”.` });
  },
});

type Analysis = NonNullable<Doc<"experiments">["analyses"]>[number];
const MAX_ANALYSES = 12;

/**
 * Record a test's outcome (Book 14 §14). Code labels what it can claim. A
 * change of metric or success rule is saved as a new analysis; the same
 * definition corrects the latest one.
 */
export const recordExperimentOutcome = mutation({
  args: {
    slug: v.string(),
    experimentId: v.id("experiments"),
    executed: v.boolean(),
    source: v.union(v.literal("owner_report"), v.literal("integration"), v.literal("platform_report")),
    design: v.union(v.literal("none"), v.literal("before_after"), v.literal("holdout"), v.literal("randomized")),
    eligible: v.optional(v.number()),
    exposed: v.optional(v.number()),
    conversions: v.optional(v.number()),
    controlSize: v.optional(v.number()),
    controlConversions: v.optional(v.number()),
    plannedSharePct: v.optional(v.number()),
    assignment: v.optional(v.union(v.literal("random"), v.literal("rule"), v.literal("owner_choice"))),
    windowStart: v.optional(v.string()),
    windowEnd: v.optional(v.string()),
    metric: v.optional(v.string()),
    successRule: v.optional(v.string()),
    result: v.union(v.literal("met"), v.literal("missed"), v.literal("unclear")),
    stopRuleHit: v.boolean(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { slug, experimentId, ...a }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const e = assertSameOrg(await ctx.db.get(experimentId), org._id, "experiment");
    const input = { ...a, metric: (a.metric ?? e.primaryMetric).trim(), successRule: (a.successRule ?? e.stoppingRule).trim(), note: a.note?.trim() || undefined };
    const problems = outcomeProblems(input, new Date().toISOString().slice(0, 10));
    if (problems.length) throw appError("INVALID", problems[0]);
    const prior = e.analyses ?? [];
    const last = prior.at(-1);
    const correction = Boolean(last && sameDefinition(last, input));
    if (!correction && prior.length >= MAX_ANALYSES) throw appError("INVALID", "Too many analyses on this test.");
    const row: Analysis = {
      ...input,
      n: correction ? last!.n : (last?.n ?? 0) + 1,
      inference: inferenceOf(input),
      redefined: isRedefined(input, e),
      reviewedBy: user._id,
      reviewedAt: Date.now(),
    };
    const analyses = correction ? [...prior.slice(0, -1), row] : [...prior, row];
    await ctx.db.patch(e._id, { analyses, status: a.executed ? "concluded" : "stopped" });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "experiment.outcome_recorded", subjectType: "experiment", subjectId: e._id, summary: `Recorded “${e.name}” (analysis ${row.n}, ${row.inference}).` });
    return { n: row.n, inference: row.inference, newAnalysis: !correction };
  },
});

/** Reviewed test outcomes from the given plans: tested ones as lessons, untested ones kept apart. */
async function outcomeLines(ctx: QueryCtx, plans: Doc<"strategies">[]): Promise<{ tested: string[]; notRun: string[] }> {
  const tested: string[] = [];
  const notRun: string[] = [];
  for (const s of plans) {
    for (const e of await ctx.db.query("experiments").withIndex("by_strategy", (q) => q.eq("strategyId", s._id)).take(10)) {
      const latest = e.analyses?.at(-1);
      if (!latest?.reviewedAt) continue;
      const original = e.analyses!.find((x) => !x.redefined && x.inference !== "not_run")?.result;
      const line = `- ${outcomeLine(e.name, latest, latest.redefined ? original : undefined)}`;
      if (latest.inference === "not_run") notRun.push(line);
      else tested.push(line);
    }
  }
  return { tested: tested.slice(0, 6), notRun: notRun.slice(0, 4) };
}

/** First-party results from the last plans, as facts for the next plan's brief. */
export async function resultsBrief(ctx: QueryCtx, orgId: Id<"organizations">): Promise<string> {
  const plans = await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").take(4);
  const lines: string[] = [];
  const matured: { customers: number; p10: number; p90: number }[] = [];
  for (const s of plans)
    for (const r of await actualsFor(ctx, s)) {
      // Calibration only on plays that ran their whole horizon with every week logged.
      if (r.actuals.weeks >= Math.floor(r.horizonWeeks) && r.actuals.weeksSinceStart === r.actuals.weeks && r.forecast.p90 > 0) matured.push({ customers: r.actuals.customers, ...r.forecast });
      if (lines.length < 6) {
        lines.push(`- ${resultsLine(r.name, r.actuals)}`);
        if (r.retention.weeksReported) lines.push(`  OWNER-REPORTED REPEAT-CUSTOMER OUTCOMES (association with this play is not attribution or causation): ${r.retention.repeatCustomerWeeks} customer-week(s); net revenue ${r.retention.revenueByCurrency.map((x) => `${formatMoney(minorToMajor(x.netRevenueMinor, x.currency), x.currency)} over ${x.weeksReported} week(s)`).join(", ") || "not reported"}; retained contribution ${r.retention.contributionByCurrency.map((x) => `${formatMoney(minorToMajor(x.contributionMinor, x.currency), x.currency)} over ${x.weeksReported} week(s)`).join(", ") || "not reported"}. These values are separate from new-customer forecasts and may omit unreported weeks.`);
        // A play that's behind gets a diagnosis, not more budget (cycle 2).
        if (r.actuals.status === "behind") lines.push(`  ${shortfallLine(r.name, diagnoseShortfall(r.actuals, { killIf: r.killIf }))}`);
      }
    }
  const wonDealLines = await wonDealsByPlay(ctx, orgId, plans);
  const cal = forecastCalibration(matured);
  const { tested, notRun } = await outcomeLines(ctx, plans);
  const parts = [
    cal.verdict !== "too_few_plays" ? `FORECAST CALIBRATION (computed; plays that ran their full horizon): ${cal.inside} of ${cal.matured} landed inside their P10–P90 range (an 80% range, so about ${cal.expected} expected).${cal.verdict === "overconfident" ? ` That few is unlikely by chance (P = ${cal.pTooFew}): past ranges were too narrow, so widen this plan's ranges and lean on measured rates.` : " Consistent with the stated ranges."}` : "",
    lines.length ? `RESULTS SO FAR (logged by the owner; first-party counts, not proof of cause; small samples have wide ranges; prefer them to benchmarks for the same play):\n${lines.join("\n")}` : "",
    wonDealLines.length ? `WON DEALS ASSOCIATED WITH PLAYS (owner-entered CRM stages and values; target links show association, not attribution or causation; these are not retained revenue):\n${wonDealLines.join("\n")}` : "",
    tested.length ? `EXPERIMENT OUTCOMES (owner-reviewed; each label says what it can claim: OBSERVED and ATTRIBUTED are not proof of cause; only INCREMENTAL compared with a group that didn't get the change, so only those may be called incremental):\n${tested.join("\n")}` : "",
    notRun.length ? `TESTS NOT RUN (the plan wasn't carried out; draw no lesson about these channels):\n${notRun.join("\n")}` : "",
  ];
  return parts.filter(Boolean).join("\n\n");
}

/** Attribute a CRM win only as an owner-reported association through a stable target play ID. */
async function wonDealsByPlay(ctx: QueryCtx, orgId: Id<"organizations">, plans: Doc<"strategies">[]): Promise<string[]> {
  const byId = new Map<string, { name: string; since: number }>();
  for (const strategy of plans) {
    for (const play of playsOf(strategy)) {
      if (!play.id) continue;
      const prior = byId.get(play.id);
      byId.set(play.id, { name: play.name, since: Math.min(prior?.since ?? strategy.createdAt, strategy.createdAt) });
    }
  }
  if (!byId.size) return [];
  const deals = await ctx.db.query("deals").withIndex("by_org_stage", (q) => q.eq("orgId", orgId).eq("stage", "won")).take(500);
  const totals = new Map<string, { count: number; values: Map<string, number>; unvalued: number }>();
  for (const deal of deals) {
    if (!deal.prospectId || deal.wonAt === undefined) continue;
    const prospect = await ctx.db.get(deal.prospectId);
    if (!prospect || prospect.orgId !== orgId) continue;
    for (const playId of new Set(prospect.playIds ?? [])) {
      const play = byId.get(playId);
      if (!play || deal.wonAt < play.since) continue;
      const entry = totals.get(playId) ?? { count: 0, values: new Map<string, number>(), unvalued: 0 };
      entry.count += 1;
      if (deal.valueMinor === undefined) entry.unvalued += 1;
      else entry.values.set(deal.currency, (entry.values.get(deal.currency) ?? 0) + deal.valueMinor);
      totals.set(playId, entry);
    }
  }
  return [...totals.entries()].map(([id, result]) => {
    const play = byId.get(id)!;
    const amounts = [...result.values.entries()].map(([currency, minor]) => formatMoney(minorToMajor(minor, currency), currency));
    const value = amounts.length ? `; recorded deal value ${amounts.join(", ")}` : "";
    const missing = result.unvalued ? `; ${result.unvalued} deal value${result.unvalued === 1 ? "" : "s"} not recorded` : "";
    return `- ${play.name}: ${result.count} owner-marked won CRM deal${result.count === 1 ? "" : "s"}${value}${missing}`;
  }).slice(0, 6);
}

export const briefFor = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<string> => resultsBrief(ctx, orgId),
});

export type PlayResultsView = Record<string, PlayActuals & { retention: RetentionActuals; entries: { weekStart: number; reach: number; steps: number[]; spendUsd: number; ownerHours: number; repeatCustomers?: number; retainedRevenueMinor?: number; retainedContributionMinor?: number; retentionCurrency?: string }[] }>;
