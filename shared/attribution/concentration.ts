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
  /** Positive net billing revenue across all events, including unidentified customers. */
  totalPositiveMinor: number;
  identifiedCoverage: number | null;
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

  const customerByOrder = new Map<string, string>();
  for (const event of unique) {
    if (event.kind !== "refund" && event.orderRef && event.customerRef) {
      const key = `${event.source}\u0000${event.currency}\u0000${event.orderRef}`;
      if (!customerByOrder.has(key)) customerByOrder.set(key, event.customerRef);
    }
  }

  const netByCustomer = new Map<string, number>();
  let totalPositiveMinor = 0;
  for (const event of unique) {
    const net = netMinor(event);
    if (net > 0) totalPositiveMinor += net;
    const customerRef = event.customerRef ?? (event.kind === "refund" && event.orderRef
      ? customerByOrder.get(`${event.source}\u0000${event.currency}\u0000${event.orderRef}`)
      : undefined);
    const customer = customerRef ? `${event.source}\u0000${customerRef}` : undefined;
    if (customer) netByCustomer.set(customer, (netByCustomer.get(customer) ?? 0) + net);
  }

  const positive = [...netByCustomer.values()].filter((amount) => amount > 0).sort((a, b) => b - a);
  const identifiedPositiveMinor = positive.reduce((sum, amount) => sum + amount, 0);
  const identifiedCoverage = totalPositiveMinor > 0 ? identifiedPositiveMinor / totalPositiveMinor : null;
  return {
    currency: options.currency,
    fromMs: options.fromMs,
    toMs: options.toMs,
    eventCount: unique.length,
    customerCount: positive.length,
    identifiedPositiveMinor,
    totalPositiveMinor,
    identifiedCoverage,
    topCustomerShare: identifiedPositiveMinor > 0 ? positive[0] / identifiedPositiveMinor : null,
    topThreeCustomerShare: identifiedPositiveMinor > 0 ? positive.slice(0, 3).reduce((sum, amount) => sum + amount, 0) / identifiedPositiveMinor : null,
    duplicatesRemoved: duplicates,
    partial: options.partial ?? false,
  };
}
