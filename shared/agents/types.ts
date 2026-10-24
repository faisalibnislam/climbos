import type { Diagnosis } from "./diagnosis";
import type { EvidenceKind } from "./evidenceKind";
import type { z } from "zod";
import type { Effort } from "../ai/types";
import type { ModelKey } from "../economics/rates";
import type { RoleKey } from "../economics/roles";

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
  precomputedResearch?: { notes: string; sources: { url: string; title?: string }[] };
  /** Exact pages read by the application for this run; internal input for source-reference validation. */
  availableSourceUrls?: string[];
  /** Facts the critic must check claims against (statements). */
  facts: string[];
  /** Hard limits the output is checked against in code (spec §13). */
  constraints?: PlanConstraints;
}

export interface PlanConstraints {
  /** Cash the owner will pay ad platforms each month, in `currency` (the name predates currencies). */
  monthlyAdBudgetUsd?: number;
  /** Workspace currency (ISO code) for every amount here; absent means USD. */
  currency?: string;
  /** Hours a week the owner can give growth work (when they said). */
  ownerHoursPerWeek?: number;
  /** The plays' computed P50 customers total, which the plan's North Star must match. */
  lockedCustomers?: number;
  /** The goal's horizon in days (the period lockedCustomers covers). */
  horizonDays?: number;
  /** Every customer count the calculations produced (portfolio and per-play P10/P50/P90); plan prose may only use these, the goal or a fact. */
  forecastCustomers?: number[];
  /** The owner's goal numbers (baseline and desired), which prose may restate. */
  goalNumbers?: number[];
  /** Contacts with marketing-email consent in ClimbOS (capped at 1,000); 0 = no list to send to. */
  emailAudience?: number;
  /** Additional new customers the owner can accept each month with current operations. */
  newCustomersPerMonth?: number;
  /** Where customers can be served (acquisition geography): local or regional limits paid reach. */
  serviceArea?: string;
  /** Each confirmed fact's strength as evidence (shared/agents/evidenceKind.ts); proof-of-demand language needs more than opinions. */
  factKinds?: EvidenceKind[];
  /** Acquisition library business types (e.g. desktop_app), for platform rules. */
  businessTypes?: string[];
  /** The weakest link computed from the owner's numbers; the plays must work on it. */
  diagnosis?: Diagnosis;
  /** The owner's measured funnel rates (lead, activation, purchase) for sizing tests on real baselines. */
  funnelRates?: { lead?: number; activation?: number; purchase?: number };
  /** Playbooks the business isn't eligible for now (ids and reasons); plays can't rely on them. */
  ineligiblePlaybooks?: { id: string; reasons: string[] }[];
}

export interface CritiqueResult {
  gates: { id: string; pass: boolean; note: string }[];
  scores: { id: string; score: number; note: string; fix: string }[];
  strengths: string[];
  fixes: string[];
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
  research: { notes: string; sources: { url: string; title?: string }[] } | null;
  history: { round: number; average: number; gatesPassed: boolean; lintErrors: number }[];
  /** Run quality signals for the engine dashboard (spec §27). */
  quality?: RunQuality;
}

export interface RunQuality {
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
