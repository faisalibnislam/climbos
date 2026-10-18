import type { ModelKey } from "../economics/rates";
import type { PhaseModels } from "./types";

/**
 * Model routes (owner decision, 18 Oct 2026): OpenAI only, Anthropic dropped.
 * - Climb AI Basic (free, and paid by choice): Luna for every phase.
 * - Climb AI Expert (paid only): Sol writes the draft (and any revision) for
 *   the growth plan, business insights, ads and the weekly autopilot plan;
 *   Luna researches and reviews. Every other job stays on Luna.
 * No fallback model: when OpenAI is unavailable a job pauses and resumes
 * from its checkpoints (Retry).
 */

const LUNA: ModelKey = "gpt-6-luna";
const SOL: ModelKey = "gpt-6.1-sol";

export const ROUTE_VERSION = "openai-2026-10-18";

export type AiMode = "basic" | "expert";

export const AI_MODES: Record<AiMode, { label: string; short: string }> = {
  basic: { label: "Climb AI Basic", short: "Fast and low-cost. Good for most work." },
  expert: { label: "Climb AI Expert", short: "Deeper analysis for plans, insights, ads and the weekly plan." },
};

/** Agents whose draft Sol writes in Expert mode. */
export const EXPERT_AGENTS: ReadonlySet<string> = new Set(["business_insights", "channel_fit", "growth_plays", "growth_strategy", "ad_drafts", "social_calendar"]);

/** Job kinds where the Basic/Expert choice changes anything. */
export const EXPERT_KINDS: ReadonlySet<string> = new Set(["onboarding_research", "strategy", "content_ads", "social_calendar"]);

/** Models for an agent in a mode. Basic is all Luna; Expert swaps in Sol for the draft on EXPERT_AGENTS. */
export function routeModels(id: string, mode: AiMode = "basic"): PhaseModels {
  const sol = mode === "expert" && EXPERT_AGENTS.has(id);
  return { research: LUNA, draft: sol ? SOL : LUNA, critic: LUNA, revise: sol ? SOL : LUNA };
}

/** Basic strategy work: Luna writes two first drafts and the reviewer keeps the stronger (still far cheaper than Sol). */
const BEST_OF_TWO: ReadonlySet<string> = new Set(["business_insights", "growth_plays", "growth_strategy"]);

export function draftsFor(id: string, mode: AiMode = "basic"): number {
  return mode === "basic" && BEST_OF_TWO.has(id) ? 2 : 1;
}

/** Single-call tasks outside the agent loop. */
export const CALL_ROUTES = {
  /** Understanding a wish. */
  chat_intent: LUNA,
  /** Climb AI chat: always Luna. */
  climb: LUNA,
} as const;
