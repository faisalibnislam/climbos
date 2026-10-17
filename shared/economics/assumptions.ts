import type { RoleKey } from "./roles";

/**
 * Editable economic assumptions (workbook "Assumptions" sheet). Defaults are the
 * research-time values; change a copy, never the frozen default.
 */

export type PlanKey = "basic" | "starter" | "growth" | "pro" | "business";
export type UsageProfile = "low" | "base" | "heavy";

export const PLAN_KEYS: readonly PlanKey[] = ["basic", "starter", "growth", "pro", "business"];
/** The four plans modeled by the original workbook (regression fixture). */
export const WORKBOOK_PLAN_KEYS: readonly PlanKey[] = ["starter", "growth", "pro", "business"];
export const USAGE_PROFILES: readonly UsageProfile[] = ["low", "base", "heavy"];

export interface PlanDefinition {
  key: PlanKey;
  name: string;
  /** Pre-tax list price, USD per month. */
  listPriceUsd: number;
  workloadFactor: number;
  /** Plan-specific base support minutes per month (heavy = 2x). */
  baseSupportMinutes: number;
  brands: number;
  seats: number;
  connections: number;
  /**
   * How the shared fixed footprint is allocated to one customer of this plan.
   * "per_customer": footprint / customers (workbook rule).
   * "price_weighted": the per-customer share scaled by listPrice / referencePrice
   * (never more than the per-customer share). Used for plans priced far below
   * the reference plan, where a flat per-head share would misstate their cost.
   */
  fixedAllocation: "per_customer" | "price_weighted";
  /**
   * Guaranteed monthly role runs regardless of workload scaling (for example one
   * monthly strategy refresh on the smallest plan). Any runs above the scaled
   * expectation are costed explicitly in every usage profile.
   */
  minimumRoleRuns?: Partial<Record<RoleKey, number>>;
}

export interface Assumptions {
  payingCustomers: number;
  minimumGrossMargin: number;
  cacheReadFraction: number;
  cacheWriteFraction: number;
  batchFraction: number;
  retryQaReserve: number;
  refundReserve: number;
  internationalCardMix: number;
  effectiveCheckoutTax: number;
  stress: {
    aiMultiplier: number;
    infraMultiplier: number;
    supportMultiplier: number;
    customerCount: number;
    discount: number;
    internationalMix: number;
    checkoutTax: number;
  };
  fixed: {
    vercel: number;
    convex: number;
    resend: number;
    firecrawl: number;
    monitoringAndDomainReserve: number;
  };
  /** Growth-base monthly workload drivers. */
  growthBase: {
    deliveredImages: number;
    attemptsPerDeliveredImage: number;
    searchCalls: number;
    scrapeCredits: number;
    transactionalEmails: number;
    vercelCpuHours: number;
    vercelMemoryGbHours: number;
    vercelInvocationsM: number;
    convexCallsM: number;
    convexActionGbHours: number;
    convexDbIoGb: number;
    convexDbStorageGb: number;
    convexEgressGb: number;
    convexSearchStorageGb: number;
    r2StorageGb: number;
    r2Writes: number;
    r2Reads: number;
    analyticsEvents: number;
    integrationReserveUsd: number;
    observabilityVariableUsd: number;
    socialPosts: number;
    byoMarketingSends: number;
    byoSenderBudgetUsd: number;
    cacheStorageUsd: number;
  };
  plans: Record<PlanKey, PlanDefinition>;
  /** Reference plan for price-weighted fixed allocation. */
  fixedAllocationReferencePlan: PlanKey;
  profiles: Record<UsageProfile, { volumeFactor: number; supportFactor: number }>;
}

export const DEFAULT_ASSUMPTIONS: Assumptions = Object.freeze({
  payingCustomers: 100,
  minimumGrossMargin: 0.3,
  cacheReadFraction: 0,
  cacheWriteFraction: 0,
  batchFraction: 0,
  retryQaReserve: 0.2,
  refundReserve: 0.01,
  internationalCardMix: 0.5,
  effectiveCheckoutTax: 0.1,
  stress: {
    aiMultiplier: 2,
    infraMultiplier: 2,
    supportMultiplier: 1.5,
    customerCount: 10,
    discount: 0.2,
    internationalMix: 1,
    checkoutTax: 0.25,
  },
  fixed: {
    vercel: 20,
    convex: 25,
    resend: 20,
    firecrawl: 19,
    monitoringAndDomainReserve: 25,
  },
  growthBase: {
    deliveredImages: 30,
    attemptsPerDeliveredImage: 2,
    searchCalls: 40,
    scrapeCredits: 100,
    transactionalEmails: 150,
    vercelCpuHours: 0.5,
    vercelMemoryGbHours: 30,
    vercelInvocationsM: 0.1,
    convexCallsM: 1,
    convexActionGbHours: 6,
    convexDbIoGb: 10,
    convexDbStorageGb: 1,
    convexEgressGb: 2,
    convexSearchStorageGb: 0.2,
    r2StorageGb: 5,
    r2Writes: 10_000,
    r2Reads: 100_000,
    analyticsEvents: 50_000,
    integrationReserveUsd: 1.5,
    observabilityVariableUsd: 0.5,
    socialPosts: 40,
    byoMarketingSends: 5_000,
    byoSenderBudgetUsd: 40,
    cacheStorageUsd: 0,
  },
  fixedAllocationReferencePlan: "starter",
  plans: {
    basic: {
      key: "basic",
      name: "Basic",
      listPriceUsd: 19,
      workloadFactor: 0.04,
      baseSupportMinutes: 1,
      brands: 1,
      seats: 1,
      connections: 2,
      fixedAllocation: "price_weighted",
      minimumRoleRuns: { ceo: 1, cmo: 1 },
    },
    starter: {
      key: "starter",
      name: "Starter",
      listPriceUsd: 169,
      workloadFactor: 0.35,
      baseSupportMinutes: 10,
      brands: 1,
      seats: 1,
      connections: 3,
      fixedAllocation: "per_customer",
    },
    growth: {
      key: "growth",
      name: "Growth",
      listPriceUsd: 449,
      workloadFactor: 1,
      baseSupportMinutes: 25,
      brands: 1,
      seats: 3,
      connections: 6,
      fixedAllocation: "per_customer",
    },
    pro: {
      key: "pro",
      name: "Pro",
      listPriceUsd: 999,
      workloadFactor: 2.5,
      baseSupportMinutes: 60,
      brands: 3,
      seats: 8,
      connections: 15,
      fixedAllocation: "per_customer",
    },
    business: {
      key: "business",
      name: "Business",
      listPriceUsd: 2299,
      workloadFactor: 6,
      baseSupportMinutes: 120,
      brands: 5,
      seats: 20,
      connections: 30,
      fixedAllocation: "per_customer",
    },
  },
  profiles: {
    low: { volumeFactor: 0.4, supportFactor: 0.5 },
    base: { volumeFactor: 1, supportFactor: 1 },
    heavy: { volumeFactor: 3, supportFactor: 2 },
  },
}) as Assumptions;

/** Deep-clone the defaults (or a given set) so callers can safely edit a copy. */
export function cloneAssumptions(source: Assumptions = DEFAULT_ASSUMPTIONS): Assumptions {
  return JSON.parse(JSON.stringify(source)) as Assumptions;
}
