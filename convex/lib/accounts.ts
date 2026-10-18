import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

/**
 * Billing accounts: one owner, one package and one credit balance shared by
 * all of the owner's workspaces. Seats are counted across the account.
 */

/** The account a user owns (created on their first workspace). */
export async function ensureAccountForOwner(ctx: MutationCtx, user: Doc<"users">, name: string): Promise<Id<"accounts">> {
  const existing = await ctx.db
    .query("accounts")
    .withIndex("by_owner", (q) => q.eq("ownerUserId", user._id))
    .first();
  if (existing) return existing._id;
  return ctx.db.insert("accounts", { ownerUserId: user._id, name: name.slice(0, 80), createdAt: Date.now() });
}

export async function accountWorkspaces(ctx: Ctx, accountId: Id<"accounts">): Promise<Doc<"organizations">[]> {
  const rows = await ctx.db
    .query("organizations")
    .withIndex("by_account", (q) => q.eq("accountId", accountId))
    .take(200);
  return rows.filter((o) => !o.deletedAt);
}

/** People on the account: distinct active members plus pending invites, across all its workspaces. */
export async function accountSeats(ctx: Ctx, accountId: Id<"accounts">): Promise<{ users: Set<string>; invites: Set<string> }> {
  const users = new Set<string>();
  const invites = new Set<string>();
  for (const org of await accountWorkspaces(ctx, accountId)) {
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .take(200);
    for (const m of members) {
      if (m.status === "active" && m.userId) users.add(m.userId);
      if (m.status === "invited" && m.invitedEmail) invites.add(m.invitedEmail.toLowerCase());
    }
  }
  return { users, invites };
}
