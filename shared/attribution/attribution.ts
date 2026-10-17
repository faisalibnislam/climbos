/**
 * Rule-based (last/first touch) attribution of billing revenue to channels.
 *
 * Assumptions:
 *  - Revenue comes only from billing/order events; platform claims are never used here.
 *  - A touch is eligible for an event when it belongs to the same customerRef,
 *    occurred at or before the event, and within `lookbackDays` of it.
 *  - Events with no eligible touch (or no customerRef) go to an explicit
 *    `unattributed` bucket; nothing is silently dropped or guessed.
 *  - A "refund" event with an orderRef matching a revenue event inherits that
 *    event's channel; otherwise it is attributed by its own timestamp.
 *  - Currencies are never mixed. Optional FX conversion uses caller-supplied,
 *    dated rates and reports any currency it could not convert.
 *  - Rule-based attribution describes paths, not causal impact.
 */

import { dedupeRevenueEvents } from "./dedupe";
import type { RevenueEvent, Touch } from "./types";

export type AttributionModel = "last_touch" | "first_touch";

export interface FxRates {
  /** Date the rates apply to, "YYYY-MM-DD". Required: undated rates are not accepted. */
  asOf: string;
  reportingCurrency: string;
  /**
   * Multiplier from one minor unit of the source currency to minor units of
   * the reporting currency (account for minor-unit exponent differences, e.g. JPY).
   */
  rates: Record<string, number>;
}

export interface AttributeOptions {
  model: AttributionModel;
  lookbackDays: number;
  fx?: FxRates;
}

export interface ChannelTotals {
  /** Net of refunds, integer minor units. */
  netRevenueMinor: number;
  /** Orders + subscription payments (refund events are not conversions). */
  conversions: number;
  refundMinor: number;
}

export interface CurrencyAttribution {
  currency: string;
  channels: Record<string, ChannelTotals>;
  unattributed: ChannelTotals & { eventIds: string[] };
  attributedNetMinor: number;
  /** Independently summed net billing revenue for this currency. */
  totalNetBillingMinor: number;
  /** attributed + unattributed === total (exact integer equality). */
  reconciled: boolean;
}

export interface ReportingTotals {
  currency: string;
  asOf: string;
  /** Rounded to integer minor units after conversion. */
  channels: Record<string, number>;
  unattributedMinor: number;
  totalNetMinor: number;
  convertedCurrencies: string[];
  /** Currencies left out of the reporting totals because no rate was supplied. */
  unconvertedCurrencies: string[];
}

export interface AttributionResult {
  model: AttributionModel;
  lookbackDays: number;
  byCurrency: Record<string, CurrencyAttribution>;
  /** True when every currency reconciles exactly. */
  reconciled: boolean;
  duplicatesRemoved: number;
  reporting: ReportingTotals | null;
  notes: string[];
}

const MS_PER_DAY = 86_400_000;

/** Net billing value of an event in integer minor units (refund events are negative). */
export function netMinor(e: RevenueEvent): number {
  if (!Number.isInteger(e.amountMinor) || !Number.isInteger(e.refundedMinor)) {
    throw new RangeError(`Event ${e.id}: amounts must be integer minor units`);
  }
  if (e.kind === "refund") return -Math.abs(e.amountMinor);
  return e.amountMinor - e.refundedMinor;
}

function emptyTotals(): ChannelTotals {
  return { netRevenueMinor: 0, conversions: 0, refundMinor: 0 };
}

/** Pick the eligible touch per the model. Ties keep the earliest-listed touch. */
export function selectTouch(
  touches: readonly Touch[],
  eventTime: number,
  model: AttributionModel,
  lookbackDays: number,
): Touch | null {
  const earliest = eventTime - lookbackDays * MS_PER_DAY;
  let chosen: Touch | null = null;
  for (const t of touches) {
    if (t.occurredAt > eventTime || t.occurredAt < earliest) continue;
    if (
      chosen === null ||
      (model === "last_touch" && t.occurredAt > chosen.occurredAt) ||
      (model === "first_touch" && t.occurredAt < chosen.occurredAt)
    ) {
      chosen = t;
    }
  }
  return chosen;
}

/**
 * Attribute deduped billing revenue to channels per currency, with an explicit
 * unattributed bucket and an exact reconciliation check against total net
 * billing revenue.
 */
export function attribute(
  events: readonly RevenueEvent[],
  touches: readonly Touch[],
  options: AttributeOptions,
): AttributionResult {
  if (!(options.lookbackDays >= 0)) throw new RangeError("lookbackDays must be ≥ 0");
  const { events: unique, duplicates } = dedupeRevenueEvents(events);

  const touchesByCustomer = new Map<string, Touch[]>();
  for (const t of touches) {
    const list = touchesByCustomer.get(t.customerRef) ?? [];
    list.push(t);
    touchesByCustomer.set(t.customerRef, list);
  }

  const channelFor = (e: RevenueEvent): string | null => {
    if (!e.customerRef) return null;
    const t = selectTouch(touchesByCustomer.get(e.customerRef) ?? [], e.occurredAt, options.model, options.lookbackDays);
    return t ? t.channel : null;
  };

  // Resolve channels for non-refund events first so refunds can inherit by orderRef.
  const channelByOrder = new Map<string, string | null>();
  const resolved = new Map<RevenueEvent, string | null>();
  for (const e of unique) {
    if (e.kind === "refund") continue;
    const ch = channelFor(e);
    resolved.set(e, ch);
    if (e.orderRef && !channelByOrder.has(`${e.currency}\u0000${e.orderRef}`)) {
      channelByOrder.set(`${e.currency}\u0000${e.orderRef}`, ch);
    }
  }
  for (const e of unique) {
    if (e.kind !== "refund") continue;
    const key = e.orderRef ? `${e.currency}\u0000${e.orderRef}` : null;
    resolved.set(e, key !== null && channelByOrder.has(key) ? (channelByOrder.get(key) ?? null) : channelFor(e));
  }

  const byCurrency: Record<string, CurrencyAttribution> = {};
  const totals: Record<string, number> = {};
  for (const e of unique) {
    const net = netMinor(e);
    totals[e.currency] = (totals[e.currency] ?? 0) + net;
    const bucket = (byCurrency[e.currency] ??= {
      currency: e.currency,
      channels: {},
      unattributed: { ...emptyTotals(), eventIds: [] },
      attributedNetMinor: 0,
      totalNetBillingMinor: 0,
      reconciled: false,
    });
    const ch = resolved.get(e) ?? null;
    const target: ChannelTotals = ch === null ? bucket.unattributed : (bucket.channels[ch] ??= emptyTotals());
    target.netRevenueMinor += net;
    if (e.kind === "refund") target.refundMinor += Math.abs(e.amountMinor);
    else {
      target.conversions += 1;
      target.refundMinor += e.refundedMinor;
    }
    if (ch === null) bucket.unattributed.eventIds.push(e.id);
  }

  let allReconciled = true;
  for (const c of Object.values(byCurrency)) {
    c.attributedNetMinor = Object.values(c.channels).reduce((s, t) => s + t.netRevenueMinor, 0);
    c.totalNetBillingMinor = totals[c.currency];
    c.reconciled =
      Number.isSafeInteger(c.totalNetBillingMinor) &&
      c.attributedNetMinor + c.unattributed.netRevenueMinor === c.totalNetBillingMinor;
    allReconciled &&= c.reconciled;
  }

  const notes = [
    `${options.model === "last_touch" ? "Last" : "First"}-touch attribution with a ${options.lookbackDays}-day lookback; describes conversion paths, not causal impact.`,
    "Revenue is from billing/order events only; ad-platform claims are reported separately.",
  ];
  if (duplicates > 0) notes.push(`${duplicates} duplicate revenue event(s) removed by (source, sourceEventId).`);
  const currencies = Object.keys(byCurrency).sort();
  if (currencies.length > 1 && !options.fx) {
    notes.push(`Multiple currencies (${currencies.join(", ")}) kept separate; supply dated FX rates to report a combined total.`);
  }

  let reporting: ReportingTotals | null = null;
  if (options.fx) {
    const fx = options.fx;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fx.asOf)) throw new RangeError("fx.asOf must be a YYYY-MM-DD date");
    const rateFor = (cur: string): number | undefined => (cur === fx.reportingCurrency ? 1 : fx.rates[cur]);
    const converted: string[] = [];
    const unconverted: string[] = [];
    const channels: Record<string, number> = {};
    let unattributedMinor = 0;
    let totalNetMinor = 0;
    for (const cur of currencies) {
      const rate = rateFor(cur);
      if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
        unconverted.push(cur);
        continue;
      }
      converted.push(cur);
      const c = byCurrency[cur];
      for (const [ch, t] of Object.entries(c.channels)) channels[ch] = (channels[ch] ?? 0) + Math.round(t.netRevenueMinor * rate);
      unattributedMinor += Math.round(c.unattributed.netRevenueMinor * rate);
      totalNetMinor += Math.round(c.totalNetBillingMinor * rate);
    }
    reporting = {
      currency: fx.reportingCurrency,
      asOf: fx.asOf,
      channels,
      unattributedMinor,
      totalNetMinor,
      convertedCurrencies: converted,
      unconvertedCurrencies: unconverted,
    };
    notes.push(`Reporting totals converted to ${fx.reportingCurrency} at rates as of ${fx.asOf}; rounding may differ from per-currency sums by a few minor units.`);
    if (unconverted.length) notes.push(`No FX rate for ${unconverted.join(", ")}; excluded from reporting totals and kept separate.`);
  }

  return {
    model: options.model,
    lookbackDays: options.lookbackDays,
    byCurrency,
    reconciled: allReconciled,
    duplicatesRemoved: duplicates,
    reporting,
    notes,
  };
}
