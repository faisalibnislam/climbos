import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import {
  CURRENT_ENTITLEMENTS,
  CURRENT_ROUTING,
  currentRateVersion,
  getRateVersion,
  microsToCredits,
  stressedDeliveryCostMicros,
  usdToMicrosCeil,
} from "../shared/economics";
import type { PartialMeters } from "../shared/economics/ledger";
import { VIDEO_ROUTE, worstCaseStepMicros } from "../shared/ai/models";
import { assertTransition, type RunStatus } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { agentRoleValidator } from "./schema";
import { chargeableAccess, fleetStopped } from "./lib/access";
import { audit } from "./lib/audit";
import { reserveCredits, settleCredits, tryReserveCredits } from "./lib/credits";
import { appError } from "./lib/tenancy";

/**
 * Durable job engine. A run is created with an atomic worst-case cost
 * reservation, executes as checkpointed steps (each recorded before and after
 * its external call), and is reconciled exactly once. Provider calls happen
 * only in actions; every state change here is a transactional mutation.
 */

const plannedStepValidator = v.object({
  kind: v.union(v.literal("model"), v.literal("research"), v.literal("image"), v.literal("provider_write"), v.literal("compute")),
  role: v.optional(agentRoleValidator),
  modelKey: v.optional(v.string()),
  inputBudget: v.optional(v.number()),
  outputBudget: v.optional(v.number()),
  webSearches: v.optional(v.number()),
  scrapeCredits: v.optional(v.number()),
  imageAttempts: v.optional(v.number()),
});

const metersValidator = v.object({
  socialPosts: v.optional(v.number()),
  imageAttempts: v.optional(v.number()),
  deliveredImages: v.optional(v.number()),
  searchCalls: v.optional(v.number()),
  scrapeCredits: v.optional(v.number()),
  transactionalEmails: v.optional(v.number()),
  byoMarketingSends: v.optional(v.number()),
  analyticsEvents: v.optional(v.number()),
  supportMinutes: v.optional(v.number()),
});

const ACTIVE: RunStatus[] = ["cost_reserved", "preparing", "executing"];
const MAX_ACTIVE_RUNS = CURRENT_ENTITLEMENTS.limits.interactiveAiJobs + CURRENT_ENTITLEMENTS.limits.queuedBackgroundJobs;

export interface PlannedStep {
  kind: "model" | "research" | "image" | "provider_write" | "compute";
  role?: Doc<"workflowSteps">["role"];
  modelKey?: string;
  inputBudget?: number;
  outputBudget?: number;
  webSearches?: number;
  scrapeCredits?: number;
  imageAttempts?: number;
  /** AI video seconds (Veo), priced per second. */
  videoSeconds?: number;
}

/**
 * Worst-case µUSD estimate for a plan of steps. v1 single-call jobs also
 * reserve one repair of the costliest model step; Engine v2 agents reserve
 * each revision round separately when it starts, so they pass repair: false.
 */
export function estimateRun(steps: PlannedStep[], rateVersionId: string, opts: { repair?: boolean } = {}) {
  const rates = getRateVersion(rateVersionId);
  let ai = 0;
  let image = 0;
  let research = 0;
  let maxModelStep = 0;
  let modelSteps = 0;
  for (const s of steps) {
    if (s.kind === "model" && s.modelKey) {
      const c = worstCaseStepMicros(s.modelKey as never, s.inputBudget ?? 0, s.outputBudget ?? 0, rates);
      ai += c;
      maxModelStep = Math.max(maxModelStep, c);
      modelSteps++;
    }
    if (s.webSearches) research += usdToMicrosCeil(s.webSearches * rates.services.searchCall);
    if (s.scrapeCredits) research += usdToMicrosCeil(s.scrapeCredits * rates.services.scrapeCredit);
    if (s.imageAttempts) image += usdToMicrosCeil(s.imageAttempts * rates.services.imageAttempt);
    if (s.videoSeconds) image += usdToMicrosCeil(s.videoSeconds * VIDEO_ROUTE.perSecondUsd);
  }
  const repair = opts.repair === false ? 0 : maxModelStep;
  const costMicros = ai + repair + image + research;
  const topupCostMicros = stressedDeliveryCostMicros({
    aiMicros: ai + repair,
    imageMicros: image,
    researchMicros: research,
    modelSteps: modelSteps + 1,
  });
  return { costMicros, topupCostMicros, modelSteps };
}

async function patchRunStatus(ctx: MutationCtx, run: Doc<"workflowRuns">, to: RunStatus, extra: Partial<Doc<"workflowRuns">> = {}) {
  if (run.status !== to) assertTransition(run.status, to);
  await ctx.db.patch(run._id, { status: to, updatedAt: Date.now(), ...extra });
}

/**
 * Create a run with an atomic reservation. Throws LIMIT_REACHED / PAUSED /
 * PAYMENT_REQUIRED style errors with plain-language messages.
 */
/** Job kinds that exist only as Engine v2 agents. */
export const AGENT_ONLY_KINDS = new Set(["social_calendar", "outbound"]);

export async function createRunWithReservation(
  ctx: MutationCtx,
  params: {
    org: Doc<"organizations">;
    kind: string;
    title: string;
    roles: NonNullable<Doc<"workflowSteps">["role"]>[];
    input: unknown;
    steps: PlannedStep[];
    meters: PartialMeters;
    createdBy?: Id<"users">;
    isFixture: boolean;
    /** Climb AI mode (resolve with resolveAiMode). Absent = basic. */
    aiMode?: "basic" | "expert";
  },
): Promise<Id<"workflowRuns">> {
  const { org } = params;
  const access = await chargeableAccess(ctx, org);
  if (!access.allowed) {
    throw appError(access.code === "PAUSED" || access.code === "FLEET_STOP" ? "PAUSED" : "PAYMENT_REQUIRED", access.message, {
      reason: access.code,
    });
  }
  const limits = CURRENT_ENTITLEMENTS.limits;
  const modelStepCount = params.steps.filter((s) => s.kind === "model").length;
  const researchCount = params.steps.filter((s) => s.kind === "research").length;
  // Engine v2 agents plan up to 7 model calls each (research, drafts, critiques); every call is still metered and reserved.
  const maxModelSteps = Math.max(limits.workflowModelSteps, 24);
  if (modelStepCount > maxModelSteps || researchCount > limits.workflowResearchTools) {
    throw appError("LIMIT_REACHED", "This job is bigger than a single run allows. Split it into smaller requests.");
  }

  let active = 0;
  for (const status of ACTIVE) {
    const rows = await ctx.db
      .query("workflowRuns")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", status))
      .take(MAX_ACTIVE_RUNS + 1);
    active += rows.length;
  }
  if (active >= MAX_ACTIVE_RUNS) {
    throw appError("RATE_LIMITED", "Your team is busy with several jobs. This will be possible as soon as one finishes.");
  }

  const rateVersion = currentRateVersion();
  // Agent-only jobs (no single-call version) always run on Engine v2 outside demos.
  const v2 = (process.env.CLIMBOS_ENGINE === "v2" && !params.isFixture) || (!params.isFixture && AGENT_ONLY_KINDS.has(params.kind));
  const estimate = estimateRun(params.steps, rateVersion.id, { repair: !v2 });
  const period = access.period;
  // Team rule: jobs above the workspace's approval limit need an owner or admin to start them.
  if (org.creditApprovalLimit !== undefined && params.createdBy && microsToCredits(estimate.costMicros) > org.creditApprovalLimit) {
    const m = await ctx.db.query("memberships").withIndex("by_org_user", (q) => q.eq("orgId", org._id).eq("userId", params.createdBy!)).unique();
    if (m && m.role !== "owner" && m.role !== "admin") {
      throw appError("FORBIDDEN", `Jobs over ${org.creditApprovalLimit} credits need an owner or admin to start them.`, { reason: "approval_limit", title: params.title.slice(0, 120), credits: microsToCredits(estimate.costMicros) });
    }
  }
  const decision = await reserveCredits(ctx, { org, period, costMicros: estimate.costMicros, meters: params.meters });

  const now = Date.now();
  const runId = await ctx.db.insert("workflowRuns", {
    orgId: org._id,
    kind: params.kind,
    ...(v2 ? { engine: "v2" as const } : {}),
    ...(params.aiMode === "expert" ? { aiMode: "expert" as const } : {}),
    title: params.title,
    status: "cost_reserved",
    input: JSON.stringify(params.input),
    roles: params.roles,
    estimateMicros: estimate.costMicros,
    actualMicros: 0,
    rateVersionId: rateVersion.id,
    entitlementVersionId: period.entitlementVersionId,
    routingVersionId: CURRENT_ROUTING.id,
    budget: {
      // Engine v2 runs may add revision rounds (reserved as they happen).
      modelSteps: process.env.CLIMBOS_ENGINE === "v2" && !params.isFixture ? 24 : Math.max(limits.workflowModelSteps, modelStepCount + 1),
      researchTools: limits.workflowResearchTools,
      repairs: limits.workflowRepairAttempts,
    },
    used: { modelSteps: 0, researchTools: 0, repairs: 0 },
    isFixture: params.isFixture,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  const reservationId = await ctx.db.insert("usageReservations", {
    orgId: org._id,
    periodId: period._id,
    runId,
    purpose: params.kind,
    walletMicros: decision.walletMicros,
    topupMicros: decision.topupMicros,
    meters: params.meters,
    status: "held",
    createdAt: now,
  });
  await ctx.db.patch(runId, { reservationId });
  return runId;
}

export const getRun = internalQuery({
  args: { runId: v.id("workflowRuns") },
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run) return null;
    const org = await ctx.db.get(run.orgId);
    return { run, org };
  },
});

/** Begin (or resume) a step. Returns a checkpoint if it already succeeded. */
export const beginStep = internalMutation({
  args: {
    runId: v.id("workflowRuns"),
    index: v.number(),
    kind: plannedStepValidator.fields.kind,
    label: v.string(),
    role: v.optional(agentRoleValidator),
    isRepair: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return { proceed: false as const, reason: "missing" };
    const org = await ctx.db.get(run.orgId);
    if (!org) return { proceed: false as const, reason: "missing" };
    const key = `${run.orgId}:${run._id}:s${args.index}`;
    const existing = await ctx.db
      .query("workflowSteps")
      .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", key))
      .unique();
    if (existing?.status === "succeeded") {
      return { proceed: false as const, reason: "checkpoint", checkpoint: existing.output ?? "null", stepId: existing._id };
    }
    if (run.status === "canceled" || run.status === "paused") return { proceed: false as const, reason: run.status };
    // Suspended or deleted workspaces stop mid-job too (staff suspension, deletion).
    if (org.emergencyStop?.active || org.suspendedAt || org.deletedAt || (await fleetStopped(ctx))) {
      return { proceed: false as const, reason: "paused" };
    }
    const used = { ...run.used };
    if (args.kind === "model") {
      if (args.isRepair) {
        if (used.repairs >= run.budget.repairs) return { proceed: false as const, reason: "repair_budget" };
        used.repairs++;
      } else {
        if (used.modelSteps >= run.budget.modelSteps) return { proceed: false as const, reason: "step_budget" };
        used.modelSteps++;
      }
    }
    if (args.kind === "research") {
      if (used.researchTools >= run.budget.researchTools) return { proceed: false as const, reason: "research_budget" };
      used.researchTools++;
    }
    const now = Date.now();
    if (run.status === "cost_reserved") await patchRunStatus(ctx, run, "preparing");
    await ctx.db.patch(run._id, { used, updatedAt: now });
    if (existing) {
      // A previous attempt crashed or failed. Provider writes are never blindly retried.
      if (existing.kind === "provider_write" && existing.status === "running") {
        await ctx.db.patch(existing._id, { status: "uncertain", error: "Outcome unknown after interruption" });
        return { proceed: false as const, reason: "uncertain" };
      }
      await ctx.db.patch(existing._id, { status: "running", attempt: existing.attempt + 1, leaseUntil: now + 5 * 60_000, startedAt: now });
      return { proceed: true as const, stepId: existing._id, idempotencyKey: key };
    }
    const stepId = await ctx.db.insert("workflowSteps", {
      orgId: run.orgId,
      runId: run._id,
      index: args.index,
      kind: args.kind,
      role: args.role,
      label: args.label,
      status: "running",
      idempotencyKey: key,
      attempt: 1,
      leaseUntil: now + 5 * 60_000,
      costMicros: 0,
      startedAt: now,
    });
    return { proceed: true as const, stepId, idempotencyKey: key };
  },
});

const usageRecordValidator = v.object({
  type: v.union(
    v.literal("model_call"),
    v.literal("image_attempt"),
    v.literal("search_call"),
    v.literal("scrape_credit"),
    v.literal("cache_read"),
    v.literal("cache_write"),
  ),
  provider: v.string(),
  model: v.optional(v.string()),
  inputTokens: v.number(),
  outputTokens: v.number(),
  reasoningTokens: v.number(),
  cacheReadTokens: v.number(),
  cacheWriteTokens: v.number(),
  quantity: v.number(),
  costMicros: v.number(),
  estimated: v.boolean(),
});

/** Record usage for a step (also used for failed calls that still cost money). */
export const recordUsage = internalMutation({
  args: { stepId: v.id("workflowSteps"), records: v.array(usageRecordValidator) },
  handler: async (ctx, { stepId, records }) => {
    const step = await ctx.db.get(stepId);
    if (!step) return;
    const run = await ctx.db.get(step.runId);
    if (!run) return;
    const reservation = run.reservationId ? await ctx.db.get(run.reservationId) : null;
    let total = 0;
    for (const r of records) {
      total += r.costMicros;
      await ctx.db.insert("usageEvents", {
        ...r,
        orgId: run.orgId,
        periodId: reservation?.periodId,
        runId: run._id,
        stepId,
        role: step.role,
        createdAt: Date.now(),
      });
    }
    await ctx.db.patch(stepId, { costMicros: step.costMicros + total, provider: records[0]?.provider, model: records[0]?.model });
    await ctx.db.patch(run._id, { actualMicros: run.actualMicros + total, updatedAt: Date.now() });
  },
});

export const completeStep = internalMutation({
  args: { stepId: v.id("workflowSteps"), output: v.optional(v.string()) },
  handler: async (ctx, { stepId, output }) => {
    await ctx.db.patch(stepId, {
      status: "succeeded",
      output: output && output.length < 400_000 ? output : undefined,
      finishedAt: Date.now(),
      leaseUntil: undefined,
    });
  },
});

export const failStep = internalMutation({
  args: { stepId: v.id("workflowSteps"), error: v.string(), uncertain: v.optional(v.boolean()) },
  handler: async (ctx, { stepId, error, uncertain }) => {
    await ctx.db.patch(stepId, {
      status: uncertain ? "uncertain" : "failed",
      error: error.slice(0, 500),
      finishedAt: Date.now(),
      leaseUntil: undefined,
    });
  },
});

/** Reserve more before a fallback route. Fails closed when capacity is gone. */
export const reserveAdditional = internalMutation({
  args: { runId: v.id("workflowRuns"), costMicros: v.number() },
  handler: async (ctx, { runId, costMicros }) => {
    const run = await ctx.db.get(runId);
    if (!run?.reservationId) return { ok: false as const, message: "No reservation for this run." };
    const reservation = await ctx.db.get(run.reservationId);
    const period = reservation ? await ctx.db.get(reservation.periodId) : null;
    if (!reservation || !period || reservation.status !== "held") return { ok: false as const, message: "Reservation is not active." };
    const org = await ctx.db.get(run.orgId);
    if (!org) return { ok: false as const, message: "Workspace not found." };
    const decision = await tryReserveCredits(ctx, { org, period, costMicros, meters: {} });
    if (!decision.ok) return { ok: false as const, message: decision.message };
    await ctx.db.patch(reservation._id, {
      walletMicros: reservation.walletMicros + decision.walletMicros,
      topupMicros: reservation.topupMicros + decision.topupMicros,
    });
    await ctx.db.patch(run._id, { estimateMicros: run.estimateMicros + costMicros, updatedAt: Date.now() });
    return { ok: true as const };
  },
});

/**
 * Finish a run and reconcile its reservation exactly once. Uncertain
 * outcomes keep the reservation "unresolved" until an operator reconciles.
 */
const finishArgs = {
  runId: v.id("workflowRuns"),
  status: v.union(v.literal("verified"), v.literal("failed"), v.literal("uncertain"), v.literal("needs_approval"), v.literal("canceled")),
  output: v.optional(v.string()),
  error: v.optional(v.string()),
  userMessage: v.optional(v.string()),
  meters: v.optional(metersValidator),
};

export const finishRun = internalMutation({ args: finishArgs, handler: (ctx, args) => finishRunImpl(ctx, args) });

export async function finishRunImpl(
  ctx: MutationCtx,
  args: {
    runId: Id<"workflowRuns">;
    status: "verified" | "failed" | "uncertain" | "needs_approval" | "canceled";
    output?: string;
    error?: string;
    userMessage?: string;
    meters?: PartialMeters;
  },
): Promise<void> {
    const run = await ctx.db.get(args.runId);
    if (!run) return;
    if (run.status === args.status) return;
    if (["verified", "failed", "canceled"].includes(run.status)) return; // already finished: idempotent
    // Runs that never started go straight to the terminal state.
    if (run.status === "cost_reserved" && args.status !== "canceled" && args.status !== "failed") {
      await patchRunStatus(ctx, run, "preparing");
    }
    const fresh = (await ctx.db.get(run._id))!;
    await patchRunStatus(ctx, fresh, args.status, {
      output: args.output,
      error: args.error?.slice(0, 500),
      userMessage: args.userMessage,
      finishedAt: Date.now(),
    });

    const reservation = run.reservationId ? await ctx.db.get(run.reservationId) : null;
    if (!reservation || reservation.status !== "held") return;
    if (args.status === "uncertain") {
      await ctx.db.patch(reservation._id, { status: "unresolved" });
      await audit(ctx, { orgId: run.orgId, actorType: "system", action: "reservation.unresolved", subjectType: "run", subjectId: run._id, summary: `Run "${run.title}" ended with an uncertain outcome; cost held for review.` });
      return;
    }
    const period = await ctx.db.get(reservation.periodId);
    if (!period) return;
    // A retried run settles only what it used since its last finish.
    const settled = fresh.settled ?? { micros: 0, searchCalls: 0, imageAttempts: 0, scrapeCredits: 0 };
    const actualCost = Math.max(0, fresh.actualMicros - settled.micros);
    // Metered quantities come from recorded usage events, not from the caller.
    const events = await ctx.db
      .query("usageEvents")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .take(500);
    const derived: PartialMeters = { ...(args.meters ?? {}) };
    const sumOf = (type: string) => events.filter((e) => e.type === type).reduce((s, e) => s + e.quantity, 0);
    const totals = { micros: fresh.actualMicros, searchCalls: sumOf("search_call"), imageAttempts: sumOf("image_attempt"), scrapeCredits: sumOf("scrape_credit") };
    derived.searchCalls = Math.max(0, totals.searchCalls - settled.searchCalls);
    derived.imageAttempts = Math.max(0, totals.imageAttempts - settled.imageAttempts);
    derived.scrapeCredits = Math.max(0, totals.scrapeCredits - settled.scrapeCredits);
    const { overageMicros } = await settleCredits(ctx, {
      orgId: run.orgId,
      period,
      reservation: { walletMicros: reservation.walletMicros, topupMicros: reservation.topupMicros, meters: reservation.meters },
      actualMicros: actualCost,
      meters: derived,
    });
    await ctx.db.patch(reservation._id, { status: "reconciled", actualMicros: actualCost, reconciledAt: Date.now() });
    await ctx.db.patch(run._id, { settled: totals });
    if (overageMicros > 0) {
      await audit(ctx, { orgId: run.orgId, actorType: "system", action: "cost.overage", subjectType: "run", subjectId: run._id, summary: `Actual cost exceeded reservation by ${overageMicros} µUSD.` });
    }
    await ctx.scheduler.runAfter(0, internal.notifications.checkUsageAlerts, { periodId: period._id });
}

/* ---------------- resume from checkpoints ---------------- */

/** Job actions that continue a run from its checkpoints (finished steps are skipped). */
const RESUMABLE = new Set(["onboardingResearch", "buildStrategy", "createContent", "planSocialWeek", "findCustomers", "conversionAudit", "simplePlanJob", "makeReel"]);
/** Automatic resumes after an interrupted action before the run fails. */
export const MAX_AUTO_RESUMES = 2;
/** Owner retries of one run. */
export const MAX_RETRIES = 3;

export async function scheduleResume(ctx: MutationCtx, run: Doc<"workflowRuns">): Promise<boolean> {
  const r = run.resumeWith;
  if (!r || !RESUMABLE.has(r.fn)) return false;
  const ref = (internal.jobs as unknown as Record<string, FunctionReference<"action", "internal">>)[r.fn];
  if (!ref) return false;
  await ctx.scheduler.runAfter(0, ref, JSON.parse(r.args) as Record<string, unknown>);
  return true;
}

/** Remember how to continue a run (set by the job action the first time it runs). */
export const noteResume = internalMutation({
  args: { runId: v.id("workflowRuns"), fn: v.string(), args: v.string() },
  handler: async (ctx, { runId, fn, args }) => {
    const run = await ctx.db.get(runId);
    if (!run || (run.resumeWith?.fn === fn && run.resumeWith.args === args)) return;
    await ctx.db.patch(runId, { resumeWith: { fn, args } });
  },
});

/**
 * Reopen a failed run so it continues from its last finished step: reserve
 * what's left of the estimate, put the run back in progress and restart its
 * job action. Interrupted or failed steps run again; finished ones are reused.
 */
export async function reopenFailedRun(ctx: MutationCtx, run: Doc<"workflowRuns">, org: Doc<"organizations">): Promise<void> {
  if (run.status !== "failed") throw appError("INVALID", "Only a stopped job can be retried.");
  if (!run.resumeWith || !RESUMABLE.has(run.resumeWith.fn)) throw appError("INVALID", "This job can't continue. Start it again.");
  if ((run.retries ?? 0) >= MAX_RETRIES) throw appError("LIMIT_REACHED", "This job has been retried several times. Start it again or contact us.");
  const steps = await ctx.db.query("workflowSteps").withIndex("by_run", (q) => q.eq("runId", run._id)).take(60);
  if (steps.some((s) => s.status === "uncertain")) throw appError("INVALID", "We can't confirm whether the last action finished, so we won't repeat it.");
  const access = await chargeableAccess(ctx, org);
  if (!access.allowed) {
    throw appError(access.code === "PAUSED" || access.code === "FLEET_STOP" ? "PAUSED" : "PAYMENT_REQUIRED", access.message, { reason: access.code });
  }
  let active = 0;
  for (const status of ACTIVE) {
    const rows = await ctx.db.query("workflowRuns").withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", status)).take(MAX_ACTIVE_RUNS + 1);
    active += rows.length;
  }
  if (active >= MAX_ACTIVE_RUNS) throw appError("RATE_LIMITED", "Your team is busy with several jobs. Retry as soon as one finishes.");

  // Reserve the rest of the estimate (at least a third of it: the unfinished step runs again).
  const remaining = Math.max(run.estimateMicros - run.actualMicros, Math.ceil(run.estimateMicros / 3));
  const old = run.reservationId ? await ctx.db.get(run.reservationId) : null;
  const settled = run.settled ?? { micros: 0, searchCalls: 0, imageAttempts: 0, scrapeCredits: 0 };
  const meters: PartialMeters = {};
  for (const [k, n] of Object.entries(old?.meters ?? {})) {
    const used = k === "searchCalls" || k === "imageAttempts" || k === "scrapeCredits" ? settled[k] : 0;
    const left = Math.max(0, (n ?? 0) - used);
    if (left > 0) meters[k as keyof PartialMeters] = left;
  }
  const period = access.period;
  const decision = await reserveCredits(ctx, { org, period, costMicros: remaining, meters });
  const now = Date.now();
  const reservationId = await ctx.db.insert("usageReservations", {
    orgId: org._id,
    periodId: period._id,
    runId: run._id,
    purpose: run.kind,
    walletMicros: decision.walletMicros,
    topupMicros: decision.topupMicros,
    meters,
    status: "held",
    createdAt: now,
  });
  // A deliberate exception to "failed is terminal": the owner chose to continue this run.
  await ctx.db.patch(run._id, {
    status: "preparing",
    reservationId,
    error: undefined,
    userMessage: undefined,
    finishedAt: undefined,
    resumes: 0,
    retries: (run.retries ?? 0) + 1,
    // Room for the steps that run again.
    budget: { ...run.budget, modelSteps: run.budget.modelSteps + 6, researchTools: run.budget.researchTools + 4 },
    updatedAt: now,
  });
  await audit(ctx, { orgId: org._id, actorType: "user", action: "run.retried", subjectType: "run", subjectId: run._id, summary: `Retried "${run.title}" from its last finished step.` });
  await scheduleResume(ctx, (await ctx.db.get(run._id))!);
}

/**
 * Cron: recover runs whose action died. A resumable run continues from its
 * checkpoints (up to MAX_AUTO_RESUMES times); otherwise model steps fail and
 * provider writes become uncertain.
 */
export const recoverStuckRuns = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let recovered = 0;
    for (const status of ["cost_reserved", "preparing", "executing"] as const) {
      // An action runs at most 10 minutes, so a running job silent for 11 is dead.
      const cutoff = now - (status === "cost_reserved" ? 15 : 11) * 60_000;
      const runs = await ctx.db
        .query("workflowRuns")
        .withIndex("by_status_updated", (q) => q.eq("status", status).lt("updatedAt", cutoff))
        .take(50);
      for (const run of runs) {
        const steps = await ctx.db
          .query("workflowSteps")
          .withIndex("by_run", (q) => q.eq("runId", run._id))
          .take(60);
        let uncertain = false;
        for (const s of steps) {
          if (s.status !== "running") continue;
          if (s.kind === "provider_write") {
            uncertain = true;
            await ctx.db.patch(s._id, { status: "uncertain", error: "Interrupted; outcome must be checked with the provider" });
          } else {
            await ctx.db.patch(s._id, { status: "failed", error: "Interrupted", finishedAt: now });
          }
        }
        if (!uncertain && status !== "cost_reserved" && (run.resumes ?? 0) < MAX_AUTO_RESUMES && (await scheduleResume(ctx, run))) {
          await ctx.db.patch(run._id, { resumes: (run.resumes ?? 0) + 1, updatedAt: now });
          await audit(ctx, { orgId: run.orgId, actorType: "system", action: "run.resumed", subjectType: "run", subjectId: run._id, summary: `"${run.title}" was interrupted and continued from its last finished step.` });
          recovered++;
          continue;
        }
        await finishRunImpl(ctx, {
          runId: run._id,
          status: uncertain ? "uncertain" : "failed",
          error: "The job was interrupted.",
          userMessage: uncertain
            ? "We couldn't confirm whether the last action completed. We won't repeat it until it's checked."
            : "This job was interrupted. Nothing was published. Retry continues from where it stopped.",
        });
        recovered++;
      }
    }
    return recovered;
  },
});

/** Save a run's quick first take (shown in the progress panel until the full result lands). */
export const setRunPreview = internalMutation({
  args: { runId: v.id("workflowRuns"), preview: v.string() },
  handler: async (ctx, { runId, preview }) => {
    await ctx.db.patch(runId, { preview: preview.slice(0, 4000) });
  },
});

/** Background response id for a long model turn (so a resumed action polls it instead of paying again). */
export const stepProviderRef = internalQuery({
  args: { stepId: v.id("workflowSteps") },
  handler: async (ctx, { stepId }) => (await ctx.db.get(stepId))?.providerRef ?? null,
});

export const setStepProviderRef = internalMutation({
  args: { stepId: v.id("workflowSteps"), ref: v.optional(v.string()) },
  handler: async (ctx, { stepId, ref }) => {
    await ctx.db.patch(stepId, { providerRef: ref, leaseUntil: Date.now() + 10 * 60_000 });
  },
});

export const cancelRun = internalMutation({
  args: { runId: v.id("workflowRuns"), reason: v.string() },
  handler: async (ctx, { runId, reason }) => {
    const run = await ctx.db.get(runId);
    if (!run || !["proposed", "cost_reserved", "needs_approval", "approved", "scheduled", "paused"].includes(run.status)) return false;
    await finishRunImpl(ctx, { runId, status: "canceled", error: reason, userMessage: reason });
    return true;
  },
});
