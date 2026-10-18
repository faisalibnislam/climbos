import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, type QueryCtx } from "./_generated/server";

/**
 * Loop 2 — learn from results. Weekly, every workspace's real outcomes
 * (replies, bookings, leads, clicks) become rates the planner uses before
 * vendor benchmarks. Pooled rates by business type are anonymous: only counts,
 * and only published when at least 5 workspaces contribute.
 */

const K_ANON = 5;
const DAY = 86_400_000;
const WINDOW = 120 * DAY;

export const METRICS: Record<string, { label: string; minTrials: number }> = {
  outreach_reply: { label: "Outreach emails → replies", minTrials: 30 },
  outreach_booking: { label: "Outreach replies → booked calls", minTrials: 5 },
  landing_lead: { label: "Landing page views → leads", minTrials: 50 },
  chat_lead: { label: "Website chats → email captured", minTrials: 10 },
  review_click: { label: "Review requests → opened review link", minTrials: 10 },
  bio_signup: { label: "Link-in-bio views → sign-ups", minTrials: 50 },
};

type Counts = Record<string, { trials: number; successes: number }>;

async function orgCounts(ctx: QueryCtx, orgId: Id<"organizations">, since: number): Promise<Counts> {
  const c: Counts = {};
  const add = (m: string, t: number, s: number) => {
    c[m] = { trials: (c[m]?.trials ?? 0) + t, successes: (c[m]?.successes ?? 0) + s };
  };
  for (const camp of await ctx.db.query("outboundCampaigns").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).take(50)) {
    const sends = await ctx.db.query("outboundSends").withIndex("by_campaign", (q) => q.eq("campaignId", camp._id).gte("createdAt", since)).take(3000);
    const contacted = new Set(sends.filter((s) => s.status === "sent" && s.step === 0).map((s) => s.prospectId));
    if (!contacted.size) continue;
    const prospects = await ctx.db.query("prospects").withIndex("by_campaign", (q) => q.eq("campaignId", camp._id)).take(500);
    const replied = prospects.filter((p) => contacted.has(p._id) && ["replied", "booked", "won"].includes(p.stage));
    add("outreach_reply", contacted.size, replied.length);
    add("outreach_booking", replied.length, replied.filter((p) => p.stage === "booked" || p.stage === "won").length);
  }
  for (const p of await ctx.db.query("landingPages").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(50)) add("landing_lead", p.views, p.leads);
  const threads = await ctx.db.query("chatThreads").withIndex("by_org_last", (q) => q.eq("orgId", orgId).gte("lastAt", since)).take(2000);
  add("chat_lead", threads.length, threads.filter((t) => t.email).length);
  const reqs = (await ctx.db.query("reviewRequests").withIndex("by_org_created", (q) => q.eq("orgId", orgId).gte("createdAt", since)).take(1000)).filter((r) => r.status === "sent");
  add("review_click", reqs.length, reqs.filter((r) => r.clickedAt).length);
  const bio = await ctx.db.query("bioPages").withIndex("by_org", (q) => q.eq("orgId", orgId)).first();
  if (bio) {
    const signups = (await ctx.db.query("communityMessages").withIndex("by_org_received", (q) => q.eq("orgId", orgId).gte("receivedAt", since)).take(2000)).filter((m) => m.channel === "link_in_bio").length;
    add("bio_signup", bio.views, signups);
  }
  return c;
}

export const orgIds = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("organizations").withIndex("by_kind_created", (q) => q.eq("kind", "customer")).take(5000)).filter((o) => !o.deletedAt).map((o) => o._id),
});

export const countsForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const type = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first())?.businessType ?? "other";
    return { type, counts: await orgCounts(ctx, orgId, Date.now() - WINDOW) };
  },
});

const rowV = v.object({ scope: v.string(), metric: v.string(), workspaces: v.number(), trials: v.number(), successes: v.number() });

export const writeRates = internalMutation({
  args: { rows: v.array(rowV), replace: v.boolean() },
  handler: async (ctx, { rows, replace }) => {
    const now = Date.now();
    if (replace) {
      const keep = new Set(rows.map((r) => `${r.scope}|${r.metric}`));
      for (const old of await ctx.db.query("learnedRates").take(8000)) if (!keep.has(`${old.scope}|${old.metric}`)) await ctx.db.delete(old._id);
    }
    for (const r of rows) {
      const existing = await ctx.db.query("learnedRates").withIndex("by_scope_metric", (q) => q.eq("scope", r.scope).eq("metric", r.metric)).first();
      const doc = { ...r, rate: r.trials ? r.successes / r.trials : 0, updatedAt: now };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("learnedRates", doc);
    }
  },
});

/** Weekly: each workspace's rates (read one at a time), then the pooled ones. */
export const recompute = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const pooled = new Map<string, { workspaces: number; trials: number; successes: number }>();
    const rows: { scope: string; metric: string; workspaces: number; trials: number; successes: number }[] = [];
    for (const orgId of await ctx.runQuery(internal.learning.orgIds, {})) {
      const { type, counts } = await ctx.runQuery(internal.learning.countsForOrg, { orgId });
      for (const [metric, x] of Object.entries(counts)) {
        if (x.trials < METRICS[metric].minTrials) continue;
        rows.push({ scope: `org:${orgId}`, metric, workspaces: 1, ...x });
        for (const scope of [`type:${type}`, "all"]) {
          const k = `${scope}|${metric}`;
          const p = pooled.get(k) ?? { workspaces: 0, trials: 0, successes: 0 };
          pooled.set(k, { workspaces: p.workspaces + 1, trials: p.trials + x.trials, successes: p.successes + x.successes });
        }
      }
    }
    for (const [k, p] of pooled) if (p.workspaces >= K_ANON) rows.push({ scope: k.split("|")[0], metric: k.split("|")[1], ...p });
    // Write in chunks; the first chunk also clears rates that no longer qualify.
    for (let i = 0; i < Math.max(rows.length, 1); i += 200) await ctx.runMutation(internal.learning.writeRates, { rows: rows.slice(i, i + 200), replace: i === 0 });
    return rows.length;
  },
});

/** Text block for the planner: this business's own results first, then pooled rates for its type. */
export const contextFor = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<string> => {
    const type = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first())?.businessType ?? "other";
    const lines: string[] = [];
    const pct = (r: number) => `${Math.round(r * 1000) / 10}%`;
    for (const [metric, m] of Object.entries(METRICS)) {
      const own = await ctx.db.query("learnedRates").withIndex("by_scope_metric", (q) => q.eq("scope", `org:${orgId}`).eq("metric", metric)).first();
      const pool = (await ctx.db.query("learnedRates").withIndex("by_scope_metric", (q) => q.eq("scope", `type:${type}`).eq("metric", metric)).first()) ?? (await ctx.db.query("learnedRates").withIndex("by_scope_metric", (q) => q.eq("scope", "all").eq("metric", metric)).first());
      if (own) lines.push(`- ${m.label}: THIS BUSINESS ${pct(own.rate)} (${own.successes}/${own.trials}, last 120 days) [first-party, grade A]`);
      if (pool) lines.push(`- ${m.label}: ClimbOS ${pool.scope === "all" ? "all businesses" : `${type} businesses`} ${pct(pool.rate)} (${pool.workspaces} workspaces, n=${pool.trials}) [ClimbOS aggregate, grade A/B]`);
    }
    return lines.length ? `RESULTS CLIMBOS HAS MEASURED (use these before vendor benchmarks; this business's own rate wins):\n${lines.join("\n")}` : "";
  },
});
