import { currencyExponent, decimalToMinor } from "../integrations/currency";
import type { CampaignDailyMetrics } from "../integrations/googleAds";
import type { MetaInsightRow } from "../integrations/metaAds";
import { isKnownCurrency } from "../economics/currency";
import { reportDayInZone, validReportDay, validateReportRows } from "./campaignReport";

export const SPEND_MONITOR_INTERVAL_MS = 15 * 60_000;
export const SPEND_MONITOR_FRESH_MS = 5 * 60_000;
export const SPEND_MONITOR_ACTION = "pause_at_reported_total";

/** Includes today's partial provider day. No missing timezone or lifetime range is invented. */
export function spendMonitorWindow(startDate: string | undefined, timeZone: string, now: number) {
  const endDate = reportDayInZone(now, timeZone);
  if (!startDate || !validReportDay(startDate) || startDate > endDate) throw new Error("The approved campaign start date is unavailable or still in the future.");
  if ((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 >= 90) throw new Error("This campaign exceeds the monitor's 90-day reporting window. Check its full spend in the ad platform.");
  return { startDate, endDate };
}

type Window = { campaignId: string; startDate: string; endDate: string; currency: string; truncated: boolean };
function complete(input: Window) {
  if (input.truncated) throw new Error("The provider spend report is incomplete. No pause decision was made.");
  if (!isKnownCurrency(input.currency)) throw new Error("The report currency is unknown.");
}
export function googleMonitorSpend(input: Window & { rows: CampaignDailyMetrics[] }): number {
  complete(input);
  if (input.rows.some(row => row.campaignId !== input.campaignId)) throw new Error("The report does not match the approved campaign.");
  validateReportRows(input.rows, input.startDate, input.endDate);
  let micros = 0;
  for (const row of input.rows) {
    if (!Number.isSafeInteger(row.costMicros) || row.costMicros < 0 || !Number.isSafeInteger(micros + row.costMicros)) throw new Error("Reported spend is missing or invalid.");
    micros += row.costMicros;
  }
  // Rounding up could falsely cross the approved minor-unit threshold.
  return Math.floor(micros / 10 ** (6 - currencyExponent(input.currency)));
}
export function metaMonitorSpend(input: Window & { rows: MetaInsightRow[] }): number {
  complete(input);
  if (input.rows.some(row => !row.campaignId)) throw new Error("The report contains unidentified campaigns.");
  const rows = input.rows.filter(row => row.campaignId === input.campaignId);
  validateReportRows(rows, input.startDate, input.endDate);
  let spend = 0;
  for (const row of rows) {
    if (row.currency?.toUpperCase() !== input.currency.toUpperCase()) throw new Error("The report currency differs from the approved campaign.");
    const amount = decimalToMinor(row.spendDecimal ?? String(row.spend), input.currency);
    if (!amount.ok || amount.minor < 0 || !Number.isSafeInteger(spend + amount.minor)) throw new Error("Reported spend is missing or invalid.");
    spend += amount.minor;
  }
  return spend;
}
