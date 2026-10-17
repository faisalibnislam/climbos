import { v } from "convex/values";
import { CURRENT_ENTITLEMENTS } from "../shared/economics";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

const DAY = 86_400_000;

/** Raw research payload retention (30 days by default); derived facts keep a dangling-safe source list. */
export const purgeExpiredSources = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("factSources")
      .withIndex("by_expires", (q) => q.lt("expiresAt", Date.now()))
      .take(500);
    for (const r of rows) await ctx.db.patch(r._id, { excerpt: undefined, expiresAt: Number.MAX_SAFE_INTEGER });
    return rows.length;
  },
});

/** Detailed activity retention: chat and step details older than the policy are removed; costs and audit stay. */
export const purgeOldActivity = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - CURRENT_ENTITLEMENTS.retentionDays.detailedActivity * DAY;
    const runs = await ctx.db
      .query("workflowRuns")
      .withIndex("by_status_updated", (q) => q.eq("status", "verified").lt("updatedAt", cutoff))
      .take(100);
    let removed = 0;
    for (const r of runs) {
      const steps = await ctx.db
        .query("workflowSteps")
        .withIndex("by_run", (q) => q.eq("runId", r._id))
        .take(50);
      for (const s of steps) {
        if (s.output) {
          await ctx.db.patch(s._id, { output: undefined });
          removed++;
        }
      }
    }
    return removed;
  },
});

export const connectedOrgs = internalQuery({
  args: { provider: v.union(v.literal("ga4"), v.literal("stripe_revenue")) },
  handler: async (ctx, { provider }) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_provider_status", (q) => q.eq("provider", provider).eq("status", "connected"))
      .take(2000);
    return [...new Set(rows.filter((r) => !r.isFixture).map((r) => r.orgId))];
  },
});

export const syncAll = internalAction({
  args: {},
  handler: async (ctx) => {
    for (const orgId of await ctx.runQuery(internal.maintenance.connectedOrgs, { provider: "ga4" })) {
      await ctx.runAction(internal.connectionActions.syncGa4, { orgId });
    }
    for (const orgId of await ctx.runQuery(internal.maintenance.connectedOrgs, { provider: "stripe_revenue" })) {
      await ctx.runAction(internal.connectionActions.syncStripe, { orgId });
    }
  },
});

export const checkExpiry = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("connections")
      .withIndex("by_expires", (q) => q.gt("expiresAt", 0).lt("expiresAt", Date.now() + 3 * DAY))
      .take(200);
    for (const c of rows) {
      if (c.status !== "connected" || c.isFixture) continue;
      if ((c.expiresAt ?? 0) < Date.now()) await ctx.db.patch(c._id, { status: "expired", updatedAt: Date.now() });
      await ctx.db.insert("auditEvents", { orgId: c.orgId, actorType: "system", action: "connection.expiring", summary: `${c.provider} access ${c.expiresAt && c.expiresAt < Date.now() ? "expired" : "expires soon"}. Reconnect it in Connections.`, createdAt: Date.now() });
    }
  },
});

export const digestCandidates = internalQuery({
  args: {},
  handler: async (ctx) => {
    const orgs = await ctx.db
      .query("organizations")
      .withIndex("by_kind_created", (q) => q.eq("kind", "customer"))
      .take(1000);
    const out: { orgId: (typeof orgs)[number]["_id"]; lines: string[] }[] = [];
    for (const o of orgs) {
      if (o.deletedAt) continue;
      const pending = await ctx.db
        .query("artifacts")
        .withIndex("by_org_status", (q) => q.eq("orgId", o._id).eq("status", "in_review"))
        .take(50);
      const published = await ctx.db
        .query("artifacts")
        .withIndex("by_org_status", (q) => q.eq("orgId", o._id).eq("status", "published"))
        .take(50);
      const lines: string[] = [];
      if (pending.length) lines.push(`${pending.length} draft${pending.length === 1 ? "" : "s"} waiting for your approval.`);
      const recent = published.filter((p) => p.updatedAt > Date.now() - 7 * DAY);
      if (recent.length) lines.push(`${recent.length} post${recent.length === 1 ? "" : "s"} confirmed by the platform this week.`);
      if (o.emergencyStop?.active) lines.push("All activity is paused.");
      if (lines.length) out.push({ orgId: o._id, lines });
    }
    return out;
  },
});

export const sendDigests = internalAction({
  args: {},
  handler: async (ctx) => {
    const weekly = new Date().getUTCDay() === 1;
    for (const c of await ctx.runQuery(internal.maintenance.digestCandidates, {})) {
      // Daily recipients get every day; weekly recipients only on Mondays (recipientsFor filters "off").
      await ctx.runAction(internal.notifications.sendDigest, { orgId: c.orgId, cadence: weekly ? "weekly" : "daily", lines: c.lines });
    }
  },
});
