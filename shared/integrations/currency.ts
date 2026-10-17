/**
 * ISO 4217 minor-unit exponents and exact decimal → minor-unit conversion
 * (string based, no floating point).
 */

const EXPONENT_OVERRIDES: Record<string, number> = {
  // zero-decimal
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0, UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // three-decimal
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  // four-decimal
  CLF: 4, UYW: 4,
};

/** Currencies we know are valid 2-decimal codes (others still default to 2 if well-formed). */
export function currencyExponent(currency: string): number {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Invalid ISO 4217 currency code: ${currency}`);
  return EXPONENT_OVERRIDES[code] ?? 2;
}

export function isValidCurrencyCode(currency: string): boolean {
  return /^[A-Za-z]{3}$/.test(currency.trim());
}

export type DecimalParse = { ok: true; minor: number } | { ok: false; error: string };

/**
 * Convert a decimal string ("12.34", "-5", "1,234.50" is rejected) to integer
 * minor units for the currency. Rejects more fractional digits than the
 * currency allows (no silent rounding).
 */
export function decimalToMinor(value: string, currency: string): DecimalParse {
  const exp = currencyExponent(currency);
  const trimmed = value.trim();
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (!m) return { ok: false, error: `"${value}" is not a plain decimal number (use 1234.56, no symbols or thousands separators)` };
  const [, sign, whole, frac = ""] = m;
  const fracTrimmed = frac.replace(/0+$/, "");
  if (fracTrimmed.length > exp) {
    return { ok: false, error: `"${value}" has more decimal places than ${currency.toUpperCase()} allows (${exp})` };
  }
  const padded = (fracTrimmed + "0".repeat(exp)).slice(0, exp);
  const digits = `${whole}${padded}`.replace(/^0+(?=\d)/, "");
  const n = Number(digits);
  if (!Number.isSafeInteger(n)) return { ok: false, error: `"${value}" is too large` };
  return { ok: true, minor: sign === "-" ? -n : n };
}

/** Minor units → Google Ads micros (1 unit = 1,000,000 micros). */
export function minorToMicros(minor: number, currency: string): number {
  const exp = currencyExponent(currency);
  return minor * 10 ** (6 - exp);
}

/** Micros → minor units (rounded half away from zero). */
export function microsToMinor(micros: number, currency: string): number {
  const exp = currencyExponent(currency);
  const factor = 10 ** (6 - exp);
  return Math.sign(micros) * Math.round(Math.abs(micros) / factor);
}
