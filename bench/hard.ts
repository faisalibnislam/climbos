/**
 * Hard failures, scored apart from the judge (Book 13 §11, Book 14 §13). Each saved plan is re-linted
 * with the checks that make a production plan "failed" (HARD_RULES in shared/agents/quality.ts):
 * the plays lint as the runtime runs it on the plays agent, and the final-plan lint as convex/jobs.ts
 * runs it after the consistency pass. A plan with any counted hard finding loses its comparison,
 * whatever the judge says.
 *
 * Pure and offline: it works on live and imported (saved) outputs. Live arms save what the writers saw
 * (HardEvidence); for older saved outputs it's rebuilt, and what can't be rebuilt isn't counted:
 * - no research notes saved → plays `invented_fact` findings are listed but not counted;
 * - the plan's own channels not saved (bench outputs carry the scorecard rows there) → no channel budget check.
 */
import { forecastCustomers, lockedNumbers, portfolioP50 } from "../shared/agents/economics";
import { planTask, playsTask } from "../shared/agents/planTasks";
import { HARD_RULES } from "../shared/agents/quality";
import { growthPlaysSpec, strategySpec } from "../shared/agents/specs";
import type { AgentInput, LintIssue } from "../shared/agents/types";
import type { BenchCase } from "./cases";

/** What the writers saw, rebuilt for the lint. */
export interface LintCase {
  c: BenchCase;
  /** The brief the strategy agents got (with insights). */
  brief: string;
  facts: string[];
  /** The insights block as the plan job gives it. */
  insights: string;
  /** Scorecard text without the channel-fit model's adjustments; an arm's own (saved) scorecard wins. */
  scorecard: string;
}

/** Evidence an arm saves alongside its output (never shown to the judge). */
export interface HardEvidence {
  scorecard?: string;
  /** Research source URLs. */
  sources?: string[];
  /** The plays agent's research notes ("" when it did research but wrote none). */
  notes?: string;
  /** The final plan's own channels (the bench output replaces them with scorecard rows). */
  planChannels?: unknown[];
}

export interface HardFinding {
  stage: "plays" | "plan";
  rule: string;
  path?: string;
  message: string;
}

export interface HardCheck {
  /** Counted hard findings: any one fails the plan. */
  findings: HardFinding[];
  /** Counted hard findings by rule. */
  rules: Record<string, number>;
  /** Hard findings the saved evidence can't confirm (see the header). Listed, never counted. */
  uncounted?: HardFinding[];
  /** Checks that couldn't run on this output. */
  notes?: string[];
  /** Why the output couldn't be checked at all (no plays, or a lint crash on an older schema). Not a failure. */
  skipped?: string;
}

type PlanOut = { plays?: unknown[]; portfolioNote?: string; economics?: unknown; decision?: unknown; researchSources?: string[]; channels?: unknown[] } & Record<string, unknown>;
type ScoreRow = { name?: string; score?: number; why?: string };

const hardOnly = (stage: HardFinding["stage"], xs: LintIssue[]): HardFinding[] =>
  xs.filter((l) => l.severity === "error" && HARD_RULES.has(l.rule)).map((l) => ({ stage, rule: l.rule, ...(l.path ? { path: l.path } : {}), message: l.message.slice(0, 300) }));

/** Bench outputs put the scorecard's top rows (code-written: name, score, status, why) where the plan's channels were. */
const isScoreRows = (xs: unknown): xs is ScoreRow[] => Array.isArray(xs) && xs.length > 0 && xs.every((r) => r && typeof (r as ScoreRow).score === "number" && !("suggestedMonthlyAdSpend" in (r as object)));

/** Re-run the hard checks on one saved strategy output. */
export function hardCheck(output: unknown, lc: LintCase, ev: HardEvidence = {}): HardCheck {
  const out = (output ?? {}) as PlanOut;
  if (!Array.isArray(out.plays)) return { findings: [], rules: {}, skipped: "no plays (not a plays-based plan)" };
  const { plays: _plays, portfolioNote, economics, decision, researchSources, ...plan } = out;
  const playsOut = { portfolioNote: portfolioNote ?? "", plays: out.plays, economics: economics ?? { revenuePerCustomerMonthUsd: 0, grossMargin: 0, monthlyChurn: 0, basis: "" }, ...(decision ? { decision } : {}) };
  const sources = [...new Set([...(researchSources ?? []), ...(ev.sources ?? [])])];
  const scoreRows = isScoreRows(plan.channels) ? plan.channels : null;
  // An older saved output has no scorecard: the deterministic one plus the rows it kept (their scores).
  const scorecard = ev.scorecard ?? `${lc.scorecard}${scoreRows ? `\n${scoreRows.map((r) => `${r.name} (${r.score}/100) ${r.why ?? ""}`).join("\n")}` : ""}`;
  const notes: string[] = [];
  const planChannels = ev.planChannels ?? (scoreRows ? (notes.push("plan channels not saved: channel ad-spend budget check skipped"), []) : (plan.channels ?? []));
  if (ev.notes === undefined) notes.push("research notes not saved: plays invented_fact findings not counted");
  const h = lc.c.horizonDays;
  const base: AgentInput = { task: "", brief: lc.brief, facts: lc.facts, constraints: { monthlyAdBudgetUsd: lc.c.monthlyAdBudget } };
  const all: HardFinding[] = [];
  try {
    // As the runtime lints an agent: research notes and source URLs join the untrusted context.
    const playsIn: AgentInput = { ...base, task: playsTask({ scorecard, insights: lc.insights, horizonDays: h, decisionContract: Boolean(decision) }), untrustedContext: [ev.notes ?? "", ...sources].join("\n") };
    all.push(...hardOnly("plays", growthPlaysSpec({ decisionContract: Boolean(decision) }).lint!(playsOut as never, playsIn)));
    // As convex/jobs.ts lints the final plan (no research notes): locked numbers and the plays in the task, calculated counts in the constraints.
    const locked = lockedNumbers(playsOut as never, { statement: lc.c.goal, target: null, horizonDays: h });
    const planIn: AgentInput = {
      ...base,
      task: planTask({ locked, plays: playsOut, scorecard, insights: lc.insights, horizonDays: h }),
      constraints: { ...base.constraints, lockedCustomers: portfolioP50(playsOut as never, h), horizonDays: h, forecastCustomers: forecastCustomers(playsOut as never, h) },
    };
    all.push(...hardOnly("plan", strategySpec().lint!({ ...plan, channels: planChannels } as never, planIn)));
  } catch (e) {
    return { findings: [], rules: {}, skipped: `lint failed on this output: ${(e as Error).message.slice(0, 160)}` };
  }
  const unconfirmed = (f: HardFinding) => ev.notes === undefined && f.stage === "plays" && f.rule === "invented_fact";
  const findings = all.filter((f) => !unconfirmed(f));
  const uncounted = all.filter(unconfirmed);
  const rules: Record<string, number> = {};
  for (const f of findings) rules[f.rule] = (rules[f.rule] ?? 0) + 1;
  return { findings, rules, ...(uncounted.length ? { uncounted } : {}), ...(notes.length ? { notes } : {}) };
}

export const hardFailed = (h: HardCheck | null | undefined): boolean => Boolean(h?.findings.length);

export type PairResult = "win" | "loss" | "tie" | "error";

/**
 * x's result against y once hard failures count: x failed → loss (even if y failed too: a failed
 * plan never wins); only y failed → win; neither → the judge's call. The judge's own call is kept.
 */
export function withHardOverride<J extends { result: PairResult }>(judged: J, xHard: HardCheck | null | undefined, yHard: HardCheck | null | undefined): J & { judged: PairResult; hardOverride?: "x_failed" | "y_failed" | "both_failed" } {
  const x = hardFailed(xHard);
  const y = hardFailed(yHard);
  const hardOverride = x && y ? "both_failed" : x ? "x_failed" : y ? "y_failed" : undefined;
  const result: PairResult = x ? "loss" : y ? "win" : judged.result;
  return { ...judged, result, judged: judged.result, ...(hardOverride ? { hardOverride } : {}) };
}

/** Markdown: hard failures per arm, then each failing case. */
export function hardSection(rows: { case: string; task: string; hard?: Record<string, HardCheck | null> }[], arms: string[]): string[] {
  const checked = rows.filter((r) => r.hard);
  if (!checked.length) return [];
  const lines = ["## Hard failures (code checks; a failed plan loses its comparisons)", "", "| Arm | Plans checked | Failed | Rules | Not counted |", "|---|---|---|---|---|"];
  for (const a of arms) {
    const hs = checked.map((r) => r.hard?.[a]).filter((h): h is HardCheck => Boolean(h) && !h!.skipped);
    const rules: Record<string, number> = {};
    for (const h of hs) for (const [k, n] of Object.entries(h.rules)) rules[k] = (rules[k] ?? 0) + n;
    const uncounted = hs.reduce((n, h) => n + (h.uncounted?.length ?? 0), 0);
    lines.push(`| ${a} | ${hs.length} | ${hs.filter(hardFailed).length} | ${Object.entries(rules).map(([k, n]) => `${k} ×${n}`).join(", ") || "–"} | ${uncounted || "–"} |`);
  }
  const detail = checked.flatMap((r) =>
    Object.entries(r.hard ?? {}).flatMap(([a, h]) => {
      if (!h) return [];
      if (h.skipped) return [`- ${r.case}/${r.task} ${a}: not checked (${h.skipped})`];
      const out = hardFailed(h) ? [`- **${r.case}/${r.task} ${a}**: ${h.findings.slice(0, 4).map((f) => `${f.stage} ${f.rule}${f.path ? ` @ ${f.path}` : ""}`).join(" · ")}${h.findings.length > 4 ? ` · +${h.findings.length - 4} more` : ""}`] : [];
      return h.notes?.length ? [...out, `- ${r.case}/${r.task} ${a}: ${h.notes.join("; ")}`] : out;
    }),
  );
  if (detail.length) lines.push("", ...detail);
  return lines;
}
