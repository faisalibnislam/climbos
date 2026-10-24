/**
 * Monthly customer cohorts from billing events. A customer's cohort is the
 * month of their first positive payment; retention for month offset k is the
 * share of that cohort with at least one positive payment in month k.
 * Later months are only reported once they are complete: months that haven't
 * finished yet are `null` (not zero), so a young cohort never looks like it
 * churned. Month 0 is always shown (it is 100% by definition).
 */

export interface CohortPayment {
  /** Provider namespace for customerRef; optional only for legacy callers. */
  source?: string;
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

function monthKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 7);
}

function monthIndex(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

export function computeCohorts(
  payments: readonly CohortPayment[],
  options: { currency: string; nowMs: number; maxMonths?: number },
): CohortRow[] {
  const maxMonths = options.maxMonths ?? 12;
  const nowIndex = monthIndex(monthKey(options.nowMs));
  const firstMonth = new Map<string, number>();
  const customerKey = (payment: CohortPayment) => `${payment.source ?? ""}\u0000${payment.customerRef}`;
  const valid = payments
    .filter((p) => p.customerRef && p.kind !== "refund" && p.currency === options.currency && p.amountMinor - p.refundedMinor > 0)
    .sort((a, b) => a.occurredAt - b.occurredAt);
  for (const p of valid) {
    const idx = monthIndex(monthKey(p.occurredAt));
    const customer = customerKey(p);
    if (!firstMonth.has(customer)) firstMonth.set(customer, idx);
  }
  const customerByOrder = new Map<string, string>();
  for (const p of valid) {
    if (!p.orderRef || !p.customerRef) continue;
    const key = `${p.source ?? ""}\u0000${p.currency}\u0000${p.orderRef}`;
    if (!customerByOrder.has(key)) customerByOrder.set(key, customerKey(p));
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
  for (const refund of payments) {
    if (refund.kind !== "refund" || refund.currency !== options.currency) continue;
    const customer = refund.customerRef
      ? customerKey(refund)
      : refund.orderRef
        ? customerByOrder.get(`${refund.source ?? ""}\u0000${refund.currency}\u0000${refund.orderRef}`)
        : undefined;
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
    c.revenue.set(k, (c.revenue.get(k) ?? 0) + netMinor);
  }
  return [...cohorts.entries()]
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
}
