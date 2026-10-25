/**
 * Runs the knowledge expansion's 32 synthetic cases against the engine as it is.
 *
 * Surfaces:
 *   advisor  every case, through Climb AI's real prompt, model route and tools
 *            (workspace tools return "no data" in this synthetic workspace;
 *            pure tools such as calculators run for real; nothing is published,
 *            sent or spent: confirm tools only report a card, as in production)
 *   plan     the plan-shaped cases (PLAN_CASES) through the real plays → plan →
 *            consistency path, research off (the case inputs are the evidence)
 *
 * The engine sees only the exported prompt (no expected answers). Grade with
 * bench/expansion/grade.ts.
 *
 *   pnpm tsx bench/expansion/run.ts --fake --label dry
 *   pnpm tsx bench/expansion/run.ts --surface advisor --cases EV03,EV08 --max-usd 1 --label baseline
 *
 * Paid runs refuse to start without --max-usd (the owner-approved cap).
 */
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { modelTurn } from "../../shared/ai/turn";
import type { MessageParam, ToolDef, ToolResultBlock, TurnRequest, TurnResult } from "../../shared/ai/types";
import { currentRateVersion } from "../../shared/economics";
import { fakeTurn } from "../../shared/agents/fake";
import { runAgent, type AgentDeps } from "../../shared/agents/runtime";
import { draftsFor, routeModels } from "../../shared/agents/routes";
import { ENGINE_VERSION, growthPlaysSpec, playCatalogsFor, strategySpec, type PlaysOutput } from "../../shared/agents/specs";
import { planTask, playsTask } from "../../shared/agents/planTasks";
import { forecastCustomers, lockedNumbers, portfolioP50, withForecasts } from "../../shared/agents/economics";
import { withDerivedAssumed } from "../../shared/agents/provenance";
import { reconcile } from "../../shared/agents/consistency";
import { capsHint, PLAN_CAPS } from "../../shared/agents/wordCaps";
import type { AgentInput } from "../../shared/agents/types";
import { CLIMB_CONFIG } from "../../convex/lib/climbConfig";
import { climbToolDefs, toolByName } from "../../convex/lib/climbTools";
import { evidenceKind } from "../../shared/agents/evidenceKind";
import { platformNotes } from "../../shared/acquisition/platformRules";
import { fixtureIdentity, LIBRARY_TYPE, loadCases, loadPrompts, PLAN_CASES, type ExpansionCase } from "./cases";

// ---------- args ----------
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const FAKE = flag("fake");
const surface = (arg("surface") ?? "all") as "advisor" | "plan" | "all";
const label = arg("label") ?? (FAKE ? "dry" : "run");
const concurrency = Number(arg("concurrency") ?? 4);
const maxUsd = arg("max-usd") ? Number(arg("max-usd")) : null;
if (!FAKE && !(maxUsd && maxUsd > 0)) {
  console.error("Paid runs need --max-usd <owner-approved cap>. Use --fake for a free dry run.");
  process.exit(1);
}
if (FAKE) process.env.CLIMBOS_FAKE_LLM = process.env.CLIMBOS_FAKE_LLM ?? "ship";
else
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(OPENAI_API_KEY)\s*=\s*"?([^"#]*)"?/);
    if (m && m[2].trim() && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }

const rates = currentRateVersion();
const cases = loadCases();
const prompts = new Map(loadPrompts().map((p) => [p.case_id, p.prompt]));
const wanted = (arg("cases") ?? cases.map((c) => c.id).join(",")).split(",");
const knownCaseIds = new Set(cases.map((c) => c.id));
const unknownCaseIds = wanted.filter((id) => !knownCaseIds.has(id));
if (unknownCaseIds.length) throw new Error(`Unknown evaluation case id(s): ${[...new Set(unknownCaseIds)].join(", ")}`);
if (new Set(wanted).size !== wanted.length) throw new Error("--cases cannot contain duplicate case ids.");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error("--concurrency must be an integer from 1 to 16.");
if (!(["all", "advisor", "plan"] as string[]).includes(surface)) throw new Error("--surface must be all, advisor, or plan.");

// ---------- spend cap ----------
const capMicros = maxUsd ? Math.round(maxUsd * 1e6) : Infinity;
let spentMicros = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One model call: the fake model in dry runs; otherwise production's, with retries and the hard cap. */
async function turn(req: TurnRequest): Promise<TurnResult> {
  if (spentMicros >= capMicros) throw new Error(`Budget cap reached ($${(spentMicros / 1e6).toFixed(2)} of $${maxUsd})`);
  const call = FAKE ? fakeTurn : modelTurn;
  let r = await call(req, rates);
  for (let attempt = 1; attempt <= 3 && !r.ok && ["rate_limited", "provider_error", "timeout"].includes(r.kind); attempt++) {
    await sleep((r.ok ? 0 : (r.retryAfterMs ?? 0)) + 4000 * attempt);
    r = await call(req, rates);
  }
  spentMicros += r.costMicros;
  return r;
}

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

export interface ExpansionRow {
  case_id: string;
  surface: "advisor" | "plan";
  ok: boolean;
  /** What the owner would read. */
  response: string;
  /** Structured output (plan surface). */
  output?: unknown;
  error?: string;
  /** Tools the assistant called, with what the harness returned (execution receipts). */
  tool_calls: { name: string; input: unknown; result: string }[];
  cost_micros: number;
  elapsed_seconds: number;
}

// ---------- advisor (Climb AI) ----------
const NO_DATA = { note: "Synthetic evaluation workspace: there is no stored business data for this tool. Use only what the owner wrote." };

async function runAdvisor(c: ExpansionCase): Promise<ExpansionRow> {
  const t0 = Date.now();
  const before = spentMicros;
  const calls: ExpansionRow["tool_calls"] = [];
  const screen = [`NOW: ${new Date().toISOString()}. Owner's timezone: UTC.`, "SCREEN: Today (/today)"].join("\n");
  const messages: MessageParam[] = [{ role: "user", content: `${screen}\n\nOWNER: ${prompts.get(c.id) ?? c.task}` }];
  const tools = climbToolDefs({ ui: true }) as ToolDef[];
  try {
    for (let i = 0; i < CLIMB_CONFIG.maxTurns; i++) {
      const r = await turn({ modelKey: CLIMB_CONFIG.model, cacheKey: "climbos:climb", system: [{ text: CLIMB_CONFIG.rules, cache: true }], messages, customTools: tools, ...CLIMB_CONFIG.turn });
      if (!r.ok) throw new Error(`${r.kind}: ${r.message}`);
      messages.push(...r.appended);
      if (r.stopReason !== "tool_use" || !r.toolUses?.length) return row(c, "advisor", true, r.text.trim(), undefined, calls, before, t0);
      const results: ToolResultBlock[] = [];
      for (const tu of r.toolUses) {
        const tool = toolByName(tu.name);
        const parsed = tool?.input.safeParse(tu.input ?? {});
        let content: string;
        if (!tool || !parsed?.success) content = `Unknown tool or bad input: ${tu.name}`;
        else if (tool.risk === "ui") content = tool.name === "go_to" ? "Opened for the owner." : "Highlighted on the owner's screen.";
        else if (tool.risk === "confirm") content = "A confirmation card is now shown to the owner. It has NOT happened yet; tell them to confirm it if they want it.";
        else {
          // Pure tools (no workspace data, e.g. calculators) run for real; workspace tools have nothing to return here.
          const local = (tool as { local?: (input: unknown) => unknown }).local;
          const out = local ? local(parsed.data) : NO_DATA;
          content = `<untrusted_content source="${tool.name}">\n${JSON.stringify(out).slice(0, 8000)}\n</untrusted_content>`;
        }
        calls.push({ name: tu.name, input: tu.input, result: content.slice(0, 2000) });
        results.push({ type: "tool_result", tool_use_id: tu.id, content });
      }
      messages.push({ role: "user", content: results });
    }
    return row(c, "advisor", false, "", undefined, calls, before, t0, "Reached the turn limit without a final answer.");
  } catch (e) {
    return row(c, "advisor", false, "", undefined, calls, before, t0, (e as Error).message);
  }
}

// ---------- plan (plays → plan → consistency) ----------
const humanKey = (k: string) => k.replace(/_/g, " ");

/** The case as a business brief: its inputs are owner-reported facts; nothing else is known. */
function planInput(c: ExpansionCase): AgentInput {
  const budget = Number((c.inputs as Record<string, unknown>).monthly_ad_ceiling_usd ?? NaN);
  const facts = Object.entries(c.inputs).map(([k, v]) => `${humanKey(k)}: ${typeof v === "string" ? v : JSON.stringify(v)} (owner-reported)`);
  const inputs = c.inputs as Record<string, unknown>;
  const slots = Number(inputs.weekly_open_slots ?? NaN);
  const type = LIBRARY_TYPE[c.business_type];
  return {
    task: "",
    brief: [`BUSINESS: Synthetic evaluation case ${c.id} (${humanKey(c.business_type)}). No website; only the owner's inputs below are known.`, `TYPE: ${LIBRARY_TYPE[c.business_type] ?? "unknown"} · CURRENCY: USD`, `GOAL: ${c.task} (horizon 90 days${Number.isFinite(budget) ? `, ad budget ${budget} USD/month ceiling` : ", ad budget not given"})`, `CONFIRMED FACTS:\n${facts.map((f, i) => `[${i}] ${f}`).join("\n")}`].join("\n"),
    facts,
    // As production builds them: evidence kinds from the facts' wording, library type, a local area and delivery limit when the inputs say so.
    constraints: {
      ...(Number.isFinite(budget) ? { monthlyAdBudgetUsd: budget } : {}),
      currency: "USD",
      factKinds: facts.map((f) => evidenceKind(f, "owner_supplied")),
      ...(type ? { businessTypes: [type] } : {}),
      ...(c.business_type === "local_service" ? { serviceArea: "local" } : {}),
      ...(Number.isFinite(slots) ? { newCustomersPerMonth: Math.round(slots * 4.3) } : {}),
    },
  };
}

/** The plan as an owner reads it, for grading. */
function planText(plan: Record<string, unknown>, plays: PlaysOutput): string {
  const p = plan as { summary?: string; diagnosis?: string; positioning?: string; northStar?: { metric: string; target: string }; channels?: { name: string; why: string }[]; experiments?: { name: string; hypothesis: string; method: string; durationDays: number }[]; risks?: { risk: string; mitigation: string }[]; notDoing?: { channel: string; why: string }[]; weekOneChecklist?: string[] };
  return [
    `SUMMARY: ${p.summary ?? ""}`,
    `DIAGNOSIS: ${p.diagnosis ?? ""}`,
    p.northStar ? `NORTH STAR: ${p.northStar.metric}: ${p.northStar.target}` : "",
    `PLAYS:\n${plays.plays.map((x) => `- ${x.name} (${x.kind}): ${(x as { oneLiner?: string }).oneLiner ?? ""}`).join("\n")}`,
    `CHANNELS:\n${(p.channels ?? []).map((x) => `- ${x.name}: ${x.why}`).join("\n")}`,
    `EXPERIMENTS:\n${(p.experiments ?? []).map((x) => `- ${x.name} (${x.method}, ${x.durationDays} days): ${x.hypothesis}`).join("\n")}`,
    `THIS WEEK:\n${(p.weekOneChecklist ?? []).map((x) => `- ${x}`).join("\n")}`,
    `RISKS:\n${(p.risks ?? []).map((x) => `- ${x.risk} → ${x.mitigation}`).join("\n")}`,
    `NOT DOING:\n${(p.notDoing ?? []).map((x) => `- ${x.channel}: ${x.why}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function runPlan(c: ExpansionCase): Promise<ExpansionRow> {
  const t0 = Date.now();
  const before = spentMicros;
  const deps: AgentDeps = { turn, phase: async (_k, _l, fn) => (await fn()).value };
  const basic = <S extends { id: string; models: unknown }>(spec: S): S => ({ ...spec, models: routeModels(spec.id, "basic"), drafts: draftsFor(spec.id, "basic") });
  try {
    const base = planInput(c);
    const playsSpec = basic(growthPlaysSpec({}, playCatalogsFor(LIBRARY_TYPE[c.business_type])));
    const playsRun = await runAgent(playsSpec, { ...base, task: playsTask({ scorecard: "", insights: "(none yet)", horizonDays: 90, engines: platformNotes(base.constraints?.businessTypes ?? []) }), constraints: { ...base.constraints, horizonDays: 90 } }, deps);
    const draft = playsRun.output as PlaysOutput;
    const plays = withForecasts({ ...draft, economics: withDerivedAssumed(draft.economics) }) as PlaysOutput;
    const locked = lockedNumbers(plays, { statement: c.task, target: null, horizonDays: 90 });
    const input: AgentInput = { ...base, task: planTask({ locked, plays, scorecard: "", insights: "(none yet)", horizonDays: 90, engines: platformNotes(base.constraints?.businessTypes ?? []) }), constraints: { ...base.constraints, lockedCustomers: portfolioP50(plays, 90), horizonDays: 90, forecastCustomers: forecastCustomers(plays, 90) } };
    const planRun = await runAgent(basic(strategySpec({})), input, deps);
    const sspec = strategySpec({});
    const plan = (await reconcile({ turn, plan: planRun.output, locked, schema: sspec.schema as never, lint: (o) => sspec.lint?.(o as never, input) ?? [], caps: capsHint(PLAN_CAPS) })).plan as Record<string, unknown>;
    return row(c, "plan", true, planText(plan, plays), { ...plan, plays: plays.plays, economics: plays.economics }, [], before, t0);
  } catch (e) {
    return row(c, "plan", false, "", undefined, [], before, t0, (e as Error).message);
  }
}

function row(c: ExpansionCase, s: ExpansionRow["surface"], ok: boolean, response: string, output: unknown, calls: ExpansionRow["tool_calls"], beforeMicros: number, t0: number, error?: string): ExpansionRow {
  return { case_id: c.id, surface: s, ok, response, ...(output !== undefined ? { output } : {}), ...(error ? { error } : {}), tool_calls: calls, cost_micros: spentMicros - beforeMicros, elapsed_seconds: Math.round((Date.now() - t0) / 100) / 10 };
}

// ---------- main ----------
async function main() {
  const selected = cases.filter((c) => wanted.includes(c.id));
  const jobs: { c: ExpansionCase; s: ExpansionRow["surface"] }[] = [];
  if (surface !== "plan") for (const c of selected) jobs.push({ c, s: "advisor" });
  if (surface !== "advisor") for (const c of selected) if ((PLAN_CASES as readonly string[]).includes(c.id)) jobs.push({ c, s: "plan" });
  const t0 = Date.now();
  console.log(`${jobs.length} runs (${surface}), ${FAKE ? "fake model" : `cap $${maxUsd}`}`);
  const rows = await pool(jobs, concurrency, async (j) => {
    const r = j.s === "advisor" ? await runAdvisor(j.c) : await runPlan(j.c);
    console.log(` ${r.case_id} ${r.surface}: ${r.ok ? "ok" : `FAILED ${r.error}`} (${r.elapsed_seconds}s, $${(r.cost_micros / 1e6).toFixed(3)})`);
    return r;
  });
  let gitRef = "unknown";
  try {
    gitRef = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    /* not a git checkout */
  }
  const fixtures = fixtureIdentity();
  const meta = { label, fake: FAKE, engine_version: ENGINE_VERSION, git_ref: gitRef, fixture_version: fixtures.version, fixture_sha256: fixtures.sha256, climb_model: CLIMB_CONFIG.model, climb_turn: CLIMB_CONFIG.turn, surface, started_at: new Date(t0).toISOString(), elapsed_seconds: Math.round((Date.now() - t0) / 1000), spent_usd: Math.round(spentMicros) / 1e6, cap_usd: maxUsd };
  mkdirSync("bench/results", { recursive: true });
  const file = `bench/results/expansion-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${label}.json`;
  writeFileSync(file, JSON.stringify({ meta, rows }, null, 2));
  console.log(`Spent $${(spentMicros / 1e6).toFixed(2)}${FAKE ? " (fake)" : ""}. Wrote ${file}`);
}

if (process.argv[1]?.endsWith("run.ts")) void main();
