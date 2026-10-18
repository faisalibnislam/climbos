import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireStaff } from "./lib/staff";
import { appError } from "./lib/tenancy";

/**
 * Self-improvement loop 3 — the engine lab. Weekly, Luna reads what reviewers
 * flagged on real growth plans and proposes a few playbook rules. Staff can
 * A/B test a proposal on the fixed Formkit case (≈$0.30, capped at $5/month)
 * and approve it; approved rules join that agent's playbook. Quality is
 * tracked from real review scores before and after.
 */

export const LAB_AGENTS = ["growth_plays", "growth_strategy"] as const;
export const MONTHLY_CAP_MICROS = 5_000_000;
const DAY = 86_400_000;

const monthKey = () => `labSpend:${new Date().toISOString().slice(0, 7)}`;

async function spentThisMonth(ctx: QueryCtx): Promise<number> {
  const row = await ctx.db.query("appConfig").withIndex("by_key", (q) => q.eq("key", monthKey())).first();
  return row ? Number(row.value) : 0;
}

export const spend = internalQuery({ args: {}, handler: async (ctx) => spentThisMonth(ctx) });

export const addSpend = internalMutation({
  args: { micros: v.number() },
  handler: async (ctx, { micros }) => {
    const key = monthKey();
    const row = await ctx.db.query("appConfig").withIndex("by_key", (q) => q.eq("key", key)).first();
    const value = String((row ? Number(row.value) : 0) + Math.max(0, Math.round(micros)));
    if (row) await ctx.db.patch(row._id, { value, updatedAt: Date.now() });
    else await ctx.db.insert("appConfig", { key, value, updatedAt: Date.now() });
  },
});

/** Approved rules for an agent (joined into its playbook by the job runner). */
export const addendumFor = internalQuery({
  args: { agentId: v.string() },
  handler: async (ctx, { agentId }): Promise<string> => {
    const rows = await ctx.db.query("engineProposals").withIndex("by_agent_status", (q) => q.eq("agentId", agentId).eq("status", "approved")).take(10);
    return rows.map((r) => r.rules).join("\n").slice(0, 3000);
  },
});

/** Average review score (1–5) of real runs for each lab agent, per week, last 8 weeks. */
async function qualityTrend(ctx: QueryCtx) {
  const since = Date.now() - 56 * DAY;
  const runs = (await ctx.db.query("workflowRuns").withIndex("by_status_updated", (q) => q.eq("status", "verified").gte("updatedAt", since)).take(400)).filter((r) => r.kind === "strategy");
  const weeks = new Map<string, { sum: number; n: number }>();
  for (const r of runs) {
    const steps = await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", r._id)).take(80);
    for (const s of steps) {
      if (!/^Growth (plays|plan): review 1$/.test(s.label) || !s.output) continue;
      try {
        const c = JSON.parse(s.output) as { scores?: { score: number }[] };
        if (!c.scores?.length) continue;
        const avg = c.scores.reduce((a, b) => a + b.score, 0) / c.scores.length;
        const agent = s.label.startsWith("Growth plays") ? "growth_plays" : "growth_strategy";
        const wk = `${agent}|${new Date(r.updatedAt - ((new Date(r.updatedAt).getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10)}`;
        const w = weeks.get(wk) ?? { sum: 0, n: 0 };
        weeks.set(wk, { sum: w.sum + avg, n: w.n + 1 });
      } catch {
        // Not a critique.
      }
    }
  }
  return [...weeks.entries()].map(([k, w]) => ({ agent: k.split("|")[0], week: k.split("|")[1], score: Math.round((w.sum / w.n) * 100) / 100, plans: w.n })).sort((a, b) => a.week.localeCompare(b.week));
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx, "read");
    const proposals: Doc<"engineProposals">[] = [];
    for (const agentId of LAB_AGENTS) for (const status of ["proposed", "testing", "approved"] as const) proposals.push(...(await ctx.db.query("engineProposals").withIndex("by_agent_status", (q) => q.eq("agentId", agentId).eq("status", status)).take(20)));
    proposals.sort((a, b) => b.createdAt - a.createdAt);
    return {
      spentMicros: await spentThisMonth(ctx),
      capMicros: MONTHLY_CAP_MICROS,
      proposals: proposals.map((p) => ({ id: p._id, agentId: p.agentId, rules: p.rules, rationale: p.rationale, status: p.status, test: p.test ?? null, createdAt: p.createdAt })),
      trend: await qualityTrend(ctx),
    };
  },
});

export const test = mutation({
  args: { id: v.id("engineProposals") },
  handler: async (ctx, { id }) => {
    await requireStaff(ctx, "features");
    const p = await ctx.db.get(id);
    if (!p || p.status !== "proposed") throw appError("INVALID", "Only new proposals can be tested.");
    if ((await spentThisMonth(ctx)) + 400_000 > MONTHLY_CAP_MICROS) throw appError("LIMIT_REACHED", "This month's $5 lab budget is used up.");
    await ctx.db.patch(id, { status: "testing", test: { costMicros: 0, at: Date.now() } });
    await ctx.scheduler.runAfter(0, internal.engineLabActions.runArm, { id, arm: "baseline" });
    await ctx.scheduler.runAfter(0, internal.engineLabActions.runArm, { id, arm: "variant" });
  },
});

export const decide = mutation({
  args: { id: v.id("engineProposals"), decision: v.union(v.literal("approved"), v.literal("rejected"), v.literal("retired")) },
  handler: async (ctx, { id, decision }) => {
    const { user } = await requireStaff(ctx, "features");
    const p = await ctx.db.get(id);
    if (!p) throw appError("NOT_FOUND", "Gone.");
    await ctx.db.patch(id, { status: decision, decidedBy: user._id, decidedAt: Date.now() });
  },
});

export const proposalById = internalQuery({ args: { id: v.id("engineProposals") }, handler: async (ctx, { id }) => ctx.db.get(id) });

export const recordArm = internalMutation({
  args: { id: v.id("engineProposals"), arm: v.union(v.literal("baseline"), v.literal("variant")), score: v.optional(v.number()), costMicros: v.number(), error: v.optional(v.string()) },
  handler: async (ctx, { id, arm, score, costMicros, error }) => {
    const p = await ctx.db.get(id);
    if (!p) return;
    const t = p.test ?? { costMicros: 0, at: Date.now() };
    const next = { ...t, [arm]: score, costMicros: t.costMicros + costMicros, ...(error ? { error: error.slice(0, 200) } : {}) };
    const done = next.baseline !== undefined && next.variant !== undefined;
    await ctx.db.patch(id, { test: next, ...(done || error ? { status: "proposed" as const } : {}) });
  },
});

/** Recent reviewer feedback on real plans, for the weekly proposal. */
export const recentFeedback = internalQuery({
  args: { agentId: v.string() },
  handler: async (ctx, { agentId }): Promise<string[]> => {
    const label = agentId === "growth_plays" ? "Growth plays" : "Growth plan";
    const runs = (await ctx.db.query("workflowRuns").withIndex("by_status_updated", (q) => q.eq("status", "verified").gte("updatedAt", Date.now() - 14 * DAY)).take(200)).filter((r) => r.kind === "strategy" && !r.isFixture);
    const out: string[] = [];
    for (const r of runs.slice(0, 40)) {
      for (const s of await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", r._id)).take(80)) {
        if (!s.label.startsWith(`${label}: review`) || !s.output) continue;
        try {
          const c = JSON.parse(s.output) as { fixes?: string[] };
          out.push(...(c.fixes ?? []).slice(0, 4));
        } catch {
          // skip
        }
      }
    }
    return out.slice(0, 120);
  },
});

export const saveProposal = internalMutation({
  args: { agentId: v.string(), rules: v.string(), rationale: v.string() },
  handler: async (ctx, a): Promise<Id<"engineProposals">> => ctx.db.insert("engineProposals", { ...a, rules: a.rules.slice(0, 2000), rationale: a.rationale.slice(0, 600), status: "proposed", createdAt: Date.now() }),
});
