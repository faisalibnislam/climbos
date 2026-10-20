/**
 * Money in the workspace's own currency (Book 14 §4: units travel with values).
 *
 * Amounts the owner gives, plans compute and the UI shows stay in the
 * workspace currency. Only the channel library's thresholds are written in USD
 * (e.g. "a paid test needs $300/month", "low-ticket is under $25/month"); those
 * are scaled with the reference rates below. The rates are rough, dated
 * references for thresholds only, never shown as a conversion.
 */

/** Approximate units of each currency per 1 USD (reference, October 2026). Thresholds only. */
const PER_USD: Record<string, number> = {
  USD: 1,
  EUR: 0.9,
  GBP: 0.78,
  CAD: 1.37,
  AUD: 1.5,
  NZD: 1.65,
  CHF: 0.88,
  SEK: 10.5,
  NOK: 10.8,
  DKK: 6.8,
  PLN: 3.9,
  INR: 84,
  BDT: 120,
  PKR: 280,
  LKR: 300,
  NPR: 134,
  JPY: 150,
  KRW: 1350,
  CNY: 7.2,
  HKD: 7.8,
  SGD: 1.33,
  MYR: 4.5,
  IDR: 15800,
  PHP: 57,
  THB: 35,
  VND: 25000,
  AED: 3.67,
  SAR: 3.75,
  QAR: 3.64,
  TRY: 34,
  EGP: 49,
  NGN: 1600,
  KES: 129,
  ZAR: 18,
  BRL: 5.5,
  MXN: 18,
  ARS: 1000,
  COP: 4100,
  CLP: 950,
};

const norm = (c: string | null | undefined) => (c ?? "USD").trim().toUpperCase() || "USD";

/** Digits after the decimal point in the currency's minor unit (USD 2, JPY 0). */
export function fractionDigits(currency: string | null | undefined): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: norm(currency) }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** Stored minor units (cents, paise, yen) to whole currency units. */
export function minorToMajor(minor: number, currency: string | null | undefined): number {
  return minor / 10 ** fractionDigits(currency);
}

/** Whole currency units to stored minor units. */
export function majorToMinor(major: number, currency: string | null | undefined): number {
  return Math.round(major * 10 ** fractionDigits(currency));
}

/** Whether a USD threshold can be scaled into this currency (false = USD thresholds used as-is). */
export function hasReferenceRate(currency: string | null | undefined): boolean {
  return norm(currency) in PER_USD;
}

/** A USD-written threshold in this currency's units. */
export function fromUsd(usd: number, currency: string | null | undefined): number {
  return usd * (PER_USD[norm(currency)] ?? 1);
}

/** An amount in this currency, in USD units, to compare with a USD-written threshold. */
export function toUsd(amount: number, currency: string | null | undefined): number {
  return amount / (PER_USD[norm(currency)] ?? 1);
}

/** Whole-unit display, symbol from the currency ("$1,200", "€40", "৳5,000"). Under 10 keeps the minor unit ("$5.99", "$6"). */
export function formatMoney(n: number | null | undefined, currency: string | null | undefined, empty = "n/a"): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return empty;
  const c = norm(currency);
  const small = Math.abs(n) < 10 && fractionDigits(c) > 0 && !Number.isInteger(n);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: c, currencyDisplay: "narrowSymbol", minimumFractionDigits: small ? 2 : 0, maximumFractionDigits: small ? 2 : 0 }).format(n);
  } catch {
    return `${small ? n.toFixed(2) : Math.round(n).toLocaleString("en-US")} ${c}`;
  }
}

/** A round threshold in this currency (USD threshold scaled, then rounded to 2 significant figures). */
export function thresholdIn(usd: number, currency: string | null | undefined): number {
  const v = fromUsd(usd, currency);
  if (v <= 0) return 0;
  const p = 10 ** Math.max(0, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / p) * p;
}
