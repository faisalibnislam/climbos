import { v } from "convex/values";
import { can } from "../shared/policy";
import { validProductFunnel } from "../shared/growth/productFunnels";
import { mutation, query } from "./_generated/server";
import { productFunnelAssessments } from "./lib/productFunnels";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { audit } from "./lib/audit";

export const list = query({
  args: { slug: v.string() }, handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await productFunnelAssessments(ctx, org._id, Date.now());
    return { rows, canManage: can(role, "manage_connections"), canCreate: can(role, "manage_connections") && rows.length < 20 };
  },
});
export const create = mutation({
  args: { slug: v.string(), sourceId: v.id("productTrackingSources"), name: v.string(), entity: v.union(v.literal("person"), v.literal("account")), entryEvent: v.string(), activationEvent: v.string(), returnEvent: v.string(), activationDays: v.number(), returnStartDay: v.number(), returnEndDay: v.number(), lookbackDays: v.number() },
  handler: async (ctx, { slug, ...input }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    const source = assertSameOrg(await ctx.db.get(input.sourceId), org._id, "product source");
    const definition = { ...input, name: input.name.trim(), scope: source.scope };
    if (!validProductFunnel(definition) || [input.entryEvent, input.activationEvent, input.returnEvent].some(e => !source.mappings.some(m => m.event === e))) throw appError("INVALID", "Choose defined events, a 1–21 day activation window, a later return window ending by day 21, and a lookback covering that window plus seven late-arrival days (up to 30 UTC dates).");
    const existing = await ctx.db.query("productFunnels").withIndex("by_org", q => q.eq("orgId", org._id)).take(20);
    if (existing.length >= 20) throw appError("LIMIT_REACHED", "Remove an unused definition before adding another; up to 20 are supported.");
    const id = await ctx.db.insert("productFunnels", { ...definition, orgId: org._id, createdBy: user._id, createdAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "product_funnel.created", subjectType: "productFunnel", subjectId: id, summary: "Owner defined a product-event measurement. No event, consent, approval or external action created." });
    return id;
  },
});
export const remove = mutation({
  args: { slug: v.string(), id: v.id("productFunnels") }, handler: async (ctx, { slug, id }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "manage_connections");
    assertSameOrg(await ctx.db.get(id), org._id, "funnel definition");
    await ctx.db.delete(id);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "product_funnel.removed", subjectType: "productFunnel", subjectId: id, summary: "Removed a measurement definition; existing product events were not changed." });
  },
});
