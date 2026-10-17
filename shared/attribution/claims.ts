/**
 * Ad-platform claimed conversions. Each platform counts conversions under its
 * own attribution window and rules, so the same order is often claimed by
 * several platforms. These figures are labelled `platform_reported`, kept per
 * platform and per currency, and must never be added together or treated as
 * revenue truth.
 */

import type { PlatformClaim } from "./types";

export const OVERLAP_WARNING =
  "Platform-reported conversions use each platform's own attribution rules and can overlap (the same order may be claimed by several platforms). Do not add them together or compare them to billing revenue as if they were unique.";

export interface PlatformClaimSummary {
  platform: string;
  label: "platform_reported";
  conversions: number;
  /** Claimed conversion value per currency, minor units. */
  conversionValueMinorByCurrency: Record<string, number>;
  firstDate: string | null;
  lastDate: string | null;
  days: number;
}

export interface ClaimsSummary {
  label: "platform_reported";
  platforms: PlatformClaimSummary[];
  overlapWarning: string;
}

/** Summarise claims per platform. Deliberately exposes no cross-platform total. */
export function summarizePlatformClaims(claims: readonly PlatformClaim[]): ClaimsSummary {
  const map = new Map<string, PlatformClaimSummary & { dates: Set<string> }>();
  for (const c of claims) {
    const s =
      map.get(c.platform) ??
      ({
        platform: c.platform,
        label: "platform_reported",
        conversions: 0,
        conversionValueMinorByCurrency: {},
        firstDate: null,
        lastDate: null,
        days: 0,
        dates: new Set<string>(),
      } as PlatformClaimSummary & { dates: Set<string> });
    s.conversions += c.conversions;
    s.conversionValueMinorByCurrency[c.currency] = (s.conversionValueMinorByCurrency[c.currency] ?? 0) + c.conversionValueMinor;
    if (s.firstDate === null || c.date < s.firstDate) s.firstDate = c.date;
    if (s.lastDate === null || c.date > s.lastDate) s.lastDate = c.date;
    s.dates.add(c.date);
    map.set(c.platform, s);
  }
  const platforms = [...map.values()]
    .map(({ dates, ...rest }) => ({ ...rest, days: dates.size }))
    .sort((a, b) => a.platform.localeCompare(b.platform));
  return { label: "platform_reported", platforms, overlapWarning: OVERLAP_WARNING };
}

/** Thrown whenever code tries to build a revenue total from platform claims. */
export class ClaimsAggregationError extends Error {
  constructor() {
    super(`Refusing to combine platform claims into total revenue. ${OVERLAP_WARNING} Use billing revenue (attribute()) for totals.`);
    this.name = "ClaimsAggregationError";
  }
}

/**
 * Guard rail: ALWAYS throws. Exists so callers that reach for a combined
 * "total revenue" from platform claims fail loudly instead of double counting.
 */
export function totalRevenueFromClaims(_claims: readonly PlatformClaim[]): never {
  void _claims;
  throw new ClaimsAggregationError();
}
