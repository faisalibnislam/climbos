/**
 * Return metrics. All amounts must be in the SAME currency and the same
 * minor-unit scale; these functions do not convert.
 *
 * Definitions (kept deliberately distinct):
 *  - ROAS (return on ad spend) = attributed revenue / ad spend.
 *    A revenue ratio; ignores every cost except media. 3.0 means $3 of
 *    attributed revenue per $1 of ad spend. Null when ad spend is 0.
 *  - Contribution = attributed revenue − ad spend − other costs
 *    (e.g. COGS, fees, agency, tooling attributable to the campaign).
 *  - ROI = contribution / (ad spend + other costs). A profit ratio;
 *    0 is break-even, 0.5 means 50% return on total cost. Null when total cost is 0.
 * Both rely on rule-based attributed revenue, so neither is a causal (incremental) measure.
 */

/** ROAS = attributedRevenue / adSpend; null when adSpend is 0. */
export function roas(attributedRevenueMinor: number, adSpendMinor: number): number | null {
  if (adSpendMinor < 0) throw new RangeError("adSpend must be ≥ 0");
  if (adSpendMinor === 0) return null;
  return attributedRevenueMinor / adSpendMinor;
}

/** Contribution = revenue − ad spend − other costs (minor units). */
export function contribution(attributedRevenueMinor: number, adSpendMinor: number, otherCostsMinor = 0): number {
  return attributedRevenueMinor - adSpendMinor - otherCostsMinor;
}

/** ROI = (revenue − ad spend − other costs) / (ad spend + other costs); null when total cost is 0. */
export function roi(attributedRevenueMinor: number, adSpendMinor: number, otherCostsMinor = 0): number | null {
  if (adSpendMinor < 0 || otherCostsMinor < 0) throw new RangeError("costs must be ≥ 0");
  const cost = adSpendMinor + otherCostsMinor;
  if (cost === 0) return null;
  return contribution(attributedRevenueMinor, adSpendMinor, otherCostsMinor) / cost;
}

export interface ReturnMetrics {
  roas: number | null;
  roi: number | null;
  contributionMinor: number;
  definitions: { roas: string; roi: string };
}

/** Convenience wrapper returning ROAS, ROI and contribution with their definitions. */
export function computeReturnMetrics(input: {
  attributedRevenueMinor: number;
  adSpendMinor: number;
  otherCostsMinor?: number;
}): ReturnMetrics {
  const other = input.otherCostsMinor ?? 0;
  return {
    roas: roas(input.attributedRevenueMinor, input.adSpendMinor),
    roi: roi(input.attributedRevenueMinor, input.adSpendMinor, other),
    contributionMinor: contribution(input.attributedRevenueMinor, input.adSpendMinor, other),
    definitions: {
      roas: "ROAS = attributed revenue / ad spend",
      roi: "ROI = (attributed revenue − ad spend − other costs) / (ad spend + other costs)",
    },
  };
}
