import type { ModelKey } from "./rates";

/**
 * The ten coordinated ClimbOS roles and their Growth-base monthly design
 * budgets (blueprint section 3 / workbook "Agents" sheet). Token budgets include
 * system prompts, retrieved context, tool results and billed reasoning.
 */
export type RoleKey =
  | "ceo"
  | "coo"
  | "cmo"
  | "cso"
  | "creative_director"
  | "social_media_manager"
  | "ads_manager"
  | "seo_specialist"
  | "data_analyst"
  | "customer_success_manager";

export interface RoleBudget {
  key: RoleKey;
  title: string;
  /** Plain-language description shown to owners. */
  plainTitle: string;
  task: string;
  baseRunsPerMonth: number;
  inputTokensPerRun: number;
  outputTokensPerRun: number;
}

export const ROLE_BUDGETS: readonly RoleBudget[] = Object.freeze([
  {
    key: "ceo",
    title: "CEO",
    plainTitle: "Strategy lead",
    task: "Goal decomposition, priorities and monthly synthesis",
    baseRunsPerMonth: 8,
    inputTokensPerRun: 16_000,
    outputTokensPerRun: 3_000,
  },
  {
    key: "coo",
    title: "COO",
    plainTitle: "Operations lead",
    task: "Understands requests and summarizes work; code executes workflows",
    baseRunsPerMonth: 300,
    inputTokensPerRun: 2_000,
    outputTokensPerRun: 400,
  },
  {
    key: "cmo",
    title: "CMO",
    plainTitle: "Marketing lead",
    task: "Positioning, channel plan and experiment design",
    baseRunsPerMonth: 20,
    inputTokensPerRun: 12_000,
    outputTokensPerRun: 2_500,
  },
  {
    key: "cso",
    title: "CSO",
    plainTitle: "Sales lead",
    task: "Owned-lead qualification, funnel and offer drafts",
    baseRunsPerMonth: 120,
    inputTokensPerRun: 6_000,
    outputTokensPerRun: 1_200,
  },
  {
    key: "creative_director",
    title: "Creative Director",
    plainTitle: "Creative lead",
    task: "Concepts, copy and image briefs",
    baseRunsPerMonth: 120,
    inputTokensPerRun: 4_000,
    outputTokensPerRun: 1_000,
  },
  {
    key: "social_media_manager",
    title: "Social Media Manager",
    plainTitle: "Social media",
    task: "Captions, variants, alt text and calendar",
    baseRunsPerMonth: 300,
    inputTokensPerRun: 3_000,
    outputTokensPerRun: 600,
  },
  {
    key: "ads_manager",
    title: "Ads Manager",
    plainTitle: "Ads",
    task: "Ad drafts and explanations of bounded recommendations",
    baseRunsPerMonth: 120,
    inputTokensPerRun: 6_000,
    outputTokensPerRun: 1_000,
  },
  {
    key: "seo_specialist",
    title: "SEO Specialist",
    plainTitle: "Search (SEO)",
    task: "Sourced research and outlines",
    baseRunsPerMonth: 80,
    inputTokensPerRun: 10_000,
    outputTokensPerRun: 1_600,
  },
  {
    key: "data_analyst",
    title: "Data Analyst",
    plainTitle: "Numbers",
    task: "Explains computed metrics and forecasts; statistical code produces numbers",
    baseRunsPerMonth: 120,
    inputTokensPerRun: 8_000,
    outputTokensPerRun: 1_200,
  },
  {
    key: "customer_success_manager",
    title: "Customer Success Manager",
    plainTitle: "Customer care",
    task: "Retention segments and opt-in lifecycle drafts",
    baseRunsPerMonth: 120,
    inputTokensPerRun: 4_000,
    outputTokensPerRun: 800,
  },
]);

export const ROLE_KEYS: readonly RoleKey[] = ROLE_BUDGETS.map((r) => r.key);

export function getRoleBudget(key: RoleKey): RoleBudget {
  const role = ROLE_BUDGETS.find((r) => r.key === key);
  if (!role) throw new Error(`Unknown role: ${key}`);
  return role;
}

export interface RoleRoute {
  primary: ModelKey;
  /** Fallback route. Requires a fresh cost reservation before use. */
  fallback: ModelKey;
}

export interface RoutingVersion {
  id: string;
  label: string;
  routes: Record<RoleKey, RoleRoute>;
  notes: readonly string[];
}

/** Workbook routing (includes OpenAI routes). Regression fixture: never edit. */
export const ROUTING_RESEARCH_2026_10_17: RoutingVersion = Object.freeze<RoutingVersion>({
  id: "routing-research-2026-10-17",
  label: "Blueprint routing (workbook fixture)",
  routes: {
    ceo: { primary: "claude-sonnet-5.5", fallback: "gpt-6.1-sol" },
    coo: { primary: "gpt-6-luna", fallback: "claude-haiku-5.5" },
    cmo: { primary: "claude-sonnet-5.5", fallback: "gpt-6.1-sol" },
    cso: { primary: "gpt-6-luna", fallback: "gemini-3.1-flash-lite" },
    creative_director: { primary: "claude-sonnet-5.5", fallback: "gpt-6.1-sol" },
    social_media_manager: { primary: "claude-haiku-5.5", fallback: "gpt-6-luna" },
    ads_manager: { primary: "gpt-6-luna", fallback: "claude-haiku-5.5" },
    seo_specialist: { primary: "gemini-3.8-flash", fallback: "claude-sonnet-5.5" },
    data_analyst: { primary: "gemini-3.1-flash-lite", fallback: "gpt-6-luna" },
    customer_success_manager: { primary: "gpt-6-luna", fallback: "claude-haiku-5.5" },
  },
  notes: ["Original blueprint routing across Anthropic, OpenAI and Google."],
});

/**
 * Production routing: Anthropic + Google only (owner decision, 17 Oct 2026).
 * GPT-6 Luna routes move to Claude Haiku 5.5 (identical research-time rates);
 * GPT-6.1 Sol quality fallbacks move to a cross-provider Gemini fallback, which
 * is cheaper than the route it replaces, so the modeled margin cannot decrease.
 */
export const ROUTING_CLIMBOS_2026_10_17: RoutingVersion = Object.freeze<RoutingVersion>({
  id: "routing-climbos-2026-10-17",
  label: "ClimbOS production routing (Claude + Gemini)",
  routes: {
    ceo: { primary: "claude-sonnet-5.5", fallback: "gemini-3.8-flash" },
    coo: { primary: "claude-haiku-5.5", fallback: "gemini-3.1-flash-lite" },
    cmo: { primary: "claude-sonnet-5.5", fallback: "gemini-3.8-flash" },
    cso: { primary: "claude-haiku-5.5", fallback: "gemini-3.1-flash-lite" },
    creative_director: { primary: "claude-sonnet-5.5", fallback: "gemini-3.8-flash" },
    social_media_manager: { primary: "claude-haiku-5.5", fallback: "gemini-3.1-flash-lite" },
    ads_manager: { primary: "claude-haiku-5.5", fallback: "gemini-3.1-flash-lite" },
    seo_specialist: { primary: "gemini-3.8-flash", fallback: "claude-sonnet-5.5" },
    data_analyst: { primary: "gemini-3.1-flash-lite", fallback: "claude-haiku-5.5" },
    customer_success_manager: { primary: "claude-haiku-5.5", fallback: "gemini-3.1-flash-lite" },
  },
  notes: [
    "OpenAI is not used. Luna-routed roles use Claude Haiku 5.5 at identical rates.",
    "Fallbacks are cross-provider so a single-provider outage degrades gracefully.",
  ],
});

export const ROUTING_VERSIONS: readonly RoutingVersion[] = [
  ROUTING_RESEARCH_2026_10_17,
  ROUTING_CLIMBOS_2026_10_17,
];

export function getRoutingVersion(id: string): RoutingVersion {
  const v = ROUTING_VERSIONS.find((r) => r.id === id);
  if (!v) throw new Error(`Unknown routing version: ${id}`);
  return v;
}

export const CURRENT_ROUTING = ROUTING_CLIMBOS_2026_10_17;
