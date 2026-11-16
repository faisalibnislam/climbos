import { decimalToMinor } from "../integrations/currency";
import type { MetaInsightRow } from "../integrations/metaAds";
import { validateReportRows } from "./campaignReport";

export interface MetaCampaignTotals {
  spendMinor: number;
  impressions: number;
  clicks: number;
  reportedActions?: Array<{ actionType: string; value: number }>;
}

/** Aggregate only the selected campaign and preserve Meta action types separately. */
export function aggregateMetaCampaignInsights(input: {
  rows: MetaInsightRow[];
  campaignId: string;
  startDate: string;
  endDate: string;
  currency: string;
}): MetaCampaignTotals {
  if (input.rows.some(row => !row.campaignId)) throw new Error("Meta returned a row without campaign identity.");
  const rows = input.rows.filter((row) => row.campaignId === input.campaignId);
  if (rows.length === 0) throw new Error("Meta returned no daily rows for this campaign and report window.");
  if (!rows.some(row => row.date >= input.startDate && row.date <= input.endDate)) throw new Error("Meta returned no daily rows for this campaign and report window.");
  validateReportRows(rows, input.startDate, input.endDate);
  if (rows.some(row => row.currency?.toUpperCase() !== input.currency.toUpperCase())) {
    throw new Error("Meta returned missing or mismatched currency data.");
  }

  const totals = { spendMinor: 0, impressions: 0, clicks: 0, actions: new Map<string, number>() };
  for (const row of rows) {
    const spend = decimalToMinor(row.spendDecimal ?? String(row.spend), input.currency);
    if (!spend.ok || spend.minor < 0 || !Number.isSafeInteger(totals.spendMinor + spend.minor)) throw new Error("Meta returned spend that cannot be represented in the campaign currency.");
    if (!Number.isSafeInteger(row.impressions) || row.impressions < 0 || !Number.isSafeInteger(row.clicks) || row.clicks < 0) {
      throw new Error("Meta returned invalid impression or click totals.");
    }
    totals.spendMinor += spend.minor;
    totals.impressions += row.impressions;
    totals.clicks += row.clicks;
    if (!Number.isSafeInteger(totals.impressions) || !Number.isSafeInteger(totals.clicks)) throw new Error("Meta returned unsafe report totals.");
    const seen = new Set<string>();
    for (const action of row.actions ?? []) {
      if (!action.actionType || seen.has(action.actionType) || !Number.isFinite(action.value) || action.value < 0) throw new Error("Meta returned invalid or duplicate action data.");
      seen.add(action.actionType);
      const sum = (totals.actions.get(action.actionType) ?? 0) + action.value;
      if (!Number.isFinite(sum) || sum > Number.MAX_SAFE_INTEGER) throw new Error("Meta returned unsafe action totals.");
      totals.actions.set(action.actionType, sum);
    }
  }
  return {
    spendMinor: totals.spendMinor,
    impressions: totals.impressions,
    clicks: totals.clicks,
    reportedActions: rows.some(row => row.actions === undefined) ? undefined : [...totals.actions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([actionType, value]) => ({ actionType, value })),
  };
}
