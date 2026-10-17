/**
 * Pure economics calculator. Reproduces the ClimbOS-Cost-Calculator.xlsx
 * workbook (Costs, Agents and Summary sheets) from a rate version, a routing
 * version and an assumptions object. No spreadsheet runtime is involved.
 *
 * Formulas (blueprint section 10):
 *   a = f × (1 + t) + p            f = checkout % incl. international mix
 *   R = P × (1 − q)                recognized revenue after refund reserve
 *   F = a × P + k                  payment cost (fees on taxed checkout total)
 *   Gross margin = (R − C − F) / R
 *   Minimum price P = (C + k) / [(1 − q)(1 − m) − a]   (denominator must be > 0)
 *   Minimum list price under discount d = P / (1 − d)
 */

import {
  type Assumptions,
  DEFAULT_ASSUMPTIONS,
  PLAN_KEYS,
  type PlanKey,
  USAGE_PROFILES,
  type UsageProfile,
} from "./assumptions";
import { type MicroUsd, microsToUsd, sumMicros, usdToMicros } from "./money";
import { type RateVersion, RESEARCH_2026_10_17 } from "./rates";
import {
  ROLE_BUDGETS,
  type RoleKey,
  ROUTING_RESEARCH_2026_10_17,
  type RoutingVersion,
} from "./roles";

export class EconomicsInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EconomicsInputError";
  }
}

export interface CalculatorInputs {
  assumptions?: Assumptions;
  rates?: RateVersion;
  routing?: RoutingVersion;
}

interface ResolvedInputs {
  assumptions: Assumptions;
  rates: RateVersion;
  routing: RoutingVersion;
}

function resolve(inputs: CalculatorInputs = {}): ResolvedInputs {
  const resolved = {
    assumptions: inputs.assumptions ?? DEFAULT_ASSUMPTIONS,
    rates: inputs.rates ?? RESEARCH_2026_10_17,
    routing: inputs.routing ?? ROUTING_RESEARCH_2026_10_17,
  };
  validateAssumptions(resolved.assumptions);
  return resolved;
}

function requireFraction(value: number, label: string, { allowOne = true } = {}): void {
  if (!Number.isFinite(value) || value < 0 || value > 1 || (!allowOne && value === 1)) {
    throw new EconomicsInputError(`${label} must be a fraction between 0 and 1, received ${value}`);
  }
}

function requirePositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new EconomicsInputError(`${label} must be greater than 0, received ${value}`);
  }
}

function requireNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new EconomicsInputError(`${label} must be 0 or more, received ${value}`);
  }
}

export function validateAssumptions(a: Assumptions): void {
  requirePositive(a.payingCustomers, "Paying customers");
  requireFraction(a.minimumGrossMargin, "Minimum gross margin", { allowOne: false });
  requireFraction(a.cacheReadFraction, "Cache read fraction");
  requireFraction(a.cacheWriteFraction, "Cache write fraction");
  if (a.cacheReadFraction + a.cacheWriteFraction > 1) {
    throw new EconomicsInputError("Cache read and write fractions must total 100% or less");
  }
  requireFraction(a.batchFraction, "Batch fraction");
  requireNonNegative(a.retryQaReserve, "Retry / QA reserve");
  requireFraction(a.refundReserve, "Refund reserve", { allowOne: false });
  requireFraction(a.internationalCardMix, "International card mix");
  requireNonNegative(a.effectiveCheckoutTax, "Effective checkout tax");
  requirePositive(a.stress.aiMultiplier, "Stress AI multiplier");
  requirePositive(a.stress.infraMultiplier, "Stress infrastructure multiplier");
  requirePositive(a.stress.supportMultiplier, "Stress support multiplier");
  requirePositive(a.stress.customerCount, "Stress customer count");
  requireFraction(a.stress.discount, "Stress discount", { allowOne: false });
  requireFraction(a.stress.internationalMix, "Stress international mix");
  requireNonNegative(a.stress.checkoutTax, "Stress checkout tax");
  for (const [k, v] of Object.entries(a.fixed)) requireNonNegative(v, `Fixed cost ${k}`);
  for (const [k, v] of Object.entries(a.growthBase)) requireNonNegative(v, `Growth base ${k}`);
  for (const key of PLAN_KEYS) {
    const plan = a.plans[key];
    requirePositive(plan.listPriceUsd, `${plan.name} list price`);
    requirePositive(plan.workloadFactor, `${plan.name} workload factor`);
    requireNonNegative(plan.baseSupportMinutes, `${plan.name} support minutes`);
  }
  for (const key of USAGE_PROFILES) {
    requireNonNegative(a.profiles[key].volumeFactor, `${key} volume factor`);
    requireNonNegative(a.profiles[key].supportFactor, `${key} support factor`);
  }
}

/* ------------------------------------------------------------------ */
/* Agents sheet                                                         */
/* ------------------------------------------------------------------ */

export interface RoleCostRow {
  role: RoleKey;
  model: string;
  runs: number;
  inputTokensPerRun: number;
  outputTokensPerRun: number;
  inputCostUsd: number;
  outputCostUsd: number;
  totalUsd: number;
}

/** Growth-base monthly raw text cost per role, before the retry/QA reserve. */
export function roleTextCosts(inputs: CalculatorInputs = {}): { rows: RoleCostRow[]; totalUsd: number } {
  const { assumptions: a, rates, routing } = resolve(inputs);
  const uncached = 1 - a.cacheReadFraction - a.cacheWriteFraction;
  const batchFactor = 1 - a.batchFraction * 0.5;
  const rows = ROLE_BUDGETS.map((role) => {
    const model = rates.models[routing.routes[role.key].primary];
    const inputCostUsd =
      ((role.baseRunsPerMonth * role.inputTokensPerRun) / 1_000_000) *
      (uncached * model.inputPerM +
        a.cacheReadFraction * model.cacheReadPerM +
        a.cacheWriteFraction * model.cacheWritePerM) *
      batchFactor;
    const outputCostUsd =
      ((role.baseRunsPerMonth * role.outputTokensPerRun) / 1_000_000) * model.outputPerM * batchFactor;
    return {
      role: role.key,
      model: model.displayName,
      runs: role.baseRunsPerMonth,
      inputTokensPerRun: role.inputTokensPerRun,
      outputTokensPerRun: role.outputTokensPerRun,
      inputCostUsd,
      outputCostUsd,
      totalUsd: inputCostUsd + outputCostUsd,
    };
  });
  return { rows, totalUsd: rows.reduce((s, r) => s + r.totalUsd, 0) };
}

/* ------------------------------------------------------------------ */
/* Fees                                                                 */
/* ------------------------------------------------------------------ */

/** Effective variable payment rate a = f × (1 + t) + p. */
export function effectivePaymentRate(params: {
  percent: number;
  internationalSurcharge: number;
  internationalMix: number;
  checkoutTax: number;
  payoutVariableReserve: number;
}): number {
  const f = params.percent + params.internationalSurcharge * params.internationalMix;
  return f * (1 + params.checkoutTax) + params.payoutVariableReserve;
}

/**
 * Minimum pre-tax list price that achieves `targetMargin`.
 * Throws when the denominator is not positive (no price can reach the target).
 */
export function minimumPrice(params: {
  directCostUsd: number;
  fixedPerTransactionUsd: number;
  refundReserve: number;
  targetMargin: number;
  paymentRate: number;
  discount?: number;
}): number {
  const { directCostUsd, fixedPerTransactionUsd, refundReserve, targetMargin, paymentRate } = params;
  const discount = params.discount ?? 0;
  requireNonNegative(directCostUsd, "Direct cost");
  requireFraction(refundReserve, "Refund reserve", { allowOne: false });
  requireFraction(targetMargin, "Target margin", { allowOne: false });
  requireFraction(discount, "Discount", { allowOne: false });
  const denominator = (1 - refundReserve) * (1 - targetMargin) - paymentRate;
  if (!(denominator > 0)) {
    throw new EconomicsInputError(
      `No price can reach a ${(targetMargin * 100).toFixed(1)}% margin: fees and refunds consume the whole price (denominator ${denominator.toFixed(6)})`,
    );
  }
  return (directCostUsd + fixedPerTransactionUsd) / denominator / (1 - discount);
}

/* ------------------------------------------------------------------ */
/* Costs sheet                                                          */
/* ------------------------------------------------------------------ */

export const COST_LINE_KEYS = [
  "textAi",
  "images",
  "research",
  "transactionalEmail",
  "hosting",
  "storage",
  "analytics",
  "integrations",
  "support",
  "observability",
  "fixedAllocated",
] as const;
export type CostLineKey = (typeof COST_LINE_KEYS)[number];

export const COST_LINE_LABELS: Record<CostLineKey, string> = {
  textAi: "Text AI, including QA/retries",
  images: "Images",
  research: "Research tools",
  transactionalEmail: "Transactional email",
  hosting: "Hosting, database and background jobs",
  storage: "Storage and object operations",
  analytics: "Analytics",
  integrations: "Social/ads integration reserve",
  support: "Support",
  observability: "Variable monitoring",
  fixedAllocated: "Shared production fixed services",
};

export interface PlanCaps {
  deliveredImages: number;
  imageAttempts: number;
  socialPosts: number;
  scrapeCredits: number;
  searchCalls: number;
  transactionalEmails: number;
  byoMarketingSends: number;
  storageGb: number;
  /** Internal monthly AI wallet (text + images, stressed), whole dollars rounded down. */
  aiWalletMicros: MicroUsd;
  supportMinutes: number;
  roleRuns: Record<RoleKey, number>;
}

export interface ProfileResult {
  plan: PlanKey;
  profile: UsageProfile;
  workloadFactor: number;
  usageFactor: number;
  supportFactor: number;
  listPriceMicros: MicroUsd;
  revenueMicros: MicroUsd;
  lines: Record<CostLineKey, MicroUsd>;
  directCogsMicros: MicroUsd;
  paymentFeesMicros: MicroUsd;
  totalCogsMicros: MicroUsd;
  grossProfitMicros: MicroUsd;
  grossMargin: number;
  minimumListPriceUsd: number;
  stress: {
    revenueMicros: MicroUsd;
    directCogsMicros: MicroUsd;
    paymentFeesMicros: MicroUsd;
    totalCogsMicros: MicroUsd;
    grossMargin: number;
    minimumListPriceUsd: number;
  };
  /** Customer-paid budget shown separately; excluded from ClimbOS revenue and COGS. */
  externalSenderBudgetMicros: MicroUsd;
  caps: Omit<PlanCaps, "roleRuns" | "aiWalletMicros"> & { aiWalletUsdUnrounded: number };
  meetsTarget: boolean;
}

export function fixedFootprintUsd(a: Assumptions, rates: RateVersion): number {
  const f = a.fixed;
  return (
    f.vercel +
    f.convex +
    f.resend +
    f.firecrawl +
    f.monitoringAndDomainReserve +
    rates.payments.monthlyPlanFee +
    rates.payments.monthlyPayoutFixed
  );
}

export function computeProfile(
  plan: PlanKey,
  profile: UsageProfile,
  inputs: CalculatorInputs = {},
): ProfileResult {
  const resolved = resolve(inputs);
  const { assumptions: a, rates } = resolved;
  const s = rates.services;
  const g = a.growthBase;
  const planDef = a.plans[plan];
  const prof = a.profiles[profile];
  const w = planDef.workloadFactor;
  const u = prof.volumeFactor;
  const scale = w * u;

  const baseText = roleTextCosts(resolved).totalUsd;

  const lineUsd: Record<CostLineKey, number> = {
    textAi: (baseText * (1 + a.retryQaReserve) + g.cacheStorageUsd) * scale,
    images: g.deliveredImages * g.attemptsPerDeliveredImage * s.imageAttempt * scale,
    research: (g.searchCalls * s.searchCall + g.scrapeCredits * s.scrapeCredit) * scale,
    transactionalEmail: g.transactionalEmails * s.transactionalEmail * scale,
    hosting:
      (g.vercelCpuHours * s.vercelCpuHour +
        g.vercelMemoryGbHours * s.vercelMemoryGbHour +
        g.vercelInvocationsM * s.vercelInvocationsPerM +
        g.convexCallsM * s.convexCallsPerM +
        g.convexActionGbHours * s.convexActionGbHour +
        g.convexDbIoGb * s.convexDbIoGb +
        g.convexDbStorageGb * s.convexDbStorageGbMonth +
        g.convexEgressGb * s.convexEgressGb +
        g.convexSearchStorageGb * s.convexSearchStorageGbMonth) *
      scale,
    storage:
      (g.r2StorageGb * s.r2StorageGbMonth +
        (g.r2Writes * s.r2WritesPerM) / 1_000_000 +
        (g.r2Reads * s.r2ReadsPerM) / 1_000_000) *
      scale,
    analytics: g.analyticsEvents * s.analyticsEvent * scale,
    integrations: g.integrationReserveUsd * scale,
    support: planDef.baseSupportMinutes * prof.supportFactor * s.supportPerMinute,
    observability: g.observabilityVariableUsd * scale,
    fixedAllocated: fixedFootprintUsd(a, rates) / a.payingCustomers,
  };

  const lines = Object.fromEntries(
    COST_LINE_KEYS.map((k) => [k, usdToMicros(lineUsd[k])]),
  ) as Record<CostLineKey, MicroUsd>;
  const directCogsMicros = sumMicros(COST_LINE_KEYS.map((k) => lines[k]));

  const pay = rates.payments;
  const P = planDef.listPriceUsd;
  const aNormal = effectivePaymentRate({
    percent: pay.percent,
    internationalSurcharge: pay.internationalSurcharge,
    internationalMix: a.internationalCardMix,
    checkoutTax: a.effectiveCheckoutTax,
    payoutVariableReserve: pay.payoutVariableReserve,
  });
  const paymentFeesMicros = usdToMicros(P * aNormal + pay.fixedPerTransaction);
  const revenueMicros = usdToMicros(P * (1 - a.refundReserve));
  const totalCogsMicros = directCogsMicros + paymentFeesMicros;
  const grossProfitMicros = revenueMicros - totalCogsMicros;
  const grossMargin = grossProfitMicros / revenueMicros;

  const minimumListPriceUsd = minimumPrice({
    directCostUsd: microsToUsd(directCogsMicros),
    fixedPerTransactionUsd: pay.fixedPerTransaction,
    refundReserve: a.refundReserve,
    targetMargin: a.minimumGrossMargin,
    paymentRate: aNormal,
  });

  // Combined downside stress (blueprint section 10).
  const st = a.stress;
  const stressPrice = P * (1 - st.discount);
  const stressDirectUsd =
    microsToUsd(lines.textAi + lines.images) * st.aiMultiplier +
    microsToUsd(lines.research + lines.transactionalEmail) +
    microsToUsd(lines.hosting + lines.storage + lines.analytics + lines.integrations) * st.infraMultiplier +
    microsToUsd(lines.support) * st.supportMultiplier +
    microsToUsd(lines.observability) * st.infraMultiplier +
    fixedFootprintUsd(a, rates) / st.customerCount;
  const stressDirectMicros = usdToMicros(stressDirectUsd);
  const aStress = effectivePaymentRate({
    percent: pay.percent,
    internationalSurcharge: pay.internationalSurcharge,
    internationalMix: st.internationalMix,
    checkoutTax: st.checkoutTax,
    payoutVariableReserve: pay.payoutVariableReserve,
  });
  const stressFeesMicros = usdToMicros(stressPrice * aStress + pay.fixedPerTransaction);
  const stressRevenueMicros = usdToMicros(stressPrice * (1 - a.refundReserve));
  const stressTotalMicros = stressDirectMicros + stressFeesMicros;
  const stressMargin = (stressRevenueMicros - stressTotalMicros) / stressRevenueMicros;
  const stressMinimumListPriceUsd = minimumPrice({
    directCostUsd: microsToUsd(stressDirectMicros),
    fixedPerTransactionUsd: pay.fixedPerTransaction,
    refundReserve: a.refundReserve,
    targetMargin: a.minimumGrossMargin,
    paymentRate: aStress,
    discount: st.discount,
  });

  const floorCap = (value: number) => Math.floor(Number(value.toPrecision(12)));

  return {
    plan,
    profile,
    workloadFactor: w,
    usageFactor: u,
    supportFactor: prof.supportFactor,
    listPriceMicros: usdToMicros(P),
    revenueMicros,
    lines,
    directCogsMicros,
    paymentFeesMicros,
    totalCogsMicros,
    grossProfitMicros,
    grossMargin,
    minimumListPriceUsd,
    stress: {
      revenueMicros: stressRevenueMicros,
      directCogsMicros: stressDirectMicros,
      paymentFeesMicros: stressFeesMicros,
      totalCogsMicros: stressTotalMicros,
      grossMargin: stressMargin,
      minimumListPriceUsd: stressMinimumListPriceUsd,
    },
    externalSenderBudgetMicros: usdToMicros(g.byoSenderBudgetUsd * scale),
    caps: {
      deliveredImages: floorCap(g.deliveredImages * scale),
      imageAttempts: floorCap(g.deliveredImages * scale * g.attemptsPerDeliveredImage),
      socialPosts: floorCap(g.socialPosts * scale),
      scrapeCredits: floorCap(g.scrapeCredits * scale),
      searchCalls: floorCap(g.searchCalls * scale),
      transactionalEmails: floorCap(g.transactionalEmails * scale),
      byoMarketingSends: floorCap(g.byoMarketingSends * scale),
      storageGb: g.r2StorageGb * scale,
      aiWalletUsdUnrounded: microsToUsd(lines.textAi + lines.images) * st.aiMultiplier,
      supportMinutes: planDef.baseSupportMinutes * prof.supportFactor,
    },
    meetsTarget: grossMargin >= a.minimumGrossMargin && stressMargin >= a.minimumGrossMargin,
  };
}

export function computeAllProfiles(inputs: CalculatorInputs = {}): ProfileResult[] {
  const rows: ProfileResult[] = [];
  for (const plan of PLAN_KEYS) {
    for (const profile of USAGE_PROFILES) rows.push(computeProfile(plan, profile, inputs));
  }
  return rows;
}

/** Monthly caps for a plan = its Heavy profile (the included maximum). */
export function computePlanCaps(plan: PlanKey, inputs: CalculatorInputs = {}): PlanCaps {
  const resolved = resolve(inputs);
  const heavy = computeProfile(plan, "heavy", resolved);
  const scale = heavy.workloadFactor * heavy.usageFactor;
  const roleRuns = Object.fromEntries(
    ROLE_BUDGETS.map((r) => [r.key, Math.floor(Number((r.baseRunsPerMonth * scale).toPrecision(12)))]),
  ) as Record<RoleKey, number>;
  const { aiWalletUsdUnrounded, ...rest } = heavy.caps;
  return {
    ...rest,
    aiWalletMicros: usdToMicros(Math.floor(aiWalletUsdUnrounded)),
    roleRuns,
  };
}

export interface MarginGuardResult {
  ok: boolean;
  failures: { plan: PlanKey; profile: UsageProfile; grossMargin: number; stressMargin: number }[];
}

/**
 * Release gate: a plan/rate configuration may only be enabled when every
 * plan's heavy profile meets the minimum gross margin both normally and under
 * the combined stress envelope.
 */
export function marginGuard(inputs: CalculatorInputs = {}): MarginGuardResult {
  const resolved = resolve(inputs);
  const failures: MarginGuardResult["failures"] = [];
  for (const row of computeAllProfiles(resolved)) {
    if (!row.meetsTarget) {
      failures.push({
        plan: row.plan,
        profile: row.profile,
        grossMargin: row.grossMargin,
        stressMargin: row.stress.grossMargin,
      });
    }
  }
  return { ok: failures.length === 0, failures };
}
