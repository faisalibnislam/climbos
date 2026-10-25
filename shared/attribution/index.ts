/**
 * ClimbOS attribution: billing revenue is the source of truth; ad-platform
 * claims are reported separately and never summed into unique totals.
 */

export type { ConversionEvent, PlatformClaim, RevenueEvent, Touch } from "./types";
export {
  dedupeConversionEvents,
  dedupeRevenueEvents,
  revenueEventKey,
  type DedupeResult,
} from "./dedupe";
export {
  attribute,
  netMinor,
  selectTouch,
  type AttributeOptions,
  type AttributionModel,
  type AttributionResult,
  type ChannelTotals,
  type CurrencyAttribution,
  type FxRates,
  type ReportingTotals,
} from "./attribution";
export {
  ClaimsAggregationError,
  OVERLAP_WARNING,
  summarizePlatformClaims,
  totalRevenueFromClaims,
  type ClaimsSummary,
  type PlatformClaimSummary,
} from "./claims";
export { computeReturnMetrics, contribution, mediaBreakEvenRoas, roas, roi, type ReturnMetrics } from "./roi";
export { computeCohorts, subscriptionCohortBrief, type CohortPayment, type CohortRow } from "./cohorts";
export { customerConcentration, type CustomerConcentration } from "./concentration";
export { refundExposure, type RefundExposure } from "./refundExposure";
export { platformConcentration, type PlatformConcentration } from "./platformConcentration";
