import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { appError, requireOrgAccess } from "./lib/tenancy";
import { audit } from "./lib/audit";
import { PlatformPreparationSchema } from "../shared/acquisition/platformPreparation";
const platformKindV = v.union(v.literal("product_hunt"), v.literal("google_business"), v.literal("g2"));
export const latest = query({
  args: { slug: v.string(), kind: platformKindV },
  handler: async (ctx, { slug, kind }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db.query("platformPreparations").withIndex("by_org_kind", (q) => q.eq("orgId", org._id).eq("kind", kind)).order("desc").take(11);
    return { canEdit: role !== "viewer", version: rows[0]?.version ?? 0, draft: rows[0] ? PlatformPreparationSchema.parse(JSON.parse(rows[0].draft)) : null, history: rows.slice(0, 10).map((r) => ({ version: r.version, createdAt: r.createdAt, draft: PlatformPreparationSchema.parse(JSON.parse(r.draft)) })), hasOlder: rows.length > 10 };
  },
});
export const save = mutation({
  args: { slug: v.string(), kind: platformKindV, expectedVersion: v.number(), draft: v.string() },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const latest = await ctx.db.query("platformPreparations").withIndex("by_org_kind", (q) => q.eq("orgId", org._id).eq("kind", args.kind)).order("desc").first();
    if ((latest?.version ?? 0) !== args.expectedVersion) throw appError("INVALID", "This draft changed in another window. Reopen it before saving.");
    if (args.draft.length > 15_000) throw appError("INVALID", "Keep the preparation brief shorter.");
    let value; try { value = PlatformPreparationSchema.safeParse(JSON.parse(args.draft)); } catch { throw appError("INVALID", "The preparation draft is invalid."); }
    if (!value.success) throw appError("INVALID", value.error.issues[0]?.message ?? "Check the draft fields.");
    const version = args.expectedVersion + 1;
    await ctx.db.insert("platformPreparations", { orgId: org._id, kind: args.kind, version, draft: JSON.stringify(value.data), createdAt: Date.now(), createdBy: user._id });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "platform.preparation_saved", subjectType: "platformPreparation", subjectId: args.kind, summary: `Saved ${args.kind} preparation v${version}; no external action.` });
    return { version };
  },
});
