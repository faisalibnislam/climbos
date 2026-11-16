import { microsToMinor } from "../integrations/currency";
import { fractionDigits, isKnownCurrency } from "../economics/currency";
import type { CampaignDailyMetrics } from "../integrations/googleAds";

export const CAMPAIGN_REPORT_VERSION = 1;
export function validateCampaignReportTotals(report: { currency: string; spendMinor?: number; impressions?: number; clicks?: number; conversions?: number; conversionValueMinor?: number; reportedActions?: readonly { actionType: string; value: number }[] }): void {
  if (!isKnownCurrency(report.currency)) throw new Error("The campaign report currency is unknown.");
  for (const field of ["spendMinor", "impressions", "clicks"] as const) {
    const n = report[field];
    if (n === undefined || !Number.isSafeInteger(n) || n < 0) throw new Error(`Missing or invalid reported ${field}.`);
  }
  if (report.conversions !== undefined && (!Number.isFinite(report.conversions) || report.conversions < 0 || report.conversions > Number.MAX_SAFE_INTEGER)) throw new Error("Invalid reported conversions.");
  if (report.conversionValueMinor !== undefined && (!Number.isSafeInteger(report.conversionValueMinor) || report.conversionValueMinor < 0)) throw new Error("Invalid reported conversion value.");
  const seen = new Set<string>();
  for (const action of report.reportedActions ?? []) {
    if (!action.actionType || seen.has(action.actionType) || !Number.isFinite(action.value) || action.value < 0 || action.value > Number.MAX_SAFE_INTEGER) throw new Error("Invalid reported action totals.");
    seen.add(action.actionType);
  }
}
export function validReportDay(day: string): boolean {
  const ms = Date.parse(`${day}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === day;
}
export function reportDayInZone(ms: number, timeZone: string): string {
  if (!timeZone) throw new Error("The ad account timezone is unknown. Reconnect or check the account settings.");
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ms);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch { throw new Error("The ad account timezone is not recognized."); }
}
export function shiftReportDay(day: string, delta: number): string {
  if (!validReportDay(day)) throw new Error("The campaign report date is invalid.");
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);
}
export function campaignReportWindow(campaign: { activatedAt?: number; startDate?: string; endDate?: string }, timeZone: string, now: number) {
  const activation = campaign.activatedAt !== undefined ? reportDayInZone(campaign.activatedAt, timeZone) : campaign.startDate;
  if (!activation || !validReportDay(activation) || (campaign.endDate !== undefined && !validReportDay(campaign.endDate))) throw new Error("The campaign dates need review before reading results.");
  const yesterday = shiftReportDay(reportDayInZone(now, timeZone), -1);
  const endDate = campaign.endDate && campaign.endDate < yesterday ? campaign.endDate : yesterday;
  if (endDate < activation) throw new Error("No completed campaign days are available to report yet.");
  const startDate = activation < shiftReportDay(endDate, -89) ? shiftReportDay(endDate, -89) : activation;
  return { startDate, endDate };
}

export function validateReportRows(rows: readonly { date: string }[], startDate: string, endDate: string): void {
  if (!validReportDay(startDate) || !validReportDay(endDate) || endDate < startDate) throw new Error("Invalid campaign report window.");
  if (!rows.length) throw new Error("No daily rows were returned for this campaign. Its results remain unknown.");
  const seen = new Set<string>();
  for (const row of rows) {
    if (!validReportDay(row.date) || row.date < startDate || row.date > endDate) throw new Error("A campaign report row has an invalid or out-of-window date.");
    if (seen.has(row.date)) throw new Error("Duplicate campaign report days cannot be safely added together.");
    seen.add(row.date);
  }
}
export function aggregateGoogleCampaignMetrics(input: { rows: CampaignDailyMetrics[]; campaignId: string; currency: string; startDate: string; endDate: string }) {
  if (!isKnownCurrency(input.currency)) throw new Error("The campaign report currency is unknown.");
  if (input.rows.some(row => row.campaignId !== input.campaignId)) throw new Error("Google returned a different campaign than requested.");
  validateReportRows(input.rows, input.startDate, input.endDate);
  const total = (field: "costMicros" | "clicks" | "impressions" | "conversions" | "conversionsValue", integer: boolean): number | undefined => {
    let sum = 0;
    let missing = false;
    for (const row of input.rows) {
      const value = row[field];
      if (value === undefined) { missing = true; continue; }
      if (!Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) throw new Error(`Google returned missing or invalid ${field}.`);
      sum += value;
      if (!Number.isFinite(sum) || sum > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(sum))) throw new Error("The campaign report total is too large to represent safely.");
    }
    return missing ? undefined : sum;
  };
  const costMicros = total("costMicros", true)!;
  const value = total("conversionsValue", false);
  const conversionValueMinor = value === undefined ? undefined : Math.round(value * 10 ** fractionDigits(input.currency));
  if (conversionValueMinor !== undefined && !Number.isSafeInteger(conversionValueMinor)) throw new Error("The reported conversion value is too large.");
  return { spendMinor: microsToMinor(costMicros, input.currency), impressions: total("impressions", true)!, clicks: total("clicks", true)!, conversions: total("conversions", false), conversionValueMinor };
}
