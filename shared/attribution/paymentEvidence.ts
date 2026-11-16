/** CRM mirrors are owner-reported sales, never evidence of payment collection.
 * Other sources still need validation; passing this predicate does not verify a
 * provider, an owner-imported CSV, or cross-provider deduplication.
 */
export function isPaymentRecord(record: { source: string }): boolean {
  return record.source.trim().toLowerCase() !== "crm";
}

export const PAYMENT_BASIS = "payments-excluding-crm-v1" as const;
export const SALES_PAYMENT_NOTE = "Owner-recorded sales stay in the customer pipeline and are excluded from payment totals, paying-customer counts and repeat-payment calculations. A won deal does not establish collected payment; imported billing records are not independent verification of cash or profit.";
export const LEGACY_BILLING_NOTE = "older billing totals may include owner-recorded sales; re-import the affected billing dates before using these totals or forecasts";

export function needsPaymentRefresh(row: { metricKey: string; source: string; isFixture: boolean; billingBasis?: string }): boolean {
  return row.metricKey === "revenue" && row.source === "billing" && !row.isFixture && row.billingBasis !== PAYMENT_BASIS;
}
