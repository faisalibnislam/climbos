import { formatCredits, microsToCredits } from "../../../shared/economics/credits";

/** Display helpers. Money from the backend is integer µUSD (costs) or minor units (revenue). */

/** Owner-facing cost: credits (1 credit = 1¢ of cost), never dollars. */
export function microsToCreditsLabel(micros: number): string {
  return formatCredits(microsToCredits(micros));
}

const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Real API cost in dollars, for users an operator enabled (everyone else sees
 * credits). To the cent; a real but sub-cent cost reads "under $0.01".
 */
export function microsToUsdCost(micros: number): string {
  if (micros <= 0) return "$0.00";
  const cents = Math.round(micros / 10_000);
  return cents === 0 ? "under $0.01" : usd(cents);
}

/** A worst case in dollars, rounded up to the cent (never understates "up to"). */
export function microsToUsdUpTo(micros: number): string {
  return usd(micros <= 0 ? 0 : Math.ceil(micros / 10_000));
}

/** Dollars left to spend, rounded down to the cent (never promises more than there is). */
export function microsToUsdLeft(micros: number): string {
  return usd(micros <= 0 ? 0 : Math.floor(micros / 10_000));
}

/** Staff-only (ops console): provider cost in dollars. */
export function microsToUsd(micros: number): string {
  const usd = micros / 1_000_000;
  if (usd === 0) return "$0";
  if (usd < 0.01) return "under $0.01";
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

export function minorToDisplay(minor: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Math.abs(minor) >= 100_000 ? 0 : 2 }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

export function relativeTime(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
