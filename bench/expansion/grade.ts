/**
 * Grades an expansion run (bench/expansion/run.ts output).
 *
 * - Deterministic: each case's numeric checks (numeric.ts). No model.
 * - Judge (blind): a Sol reviewer scores the pack's 7-dimension rubric (0–2)
 *   and says whether each hard failure (the case's own plus the pack's global
 *   ones) is present. Any hard failure fails the case, whatever the scores.
 * - Pairwise (--against other.json): the same reviewer picks the better answer
 *   per case in both orders; a win only counts when both orders agree.
 *
 * Writes <results>.graded.json, a markdown report and a blind packet (answers
 * without arm names) for owner review.
 *
 *   pnpm tsx bench/expansion/grade.ts --results bench/results/expansion-…-dry.json --fake
 *   pnpm tsx bench/expansion/grade.ts --results after.json --against baseline.json --max-usd 3
 */
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { modelTurn } from "../../shared/ai/turn";
import type { TurnRequest, TurnResult } from "../../shared/ai/types";
import { currentRateVersion } from "../../shared/economics";
import { fakeTurn } from "../../shared/agents/fake";
import type { ModelKey } from "../../shared/economics/rates";
import { GLOBAL_HARD_FAILURES, loadCases, RUBRIC, type ExpansionCase, type RubricKey } from "./cases";
import { checkNumbers, type NumberResult } from "./numeric";
import type { ExpansionRow } from "./run";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const FAKE = process.argv.includes("--fake");
const resultsFile = arg("results");
const againstFile = arg("against");
const maxUsd = arg("max-usd") ? Number(arg("max-usd")) : null;
const JUDGE: ModelKey = "gpt-6.1-sol";

type Run = { meta: Record<string, unknown>; rows: ExpansionRow[] };

export const JudgeSchema = z.object({
  scores: z.object(Object.fromEntries(RUBRIC.map((r) => [r.key, z.number().int().min(0).max(2)])) as Record<RubricKey, z.ZodNumber>),
  hard_failures: z.array(z.object({ failure: z.string(), present: z.boolean(), why: z.string() })),
  notes: z.string(),
});
export type Judgement = z.infer<typeof JudgeSchema>;

const PairSchema = z.object({ better: z.enum(["A", "B", "tie"]), why: z.string() });

const JUDGE_RULES = `You are a strict, fair reviewer of advice an AI growth assistant gave a small-business owner in a synthetic test case. You see the case, what a strong answer does, the failures that sink an answer, and the answer. Judge only what the answer says; reward correct caution, never length or polish. Score each rubric dimension 0 (materially wrong or missing), 1 (partly right or not qualified enough) or 2 (useful and supported by the inputs). For every listed hard failure, say whether the answer commits it, quoting or pointing to the words. An answer that asks a sensible clarifying question or proposes a learning step instead of inventing facts is not a failure.`;

/** The judge's prompt for one answer. Exported for tests. */
export function judgePrompt(c: ExpansionCase, response: string): string {
  return [
    `CASE ${c.id} (${c.business_type})`,
    `TASK: ${c.task}`,
    `INPUTS: ${JSON.stringify(c.inputs)}`,
    `A STRONG ANSWER:\n${c.expected_behaviors.map((b) => `- ${b}`).join("\n")}`,
    `HARD FAILURES (check each):\n${[...c.hard_failures, ...GLOBAL_HARD_FAILURES].map((f) => `- ${f}`).join("\n")}`,
    `RUBRIC:\n${RUBRIC.map((r) => `- ${r.key}: ${r.strong}`).join("\n")}`,
    `THE ANSWER:\n<answer>\n${response || "(no answer)"}\n</answer>`,
  ].join("\n\n");
}

const rates = currentRateVersion();
let spentMicros = 0;
async function call(req: TurnRequest): Promise<TurnResult> {
  if (maxUsd !== null && spentMicros >= maxUsd * 1e6) throw new Error("Judge budget cap reached");
  const r = await (FAKE ? fakeTurn : modelTurn)(req, rates);
  spentMicros += r.costMicros;
  return r;
}

async function judge(c: ExpansionCase, row: ExpansionRow): Promise<Judgement | { error: string }> {
  if (!row.ok) return { error: row.error ?? "no answer" };
  const r = await call({ modelKey: JUDGE, cacheKey: "climbos:expansion_judge", system: [{ text: JUDGE_RULES, cache: true }], messages: [{ role: "user", content: judgePrompt(c, row.response) }], schema: JudgeSchema, maxTokens: 4_000, effort: "medium" });
  return r.ok ? (r.output as Judgement) : { error: `${r.kind}: ${r.message}` };
}

async function pair(c: ExpansionCase, a: string, b: string): Promise<"A" | "B" | "tie" | "error"> {
  const ask = async (x: string, y: string) => {
    const r = await call({ modelKey: JUDGE, cacheKey: "climbos:expansion_pair", system: [{ text: `${JUDGE_RULES}\nNow compare two answers to the same case and pick the better one for the owner, or "tie".` }], messages: [{ role: "user", content: `${judgePrompt(c, "").replace(/THE ANSWER:[\s\S]*$/, "")}ANSWER A:\n<answer>\n${x}\n</answer>\n\nANSWER B:\n<answer>\n${y}\n</answer>` }], schema: PairSchema, maxTokens: 2_000, effort: "medium" });
    return r.ok ? (r.output as z.infer<typeof PairSchema>).better : "error";
  };
  const first = await ask(a, b);
  const second = await ask(b, a);
  if (first === "error" || second === "error") return "error";
  const flipped = second === "A" ? "B" : second === "B" ? "A" : "tie";
  return first === flipped ? first : "tie";
}

export interface GradedRow {
  case_id: string;
  surface: ExpansionRow["surface"];
  ok: boolean;
  numbers: NumberResult[];
  judgement: Judgement | { error: string } | null;
  /** Any hard failure (judge) or a failed run. */
  hard_fail: boolean;
  total: number | null;
}

export function summarize(rows: GradedRow[]) {
  const scored = rows.filter((r) => r.total !== null);
  const dims = Object.fromEntries(RUBRIC.map((d) => [d.key, scored.length ? Math.round((scored.reduce((s, r) => s + ((r.judgement as Judgement).scores[d.key] ?? 0), 0) / scored.length) * 100) / 100 : null]));
  const numbers = rows.flatMap((r) => r.numbers);
  return {
    runs: rows.length,
    failed_runs: rows.filter((r) => !r.ok).length,
    hard_fails: rows.filter((r) => r.hard_fail).length,
    numbers_found: `${numbers.filter((n) => n.found).length}/${numbers.length}`,
    mean_total: scored.length ? Math.round((scored.reduce((s, r) => s + (r.total ?? 0), 0) / scored.length) * 100) / 100 : null,
    dims,
  };
}

async function main() {
  if (!resultsFile) throw new Error("--results <file> is required");
  if (!FAKE && !(maxUsd && maxUsd > 0)) {
    console.error("Judging calls a model: pass --max-usd <owner-approved cap>, or --fake for a free dry run.");
    process.exit(1);
  }
  const run = JSON.parse(readFileSync(resultsFile, "utf8")) as Run;
  const cases = new Map(loadCases().map((c) => [c.id, c]));
  const graded: GradedRow[] = [];
  for (const row of run.rows) {
    const c = cases.get(row.case_id)!;
    const numbers = checkNumbers(row.response, c.numeric_checks);
    const j = await judge(c, row);
    const ok = !("error" in j);
    const total = ok ? Object.values((j as Judgement).scores).reduce((s, n) => s + n, 0) : null;
    graded.push({ case_id: row.case_id, surface: row.surface, ok: row.ok, numbers, judgement: j, hard_fail: !row.ok || (ok && (j as Judgement).hard_failures.some((h) => h.present)), total });
    console.log(` ${row.case_id} ${row.surface}: ${total ?? "—"}/14${graded[graded.length - 1].hard_fail ? " HARD FAIL" : ""} · numbers ${numbers.filter((n) => n.found).length}/${numbers.length}`);
  }
  const pairs: { case_id: string; surface: string; winner: string }[] = [];
  if (againstFile) {
    const other = JSON.parse(readFileSync(againstFile, "utf8")) as Run;
    const byKey = new Map(other.rows.map((r) => [`${r.case_id}|${r.surface}`, r]));
    for (const row of run.rows) {
      const o = byKey.get(`${row.case_id}|${row.surface}`);
      if (!o) continue;
      const w = await pair(cases.get(row.case_id)!, row.response, o.response);
      pairs.push({ case_id: row.case_id, surface: row.surface, winner: w === "A" ? "this" : w === "B" ? "against" : w });
    }
  }
  const summary = summarize(graded);
  const base = resultsFile.replace(/\.json$/, "");
  writeFileSync(`${base}.graded.json`, JSON.stringify({ meta: run.meta, judge: JUDGE, fake: FAKE, spent_usd: spentMicros / 1e6, summary, pairs, rows: graded }, null, 2));
  const md = [
    `# Expansion eval: ${String(run.meta.label)}`,
    `Engine ${String(run.meta.engine_version)} @ ${String(run.meta.git_ref)} · judge ${JUDGE}${FAKE ? " (fake)" : ""} · run $${String(run.meta.spent_usd)} + judging $${(spentMicros / 1e6).toFixed(2)}`,
    "",
    `| Runs | Failed | Hard fails | Numbers found | Mean /14 |`,
    `|---|---|---|---|---|`,
    `| ${summary.runs} | ${summary.failed_runs} | ${summary.hard_fails} | ${summary.numbers_found} | ${summary.mean_total ?? "—"} |`,
    "",
    `| Dimension | Mean /2 |`,
    `|---|---|`,
    ...RUBRIC.map((d) => `| ${d.label} | ${summary.dims[d.key] ?? "—"} |`),
    "",
    ...(pairs.length ? [`**Pairwise vs ${againstFile}:** this ${pairs.filter((p) => p.winner === "this").length}, against ${pairs.filter((p) => p.winner === "against").length}, tie ${pairs.filter((p) => p.winner === "tie").length}, error ${pairs.filter((p) => p.winner === "error").length}`, ""] : []),
    `| Case | Surface | /14 | Hard fail | Numbers |`,
    `|---|---|---|---|---|`,
    ...graded.map((g) => `| ${g.case_id} | ${g.surface} | ${g.total ?? "—"} | ${g.hard_fail ? "yes" : ""} | ${g.numbers.length ? `${g.numbers.filter((n) => n.found).length}/${g.numbers.length}` : ""} |`),
  ].join("\n");
  writeFileSync(`${base}.md`, md);
  // Blind packet: the answers only, in a shuffled order, for the owner to read.
  const order = [...run.rows].sort((a, b) => (a.case_id + a.surface).localeCompare(b.case_id + b.surface));
  writeFileSync(`${base}.blind.md`, order.map((r, i) => `## ${i + 1}. ${r.case_id} (${r.surface})\n\n**Task:** ${cases.get(r.case_id)!.task}\n\n${r.ok ? r.response : `_(no answer: ${r.error})_`}`).join("\n\n---\n\n"));
  console.log(`Wrote ${base}.graded.json, .md and .blind.md · judging $${(spentMicros / 1e6).toFixed(2)}${FAKE ? " (fake)" : ""}`);
}

if (process.argv[1]?.endsWith("grade.ts")) void main();
