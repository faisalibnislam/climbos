import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** A bell notice (and, for people who turned it on, a phone notification) for a workspace's owners and admins. */
export async function notifyOwners(ctx: MutationCtx, orgId: Id<"organizations">, text: string, path: string) {
  const org = await ctx.db.get(orgId);
  if (!org || org.kind === "demo") return;
  for (const m of await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(50)) {
    if (m.status === "active" && m.userId && ["owner", "admin"].includes(m.role)) {
      await ctx.db.insert("notices", { userId: m.userId, orgId, kind: "system", text: text.slice(0, 240), href: `/app/${org.slug}/${path.replace(/^\//, "")}`, createdAt: Date.now() });
    }
  }
}
