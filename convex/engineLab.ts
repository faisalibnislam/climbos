import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { requireStaff } from "./lib/staff";
import { appError } from "./lib/tenancy";
import { redactFeedback } from "../shared/lab/redact";

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

/** Last 14 days of agent runs: mean lint errors draft → final, numbers lost in revision, ship rate. */
async function engineHealth(ctx: QueryCtx) {
  const rows = await ctx.db.query("engineQuality").withIndex("by_created", (q) => q.gte("createdAt", Date.now() - 14 * DAY)).order("desc").take(300);
  const by = new Map<string, { n: number; draft: number; final: number; invented: number; dropped: number; shipped: number; research: number }>();
  const decisions = { approved: 0, sentBack: 0, notes: [] as string[] };
  for (const r of rows) {
    if (r.agentId === "owner_decision") {
      try {
        const d = JSON.parse(r.data) as { decision: string; note?: string };
        if (d.decision === "approve") decisions.approved++;
        else {
          decisions.sentBack++;
          if (d.note && decisions.notes.length < 5) decisions.notes.push(d.note);
        }
      } catch {
        // skip
      }
      continue;
    }
    let q: { draftLint?: Record<string, number>; finalLint?: Record<string, number>; numbersDropped?: string[]; shipped?: boolean | null; contextChars?: { research?: number } };
    try {
      q = JSON.parse(r.data);
    } catch {
      continue;
    }
    const k = `${r.agentId}|${r.mode}`;
    const a = by.get(k) ?? { n: 0, draft: 0, final: 0, invented: 0, dropped: 0, shipped: 0, research: 0 };
    const sum = (x?: Record<string, number>) => Object.values(x ?? {}).reduce((s, v) => s + v, 0);
    a.n++;
    a.draft += sum(q.draftLint);
    a.final += sum(q.finalLint);
    a.invented += q.finalLint?.invented_fact ?? 0;
    a.dropped += q.numbersDropped?.length ?? 0;
    a.shipped += q.shipped ? 1 : 0;
    a.research += q.contextChars?.research ?? 0;
    by.set(k, a);
  }
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    agents: [...by.entries()].map(([k, a]) => ({ agent: k.split("|")[0], mode: k.split("|")[1], runs: a.n, draftErrors: r1(a.draft / a.n), finalErrors: r1(a.final / a.n), inventedFinal: r1(a.invented / a.n), numbersDropped: r1(a.dropped / a.n), shipRate: Math.round((a.shipped / a.n) * 100), researchChars: Math.round(a.research / a.n) })),
    decisions,
  };
}

/** Plan runs in the last 14 days: cost per plan by mode, and how often a run outgrew its reservation. */
async function planCost(ctx: QueryCtx) {
  const since = Date.now() - 14 * DAY;
  const runs: Doc<"workflowRuns">[] = [];
  for (const status of ["verified", "failed"] as const) runs.push(...(await ctx.db.query("workflowRuns").withIndex("by_status_updated", (q) => q.eq("status", status).gte("updatedAt", since)).take(400)));
  const by = new Map<string, number[]>();
  let over = 0;
  let capped = 0;
  for (const r of runs.filter((x) => x.kind === "strategy" && !x.isFixture)) {
    const k = r.aiMode ?? "basic";
    by.set(k, [...(by.get(k) ?? []), r.actualMicros]);
    if (r.actualMicros > r.estimateMicros) over++;
    if (r.status === "failed" && /more AI work than planned/.test(r.userMessage ?? "")) capped++;
  }
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0;
  return {
    modes: [...by.entries()].map(([mode, xs]) => ({ mode, plans: xs.length, meanMicros: Math.round(xs.reduce((s, x) => s + x, 0) / xs.length), p95Micros: q(xs, 0.95) })),
    overReservation: over,
    stoppedAtCap: capped,
  };
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
      health: await engineHealth(ctx),
      cost: await planCost(ctx),
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
    if (decision === "approved") {
      const result = p.test;
      if (p.status !== "proposed" || !result || result.error || result.baseline === undefined || result.variant === undefined) {
        throw appError("INVALID", "A proposal needs a completed, error-free comparison before it can be approved.");
      }
      if (result.variant <= result.baseline) {
        throw appError("INVALID", "The proposed rule did not improve the current screening score. Keep it out of the live playbook.");
      }
    }
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

/**
 * Recent reviewer feedback on real plans, for the weekly proposal: scrubbed of
 * names, sites, links and figures, at most 4 fixes per workspace, grouped by an
 * anonymous label so a rule can be required to recur across ≥ 5 businesses.
 */
export const recentFeedback = internalQuery({
  args: { agentId: v.string() },
  handler: async (ctx, { agentId }): Promise<{ business: string; fix: string }[]> => {
    const label = agentId === "growth_plays" ? "Growth plays" : "Growth plan";
    const runs = (await ctx.db.query("workflowRuns").withIndex("by_status_updated", (q) => q.eq("status", "verified").gte("updatedAt", Date.now() - 14 * DAY)).take(200)).filter((r) => r.kind === "strategy" && !r.isFixture);
    const perOrg = new Map<string, string[]>();
    for (const r of runs.slice(0, 60)) {
      const have = perOrg.get(r.orgId) ?? [];
      if (have.length >= 4) continue;
      const org = await ctx.db.get(r.orgId);
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", r.orgId)).first();
      const names = [org?.name, business?.name, business?.website];
      for (const s of await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", r._id)).take(80)) {
        if (!s.label.startsWith(`${label}: review`) || !s.output) continue;
        try {
          const c = JSON.parse(s.output) as { fixes?: string[] };
          for (const f of c.fixes ?? []) if (have.length < 4) have.push(redactFeedback(f, names));
        } catch {
          // skip
        }
      }
      perOrg.set(r.orgId, have);
    }
    // Anonymous labels (B1, B2…) in a stable but meaningless order.
    const out: { business: string; fix: string }[] = [];
    [...perOrg.values()].filter((f) => f.length).forEach((fixes, i) => fixes.forEach((fix) => out.push({ business: `B${i + 1}`, fix })));
    return out.slice(0, 160);
  },
});

export const saveProposal = internalMutation({
  args: { agentId: v.string(), rules: v.string(), rationale: v.string() },
  handler: async (ctx, a): Promise<Id<"engineProposals">> => ctx.db.insert("engineProposals", { ...a, rules: a.rules.slice(0, 2000), rationale: a.rationale.slice(0, 600), status: "proposed", createdAt: Date.now() }),
});

/** Engine quality log (no tenant text: counts, sizes and numbers only). */
export const recordQuality = internalMutation({
  args: { runId: v.id("workflowRuns"), agentId: v.string(), mode: v.string(), data: v.string() },
  handler: async (ctx, a) => {
    await ctx.db.insert("engineQuality", { ...a, data: a.data.slice(0, 8000), createdAt: Date.now() });
  },
});
