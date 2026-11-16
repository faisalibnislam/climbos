import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup, type T } from "./helpers";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { offerAssessmentFixture } from "../fixtures/offerAssessment";
import { campaignTimingFixture } from "../fixtures/campaignTiming";

/** Structured experiment outcomes (Book 14 §14): code labels the claim, re-analysis is appended, the next plan learns. */
async function planWithTests(t: T, email: string) {
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Outcome Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
  const ids = await t.run(async (ctx) => {
    const o = orgId as Id<"organizations">;
    const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", o)).first())!;
    const goalId = (await ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", o).eq("status", "active")).first())!._id;
    const strategyId = await ctx.db.insert("strategies", {
      orgId: o, businessId: business._id, goalId, version: 1, status: "approved", summary: "s", audiences: [], positioning: "p", channels: [], constraints: [], measurementPlan: "m", reviewDate: "2026-11-01", sourceFactIds: [], generationCostMicros: 0, createdAt: Date.now(),
    } as never);
    const exp = (name: string, method: "holdout" | "pre_post_observational") =>
      ctx.db.insert("experiments", { orgId: o, strategyId, name, hypothesis: "h", population: "past customers", method, primaryMetric: "booked calls", guardrails: [], durationDays: 14, stoppingRule: "stop if < 2 calls in 14 days", status: "running", createdAt: Date.now() });
    return { strategyId, referral: await exp("Referral ask", "pre_post_observational"), holdout: await exp("Win-back email", "holdout"), cold: await exp("Cold email", "pre_post_observational") };
  });
  return { owner, slug, orgId: orgId as Id<"organizations">, ...ids };
}

function originalDecisions(brief: string) {
  return brief.split("\n").filter(line => line.startsWith('{"strategyId":') && line.includes('"originalFocusedMove":')).map(line => JSON.parse(line));
}

function focusedExpert(fixture = focusedPlanFixture()) {
  const { diagnosis, affordableCac, notDoing, northStar, leadingIndicators, phases, weekOneChecklist, risks, focusedMove } = fixture;
  return { diagnosis, affordableCac, notDoing, northStar, leadingIndicators, phases, weekOneChecklist, risks, focusedMove, plays: [] };
}

describe("experiment outcomes", () => {
  it.each(["met", "missed", "unclear", "not_run"] as const)("carries original focused offer and timing conditions with a %s report, without treating the proposal as exposure", async outcome => {
    const t = setup(), f = await planWithTests(t, `focused-${outcome}@example.com`);
    const fixture = focusedPlanFixture(), offer = offerAssessmentFixture();
    fixture.focusedMove.offerAssessment = offer;
    fixture.focusedMove.timingAssessment = campaignTimingFixture;
    await t.run(async ctx => {
      await ctx.db.patch(f.strategyId, { expert: focusedExpert(fixture) });
      // A newer plan's changed terms must not replace the original conditions.
      const { _id: _id, _creationTime: _time, ...plan } = (await ctx.db.get(f.strategyId))!;
      await ctx.db.insert("strategies", { ...plan, version: 2, expert: { ...plan.expert!, focusedMove: { ...fixture.focusedMove, title: "New unrelated direction", offerAssessment: undefined, timingAssessment: undefined } } });
    });
    const report = { expectedRevision: 0, slug: f.slug, experimentId: f.referral, executed: outcome !== "not_run", source: "owner_report" as const, design: "none" as const, result: outcome === "not_run" ? "unclear" as const : outcome, stopRuleHit: false };
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, report);
    const brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(originalDecisions(brief)).toEqual([expect.objectContaining({ strategyId: f.strategyId, planVersion: 1, originalFocusedMove: fixture.focusedMove })]);
    expect(brief).toContain("not proof that this experiment tested the offer or used that window");
    expect(brief).not.toContain("New unrelated direction");
    if (outcome === "not_run") expect(brief).toContain("Referral ask: NOT RUN");
    else expect(brief).toContain(`reported result: ${outcome === "unclear" ? "unclear against" : outcome} its success rule`);
    const foreign = await planWithTests(t, `foreign-${outcome}@example.com`);
    expect(await t.query(internal.playResults.briefFor, { orgId: foreign.orgId })).toBe("");
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("includes one original plan context for multiple reports and explicitly omits an oversized decision intact", async () => {
    const t = setup(), f = await planWithTests(t, "focused-context-limits@example.com");
    const fixture = focusedPlanFixture();
    await t.run(ctx => ctx.db.patch(f.strategyId, { expert: focusedExpert(fixture) }));
    const report = { expectedRevision: 0, slug: f.slug, executed: true, source: "owner_report" as const, design: "none" as const, result: "unclear" as const, stopRuleHit: false };
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, experimentId: f.referral });
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, experimentId: f.holdout });
    let brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(originalDecisions(brief)).toHaveLength(1);
    expect(originalDecisions(brief)[0].originalFocusedMove).toEqual(fixture.focusedMove);
    const large = { ...fixture.focusedMove, why: "Do not truncate these historical conditions. ".repeat(300) };
    await t.run(ctx => ctx.db.patch(f.strategyId, { expert: { ...focusedExpert(fixture), focusedMove: large } }));
    brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("Original focused decision omitted in full: context limit");
    expect(brief).not.toContain("Do not truncate these historical conditions.");
    expect(brief).toContain("Referral ask");
    expect(brief).toContain("Win-back email");
    await t.run(ctx => ctx.db.patch(f.strategyId, { expert: undefined }));
    expect(await t.query(internal.playResults.briefFor, { orgId: f.orgId })).toContain('"originalFocusedMove":null');
  });

  it("retains recently reported tests after newer untested plans and keeps their original context", async () => {
    const t = setup();
    const f = await planWithTests(t, "durable-outcomes@example.com");
    await t.run(async ctx => {
      await ctx.db.patch(f.referral, { hypothesis: "A personal referral request helps repeat buyers introduce peers", population: "Repeat buyers in Dhaka", variants: [{ key: "control", description: "No request" }, { key: "change", description: "Personal referral request" }], guardrails: ["Stop on complaints"] });
      const { _id: _id, _creationTime: _time, ...plan } = (await ctx.db.get(f.strategyId))!;
      for (let i = 0; i < 6; i++) await ctx.db.insert("strategies", { ...plan, version: i + 2, createdAt: Date.now() + i });
    });
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 0, slug: f.slug, experimentId: f.referral, executed: true, source: "owner_report", design: "before_after", exposed: 100, conversions: 2, result: "unclear", stopRuleHit: false, note: "Only repeat buyers were approached" });
    const brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("Referral ask");
    expect(brief).toContain("Repeat buyers in Dhaka");
    expect(brief).toContain("A personal referral request helps repeat buyers introduce peers");
    expect(brief).toContain("No request");
    expect(brief).toContain("Stop on complaints");
    expect(brief).toContain("Only repeat buyers were approached");
    expect(brief).toContain(f.referral);
    expect(brief).toContain(f.strategyId);
    expect(brief).toContain("bounded sample");
  });

  it("bounds complete decision context across plans and excludes broken original business and goal provenance", async () => {
    const t = setup(), f = await planWithTests(t, "decision-budget@example.com");
    const other = await planWithTests(t, "decision-provenance@example.com");
    const fixture = focusedPlanFixture(); fixture.focusedMove.offerAssessment = offerAssessmentFixture(); fixture.focusedMove.timingAssessment = campaignTimingFixture;
    const ids = await t.run(async ctx => {
      const { _id: _id, _creationTime: _time, ...plan } = (await ctx.db.get(f.strategyId))!;
      const { _id: _exp, _creationTime: _expTime, ...test } = (await ctx.db.get(f.referral))!;
      const ids = [];
      for (let i = 0; i < 4; i++) {
        const strategyId = await ctx.db.insert("strategies", { ...plan, expert: focusedExpert(fixture), version: i + 2 });
        const experimentId = await ctx.db.insert("experiments", { ...test, strategyId, name: `Independent report ${i}` });
        ids.push({ strategyId, experimentId });
      }
      return ids;
    });
    for (const row of ids) await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { slug: f.slug, experimentId: row.experimentId, expectedRevision: 0, executed: true, source: "owner_report", design: "none", result: "unclear", stopRuleHit: false });
    let brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    const decisions = originalDecisions(brief), included = decisions.filter(d => d.originalFocusedMove !== null);
    expect(decisions).toHaveLength(4); expect(included).toHaveLength(2);
    expect(included.reduce((sum, record) => sum + JSON.stringify(record).length, 0)).toBeLessThanOrEqual(16000);
    expect(decisions.filter(d => d.limitation)).toHaveLength(2);
    expect(brief).toContain("Independent report 0");
    await t.run(async ctx => {
      const foreign = (await ctx.db.get(other.strategyId))!;
      await ctx.db.patch(ids[0].strategyId, { businessId: foreign.businessId });
      await ctx.db.patch(ids[1].strategyId, { goalId: foreign.goalId });
    });
    brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).not.toContain("Independent report 0"); expect(brief).not.toContain("Independent report 1");
    expect(brief).not.toContain(ids[0].strategyId); expect(brief).not.toContain(ids[1].strategyId);
    expect(originalDecisions(brief)).toHaveLength(2);
  });

  it("retrieves reported tests beyond the old ten-test limit without letting corrections crowd out other tests", async () => {
    const t = setup();
    const f = await planWithTests(t, "outcome-volume@example.com");
    const last = await t.run(async ctx => {
      const { _id: _id, _creationTime: _time, ...experiment } = (await ctx.db.get(f.referral))!;
      let id = f.referral;
      for (let i = 0; i < 20; i++) id = await ctx.db.insert("experiments", { ...experiment, name: `Later test ${i}` });
      return id;
    });
    const report = { slug: f.slug, executed: true, source: "owner_report" as const, design: "before_after" as const, exposed: 100, conversions: 2, result: "missed" as const, stopRuleHit: false };
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 0, experimentId: last });
    for (let revision = 0; revision < 45; revision++) await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: revision, experimentId: f.referral });
    const brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("Later test 19");
    expect(brief.match(/- Referral ask/g)).toHaveLength(1);
  });

  it("uses the latest original-definition report after returning to and then changing the metric again", async () => {
    const t = setup();
    const f = await planWithTests(t, "definition-return@example.com");
    const report = { slug: f.slug, experimentId: f.referral, executed: true, source: "owner_report" as const, design: "before_after" as const, result: "unclear" as const, stopRuleHit: false };
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 0, result: "met" });
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 1, metric: "replies" });
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 2, result: "missed" });
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 3, metric: "replies" });
    const brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("On the original definition it missed its success rule.");
    expect(brief).not.toContain("On the original definition it met its success rule.");
  });

  it("keeps bounded legacy coverage, deduplicates candidates and sends the original context only to strategy work", async () => {
    const t = setup();
    const f = await planWithTests(t, "legacy-context@example.com");
    const report = { slug: f.slug, experimentId: f.referral, executed: true, source: "owner_report" as const, design: "before_after" as const, result: "missed" as const, stopRuleHit: false };
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 0 });
    const ids = await t.run(async ctx => {
      await ctx.db.patch(f.referral, { outcomeReviewedAt: undefined, population: "Legacy audience", hypothesis: "Legacy mechanism" });
      const run = { orgId: f.orgId, title: "Learning context", status: "executing" as const, input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: Date.now(), updatedAt: Date.now() };
      return { strategy: await ctx.db.insert("workflowRuns", { ...run, kind: "strategy" }), content: await ctx.db.insert("workflowRuns", { ...run, kind: "content_social" }) };
    });
    let brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("Legacy audience");
    expect(brief).toContain("Older unindexed reports may be omitted");
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 1 });
    brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief.match(/- Referral ask/g)).toHaveLength(1);
    expect((await t.query(internal.jobWrites.jobContext, { runId: ids.strategy }))?.resultsText).toContain("Legacy mechanism");
    expect((await t.query(internal.jobWrites.jobContext, { runId: ids.content }))?.resultsText).toBe("");
    for (const table of ["approvals", "actionReceipts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("excludes foreign, orphaned, fixture and design-linked tests from generic learning and rejects broken source links on writes", async () => {
    const t = setup();
    const f = await planWithTests(t, "linked-outcomes@example.com");
    const other = await planWithTests(t, "foreign-outcomes@example.com");
    const report = { slug: f.slug, experimentId: f.referral, executed: true, source: "owner_report" as const, design: "before_after" as const, result: "met" as const, stopRuleHit: false };
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 0 });
    expect(await t.query(internal.playResults.briefFor, { orgId: other.orgId })).toBe("");
    await t.run(ctx => ctx.db.patch(f.referral, { strategyId: other.strategyId }));
    expect(await t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    await expect(f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 1 })).rejects.toThrow();
    await t.run(ctx => ctx.db.patch(f.referral, { strategyId: f.strategyId, orgId: other.orgId }));
    expect(await t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    const runId = await t.run(async ctx => {
      await ctx.db.patch(f.referral, { orgId: f.orgId });
      const runId = await ctx.db.insert("workflowRuns", { orgId: f.orgId, kind: "strategy", title: "Demo plan", status: "verified", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: true, createdAt: Date.now(), updatedAt: Date.now() });
      await ctx.db.patch(f.strategyId, { runId });
      return runId;
    });
    expect(await t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    await expect(f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 1 })).rejects.toThrow(/Demo plan/);
    await t.run(ctx => ctx.db.delete(runId));
    expect(await t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    await expect(f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 1 })).rejects.toThrow();
    await t.run(ctx => ctx.db.delete(f.strategyId));
    expect(await t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    await expect(f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 1 })).rejects.toThrow();
    expect((await t.run(ctx => ctx.db.get(f.referral)))?.outcomeRevision).toBe(1);
    for (const table of ["approvals", "actionReceipts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("selects recent reports with separate tested and not-run limits and does not revive superseded original results", async () => {
    const t = setup();
    const f = await planWithTests(t, "bounded-outcomes@example.com");
    await t.run(async ctx => {
      const { _id: _id, _creationTime: _time, ...template } = (await ctx.db.get(f.referral))!;
      for (let i = 0; i < 15; i++) {
        const at = Date.now() - 100_000 + i;
        await ctx.db.insert("experiments", { ...template, name: `Recorded experiment ${i}`, outcomeReviewedAt: at, analyses: [{ n: 1, executed: i < 8, source: "owner_report", design: "none", metric: template.primaryMetric, successRule: template.stoppingRule, result: i % 2 ? "missed" : "unclear", stopRuleHit: false, inference: "observed", redefined: false, reviewedAt: at, reviewedBy: f.owner.userId }] });
      }
    });
    let brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    const [tested, notRun] = brief.split("TESTS NOT RUN");
    expect(tested.match(/- Recorded experiment/g)).toHaveLength(6);
    expect(notRun.match(/- Recorded experiment/g)).toHaveLength(4);
    expect(tested).toContain("Recorded experiment 7");
    expect(tested).not.toContain("Recorded experiment 0 (");
    expect(notRun).toContain("Recorded experiment 14");
    const report = { slug: f.slug, experimentId: f.referral, executed: true, source: "owner_report" as const, design: "none" as const, result: "met" as const, stopRuleHit: false };
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 0 });
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 1, metric: "replies" });
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 2, executed: false, result: "unclear" });
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, expectedRevision: 3, metric: "replies", result: "unclear" });
    brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).not.toContain("On the original definition it met");
    expect(brief).toContain("exploratory only");
  });

  it("backfills old review timestamps in tenant-scoped pages without rewriting reports or inventing dates", async () => {
    const t = setup();
    const f = await planWithTests(t, "index-backfill@example.com");
    const other = await planWithTests(t, "index-other@example.com");
    const report = { expectedRevision: 0, slug: f.slug, experimentId: f.referral, executed: true, source: "owner_report" as const, design: "none" as const, result: "missed" as const, stopRuleHit: false };
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, report);
    await other.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...report, slug: other.slug, experimentId: other.referral });
    const before = await t.run(async ctx => {
      await ctx.db.patch(f.referral, { outcomeReviewedAt: undefined });
      await ctx.db.patch(other.referral, { outcomeReviewedAt: undefined });
      const original = (await ctx.db.get(f.referral))!;
      await ctx.db.patch(f.holdout, { analyses: [{ ...original.analyses![0], reviewedAt: Date.now() + 86_400_000 }] });
      const { _id: _id, _creationTime: _time, ...plan } = (await ctx.db.get(f.strategyId))!;
      for (let i = 0; i < 6; i++) await ctx.db.insert("strategies", { ...plan, version: i + 2 });
      return original;
    });
    expect(await t.query(internal.playResults.briefFor, { orgId: f.orgId })).toBe("");
    expect(await t.mutation(internal.migrations.experimentOutcomeReviewIndex, { orgId: f.orgId })).toMatchObject({ eligible: 1, updated: 0, skipped: 1, dryRun: true });
    expect(await t.run(ctx => ctx.db.get(f.referral))).toEqual(before);
    let cursor: string | undefined, updated = 0, pages = 0;
    do {
      const page = await t.mutation(internal.migrations.experimentOutcomeReviewIndex, { orgId: f.orgId, limit: 1, cursor, dryRun: false });
      updated += page.updated; pages++; cursor = page.cursor ?? undefined;
    } while (cursor);
    expect(pages).toBe(3); expect(updated).toBe(1);
    expect(await t.run(ctx => ctx.db.get(f.referral))).toEqual({ ...before, outcomeReviewedAt: before.analyses![0].reviewedAt });
    expect((await t.run(ctx => ctx.db.get(other.referral)))?.outcomeReviewedAt).toBeUndefined();
    expect((await t.run(ctx => ctx.db.get(f.holdout)))?.outcomeReviewedAt).toBeUndefined();
    expect(await t.query(internal.playResults.briefFor, { orgId: f.orgId })).toContain("Referral ask");
    expect(await t.mutation(internal.migrations.experimentOutcomeReviewIndex, { orgId: f.orgId, dryRun: false })).toMatchObject({ updated: 0, eligible: 0 });
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("saves an outcome with a computed label, and re-analysis never overwrites", async () => {
    const t = setup();
    const { owner, slug, referral } = await planWithTests(t, "outcome@example.com");
    const r1 = await owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 0, slug, experimentId: referral, executed: true, source: "owner_report", design: "before_after", eligible: 300, exposed: 120, conversions: 1, windowStart: "2026-09-01", windowEnd: "2026-09-14", result: "missed", stopRuleHit: true });
    expect(r1).toEqual({ n: 1, inference: "observed", newAnalysis: true, revision: 1 });
    // Same definition: a correction to analysis 1.
    const r2 = await owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 1, slug, experimentId: referral, executed: true, source: "owner_report", design: "before_after", eligible: 300, exposed: 120, conversions: 2, result: "missed", stopRuleHit: true });
    expect(r2).toMatchObject({ n: 1, newAnalysis: false });
    // Changed definition after results: a new analysis; the first stays.
    const r3 = await owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 2, slug, experimentId: referral, executed: true, source: "owner_report", design: "before_after", exposed: 120, conversions: 14, metric: "replies", result: "met", stopRuleHit: false });
    expect(r3).toMatchObject({ n: 2, newAnalysis: true });
    const e = await t.run(async (ctx) => ctx.db.get(referral));
    expect(e!.primaryMetric).toBe("booked calls");
    expect(e!.stoppingRule).toBe("stop if < 2 calls in 14 days");
    expect(e!.hypothesis).toBe("h");
    expect(e!.status).toBe("concluded");
    expect(e!.analyses!.map((a) => [a.n, a.metric, a.result, a.redefined, a.conversions])).toEqual([
      [1, "booked calls", "missed", false, 2],
      [2, "replies", "met", true, 14],
    ]);
  });

  it("rejects bad counts, other workspaces and a comparison claim with no group", async () => {
    const t = setup();
    const { owner, slug, holdout } = await planWithTests(t, "bad@example.com");
    await expect(owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 0, slug, experimentId: holdout, executed: true, source: "owner_report", design: "holdout", exposed: 10, conversions: 11, controlSize: 5, result: "met", stopRuleHit: false })).rejects.toThrow(/more than exposed/);
    await expect(owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 0, slug, experimentId: holdout, executed: true, source: "owner_report", design: "holdout", exposed: 10, conversions: 1, result: "met", stopRuleHit: false })).rejects.toThrow(/comparison group size/);
    const other = await planWithTests(t, "other@example.com");
    await expect(other.owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 0, slug: other.slug, experimentId: holdout, executed: false, source: "owner_report", design: "none", result: "unclear", stopRuleHit: false })).rejects.toThrow(/couldn't find/);
  });

  it("feeds reported outcomes into later plans without upgrading reports to verified causal effects", async () => {
    const t = setup();
    const { owner, slug, orgId, referral, holdout, cold } = await planWithTests(t, "brief@example.com");
    expect(await t.query(internal.playResults.briefFor, { orgId })).toBe("");
    await owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 0, slug, experimentId: referral, executed: true, source: "owner_report", design: "before_after", eligible: 300, exposed: 120, conversions: 6, result: "met", stopRuleHit: false });
    await owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 0, slug, experimentId: holdout, executed: true, source: "integration", design: "holdout", assignment: "random", eligible: 300, exposed: 200, conversions: 20, controlSize: 100, controlConversions: 5, plannedSharePct: 200 / 3, result: "met", stopRuleHit: false });
    await owner.client.mutation(api.playResults.recordExperimentOutcome, { expectedRevision: 0, slug, experimentId: cold, executed: false, source: "owner_report", design: "none", result: "unclear", stopRuleHit: false, note: "No time" });
    const brief = await t.query(internal.playResults.briefFor, { orgId });
    const line = (name: string) => brief.split("\n").find((l) => l.startsWith(`- ${name}`))!;
    expect(line("Referral ask")).toContain("OBSERVED: 6 conversions from 120 exposed of 300 eligible; no validated comparison, so not proof of cause.");
    expect(line("Referral ask")).not.toMatch(/incremental/i);
    // Not significant (p ≈ 0.18), so the brief compares without claiming extra conversions.
    expect(line("Win-back email")).toContain("REPORTED RANDOMIZED COMPARISON (holdout): 20/200 exposed (10%) vs 5/100 in the comparison group (5%): No reliable difference");
    expect(line("Win-back email")).not.toMatch(/incremental conversions/);
    // An unexecuted test is kept out of the lessons.
    const [lessons, notRun] = brief.split("TESTS NOT RUN");
    expect(lessons).not.toContain("Cold email");
    expect(notRun).toContain("Cold email: NOT RUN");
  });

  it("preserves unknown assignment, rejects invalid dates, and cannot grant actions or let viewers record outcomes", async () => {
    const t = setup();
    const f = await planWithTests(t, "integrity@example.com");
    const args = { expectedRevision: 0, slug: f.slug, experimentId: f.holdout, executed: true, source: "integration" as const, design: "randomized" as const, exposed: 300, conversions: 15, controlSize: 300, controlConversions: 60, result: "missed" as const, stopRuleHit: false };
    const before = await t.run(ctx => ctx.db.get(f.holdout));
    await expect(f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, windowStart: "2026-02-30" })).rejects.toThrow(/YYYY-MM-DD/);
    expect(await t.run(ctx => ctx.db.get(f.holdout))).toEqual(before);
    const viewer = await asNewUser(t, "viewer-outcome@example.com");
    await t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await expect(viewer.client.mutation(api.playResults.recordExperimentOutcome, args)).rejects.toThrow();
    expect(await f.owner.client.mutation(api.playResults.recordExperimentOutcome, args)).toMatchObject({ inference: "observed" });
    const unknown = (await t.run(ctx => ctx.db.get(f.holdout)))!.analyses!.at(-1)!;
    expect(unknown.assignment).toBeUndefined();
    expect(unknown.plannedSharePct).toBeUndefined();
    let brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("RANDOMIZATION UNVERIFIED");
    expect(brief).toContain("Member-entered; reported source: connected tool");
    expect(brief).not.toContain("INCREMENTAL");
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, expectedRevision: 1, assignment: "random", plannedSharePct: 50 });
    brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toMatch(/difference of -45 conversions.*95% interval -\d+ to -\d+/);
    expect(brief).toContain("not proof of causal impact");
    // Historical labels must not move a not-run report into the lessons section.
    await t.run(async ctx => {
      const e = (await ctx.db.get(f.holdout))!;
      await ctx.db.patch(e._id, { analyses: [{ ...e.analyses!.at(-1)!, executed: false, inference: "incremental" }] });
    });
    const [lessons, notRun] = (await t.query(internal.playResults.briefFor, { orgId: f.orgId })).split("TESTS NOT RUN");
    expect(lessons).not.toContain("Win-back email");
    expect(notRun).toContain("Win-back email: NOT RUN");
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toHaveLength(0);
  });
});


describe("recoverable outcome history", () => {
  it("retains corrections and changed definitions without feeding superseded counts to future plans", async () => {
    const t = setup();
    const f = await planWithTests(t, "history@example.com");
    const args = { slug: f.slug, experimentId: f.referral, executed: true, source: "owner_report" as const, design: "before_after" as const, exposed: 100, conversions: 1, result: "missed" as const, stopRuleHit: false };
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, expectedRevision: 0 });
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, expectedRevision: 1, conversions: 4, result: "met" });
    const brief = await t.query(internal.playResults.briefFor, { orgId: f.orgId });
    expect(brief).toContain("4 conversions from 100");
    expect(brief).not.toContain("1 conversions from 100");
    await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, expectedRevision: 2, metric: "qualified inquiries", result: "unclear" });
    const page = await f.owner.client.query(api.playResults.outcomeHistoryPage, { slug: f.slug, experimentId: f.referral, paginationOpts: { cursor: null, numItems: 10 } });
    expect(page.page.map(r => [r.revision, r.kind, r.analysis.n, r.analysis.conversions, r.current])).toEqual([[3, "reanalysis", 2, 1, true], [2, "correction", 1, 4, false], [1, "recorded", 1, 1, false]]);
    expect(page.page[1].changedFields).toEqual(["conversions", "result"]);
    expect(page.page[0].analysis).not.toHaveProperty("reviewedBy");
    expect((await t.run(ctx => ctx.db.get(f.referral)))!.analyses).toHaveLength(2);
    const prior = await t.run(ctx => ctx.db.query("experimentOutcomeRevisions").collect());
    await expect(f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, expectedRevision: 2 })).rejects.toThrow(/Close and reopen/);
    expect(await t.run(ctx => ctx.db.query("experimentOutcomeRevisions").collect())).toEqual(prior);
    for (const table of ["approvals", "actionReceipts", "workflowRuns"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toHaveLength(0);
  });

  it("preserves available legacy analyses, pages reports, restricts tenants and includes history in export and deletion", async () => {
    const t = setup();
    const f = await planWithTests(t, "legacy-history@example.com");
    const other = await planWithTests(t, "other-history@example.com");
    const analysis = { n: 1, executed: true, source: "owner_report" as const, design: "before_after" as const, exposed: 10, conversions: 1, metric: "booked calls", successRule: "stop if < 2 calls in 14 days", result: "missed" as const, stopRuleHit: false, inference: "observed" as const, redefined: false, reviewedBy: f.owner.userId, reviewedAt: 1234 };
    await t.run(ctx => ctx.db.patch(f.referral, { analyses: [analysis] }));
    const args = { slug: f.slug, experimentId: f.referral, executed: false, source: "owner_report" as const, design: "none" as const, result: "unclear" as const, stopRuleHit: false };
    let r = await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, expectedRevision: 0 });
    expect(r.revision).toBe(2);
    for (let i = 0; i < 10; i++) r = await f.owner.client.mutation(api.playResults.recordExperimentOutcome, { ...args, expectedRevision: r.revision, note: `Correction ${i}` });
    const query = { slug: f.slug, experimentId: f.referral, paginationOpts: { cursor: null as string | null, numItems: 10 } };
    const first = await f.owner.client.query(api.playResults.outcomeHistoryPage, query);
    expect(first.page).toHaveLength(10);
    expect(first.isDone).toBe(false);
    const second = await f.owner.client.query(api.playResults.outcomeHistoryPage, { ...query, paginationOpts: { cursor: first.continueCursor, numItems: 10 } });
    expect(second.isDone).toBe(true);
    expect(second.page.map(r => r.revision)).toEqual([2, 1]);
    expect(second.page[1]).toMatchObject({ kind: "legacy_snapshot", analysis: { conversions: 1, reviewedAt: 1234 } });
    await expect(other.owner.client.query(api.playResults.outcomeHistoryPage, { ...query, slug: other.slug })).rejects.toThrow(/couldn't find/);
    const viewer = await asNewUser(t, "history-viewer@example.com");
    await t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    expect((await viewer.client.query(api.playResults.outcomeHistoryPage, query)).page).toHaveLength(10);
    await expect(viewer.client.mutation(api.playResults.recordExperimentOutcome, { ...args, expectedRevision: r.revision })).rejects.toThrow();
    const data = JSON.parse(await t.query(internal.settings.exportData, { orgId: f.orgId }));
    expect(data.experimentOutcomeRevisions).toHaveLength(12);
    expect(data.experimentOutcomeHistoryLimited).toBe(false);
    const otherData = JSON.parse(await t.query(internal.settings.exportData, { orgId: other.orgId }));
    expect(otherData.experimentOutcomeRevisions).toEqual([]);
    await t.mutation(internal.settings.purgeWorkspaceBatch, { orgId: f.orgId });
    expect(await t.run(ctx => ctx.db.query("experimentOutcomeRevisions").withIndex("by_org", q => q.eq("orgId", f.orgId)).collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get(other.referral))).not.toBeNull();
  });
});
