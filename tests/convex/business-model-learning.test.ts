import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { businessModelLearning } from "../../convex/lib/businessModelTests";
import { demoBusinessModelCheck } from "../../shared/agents/businessModel";
import { asNewUser, setup } from "./helpers";
import type { Id } from "../../convex/_generated/dataModel";

async function fixture() {
  const t = setup(), owner = await asNewUser(t, "learning-owner@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Model learning" });
  const org = orgId as Id<"organizations">;
  const seed = (name: string, createdAt = Date.now(), isFixture = false) => t.run(ctx => {
    const check = demoBusinessModelCheck(name);
    check.alternatives.find(a => a.mode === "bold")!.name = name;
    return ctx.db.insert("workflowRuns", { orgId: org, kind: "business_model_check", title: name, status: "verified", input: "{}", output: JSON.stringify(check), roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture, createdAt, updatedAt: createdAt });
  });
  const runId = await seed("Original bold mechanism");
  const base = { slug, runId, target: "bold" as const, testState: "observed" as const, outcomeNote: "Original audience test report", outcomeEvidence: "owner_reported" as const, ownerDecision: "keep_testing" as const };
  const learning = () => t.run(async ctx => businessModelLearning(ctx, org, await ctx.db.query("workflowRuns").withIndex("by_org_kind_created", q => q.eq("orgId", org).eq("kind", "business_model_check")).order("desc").take(10)));
  return { t, owner, slug, org, runId, seed, base, learning };
}

describe("business model outcome learning", () => {
  it.each(["met", "missed", "unclear", "not_run"] as const)("preserves %s as an owner classification tied to the original test", async outcome => {
    const f = await fixture();
    const id = await f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, outcome, ...(outcome === "not_run" ? { testState: "not_started", outcomeEvidence: "unknown" } : {}), expectedPreviousId: null });
    const latest = await f.owner.client.query(api.businessModel.latest, { slug: f.slug });
    expect(latest.result?.tests.bold).toMatchObject({ id, outcome });
    const learned = await f.learning();
    expect(JSON.parse(learned.notes[0])).toMatchObject({ checkId: f.runId, reportId: id, originalProposal: "Original bold mechanism", outcome });
    expect(learned.summary).toContain("not independently verified");
    expect(learned.summary).toContain("Not-run and unclear outcomes cannot establish effectiveness");
    expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
    expect(await f.t.run(ctx => ctx.db.query("approvals").collect())).toEqual([]);
  });
  it.each([
    { testState: "run" as const, outcome: "met" as const },
    { testState: "designed" as const, outcome: "missed" as const },
    { testState: "not_started" as const, outcome: "unclear" as const },
    { testState: "observed" as const, outcome: "not_run" as const },
    { testState: "run" as const, outcome: "not_run" as const },
  ])("rejects contradictory $testState / $outcome", async args => {
    const f = await fixture();
    await expect(f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, ...args, outcomeEvidence: "unknown" })).rejects.toThrow(/observed result|cannot be marked/);
    expect(await f.t.run(ctx => ctx.db.query("businessModelTests").collect())).toEqual([]);
  });
  it("keeps a legacy missing outcome unknown even when the owner chose adoption", async () => {
    const f = await fixture();
    await f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, ownerDecision: "adopt_alternative", outcomeEvidence: "measured" });
    const learned = await f.learning();
    expect(JSON.parse(learned.notes[0])).toMatchObject({ outcome: "not_recorded", evidence: "measured", ownerDecision: "adopt_alternative" });
    expect(learned.summary).toContain("not success/failure evidence");
    const history = await f.owner.client.query(api.businessModel.testHistory, { slug: f.slug, paginationOpts: { numItems: 12, cursor: null } });
    expect(history.page[0].outcome).toBeNull();
  });
  it("preserves append-only corrections and rejects a stale form before inserting another report", async () => {
    const f = await fixture();
    const oldId = await f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, outcome: "met", expectedPreviousId: null });
    const id = await f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, outcome: "missed", outcomeNote: "Corrected after reviewing the original records", expectedPreviousId: oldId });
    await expect(f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, outcome: "met", expectedPreviousId: oldId })).rejects.toThrow(/Another test update/);
    expect((await f.t.run(ctx => ctx.db.get(oldId)))?.outcome).toBe("met");
    expect(JSON.parse((await f.learning()).notes[0])).toMatchObject({ reportId: id, outcome: "missed" });
    const history = await f.owner.client.query(api.businessModel.testHistory, { slug: f.slug, paginationOpts: { numItems: 1, cursor: null } });
    expect(history.page.map(row => row.id)).toEqual([id]);
    const older = await f.owner.client.query(api.businessModel.testHistory, { slug: f.slug, paginationOpts: { numItems: 1, cursor: history.continueCursor } });
    expect(older.page.map(row => row.id)).toEqual([oldId]);
  });
  it("lets only one concurrent first report use the empty-form version", async () => {
    const f = await fixture();
    const attempts = await Promise.allSettled(["met", "missed"].map(outcome => f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, outcome: outcome as "met" | "missed", expectedPreviousId: null })));
    expect(attempts.filter(a => a.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(a => a.status === "rejected")).toHaveLength(1);
    expect(await f.t.run(ctx => ctx.db.query("businessModelTests").collect())).toHaveLength(1);
  });
  it("retains three reported checks, including the old bold mechanism, without attaching it to a new proposal", async () => {
    const f = await fixture(); const now = Date.now();
    await f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, outcome: "missed" });
    for (let i = 1; i <= 2; i++) {
      const runId = await f.seed(`Separate proposal ${i}`, now + i);
      await f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, runId, outcome: "unclear" });
    }
    await f.seed("Newest untested proposal", now + 10);
    const learned = await f.learning();
    const records = learned.notes.map(note => JSON.parse(note));
    expect(records.map(r => r.originalProposal)).toEqual(["Separate proposal 2", "Separate proposal 1", "Original bold mechanism"]);
    expect(records.at(-1)).toMatchObject({ checkId: f.runId, outcome: "missed" });
    expect(learned.summary).toContain("older history may be omitted");
    for (let i = 0; i < 10; i++) await f.seed(`Unreported check ${i}`, now + 20 + i);
    expect((await f.learning()).notes.map(note => JSON.parse(note).originalProposal)).toEqual(["Separate proposal 2", "Separate proposal 1", "Original bold mechanism"]);
    expect((await f.owner.client.query(api.businessModel.testHistory, { slug: f.slug, paginationOpts: { numItems: 12, cursor: null } })).page).toHaveLength(3);
  });
  it("supports viewer history, denies outsiders and rejects cross-tenant reports", async () => {
    const f = await fixture(), stranger = await asNewUser(f.t, "stranger@example.com"), viewer = await asNewUser(f.t, "viewer@example.com");
    const other = await stranger.client.mutation(api.orgs.createWorkspace, { businessName: "Other business" });
    await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.org, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, outcome: "met" });
    expect((await viewer.client.query(api.businessModel.testHistory, { slug: f.slug, paginationOpts: { numItems: 12, cursor: null } })).page).toHaveLength(1);
    await expect(stranger.client.query(api.businessModel.testHistory, { slug: f.slug, paginationOpts: { numItems: 12, cursor: null } })).rejects.toThrow();
    await expect(viewer.client.mutation(api.businessModel.recordTest, f.base)).rejects.toThrow();
    await expect(stranger.client.mutation(api.businessModel.recordTest, { ...f.base, slug: other.slug })).rejects.toThrow();
    expect((await stranger.client.query(api.businessModel.testHistory, { slug: other.slug, paginationOpts: { numItems: 12, cursor: null } })).page).toEqual([]);
  });
  it("rejects invalid source checks and excludes fixture outcomes from real learning/history", async () => {
    const f = await fixture();
    const malformed = demoBusinessModelCheck("Ambiguous modes");
    malformed.alternatives[0].mode = "bold";
    await f.t.run(ctx => ctx.db.patch(f.runId, { output: JSON.stringify(malformed) }));
    await expect(f.owner.client.mutation(api.businessModel.recordTest, f.base)).rejects.toThrow(/original test/);
    const demoId = await f.seed("Fixture proposal", Date.now() + 1, true);
    await expect(f.owner.client.mutation(api.businessModel.recordTest, { ...f.base, runId: demoId })).rejects.toThrow(/Demo model checks/);
    await f.t.run(async ctx => {
      await ctx.db.insert("businessModelTests", { orgId: f.org, runId: demoId, target: "bold", testState: "observed", outcome: "met", outcomeNote: "Fixture winner", outcomeEvidence: "measured", ownerDecision: "adopt_alternative", createdBy: f.owner.userId, createdAt: Date.now() });
      await ctx.db.patch(f.runId, { output: "{}" });
    });
    await expect(f.owner.client.mutation(api.businessModel.recordTest, f.base)).rejects.toThrow(/original test/);
    expect((await f.learning()).notes).toEqual([]);
    expect((await f.owner.client.query(api.businessModel.testHistory, { slug: f.slug, paginationOpts: { numItems: 12, cursor: null } })).page).toEqual([]);
  });
});
