import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requireOrgAccess } from "./lib/tenancy";

/**
 * Membership check for actions. ctx.runQuery from an action carries the
 * caller's identity, so this enforces the same tenant rules as queries.
 */
export const orgAccessForAction = internalQuery({
  args: {
    slug: v.string(),
    permission: v.union(
      v.literal("view"),
      v.literal("chat"),
      v.literal("edit"),
      v.literal("approve"),
      v.literal("pause"),
      v.literal("resume"),
      v.literal("manage_connections"),
      v.literal("manage_policies"),
      v.literal("manage_billing"),
      v.literal("manage_team"),
      v.literal("export"),
      v.literal("delete_workspace"),
    ),
  },
  handler: async (ctx, { slug, permission }) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug }, permission);
    return { orgId: org._id, userId: user._id, role, kind: org.kind, email: user.email ?? null, name: user.name ?? null };
  },
});
