import { dedupeRevenueEvents } from "./dedupe";
import { netMinor } from "./attribution";
import type { RevenueEvent } from "./types";

export interface CustomerConcentration {
  currency: string;
  fromMs: number;
  toMs: number;
  eventCount: number;
  customerCount: number;
  /** Positive net revenue from identified customers, in integer minor units. */
  identifiedPositiveMinor: number;
  /** Sum of positive event amounts after embedded refunds, before separate refund rows. */
  totalPositiveMinor: number;
  /** Same positive-event basis as totalPositiveMinor; separate refunds do not change identity coverage. */
  identifiedBillingPositiveMinor: number;
  identifiedCoverage: number | null;
  conflictingOrderCount: number;
  unresolvedRefundCount: number;
  topCustomerShare: number | null;
  topThreeCustomerShare: number | null;
  duplicatesRemoved: number;
  /** True when the caller's bounded event read may have omitted older rows in the window. */
  partial: boolean;
}

/**
 * Descriptive customer concentration from billing events. Shares are based on
 * positive net revenue by identified customer, not forecast or causal impact.
 * Customer and order references are scoped to their billing source because
 * provider IDs are not globally unique. Refunds inherit identity from a
 * matching source + currency + orderRef when the refund row has no customerRef.
 */
export function customerConcentration(
  events: readonly RevenueEvent[],
  options: { currency: string; fromMs: number; toMs: number; partial?: boolean },
): CustomerConcentration | null {
  if (!Number.isFinite(options.fromMs) || !Number.isFinite(options.toMs) || options.fromMs > options.toMs) {
    throw new RangeError("Invalid concentration window");
  }
  const inWindow = events.filter(
    (event) => event.currency === options.currency && event.occurredAt >= options.fromMs && event.occurredAt <= options.toMs,
  );
  const { events: unique, duplicates } = dedupeRevenueEvents(inWindow);
  if (!unique.length) return null;

  const checked = (amount: number) => {
    if (!Number.isSafeInteger(amount)) throw new RangeError("Customer concentration exceeds safe minor-unit arithmetic");
    return amount;
  };
  const present = (ref?: string) => ref?.trim() ? ref : undefined;
  const orderKey = (event: RevenueEvent) => present(event.orderRef) ? JSON.stringify([event.source, event.currency, event.orderRef]) : null;
  const customerByOrder = new Map<string, string>();
  const conflictingOrders = new Set<string>();
  for (const event of unique) {
    if (!Number.isSafeInteger(event.amountMinor) || !Number.isSafeInteger(event.refundedMinor) || event.refundedMinor < 0 || (event.kind === "refund" ? event.refundedMinor !== 0 : event.amountMinor < 0 || event.refundedMinor > event.amountMinor)) throw new RangeError("Invalid customer concentration amount");
    const key = orderKey(event), customer = present(event.customerRef);
    // Refund identity is also evidence of a conflict; never let input order choose a winner.
    if (key && customer) {
      const previous = customerByOrder.get(key);
      if (previous && previous !== customer) conflictingOrders.add(key);
      customerByOrder.set(key, customer);
    }
  }

  const netByCustomer = new Map<string, number>();
  let totalPositiveMinor = 0, identifiedBillingPositiveMinor = 0, unresolvedRefundCount = 0;
  for (const event of unique) {
    const net = checked(netMinor(event));
    const key = orderKey(event);
    const conflicted = key !== null && conflictingOrders.has(key);
    const customerRef = event.kind === "refund" && conflicted ? undefined : present(event.customerRef) ?? (event.kind === "refund" && key ? customerByOrder.get(key) : undefined);
    if (net > 0) {
      totalPositiveMinor = checked(totalPositiveMinor + net);
      if (customerRef) identifiedBillingPositiveMinor = checked(identifiedBillingPositiveMinor + net);
    }
    if (event.kind === "refund" && net !== 0 && !customerRef) unresolvedRefundCount++;
    const customer = customerRef ? JSON.stringify([event.source, customerRef]) : undefined;
    if (customer) netByCustomer.set(customer, checked((netByCustomer.get(customer) ?? 0) + net));
  }

  const positive = [...netByCustomer.values()].filter((amount) => amount > 0).sort((a, b) => b - a);
  const identifiedPositiveMinor = positive.reduce((sum, amount) => checked(sum + amount), 0);
  const identifiedCoverage = totalPositiveMinor > 0 ? identifiedBillingPositiveMinor / totalPositiveMinor : null;
  return {
    currency: options.currency,
    fromMs: options.fromMs,
    toMs: options.toMs,
    eventCount: unique.length,
    customerCount: positive.length,
    identifiedPositiveMinor,
    totalPositiveMinor,
    identifiedBillingPositiveMinor, identifiedCoverage,
    conflictingOrderCount: conflictingOrders.size, unresolvedRefundCount,
    topCustomerShare: identifiedPositiveMinor > 0 && !conflictingOrders.size && !unresolvedRefundCount ? positive[0] / identifiedPositiveMinor : null,
    topThreeCustomerShare: identifiedPositiveMinor > 0 && !conflictingOrders.size && !unresolvedRefundCount ? positive.slice(0, 3).reduce((sum, amount) => sum + amount, 0) / identifiedPositiveMinor : null,
    duplicatesRemoved: duplicates,
    partial: options.partial ?? false,
  };
}
