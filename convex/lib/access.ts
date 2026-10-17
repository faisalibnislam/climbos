import { subscriptionAccess } from "../../shared/billing";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { currentPeriod } from "./periods";

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

export async function latestSubscription(ctx: Ctx, orgId: Id<"organizations">) {
  const subs = await ctx.db
    .query("subscriptions")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .order("desc")
    .take(5);
  // Prefer a subscription that currently grants access.
  return subs.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
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
  const period = await currentPeriod(ctx, org._id, now);
  if (org.kind === "demo") {
    return period
      ? { allowed: true, period, mode: "demo" }
      : { allowed: false, code: "PLAN_ENDED", message: "This demo workspace has expired. Start a new demo anytime." };
  }
  const sub = await latestSubscription(ctx, org._id);
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
    // Ended: never fall back to the onboarding allowance.
    return { allowed: false, code: "PLAN_ENDED", message: "Your plan has ended. Choose a plan to start new work; your data is still here." };
  }
  if (period?.source === "onboarding") return { allowed: true, period, mode: "onboarding" };
  return {
    allowed: false,
    code: "PAYMENT_REQUIRED",
    message: "You've used your free starter allowance. Choose a plan to keep your growth team working.",
  };
}
