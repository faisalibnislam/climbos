import type { OwnerEconomics } from "./economics";

export interface SegmentEconomicsResult {
  segment: string;
  periodDays: number;
  customers: number;
  currency: string;
  netRevenue: number;
  variableCosts: number;
  contributionAfterListedCosts: number;
  revenuePerCustomer: number;
  contributionPerCustomer: number;
  contributionMargin: number | null;
  completeCostCoverage: boolean;
  costBoundary: string;
  unknownCosts: string[];
  strategicValueNote?: string;
  basis: "owner_reported";
}

const cents = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** Deterministic summaries of owner-entered aggregate totals; never infers segment membership. */
export function calculateSegmentEconomics(
  rows: NonNullable<OwnerEconomics["segmentEconomics"]>,
  fallbackCurrency: string,
): SegmentEconomicsResult[] {
  return rows.map((row) => {
    const contribution = cents(row.netRevenue - row.variableCosts);
    return {
      segment: row.segment,
      periodDays: row.periodDays,
      customers: row.customers,
      currency: row.currency || fallbackCurrency,
      netRevenue: cents(row.netRevenue),
      variableCosts: cents(row.variableCosts),
      contributionAfterListedCosts: contribution,
      revenuePerCustomer: cents(row.netRevenue / row.customers),
      contributionPerCustomer: cents(contribution / row.customers),
      contributionMargin: row.netRevenue > 0 ? contribution / row.netRevenue : null,
      completeCostCoverage: (row.unknownCosts?.length ?? 0) === 0,
      costBoundary: row.costBoundary,
      unknownCosts: row.unknownCosts ?? [],
      ...(row.strategicValueNote ? { strategicValueNote: row.strategicValueNote } : {}),
      basis: "owner_reported" as const,
    };
  });
}

/** Plain-language, provenance-preserving briefing for the strategy agent. */
export function segmentEconomicsBrief(
  rows: NonNullable<OwnerEconomics["segmentEconomics"]> | undefined,
  currency: string,
): string {
  if (!rows?.length) return "SEGMENT ECONOMICS: unknown; ClimbOS has no owner-reported segment cost comparison. Do not infer segment profitability or discard a customer group from company-wide averages. Ask for segment-level revenue and variable delivery cost only when it could change the recommendation.";
  const summaries = calculateSegmentEconomics(rows, currency).map((row) => {
    const margin = row.contributionMargin === null ? "unavailable because net revenue is zero" : `${(row.contributionMargin * 100).toFixed(1)}% of net revenue`;
    const costs = row.completeCostCoverage ? "owner reports cost coverage complete for the stated boundary" : `cost coverage incomplete; unknown: ${row.unknownCosts.join(", ")}`;
    const value = row.strategicValueNote ? `; owner-noted strategic value: ${row.strategicValueNote}` : "";
    return `${row.segment}: ${row.customers} customers over ${row.periodDays} days; net revenue ${row.netRevenue} ${row.currency}; listed variable costs ${row.variableCosts} ${row.currency}; contribution after listed costs ${row.contributionAfterListedCosts} ${row.currency} (${row.contributionPerCustomer} ${row.currency}/customer; ${margin}); ${costs}; boundary: ${row.costBoundary}${value}`;
  });
  return `OWNER-REPORTED SEGMENT ECONOMICS (aggregates entered by the owner; not customer-level billing analysis; workspace currency ${currency}): ${summaries.join(" | ")}. Compare groups only across compatible currencies, periods, and cost boundaries. Incomplete costs mean the listed contribution is not full profitability. Do not automatically exclude a group: consider strategic value and what evidence or operating change could improve its economics.`;
}
