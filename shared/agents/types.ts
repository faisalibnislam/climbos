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
  /** What must pass to stop revising: hard gates + lint only ("gates", lean) or the full rubric ("rubric", default). */
  shipOn?: "gates" | "rubric";
}

export interface AgentInput {
  /** The job, e.g. "Write 3 LinkedIn posts for the founder that support the plan." */
  task: string;
  /** Business brief: confirmed facts, positioning, goal, constraints. Trusted. */
  brief: string;
  /** Owner text, website text, research from earlier jobs. Wrapped as untrusted. */
  untrustedContext?: string;
  /** Research to do for this job (overrides nothing; omit for no research phase). */
  research?: ResearchSpec;
  /** Facts the critic must check claims against (statements). */
  facts: string[];
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
}
