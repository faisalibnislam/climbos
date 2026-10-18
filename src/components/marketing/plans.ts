import { CREDIT_PACKAGES, CREDIT_TOPUPS, FREE_CREDITS, type PackageKey } from "@shared/economics";
import { formatNumber, formatUsd } from "@/lib/utils";

/** Credit tiers in display order (Free, then the monthly packages), from the credits registry. */
export interface Tier {
  key: "free" | PackageKey;
  name: string;
  priceUsd: number;
  credits: number;
  creditsNote: string;
  tagline: string;
  people: number;
  workspaces: number;
}

export function getTiers(): Tier[] {
  return [
    { key: "free", name: "Free", priceUsd: 0, credits: FREE_CREDITS, creditsNote: "once", tagline: "Meet your team: research, a growth plan and first drafts.", people: 1, workspaces: 1 },
    ...(Object.values(CREDIT_PACKAGES).map((p) => ({ key: p.key, name: p.name, priceUsd: p.priceUsd, credits: p.credits, creditsNote: "every month", tagline: p.tagline, people: p.seats, workspaces: p.workspaces })) as Tier[]),
  ];
}

export const RECOMMENDED_TIER: Tier["key"] = "starter";

export function getTopups() {
  return CREDIT_TOPUPS;
}

export function tierHref(key: Tier["key"]): string {
  return key === "free" ? "/sign-in?next=/onboarding" : `/sign-in?next=/onboarding%3Fplan%3D${key}`;
}

export function lowestPaidPrice(): number {
  return Math.min(...Object.values(CREDIT_PACKAGES).map((p) => p.priceUsd));
}

export interface ComparisonRow {
  label: string;
  hint?: string;
  value: (t: Tier) => string;
}

const paid = (t: Tier) => t.key !== "free";

/** What each tier includes (credits pay for the work itself). */
export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Price", value: (t) => (t.priceUsd ? `${formatUsd(t.priceUsd)} a month` : "Free") },
  { label: "Credits", hint: "1 credit ≈ 1¢ of AI work, shown before every job", value: (t) => `${formatNumber(t.credits)} ${t.creditsNote}` },
  { label: "AI growth roles", value: () => "All 10" },
  { label: "Climb AI", value: (t) => (paid(t) ? "Basic + Expert" : "Basic") },
  { label: "Autopilot", value: (t) => (paid(t) ? "Weekly plan, drafts and posting" : "Preview one week") },
  { label: "Publishing", value: (t) => (paid(t) ? "Direct to your accounts, scheduled" : "Copy and post yourself") },
  { label: "Find customers", value: (t) => (paid(t) ? "Prospects, emails sent, booking page" : "Prospect list and drafts") },
  { label: "Ads", value: (t) => (paid(t) ? "Published to your ad accounts" : "Drafts") },
  { label: "People", value: (t) => formatNumber(t.people) },
  { label: "Workspaces", value: (t) => formatNumber(t.workspaces) },
  { label: "Agents & MCP access", value: (t) => (paid(t) ? "Yes" : "—") },
  { label: "Results history", value: (t) => (paid(t) ? "Full" : "30 days") },
  { label: "\"Made with ClimbOS\" badge", value: (t) => (paid(t) ? "Removed" : "On exports and booking page") },
  { label: "Top-ups", value: (t) => (paid(t) ? "From $10, last 12 months" : "—") },
];
