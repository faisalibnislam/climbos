/**
 * Monthly customer cohorts from billing events. A customer's cohort is the
 * UTC month of their first recorded positive charge before refunds; month k
 * measures recorded charge activity, not contractual or revenue retention.
 * Later months are only reported once they are complete: months that haven't
 * finished yet are `null` (not zero), so a young cohort never looks like it
 * churned. Month 0 is always shown (it is 100% by definition).
 */

export interface CohortPayment {
  /** Provider namespace for customerRef; optional only for legacy callers. */
  source?: string;
  sourceEventId?: string;
  customerRef?: string;
  orderRef?: string;
  occurredAt: number;
  amountMinor: number;
  refundedMinor: number;
  kind: "order" | "subscription_payment" | "refund";
  currency: string;
}

export interface CohortRow {
  cohort: string; // YYYY-MM (UTC)
  size: number;
  /** Customers paying in month k (index 0 = first month). null = month not complete yet. */
  activeCustomers: (number | null)[];
  /** activeCustomers[k] / size. */
  retention: (number | null)[];
  /** Net revenue from the cohort in month k, minor units. */
  revenueMinor: (number | null)[];
}

export interface CohortAssessment {
  rows: CohortRow[];
  issue: string | null;
}

/** Compact, evidence-labeled subscription cohort context for growth planning. */
export function subscriptionCohortBrief(
  assessment: CohortAssessment,
  options: { currency: string; hasCustomerIds: boolean },
): string {
  const currency = options.currency.toUpperCase();
  if (assessment.issue) return `OBSERVED SUBSCRIPTION COHORTS: unavailable for ${currency}; ${assessment.issue} Do not infer retention, churn or expansion from this history.`;
  const { rows } = assessment;
  if (!options.hasCustomerIds) {
    return `OBSERVED SUBSCRIPTION COHORTS: unavailable for ${currency}; loaded billing events do not include customer IDs. Do not infer subscription retention, churn, or expansion from aggregate revenue.`;
  }
  if (!rows.length) {
    return `OBSERVED SUBSCRIPTION COHORTS: no same-currency subscription-payment cohorts could be calculated for ${currency}; treat retention as unknown.`;
  }
  const recent = rows.slice(-6);
  const observations = recent.map((row) => {
    const months = row.activeCustomers.slice(1, 6).map((count, index) => {
      const offset = index + 1;
      if (count === null) return `M${offset} incomplete`;
      const rate = row.retention[offset];
      return `M${offset} ${count}/${row.size}${rate === null ? "" : ` (${(rate * 100).toFixed(1)}%)`}`;
    });
    return `${row.cohort}: ${row.size} first-recorded subscription payers; ${months.join(", ") || "no completed follow-up month"}`;
  });
  return [
    `OBSERVED SUBSCRIPTION PAYMENT COHORTS (${currency}; latest six cohorts from the loaded billing-event history): ${observations.join("; ")}.`,
    "Each cohort starts at the first recorded positive subscription charge before refunds, in UTC. A refund does not reset entry or erase recorded charge activity. Customer IDs are separate per billing source. This is observed payer retention, not contractual churn, gross/net revenue retention, a forecast, or causal evidence. Import completeness is unknown: zero means no recorded charge, not verified churn. Incomplete follow-up months are omitted, not zero; the first month may still be in progress. Annual or irregular payment schedules cannot be judged as monthly churn.",
  ].join(" ");
}

function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}

function monthIndex(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function computeCohorts(
  payments: readonly CohortPayment[],
  options: { currency: string; nowMs: number; maxMonths?: number; truncated?: boolean },
): CohortAssessment {
  const unavailable = (issue: string): CohortAssessment => ({ rows: [], issue });
  if (options.truncated) return unavailable("Billing history exceeds the read limit; the first recorded charge and follow-up cannot be established from this slice.");
  const maxMonths = options.maxMonths ?? 12;
  if (!Number.isSafeInteger(options.nowMs) || options.nowMs < 0 || options.nowMs > 8.64e15 || !Number.isInteger(maxMonths) || maxMonths < 1 || maxMonths > 120 || !/^[A-Z]{3}$/.test(options.currency)) return unavailable("The cohort date, currency or observation window is invalid.");
  const recorded: CohortPayment[] = [];
  const identities = new Map<string, string>();
  for (const p of payments) {
    if (!Number.isSafeInteger(p.occurredAt) || p.occurredAt < 0 || p.occurredAt > 8.64e15 || !/^[A-Z]{3}$/.test(p.currency)) return unavailable("Billing history contains invalid dates or currencies; review the source records.");
    if (p.occurredAt > options.nowMs) continue;
    const key = JSON.stringify([p.source, p.sourceEventId]);
    const signature = JSON.stringify([p.currency, p.occurredAt, p.customerRef ?? null, p.orderRef ?? null, p.amountMinor, p.refundedMinor, p.kind]);
    const previous = identities.get(key);
    if (previous !== undefined && previous !== signature) return unavailable("Billing history contains conflicting copies of the same event; reconcile the source records.");
    if (previous !== undefined) continue;
    identities.set(key, signature);
    if (p.currency !== options.currency) continue;
    if (!Number.isSafeInteger(p.amountMinor) || !Number.isSafeInteger(p.refundedMinor) || p.refundedMinor < 0 || (p.kind === "refund" ? p.refundedMinor !== 0 : p.amountMinor < 0 || p.refundedMinor > p.amountMinor) || !p.source?.trim() || !p.sourceEventId?.trim()) return unavailable("Billing history contains invalid amounts or source identities; review the source records.");
    if (p.kind !== "refund" && p.amountMinor > 0 && !p.customerRef?.trim()) return unavailable("Positive charges are missing customer IDs; their first month and repeat payments are unknown.");
    recorded.push(p);
  }
  const nowIndex = monthIndex(monthKey(options.nowMs));
  const firstMonth = new Map<string, number>();
  const customerKey = (payment: CohortPayment) => JSON.stringify([payment.source, payment.customerRef]);
  const orderKey = (payment: CohortPayment) => JSON.stringify([payment.source, payment.currency, payment.orderRef]);
  const valid = recorded
    .filter((p) => p.customerRef && p.kind !== "refund" && p.amountMinor > 0)
    .sort((a, b) => a.occurredAt - b.occurredAt);
  for (const p of valid) {
    const idx = monthIndex(monthKey(p.occurredAt));
    const customer = customerKey(p);
    if (!firstMonth.has(customer)) firstMonth.set(customer, idx);
  }
  const customerByOrder = new Map<string, string>();
  for (const p of valid) {
    if (!p.orderRef || !p.customerRef) continue;
    const key = orderKey(p);
    const existing = customerByOrder.get(key);
    if (existing && existing !== customerKey(p)) return unavailable("Billing history contains conflicting customer identities for an order; reconcile the source records.");
    customerByOrder.set(key, customerKey(p));
  }
  const cohorts = new Map<number, { members: Set<string>; active: Map<number, Set<string>>; revenue: Map<number, number> }>();
  for (const [customer, idx] of firstMonth) {
    const c = cohorts.get(idx) ?? { members: new Set(), active: new Map(), revenue: new Map() };
    c.members.add(customer);
    cohorts.set(idx, c);
  }
  const ledger: { payment: CohortPayment; customer: string; netMinor: number; isRefund: boolean }[] = valid.map((payment) => ({
    payment,
    customer: customerKey(payment),
    netMinor: payment.amountMinor - payment.refundedMinor,
    isRefund: false,
  }));
  for (const refund of recorded) {
    if (refund.kind !== "refund" || refund.currency !== options.currency) continue;
    const orderCustomer = refund.orderRef ? customerByOrder.get(orderKey(refund)) : undefined;
    if (refund.customerRef && orderCustomer && customerKey(refund) !== orderCustomer) return unavailable("A refund's customer and order identities conflict; reconcile the source records.");
    const customer = refund.customerRef
      ? customerKey(refund)
      : orderCustomer;
    if (customer && firstMonth.has(customer)) ledger.push({ payment: refund, customer, netMinor: -Math.abs(refund.amountMinor), isRefund: true });
  }

  for (const { payment: p, customer, netMinor, isRefund } of ledger) {
    const start = firstMonth.get(customer)!;
    const k = monthIndex(monthKey(p.occurredAt)) - start;
    if (k < 0 || k >= maxMonths) continue;
    const c = cohorts.get(start)!;
    if (!isRefund) {
      const set = c.active.get(k) ?? new Set<string>();
      set.add(customer);
      c.active.set(k, set);
    }
    const revenue = (c.revenue.get(k) ?? 0) + netMinor;
    if (!Number.isSafeInteger(netMinor) || !Number.isSafeInteger(revenue)) return unavailable("Cohort revenue exceeds safe calculation limits; review the source amounts.");
    c.revenue.set(k, revenue);
  }
  const rows = [...cohorts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, c]) => {
      const activeCustomers: (number | null)[] = [];
      const retention: (number | null)[] = [];
      const revenueMinor: (number | null)[] = [];
      for (let k = 0; k < maxMonths; k++) {
        if (k > 0 && idx + k >= nowIndex) {
          activeCustomers.push(null);
          retention.push(null);
          revenueMinor.push(null);
          continue;
        }
        const n = c.active.get(k)?.size ?? 0;
        activeCustomers.push(n);
        retention.push(n / c.members.size);
        revenueMinor.push(c.revenue.get(k) ?? 0);
      }
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      return { cohort: `${y}-${String(m).padStart(2, "0")}`, size: c.members.size, activeCustomers, retention, revenueMinor };
    });
  return { rows, issue: null };
}

export interface RepeatPurchaseWindow {
  days: number;
  /** Customers whose first loaded order is at least `days` old, so the whole window has been observed. */
  eligible: number;
  /** Of those, customers with a second distinct order within `days` of the first. */
  repeated: number;
  rate: number | null;
}

export interface RepeatPurchaseSummary {
  currency: string;
  /** Distinct customers with at least one positive same-currency order and a customer ID. */
  customers: number;
  /** Positive same-currency orders without a customer ID (can't be linked to a person). */
  ordersWithoutCustomer: number;
  windows: RepeatPurchaseWindow[];
  /** Median days from first to second order, among customers who reordered within the loaded history. */
  medianDaysToSecond: number | null;
  reorderedCustomers: number;
  /** Earliest loaded order; "first order" means first within the loaded history. */
  historyFrom: number | null;
}

const DAY_MS = 86_400_000;

/**
 * Repeat purchases for one-off orders (not subscriptions): per customer (provider namespace + customer ID), the
 * first loaded order and the next distinct order. Windows only count customers old enough to have been observed
 * for the whole window, so recent customers never look like non-repeaters. Fully refunded orders don't count.
 */
export function repeatPurchaseSummary(payments: readonly CohortPayment[], options: { currency: string; nowMs: number; windowsDays?: number[] }): RepeatPurchaseSummary {
  const windowsDays = options.windowsDays ?? [30, 60, 90];
  const orders = payments.filter((p) => p.kind === "order" && p.currency === options.currency && p.amountMinor - p.refundedMinor > 0);
  const byCustomer = new Map<string, { at: number; order: string }[]>();
  let ordersWithoutCustomer = 0;
  for (const p of orders) {
    if (!p.customerRef) {
      ordersWithoutCustomer++;
      continue;
    }
    const key = `${p.source ?? ""}\u0000${p.customerRef}`;
    const list = byCustomer.get(key) ?? [];
    list.push({ at: p.occurredAt, order: p.orderRef ?? `@${p.occurredAt}` });
    byCustomer.set(key, list);
  }
  const firstTwo = [...byCustomer.values()].map((list) => {
    const sorted = list.sort((a, b) => a.at - b.at);
    const first = sorted[0];
    // Rows of the same order (e.g. partial captures) are one order.
    const second = sorted.find((x) => x.order !== first.order && x.at >= first.at);
    return { first: first.at, second: second?.at ?? null };
  });
  const windows = windowsDays.map((days) => {
    const eligible = firstTwo.filter((c) => c.first <= options.nowMs - days * DAY_MS);
    const repeated = eligible.filter((c) => c.second !== null && c.second - c.first <= days * DAY_MS).length;
    return { days, eligible: eligible.length, repeated, rate: eligible.length ? repeated / eligible.length : null };
  });
  const gaps = firstTwo.flatMap((c) => (c.second === null ? [] : [(c.second - c.first) / DAY_MS])).sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return {
    currency: options.currency,
    customers: byCustomer.size,
    ordersWithoutCustomer,
    windows,
    medianDaysToSecond: gaps.length ? (gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2) : null,
    reorderedCustomers: gaps.length,
    historyFrom: orders.length ? Math.min(...orders.map((p) => p.occurredAt)) : null,
  };
}

/** Evidence-labeled repeat-purchase context for planning; unknown when orders carry no customer IDs. */
export function repeatPurchaseBrief(s: RepeatPurchaseSummary, options: { truncated: boolean }): string {
  const currency = s.currency.toUpperCase();
  if (!s.customers && !s.ordersWithoutCustomer) return "";
  if (!s.customers) return `OBSERVED REPEAT PURCHASES: unavailable for ${currency}; loaded one-off orders do not include customer IDs. Do not infer repeat-purchase rates or time to reorder from order totals.`;
  const from = s.historyFrom ? new Date(s.historyFrom).toISOString().slice(0, 10) : "unknown";
  const windows = s.windows.map((w) => w.eligible ? `within ${w.days} days ${w.repeated}/${w.eligible} (${((w.rate ?? 0) * 100).toFixed(1)}%${w.eligible < 20 ? ", small sample" : ""})` : `within ${w.days} days not yet observable`).join("; ");
  const median = s.medianDaysToSecond === null ? "no customer has reordered in the loaded history" : `median ${Math.round(s.medianDaysToSecond)} days to a second order among the ${s.reorderedCustomers} customers who reordered (customers who haven't reordered yet are excluded, so this understates the typical wait)`;
  return [
    `OBSERVED REPEAT PURCHASES (one-off orders, ${currency}; ${s.customers} identified customers; order history loaded from ${from}${options.truncated ? ", truncated to the latest 10,000 events" : ""}${s.ordersWithoutCustomer ? `; ${s.ordersWithoutCustomer} orders without a customer ID excluded` : ""}): customers who ordered again after their first loaded order: ${windows}; ${median}.`,
    "Only customers whose whole window has passed are counted. First order means first in the loaded history, not necessarily the customer's first ever. Fully refunded orders are excluded. This is observed repeat behavior, not a retention forecast or evidence of what caused it.",
  ].join(" ");
}
