import type { ModelKey } from "../economics/rates";
import type { PhaseModels } from "./types";

/** Stable tier slots, retained so stored OpenAI runs keep their original route. */
export const STANDARD_SLOT: ModelKey = "gpt-6-luna";
export const ADVANCED_SLOT: ModelKey = "gpt-6.1-sol";
export const ROUTE_VERSION = "anthropic-2026-11-09";
export type AiMode = "basic" | "expert";
export const AI_MODES: Record<AiMode, { label: string; short: string }> = {
  basic: { label: "Climb AI Basic", short: "Haiku handles routine work; Sonnet writes and reviews recommendations." },
  expert: { label: "Climb AI Expert", short: "Sonnet gives important decisions deeper analysis." },
};

/** These agents interpret evidence or create customer-facing work. Never cheapen their review. */
export const SONNET_AGENTS: ReadonlySet<string> = new Set([
  "business_insights", "channel_fit", "growth_plays", "growth_strategy", "business_model_check",
  "social_posts", "social_calendar", "ad_drafts", "email_sequence", "seo_brief", "conversion_audit",
  "retention_plan", "sales_sequence", "cold_outreach", "creator_outreach", "creator_scout",
]);
export const EXPERT_AGENTS: ReadonlySet<string> = new Set(["business_insights", "channel_fit", "growth_plays", "growth_strategy", "ad_drafts", "social_calendar"]);
export const EXPERT_KINDS: ReadonlySet<string> = new Set(["onboarding_research", "strategy", "content_ads", "social_calendar"]);

/** Unresolved tier slots. Jobs resolve them once against their stored provider route. */
export function routeModels(id: string, mode: AiMode = "basic", policy: string = ROUTE_VERSION): PhaseModels {
  const strong = policy === ROUTE_VERSION && SONNET_AGENTS.has(id);
  const writer = strong ? ADVANCED_SLOT : STANDARD_SLOT;
  void mode; // Expert changes effort, rather than silently choosing a third model.
  return { research: STANDARD_SLOT, draft: writer, critic: strong ? ADVANCED_SLOT : STANDARD_SLOT, revise: writer };
}

/** Legacy runs retain their measured OpenAI escalation; new Sonnet work needs no third model. */
export function expertEscalationModel(id: string, mode: AiMode, policy: string = ROUTE_VERSION): ModelKey | undefined {
  return policy !== ROUTE_VERSION && mode === "expert" && EXPERT_AGENTS.has(id) ? ADVANCED_SLOT : undefined;
}
export function draftsFor(id: string, mode: AiMode = "basic", policy: string = ROUTE_VERSION): number {
  return policy !== ROUTE_VERSION && mode === "basic" && ["business_insights", "growth_plays", "growth_strategy"].includes(id) ? 2 : 1;
}
export const CALL_ROUTES = { chat_intent: STANDARD_SLOT, climb: STANDARD_SLOT } as const;

/** Legacy one-shot paths also use Sonnet for judgment/copy; simple extraction stays on Haiku. */
export function taskModelSlot(task: string, policy: string = ROUTE_VERSION): ModelKey | undefined {
  if (policy !== ROUTE_VERSION) return undefined;
  if (task === "preview_ideas" || task === "metric_explanation" || SONNET_AGENTS.has(task)) return ADVANCED_SLOT;
  return STANDARD_SLOT;
}

/** Output budgets include reasoning. No universal 24k/12k floor for small tasks. */
export function phaseTokenLimits(id: string, requested: { research: number; draft: number; critic: number }) {
  const draft = id === "growth_plays" ? 32_000 : ["business_model_check", "business_insights", "seo_brief"].includes(id) ? 24_000
    : ["growth_strategy", "conversion_audit"].includes(id) ? 16_000
    : SONNET_AGENTS.has(id) ? 12_000 : 6_000;
  return { research: Math.min(requested.research, 8_000), draft: Math.min(requested.draft, draft), critic: Math.min(requested.critic, 6_000) };
}
