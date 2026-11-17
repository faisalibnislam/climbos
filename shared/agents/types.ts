import type { OwnerChannelPreference } from "../acquisition/scoring";
import type { Diagnosis } from "./diagnosis";
import type { EvidenceKind, FactEvidenceBasis } from "./evidenceKind";
import type { z } from "zod";
import type { Effort, Source, PageReadEvidence } from "../ai/types";
import type { ModelKey } from "../economics/rates";
import type { RoleKey } from "../economics/roles";
import type { KnowledgeReferenceSet } from "../knowledge/retrieve";
import type { OwnerEconomics } from "./economics";

/** A scoring rubric an expert would use, with hard gates that override the score. */
export interface Rubric {
  id: string;
  title: string;
  /** Any failed gate fails the output, whatever the scores. */
  gates: { id: string; text: string }[];
  criteria: { id: string; name: string; anchors: { 1: string; 3: string; 5: string } }[];
  /** Ship when every gate passes, no criterion is below minEach and the average is at least minAverage. */
  shipRule: { minEach: number; minAverage: number };
}

export interface LintIssue {
  severity: "error" | "warn";
  rule: string;
  message: string;
  /** Where in the output, e.g. "posts[1].body". */
  path?: string;
}

export interface ResearchSpec {
  maxSearches: number;
  maxFetches: number;
  /** What to find out, written for the researcher. */
  brief: string;
  allowedDomains?: string[];
  userLocation?: { country?: string; region?: string; city?: string; timezone?: string };
  /** How long an exact tenant-scoped research result may be reused; absent means no cross-run reuse. */
  cacheTtlMs?: number;
}

export interface CachedResearch {
  notes: string;
  sources: Source[];
  /** Time this exact evidence set was retrieved; old cache rows may not have it. */
  retrievedAt?: number;
  pageReads?: PageReadEvidence[];
  expiresAt: number;
}

export interface PhaseModels {
  research: ModelKey;
  draft: ModelKey;
  critic: ModelKey;
  /** Conditional escalation: the model that writes revisions after a failed review (defaults to draft). */
  revise?: ModelKey;
}

/** Declarative definition of one expert agent (a role doing one kind of work). */
export interface AgentSpec<T> {
  id: string;
  role: RoleKey;
  label: string;
  /** Skill ids from skills/ whose playbooks are loaded into the drafter's system prompt. */
  skills: string[];
  /** Skill ids whose rubric files are loaded into the critic (defaults to `skills`). */
  criticSkills?: string[];
  schema: z.ZodType<T>;
  rubric: Rubric;
  lint?: (output: T, input: AgentInput) => LintIssue[];
  models: PhaseModels;
  effort: { research: Effort; draft: Effort; critic: Effort };
  maxTokens: { research: number; draft: number; critic: number };
  /** Revise rounds after the first critique (0 disables critique-driven revision). */
  maxRevisions: number;
  /** Task-scoped output mode; only enabled after a matching quality evaluation. */
  thinkingOff?: Partial<Record<"draft" | "critic", boolean>>;
  /** Optional correction must reuse the original quoted run ceiling. */
  revisionWithinInitialCap?: boolean;
  /** Conservative token-estimate floor for supplied-context tasks; actual prompt estimates may raise it. Hard run caps still apply. */
  inputBudgetFloor?: number;
  /** Write this many first drafts (different angles) and keep the one the reviewer rates higher. Default 1. */
  drafts?: number;
  /**
   * Speed (engine flag "fast_review"): keep the last revision without a second review when it has no
   * more lint errors than the version it replaces and drops none of its numbers.
   */
  skipFinalReview?: boolean;
  /** What must pass to stop revising: hard gates + lint only ("gates", lean) or the full rubric ("rubric", default). */
  shipOn?: "gates" | "rubric";
  /** Owner-facing analysis (plans, insights, audits): drafted with low verbosity. Publishable copy keeps the default. */
  ownerFacing?: boolean;
  /** Rules learned by the engine lab and approved in /ops, appended to the playbook. */
  addendum?: string;
}

export interface AgentInput {
  /** The job, e.g. "Write 3 LinkedIn posts for the founder that support the plan." */
  task: string;
  /** Application-assembled business context. Evidence labels inside it determine what each statement supports. */
  brief: string;
  /** Owner text, website text, research from earlier jobs. Wrapped as untrusted. */
  untrustedContext?: string;
  /** Research to do for this job (overrides nothing; omit for no research phase). */
  research?: ResearchSpec;
  /** Research already done for this job (e.g. in parallel with an earlier step): used instead of a research phase. */
  precomputedResearch?: { notes: string; sources: Source[]; retrievedAt?: number; pageReads?: PageReadEvidence[] };
  /** Deterministic timing context assembled by the application for date validation. */
  timingContext?: { today: string; timezone: string; geography?: string; now?: number };
  /** Exact approved offer prices allowed in copy for this tenant's active plan. */
  approvedOfferTerms?: { playName: string; recommendation: string; currency: string; allowedPrices: number[]; allowedDiscountPercentages?: number[]; allowedMechanisms?: string[]; urgencyClaim: string | null; eligibleAudience: string | null }[];
  /** Exact play selected when a campaign is launched from a growth plan. */
  approvedOfferPlayName?: string;
  /** Exact pages read by the application for this run; internal input for source-reference validation. */
  availableSourceUrls?: string[];
  /** Exact first-party page titles/headings observed by this run; lints only, not extra prompt evidence. */
  observedSitePages?: { url: string; title?: string; headings?: string[] }[];
  /** First-party website on the current business record; used to validate outbound destinations. */
  businessWebsite?: string;
  /** Owner-selected niche from the versioned industry corpus; unset means no niche-specific playbook. */
  industryBusinessTypeId?: string;
  /** Short-lived visual references for this run; never saved to jobs, checkpoints or knowledge records. `sourceArtifactId` is an exact post ID or captured page URL. */
  visualInputs?: { sourceArtifactId: string; platform: string; imageUrl: string; note: string }[];
  /** Exact URLs copied from the owner's request; external destinations need this provenance. */
  ownerSuppliedUrls?: string[];
  /** Facts the critic must check claims against (statements). */
  facts: string[];
  /** Explicit examples the owner approved for brand guidance; model output must not invent these. */
  ownerApprovedExamples?: string[];
  /** Hard limits the output is checked against in code (spec §13). */
  constraints?: PlanConstraints;
}

export interface PlanConstraints {
  /** Saved owner preferences, not measured channel performance or action authority. */
  ownerChannelPreferences?: OwnerChannelPreference[];
  /** Cash the owner will pay ad platforms each month, in `currency` (the name predates currencies). */
  monthlyAdBudgetUsd?: number;
  /** Owner-reported contribution margin before acquisition; absent when unknown. */
  ownerGrossMargin?: number;
  /** Owner-confirmed monthly cash available for growth work, including media and other cash costs (excludes owner time). */
  monthlyGrowthCashUsd?: number;
  /**
   * Owner-reported growth cash timing for the selected set's reserve check (lintFeasibility); set only when both values are
   * known and usable in `currency`. Owner unit economics replace the draft's assumptions in that check.
   */
  growthCashTiming?: { reserveUsd: number; paymentLagDays: number; horizonDays: number; ownerEconomics?: Pick<OwnerEconomics, "revenuePerCustomerMonthUsd" | "grossMargin" | "monthlyChurn"> };
  /**
   * Set when the business's demand isn't validated yet: the insights' commercial assessment found insufficient
   * business-specific evidence, or the latest business model check judged the model at risk or unproven.
   * Paid acquisition then can't lead the plan (lintDemandGate).
   */
  demandValidation?: { reasons: string[] };
  /** Workspace currency (ISO code) for every amount here; absent means USD. */
  currency?: string;
  /** Hours a week the owner can give growth work (when they said). */
  ownerHoursPerWeek?: number;
  /** The plays' computed P50 customers total, which the plan's North Star must match. */
  lockedCustomers?: number;
  /** The goal's horizon in days (the period lockedCustomers covers). */
  horizonDays?: number;
  /** Delivery timing is judged by the goal; horizonDays remains a separate financial scenario where needed. */
  adaptiveTiming?: boolean;
  goalDeadline?: string;
  /** Every customer count the calculations produced (portfolio and per-play P10/P50/P90); plan prose may only use these, the goal or a fact. */
  forecastCustomers?: number[];
  /** The owner's goal numbers (baseline and desired), which prose may restate. */
  goalNumbers?: number[];
  /** Complete local recorded audience; null = incomplete coverage, 0 = no eligible contacts in these records. Not send authorization. */
  emailAudience?: number | null;
  /** Workspace business identity for attributing an external audience report; never model-invented. */
  businessName?: string;
  /** Additional new customers the owner can accept each month with current operations. */
  newCustomersPerMonth?: number;
  /** Where customers can be served (acquisition geography): local or regional limits paid reach. */
  serviceArea?: string;
  /** Each confirmed fact's strength as evidence (shared/agents/evidenceKind.ts); proof-of-demand language needs more than opinions. */
  factKinds?: EvidenceKind[];
  /** Recorded source class, never inferred from words such as analytics or measured. */
  factEvidenceBases?: FactEvidenceBasis[];
  /** Acquisition library business types (e.g. desktop_app), for platform rules. */
  businessTypes?: string[];
  /** The weakest link computed from the owner's numbers; the plays must work on it. */
  diagnosis?: Diagnosis;
  /** The owner's measured funnel rates (lead, activation, purchase) for sizing tests on real baselines. */
  funnelRates?: { lead?: number; qualification?: number; activation?: number; purchase?: number };
  /** Playbooks the business isn't eligible for now (ids and reasons); plays can't rely on them. */
  ineligiblePlaybooks?: { id: string; reasons: string[] }[];
}

export interface CritiqueResult {
  gates: { id: string; pass: boolean; note: string }[];
  scores: { id: string; score: number; note: string; fix: string }[];
  strengths: string[];
  fixes: string[];
  /** A measured reason to spend more on an Expert-mode revision; none is the default. */
  escalation?: { reason: "none" | "complex_tradeoff" | "conflicting_evidence" | "unresolved_quality_failure"; evidence: string };
}

export interface Assessment {
  critique: CritiqueResult;
  lint: LintIssue[];
  average: number;
  minimum: number;
  gatesPassed: boolean;
  ship: boolean;
}

export interface AgentRunResult<T> {
  output: T;
  assessment: Assessment | null;
  rounds: number;
  research: { notes: string; sources: Source[]; retrievedAt?: number; pageReads?: PageReadEvidence[] } | null;
  history: { round: number; average: number; gatesPassed: boolean; lintErrors: number }[];
  /** Versioned guidance passages the drafting agent actually received; separate from business evidence. */
  knowledgeReferences?: KnowledgeReferenceSet;
  /** Run quality signals for the engine dashboard (spec §27). */
  quality?: RunQuality;
}

export interface RunQuality {
  revisionFailure?: { kind: string; message: string };
  /** Characters of each prompt block the writer saw. */
  contextChars: { brief: number; facts: number; task: number; research: number };
  /** Lint errors by rule on the first draft and on the shipped version. */
  draftLint: Record<string, number>;
  finalLint: Record<string, number>;
  /** Numbers in the first draft that the shipped version no longer has (revisions stripping specifics). */
  numbersDropped: string[];
  finalAverage: number | null;
  shipped: boolean | null;
  rounds: number;
}
