import { subscriptionAccess } from "../../shared/billing";
import { appError } from "./tenancy";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currentPeriod, type BillingScope } from "./periods";

type Ctx = QueryCtx | MutationCtx;

export type ChargeableAccess =
  | { allowed: true; period: Doc<"usagePeriods">; mode: "paid" | "onboarding" | "demo" }
  | {
      allowed: false;
      code: "PAUSED" | "PAYMENT_REQUIRED" | "PAYMENT_ISSUE" | "PLAN_ENDED" | "CONFIRMING_PAYMENT" | "FLEET_STOP";
      message: string;
    };

export async function fleetStopped(ctx: Ctx): Promise<boolean> {
  const fleet = await ctx.db
    .query("fleetControls")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  return Boolean(fleet?.emergencyStop);
}

export async function latestSubscription(ctx: Ctx, scope: BillingScope) {
  const accountId = scope.accountId;
  const subs = accountId
    ? await ctx.db
        .query("subscriptions")
        .withIndex("by_account", (q) => q.eq("accountId", accountId))
        .order("desc")
        .take(5)
    : await ctx.db
        .query("subscriptions")
        .withIndex("by_org", (q) => q.eq("orgId", scope._id))
        .order("desc")
        .take(5);
  // Prefer a subscription that currently grants access.
  return subs.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

/** The account has an active paid package (Expert, autopilot, publishing, sending, seats, MCP). */
export async function isPaid(ctx: Ctx, scope: BillingScope, now = Date.now()): Promise<boolean> {
  const sub = await latestSubscription(ctx, scope);
  return Boolean(sub && subscriptionAccess(sub, now) === "full");
}

/** Paid-only features (owner decision 18 Oct 2026): throws a plain "needs a package" error on free accounts. Demos are exempt. */
export async function requirePaid(ctx: Ctx, org: Doc<"organizations">, feature: string): Promise<void> {
  if (org.kind === "demo") return;
  if (!(await isPaid(ctx, org))) throw appError("PAYMENT_REQUIRED", `${feature} comes with a package. Choose one in Settings → Billing.`, { reason: "paid_feature" });
}

/** The package the account is on, or null for free. */
export async function activePackage(ctx: Ctx, scope: BillingScope, now = Date.now()) {
  const sub = await latestSubscription(ctx, scope);
  return sub && subscriptionAccess(sub, now) === "full" ? sub : null;
}

/**
 * Whether the org may start NEW chargeable work right now. Fails closed:
 * reading, editing and exporting are never blocked by this check.
 */
export async function chargeableAccess(ctx: Ctx, org: Doc<"organizations">, now = Date.now()): Promise<ChargeableAccess> {
  if (await fleetStopped(ctx)) {
    return { allowed: false, code: "FLEET_STOP", message: "ClimbOS has paused new work for maintenance. Your data is safe." };
  }
  if (org.emergencyStop?.active) {
    return { allowed: false, code: "PAUSED", message: "All activity is paused. Resume activity to start new work." };
  }
  if (org.suspendedAt) return { allowed: false, code: "PAUSED", message: "This workspace is suspended. Contact support." };
  const period = await currentPeriod(ctx, org, now);
  if (org.kind === "demo") {
    return period
      ? { allowed: true, period, mode: "demo" }
      : { allowed: false, code: "PLAN_ENDED", message: "This demo workspace has expired. Start a new demo anytime." };
  }
  const sub = await latestSubscription(ctx, org);
  if (sub) {
    const level = subscriptionAccess(sub, now);
    if (level === "grace_read_only") {
      return {
        allowed: false,
        code: "PAYMENT_ISSUE",
        message: "We couldn't take your last payment. Everything is still readable and exportable; update your payment details to continue new work.",
      };
    }
    if (level === "full") {
      if (period?.source === "subscription") return { allowed: true, period, mode: "paid" };
      return {
        allowed: false,
        code: "CONFIRMING_PAYMENT",
        message: "We're confirming your payment with Polar. This usually takes under a minute.",
      };
    }
    if (level === "pending") {
      return { allowed: false, code: "CONFIRMING_PAYMENT", message: "Your subscription is being set up." };
    }
    // Ended: back to the free tier (any free or top-up credits left still work).
  }
  if (period?.source === "onboarding") return { allowed: true, period, mode: "onboarding" };
  return {
    allowed: false,
    code: "PAYMENT_REQUIRED",
    message: "You're out of credits. Choose a package to keep your growth team working.",
  };
}
