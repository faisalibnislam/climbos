import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import type { TurnRequest } from "../../shared/ai/types";
import type { RateVersion } from "../../shared/economics/rates";
const state = vi.hoisted(() => ({ requests: [] as TurnRequest[], failTruth: false, refusedTarget: false }));
vi.mock("../../shared/ai/turn", async original => ({
  ...await original<typeof import("../../shared/ai/turn")>(),
  modelTurn: async (req: TurnRequest, rates: RateVersion) => {
    state.requests.push(req);
    const days = Number(JSON.stringify(req.messages).match(/EXECUTION CYCLE: (14|30|90) days/)?.[1] ?? 14);
    const plan = focusedPlanFixture(days);
    if (state.refusedTarget) plan.preparedWork[0] = { ...plan.preparedWork[0], kind: "creator_pitch", target: "Creator.example — suggest our product" };
    if (req.schema?.safeParse(plan).success) {
      const text = JSON.stringify(plan);
      return { ok: true, output: plan, text, appended: [{ role: "assistant", content: text }], usage: { inputTokens: 100, outputTokens: 500, thinkingTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, webFetches: 0, calls: 1 }, costMicros: 1000, sources: [], actualModelId: "synthetic-test-sonnet", stopReason: "end_turn" };
    }
    const { fakeTurn } = await import("../../shared/agents/fake");
    const result = await fakeTurn(req, rates);
    if (result.ok && state.failTruth && typeof result.output === "object" && result.output && "gates" in result.output) {
      (result.output as { gates: { id: string; pass: boolean; note: string }[] }).gates.find(g => g.id === "G1")!.pass = false;
    }
    return result;
  },
}));
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.CLIMBOS_FAKE_LLM; delete process.env.CLIMBOS_ENGINE; state.requests = []; state.failTruth = false; state.refusedTarget = false; });

async function workspace() {
  const t = setup(); delete process.env.CLIMBOS_FAKE_LLM; delete process.env.CLIMBOS_ENGINE;
  process.env.ANTHROPIC_API_KEY = "synthetic-unit-test-key";
  const owner = await asNewUser(t, "focused-owner@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Focused Test" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Find a repeatable way to earn paying customers", horizonDays: 14, monthlyAdBudget: 0 });
  await makePaid(t, orgId, 500_000_000);
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.patch(business._id, { website: "https://business.example/" });
  });
  await t.mutation(internal.engine.putResearchCache, { orgId, businessWebsite: "https://business.example/", cacheKey: "a".repeat(64), agentId: "business_insights", modelKey: "claude-haiku-5.5", notes: "Synthetic public-source notes for a workflow integration test. No measured demand.", sources: [{ url: "https://business.example/" }], expiresAt: Date.now() + 86400000 });
  return { t, owner, slug, orgId };
}
it("runs the real focused path with a matching quote, reuses bound research and prepared drafts, and preserves tenant/approval gates", async () => {
  const { t, owner, slug, orgId } = await workspace();
  const quote = await owner.client.query(api.workspace.planQuote, { slug, planStyle: "focused" });
  const { runId } = await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const saved = await t.run(async ctx => ({ run: (await ctx.db.get(runId))!, plan: (await ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first())! }));
  expect(saved.run.status).toBe("verified"); expect(saved.run.estimateMicros).toBe(quote.reserveMicros);
  expect(saved.plan.expert?.focusedMove?.title).toBe(focusedPlanFixture().focusedMove.title);
  expect(saved.plan.expert?.strategyExploration).toMatchObject({
    grounded: { title: "Review one past handoff" }, adjacent: { title: "Borrow a production call sheet" },
    bold: { title: "Become known for the brief you decline", precedentIds: [], evidenceStrength: "low", feasibility: "low" },
    requestedRange: "balanced", promptVersion: "focused-exploration-v1", promptHash: expect.stringMatching(/^[a-f0-9]{64}$/), inputHash: expect.stringMatching(/^[a-f0-9]{64}$/), retrievedPrecedentIds: expect.any(Array),
  });
  expect(JSON.stringify(state.requests[0].messages)).toContain("PROTECTED STRATEGY EXPLORATION");
  expect(JSON.stringify(state.requests[0].messages)).toContain("BOUNDED CREATIVE PRECEDENT RETRIEVAL");
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("approvals").collect())).toMatchObject([{ status: "pending", actionKind: "approve_plan" }]);
  expect(saved.plan.expert?.quality?.state).not.toBe("failed"); expect(saved.plan.expert?.plays).toHaveLength(0);
  expect(state.requests).toHaveLength(2); expect(state.requests.every(r => !r.webSearch)).toBe(true);
  await expect(owner.client.mutation(api.workspace.startPlay, { slug, strategyId: saved.plan._id, playId: "focused" })).rejects.toThrow(/approve/);
  const before = await t.run(ctx => ctx.db.query("workflowRuns").collect());
  const work = await owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved.plan._id, decision: "approve" });
  expect(work?.covered).toEqual(["Proposed intake example"]); expect(work?.started).toEqual([]);
  await owner.client.mutation(api.workspace.startPlay, { slug, strategyId: saved.plan._id, playId: "focused" });
  await owner.client.mutation(api.workspace.startPlay, { slug, strategyId: saved.plan._id, playId: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  expect(await t.run(ctx => ctx.db.query("workflowRuns").collect())).toHaveLength(before.length);
  const outsider = await asNewUser(t, "outside-focused@example.com");
  await expect(outsider.client.mutation(api.workspace.startPlay, { slug, strategyId: saved.plan._id, playId: "focused" })).rejects.toThrow();
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "A materially changed goal", horizonDays: 30, monthlyAdBudget: 0 });
  await expect(owner.client.mutation(api.workspace.startPlay, { slug, strategyId: saved.plan._id, playId: "focused" })).rejects.toThrow(/goal/);
  await owner.client.mutation(api.creativeStrategy.recordFeedback, { slug, strategyId: saved.plan._id, mode: "bold", decision: "rejected", ownerEdit: "Owner preference: investigate scoping rituals without publicly declining work.", testState: "not_started", outcomeEvidence: "unknown" });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  expect(JSON.stringify(state.requests.at(-2)?.messages)).toContain("Owner preference: investigate scoping rituals without publicly declining work.");
  expect(JSON.stringify(state.requests.at(-2)?.messages)).toContain("a prior rejection never bans bold exploration");
  expect(JSON.stringify(state.requests.at(-2)?.messages)).toContain("original proposal and test conditions");
  expect(JSON.stringify(state.requests.at(-2)?.messages)).toContain("Unresolved scoping decisions identified");
});
it("keeps critical review failures blocked even when a short draft passes schema", async () => {
  const { t, owner, slug, orgId } = await workspace(); state.failTruth = true;
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" }); await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality?.state).toBe("failed");
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
});
it("does not reuse another website's or another tenant's cached evidence", async () => {
  const { t, owner, slug } = await workspace();
  const { runId } = await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.run(async ctx => { const run = (await ctx.db.get(runId))!; const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", run.orgId)).first())!; await ctx.db.patch(b._id, { website: "https://changed.example/" }); });
  expect((await t.query(internal.jobWrites.jobContext, { runId }))?.focusedResearch).toBeNull();
  // No model call needed to inspect this cache boundary.
});

it("enforces a cached source refusal even when the AI critic approves the draft", async () => {
  const { t, owner, slug, orgId } = await workspace(); state.refusedTarget = true;
  await t.run(async ctx => { const cache = (await ctx.db.query("researchCache").withIndex("by_org_created", q => q.eq("orgId", orgId)).first())!; await ctx.db.patch(cache._id, { sources: [{ url: "https://creator.example/contact", productPitchPolicy: { status: "refused", evidence: "We do not accept marketing partnerships." } }] }); });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" }); await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality?.state).toBe("failed");
  expect(plan.expert?.quality?.hard.some(rule => rule.includes("contact_policy"))).toBe(true);
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
});

it.each([30, 90])("preserves the %i-day financial scenario while AI chooses independent delivery timing", async days => {
  const { t, owner, slug, orgId } = await workspace();
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Find a repeatable way to earn paying customers", horizonDays: days, monthlyAdBudget: 0 });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused", creativeRange: "surprising" }); await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality?.state).not.toBe("failed");
  expect(plan.expert?.phases.map(phase => phase.days)).toEqual(focusedPlanFixture(14).phases.map(phase => phase.days));
  expect(plan.expert?.snapshot?.horizonDays).toBe(days);
  expect(plan.expert?.timing?.firstReview.maxDays).toBe(14);
  expect(JSON.stringify(state.requests[0].messages)).not.toContain("EXECUTION CYCLE:");
  expect(JSON.stringify(state.requests[0].messages)).toContain("CREATIVITY PREFERENCE: surprising");
});
