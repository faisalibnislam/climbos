import {
  creditsToMicros,
  CURRENT_ENTITLEMENTS,
  FREE_CREDITS,
  getEntitlementVersion,
  type LedgerState,
  type Meters,
  type PlanEntitlement,
  zeroMeters,
} from "../../shared/economics";
import type { PlanKey } from "../../shared/economics/assumptions";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = QueryCtx | MutationCtx;

const UNCAPPED = 1_000_000_000;

/**
 * Free credits: 50 once per account (credits limit spend; task counts are
 * recorded, not capped). They don't expire.
 */
export const ONBOARDING_ALLOWANCE = {
  walletMicros: creditsToMicros(FREE_CREDITS),
  meters: {
    socialPosts: UNCAPPED,
    imageAttempts: UNCAPPED,
    deliveredImages: UNCAPPED,
    searchCalls: UNCAPPED,
    scrapeCredits: UNCAPPED,
    transactionalEmails: UNCAPPED,
    byoMarketingSends: 0,
    analyticsEvents: UNCAPPED,
    supportMinutes: 0,
  } satisfies Meters,
  days: 365 * 100,
};

/** Where a workspace's credits live: its account (shared), or the workspace itself (demo). */
export type BillingScope = Pick<Doc<"organizations">, "_id" | "accountId">;

export function planCaps(plan: PlanEntitlement): Meters {
  return {
    socialPosts: plan.socialPosts,
    imageAttempts: plan.imageAttempts,
    deliveredImages: plan.deliveredImages,
    searchCalls: plan.searchCalls,
    scrapeCredits: plan.scrapeCredits,
    transactionalEmails: plan.transactionalEmails,
    byoMarketingSends: plan.byoMarketingSends,
    analyticsEvents: plan.analyticsEvents,
    supportMinutes: plan.supportMinutes,
  };
}

export function ledgerOf(p: Doc<"usagePeriods">): LedgerState {
  return {
    walletCapMicros: p.walletCapMicros,
    walletReservedMicros: p.walletReservedMicros,
    walletSpentMicros: p.walletSpentMicros,
    topupCapMicros: p.topupCapMicros,
    topupReservedMicros: p.topupReservedMicros,
    topupSpentMicros: p.topupSpentMicros,
    meterCaps: p.meterCaps,
    meterUsed: p.meterUsed,
    meterReserved: p.meterReserved,
  };
}

export function ledgerPatch(next: LedgerState) {
  return {
    walletCapMicros: next.walletCapMicros,
    walletReservedMicros: next.walletReservedMicros,
    walletSpentMicros: next.walletSpentMicros,
    topupCapMicros: next.topupCapMicros,
    topupReservedMicros: next.topupReservedMicros,
    topupSpentMicros: next.topupSpentMicros,
    meterCaps: next.meterCaps,
    meterUsed: next.meterUsed,
    meterReserved: next.meterReserved,
    updatedAt: Date.now(),
  };
}

/** The usage period in force now for the workspace's account (bounded index read; never scans history). */
export async function currentPeriod(ctx: Ctx, scope: BillingScope, now = Date.now()) {
  const accountId = scope.accountId;
  const candidates = accountId
    ? await ctx.db
        .query("usagePeriods")
        .withIndex("by_account_ends", (q) => q.eq("accountId", accountId).gt("endsAt", now))
        .take(10)
    : await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_ends", (q) => q.eq("orgId", scope._id).gt("endsAt", now))
        .take(10);
  // Prefer a paid subscription period over onboarding/demo when both overlap.
  const active = candidates.filter((p) => p.startsAt <= now);
  return (
    active.find((p) => p.source === "subscription") ??
    active.find((p) => p.source === "demo") ??
    active.find((p) => p.source === "onboarding") ??
    null
  );
}

/** The account's free credits (once per account; a second workspace shares them). */
export async function createOnboardingPeriod(ctx: MutationCtx, orgId: Id<"organizations">, accountId: Id<"accounts">) {
  const existing = await ctx.db
    .query("usagePeriods")
    .withIndex("by_account_period", (q) => q.eq("accountId", accountId).eq("periodKey", "onboarding"))
    .first();
  if (existing) return existing._id;
  const now = Date.now();
  await ctx.db.patch(accountId, { freeCreditsGrantedAt: now });
  return ctx.db.insert("usagePeriods", {
    orgId,
    accountId,
    periodKey: "onboarding",
    source: "onboarding",
    entitlementVersionId: CURRENT_ENTITLEMENTS.id,
    startsAt: now,
    endsAt: now + ONBOARDING_ALLOWANCE.days * 86_400_000,
    walletCapMicros: ONBOARDING_ALLOWANCE.walletMicros,
    walletReservedMicros: 0,
    walletSpentMicros: 0,
    topupCapMicros: 0,
    topupReservedMicros: 0,
    topupSpentMicros: 0,
    meterCaps: ONBOARDING_ALLOWANCE.meters,
    meterUsed: zeroMeters(),
    meterReserved: zeroMeters(),
    alertsSent: [],
    createdAt: now,
    updatedAt: now,
  });
}

export async function createDemoPeriod(ctx: MutationCtx, orgId: Id<"organizations">) {
  const plan = CURRENT_ENTITLEMENTS.plans.pro;
  const now = Date.now();
  return ctx.db.insert("usagePeriods", {
    orgId,
    periodKey: "demo",
    source: "demo",
    planKey: "pro",
    entitlementVersionId: CURRENT_ENTITLEMENTS.id,
    startsAt: now - 86_400_000,
    endsAt: now + 30 * 86_400_000,
    walletCapMicros: plan.aiWalletMicros,
    walletReservedMicros: 0,
    walletSpentMicros: 0,
    topupCapMicros: 0,
    topupReservedMicros: 0,
    topupSpentMicros: 0,
    meterCaps: planCaps(plan),
    meterUsed: zeroMeters(),
    meterReserved: zeroMeters(),
    alertsSent: [],
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Grant a paid subscription period exactly once per paid order. If a period
 * for the same billing window already exists (mid-period upgrade), caps are
 * raised to the new plan's caps — never summed — and never lowered mid-period.
 */
export async function grantSubscriptionPeriod(
  ctx: MutationCtx,
  params: {
    orgId: Id<"organizations">;
    accountId?: Id<"accounts">;
    planKey: PlanKey;
    entitlementVersionId: string;
    periodStart: number;
    periodEnd: number;
    polarOrderId: string;
    polarSubscriptionId: string;
  },
): Promise<{ periodId: Id<"usagePeriods">; created: boolean }> {
  const ent = getEntitlementVersion(params.entitlementVersionId);
  const plan = ent.plans[params.planKey];
  const periodKey = `sub:${params.polarSubscriptionId}:${params.periodStart}`;
  const now = Date.now();
  const accountId = params.accountId;
  const existing = accountId
    ? await ctx.db
        .query("usagePeriods")
        .withIndex("by_account_period", (q) => q.eq("accountId", accountId).eq("periodKey", periodKey))
        .first()
    : await ctx.db
        .query("usagePeriods")
        .withIndex("by_org_period", (q) => q.eq("orgId", params.orgId).eq("periodKey", periodKey))
        .unique();
  const caps = planCaps(plan);
  if (existing) {
    const raised = { ...existing.meterCaps };
    for (const k of Object.keys(caps) as (keyof Meters)[]) raised[k] = Math.max(raised[k], caps[k]);
    await ctx.db.patch(existing._id, {
      planKey: params.planKey,
      walletCapMicros: Math.max(existing.walletCapMicros, plan.aiWalletMicros),
      meterCaps: raised,
      grantedByOrderId: params.polarOrderId,
      updatedAt: now,
    });
    return { periodId: existing._id, created: false };
  }
  const periodId = await ctx.db.insert("usagePeriods", {
    orgId: params.orgId,
    ...(accountId ? { accountId } : {}),
    periodKey,
    source: "subscription",
    planKey: params.planKey,
    entitlementVersionId: params.entitlementVersionId,
    startsAt: params.periodStart,
    endsAt: params.periodEnd,
    walletCapMicros: plan.aiWalletMicros,
    walletReservedMicros: 0,
    walletSpentMicros: 0,
    topupCapMicros: 0,
    topupReservedMicros: 0,
    topupSpentMicros: 0,
    meterCaps: caps,
    meterUsed: zeroMeters(),
    meterReserved: zeroMeters(),
    alertsSent: [],
    grantedByOrderId: params.polarOrderId,
    createdAt: now,
    updatedAt: now,
  });
  return { periodId, created: true };
}
