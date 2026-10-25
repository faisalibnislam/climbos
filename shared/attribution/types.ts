/**
 * Attribution domain types. Revenue truth comes from billing/order events
 * (RevenueEvent). Ad-platform claims (PlatformClaim) are kept separately and
 * are never summed into unique revenue totals.
 */

export interface RevenueEvent {
  /** Internal id. */
  id: string;
  /** Id assigned by the source system; (source, sourceEventId) is the dedupe key. */
  sourceEventId: string;
  /** Billing/order system, e.g. "stripe", "polar", "shopify". */
  source: string;
  /** Epoch milliseconds. */
  occurredAt: number;
  customerRef?: string;
  orderRef?: string;
  /** Acquisition tags carried on the billing event, when available. */
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** ISO 4217 code. */
  currency: string;
  /**
   * Integer minor units. For "order"/"subscription_payment": gross charged.
   * For "refund": the refunded magnitude (sign is ignored; always subtracted).
   */
  amountMinor: number;
  /**
   * Integer minor units already refunded against THIS event. Do not also emit
   * a separate "refund" event for the same money.
   */
  refundedMinor: number;
  kind: "order" | "subscription_payment" | "refund";
}

export interface Touch {
  customerRef: string;
  /** Billing/source system that owns the customer reference; omitted only on legacy touches. */
  source?: string;
  /** Epoch milliseconds. */
  occurredAt: number;
  channel: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  clickId?: string;
}

export interface PlatformClaim {
  platform: "google_ads" | "meta_ads" | (string & {});
  /** "YYYY-MM-DD" as reported by the platform. */
  date: string;
  conversions: number;
  conversionValueMinor: number;
  currency: string;
}

/** A browser- or server-side conversion event (e.g. pixel + Conversions API) sharing an eventId. */
export interface ConversionEvent {
  eventId: string;
  origin: "browser" | "server";
  occurredAt: number;
  name?: string;
  customerRef?: string;
  valueMinor?: number;
  currency?: string;
}
