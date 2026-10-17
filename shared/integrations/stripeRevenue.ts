/**
 * Stripe read-only revenue import with a restricted key (rk_live_/rk_test_).
 * Lists charges / invoices / refunds created since a cursor and normalizes them
 * to ImportedRevenueEvent.
 *
 * Double-count rules (match shared/attribution):
 *  - Use EITHER charges OR paid invoices as the gross source, never both.
 *  - Charges carry refundedMinor; separate "refund" events are only emitted for
 *    refunds whose charge is not part of this import batch.
 */

import { asArray, asNumber, asString, collectPages, isRecord, readFailure, requestJson } from "./http";
import { STRIPE_API_VERSION, STRIPE_BASE } from "./registry";
import type { AdapterOptions, ImportedRevenueEvent, PaginationResult, ReadResult } from "./types";

export type StripeKeyKind = "restricted" | "secret" | "publishable" | "unknown";

export function classifyStripeKey(key: string): StripeKeyKind {
  if (/^rk_(live|test)_[A-Za-z0-9]+$/.test(key)) return "restricted";
  if (/^sk_(live|test)_/.test(key)) return "secret";
  if (/^pk_(live|test)_/.test(key)) return "publishable";
  return "unknown";
}

export interface StripeCall extends AdapterOptions {
  restrictedKey: string;
  /** Connected account id (acct_…) when using Connect. */
  stripeAccount?: string;
}

function headers(call: StripeCall): Record<string, string> {
  const kind = classifyStripeKey(call.restrictedKey);
  if (kind !== "restricted") throw new Error("Stripe import requires a read-only restricted key (rk_live_… or rk_test_…)");
  const h: Record<string, string> = { Authorization: `Bearer ${call.restrictedKey}`, "Stripe-Version": STRIPE_API_VERSION };
  if (call.stripeAccount) h["Stripe-Account"] = call.stripeAccount;
  return h;
}

export type StripeResource = "charges" | "invoices" | "refunds";

/** List objects created at or after `createdGte` (unix seconds), newest first, bounded pages. */
export async function listSince(
  call: StripeCall & { resource: StripeResource; createdGte: number; maxPages?: number; startingAfter?: string },
): Promise<ReadResult<PaginationResult<Record<string, unknown>>>> {
  if (!Number.isInteger(call.createdGte) || call.createdGte < 0) return { ok: false, providerMessage: "createdGte must be unix seconds", retryable: false };
  let h: Record<string, string>;
  try {
    h = headers(call);
  } catch (err) {
    return { ok: false, providerMessage: err instanceof Error ? err.message : String(err), retryable: false };
  }
  return collectPages<Record<string, unknown>>(
    async (cursor) => {
      const url = new URL(`${STRIPE_BASE}/${call.resource}`);
      url.searchParams.set("created[gte]", String(call.createdGte));
      url.searchParams.set("limit", "100");
      if (call.resource === "invoices") url.searchParams.set("status", "paid");
      if (cursor) url.searchParams.set("starting_after", cursor);
      const out = await requestJson({ url: url.toString(), headers: h, fetchImpl: call.fetchImpl, timeoutMs: call.timeoutMs });
      if (out.kind !== "ok") return readFailure(out);
      const d = isRecord(out.data) ? out.data : {};
      const items = asArray(d.data).filter(isRecord);
      const last = items[items.length - 1];
      return { ok: true, data: { items, nextCursor: d.has_more === true && last ? asString(last.id) : undefined } };
    },
    { maxPages: call.maxPages ?? 50, startCursor: call.startingAfter },
  );
}

function idOf(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (isRecord(v)) return asString(v.id);
  return undefined;
}

function withRefs(base: Omit<ImportedRevenueEvent, "customerRef" | "orderRef">, customerRef?: string, orderRef?: string): ImportedRevenueEvent {
  const ev: ImportedRevenueEvent = { ...base };
  if (customerRef) ev.customerRef = customerRef;
  if (orderRef) ev.orderRef = orderRef;
  return ev;
}

function metaOrder(obj: Record<string, unknown>): string | undefined {
  const md = isRecord(obj.metadata) ? obj.metadata : {};
  return asString(md.order_id) ?? asString(md.orderId);
}

/** Succeeded, paid charges only. */
export function normalizeCharge(c: Record<string, unknown>): ImportedRevenueEvent | undefined {
  if (c.object !== "charge" || c.paid !== true || asString(c.status) !== "succeeded") return undefined;
  const id = asString(c.id);
  const currency = asString(c.currency);
  if (!id || !currency) return undefined;
  return withRefs(
    {
      sourceEventId: id,
      source: "stripe",
      occurredAt: asNumber(c.created) * 1000,
      currency: currency.toUpperCase(),
      amountMinor: Math.trunc(asNumber(c.amount)),
      refundedMinor: Math.trunc(asNumber(c.amount_refunded)),
      kind: "order",
    },
    idOf(c.customer),
    metaOrder(c) ?? idOf(c.payment_intent),
  );
}

/** Paid invoices → subscription payments (use instead of charges, not with them). */
export function normalizeInvoice(inv: Record<string, unknown>): ImportedRevenueEvent | undefined {
  if (inv.object !== "invoice" || asString(inv.status) !== "paid") return undefined;
  const id = asString(inv.id);
  const currency = asString(inv.currency);
  if (!id || !currency) return undefined;
  const transitions = isRecord(inv.status_transitions) ? inv.status_transitions : {};
  const paidAt = asNumber(transitions.paid_at) || asNumber(inv.created);
  return withRefs(
    {
      sourceEventId: id,
      source: "stripe",
      occurredAt: paidAt * 1000,
      currency: currency.toUpperCase(),
      amountMinor: Math.trunc(asNumber(inv.amount_paid)),
      refundedMinor: 0,
      kind: "subscription_payment",
    },
    idOf(inv.customer),
    metaOrder(inv) ?? asString(inv.number),
  );
}

export function normalizeRefund(r: Record<string, unknown>): ImportedRevenueEvent | undefined {
  if (r.object !== "refund" || asString(r.status) !== "succeeded") return undefined;
  const id = asString(r.id);
  const currency = asString(r.currency);
  if (!id || !currency) return undefined;
  return withRefs(
    {
      sourceEventId: id,
      source: "stripe",
      occurredAt: asNumber(r.created) * 1000,
      currency: currency.toUpperCase(),
      amountMinor: Math.abs(Math.trunc(asNumber(r.amount))),
      refundedMinor: 0,
      kind: "refund",
    },
    undefined,
    metaOrder(r) ?? idOf(r.charge),
  );
}

export interface StripeImportResult {
  events: ImportedRevenueEvent[];
  /** Next created[gte] cursor (unix seconds). Boundary duplicates are removed by sourceEventId dedupe. */
  nextCreatedGte: number;
  truncated: boolean;
  /** When truncated, pass back as `resume` to continue paging older objects. */
  resume?: { chargesOrInvoicesStartingAfter?: string; refundsStartingAfter?: string; highWaterCreated: number };
  skipped: number;
}

export async function importStripeRevenue(
  call: StripeCall & {
    createdGte: number;
    grossSource?: "charges" | "invoices";
    maxPages?: number;
    resume?: StripeImportResult["resume"];
  },
): Promise<ReadResult<StripeImportResult>> {
  const grossSource = call.grossSource ?? "charges";
  const grossDone = call.resume !== undefined && call.resume.chargesOrInvoicesStartingAfter === undefined;
  const refundsDone = call.resume !== undefined && call.resume.refundsStartingAfter === undefined;
  const empty: ReadResult<PaginationResult<Record<string, unknown>>> = { ok: true, data: { items: [], pages: 0, truncated: false } };
  const gross = grossDone ? empty : await listSince({ ...call, resource: grossSource, startingAfter: call.resume?.chargesOrInvoicesStartingAfter });
  if (!gross.ok) return gross;
  const refunds = refundsDone ? empty : await listSince({ ...call, resource: "refunds", startingAfter: call.resume?.refundsStartingAfter });
  if (!refunds.ok) return refunds;

  const events: ImportedRevenueEvent[] = [];
  let skipped = 0;
  let maxCreated = Math.max(call.createdGte, call.resume?.highWaterCreated ?? 0);
  const chargeIds = new Set<string>();
  for (const obj of gross.data.items) {
    maxCreated = Math.max(maxCreated, asNumber(obj.created));
    const ev = grossSource === "charges" ? normalizeCharge(obj) : normalizeInvoice(obj);
    if (!ev) {
      skipped++;
      continue;
    }
    if (grossSource === "charges") chargeIds.add(ev.sourceEventId);
    events.push(ev);
  }
  for (const r of refunds.data.items) {
    maxCreated = Math.max(maxCreated, asNumber(r.created));
    const chargeId = idOf(r.charge);
    // Refund already reflected in that charge's refundedMinor.
    if (grossSource === "charges" && chargeId && chargeIds.has(chargeId)) continue;
    const ev = normalizeRefund(r);
    if (ev) events.push(ev);
    else skipped++;
  }
  const truncated = gross.data.truncated || refunds.data.truncated;
  const result: StripeImportResult = { events, nextCreatedGte: maxCreated, truncated, skipped };
  if (truncated) {
    // Keep the old cursor until every older page has been read; continue with `resume`.
    result.nextCreatedGte = call.createdGte;
    result.resume = { highWaterCreated: maxCreated };
    if (gross.data.truncated) result.resume.chargesOrInvoicesStartingAfter = gross.data.nextCursor;
    if (refunds.data.truncated) result.resume.refundsStartingAfter = refunds.data.nextCursor;
  }
  return { ok: true, data: result };
}
