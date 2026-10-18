import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * A bell notice (and, for people who turned it on, a phone notification) for a workspace's owners and admins.
 * `path` is inside the workspace (`plan`, `work/<id>`); `/onboarding…` links are used as given.
 */
export async function notifyOwners(ctx: MutationCtx, orgId: Id<"organizations">, text: string, path: string, roles: string[] = ["owner", "admin"]) {
  const org = await ctx.db.get(orgId);
  if (!org || org.kind === "demo") return;
  const href = path.startsWith("/onboarding") ? path : `/app/${org.slug}/${path.replace(/^\//, "")}`;
  for (const m of await ctx.db.query("memberships").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(50)) {
    if (m.status === "active" && m.userId && roles.includes(m.role)) {
      await ctx.db.insert("notices", { userId: m.userId, orgId, kind: "system", text: text.slice(0, 240), href, createdAt: Date.now() });
    }
  }
}
