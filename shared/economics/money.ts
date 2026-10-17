/**
 * Money helpers.
 *
 * Rounding policy (documented in docs/PricingAndEconomics.md):
 * - All stored and ledgered amounts are integer micro-USD (1 USD = 1,000,000 µUSD).
 * - A computed line item is rounded once, half away from zero, to the nearest µUSD.
 * - Totals are exact integer sums of rounded line items. Ratios (margins) are
 *   computed from those integer totals.
 * - Display rounds µUSD to cents, half away from zero. Display rounding never
 *   feeds back into a calculation.
 * - Reservations round estimated costs UP (ceil) so a reservation is never
 *   smaller than the worst case it protects.
 */

export type MicroUsd = number;

export const MICROS_PER_USD = 1_000_000;

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number, received ${value}`);
  }
}

/** Round half away from zero to an integer. */
export function roundHalfAway(value: number): number {
  assertFinite(value, "value");
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Convert a USD amount (possibly fractional) to integer µUSD using the line rounding rule. */
export function usdToMicros(usd: number): MicroUsd {
  assertFinite(usd, "usd");
  // Guard against binary float artefacts such as 0.1 * 3 = 0.30000000000000004.
  return roundHalfAway(Number((usd * MICROS_PER_USD).toPrecision(15)));
}

/** Convert µUSD to a USD number. Exact for any integer below 2^53. */
export function microsToUsd(micros: MicroUsd): number {
  return micros / MICROS_PER_USD;
}

/** Ceil a USD estimate to µUSD; used for reservations so they never under-reserve. */
export function usdToMicrosCeil(usd: number): MicroUsd {
  assertFinite(usd, "usd");
  const scaled = Number((usd * MICROS_PER_USD).toPrecision(15));
  return Math.ceil(scaled);
}

export function sumMicros(values: readonly MicroUsd[]): MicroUsd {
  let total = 0;
  for (const v of values) {
    if (!Number.isInteger(v)) throw new RangeError(`µUSD values must be integers, received ${v}`);
    total += v;
  }
  return total;
}

/** Format µUSD as a currency string, rounding to cents half away from zero. */
export function formatUsd(micros: MicroUsd, options: { cents?: boolean } = {}): string {
  const cents = roundHalfAway(micros / 10_000);
  const usd = cents / 100;
  const showCents = options.cents ?? true;
  return usd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

/** Format a small µUSD amount with enough precision to be meaningful (e.g. $0.0042). */
export function formatUsdPrecise(micros: MicroUsd): string {
  const usd = micros / MICROS_PER_USD;
  if (Math.abs(usd) >= 1) return formatUsd(micros);
  return `$${usd.toFixed(4)}`;
}

export function formatPercent(fraction: number, digits = 1): string {
  assertFinite(fraction, "fraction");
  return `${(fraction * 100).toFixed(digits)}%`;
}
