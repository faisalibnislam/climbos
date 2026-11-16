import type { OwnerEconomics } from "./economics";
import { fractionDigits, isKnownCurrency, majorToMinor, minorToMajor } from "../economics/currency";

type SegmentRow = NonNullable<OwnerEconomics["segmentEconomics"]>[number];
export interface SegmentEconomicsResult {
  segment: string;
  periodDays: number;
  customers: number;
  currency: string;
  netRevenue: number | null;
  variableCosts: number | null;
  contributionAfterListedCosts: number | null;
  revenuePerCustomer: number | null;
  contributionPerCustomer: number | null;
  contributionMargin: number | null;
  completeCostCoverage: boolean;
  costCoverage: "complete" | "incomplete" | "unknown";
  costBoundary: string;
  unknownCosts: string[];
  issues: string[];
  strategicValueNote?: string;
  basis: "owner_reported";
}

/** Validate supplied inputs, without guessing missing money or silently rounding it. */
export function segmentEconomicsInputIssues(row: SegmentRow): string[] {
  const issues: string[] = [];
  if (!row.segment.trim() || row.segment.length > 80) issues.push("Each customer group needs a name of 1–80 characters.");
  const currencyValid = /^[A-Z]{3}$/.test(row.currency) && isKnownCurrency(row.currency);
  if (!currencyValid) issues.push("Choose a supported three-letter currency code for this group's totals.");
  if (!Number.isSafeInteger(row.periodDays) || row.periodDays < 1 || row.periodDays > 3650) issues.push("The period must be 1–3650 whole days.");
  if (!Number.isSafeInteger(row.customers) || row.customers < 1 || row.customers > 10_000_000) issues.push("The customer count must be a whole number from 1 to 10,000,000.");
  for (const [label, value, minimum] of [["Net revenue", row.netRevenue, -1_000_000_000], ["Variable costs", row.variableCosts, 0]] as const) {
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < minimum || value > 1_000_000_000) issues.push(`${label} is outside the supported range.`);
    else if (currencyValid && Math.abs(value - minorToMajor(majorToMinor(value, row.currency), row.currency)) > Number.EPSILON * Math.max(1, Math.abs(value)) * 4) issues.push(`${label} must use at most ${fractionDigits(row.currency)} decimal places for ${row.currency}.`);
  }
  if (row.costBoundary.trim().length < 12 || row.costBoundary.length > 240) issues.push("Describe the variable costs included, or name the missing costs (12–240 characters).");
  if ((row.unknownCosts?.length ?? 0) > 8 || row.unknownCosts?.some(cost => !cost.trim() || cost.length > 100)) issues.push("List up to eight specific unknown costs.");
  if (row.costCoverage !== undefined && !["complete", "incomplete", "unknown"].includes(row.costCoverage)) issues.push("Choose whether cost coverage is complete, incomplete or unknown.");
  if (row.costCoverage === "complete" && (row.variableCosts === undefined || row.unknownCosts?.length)) issues.push("Complete cost coverage requires a reported cost total and no listed unknown costs.");
  if (row.strategicValueNote && row.strategicValueNote.length > 240) issues.push("Strategic value note must be 240 characters or less.");
  return issues;
}

/** Aggregates remain in their recorded currency. The workspace currency is never an exchange rate or legacy repair. */
export function calculateSegmentEconomics(rows: SegmentRow[], _workspaceCurrency?: string): SegmentEconomicsResult[] {
  void _workspaceCurrency;
  return rows.map(row => {
    const issues = segmentEconomicsInputIssues(row);
    const valid = issues.length === 0;
    const netRevenue = valid && row.netRevenue !== undefined ? row.netRevenue : null;
    const variableCosts = valid && row.variableCosts !== undefined ? row.variableCosts : null;
    const contributionMinor = netRevenue !== null && variableCosts !== null
      ? majorToMinor(netRevenue, row.currency) - majorToMinor(variableCosts, row.currency) : null;
    const contribution = contributionMinor === null ? null : minorToMajor(contributionMinor, row.currency);
    const costCoverage = row.unknownCosts?.length ? "incomplete" : row.costCoverage ?? "unknown";
    return {
      segment: row.segment, periodDays: row.periodDays, customers: row.customers, currency: row.currency,
      netRevenue, variableCosts, contributionAfterListedCosts: contribution,
      revenuePerCustomer: netRevenue === null ? null : minorToMajor(Math.round(majorToMinor(netRevenue, row.currency) / row.customers), row.currency),
      contributionPerCustomer: contributionMinor === null ? null : minorToMajor(Math.round(contributionMinor / row.customers), row.currency),
      contributionMargin: netRevenue !== null && netRevenue > 0 && contribution !== null ? contribution / netRevenue : null,
      completeCostCoverage: valid && variableCosts !== null && costCoverage === "complete",
      costCoverage, costBoundary: row.costBoundary, unknownCosts: row.unknownCosts ?? [], issues,
      ...(row.strategicValueNote ? { strategicValueNote: row.strategicValueNote } : {}), basis: "owner_reported" as const,
    };
  });
}

/** Whole records preserve evidence limits even when the model-context budget is tight. */
export function segmentEconomicsBrief(rows: SegmentRow[] | undefined, currency: string, maxChars = 3000): string {
  if (!rows?.length) return "SEGMENT ECONOMICS: unknown; ClimbOS has no owner-reported segment cost comparison. Do not infer segment profitability or discard a customer group from company-wide averages. Ask for segment-level revenue and variable delivery cost only when it could change the recommendation.";
  const header = `OWNER-REPORTED SEGMENT ECONOMICS (aggregates, not verified billing; workspace currency ${currency}; no currency conversion):`;
  const footer = "Compare only compatible currencies, observation windows and cost boundaries; equal period lengths alone do not establish comparable dates or customers. Observation dates and independent cost verification are unavailable here. Per-customer averages are rounded to the recorded currency's minor unit. Listed contribution is not full profitability. Do not automatically exclude a group: consider strategic value and a small test. No spending or execution is authorized.";
  const summaries = calculateSegmentEconomics(rows).map(row => {
    if (row.issues.length) return `${row.segment}: calculations unavailable; resolve ${row.issues.join(" ")}`;
    const amount = (n: number | null) => n === null ? "unknown" : `${n} ${row.currency}`;
    const margin = row.contributionMargin === null ? "margin unavailable" : `${(row.contributionMargin * 100).toFixed(1)}% of net revenue`;
    const costs = row.completeCostCoverage ? "owner explicitly reports complete cost coverage for the stated boundary; not independently verified"
      : row.costCoverage === "incomplete" ? `cost coverage incomplete; unknown costs: ${row.unknownCosts.join(", ") || "not itemized"}` : "cost coverage unknown; not confirmed by the owner";
    return `${row.segment}: ${row.customers} customers over ${row.periodDays} days; net revenue ${amount(row.netRevenue)}; listed variable costs ${amount(row.variableCosts)}; contribution after listed costs ${amount(row.contributionAfterListedCosts)} (${amount(row.contributionPerCustomer)}/customer; ${margin}); ${costs}; boundary: ${row.costBoundary}${row.strategicValueNote ? `; owner-noted strategic value: ${row.strategicValueNote}` : ""}`;
  });
  const selected: string[] = [];
  const omission = "Some groups omitted to fit context; no complete comparison is available.";
  let used = header.length + footer.length + omission.length + 4;
  for (const summary of summaries) {
    if (used + summary.length + 1 > maxChars) break;
    selected.push(summary); used += summary.length + 1;
  }
  return [header, ...selected, ...(selected.length < summaries.length ? [omission] : []), footer].join("\n");
}
