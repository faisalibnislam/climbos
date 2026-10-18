import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { ensureAccountForOwner } from "./lib/accounts";

/**
 * 18 Oct 2026: shared accounts. Give every customer workspace its owner's
 * account and move its billing rows (periods, subscriptions, top-ups, Polar
 * customer, orders) onto the account. Free periods stop expiring. Idempotent;
 * run until it reports done.
 */
export const accountsBackfill = internalMutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const orgs = (await ctx.db.query("organizations").take(2000)).filter((o) => o.kind === "customer" && !o.accountId && !o.deletedAt).slice(0, limit ?? 50);
    let migrated = 0;
    for (const org of orgs) {
      const owner = (await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(50)).find((m) => m.role === "owner" && m.status === "active" && m.userId);
      const user = owner?.userId ? await ctx.db.get(owner.userId) : await ctx.db.get(org.createdBy);
      if (!user) continue;
      const accountId = await ensureAccountForOwner(ctx, user, org.name);
      await ctx.db.patch(org._id, { accountId });
      for (const p of await ctx.db.query("usagePeriods").withIndex("by_org_period", (q) => q.eq("orgId", org._id)).take(200)) {
        await ctx.db.patch(p._id, { accountId, ...(p.source === "onboarding" ? { endsAt: Math.max(p.endsAt, Date.now() + 100 * 365 * 86_400_000) } : {}) });
        if (p.source === "onboarding") await ctx.db.patch(accountId, { freeCreditsGrantedAt: p.createdAt });
      }
      for (const s of await ctx.db.query("subscriptions").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(50)) await ctx.db.patch(s._id, { accountId });
      for (const c of await ctx.db.query("creditPurchases").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(200)) await ctx.db.patch(c._id, { accountId });
      for (const c of await ctx.db.query("polarCustomers").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(10)) await ctx.db.patch(c._id, { accountId });
      const orders = (await ctx.db.query("orders").take(5000)).filter((o) => o.orgId === org._id);
      for (const o of orders) await ctx.db.patch(o._id, { accountId });
      migrated++;
    }
    const left = (await ctx.db.query("organizations").take(2000)).filter((o) => o.kind === "customer" && !o.accountId && !o.deletedAt).length;
    return { migrated, left };
  },
});
