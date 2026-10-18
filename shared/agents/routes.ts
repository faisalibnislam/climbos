import type { ModelKey } from "../economics/rates";
import type { PhaseModels } from "./types";

/**
 * Model routes per agent (owner decision, 2026-10-18). research → draft →
 * review; `revise` is the conditional escalation used only when a review
 * fails (e.g. Opus for the growth plan). Set CLIMBOS_ROUTES=classic to roll
 * back to the previous Claude-only routes for new jobs.
 */

const LUNA: ModelKey = "gpt-6-luna";
const SOL: ModelKey = "gpt-6.1-sol";
const SONNET: ModelKey = "claude-sonnet-5.5";
const HAIKU: ModelKey = "claude-haiku-5.5";
const OPUS: ModelKey = "claude-opus-5.5";

export const ROUTE_VERSION = "owner-2026-10-18";

export const ROUTES: Record<string, Partial<PhaseModels>> = {
  business_insights: { research: LUNA, draft: SOL, critic: SONNET },
  growth_plays: { research: SOL, draft: SONNET, critic: SONNET, revise: OPUS },
  growth_strategy: { research: SOL, draft: SONNET, critic: SONNET, revise: OPUS },
  channel_fit: { research: SOL, draft: SONNET, critic: SONNET },
  social_posts: { research: LUNA, draft: SONNET, critic: HAIKU },
  email_sequence: { research: LUNA, draft: SONNET, critic: HAIKU },
  retention_plan: { research: LUNA, draft: SONNET, critic: HAIKU },
  sales_sequence: { research: LUNA, draft: SONNET, critic: HAIKU },
  ad_drafts: { research: SOL, draft: SONNET, critic: HAIKU },
  seo_brief: { research: LUNA, draft: SONNET, critic: LUNA },
  conversion_audit: { research: LUNA, draft: SOL, critic: HAIKU },
  prospecting: { research: LUNA, draft: SOL, critic: SONNET },
  cold_outreach: { research: LUNA, draft: SONNET, critic: SONNET },
  social_calendar: { research: SOL, draft: SOL, critic: HAIKU },
};

/** Single-call tasks outside the agent loop. */
export const CALL_ROUTES = {
  /** Understanding a wish. */
  chat_intent: LUNA,
  /** Climb AI: routine turns; analysis escalates to Sol. */
  climb: LUNA,
  climbEscalated: SOL,
  /** Text fallback when Claude is unavailable. */
  fallback: SOL,
} as const;

export function routesEnabled(): boolean {
  return (typeof process !== "undefined" ? process.env.CLIMBOS_ROUTES : undefined) !== "classic";
}

/** Apply the route for an agent id over its default (classic) models. */
export function routeModels(id: string, classic: PhaseModels): PhaseModels {
  if (!routesEnabled()) return classic;
  return { ...classic, ...(ROUTES[id] ?? {}) };
}
