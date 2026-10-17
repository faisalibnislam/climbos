/**
 * Immutable entitlement registry. Plan caps are the Heavy profile of the
 * calculator (the included monthly maximum). They are stored as literal numbers
 * so they are machine-readable and reviewable; a unit test proves they equal
 * the calculator output for the referenced rate version, so a rate or
 * assumption change cannot silently drift from the published caps.
 */

import type { PlanKey } from "./assumptions";
import type { RoleKey } from "./roles";

export type AutonomyMode = "copilot" | "review" | "bounded_autopilot";

export interface PlanEntitlement {
  key: PlanKey;
  name: string;
  priceUsd: number;
  tagline: string;
  brands: number;
  seats: number;
  connections: number;
  socialPosts: number;
  deliveredImages: number;
  imageAttempts: number;
  searchCalls: number;
  scrapeCredits: number;
  transactionalEmails: number;
  byoMarketingSends: number;
  storageGb: number;
  analyticsEvents: number;
  supportMinutes: number;
  /** Internal monthly AI wallet in µUSD (text + images incl. stress allowance). */
  aiWalletMicros: number;
  roleRuns: Record<RoleKey, number>;
  autonomyModes: AutonomyMode[];
  defaultAutonomy: AutonomyMode;
  adsWorkflows: number;
  highlights: string[];
}

export interface TopupProduct {
  key: string;
  name: string;
  priceUsd: number;
  /** Maximum stressed incremental total delivery cost authorized, µUSD. */
  deliveryCostMicros: number;
  description: string;
}

export interface WorkspaceLimits {
  interactiveAiJobs: number;
  queuedBackgroundJobs: number;
  publishersPerConnectedAccount: number;
  modelDispatchesPerMinute: number;
  workflowModelSteps: number;
  workflowResearchTools: number;
  workflowRepairAttempts: number;
  /** Fraction of a provider's published RPM/TPM/RPD that global dispatch may use. */
  providerQuotaHeadroom: number;
  maxImageAttemptsPerRequestedImage: number;
}

export interface EntitlementVersion {
  id: string;
  effectiveFrom: string;
  rateVersionId: string;
  routingVersionId: string;
  plans: Record<PlanKey, PlanEntitlement>;
  topups: TopupProduct[];
  limits: WorkspaceLimits;
  usageAlertThresholds: readonly number[];
  /** Raw scrape/debug, detailed activity + revisions, aggregates (days). */
  retentionDays: { rawPayloads: number; detailedActivity: number; aggregates: number };
}

const roleRuns = (scale: number): Record<RoleKey, number> => {
  const base: Record<RoleKey, number> = {
    ceo: 8,
    coo: 300,
    cmo: 20,
    cso: 120,
    creative_director: 120,
    social_media_manager: 300,
    ads_manager: 120,
    seo_specialist: 80,
    data_analyst: 120,
    customer_success_manager: 120,
  };
  return Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, Math.floor(Number((v * scale).toPrecision(12)))]),
  ) as Record<RoleKey, number>;
};

export const ENTITLEMENTS_2026_10_17: EntitlementVersion = Object.freeze({
  id: "ent-2026-10-17",
  effectiveFrom: "2026-10-17",
  rateVersionId: "verified-2026-10-17",
  routingVersionId: "routing-climbos-2026-10-17",
  plans: {
    basic: {
      key: "basic",
      name: "Basic",
      priceUsd: 19,
      tagline: "Your AI growth team in miniature: a clear plan and a few posts a month.",
      brands: 1,
      seats: 1,
      connections: 2,
      socialPosts: 4,
      deliveredImages: 3,
      imageAttempts: 7,
      searchCalls: 4,
      scrapeCredits: 12,
      transactionalEmails: 18,
      byoMarketingSends: 600,
      storageGb: 0.6,
      analyticsEvents: 6_000,
      supportMinutes: 2,
      aiWalletMicros: 2_000_000,
      roleRuns: { ...roleRuns(0.04 * 3), ceo: 1 },
      autonomyModes: ["copilot"],
      defaultAutonomy: "copilot",
      adsWorkflows: 0,
      highlights: ["Business analysis and a monthly growth plan", "4 ready-to-post drafts a month", "You publish; ClimbOS drafts"],
    },
    starter: {
      key: "starter",
      name: "Starter",
      priceUsd: 169,
      tagline: "For a founder getting a steady growth rhythm going.",
      brands: 1,
      seats: 1,
      connections: 3,
      socialPosts: 42,
      deliveredImages: 31,
      imageAttempts: 63,
      searchCalls: 42,
      scrapeCredits: 105,
      transactionalEmails: 157,
      byoMarketingSends: 5_250,
      storageGb: 5.25,
      analyticsEvents: 52_500,
      supportMinutes: 20,
      aiWalletMicros: 20_000_000,
      roleRuns: roleRuns(0.35 * 3),
      autonomyModes: ["copilot", "review"],
      defaultAutonomy: "review",
      adsWorkflows: 0,
      highlights: ["All 10 growth roles", "Drafts and review before anything goes live", "1 brand, 1 seat"],
    },
    growth: {
      key: "growth",
      name: "Growth",
      priceUsd: 449,
      tagline: "For a small team running campaigns every week.",
      brands: 1,
      seats: 3,
      connections: 6,
      socialPosts: 120,
      deliveredImages: 90,
      imageAttempts: 180,
      searchCalls: 120,
      scrapeCredits: 300,
      transactionalEmails: 450,
      byoMarketingSends: 15_000,
      storageGb: 15,
      analyticsEvents: 150_000,
      supportMinutes: 50,
      aiWalletMicros: 58_000_000,
      roleRuns: roleRuns(1 * 3),
      autonomyModes: ["copilot", "review", "bounded_autopilot"],
      defaultAutonomy: "review",
      adsWorkflows: 1,
      highlights: ["Approved recurring campaigns", "1 connected ads workflow", "3 seats"],
    },
    pro: {
      key: "pro",
      name: "Pro",
      priceUsd: 999,
      tagline: "For growing companies testing several channels at once.",
      brands: 3,
      seats: 8,
      connections: 15,
      socialPosts: 300,
      deliveredImages: 225,
      imageAttempts: 450,
      searchCalls: 300,
      scrapeCredits: 750,
      transactionalEmails: 1_125,
      byoMarketingSends: 37_500,
      storageGb: 37.5,
      analyticsEvents: 375_000,
      supportMinutes: 120,
      aiWalletMicros: 145_000_000,
      roleRuns: roleRuns(2.5 * 3),
      autonomyModes: ["copilot", "review", "bounded_autopilot"],
      defaultAutonomy: "review",
      adsWorkflows: 3,
      highlights: ["Up to 3 brands", "Multi-channel experiments", "8 seats"],
    },
    business: {
      key: "business",
      name: "Business",
      priceUsd: 2299,
      tagline: "For larger teams that need governance and portfolio reporting.",
      brands: 5,
      seats: 20,
      connections: 30,
      socialPosts: 720,
      deliveredImages: 540,
      imageAttempts: 1_080,
      searchCalls: 720,
      scrapeCredits: 1_800,
      transactionalEmails: 2_700,
      byoMarketingSends: 90_000,
      storageGb: 90,
      analyticsEvents: 900_000,
      supportMinutes: 240,
      aiWalletMicros: 349_000_000,
      roleRuns: roleRuns(6 * 3),
      autonomyModes: ["copilot", "review", "bounded_autopilot"],
      defaultAutonomy: "review",
      adsWorkflows: 10,
      highlights: ["Up to 5 brands", "Governed policies and approval roles", "20 seats"],
    },
  },
  topups: [
    {
      key: "boost_29",
      name: "Extra capacity pack",
      priceUsd: 29,
      deliveryCostMicros: 10_000_000,
      description: "Adds more AI work for this month when you hit your plan's limit. Never charged automatically.",
    },
  ],
  limits: {
    interactiveAiJobs: 2,
    queuedBackgroundJobs: 5,
    publishersPerConnectedAccount: 1,
    modelDispatchesPerMinute: 10,
    workflowModelSteps: 6,
    workflowResearchTools: 3,
    workflowRepairAttempts: 1,
    providerQuotaHeadroom: 0.8,
    maxImageAttemptsPerRequestedImage: 2,
  },
  usageAlertThresholds: [0.7, 0.9, 1],
  retentionDays: { rawPayloads: 30, detailedActivity: 90, aggregates: 396 },
}) as EntitlementVersion;

export const ENTITLEMENT_VERSIONS: readonly EntitlementVersion[] = [ENTITLEMENTS_2026_10_17];
export const CURRENT_ENTITLEMENTS = ENTITLEMENTS_2026_10_17;

export function getEntitlementVersion(id: string): EntitlementVersion {
  const v = ENTITLEMENT_VERSIONS.find((e) => e.id === id);
  if (!v) throw new Error(`Unknown entitlement version: ${id}`);
  return v;
}

/** Usage meters that both a task-count quota and the cost wallet govern. */
export type MeterKey =
  | "socialPosts"
  | "imageAttempts"
  | "deliveredImages"
  | "searchCalls"
  | "scrapeCredits"
  | "transactionalEmails"
  | "byoMarketingSends"
  | "analyticsEvents"
  | "supportMinutes";

export const METER_LABELS: Record<MeterKey, string> = {
  socialPosts: "Social posts",
  imageAttempts: "Image attempts",
  deliveredImages: "Images",
  searchCalls: "Web searches",
  scrapeCredits: "Website pages read",
  transactionalEmails: "ClimbOS emails",
  byoMarketingSends: "Marketing emails (your provider)",
  analyticsEvents: "Analytics events",
  supportMinutes: "Support time (minutes)",
};

export function planCapForMeter(plan: PlanEntitlement, meter: MeterKey): number {
  return plan[meter];
}

/** Returns the highest alert threshold crossed (0.7, 0.9, 1) or null. */
export function usageAlertLevel(used: number, cap: number, thresholds: readonly number[] = [0.7, 0.9, 1]): number | null {
  if (cap <= 0) return used > 0 ? 1 : null;
  const ratio = used / cap;
  let level: number | null = null;
  for (const t of thresholds) if (ratio >= t) level = t;
  return level;
}
