/**
 * Does the link destination still show an approved offer price? A warning aid only: a missing match can mean a
 * changed offer, a price rendered by JavaScript, or a different format, so it never blocks publishing.
 */

export type OfferDestinationStatus = "found" | "not_found" | "unavailable";

const priceForms = (p: number) => [...new Set([String(p), p.toFixed(2), p.toFixed(2).replace(".", ",")])];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Approved prices that appear on the page as standalone numbers (text or JSON-LD offers). */
export function approvedPricesOnPage(page: { text: string; jsonLdPrices?: { price: string | number }[] }, prices: readonly number[]): number[] {
  const text = page.text.replace(/\s+/g, " ");
  return prices.filter((p) => {
    if (!(Number.isFinite(p) && p >= 0)) return false;
    if (page.jsonLdPrices?.some((o) => Number(String(o.price).replace(",", ".")) === p)) return true;
    return priceForms(p).some((form) => new RegExp(`(?<![\\d.,])${escape(form)}(?![\\d]|[.,]\\d)`).test(text));
  });
}

export function offerDestinationStatus(page: { text: string; jsonLdPrices?: { price: string | number }[] } | null, prices: readonly number[]): { status: OfferDestinationStatus; found: number[] } {
  if (!page) return { status: "unavailable", found: [] };
  const found = approvedPricesOnPage(page, prices);
  return { status: found.length ? "found" : "not_found", found };
}
