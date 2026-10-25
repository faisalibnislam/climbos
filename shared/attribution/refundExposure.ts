import { dedupeRevenueEvents } from "./dedupe";
import type { RevenueEvent } from "./types";

export interface RefundExposure {
  currency: string;
  fromMs: number;
  toMs: number;
  paymentCount: number;
  explicitRefundEventCount: number;
  grossPaidMinor: number;
  refundsRecordedMinor: number;
  netPaidMinor: number;
  /** Same-window refund amount / gross payment amount; null when the window cannot support that ratio. */
  refundToGrossShare: number | null;
  ratioUnavailableReason?: "no_gross_payments" | "refunds_exceed_window_gross";
  duplicatesRemoved: number;
  partial: boolean;
}

/**
 * Descriptive refund exposure from billing records in one event-time window.
 * The amount ratio is not a customer refund probability or a causal diagnosis.
 * Standalone refunds can relate to payments outside the window; in that case a
 * ratio above 100% is deliberately reported as unavailable instead of capped.
 */
export function refundExposure(
  events: readonly RevenueEvent[],
  options: { currency: string; fromMs: number; toMs: number; partial?: boolean },
): RefundExposure | null {
  if (!Number.isFinite(options.fromMs) || !Number.isFinite(options.toMs) || options.fromMs > options.toMs) {
    throw new RangeError("Invalid refund exposure window");
  }
  const inWindow = events.filter((event) =>
    event.currency === options.currency && event.occurredAt >= options.fromMs && event.occurredAt <= options.toMs,
  );
  const { events: unique, duplicates } = dedupeRevenueEvents(inWindow);
  if (!unique.length) return null;

  let paymentCount = 0;
  let explicitRefundEventCount = 0;
  let grossPaidMinor = 0;
  let refundsRecordedMinor = 0;
  for (const event of unique) {
    if (!Number.isSafeInteger(event.amountMinor) || !Number.isSafeInteger(event.refundedMinor)) {
      throw new RangeError(`Event ${event.id}: amounts must be safe integer minor units`);
    }
    if (event.kind === "refund") {
      if (event.refundedMinor !== 0) throw new RangeError(`Event ${event.id}: a refund event cannot also carry embedded refunds`);
      explicitRefundEventCount++;
      refundsRecordedMinor += Math.abs(event.amountMinor);
      continue;
    }
    if (event.amountMinor < 0 || event.refundedMinor < 0 || event.refundedMinor > event.amountMinor) {
      throw new RangeError(`Event ${event.id}: payment and refund amounts are inconsistent`);
    }
    if (event.amountMinor > 0) paymentCount++;
    grossPaidMinor += event.amountMinor;
    refundsRecordedMinor += event.refundedMinor;
  }
  if (!Number.isSafeInteger(grossPaidMinor) || !Number.isSafeInteger(refundsRecordedMinor)) {
    throw new RangeError("Refund exposure totals exceed safe integer minor units");
  }
  const ratioUnavailableReason = grossPaidMinor === 0
    ? "no_gross_payments"
    : refundsRecordedMinor > grossPaidMinor
      ? "refunds_exceed_window_gross"
      : undefined;
  return {
    currency: options.currency,
    fromMs: options.fromMs,
    toMs: options.toMs,
    paymentCount,
    explicitRefundEventCount,
    grossPaidMinor,
    refundsRecordedMinor,
    netPaidMinor: grossPaidMinor - refundsRecordedMinor,
    refundToGrossShare: ratioUnavailableReason ? null : refundsRecordedMinor / grossPaidMinor,
    ...(ratioUnavailableReason ? { ratioUnavailableReason } : {}),
    duplicatesRemoved: duplicates,
    partial: options.partial ?? false,
  };
}
