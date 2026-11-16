import { currentBusinessModelEvidence } from "./lib/businessModelEvidence";
import { BusinessModelEvidenceSchema, businessModelFreshness, readBusinessModelEvidence } from "../shared/agents/businessModelFreshness";
import { latestBusinessModelTests, parsedModelCheck } from "./lib/businessModelTests";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { ACTIVE_RUN_STATUSES, assertNoActiveRun, createRunWithReservation, latestRunsOfKind } from "./engine";
import { audit } from "./lib/audit";
import { planJob, maxJobMicros } from "./lib/jobPlans";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { can } from "../shared/policy";
import { CREATIVE_PRECEDENTS } from "../shared/knowledge/creativePrecedents";
import { BusinessModelCheckSchema, businessModelTestSubject } from "../shared/agents/businessModel";

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
    return { title: plan.title, maxCostMicros: maxJobMicros(plan, { fixture }) };
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

/** Freeze the evidence identity once, before the first model step; resumed runs cannot rebind it. */
export const captureEvidence = internalMutation({
  args: { runId: v.id("workflowRuns"), hashes: v.record(v.string(), v.string()), contextHash: v.string() },
  handler: async (ctx, { runId, hashes, contextHash }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.kind !== KIND || !ACTIVE_RUN_STATUSES.includes(run.status)) throw appError("INVALID", "This business model check is not running.");
    const existing = readBusinessModelEvidence(run.input);
    if (existing) return existing;
    const input = JSON.parse(run.input || "{}");
    const step = await ctx.db.query("workflowSteps").withIndex("by_run", q => q.eq("runId", runId)).first();
    if (input.businessModelEvidence !== undefined || step) throw appError("INVALID", "This check has earlier work without a usable input snapshot. Start a new check; earlier progress is retained.");
    const snapshot = BusinessModelEvidenceSchema.parse({ version: 1, capturedAt: Date.now(), hashes, contextHash });
    await ctx.db.patch(runId, { input: JSON.stringify({ ...input, businessModelEvidence: snapshot }) });
    return snapshot;
  },
});

/** The latest finished check with its test records, plus any check still running. */
export const latest = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const runs = await latestRunsOfKind(ctx, org._id, KIND, 10);
    const running = runs.find((r) => ACTIVE_RUN_STATUSES.includes(r.status)) ?? null;
    const done = runs.find((r) => r.status === "verified" && typeof r.output === "string" && (org.kind === "demo" || !r.isFixture));
    let check = null;
    if (done?.output) {
      try {
        const parsed = BusinessModelCheckSchema.safeParse(JSON.parse(done.output));
        check = parsed.success ? parsed.data : null;
      } catch {
        check = null;
      }
    }
    const now = Date.now();
    const freshness = done && check ? businessModelFreshness(readBusinessModelEvidence(done.input), await currentBusinessModelEvidence(ctx, org, now), now) : null;
    const tests = done ? await latestBusinessModelTests(ctx, org._id, done._id) : [];
    const latestTest = (target: string) => tests.find((t) => t.target === target);
    return {
      canEdit: can(role, "edit"),
      running: running ? { runId: running._id, status: running.status, createdAt: running.createdAt } : null,
      result: done && check ? {
        runId: done._id,
        createdAt: done.createdAt,
        isFixture: Boolean(done.isFixture),
        check,
        freshness,
        precedents: CREATIVE_PRECEDENTS.filter((p) => check.alternatives.some((a) => a.precedentIds?.includes(p.id))).map((p) => ({ id: p.id, title: p.title, mechanism: p.mechanism, causalLimit: p.causalLimit, accessedAt: p.accessedAt, sources: p.sources.map((s) => ({ title: s.title, url: s.url })) })),
        tests: Object.fromEntries((["deciding", "grounded", "adjacent", "bold"] as const).flatMap((target) => {
          const t = latestTest(target);
          return t ? [[target, { id: t._id, testState: t.testState, outcome: t.outcome ?? null, outcomeNote: t.outcomeNote ?? null, outcomeEvidence: t.outcomeEvidence, ownerDecision: t.ownerDecision, createdAt: t.createdAt }]] : [];
        })),
      } : null,
    };
  },
});

/** Append-only owner reports, including superseded decisions, tied to their original hypotheses. */
export const testHistory = query({
  args: { slug: v.string(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { slug, paginationOpts }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    if (!Number.isInteger(paginationOpts.numItems) || paginationOpts.numItems < 1 || paginationOpts.numItems > 50) throw appError("INVALID", "Load between 1 and 50 test reports at a time.");
    const result = await ctx.db.query("businessModelTests").withIndex("by_org_created", q => q.eq("orgId", org._id)).order("desc").paginate(paginationOpts);
    const page = await Promise.all(result.page.map(async row => {
      const run = await ctx.db.get(row.runId);
      if (!run || run.orgId !== org._id || (org.kind !== "demo" && run.isFixture)) return null;
      const check = parsedModelCheck(run);
      const subject = check ? businessModelTestSubject(check, row.target) : null;
      return { id: row._id, runId: row.runId, checkCreatedAt: run.createdAt, createdAt: row.createdAt, target: row.target,
        subject, testState: row.testState, outcome: row.outcome ?? null, outcomeNote: row.outcomeNote ?? null,
        outcomeEvidence: row.outcomeEvidence, ownerDecision: row.ownerDecision, isFixture: Boolean(run.isFixture) };
    }));
    return { ...result, page: page.filter(row => row !== null) };
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
    outcome: v.optional(v.union(v.literal("met"), v.literal("missed"), v.literal("unclear"), v.literal("not_run"))),
    expectedPreviousId: v.optional(v.union(v.id("businessModelTests"), v.null())),
    ownerDecision: v.union(v.literal("undecided"), v.literal("keep_current_model"), v.literal("keep_testing"), v.literal("adopt_alternative"), v.literal("drop_alternative")),
  },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const run = assertSameOrg(await ctx.db.get(a.runId), org._id, "business model check");
    if (run.kind !== KIND || run.status !== "verified") throw appError("INVALID", "Record test results on a finished business model check.");
    if (run.isFixture && org.kind !== "demo") throw appError("INVALID", "Demo model checks cannot accept real business outcomes.");
    const check = parsedModelCheck(run);
    if (!check || !businessModelTestSubject(check, a.target)) throw appError("INVALID", "The original test could not be read. Keep the earlier report and run a new check before recording a result.");
    const previous = (await latestBusinessModelTests(ctx, org._id, run._id)).find(row => row.target === a.target);
    if (a.expectedPreviousId !== undefined && (previous?._id ?? null) !== a.expectedPreviousId) throw appError("INVALID", "Another test update was saved while you were editing. Reload the saved result before making a new update.");
    const note = a.outcomeNote?.trim().slice(0, 600) || undefined;
    if (a.testState === "observed" && !note) throw appError("INVALID", "Add what you observed.");
    if (a.outcomeEvidence !== "unknown" && a.testState !== "observed") throw appError("INVALID", "Evidence applies to an observed result.");
    if (a.outcome && a.outcome !== "not_run" && a.testState !== "observed") throw appError("INVALID", "Met, missed or unclear applies to an observed result.");
    if (a.outcome === "not_run" && (a.testState === "run" || a.testState === "observed")) throw appError("INVALID", "A running or observed test cannot be marked not run.");
    if ((a.ownerDecision === "adopt_alternative" || a.ownerDecision === "drop_alternative") && a.target === "deciding") throw appError("INVALID", "Choose an alternative to adopt or drop.");
    const reportId = await ctx.db.insert("businessModelTests", { orgId: org._id, runId: run._id, target: a.target, testState: a.testState, ...(note ? { outcomeNote: note } : {}), outcomeEvidence: a.outcomeEvidence, ...(a.outcome ? { outcome: a.outcome } : {}), ownerDecision: a.ownerDecision, createdBy: user._id, createdAt: Date.now() });
    await ctx.db.patch(run._id, { lastBusinessModelTestAt: Date.now() });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "business_model.test_recorded", subjectType: "workflowRun", subjectId: run._id, summary: `Recorded ${a.target} test: ${a.testState}, outcome ${(a.outcome ?? "not_recorded").replace(/_/g, " ")}, ${a.ownerDecision.replace(/_/g, " ")}.` });
    return reportId;
  },
});
