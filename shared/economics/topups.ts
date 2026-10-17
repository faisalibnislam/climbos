import { type Assumptions, DEFAULT_ASSUMPTIONS } from "./assumptions";
import { effectivePaymentRate, EconomicsInputError } from "./calculator";
import { type RateVersion, RESEARCH_2026_10_17 } from "./rates";

export interface TopupEconomics {
  priceUsd: number;
  deliveryCostUsd: number;
  revenueUsd: number;
  paymentFeesUsd: number;
  grossProfitUsd: number;
  grossMargin: number;
}

/**
 * Margin of a one-time top-up at the STRESS fee rate (100% international cards,
 * 25% checkout tax) with the refund reserve applied. The delivery cost is the
 * stressed incremental total delivery cost the pack authorizes (AI, images,
 * research, compute and support induced by the work), not raw token cost.
 */
export function topupEconomics(
  priceUsd: number,
  deliveryCostUsd: number,
  options: { assumptions?: Assumptions; rates?: RateVersion } = {},
): TopupEconomics {
  const a = options.assumptions ?? DEFAULT_ASSUMPTIONS;
  const pay = (options.rates ?? RESEARCH_2026_10_17).payments;
  if (!(priceUsd > 0)) throw new EconomicsInputError("Top-up price must be greater than 0");
  if (!(deliveryCostUsd >= 0)) throw new EconomicsInputError("Delivery cost must be 0 or more");
  const rate = effectivePaymentRate({
    percent: pay.percent,
    internationalSurcharge: pay.internationalSurcharge,
    internationalMix: a.stress.internationalMix,
    checkoutTax: a.stress.checkoutTax,
    payoutVariableReserve: pay.payoutVariableReserve,
  });
  const revenueUsd = priceUsd * (1 - a.refundReserve);
  const paymentFeesUsd = priceUsd * rate + pay.fixedPerTransaction;
  const grossProfitUsd = revenueUsd - deliveryCostUsd - paymentFeesUsd;
  return {
    priceUsd,
    deliveryCostUsd,
    revenueUsd,
    paymentFeesUsd,
    grossProfitUsd,
    grossMargin: grossProfitUsd / revenueUsd,
  };
}

/** Largest delivery cost (whole cents, rounded down) a top-up price can authorize at a target margin. */
export function maxTopupDeliveryCostUsd(
  priceUsd: number,
  targetMargin: number,
  options: { assumptions?: Assumptions; rates?: RateVersion } = {},
): number {
  const zero = topupEconomics(priceUsd, 0, options);
  const allowed = zero.revenueUsd * (1 - targetMargin) - zero.paymentFeesUsd;
  if (allowed <= 0) {
    throw new EconomicsInputError("Top-up price is too low to cover fees at this margin");
  }
  return Math.floor(allowed * 100) / 100;
}

/**
 * Stressed delivery cost a job consumes from a top-up allowance. AI and image
 * provider costs are multiplied by the stress AI multiplier; research is kept
 * at its modeled rate; a per-step compute/support overhead is added.
 */
export function stressedDeliveryCostMicros(params: {
  aiMicros: number;
  imageMicros: number;
  researchMicros: number;
  modelSteps: number;
  aiMultiplier?: number;
  /** Compute + support overhead per model step, µUSD. Default $0.002. */
  overheadPerStepMicros?: number;
}): number {
  const mult = params.aiMultiplier ?? DEFAULT_ASSUMPTIONS.stress.aiMultiplier;
  const overhead = params.overheadPerStepMicros ?? 2_000;
  return Math.ceil(
    (params.aiMicros + params.imageMicros) * mult + params.researchMicros + params.modelSteps * overhead,
  );
}
