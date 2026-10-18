/**
 * ClimbOS engine benchmark.
 *
 * Arms:
 *   v1   the original single-call engine (current prompts and schemas)
 *   v0f  a frontier one-shot baseline: Opus 5.5, high effort, same brief and
 *        output schema as v2, same web-search budget, but no skills, no
 *        research phase and no review loop (how most AI tools use a model)
 *   v2o  Engine v2 with Opus drafting   (Opus critic)
 *   v2s  Engine v2 with Sonnet drafting (Opus critic)
 *   v2s1 Engine v2, Sonnet drafting, at most 1 revision
 *
 * Judging: blind pairwise comparisons in both orders (a win only counts when
 * both orders agree) by up to three judge models, plus absolute 1–10 expert
 * scores. Outputs are saved for human reading.
 *
 *   pnpm bench --cases plausible,fishwife --tasks strategy,linkedin \
 *     --arms v1,v0f,v2s --compare v2s:v1,v2s:v0f --judges opus,sonnet --label run
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { claudeTurn, type ClaudeTurnRequest, type ClaudeTurnResult } from "../shared/ai/claude";
import { factsBlock, ROLE_CHARTERS, systemPrompt, TASKS, untrusted, type BusinessInsights, type BusinessProfile } from "../shared/ai/tasks";
import { adsSpec, conversionAuditSpec, emailSpec, growthPlaysSpec, insightsSpec, outreachSpec, playCatalogsFor, PlaysOutputSchema, prospectingSpec, researchFor, seoSpec, socialSpec, strategySpec, type ProspectsOutput } from "../shared/agents/specs";
import { OPERATING_RULES, runAgent, type AgentDeps } from "../shared/agents/runtime";
import type { AgentInput, AgentSpec } from "../shared/agents/types";
import { CURRENT_ROUTING, currentRateVersion } from "../shared/economics";
import type { ModelKey } from "../shared/economics/rates";
import { callModel } from "../convex/ai/providers";
import { researchWebsite } from "../convex/ai/research";
import { CASES, TASKS_ALL, type BenchCase, type BenchTask } from "./cases";

// ---------- env & args ----------
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*(ANTHROPIC_API_KEY|ANTHROPIC_WORKSPACE_ID|GEMINI_API_KEY)\s*=\s*"?([^"#]*)"?/);
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
const concurrency = Number(arg("concurrency") ?? 6);
const arms = (arg("arms") ?? "v1,v0f,v2s").split(",");
const compare = (arg("compare") ?? "v2s:v1,v2s:v0f").split(",").map((c) => c.split(":") as [string, string]);
const judges = (arg("judges") ?? "opus,sonnet").split(",");
const pointwise = arg("pointwise") !== "off";
mkdirSync("bench/cache", { recursive: true });
mkdirSync("bench/results", { recursive: true });

const JUDGE_MODELS: Record<string, ModelKey> = { opus: "claude-opus-5.5", sonnet: "claude-sonnet-5.5", fable: "claude-fable-5.1" };

async function pool<T, R>(items: T[], n: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Claude call with retries for transient errors (rate limits, overload, network). */
async function turnWithRetry(req: ClaudeTurnRequest): Promise<ClaudeTurnResult> {
  let r = await claudeTurn(req, rates);
  for (let attempt = 1; attempt <= 4 && !r.ok && ["rate_limited", "provider_error", "timeout"].includes(r.kind); attempt++) {
    await sleep((r.ok ? 0 : (r.retryAfterMs ?? 0)) + 5000 * attempt + Math.random() * 3000);
    r = await claudeTurn(req, rates);
  }
  return r;
}

// ---------- shared inputs (cached) ----------
interface Prepared {
  c: BenchCase;
  profile: BusinessProfile;
  pagesText: string;
  insights: BusinessInsights;
}

async function prepare(c: BenchCase): Promise<Prepared | null> {
  const file = `bench/cache/${c.id}.json`;
  if (existsSync(file)) return { c, ...JSON.parse(readFileSync(file, "utf8")) };
  try {
    console.log(`[prepare] ${c.id}: reading website`);
    const res = await researchWebsite(c.website, 2);
    const pagesText = res.pages
      .filter((p) => p.status === "ok")
      .map((p) => untrusted(p.url, `${p.text}\n${p.prices.join("\n")}`, 12_000))
      .join("\n\n");
    if (!pagesText.trim()) throw new Error("website unreadable");
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
    if (!prof.ok) throw new Error(`profile: ${prof.message}`);
    const profile = prof.output as BusinessProfile;
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
    if (!ins.ok) throw new Error(`insights: ${ins.message}`);
    const prepared = { profile, pagesText, insights: ins.output as BusinessInsights };
    writeFileSync(file, JSON.stringify(prepared, null, 1));
    return { c, ...prepared };
  } catch (e) {
    console.log(`[prepare] ${c.id} skipped: ${(e as Error).message}`);
    return null;
  }
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
type SpecFactory = (o: { models?: { draft?: ModelKey }; maxRevisions?: number }, p?: Prepared) => AgentSpec<unknown>;
interface TaskDef {
  v1: { task: keyof typeof TASKS; prompt: (p: Prepared) => string; webSearches?: number };
  spec: SpecFactory;
  task: (p: Prepared) => string;
  research?: (p: Prepared) => AgentInput["research"];
  /** Include the raw website text as untrusted context. */
  pages?: boolean;
  judgeFocus: string;
}

const social = (channel: string): SpecFactory => (o) => socialSpec([channel], o) as unknown as AgentSpec<unknown>;
const v1Social = (channel: string, n = 3) => (p: Prepared) =>
  `TASK: Write ${n} social posts for ${channel} that support the plan. Platform-native style, accessible alt text, an image idea that never implies a real customer or a fake screenshot.\n\n${brief(p, true)}`;

const DEFS: Record<BenchTask, TaskDef> = {
  insights: {
    v1: {
      task: "business_insights",
      webSearches: 2,
      prompt: (p) =>
        `TASK: Using the business profile and website content, produce business intelligence: likely customer groups, competitors (only name competitors you can support with a source), positioning, pricing observations, SWOT, a customer journey and the top opportunities.\n\n${brief(p, false)}\n\n${p.pagesText}`,
    },
    spec: (o) => insightsSpec(o) as unknown as AgentSpec<unknown>,
    task: () => "Produce business intelligence for this business: competitive alternatives, customer groups, a voice-of-customer phrase bank, objections, positioning, pricing observations, SWOT, journey, gaps and the top opportunities.",
    research: (p) => researchFor("business_insights", { website: p.c.website, businessName: p.c.name }),
    pages: true,
    judgeFocus: "business intelligence (competitors, customers, positioning, opportunities) an owner could act on",
  },
  strategy: {
    v1: {
      task: "growth_strategy",
      prompt: (p) =>
        `TASK: Create a focused growth plan for the goal. Choose 2-4 channels with priorities, dependencies and how each will be measured. Include 1-2 experiments with a hypothesis, population, method, primary metric, guardrails, duration and stopping rule. Suggested ad spend must not exceed the stated monthly ad budget. Add 3 concrete first actions.\n\n${brief(p, true)}`,
    },
    spec: (o) => strategySpec(o) as unknown as AgentSpec<unknown>,
    task: () =>
      "Create the 90-day growth plan for the goal, within the stated budget and a small business owner's time. Build it around a portfolio of 2-4 growth plays: one bankable, one or two creative-but-proven (a proven mechanic on a non-obvious audience, asset or moment), at most one capped moonshot. Go beyond social posts and email when something else would move the goal more. Forecast each play with cited base rates and ranges, and give each a test with kill and scale rules and a first action for today.",
    research: (p) => researchFor("growth_strategy", { website: p.c.website, businessName: p.c.name }),
    judgeFocus: "a 90-day growth strategy built on concrete growth plays",
  },
  linkedin: { v1: { task: "social_posts", prompt: v1Social("linkedin") }, spec: social("linkedin"), task: () => "Write 3 LinkedIn posts (founder voice unless the brief suggests otherwise) that support the goal.", judgeFocus: "LinkedIn posts" },
  instagram: { v1: { task: "social_posts", prompt: v1Social("instagram") }, spec: social("instagram"), task: () => "Write 3 Instagram posts that support the goal: mix formats, with at least one carousel (slide-by-slide).", judgeFocus: "Instagram posts" },
  facebook: { v1: { task: "social_posts", prompt: v1Social("facebook") }, spec: social("facebook"), task: () => "Write 3 Facebook page posts that support the goal.", judgeFocus: "Facebook page posts" },
  x: { v1: { task: "social_posts", prompt: v1Social("x") }, spec: social("x"), task: () => "Write 3 X posts that support the goal (one may be a short thread).", judgeFocus: "X (Twitter) posts" },
  tiktok: {
    v1: { task: "social_posts", prompt: v1Social("tiktok", 2) },
    spec: social("tiktok"),
    task: () => "Write 2 short-video scripts for TikTok/Reels that support the goal: hook in the first 2 seconds, timed beats, on-screen text, a phone-friendly shot list, caption and CTA.",
    judgeFocus: "short-video scripts (TikTok/Reels)",
  },
  ads: {
    v1: { task: "ad_drafts", prompt: (p) => `TASK: Draft one Google search ad (headlines ≤ 30 characters, descriptions ≤ 90) and one Meta ad. Keep within the owner's budget; suggest a test budget but never above it.\n\n${brief(p, true)}` },
    spec: (o) => adsSpec(o) as unknown as AgentSpec<unknown>,
    task: () => "Draft one Google responsive search ad and Meta ads built on distinct creative concepts for the goal, within budget. Ads stay paused until the owner approves.",
    research: (p) => researchFor("ad_drafts", { website: p.c.website, businessName: p.c.name }),
    judgeFocus: "paid ads (Google search + Meta)",
  },
  email: {
    v1: { task: "email_sequence", prompt: (p) => `TASK: Write a short email sequence (3 emails) for people who agreed to hear from the business. Use {{first_name}} for personalization. Include a clear call to action per email.\n\n${brief(p, true)}` },
    spec: (o) => emailSpec(o) as unknown as AgentSpec<unknown>,
    task: () => "Write a short nurture email sequence (3 emails) for people who opted in, using {{first_name}} with a safe fallback.",
    judgeFocus: "a lifecycle email sequence",
  },
  seo: {
    v1: { task: "seo_brief", webSearches: 2, prompt: (p) => `TASK: Plan and draft one helpful page targeting a real search a likely customer makes. Include title (≤ 60 chars), meta description (≤ 155 chars), outline and a first draft.\n\n${brief(p, true)}` },
    spec: (o) => seoSpec(o) as unknown as AgentSpec<unknown>,
    task: () => "Plan and draft one genuinely helpful page targeting a real, high-intent search a likely customer makes. Include the title (≤ 60 characters), meta description (≤ 155 characters), outline and a full first draft.",
    research: (p) => researchFor("seo_brief", { website: p.c.website, businessName: p.c.name }),
    judgeFocus: "an SEO page (brief + draft)",
  },
  outbound: {
    v1: { task: "sales_sequence", prompt: (p) => `TASK: Find 10 real companies that need this business and write a cold email sequence.\n\n${brief(p, true)}` },
    spec: (o) => prospectingSpec(o) as unknown as AgentSpec<unknown>,
    task: () => OUTBOUND_TASK,
    research: (p) => researchFor("prospecting", { website: p.c.website, businessName: p.c.name }),
    judgeFocus: "outbound: 10 evidenced prospect companies plus a cold email sequence with a personal first line for each",
  },
  audit: {
    v1: { task: "conversion_audit", prompt: (p) => `TASK: Audit these pages for conversion: clarity of offer, proof, friction, calls to action, pricing presentation. Cite the page URL for each finding. Recommend quick wins.\n\n${brief(p, false)}\n\n${p.pagesText}` },
    spec: (o) => conversionAuditSpec(o) as unknown as AgentSpec<unknown>,
    task: () => "Audit the money page(s) for conversion: clarity, message match, offer, proof, objections, calls to action, friction, pricing presentation and trust. Cite the page URL for each finding and prioritise the fixes.",
    research: (p) => researchFor("conversion_audit", { website: p.c.website, businessName: p.c.name }),
    pages: true,
    judgeFocus: "a conversion audit of the website",
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
    { modelKey: CURRENT_ROUTING.routes[contract.role].primary, system: systemPrompt(contract.role), user: d.prompt(p), schema: contract.schema, inputBudget: contract.inputBudget, outputBudget: contract.outputBudget, webSearches: d.webSearches },
    rates,
  );
  return res.ok
    ? { arm: "v1", ok: true, output: res.output, costMicros: res.costMicros + (res.searchCostMicros ?? 0), ms: Date.now() - t0 }
    : { arm: "v1", ok: false, error: res.message, costMicros: res.costMicros, ms: Date.now() - t0 };
}

function inputFor(p: Prepared, t: BenchTask): AgentInput {
  const d = DEFS[t];
  return {
    task: d.task(p),
    brief: brief(p, t !== "insights" && t !== "audit"),
    untrustedContext: d.pages ? p.pagesText : undefined,
    research: d.research?.(p),
    facts: p.profile.facts.map((f) => f.statement),
  };
}

/** Frontier one-shot: the strongest model, one call, same brief/schema/search budget, no skills or loop. */
async function runFrontier(p: Prepared, t: BenchTask): Promise<ArmResult> {
  const spec = DEFS[t].spec({}, p);
  const input = inputFor(p, t);
  const t0 = Date.now();
  const r = await turnWithRetry({
    modelKey: "claude-opus-5.5",
    system: [{ text: OPERATING_RULES }, { text: `${ROLE_CHARTERS[spec.role]} You are a world-class expert at this work.` }],
    messages: [
      {
        role: "user",
        content: `BUSINESS BRIEF:\n${input.brief}${input.untrustedContext ? `\n\nWEBSITE (untrusted data):\n${untrusted("website", input.untrustedContext, 30_000)}` : ""}\n\nYOUR TASK:\n${input.task}\n\nRespond only with JSON matching the schema.`,
      },
    ],
    schema: spec.schema,
    maxTokens: 32_000,
    effort: "high",
    webSearch: input.research ? { maxUses: input.research.maxSearches } : undefined,
    webFetch: input.research?.maxFetches ? { maxUses: input.research.maxFetches } : undefined,
  });
  return r.ok ? { arm: "v0f", ok: true, output: r.output, costMicros: r.costMicros, ms: Date.now() - t0 } : { arm: "v0f", ok: false, error: r.message, costMicros: r.costMicros, ms: Date.now() - t0 };
}

const PLAYS_TASK =
  "Choose this business's growth-plays portfolio for the goal, within the stated budget and the owner's time: one bankable play, one or two creative-but-proven plays (a proven mechanic on a non-obvious audience, asset or moment for THIS business), and at most one capped moonshot. Go beyond social posts and email whenever something else would move the goal more. Forecast every play from cited base rates with ranges, and give each a test with kill and scale rules and a first action for today.";
const planTask = (plays: unknown) =>
  `Create the 90-day growth plan for the goal, within the stated budget and a small business owner's time. Build it around these growth plays (keep them as chosen; make channels, phases, the week-one checklist, North Star and measurement serve them):\n${JSON.stringify(plays).slice(0, 14_000)}`;

/** Strategy is two stages in production (plays agent, then plan agent); both arms get the same two stages. */
async function runStrategyV2(p: Prepared, arm: string): Promise<ArmResult> {
  let cost = 0;
  const deps: AgentDeps = {
    turn: async (req) => {
      const r = await turnWithRetry(req);
      cost += r.costMicros;
      return r;
    },
    phase: async (_key, _label, fn) => (await fn()).value,
  };
  const t0 = Date.now();
  try {
    const base = inputFor(p, "strategy");
    const plays = await runAgent(growthPlaysSpec({}, playCatalogsFor(p.c.type)), { ...base, task: PLAYS_TASK, research: researchFor("growth_strategy", { website: p.c.website, businessName: p.c.name }) }, deps);
    const plan = await runAgent(strategySpec({}), { ...base, task: planTask(plays.output) }, deps);
    return { arm, ok: true, output: { ...(plan.output as object), plays: (plays.output as { plays: unknown }).plays, portfolioNote: (plays.output as { portfolioNote: string }).portfolioNote }, costMicros: cost, ms: Date.now() - t0 };
  } catch (e) {
    return { arm, ok: false, error: (e as Error).message, costMicros: cost, ms: Date.now() - t0 };
  }
}

async function runStrategyFrontier(p: Prepared): Promise<ArmResult> {
  const t0 = Date.now();
  const base = inputFor(p, "strategy");
  const call = (task: string, schema: z.ZodType, research?: { maxSearches: number; maxFetches?: number }) =>
    turnWithRetry({
      modelKey: "claude-opus-5.5",
      system: [{ text: OPERATING_RULES }, { text: `${ROLE_CHARTERS.ceo} You are a world-class expert at this work.` }],
      messages: [{ role: "user", content: `BUSINESS BRIEF:\n${base.brief}\n\nYOUR TASK:\n${task}\n\nRespond only with JSON matching the schema.` }],
      schema,
      maxTokens: 32_000,
      effort: "high",
      webSearch: research ? { maxUses: research.maxSearches } : undefined,
      webFetch: research?.maxFetches ? { maxUses: research.maxFetches } : undefined,
    });
  const a = await call(PLAYS_TASK, PlaysOutputSchema, researchFor("growth_strategy", { website: p.c.website, businessName: p.c.name }));
  if (!a.ok) return { arm: "v0f", ok: false, error: a.message, costMicros: a.costMicros, ms: Date.now() - t0 };
  const b = await call(planTask(a.output), strategySpec({}).schema as z.ZodType);
  if (!b.ok) return { arm: "v0f", ok: false, error: b.message, costMicros: a.costMicros + b.costMicros, ms: Date.now() - t0 };
  const plays = a.output as { plays: unknown; portfolioNote: string };
  return { arm: "v0f", ok: true, output: { ...(b.output as object), plays: plays.plays, portfolioNote: plays.portfolioNote }, costMicros: a.costMicros + b.costMicros, ms: Date.now() - t0 };
}

const OUTBOUND_TASK =
  "Find 10 real companies that need this business now, from public web sources only, each with evidence URLs, a trigger if one exists, fit and timing scores, and the decision-maker role. Write the ICP first. Never invent a company, person or email.";

/** Outbound is two stages in production (prospecting, then the cold sequence and openers). */
async function runOutboundV2(p: Prepared, arm: string): Promise<ArmResult> {
  let cost = 0;
  const deps: AgentDeps = {
    turn: async (req) => {
      const r = await turnWithRetry(req);
      cost += r.costMicros;
      return r;
    },
    phase: async (_key, _label, fn) => (await fn()).value,
  };
  const t0 = Date.now();
  try {
    const base = inputFor(p, "outbound");
    const found = await runAgent(prospectingSpec({}), base, deps);
    const f = found.output as ProspectsOutput;
    const mail = await runAgent(
      outreachSpec({}),
      {
        ...base,
        research: undefined,
        task: `Write the cold email sequence for these prospects (one template, 3-4 steps on business days 0, 3, 7 and 14) and one opener per prospect for {{firstLine}}, built only on that prospect's cited evidence. The system adds greeting, footer, opt-out and booking link.\n\nICP: ${JSON.stringify(f.icp)}\n\nPROSPECTS:\n${JSON.stringify(f.prospects.map((x) => ({ company: x.company, why: x.why, trigger: x.trigger, evidence: x.evidence, contact: x.contact }))).slice(0, 16_000)}`,
      },
      deps,
    );
    return { arm, ok: true, output: { ...f, ...(mail.output as object) }, costMicros: cost, ms: Date.now() - t0 };
  } catch (e) {
    return { arm, ok: false, error: (e as Error).message, costMicros: cost, ms: Date.now() - t0 };
  }
}

async function runV2(p: Prepared, t: BenchTask, arm: string): Promise<ArmResult> {
  if (t === "strategy") return runStrategyV2(p, arm);
  if (t === "outbound") return runOutboundV2(p, arm);
  const draft: ModelKey = arm.startsWith("v2o") ? "claude-opus-5.5" : "claude-sonnet-5.5";
  const maxRevisions = arm.endsWith("1") ? 1 : 2;
  // v22: the production configuration exactly as shipped (expert/lean profiles).
  const spec = arm === "v22" ? DEFS[t].spec({}, p) : DEFS[t].spec({ models: { draft }, maxRevisions }, p);
  let cost = 0;
  const deps: AgentDeps = {
    turn: async (req) => {
      const r = await turnWithRetry(req);
      cost += r.costMicros;
      return r;
    },
    phase: async (_key, _label, fn) => (await fn()).value,
  };
  const t0 = Date.now();
  try {
    const r = await runAgent(spec, inputFor(p, t), deps);
    return { arm, ok: true, output: r.output, costMicros: cost, ms: Date.now() - t0, rounds: r.rounds, history: r.history };
  } catch (e) {
    return { arm, ok: false, error: (e as Error).message, costMicros: cost, ms: Date.now() - t0 };
  }
}

function runArm(p: Prepared, t: BenchTask, arm: string): Promise<ArmResult> {
  if (arm === "v1") return runV1(p, t);
  if (arm === "v0f") return t === "strategy" ? runStrategyFrontier(p) : runFrontier(p, t);
  return runV2(p, t, arm);
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
5. For plans and strategy: creative but predictable. Non-obvious plays built on proven mechanics, with honest evidence-based forecasts and tests, beat generic channel lists ("post on social", "run ads"). Unsupported optimism is not creativity.

Do not reward length or extra fields for their own sake. Do not reward polish over truth. If both are equally good or equally weak, say tie.`;

async function judgeOnce(judge: string, p: Prepared, t: BenchTask, a: unknown, b: unknown): Promise<Verdict | null> {
  const r = await turnWithRetry({
    modelKey: JUDGE_MODELS[judge],
    system: [{ text: JUDGE_SYSTEM, cache: true }],
    messages: [
      {
        role: "user",
        content: `THE OWNER'S BUSINESS:\n${brief(p, true)}\n\nTHE JOB: ${DEFS[t].judgeFocus}.\n\n=== WORK A ===\n${JSON.stringify(a, null, 1).slice(0, 40_000)}\n\n=== WORK B ===\n${JSON.stringify(b, null, 1).slice(0, 40_000)}\n\nWhich is better?`,
      },
    ],
    schema: VerdictSchema,
    maxTokens: 12_000,
    effort: "medium",
  });
  return r.ok ? (r.output as Verdict) : null;
}

/** Both orders; a win counts only if both agree, otherwise a tie. Result is from x's point of view. */
async function pairwise(judge: string, p: Prepared, t: BenchTask, x: unknown, y: unknown) {
  const [xy, yx] = await Promise.all([judgeOnce(judge, p, t, x, y), judgeOnce(judge, p, t, y, x)]);
  if (!xy || !yx) return { result: "error" as const, reasons: [] as string[] };
  const first = xy.winner === "A" ? "win" : xy.winner === "B" ? "loss" : "tie";
  const second = yx.winner === "B" ? "win" : yx.winner === "A" ? "loss" : "tie";
  return { result: (first === second ? first : "tie") as "win" | "loss" | "tie", reasons: xy.reasons, truthX: xy.truthProblemsA, truthY: xy.truthProblemsB };
}

const ScoreSchema = z.object({
  truth: z.number(),
  specificity: z.number(),
  strategy: z.number(),
  craft: z.number(),
  usefulness: z.number(),
  creativity: z.number(),
  overall: z.number(),
  topIssue: z.string(),
});
type Score = z.infer<typeof ScoreSchema>;

async function score(p: Prepared, t: BenchTask, work: unknown): Promise<Score | null> {
  const r = await turnWithRetry({
    modelKey: "claude-opus-5.5",
    system: [
      {
        text: `You are a strict senior marketing expert. Score one piece of work for a small business from 1 to 10 on each dimension, where 10 means the best work a top specialist anywhere would produce, 7 means solid professional work, 5 means usable after real edits and 3 or below means it should be redone.
- truth: every claim traceable to confirmed facts or cited sources (invented numbers/customers/quotes score 1-3)
- specificity: unmistakably for this business and audience
- strategy: focused, prioritized, sound judgement for this goal and budget
- craft: would perform on the channel as written
- usefulness: ready for a non-expert owner to use
- creativity: non-obvious ideas a competitor isn't using, still grounded in proven mechanics and evidence (generic best-practice lists score 3 or below)
- overall: your overall verdict
- topIssue: the single biggest problem, in one sentence.`,
        cache: true,
      },
    ],
    messages: [{ role: "user", content: `THE OWNER'S BUSINESS:\n${brief(p, true)}\n\nTHE JOB: ${DEFS[t].judgeFocus}.\n\nTHE WORK:\n${JSON.stringify(work, null, 1).slice(0, 40_000)}` }],
    schema: ScoreSchema,
    maxTokens: 8000,
    effort: "medium",
  });
  return r.ok ? (r.output as Score) : null;
}

// ---------- main ----------
async function main() {
  const cases = CASES.filter((c) => caseIds.includes(c.id));
  const prepared = (await pool(cases, 4, prepare)).filter((p): p is Prepared => Boolean(p));
  const jobs = prepared.flatMap((p) => tasks.map((t) => ({ p, t })));
  console.log(`Running ${jobs.length} case×task pairs · arms ${arms.join(", ")} · compare ${compare.map((c) => c.join(">")).join(", ")} · judges ${judges.join(", ")} · concurrency ${concurrency}`);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const base = `bench/results/${stamp}-${label}`;
  const results: Record<string, unknown>[] = [];

  await pool(jobs, concurrency, async ({ p, t }) => {
    const outs: Record<string, ArmResult> = {};
    await Promise.all(arms.map(async (a) => (outs[a] = await runArm(p, t, a))));
    const comparisons: Record<string, Record<string, unknown>> = {};
    await Promise.all(
      compare.map(async ([x, y]) => {
        if (!outs[x]?.ok || !outs[y]?.ok) return;
        comparisons[`${x}>${y}`] = {};
        await Promise.all(judges.map(async (j) => (comparisons[`${x}>${y}`][j] = await pairwise(j, p, t, outs[x].output, outs[y].output))));
      }),
    );
    const scores: Record<string, Score | null> = {};
    if (pointwise) await Promise.all(arms.map(async (a) => (scores[a] = outs[a]?.ok ? await score(p, t, outs[a].output) : null)));
    const row = { case: p.c.id, type: p.c.type, task: t, outs, comparisons, scores };
    results.push(row);
    writeFileSync(`${base}.json`, JSON.stringify(results, null, 1)); // incremental, safe to inspect mid-run
    const cmp = Object.entries(comparisons)
      .map(([k, v]) => `${k} ${Object.entries(v).map(([j, r]) => `${j}:${(r as { result: string }).result}`).join("/")}`)
      .join(" · ");
    const sc = Object.entries(scores)
      .map(([a, s]) => `${a}=${s?.overall ?? "–"}`)
      .join(" ");
    console.log(`  ${p.c.id}/${t}: ${arms.map((a) => `${a} ${outs[a]?.ok ? `$${(outs[a].costMicros / 1e6).toFixed(2)} ${Math.round(outs[a].ms / 1000)}s` : `ERR ${outs[a]?.error?.slice(0, 60)}`}`).join(" | ")} · ${cmp} · ${sc}`);
  });

  writeFileSync(`${base}.json`, JSON.stringify(results, null, 1));
  writeFileSync(`${base}.md`, summarize(results));
  console.log(`\nWrote ${base}.md and .json`);
  console.log(summarize(results).split("\n").slice(0, 40).join("\n"));
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function summarize(rows: Record<string, unknown>[]): string {
  type Row = { case: string; task: BenchTask; outs: Record<string, ArmResult>; comparisons: Record<string, Record<string, { result: string; reasons: string[] }>>; scores: Record<string, Score | null> };
  const R = rows as unknown as Row[];
  const lines: string[] = [`# Benchmark: ${label} (${new Date().toISOString().slice(0, 10)})`, "", `Cases: ${[...new Set(R.map((r) => r.case))].join(", ")} · Tasks: ${tasks.join(", ")} · Arms: ${arms.join(", ")}`, ""];
  lines.push("## Pairwise (both orders; a win needs both orders to agree)", "", "| Comparison | Judge | Wins | Ties | Losses | Win rate (excl. ties) |", "|---|---|---|---|---|---|");
  for (const [x, y] of compare) {
    for (const j of judges) {
      const res = R.map((r) => r.comparisons[`${x}>${y}`]?.[j]?.result).filter(Boolean) as string[];
      const w = res.filter((s) => s === "win").length;
      const l = res.filter((s) => s === "loss").length;
      const tie = res.filter((s) => s === "tie").length;
      lines.push(`| ${x} vs ${y} | ${j} | ${w} | ${tie} | ${l} | ${w + l ? Math.round((100 * w) / (w + l)) : "–"}% |`);
    }
  }
  if (pointwise) {
    lines.push("", "## Absolute expert scores (Opus judge, 1–10, mean)", "", `| Task | ${arms.join(" | ")} |`, `|---|${arms.map(() => "---").join("|")}|`);
    for (const t of [...tasks, "ALL" as const]) {
      const rs = t === "ALL" ? R : R.filter((r) => r.task === t);
      lines.push(`| ${t} | ${arms.map((a) => mean(rs.map((r) => r.scores[a]?.overall).filter((v): v is number => typeof v === "number")).toFixed(2)).join(" | ")} |`);
    }
    lines.push("", "| Dimension (all tasks) | " + arms.join(" | ") + " |", `|---|${arms.map(() => "---").join("|")}|`);
    for (const dim of ["truth", "specificity", "strategy", "craft", "usefulness", "creativity"] as const) {
      lines.push(`| ${dim} | ${arms.map((a) => mean(R.map((r) => r.scores[a]?.[dim]).filter((v): v is number => typeof v === "number")).toFixed(2)).join(" | ")} |`);
    }
  }
  lines.push("", "## Cost and time per job (mean)", "", "| Task | " + arms.map((a) => `${a} $ / s`).join(" | ") + " |", `|---|${arms.map(() => "---").join("|")}|`);
  for (const t of tasks) {
    const rs = R.filter((r) => r.task === t);
    lines.push(`| ${t} | ${arms.map((a) => `${mean(rs.map((r) => r.outs[a]?.costMicros ?? 0)).toFixed(0) === "NaN" ? "–" : (mean(rs.map((r) => (r.outs[a]?.costMicros ?? 0) / 1e6))).toFixed(3)} / ${Math.round(mean(rs.map((r) => (r.outs[a]?.ms ?? 0) / 1000)))}`).join(" | ")} |`);
  }
  const errors = R.flatMap((r) => Object.values(r.outs).filter((o) => !o.ok).map((o) => `${r.case}/${r.task} ${o.arm}: ${o.error}`));
  if (errors.length) lines.push("", "## Errors", "", ...errors.map((e) => `- ${e}`));
  lines.push("", "## Losses to read (first judge, reasons)", "");
  for (const r of R) {
    for (const [k, v] of Object.entries(r.comparisons)) {
      const first = v[judges[0]];
      if (first?.result === "loss") lines.push(`- **${r.case}/${r.task} ${k}**: ${first.reasons.slice(0, 3).join(" / ")}`);
    }
  }
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
