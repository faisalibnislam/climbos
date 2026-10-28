import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { requireOrgAccess } from "./lib/tenancy";
import { followerSummary, getFollowerCount, shiftDay, type FollowerProvider } from "../shared/integrations/followers";

const PROVIDERS: FollowerProvider[] = ["instagram", "facebook_pages"];
const LABEL: Record<FollowerProvider, string> = { instagram: "Instagram", facebook_pages: "Facebook" };

const today = () => new Date().toISOString().slice(0, 10);

/** Follower counts per connected platform: latest, change over 7 days and weekly points. Unconnected platforms say so. */
export const summary = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const day = today();
    const from = shiftDay(day, -60);
    const platforms = [];
    for (const provider of PROVIDERS) {
      const conn = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", provider)).first();
      const points = await ctx.db.query("followerSnapshots").withIndex("by_org_provider_day", (q) => q.eq("orgId", org._id).eq("provider", provider).gte("day", from)).take(70);
      const s = followerSummary(points.map((p) => ({ day: p.day, count: p.count })), day);
      platforms.push({ provider, label: LABEL[provider], connected: conn?.status === "connected" && !conn.isFixture, ...s });
    }
    const tracked = platforms.filter((p) => p.latest !== null);
    return {
      platforms,
      total: tracked.length ? tracked.reduce((n, p) => n + (p.latest ?? 0), 0) : null,
      weekChange: tracked.some((p) => p.weekChange !== null) ? tracked.reduce((n, p) => n + (p.weekChange ?? 0), 0) : null,
    };
  },
});

export const accountsToRead = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const out: { provider: FollowerProvider; accountId: string; connectionId: Id<"connections"> }[] = [];
    for (const provider of PROVIDERS) {
      const conn = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", orgId).eq("provider", provider)).first();
      if (conn && conn.status === "connected" && !conn.isFixture && conn.externalAccountId) out.push({ provider, accountId: conn.externalAccountId, connectionId: conn._id });
    }
    return out;
  },
});

export const record = internalMutation({
  args: { orgId: v.id("organizations"), provider: v.union(v.literal("instagram"), v.literal("facebook_pages")), accountId: v.string(), count: v.number() },
  handler: async (ctx, { orgId, provider, accountId, count }) => {
    const day = today();
    const existing = await ctx.db.query("followerSnapshots").withIndex("by_org_provider_day", (q) => q.eq("orgId", orgId).eq("provider", provider).eq("day", day)).first();
    // A changed account (another Page) starts a fresh series rather than mixing two audiences.
    if (existing) await ctx.db.patch(existing._id, { count, accountId, recordedAt: Date.now() });
    else await ctx.db.insert("followerSnapshots", { orgId, provider, accountId, day, count, recordedAt: Date.now() });
  },
});

/** Read today's follower count for each connected social account. Failures are skipped; tomorrow tries again. */
export const syncOrg = internalAction({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<{ saved: number }> => {
    const accounts: { provider: FollowerProvider; accountId: string; connectionId: Id<"connections"> }[] = await ctx.runQuery(internal.followers.accountsToRead, { orgId });
    let saved = 0;
    for (const a of accounts) {
      const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: a.connectionId });
      const accessToken = secret ? (JSON.parse(secret.value) as { accessToken?: unknown }).accessToken : undefined;
      if (typeof accessToken !== "string" || !accessToken) continue;
      const result = await getFollowerCount({ accessToken, provider: a.provider, accountId: a.accountId, timeoutMs: 12_000 });
      if (!result.ok) continue;
      await ctx.runMutation(internal.followers.record, { orgId, provider: a.provider, accountId: a.accountId, count: result.data.count });
      saved++;
    }
    return { saved };
  },
});

export const orgsWithSocial = internalQuery({
  args: {},
  handler: async (ctx) => {
    const ids = new Set<Id<"organizations">>();
    for (const provider of PROVIDERS) {
      const rows = await ctx.db.query("connections").withIndex("by_provider_status", (q) => q.eq("provider", provider).eq("status", "connected")).take(2000);
      for (const r of rows) if (!r.isFixture) ids.add(r.orgId);
    }
    return [...ids];
  },
});

/** Daily: one follower reading per connected account. */
export const syncAll = internalAction({
  args: {},
  handler: async (ctx): Promise<{ orgs: number }> => {
    const orgs: Id<"organizations">[] = await ctx.runQuery(internal.followers.orgsWithSocial, {});
    for (const orgId of orgs) await ctx.scheduler.runAfter(0, internal.followers.syncOrg, { orgId });
    return { orgs: orgs.length };
  },
});
