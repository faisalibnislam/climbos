import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { ACTIVE_RUN_STATUSES, assertNoActiveRun, createRunWithReservation, latestRunsOfKind } from "./engine";
import { audit } from "./lib/audit";
import { estimateJobMicros, planJob } from "./lib/jobPlans";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { can } from "../shared/policy";
import { BusinessModelCheckSchema } from "../shared/agents/businessModel";

/**
 * Business model check (owner decision 2026-10-25): owner-started and metered; later plans read the latest result.
 * Results are AI judgment for owner review; nothing here changes prices, offers, or operations.
 */

const KIND = "business_model_check";
const targetV = v.union(v.literal("deciding"), v.literal("grounded"), v.literal("adjacent"), v.literal("bold"));

/** Maximum credit cost shown before the owner starts a check. */
export const estimate = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const fixture = org.kind === "demo";
    const plan = planJob(KIND, {}, { fixture, mode: "basic" });
    return { title: plan.title, maxCostMicros: estimateJobMicros(plan, { fixture }) };
  },
});

export const start = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) throw appError("NOT_FOUND", "Add your business first.");
    await assertNoActiveRun(ctx, org._id, KIND, "A business model check is already running.");
    const fixture = org.kind === "demo";
    const plan = planJob(KIND, {}, { fixture, mode: "basic" });
    const runId = await createRunWithReservation(ctx, { org, kind: plan.kind, title: plan.title, roles: plan.roles, input: {}, steps: plan.steps, meters: plan.meters, createdBy: user._id, isFixture: fixture, aiMode: "basic" });
    await ctx.scheduler.runAfter(0, internal.jobs.businessModelCheck, { runId });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "business_model.check_started", subjectType: "workflowRun", subjectId: runId, summary: "Started a business model check." });
    return { runId };
  },
});

/** The latest finished check with its test records, plus any check still running. */
export const latest = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const runs = await latestRunsOfKind(ctx, org._id, KIND, 10);
    const running = runs.find((r) => ACTIVE_RUN_STATUSES.includes(r.status)) ?? null;
    const done = runs.find((r) => r.status === "verified" && typeof r.output === "string");
    let check = null;
    if (done?.output) {
      try {
        const parsed = BusinessModelCheckSchema.safeParse(JSON.parse(done.output));
        check = parsed.success ? parsed.data : null;
      } catch {
        check = null;
      }
    }
    const tests = done ? await ctx.db.query("businessModelTests").withIndex("by_run_target", (q) => q.eq("runId", done._id)).take(200) : [];
    const latestTest = (target: string) => tests.filter((t) => t.target === target).sort((a, b) => b.createdAt - a.createdAt || b._creationTime - a._creationTime)[0];
    return {
      canEdit: can(role, "edit"),
      running: running ? { runId: running._id, status: running.status, createdAt: running.createdAt } : null,
      result: done && check ? {
        runId: done._id,
        createdAt: done.createdAt,
        isFixture: Boolean(done.isFixture),
        check,
        tests: Object.fromEntries((["deciding", "grounded", "adjacent", "bold"] as const).flatMap((target) => {
          const t = latestTest(target);
          return t ? [[target, { testState: t.testState, outcomeNote: t.outcomeNote ?? null, outcomeEvidence: t.outcomeEvidence, ownerDecision: t.ownerDecision, createdAt: t.createdAt }]] : [];
        })),
      } : null,
    };
  },
});

/** Owner-recorded progress and result of a check's deciding test or an alternative's test. */
export const recordTest = mutation({
  args: {
    slug: v.string(),
    runId: v.id("workflowRuns"),
    target: targetV,
    testState: v.union(v.literal("not_started"), v.literal("designed"), v.literal("run"), v.literal("observed")),
    outcomeNote: v.optional(v.string()),
    outcomeEvidence: v.union(v.literal("measured"), v.literal("owner_reported"), v.literal("unknown")),
    ownerDecision: v.union(v.literal("undecided"), v.literal("keep_current_model"), v.literal("keep_testing"), v.literal("adopt_alternative"), v.literal("drop_alternative")),
  },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const run = assertSameOrg(await ctx.db.get(a.runId), org._id, "business model check");
    if (run.kind !== KIND || run.status !== "verified") throw appError("INVALID", "Record test results on a finished business model check.");
    const note = a.outcomeNote?.trim().slice(0, 600) || undefined;
    if (a.testState === "observed" && !note) throw appError("INVALID", "Add what you observed.");
    if (a.outcomeEvidence !== "unknown" && a.testState !== "observed") throw appError("INVALID", "Evidence applies to an observed result.");
    if ((a.ownerDecision === "adopt_alternative" || a.ownerDecision === "drop_alternative") && a.target === "deciding") throw appError("INVALID", "Choose an alternative to adopt or drop.");
    await ctx.db.insert("businessModelTests", { orgId: org._id, runId: run._id, target: a.target, testState: a.testState, ...(note ? { outcomeNote: note } : {}), outcomeEvidence: a.outcomeEvidence, ownerDecision: a.ownerDecision, createdBy: user._id, createdAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "business_model.test_recorded", subjectType: "workflowRun", subjectId: run._id, summary: `Recorded ${a.target} test: ${a.testState}, ${a.ownerDecision.replace(/_/g, " ")}.` });
  },
});
