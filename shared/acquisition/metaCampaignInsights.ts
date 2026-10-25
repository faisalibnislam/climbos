import { decimalToMinor } from "../integrations/currency";
import type { MetaInsightRow } from "../integrations/metaAds";

export interface MetaCampaignTotals {
  spendMinor: number;
  impressions: number;
  clicks: number;
  reportedActions: Array<{ actionType: string; value: number }>;
}

/** Aggregate only the selected campaign and preserve Meta action types separately. */
export function aggregateMetaCampaignInsights(input: {
  rows: MetaInsightRow[];
  campaignId: string;
  startDate: string;
  endDate: string;
  currency: string;
}): MetaCampaignTotals {
  const rows = input.rows.filter((row) => row.campaignId === input.campaignId && row.date >= input.startDate && row.date <= input.endDate);
  if (rows.length === 0) throw new Error("Meta returned no daily rows for this campaign and report window.");
  const currencies = new Set(rows.map((row) => row.currency?.toUpperCase()).filter((value): value is string => Boolean(value)));
  if (currencies.size !== 1 || !currencies.has(input.currency.toUpperCase())) {
    throw new Error("Meta returned missing or mismatched currency data.");
  }

  const totals = { spendMinor: 0, impressions: 0, clicks: 0, actions: new Map<string, number>() };
  for (const row of rows) {
    const spend = decimalToMinor(String(row.spend), input.currency);
    if (!spend.ok || !Number.isSafeInteger(totals.spendMinor + spend.minor)) throw new Error("Meta returned spend that cannot be represented in the campaign currency.");
    if (!Number.isSafeInteger(row.impressions) || row.impressions < 0 || !Number.isSafeInteger(row.clicks) || row.clicks < 0) {
      throw new Error("Meta returned invalid impression or click totals.");
    }
    totals.spendMinor += spend.minor;
    totals.impressions += row.impressions;
    totals.clicks += row.clicks;
    for (const action of row.actions) {
      if (!action.actionType || !Number.isFinite(action.value) || action.value < 0) continue;
      totals.actions.set(action.actionType, (totals.actions.get(action.actionType) ?? 0) + action.value);
    }
  }
  return {
    spendMinor: totals.spendMinor,
    impressions: totals.impressions,
    clicks: totals.clicks,
    reportedActions: [...totals.actions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([actionType, value]) => ({ actionType, value })),
  };
}
