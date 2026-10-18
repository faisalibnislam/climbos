/**
 * Credits (owner decisions, 18 Oct 2026). The app is free; every action costs
 * credits, and owners never see dollar amounts in the product.
 *
 * - 1 credit = 1¢ of our direct cost (AI, web search, images, page reads).
 *   Jobs reserve their worst case up front ("Up to X credits") and are charged
 *   what they actually used; the rest returns.
 * - Monthly packages: credits reset at each renewal.
 * - Top-ups: for subscribers only; credits last 12 months and are used after
 *   the month's package credits.
 * - Free: 50 credits once per new workspace.
 * - Prices were set for a 10% (packages) / 12% (top-ups) margin after Polar
 *   fees (5% + $0.50, +1.5% international) and a 5% hosting allowance. The
 *   $50 top-up at 4,000 credits is a deliberate owner choice below that target.
 */

export const MICROS_PER_CREDIT = 10_000;
export const FREE_CREDITS = 50;
export const TOPUP_VALID_DAYS = 365;

export type PackageKey = "starter" | "pro";
export type TopupKey = "credits_10" | "credits_25" | "credits_50";

export interface CreditPackage {
  key: PackageKey;
  name: string;
  priceUsd: number;
  credits: number;
  seats: number;
  workspaces: number;
  tagline: string;
}

export const CREDIT_PACKAGES: Record<PackageKey, CreditPackage> = {
  starter: { key: "starter", name: "Starter", priceUsd: 15, credits: 1_100, seats: 3, workspaces: 3, tagline: "For one business growing steadily." },
  pro: { key: "pro", name: "Pro", priceUsd: 39, credits: 3_000, seats: 10, workspaces: 10, tagline: "For busy teams and several brands." },
};

export interface CreditTopup {
  key: TopupKey;
  priceUsd: number;
  credits: number;
}

export const CREDIT_TOPUPS: readonly CreditTopup[] = [
  { key: "credits_10", priceUsd: 10, credits: 700 },
  { key: "credits_25", priceUsd: 25, credits: 1_800 },
  { key: "credits_50", priceUsd: 50, credits: 4_000 },
];

/** Free workspaces: one user, one free workspace per owner. */
export const FREE_LIMITS = { seats: 1, freeWorkspacesPerOwner: 1, historyDays: 30 };

export function creditsToMicros(credits: number): number {
  return Math.round(credits * MICROS_PER_CREDIT);
}

/** Credits shown to owners: cost rounded up to a whole credit (never shows 0 for real work). */
export function microsToCredits(micros: number): number {
  return micros <= 0 ? 0 : Math.ceil(micros / MICROS_PER_CREDIT);
}

/** Credits left, rounded down (never promise more than there is). */
export function microsToCreditsFloor(micros: number): number {
  return micros <= 0 ? 0 : Math.floor(micros / MICROS_PER_CREDIT);
}

export function formatCredits(credits: number): string {
  return `${credits.toLocaleString("en-US")} credit${credits === 1 ? "" : "s"}`;
}

/** Margin after Polar fees (worst case: all international) and the hosting allowance, if every credit is used. */
export function creditMargin(priceUsd: number, credits: number, opts: { overhead?: number; feePercent?: number; feeFixed?: number } = {}): number {
  const fees = priceUsd * (opts.feePercent ?? 0.065) + (opts.feeFixed ?? 0.5);
  const cost = credits / 100;
  return (priceUsd - fees - cost) / priceUsd - (opts.overhead ?? 0.05);
}

/** What common actions cost at most, in credits (a test keeps these equal to the live job estimates). */
export const CREDIT_EXAMPLES: readonly { kind: string; label: string; basic: number; expert?: number }[] = [
  { kind: "onboarding_research", label: "Research your business", basic: 15, expert: 53 },
  { kind: "strategy", label: "90-day growth plan", basic: 18, expert: 132 },
  { kind: "content_social", label: "3 social posts", basic: 4 },
  { kind: "content_ads", label: "Ad set", basic: 9, expert: 47 },
  { kind: "content_email", label: "Email sequence", basic: 4 },
  { kind: "content_seo", label: "SEO page", basic: 11 },
  { kind: "conversion_audit", label: "Website audit", basic: 9 },
  { kind: "social_calendar", label: "Weekly autopilot plan", basic: 3, expert: 34 },
  { kind: "outbound", label: "Find customers + emails", basic: 20 },
  { kind: "image", label: "One image", basic: 5 },
];
