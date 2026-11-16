import { reportDayInZone, validReportDay } from "../acquisition/campaignReport";
import { currencyExponent } from "../integrations/currency";

/** A bounded provider observation, not proof of delivery or a billing guarantee. */
export interface CampaignActivationObservation {
  provider: "google_ads" | "meta_ads";
  accountId: string;
  campaignId: string;
  currency: string;
  timeZone: string;
  status: string;
  kind: string;
  /** Google micros or Meta currency subunits, preserved without rounding. */
  budgetAmount: string;
  budgetPeriod?: string;
  budgetShared?: boolean;
  startDateTime?: string;
  endDateTime?: string;
}

export function campaignActivationProblem(c: {
  channel: string; externalId?: string; currency: string; dailyBudgetMinor?: number;
  budgetEnvelopeMinor?: number; startDate?: string; endDate?: string;
}, accountId: string, observed: CampaignActivationObservation, now: number): string | null {
  const google = c.channel === "google_search_ad";
  const expectedProvider = google ? "google_ads" : "meta_ads";
  const account = google ? accountId.replace(/-/g, "").trim() : accountId.replace(/^act_/, "").trim();
  if (observed.provider !== expectedProvider || observed.accountId !== account || observed.campaignId !== c.externalId) return "The provider campaign does not match the approved account and campaign. Review the connection.";
  if (observed.status !== "PAUSED") return "The provider does not report this campaign as paused. Check its current status before starting it.";
  if (observed.currency !== c.currency) return "The provider currency differs from the approved budget. Review the account and campaign.";
  let localDay: string;
  try {
    if (!observed.timeZone) throw new Error("Unknown timezone");
    localDay = reportDayInZone(now, observed.timeZone);
  } catch { return "The provider account timezone is unknown. Reconnect or check the ad account before starting."; }
  if (!c.startDate || !c.endDate || !validReportDay(c.startDate) || !validReportDay(c.endDate) || c.startDate > c.endDate || localDay > c.endDate) return "The approved campaign dates are missing or have ended in the ad account timezone.";
  if (!/^\d{1,30}$/.test(observed.budgetAmount)) return "The provider budget is missing or invalid. Check it before starting.";
  const approvedMinor = google ? c.dailyBudgetMinor : c.budgetEnvelopeMinor;
  if (!Number.isSafeInteger(approvedMinor) || approvedMinor! <= 0) return "The approved budget needs owner review.";
  const expected = BigInt(approvedMinor!) * (google ? 10n ** BigInt(6 - currencyExponent(c.currency)) : 1n);
  if (BigInt(observed.budgetAmount) !== expected) return google
    ? "The Google average daily budget differs from the approved amount. Restore the reviewed budget in Google or prepare a new campaign. ClimbOS has not changed it."
    : "The Meta campaign spend cap differs from the approved total. Restore the reviewed cap in Meta or prepare a new campaign. ClimbOS has not changed it.";
  if (google) {
    if (observed.kind !== "SEARCH" || observed.budgetPeriod !== "DAILY" || observed.budgetShared !== false) return "The Google campaign type or budget sharing/period differs from the supported approved setup.";
    if (observed.startDateTime !== `${c.startDate} 00:00:00` || observed.endDateTime !== `${c.endDate} 23:59:59`) return "The Google campaign dates differ from the approved account-local dates. Check them before starting.";
  } else {
    if (observed.kind !== "OUTCOME_TRAFFIC") return "The Meta campaign objective differs from the prepared traffic campaign. Review it before starting.";
    // Meta delivery dates live on ad sets; enabling the parent cannot authorize an early start.
    if (localDay < c.startDate) return "The approved start date has not arrived in the Meta account timezone. Review the ad-set schedule and start on or after that date.";
  }
  return null;
}
