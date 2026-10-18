import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError, operatorEmails, requireUser } from "./tenancy";

type Ctx = QueryCtx | MutationCtx;

export type StaffRole = "owner" | "admin" | "support";

/**
 * Staff powers (owner decision 18 Oct 2026):
 * - owner: everything.
 * - admin: everything except money settings and staff roles.
 * - support: read accounts, view a workspace read-only, retry jobs, grant up to 500 credits.
 */
export type StaffPower = "read" | "view_as" | "retry" | "grant_small" | "grant" | "manage_accounts" | "features" | "money" | "staff" | "operate";

const POWERS: Record<StaffRole, readonly StaffPower[]> = {
  owner: ["read", "view_as", "retry", "grant_small", "grant", "manage_accounts", "features", "money", "staff", "operate"],
  admin: ["read", "view_as", "retry", "grant_small", "grant", "manage_accounts", "features", "operate"],
  support: ["read", "view_as", "retry", "grant_small"],
};

export const SUPPORT_GRANT_LIMIT = 500;

export async function staffRoleOf(ctx: Ctx, user: Doc<"users"> | null): Promise<StaffRole | null> {
  const email = user?.email?.toLowerCase();
  if (!email || user?.isAnonymous) return null;
  if (operatorEmails().includes(email)) return "owner";
  const row = await ctx.db
    .query("staff")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
  return row?.role ?? null;
}

export function staffCan(role: StaffRole | null, power: StaffPower): boolean {
  return Boolean(role && POWERS[role].includes(power));
}

export function staffPowers(role: StaffRole | null): readonly StaffPower[] {
  return role ? POWERS[role] : [];
}

/** Staff-only access check. Non-staff get a plain "not found". */
export async function requireStaff(ctx: Ctx, power: StaffPower): Promise<{ user: Doc<"users">; role: StaffRole }> {
  const user = await requireUser(ctx);
  const role = await staffRoleOf(ctx, user);
  if (!role) throw appError("NOT_FOUND", "Not found.");
  if (!staffCan(role, power)) throw appError("FORBIDDEN", "Your staff role can't do this.");
  return { user, role };
}
