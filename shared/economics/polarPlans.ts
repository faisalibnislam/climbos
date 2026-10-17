/**
 * Polar seller plan comparison. Published plans (fees on taxed checkout total;
 * non-US cards add 1.5% on every plan). Choose a plan from actual transaction
 * count and volume, never from a generic revenue threshold.
 */

export type PolarSellerPlan = "starter" | "pro" | "growth" | "scale";

export interface PolarPlanFees {
  plan: PolarSellerPlan;
  monthlyFeeUsd: number;
  percent: number;
  fixedPerTransactionUsd: number;
}

export const POLAR_SELLER_PLANS: Record<PolarSellerPlan, PolarPlanFees> = {
  starter: { plan: "starter", monthlyFeeUsd: 0, percent: 0.05, fixedPerTransactionUsd: 0.5 },
  pro: { plan: "pro", monthlyFeeUsd: 20, percent: 0.038, fixedPerTransactionUsd: 0.4 },
  growth: { plan: "growth", monthlyFeeUsd: 100, percent: 0.036, fixedPerTransactionUsd: 0.35 },
  scale: { plan: "scale", monthlyFeeUsd: 400, percent: 0.034, fixedPerTransactionUsd: 0.3 },
};

export const POLAR_INTERNATIONAL_SURCHARGE = 0.015;

/** Monthly Polar checkout fees for a given fee-bearing (taxed) volume and transaction count. */
export function polarMonthlyFeesUsd(
  plan: PolarSellerPlan,
  params: { taxedCheckoutVolumeUsd: number; transactions: number; internationalMix: number },
): number {
  const p = POLAR_SELLER_PLANS[plan];
  const { taxedCheckoutVolumeUsd, transactions, internationalMix } = params;
  if (taxedCheckoutVolumeUsd < 0 || transactions < 0) throw new RangeError("Volume and transactions must be 0 or more");
  return (
    p.monthlyFeeUsd +
    taxedCheckoutVolumeUsd * (p.percent + POLAR_INTERNATIONAL_SURCHARGE * internationalMix) +
    transactions * p.fixedPerTransactionUsd
  );
}

export function cheapestPolarPlan(params: {
  taxedCheckoutVolumeUsd: number;
  transactions: number;
  internationalMix: number;
}): { plan: PolarSellerPlan; feesUsd: number; all: Record<PolarSellerPlan, number> } {
  const all = Object.fromEntries(
    (Object.keys(POLAR_SELLER_PLANS) as PolarSellerPlan[]).map((k) => [k, polarMonthlyFeesUsd(k, params)]),
  ) as Record<PolarSellerPlan, number>;
  let best: PolarSellerPlan = "starter";
  for (const k of Object.keys(all) as PolarSellerPlan[]) if (all[k] < all[best]) best = k;
  return { plan: best, feesUsd: all[best], all };
}
