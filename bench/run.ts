/**
 * ClimbOS engine benchmark: v1 (single call, current prompts) vs v2 (agent
 * loop with skills) on real businesses, judged blind and pairwise in both
 * orders by two judge models.
 *
 *   pnpm bench --cases plausible,fishwife --tasks strategy,linkedin --label pilot
 *
 * Reads ANTHROPIC_API_KEY / GEMINI_API_KEY from .env.local. Writes
 * bench/results/<date>-<label>.json and .md. Business facts are cached in
 * bench/cache so both engines always see identical inputs.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { claudeTurn, type ClaudeTurnRequest } from "../shared/ai/claude";
import { factsBlock, systemPrompt, TASKS, untrusted, type BusinessInsights, type BusinessProfile } from "../shared/ai/tasks";
import { adsSpec, emailSpec, insightsSpec, researchFor, socialSpec, strategySpec } from "../shared/agents/specs";
import { runAgent, type AgentDeps } from "../shared/agents/runtime";
import type { AgentInput, AgentSpec } from "../shared/agents/types";
import { CURRENT_ROUTING, currentRateVersion } from "../shared/economics";
import { callModel } from "../convex/ai/providers";
import { researchWebsite } from "../convex/ai/research";
import { CASES, TASKS_ALL, type BenchCase, type BenchTask } from "./cases";

// ---------- env ----------
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*(ANTHROPIC_API_KEY|GEMINI_API_KEY)\s*=\s*"?([^"#]*)"?/);
  if (m && m[2].trim() && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const rates = currentRateVersion();
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const caseIds = (arg("cases") ?? CASES.map((c) => c.id).join(",")).split(",");
const tasks = (arg("tasks") ?? TASKS_ALL.join(",")).split(",") as BenchTask[];
const label = arg("label") ?? "run";
const concurrency = Number(arg("concurrency") ?? 4);
const arms = (arg("arms") ?? "v1,v2").split(",");
mkdirSync("bench/cache", { recursive: true });

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ---------- shared inputs (cached) ----------
interface Prepared {
  c: BenchCase;
  profile: BusinessProfile;
  pagesText: string;
  insights: BusinessInsights;
}

async function prepare(c: BenchCase): Promise<Prepared> {
  const file = `bench/cache/${c.id}.json`;
  if (existsSync(file)) return { c, ...JSON.parse(readFileSync(file, "utf8")) };
  console.log(`[prepare] ${c.id}: reading website`);
  const res = await researchWebsite(c.website, 2);
  const pagesText = res.pages
    .filter((p) => p.status === "ok")
    .map((p) => untrusted(p.url, `${p.text}\n${p.prices.join("\n")}`, 12_000))
    .join("\n\n");
  const pt = TASKS.business_profile;
  const prof = await callModel(
    {
      modelKey: CURRENT_ROUTING.routes[pt.role].primary,
      system: systemPrompt(pt.role),
      user: `TASK: Build a concise, factual business profile from the website content below. Every fact must come from the content and cite the page URL it came from in sourceUrl. Mark anything uncertain as low confidence. Business name given by the owner: "${c.name}". Suggest 2-4 success events.\n\n${pagesText}`,
      schema: pt.schema,
      inputBudget: pt.inputBudget,
      outputBudget: pt.outputBudget,
    },
    rates,
  );
  if (!prof.ok) throw new Error(`profile ${c.id}: ${prof.message}`);
  const profile = prof.output as BusinessProfile;
  // Shared insights (v1) so strategy and content are compared on identical inputs.
  const it = TASKS.business_insights;
  const ins = await callModel(
    {
      modelKey: CURRENT_ROUTING.routes[it.role].primary,
      system: systemPrompt(it.role),
      user: `TASK: Using the business profile and website content, produce business intelligence: likely customer groups, competitors (only name competitors you can support with a source), positioning, pricing observations, SWOT, a customer journey and the top opportunities.\n\nPROFILE:\n${JSON.stringify(profile).slice(0, 6000)}\n\n${pagesText}`,
      schema: it.schema,
      inputBudget: it.inputBudget,
      outputBudget: 6000,
      webSearches: 2,
    },
    rates,
  );
  if (!ins.ok) throw new Error(`insights ${c.id}: ${ins.message}`);
  const prepared = { profile, pagesText, insights: ins.output as BusinessInsights };
  writeFileSync(file, JSON.stringify(prepared, null, 1));
  return { c, ...prepared };
}

function brief(p: Prepared, withInsights: boolean): string {
  const { c, profile, insights } = p;
  return [
    `BUSINESS: ${c.name} (${c.website})`,
    `SUMMARY: ${profile.oneLineSummary}`,
    `TYPE: ${profile.businessType} · CURRENCY: ${c.currency}`,
    `AUDIENCE: ${profile.audience}`,
    `GOAL: ${c.goal} (horizon ${c.horizonDays} days, ad budget ${c.monthlyAdBudget} ${c.currency}/month, paid directly to ad platforms)`,
    `BRAND VOICE: ${profile.brandVoice}`,
    factsBlock(profile.facts.map((f) => ({ statement: f.statement, category: f.category }))),
    withInsights
      ? `INSIGHTS:\n${JSON.stringify({ audiences: insights.audiences, positioning: insights.positioning, swot: insights.swot, opportunities: insights.opportunities, competitors: insights.competitors }).slice(0, 6000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------- task definitions ----------
interface TaskDef {
  v1: { task: keyof typeof TASKS; prompt: (p: Prepared) => string; webSearches?: number };
  v2: { spec: () => AgentSpec<unknown>; task: (p: Prepared) => string; research?: (p: Prepared) => AgentInput["research"] };
  judgeFocus: string;
}

const DEFS: Record<BenchTask, TaskDef> = {
  insights: {
    v1: {
      task: "business_insights",
      webSearches: 2,
      prompt: (p) =>
        `TASK: Using the business profile and website content, produce business intelligence: likely customer groups, competitors (only name competitors you can support with a source), positioning, pricing observations, SWOT, a customer journey and the top opportunities.\n\n${brief(p, false)}\n\n${p.pagesText}`,
    },
    v2: {
      spec: insightsSpec as () => AgentSpec<unknown>,
      task: () => "Produce business intelligence for this business: competitive alternatives, customer groups, voice-of-customer phrase bank, objections, positioning, pricing observations, SWOT, journey, gaps and top opportunities.",
      research: (p) => researchFor("business_insights", { website: p.c.website, businessName: p.c.name }),
    },
    judgeFocus: "business intelligence (competitors, customers, positioning, opportunities) an owner could act on",
  },
  strategy: {
    v1: {
      task: "growth_strategy",
      prompt: (p) =>
        `TASK: Create a focused growth plan for the goal. Choose 2-4 channels with priorities, dependencies and how each will be measured. Include 1-2 experiments with a hypothesis, population, method, primary metric, guardrails, duration and stopping rule. Suggested ad spend must not exceed the stated monthly ad budget. Add 3 concrete first actions.\n\n${brief(p, true)}`,
    },
    v2: { spec: strategySpec as () => AgentSpec<unknown>, task: () => "Create the 90-day growth plan for the goal, within the stated budget." },
    judgeFocus: "a 90-day growth strategy",
  },
  linkedin: {
    v1: {
      task: "social_posts",
      prompt: (p) => `TASK: Write 3 social posts for linkedin that support the plan. Platform-native style, accessible alt text, an image idea that never implies a real customer or a fake screenshot.\n\n${brief(p, true)}`,
    },
    v2: { spec: () => socialSpec(["linkedin"]) as unknown as AgentSpec<unknown>, task: () => "Write 3 LinkedIn posts (founder voice unless the brief suggests otherwise) that support the goal." },
    judgeFocus: "LinkedIn posts",
  },
  instagram: {
    v1: {
      task: "social_posts",
      prompt: (p) => `TASK: Write 3 social posts for instagram that support the plan. Platform-native style, accessible alt text, an image idea that never implies a real customer or a fake screenshot.\n\n${brief(p, true)}`,
    },
    v2: { spec: () => socialSpec(["instagram"]) as unknown as AgentSpec<unknown>, task: () => "Write 3 Instagram posts (mix formats: at least one carousel) that support the goal." },
    judgeFocus: "Instagram posts",
  },
  ads: {
    v1: {
      task: "ad_drafts",
      prompt: (p) => `TASK: Draft one Google search ad (headlines ≤ 30 characters, descriptions ≤ 90) and one Meta ad. Keep within the owner's budget; suggest a test budget but never above it.\n\n${brief(p, true)}`,
    },
    v2: { spec: adsSpec as () => AgentSpec<unknown>, task: () => "Draft one Google search ad (responsive search ad) and Meta ads (distinct concepts) for the goal, within budget. Ads stay paused until the owner approves." },
    judgeFocus: "paid ads (Google search + Meta)",
  },
  email: {
    v1: {
      task: "email_sequence",
      prompt: (p) => `TASK: Write a short email sequence (3 emails) for people who agreed to hear from the business. Use {{first_name}} for personalization. Include a clear call to action per email.\n\n${brief(p, true)}`,
    },
    v2: { spec: emailSpec as () => AgentSpec<unknown>, task: () => "Write a short nurture email sequence (3 emails) for people who opted in, using {{first_name}} with a safe fallback." },
    judgeFocus: "a lifecycle email sequence",
  },
};

// ---------- arms ----------
interface ArmResult {
  arm: string;
  ok: boolean;
  output?: unknown;
  error?: string;
  costMicros: number;
  ms: number;
  rounds?: number;
  history?: unknown;
}

async function runV1(p: Prepared, t: BenchTask): Promise<ArmResult> {
  const d = DEFS[t].v1;
  const contract = TASKS[d.task];
  const t0 = Date.now();
  const res = await callModel(
    {
      modelKey: CURRENT_ROUTING.routes[contract.role].primary,
      system: systemPrompt(contract.role),
      user: d.prompt(p),
      schema: contract.schema,
      inputBudget: contract.inputBudget,
      outputBudget: contract.outputBudget,
      webSearches: d.webSearches,
    },
    rates,
  );
  return res.ok
    ? { arm: "v1", ok: true, output: res.output, costMicros: res.costMicros + (res.searchCostMicros ?? 0), ms: Date.now() - t0 }
    : { arm: "v1", ok: false, error: res.message, costMicros: res.costMicros, ms: Date.now() - t0 };
}

async function runV2(p: Prepared, t: BenchTask): Promise<ArmResult> {
  const d = DEFS[t].v2;
  const spec = d.spec();
  let cost = 0;
  const deps: AgentDeps = {
    turn: async (req: ClaudeTurnRequest) => {
      let r = await claudeTurn(req, rates);
      if (!r.ok && r.kind === "rate_limited") {
        await new Promise((res) => setTimeout(res, r.ok ? 0 : (r.retryAfterMs ?? 15_000)));
        r = await claudeTurn(req, rates);
      }
      cost += r.costMicros;
      return r;
    },
    phase: async (_key, _label, fn) => (await fn()).value,
  };
  const input: AgentInput = {
    task: d.task(p),
    brief: brief(p, t !== "insights"),
    untrustedContext: t === "insights" ? p.pagesText : undefined,
    research: d.research?.(p),
    facts: p.profile.facts.map((f) => f.statement),
  };
  const t0 = Date.now();
  try {
    const r = await runAgent(spec, input, deps);
    return { arm: "v2", ok: true, output: r.output, costMicros: cost, ms: Date.now() - t0, rounds: r.rounds, history: r.history };
  } catch (e) {
    return { arm: "v2", ok: false, error: (e as Error).message, costMicros: cost, ms: Date.now() - t0 };
  }
}

// ---------- judging ----------
const VerdictSchema = z.object({
  winner: z.enum(["A", "B", "tie"]),
  margin: z.enum(["slight", "clear", "decisive"]),
  reasons: z.array(z.string()),
  truthProblemsA: z.array(z.string()),
  truthProblemsB: z.array(z.string()),
});
type Verdict = z.infer<typeof VerdictSchema>;

const JUDGE_SYSTEM = `You are a blunt senior marketing expert judging two pieces of work for a small business, produced by two different systems. You don't know which is which. Decide which one a top specialist would rather hand to this owner.

Weigh, in order:
1. Truth: anything not supported by the confirmed facts or cited sources (invented numbers, customers, quotes, features, results) is a serious flaw.
2. Strategic quality and specificity: is it unmistakably for THIS business and audience, focused, prioritized and actionable?
3. Craft for the channel: would it perform on the platform as written (hooks, structure, limits, native style)?
4. Usefulness to a non-expert owner: clear, honest, ready to use.

Do not reward length for its own sake. Do not reward polish over truth. If both are equally good or equally weak, say tie.`;

async function judgeOnce(model: "claude-opus-5.5" | "claude-sonnet-5.5", p: Prepared, t: BenchTask, a: unknown, b: unknown): Promise<Verdict | null> {
  const r = await claudeTurn(
    {
      modelKey: model,
      system: [{ text: JUDGE_SYSTEM, cache: true }],
      messages: [
        {
          role: "user",
          content: `THE OWNER'S BUSINESS:\n${brief(p, true)}\n\nTHE JOB: ${DEFS[t].judgeFocus}.\n\n=== WORK A ===\n${JSON.stringify(a, null, 1).slice(0, 40_000)}\n\n=== WORK B ===\n${JSON.stringify(b, null, 1).slice(0, 40_000)}\n\nWhich is better?`,
        },
      ],
      schema: VerdictSchema,
      maxTokens: 6000,
      effort: "medium",
    },
    rates,
  );
  return r.ok ? (r.output as Verdict) : null;
}

/** Both orders; a win counts only if consistent, otherwise tie. Returns v2's result. */
async function judge(model: "claude-opus-5.5" | "claude-sonnet-5.5", p: Prepared, t: BenchTask, v1: unknown, v2: unknown) {
  const [ab, ba] = await Promise.all([judgeOnce(model, p, t, v1, v2), judgeOnce(model, p, t, v2, v1)]);
  if (!ab || !ba) return { result: "error" as const, ab, ba };
  const first = ab.winner === "B" ? "v2" : ab.winner === "A" ? "v1" : "tie";
  const second = ba.winner === "A" ? "v2" : ba.winner === "B" ? "v1" : "tie";
  const result = first === second ? first : "tie";
  return { result, ab, ba };
}

// ---------- main ----------
async function main() {
  const cases = CASES.filter((c) => caseIds.includes(c.id));
  const prepared = await pool(cases, 3, prepare);
  const jobs = prepared.flatMap((p) => tasks.map((t) => ({ p, t })));
  console.log(`Running ${jobs.length} case×task pairs (${arms.join(" vs ")}), concurrency ${concurrency}`);
  const results = await pool(jobs, concurrency, async ({ p, t }) => {
    const [v1, v2] = await Promise.all([arms.includes("v1") ? runV1(p, t) : null, arms.includes("v2") ? runV2(p, t) : null]);
    let opus = null;
    let sonnet = null;
    if (v1?.ok && v2?.ok) {
      [opus, sonnet] = await Promise.all([judge("claude-opus-5.5", p, t, v1.output, v2.output), judge("claude-sonnet-5.5", p, t, v1.output, v2.output)]);
    }
    console.log(`  ${p.c.id}/${t}: v1 ${v1?.ok ? "ok" : v1?.error} · v2 ${v2?.ok ? `ok (${v2.rounds} rounds, $${(v2.costMicros / 1e6).toFixed(3)}, ${Math.round(v2.ms / 1000)}s)` : v2?.error} · opus: ${opus?.result} · sonnet: ${sonnet?.result}`);
    return { case: p.c.id, task: t, v1, v2, opus, sonnet };
  });

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const base = `bench/results/${stamp}-${label}`;
  writeFileSync(`${base}.json`, JSON.stringify(results, null, 1));

  const count = (judgeKey: "opus" | "sonnet", r: string) => results.filter((x) => x[judgeKey]?.result === r).length;
  const judged = results.filter((r) => r.opus && r.opus.result !== "error").length;
  const lines = [
    `# Benchmark: ${label} (${new Date().toISOString().slice(0, 10)})`,
    "",
    `Cases: ${caseIds.join(", ")} · Tasks: ${tasks.join(", ")} · Judged pairs: ${judged}`,
    "",
    "| Judge | v2 wins | ties | v1 wins |",
    "|---|---|---|---|",
    `| Opus 5.5 (both orders) | ${count("opus", "v2")} | ${count("opus", "tie")} | ${count("opus", "v1")} |`,
    `| Sonnet 5.5 (both orders) | ${count("sonnet", "v2")} | ${count("sonnet", "tie")} | ${count("sonnet", "v1")} |`,
    "",
    "| Case | Task | Opus | Sonnet | v1 cost | v2 cost | v2 rounds | v2 time |",
    "|---|---|---|---|---|---|---|---|",
    ...results.map(
      (r) =>
        `| ${r.case} | ${r.task} | ${r.opus?.result ?? "—"} | ${r.sonnet?.result ?? "—"} | $${((r.v1?.costMicros ?? 0) / 1e6).toFixed(3)} | $${((r.v2?.costMicros ?? 0) / 1e6).toFixed(3)} | ${r.v2?.rounds ?? "—"} | ${r.v2 ? Math.round(r.v2.ms / 1000) + "s" : "—"} |`,
    ),
    "",
    "## Judge reasons (Opus, v1 shown as A)",
    ...results.flatMap((r) => [`### ${r.case} / ${r.task}: ${r.opus?.result ?? "not judged"}`, ...(r.opus?.ab?.reasons ?? []).map((x: string) => `- ${x}`), ...(r.v2?.ok ? [] : [`- v2 error: ${r.v2?.error}`])]),
  ];
  writeFileSync(`${base}.md`, lines.join("\n"));
  console.log(`\nWrote ${base}.md`);
  console.log(lines.slice(0, 9).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
