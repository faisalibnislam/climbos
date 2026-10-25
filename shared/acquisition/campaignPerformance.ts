export interface CampaignPerformanceReviewInput {
  spendMinor: number;
  conversions: number;
  observedThrough: string;
  campaignStartDate: string;
  reviewAfterDays: number;
  targetCostPerConversionMinor?: number;
}

export type CampaignPerformanceReview =
  | { status: "not_due"; message: string }
  | { status: "target_needed"; message: string }
  | { status: "review"; message: string; observedCostPerConversionMinor: number | null }
  | { status: "within_target"; message: string; observedCostPerConversionMinor: number };

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Compare platform-reported results with the owner's predeclared review window
 * and cost-per-conversion limit. This produces advice only; it never pauses or
 * edits a campaign and does not claim incrementality or profit.
 */
export function reviewCampaignPerformance(input: CampaignPerformanceReviewInput): CampaignPerformanceReview {
  if (
    !ISO_DAY.test(input.campaignStartDate) ||
    !ISO_DAY.test(input.observedThrough) ||
    !Number.isSafeInteger(input.spendMinor) || input.spendMinor < 0 ||
    !Number.isFinite(input.conversions) || input.conversions < 0 ||
    !Number.isInteger(input.reviewAfterDays) || input.reviewAfterDays < 1
  ) {
    throw new Error("Campaign performance review inputs are invalid.");
  }

  const first = Date.parse(`${input.campaignStartDate}T00:00:00Z`);
  const last = Date.parse(`${input.observedThrough}T00:00:00Z`);
  if (last < first) throw new Error("Campaign performance review inputs are invalid.");
  const observedDays = Math.floor((last - first) / DAY_MS) + 1;
  if (observedDays < input.reviewAfterDays) {
    return { status: "not_due", message: `The owner's review point is ${input.reviewAfterDays} days; ${Math.max(0, observedDays)} day(s) are currently reported.` };
  }

  const target = input.targetCostPerConversionMinor;
  if (target === undefined || !Number.isSafeInteger(target) || target <= 0) {
    return { status: "target_needed", message: "Results are available, but there is no owner-set cost-per-conversion target to judge them against." };
  }

  if (input.conversions === 0) {
    if (input.spendMinor >= target) {
      return {
        status: "review",
        observedCostPerConversionMinor: null,
        message: "Reported spend has reached the owner's cost limit without a reported conversion. Review conversion tracking, audience, and offer; consider pausing if this was the agreed stop condition.",
      };
    }
    return {
      status: "not_due",
      message: "No conversions are reported yet, but spend is still below the owner's cost limit. Keep monitoring the agreed review window.",
    };
  }

  const observedCostPerConversionMinor = Math.round(input.spendMinor / input.conversions);
  if (observedCostPerConversionMinor > target) {
    return {
      status: "review",
      observedCostPerConversionMinor,
      message: "Reported cost per conversion is above the owner's target. Review measurement, audience, offer, and destination; consider revising or pausing before making further spend decisions.",
    };
  }
  return {
    status: "within_target",
    observedCostPerConversionMinor,
    message: "Reported cost per conversion is at or below the owner's target. This is a platform-reported efficiency signal, not proof of incremental customers or profit.",
  };
}

/** Meta reports many action types; only an owner-confirmed type becomes the campaign's conversion count. */
export function metaConversions(reportedActions: readonly { actionType: string; value: number }[] | undefined, confirmedType: string | null | undefined): number | undefined {
  if (!confirmedType) return undefined;
  const action = reportedActions?.find((a) => a.actionType === confirmedType);
  return action && Number.isFinite(action.value) && action.value >= 0 ? action.value : undefined;
}
