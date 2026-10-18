/**
 * Blind judging of saved outputs (e.g. ChatGPT runs pasted by the owner) against
 * ClimbOS outputs for the same case. Same judge prompts as bench/run.ts; both
 * orders; a win needs both orders to agree. Every output is given as Markdown
 * with system-identifying headers stripped, so format can't reveal the source.
 *
 *   pnpm -s tsx bench/judge-files.ts --label formkit-chatgpt
 */
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { claudeTurn, type ClaudeTurnRequest, type ClaudeTurnResult } from "../shared/ai/claude";
import { currentRateVersion } from "../shared/economics";
import type { ModelKey } from "../shared/economics/rates";

for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*(ANTHROPIC_API_KEY|ANTHROPIC_WORKSPACE_ID)\s*=\s*"?([^"#]*)"?/);
  if (m && m[2].trim() && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const rates = currentRateVersion();
const label = process.argv[process.argv.indexOf("--label") + 1] ?? "files";

const BRIEF = `BUSINESS: Formkit (https://formkit.app), B2B SaaS form builder.
GOAL: Get more paying customers in the next 90 days.
MONTHLY AD BUDGET: USD 600 (a ceiling, paid directly to ad platforms).
Rules both systems were given: cite sources, never invent facts, label estimates, publishable copy must be ready to use, no guarantees.`;

const TASKS: Record<string, { focus: string; files: Record<string, string> }> = {
  strategy: { focus: "a 90-day growth strategy built on concrete growth plays", files: { climbos: "bench/results/formkit-climbos/strategy.md", luna: "bench/chatgpt/strategy-luna.md", sol: "bench/chatgpt/strategy-sol.md" } },
  insights: { focus: "business intelligence (competitors, customers, positioning, opportunities) an owner could act on", files: { climbos: "bench/results/formkit-climbos/insights.md", luna: "bench/chatgpt/insights-luna.md", sol: "bench/chatgpt/insights-sol.md" } },
  linkedin: { focus: "3 LinkedIn posts", files: { climbos: "bench/results/formkit-climbos/linkedin.md", luna: "bench/chatgpt/linkedin-luna.md", sol: "bench/chatgpt/linkedin-sol.md" } },
  outbound: { focus: "outbound: 10 evidenced prospect companies plus a cold email sequence with a personal first line for each", files: { climbos: "bench/results/formkit-climbos/outbound.md", luna: "bench/chatgpt/outbound-luna.md", sol: "bench/chatgpt/outbound-sol.md" } },
};
const PAIRS: [string, string][] = [
  ["climbos", "luna"],
  ["climbos", "sol"],
  ["sol", "luna"],
];
const JUDGES: Record<string, ModelKey> = { opus: "claude-opus-5.5", sonnet: "claude-sonnet-5.5" };

/** Strip source-revealing lines (titles, cost/score lines, model notes). */
function load(path: string): string {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => !/^# ClimbOS ·|^Cost \$|^Model:|^Prepared .*Owner review/i.test(l.trim()))
    .join("\n")
    .trim();
}

const VerdictSchema = z.object({
  winner: z.enum(["A", "B", "tie"]),
  margin: z.enum(["slight", "clear", "decisive"]),
  reasons: z.array(z.string()),
  truthProblemsA: z.array(z.string()),
  truthProblemsB: z.array(z.string()),
});
const ScoreSchema = z.object({ truth: z.number(), specificity: z.number(), strategy: z.number(), craft: z.number(), usefulness: z.number(), creativity: z.number(), overall: z.number(), topIssue: z.string() });

const JUDGE_SYSTEM = `You are a blunt senior marketing expert judging two pieces of work for a small business, produced by two different systems. You don't know which is which. Decide which one a top specialist would rather hand to this owner.

Weigh, in order:
1. Truth: anything not supported by the facts or cited sources (invented numbers, customers, quotes, features, results) is a serious flaw.
2. Strategic quality and specificity: is it unmistakably for THIS business and audience, focused, prioritized and actionable?
3. Craft for the channel: would it perform on the platform as written (hooks, structure, limits, native style)?
4. Usefulness to a non-expert owner: clear, honest, ready to use.
5. For plans and strategy: creative but predictable. Non-obvious plays built on proven mechanics, with honest evidence-based forecasts and tests, beat generic channel lists. Unsupported optimism is not creativity.

Ignore formatting style (one may read like structured fields, the other like a document). Do not reward length for its own sake. If both are equally good or equally weak, say tie.`;

const SCORE_SYSTEM = `You are a strict senior marketing expert. Score one piece of work for a small business from 1 to 10 on each dimension, where 10 means the best work a top specialist anywhere would produce, 7 means solid professional work, 5 means usable after real edits and 3 or below means it should be redone.
- truth: every claim traceable to facts or cited sources (invented numbers/customers/quotes score 1-3)
- specificity: unmistakably for this business and audience
- strategy: focused, prioritized, sound judgement for this goal and budget
- craft: would perform on the channel as written
- usefulness: ready for a non-expert owner to use
- creativity: non-obvious ideas a competitor isn't using, still grounded in proven mechanics and evidence
- overall: your overall verdict
- topIssue: the single biggest problem, in one sentence.
Ignore formatting style.`;

let spent = 0;
async function turn(req: ClaudeTurnRequest): Promise<ClaudeTurnResult> {
  for (let i = 0; i < 4; i++) {
    const r = await claudeTurn(req, rates);
    spent += r.costMicros;
    if (r.ok || !["rate_limited", "timeout", "provider_error"].includes(r.kind)) return r;
    await new Promise((res) => setTimeout(res, 4000 * (i + 1)));
  }
  return claudeTurn(req, rates);
}

async function judgeOnce(judge: string, focus: string, a: string, b: string) {
  const r = await turn({
    modelKey: JUDGES[judge],
    system: [{ text: JUDGE_SYSTEM, cache: true }],
    messages: [{ role: "user", content: `THE OWNER'S BUSINESS:\n${BRIEF}\n\nTHE JOB: ${focus}.\n\n=== WORK A ===\n${a.slice(0, 45_000)}\n\n=== WORK B ===\n${b.slice(0, 45_000)}\n\nWhich is better?` }],
    schema: VerdictSchema,
    maxTokens: 12_000,
    effort: "medium",
  });
  return r.ok ? (r.output as z.infer<typeof VerdictSchema>) : null;
}

async function pairwise(judge: string, focus: string, x: string, y: string) {
  const [xy, yx] = await Promise.all([judgeOnce(judge, focus, x, y), judgeOnce(judge, focus, y, x)]);
  if (!xy || !yx) return { result: "error", reasons: [] as string[], truthX: [] as string[], truthY: [] as string[] };
  const first = xy.winner === "A" ? "win" : xy.winner === "B" ? "loss" : "tie";
  const second = yx.winner === "B" ? "win" : yx.winner === "A" ? "loss" : "tie";
  return { result: first === second ? first : "tie", reasons: xy.reasons, truthX: xy.truthProblemsA, truthY: xy.truthProblemsB };
}

async function score(focus: string, work: string) {
  const r = await turn({
    modelKey: "claude-opus-5.5",
    system: [{ text: SCORE_SYSTEM, cache: true }],
    messages: [{ role: "user", content: `THE OWNER'S BUSINESS:\n${BRIEF}\n\nTHE JOB: ${focus}.\n\nTHE WORK:\n${work.slice(0, 45_000)}` }],
    schema: ScoreSchema,
    maxTokens: 8000,
    effort: "medium",
  });
  return r.ok ? (r.output as z.infer<typeof ScoreSchema>) : null;
}

async function main() {
  const out: Record<string, unknown> = {};
  await Promise.all(
    Object.entries(TASKS).map(async ([task, t]) => {
      const docs = Object.fromEntries(Object.entries(t.files).map(([k, f]) => [k, load(f)]));
      const pairs: Record<string, unknown> = {};
      await Promise.all(
        PAIRS.map(async ([x, y]) => {
          pairs[`${x}>${y}`] = Object.fromEntries(await Promise.all(Object.keys(JUDGES).map(async (j) => [j, await pairwise(j, t.focus, docs[x], docs[y])])));
        }),
      );
      const scores = Object.fromEntries(await Promise.all(Object.keys(docs).map(async (k) => [k, await score(t.focus, docs[k])])));
      out[task] = { pairs, scores, words: Object.fromEntries(Object.entries(docs).map(([k, d]) => [k, d.split(/\s+/).length])) };
      console.log(`${task}: ${Object.entries(pairs).map(([k, v]) => `${k} ${Object.entries(v as Record<string, { result: string }>).map(([j, r]) => `${j}:${r.result}`).join("/")}`).join(" · ")} · scores ${Object.entries(scores).map(([k, s]) => `${k}=${(s as { overall?: number } | null)?.overall ?? "–"}`).join(" ")}`);
    }),
  );
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  writeFileSync(`bench/results/${stamp}-${label}.json`, JSON.stringify(out, null, 1));
  console.log(`\nJudging cost $${(spent / 1e6).toFixed(2)} · wrote bench/results/${stamp}-${label}.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
