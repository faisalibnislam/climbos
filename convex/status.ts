import { internalMutation, query } from "./_generated/server";

/**
 * Public status page: every 5 minutes we sample what customers depend on
 * (AI, background jobs, email, publishing, billing webhooks) from our own
 * records; the page shows now and the last 30 days.
 */

type Status = "ok" | "degraded" | "down";
export const COMPONENTS = [
  { key: "app", label: "App and sign-in" },
  { key: "ai", label: "AI work (Climb AI, plans, drafts)" },
  { key: "jobs", label: "Background jobs" },
  { key: "email", label: "Email delivery" },
  { key: "publishing", label: "Publishing" },
  { key: "billing", label: "Billing" },
] as const;

const HOUR = 3_600_000;
/** Down samples (5 minutes apart) before a whole day shows as down. */
const DOWN_SAMPLES = 3;

export const sample = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const fleet = await ctx.db.query("fleetControls").first();
    const open = (fleet?.circuits ?? []).filter((c) => c.state === "open");
    const half = (fleet?.circuits ?? []).filter((c) => c.state === "half_open");
    const ai: Status = open.some((c) => ["openai", "gemini"].includes(c.provider)) ? "down" : half.length || open.length ? "degraded" : "ok";

    const recent = await ctx.db.query("workflowRuns").withIndex("by_status_updated", (q) => q.eq("status", "failed").gte("updatedAt", now - HOUR)).take(200);
    const done = await ctx.db.query("workflowRuns").withIndex("by_status_updated", (q) => q.eq("status", "verified").gte("updatedAt", now - HOUR)).take(500);
    const stuck = await ctx.db.query("workflowRuns").withIndex("by_status_updated", (q) => q.eq("status", "executing").lt("updatedAt", now - 20 * 60_000)).take(50);
    const failRate = recent.length + done.length >= 10 ? recent.length / (recent.length + done.length) : 0;
    const jobs: Status = stuck.length >= 10 || failRate > 0.5 ? "down" : stuck.length >= 3 || failRate > 0.2 ? "degraded" : "ok";

    const mailRecent = await ctx.db.query("emailLog").withIndex("by_created", (q) => q.gte("createdAt", now - 6 * HOUR)).take(500);
    const mailFailed = mailRecent.filter((m) => m.status === "failed").length;
    const email: Status = mailRecent.length >= 5 && mailFailed / mailRecent.length > 0.5 ? "down" : mailFailed >= 3 ? "degraded" : "ok";

    const pubRecent = (await ctx.db.query("actionReceipts").order("desc").take(200)).filter((r) => r.createdAt > now - 6 * HOUR);
    const pubFailed = pubRecent.filter((r) => r.status === "failed").length;
    const publishing: Status = pubRecent.length >= 5 && pubFailed / pubRecent.length > 0.5 ? "down" : pubFailed >= 3 ? "degraded" : "ok";

    const hookFailed = (await ctx.db.query("webhookEvents").withIndex("by_status_received", (q) => q.eq("status", "failed").gte("receivedAt", now - 6 * HOUR)).take(50)).length;
    const billing: Status = hookFailed >= 5 ? "degraded" : "ok";

    const components = [
      { key: "app", status: "ok" as Status },
      { key: "ai", status: ai, note: open.length ? `Provider issue: ${open.map((c) => c.provider).join(", ")}` : undefined },
      { key: "jobs", status: jobs, note: stuck.length ? `${stuck.length} slow` : undefined },
      { key: "email", status: email },
      { key: "publishing", status: publishing },
      { key: "billing", status: billing },
    ];
    await ctx.db.insert("statusSamples", { at: now, day: new Date(now).toISOString().slice(0, 10), components });
    // Keep 35 days.
    for (const old of await ctx.db.query("statusSamples").withIndex("by_at", (q) => q.lt("at", now - 35 * 24 * HOUR)).take(200)) await ctx.db.delete(old._id);
  },
});

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const latest = await ctx.db.query("statusSamples").withIndex("by_at").order("desc").first();
    const since = new Date(Date.now() - 29 * 24 * HOUR).toISOString().slice(0, 10);
    const samples = await ctx.db.query("statusSamples").withIndex("by_day", (q) => q.gte("day", since)).take(9000);
    // Per day and component: how many samples were down or degraded.
    const counts = new Map<string, Map<string, { down: number; degraded: number }>>();
    for (const s of samples) {
      const d = counts.get(s.day) ?? new Map<string, { down: number; degraded: number }>();
      for (const c of s.components) {
        const n = d.get(c.key) ?? { down: 0, degraded: 0 };
        if (c.status === "down") n.down++;
        else if (c.status === "degraded") n.degraded++;
        d.set(c.key, n);
      }
      counts.set(s.day, d);
    }
    const days = new Map<string, Map<string, Status>>();
    for (const [day, d] of counts) {
      const out = new Map<string, Status>();
      // A day is "down" only if 3+ samples were down; a blip shows as degraded.
      for (const [key, n] of d) out.set(key, n.down >= DOWN_SAMPLES ? "down" : n.down > 0 || n.degraded > 0 ? "degraded" : "ok");
      days.set(day, out);
    }
    const dayList = [...Array(30)].map((_, i) => new Date(Date.now() - (29 - i) * 24 * HOUR).toISOString().slice(0, 10));
    return {
      updatedAt: latest?.at ?? null,
      components: COMPONENTS.map((c) => {
        const now = latest?.components.find((x) => x.key === c.key);
        const history = dayList.map((d) => days.get(d)?.get(c.key) ?? null);
        const known = history.filter(Boolean);
        return { key: c.key, label: c.label, status: (now?.status ?? "ok") as Status, note: now?.note ?? null, history, uptime: known.length ? Math.round((known.filter((h) => h === "ok").length / known.length) * 1000) / 10 : 100 };
      }),
      days: dayList,
    };
  },
});

