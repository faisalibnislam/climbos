import { CREDIT_PACKAGES, CREDIT_TOPUPS, FREE_CREDITS, FREE_LIMITS, type PackageKey, type TopupKey } from "./credits";

/**
 * Settings ClimbOS staff can change live from the admin panel (no deploy).
 * Credit amounts apply to new grants: each subscriber's next renewal, new
 * top-ups and new accounts. Prices themselves live in Polar.
 */

export type FeatureKey = "expert" | "autopilot" | "publishing" | "sending" | "ads_publish" | "booking_page" | "mcp" | "full_history" | "no_badge";

export const FEATURES: Record<FeatureKey, string> = {
  expert: "Climb AI Expert",
  autopilot: "Autopilot",
  publishing: "Direct publishing and scheduling",
  sending: "Sending emails",
  ads_publish: "Publishing ads",
  booking_page: "Booking page",
  mcp: "Agents & MCP access",
  full_history: "Results history beyond 30 days",
  no_badge: "No “Made with ClimbOS” badge",
};

export interface LiveConfig {
  /** Credits granted per month per package (applies from the next renewal). */
  packageCredits: Record<PackageKey, number>;
  topupCredits: Record<TopupKey, number>;
  freeCredits: number;
  seats: { free: number } & Record<PackageKey, number>;
  workspaces: { free: number } & Record<PackageKey, number>;
  freeHistoryDays: number;
  /** Credits each side gets when a referred account buys its first package. */
  referralCredits: number;
  /** "paid" = packages only; "free" = everyone. */
  features: Record<FeatureKey, "free" | "paid">;
}

export const DEFAULT_LIVE_CONFIG: LiveConfig = {
  packageCredits: { starter: CREDIT_PACKAGES.starter.credits, pro: CREDIT_PACKAGES.pro.credits },
  topupCredits: Object.fromEntries(CREDIT_TOPUPS.map((t) => [t.key, t.credits])) as Record<TopupKey, number>,
  freeCredits: FREE_CREDITS,
  seats: { free: FREE_LIMITS.seats, starter: CREDIT_PACKAGES.starter.seats, pro: CREDIT_PACKAGES.pro.seats },
  workspaces: { free: FREE_LIMITS.freeWorkspacesPerOwner, starter: CREDIT_PACKAGES.starter.workspaces, pro: CREDIT_PACKAGES.pro.workspaces },
  freeHistoryDays: FREE_LIMITS.historyDays,
  referralCredits: 200,
  features: { expert: "paid", autopilot: "paid", publishing: "paid", sending: "paid", ads_publish: "paid", booking_page: "paid", mcp: "paid", full_history: "paid", no_badge: "paid" },
};

/** Saved overrides on top of the defaults (unknown keys ignored, numbers clamped to sane ranges). */
export function mergeLiveConfig(saved: unknown): LiveConfig {
  const s = (saved && typeof saved === "object" ? saved : {}) as Partial<LiveConfig>;
  const num = (v: unknown, d: number, max = 1_000_000) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : d);
  const d = DEFAULT_LIVE_CONFIG;
  return {
    packageCredits: { starter: num(s.packageCredits?.starter, d.packageCredits.starter), pro: num(s.packageCredits?.pro, d.packageCredits.pro) },
    topupCredits: Object.fromEntries((Object.keys(d.topupCredits) as TopupKey[]).map((k) => [k, num(s.topupCredits?.[k], d.topupCredits[k])])) as Record<TopupKey, number>,
    freeCredits: num(s.freeCredits, d.freeCredits, 100_000),
    seats: { free: num(s.seats?.free, d.seats.free, 1000), starter: num(s.seats?.starter, d.seats.starter, 1000), pro: num(s.seats?.pro, d.seats.pro, 1000) },
    workspaces: { free: num(s.workspaces?.free, d.workspaces.free, 1000), starter: num(s.workspaces?.starter, d.workspaces.starter, 1000), pro: num(s.workspaces?.pro, d.workspaces.pro, 1000) },
    freeHistoryDays: num(s.freeHistoryDays, d.freeHistoryDays, 3650),
    referralCredits: num(s.referralCredits, d.referralCredits, 10_000),
    features: Object.fromEntries((Object.keys(d.features) as FeatureKey[]).map((k) => [k, s.features?.[k] === "free" ? "free" : "paid"])) as Record<FeatureKey, "free" | "paid">,
  };
}

/** Which package a plan key counts as (retired plans map to the nearest package). */
export function packageOf(planKey: string): PackageKey {
  return planKey === "starter" || planKey === "basic" ? "starter" : "pro";
}
