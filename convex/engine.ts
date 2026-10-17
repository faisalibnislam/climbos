import { v } from "convex/values";
import {
  CURRENT_ENTITLEMENTS,
  CURRENT_ROUTING,
  currentRateVersion,
  decideReservation,
  getRateVersion,
  reconcileReservation,
  stressedDeliveryCostMicros,
  usdToMicrosCeil,
} from "../shared/economics";
import type { PartialMeters } from "../shared/economics/ledger";
import { worstCaseStepMicros } from "../shared/ai/models";
import { assertTransition, type RunStatus } from "../shared/policy";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { agentRoleValidator } from "./schema";
import { chargeableAccess, fleetStopped } from "./lib/access";
import { audit } from "./lib/audit";
import { ledgerOf, ledgerPatch } from "./lib/periods";
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
}

/** Worst-case µUSD estimate for a plan of steps, including one repair of the costliest model step. */
export function estimateRun(steps: PlannedStep[], rateVersionId: string) {
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
  }
  const repair = maxModelStep; // one repair attempt allowed by default
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
  if (modelStepCount > limits.workflowModelSteps || researchCount > limits.workflowResearchTools) {
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
  const estimate = estimateRun(params.steps, rateVersion.id);
  const period = access.period;
  const decision = decideReservation(ledgerOf(period), {
    costMicros: estimate.costMicros,
    topupCostMicros: estimate.topupCostMicros,
    meters: params.meters,
  });
  if (!decision.ok) {
    throw appError("LIMIT_REACHED", decision.message, { reason: decision.reason, meter: decision.meter ?? "" });
  }
  await ctx.db.patch(period._id, ledgerPatch(decision.next));

  const now = Date.now();
  const runId = await ctx.db.insert("workflowRuns", {
    orgId: org._id,
    kind: params.kind,
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
      modelSteps: limits.workflowModelSteps,
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
    if (org.emergencyStop?.active || (await fleetStopped(ctx))) {
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
    const usingTopup = reservation.topupMicros > 0;
    const decision = decideReservation(ledgerOf(period), {
      costMicros: usingTopup ? Number.MAX_SAFE_INTEGER : costMicros,
      topupCostMicros: usingTopup ? stressedDeliveryCostMicros({ aiMicros: costMicros, imageMicros: 0, researchMicros: 0, modelSteps: 1 }) : 0,
      meters: {},
    });
    if (!decision.ok) return { ok: false as const, message: decision.message };
    await ctx.db.patch(period._id, ledgerPatch(decision.next));
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
    const actualCost = fresh.actualMicros;
    // Metered quantities come from recorded usage events, not from the caller.
    const events = await ctx.db
      .query("usageEvents")
      .withIndex("by_run", (q) => q.eq("runId", run._id))
      .take(500);
    const derived: PartialMeters = { ...(args.meters ?? {}) };
    const sumOf = (type: string) => events.filter((e) => e.type === type).reduce((s, e) => s + e.quantity, 0);
    derived.searchCalls = sumOf("search_call");
    derived.imageAttempts = sumOf("image_attempt");
    derived.scrapeCredits = sumOf("scrape_credit");
    const actualTopup = reservation.topupMicros > 0
      ? stressedDeliveryCostMicros({ aiMicros: actualCost, imageMicros: 0, researchMicros: 0, modelSteps: fresh.used.modelSteps })
      : 0;
    const { next, overageMicros } = reconcileReservation(
      ledgerOf(period),
      { walletMicros: reservation.walletMicros, topupMicros: reservation.topupMicros, meters: reservation.meters },
      { costMicros: actualCost, topupCostMicros: Math.min(actualTopup, reservation.topupMicros || actualTopup), meters: derived },
    );
    await ctx.db.patch(period._id, ledgerPatch(next));
    await ctx.db.patch(reservation._id, { status: "reconciled", actualMicros: actualCost, reconciledAt: Date.now() });
    if (overageMicros > 0) {
      await audit(ctx, { orgId: run.orgId, actorType: "system", action: "cost.overage", subjectType: "run", subjectId: run._id, summary: `Actual cost exceeded reservation by ${overageMicros} µUSD.` });
    }
    await ctx.scheduler.runAfter(0, internal.notifications.checkUsageAlerts, { periodId: period._id });
}

/** Cron: recover runs whose action died. Model steps fail; provider writes become uncertain. */
export const recoverStuckRuns = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 15 * 60_000;
    let recovered = 0;
    for (const status of ["cost_reserved", "preparing", "executing"] as const) {
      const runs = await ctx.db
        .query("workflowRuns")
        .withIndex("by_status_updated", (q) => q.eq("status", status).lt("updatedAt", cutoff))
        .take(50);
      for (const run of runs) {
        const steps = await ctx.db
          .query("workflowSteps")
          .withIndex("by_run", (q) => q.eq("runId", run._id))
          .take(50);
        let uncertain = false;
        for (const s of steps) {
          if (s.status !== "running") continue;
          if (s.kind === "provider_write") {
            uncertain = true;
            await ctx.db.patch(s._id, { status: "uncertain", error: "Interrupted; outcome must be checked with the provider" });
          } else {
            await ctx.db.patch(s._id, { status: "failed", error: "Interrupted" });
          }
        }
        await finishRunImpl(ctx, {
          runId: run._id,
          status: uncertain ? "uncertain" : "failed",
          error: "The job was interrupted.",
          userMessage: uncertain
            ? "We couldn't confirm whether the last action completed. We won't repeat it until it's checked."
            : "This job was interrupted. Nothing was published. You can try again.",
        });
        recovered++;
      }
    }
    return recovered;
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
