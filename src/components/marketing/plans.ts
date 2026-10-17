import { CURRENT_ENTITLEMENTS, PLAN_KEYS, type PlanEntitlement, type PlanKey } from "@shared/economics";
import { formatNumber, formatUsd, plural } from "@/lib/utils";
import { AUTONOMY_LABELS } from "./content";

/** Plans in display order, straight from the versioned entitlement registry (never hardcoded). */
export function getPlans(): PlanEntitlement[] {
  return PLAN_KEYS.map((k) => CURRENT_ENTITLEMENTS.plans[k]);
}

export function getTopup() {
  return CURRENT_ENTITLEMENTS.topups[0];
}

export const RECOMMENDED_PLAN: PlanKey = "growth";

export function planHref(key: PlanKey): string {
  return `/sign-in?next=/onboarding%3Fplan%3D${key}`;
}

export function lowestPrice(): number {
  return Math.min(...getPlans().map((p) => p.priceUsd));
}

export function priceLabel(plan: PlanEntitlement): string {
  return formatUsd(plan.priceUsd);
}

/** "1 brand · 1 seat · 3 connected accounts" */
export function teamLine(p: PlanEntitlement): string {
  return [plural(p.brands, "brand"), plural(p.seats, "seat"), plural(p.connections, "connected account")].join(" · ");
}

export function imagesLine(p: PlanEntitlement): string {
  return `Up to ${plural(p.deliveredImages, "image")} (${formatNumber(p.imageAttempts)} attempts)`;
}

export function adsLine(p: PlanEntitlement): string {
  if (p.adsWorkflows <= 0) return "Ad plans and drafts (you launch them)";
  return `${plural(p.adsWorkflows, "connected ads workflow")}`;
}

export function autonomyLine(p: PlanEntitlement): string {
  const best = p.autonomyModes.includes("bounded_autopilot")
    ? "bounded_autopilot"
    : p.autonomyModes.includes("review")
      ? "review"
      : "copilot";
  return AUTONOMY_LABELS[best].title;
}

/** Key monthly limits in plain words, for plan cards. */
export function planLimitLines(p: PlanEntitlement): string[] {
  return [
    teamLine(p),
    `${plural(p.socialPosts, "social post")} a month`,
    imagesLine(p),
    `${plural(p.scrapeCredits, "website page")} read`,
    `${plural(p.searchCalls, "web search", "web searches")}`,
  ];
}

export interface ComparisonRow {
  label: string;
  hint?: string;
  value: (p: PlanEntitlement) => string;
}

/** Rows for the accessible plan comparison table. */
export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Monthly price", value: (p) => `${formatUsd(p.priceUsd)} a month` },
  { label: "AI growth roles", value: () => "All 10" },
  { label: "Brands", value: (p) => formatNumber(p.brands) },
  { label: "Seats (people on your team)", value: (p) => formatNumber(p.seats) },
  { label: "Connected accounts", hint: "Social, ads, analytics, email and CRM connections", value: (p) => formatNumber(p.connections) },
  { label: "How work goes live", value: (p) => autonomyLine(p) },
  { label: "Social posts a month", value: (p) => formatNumber(p.socialPosts) },
  { label: "Images a month", hint: "Attempts include retries and alternatives", value: (p) => `Up to ${formatNumber(p.deliveredImages)} (${formatNumber(p.imageAttempts)} attempts)` },
  { label: "Website pages read a month", hint: "Your site and competitors' sites", value: (p) => formatNumber(p.scrapeCredits) },
  { label: "Web searches a month", value: (p) => formatNumber(p.searchCalls) },
  { label: "Marketing emails a month", hint: "Sent through your own email provider", value: (p) => formatNumber(p.byoMarketingSends) },
  { label: "Emails from ClimbOS a month", hint: "Approval requests, alerts and reports", value: (p) => formatNumber(p.transactionalEmails) },
  { label: "Ads", value: (p) => adsLine(p) },
  { label: "Support time a month", value: (p) => `${formatNumber(p.supportMinutes)} minutes` },
];
