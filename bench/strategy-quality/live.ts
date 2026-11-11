/** Explicitly opt-in capped QA. The local app never loads credentials from this runner. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync, unlinkSync, renameSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import { runAgent } from "../../shared/agents/runtime";
import { ENGINE_VERSION, growthPlaysSpec, socialSpec } from "../../shared/agents/specs";
import { socialPostsTask } from "../../shared/agents/contentTasks";
import { playsTask } from "../../shared/agents/planTasks";
import { modelTurn } from "../../shared/ai/turn";
import { getRateVersion } from "../../shared/economics";
import type { AgentInput } from "../../shared/agents/types";
import { reserveLunaCall, lunaActualMicros } from "./budget";
import { selectStrategyQualityCases } from "./cases";

async function main() {
const { values } = parseArgs({ options: { social: { type: "boolean" }, "confirm-paid": { type: "boolean" }, "retry-failed": { type: "boolean" }, cases: { type: "string" }, "baseline-dir": { type: "string" } } });
if (!values["confirm-paid"] || !process.env.OPENAI_API_KEY) throw new Error("This runner requires --confirm-paid and OPENAI_API_KEY in the environment. Do not put keys in arguments or files.");
if (process.env.CLIMBOS_FAKE_LLM) throw new Error("Remove CLIMBOS_FAKE_LLM before a real-model evaluation.");
const out = resolve("bench/cache/strategy-quality-2026-11-09");
mkdirSync(out, { recursive: true });
const ledgerPath = resolve(out, "budget.json");
const lockPath = resolve(out, "budget.lock");
const lock = openSync(lockPath, "wx", 0o600);
type Receipt = { label: string; reservedMicros: number; chargedMicros: number; actualMicros: number | null; inputTokens: number | null; outputTokens: number | null; status: string };
let ledger: { capMicros: number; receipts: Receipt[] };
try {
  ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : { capMicros: 2_000_000, receipts: [] };
  if (ledger.capMicros !== 2_000_000 || !Array.isArray(ledger.receipts) || !ledger.receipts.every((r) => Number.isSafeInteger(r.chargedMicros) && r.chargedMicros >= 0 && Number.isSafeInteger(r.reservedMicros) && r.reservedMicros >= 0)) throw new Error("Invalid existing evaluation ledger; refusing to reset it.");
} catch (error) { closeSync(lock); unlinkSync(lockPath); throw error; }
const persist = () => { const pending = `${ledgerPath}.pending`; writeFileSync(pending, JSON.stringify(ledger, null, 2), { mode: 0o600 }); renameSync(pending, ledgerPath); };
const spent = () => ledger.receipts.reduce((sum, receipt) => sum + receipt.chargedMicros, 0);
let label = "initialization";
const actualFetch = globalThis.fetch;
// Guard the ACTUAL HTTP boundary, including any future adapter follow-up.
// Price checked 2026-11-09: Luna standard $0.10/$0.50 per 1M input/output,
// cached input $0.01. Reservations cover long-context input at $0.20/M
// and output at $1/M (above the $0.75/M long-context rate), using byte bounds. No tools, background jobs, alternate models or implicit retries.
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url !== "https://api.openai.com/v1/responses" || init?.method !== "POST") throw new Error("QA allows only the official OpenAI Responses text endpoint.");
  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  console.log(`QA request: ${String(body.model)}, output limit ${String(body.max_output_tokens)}, tools ${Boolean(body.tools)}, background ${Boolean(body.background)}.`);
  if (body.model !== "gpt-6-luna" || body.tools || body.background || JSON.stringify(body.input).includes('"type":"input_image"')) throw new Error("QA forbids other models, paid tools and background generation.");
  body.service_tier = "default";
  body.store = false;
  const bytes = Buffer.byteLength(JSON.stringify(body), "utf8") + 16_384;
  const maxOutput = Number(body.max_output_tokens);
  console.log(`QA input byte bound: ${bytes}.`);
  const reservedMicros = reserveLunaCall(bytes, maxOutput, spent());
  const receipt: Receipt = { label, reservedMicros, chargedMicros: reservedMicros, actualMicros: null, inputTokens: null, outputTokens: null, status: "reserved" };
  ledger.receipts.push(receipt);
  persist();
  try {
    const response = await actualFetch(url, { ...init, body: JSON.stringify(body) });
    const data = await response.clone().json().catch(() => null) as { usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } } } | null;
    if (data) writeFileSync(resolve(out, `response-${ledger.receipts.length}-${label.replaceAll("/", "-")}.json`), JSON.stringify(data, null, 2));
    const usage = data?.usage;
    const actual = usage ? lunaActualMicros(usage.input_tokens!, usage.output_tokens!, usage.input_tokens_details?.cached_tokens ?? 0) : null;
    if (actual !== null) {
      const actualMicros = actual;
      receipt.inputTokens = usage!.input_tokens!; receipt.outputTokens = usage!.output_tokens!;
      receipt.actualMicros = actualMicros; receipt.chargedMicros = Math.max(0, actualMicros);
      receipt.status = response.ok ? "completed" : "failed_with_usage";
      if (actualMicros > reservedMicros) throw new Error("Provider usage exceeded the reserved envelope; stopping QA.");
    } else if (response.status >= 400 && response.status < 500) {
      receipt.actualMicros = 0; receipt.chargedMicros = 0; receipt.status = `rejected_${response.status}`;
    } else receipt.status = "unknown_usage_hold_retained";
    persist();
    return response;
  } catch (error) {
    if (receipt.status === "reserved") receipt.status = "network_uncertainty_hold_retained";
    persist();
    throw error;
  }
};

try {
  const variants = [{ name: "current", spec: growthPlaysSpec, task: playsTask, run: runAgent, version: ENGINE_VERSION }];
  if (values["baseline-dir"]) {
    const root = resolve(values["baseline-dir"]);
    const load = async (path: string) => { const loadedModule = await import(pathToFileURL(resolve(root, path)).href); return loadedModule.default ?? loadedModule; };
    const oldSpecs = await load("shared/agents/specs.ts") as { growthPlaysSpec: typeof growthPlaysSpec; ENGINE_VERSION: string };
    const oldTasks = await load("shared/agents/planTasks.ts") as { playsTask: typeof playsTask };
    const oldRuntime = await load("shared/agents/runtime.ts") as { runAgent: typeof runAgent };
    variants.unshift({ name: "baseline", spec: oldSpecs.growthPlaysSpec, task: oldTasks.playsTask, run: oldRuntime.runAgent, version: oldSpecs.ENGINE_VERSION });
  }
  const sourceHashes = new Map(variants.map((variant) => {
    const root = variant.name === "baseline" ? resolve(values["baseline-dir"]!) : resolve(".");
    const files = ["shared/agents/runtime.ts", "shared/agents/specs.ts", "shared/agents/planTasks.ts", "shared/agents/planningCycles.ts", "shared/agents/channelJudgment.ts", "shared/skills/generated.ts", "shared/knowledge/creativePrecedents.ts", "shared/knowledge/creativePrecedentExpansion.ts"];
    return [variant.name, createHash("sha256").update(files.filter((f) => existsSync(resolve(root, f))).map((f) => readFileSync(resolve(root, f), "utf8")).join("\n")).update(readFileSync(resolve("shared/ai/openai.ts"), "utf8")).digest("hex")];
  }));
  const socialSourceHash = createHash("sha256").update(["shared/agents/runtime.ts", "shared/agents/specs.ts", "shared/agents/contentTasks.ts", "shared/ai/openai.ts", "shared/skills/generated.ts"].map((file) => readFileSync(resolve(file), "utf8")).join("\n")).digest("hex");
  evaluation: for (const item of selectStrategyQualityCases(values.cases).filter(() => !values.social)) for (const variant of variants) {
    label = `${item.id}/${variant.name}`;
    const fingerprint = createHash("sha256").update(JSON.stringify({ case: item.id, brief: item.brief, research: item.research, engine: variant.version, testCurrency: "USD", contextVersion: 4, businessWebsite: item.businessWebsite ?? null, sourceHash: sourceHashes.get(variant.name) })).digest("hex").slice(0, 12);
    const path = resolve(out, `${item.id}-${variant.name}-${fingerprint}.json`);
    if (existsSync(path) && (!values["retry-failed"] || !JSON.parse(readFileSync(path, "utf8")).error)) { console.log(`Keeping saved ${label}; no repeated call.`); continue; }
    const spec = variant.spec({ maxRevisions: 1 });
    spec.drafts = 1;
    const input: AgentInput = { task: variant.task({ scorecard: "No scored channel evidence supplied. Investigate fit; library priors are not customer evidence.", insights: item.research.notes, horizonDays: 90 }), brief: `${item.brief}\nEvaluation setup only: use USD for amounts, a 90-day horizon and zero ad budget. These are synthetic comparison constraints, not claims about the real owner's location or finances. Customer value, margin, retention, owner time and demand remain unknown unless supplied above.`, facts: item.facts, ...(item.businessWebsite ? { businessWebsite: item.businessWebsite } : {}), availableSourceUrls: item.research.sources.map((source) => source.url), precomputedResearch: item.research, constraints: { monthlyAdBudgetUsd: 0, horizonDays: 90, currency: "USD", businessTypes: [item.businessType] } };
    console.log(`Running ${label}; budget used/held $${(spent() / 1e6).toFixed(4)}.`);
    try {
      const result = await variant.run(spec, input, { turn: (req) => modelTurn({ ...req, timeoutMs: 180_000 }, getRateVersion("verified-2026-10-17")), phase: async (_key, _label, fn) => (await fn()).value, beforeRevision: async () => spent() < 1_800_000 });
      writeFileSync(path, JSON.stringify({ caseId: item.id, variant: variant.name, engine: variant.version, model: "gpt-6-luna", sourceHash: sourceHashes.get(variant.name), input, evidence: input.precomputedResearch, result, schemaPassed: spec.schema.safeParse(result.output).success, reviewedBy: "production AI critic; independent owner review pending", limits: "One draft and at most one revision; frozen evidence; no live discovery or execution." }, null, 2));
      console.log(`Saved ${label}: schema ${spec.schema.safeParse(result.output).success}; critic ship ${result.assessment?.ship}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "QA failed";
      writeFileSync(path, JSON.stringify({ caseId: item.id, variant: variant.name, engine: variant.version, error: message, budgetUsedOrHeldMicros: spent() }, null, 2));
      console.log(`Saved failure for ${label}: ${message.slice(0, 180)}`);
      if (message.includes("BUDGET") || message.includes("reserved envelope") || message.includes("could not be reached")) break evaluation;
    }
  }
  if (values.social) for (const channel of ["linkedin", "instagram", "facebook", "x", "tiktok", "pinterest", "youtube"]) {
    label = `social/${channel}`;
    const spec = socialSpec([channel], { maxRevisions: 1 });
    spec.drafts = 1;
    const facts = ["Synthetic owner confirms the repair kit contains replacement hinge screws and a printed fitting guide.", "Synthetic owner confirms a screwdriver is required and is not included.", "Synthetic owner confirms the kit fits only the hinge models listed in its guide; compatibility must be checked before ordering."];
    const input: AgentInput = { task: socialPostsTask({ quantity: 2, channels: [channel], request: "Show a concrete repair situation and a useful compatibility check. Make the two angles distinct. No sales, reviews, outcomes, discounts or urgency claims are supplied.", plan: "Synthetic approved direction for this evaluation only: help a homeowner decide whether a compatible loose-hinge repair is possible before replacing the whole item. CTA: read the fitting guide. No customer outcome or traffic data exists." }), brief: "SYNTHETIC QA BUSINESS: a household repair-kit shop with a fitting guide. Zero ad budget. Audience size, images, price, margins, tracking and posting permission are unknown. Write editable drafts only.", facts, constraints: { factKinds: ["owner", "owner", "owner"], currency: "USD", monthlyAdBudgetUsd: 0 }, precomputedResearch: { notes: "No current trend research or external customer evidence. Use evergreen ideas and the supplied synthetic facts only.", sources: [] } };
    const fingerprint = createHash("sha256").update(JSON.stringify({ channel, input, engine: ENGINE_VERSION, sourceHash: socialSourceHash })).digest("hex").slice(0, 12);
    const path = resolve(out, `social-${channel}-${fingerprint}.json`);
    if (existsSync(path) && (!values["retry-failed"] || !JSON.parse(readFileSync(path, "utf8")).error)) { console.log(`Keeping saved ${label}.`); continue; }
    try {
      console.log(`Running ${label}; budget used/held $${(spent() / 1e6).toFixed(4)}.`);
      const result = await runAgent(spec, input, { turn: (req) => modelTurn({ ...req, timeoutMs: 180_000 }, getRateVersion("verified-2026-10-17")), phase: async (_key, _label, fn) => (await fn()).value, beforeRevision: async () => spent() < 1_850_000 });
      writeFileSync(path, JSON.stringify({ suite: "social", channel, engine: ENGINE_VERSION, sourceHash: socialSourceHash, model: "gpt-6-luna", input, result, schemaPassed: spec.schema.safeParse(result.output).success, reviewedBy: "production AI critic; independent owner review pending", limits: "Synthetic facts; no images, trends, audience, publishing or real outcome evidence." }, null, 2));
      console.log(`Saved ${label}: schema true; critic ship ${result.assessment?.ship}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Social QA failed";
      writeFileSync(path, JSON.stringify({ suite: "social", channel, engine: ENGINE_VERSION, error: message, budgetUsedOrHeldMicros: spent() }, null, 2));
      console.log(`Saved failure for ${label}: ${message.slice(0, 180)}`);
      if (message.includes("BUDGET") || message.includes("reserved envelope") || message.includes("could not be reached")) break;
    }
  }
  console.log(`QA complete. Cumulative used/held: $${(spent() / 1e6).toFixed(6)} of $2. Receipts: ${ledgerPath}`);
} finally {
  globalThis.fetch = actualFetch;
  closeSync(lock); unlinkSync(lockPath);
}
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : "QA failed."); process.exitCode = 1; });
