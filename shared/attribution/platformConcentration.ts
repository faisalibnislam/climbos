import { netMinor } from "./attribution";
import { dedupeRevenueEvents } from "./dedupe";
import type { RevenueEvent } from "./types";

const PLATFORM_BY_SOURCE: Record<string, string> = {
  google: "Google",
  googleads: "Google",
  adwords: "Google",
  facebook: "Meta",
  meta: "Meta",
  instagram: "Meta",
  fb: "Meta",
  ig: "Meta",
  tiktok: "TikTok",
  tiktokads: "TikTok",
  linkedin: "LinkedIn",
  linkedinads: "LinkedIn",
  amazon: "Amazon",
  amazonads: "Amazon",
  pinterest: "Pinterest",
  youtube: "YouTube",
  bing: "Microsoft",
  microsoftads: "Microsoft",
  email: "Email",
  newsletter: "Email",
};

function platformLabel(source: string | undefined, medium: string | undefined): string | null {
  const normalized = source?.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "") ?? "";
  const platform = PLATFORM_BY_SOURCE[normalized];
  if (!platform) return null;
  const normalizedMedium = medium?.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "") ?? "";
  if (["cpc", "ppc", "paid", "paidsocial", "paidsearch", "display"].includes(normalizedMedium)) return `${platform} ads`;
  if (normalizedMedium === "organic") return `${platform} organic`;
  return `${platform} tagged`;
}

export interface PlatformConcentration {
  currency: string;
  fromMs: number;
  toMs: number;
  eventCount: number;
  attributedConversions: number;
  totalConversions: number;
  attributedPositiveNetMinor: number;
  /** Tracked billing outcomes by recognized UTM source; descriptive, not causal or profitable by itself. */
  sources: {
    source: string;
    paymentEvents: number;
    identifiedCustomers: number;
    /** Customers whose first positive payment in the loaded billing history fell in this window, assigned to the tracked path. */
    firstRecordedCustomers: number;
    netRevenueMinor: number;
    refundMinor: number;
    mediaSpendStatus?: "matched" | "not_reported" | "currency_mismatch" | "partial";
    mediaSpendOrigin?: "owner_reported" | "platform_reported" | "mixed" | "unknown";
    adSpendMinor?: number;
    mediaRoas?: number | null;
    /** Net billing × supplied gross margin minus reported media spend; a modeled proxy, not causal profit. */
    modeledContributionAfterMediaSpendMinor?: number;
  }[];
  topSource: string | null;
  topSourceShare: number | null;
  topThreeShare: number | null;
  duplicatesRemoved: number;
  partial: boolean;
  spendPartial: boolean;
}

export interface ReportedAdSpend {
  platform: string;
  date: string;
  currency: string;
  spendMinor: number;
  origin?: "owner_reported" | "platform_reported";
}

/**
 * Summarize positive net billing revenue attributed to a bounded set of known
 * UTM platforms. This is a tracked last-touch path signal, not causal impact or
 * a complete inventory of the business's platform dependence.
 */
export function platformConcentration(
  input: readonly RevenueEvent[],
  options: { currency: string; fromMs: number; toMs: number; partial?: boolean; reportedSpend?: readonly ReportedAdSpend[]; spendPartial?: boolean; grossMargin?: number },
): PlatformConcentration | null {
  if (options.grossMargin !== undefined && (!Number.isFinite(options.grossMargin) || options.grossMargin < 0 || options.grossMargin > 1)) {
    throw new RangeError("Gross margin must be a share between 0 and 1");
  }
  const { events, duplicates } = dedupeRevenueEvents(input.filter(
    (event) => event.currency === options.currency && event.occurredAt >= options.fromMs && event.occurredAt <= options.toMs,
  ));
  if (!events.length) return null;

  // Use earlier imported billing history to keep renewals from looking like new customers.
  // This is still "first recorded" in ClimbOS data, not a verified lifetime acquisition record.
  const history = dedupeRevenueEvents(input.filter((event) => event.currency === options.currency && event.occurredAt <= options.toMs)).events;
  const ordered = [...history].sort((a, b) => a.occurredAt - b.occurredAt || a.id.localeCompare(b.id));
  const lastTouch = new Map<string, { occurredAt: number; label: string }>();
  const channelByOrder = new Map<string, string>();
  const revenueBySource = new Map<string, number>();
  const outcomesBySource = new Map<string, { paymentEvents: number; customers: Set<string>; firstRecordedCustomers: number; netRevenueMinor: number; refundMinor: number }>();
  const firstPaidCustomerKeys = new Set<string>();
  const uncertainFirstPaidCustomerKeys = new Set<string>();
  let historyIncomplete = false;
  let attributedConversions = 0;
  let totalConversions = 0;
  const touchKey = (event: RevenueEvent) => event.customerRef ? `${event.source}\u0000${event.customerRef}` : null;
  const orderKey = (event: RevenueEvent) => event.orderRef ? `${event.source}\u0000${event.currency}\u0000${event.orderRef}` : null;

  for (const event of ordered) {
    const key = touchKey(event);
    const directLabel = event.kind === "refund" ? null : platformLabel(event.utmSource, event.utmMedium);
    // Revenue imports represent a purchase touch one millisecond before charge time.
    if (key && directLabel) lastTouch.set(key, { occurredAt: event.occurredAt - 1, label: directLabel });
    const priorTouch = key ? lastTouch.get(key) : undefined;
    const eligibleTouch = priorTouch && priorTouch.occurredAt <= event.occurredAt && event.occurredAt - priorTouch.occurredAt <= 30 * 86_400_000
      ? priorTouch.label
      : null;
    const order = orderKey(event);
    const source = event.kind === "refund"
      ? (order ? channelByOrder.get(order) : undefined) ?? eligibleTouch
      : directLabel ?? eligibleTouch;
    const inWindow = event.occurredAt >= options.fromMs && event.occurredAt <= options.toMs;
    const validMinorAmounts = Number.isSafeInteger(event.amountMinor) && Number.isSafeInteger(event.refundedMinor);
    const invalidPayment = event.kind !== "refund" && (event.amountMinor < 0 || event.refundedMinor < 0 || event.refundedMinor > event.amountMinor);
    const invalidRefund = event.kind === "refund" && event.refundedMinor !== 0;
    if (!validMinorAmounts || invalidPayment || invalidRefund) {
      if (inWindow) throw new RangeError(`Event ${event.id}: billing amounts are invalid`);
      historyIncomplete = true;
      if (event.customerRef) uncertainFirstPaidCustomerKeys.add(`${event.source}\u0000${event.customerRef}`);
      continue;
    }
    const net = netMinor(event);

    if (event.kind === "refund") {
      if (inWindow && source) {
        revenueBySource.set(source, (revenueBySource.get(source) ?? 0) + net);
        const outcome = outcomesBySource.get(source) ?? { paymentEvents: 0, customers: new Set<string>(), firstRecordedCustomers: 0, netRevenueMinor: 0, refundMinor: 0 };
        outcome.netRevenueMinor += net;
        outcome.refundMinor += Math.abs(event.amountMinor);
        outcomesBySource.set(source, outcome);
      }
      continue;
    }

    if (order && source && !channelByOrder.has(order)) channelByOrder.set(order, source);
    const customer = event.customerRef ? `${event.source}\u0000${event.customerRef}` : null;
    const firstRecordedPayment = event.amountMinor > 0 && customer !== null && !firstPaidCustomerKeys.has(customer) && !uncertainFirstPaidCustomerKeys.has(customer);
    if (event.amountMinor > 0 && customer) firstPaidCustomerKeys.add(customer);
    if (!inWindow) continue;
    totalConversions++;
    if (source) {
      attributedConversions++;
      revenueBySource.set(source, (revenueBySource.get(source) ?? 0) + net);
      const outcome = outcomesBySource.get(source) ?? { paymentEvents: 0, customers: new Set<string>(), firstRecordedCustomers: 0, netRevenueMinor: 0, refundMinor: 0 };
      outcome.paymentEvents++;
      if (customer) outcome.customers.add(customer);
      if (firstRecordedPayment) outcome.firstRecordedCustomers++;
      outcome.netRevenueMinor += net;
      outcome.refundMinor += event.refundedMinor;
      outcomesBySource.set(source, outcome);
    }
  }

  const ranked = [...revenueBySource.entries()]
    .map(([source, net]) => ({ source, net }))
    .filter((row) => row.net > 0)
    .sort((a, b) => b.net - a.net || a.source.localeCompare(b.source));
  const attributedPositiveNetMinor = ranked.reduce((sum, row) => sum + row.net, 0);
  const sourcePlatform: Record<string, string> = { "Google ads": "google_ads", "Meta ads": "meta_ads" };
  const fromDay = new Date(options.fromMs).toISOString().slice(0, 10);
  const toDay = new Date(options.toMs).toISOString().slice(0, 10);
  const spendByPlatform = new Map<string, { currencies: Set<string>; spendByCurrency: Map<string, number>; origins: Set<string> }>();
  for (const spend of options.reportedSpend ?? []) {
    if (spend.date < fromDay || spend.date > toDay) continue;
    if (!Number.isSafeInteger(spend.spendMinor) || spend.spendMinor < 0) throw new RangeError("Reported ad spend must use nonnegative safe integer minor units");
    const aggregate = spendByPlatform.get(spend.platform) ?? { currencies: new Set<string>(), spendByCurrency: new Map<string, number>(), origins: new Set<string>() };
    aggregate.currencies.add(spend.currency.toUpperCase());
    aggregate.spendByCurrency.set(spend.currency.toUpperCase(), (aggregate.spendByCurrency.get(spend.currency.toUpperCase()) ?? 0) + spend.spendMinor);
    aggregate.origins.add(spend.origin ?? "unknown");
    spendByPlatform.set(spend.platform, aggregate);
  }
  return {
    currency: options.currency,
    fromMs: options.fromMs,
    toMs: options.toMs,
    eventCount: events.length,
    attributedConversions,
    totalConversions,
    attributedPositiveNetMinor,
    sources: [...outcomesBySource.entries()]
      .map(([source, outcome]) => {
        const platform = sourcePlatform[source];
        if (!platform) return {
          source,
          paymentEvents: outcome.paymentEvents,
          identifiedCustomers: outcome.customers.size,
          firstRecordedCustomers: outcome.firstRecordedCustomers,
          netRevenueMinor: outcome.netRevenueMinor,
          refundMinor: outcome.refundMinor,
        };
        const spend = spendByPlatform.get(platform);
        if (options.spendPartial) return { source, paymentEvents: outcome.paymentEvents, identifiedCustomers: outcome.customers.size, firstRecordedCustomers: outcome.firstRecordedCustomers, netRevenueMinor: outcome.netRevenueMinor, refundMinor: outcome.refundMinor, mediaSpendStatus: "partial" as const };
        if (!spend) return { source, paymentEvents: outcome.paymentEvents, identifiedCustomers: outcome.customers.size, firstRecordedCustomers: outcome.firstRecordedCustomers, netRevenueMinor: outcome.netRevenueMinor, refundMinor: outcome.refundMinor, mediaSpendStatus: "not_reported" as const };
        const mediaSpend = spend.spendByCurrency.get(options.currency.toUpperCase());
        if (spend.currencies.size !== 1 || mediaSpend === undefined) return { source, paymentEvents: outcome.paymentEvents, identifiedCustomers: outcome.customers.size, firstRecordedCustomers: outcome.firstRecordedCustomers, netRevenueMinor: outcome.netRevenueMinor, refundMinor: outcome.refundMinor, mediaSpendStatus: "currency_mismatch" as const };
        if (!Number.isSafeInteger(mediaSpend)) throw new RangeError("Reported ad spend total exceeds safe integer minor units");
        return {
          source,
          paymentEvents: outcome.paymentEvents,
          identifiedCustomers: outcome.customers.size,
          firstRecordedCustomers: outcome.firstRecordedCustomers,
          netRevenueMinor: outcome.netRevenueMinor,
          refundMinor: outcome.refundMinor,
          mediaSpendStatus: "matched" as const,
          mediaSpendOrigin: spend.origins.size === 1 ? [...spend.origins][0] as "owner_reported" | "platform_reported" | "unknown" : "mixed" as const,
          adSpendMinor: mediaSpend,
          mediaRoas: mediaSpend > 0 ? outcome.netRevenueMinor / mediaSpend : null,
          ...(options.grossMargin !== undefined ? { modeledContributionAfterMediaSpendMinor: Math.round(outcome.netRevenueMinor * options.grossMargin) - mediaSpend } : {}),
        };
      })
      .sort((a, b) => b.netRevenueMinor - a.netRevenueMinor || a.source.localeCompare(b.source)),
    topSource: ranked[0]?.source ?? null,
    topSourceShare: attributedPositiveNetMinor ? (ranked[0]?.net ?? 0) / attributedPositiveNetMinor : null,
    topThreeShare: attributedPositiveNetMinor
      ? ranked.slice(0, 3).reduce((sum, row) => sum + row.net, 0) / attributedPositiveNetMinor
      : null,
    duplicatesRemoved: duplicates,
    partial: Boolean(options.partial || historyIncomplete),
    spendPartial: options.spendPartial ?? false,
  };
}
