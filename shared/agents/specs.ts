import { z } from "zod";
import { lintWordCaps, PLAN_CAPS, PLAYS_CAPS } from "./wordCaps";
import { customerValue, lintEconomics, playMaths, portfolioExpectedCustomers, portfolioP50, portfolioRange, selectPortfolio, withForecasts, type Economics, type ForecastUncertainty, type PlayLike, type PlaySensitivity } from "./economics";
import type { FinancialEvidence } from "./provenance";
import { PROVENANCE } from "./provenance";
import { DECISION_CAPS, DecisionSchema, lintDecision, type Decision } from "./decision";
import type { PlanQuality } from "./quality";
import type { GoalGap, GoalTarget } from "./goal";
import type { RefundExposure } from "../attribution/refundExposure";
import type { PlatformConcentration } from "../attribution/platformConcentration";
import type { KnowledgeReferenceSet } from "../knowledge/retrieve";
import type { PlanConstraints } from "./types";
import { LOW_TICKET_USD_MONTH } from "../acquisition/scoring";
import { formatMoney, toUsd } from "../economics/currency";
import { sampleSize } from "../analysis/decisions";
import { citedCreatorCompetitorCollaborations, citedCreatorFact } from "../growth/targets";
import type { Effort } from "../ai/types";
import {
  AdDraftsSchema,
  BusinessInsightsSchema,
  SwotEvidenceSchema,
  SwotMoveSchema,
  ConversionAuditSchema,
  EmailSequenceSchema,
  RetentionPlanSchema,
  SalesSequenceSchema,
  SeoBriefSchema,
  SocialPostsSchema,
  StrategySchema,
  type TaskType,
} from "../ai/tasks";
import { skillRubric } from "../skills";
import { lintEvidenceStrength } from "./evidenceKind";
import { inferSearchIntentStage } from "./searchIntent";
import { lintFactIndexes } from "./factIndexes";
import { lintDiagnosisFit, playWorksOnConstraint } from "./diagnosis";
import { lintEligibilityIds } from "../playbooks/contracts";
import { lintPlatformEligibility } from "../acquisition/platformRules";
import { hookBeforeFold, lintClaims, lintCopy, maxItems, maxLength, minItems, stringFields } from "./lint";
import type { AgentInput, AgentSpec, LintIssue, PhaseModels, ResearchSpec, Rubric } from "./types";

/**
 * Engine v2 agent definitions: one expert agent per kind of work. Schemas
 * extend the v1 task schemas (additive fields only), so everything that saves
 * or shows v1 output keeps working while the richer fields carry the expert
 * detail. Models and efforts are the starting point; the benchmark decides.
 */

import { routeModels } from "./routes";


/* ---------------- Schemas (v1 + expert fields) ---------------- */

const force = z.enum(["push", "pull", "anxiety", "habit"]);

export const InsightsV2Schema = BusinessInsightsSchema.extend({
  audiences: z.array(BusinessInsightsSchema.shape.audiences.element.extend({
    needs: z.array(z.object({ statement: z.string().max(240), basis: z.enum(["owner_report", "measured", "research", "inference"]), evidenceRefs: z.array(z.string()).max(4) })).max(4),
    objections: z.array(z.object({ statement: z.string().max(240), basis: z.enum(["owner_report", "measured", "research", "inference"]), evidenceRefs: z.array(z.string()).max(4) })).max(4),
    purchasingMotivations: z.array(z.object({ statement: z.string().max(240), basis: z.enum(["owner_report", "measured", "research", "inference"]), evidenceRefs: z.array(z.string()).max(4) })).max(4),
    channelPreferences: z.array(z.object({ channel: z.string().max(100), rationale: z.string().max(240), basis: z.enum(["owner_report", "measured", "research", "inference"]), evidenceRefs: z.array(z.string()).max(4) })).max(4),
  })).max(5),
  swot: z.object({
    strengths: z.array(z.string()).max(4),
    weaknesses: z.array(z.string()).max(4),
    opportunities: z.array(z.string()).max(4),
    threats: z.array(z.string()).max(4),
  }),
  swotEvidence: z.array(SwotEvidenceSchema).max(16),
  swotMoves: z.array(SwotMoveSchema).max(8),
  siteAssessment: z.array(z.object({
    dimension: z.enum(["offer_clarity", "buyer_specificity", "proof_presentation", "conversion_path", "trust_signals", "messaging_consistency"]),
    observation: z.string().max(360),
    evidenceQuote: z.string().min(1).max(240),
    sourceUrl: z.string(),
    implication: z.string().max(360),
  })).max(8),
  competitors: z.array(
    BusinessInsightsSchema.shape.competitors.element.extend({
      kind: z.enum(["direct", "adjacent"]),
      comparison: z.array(z.object({
        dimension: z.enum(["target_customer", "positioning", "offer", "pricing", "proof", "distribution", "experience", "other"]),
        finding: z.string().max(500),
        sourceUrl: z.string(),
        implication: z.string().max(500),
      })).max(8).optional(),
    }),
  ),
  alternatives: z.array(z.object({ name: z.string(), kind: z.enum(["competitor", "adjacent", "diy", "hire", "marketplace", "do_nothing", "other"]), evidence: z.string(), sourceUrl: z.string() })),
  vocPhrases: z.array(z.object({ phrase: z.string(), theme: z.string(), sourceUrl: z.string() })),
  objections: z.array(z.object({ objection: z.string(), force, counter: z.string(), sourceUrl: z.string() })),
  gaps: z.array(z.object({ gap: z.string(), evidence: z.string(), risk: z.string(), sourceUrl: z.string() })),
  positioningStatement: z.string(),
  confidenceNotes: z.string(),
});
export type InsightsV2 = z.infer<typeof InsightsV2Schema>;

/** A growth play card (skills/growth-plays): creative, forecast with base rates, testable. */
/**
 * Where a number came from: owner (a number the owner actually gave in the brief or facts), research the writer read
 * (ref = URL), a named benchmark (ref = its name), planned (an allocation the planner proposes within the owner's
 * limits, e.g. spend or hours), or an assumption (ref = ""). ClimbOS checks these tags after writing.
 */
export const ProvenanceSchema = z.enum(PROVENANCE);
/** Research context is copied from the same cited evidence; verifier checks each item before a rate is called sourced. */
export const SourceTagSchema = z.object({
  source: ProvenanceSchema,
  ref: z.string(),
  /** For research, the exact sentence from the page that states the number (≤ 200 characters); "" otherwise. */
  quote: z.string(),
  population: z.string().max(120).optional(),
  denominator: z.string().max(120).optional(),
  period: z.string().max(80).optional(),
});

export const PlaySchema = z.object({
  name: z.string(),
  oneLiner: z.string(),
  kind: z.enum(["bankable", "creative", "moonshot"]),
  /** Who and where, with size when known, e.g. "HR managers in Austin · SHRM Austin chapter (1,200 members)". */
  audience: z.string(),
  trigger: z.string(),
  hook: z.string(),
  mechanic: z.string(),
  assetUsed: z.string(),
  /**
   * How qualified people reach the asset this play changes or builds: channel, expected visitors a week with its source
   * (or how it's measured when unknown), cost and owner time, e.g. "Creator test: 10 coaching YouTubers pitched
   * (planned), ~40 visits a week (assumption); $0, 1 owner hour a week". "" for a play that is itself the channel.
   */
  route: z.string(),
  /** One step per line: "500 postcards → calls: 1–4.5%, plan 2% [source.com, C]". */
  funnel: z.array(z.string()),
  unit: z.string(),
  p10: z.number(),
  p50: z.number(),
  p90: z.number(),
  /** Code-generated separation of modeled play-attributed outcomes from counterfactual lift. */
  outcomeAccounting: z.object({
    attributionBasis: z.literal("modeled_play_funnel"),
    attributedCustomers: z.object({ p10: z.number(), p50: z.number(), p90: z.number() }),
    attributedRevenue12m: z.object({ p10: z.number(), p50: z.number(), p90: z.number() }).nullable(),
    incrementalityBasis: z.enum(["modeled_baseline_delta", "not_estimated"]),
    modeledIncrementalCustomers: z.object({ p10: z.number(), p50: z.number(), p90: z.number() }).nullable(),
    modeledIncrementalRevenue12m: z.object({ p10: z.number(), p50: z.number(), p90: z.number() }).nullable(),
    currency: z.string(),
    revenueHorizonMonths: z.literal(12),
  }).nullable().optional(),
  /** Code-generated explanation of the forecast range; absent on older saved plans. */
  forecastUncertainty: z.object({
    rangeMethod: z.enum(["input_scenario", "single_scenario"]),
    variedDrivers: z.array(z.string()),
    statisticalInterval: z.literal("not_estimated"),
    calibratedToBusiness: z.literal(false),
    timing: z.object({ reachRamp: z.enum(["modeled", "immediate_assumed"]), paidConversionLag: z.enum(["modeled", "none_assumed"]) }),
    omittedFactors: z.tuple([z.literal("seasonality"), z.literal("execution_variation"), z.literal("model_error")]),
  }).optional(),
  /** Code-generated input quality for the cost/payback comparison; absent on older saved plans. */
  financialEvidence: z.object({
    status: z.enum(["checked_inputs", "conditional_scenario", "unlabelled_scenario"]),
    assumed: z.array(z.string()),
    unchecked: z.array(z.string()),
    planned: z.array(z.string()),
  }).nullable().optional(),
  horizonDays: z.number(),
  confidence: z.enum(["high", "medium", "low"]),
  biggestUnknown: z.string(),
  /** Size, budget and duration, e.g. "500 cards · $260 · 21 days". */
  test: z.string(),
  killIf: z.string(),
  scaleIf: z.string(),
  /** 1-5 each: fit, predictability, leverage, timeToSignal, compounding, cost, risk, distinctiveness. */
  scores: z.array(z.number()),
  firstActionToday: z.string(),
  /** Typed chain from the diagnosed constraint to a measurable owner action. */
  actionContract: z.object({
    diagnosis: z.string().min(1),
    intendedEffect: z.string().min(1),
    evidenceBasis: z.enum(["assumption", "inference", "measured", "owner_report", "source_claim"]),
    evidenceNote: z.string().min(1),
    evidenceRefs: z.array(z.string()).max(8),
    targetOrAsset: z.string().min(1),
    resourcePlan: z.string().min(1),
    executionCapability: z.enum(["owner", "climbos", "existing_integration", "external_setup", "unknown"]),
    dependencies: z.array(z.string()).max(8),
    measurement: z.object({
      metric: z.string().min(1),
      baseline: z.string().min(1),
      target: z.string().min(1),
      windowDays: z.number().int().min(1).max(365),
      source: z.string().min(1),
    }),
  }),
  /** Derived by ClimbOS from the action's declared dependencies and capability. */
  actionReadiness: z.object({ status: z.enum(["safe_to_start", "depends_on_input"]), reasons: z.array(z.string()) }).optional(),
  climbosCanDo: z.string(),
  /** The play's numbers; ClimbOS code (not the model) turns them into customers, cost per customer and payback. */
  model: z.object({
    /** Right-fit people reached per week at the planned volume, with a realistic low and high. */
    weeklyReach: z.number(),
    weeklyReachLow: z.number(),
    weeklyReachHigh: z.number(),
    /** Optional scenario inputs; omitted values mean immediate scale and paid conversion. */
    rampWeeks: z.number().min(0).max(365).optional().describe("Weeks until this play reaches its planned weekly reach. Include only when supported by business evidence or an explicitly labeled scenario assumption."),
    salesLagDays: z.number().min(0).max(365).optional().describe("Days from reaching a prospect to paid conversion. Include only when supported by business evidence or an explicitly labeled scenario assumption."),
    reachSource: SourceTagSchema,
    /**
     * Funnel steps from reach to a paying customer; rate = most-likely share passing (0–1), low/high = the cited range; source = where the rate came from.
     * baselineRate = today's rate at a step the play changes (onboarding, checkout, follow-up), so only the extra customers count.
     */
    steps: z.array(z.object({ name: z.string(), rate: z.number(), low: z.number(), high: z.number(), source: ProvenanceSchema, ref: z.string(), quote: z.string(), population: z.string().max(120).optional(), denominator: z.string().max(120).optional(), period: z.string().max(80).optional(), baselineRate: z.number().optional() })),
    monthlySpendUsd: z.number(),
    spendSource: SourceTagSchema,
    ownerHoursPerWeek: z.number(),
    /** Monthly non-media costs for this play (tools, freelancers, creative); 0 when none. Counted in cost per customer. */
    otherMonthlyUsd: z.number().optional(),
    otherSource: SourceTagSchema.optional(),
    hoursSource: SourceTagSchema,
  }),
});
export type Play = z.infer<typeof PlaySchema>;
/** What the plays agent writes: no forecast numbers (ClimbOS code computes P10/P50/P90 from the model). */
export const PlayDraftSchema = PlaySchema.omit({ p10: true, p50: true, p90: true, outcomeAccounting: true, forecastUncertainty: true, financialEvidence: true, actionReadiness: true });
export type PlayDraft = z.infer<typeof PlayDraftSchema>;

export function actionReadinessOf(action: PlayDraft["actionContract"]): NonNullable<Play["actionReadiness"]> {
  const reasons = [...action.dependencies];
  if (action.executionCapability === "external_setup") reasons.push("External setup is required.");
  if (action.executionCapability === "unknown") reasons.push("Execution capability is not established.");
  if (action.executionCapability === "climbos") reasons.push("Confirm the required ClimbOS capability is available for this action.");
  if (action.executionCapability === "existing_integration") reasons.push("Confirm the required integration is connected and authorized.");
  return { status: reasons.length ? "depends_on_input" : "safe_to_start", reasons: [...new Set(reasons)] };
}

export const SCORE_KEYS = ["fit", "predictability", "leverage", "timeToSignal", "compounding", "cost", "risk", "distinctiveness"] as const;
export type PlayScores = Record<(typeof SCORE_KEYS)[number], number>;

export function playScores(p: Pick<Play, "scores">): PlayScores {
  return Object.fromEntries(SCORE_KEYS.map((k, i) => [k, Math.max(1, Math.min(5, Math.round(p.scores[i] ?? 1)))])) as PlayScores;
}

/** Weighted play score (growth-plays rubric), 20–100. */
export function playScore(p: Pick<Play, "scores">): number {
  const s = playScores(p);
  return Math.round(20 * (0.25 * s.fit + 0.2 * s.predictability + 0.15 * s.leverage + 0.1 * s.timeToSignal + 0.1 * s.compounding + 0.1 * s.cost + 0.1 * s.risk));
}

/** What a channel or audience rests on (Book 14 §5): "fact:N" (a confirmed fact's index) or a research URL; [] for a judgment call. */
const CITES = z.array(z.string());

export const StrategyV2Schema = StrategySchema.extend({
  audiences: z.array(StrategySchema.shape.audiences.element.extend({ cites: CITES })),
  channels: z.array(StrategySchema.shape.channels.element.extend({ cites: CITES })),
  diagnosis: z.string(),
  affordableCac: z.string(),
  notDoing: z.array(z.object({ channel: z.string(), why: z.string() })),
  northStar: z.object({ metric: z.string(), baseline: z.string(), target: z.string() }),
  leadingIndicators: z.array(z.object({ metric: z.string(), weeklyTarget: z.string(), source: z.string() })),
  phases: z.array(z.object({ name: z.string(), days: z.string(), focus: z.string() })),
  weekOneChecklist: z.array(z.string()),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })),
});
/** Saved plans also carry the growth-plays portfolio (produced by its own agent). */
export type StrategyV2 = z.infer<typeof StrategyV2Schema> & { constraintDiagnosis?: unknown; playbooks?: unknown; portfolio?: unknown; plays?: Play[]; economics?: PlaysOutput["economics"]; decision?: Decision | null; webSources?: { url: string; title?: string }[]; snapshot?: PlanSnapshot; quality?: PlanQuality | null; goalGap?: GoalGap | null };
export interface BusinessFunnelSnapshot { periodDays: number; visitors?: number; leads?: number; qualifiedLeads?: number; qualificationDefinition?: string; activated?: number; newCustomers?: number; activationKind?: "value" | "habit" | "setup" | "unknown"; signupKind?: "free_plan" | "trial_no_card" | "trial_card" | "unknown"; updatedAt: number }
export interface GoalInputSnapshot { id: string; kind: "more_sales" | "more_customers" | "more_reach" | "custom"; statement: string; horizonDays: number; monthlyAdBudgetMinor: number; currency: string; target: GoalTarget | null }
export interface PlanSnapshot { snapshotVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18; snapshotId: string; capturedAt: number; engine: string; aiMode: string; goal: string; horizonDays: number; monthlyAdBudget: number; currency?: string; facts: number; factVersions: { id: string; updatedAt: number }[]; businessProfile?: unknown; businessFactVersions?: { id: string; updatedAt: number }[]; brandProfile?: unknown; ownerAcquisitionTypes?: string[] | null; ownerAcquisitionDimensions?: Record<string, string>; ownerChannelPreferences?: { channelId: string; preference: "prefer" | "avoid"; rationale: string }[]; businessResearchAt?: number | null; marketChangeVersions?: { id: string; at: number }[]; staleFactIds: string[]; contradictions: { subject: string; values: string[]; factIds: string[] }[]; insightsChars: number; insightsHash: string; sourceUrls: string[]; capabilities: string[]; businessLifecycleStage?: { stage: string; provenance: "owner_reported"; updatedAt: number } | null; businessFunnel?: BusinessFunnelSnapshot | null; goalInput?: GoalInputSnapshot | null; knowledgeReferences?: KnowledgeReferenceSet; ownerEconomics?: unknown; refundExposure?: RefundExposure; channelOutcomes?: PlatformConcentration; goalTarget?: GoalTarget; flags?: string[] }
/** Bump when the plan pipeline changes in a way that could change results. */
export const ENGINE_VERSION = "v3.54-built-in-agent-feedback";

/** The growth-plays agent's output: 1 bankable, 1-2 creative-proven, at most 1 capped moonshot (≤ 4). */
export const PlaysOutputSchema = z.object({
  /** One or two sentences: why this portfolio, for this business, now. */
  portfolioNote: z.string(),
  /** What one customer is worth (facts first, else labelled assumptions in `basis`). */
  economics: z.object({
    revenuePerCustomerMonthUsd: z.number(),
    /** Contribution margin before acquisition, 0–1. */
    grossMargin: z.number(),
    /** Share of customers lost per month, 0–1. */
    monthlyChurn: z.number(),
    basis: z.string(),
    /** Where revenue, margin and churn came from. ClimbOS derives the "assumed" list from these. */
    sources: z.object({ revenue: SourceTagSchema, margin: SourceTagSchema, churn: SourceTagSchema }),
  }),
  plays: z.array(PlayDraftSchema),
});
/** With the decision_contract flag, the plays agent also writes the structured decision the plays rest on (REQ-STRAT-01/02). */
export const PlaysDecisionOutputSchema = PlaysOutputSchema.extend({ decision: DecisionSchema });
/** `economics.currency` is set by code after the agent (the workspace currency every amount is in). */
export type PlaysOutput = Omit<z.infer<typeof PlaysOutputSchema>, "economics"> & { economics: z.infer<typeof PlaysOutputSchema>["economics"] & { currency?: string }; decision?: Decision };
/** Saved portfolio: the agent's plays plus the forecast ClimbOS computed. */
export type PlaysWithForecast = Omit<PlaysOutput, "plays"> & { plays: (Play & { sensitivity: PlaySensitivity[]; forecastUncertainty: ForecastUncertainty | null; financialEvidence: FinancialEvidence | null })[] };

const VANITY = /\b(awareness|impressions|engagement|followers|reach|likes|views)\b/i;
const GENERIC = /\b(post consistently|build a community|leverage social media|increase brand awareness|engage with your audience|create valuable content|optimi[sz]e your seo|run targeted ads|start a blog|partner with influencers|go viral|thought leadership|omnichannel|drive engagement)\b/i;
const CATEGORY_ONLY_ACTION = /^\s*(?:use influencers?|do seo|run email campaigns?|post consistently|run targeted ads|start a blog|build a community|leverage social media|increase brand awareness|engage with your audience|create valuable content|optimi[sz]e your seo|partner with influencers|drive engagement|thought leadership|omnichannel)\s*[.!]?\s*$/i;

/** Deterministic portfolio checks (growth-plays §3–4). */
const CUSTOMER_UNIT = /customer|client|account|member|order|booking|job|sale|subscriber|patient|student|deal|sign-?up/i;
/** A funnel's last step must be the paying outcome, not an intermediate action (bench 2026-10-19: signups and clicks counted as customers). */
/** Units that are paying outcomes (sign-ups, visits and events aren't). */
const PAYING_UNIT = /customer|client|account|member|order|booking|booked|job|sale|subscri|patient|student|deal|team|seat|purchase|buyer|user.*paid|paid/i;
const PAYING_STEP = /paid|pay|purchas|buy|bought|customer|order|subscri|upgrad|clos|won|win|sale|client|deal|contract|enrol|member|convert/i;
const INTERMEDIATE_STEP = /click|visit|view|open|repl|lead|sign-?up|trial|install|download|register|demo|call|book|follow|watch|read|start/i;
const STOP = new Set(["with", "your", "their", "this", "that", "from", "into", "page", "pages", "play", "they", "them", "then", "each", "more", "about", "every", "week", "weekly"]);
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)));
/** Jaccard similarity of two word sets. */
const overlap = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  const inter = [...a].filter((w) => b.has(w)).length;
  return inter / (a.size + b.size - inter);
};

export function lintPlays(drafts: PlayDraft[], economics?: Economics, opts: { decisionContract?: boolean } = {}): LintIssue[] {
  const plays = economics ? withForecasts({ economics, plays: drafts }).plays : (drafts as Play[]);
  const issues: LintIssue[] = [];
  const err = (message: string, path = "plays") => issues.push({ severity: "error", rule: "portfolio", message, path });
  const scored = plays.map((p) => ({ p, s: playScores(p) }));
  const bankable = scored.filter((x) => x.p.kind === "bankable");
  // "Bankable" is decided by computed robustness when what a customer is worth is known (Hubbard Ch 6/14): it must pay back
  // even at the low end of its own range. The model's 1–5 predictability score only decides when robustness can't be computed.
  const robust = (p: PlayDraft) => (economics && (p as { model?: { steps?: unknown[] } }).model?.steps?.length ? playMaths(p as never, economics).robustness : "unknown");
  scored.forEach((x, i) => {
    if (x.p.kind !== "bankable") return;
    const r = robust(x.p);
    if (r === "fragile") err(`"${x.p.name}" is labelled bankable but pays back only at its most-likely rates, not at the low end of its range (computed). Firm up the deciding input or call it creative with a capped test.`, `plays[${i}]`);
  });
  const scoreGate = (x: { p: PlayDraft; s: ReturnType<typeof playScores> }) => robust(x.p) === "unknown" && x.s.predictability < 4;
  if (opts.decisionContract) {
    // Focus over shape: 1–4 plays of any kind; the goal gap (code) reports a shortfall instead of pushing volume.
    if (plays.length < 1 || plays.length > 4) err(`${plays.length} plays; give 1 to 4.`);
    if (bankable.some(scoreGate)) err("A play labelled bankable needs predictability ≥ 4; otherwise call it creative.");
  } else {
    if (plays.length < 2 || plays.length > 4) err(`${plays.length} plays; the portfolio needs 2 to 4.`);
    if (bankable.length !== 1) err(`${bankable.length} bankable plays; exactly one is needed.`);
    if (bankable[0] && scoreGate(bankable[0])) err("The bankable play needs predictability ≥ 4.");
    if (!scored.some((x) => x.p.kind === "creative" && x.s.distinctiveness >= 4 && x.s.predictability >= 3)) err("At least one creative play needs distinctiveness ≥ 4 and predictability ≥ 3 (a proven mechanic on a non-obvious audience, asset or moment).");
  }
  if (plays.filter((p) => p.kind === "moonshot").length > 1) err("At most one moonshot.");
  // A plan with no plays can't drive work, whatever else it says (hard).
  if (!plays.length) issues.push({ severity: "error", rule: "no_plays", message: "No plays. Give at least one play with a weekly volume the owner can run now.", path: "plays" });
  // Two plays that are the same move count once.
  plays.forEach((p, i) => plays.slice(0, i).forEach((q) => {
    if (overlap(words(`${p.name} ${p.mechanic}`), words(`${q.name} ${q.mechanic}`)) >= 0.6) err(`"${p.name}" repeats "${q.name}". Merge them or replace one with a different move.`, `plays[${i}]`);
  }));
  // The forecast counts paying outcomes: the unit must be one, and so must the last step.
  plays.forEach((p, i) => {
    const last = p.model?.steps?.at(-1)?.name ?? "";
    const bookingUnit = /book|job|appointment/i.test(p.unit);
    if (p.model?.steps?.length && !PAYING_UNIT.test(p.unit))
      issues.push({ severity: "error", rule: "economics", message: `"${p.unit}" isn't a paying outcome. Use paying customers, orders or booked jobs as the unit, and add the steps that get there.`, path: `plays[${i}].unit` });
    else if (last && !bookingUnit && INTERMEDIATE_STEP.test(last) && !PAYING_STEP.test(last))
      issues.push({ severity: "error", rule: "economics", message: `The last step "${last}" isn't a paying ${p.unit.replace(/s$/, "")}. Add the step from it to paying (with its rate) so customers aren't overstated.`, path: `plays[${i}].model.steps` });
  });
  // Ambition: the portfolio must credibly move the goal, not run a cautious measurement exercise.
  const customerLike = plays.filter((p) => CUSTOMER_UNIT.test(p.unit));
  const combined = customerLike.reduce((s, p) => s + p.p50, 0);
  if (opts.decisionContract) {
    // No volume pressure: the goal gap shows how far the plays get, and why.
  } else if (customerLike.length && combined < 2) err(`The plays add up to ${Math.round(combined * 10) / 10} ${customerLike[0].unit} at P50 — too small to move the goal. Add a bankable demand-generation play that reaches enough of the right people (with a weekly volume), or raise the volume of the existing ones.`);
  else if (customerLike.length && combined < 5) issues.push({ severity: "warn", rule: "portfolio", message: `Combined P50 is only ${Math.round(combined * 10) / 10} ${customerLike[0].unit}; check the volumes are big enough to matter.`, path: "plays" });
  scored.forEach(({ p, s }, i) => {
    const path = `plays[${i}]`;
    if (p.scores.length !== 8) err("scores needs 8 numbers in order: fit, predictability, leverage, timeToSignal, compounding, cost, risk, distinctiveness.", `${path}.scores`);
    if (p.funnel.length < 2) err("The forecast needs a funnel with at least 2 steps.", `${path}.funnel`);
    if (VANITY.test(p.unit)) err(`"${p.unit}" is a vanity unit; use booked jobs, customers, members or revenue.`, `${path}.unit`);
    p.funnel.forEach((line, j) => {
      if (!/\[[^\]]+\]/.test(line) && !/assumption|grade d/i.test(line)) err("Every funnel step needs a [source, grade] or 'assumption, grade D'.", `${path}.funnel[${j}]`);
    });
    if (!p.killIf.trim() || !p.scaleIf.trim()) err("Every play needs kill and scale rules.", path);
    if (!p.audience.trim() || !p.hook.trim()) err("Every play needs a named audience and place, and an exact hook.", path);
    if (p.kind === "moonshot" && s.predictability > 2) issues.push({ severity: "warn", rule: "portfolio", message: "A moonshot with predictability > 2 could be a creative play instead.", path });
    if (CATEGORY_ONLY_ACTION.test(p.mechanic)) {
      issues.push({ severity: "error", rule: "generic_action", message: `"${p.mechanic}" is only a channel category, not a deliverable. Specify this business's audience, asset or offer, execution mechanic, distribution route, and first action.`, path: `${path}.mechanic` });
    } else if (GENERIC.test(`${p.name} ${p.oneLiner} ${p.mechanic}`)) {
      issues.push({ severity: "warn", rule: "generic", message: "Generic phrasing; name the audience, hook and number in the same sentence.", path });
    }
  });
  return issues;
}

const postFormat = z.enum(["text", "single_image", "carousel", "document", "reel", "thread", "story"]);
const copyAngleSchema = z.string().min(4).max(180);
export const CopyBriefSchema = z.object({
  reader: z.string(),
  situation: z.string(),
  awarenessStage: z.enum(["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware", "unknown"]),
  relationshipStage: z.enum(["cold", "prospect", "consented_lead", "customer", "returning_customer", "unknown"]),
  objective: z.string(),
  offerFactIndexes: z.array(z.number()),
  problemJob: z.string(),
  trigger: z.string(),
  centralIdea: z.string(),
  objection: z.string(),
  proofFactIndexes: z.array(z.number()),
  prohibitedClaims: z.array(z.string()),
  channel: z.string(),
  format: z.string(),
  deliveryContext: z.string(),
  brandVoice: z.string(),
  approvedExamples: z.array(z.string()).max(3),
  cta: z.string(),
  afterAction: z.string(),
  trackingMetric: z.string(),
  trackingMethod: z.string(),
  supportingFactIndexes: z.array(z.number()),
  supportingSourceUrls: z.array(z.string()),
  unknowns: z.array(z.string()),
});
export type CopyBrief = z.infer<typeof CopyBriefSchema>;

export const SocialPostsV2Schema = z.object({
  copyBrief: CopyBriefSchema,
  posts: z.array(
    SocialPostsSchema.shape.posts.element.extend({
      /** Internal strategy cue shown to the owner; keep it to one specific idea. */
      angle: copyAngleSchema,
      format: postFormat,
      hook: z.string(),
      slides: z.array(z.object({ heading: z.string(), body: z.string() })),
      videoScript: z.string(),
      visualBrief: z.string(),
      firstComment: z.string(),
    }),
  ),
});
export type SocialPostsV2 = z.infer<typeof SocialPostsV2Schema>;

export const AdDraftsV2Schema = AdDraftsSchema.extend({
  copyBrief: CopyBriefSchema,
  searchAds: z.array(
    AdDraftsSchema.shape.searchAds.element.extend({ angle: copyAngleSchema, paths: z.array(z.string()), negativeKeywords: z.array(z.string()), landingPageMatch: z.string() }),
  ),
  metaAds: z.array(
    AdDraftsSchema.shape.metaAds.element.extend({ concept: z.string(), angle: copyAngleSchema, format: z.enum(["image", "video", "carousel"]), creativeBrief: z.string() }),
  ),
});
export type AdDraftsV2 = z.infer<typeof AdDraftsV2Schema>;

export const EmailSequenceV2Schema = EmailSequenceSchema.extend({
  copyBrief: CopyBriefSchema,
  /** Campaign's organizing idea, distinct from each email's own angle. */
  angle: copyAngleSchema,
  emails: z.array(EmailSequenceSchema.shape.emails.element.extend({ angle: copyAngleSchema })),
  sender: z.string(),
  goal: z.string(),
  successMetric: z.string(),
});
export type EmailSequenceV2 = z.infer<typeof EmailSequenceV2Schema>;

export const SeoBriefV2Schema = SeoBriefSchema.extend({
  pageType: z.enum(["comparison", "alternatives", "service_location", "pricing", "how_to", "product", "category", "other"]),
  intentStage: z.enum(["awareness", "evaluation", "purchase", "unclear"]),
  intentEvidence: z.string(),
  eeatSignals: z.array(z.string()),
  recommendedAction: z.enum(["refresh_existing_page", "create_new_page"]),
  targetPageUrl: z.string(),
  recommendationReason: z.string(),
});

export const ConversionAuditV2Schema = ConversionAuditSchema.extend({
  clarityVerdict: z.string(),
  messageMatch: z.string(),
  prioritizedFixes: z.array(z.object({ fix: z.string(), why: z.string(), effort: z.enum(["small", "medium", "large"]), expectedEffect: z.string() })),
});

/* ---------------- Lint ---------------- */

const CHANNEL_SKILL: Record<string, string> = {
  linkedin: "linkedin-posts",
  instagram: "instagram-posts",
  facebook: "facebook-posts",
  x: "x-posts",
  tiktok: "short-video-scripts",
  youtube: "short-video-scripts",
  pinterest: "social-visual-briefs",
};

const CHANNEL_LIMITS: Record<string, { body: number; hashtags: number; fold?: number; emojiPer150: number }> = {
  linkedin: { body: 3000, hashtags: 3, fold: 140, emojiPer150: 1 },
  instagram: { body: 2200, hashtags: 5, fold: 125, emojiPer150: 2 },
  facebook: { body: 63206, hashtags: 2, fold: 125, emojiPer150: 1 },
  x: { body: 280, hashtags: 2, emojiPer150: 1 },
  tiktok: { body: 4000, hashtags: 5, emojiPer150: 2 },
  youtube: { body: 5000, hashtags: 3, emojiPer150: 2 },
  pinterest: { body: 500, hashtags: 5, emojiPer150: 1 },
};

/** Below this, a feed post reads as a stub (blind reviews penalised clipped Facebook and LinkedIn copy). */
const MIN_BODY_WORDS: Record<string, number> = { facebook: 40, linkedin: 50 };

/** Everything the writer was given: numbers in any prompt block trace (brief, facts, research, the task's inputs). */
function evidenceOf(input: AgentInput): string {
  return [input.brief, input.facts.join("\n"), input.untrustedContext ?? "", input.task].join("\n");
}

/**
 * Website copy, unreviewed research and stated opinions can describe a promise,
 * but cannot verify that the product delivers it. Use current confirmed facts
 * with stronger evidence kinds for the claim ledger.
 */
export function verifiedCapabilityEvidence(input: AgentInput): string {
  return input.facts.filter((_, i) => {
    const kind = input.constraints?.factKinds?.[i];
    return kind === "owner" || kind === "behavior" || kind === "measured";
  }).join("\n");
}

/** The output's own numeric fields (rates also as percentages), so prose may restate them. */
export function ownNumbers(v: unknown, out: string[] = []): string[] {
  if (typeof v === "number" && Number.isFinite(v)) {
    out.push(String(v));
    if (v > 0 && v < 1) out.push(String(Math.round(v * 10_000) / 100));
  } else if (Array.isArray(v)) v.forEach((x) => ownNumbers(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => ownNumbers(x, out));
  return out;
}

/** Domains named in "[source, grade]" funnel citations must be in what the writer was given (research notes, brief, facts). */
export function lintCitations(plays: { funnel: string[] }[], evidence: string): LintIssue[] {
  const ev = evidence.toLowerCase().replace(/https?:\/\/(www\.)?/g, "");
  const issues: LintIssue[] = [];
  plays.forEach((p, i) =>
    p.funnel.forEach((line, j) => {
      // "[source.com, C]" anywhere in the line, and any bare URL.
      const cited = [...line.matchAll(/\[([^\]]+?),\s*[ABCD]\]/g)].map((m) => m[1]).concat(line.match(/https?:\/\/[^\s,);\]]+/g) ?? []);
      const domains = [...new Set(cited.map((c) => c.toLowerCase().replace(/https?:\/\/(www\.)?/, "").match(/([a-z0-9-]+\.)+[a-z]{2,}/)?.[0]?.replace(/^www\./, "")).filter((d): d is string => Boolean(d)))];
      const missing = domains.filter((d) => !ev.includes(d));
      if (missing.length)
        issues.push({ severity: "error", rule: "citation", message: `${missing.map((d) => `"${d}"`).join(", ")} isn't in your research notes or the brief. Cite a source you actually read, or mark the rate "assumption, grade D".`, path: `plays[${i}].funnel[${j}]` });
    }),
  );
  return issues;
}

/** Every sourced number names its source; research must be a page the writer actually read. */
type LintTag = { source?: string; ref?: string; quote?: string; population?: string; denominator?: string; period?: string };
export function lintProvenance(out: { economics: { sources?: Record<string, LintTag> }; plays: { model?: { reachSource?: LintTag; spendSource?: LintTag; hoursSource?: LintTag; steps?: ({ name: string } & LintTag)[] } }[] }, evidence: string): LintIssue[] {
  const ev = evidence.toLowerCase().replace(/https?:\/\/(www\.)?/g, "");
  const issues: LintIssue[] = [];
  const check = (t: LintTag | undefined, path: string, what: string) => {
    if (!t?.source) return; // older outputs carry no tags
    const ref = (t.ref ?? "").trim();
    if ((t.source === "research" || t.source === "benchmark") && !ref) issues.push({ severity: "error", rule: "provenance", message: `${what}: name the ${t.source === "research" ? "page" : "benchmark"} it came from, or mark it as an assumption.`, path });
    if (t.source === "research" && ref && !(t.quote ?? "").trim()) issues.push({ severity: "error", rule: "provenance", message: `${what}: copy the exact sentence from the page that states this number into "quote", or mark it as an assumption.`, path });
    if (t.source === "research" && ref) {
      const missing: string[] = [];
      if (!t.population?.trim()) missing.push("population");
      if (!t.period?.trim()) missing.push("period");
      if (path.includes(".steps[") && !t.denominator?.trim()) missing.push("denominator");
      if (missing.length) issues.push({ severity: "error", rule: "provenance", message: `${what}: name the source's ${missing.join(", ")} so ClimbOS can check the rate applies.`, path });
    }
    if (t.source === "research" && ref) {
      const domain = ref.toLowerCase().replace(/https?:\/\/(www\.)?/, "").match(/([a-z0-9-]+\.)+[a-z]{2,}/)?.[0];
      if (domain && !ev.includes(domain)) issues.push({ severity: "error", rule: "provenance", message: `${what}: "${domain}" isn't in your research notes. Cite a page you read, call it a benchmark with its name, or mark it as an assumption.`, path });
    }
  };
  for (const k of ["revenue", "margin", "churn"]) check(out.economics.sources?.[k], `economics.sources.${k}`, `Economics ${k}`);
  out.plays.forEach((p, i) => {
    check(p.model?.reachSource, `plays[${i}].model.reachSource`, "Weekly reach");
    check(p.model?.spendSource, `plays[${i}].model.spendSource`, "Spend");
    check(p.model?.hoursSource, `plays[${i}].model.hoursSource`, "Owner hours");
    p.model?.steps?.forEach((st, j) => check(st, `plays[${i}].model.steps[${j}]`, `"${st.name}" rate`));
  });
  return issues;
}

/** Assets a play can stand on: pages, integrations, lists, audiences and partners (product features are checked by the truth gate). */
const ASSET_NOUN = /\b(pages?|comparisons?|integrations?|connections?|lists?|subscribers?|newsletters?|audiences?|followers?|community|communities|partners?|partnerships?|listings?|directory|blog|posts?|case stud(?:y|ies)|reviews?|testimonials?|waitlists?|landing)\b/i;
const TO_BUILD = /^\s*(?:to build|new|build|create)\b|\b(?:to build|to create|to write|to publish|not (?:yet )?(?:built|live|confirmed|verified)|none yet|(?:will|we'll) (?:build|create|write|publish))\b/i;
const BUILD_ACTION = /\b(build|create|write|draft|publish|set up|launch|make|add|ship|record|list|submit)\b/i;
const NUMBER_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const COUNTED = /\b(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:[\w-]+\s+){0,3}?(pages|comparisons|integrations|listings|posts|lists|reviews|case studies)\b/i;
const urlKeyOf = (u: string) => u.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/.,;:)\]]+$/, "");

/**
 * Bench Run 4: a play rested on "five existing pages" the research never confirmed. A play may only build on an
 * asset the research or facts confirm (its page URL is in what the writer read); otherwise it says "To build"
 * and building it is the first action today.
 */
export function lintAssets(plays: { assetUsed: string; firstActionToday: string }[], evidence: string): LintIssue[] {
  const ev = evidence.toLowerCase().replace(/https?:\/\/(www\.)?/g, "");
  const issues: LintIssue[] = [];
  plays.forEach((p, i) => {
    const a = p.assetUsed ?? "";
    if (!ASSET_NOUN.test(a)) return;
    if (TO_BUILD.test(a)) {
      if (!BUILD_ACTION.test(p.firstActionToday ?? "")) issues.push({ severity: "error", rule: "asset", message: `The asset is still to build ("${a.slice(0, 80)}"); make building it the first action today.`, path: `plays[${i}].firstActionToday` });
      return;
    }
    // A confirmed asset is a page with a path (not just the home page) that the writer actually read.
    const urls = [...new Set((a.match(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s,;)\]]+/gi) ?? []).map(urlKeyOf))].filter((u) => u.includes("/"));
    const verified = urls.filter((u) => ev.includes(u));
    const unverified = urls.filter((u) => !ev.includes(u));
    if (!verified.length) {
      issues.push({ severity: "error", rule: "asset", message: `"${a.slice(0, 80)}" isn't confirmed by the research. Give each existing page, integration or list's URL from your research notes or facts, or write "To build: …" and make building it the first action today.`, path: `plays[${i}].assetUsed` });
      return;
    }
    if (unverified.length) issues.push({ severity: "error", rule: "asset", message: `${unverified.map((u) => `"${u}"`).join(", ")} isn't in your research notes or facts. Cite pages you read, or mark the rest "To build".`, path: `plays[${i}].assetUsed` });
    const m = a.match(COUNTED);
    const claimed = m ? (NUMBER_WORDS[m[1].toLowerCase()] ?? Number(m[1])) : 0;
    if (claimed > verified.length) issues.push({ severity: "error", rule: "asset", message: `Claims ${claimed} ${m![2]}, but research confirms ${verified.length}. List each one's URL, or count only the confirmed ones and mark the rest "To build".`, path: `plays[${i}].assetUsed` });
  });
  return issues;
}

/** Own-asset kinds a play can extend: a new asset of a kind the business already has starts from the existing one. */
const ASSET_KINDS: { kind: string; url: RegExp; text: RegExp }[] = [
  { kind: "comparison", url: /\/(?:vs|versus|compare|comparisons?|alternatives?)(?:[/-]|$)|-vs-|-alternatives?(?:\/|$)/, text: /\b(?:comparisons?|compare|alternatives?|vs\.?|versus|switch(?:ing)?|competitor)\b/i },
  // A listing page (zapier.com/apps/x, slack.com/marketplace/x, /integrations/slack), not a general integrations page.
  { kind: "integration", url: /\/(?:integrations?|apps|marketplace)\/[^/]+/, text: /\b(?:integrations?|listings?|marketplace|app store|directory)\b/i },
  { kind: "trial", url: /\/(?:trial|free-trial|signup|sign-up|get-started|start|pricing)(?:\/|$)/, text: /\b(?:trial|sign-?up|pricing|checkout|upgrade)\s+(?:pages?|flow)\b/i },
  { kind: "landing", url: /\/(?:for|use-cases?|solutions?|industries)(?:\/|$)/, text: /\b(?:role|use-case|industry|persona|landing|audience)\s+pages?\b/i },
];
const kindOfUrl = (key: string) => (key.includes("/") ? ASSET_KINDS.find((k) => k.url.test(key.slice(key.indexOf("/"))))?.kind : undefined);
const kindOfText = (s: string) => ASSET_KINDS.find((k) => k.text.test(s))?.kind;
const COUNT_WORD = `\\d+|${Object.keys(NUMBER_WORDS).join("|")}|one|an?`;
/** "build four comparison pages", "drafts five SEO pages", "Publish a Calendly alternative page". */
const NEW_ASSET = new RegExp(`\\b(?:build|create|write|draft|publish|launch|ship|add)(?:s|es|ed|ing)?\\s+(?:(${COUNT_WORD})\\s+)?(?:new\\s+)?((?:[\\w.-]+\\s+){0,3}?)(pages?|comparisons?|alternatives?|listings?|posts?|articles?|guides?)\\b`, "gi");
/** A sentence that puts more assets after a result ("if it converts, add five"), not now. */
const GATED = /\b(?:if|once|only (?:after|when|if)|after (?:the|it|its|this|that|day|week)\b|later|expand|scale)/i;
const IMPROVE = /\b(?:update|refresh|improve|rewrite|re-write|edit|fix|tighten|retitle|optimi[sz]e|add|test|a\/b|change|swap|shorten|correct|adapt)\b/i;
/** "Collect data / pause growth": measurement dressed up as the plan. */
const DATA_ONLY = /\b(?:collect(?:ing)?|gather(?:ing)?)\s+(?:data|baselines?|inputs)\b|\b(?:keep|leave|hold)\s+(?:both\s+|all\s+|the\s+)?(?:acquisition\s+|growth\s+)?(?:plays?|tests?|acquisition|growth)\s+(?:paused|on hold)\b|\bpause[sd]?\s+(?:growth|acquisition|(?:all|both|the)\s+(?:plays|tests))\b|\b(?:should not|shouldn't|do not|don't)\s+(?:launch|start|run)\b/i;
/** A baseline is a number of searches or impressions, not "search demand is unknown". */
const DEMAND = /\d[\d,.]*\s*k?\+?\s*(?:monthly\s+|a month\s+)?(?:searches|impressions)\b|\b(?:search|keyword) volume\b[^.;]{0,30}\d|\d[^.;]{0,30}\b(?:search|keyword) volume\b/i;
const NEGATED = /\b(?:unknown|no|not|missing|unverified|unmeasured)\b/i;
const sentences = (s: string) => s.split(/(?<=[.;!?])\s+/).filter(Boolean);
const countOf = (w: string | undefined) => (!w || /^(?:an?|one)$/i.test(w) ? 1 : (NUMBER_WORDS[w.toLowerCase()] ?? (Number(w) || 1)));
/** URLs written as links (with a protocol) or with a path; a bare "Cal.com" is a name, not a link. */
const urlKeysIn = (s: string) => [...new Set((s.match(/https?:\/\/[^\s,;)\]]+|(?:[a-z0-9-]+\.)+[a-z]{2,}\/[^\s,;)\]]*/gi) ?? []).map(urlKeyOf))];
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** New assets a play commits to now (gated sentences don't count), each with its count and kind. */
function newAssetsOf(p: { assetUsed: string; test: string; firstActionToday: string; mechanic?: string }): { count: number; kind?: string; noun: string }[] {
  const found: { count: number; kind?: string; noun: string }[] = [];
  // "To build: a Calendly alternative page" or "listing to build".
  for (const part of (p.assetUsed ?? "").split(/;\s*|\.\s+/).filter((x) => /\bto build\b/i.test(x))) {
    const noun = part.replace(/\bto build\b:?/i, "").trim() || "asset";
    found.push({ count: 1, kind: kindOfText(part), noun });
  }
  for (const s of [p.assetUsed, p.test, p.firstActionToday, p.mechanic ?? ""].flatMap((t) => sentences(t ?? ""))) {
    if (GATED.test(s)) continue;
    for (const m of s.matchAll(NEW_ASSET)) {
      if (/\b(?:existing|current|live)\b/i.test(m[2])) continue;
      found.push({ count: countOf(m[1]), kind: kindOfText(m[0]), noun: `${m[2]}${m[3]}`.trim() });
    }
  }
  return found;
}

/** The first action works on an existing asset (names it, or improves before building anything new) and isn't data-only. */
function improvesFirst(action: string, urls: string[]): boolean {
  if (!action || DATA_ONLY.test(action)) return false;
  const a = alnum(action);
  const named = urls.some((u) => {
    const slug = alnum(u.split("/").filter(Boolean).at(-1) ?? "");
    return u.includes("/") && slug.length >= 3 && a.includes(slug);
  });
  if (named || /\bexisting\b/i.test(action)) return true;
  const improve = action.search(IMPROVE);
  const build = action.search(new RegExp(NEW_ASSET.source, "i"));
  return improve >= 0 && (build < 0 || improve < build);
}

/** Longest duration a test names, in days ("45 days", "four weeks", "six-week", "day 90"). */
export function durationDays(text: string): number | undefined {
  let max: number | undefined;
  for (const m of text.matchAll(new RegExp(`\\b(${COUNT_WORD})[\\s-]+(day|week|month)s?\\b|\\bday\\s+(\\d+)\\b`, "gi"))) {
    const d = m[3] ? Number(m[3]) : countOf(m[1]) * (/week/i.test(m[2]) ? 7 : /month/i.test(m[2]) ? 30 : 1);
    max = Math.max(max ?? 0, d);
  }
  return max;
}

/**
 * Bench Run 5 (Meetrao): a play committed to four new comparison pages with no demand baseline while an existing
 * Cal.com comparison page sat unused. A play that adds an asset of a kind the business already has starts from the
 * existing one (some play improves it first), and more than one new asset at once needs a demand baseline; otherwise
 * the rest goes in scaleIf, gated on the first one's result.
 */
export function lintAssetsFirst(plays: { assetUsed: string; test: string; firstActionToday: string; mechanic?: string; funnel?: string[]; model?: { reachSource?: LintTag } }[], evidence: string): LintIssue[] {
  const ev = evidence.toLowerCase().replace(/https?:\/\/(www\.)?/g, "");
  const cited = plays.map((p) => urlKeysIn(p.assetUsed ?? "").filter((u) => ev.includes(u)));
  const own = new Set(cited.flat().map((u) => u.split("/")[0]));
  const existing = [...new Set([...cited.flat(), ...urlKeysIn(evidence).filter((u) => own.has(u.split("/")[0]))])].filter((u) => u.split("/")[1]);
  const issues: LintIssue[] = [];
  plays.forEach((p, i) => {
    const added = newAssetsOf(p);
    if (!added.length) return;
    for (const kind of new Set(added.map((a) => a.kind).filter(Boolean))) {
      const same = existing.filter((u) => kindOfUrl(u) === kind);
      if (!same.length) continue;
      const started = plays.some((q, j) => {
        const urls = cited[j].filter((u) => kindOfUrl(u) === kind);
        return urls.length > 0 && improvesFirst(q.firstActionToday, urls);
      });
      if (!started) issues.push({ severity: "error", rule: "assets_first", message: `Research shows an existing ${kind} page (${same.slice(0, 2).join(", ")}). Start from it: cite it in assetUsed, make improving it the first action today and the test, and add new ${kind} pages only in scaleIf, gated on its result.`, path: `plays[${i}].firstActionToday` });
    }
    const most = added.reduce((a, b) => (b.count > a.count ? b : a));
    if (most.count < 2) return;
    const baseline = [p.assetUsed, p.test, p.mechanic ?? "", ...(p.funnel ?? []).filter((l) => !/assumption/i.test(l)), ...(p.model?.reachSource?.source && ["owner", "research"].includes(p.model.reachSource.source) ? [p.model.reachSource.quote ?? ""] : [])]
      .flatMap((t) => sentences(t ?? ""))
      .some((s) => DEMAND.test(s) && !NEGATED.test(s));
    if (!baseline) {
      const start = existing.find((u) => kindOfUrl(u) === most.kind) ?? existing.find((u) => added.some((x) => x.kind && kindOfUrl(u) === x.kind));
      issues.push({ severity: "error", rule: "assets_first", message: `Commits to ${most.count} new ${most.noun} at once with no demand baseline. Start with ${start ? `the existing ${start}` : "one"}, put the rest in scaleIf, gated on its result, or cite each one's search demand (searches or impressions a month).`, path: `plays[${i}].test` });
    }
  });
  return issues;
}

/**
 * Bench Run 5 (Folevi): the plays built only new assets and the plan said "collect data, keep plays paused". At least
 * one play must be a concrete test on an existing asset: it cites a confirmed URL, its first action improves that
 * asset, and its test names a duration inside the horizon. Measurement can run alongside, never instead.
 */
export function lintExistingTest(plays: { assetUsed: string; test: string; firstActionToday: string; horizonDays?: number }[], evidence: string, horizonDays?: number): LintIssue[] {
  const ev = evidence.toLowerCase().replace(/https?:\/\/(www\.)?/g, "");
  if (!plays.length || !urlKeysIn(evidence).length) return [];
  const ok = plays.some((p) => {
    const urls = urlKeysIn(p.assetUsed ?? "").filter((u) => ev.includes(u));
    const h = horizonDays ?? (p.horizonDays || 90);
    const d = durationDays(p.test ?? "");
    return urls.length > 0 && !DATA_ONLY.test(p.test ?? "") && d !== undefined && d <= h && improvesFirst(p.firstActionToday, urls);
  });
  if (ok) return [];
  const h = horizonDays ?? (plays[0].horizonDays || 90);
  return [{ severity: "error", rule: "existing_test", message: `No play runs a concrete test on an existing asset within ${h} days. Keep data collection as a parallel step, but make at least one play improve a confirmed page, listing or flow (its URL in assetUsed), make that change the first action today, and give its test a size and a duration of ${h} days or less.`, path: "plays" }];
}

/** Week-one items and phase work that change or test something (not measurement alone). */
const PLAN_ACTION = /\b(?:update|refresh|improve|rewrite|edit|fix|publish|launch|send|ship|test|draft|post|submit|swap|adapt|run (?:the|a|an|both|all) (?:tests?|plays?|experiments?))\b|\bapprove\b[^.;]{0,40}\b(?:edits?|copy|page|draft|listing|changes?)\b/i;
/** Last day a phase covers ("0–14", "Days 15–45", "Week one", "Through day 90"); undefined when it has no date. */
export function phaseEndDay(days: string): number | undefined {
  const weeks = days.match(new RegExp(`\\bweeks?\\s+(${COUNT_WORD})(?:\\s*[–-]\\s*(${COUNT_WORD}))?`, "i"));
  if (weeks) return countOf(weeks[2] ?? weeks[1]) * 7;
  const nums = (days.match(/\d+/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : undefined;
}

/** The plan side of Bench Run 5 (Folevi): never a data-only plan; one concrete test on an existing asset runs inside the horizon. */
export function lintActionPlan(out: { summary?: string; phases?: { name: string; days: string; focus: string }[]; weekOneChecklist?: string[]; experiments?: { method: string; durationDays: number; stoppingRule: string }[] }, horizonDays?: number): LintIssue[] {
  const h = horizonDays || 90;
  const issues: LintIssue[] = [];
  const parallel = "Collecting data can run in parallel, but at least one concrete test on an existing asset (a page, listing or flow the research confirmed) must run inside the horizon.";
  const paused = [["summary", out.summary ?? ""] as const, ...(out.phases ?? []).map((p, i) => [`phases[${i}].focus`, p.focus] as const), ...(out.experiments ?? []).map((e, i) => [`experiments[${i}].stoppingRule`, e.stoppingRule] as const)].find(([, t]) => DATA_ONLY.test(t));
  if (paused) issues.push({ severity: "error", rule: "data_only", message: `"${paused[1].match(DATA_ONLY)![0]}" makes the plan data-only. ${parallel}`, path: paused[0] });
  const exps = out.experiments ?? [];
  if (exps.length && !exps.some((e) => e.method !== "export_instructions" && e.durationDays > 0 && e.durationDays <= h)) issues.push({ severity: "error", rule: "data_only", message: `No experiment is a live test within ${h} days. Add one A/B, holdout or before/after test on an existing asset. ${parallel}`, path: "experiments" });
  const acts = (out.phases ?? []).some((p) => PLAN_ACTION.test(p.focus) && (phaseEndDay(p.days) ?? Infinity) <= h) || (out.weekOneChecklist ?? []).some((t) => PLAN_ACTION.test(t));
  if (!acts) issues.push({ severity: "error", rule: "data_only", message: `No phase (with days) or week-one item changes or tests anything. ${parallel} Name it in a dated phase and the week-one checklist.`, path: "phases" });
  return issues;
}

/** What an asset play changes or builds: a page, listing, hub, flow or its parts. */
const CHANGED_ASSET = /\b(?:pages?|comparisons?|alternatives?|landing|listings?|hub|onboarding|sign-?ups?|trial|checkout|pricing|hero|cta|headline|(?:upgrade|email|welcome|nurture|onboarding)[\s-](?:flow|sequence|emails?|prompts?))\b/i;
const ASSET_VERB = new RegExp(`${IMPROVE.source}|\\b(?:build|create|write|draft|publish|launch|ship|revise|replace|rework|redesign|define)\\b`, "i");
/** Channels that send people somewhere (people the business reaches, borrows or pays for). */
const ACTIVE_ROUTE = /\b(?:creators?|influencers?|youtub\w*|podcasts?|newsletters?|communit(?:y|ies)|forums?|reddit|subreddits?|r\/\w+|slack|discord|facebook groups?|linkedin|x posts?|twitter|tiktok|instagram|threads|quora|cold email|outbound|outreach|email (?:list|subscribers|blast|campaign|sequence)|emails? (?:to|past|existing)|partners?|partnerships?|affiliates?|referrals?|marketplaces?|app stores?|directories|directory|product hunt|g2|capterra|alternativeto|zapier|(?<!\bno\s(?:search |google |meta |reddit |linkedin |paid )?)(?:search |google |meta |reddit |linkedin |paid )?ads|paid (?:social|search)|ppc|retarget\w*|sponsor\w*|(?:live|in-person|industry|local) events?|conferences?|webinars?|meetups?|in-app|(?:new|weekly|existing|current) (?:sign-?ups|trials?|users|customers|accounts)|trial (?:starts|users)|lifecycle|press)\b/i;
/** Channels that wait for people to arrive: fine with measured numbers, a hope without them (bench Run 6, Meetrao). */
const PASSIVE_ROUTE = /\b(?:organic|seo|search|google|bing|rankings?|existing (?:traffic|visitors)|current (?:traffic|visitors)|direct traffic|site traffic|ai (?:search|answers))\b/i;
/** A number per week ("40 visits a week", "~300 visitors/week", "weekly: 25"). */
const WEEKLY = /(?<![$\d,.])\d[\d,.]*(?![\d,.])(?!\s*(?:owner\s+)?(?:h|hrs?|hours?|mins?|minutes?)\b)\s*k?\+?\s*(?:[\w-]+\s+){0,3}?(?:(?:a|per|each|\/)\s*(?:week|wk)\b|weekly\b)|\bweekly\b[^.;]{0,30}\d|\d[^.;]{0,20}\/\s*w(?:ee)?k\b/i;
/** Volume not known yet, with how it will be counted ("unknown; measured with UTM visits in week 1"). */
const MEASURED_LATER = /\b(?:unknown|unmeasured|not known|no data|tbd)\b[^.]{0,80}\b(?:measur|track|count|log|read|utm|analytics)\w*|\bmeasured? (?:by|with|via|in|from|weekly|through)\b/i;
/** A volume's source tag (owner, research, benchmark, planned, assumption); "owner time" isn't one. */
const VOLUME_LABEL = /[([]\s*(?:owner|research|benchmark|planned|assum\w*|estimate\w*)\b|\b(?:benchmark|planned|assum(?:ption|ed)|estimated?)\b|\b(?:owner|research)\s*(?:data|analytics|reported|:)/i;
/** Measured numbers: the owner's data or a page that was read. */
const MEASURED_LABEL = /[([]\s*(?:owner|research)\b|\b(?:owner|research)\s*(?:data|analytics|reported|:)|\b(?:search console|google analytics|ga4|plausible|ahrefs|semrush)\b/i;
const ROUTE_COST = /\$\s?\d|\b\d[\d,.]*\s*(?:usd|dollars)\b|\bfree\b|\bno (?:ad |cash |media )?(?:spend|cost)\b|\bunpaid\b|\bzero (?:spend|cost)\b/i;
const ROUTE_TIME = /\b\d+(?:\.\d+)?\s*(?:[–-]\s*\d+(?:\.\d+)?\s*)?(?:owner\s+)?(?:h|hrs?|hours?|mins?|minutes?)\b|\b(?:one|two|three|four|five|half an?|an?)\s+(?:owner\s+)?hours?\b|\bno owner time\b/i;

/** The play changes or builds an asset (page, listing, flow), so visitors have to reach it. */
export function changesAsset(p: { assetUsed: string; firstActionToday: string; mechanic?: string }): boolean {
  const toBuild = (p.assetUsed ?? "").split(/;\s*|\.\s+/).some((x) => /\bto build\b/i.test(x) && CHANGED_ASSET.test(x));
  return toBuild || [p.firstActionToday, p.mechanic ?? ""].flatMap((t) => sentences(t ?? "")).some((s) => ASSET_VERB.test(s) && CHANGED_ASSET.test(s));
}

/** What a route is missing (empty when it's complete). */
export function routeGaps(route: string): string[] {
  const r = (route ?? "").trim();
  if (!r || /^(?:none|n\/a|-|tbd)\.?$/i.test(r)) return ["names no route"];
  const gaps: string[] = [];
  const active = ACTIVE_ROUTE.test(r);
  if (!active && !PASSIVE_ROUTE.test(r)) gaps.push("names no channel");
  const weekly = WEEKLY.test(r);
  if (!weekly && !MEASURED_LATER.test(r)) gaps.push("gives no weekly volume (or how it will be measured)");
  else if (weekly && !VOLUME_LABEL.test(r)) gaps.push("doesn't label where its weekly volume comes from");
  if (!active && PASSIVE_ROUTE.test(r) && !MEASURED_LABEL.test(r)) gaps.push("waits for search or existing traffic with no measured number (pair it with an active test: creators, a community, outbound, a partner or search ads)");
  if (!ROUTE_COST.test(r)) gaps.push("gives no cost");
  if (!ROUTE_TIME.test(r)) gaps.push("gives no owner time");
  return gaps;
}

/**
 * Bench Run 6 (Meetrao): the plays edited two existing pages but never said how qualified visitors reach them; B0
 * paired its comparison page with a creator test and won. Every play that changes or builds an asset names its route:
 * a channel, expected visitors a week with its source tag (or how it will be measured), cost and owner time.
 */
export function lintDistribution(plays: { name?: string; route?: string; assetUsed: string; firstActionToday: string; mechanic?: string }[]): LintIssue[] {
  const issues: LintIssue[] = [];
  plays.forEach((p, i) => {
    if (!changesAsset(p)) return;
    const gaps = routeGaps(p.route ?? "");
    if (gaps.length) issues.push({ severity: "error", rule: "distribution", message: `"${p.name ?? `Play ${i + 1}`}" changes or builds an asset, but its route ${gaps.join("; ")}. In route, name how qualified visitors reach it: the channel (e.g. a creator, community, outbound or search-ads test pointed at the page), expected visitors a week tagged owner, research, benchmark, planned or assumption (or how you'll measure it if unknown), cost and owner time.`, path: `plays[${i}].route` });
  });
  return issues;
}

/** Plan items that send people to an asset (not just edit it). */
const PLAN_DISTRIBUTION = /\b(?:pitch\w*|promot\w*|submit\w*|invite\w*|announce\w*|sponsor\w*|boost\w*|outreach|reach out|share (?:it|the|both|each)|post(?:s|ing)?\b[^.;]{0,40}\b(?:groups?|communit(?:y|ies)|forums?|subreddits?|r\/\w+|slack|discord|reddit|linkedin|newsletters?)\b|(?:email|dm|message)(?:s|ing)? (?:the |your |past |existing |\d)|send (?:\d|the|a|an|it)[^.;]{0,40}\b(?:emails?|pitch(?:es)?|messages?|invites?|links?|newsletters?)|run (?:the |a |an )?(?:search |paid |google )?ads)\b|\b(?:start|run|launch|begin|book|test)\b[^.;]{0,30}\b(?:creators?|communit(?:y|ies)|partners?|newsletters?|affiliates?|ads|outreach|outbound|cold email)\b/i;
const PLAN_ASSET_CHANGE = (s: string) => ASSET_VERB.test(s) && CHANGED_ASSET.test(s);

/** The plan side of Run 6: dated work that edits pages also sends qualified people to them inside the horizon. */
export function lintPlanDistribution(out: { phases?: { name: string; days: string; focus: string }[]; weekOneChecklist?: string[] }, horizonDays?: number): LintIssue[] {
  const h = horizonDays || 90;
  const dated = [...(out.phases ?? []).filter((p) => (phaseEndDay(p.days) ?? Infinity) <= h).map((p) => p.focus), ...(out.weekOneChecklist ?? [])];
  const all = [...(out.phases ?? []).map((p) => p.focus), ...(out.weekOneChecklist ?? [])];
  if (!all.some(PLAN_ASSET_CHANGE)) return [];
  if (dated.some((t) => PLAN_DISTRIBUTION.test(t))) return [];
  return [{ severity: "error", rule: "distribution", message: `The plan edits or builds pages but no dated phase or week-one item sends qualified people to them. Add each play's route as an action inside ${h} days (e.g. "Pitch 10 coaching creators the comparison page") in the week-one checklist and a dated phase.`, path: "weekOneChecklist" }];
}

/** Paid traffic (search, social or sponsored placements). */
const PAID_ROUTE = /\b(?:search |google |meta |reddit |linkedin |tiktok |paid )?ads\b|\bppc\b|\bpaid (?:social|search|traffic)\b|\bsponsor\w*|\bboost\w*/i;
/** A route that costs nothing but time. */
const FREE_ROUTE = /\bfree\b|\bno (?:ad |cash |media )?(?:spend|cost)\b|\bunpaid\b|\bzero (?:spend|cost)\b|\$\s?0(?![\d.,])/i;
/** Spend that waits for the free test ("only after the page converts", "once …", "gated on …"). */
const GATED_SPEND = /\b(?:after|once|only (?:if|when|after)|gated on|unless|until|if (?:the |it |that |this )?[^.;]{0,50}\b(?:passes|works|converts|hits|beats|clears|reaches))\b/i;

/**
 * Bench Run 7 (Meetrao, $30 a year): the plays bought search traffic for a low-price product; B0 improved the existing
 * buyer-intent page and tested a free creator route first, and won. For low-price products the first play improves an
 * existing high-intent page (confirmed URL, changed today) and reaches people with a free route; any play that spends
 * money waits for that result.
 */
export function lintLowPriceFirst(
  plays: { name?: string; assetUsed: string; firstActionToday: string; route?: string; test?: string; scaleIf?: string; model?: { monthlySpendUsd: number } }[],
  economics: { revenuePerCustomerMonthUsd?: number; currency?: string } | undefined,
  evidence: string,
): LintIssue[] {
  const price = economics?.revenuePerCustomerMonthUsd ?? 0;
  const cur = economics?.currency;
  if (!(price > 0 && toUsd(price, cur) < LOW_TICKET_USD_MONTH) || !plays.length) return [];
  const issues: LintIssue[] = [];
  const priceText = `about ${formatMoney(price, cur)} a month per customer`;
  const first = plays[0];
  const ev = evidence.toLowerCase().replace(/https?:\/\/(www\.)?/g, "");
  const urls = urlKeysIn(first.assetUsed ?? "").filter((u) => ev.includes(u));
  if (urlKeysIn(evidence).length && (!urls.length || !improvesFirst(first.firstActionToday ?? "", urls))) {
    issues.push({ severity: "error", rule: "low_price_first", message: `At ${priceText}, start with what already brings buyers: make the first play improve an existing high-intent page (comparison, alternative, pricing or signup page, its URL from the research in assetUsed) and make that change the first action today.`, path: "plays[0].assetUsed" });
  }
  const route = first.route ?? "";
  if ((first.model?.monthlySpendUsd ?? 0) > 0 || (PAID_ROUTE.test(route) && !FREE_ROUTE.test(route))) {
    issues.push({ severity: "error", rule: "low_price_first", message: `At ${priceText}, the first play reaches people for free (creators, communities, existing users, a partner's newsletter, directories). Paid traffic comes later, only after that test reads out.`, path: "plays[0].route" });
  }
  plays.slice(1).forEach((p, i) => {
    const spend = p.model?.monthlySpendUsd ?? 0;
    if (spend > 0 && !GATED_SPEND.test(`${p.test ?? ""} ${p.firstActionToday ?? ""} ${p.scaleIf ?? ""}`)) {
      issues.push({ severity: "error", rule: "low_price_first", message: `"${p.name ?? `Play ${i + 2}`}" spends ${formatMoney(spend, cur)} a month before the free test reads out. At ${priceText}, start paid traffic only after the first play's result; say so in its test (e.g. "Run search ads only once the page converts ≥2% from creator visits").`, path: `plays[${i + 1}].test` });
    }
  });
  return issues;
}

/** Success tied to one paid tier ("Pro customers", "Business plan upgrades"). */
const ONE_TIER = /\b(?:pro|premium|business|team|teams|plus|growth|enterprise|advanced|professional|core|scale|max)\s+(?:plan|tier|subscri\w*|customers?|accounts?|upgrades?|users?|seats?|members?)\b/i;
const ANY_PAID = /\b(?:any|all|every)\s+paid\b|\bpaid (?:customers?|accounts?|sign-?ups|subscribers|users)\b(?![^.;]{0,20}\bon (?:the )?(?:pro|premium|business|team))/i;

/**
 * Bench Run 7 (Folevi): success was narrowed to one paid tier (Pro); B0 counted conversion to any paid plan with a
 * conservative revenue proxy and won. Plays and the North Star count new customers on any paid plan.
 */
export function lintAnyPaidPlan(items: { text: string; path: string }[]): LintIssue[] {
  return items
    .filter((x) => ONE_TIER.test(x.text) && !ANY_PAID.test(x.text))
    .map((x) => ({ severity: "error" as const, rule: "any_paid_plan", message: `"${x.text.slice(0, 80)}" counts only one paid tier. Count new customers on any paid plan, and use the lowest paid price as revenue per customer unless the owner gives a mix.`, path: x.path }));
}

/* ---------------- Five lenses (marketing books, in our own words; skills/growth-plays "Five lenses") ---------------- */

type LensPlay = { name?: string; oneLiner?: string; audience?: string; trigger?: string; hook?: string; mechanic?: string; assetUsed?: string; unit?: string; route?: string; test?: string; firstActionToday?: string };
const playText = (p: LensPlay, keys: (keyof LensPlay)[]) => keys.map((k) => p[k] ?? "").join(" ");
const lowPrice = (economics: { revenuePerCustomerMonthUsd?: number } | undefined) => {
  const price = economics?.revenuePerCustomerMonthUsd ?? 0;
  return price > 0 && price < LOW_TICKET_USD_MONTH;
};

/** Work on the product's own funnel: signup, first value, trial, upgrade. */
const FUNNEL_PLAY = /\b(?:onboarding|activation|activate[sd]?|first[- ]run|first value|time[- ]to[- ]value|sign-?up (?:flow|page|form|step)|trial(?:[- ]to[- ]paid| flow| emails?| length| terms| users)|upgrade (?:prompt|flow|path|page|moment)|paywall|free plan|freemium|in-app|empty states?|welcome (?:emails?|flow|screen)|setup (?:wizard|checklist)|pricing page|checkout)\b/i;

/** Lens 1 (product-led growth): a low-price self-serve product gets at least one play on its own funnel. */
export function lintSelfServeFunnel(plays: LensPlay[], economics: { revenuePerCustomerMonthUsd?: number } | undefined): LintIssue[] {
  if (!lowPrice(economics) || !plays.length) return [];
  if (plays.some((p) => FUNNEL_PLAY.test(playText(p, ["name", "oneLiner", "mechanic", "assetUsed", "firstActionToday", "test"])))) return [];
  return [{ severity: "error", rule: "self_serve_funnel", message: "At this price the product is the main channel: add a play on its own funnel (signup → first value → upgrade), e.g. shorten the time to the first result or move the upgrade prompt to where the free limit is felt.", path: "plays" }];
}

const COMPARISON_PLAY = /\b(?:comparison|compare|alternatives?|vs\.?|versus|switch(?:ing)? from)\b/i;
/** A named alternative: "vs Calendly", "alternative to Google Analytics", or the status quo (spreadsheets, doing it by hand). */
const ALT_LEAD = /\b(?:vs\.?|versus|alternative to|compared (?:to|with)|instead of|switch(?:ing)? from|than|unlike|replaces?)\s+(?:the\s+|a\s+)?(\S+)/gi;
const STATUS_QUO = /\b(?:spreadsheets?|excel|pen and paper|paper|doing nothing|by hand|manual(?:ly)?|email threads|whatsapp)\b/i;
/** A named alternative: "vs Calendly", "alternative to Google Analytics", "unlike Acme", or the status quo. */
const namesAlternative = (t: string) => STATUS_QUO.test(t) || [...t.matchAll(ALT_LEAD)].some((m) => /^[A-Z0-9]/.test(m[1]));
const DIFFERENTIATOR = /\b(?:only|unlike|without|instead of|no (?:need|cookies?|setup|code|contracts?|per-seat|ads)|cheaper|faster|simpler|lighter|privacy|private|built for|doesn'?t|does not|fewer|less|more (?:control|privacy)|one[- ]click|in minutes)\b/i;
const SEGMENT = /\bfor (?:[\w'-]+ ){0,4}(?:teams?|owners?|freelancers?|agencies|founders?|studios?|shops?|clinics?|coaches?|consultants?|businesses|companies|creators?|marketers?|developers?|designers?|accountants?|sites?|stores?|bloggers?|[a-z]+(?:ers|ists|ants))\b|\b(?:solo|small|indie|local|eu|european|privacy-conscious|growing)\s+[\w-]+/i;

/** Lens 2 (positioning): a comparison or alternative page names the alternative, what's different and for whom. */
export function lintComparisonPositioning(plays: LensPlay[]): LintIssue[] {
  const issues: LintIssue[] = [];
  plays.forEach((p, i) => {
    if (!COMPARISON_PLAY.test(playText(p, ["name", "assetUsed", "mechanic", "firstActionToday"]))) return;
    const text = playText(p, ["oneLiner", "hook", "mechanic", "audience", "firstActionToday", "name"]);
    const gaps = [
      namesAlternative(text) ? "" : "the alternative it's compared with (a competitor or what people do instead)",
      DIFFERENTIATOR.test(text) ? "" : "what this product does that the alternative doesn't",
      SEGMENT.test(`${p.audience ?? ""} ${text}`) ? "" : "who that matters most to (the best-fit segment)",
    ].filter(Boolean);
    if (gaps.length) issues.push({ severity: "error", rule: "positioning", message: `"${p.name ?? `Play ${i + 1}`}" is a comparison or alternative page but doesn't say ${gaps.join("; ")}. Lead with one strength for one segment against a named alternative, from research.`, path: `plays[${i}].hook` });
  });
  return issues;
}

const GUARANTEE = /\b(?:money[- ]back|refunds? (?:if|guarantee)|guarantee[sd]?|risk[- ]free|no[- ]risk|or (?:it'?s|your money) (?:free|back)|results? guaranteed)\b/i;

/** Lens 3 (offers): a guarantee or refund promise only when the owner's facts or the research confirm it. */
export function lintOfferClaims(plays: LensPlay[], evidence: string): LintIssue[] {
  if (GUARANTEE.test(evidence)) return [];
  return plays.flatMap((p, i) =>
    GUARANTEE.test(playText(p, ["oneLiner", "hook", "mechanic"]))
      ? [{ severity: "error" as const, rule: "offer_claim", message: `"${p.name ?? `Play ${i + 1}`}" promises a guarantee or refund the owner hasn't confirmed. Use another lever (a faster first result, less effort to start, proof from real customers), or ask the owner first.`, path: `plays[${i}].hook` }]
      : [],
  );
}

const VANITY_METRIC = /\b(?:followers?|impressions?|views?|likes?|reach|traffic|visits?|visitors?|sessions?|page ?views?|clicks?|engagement|downloads?|subscribers?)\b/i;
const OUTCOME = /\b(?:customers?|clients?|paying|paid|revenue|sales?|orders?|bookings?|booked|jobs?|accounts?|subscriptions?|sign-?ups|trials?|activated|activation|leads?|mrr|arr|members?|patients?|students?|deals?|contracts?)\b/i;

/** Lens 4 (stage metrics): an outcome, never a vanity number, as the North Star (plays' units are checked in lintPlays). */
export function lintStageMetric(items: { text: string; path: string }[]): LintIssue[] {
  return items
    .filter((x) => x.text.trim() && VANITY_METRIC.test(x.text) && !OUTCOME.test(x.text))
    .map((x) => ({ severity: "error" as const, rule: "vanity_metric", message: `"${x.text.slice(0, 80)}" is a leading signal, not an outcome. Count what the business is paid for (new paying customers, booked jobs, activated accounts) and keep visits or followers as a leading indicator.`, path: x.path }));
}

const REFERRAL_PLAY = /\b(?:referr\w*|word[- ]of[- ]mouth|invite (?:a |your )?(?:friends?|colleagues?|teammates?|clients?)|tell a friend|ambassadors?|share (?:with|it|us))\b/i;
const SHARE_TRIGGER = /\b(?:after|when|right after|each time|every time|the moment|at the moment|once (?:they|a|the|their)|on (?:first|their)|at (?:checkout|signup|renewal|delivery))\b/i;
const SHARE_MECHANISM = /\b(?:links?|invites?|buttons?|in-app|in the app|templates?|codes?|widgets?|badges?|signatures?|footers?|powered by|share (?:screens?|cards?|pages?)|qr)\b/i;

/** Lens 5 (word of mouth): a referral play names the moment people think of it and the share mechanism in that moment. */
export function lintReferralDrivers(plays: LensPlay[]): LintIssue[] {
  const issues: LintIssue[] = [];
  plays.forEach((p, i) => {
    if (!REFERRAL_PLAY.test(playText(p, ["name", "oneLiner", "mechanic", "hook"]))) return;
    const gaps = [
      SHARE_TRIGGER.test(playText(p, ["trigger", "mechanic", "hook"])) ? "" : "the trigger (the moment a customer thinks of it)",
      SHARE_MECHANISM.test(playText(p, ["mechanic", "firstActionToday", "route", "assetUsed"])) ? "" : "the share mechanism built into that moment (a link, invite or template in the product)",
    ].filter(Boolean);
    if (gaps.length) issues.push({ severity: "error", rule: "referral_drivers", message: `"${p.name ?? `Play ${i + 1}`}" asks people to share but doesn't name ${gaps.join(" or ")}.`, path: `plays[${i}].mechanic` });
  });
  return issues;
}

/** Spec §13: the portfolio must fit the owner's cash and time. */
export function lintFeasibility(plays: { name: string; kind: string; model?: { monthlySpendUsd: number; ownerHoursPerWeek: number } }[], c: PlanConstraints | undefined, economics?: Economics): LintIssue[] {
  if (!c) return [];
  const issues: LintIssue[] = [];
  const m = (n: number) => formatMoney(n, c.currency);
  // The fix is computed, not left to the model: the best set of these plays that fits all limits together (decision books, Kochenderfer App. E).
  const fixHint = () => {
    if (!economics) return "";
    const pick = selectPortfolio({ economics, plays: plays as never }, { monthlyBudgetUsd: c.monthlyAdBudgetUsd, ownerHoursPerWeek: c.ownerHoursPerWeek, newCustomersPerMonth: c.newCustomersPerMonth, horizonDays: c.horizonDays });
    return pick?.selected.length ? ` Best set that fits (computed): ${pick.selected.join(" + ")}; drop or shrink ${pick.left.map((l) => l.name).join(", ")}.` : "";
  };
  const spend = plays.reduce((s, p) => s + Math.max(0, p.model?.monthlySpendUsd ?? 0), 0);
  const hours = plays.reduce((s, p) => s + Math.max(0, p.model?.ownerHoursPerWeek ?? 0), 0);
  if (c.monthlyAdBudgetUsd !== undefined && spend > c.monthlyAdBudgetUsd * 1.001)
    issues.push({ severity: "error", rule: "budget", message: c.monthlyAdBudgetUsd === 0 ? `The owner has no ad budget, but the plays spend ${m(spend)}/month. Use plays that cost time or ClimbOS credits instead.` : `The plays spend ${m(spend)}/month; the budget is ${m(c.monthlyAdBudgetUsd)}. Cut or drop a play.${fixHint()}`, path: "plays" });
  if (c.ownerHoursPerWeek !== undefined && hours > c.ownerHoursPerWeek + 0.01)
    issues.push({ severity: "error", rule: "capacity", message: `The plays need ${Math.round(hours * 10) / 10} owner hours a week; the owner has ${c.ownerHoursPerWeek}. Move work to ClimbOS or drop a play.${fixHint()}`, path: "plays" });
  else if (c.ownerHoursPerWeek === undefined && hours > 10)
    issues.push({ severity: "warn", rule: "capacity", message: `The plays need ${Math.round(hours)} owner hours a week; most owners have under 10. Move work to ClimbOS where you can.`, path: "plays" });
  return issues;
}

/** The plan's paid channels must fit the budget, and its North Star must be the plays' computed total. */
export function lintPlanFit(out: { channels: { name: string; suggestedMonthlyAdSpend: number }[]; northStar?: { target: string } }, c: PlanConstraints | undefined): LintIssue[] {
  if (!c) return [];
  const issues: LintIssue[] = [];
  const spend = out.channels.reduce((s, ch) => s + Math.max(0, ch.suggestedMonthlyAdSpend || 0), 0);
  if (c.monthlyAdBudgetUsd !== undefined && spend > c.monthlyAdBudgetUsd * 1.001) issues.push({ severity: "error", rule: "budget", message: `Channels suggest ${formatMoney(spend, c.currency)}/month in ads; the budget is ${formatMoney(c.monthlyAdBudgetUsd, c.currency)}.`, path: "channels" });
  if (c.lockedCustomers !== undefined && c.lockedCustomers > 0 && out.northStar?.target) {
    const nums = [...out.northStar.target.replace(/,/g, "").matchAll(/(?<![A-Za-z\d.-])\d+(?:\.\d+)?/g)].map((m) => Number(m[0])).filter((n) => n > 0 && n !== 90 && n !== 30 && n !== 60 && n !== c.horizonDays);
    const want = c.lockedCustomers;
    if (nums.length && !nums.some((n) => Math.abs(n - want) <= Math.max(1, want * 0.15)))
      issues.push({ severity: "error", rule: "consistency", message: `The North Star target doesn't match the plays: they add up to ≈${Math.round(want)} customers by day ${c.horizonDays ?? 90}. Use that number.`, path: "northStar.target" });
  }
  return issues;
}

/** "https://www.x.com/a/" → "x.com/a": how cited URLs are matched against what the writer was given. */
const citeKey = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[#?].*$/, "").replace(/\/+$/, "");

/**
 * Book 14 §5: channel and audience cites must resolve. "fact:N" must be a
 * confirmed fact the writer was given; a URL must be one it read (research,
 * facts, brief or plays). An unresolvable cite is a fabricated citation.
 */
export function lintCites(out: { channels: { name: string; priority: number; cites?: string[] }[]; audiences: { name: string; cites?: string[] }[] }, factCount: number, evidence: string): LintIssue[] {
  const ev = evidence.toLowerCase().replace(/https?:\/\/(www\.)?/g, "");
  const issues: LintIssue[] = [];
  const check = (cites: string[] | undefined, path: string, label: string) => {
    for (const c of cites ?? []) {
      const f = /^fact:(\d+)$/i.exec(c.trim());
      const ok = f ? Number(f[1]) < factCount : /^https?:\/\//i.test(c.trim()) && ev.includes(citeKey(c));
      if (!ok) issues.push({ severity: "error", rule: "citation", message: `${label} cites "${c.slice(0, 80)}", which isn't a confirmed fact (fact:0–${Math.max(0, factCount - 1)}) or a page the research read. Cite a real one or leave cites empty.`, path: `${path}.cites` });
    }
  };
  out.channels.forEach((ch, i) => {
    check(ch.cites, `channels[${i}]`, `Channel "${ch.name}"`);
    if (ch.priority === 1 && ch.cites && !ch.cites.length && factCount + ev.length > 0) issues.push({ severity: "warn", rule: "uncited", message: `The top channel "${ch.name}" cites nothing. Name the fact or page it rests on.`, path: `channels[${i}].cites` });
  });
  (out.audiences ?? []).forEach((a, i) => check(a.cites, `audiences[${i}]`, `Audience "${a.name}"`));
  return issues;
}

/** REQ-OUT-01/05: keep each play traceable and expose prerequisites as data. */
const ACTION_OUTCOME_FAMILIES: [RegExp, string][] = [
  [/\b(?:revenue|sales|gross profit|contribution)\b/i, "revenue"],
  [/\b(?:qualified )?leads?\b/i, "leads"],
  [/\b(?:booked|attended|completed)?\s*(?:jobs?|appointments?|bookings?|calls?)\b/i, "bookings"],
  [/\b(?:paying|paid|new|returning|retained|repeat)?\s*(?:customers?|clients?|accounts?|members?|subscribers?|orders?|purchases?|deals?|contracts?)\b/i, "paying_customers"],
  [/\b(?:activated|activation|first value|retained|retention|repeat purchase)\b/i, "activation_or_retention"],
];

function actionOutcomeFamilies(value: string): Set<string> {
  return new Set(ACTION_OUTCOME_FAMILIES.filter(([pattern]) => pattern.test(value)).map(([, family]) => family));
}

export function lintActionContracts(plays: PlayDraft[], factCount: number, evidence: string, horizonDays?: number, availableSourceUrls: string[] = []): LintIssue[] {
  const issues: LintIssue[] = [];
  const readUrls = new Set(availableSourceUrls.map(citeKey));
  plays.forEach((play, i) => {
    const path = `plays[${i}].actionContract`;
    const action = play.actionContract;
    // Legacy fixtures and plans predate this contract. New model drafts cannot
    // omit it because PlayDraftSchema requires the full object.
    if (!action) return;
    if (["measured", "owner_report", "source_claim"].includes(action.evidenceBasis) && !action.evidenceRefs.length) {
      issues.push({ severity: "error", rule: "action_evidence", message: "This evidence basis requires at least one confirmed fact or source reference.", path: `${path}.evidenceRefs` });
    }
    for (const ref of action.evidenceRefs) {
      const fact = /^fact:(\d+)$/i.exec(ref.trim());
      const valid = fact ? Number(fact[1]) < factCount : /^https?:\/\//i.test(ref.trim()) && readUrls.has(citeKey(ref));
      if (!valid) issues.push({ severity: "error", rule: "action_evidence", message: `Evidence reference "${ref.slice(0, 80)}" is not a supplied fact or a page read for this run.`, path: `${path}.evidenceRefs` });
    }
    if (action.executionCapability === "unknown" && action.dependencies.length === 0) {
      issues.push({ severity: "error", rule: "action_readiness", message: "Name what must be confirmed before this play can start, or identify the available execution capability.", path: `${path}.executionCapability` });
    }
    if (horizonDays && action.measurement.windowDays > horizonDays) {
      issues.push({ severity: "error", rule: "action_measurement", message: `The ${action.measurement.windowDays}-day measurement window exceeds the ${horizonDays}-day plan horizon.`, path: `${path}.measurement.windowDays` });
    }
    const unitOutcomes = actionOutcomeFamilies(play.unit);
    const metricOutcomes = actionOutcomeFamilies(action.measurement.metric);
    if (unitOutcomes.size && ![...unitOutcomes].some((outcome) => metricOutcomes.has(outcome))) {
      issues.push({ severity: "error", rule: "action_measurement", message: `The primary measurement "${action.measurement.metric}" does not match this play's forecast outcome ("${play.unit}"). Measure the same business outcome; keep visits, clicks and impressions as leading indicators.`, path: `${path}.measurement.metric` });
    } else if (!metricOutcomes.size) {
      issues.push({ severity: "error", rule: "action_measurement", message: `"${action.measurement.metric}" does not name a recognized business outcome. Use a measurable customer, booking, lead, revenue, activation or retention outcome; keep traffic and engagement as leading indicators.`, path: `${path}.measurement.metric` });
    }
    if (/\b(?:unknown|not known|not measured|no baseline)\b/i.test(action.measurement.baseline) && !/\b(?:measure|establish|collect|instrument)\b/i.test(action.measurement.source)) {
      issues.push({ severity: "warn", rule: "action_measurement", message: "The baseline is unknown; specify how the first action will measure it.", path: `${path}.measurement.source` });
    }
  });
  return issues;
}

/** "about 400 visitors a week", "1,200 trial users": the first count in a population, and whether it is per week or per month. */
function eligibleCount(population: string): { n: number; per: "week" | "month" | "total" } | null {
  const m = population.replace(/(\d),(\d{3})/g, "$1$2").match(/(\d+(?:\.\d+)?)\s*(k)?\b/i);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  const per = /\b(a|per|each|every)\s+week|\bweekly\b|\/\s?w(ee)?k/i.test(population) ? "week" : /\b(a|per|each|every)\s+month|\bmonthly\b|\/\s?mo(nth)?\b/i.test(population) ? "month" : "total";
  return { n, per };
}

/** "Stop when it's significant": peeking, which makes a fixed-horizon p-value meaningless (BK06 Ch 3). */
const PEEKING = /\b(as soon as|once|when|until)\b[^.]{0,40}\bsignifican/i;
/** A stop rule about harm (a guardrail) may stop early: Microsoft ExP auto-stops for harm (blog research BRP-21). */
const HARM_STOP = /\b(complain\w*|refund\w*|unsubscrib\w*|cancel\w*|churn\w*|errors?|crash\w*|bounce\w*|spam|chargebacks?|support tickets?|harm)\b/i;
const STOP_WORD = /\b(stop|pause|halt|switch off|turn off|roll back)\b/i;

/** The owner's measured funnel rates, by the kind of metric a test targets (shared/agents/diagnosis.ts readings). */
export type FunnelRates = { lead?: number; qualification?: number; activation?: number; purchase?: number };

/**
 * The baseline in the population's own unit (decision books: Kohavi Ch 17, the denominator must be the unit
 * counted): a purchase rate per lead can't size a test whose population is visitors. Visitors → paid is
 * lead × (activation) × purchase; when a link isn't measured the per-lead rate is kept as an upper bound.
 */
function inPopulationUnits(base: { rate: number; kind: string } | null, population: string, rates: FunnelRates | undefined): { rate: number; kind: string } | null {
  if (!base || !rates) return base;
  const visitors = /\b(visit\w*|views?|sessions?|traffic|page ?views?)\b/i.test(population);
  if (!visitors || base.kind === "lead") return base;
  const chain = base.kind === "qualification" ? [rates.lead, rates.qualification] : base.kind === "activation" ? [rates.lead, rates.qualification ?? 1, rates.activation] : [rates.lead, rates.qualification ?? 1, rates.activation ?? 1, rates.purchase];
  // A link missing: the per-lead rate is an upper bound on the per-visitor rate, so it still proves a test can't finish (never that it can).
  if (chain.some((r) => r === undefined)) return base;
  const rate = chain.reduce<number>((acc, r) => acc * (r as number), 1);
  return rate > 0 && rate < 1 ? { rate, kind: `visitor → ${base.kind}` } : null;
}

/** Which owner-measured rate a test's primary metric is about, if any. */
function baselineFor(metric: string, rates: FunnelRates | undefined): { rate: number; kind: string } | null {
  if (!rates) return null;
  const m = metric.toLowerCase();
  const pick = /\b(qualif\w* leads?|screened leads?)\b/.test(m) ? "qualification" : /\b(activat\w*|first value|onboard\w*|set ?up)\b/.test(m) ? "activation" : /\b(paid|pay\w*|purchas\w*|customers?|bookings?|booked|sales?|subscri\w*|orders?|upgrade\w*)\b/.test(m) ? "purchase" : /\b(sign-?ups?|leads?|trials?|inquir\w*|enquir\w*|registrations?)\b/.test(m) ? "lead" : null;
  const rate = pick ? rates[pick as keyof FunnelRates] : undefined;
  return pick && rate !== undefined && rate > 0 && rate < 1 ? { rate, kind: pick } : null;
}

/**
 * Expansion slice 3 + blog research BRP-21/22 (BK06 Ch 2, 3, 10–11; Microsoft ExP;
 * BK04 card requirements): a split or holdout test must name how many are
 * eligible, run at least a week, set 1–3 guardrails with a number, and be able
 * to finish even for a big swing, sized on the metric's real baseline when the
 * owner measured it. It must not stop on significance; stopping for harm is allowed.
 */
export function lintExperimentFeasibility(out: { experiments?: { name: string; method: string; population: string; durationDays: number; stoppingRule: string; primaryMetric?: string; primaryMetricType?: "binary_rate" | "count" | "continuous" | "monetary"; assignmentUnit?: string; assignmentMethod?: string; denominator?: string; baselineRate?: number | null; baselineProvenance?: "measured" | "owner_report" | "source_reported" | "unknown"; baselineEvidenceRefs?: string[]; baselineBasis?: string; minimumMeaningfulEffect?: { value: number | null; unit: string; basis: string }; plannedSamplePerArm?: number | null; plannedSampleBasis?: string; guardrails?: string[] }[] }, c?: { funnelRates?: FunnelRates }): LintIssue[] {
  const issues: LintIssue[] = [];
  (out.experiments ?? []).forEach((e, i) => {
    const path = `experiments[${i}]`;
    const harmStop = HARM_STOP.test(e.stoppingRule) && STOP_WORD.test(e.stoppingRule);
    if (PEEKING.test(e.stoppingRule) && !harmStop) issues.push({ severity: "error", rule: "experiment_feasibility", message: `"${e.name}" stops when the result looks significant. Fix the end date or sample in advance and read it once then (stopping early for harm, like complaints or refunds, is fine).`, path: `${path}.stoppingRule` });
    if (e.method !== "ab_split" && e.method !== "holdout") return;
    if (e.durationDays < 7) issues.push({ severity: "error", rule: "experiment_feasibility", message: `"${e.name}" runs ${e.durationDays} days. Run at least one whole week so weekdays and weekends both count.`, path: `${path}.durationDays` });
    const guards = (e.guardrails ?? []).filter((g) => g.trim());
    if (!guards.length || guards.length > 3 || !guards.every((g) => /\d/.test(g)))
      issues.push({ severity: "error", rule: "experiment_feasibility", message: `"${e.name}" needs 1–3 guardrails, each with a number that marks harm (e.g. "unsubscribes above 1%", "refunds above 3%").`, path: `${path}.guardrails` });
    const preregistration: [string, boolean][] = [
      ["assignmentUnit", Boolean(e.assignmentUnit?.trim())],
      ["assignmentMethod", Boolean(e.assignmentMethod && e.assignmentMethod !== "not_applicable")],
      ["primaryMetricType", Boolean(e.primaryMetricType)],
      ["denominator", Boolean(e.denominator?.trim())],
      ["baselineBasis", Boolean(e.baselineBasis?.trim())],
      ["baselineEvidenceRefs", e.baselineProvenance === "unknown" ? (e.baselineEvidenceRefs?.length ?? 0) === 0 : Boolean(e.baselineEvidenceRefs?.length)],
      ["minimumMeaningfulEffect.basis", Boolean(e.minimumMeaningfulEffect?.basis.trim())],
      ["plannedSampleBasis", Boolean(e.plannedSampleBasis?.trim())],
    ];
    for (const [field, present] of preregistration) {
      if (!present) issues.push({ severity: "error", rule: "experiment_preregistration", message: `"${e.name}" must declare ${field} before a split or holdout starts. Use an explicit unknown reason instead of guessing.`, path: `${path}.${field}` });
    }
    if (e.primaryMetricType === "binary_rate" && e.baselineRate !== null && e.baselineRate !== undefined && (!(e.baselineRate > 0 && e.baselineRate < 1) || e.baselineProvenance === "unknown" || !e.baselineProvenance))
      issues.push({ severity: "error", rule: "experiment_preregistration", message: `"${e.name}" has a baseline that is outside (0, 1) or lacks a measured, owner-reported or source-reported basis.`, path: `${path}.baselineRate` });
    if (e.primaryMetricType === "binary_rate" && (e.baselineRate === null || e.baselineRate === undefined || e.baselineProvenance === "unknown"))
      issues.push({ severity: "error", rule: "experiment_preregistration", message: `"${e.name}" has no supported binary baseline. Measure it first or choose a method that does not claim a powered split.`, path: `${path}.baselineRate` });
    const mde = e.minimumMeaningfulEffect?.value;
    if (e.primaryMetricType === "binary_rate" && (mde === null || mde === undefined || !(mde > 0) || e.minimumMeaningfulEffect?.unit !== "absolute_rate"))
      issues.push({ severity: "error", rule: "experiment_preregistration", message: `"${e.name}" needs a positive minimum meaningful effect in absolute_rate units for binary-rate sizing.`, path: `${path}.minimumMeaningfulEffect` });
    if (!Number.isInteger(e.plannedSamplePerArm) || (e.plannedSamplePerArm ?? 0) <= 0)
      issues.push({ severity: "error", rule: "experiment_preregistration", message: `"${e.name}" needs a positive whole-number planned sample per arm; explain its calculation and limits.`, path: `${path}.plannedSamplePerArm` });
    if (preregistration.some(([, present]) => !present) || !e.primaryMetricType || (e.primaryMetricType === "binary_rate" && (e.baselineRate == null || e.baselineProvenance === "unknown" || !(e.baselineEvidenceRefs?.length))) || !e.minimumMeaningfulEffect?.basis.trim() || !Number.isInteger(e.plannedSamplePerArm) || (e.plannedSamplePerArm ?? 0) <= 0) return;
    if (e.primaryMetricType === "binary_rate" && mde != null && e.baselineRate != null && e.baselineRate + mde >= 1) {
      issues.push({ severity: "error", rule: "experiment_preregistration", message: `"${e.name}" baseline plus minimum meaningful effect must stay below 100%.`, path: `${path}.minimumMeaningfulEffect` });
      return;
    }
    const measured = inPopulationUnits(baselineFor(e.primaryMetric ?? "", c?.funnelRates), e.population, c?.funnelRates);
    if (measured && e.primaryMetricType === "binary_rate" && e.baselineRate != null && Math.abs(measured.rate - e.baselineRate) > 0.0005) {
      issues.push({ severity: "error", rule: "experiment_preregistration", message: `"${e.name}" baseline must match from your measured ${measured.kind} rate (${Math.round(measured.rate * 1000) / 10}%) available to this plan.`, path: `${path}.baselineRate` });
      return;
    }
    const cnt = eligibleCount(e.population);
    if (!cnt) {
      issues.push({ severity: "error", rule: "experiment_feasibility", message: `"${e.name}" is a ${e.method === "ab_split" ? "split" : "holdout"} test but doesn't say how many people are eligible (e.g. "about 400 visitors a week"). Without it, nobody can tell if it can finish.`, path: `${path}.population` });
      return;
    }
    const days = Math.max(1, e.durationDays);
    const available = cnt.per === "week" ? cnt.n * (days / 7) : cnt.n === 0 ? 0 : cnt.per === "month" ? cnt.n * (days / 30) : cnt.n;
    const sizingBaseline = measured?.rate ?? e.baselineRate;
    if (e.primaryMetricType === "binary_rate" && sizingBaseline !== undefined && sizingBaseline !== null && mde !== null && mde !== undefined && mde > 0 && sizingBaseline + mde < 1) {
      const needPerArm = sampleSize({ baseline: sizingBaseline, minDetectable: mde }).perArm;
      if ((e.plannedSamplePerArm ?? 0) < needPerArm) issues.push({ severity: "error", rule: "experiment_preregistration", message: `"${e.name}" plans ${e.plannedSamplePerArm} per arm, but its stated baseline and minimum meaningful effect need about ${needPerArm} per arm at the default two-sided 5% alpha and 80% power.`, path: `${path}.plannedSamplePerArm` });
      if (available / 2 < e.plannedSamplePerArm!) issues.push({ severity: "error", rule: "experiment_feasibility", message: `"${e.name}" reaches about ${Math.round(available / 2)} people per arm in ${days} days, below its predeclared target of ${e.plannedSamplePerArm}. Use a baseline week, a before/after labelled observational method, interviews or an assisted pilot.`, path });
    } else if (available / 2 < (e.plannedSamplePerArm ?? Infinity)) {
      issues.push({ severity: "error", rule: "experiment_feasibility", message: `"${e.name}" reaches about ${Math.round(available / 2)} people per arm in ${days} days, below its predeclared target of ${e.plannedSamplePerArm}.`, path });
    }
  });
  return issues;
}

/** Words that keep paid reach inside a service area. */
const GEO_TARGETED = /\b(radius|within \d|km|kilomet|miles?|mi\b|neighbou?rhoods?|nearby|local(ly)?|city|town|county|borough|suburbs?|zip|post ?codes?|service area|geo-?target\w*|geo-?fenc\w*|location target\w*)\b/i;

/**
 * Expansion slice 4 (BK01 Ch 8 chain-link; pack BT-03/BT-05): demand the
 * business can't deliver is waste. Forecast new customers can't exceed the
 * owner's monthly delivery limit (a hard capacity check), and a local or
 * regional business's paid reach must target its service area.
 */
export function lintDeliveryCapacity(customers: number, c: PlanConstraints | undefined, path = "plays"): LintIssue[] {
  const cap = c?.newCustomersPerMonth;
  if (cap === undefined || !(customers > 0)) return [];
  const months = (c?.horizonDays ?? 90) / (365.25 / 12);
  const limit = cap * months;
  return customers > limit * 1.001
    ? [{ severity: "error", rule: "capacity", message: `The plays forecast about ${Math.round(customers)} new customers in ${c?.horizonDays ?? 90} days; the business can take about ${Math.round(limit)} (${cap} a month). Fill the capacity you have (pricing, selectivity, a waitlist) or add capacity before adding demand.`, path }]
    : [];
}

export function lintServiceArea(items: { path: string; spend: number; text: string }[], c: PlanConstraints | undefined): LintIssue[] {
  if (c?.serviceArea !== "local" && c?.serviceArea !== "regional") return [];
  return items
    .filter((x) => x.spend > 0 && !GEO_TARGETED.test(x.text))
    .map((x) => ({ severity: "error" as const, rule: "service_area", message: `This spends on paid reach for a ${c.serviceArea} business without limiting it to the service area. Target only where you can serve (radius, neighbourhoods, postcodes).`, path: x.path }));
}

/** A reported change in someone else's results: "increased conversions by 30%", "a 2x lift", "grew signups 40%". */
const REPORTED_UPLIFT = /\b(?:increas\w*|boost\w*|lift\w*|grew|grow\w*|rais\w*|improv\w*|doubl\w*|tripl\w*|jump\w*|uplift)\b[^.]{0,60}?(?:\d+(?:\.\d+)?\s?%|\d+(?:\.\d+)?\s?[x×])|\b\d+(?:\.\d+)?\s?%\s+(?:lift|uplift|increase|more|higher|boost)\b/i;
/** Company case-study framing in a plan's prose: "like Acme, who saw 30%". */
const CASE_TRANSFER = /\b(?:like|as|just as|similar to)\s+[A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*)?\s*(?:,\s*(?:who|which)\s+)?(?:saw|got|achieved|reported|did|grew|increased)\b[^.]{0,60}\d+(?:\.\d+)?\s?(?:%|[x×])/;

/**
 * Expansion slice 10 (pack RECONCILIATION §10, public cases; BK06 Ch 11): a
 * published success story is a mechanism hypothesis, not a forecast. A funnel
 * rate can't be another business's reported lift, and a plan can't promise one.
 */
export function lintBorrowedUplift(plays: { name?: string; model?: { steps?: { name: string; source?: string; quote?: string }[] } }[], prose: { path: string; text: string }[] = []): LintIssue[] {
  const issues: LintIssue[] = [];
  plays.forEach((p, i) =>
    (p.model?.steps ?? []).forEach((s, j) => {
      if ((s.source === "research" || s.source === "benchmark") && REPORTED_UPLIFT.test(s.quote ?? ""))
        issues.push({ severity: "error", rule: "borrowed_uplift", message: `"${p.name ?? `Play ${i + 1}`}" step "${s.name}" uses another business's reported lift as its rate. Use a base rate for this step, or label an assumption and test it.`, path: `plays[${i}].model.steps[${j}]` });
    }),
  );
  for (const x of prose) if (CASE_TRANSFER.test(x.text)) issues.push({ severity: "error", rule: "borrowed_uplift", message: "Promises another company's reported result. Treat their story as an idea to test here, not a forecast.", path: x.path });
  return issues;
}

/** Sending to a list the business already has ("email your list", "newsletter subscribers"). Building a list doesn't match. */
const USES_LIST = /\b(?:your|existing|current)\s+(?:email\s+|mailing\s+|newsletter\s+)?(?:list|subscribers?|newsletter)\b|\bnewsletter\s+subscribers?\b|\b(?:email|broadcast|send)\w*\s+(?:to\s+)?(?:your|the|existing)\s+(?:\d[\d,]*\s+)?(?:subscribers?|list)\b/i;
const BUILDS_LIST = /\b(?:start|launch|build|create|grow|set up|collect)\w*\b[^.]{0,40}\b(?:list|newsletter|subscribers?)\b/i;
const LIST_IN_EVIDENCE = /\b(subscribers?|newsletter|mailing list|email list|contacts?)\b/i;

/**
 * Book 14 §4: no audience is assumed. With no consented contacts in ClimbOS and
 * no fact about a list, a play or channel can't rely on emailing one.
 */
export function lintNoAudience(out: unknown, c: PlanConstraints | undefined, evidence: string): LintIssue[] {
  if (c?.emailAudience === undefined || c.emailAudience > 0 || LIST_IN_EVIDENCE.test(evidence)) return [];
  return stringFields(out)
    .filter(({ path, text }) => !/url|sourceUrl|notDoing|risks/i.test(path) && USES_LIST.test(text) && !BUILDS_LIST.test(text))
    .slice(0, 3)
    .map(({ path }) => ({ severity: "error" as const, rule: "no_audience", message: "This relies on an email list, but the business has no consented contacts in ClimbOS and no fact says it has a list. Build the list first (a signup or lead magnet), or reach people another way.", path }));
}

/** "40 new customers", "120–200 paying users": a count of outcomes over the plan's horizon. Interviews, calls and per-week rates are not. */
const OUTCOME_COUNT = /(?<![\d.,$£€\w])(\d[\d,]*)(?:\s*(?:-|–|to)\s*(\d[\d,]*))?\s+(?:(?:new|more|extra|additional|paying|paid|first|net)\s+){0,2}(?:customers?|clients?|subscribers?|members?|accounts?|teams?|users?|buyers?)\b(?!\s+(?:interviews?|calls?|conversations?|reviews?|stories|story|quotes?|testimonials?|case|studies|study|emails?|names?))(?!\s*(?:a|per|\/|each|every)\s*(?:week|day|month))/gi;

/**
 * Book 14 §7: every customer count in the plan's prose must be one the code
 * calculated (any play's or the portfolio's P10/P50/P90), the owner's goal, or
 * a number in the facts. A rewrite can't quietly promise more than the maths.
 */
export function lintOutcomeNumbers(out: unknown, c: PlanConstraints | undefined, evidence: string): LintIssue[] {
  const calc = c?.forecastCustomers ?? [];
  if (!calc.length) return [];
  const allowed = [...calc, ...(c?.goalNumbers ?? [])].filter((n) => Number.isFinite(n));
  const ev = ` ${evidence.replace(/(\d),(\d)/g, "$1$2")} `;
  const ok = (n: number) => n <= 2 || allowed.some((a) => Math.abs(a - n) <= Math.max(1, a * 0.15)) || new RegExp(`(?<![\\d.])${n}(?![\\d])`).test(ev);
  const issues: LintIssue[] = [];
  for (const { path, text } of stringFields(out)) {
    // The North Star target has its own check; baselines and weekly indicators aren't horizon totals.
    if (/^northStar\.(target|baseline)$|^leadingIndicators|^notDoing|url|sourceUrl/i.test(path)) continue;
    const bad = [...text.matchAll(OUTCOME_COUNT)].flatMap((m) => [m[1], m[2]].filter(Boolean).map((d) => Number(d.replace(/,/g, "")))).filter((n) => !ok(n));
    if (bad.length) {
      const p50 = c?.lockedCustomers;
      issues.push({ severity: "error", rule: "consistency", message: `Customer count ${[...new Set(bad)].join(", ")} isn't one the plays calculate${p50 ? ` (they add up to ≈${Math.round(p50)})` : ""}, the goal, or a fact. Use the calculated number or drop it.`, path });
    }
  }
  return issues;
}

/** Plans and plays: numbers trace to any input or the output's own model; labelled assumptions and targets pass. */
function lintPlanning(out: unknown, input: AgentInput): LintIssue[] {
  return lintCopy(out, { evidence: `${evidenceOf(input)}\n${ownNumbers(out).join(" ")}`, labelled: true, skip: (p) => /url|sourceUrl|keywords|key$|killIf|scaleIf|falsifier|days$|weeklyTarget|target$/i.test(p) });
}

const ANGLE_STOP_WORDS = new Set(["a", "an", "and", "at", "for", "from", "in", "of", "on", "or", "the", "to", "with", "your", "their", "when", "how", "why"]);

function normalizeAngleWord(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Flags thin and lexically near-identical angle choices without claiming semantic understanding. */
export function lintDistinctAngles(items: { path: string; angle: string }[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const normalized = items.map((item) => {
    const angle = typeof item.angle === "string" ? item.angle : "";
    const words = angle.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [];
    const meaningful = new Set(words.filter((word) => !ANGLE_STOP_WORDS.has(word)).map(normalizeAngleWord));
    if (!angle.trim()) issues.push({ severity: "error", rule: "copy_angle", message: "Choose one concrete reader angle for this piece before drafting it.", path: item.path });
    if (words.length > 12) issues.push({ severity: "error", rule: "copy_angle", message: `This angle is ${words.length} words; make it one idea in 12 words or fewer.`, path: item.path });
    return { ...item, meaningful };
  });
  for (let i = 0; i < normalized.length; i += 1) {
    const left = normalized[i]!;
    if (left.meaningful.size < 4) continue;
    for (let j = i + 1; j < normalized.length; j += 1) {
      const right = normalized[j]!;
      const union = new Set([...left.meaningful, ...right.meaningful]);
      const overlap = [...left.meaningful].filter((word) => right.meaningful.has(word)).length / union.size;
      if (overlap >= 0.8) {
        issues.push({ severity: "warn", rule: "repeated_angle", message: `This angle closely repeats ${left.path}. Choose a different customer moment, objection, use case, customer phrase, myth, or proof mechanism.`, path: right.path });
      }
    }
  }
  return issues;
}

const COPY_STOP_WORDS = new Set([...ANGLE_STOP_WORDS, "about", "after", "all", "also", "are", "as", "be", "been", "before", "being", "but", "can", "do", "does", "each", "get", "gets", "has", "have", "here", "if", "it", "its", "just", "more", "most", "not", "our", "out", "so", "than", "that", "this", "was", "we", "were", "will", "you"]);

function copyTokens(text: string): string[] {
  return (text.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+/gu) ?? [])
    .map(normalizeAngleWord)
    .filter((word) => !COPY_STOP_WORDS.has(word));
}

function tokenOverlap(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  const union = new Set([...a, ...b]);
  return union.size ? [...a].filter((word) => b.has(word)).length / union.size : 0;
}

/** Warns on likely repeated propositions or openings within a generated campaign set. */
export function lintRepeatedCopyPieces(items: { path: string; text: string }[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const normalized = items.map((item) => {
    const tokens = copyTokens(item.text);
    const opening = copyTokens(item.text.split(/(?<=[.!?])\s+|\n+/)[0] ?? "").slice(0, 12);
    return { ...item, tokens, opening };
  });
  for (let i = 0; i < normalized.length; i += 1) {
    const left = normalized[i]!;
    for (let j = i + 1; j < normalized.length; j += 1) {
      const right = normalized[j]!;
      const propositionSimilarity = left.tokens.length >= 8 && right.tokens.length >= 8 ? tokenOverlap(left.tokens, right.tokens) : 0;
      const openingSimilarity = left.opening.length >= 5 && right.opening.length >= 5 ? tokenOverlap(left.opening, right.opening) : 0;
      const exactOpening = left.opening.length >= 4 && left.opening.join(" ") === right.opening.join(" ");
      if (propositionSimilarity >= 0.55 || openingSimilarity >= 0.7 || exactOpening) {
        const reason = propositionSimilarity >= 0.55 ? "Their main wording overlaps" : "Their openings overlap";
        issues.push({ severity: "warn", rule: "repeated_copy", message: `${reason} with ${left.path}. Rework one piece around a different reader moment, objection, use case, customer phrase, or proof point.`, path: right.path });
      }
    }
  }
  return issues;
}

function lintSocial(out: SocialPostsV2, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = [];
  issues.push(...lintCopyBrief(out.copyBrief, input));
  issues.push(...lintDistinctAngles(out.posts.map((p, i) => ({ path: `posts[${i}].angle`, angle: p.angle }))));
  issues.push(...lintRepeatedCopyPieces(out.posts.map((p, i) => ({ path: `posts[${i}].body`, text: `${p.title}\n${p.hook}\n${p.body}` }))));
  issues.push(...lintEmbeddedUrls(out.posts.flatMap((p, i) => [
    { path: `posts[${i}].title`, text: p.title },
    { path: `posts[${i}].hook`, text: p.hook },
    { path: `posts[${i}].body`, text: p.body },
    { path: `posts[${i}].firstComment`, text: p.firstComment },
  ]), input));
  out.posts.forEach((p, i) => {
    const lim = CHANNEL_LIMITS[p.channel] ?? CHANNEL_LIMITS.instagram;
    const path = `posts[${i}]`;
    issues.push(
      ...lintCopy({ angle: p.angle, body: p.body, slides: p.slides, script: p.videoScript, firstComment: p.firstComment }, { evidence: evidenceOf(input), claimEvidence: verifiedCapabilityEvidence(input), emojiPer150: lim.emojiPer150, publishable: true }).map((l) => ({ ...l, path: `${path}.${l.path ?? ""}` })),
      ...lintFactIndexes(p.factIndexes, input.facts.length, `${path}.factIndexes`),
      // Briefs and alt text are complete too: no owner questions hidden in them.
      ...lintCopy({ title: p.title, hook: p.hook, visualBrief: p.visualBrief, altText: p.altText, imageIdea: p.imageIdea }, { publishable: true }).filter((l) => l.rule === "placeholder").map((l) => ({ ...l, path: `${path}.${l.path ?? ""}` })),
      ...maxLength(p.body, lim.body, `${path}.body`, "Post"),
      ...maxItems(p.hashtags, lim.hashtags, `${path}.hashtags`, "hashtags"),
      ...(lim.fold ? hookBeforeFold(p.body, lim.fold, `${path}.body`) : []),
    );
    if (p.format === "carousel" || p.format === "document") issues.push(...minItems(p.slides, 3, `${path}.slides`, "slides for a carousel"), ...maxItems(p.slides, 20, `${path}.slides`, "slides"));
    if (p.format === "reel" && !p.videoScript.trim()) issues.push({ severity: "error", rule: "missing", message: "A Reel needs a script.", path: `${path}.videoScript` });
    if (!p.altText.trim() && p.format !== "text" && p.format !== "thread") issues.push({ severity: "error", rule: "accessibility", message: "Visual posts need alt text.", path: `${path}.altText` });
    issues.push(...lintVoice([p.body, ...p.slides, p.videoScript, p.firstComment].join("\n"), path));
    const minWords = MIN_BODY_WORDS[p.channel];
    const words = p.body.split(/\s+/).filter(Boolean).length;
    if (minWords && words < minWords && p.format !== "reel" && p.format !== "story") {
      issues.push({ severity: "error", rule: "thin", message: `${p.channel} post body is ${words} words; write ${minWords}-150 (hook, why it matters, proof, one next step).`, path: `${path}.body` });
    }
    const promised = promisedCount([p.title, p.hook, p.altText].join(" "));
    if (promised && (p.format === "carousel" || p.format === "document") && p.slides.length < promised + 1) {
      issues.push({ severity: "error", rule: "promise", message: `The post promises ${promised} items but has ${p.slides.length} slides (with the cover). Deliver every item or change the number.`, path: `${path}.slides` });
    }
  });
  return issues;
}

/** Own-channel copy speaks as the brand; reviewer-style third person reads as an outsider. */
export function lintVoice(text: string, path: string): LintIssue[] {
  const m = text.match(/\b(?:the (?:team|company|brand|founders?|business) (?:says|claims|notes|admits|states)|the (?:site|website|company)'s own (?:claim|words)|according to (?:the|their) (?:site|website|homepage))\b/i);
  return m ? [{ severity: "error", rule: "voice", message: `Write as the brand ("we", "our"), not about it: "${m[0]}".`, path }] : [];
}

/** "6 things", "five ways": the number a title or hook promises. */
export function promisedCount(text: string): number | null {
  const words: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const m = text.match(/\b(\d{1,2}|three|four|five|six|seven|eight|nine|ten) (?:things|ways|reasons|tips|mistakes|steps|signs|ideas|myths|questions|rules|lessons)\b/i);
  if (!m) return null;
  const n = words[m[1].toLowerCase()] ?? Number(m[1]);
  return n >= 3 && n <= 20 ? n : null;
}

function lintAds(out: AdDraftsV2, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = [...lintCopyBrief(out.copyBrief, input), ...lintCopy(out, { evidence: evidenceOf(input), claimEvidence: verifiedCapabilityEvidence(input), publishable: true, skip: (p) => /keywords|finalUrl|negative|creativeBrief|landingPageMatch/i.test(p) }), ...lintDistinctAngles([...out.searchAds.map((ad, i) => ({ path: `searchAds[${i}].angle`, angle: ad.angle })), ...out.metaAds.map((ad, i) => ({ path: `metaAds[${i}].angle`, angle: ad.angle }))]), ...lintRepeatedCopyPieces([...out.searchAds.map((ad, i) => ({ path: `searchAds[${i}]`, text: `${ad.headlines.join(" ")} ${ad.descriptions.join(" ")}` })), ...out.metaAds.map((ad, i) => ({ path: `metaAds[${i}]`, text: `${ad.headline} ${ad.primaryText} ${ad.description}` }))]), ...lintEmbeddedUrls([
    ...out.searchAds.flatMap((ad, i) => ad.headlines.concat(ad.descriptions).map((text) => ({ path: `searchAds[${i}]`, text }))),
    ...out.metaAds.flatMap((ad, i) => [ad.primaryText, ad.headline, ad.description].map((text) => ({ path: `metaAds[${i}]`, text }))),
  ], input), ...lintAdDestinations(out, input), ...lintFactIndexes(out.factIndexes, input.facts.length)];
  out.searchAds.forEach((a, i) => {
    const path = `searchAds[${i}]`;
    issues.push(...minItems(a.headlines, 3, `${path}.headlines`, "headlines"), ...maxItems(a.headlines, 15, `${path}.headlines`, "headlines"));
    issues.push(...minItems(a.descriptions, 2, `${path}.descriptions`, "descriptions"), ...maxItems(a.descriptions, 4, `${path}.descriptions`, "descriptions"));
    a.headlines.forEach((h, j) => issues.push(...maxLength(h, 30, `${path}.headlines[${j}]`, "Headline")));
    a.descriptions.forEach((d, j) => issues.push(...maxLength(d, 90, `${path}.descriptions[${j}]`, "Description")));
    a.paths.forEach((p, j) => issues.push(...maxLength(p, 15, `${path}.paths[${j}]`, "Display path")));
    if (/\p{Extended_Pictographic}/u.test([...a.headlines, ...a.descriptions].join(" "))) issues.push({ severity: "error", rule: "emoji", message: "Google search ads can't use emoji.", path });
  });
  out.metaAds.forEach((m, i) => {
    issues.push(...maxLength(m.headline, 40, `metaAds[${i}].headline`, "Headline"));
    issues.push(...hookBeforeFold(m.primaryText, 125, `metaAds[${i}].primaryText`));
  });
  return issues;
}

/** Ad destinations must be a safe web URL on the business site or explicitly supplied by the owner. */
function lintAdDestinations(out: AdDraftsV2, input: AgentInput): LintIssue[] {
  const businessHost = input.businessWebsite ? domainOf(input.businessWebsite) : null;
  const issues: LintIssue[] = [];
  out.searchAds.forEach((ad, index) => {
    const path = `searchAds[${index}].finalUrl`;
    const raw = ad.finalUrl.trim();
    if (!raw) {
      if (!businessHost) issues.push({ severity: "error", rule: "ad_destination", message: "Provide the business website or an explicit destination URL before creating this ad.", path });
      return;
    }
    issues.push(...lintOneOutboundUrl(raw, path, input, "ad_destination"));
  });
  return issues;
}

function ownerSuppliedTaskUrls(input: AgentInput): Set<string> {
  return new Set(
    (input.ownerSuppliedUrls ?? [])
      .map((url) => url.replace(/[.,;!?]+$/, ""))
      .map(normalizeSourceUrl)
      .filter((url): url is string => Boolean(url)),
  );
}

function lintOneOutboundUrl(rawUrl: string, path: string, input: AgentInput, rule = "copy_link"): LintIssue[] {
  const raw = rawUrl.replace(/[.,;!?]+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return [{ severity: "error", rule, message: "Links in ready-to-use copy must be absolute HTTPS URLs.", path }];
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return [{ severity: "error", rule, message: "Links in ready-to-use copy must use HTTPS and cannot contain embedded credentials.", path }];
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const businessHost = input.businessWebsite ? domainOf(input.businessWebsite) : null;
  const isBusinessHost = businessHost !== null && (host === businessHost || host.endsWith(`.${businessHost}`));
  const url = normalizeSourceUrl(raw);
  if (isBusinessHost || (url !== null && ownerSuppliedTaskUrls(input).has(url))) return [];
  return [{ severity: "error", rule, message: "This link is outside the business website and was not explicitly supplied by the owner. Use the business site or provide the approved URL.", path }];
}

export function lintEmbeddedUrls(fields: { path: string; text: string }[], input: AgentInput): LintIssue[] {
  return fields.flatMap(({ path, text }) => {
    const matches = [...text.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)];
    return matches.flatMap((match) => lintOneOutboundUrl(match[0], path, input));
  });
}

function lintGeneric(out: unknown, input: AgentInput): LintIssue[] {
  return lintCopy(out, { evidence: evidenceOf(input), skip: (p) => /url|sourceUrl|keywords|key$/i.test(p) });
}

/** Source links in business intelligence must be among the pages supplied to this exact run. */
function normalizeSourceUrl(raw: string): string | null {
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") return null;
      u.hash = "";
      u.hostname = u.hostname.toLowerCase();
      if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/$/, "");
      return u.toString().replace(/\/$/, "");
    } catch {
      return null;
    }
}

export function lintAvailableSourceUrls(refs: { url: string; path: string }[], input: AgentInput): LintIssue[] {
  const sourceCandidates = [
    ...(input.availableSourceUrls ?? []),
    ...(input.precomputedResearch?.sources ?? []).map((s) => s.url),
  ];
  const available = new Set(sourceCandidates.map(normalizeSourceUrl).filter((x): x is string => Boolean(x)));
  return refs.flatMap(({ url, path }) => {
    const source = normalizeSourceUrl(url);
    return source && available.has(source) ? [] : [{ severity: "error" as const, rule: "citation", message: `This citation points to a page that was not present in this run's supplied sources. Use a page ClimbOS read, or leave the citation out.`, path }];
  });
}

/** Validate the shared campaign context against only the facts and pages available to this run. */
export function lintCopyBrief(brief: CopyBrief | undefined, input: AgentInput): LintIssue[] {
  // The Zod output schemas require this field in live generation; tolerate
  // older hand-built test fixtures passed directly to individual lint helpers.
  if (!brief) return [];
  const refs = [
    ...brief.offerFactIndexes.map((index, i) => ({ index, path: `copyBrief.offerFactIndexes[${i}]` })),
    ...brief.proofFactIndexes.map((index, i) => ({ index, path: `copyBrief.proofFactIndexes[${i}]` })),
    ...brief.supportingFactIndexes.map((index, i) => ({ index, path: `copyBrief.supportingFactIndexes[${i}]` })),
  ];
  const normalizeExample = (example: string) => example.replace(/\s+/g, " ").trim();
  const approvedExamples = new Set((input.ownerApprovedExamples ?? []).map(normalizeExample));
  const inventedExamples = brief.approvedExamples.flatMap((example, i) => approvedExamples.has(normalizeExample(example))
    ? []
    : [{ severity: "error" as const, rule: "approved_example", message: "Use only an exact example the owner saved as approved; omit this field when none was supplied.", path: `copyBrief.approvedExamples[${i}]` }]);
  return [
    ...inventedExamples,
    ...refs.flatMap(({ index, path }) => lintFactIndexes([index], input.facts.length, path)),
    ...lintAvailableSourceUrls(brief.supportingSourceUrls.map((url, i) => ({ url, path: `copyBrief.supportingSourceUrls[${i}]` })), input),
  ];
}

export function lintInsightSources(out: Pick<InsightsV2, "audiences" | "competitors" | "alternatives" | "vocPhrases" | "objections" | "gaps" | "swot" | "swotEvidence" | "swotMoves" | "siteAssessment">, input: AgentInput): LintIssue[] {
  const refs: { url: string; path: string }[] = [];
  out.competitors.forEach((competitor, i) => {
    refs.push({ url: competitor.sourceUrl, path: `competitors[${i}].sourceUrl` });
    competitor.comparison?.forEach((finding, j) => refs.push({ url: finding.sourceUrl, path: `competitors[${i}].comparison[${j}].sourceUrl` }));
  });
  const groups: [string, { sourceUrl: string }[]][] = [
    ["alternatives", out.alternatives],
    ["vocPhrases", out.vocPhrases],
    ["objections", out.objections],
    ["gaps", out.gaps],
  ];
  refs.push(...groups.flatMap(([group, rows]) => rows.map((row, i) => ({ url: row.sourceUrl, path: `${group}[${i}].sourceUrl` }))));
  const siteQuoteIssues: LintIssue[] = [];
  const normalizeQuote = (text: string) => text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const pageBlocks = [...(input.untrustedContext ?? "").matchAll(/<untrusted_content source="([^"]+)">\s*([\s\S]*?)\s*<\/untrusted_content>/gi)];
  out.siteAssessment.forEach((finding, index) => {
    const path = `siteAssessment[${index}]`;
    refs.push({ url: finding.sourceUrl, path: `${path}.sourceUrl` });
    const source = normalizeSourceUrl(finding.sourceUrl);
    const quote = normalizeQuote(finding.evidenceQuote);
    const supported = source && quote && pageBlocks.some(([, pageUrl, pageText]) =>
      normalizeSourceUrl(pageUrl) === source && normalizeQuote(pageText).includes(quote),
    );
    if (!supported) siteQuoteIssues.push({ severity: "error", rule: "site_assessment_quote", message: "Use a verbatim excerpt from the cited website page that ClimbOS read in this run; do not cite owner text or another page.", path: `${path}.evidenceQuote` });
  });
  const factCount = input.facts.length;
  const swotIssues: LintIssue[] = [];
  const audienceEvidence = (items: { statement: string; basis: string; evidenceRefs: string[] }[], path: string) => items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (item.basis !== "inference" && item.evidenceRefs.length === 0) {
      swotIssues.push({ severity: "error", rule: "audience_evidence", message: "Label an unsupported audience hypothesis as inference, or cite a supplied fact or page read in this run.", path: `${itemPath}.evidenceRefs` });
    }
    const hasFact = item.evidenceRefs.some((ref) => /^fact:\d+$/i.test(ref.trim()));
    const hasPage = item.evidenceRefs.some((ref) => /^https?:\/\//i.test(ref.trim()));
    if ((item.basis === "owner_report" || item.basis === "measured") && !hasFact) {
      swotIssues.push({ severity: "error", rule: "audience_evidence", message: "Owner-reported and measured audience findings must point to a supplied fact record.", path: `${itemPath}.evidenceRefs` });
    }
    if (item.basis === "research" && !hasPage) {
      swotIssues.push({ severity: "error", rule: "audience_evidence", message: "A research audience finding must cite a page read in this run.", path: `${itemPath}.evidenceRefs` });
    }
    for (const ref of item.evidenceRefs) {
      const fact = /^fact:(\d+)$/i.exec(ref.trim());
      if (fact) {
        if (Number(fact[1]) >= factCount) swotIssues.push({ severity: "error", rule: "citation", message: `Evidence reference "${ref}" is outside this run's confirmed fact list.`, path: `${itemPath}.evidenceRefs` });
      } else if (/^https?:\/\//i.test(ref.trim())) {
        refs.push({ url: ref, path: `${itemPath}.evidenceRefs` });
      } else {
        swotIssues.push({ severity: "error", rule: "citation", message: "Use fact:N or a page URL read in this run.", path: `${itemPath}.evidenceRefs` });
      }
    }
  });
  out.audiences.forEach((audience, index) => {
    const path = `audiences[${index}]`;
    audienceEvidence(audience.needs, `${path}.needs`);
    audienceEvidence(audience.objections, `${path}.objections`);
    audienceEvidence(audience.purchasingMotivations, `${path}.purchasingMotivations`);
    audienceEvidence(audience.channelPreferences.map(({ channel, rationale, basis, evidenceRefs }) => ({ statement: `${channel}: ${rationale}`, basis, evidenceRefs })), `${path}.channelPreferences`);
  });
  const dimensions = {
    strength: { statements: out.swot.strengths, path: "strengths" },
    weakness: { statements: out.swot.weaknesses, path: "weaknesses" },
    opportunity: { statements: out.swot.opportunities, path: "opportunities" },
    threat: { statements: out.swot.threats, path: "threats" },
  };
  const represented = new Set<string>();
  out.swotEvidence.forEach((finding, index) => {
    const path = `swotEvidence[${index}]`;
    const dimensionRows = dimensions[finding.dimension].statements;
    if (!dimensionRows.includes(finding.finding)) {
      swotIssues.push({ severity: "error", rule: "swot_evidence", message: "Each evidence record must match a statement in its SWOT section exactly.", path: `${path}.finding` });
    }
    represented.add(`${finding.dimension}\u0000${finding.finding}`);
    if (!finding.strategicImplication.trim()) {
      swotIssues.push({ severity: "error", rule: "swot_evidence", message: "Explain the decision or action this finding could change.", path: `${path}.strategicImplication` });
    }
    if (finding.basis !== "inference" && finding.evidenceRefs.length === 0) {
      swotIssues.push({ severity: "error", rule: "swot_evidence", message: "A non-inference SWOT finding needs a traceable fact or source.", path: `${path}.evidenceRefs` });
    }
    const hasFact = finding.evidenceRefs.some((ref) => /^fact:\d+$/i.test(ref.trim()));
    const hasPage = finding.evidenceRefs.some((ref) => /^https?:\/\//i.test(ref.trim()));
    if ((finding.basis === "owner_report" || finding.basis === "measured") && !hasFact) {
      swotIssues.push({ severity: "error", rule: "swot_evidence", message: "Owner reports and measured findings must point to a supplied fact record.", path: `${path}.evidenceRefs` });
    }
    if (finding.basis === "research" && !hasPage) {
      swotIssues.push({ severity: "error", rule: "swot_evidence", message: "A research finding must cite a page read in this run.", path: `${path}.evidenceRefs` });
    }
    for (const ref of finding.evidenceRefs) {
      const fact = /^fact:(\d+)$/i.exec(ref.trim());
      if (fact) {
        if (Number(fact[1]) >= factCount) swotIssues.push({ severity: "error", rule: "citation", message: `Evidence reference "${ref}" is outside this run's confirmed fact list.`, path: `${path}.evidenceRefs` });
      } else if (/^https?:\/\//i.test(ref.trim())) {
        refs.push({ url: ref, path: `${path}.evidenceRefs` });
      } else {
        swotIssues.push({ severity: "error", rule: "citation", message: "Use fact:N or a page URL read in this run.", path: `${path}.evidenceRefs` });
      }
    }
  });
  for (const [dimension, section] of Object.entries(dimensions)) section.statements.forEach((finding) => {
    if (!represented.has(`${dimension}\u0000${finding}`)) {
      swotIssues.push({ severity: "error", rule: "swot_evidence", message: "Give this SWOT statement a source or label it as an inference, and explain its strategic implication.", path: `swot.${section.path}` });
    }
  });
  const moveDimensions = {
    strength_opportunity: ["strength", "opportunity"],
    weakness_opportunity: ["weakness", "opportunity"],
    strength_threat: ["strength", "threat"],
    weakness_threat: ["weakness", "threat"],
  } as const;
  const seenMoves = new Set<string>();
  out.swotMoves.forEach((move, index) => {
    const path = `swotMoves[${index}]`;
    const [first, second] = moveDimensions[move.kind];
    const firstRows = dimensions[first].statements;
    const secondRows = dimensions[second].statements;
    if (!Number.isInteger(move.firstIndex) || move.firstIndex < 0 || move.firstIndex >= firstRows.length) {
      swotIssues.push({ severity: "error", rule: "swot_move", message: `Select an existing ${first} statement for this strategic combination.`, path: `${path}.firstIndex` });
    }
    if (!Number.isInteger(move.secondIndex) || move.secondIndex < 0 || move.secondIndex >= secondRows.length) {
      swotIssues.push({ severity: "error", rule: "swot_move", message: `Select an existing ${second} statement for this strategic combination.`, path: `${path}.secondIndex` });
    }
    const key = `${move.kind}:${move.firstIndex}:${move.secondIndex}`;
    if (seenMoves.has(key)) swotIssues.push({ severity: "error", rule: "swot_move", message: "Keep only one move for each pair of SWOT findings.", path });
    seenMoves.add(key);
    if (!move.move.trim() || !move.firstTest.trim() || !move.measure.trim()) {
      swotIssues.push({ severity: "error", rule: "swot_move", message: "Each strategy needs a concrete move, a first test, and a measure.", path });
    }
  });
  return [...lintAvailableSourceUrls(refs, input), ...siteQuoteIssues, ...swotIssues];
}

/** Lint for things that get published or sent as written (emails, pages): no placeholders. */
function lintPublishable(out: unknown, input: AgentInput): LintIssue[] {
  const factIndexes = (out as { factIndexes?: number[] }).factIndexes ?? [];
  return [...lintCopy(out, { evidence: evidenceOf(input), claimEvidence: verifiedCapabilityEvidence(input), publishable: true, skip: (p) => /url|sourceUrl|keywords|key$|intentEvidence|eeatSignals|outline|goal|successMetric/i.test(p) }), ...lintFactIndexes(factIndexes, input.facts.length)];
}

export function lintSearchIntent(out: z.infer<typeof SeoBriefV2Schema>): LintIssue[] {
  const inferred = inferSearchIntentStage(`${out.primaryKeyword} ${out.searchIntent} ${out.intentEvidence}`, out.pageType);
  if (inferred === "unclear" || out.intentStage === inferred) return [];
  return [{ severity: "error", rule: "search_intent", message: `The page is labeled ${out.intentStage}, but its keyword and intent evidence indicate ${inferred} intent. Match the content and next step to the searcher's stage.`, path: "intentStage" }];
}

export function lintSeoEvidence(out: z.infer<typeof SeoBriefV2Schema>, input: AgentInput): LintIssue[] {
  const factIndexes: LintIssue[] = [
    ...out.faqs.flatMap((faq, i) => lintFactIndexes(faq.factIndexes, input.facts.length, `faqs[${i}].factIndexes`)),
    ...out.citableClaims.flatMap((claim, i) => lintFactIndexes(claim.factIndexes, input.facts.length, `citableClaims[${i}].factIndexes`)),
  ];
  const sourceRefs = [
    ...out.faqs.flatMap((faq, i) => faq.sourceUrls.map((url) => ({ url, path: `faqs[${i}].sourceUrls` }))),
    ...out.citableClaims.flatMap((claim, i) => claim.sourceUrls.map((url) => ({ url, path: `citableClaims[${i}].sourceUrls` }))),
  ];
  const citationIssues = lintAvailableSourceUrls(sourceRefs, input);
  const claimIssues = out.citableClaims.flatMap((claim, i) => claim.factIndexes.length || claim.sourceUrls.length ? [] : [{
    severity: "error" as const,
    rule: "citation",
    message: "A citable claim needs at least one confirmed fact index or source page read in this run.",
    path: `citableClaims[${i}]`,
  }]);
  return [...factIndexes, ...citationIssues, ...claimIssues];
}

export function lintSeoRecommendation(out: z.infer<typeof SeoBriefV2Schema>, input: AgentInput): LintIssue[] {
  const target = out.targetPageUrl.trim();
  const issues: LintIssue[] = [];
  if (!out.recommendationReason.trim()) {
    issues.push({ severity: "error", rule: "seo_recommendation", message: "Explain why this should refresh an existing page or create a new one.", path: "recommendationReason" });
  }
  if (out.recommendedAction === "refresh_existing_page" && !target) {
    issues.push({ severity: "error", rule: "seo_recommendation", message: "A refresh recommendation must name an existing page observed in this run.", path: "targetPageUrl" });
  }
  if (out.recommendedAction === "create_new_page" && target) {
    issues.push({ severity: "error", rule: "seo_recommendation", message: "A new-page recommendation must leave targetPageUrl empty.", path: "targetPageUrl" });
  }
  if (target) issues.push(...lintAvailableSourceUrls([{ url: target, path: "targetPageUrl" }], input));
  return issues;
}

/** Conversion findings must point to a page supplied to this run, not a plausible-looking URL. */
export function lintConversionAuditSources(out: z.infer<typeof ConversionAuditV2Schema>, input: AgentInput): LintIssue[] {
  return lintAvailableSourceUrls(
    out.findings.map((finding, i) => ({ url: finding.sourceUrl, path: `findings[${i}].sourceUrl` })),
    input,
  );
}

/* ---------------- Rubrics ---------------- */

/** A primary skill's rubric, with other skills' checklists available to the critic via criticSkills. */
function rubricOf(id: string): Rubric {
  return skillRubric(id);
}

/** Which play catalogs a business type gets (keeps prompts focused). */
export function playCatalogsFor(type: string | null | undefined): string[] {
  switch (type) {
    case "saas":
    case "b2b_saas":
    case "creator_saas":
    case "b2b_service":
    case "agency":
      return ["plays-saas-b2b"];
    case "ecommerce":
    case "physical_products":
    case "b2c_app":
    case "creator":
      return ["plays-ecommerce-consumer"];
    case "services":
    case "local_service":
    case "local_food":
    case "local_fitness":
      return ["plays-local"];
    default:
      return ["plays-local", "plays-saas-b2b"];
  }
}

/* ---------------- Specs ---------------- */

interface SpecOptions {
  models?: Partial<PhaseModels>;
  effort?: Partial<Record<"research" | "draft" | "critic", Effort>>;
  maxRevisions?: number;
  shipOn?: "gates" | "rubric";
  /** S5 flag (REQ-STRAT-05, REQ-OUT-03): a focused decision instead of the fixed bankable + creative portfolio. */
  decisionContract?: boolean;
}

/**
 * Review profiles (models come from shared/agents/routes.ts):
 * - "expert" jobs (insights, strategy, weekly plan): the reviewer scores the
 *   full rubric, at most one revision.
 * - "lean" jobs (publishable content, audits): drafted once with the skills;
 *   the reviewer only checks hard gates and lint, and revises only on a failure.
 */
type Profile = "expert" | "lean";

const TOKEN_FLOORS = { research: 16_000, draft: 24_000, critic: 12_000 };
function withFloors(m: { research: number; draft: number; critic: number }) {
  return { research: Math.max(m.research, TOKEN_FLOORS.research), draft: Math.max(m.draft, TOKEN_FLOORS.draft), critic: Math.max(m.critic, TOKEN_FLOORS.critic) };
}

function base<T>(s: Omit<AgentSpec<T>, "models" | "effort" | "maxTokens" | "maxRevisions" | "shipOn"> & Partial<Pick<AgentSpec<T>, "maxTokens">>, o: SpecOptions, profile: Profile): AgentSpec<T> {
  const lean = profile === "lean";
  return {
    ...s,
    // Basic routes; runAgentTask applies the run's mode. Explicit overrides (benchmark arms, tests) win.
    models: { ...routeModels(s.id), ...o.models },
    effort: { research: "medium", draft: "high", critic: lean ? "low" : "medium", ...o.effort },
    // OpenAI reasoning tokens count against max output tokens: keep floors so thinking never crowds out the answer.
    maxTokens: withFloors(s.maxTokens ?? { research: 24_000, draft: 32_000, critic: 16_000 }),
    maxRevisions: o.maxRevisions ?? 1,
    shipOn: o.shipOn ?? (lean ? "gates" : "rubric"),
    ownerFacing: s.ownerFacing ?? !lean,
  };
}

export function insightsSpec(o: SpecOptions = {}): AgentSpec<InsightsV2> {
  return base(
    {
      id: "business_insights",
      role: "cmo",
      label: "Business insights",
      skills: ["owner-brevity", "voc-research", "competitor-teardown", "positioning"],
      schema: InsightsV2Schema,
      rubric: rubricOf("positioning"),
      criticSkills: ["competitor-teardown", "voc-research"],
      lint: (out, input) => [...lintGeneric(out, input), ...lintInsightSources(out, input)],
    },
    o,
    "expert",
  );
}

/** Growth plays: the creative, predictable portfolio the plan is built around. */
/** Check a structured strategic choice against the candidate plays' locked math when both options are measurable. */
export function lintDecisionOptionChoice(
  decision: Decision | undefined,
  plays: PlayLike[],
  economics: Economics,
  constraints?: PlanConstraints,
): LintIssue[] {
  if (!decision || decision.options.length < 2) return [];
  const analysis = analyzeDecisionOptions(decision, plays, economics, constraints);
  if (!analysis) return [];
  const chosenIndex = analysis.options.findIndex((option) => option.chosen);
  const chosen = analysis.options[chosenIndex];
  if (!chosen?.calculated) return [];
  const alternatives = analysis.options.filter((candidate, index) => candidate.calculated && index !== chosenIndex);
  const chosenScore = chosen.netContribution;
  const comparable = alternatives.filter((candidate) => (candidate.netContribution !== null) === (chosenScore !== null));
  const better = comparable.find((candidate) => {
    if (chosen.feasible === false && candidate.feasible === true) return true;
    if (chosen.feasible === true && candidate.feasible === false) return false;
    const alternativeScore = candidate.netContribution ?? candidate.expectedCustomers!;
    const selectedScore = chosen.netContribution ?? chosen.expectedCustomers!;
    return alternativeScore > selectedScore + Math.max(0.01, Math.abs(selectedScore) * 0.01);
  });
  if (!better) return [];
  const selectedName = chosen.name;
  const alternativeName = better.name;
  const reason = chosen.feasible === false && better.feasible === true
    ? `The chosen option "${selectedName}" exceeds a confirmed budget, time or delivery limit, while "${alternativeName}" fits.`
    : chosen.netContribution === null
      ? `The chosen option "${selectedName}" supports fewer modeled customers than "${alternativeName}" under the same confirmed limits.`
      : `The chosen option "${selectedName}" has lower modeled net contribution than "${alternativeName}" under the same confirmed limits.`;
  // This is a reviewer signal rather than a hard gate: a documented nonfinancial
  // reason can legitimately outweigh a simplified modeled comparison.
  return [{ severity: "warn", rule: "decision_choice", message: `${reason} Recheck this trade-off and state an evidence-based reason if another factor outweighs the modeled result.`, path: `decision.options[${chosenIndex}]` }];
}

/** Reproducible calculation trace for a structured choice; scenario ranges are not calibrated probabilities. */
export function analyzeDecisionOptions(
  decision: Decision,
  plays: PlayLike[],
  economics: Economics,
  constraints?: PlanConstraints,
) {
  const horizonDays = constraints?.horizonDays ?? Math.max(1, ...plays.map((play) => play.horizonDays || 90));
  const valuePerCustomer = customerValue(economics);
  const names = new Map(plays.map((play) => [play.name.trim().toLowerCase(), play]));
  const feasibilityEvaluated = constraints?.monthlyAdBudgetUsd !== undefined || constraints?.ownerHoursPerWeek !== undefined || constraints?.newCustomersPerMonth !== undefined;
  const options = decision.options.map((option) => {
    const selected = option.plays.map((name) => names.get(name.trim().toLowerCase()));
    const optionPlays = selected as PlayLike[];
    const unavailableReason = !option.plays.length
      ? "No mapped plays"
      : selected.some((play) => !play) || new Set(selected).size !== selected.length
        ? "One or more named plays could not be mapped uniquely"
        : optionPlays.some((play) => !play.model?.steps?.length)
          ? "A mapped play has no modeled funnel"
          : null;
    if (unavailableReason) return {
      name: option.name,
      chosen: option.chosen,
      playNames: option.plays,
      calculated: false as const,
      unavailableReason,
      feasible: null,
      customerRange: null,
      expectedCustomers: null,
      cost: null,
      monthlySpend: null,
      ownerHoursPerWeek: null,
      netContribution: null,
    };
    const spend = optionPlays.reduce((sum, play) => sum + Math.max(0, play.model.monthlySpendUsd), 0);
    const ownerHours = optionPlays.reduce((sum, play) => sum + Math.max(0, play.model.ownerHoursPerWeek), 0);
    const portfolio = { economics, plays: optionPlays };
    const range = portfolioRange(portfolio, horizonDays);
    const expectedCustomers = portfolioExpectedCustomers(portfolio, horizonDays);
    const cost = optionPlays.reduce((sum, play) => sum + playMaths({ ...play, horizonDays }, economics).costUsd, 0);
    const feasible = feasibilityEvaluated
      ? (constraints?.monthlyAdBudgetUsd === undefined || spend <= constraints.monthlyAdBudgetUsd)
        && (constraints?.ownerHoursPerWeek === undefined || ownerHours <= constraints.ownerHoursPerWeek)
        && (constraints?.newCustomersPerMonth === undefined || range.p90 <= constraints.newCustomersPerMonth * (horizonDays / 30))
      : null;
    return {
      name: option.name,
      chosen: option.chosen,
      playNames: option.plays,
      calculated: true as const,
      unavailableReason: null,
      feasible,
      customerRange: { p10: range.p10, p50: range.p50, p90: range.p90 },
      expectedCustomers,
      cost,
      monthlySpend: spend,
      ownerHoursPerWeek: ownerHours,
      netContribution: valuePerCustomer === null ? null : expectedCustomers * valuePerCustomer - cost,
    };
  });
  return {
    method: "seeded_joint_scenario_mean_v1" as const,
    horizonDays,
    currency: economics.currency ?? "USD",
    valuePerCustomer,
    scoreBasis: valuePerCustomer === null ? "expected_customers" as const : "net_contribution" as const,
    constraints: {
      monthlyAdBudgetUsd: constraints?.monthlyAdBudgetUsd ?? null,
      ownerHoursPerWeek: constraints?.ownerHoursPerWeek ?? null,
      newCustomersPerMonth: constraints?.newCustomersPerMonth ?? null,
    },
    probabilityCalibrated: false as const,
    limitations: ["Scenario ranges are not calibrated probabilities.", "Unmapped options are not compared.", "Calculations are conditional on the supplied play and economics inputs."],
    options,
  };
}

/** Keep a structured diagnosis and its selected action connected to the actual play. */
export function lintDecisionConstraintFit(
  decision: Decision | undefined,
  plays: { name: string; oneLiner?: string; mechanic?: string; assetUsed?: string; firstActionToday?: string; test?: string }[],
  diagnosis?: PlanConstraints["diagnosis"],
): LintIssue[] {
  if (!decision) return [];
  let constraint = decision.constraint;
  const measured = diagnosis?.status === "supported" && diagnosis.basis === "measured" && diagnosis.constraint !== "unknown";
  if (measured && diagnosis && diagnosis.constraint !== "unknown") {
    constraint = diagnosis.constraint;
    if (decision.constraint !== constraint) {
      return [{ severity: "error", rule: "diagnosis_fit", message: `The structured decision names ${decision.constraint}, but the owner's measured funnel supports ${constraint}. Refresh the decision to address the measured constraint or resolve the conflicting inputs.`, path: "decision.constraint" }];
    }
  }
  const fits = plays.some((p) => playWorksOnConstraint(`${p.name} ${p.oneLiner ?? ""} ${p.mechanic ?? ""} ${p.assetUsed ?? ""} ${p.firstActionToday ?? ""} ${p.test ?? ""}`, constraint));
  if (fits) return [];
  const severity = measured ? "error" : "warn";
  return [{ severity, rule: "diagnosis_fit", message: `${measured ? "The owner's measured numbers" : "The structured strategy"} point to ${constraint}, but no play clearly works on it. Name a play that addresses this constraint or revisit the decision.`, path: "plays" }];
}

export function growthPlaysSpec(o: SpecOptions = {}, catalogs: string[] = playCatalogsFor(null)): AgentSpec<PlaysOutput> {
  return base(
    {
      id: "growth_plays",
      role: "cmo",
      label: "Growth plays",
      skills: ["owner-brevity", "growth-plays", ...catalogs],
      schema: (o.decisionContract ? PlaysDecisionOutputSchema : PlaysOutputSchema) as z.ZodType<PlaysOutput>,
      rubric: rubricOf("growth-plays"),
      criticSkills: ["positioning", "experiment-design"],
      maxTokens: { research: 24_000, draft: 40_000, critic: 16_000 },
      lint: (out, input) => [...lintPlanning(out, input), ...lintActionContracts(out.plays, input.facts.length, evidenceOf(input), input.constraints?.horizonDays, input.availableSourceUrls ?? input.precomputedResearch?.sources.map((source) => source.url)), ...lintCitations(out.plays, evidenceOf(input)), ...lintProvenance(out, evidenceOf(input)), ...lintAssets(out.plays, evidenceOf(input)), ...lintAssetsFirst(out.plays, evidenceOf(input)), ...lintExistingTest(out.plays, evidenceOf(input), input.constraints?.horizonDays), ...lintDistribution(out.plays), ...lintLowPriceFirst(out.plays, { ...out.economics, currency: input.constraints?.currency }, evidenceOf(input)), ...lintSelfServeFunnel(out.plays, out.economics), ...lintComparisonPositioning(out.plays), ...lintOfferClaims(out.plays, evidenceOf(input)), ...lintReferralDrivers(out.plays), ...lintAnyPaidPlan(out.plays.map((p, i) => ({ text: p.unit ?? "", path: `plays[${i}].unit` }))), ...lintFeasibility(out.plays, input.constraints, out.economics), ...lintPlays(out.plays, out.economics, { decisionContract: o.decisionContract }), ...(o.decisionContract ? [...lintDecision(out.decision, out.plays, { factCount: input.facts.length, availableSourceUrls: input.availableSourceUrls ?? input.precomputedResearch?.sources.map((source) => source.url) ?? [] }), ...lintDecisionConstraintFit(out.decision, out.plays, input.constraints?.diagnosis), ...lintDecisionOptionChoice(out.decision, out.plays, out.economics, input.constraints), ...lintWordCaps(out, DECISION_CAPS)] : []), ...lintWordCaps(out, PLAYS_CAPS), ...lintNoAudience(out.plays, input.constraints, input.facts.join("\n")), ...lintBorrowedUplift(out.plays), ...lintDiagnosisFit(out.plays, o.decisionContract && out.decision ? undefined : input.constraints?.diagnosis), ...lintEligibilityIds(out.plays, input.constraints?.ineligiblePlaybooks), ...lintPlatformEligibility(out.plays.map((p, i) => ({ path: `plays[${i}]`, text: JSON.stringify(p) })), input.constraints?.businessTypes ?? []), ...(input.constraints?.factKinds ? lintEvidenceStrength(out.plays.flatMap((p, i) => [{ path: `plays[${i}].oneLiner`, text: (p as { oneLiner?: string }).oneLiner ?? "" }, { path: `plays[${i}].mechanic`, text: (p as { mechanic?: string }).mechanic ?? "" }]), input.constraints.factKinds) : []), ...lintClaims(out.plays.flatMap((p, i) => [{ path: `plays[${i}].hook`, text: (p as { hook?: string }).hook ?? "" }, { path: `plays[${i}].oneLiner`, text: (p as { oneLiner?: string }).oneLiner ?? "" }]), verifiedCapabilityEvidence(input)), ...lintDeliveryCapacity(portfolioP50(out, input.constraints?.horizonDays), input.constraints), ...lintServiceArea(out.plays.map((p, i) => ({ path: `plays[${i}]`, spend: p.model?.monthlySpendUsd ?? 0, text: JSON.stringify(p) })), input.constraints), ...lintEconomics({ ...out, economics: { ...out.economics, currency: input.constraints?.currency } })],
    },
    o,
    "expert",
  );
}

export function strategySpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof StrategyV2Schema>> {
  return base(
    {
      id: "growth_strategy",
      role: "ceo",
      label: "Growth plan",
      skills: ["owner-brevity", "growth-strategy", "experiment-design"],
      schema: StrategyV2Schema,
      rubric: rubricOf("growth-strategy"),
      criticSkills: ["experiment-design", "positioning"],
      lint: (out, input) => {
        const issues = [...lintPlanning(out, input), ...lintWordCaps(out, PLAN_CAPS), ...lintPlanFit(out, input.constraints), ...lintOutcomeNumbers(out, input.constraints, `${input.brief}\n${input.facts.join("\n")}`), ...lintNoAudience(out, input.constraints, input.facts.join("\n")), ...lintCites(out, input.facts.length, evidenceOf(input)), ...lintExperimentFeasibility(out, input.constraints), ...lintBorrowedUplift([], [{ path: "summary", text: out.summary }, { path: "diagnosis", text: out.diagnosis }, ...(out.phases ?? []).map((p, i) => ({ path: `phases[${i}].focus`, text: p.focus }))]), ...lintClaims([{ path: "positioning", text: out.positioning }], verifiedCapabilityEvidence(input)), ...lintPlatformEligibility([...out.channels.map((ch, i) => ({ path: `channels[${i}]`, text: `${ch.name} ${ch.why} ${(ch.deliverables ?? []).join(" ")}` })), ...(out.experiments ?? []).map((e, i) => ({ path: `experiments[${i}]`, text: `${e.name} ${e.hypothesis}` })), ...(out.phases ?? []).map((p, i) => ({ path: `phases[${i}].focus`, text: p.focus }))], input.constraints?.businessTypes ?? []), ...(input.constraints?.factKinds ? lintEvidenceStrength([{ path: "summary", text: out.summary }, { path: "diagnosis", text: out.diagnosis }, { path: "positioning", text: out.positioning }, ...(out.audiences ?? []).map((x, i) => ({ path: `audiences[${i}].evidence`, text: x.evidence }))], input.constraints.factKinds) : []), ...lintDeliveryCapacity(input.constraints?.lockedCustomers ?? 0, input.constraints, "northStar.target"), ...lintServiceArea(out.channels.map((ch, i) => ({ path: `channels[${i}]`, spend: ch.suggestedMonthlyAdSpend, text: `${ch.name} ${ch.why} ${(ch.deliverables ?? []).join(" ")} ${ch.measurement ?? ""}` })), input.constraints), ...lintActionPlan(out, input.constraints?.horizonDays), ...lintPlanDistribution(out, input.constraints?.horizonDays), ...lintAnyPaidPlan([{ text: out.northStar?.metric ?? "", path: "northStar.metric" }, { text: out.northStar?.target ?? "", path: "northStar.target" }]), ...lintStageMetric([{ text: out.northStar?.metric ?? "", path: "northStar.metric" }])];
        if (out.channels.length > 3) issues.push({ severity: "error", rule: "focus", message: `${out.channels.length} active channels; pick 1 primary + 1 secondary (3 at most) and put the rest in "not doing".`, path: "channels" });
        if (out.weekOneChecklist.length > 5) issues.push({ severity: "warn", rule: "focus", message: "Week-1 checklist should have at most 5 items.", path: "weekOneChecklist" });
        // Owner-ready: a number to aim at, and a summary that says what to expect.
        if (!/\d/.test(out.northStar?.target ?? "")) issues.push({ severity: "error", rule: "ambition", message: "The North Star target needs a number and a date (e.g. \"20 new paying customers by day 90\"). Use the plays' P50; say it's an estimate.", path: "northStar.target" });
        if (!/\d/.test(out.summary ?? "")) issues.push({ severity: "warn", rule: "ambition", message: "The summary should say what to expect in numbers (the plays' combined P50 over 90 days).", path: "summary" });
        if (/not a forecast|do not scale until|until (actual|verified) (cac|economics)/i.test(out.summary ?? "")) issues.push({ severity: "warn", rule: "ambition", message: "The summary reads as a validation exercise. Lead with the expected outcome and the engine; keep caveats in kill rules.", path: "summary" });
        return issues;
      },
    },
    o,
    "expert",
  );
}

export function socialSpec(channels: string[], o: SpecOptions = {}): AgentSpec<SocialPostsV2> {
  const channelSkills = [...new Set(channels.map((c) => CHANNEL_SKILL[c] ?? "instagram-posts"))];
  const primary = channelSkills[0] ?? "instagram-posts";
  const needsVideo = channels.some((c) => c === "tiktok" || c === "youtube");
  return base(
    {
      id: "social_posts",
      role: "social_media_manager",
      label: "Social posts",
      skills: ["copy-fundamentals", ...channelSkills, "social-visual-briefs", ...(needsVideo || channelSkills.includes("instagram-posts") ? ["short-video-scripts"] : [])].filter((v, i, a) => a.indexOf(v) === i),
      schema: SocialPostsV2Schema,
      rubric: rubricOf(primary),
      criticSkills: ["copy-fundamentals", ...channelSkills.slice(1)],
      lint: lintSocial,
    },
    o,
    "lean",
  );
}

export function adsSpec(o: SpecOptions = {}): AgentSpec<AdDraftsV2> {
  return base(
    { id: "ad_drafts", role: "ads_manager", label: "Ad drafts", skills: ["copy-fundamentals", "google-ads", "meta-ads"], schema: AdDraftsV2Schema, rubric: rubricOf("google-ads"), criticSkills: ["meta-ads"], lint: lintAds },
    o,
    "lean",
  );
}

export function emailSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof EmailSequenceV2Schema>> {
  return base(
    {
      id: "email_sequence",
      role: "customer_success_manager",
      label: "Email sequence",
      skills: ["copy-fundamentals", "lifecycle-email"],
      schema: EmailSequenceV2Schema,
      rubric: rubricOf("lifecycle-email"),
      lint: (out, input) => [...lintCopyBrief(out.copyBrief, input), ...lintPublishable(out, input), ...lintDistinctAngles(out.emails.map((e, i) => ({ path: `emails[${i}].angle`, angle: e.angle }))), ...lintRepeatedCopyPieces(out.emails.map((e, i) => ({ path: `emails[${i}]`, text: `${e.subject}\n${e.previewText}\n${e.body}` }))), ...lintEmbeddedUrls(out.emails.flatMap((email, i) => [
        { path: `emails[${i}].subject`, text: email.subject },
        { path: `emails[${i}].previewText`, text: email.previewText },
        { path: `emails[${i}].body`, text: email.body },
        { path: `emails[${i}].callToAction`, text: email.callToAction },
      ]), input), ...out.emails.flatMap((e, i) => maxLength(e.subject, 70, `emails[${i}].subject`, "Subject line"))],
    },
    o,
    "lean",
  );
}

export function seoSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof SeoBriefV2Schema>> {
  return base(
    {
      id: "seo_brief",
      role: "seo_specialist",
      label: "SEO page",
      skills: ["seo-pages", "copy-fundamentals"],
      schema: SeoBriefV2Schema,
      rubric: rubricOf("seo-pages"),
      lint: (out, input) => [...lintPublishable(out, input), ...lintSearchIntent(out), ...lintSeoEvidence(out, input), ...lintSeoRecommendation(out, input), ...maxLength(out.title, 65, "title", "Title"), ...maxLength(out.metaDescription, 160, "metaDescription", "Meta description")],
      maxTokens: { research: 24_000, draft: 40_000, critic: 16_000 },
    },
    o,
    "lean",
  );
}

export function conversionAuditSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof ConversionAuditV2Schema>> {
  return base(
    { id: "conversion_audit", role: "cso", label: "Conversion audit", skills: ["owner-brevity", "conversion-audit", "landing-pages"], schema: ConversionAuditV2Schema, rubric: rubricOf("conversion-audit"), lint: (out, input) => [...lintGeneric(out, input), ...lintConversionAuditSources(out, input)] },
    o,
    "lean",
  );
}

export function retentionSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof RetentionPlanSchema>> {
  return base(
    { id: "retention_plan", role: "customer_success_manager", label: "Retention plan", skills: ["owner-brevity", "retention-lifecycle", "lifecycle-email"], schema: RetentionPlanSchema, rubric: rubricOf("retention-lifecycle"), lint: lintGeneric },
    o,
    "lean",
  );
}

export function salesSpec(o: SpecOptions = {}): AgentSpec<z.infer<typeof SalesSequenceSchema>> {
  return base(
    { id: "sales_sequence", role: "cso", label: "Sales follow-up", skills: ["sales-follow-up", "copy-fundamentals"], schema: SalesSequenceSchema, rubric: rubricOf("sales-follow-up"), lint: lintGeneric },
    o,
    "lean",
  );
}

/* ---------------- Social autopilot: weekly calendar ---------------- */

export const SocialCalendarSchema = z.object({
  weekTheme: z.string(),
  pillars: z.array(z.object({ name: z.string(), why: z.string() })),
  slots: z.array(
    z.object({
      channel: z.string(),
      /** 1 = Monday … 7 = Sunday, in the business's time zone. */
      day: z.number(),
      pillar: z.string(),
      purpose: z.enum(["teach", "prove", "connect", "ask"]),
      format: postFormat,
      idea: z.string(),
      angle: z.string(),
      hookDraft: z.string(),
      proof: z.string(),
      callToAction: z.string(),
      needsOwner: z.boolean(),
      ownerNote: z.string(),
    }),
  ),
  learningsApplied: z.array(z.string()),
});
export type SocialCalendar = z.infer<typeof SocialCalendarSchema>;

/** Plans next week's slots; `cadence` is posts per channel this week. */
export function socialCalendarSpec(cadence: Record<string, number>, o: SpecOptions = {}): AgentSpec<SocialCalendar> {
  const channelSkills = [...new Set(Object.keys(cadence).map((c) => CHANNEL_SKILL[c]).filter(Boolean))];
  return base(
    {
      id: "social_calendar",
      role: "social_media_manager",
      label: "Weekly content plan",
      skills: ["owner-brevity", "social-calendar", "positioning", ...channelSkills.slice(0, 2)],
      schema: SocialCalendarSchema,
      rubric: rubricOf("social-calendar"),
      criticSkills: ["copy-fundamentals"],
      lint: (out, input) => {
        const issues = lintCopy({ theme: out.weekTheme, slots: out.slots.map((s) => ({ idea: s.idea, hook: s.hookDraft })) }, { evidence: evidenceOf(input) });
        for (const [channel, n] of Object.entries(cadence)) {
          const got = out.slots.filter((s) => s.channel === channel).length;
          if (got !== n) issues.push({ severity: "error", rule: "count", message: `${channel} needs exactly ${n} slot${n === 1 ? "" : "s"}; the plan has ${got}.`, path: "slots" });
        }
        out.slots.forEach((s, i) => {
          if (!(s.channel in cadence)) issues.push({ severity: "error", rule: "channel", message: `"${s.channel}" isn't one of this week's channels.`, path: `slots[${i}].channel` });
          if (!Number.isInteger(s.day) || s.day < 1 || s.day > 7) issues.push({ severity: "error", rule: "day", message: "day must be 1 (Monday) to 7 (Sunday).", path: `slots[${i}].day` });
        });
        const ideas = out.slots.map((s) => s.idea.trim().toLowerCase());
        if (new Set(ideas).size !== ideas.length) issues.push({ severity: "error", rule: "duplicate", message: "Two slots share the same idea; every slot needs its own.", path: "slots" });
        if (out.pillars.length > 4) issues.push({ severity: "warn", rule: "focus", message: "More than 4 pillars dilutes the week.", path: "pillars" });
        return issues;
      },
      maxTokens: { research: 16_000, draft: 24_000, critic: 16_000 },
    },
    o,
    "expert",
  );
}

/* ---------------- Acquisition intelligence: classify, then score channels ---------------- */

export const ChannelFitSchema = z.object({
  /** 1-3 library business type keys, most specific first. */
  types: z.array(z.string()),
  dimensions: z.array(z.object({ key: z.string(), value: z.string(), confidence: z.enum(["high", "medium", "low"]), evidence: z.string() })),
  channels: z.array(
    z.object({
      id: z.string(),
      /** Changes to the 8 factor priors, in order: audience, intent, budget, time, feasibility, competition, scalability, measurement. Each −30…+30; 0 = keep. */
      deltas: z.array(z.number()),
      reason: z.string(),
      evidence: z.string(),
      platform: z.string(),
      tactic: z.string(),
      audience: z.string(),
    }),
  ),
  /** Two short bullets for the owner: what wins and why. */
  summary: z.array(z.string()),
});
export type ChannelFit = z.infer<typeof ChannelFitSchema>;

function lintChannelFit(out: ChannelFit, input: AgentInput, candidateIds: string[], typeKeys: string[], dims: Record<string, readonly string[]>): LintIssue[] {
  const issues: LintIssue[] = lintCopy({ summary: out.summary, reasons: out.channels.map((c) => c.reason) }, { evidence: evidenceOf(input) });
  if (!out.types.length || out.types.length > 3) issues.push({ severity: "error", rule: "types", message: "Pick 1-3 business types.", path: "types" });
  out.types.forEach((t, i) => {
    if (!typeKeys.includes(t)) issues.push({ severity: "error", rule: "types", message: `"${t}" isn't a library type. Use one of: ${typeKeys.join(", ")}.`, path: `types[${i}]` });
  });
  out.dimensions.forEach((d, i) => {
    const allowed = dims[d.key];
    if (!allowed) issues.push({ severity: "error", rule: "dimension", message: `Unknown dimension "${d.key}".`, path: `dimensions[${i}]` });
    else if (!allowed.includes(d.value)) issues.push({ severity: "error", rule: "dimension", message: `${d.key} must be one of: ${allowed.join(", ")}.`, path: `dimensions[${i}].value` });
  });
  if (out.channels.length < 8) issues.push({ severity: "error", rule: "count", message: "Review at least 8 candidate channels.", path: "channels" });
  out.channels.forEach((c, i) => {
    const path = `channels[${i}]`;
    if (!candidateIds.includes(c.id)) issues.push({ severity: "error", rule: "channel", message: `${c.id} isn't in the candidate list.`, path });
    if (c.deltas.length !== 8) issues.push({ severity: "error", rule: "deltas", message: "deltas needs 8 numbers in factor order.", path: `${path}.deltas` });
    if (c.deltas.some((d) => Math.abs(d) > 30)) issues.push({ severity: "error", rule: "deltas", message: "Each delta is between −30 and +30.", path: `${path}.deltas` });
    if (c.deltas.some((d) => d !== 0) && !c.evidence.trim()) issues.push({ severity: "error", rule: "evidence", message: "Any change needs evidence (a source, a confirmed fact or the owner's data).", path: `${path}.evidence` });
  });
  return issues;
}

/** Scores the library's candidate channels for this business with evidence (Acquisition Intelligence). */
export function channelFitSpec(ctx: { candidateIds: string[]; typeKeys: string[]; dims: Record<string, readonly string[]> }, o: SpecOptions = {}): AgentSpec<ChannelFit> {
  return base(
    {
      id: "channel_fit",
      role: "cmo",
      label: "Channel scoring",
      skills: ["owner-brevity", "growth-strategy", "positioning"],
      schema: ChannelFitSchema,
      rubric: rubricOf("growth-strategy"),
      criticSkills: ["growth-strategy"],
      lint: (out, input) => lintChannelFit(out, input, ctx.candidateIds, ctx.typeKeys, ctx.dims),
      maxTokens: { research: 8_000, draft: 16_000, critic: 8_000 },
    },
    // One pass, no review: deterministic rules and sanitising (mergeFit, adjustmentsFrom) carry the structure.
    { maxRevisions: -1, ...o },
    "lean",
  );
}

/* ---------------- Outbound: find the people, write the emails ---------------- */

export const ProspectsOutputSchema = z.object({
  icp: z.object({
    /** One sentence: who, where, what situation. */
    summary: z.string(),
    mustHaves: z.array(z.string()),
    disqualifiers: z.array(z.string()),
    triggers: z.array(z.string()),
    /** The role that owns the problem, e.g. "Owner" or "Head of marketing". */
    decisionMaker: z.string(),
  }),
  prospects: z.array(
    z.object({
      company: z.string(),
      website: z.string(),
      location: z.string(),
      /** "1-10", "11-50", "51-200" or "unknown". */
      sizeBand: z.string(),
      /** One line: why they need this business now. */
      why: z.string(),
      evidence: z.array(z.object({ url: z.string(), observation: z.string() })),
      /** A dated or observable trigger, or "". */
      trigger: z.string(),
      fit: z.number(),
      timing: z.number(),
      /** Who to contact: a name and title only if published on their own site, else the role. */
      contact: z.string(),
      /** A published contact email copied verbatim from the evidence, else "". */
      publicEmail: z.string(),
      /** Exact audience figure shown by the source; keep it as text rather than estimating a normalized count. */
      audienceSize: z.object({ value: z.string().min(1).max(100), sourceUrl: z.string().url() }).optional(),
      /** Language stated or clearly labeled on a cited creator profile/content page. */
      contentLanguage: z.object({ value: z.string().min(1).max(80), sourceUrl: z.string().url() }).optional(),
      /** Audience location explicitly stated by a cited source; do not substitute creator location. */
      audienceLocation: z.object({ value: z.string().min(1).max(100), sourceUrl: z.string().url() }).optional(),
      /** Visible post metrics copied from each exact public content page; not evidence of audience quality or sales. */
      contentSamples: z.array(z.object({
        url: z.string().url(),
        format: z.enum(["short_video", "long_video", "image", "text", "live", "other"]),
        views: z.string().max(40).optional(),
        likes: z.string().max(40).optional(),
        comments: z.string().max(40).optional(),
      })).max(5).optional(),
      /** Prior competitor work is a source-bound fit/conflict signal, never proof of an active exclusive contract. */
      competitorCollaborations: z.array(z.object({
        name: z.string().min(1).max(100),
        type: z.enum(["paid_or_sponsored", "affiliate", "gifted_or_product", "co_created_or_partnered", "mentioned_only", "unclear"]),
        evidenceUrl: z.string().url(),
        evidenceQuote: z.string().min(1).max(240),
        publishedAt: z.string().max(80).optional(),
      })).max(5).optional(),
      /** A proposed collaboration, not a claim that the creator has agreed or performed. */
      collaborationConcept: z.string().max(240).optional(),
    }),
  ),
  excluded: z.array(z.object({ company: z.string(), reason: z.string() })),
});
export type ProspectsOutput = z.infer<typeof ProspectsOutputSchema>;

export const OutreachOutputSchema = z.object({
  sequence: z.array(
    z.object({
      /** Business days after the first email (0, 3, 7, 14). */
      day: z.number(),
      subject: z.string(),
      /** Plain text. Use {{firstLine}} where the personal opener goes in step 1; no greeting name, no footer. */
      body: z.string(),
      purpose: z.string(),
    }),
  ),
  firstLines: z.array(z.object({ company: z.string(), line: z.string() })),
  /** At most 3 bullets for the owner: what to check before sending. */
  ownerNotes: z.array(z.string()),
});
export type OutreachOutput = z.infer<typeof OutreachOutputSchema>;

function lintProspects(out: ProspectsOutput, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = lintCopy({ icp: out.icp.summary }, { evidence: evidenceOf(input) });
  if (out.prospects.length < 3) issues.push({ severity: "error", rule: "count", message: "Find at least 3 qualified companies, or explain in excluded why the market is thin.", path: "prospects" });
  const seen = new Set<string>();
  out.prospects.forEach((p, i) => {
    const path = `prospects[${i}]`;
    const host = domainOf(p.website);
    if (!host) issues.push({ severity: "error", rule: "source", message: `${p.company}: needs its real website.`, path: `${path}.website` });
    if (host && seen.has(host)) issues.push({ severity: "error", rule: "duplicate", message: `${p.company} is listed twice.`, path });
    if (host) seen.add(host);
    if (!p.evidence.some((e) => /^https?:\/\//.test(e.url))) issues.push({ severity: "error", rule: "evidence", message: `${p.company}: every prospect needs at least one evidence URL.`, path: `${path}.evidence` });
    if (p.publicEmail && !p.evidence.some((e) => e.observation.toLowerCase().includes(p.publicEmail.toLowerCase()))) {
      issues.push({ severity: "error", rule: "invented_email", message: `${p.company}: only use an email copied verbatim from a cited page (quote it in evidence).`, path: `${path}.publicEmail` });
    }
    if (p.fit < 0 || p.fit > 100 || p.timing < 0 || p.timing > 100) issues.push({ severity: "error", rule: "range", message: "fit and timing are 0-100.", path });
  });
  return issues;
}

function lintOutreach(out: OutreachOutput, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = lintCopy({ sequence: out.sequence.map((s) => ({ subject: s.subject, body: s.body.replace(/\{\{firstLine\}\}/g, "") })), firstLines: out.firstLines.map((f) => f.line) }, { evidence: evidenceOf(input), claimEvidence: verifiedCapabilityEvidence(input), publishable: true });
  if (out.sequence.length < 2 || out.sequence.length > 5) issues.push({ severity: "error", rule: "count", message: "Write 2-5 steps.", path: "sequence" });
  out.sequence.forEach((s, i) => {
    const words = s.body.replace(/\{\{firstLine\}\}/g, "").split(/\s+/).filter(Boolean).length;
    const max = i === 0 ? 110 : 70;
    if (words > max) issues.push({ severity: "error", rule: "length", message: `Step ${i + 1} is ${words} words; keep it under ${max}.`, path: `sequence[${i}].body` });
    if (s.subject.split(/\s+/).length > 6) issues.push({ severity: "warn", rule: "subject", message: "Subject lines are 2-5 plain words.", path: `sequence[${i}].subject` });
    if (/[!$]|\bfree\b/i.test(s.subject)) issues.push({ severity: "error", rule: "subject", message: "No '!', '$' or 'free' in subject lines.", path: `sequence[${i}].subject` });
  });
  if (out.sequence[0] && !out.sequence[0].body.includes("{{firstLine}}")) issues.push({ severity: "error", rule: "personalisation", message: "Step 1 needs {{firstLine}} where the personal opener goes.", path: "sequence[0].body" });
  return issues;
}

function domainOf(url: string): string | null {
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** Finds and evidences companies that need this business now (public web only). */
export function prospectingSpec(o: SpecOptions = {}): AgentSpec<ProspectsOutput> {
  return base(
    {
      id: "prospecting",
      role: "cso",
      label: "Find customers",
      skills: ["owner-brevity", "prospecting", "positioning"],
      schema: ProspectsOutputSchema,
      rubric: rubricOf("prospecting"),
      criticSkills: ["prospecting"],
      lint: lintProspects,
      maxTokens: { research: 32_000, draft: 32_000, critic: 12_000 },
    },
    o,
    "lean",
  );
}

function lintCreators(out: ProspectsOutput, input: AgentInput): LintIssue[] {
  const issues: LintIssue[] = lintCopy({ icp: out.icp.summary }, { evidence: evidenceOf(input) });
  if (out.prospects.length < 3) issues.push({ severity: "error", rule: "count", message: "Find at least 3 verified creators, or explain in excluded why the niche is thin.", path: "prospects" });
  const seen = new Set<string>();
  out.prospects.forEach((p, i) => {
    const path = `prospects[${i}]`;
    if (!/^https?:\/\//.test(p.website)) issues.push({ severity: "error", rule: "source", message: `${p.company}: needs their real profile URL.`, path: `${path}.website` });
    const key = p.website.toLowerCase().replace(/\/$/, "");
    if (seen.has(key)) issues.push({ severity: "error", rule: "duplicate", message: `${p.company} is listed twice.`, path });
    seen.add(key);
    if (!p.evidence.some((e) => /^https?:\/\//.test(e.url))) issues.push({ severity: "error", rule: "evidence", message: `${p.company}: cite the profile or a recent post.`, path: `${path}.evidence` });
    for (const [field, detail] of [["audienceSize", p.audienceSize], ["contentLanguage", p.contentLanguage], ["audienceLocation", p.audienceLocation]] as const) {
      if (!detail) continue;
      if (!citedCreatorFact(detail, p.evidence)) {
        issues.push({ severity: "error", rule: "creator_fact_source", message: `${p.company}: ${field} must match text recorded from its exact cited evidence URL; leave it unknown if the source doesn't show it.`, path: `${path}.${field}` });
      }
    }
    for (const [sampleIndex, sample] of (p.contentSamples ?? []).entries()) {
      const samplePath = `${path}.contentSamples[${sampleIndex}]`;
      const sourceText = p.evidence.find((e) => e.url === sample.url)?.observation;
      if (!sourceText) {
        issues.push({ severity: "error", rule: "creator_content_source", message: `${p.company}: each content sample must cite a content URL observed for this creator.`, path: `${samplePath}.url` });
      }
      for (const metric of ["views", "likes", "comments"] as const) {
        const value = sample[metric]?.trim();
        if (value && (!sourceText || !sourceText.toLowerCase().includes(value.toLowerCase()))) {
          issues.push({ severity: "error", rule: "creator_content_metric_source", message: `${p.company}: ${metric} must match the exact wording observed on that content URL; omit it when not visible.`, path: `${samplePath}.${metric}` });
        }
      }
    }
    const competitorSignals = citedCreatorCompetitorCollaborations(p.competitorCollaborations, p.evidence, 0);
    if (competitorSignals.length !== (p.competitorCollaborations ?? []).length) {
      issues.push({ severity: "error", rule: "creator_competitor_source", message: `${p.company}: each competitor-collaboration signal needs an exact cited source quote naming the company; a published date must appear in that quote.`, path: `${path}.competitorCollaborations` });
    }
    if (p.publicEmail && !p.evidence.some((e) => e.observation.toLowerCase().includes(p.publicEmail.toLowerCase()))) {
      issues.push({ severity: "error", rule: "invented_email", message: `${p.company}: only use an email copied verbatim from a cited page (quote it in evidence).`, path: `${path}.publicEmail` });
    }
    if (!/\d|unknown/i.test(p.sizeBand)) issues.push({ severity: "warn", rule: "audience", message: `${p.company}: state the audience as shown (e.g. "~12k Instagram followers") or "unknown".`, path: `${path}.sizeBand` });
  });
  return issues;
}

/** Finds real creators whose audience matches the buyers (public profiles only), with contact routes. */
export function creatorScoutSpec(o: SpecOptions = {}): AgentSpec<ProspectsOutput> {
  return base(
    {
      id: "creator_scout",
      role: "cmo",
      label: "Find creators",
      skills: ["owner-brevity", "creator-scouting", "positioning"],
      schema: ProspectsOutputSchema,
      rubric: rubricOf("creator-scouting"),
      criticSkills: ["creator-scouting"],
      lint: lintCreators,
      maxTokens: { research: 32_000, draft: 32_000, critic: 12_000 },
    },
    o,
    "lean",
  );
}

/** Writes the cold sequence and one sourced opener per prospect. */
export function outreachSpec(o: SpecOptions = {}): AgentSpec<OutreachOutput> {
  return base(
    {
      id: "cold_outreach",
      role: "cso",
      label: "Write the emails",
      skills: ["owner-brevity", "cold-outreach", "copy-fundamentals"],
      schema: OutreachOutputSchema,
      rubric: rubricOf("cold-outreach"),
      criticSkills: ["copy-fundamentals"],
      lint: lintOutreach,
      maxTokens: { research: 8_000, draft: 24_000, critic: 12_000 },
    },
    o,
    "lean",
  );
}

/** Research briefs per job (what the research phase should find). */
export function researchFor(task: TaskType | "business_insights" | "prospecting" | "creator_scout", ctx: { website?: string; businessName: string; country?: string; marketScope?: string }): ResearchSpec | undefined {
  const site = ctx.website ? ` (${ctx.website})` : "";
  const market = ctx.country ? ` Owner-stated market: ${ctx.country}.` : "";
  const scope = ctx.marketScope ? ` Business reach is classified as ${ctx.marketScope}; this is scope only, not a named city or country.` : "";
  switch (task) {
    case "growth_strategy":
      return {
        maxSearches: 7,
        maxFetches: 4,
        brief: `Find the specific, named places where ${ctx.businessName}${site}'s best-fit customers already gather or decide, so growth plays can name real audiences.${market}${scope} First identify the business's served geography from its own pages or supplied owner facts. Use a local market only when a named location is supported; never infer a city or country from currency, timezone, domain suffix or search ranking. If the location is unknown, say so and keep findings geography-neutral. For local or regional businesses, prioritize sources and channels available in that served area:
1. Communities, newsletters, podcasts, YouTube/TikTok creators, directories, marketplaces, review sites and app stores relevant to this business and its location (name, URL, rough size/audience if visible).
2. Complementary businesses or platforms that could partner (who already serves the same customer before or after this business).
3. Where competitors are present or absent (review sites, marketplaces, launches, local listings, comparison pages).
4. Seasonal or event windows in the next 90 days that matter to these customers.
Only report what you actually found, with URLs.`,
      };
    case "business_insights":
      return {
        maxSearches: 8,
        maxFetches: 8,
        brief: `For ${ctx.businessName}${site}.${market} First identify the served market and customer geography from pages read in this run or supplied owner facts. Match competitors, customer reviews, communities, directories and market developments to that geography and language when supported. Never infer a city or country from currency, timezone, domain suffix or search ranking; if the location is unknown, say so and leave geography-dependent findings unanswered.
1. Competitive set: identify 3-5 direct competitors that solve the same customer job for a similar buyer, and classify each sourced company as direct or adjacent (nearby job/segment, not a direct substitute). Use the competitor's own canonical homepage as url and the exact page read as sourceUrl. Put DIY, hiring, marketplaces and doing nothing in alternatives with their matching kind; do not list directories or review sites as vendors. For each competitor, add up to 8 comparison observations across target customer, positioning, offer, pricing, proof, distribution, and customer experience when the supplied pages support them. Each observation must include the exact sourceUrl read, what that page shows, and a separate cautious implication for this business. Omit dimensions with no evidence; unknown is not a weakness, and do not claim superiority or that an observed difference causes customer choice.
2. Voice of customer: find reviews and forum threads (G2/Capterra/Trustpilot/Google reviews/Reddit/app stores, whichever fit this business type) about this business and its top competitors. Collect 15-30 short verbatim phrases with URLs: why people switch, what almost stopped them, outcomes they describe, words they use for the problem.
3. Gaps: values customers mention that no competitor leads with; offers nobody makes (guarantee, fixed price, fast start); channels competitors are absent from. Note evidence for each.`,
      };
    case "seo_brief":
      return {
        maxSearches: 5,
        maxFetches: 4,
        brief: `First inspect the business's directly observed pages in the supplied site inventory and find any existing URL that already serves the target customer task. Prefer improving that page when it fits; propose a new URL only when the inventory shows no suitable page. A sitemap or browser fetch is a discovery observation, not evidence of search-engine indexing. Then search the target query and close variants. Record what currently ranks (page types, angles, gaps), whether an AI Overview appears, and related questions people ask. Look for customer language in relevant discussions or reviews when available. Fetch the top 2-3 results to see what they cover and miss. Save exact source URLs and distinguish what you observed from what you infer.`,
      };
    case "ad_drafts":
      return {
        maxSearches: 3,
        maxFetches: 3,
        brief: `Look for competitors' current ads and offers (Google results for the main keywords, competitor landing pages) and the exact phrases buyers use. Note claims competitors make so ours can differ.`,
      };
    case "prospecting":
      // Searches are metered per plan; page reads (one per candidate's own site) are where verification happens.
      return {
        maxSearches: 12,
        maxFetches: 25,
        brief: `Find real companies that are a strong fit to buy from ${ctx.businessName}${site}${ctx.country ? ` (sells in ${ctx.country})` : ""}, from public web sources only.
1. Look for companies SHOWING THE NEED: e.g. their own site uses a weaker alternative or a manual workaround this business replaces, they are hiring for the job it does, they just launched or expanded, or they complain about the problem in public. Category + location searches, directories, marketplaces, association member lists, job boards and local news all work.
2. Skip competitors, and partners/resellers/certified agencies of a direct competitor (they are invested in the rival).
3. Gather about 1.5x the companies needed, then open EACH candidate's own website (one fetch each) to confirm it exists, what it does, where it is, and any published contact email (copy verbatim).
4. Note for each: name, website, location, size clues, a dated or observable trigger, the decision-maker role (a name only if on their own team page). Record the URL for every observation. Skip anything you can't verify.`,
      };
    case "creator_scout":
      return {
        maxSearches: 12,
        maxFetches: 25,
        brief: `Find real creators and influencers whose audience matches the buyers of ${ctx.businessName}${site}${ctx.country ? ` (sells in ${ctx.country})` : ""}, from public pages only.
1. Work out 3-5 audience niches from the positioning, then search the platforms that fit (Instagram, TikTok, YouTube, LinkedIn, X, newsletters, podcasts), creator lists and directories.
2. Open each candidate's profile or own site to confirm: handle, platform, audience size as shown publicly, creator location, separately stated audience location if available, recent activity, and one recent post that shows fit (URL + what it's about). Do not infer audience location from creator location.
3. Find the contact route: a business email published in bio/link-in-bio/site/media kit (copy verbatim), else the DM or form route. Never guess an email.
4. For up to 5 recent content examples per creator, record the exact content URL, format, and visible views/likes/comments exactly as shown; omit metrics that aren't visible. Do not calculate engagement rates or infer audience quality, authenticity, reach, response, or sales from those counts.
5. If public evidence shows a prior competitor collaboration, record the company, type, exact source quote, URL and publication date when visible. Treat it as a fit/conflict signal, not proof of a current exclusive deal; do not automatically exclude a creator for a past mention or partnership. Exclude only when evidence supports a current material conflict with this proposed campaign.
6. Skip inactive accounts and off-niche creators. Do not label an audience as fake or bought without reliable evidence. Gather ~1.5x what's needed; record a URL for every observation.`,
      };
    case "conversion_audit":
      return { maxSearches: 2, maxFetches: 4, brief: `Fetch the business's money page(s) and 1-2 competitor equivalents. Note headline, offer, proof, CTA, objections handled and friction.` };
    default:
      return undefined;
  }
}

export type AnyAgentSpec = AgentSpec<unknown>;
