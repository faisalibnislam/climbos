"use node";

import { AsyncLocalStorage } from "node:async_hooks";
import { checkProspects } from "./ai/prospectCheck";
import { downloadVeo, pollVeo, startVeo } from "./ai/veo";
import type { FunctionArgs, FunctionReference } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";
import { CURRENT_ROUTING, getRateVersion } from "../shared/economics";
import type { ModelKey } from "../shared/economics/rates";
import { estimateTokens, MODEL_SPECS, runtimeModel, VIDEO_ROUTE } from "../shared/ai/models";
import {
  type AdDraftsOutput,
  type BusinessInsights,
  type BusinessProfile,
  type ChatIntentOutput,
  type EmailSequenceOutput,
  factsBlock,
  stripFactMarkers,
  type SeoBriefOutput,
  type SocialPostsOutput,
  type StrategyOutput,
  systemPrompt,
  TASKS,
  type TaskType,
  untrusted,
} from "../shared/ai/tasks";
import { internal } from "./_generated/api";
import { claudeUsageRecords } from "./lib/usage";
import type { Doc, Id } from "./_generated/dataModel";
import { type ActionCtx, internalAction } from "./_generated/server";
import { fixtureOutput, type FixtureContext } from "./ai/fixtures";
import { callModel, generateImage, type ModelResult } from "./ai/providers";
import { researchWebsite } from "./ai/research";
import { r2Configured, r2Key, r2Put } from "./lib/r2";
import { adsToArtifacts, emailToArtifacts, seoToArtifacts, socialToArtifacts } from "./jobWrites";
import { AgentFailure, AgentYield, runAgent, type AgentDeps } from "../shared/agents/runtime";
import { type TurnResult } from "../shared/ai/types";
import { modelTurn, providerOf } from "../shared/ai/turn";
import { CALL_ROUTES, draftsFor, routeModels } from "../shared/agents/routes";
import { CLIMBOS_ENGINES } from "../shared/agents/capacity";
import { reconcile } from "../shared/agents/consistency";
import { lockedNumbers } from "../shared/agents/economics";
import { capsHint, PLAN_CAPS, PLAYS_CAPS } from "../shared/agents/wordCaps";
import {
  adsSpec,
  conversionAuditSpec,
  emailSpec,
  insightsSpec,
  channelFitSpec,
  outreachSpec,
  creatorScoutSpec,
  prospectingSpec,
  researchFor,
  retentionSpec,
  salesSpec,
  seoSpec,
  growthPlaysSpec,
  playCatalogsFor,
  socialCalendarSpec,
  socialSpec,
  strategySpec,
  type ChannelFit,
  type OutreachOutput,
  type PlaysOutput,
  type ProspectsOutput,
  type SocialCalendar,
} from "../shared/agents/specs";
import { fixtureCalendar } from "../shared/autopilot/fixture";
import { fixtureOutbound } from "../shared/outbound";
import { BUSINESS_TYPES, budgetBand, LIBRARY_VERSION, typesFromLegacy } from "../shared/acquisition/library";
import { adjustmentsFrom, candidatesFor, DIMENSIONS, FACTORS, mergeFit, profileFrom, scoreChannels, scorecardText, type Adjustment, type SavedAcquisition } from "../shared/acquisition/scoring";
import type { AgentInput, AgentSpec } from "../shared/agents/types";
import { fakeTurn } from "../shared/agents/fake";
import { agentRevisionSteps } from "./lib/jobPlans";
import { estimateRun } from "./engine";
import { usdToMicrosCeil } from "../shared/economics/money";
import type { RateVersion } from "../shared/economics/rates";

class JobStop extends Error {
  constructor(
    public reason: string,
    public userMessage: string,
  ) {
    super(reason);
  }
}

type JobCtx = NonNullable<Awaited<ReturnType<typeof loadContext>>>;

async function loadContext(ctx: ActionCtx, runId: Id<"workflowRuns">) {
  return ctx.runQuery(internal.jobWrites.jobContext, { runId });
}

const STOP_MESSAGES: Record<string, string> = {
  paused: "Activity is paused, so this job stopped before doing anything else.",
  canceled: "This job was canceled.",
  step_budget: "This job reached its step limit. Try a smaller request.",
  repair_budget: "The AI's answer didn't pass our checks, and the retry limit was reached. Nothing was saved.",
  research_budget: "This job reached its research limit.",
  uncertain: "We couldn't confirm the outcome of a previous attempt, so we stopped to avoid doing it twice.",
};

/** Begin a checkpointed step. Returns the stored output if it already completed. */
async function begin(
  ctx: ActionCtx,
  runId: Id<"workflowRuns">,
  index: number,
  kind: "model" | "research" | "image" | "provider_write" | "compute",
  label: string,
  role?: Doc<"workflowSteps">["role"],
  isRepair = false,
) {
  const b = await ctx.runMutation(internal.engine.beginStep, { runId, index, kind, label, role, isRepair });
  if (b.reason === "checkpoint") return { checkpoint: JSON.parse(b.checkpoint ?? "null") as unknown, stepId: b.stepId! };
  if (!b.proceed) throw new JobStop(b.reason, STOP_MESSAGES[b.reason] ?? "This job stopped.");
  return { checkpoint: undefined, stepId: b.stepId };
}

function usageRecord(provider: string, model: string, r: ModelResult) {
  const usage = r.usage ?? { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 };
  const records = [
    {
      type: "model_call" as const,
      provider,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.reasoningTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      quantity: 1,
      costMicros: r.ok ? r.costMicros : r.costMicros,
      estimated: false,
    },
  ];
  if (r.ok && r.searchCostMicros > 0) {
    records.push({ ...records[0], type: "search_call" as never, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: usage.webSearches, costMicros: r.searchCostMicros });
  }
  return records;
}

/** Fit untrusted context into the step's input budget. */
function clipToBudget(system: string, task: string, context: string, inputBudget: number): string {
  const fixed = estimateTokens(system + task) + 200;
  const allowedTokens = Math.max(500, inputBudget - fixed);
  const allowedChars = Math.floor((allowedTokens * 4) / 1.1);
  return context.length > allowedChars ? context.slice(0, allowedChars) : context;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Run one model task with schema validation, at most one repair, and a
 * cross-provider fallback that must reserve its own worst-case cost first.
 */
async function runModelTask<T>(
  ctx: ActionCtx,
  job: JobCtx,
  index: number,
  taskType: TaskType,
  taskText: string,
  untrustedContext: string,
  fixture: FixtureContext,
): Promise<T> {
  const task = TASKS[taskType];
  const { run } = job;
  const step = await begin(ctx, run._id, index, "model", task.label, task.role);
  if (step.checkpoint !== undefined) return step.checkpoint as T;
  const stepId = step.stepId!;

  if (run.isFixture) {
    const output = task.schema.parse(fixtureOutput(taskType, fixture)) as T;
    await ctx.runMutation(internal.engine.recordUsage, {
      stepId,
      records: [{ type: "model_call", provider: "fixture", model: "demo-fixture", inputTokens: estimateTokens(taskText + untrustedContext), outputTokens: estimateTokens(JSON.stringify(output)), reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: 0, estimated: true }],
    });
    await ctx.runMutation(internal.engine.completeStep, { stepId, output: JSON.stringify(output) });
    return output;
  }

  const rates = getRateVersion(run.rateVersionId);
  const roleRoute = CURRENT_ROUTING.routes[task.role];
  const route = { primary: (task.type === "chat_intent" ? CALL_ROUTES.chat_intent : task.primaryModel) ?? runtimeModel(roleRoute.primary) };
  const system = systemPrompt(task.role);
  const user = `${taskText}\n\n${clipToBudget(system, taskText, untrustedContext, task.inputBudget)}`;
  const searches = (m: ModelKey) => (task.allowWebSearch && MODEL_SPECS[m].provider === "openai" ? 2 : 0);

  const attempt = async (modelKey: ModelKey, extra = "", usageStepId: Id<"workflowSteps"> = stepId): Promise<ModelResult> => {
    const circuit = await ctx.runQuery(internal.circuits.circuitState, { provider: MODEL_SPECS[modelKey].provider });
    if (circuit === "open") return { ok: false, kind: "provider_unavailable", message: "Provider temporarily disabled after repeated failures.", costMicros: 0 };
    let res = await callModel({ modelKey, system, user: user + extra, schema: task.schema, inputBudget: task.inputBudget, outputBudget: task.outputBudget, webSearches: searches(modelKey) }, rates);
    if (!res.ok && res.kind === "rate_limited" && (res.retryAfterMs ?? 0) <= 10_000) {
      await sleep((res.retryAfterMs ?? 3000) + Math.floor(Math.random() * 1000));
      res = await callModel({ modelKey, system, user: user + extra, schema: task.schema, inputBudget: task.inputBudget, outputBudget: task.outputBudget, webSearches: searches(modelKey) }, rates);
    }
    await ctx.runMutation(internal.engine.recordUsage, { stepId: usageStepId, records: usageRecord(MODEL_SPECS[modelKey].provider, res.ok ? res.actualModelId : MODEL_SPECS[modelKey].apiModelId, res) });
    if (res.ok || res.kind === "invalid_output" || res.kind === "refused") {
      await ctx.runMutation(internal.circuits.recordProviderResult, { provider: MODEL_SPECS[modelKey].provider, ok: true });
    } else if (res.kind === "provider_error" || res.kind === "timeout" || res.kind === "spend_limit") {
      await ctx.runMutation(internal.circuits.recordProviderResult, { provider: MODEL_SPECS[modelKey].provider, ok: false, billing: res.kind === "spend_limit", reason: res.message.slice(0, 120) });
    }
    return res;
  };

  let res = await attempt(route.primary);
  if (!res.ok && res.kind === "invalid_output") {
    // One repair, counted against the run's repair budget and recorded as its own step.
    let repair: Awaited<ReturnType<typeof begin>>;
    try {
      repair = await begin(ctx, run._id, index + 1000, "model", `${task.label} (repair)`, task.role, true);
    } catch (e) {
      await ctx.runMutation(internal.engine.failStep, { stepId, error: `${res.kind}: ${res.message}` });
      throw e;
    }
    if (repair.checkpoint !== undefined) {
      // Repair already finished before a restart: reuse its saved answer (its cost was recorded then).
      res = {
        ok: true,
        provider: MODEL_SPECS[route.primary].provider,
        actualModelId: MODEL_SPECS[route.primary].apiModelId,
        output: repair.checkpoint,
        rawText: "",
        usage: { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 },
        costMicros: 0,
        searchCostMicros: 0,
        finishReason: "checkpoint",
        sourceUrls: [],
      };
    } else {
      // A cut-off answer can't be fixed by asking again at the same length, so ask for a shorter one.
      const hint = /cut off/i.test(res.message)
        ? "Your previous answer was too long and was cut off. Answer again, much more briefly: keep each text field to one or two short sentences and use only as many list items as the schema requires."
        : `Your previous answer failed validation: ${res.message}. Return only valid JSON matching the schema.`;
      res = await attempt(route.primary, `\n\n${hint}`, repair.stepId!);
      if (res.ok) await ctx.runMutation(internal.engine.completeStep, { stepId: repair.stepId!, output: JSON.stringify(res.output) });
      else await ctx.runMutation(internal.engine.failStep, { stepId: repair.stepId!, error: `${res.kind}: ${res.message}` });
    }
  }
  if (!res.ok) {
    await ctx.runMutation(internal.engine.failStep, { stepId, error: `${res.kind}: ${res.message}` });
    const message =
      res.kind === "provider_unavailable" || res.kind === "spend_limit"
        ? "Our AI provider isn't available right now. Your progress is saved: retry in a few minutes to continue."
        : res.kind === "refused"
          ? "The AI declined this request. Try rephrasing it."
          : res.kind === "invalid_output"
            ? "The AI's answer didn't pass our quality checks. Nothing was saved."
            : "The AI service had a problem. Nothing was saved; please try again.";
    throw new JobStop(res.kind, message);
  }
  const output = stripFactMarkers(res.output);
  await ctx.runMutation(internal.engine.completeStep, { stepId, output: JSON.stringify(output) });
  return output as T;
}

/* ------------------------------------------------------------------ */
/* Engine v2: expert agents (research → draft → critique → revise)      */
/* ------------------------------------------------------------------ */

/** Each action stops starting new agent phases after this long and resumes in a fresh action. */
// Low enough that a step started just before it (≤4 min turn timeout) still ends inside Convex's 10-minute action limit.
const ACTION_SOFT_LIMIT_MS = 4.5 * 60_000;
function softLimitMs(): number {
  const override = Number(process.env.CLIMBOS_AGENT_SOFT_LIMIT_MS);
  return Number.isFinite(override) && override > 0 ? override : ACTION_SOFT_LIMIT_MS;
}

const AGENT_FAILURES: Record<string, string> = {
  provider_unavailable: "Our AI provider isn't available right now. Your progress is saved: retry in a few minutes to continue.",
  spend_limit: "Our AI provider isn't available right now. Your progress is saved: retry in a few minutes to continue.",
  refused: "The AI declined this request. Try rephrasing it.",
  invalid_output: "The AI's answer didn't pass our quality checks. Nothing was saved.",
};


/**
 * Run one Engine v2 agent inside a job. Every phase is a checkpointed,
 * metered workflow step; a resumed action skips finished phases. Demo
 * workspaces keep using fixtures through the v1 path.
 */
async function runAgentTask<T>(
  ctx: ActionCtx,
  job: JobCtx,
  baseIndex: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: AgentSpec<any>,
  input: AgentInput,
  startedAt: number,
  fixture: { task: TaskType; text: string; context: string; ctx: FixtureContext },
  meta?: { shipped?: boolean | null },
): Promise<T> {
  if (job.run.isFixture || job.run.engine !== "v2") {
    return runModelTask<T>(ctx, job, baseIndex, fixture.task, fixture.text, fixture.context, fixture.ctx);
  }
  // Climb AI Expert (paid): Sol drafts this agent's work when it's one of the expert agents.
  // Engine lab: rules approved in /ops join this agent's playbook.
  const addendum: string = await ctx.runQuery(internal.engineLab.addendumFor, { agentId: spec.id });
  if (addendum) spec = { ...spec, addendum };
  if (job.run.aiMode === "expert") spec = { ...spec, models: routeModels(spec.id, "expert") };
  // Climb AI Basic: best of two drafts for the strategy agents.
  else if (draftsFor(spec.id, "basic") > 1) spec = { ...spec, drafts: draftsFor(spec.id, "basic") };
  const rates = getRateVersion(job.run.rateVersionId);
  // Each phase runs in its own async context, so parallel phases (best-of-two) meter to their own step.
  const stepScope = new AsyncLocalStorage<Id<"workflowSteps">>();
  // Shared across every agent in this action: yield only after real progress.
  const tracker = ((job as unknown as { __progress?: { did: boolean } }).__progress ??= { did: false });
  const deps: AgentDeps = {
    deadline: startedAt + softLimitMs(),
    progressed: () => tracker.did,
    beforeRevision: async (round) => {
      // Idempotent per round: a compute step marks that this round's cost was reserved.
      const mark = await begin(ctx, job.run._id, baseIndex + 60 + round, "compute", `${spec.label}: reserve revision ${round}`, spec.role);
      if (mark.checkpoint !== undefined) return Boolean(mark.checkpoint);
      const cost = estimateRun(agentRevisionSteps(spec), job.run.rateVersionId, { repair: false }).costMicros;
      const reserved = await ctx.runMutation(internal.engine.reserveAdditional, { runId: job.run._id, costMicros: cost });
      await ctx.runMutation(internal.engine.completeStep, { stepId: mark.stepId!, output: JSON.stringify(reserved.ok) });
      return reserved.ok;
    },
    turn: async (req) => {
      const call = process.env.CLIMBOS_FAKE_LLM ? fakeTurn : modelTurn;
      // One provider attempt (with a short rate-limit retry), metered and fed to that provider's circuit.
      const attemptOn = async (modelKey: ModelKey) => {
        const provider = providerOf(modelKey);
        const circuit = await ctx.runQuery(internal.circuits.circuitState, { provider });
        if (circuit === "open") {
          return { ok: false, kind: "provider_unavailable", message: "Provider temporarily disabled after repeated failures.", usage: { inputTokens: 0, outputTokens: 0, thinkingTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, webFetches: 0, calls: 0 }, costMicros: 0, appended: [] } as TurnResult;
        }
        // Long OpenAI turns (Sol drafts, big outputs) run in background mode: if this action's time runs out,
        // the job yields and the next action keeps polling the same answer (no rerun, no double charge).
        const stepId = stepScope.getStore() ?? null;
        const background = provider === "openai" && !process.env.CLIMBOS_FAKE_LLM && (modelKey === "gpt-6.1-sol" || req.maxTokens >= 24_000);
        const ref = background && stepId ? await ctx.runQuery(internal.engine.stepProviderRef, { stepId }) : null;
        const q = {
          ...req,
          modelKey,
          ...(background
            ? {
                background: {
                  resumeResponseId: ref ?? undefined,
                  pollUntil: startedAt + 8.5 * 60_000,
                  onStarted: async (id: string) => {
                    if (stepId) await ctx.runMutation(internal.engine.setStepProviderRef, { stepId, ref: id });
                  },
                },
              }
            : {}),
        };
        let r = await call(q, rates);
        if (!r.ok && r.kind === "pending") throw new AgentYield();
        // A failed background answer can't be resumed: the next attempt starts fresh.
        if (!r.ok && ref && stepId) await ctx.runMutation(internal.engine.setStepProviderRef, { stepId, ref: undefined });
        if (!r.ok && r.kind === "rate_limited" && (r.retryAfterMs ?? 0) <= 15_000) {
          await sleep((r.retryAfterMs ?? 3000) + Math.floor(Math.random() * 1000));
          r = await call(q, rates);
        }
        if (stepId && (r.usage.calls > 0 || r.costMicros > 0)) {
          await ctx.runMutation(internal.engine.recordUsage, { stepId, records: claudeUsageRecords(modelKey, r, rates) });
        }
        const healthy = r.ok || ["invalid_output", "refused"].includes(r.kind);
        if (healthy || ["provider_error", "timeout", "spend_limit"].includes(r.ok ? "" : r.kind)) {
          await ctx.runMutation(internal.circuits.recordProviderResult, { provider, ok: healthy, billing: !r.ok && r.kind === "spend_limit", reason: r.ok ? undefined : r.message.slice(0, 120) });
        }
        return r;
      };
      // No fallback model: an outage stops the job with its progress saved (Retry continues it).
      return attemptOn(req.modelKey);
    },
    phase: async (key, label, fn) => {
      const step = await begin(ctx, job.run._id, baseIndex + key.index, "model", label, spec.role);
      if (step.checkpoint !== undefined) return step.checkpoint as never;
      const stepId = step.stepId!;
      tracker.did = true;
      return stepScope.run(stepId, async () => {
        try {
          const { value } = await fn();
          await ctx.runMutation(internal.engine.completeStep, { stepId, output: JSON.stringify(value) });
          return value;
        } catch (e) {
          // Yielding mid-turn keeps the step running; the next action resumes it.
          if (!(e instanceof AgentYield)) await ctx.runMutation(internal.engine.failStep, { stepId, error: (e as Error).message.slice(0, 400) });
          throw e;
        }
      });
    },
  };
  try {
    const result = await runAgent(spec, input, deps);
    if (meta) meta.shipped = result.assessment?.ship ?? null;
    return result.output as T;
  } catch (e) {
    if (e instanceof AgentYield) throw e;
    if (e instanceof AgentFailure) throw new JobStop(e.kind, AGENT_FAILURES[e.kind] ?? "The AI service had a problem. Nothing was saved; please try again.");
    throw e;
  }
}

/** The approved positioning and customer language, so content carries the plan. */
function planContext(job: JobCtx): string {
  const insights = job.business?.insights as (Record<string, unknown> & { positioning?: string }) | undefined;
  if (!insights) return "";
  const pick = (k: string) => (insights[k] ? `${k}: ${JSON.stringify(insights[k]).slice(0, 3000)}` : "");
  return `\n\nPOSITIONING AND CUSTOMER LANGUAGE (from research):\n${[pick("positioningStatement") || pick("positioning"), pick("vocPhrases"), pick("objections"), pick("audiences")].filter(Boolean).join("\n")}`;
}

function agentInput(job: JobCtx, task: string, extra: Partial<AgentInput> = {}): AgentInput {
  return { task, brief: businessBrief(job), facts: job.facts.map((f) => f.statement), ...extra };
}

function fixtureCtx(job: JobCtx, extra: Partial<FixtureContext> = {}): FixtureContext {
  return {
    businessName: job.business?.name ?? job.org.name,
    website: job.business?.website,
    facts: job.facts,
    goal: job.goal?.statement,
    ...extra,
  };
}

function businessBrief(job: JobCtx): string {
  const b = job.business;
  return [
    `BUSINESS: ${b?.name ?? job.org.name}${b?.website ? ` (${b.website})` : ""}`,
    b?.summary ? `SUMMARY: ${b.summary}` : "",
    `TYPE: ${b?.businessType ?? "unknown"} · CURRENCY: ${b?.currency ?? job.org.currency} · TIMEZONE: ${b?.timezone ?? job.org.timezone}`,
    job.goal ? `GOAL: ${job.goal.statement} (horizon ${job.goal.horizonDays} days, ad budget ${(job.goal.monthlyAdBudgetMinor / 100).toFixed(0)} ${job.goal.currency}/month, paid directly to ad platforms)` : "",
    job.brand ? `BRAND VOICE: ${job.brand.voice}${job.brand.toneWords.length ? ` (${job.brand.toneWords.join(", ")})` : ""}. Avoid: ${job.brand.doNots.join("; ")}` : "",
    job.brand?.learnedRules?.length ? `HOW THE OWNER EDITS DRAFTS (follow these): ${job.brand.learnedRules.map((r) => r.text).join("; ")}` : "",
    job.org.contentLanguage && job.org.contentLanguage !== "English" ? `LANGUAGE: write every customer-facing word (posts, emails, ads, pages) in ${job.org.contentLanguage}. Notes to the owner stay in English.` : "",
    factsBlock(job.facts),
  ]
    .filter(Boolean)
    .join("\n");
}

async function finish(
  ctx: ActionCtx,
  runId: Id<"workflowRuns">,
  status: "verified" | "failed",
  extra: { output?: unknown; userMessage?: string; error?: string; meters?: Record<string, number> } = {},
) {
  await ctx.runMutation(internal.engine.finishRun, {
    runId,
    status,
    output: extra.output === undefined ? undefined : JSON.stringify(extra.output),
    userMessage: extra.userMessage,
    error: extra.error,
    meters: extra.meters,
  });
}

type ResumableJob = "onboardingResearch" | "buildStrategy" | "createContent" | "planSocialWeek" | "findCustomers" | "conversionAudit" | "simplePlanJob" | "makeReel";
interface Resume {
  fn: ResumableJob;
  args: Record<string, unknown>;
  run: () => Promise<unknown>;
}

/** How to continue a run in a fresh action (after a yield, an interruption or an owner retry). */
function resumeAs<F extends ResumableJob>(ctx: ActionCtx, fn: F, args: FunctionArgs<(typeof internal.jobs)[F]>): Resume {
  const ref = internal.jobs[fn] as unknown as FunctionReference<"action", "internal">;
  return { fn, args: args as Record<string, unknown>, run: () => ctx.scheduler.runAfter(0, ref, args as Record<string, unknown>) };
}

async function guarded(
  ctx: ActionCtx,
  runId: Id<"workflowRuns">,
  body: () => Promise<void>,
  onFail?: (msg: string) => Promise<void>,
  resume?: Resume,
) {
  if (resume) await ctx.runMutation(internal.engine.noteResume, { runId, fn: resume.fn, args: JSON.stringify(resume.args) });
  try {
    await body();
  } catch (e) {
    // Engine v2: an agent stopped before the action time limit. Completed phases
    // are checkpoints, so a fresh action picks up where this one left off.
    if (e instanceof AgentYield && resume) {
      await resume.run();
      return;
    }
    const msg = e instanceof JobStop ? e.userMessage : "Something went wrong. Nothing was published; you can try again.";
    await finish(ctx, runId, "failed", { userMessage: msg, error: (e as Error).message?.slice(0, 300) });
    if (onFail) await onFail(msg);
  }
}

/* ------------------------------------------------------------------ */
/* Quick first take (speed): a fast Luna answer while the full job works  */
/* ------------------------------------------------------------------ */

const QuickTakeSchema = z.object({ headline: z.string(), points: z.array(z.string()) });

/**
 * One fast, cheap model call (Luna, low effort, no research) that gives the
 * owner a useful first take within about a minute. Checkpointed and metered
 * like any step; failures are ignored (the full job still runs).
 */
/** Checkpointed, metered consistency pass; on any failure the plan is kept as written. */
async function consistencyStep(ctx: ActionCtx, job: JobCtx, index: number, plan: StrategyOutput, locked: string): Promise<StrategyOutput> {
  // The fake model can't edit meaningfully; tests keep the plan as written.
  if (job.run.isFixture || job.run.engine !== "v2" || process.env.CLIMBOS_FAKE_LLM) return plan;
  const step = await begin(ctx, job.run._id, index, "model", "Growth plan: consistency check", "ceo");
  if (step.checkpoint !== undefined) return step.checkpoint as StrategyOutput;
  const rates = getRateVersion(job.run.rateVersionId);
  const call = process.env.CLIMBOS_FAKE_LLM ? fakeTurn : modelTurn;
  const spec = strategySpec();
  try {
    const out = await reconcile({
      turn: async (req) => {
        const r = await call(req, rates);
        if (r.usage.calls > 0) await ctx.runMutation(internal.engine.recordUsage, { stepId: step.stepId!, records: claudeUsageRecords(req.modelKey, r, rates) });
        return r;
      },
      plan,
      locked,
      schema: spec.schema as never,
      lint: (o) => spec.lint?.(o as never, { task: "", brief: "", facts: [] }) ?? [],
      caps: capsHint(PLAN_CAPS),
    });
    await ctx.runMutation(internal.engine.completeStep, { stepId: step.stepId!, output: JSON.stringify(out.plan) });
    return out.plan as StrategyOutput;
  } catch (e) {
    await ctx.runMutation(internal.engine.failStep, { stepId: step.stepId!, error: (e as Error).message.slice(0, 200) });
    return plan;
  }
}

async function quickTake(ctx: ActionCtx, job: JobCtx, index: number, label: string, task: string) {
  if (job.run.isFixture || job.run.engine !== "v2" || process.env.CLIMBOS_FAKE_LLM) return;
  try {
    const step = await begin(ctx, job.run._id, index, "model", label, "ceo");
    if (step.checkpoint !== undefined) return;
    const rates = getRateVersion(job.run.rateVersionId);
    const r = await modelTurn(
      {
        modelKey: CALL_ROUTES.chat_intent,
        system: [{ text: "You are a senior growth advisor writing a fast first take for a small-business owner. Be specific to this business, plain and brief. No invented numbers; say 'assumption' where you estimate." }],
        messages: [{ role: "user", content: `${businessBrief(job)}\n\n${task}\n\nReturn JSON: headline (one sentence) and 3-5 points (each one short sentence).` }],
        schema: QuickTakeSchema,
        maxTokens: 3_000,
        effort: "low",
        thinkingOff: true,
        timeoutMs: 60_000,
      },
      rates,
    );
    if (r.usage.calls > 0) await ctx.runMutation(internal.engine.recordUsage, { stepId: step.stepId!, records: claudeUsageRecords(CALL_ROUTES.chat_intent, r, rates) });
    if (r.ok) {
      const out = r.output as z.infer<typeof QuickTakeSchema>;
      await ctx.runMutation(internal.engine.setRunPreview, { runId: job.run._id, preview: JSON.stringify({ headline: out.headline, points: out.points.slice(0, 5) }) });
      await ctx.runMutation(internal.engine.completeStep, { stepId: step.stepId!, output: JSON.stringify(out) });
    } else {
      await ctx.runMutation(internal.engine.failStep, { stepId: step.stepId!, error: r.message.slice(0, 200) });
    }
  } catch {
    // A first take is a nice-to-have; never block the real job on it.
  }
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                 */
/* ------------------------------------------------------------------ */

export const onboardingResearch = internalAction({
  args: { runId: v.id("workflowRuns"), ownerText: v.optional(v.string()) },
  handler: async (ctx, { runId, ownerText }) => {
    const startedAt = Date.now();
    const job = await loadContext(ctx, runId);
    if (!job?.business) return;
    const business = job.business;
    await guarded(ctx, runId, async () => {
      // Step 0: bounded website research (skipped when the owner pasted their own description).
      let pagesText = "";
      let pagesFetched = 0;
      const step = await begin(ctx, runId, 0, "research", "Read your website");
      let pages: { url: string; title?: string; excerpt?: string; status: "ok" | "blocked_by_robots" | "failed"; text: string }[] = [];
      if (step.checkpoint !== undefined) {
        pages = step.checkpoint as typeof pages;
      } else {
        if (job.run.isFixture || !business.website) {
          pages = business.website
            ? [{ url: business.website, title: business.name, status: "ok", text: job.facts.map((f) => f.statement).join("\n") }]
            : [];
        } else {
          const res = await researchWebsite(business.website, 2);
          pagesFetched = res.pagesFetched;
          pages = res.pages.map((p) => ({ url: p.url, title: p.title, excerpt: p.text.slice(0, 600), status: p.status, text: `${p.text}\n${p.prices.join("\n")}` }));
          await ctx.runMutation(internal.engine.recordUsage, {
            stepId: step.stepId!,
            records: [{ type: "scrape_credit", provider: process.env.FIRECRAWL_API_KEY ? "firecrawl" : "builtin", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: pagesFetched, costMicros: pagesFetched * 5_000, estimated: !process.env.FIRECRAWL_API_KEY }],
          });
        }
        await ctx.runMutation(internal.engine.completeStep, { stepId: step.stepId!, output: JSON.stringify(pages) });
      }
      pagesText = pages
        .filter((p) => p.status === "ok")
        .map((p) => untrusted(p.url, p.text, 12_000))
        .join("\n\n");
      if (ownerText) pagesText += `\n\n${untrusted("owner-supplied description", ownerText, 8_000)}`;
      if (!pagesText.trim()) {
        await ctx.runMutation(internal.jobWrites.saveResearch, { runId, businessId: business._id, pages: pages.map(({ text: _t, ...p }) => p) });
        throw new JobStop("no_content", "We couldn't read your website (it may block automated visitors). Paste a short description of your business instead and we'll continue.");
      }

      // Step 1: Data Analyst extracts a sourced business profile.
      const profile = await runModelTask<BusinessProfile>(
        ctx,
        job,
        1,
        "business_profile",
        `TASK: Build a concise, factual business profile from the website content below. Every fact must come from the content and cite the page URL it came from in sourceUrl. Mark anything uncertain as low confidence. Business name given by the owner: "${business.name}". Suggest 2-4 success events that define a valuable customer action for this type of business.`,
        pagesText,
        fixtureCtx(job),
      );
      await ctx.runMutation(internal.jobWrites.saveResearch, {
        runId,
        businessId: business._id,
        pages: pages.map(({ text: _t, ...p }) => p),
        profile: JSON.stringify(profile),
      });

      // Speed: a first take on what we see while the deep research runs (5-10 minutes).
      await quickTake(ctx, job, 300, "First take", `From this profile, give the owner a first take: who the best customers probably are, what makes the business stand out, and the 2-3 biggest growth opportunities you already see. Deeper research with competitors and customer language follows.\n\nPROFILE:\n${JSON.stringify(profile).slice(0, 5000)}`);

      // Step 2: CMO builds business intelligence (audience, competitors, VoC, SWOT, journey).
      const v1InsightsTask = `TASK: Using the business profile and website content, produce business intelligence: likely customer groups, competitors (only name competitors you can support with a source; if you used web search, put the URL in sourceUrl; otherwise say the owner should confirm), positioning, pricing observations, SWOT, a customer journey and the top opportunities.\n\nPROFILE:\n${JSON.stringify(profile).slice(0, 6000)}`;
      const insights = await runAgentTask<BusinessInsights>(
        ctx,
        job,
        2,
        insightsSpec(),
        agentInput(
          job,
          `Produce business intelligence for ${business.name}: competitive alternatives, customer groups, a voice-of-customer phrase bank, objections, positioning, pricing observations, SWOT, journey, gaps and the top opportunities.\n\nPROFILE (extracted from the website):\n${JSON.stringify(profile).slice(0, 6000)}`,
          {
            untrustedContext: pagesText,
            facts: profile.facts.map((f) => f.statement),
            research: researchFor("business_insights", { website: business.website, businessName: business.name }),
          },
        ),
        startedAt,
        { task: "business_insights", text: v1InsightsTask, context: pagesText, ctx: fixtureCtx(job) },
      );
      await ctx.runMutation(internal.jobWrites.saveInsights, { runId, businessId: business._id, insights: JSON.stringify(insights) });
      await finish(ctx, runId, "verified", { output: { facts: profile.facts.length }, meters: { scrapeCredits: pagesFetched, searchCalls: 0 } });
    }, undefined, resumeAs(ctx, "onboardingResearch", { runId, ownerText }));
  },
});

export const buildStrategy = internalAction({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, { runId }) => {
    const startedAt = Date.now();
    const job = await loadContext(ctx, runId);
    if (!job) return;
    await guarded(ctx, runId, async () => {
      const insights = job.business?.insights;
      const learned = await ctx.runQuery(internal.learning.contextFor, { orgId: job.org._id });
      const insightsBrief = `${insights ? JSON.stringify(insights).slice(0, 14_000) : "(none yet)"}${learned ? `\n\n${learned}` : ""}`;
      const v2 = !job.run.isFixture && job.run.engine === "v2";
      // Speed: a first take in about a minute while the full plan is researched and reviewed.
      await quickTake(ctx, job, 300, "First take", `Give the owner a first take on the growth plan for this goal: the single biggest opportunity, the 2-3 moves you'd start with this week and what to measure. A deeper, researched plan follows in a few minutes.\n\nBUSINESS INTELLIGENCE:\n${insightsBrief.slice(0, 6000)}`);
      // 0. Acquisition Intelligence: classify the business and score the library's channels with evidence.
      let profile = profileFrom({
        saved: (job.business as { acquisition?: SavedAcquisition } | null)?.acquisition ?? null,
        legacyType: job.business?.businessType,
        budgetMinor: job.goal?.monthlyAdBudgetMinor ?? 0,
        horizonDays: job.goal?.horizonDays ?? 90,
        legacyTypes: typesFromLegacy,
      });
      let adjustments: Adjustment[] = [];
      let channelSummary: string[] = [];
      if (v2) {
        const candidates = candidatesFor(profile);
        const typeKeys = BUSINESS_TYPES.map((t) => t.key);
        const dimValues = Object.fromEntries(Object.entries(DIMENSIONS).map(([k, d]) => [k, d.values]));
        const fit = await runAgentTask<ChannelFit>(
          ctx,
          job,
          200,
          channelFitSpec({ candidateIds: candidates.map((c) => c.id), typeKeys, dims: dimValues }),
          agentInput(
            job,
            [
              "Classify this business and score its candidate acquisition channels for the goal and budget, so the plan uses the channels most likely to bring profitable customers.",
              `1. types: 1-3 of these library keys, most specific first: ${BUSINESS_TYPES.map((t) => `${t.key} (${t.label})`).join("; ")}.`,
              `2. dimensions: infer each you can from the website and research, with confidence and evidence. Allowed values: ${Object.entries(DIMENSIONS).map(([k, d]) => `${k}=${d.values.join("|")}`).join("; ")}. Owner-confirmed values (below) are fixed.`,
              `3. channels: review every candidate below. Each has rule-based factor priors (audience, intent, budget, time, feasibility, competition, scalability, measurement). Give deltas (−30…+30, 0 = keep) only where evidence for THIS business says the prior is wrong: e.g. competitors already dominate it (competition down) or are absent (up); the audience provably gathers there (audience up); the owner can't execute it (feasibility down). Name the platform, the tactic and the audience for each.`,
              `4. summary: two short bullets on what wins and why.`,
              `Monthly budget: $${profile.budgetUsd}. Horizon: ${profile.horizonDays} days.`,
              `OWNER-CONFIRMED: ${Object.entries(profile.dims).filter(([, d]) => d?.source === "owner").map(([k, d]) => `${k}=${d!.value}`).join(", ") || "none"}.`,
              `CANDIDATES (id · name · priors):\n${candidates.map((c) => `${c.id} · ${c.name} · ${FACTORS.map((f) => c.factors[f]).join("/")}`).join("\n")}`,
              `BUSINESS INTELLIGENCE (researched earlier):\n${insightsBrief}`,
            ].join("\n\n"),
          ),
          startedAt,
          { task: "growth_strategy", context: "", ctx: fixtureCtx(job), text: "" },
        );
        profile = mergeFit(profile, fit, new Set(typeKeys));
        adjustments = adjustmentsFrom(fit);
        channelSummary = fit.summary.slice(0, 3);
      }
      const scored = scoreChannels(profile, adjustments);
      const scorecard = `\n\nCHANNEL SCORECARD (Acquisition Intelligence, budget band ${budgetBand(profile.budgetUsd).label}: ${budgetBand(profile.budgetUsd).approach}). Build on the Primary and In-the-plan channels first; anything lower-ranked must say why:\n${scorecardText(scored)}`;
      // 1. Growth plays: the creative, predictable portfolio (own agent: research + play catalogs).
      const plays = v2
        ? await runAgentTask<PlaysOutput>(
            ctx,
            job,
            0,
            growthPlaysSpec({}, playCatalogsFor(job.business?.businessType)),
            agentInput(
              job,
              `Choose this business's growth-plays portfolio for the goal, within the stated budget and the owner's time: one bankable play, one or two creative-but-proven plays (a proven mechanic on a non-obvious audience, asset or moment for THIS business), and at most one capped moonshot. Go beyond social posts and email whenever something else would move the goal more. Forecast every play from cited base rates with ranges, and give each a test with kill and scale rules and a first action for today. Be ambitious: together the plays must credibly move the goal within 90 days (a real volume engine with weekly numbers), not just validate assumptions. Keep each play card short and plain. Fill economics (what one customer is worth: facts first, else labelled assumptions) and each play's model; ClimbOS computes customers and cost per customer from them and sends back plays that lose money. ${capsHint(PLAYS_CAPS)}${scorecard}\n\n${CLIMBOS_ENGINES}\n\nBUSINESS INTELLIGENCE (researched earlier; competitors, customer language, objections, gaps):\n${insightsBrief}`,
              { research: researchFor("growth_strategy", { website: job.business?.website, businessName: job.business?.name ?? job.org.name }) },
            ),
            startedAt,
            { task: "growth_strategy", context: "", ctx: fixtureCtx(job), text: "" },
          )
        : null;
      // 2. The 90-day plan, built around those plays.
      const locked = plays ? lockedNumbers(plays) : "";
      let strategy = await runAgentTask<StrategyOutput>(
        ctx,
        job,
        100,
        strategySpec(),
        agentInput(
          job,
          `${locked ? `${locked}\n\n` : ""}Create the 90-day growth plan for the goal, within the stated budget and the owner's time.${plays ? ` Build it around these growth plays (keep them as chosen; make channels, phases, the week-one checklist, North Star and measurement serve them):\n${JSON.stringify(plays).slice(0, 14_000)}` : ""}${scorecard}\nList strong channels left for later in notDoing, with the reason. Write for a busy owner: short sentences, no repeated thresholds; put the numbers where they're used. ${capsHint(PLAN_CAPS)}\n\n${CLIMBOS_ENGINES}\n\nBUSINESS INTELLIGENCE (researched earlier; competitors, customer language, objections, gaps):\n${insightsBrief}`,
        ),
        startedAt,
        {
          task: "growth_strategy",
          context: "",
          ctx: fixtureCtx(job),
          text:
        `TASK: Create a focused growth plan for the goal. Choose 2-4 channels with priorities, dependencies and how each will be measured. Include 1-2 experiments with a hypothesis, population, method, primary metric, guardrails, duration and stopping rule. Suggested ad spend must not exceed the stated monthly ad budget. Add 3 concrete first actions.\n\n${businessBrief(job)}\n\nINSIGHTS:\n${insights ? JSON.stringify({ audiences: insights.audiences, positioning: insights.positioning, swot: insights.swot, opportunities: insights.opportunities }).slice(0, 6000) : "(none yet)"}`,
        },
      );
      // Final consistency pass: one editor reconciles the plan with the locked numbers.
      if (plays && locked) strategy = await consistencyStep(ctx, job, 190, strategy, locked);
      await ctx.runMutation(internal.jobWrites.saveStrategy, {
        runId,
        strategy: JSON.stringify(plays ? { ...strategy, plays: plays.plays, economics: plays.economics } : strategy),
        factIds: job.facts.map((f) => f.id),
        acquisition: JSON.stringify({ libraryVersion: LIBRARY_VERSION, profile, adjustments, summary: channelSummary }),
      });
      await finish(ctx, runId, "verified", { output: { channels: strategy.channels.length } });
    }, undefined, resumeAs(ctx, "buildStrategy", { runId }));
  },
});

export const createContent = internalAction({
  args: {
    runId: v.id("workflowRuns"),
    job: v.union(v.literal("content_social"), v.literal("content_ads"), v.literal("content_email"), v.literal("content_seo")),
    channel: v.optional(v.string()),
    quantity: v.optional(v.number()),
    images: v.optional(v.number()),
    brief: v.optional(v.string()),
    cardId: v.optional(v.id("actionCards")),
    /** Real images to build the posts around (site screenshots, product photos, uploads), in post order. */
    assetIds: v.optional(v.array(v.id("assets"))),
  },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const job = await loadContext(ctx, args.runId);
    if (!job) return;
    const factIds = job.facts.map((f) => f.id);
    const assets = args.assetIds?.length ? await ctx.runQuery(internal.assets.forJob, { orgId: job.org._id, assetIds: args.assetIds }) : [];
    const imagesBrief = assets.length
      ? `\n\nREAL IMAGES (use them; post N is built around image N, in order; write each post's imageIdea and alt text to describe how that real image is used, never inventing what it shows):\n${assets.map((a, i) => `${i + 1}. ${a.describe}`).join("\n")}`
      : "";
    const ownerBrief = `${args.brief ?? ""}${imagesBrief}`.trim();
    const brief = ownerBrief ? `\n\nOWNER REQUEST: ${untrusted("owner request", ownerBrief, 3000)}` : "";
    await guarded(
      ctx,
      args.runId,
      async () => {
        const fx = fixtureCtx(job, { channel: args.channel, quantity: args.quantity, request: args.brief });
        const review: { shipped?: boolean | null } = {};
        let items: ReturnType<typeof socialToArtifacts> = [];
        let posts = 0;
        if (args.job === "content_social") {
          const qty = Math.max(1, Math.min(args.quantity ?? 3, 6));
          const channels = args.channel ? [args.channel] : ["instagram", "facebook", "linkedin"];
          const out = await runAgentTask<SocialPostsOutput>(
            ctx,
            job,
            0,
            socialSpec(channels),
            agentInput(
              job,
              `Write ${qty} social post${qty === 1 ? "" : "s"} for ${channels.join(", ")} that support the growth plan and goal. Each post makes one point, written natively for its platform, with a visual brief and accessible alt text. Never imply a real customer or show a fake screenshot.${args.brief ? `\n\nThe owner asked for: ${args.brief.slice(0, 1500)}` : ""}${imagesBrief}${planContext(job)}`,
            ),
            startedAt,
            {
              task: "social_posts",
              context: "",
              ctx: fx,
              text: `TASK: Write ${qty} social posts${args.channel ? ` for ${args.channel}` : " across Instagram, Facebook and LinkedIn"} that support the plan. Platform-native style, accessible alt text, an image idea that never implies a real customer or a fake screenshot.\n\n${businessBrief(job)}${brief}`,
            },
            review,
          );
          out.posts = out.posts.slice(0, qty);
          // A run for one channel only ever produces posts for that channel.
          if (args.channel) out.posts = out.posts.map((p) => ({ ...p, channel: args.channel as typeof p.channel }));
          posts = out.posts.length;
          items = socialToArtifacts(out, Date.now());
        } else if (args.job === "content_ads") {
          const out = await runAgentTask<AdDraftsOutput>(
            ctx,
            job,
            0,
            adsSpec(),
            agentInput(job, `Draft one Google responsive search ad and Meta ads built on distinct creative concepts for the goal, within the owner's budget. Ads are created paused and only go live after the owner approves them.${args.brief ? `\n\nThe owner asked for: ${args.brief.slice(0, 1500)}` : ""}${planContext(job)}`, {
              research: researchFor("ad_drafts", { website: job.business?.website, businessName: job.business?.name ?? job.org.name }),
            }),
            startedAt,
            { task: "ad_drafts", context: "", ctx: fx, text: `TASK: Draft one Google search ad (headlines ≤ 30 characters, descriptions ≤ 90) and one Meta ad. Keep within the owner's budget; suggest a test budget but never above it.\n\n${businessBrief(job)}${brief}` },
          );
          items = adsToArtifacts(out, job.business?.website);
        } else if (args.job === "content_email") {
          const out = await runAgentTask<EmailSequenceOutput>(
            ctx,
            job,
            0,
            emailSpec(),
            agentInput(job, `Write a short email sequence (3 emails) for people who agreed to hear from the business. Use {{first_name}} with a safe fallback. One idea and one call to action per email.${args.brief ? `\n\nThe owner asked for: ${args.brief.slice(0, 1500)}` : ""}${planContext(job)}`),
            startedAt,
            { task: "email_sequence", context: "", ctx: fx, text: `TASK: Write a short email sequence (3 emails) for people who agreed to hear from the business. Use {{first_name}} for personalization. Include a clear call to action per email.\n\n${businessBrief(job)}${brief}` },
          );
          items = emailToArtifacts(out);
        } else {
          const out = await runAgentTask<SeoBriefOutput>(
            ctx,
            job,
            0,
            seoSpec(),
            agentInput(job, `Plan and draft one genuinely helpful page targeting a real, high-intent search a likely customer makes. Include the title (≤ 60 characters), meta description (≤ 155 characters), outline and a full first draft.${args.brief ? `\n\nThe owner asked for: ${args.brief.slice(0, 1500)}` : ""}${planContext(job)}`, {
              research: researchFor("seo_brief", { website: job.business?.website, businessName: job.business?.name ?? job.org.name }),
            }),
            startedAt,
            { task: "seo_brief", context: "", ctx: fx, text: `TASK: Plan and draft one helpful page targeting a real search a likely customer makes. Include title (≤ 60 chars), meta description (≤ 155 chars), outline and a first draft.\n\n${businessBrief(job)}${brief}` },
          );
          items = seoToArtifacts(out);
        }

        // Creative Director: images for the first N social posts (max 2 attempts each, metered).
        const withImages: (typeof items[number] & { imageStorageId?: Id<"_storage">; imageR2Key?: string; imageLabel?: string })[] = items.map((i) => ({ ...i }));
        let delivered = 0;
        let attempts = 0;
        // Real images first: post i gets real image i (screenshots, product photos, uploads).
        if (assets.length) {
          withImages.forEach((item, i) => {
            const a = assets[i % assets.length];
            item.imageStorageId = a.storageId;
            item.imageR2Key = a.r2Key;
            item.imageLabel = a.labelForPost;
          });
        }
        const imageCount = args.job === "content_social" && !assets.length ? Math.min(args.images ?? 0, 2, withImages.length) : 0;
        for (let i = 0; i < imageCount; i++) {
          const item = withImages[i];
          const s = await begin(ctx, args.runId, 10 + i, "image", "Create image", "creative_director");
          if (s.checkpoint !== undefined) {
            if (typeof s.checkpoint === "string") {
              if (s.checkpoint.startsWith("r2:")) item.imageR2Key = s.checkpoint.slice(3);
              else item.imageStorageId = s.checkpoint as Id<"_storage">;
            }
            continue;
          }
          if (job.run.isFixture) {
            await ctx.runMutation(internal.engine.completeStep, { stepId: s.stepId!, output: JSON.stringify(null) });
            continue; // demo: no image generated; a labeled placeholder is shown instead
          }
          const rates = getRateVersion(job.run.rateVersionId);
          const prompt = `Brand illustration for ${job.business?.name ?? "a small business"}: ${item.imagePrompt}. Clean, modern, soft natural light, no text, no logos, no real people's faces, no fake product screenshots.`;
          let stored: string | undefined; // "r2:<key>" or a Convex storage id
          for (let a = 0; a < 2 && !stored; a++) {
            attempts++;
            const img = await generateImage(prompt, rates);
            await ctx.runMutation(internal.engine.recordUsage, {
              stepId: s.stepId!,
              records: [{ type: "image_attempt", provider: "google", model: "gemini-3.1-flash-lite-image", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: img.costMicros, estimated: true }],
            });
            if (img.ok) {
              if (r2Configured()) {
                const key = r2Key(job.org._id, "images", img.mimeType.split("/")[1] ?? "png");
                await r2Put(key, img.bytes, img.mimeType);
                stored = `r2:${key}`;
              } else {
                stored = await ctx.storage.store(new Blob([img.bytes as BlobPart], { type: img.mimeType }));
              }
            } else if (img.kind === "provider_unavailable") break;
          }
          if (stored) {
            if (stored.startsWith("r2:")) item.imageR2Key = stored.slice(3);
            else item.imageStorageId = stored as Id<"_storage">;
            delivered++;
          }
          await ctx.runMutation(internal.engine.completeStep, { stepId: s.stepId!, output: JSON.stringify(stored ?? null) });
        }

        const artifactIds = await ctx.runMutation(internal.jobWrites.saveArtifacts, { runId: args.runId, items: withImages as never, factIds });
        await finish(ctx, args.runId, "verified", {
          output: { artifacts: withImages.length },
          meters: { socialPosts: posts, imageAttempts: attempts, deliveredImages: delivered },
        });
        // Autopilot runs: attach drafts to their calendar slots and route each (auto vs ask).
        if (args.job === "content_social") await ctx.runMutation(internal.autopilot.routeDrafts, { runId: args.runId, artifactIds, reviewShipped: review.shipped ?? null });
        if (args.cardId) await ctx.runMutation(internal.jobWrites.updateActionCard, { cardId: args.cardId, status: "done" });
      },
      async () => {
        if (args.cardId) await ctx.runMutation(internal.jobWrites.updateActionCard, { cardId: args.cardId, status: "failed" });
        await ctx.runMutation(internal.autopilot.draftingFailed, { runId: args.runId });
      },
      resumeAs(ctx, "createContent", args),
    );
  },
});

/** Social autopilot: plan a week of posts (Engine v2 agent, or a deterministic plan for demos). */
export const planSocialWeek = internalAction({
  args: { runId: v.id("workflowRuns"), weekOf: v.string(), fromDay: v.number() },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const job = await loadContext(ctx, args.runId);
    if (!job) return;
    const pc = await ctx.runQuery(internal.autopilot.planningContext, args);
    if (!pc) return;
    await guarded(
      ctx,
      args.runId,
      async () => {
        let plan: SocialCalendar;
        if (job.run.isFixture || job.run.engine !== "v2") {
          plan = fixtureCalendar(pc.cadence, pc.fromDay, job.business?.name ?? job.org.name, job.facts.map((f) => f.statement));
        } else {
          const cadenceText = Object.entries(pc.cadence).map(([c, n]) => `${c}: ${n}`).join(", ");
          const days = pc.dates.map((d, i) => `${i + 1} = ${new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}`).join("; ");
          plan = await runAgentTask<SocialCalendar>(
            ctx,
            job,
            0,
            socialCalendarSpec(pc.cadence),
            agentInput(
              job,
              [
                `Plan the organic social posts for the week of ${pc.dates[0]} (days: ${days}).`,
                `Exactly this many slots per channel: ${cadenceText}. Use only days ${pc.fromDay} to 7.`,
                `Consider holidays, seasons and events in this week that matter to this business's customers in its country (time zone ${pc.timezone}).`,
                pc.postingHours.length ? `The owner prefers posting around these local hours: ${pc.postingHours.join(", ")}.` : "",
                pc.alwaysAskTopics.length ? `Always-ask topics (flag needsOwner if a slot touches them): ${pc.alwaysAskTopics.join("; ")}.` : "",
                pc.history ? `WHAT HAPPENED IN RECENT WEEKS (apply it and say how in learningsApplied):\n${pc.history}` : "No history yet: this is the first planned week. Plan it as a deliberate test (two contrasting formats on the main channel) and say so in learningsApplied.",
                planContext(job),
              ]
                .filter(Boolean)
                .join("\n\n"),
            ),
            startedAt,
            { task: "social_posts", text: "", context: "", ctx: fixtureCtx(job) },
          );
        }
        await ctx.runMutation(internal.autopilot.saveWeekPlan, { runId: args.runId, weekOf: args.weekOf, fromDay: args.fromDay, plan });
        await finish(ctx, args.runId, "verified", { output: { slots: plan.slots.length } });
      },
      undefined,
      resumeAs(ctx, "planSocialWeek", args),
    );
  },
});

/** Check each prospect's website and published emails; checkpointed and metered as page reads. */
async function verifyProspects(ctx: ActionCtx, job: JobCtx, found: ProspectsOutput): Promise<ProspectsOutput> {
  if (process.env.CLIMBOS_FAKE_LLM) return found; // tests never fetch real sites
  const step = await begin(ctx, job.run._id, 300, "research", "Check websites and emails", "cso");
  if (step.checkpoint !== undefined) return step.checkpoint as ProspectsOutput;
  const checks = await checkProspects(found.prospects.map((p) => p.website), 150_000);
  const now = Date.now();
  const prospects = found.prospects
    .map((p) => {
      const c = checks.get(p.website);
      if (!c) return p; // not checked in time: keep as found
      const best = c.mxOk === false ? undefined : c.emails[0];
      return {
        ...p,
        publicEmail: best?.email ?? (p.publicEmail && c.emails.some((e) => e.email === p.publicEmail.toLowerCase()) ? p.publicEmail : ""),
        check: { siteLive: c.live, emailSource: best?.url, emailKind: best?.kind, mxOk: c.mxOk ?? undefined, checkedAt: now },
      };
    })
    .filter((p) => (p as { check?: { siteLive: boolean } }).check?.siteLive !== false);
  const pages = [...checks.values()].reduce((s, c) => s + c.pagesFetched, 0);
  if (pages > 0) {
    await ctx.runMutation(internal.engine.recordUsage, {
      stepId: step.stepId!,
      records: [{ type: "scrape_credit", provider: "climbos", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: pages, costMicros: 0, estimated: false }],
    });
  }
  const out = { ...found, prospects };
  await ctx.runMutation(internal.engine.completeStep, { stepId: step.stepId!, output: JSON.stringify(out) });
  return out;
}

/** Outbound: find evidenced prospects, then write the sequence and openers. Nothing is sent. */
export const findCustomers = internalAction({
  args: { runId: v.id("workflowRuns"), campaignId: v.id("outboundCampaigns"), cardId: v.optional(v.id("actionCards")) },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const job = await loadContext(ctx, args.runId);
    if (!job) return;
    const cc = await ctx.runQuery(internal.outbound.campaignContext, { campaignId: args.campaignId });
    if (!cc) return;
    const name = job.business?.name ?? job.org.name;
    await guarded(
      ctx,
      args.runId,
      async () => {
        let found: ProspectsOutput;
        let outreach: OutreachOutput;
        if (job.run.isFixture || job.run.engine !== "v2") {
          ({ prospects: found, outreach } = fixtureOutbound({ businessName: name, ...cc.brief }));
        } else {
          const steer = [
            cc.brief.who ? `Owner's steer on who to find: ${untrusted("owner request", cc.brief.who, 300)}` : "No steer on who: derive the ideal customer from the positioning and facts.",
            cc.brief.where ? `Where: ${untrusted("owner request", cc.brief.where, 120)}` : "Where: the business's own market (from its site, currency and time zone).",
          ].join("\n");
          const creators = cc.kind === "creators";
          found = await runAgentTask<ProspectsOutput>(
            ctx,
            job,
            0,
            creators ? creatorScoutSpec() : prospectingSpec(),
            creators
              ? agentInput(
                  job,
                  `Find ${cc.brief.count} real creators or influencers whose audience matches the buyers of ${name}, from public pages only: each with profile URL, audience size as shown, a recent post that shows fit, fit and timing scores, and the contact route. Write the ideal-customer summary first (icp).\n${steer}\nNever invent a creator, follower count, rate or email; only copy an email published verbatim on a cited page.${cc.knownDomains.length ? `\nAlready found (skip): ${cc.knownDomains.join(", ").slice(0, 3000)}` : ""}${planContext(job)}`,
                  { research: researchFor("creator_scout", { website: job.business?.website, businessName: name }) },
                )
              : agentInput(
              job,
              `Find ${cc.brief.count} real companies that need ${name} now, from public web sources only, each with evidence URLs, a trigger if one exists, fit and timing scores, and the decision-maker role. Write the ICP first.\n${steer}\nApply the jurisdiction rules from the playbook (exclude anyone you may not cold-email). Never invent a company, person or email; only copy an email that is published verbatim on a cited page.${cc.knownDomains.length ? `\nAlready in the pipeline (skip): ${cc.knownDomains.join(", ").slice(0, 3000)}` : ""}${planContext(job)}`,
              { research: researchFor("prospecting", { website: job.business?.website, businessName: name }) },
            ),
            startedAt,
            { task: "sales_sequence", text: "", context: "", ctx: fixtureCtx(job) },
          );
          // Our own checks (no data vendor): drop companies whose site isn't live; attach emails each site publishes.
          // Creators live on social platforms that block automated visits, so their research evidence stands.
          if (!creators) found = await verifyProspects(ctx, job, found);
          outreach = await runAgentTask<OutreachOutput>(
            ctx,
            job,
            100,
            outreachSpec(),
            agentInput(
              job,
              `${creators ? `Write a short collaboration pitch to these creators (one template, 2-3 steps on business days 0, 4 and 10): what ${name} offers them (a paid post, gifted product, affiliate commission or a co-created piece — say which the owner should confirm), why their audience fits, and a simple next step. One opener per creator for {{firstLine}}, built only on their cited recent post. Mention that paid or gifted posts must be disclosed. Sender: ${name}.` : `Write the cold email sequence for these prospects (one template for all, 3-4 steps on business days 0, 3, 7 and 14) and one opener per prospect for {{firstLine}}, built only on that prospect's cited evidence. Sender: ${name}.`} The system adds the greeting name, footer, opt-out line and booking link, so don't write them. CTA: an interest question or a short call.\n\nICP: ${JSON.stringify(found.icp)}\n\nPROSPECTS:\n${JSON.stringify(found.prospects.map((p) => ({ company: p.company, why: p.why, trigger: p.trigger, evidence: p.evidence, contact: p.contact }))).slice(0, 16_000)}${planContext(job)}`,
            ),
            startedAt,
            { task: "sales_sequence", text: "", context: "", ctx: fixtureCtx(job) },
          );
        }
        const saved = await ctx.runMutation(internal.outbound.saveResult, { campaignId: args.campaignId, prospects: found, outreach });
        await finish(ctx, args.runId, "verified", { output: { prospects: saved?.added ?? 0, emails: outreach.sequence.length } });
        if (args.cardId) await ctx.runMutation(internal.jobWrites.updateActionCard, { cardId: args.cardId, status: "done" });
      },
      async () => {
        await ctx.runMutation(internal.outbound.markFailed, { campaignId: args.campaignId });
        if (args.cardId) await ctx.runMutation(internal.jobWrites.updateActionCard, { cardId: args.cardId, status: "failed" });
      },
      resumeAs(ctx, "findCustomers", args),
    );
  },
});

/**
 * A wish: the owner says what they want; the COO turns it into concrete work.
 * Safe internal work (drafts, plans, audits, analysis) starts by itself
 * (saveChatResult); anything external still waits for the owner's approval.
 */
export const chatIntent = internalAction({
  args: { runId: v.id("workflowRuns"), messageId: v.id("chatMessages"), text: v.string() },
  handler: async (ctx, { runId, messageId, text }) => {
    const job = await loadContext(ctx, runId);
    if (!job) return;
    const wc = await ctx.runQuery(internal.workspace.wishContext, { orgId: job.org._id });
    const plan = job.strategy
      ? [
          `CURRENT GROWTH PLAN (${job.strategy.status}): ${job.strategy.summary.slice(0, 600)}`,
          `Priorities: ${job.strategy.channels.map((c) => `${c.priority}. ${c.name} (${c.status})`).join("; ").slice(0, 600)}`,
          job.strategy.expert ? `North Star: ${job.strategy.expert.northStar.metric} → ${job.strategy.expert.northStar.target}. Not doing: ${job.strategy.expert.notDoing.map((n) => n.channel).join(", ")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "No growth plan yet.";
    await guarded(
      ctx,
      runId,
      async () => {
        const out = await runModelTask<ChatIntentOutput>(
          ctx,
          job,
          0,
          "chat_intent",
          [
            "TASK: You are the COO of this business's AI growth team. The owner just made a wish in plain words. Make it happen: turn it into the smallest set of concrete actions (1-4) that best achieves what they actually want, and write each action's `brief` so the specialist can do excellent work without asking anything.",
            "",
            "Rules:",
            "- Act, don't interview. If something is unclear, choose the most sensible reading, say the assumption in one short clause in `reply`, and proceed. Ask a `followUp` only if the answer would change the work; otherwise followUp is \"\".",
            "- `understood`: one sentence restating the wish in the owner's own terms (no jargon).",
            "- `reply`: 1-2 short sentences (under 35 words), warm and specific: what the team is doing now, and when anything needs the owner. Never promise results or invent numbers.",
            "- `brief`: carry the owner's exact specifics (products, dates, offers, tone, audience, deadlines) plus the angle and why. Mention which confirmed facts to use. Up to 120 words.",
            "- Pick what really moves the owner's goal, not just what they literally said: e.g. \"more holiday orders\" may need posts AND a pre-order email AND an ad draft. Think beyond social and email when it fits (partnerships, creators, reviews, launches, local plays) and put those ideas in a note or plan refresh brief.",
            "- Kinds: generate_content (channel: instagram, facebook, linkedin, x, tiktok, pinterest, youtube, email, google_search_ad, meta_ad, blog; quantity = number of posts, max 6), refresh_plan, research (conversion audit of their website), analyze_results, set_up_autopilot (when they want posting to run by itself; put channels and cadence in brief), find_customers (outbound: find companies or people who need this business, write cold emails, book calls; brief = who and where, quantity = how many prospects, 10-30; nothing is sent), connect_account (when the wish needs an account we don't have; channel = provider), note (advice or an idea the team can't execute yet), schedule_content/ad_change/email_send (only to prepare something external for approval).",
            "- Anything that would publish, send or spend is prepared for approval, never done directly.",
            "",
            businessBrief(job),
            planContext(job),
            "",
            plan,
            `Autopilot: ${wc.autopilot}. Connected accounts: ${wc.connected.join(", ") || "none"}.`,
            wc.recentWork.length ? `Recent work: ${wc.recentWork.join("; ")}` : "",
            wc.conversation ? `RECENT CONVERSATION:\n${wc.conversation}` : "",
            "",
            "OWNER'S WISH:",
          ]
            .filter((l) => l !== undefined)
            .join("\n"),
          untrusted("owner wish", text, 2000),
          fixtureCtx(job, { request: text }),
        );
        await ctx.runMutation(internal.jobWrites.saveChatResult, { runId, messageId, result: JSON.stringify(out), isFixture: job.run.isFixture });
        await finish(ctx, runId, "verified");
      },
      async (msg) => {
        await ctx.runMutation(internal.jobWrites.markChatFailed, { messageId, message: msg });
      },
    );
  },
});

export const explainResults = internalAction({
  args: { runId: v.id("workflowRuns"), metricsJson: v.string(), cardId: v.optional(v.id("actionCards")) },
  handler: async (ctx, { runId, metricsJson, cardId }) => {
    const job = await loadContext(ctx, runId);
    if (!job) return;
    await guarded(ctx, runId, async () => {
      const out = await runModelTask<unknown>(
        ctx,
        job,
        0,
        "metric_explanation",
        `TASK: Explain these computed results in plain English for the owner. Use ONLY the numbers given. Say clearly what is observed, what is attributed and what is projected, and what is uncertain.\n\n${businessBrief(job)}\n\nCOMPUTED RESULTS (from ClimbOS statistics code):\n${metricsJson.slice(0, 12_000)}`,
        "",
        fixtureCtx(job),
      );
      await finish(ctx, runId, "verified", { output: out });
      if (cardId) await ctx.runMutation(internal.jobWrites.updateActionCard, { cardId, status: "done" });
    });
  },
});

export const conversionAudit = internalAction({
  args: { runId: v.id("workflowRuns"), cardId: v.optional(v.id("actionCards")) },
  handler: async (ctx, { runId, cardId }) => {
    const startedAt = Date.now();
    const job = await loadContext(ctx, runId);
    if (!job?.business) return;
    const website = job.business.website;
    await guarded(ctx, runId, async () => {
      const step = await begin(ctx, runId, 0, "research", "Read key pages");
      let text = "";
      if (step.checkpoint !== undefined) text = step.checkpoint as string;
      else {
        if (!job.run.isFixture && website) {
          const res = await researchWebsite(website, 1);
          text = res.pages.filter((p) => p.status === "ok").map((p) => untrusted(p.url, p.text, 10_000)).join("\n\n");
          await ctx.runMutation(internal.engine.recordUsage, {
            stepId: step.stepId!,
            records: [{ type: "scrape_credit", provider: process.env.FIRECRAWL_API_KEY ? "firecrawl" : "builtin", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: res.pagesFetched, costMicros: res.pagesFetched * 5_000, estimated: !process.env.FIRECRAWL_API_KEY }],
          });
        }
        await ctx.runMutation(internal.engine.completeStep, { stepId: step.stepId!, output: JSON.stringify(text) });
      }
      const out = await runAgentTask<unknown>(
        ctx,
        job,
        1,
        conversionAuditSpec(),
        agentInput(job, "Audit the money page(s) for conversion: clarity, message match, offer, proof, objections, calls to action, friction, pricing presentation and trust. Cite the page URL for each finding and prioritise the fixes.", {
          untrustedContext: text,
          research: researchFor("conversion_audit", { website, businessName: job.business?.name ?? job.org.name }),
        }),
        startedAt,
        { task: "conversion_audit", context: text, ctx: fixtureCtx(job), text: `TASK: Audit these pages for conversion: clarity of offer, proof, friction, calls to action, pricing presentation. Cite the page URL for each finding. Recommend quick wins.\n\n${businessBrief(job)}` },
      );
      await finish(ctx, runId, "verified", { output: out, meters: { scrapeCredits: text ? 2 : 0 } });
      if (cardId) await ctx.runMutation(internal.jobWrites.updateActionCard, { cardId, status: "done" });
    }, undefined, resumeAs(ctx, "conversionAudit", { runId, cardId }));
  },
});

export const simplePlanJob = internalAction({
  args: { runId: v.id("workflowRuns"), task: v.union(v.literal("retention_plan"), v.literal("sales_sequence")), cardId: v.optional(v.id("actionCards")) },
  handler: async (ctx, { runId, task, cardId }) => {
    const startedAt = Date.now();
    const job = await loadContext(ctx, runId);
    if (!job) return;
    await guarded(ctx, runId, async () => {
      const text =
        task === "retention_plan"
          ? "TASK: Design customer segments and retention plays (trigger, message, channel) for people who already use the product and agreed to hear from the business."
          : "TASK: Define the ideal customer, qualification questions and a follow-up sequence for leads the business ALREADY has (inbound or CRM). Never imply access to a contact database.";
      const out = await runAgentTask<unknown>(
        ctx,
        job,
        0,
        task === "retention_plan" ? retentionSpec() : salesSpec(),
        agentInput(job, `${text.replace(/^TASK: /, "")}${planContext(job)}`),
        startedAt,
        { task, context: "", ctx: fixtureCtx(job), text: `${text}\n\n${businessBrief(job)}` },
      );
      await finish(ctx, runId, "verified", { output: out });
      if (cardId) await ctx.runMutation(internal.jobWrites.updateActionCard, { cardId, status: "done" });
    }, undefined, resumeAs(ctx, "simplePlanJob", { runId, task, cardId }));
  },
});

/* ------------------------------------------------------------------ */
/* Reels: script (Luna) → images (yours first, generated if needed) → our renderer */
/* ------------------------------------------------------------------ */

const ReelScriptSchema = z.object({
  caption: z.string(),
  scenes: z.array(z.object({ caption: z.string(), sub: z.string(), assetId: z.string(), imagePrompt: z.string() })),
  cta: z.string(),
  /** A cinematic 4-second shot for the opening scene (used when AI clips are on). */
  clipPrompt: z.string(),
});

export const makeReel = internalAction({
  args: { runId: v.id("workflowRuns"), reelId: v.id("reels"), assetIds: v.array(v.id("assets")) },
  handler: async (ctx, args) => {
    const startedAt = Date.now();
    const job = await loadContext(ctx, args.runId);
    if (!job) return;
    const failReel = async (msg: string) => ctx.runMutation(internal.reels.save, { reelId: args.reelId, patch: { status: "failed", error: msg } });
    await guarded(
      ctx,
      args.runId,
      async () => {
        const reel = (await ctx.runQuery(internal.reels.assetsFor, { orgId: job.org._id, assetIds: args.assetIds })) ?? [];
        const brief = JSON.parse(job.run.input || "{}").brief as string;
        const rates = getRateVersion(job.run.rateVersionId);
        // 1. Script (checkpointed): 3-5 scenes, short captions, which of your images each uses.
        const s1 = await begin(ctx, job.run._id, 0, "model", "Reel: script", "social_media_manager");
        let script: z.infer<typeof ReelScriptSchema>;
        if (s1.checkpoint !== undefined) script = s1.checkpoint as typeof script;
        else if (job.run.isFixture || process.env.CLIMBOS_FAKE_LLM) {
          script = { caption: `${brief} #smallbusiness`, scenes: [{ caption: brief.slice(0, 60), sub: "", assetId: reel[0]?.id ?? "", imagePrompt: "" }, { caption: "Here's how it works", sub: "", assetId: reel[1]?.id ?? "", imagePrompt: "" }], cta: "Try it today", clipPrompt: "" };
          await ctx.runMutation(internal.engine.completeStep, { stepId: s1.stepId!, output: JSON.stringify(script) });
        } else {
          const r = await modelTurn(
            {
              modelKey: CALL_ROUTES.chat_intent,
              system: [{ text: "You write scroll-stopping 10-15 second vertical videos (Reels, TikTok, Shorts) for small businesses. Hook in the first scene, one idea per scene, captions of 3-8 words people can read in 2 seconds, plain words, no hashtags in captions, no invented claims, prices or reviews." }],
              messages: [
                {
                  role: "user",
                  content: `${businessBrief(job)}${planContext(job)}\n\nREEL BRIEF: ${untrusted("owner request", brief, 600)}\n\nAVAILABLE IMAGES (use their id in assetId; prefer real screenshots and product photos):\n${reel.map((a) => `- ${a.id}: ${a.kind} · ${a.label}`).join("\n") || "(none)"}\n\nReturn JSON: caption (the post caption, 1-3 short lines + up to 5 hashtags), scenes (3-5; each with caption, sub (optional short line or ""), assetId (an id above or ""), imagePrompt (only when no image fits: a short photo prompt, no text or logos; else "")), cta (the last card, 2-5 words), and clipPrompt (a vivid 4-second vertical video shot for the opening scene: subject, action, setting, light and camera move; no text, logos or real brands).`,
                },
              ],
              schema: ReelScriptSchema,
              maxTokens: 4_000,
              effort: "low",
              timeoutMs: 90_000,
            },
            rates,
          );
          if (r.usage.calls > 0) await ctx.runMutation(internal.engine.recordUsage, { stepId: s1.stepId!, records: claudeUsageRecords(CALL_ROUTES.chat_intent, r, rates) });
          if (!r.ok) {
            await ctx.runMutation(internal.engine.failStep, { stepId: s1.stepId!, error: r.message.slice(0, 300) });
            throw new JobStop(r.kind, "The AI couldn't write this reel. Try again.");
          }
          script = r.output as typeof script;
          await ctx.runMutation(internal.engine.completeStep, { stepId: s1.stepId!, output: JSON.stringify(script) });
        }
        const scenes = script.scenes.slice(0, 5);
        // 2. Images: your own first; at most 2 generated (each up to 2 tries), metered.
        const urlFor = new Map(reel.map((a) => [a.id as string, a.url]));
        const sceneImages: (string | undefined)[] = [];
        let generated = 0;
        let attempts = 0;
        for (let i = 0; i < scenes.length; i++) {
          const own = urlFor.get(scenes[i].assetId);
          if (own) {
            sceneImages.push(own);
            continue;
          }
          if (!scenes[i].imagePrompt || generated >= 2 || job.run.isFixture || process.env.CLIMBOS_FAKE_LLM) {
            sceneImages.push(reel[i % Math.max(1, reel.length)]?.url);
            continue;
          }
          const st = await begin(ctx, job.run._id, 1 + generated, "image", `Reel: image ${generated + 1}`, "creative_director");
          generated++;
          if (st.checkpoint !== undefined) {
            sceneImages.push((st.checkpoint as string | null) ?? undefined);
            continue;
          }
          let dataUrl: string | null = null;
          for (let a = 0; a < 2 && !dataUrl; a++) {
            attempts++;
            const img = await generateImage(`Vertical 9:16 photo for ${job.business?.name ?? "a small business"}: ${scenes[i].imagePrompt}. Natural light, modern, no text, no logos, no real people's faces.`, rates);
            await ctx.runMutation(internal.engine.recordUsage, { stepId: st.stepId!, records: [{ type: "image_attempt", provider: "google", model: "gemini-3.1-flash-lite-image", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: img.costMicros, estimated: true }] });
            if (img.ok) dataUrl = `data:${img.mimeType};base64,${Buffer.from(img.bytes).toString("base64")}`;
            else if (img.kind === "provider_unavailable") break;
          }
          await ctx.runMutation(internal.engine.completeStep, { stepId: st.stepId!, output: JSON.stringify(null) });
          sceneImages.push(dataUrl ?? reel[i % Math.max(1, reel.length)]?.url);
        }
        // 2b. AI video clips (paid, Veo): the opening scene(s) become real video. Long-running: the
        // operation id is checkpointed so a fresh action keeps polling instead of paying again.
        const reelInfo = await ctx.runQuery(internal.reels.get, { reelId: args.reelId });
        const clipUrls: (string | undefined)[] = [];
        for (let k = 0; k < Math.min(reelInfo?.clips ?? 0, scenes.length) && !job.run.isFixture && !process.env.CLIMBOS_FAKE_LLM; k++) {
          const cs = await begin(ctx, job.run._id, 20 + k, "compute", `Reel: AI video clip ${k + 1}`, "creative_director");
          if (cs.checkpoint !== undefined) {
            const id = cs.checkpoint as Id<"_storage"> | null;
            clipUrls.push(id ? ((await ctx.runQuery(internal.reels.videoUrl, { storageId: id })) ?? undefined) : undefined);
            continue;
          }
          let op = await ctx.runQuery(internal.engine.stepProviderRef, { stepId: cs.stepId! });
          if (!op) {
            const prompt = k === 0 ? script.clipPrompt || `${scenes[0].caption}, vertical cinematic shot` : `${scenes[k].caption}, vertical cinematic b-roll`;
            const started = await startVeo(prompt);
            if (!started.ok) {
              await ctx.runMutation(internal.engine.completeStep, { stepId: cs.stepId!, output: JSON.stringify(null) });
              clipUrls.push(undefined);
              continue;
            }
            op = started.operation;
            await ctx.runMutation(internal.engine.setStepProviderRef, { stepId: cs.stepId!, ref: op });
          }
          let result: Awaited<ReturnType<typeof pollVeo>> = { done: false };
          while (!result.done) {
            if (Date.now() - startedAt > 7 * 60_000) throw new AgentYield(); // resume polling in a fresh action
            await sleep(10_000);
            result = await pollVeo(op);
          }
          let storageId: Id<"_storage"> | null = null;
          if ("uri" in result) {
            const bytes = await downloadVeo(result.uri);
            if (bytes) {
              storageId = await ctx.storage.store(new Blob([bytes as BlobPart], { type: "video/mp4" }));
              await ctx.runMutation(internal.engine.recordUsage, { stepId: cs.stepId!, records: [{ type: "image_attempt", provider: "google", model: VIDEO_ROUTE.apiModelId, inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: Math.ceil(VIDEO_ROUTE.clipSeconds * VIDEO_ROUTE.perSecondUsd * 1_000_000), estimated: true }] });
            }
          }
          await ctx.runMutation(internal.engine.completeStep, { stepId: cs.stepId!, output: JSON.stringify(storageId) });
          clipUrls.push(storageId ? ((await ctx.runQuery(internal.reels.videoUrl, { storageId })) ?? undefined) : undefined);
        }

        // 3. Render on our worker (not charged) and save the MP4.
        const st = await begin(ctx, job.run._id, 10, "compute", "Reel: render video", "creative_director");
        const reelDoc = await ctx.runQuery(internal.reels.get, { reelId: args.reelId });
        const brand = { name: job.business?.name ?? job.org.name, color: job.brand?.colors?.[0] ?? "#0b5d46", website: job.business?.website ?? undefined };
        const renderScenes: { caption: string; sub?: string; imageUrl?: string; videoUrl?: string; cta?: boolean }[] = [...scenes.map((s, i) => ({ caption: s.caption, sub: s.sub || undefined, imageUrl: sceneImages[i], videoUrl: clipUrls[i] })), { caption: script.cta, cta: true }];
        const secret = process.env.CLIMBOS_SERVER_SECRET;
        let storageId: Id<"_storage"> | undefined;
        let seconds: number | undefined;
        if (job.run.isFixture || process.env.CLIMBOS_FAKE_LLM || !secret) {
          seconds = renderScenes.length * 3;
        } else {
          const res = await fetch(`${(process.env.RENDER_WORKER_URL ?? process.env.SITE_URL ?? "https://climbos.app").replace(/\/$/, "")}/api/render/reel`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-climbos-secret": secret },
            body: JSON.stringify({ scenes: renderScenes, brand, secondsEach: 3, badge: reelDoc?.badge ?? true }),
          });
          const json = (await res.json().catch(() => ({}))) as { mp4?: string; seconds?: number; error?: string };
          if (!res.ok || !json.mp4) {
            await ctx.runMutation(internal.engine.failStep, { stepId: st.stepId!, error: json.error ?? `Render failed (${res.status})` });
            throw new JobStop("render_failed", "We couldn't render the video. Try again in a minute.");
          }
          storageId = await ctx.storage.store(new Blob([Buffer.from(json.mp4, "base64")], { type: "video/mp4" }));
          seconds = json.seconds;
        }
        await ctx.runMutation(internal.engine.completeStep, { stepId: st.stepId!, output: JSON.stringify({ seconds }) });
        await ctx.runMutation(internal.reels.save, {
          reelId: args.reelId,
          patch: { status: "ready", scenes: renderScenes.map((s, i) => ({ caption: s.caption, ...(s.sub ? { sub: s.sub } : {}), ...(scenes[i] && urlFor.has(scenes[i].assetId) ? { assetId: scenes[i].assetId } : {}), ...(s.cta ? { cta: true } : {}) })), caption: script.caption.slice(0, 2200), ...(storageId ? { videoStorageId: storageId } : {}), seconds },
        });
        await finish(ctx, args.runId, "verified", { output: { scenes: renderScenes.length, seconds }, meters: { imageAttempts: attempts } });
      },
      async (msg) => {
        await failReel(msg);
      },
      resumeAs(ctx, "makeReel", args),
    );
  },
});
