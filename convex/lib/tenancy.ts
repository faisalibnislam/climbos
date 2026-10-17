import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { can, type MemberRole, type Permission } from "../../shared/policy";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "LIMIT_REACHED"
  | "PAYMENT_REQUIRED"
  | "PAUSED"
  | "RATE_LIMITED"
  | "UNAVAILABLE";

export function appError(code: AppErrorCode, message: string, extra: Record<string, string | number | boolean> = {}): ConvexError<{
  code: AppErrorCode;
  message: string;
} & Record<string, string | number | boolean>> {
  return new ConvexError({ code, message, ...extra });
}

export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw appError("UNAUTHENTICATED", "Please sign in to continue.");
  const user = await ctx.db.get(userId);
  if (!user) throw appError("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}

export async function optionalUser(ctx: Ctx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  return userId ? await ctx.db.get(userId) : null;
}

export interface OrgAccess {
  user: Doc<"users">;
  org: Doc<"organizations">;
  membership: Doc<"memberships">;
  role: MemberRole;
}

/**
 * Resolve an organization by slug or id AND verify the signed-in user holds an
 * active membership with the required permission. Non-members get NOT_FOUND so
 * workspace existence is not leaked across tenants.
 */
export async function requireOrgAccess(
  ctx: Ctx,
  ref: { slug: string } | { orgId: Id<"organizations"> },
  permission: Permission = "view",
): Promise<OrgAccess> {
  const user = await requireUser(ctx);
  const org =
    "slug" in ref
      ? await ctx.db
          .query("organizations")
          .withIndex("by_slug", (q) => q.eq("slug", ref.slug))
          .unique()
      : await ctx.db.get(ref.orgId);
  if (!org || org.deletedAt) throw appError("NOT_FOUND", "We couldn't find that workspace.");
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", user._id))
    .unique();
  if (!membership || membership.status !== "active") {
    throw appError("NOT_FOUND", "We couldn't find that workspace.");
  }
  if (!can(membership.role, permission)) {
    throw appError("FORBIDDEN", `Your role (${membership.role}) can't do this. Ask an owner or admin.`, {
      role: membership.role,
      permission,
    });
  }
  return { user, org, membership, role: membership.role };
}

/** Assert a document belongs to the org the caller was authorized for. */
export function assertSameOrg<T extends { orgId: Id<"organizations"> }>(
  doc: T | null,
  orgId: Id<"organizations">,
  what = "item",
): T {
  if (!doc || doc.orgId !== orgId) throw appError("NOT_FOUND", `We couldn't find that ${what}.`);
  return doc;
}

export function operatorEmails(): string[] {
  return (process.env.OPS_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Operators are a separate allowlist; customer roles never grant operator access. */
export async function requireOperator(ctx: Ctx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  const email = user.email?.toLowerCase();
  if (!email || user.isAnonymous || !operatorEmails().includes(email)) {
    throw appError("NOT_FOUND", "Not found.");
  }
  return user;
}

export async function isOperator(ctx: Ctx): Promise<boolean> {
  const user = await optionalUser(ctx);
  const email = user?.email?.toLowerCase();
  return Boolean(email && !user?.isAnonymous && operatorEmails().includes(email));
}
