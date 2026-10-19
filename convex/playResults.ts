import { v } from "convex/values";
import { internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { playActuals, resultsLine, type PlayActuals } from "../shared/growth/actuals";
import type { PlayModel } from "../shared/agents/economics";

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

async function actualsFor(ctx: QueryCtx, s: Doc<"strategies">): Promise<{ name: string; actuals: PlayActuals; entries: Doc<"playResults">[] }[]> {
  const out = [];
  const all = await ctx.db.query("playResults").withIndex("by_strategy", (q) => q.eq("strategyId", s._id)).take(400);
  for (const p of playsOf(s)) {
    // By stable ID when both have one; older rows by name.
    const entries = all.filter((e) => (p.id && e.playId ? e.playId === p.id : e.playName === p.name)).slice(0, 60);
    if (!entries.length) continue;
    const weeks = (p.horizonDays || 90) / 7;
    out.push({ name: p.name, entries, actuals: playActuals(p.model!, entries, { p10: p.p10 ?? 0, p50: p.p50 ?? 0, p90: p.p90 ?? 0 }, weeks) });
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
    return Object.fromEntries(rows.map((r) => [r.name, { ...r.actuals, entries: r.entries.map((e) => ({ weekStart: e.weekStart, reach: e.reach, steps: e.steps, spendUsd: e.spendUsd, ownerHours: e.ownerHours })) }]));
  },
});

/** Log (or correct) one week of a play's results. */
export const log = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), playName: v.string(), weekStart: v.optional(v.number()), reach: v.number(), steps: v.array(v.number()), spendUsd: v.number(), ownerHours: v.number() },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const s = assertSameOrg(await ctx.db.get(a.strategyId), org._id, "plan");
    const play = playsOf(s).find((p) => p.name === a.playName);
    if (!play) throw appError("NOT_FOUND", "That play isn't in this plan.");
    if (a.steps.length !== play.model!.steps.length) throw appError("INVALID", "Give a number for every step.");
    const nums = [a.reach, ...a.steps, a.spendUsd, a.ownerHours];
    if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 10_000_000)) throw appError("INVALID", "Numbers must be zero or more.");
    // Each step can't have more people than the one before it.
    const chain = [a.reach, ...a.steps];
    if (chain.some((n, i) => i > 0 && n > chain[i - 1])) throw appError("INVALID", "Each step can't be bigger than the one before it.");
    const weekStart = weekOf(a.weekStart ?? Date.now());
    if (weekStart > Date.now()) throw appError("INVALID", "That week hasn't started yet.");
    const existing = (await ctx.db.query("playResults").withIndex("by_strategy", (q) => q.eq("strategyId", s._id)).take(400)).find((e) => e.weekStart === weekStart && (play.id && e.playId ? e.playId === play.id : e.playName === a.playName));
    const row = { reach: Math.round(a.reach), steps: a.steps.map(Math.round), spendUsd: a.spendUsd, ownerHours: a.ownerHours, enteredBy: user._id, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("playResults", { orgId: org._id, strategyId: s._id, playName: a.playName, ...(play.id ? { playId: play.id } : {}), weekStart, ...row });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "play.results_logged", subjectType: "strategy", subjectId: s._id, summary: `Logged results for “${a.playName}”.` });
  },
});

/** First-party results from the last plans, as facts for the next plan's brief. */
export async function resultsBrief(ctx: QueryCtx, orgId: Id<"organizations">): Promise<string> {
  const plans = await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").take(4);
  const lines: string[] = [];
  for (const s of plans) for (const r of await actualsFor(ctx, s)) if (lines.length < 6) lines.push(`- ${resultsLine(r.name, r.actuals)}`);
  return lines.length ? `RESULTS SO FAR (logged by the owner; first-party counts, not proof of cause; small samples have wide ranges; prefer them to benchmarks for the same play):\n${lines.join("\n")}` : "";
}

export const briefFor = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<string> => resultsBrief(ctx, orgId),
});

export type PlayResultsView = Record<string, PlayActuals & { entries: { weekStart: number; reach: number; steps: number[]; spendUsd: number; ownerHours: number }[] }>;
