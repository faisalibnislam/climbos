import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { futureCampaignTimingFixture, evergreenTimingFixture, timingFacts, timingUrl } from "../fixtures/campaignTiming";
import { offerAssessmentFixture, offerFact } from "../fixtures/offerAssessment";
import { approvedPlanOfferTerms } from "../../shared/agents/approvedPlanContext";
import type { TurnRequest } from "../../shared/ai/types";
import type { RateVersion } from "../../shared/economics/rates";
const state = vi.hoisted(() => ({ requests: [] as TurnRequest[], reviewScores: "", failTruth: false, unsupportedStateClaim: false, refusedTarget: false, unsupportedGuarantee: false, wrongLearningTest: false, offerMode: "", timingMode: "", demandMode: "", citationReference: "", explorationReference: "", dismissedChannel: false, emailMode: "" }));
vi.mock("../../shared/ai/turn", async original => ({
  ...await original<typeof import("../../shared/ai/turn")>(),
  modelTurn: async (req: TurnRequest, rates: RateVersion) => {
    state.requests.push(req);
    const days = Number(JSON.stringify(req.messages).match(/EXECUTION CYCLE: (14|30|90) days/)?.[1] ?? 14);
    const plan = focusedPlanFixture(days);
    if (state.unsupportedStateClaim) plan.strategicDirection.whyThisBusiness = "The business has no audience.";
    if (state.emailMode) plan.focusedMove.firstAction = state.emailMode === "draft" ? "Draft an email for your newsletter subscribers for owner review." : "Email your list about the proposed intake handoff.";
    if (state.dismissedChannel) plan.channels[0] = { ...plan.channels[0], key: "seo_content", name: "Blog articles" };
    if (state.explorationReference) {
      if (state.explorationReference.startsWith("CP-")) plan.strategyExploration.bold.precedentIds = [state.explorationReference];
      else plan.strategyExploration.bold.evidenceRefs = [state.explorationReference];
    }
    if (state.citationReference) { plan.channels[0].cites = [state.citationReference]; plan.audiences[0].cites = [state.citationReference]; }
    if (state.demandMode) {
      const channel = plan.channels[0];
      plan.channels = [{ ...channel, key: "search_ads", name: "Search ads test", priority: 1, suggestedMonthlyAdSpend: 150 }];
      if (state.demandMode === "supporting") plan.channels.push({ ...channel, name: "Private demand validation", priority: 0, suggestedMonthlyAdSpend: 0 });
    }
    if (state.timingMode) {
      const timing = futureCampaignTimingFixture();
      if (state.timingMode === "too_close") timing.proposedWindow!.startDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      if (state.timingMode === "capacity") timing.capacity.status = "constrained";
      if (state.timingMode === "measured") timing.moment.evidence[0] = { ...timing.moment.evidence[0], basis: "measured", reference: "fact:0", sourceUrl: null };
      plan.focusedMove.timingAssessment = state.timingMode === "unknown"
        ? { ...evergreenTimingFixture(), decision: "not_enough_evidence", geographyBasis: "Served geography unknown.", unknowns: ["Served geography", "Timezone", "Capacity and lead time"], rationale: "Prepare a geography-neutral draft until readiness is known." }
        : timing;
      Object.assign(plan.focusedMove.timingAssessment, { researchRetrievedAt: "2099-01-01T00:00:00.000Z" });
    }
    if (state.offerMode) {
      const offer = offerAssessmentFixture();
      if (state.offerMode === "measured") { offer.evidenceBasis = "measured"; offer.current.netPrice.basis = "measured"; offer.risks[4].status = "measured"; }
      if (state.offerMode === "missing_cost") offer.proposed.unknownCosts = ["Incremental delivery cost"];
      if (state.offerMode === "validate_first") {
        offer.recommendation = "validate_first"; offer.proposed.unknownCosts = ["Incremental delivery cost"];
        offer.risks[0].status = "unknown"; offer.test.ownerInputs = ["Confirm incremental delivery cost"];
      }
      plan.diagnosis = offer.diagnosis;
      plan.focusedMove = { ...plan.focusedMove, title: "Test the proposed introductory discount", why: "The owner reports a price obstacle for qualified quote requests.", firstAction: "Review the prepared offer test.", aiCanDo: "Prepare a private discount test brief for owner review.", ...(state.offerMode === "missing_assessment" ? {} : { offerAssessment: offer }) };
      if (state.offerMode === "plural_missing_assessment") plan.focusedMove = { ...focusedPlanFixture(days).focusedMove, title: "Offer discounts to first-time buyers", why: "A proposed price test for quote requesters.", firstAction: "Review the proposed terms.", aiCanDo: "Prepare the test brief." };
      plan.preparedWork[0].approvedOfferPlayName = plan.focusedMove.title;
      plan.experiments[0].name = plan.focusedMove.title;
    }
    if (state.wrongLearningTest) plan.experiments[0].name = "Unrelated test that does not track the primary move";
    if (state.unsupportedGuarantee) plan.preparedWork[0] = { ...plan.preparedWork[0], kind: "social_post", draft: "Review our service for your next project. We guarantee your money back." };
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
    if (result.ok && state.unsupportedStateClaim && typeof result.output === "object" && result.output && "evidenceAudit" in result.output) {
      const audit = (result.output as import("../../shared/agents/types").CritiqueResult).evidenceAudit!;
      audit.find(row => row.category === "business_state")!.claims = [{ path: "strategicDirection.whyThisBusiness", quote: "The business has no audience.", verdict: "unsupported", basis: "A traffic report does not establish absence of contacts or followers.", correction: "Keep audience availability unknown." }];
    }
    if (result.ok && state.reviewScores && typeof result.output === "object" && result.output && "scores" in result.output) {
      const review = result.output as { scores: { id: string; score: number; note: string; fix: string }[] };
      review.scores.forEach(score => { score.score = 3.5; });
      if (state.reviewScores === "duplicate") review.scores.push({ ...review.scores[0], score: 5 });
    }
    return result;
  },
}));
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.CLIMBOS_FAKE_LLM; delete process.env.CLIMBOS_ENGINE; state.requests = []; state.reviewScores = ""; state.failTruth = false; state.unsupportedStateClaim = false; state.refusedTarget = false; state.unsupportedGuarantee = false; state.wrongLearningTest = false; state.offerMode = ""; state.timingMode = ""; state.demandMode = ""; state.citationReference = ""; state.explorationReference = ""; state.dismissedChannel = false; state.emailMode = ""; });

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

it.each(["focused", "starter"] as const)("connects the precedent library to the real %s writer, critic and saved plan", async planStyle => {
  const { t, owner, slug, orgId } = await workspace();
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Create a personalized shareable annual recap using each customer's own product history", horizonDays: 14, monthlyAdBudget: 0 });
  state.explorationReference = "CP-011";
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  const prompts = state.requests.map(req => req.messages.map(message => typeof message.content === "string" ? message.content : JSON.stringify(message.content)).join("\n"));
  const writer = prompts.find(prompt => prompt.includes("BOUNDED CREATIVE PRECEDENT RETRIEVAL"));
  const critic = prompts.find(prompt => prompt.includes("CREATIVE PRECEDENTS (reference only; validate transfer conditions"));
  expect(writer).toBeDefined(); expect(critic).toBeDefined();
  expect(writer!.match(/PROTECTED STRATEGY EXPLORATION:/g)).toHaveLength(1);
  const ids = plan.expert?.strategyExploration?.retrievedPrecedentIds ?? [];
  expect(ids).toContain("CP-011"); expect(ids.length).toBeLessThanOrEqual(2);
  for (const id of ids) { expect(writer).toContain(id); expect(critic).toContain(id); }
  expect(plan.expert?.strategyExploration?.bold.precedentIds).toEqual(["CP-011"]);
  expect(plan.expert?.quality?.state).toBe("passed");
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it("keeps original exploration when a vague goal has no matching business mechanism", async () => {
  const { t, owner, slug, orgId } = await workspace();
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.strategyExploration?.retrievedPrecedentIds).toEqual([]);
  expect(plan.expert?.strategyExploration?.bold.precedentIds).toEqual([]);
  expect(plan.expert?.quality?.state).toBe("passed");
  const prompts = state.requests.map(req => JSON.stringify(req.messages));
  expect(prompts.some(prompt => prompt.includes("No sufficiently relevant sourced creative precedent"))).toBe(true);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["fractional", "duplicate"])("persists honest %s review results without authorizing actions", async mode => {
  const { t, owner, slug, orgId } = await workspace();
  state.reviewScores = mode;
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality?.state).toBe(mode === "duplicate" ? "failed" : "provisional");
  expect(plan.expert?.quality?.agents[0].shipped).toBe(false);
  if (mode === "duplicate") {
    expect(plan.expert?.quality?.fixes).toContainEqual(expect.objectContaining({ rule: "review_scores" }));
    await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  } else expect(plan.expert?.quality?.agents[0].average).toBe(3.5);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.query("approvals").collect())).every(a => a.status === "pending")).toBe(true);
});

it.each([
  ["focused", "https://unread.example/case", "exploration_evidence"],
  ["starter", "CP-999", "creative_precedent"],
] as const)("keeps %s original options inspectable but blocks invalid claimed sources", async (planStyle, reference, rule) => {
  const { t, owner, slug, orgId } = await workspace();
  state.explorationReference = reference;
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality).toMatchObject({ state: "failed", fixes: expect.arrayContaining([expect.objectContaining({ rule })]) });
  expect(plan.expert?.strategyExploration?.bold).toMatchObject({ title: "Become known for the brief you decline", evidenceStrength: "low", feasibility: "low" });
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  // Earlier versions stored these errors under a provisional label. Read the
  // retained findings at the approval boundary without rewriting history.
  await t.run(ctx => ctx.db.patch(plan._id, { expert: { ...plan.expert!, quality: { ...plan.expert!.quality!, state: "provisional" } } }));
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  await expect(owner.client.mutation(api.workspace.startPlay, { slug, strategyId: plan._id, playId: "focused" })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it("keeps unchanged channel feedback fresh and requires refresh when its source changes", async () => {
  const { t, owner, slug, orgId } = await workspace();
  const preference = { slug, channelId: "C01", preference: "prefer" as const, rationale: "Our team prefers writing useful customer answers." };
  await owner.client.mutation(api.acquisition.setChannelPreference, { ...preference, sourceUrl: "https://owner.example/original" });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect((await owner.client.query(api.workspace.plan, { slug, strategyId: plan._id })).staleInputs.businessProfile).toBe(false);
  await owner.client.mutation(api.acquisition.setChannelPreference, { ...preference, sourceUrl: "https://owner.example/corrected" });
  expect((await owner.client.query(api.workspace.plan, { slug, strategyId: plan._id })).staleInputs.businessProfile).toBe(true);
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/business profile changed/);
  await expect(owner.client.mutation(api.workspace.startPlay, { slug, strategyId: plan._id, playId: "focused" })).rejects.toThrow(/business profile changed/);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each([
  ["focused", "dismissed"], ["focused", "irrelevant"],
  ["starter", "dismissed"], ["starter", "irrelevant"],
] as const)("carries %s owner channel feedback into review and respects %s until cleared", async (planStyle, preference) => {
  const { t, owner, slug, orgId } = await workspace();
  state.dismissedChannel = true;
  const rationale = "Our team cannot maintain articles this cycle.";
  await owner.client.mutation(api.acquisition.setChannelPreference, { slug, channelId: "C01", preference, rationale });
  const generate = async () => {
    await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
    await t.finishAllScheduledFunctions(() => undefined);
    return (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  };
  const blocked = await generate();
  expect(JSON.stringify(state.requests)).toContain("OWNER CHANNEL FEEDBACK");
  expect(JSON.stringify(state.requests)).toContain(rationale);
  expect(blocked.expert?.quality).toMatchObject({ state: "failed", fixes: expect.arrayContaining([expect.objectContaining({ rule: "owner_channel_preference", path: "channels[0]" })]) });
  expect(blocked.expert?.strategyExploration?.bold).toMatchObject({ precedentIds: [], evidenceStrength: "low" });
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: blocked._id, decision: "approve" })).rejects.toThrow(/checks/);
  await expect(owner.client.mutation(api.workspace.startPlay, { slug, strategyId: blocked._id, playId: "focused" })).rejects.toThrow();
  await owner.client.mutation(api.acquisition.setChannelPreference, { slug, channelId: "C01", preference: "clear" });
  const cleared = await generate();
  expect(cleared._id).not.toBe(blocked._id);
  expect(cleared.expert?.quality?.state).toBe("passed");
  expect(cleared.expert?.snapshot?.ownerChannelPreferences).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.query("approvals").collect())).every(a => a.status === "pending")).toBe(true);
});

it.each([
  ["focused", "https://business.exam"], ["starter", "https://business.exam"],
  ["focused", "https://mentioned.example/report"], ["starter", "https://mentioned.example/report"],
] as const)("rejects a %s source citation absent from the recorded research: %s", async (planStyle, reference) => {
  const { t, owner, slug, orgId } = await workspace();
  state.citationReference = reference;
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Consider https://mentioned.example/report if useful, but we have not read it", horizonDays: 14, monthlyAdBudget: 0 });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality).toMatchObject({ state: "failed", fixes: expect.arrayContaining([expect.objectContaining({ rule: "citation", path: "channels[0].cites" }), expect.objectContaining({ rule: "citation", path: "audiences[0].cites" })]) });
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  await expect(owner.client.mutation(api.workspace.startPlay, { slug, strategyId: plan._id, playId: "focused" })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.query("approvals").collect())).every(a => a.status === "pending")).toBe(true);
});

it.each(["focused", "starter"] as const)("retains an exact cached source citation through %s generation", async planStyle => {
  const { t, owner, slug, orgId } = await workspace();
  state.citationReference = "https://business.example/#source";
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.channels[0].sources).toContainEqual(expect.objectContaining({ kind: "web", url: state.citationReference }));
  expect(plan.audiences[0].sources).toContainEqual(expect.objectContaining({ kind: "web", url: state.citationReference }));
  expect(plan.expert?.quality?.state).toBe("passed");
  expect((plan.expert?.quality?.fixes ?? []).filter(fix => fix.rule === "citation")).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each([
  ["focused", 0], ["focused", -0.25], ["focused", "capacity"],
  ["starter", 0], ["starter", -0.25], ["starter", "capacity"],
] as const)("blocks a %s paid recommendation for the owner-supplied constraint %s", async (planStyle, constraint) => {
  const { t, owner, slug, orgId } = await workspace();
  state.demandMode = "primary";
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Find a repeatable way to earn paying customers", horizonDays: 14, monthlyAdBudget: 200 });
  await owner.client.mutation(api.workspace.setUnitEconomics, { slug, ...(constraint === "capacity" ? { newCustomersPerMonth: 0 } : { grossMargin: constraint }) });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality).toMatchObject({ state: "failed", fixes: expect.arrayContaining([expect.objectContaining({ rule: "paid_acquisition_fit", path: "channels[0].suggestedMonthlyAdSpend" })]) });
  expect(plan.expert?.strategyExploration?.bold).toMatchObject({ precedentIds: [], feasibility: "low" });
  expect(JSON.stringify(state.requests)).toContain(constraint === "capacity" ? "delivery" : "ownerGrossMargin");
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  await expect(owner.client.mutation(api.workspace.startPlay, { slug, strategyId: plan._id, playId: "focused" })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.query("approvals").collect())).every(a => a.status === "pending")).toBe(true);
});

it.each(["focused", "starter"] as const)("blocks primary paid acquisition in a %s plan when owner evidence calls for demand validation", async planStyle => {
  const { t, owner, slug, orgId } = await workspace();
  state.demandMode = "primary";
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Find a repeatable way to earn paying customers", horizonDays: 14, monthlyAdBudget: 200 });
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.patch(business._id, { lifecycleStage: { stage: "pre_launch", provenance: "owner_reported", updatedAt: Date.now() } });
  });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality).toMatchObject({ state: "failed", fixes: expect.arrayContaining([expect.objectContaining({ rule: "demand_gate", path: "channels[0].suggestedMonthlyAdSpend" })]) });
  expect(plan.expert?.strategyExploration?.bold).toMatchObject({ precedentIds: [], feasibility: "low" });
  expect(JSON.stringify(state.requests)).toContain("demandValidation");
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  await expect(owner.client.mutation(api.workspace.startPlay, { slug, strategyId: plan._id, playId: "focused" })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect((await t.run(ctx => ctx.db.query("approvals").collect())).every(a => a.status === "pending")).toBe(true);
});

it("keeps a supporting paid test visible after an unpaid primary demand test", async () => {
  const { t, owner, slug, orgId } = await workspace();
  state.demandMode = "supporting";
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Find a repeatable way to earn paying customers", horizonDays: 14, monthlyAdBudget: 200 });
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.patch(business._id, { lifecycleStage: { stage: "pre_launch", provenance: "owner_reported", updatedAt: Date.now() } });
  });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality?.state).not.toBe("failed");
  expect(plan.channels).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Search ads test", adSpendMinor: 15000 })]));
  expect(JSON.stringify(state.requests)).toContain("buys traffic before demand is validated");
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["focused", "starter"] as const)("carries deterministic diagnosis into the %s writer, review and saved plan", async planStyle => {
  const { t, owner, slug, orgId } = await workspace();
  await owner.client.mutation(api.workspace.setFunnel, { slug, periodDays: 90, leads: 100, activated: 12, newCustomers: 3, activationKind: "value" });
  const { runId } = await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const saved = await t.run(async ctx => ({ run: await ctx.db.get(runId), plan: await ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first() }));
  expect(saved.run?.status).toBe("verified");
  expect(saved.plan?.expert?.constraintDiagnosis).toMatchObject({ constraint: "activation", status: "supported", leverage: expect.arrayContaining([{ stage: "purchase", perPoint: 0.04 }]) });
  expect(state.requests.length).toBeGreaterThanOrEqual(2);
  for (const request of state.requests) expect(JSON.stringify(request.messages)).toContain("DIAGNOSIS (computed from the owner's numbers");
  expect(JSON.stringify(state.requests[0].messages)).toContain("not a proven cause");
  expect(saved.plan?.expert?.strategyExploration?.bold.title).toBe(focusedPlanFixture().strategyExploration.bold.title);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["focused", "starter"] as const)("keeps owner-confirmed same-day buying valid in %s diagnosis", async planStyle => {
  const { t, owner, slug, orgId } = await workspace();
  await owner.client.mutation(api.acquisition.setDimension, { slug, key: "salesCycle", value: "immediate" });
  await owner.client.mutation(api.workspace.setFunnel, { slug, periodDays: 90, leads: 100, activated: 12, newCustomers: 3, activationKind: "value" });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first());
  expect(plan?.expert?.constraintDiagnosis).toMatchObject({ constraint: "activation", status: "supported" });
  expect(JSON.stringify(state.requests)).not.toContain("Sales cycle length must");
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["owner", "inferred", "low_confidence"] as const)("preserves %s buying-cycle uncertainty through generation and storage", async source => {
  const { t, owner, slug, orgId } = await workspace();
  await owner.client.mutation(api.workspace.setFunnel, { slug, periodDays: 30, leads: 100, activated: 12, newCustomers: 3, activationKind: "value" });
  await owner.client.mutation(api.acquisition.setDimension, { slug, key: "salesCycle", value: "long" });
  if (source !== "owner") await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.patch(business._id, { acquisition: { ...business.acquisition!, dims: { salesCycle: { value: "long", source: "inferred", confidence: source === "low_confidence" ? "low" : "high" } } } });
  });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first());
  const diagnosis = plan?.expert?.constraintDiagnosis;
  if (source === "low_confidence") {
    expect(diagnosis).toMatchObject({ constraint: "activation", status: "supported" });
    expect(diagnosis?.salesCycleNote).toBeUndefined();
  } else {
    expect(diagnosis).toMatchObject({ constraint: "unknown", status: "insufficient_evidence", nextMeasurement: { priority: "decision_critical" } });
    expect(diagnosis?.salesCycleNote).toContain("120-day planning assumption");
    expect(diagnosis?.salesCycleNote).toContain(source === "owner" ? "owner-selected" : "inferred");
    expect(diagnosis?.nextMeasurement.action).toContain("lead and purchase dates");
    for (const request of state.requests) expect(JSON.stringify(request.messages)).toContain(diagnosis.salesCycleNote);
  }
  expect(plan?.expert?.strategyExploration?.bold).toBeDefined();
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["met", "missed", "unclear", "not_run"] as const)("records %s for the generated primary test and carries it to future learning", async outcome => {
  const { t, owner, slug, orgId } = await workspace();
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  const tests = await t.run(ctx => ctx.db.query("experiments").filter(q => q.eq(q.field("strategyId"), plan._id)).collect());
  expect(tests).toHaveLength(1);
  expect(tests[0]).toMatchObject({ name: plan.expert!.focusedMove!.title, method: "pre_post_observational", durationDays: 1, status: "proposed", baselineRate: null, baselineProvenance: "unknown", plannedSamplePerArm: null });
  const report = await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: tests[0]._id, expectedRevision: 0, executed: outcome !== "not_run", source: "owner_report", design: "none", result: outcome === "not_run" ? "unclear" : outcome, stopRuleHit: false, note: "Synthetic private workflow review; no causal claim or customer revenue observed." });
  expect(report.inference).toBe(outcome === "not_run" ? "not_run" : "observed");
  const brief = await t.query(internal.playResults.briefFor, { orgId });
  expect(brief).toContain(tests[0].name);
  expect(brief).toContain(outcome === "not_run" ? "NOT RUN" : `reported result: ${outcome}`);
  const outsider = await asNewUser(t, `outsider-${outcome}@example.com`);
  await expect(outsider.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId: tests[0]._id, expectedRevision: 1, executed: false, source: "owner_report", design: "none", result: "unclear", stopRuleHit: false })).rejects.toThrow();

  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it("blocks plan approval when the saved test does not match the primary recommendation", async () => {
  const { t, owner, slug, orgId } = await workspace(); state.wrongLearningTest = true;
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality?.state).toBe("failed");
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["unknown", "capacity", "conflicting"] as const)("preserves %s diagnosis evidence without suppressing bold exploration", async condition => {
  const { t, owner, slug, orgId } = await workspace();
  if (condition === "capacity") await owner.client.mutation(api.workspace.setUnitEconomics, { slug, newCustomersPerMonth: 0 });
  if (condition === "conflicting") await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    // Simulate contradictory legacy data; the current owner mutation rejects it.
    await ctx.db.patch(business._id, { funnel: { periodDays: 30, leads: 10, activated: 20, updatedAt: Date.now() } });
  });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first());
  expect(plan?.expert?.constraintDiagnosis).toMatchObject(condition === "capacity"
    ? { constraint: "delivery", status: "supported" }
    : { constraint: "unknown", status: condition === "unknown" ? "insufficient_evidence" : "conflicting_inputs" });
  expect(plan?.expert?.strategyExploration?.bold).toMatchObject({ precedentIds: [], feasibility: "low", evidenceStrength: "low" });
  const prompt = JSON.stringify(state.requests[0].messages);
  expect(prompt).toContain(condition === "capacity" ? "no remaining capacity" : condition === "conflicting" ? "counts contradict each other" : "not enough evidence to name the binding constraint");
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});
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
    requestedRange: "balanced", promptVersion: "focused-exploration-v2", promptHash: expect.stringMatching(/^[a-f0-9]{64}$/), inputHash: expect.stringMatching(/^[a-f0-9]{64}$/), retrievedPrecedentIds: expect.any(Array),
  });
  expect(JSON.stringify(state.requests[0].messages)).toContain("PROTECTED STRATEGY EXPLORATION");
  expect(JSON.stringify(state.requests[0].messages)).toContain("BOUNDED CREATIVE PRECEDENT RETRIEVAL");
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("approvals").collect())).toMatchObject([{ status: "pending", actionKind: "approve_plan" }]);
  expect(saved.plan.expert?.quality?.state).not.toBe("failed"); expect(saved.plan.expert?.plays).toHaveLength(0);
  expect(state.requests).toHaveLength(3); expect(state.requests.every(r => !r.webSearch)).toBe(true);
  expect(state.requests[0].maxTokens).toBe(12000);
  expect(state.requests[0].modelKey).toBe(state.requests[1].modelKey);
  expect(state.requests[1].maxTokens).toBe(32000);
  expect(JSON.stringify(state.requests[1].messages)).toContain("creative preparation proposals");
  expect(JSON.stringify(state.requests[2].messages)).not.toContain("Synthetic direction 1");
  const preparationSteps = await t.run(ctx => ctx.db.query("workflowSteps").withIndex("by_run", q => q.eq("runId", runId)).collect());
  expect(preparationSteps.some(step => step.label.includes("explore strategic directions") && step.status === "succeeded")).toBe(true);
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

it("withholds unsupported refund copy even when the AI review approves it", async () => {
  const { t, owner, slug, orgId } = await workspace(); state.unsupportedGuarantee = true;
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality?.state).toBe("failed");
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["unrelated", "negative", "reported", "draft"])("keeps %s audience evidence honest through final plan review and approval", async mode => {
  const { t, owner, slug, orgId } = await workspace(); state.emailMode = mode;
  await owner.client.mutation(api.orgs.addFact, { slug, category: "audience", statement: mode === "reported" ? "Focused Test has 2,400 newsletter subscribers." : mode === "negative" ? "We have no newsletter subscribers." : "Contact support for product help." });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  const blocked = mode === "unrelated" || mode === "negative";
  const fixes = plan.expert?.quality?.fixes?.filter(f => f.rule === "no_audience") ?? [];
  if (blocked) {
    expect(plan.expert?.quality?.state).toBe("failed");
    expect(fixes).toContainEqual(expect.objectContaining({ rule: "no_audience", path: "focusedMove.firstAction" }));
    await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  } else {
    expect(fixes).toEqual([]);
    expect(plan.expert?.quality?.state).not.toBe("failed");
  }
  expect(plan.expert?.strategyExploration?.bold).toBeDefined();
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("approvals").filter(q => q.eq(q.field("subjectType"), "email_send")).collect())).toEqual([]);
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


it.each(["focused", "starter"] as const)("persists the %s offer assessment and derives downstream terms only after owner approval", async planStyle => {
  const { t, owner, slug, orgId } = await workspace(); state.offerMode = "valid";
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.insert("businessFacts", { orgId, businessId: business._id, category: "pricing", statement: offerFact, confidence: "high", reviewState: "confirmed", provenance: "owner_supplied", sourceIds: [], createdAt: Date.now(), updatedAt: Date.now() });
  });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const saved = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(saved.expert?.focusedMove?.offerAssessment).toEqual(offerAssessmentFixture());
  expect(saved.expert?.preparedWork?.[0].approvedOfferPlayName).toBe(saved.expert?.focusedMove?.title);
  expect(saved.expert?.quality?.state).toBe("passed");
  expect(approvedPlanOfferTerms(saved)).toEqual([]);
  const stranger = await asNewUser(t, `offer-stranger-${planStyle}@example.com`);
  await expect(stranger.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved._id, decision: "approve" })).rejects.toThrow();
  const changedExpert = structuredClone(saved.expert!);
  changedExpert.focusedMove!.offerAssessment!.proposed.netPrice.amount = 90;
  await t.run(ctx => ctx.db.patch(saved._id, { expert: changedExpert }));
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved._id, decision: "approve" })).rejects.toThrow(/changed after it was sent for review/);
  await t.run(ctx => ctx.db.patch(saved._id, { expert: saved.expert }));
  await owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved._id, decision: "approve" });
  const approved = (await t.run(ctx => ctx.db.get(saved._id)))!;
  expect(approvedPlanOfferTerms(approved)).toMatchObject([{ allowedPrices: [100, 95], allowedDiscountPercentages: [5] }]);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("campaigns").collect())).toEqual([]);
});

it.each(["missing_assessment", "plural_missing_assessment", "missing_cost", "validate_first"])("keeps %s promotion decisions honest through generation and approval", async mode => {
  const { t, owner, slug, orgId } = await workspace(); state.offerMode = mode;
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.insert("businessFacts", { orgId, businessId: business._id, category: "pricing", statement: offerFact, confidence: "high", reviewState: "confirmed", provenance: "owner_supplied", sourceIds: [], createdAt: Date.now(), updatedAt: Date.now() });
  });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const saved = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(saved.expert?.quality?.state).toBe(mode === "validate_first" ? "passed" : "failed");
  if (mode === "validate_first") {
    expect(saved.expert?.focusedMove?.offerAssessment?.proposed.unknownCosts).toEqual(["Incremental delivery cost"]);
    await owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved._id, decision: "approve" });
    expect(approvedPlanOfferTerms((await t.run(ctx => ctx.db.get(saved._id)))!)).toMatchObject([{ recommendation: "validate_first", allowedPrices: [100], allowedMechanisms: [] }]);
  } else await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved._id, decision: "approve" })).rejects.toThrow(/checks/);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it.each(["offer", "timing"] as const)("blocks %s evidence upgraded from an owner report to measured data", async kind => {
  const { t, owner, slug, orgId } = await workspace();
  if (kind === "offer") state.offerMode = "measured"; else state.timingMode = "measured";
  await setTimingEvidence(t, orgId, Date.now() - 60000);
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    const fact = (await ctx.db.query("businessFacts").withIndex("by_business", q => q.eq("businessId", business._id)).first())!;
    await ctx.db.patch(fact._id, { statement: `${fact.statement} ${offerFact} ${futureCampaignTimingFixture().moment.evidence[0].claim} Owner analytics dashboard notes are self-reported.` });
  });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const saved = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(saved.expert?.quality?.state).toBe("failed");
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved._id, decision: "approve" })).rejects.toThrow(/checks/);
  for (const request of state.requests) expect(JSON.stringify(request.messages)).toContain("source: owner_reported; wording signal: measured");
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});


it.each(["focused", "starter"] as const)("carries a sourced campaign window through %s generation, review and approval without scheduling", async planStyle => {
  const { t, owner, slug, orgId } = await workspace(); state.timingMode = "valid";
  const retrievedAt = Date.now() - 60000;
  await setTimingEvidence(t, orgId, retrievedAt);
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle });
  await t.finishAllScheduledFunctions(() => undefined);
  const saved = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(saved.expert?.quality?.state).toBe("passed");
  expect(saved.expert?.focusedMove?.timingAssessment).toMatchObject({ decision: "proceed", proposedWindow: futureCampaignTimingFixture().proposedWindow, researchRetrievedAt: new Date(retrievedAt).toISOString() });
  expect(JSON.stringify(state.requests[0].messages)).toContain("FOCUSED TIMING CONTRACT");
  const changed = structuredClone(saved.expert!); changed.focusedMove!.timingAssessment!.proposedWindow!.startDate = "2099-01-01";
  await t.run(ctx => ctx.db.patch(saved._id, { expert: changed }));
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved._id, decision: "approve" })).rejects.toThrow(/changed after it was sent for review/);
  await t.run(ctx => ctx.db.patch(saved._id, { expert: saved.expert }));
  await owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved._id, decision: "approve" });
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("campaigns").collect())).toEqual([]);
});

async function setTimingEvidence(t: ReturnType<typeof setup>, orgId: import("../../convex/_generated/dataModel").Id<"organizations">, retrievedAt: number) {
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.insert("businessFacts", { orgId, businessId: business._id, category: "product", statement: `${timingFacts.join(" ")} Campaign timezone is America/New_York.`, confidence: "high", reviewState: "confirmed", provenance: "owner_supplied", sourceIds: [], createdAt: Date.now(), updatedAt: Date.now() });
  });
  await t.mutation(internal.engine.putResearchCache, { orgId, businessWebsite: "https://business.example/", cacheKey: "b".repeat(64), agentId: "business_insights", modelKey: "claude-haiku-5.5", notes: futureCampaignTimingFixture().moment.evidence[0].claim, sources: [{ url: timingUrl }], retrievedAt, expiresAt: Date.now() + 86400000 });
}

it("supplies the original offer and timing conditions with a reported experiment to the next writer and reviewer", async () => {
  const { t, owner, slug, orgId } = await workspace();
  state.offerMode = "valid"; state.timingMode = "valid";
  await setTimingEvidence(t, orgId, Date.now() - 60000);
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    const fact = (await ctx.db.query("businessFacts").withIndex("by_business", q => q.eq("businessId", business._id)).first())!;
    await ctx.db.patch(fact._id, { statement: `${fact.statement} ${offerFact}` });
  });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const original = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(original.expert?.quality?.state).toBe("passed");
  const experimentId = await t.run(ctx => ctx.db.insert("experiments", { orgId, strategyId: original._id, name: "Synthetic original offer review", hypothesis: "The proposal may address a price objection", population: "Eligible quote requesters", method: "pre_post_observational", primaryMetric: "Completed jobs", guardrails: ["Contribution remains within the owner limit"], durationDays: 21, stoppingRule: "Stop if the owner contribution floor fails", status: "proposed", createdAt: Date.now() }));
  await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId, expectedRevision: 0, executed: true, source: "owner_report", design: "none", result: "unclear", stopRuleHit: false, note: "Actual exposure was not tracked; no causal conclusion.", measurement: { type: "count", value: 2, comparisonValue: null, unit: "completed jobs", basis: "Owner-reported jobs completed in the observed period; offer exposure unknown", comparisonBasis: "No earlier comparable count supplied" } });
  state.requests = []; state.offerMode = ""; state.timingMode = "";
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  expect(state.requests.length).toBeGreaterThanOrEqual(2);
  for (const request of state.requests) {
    const prompt = JSON.stringify(request.messages);
    expect(prompt).toContain("ORIGINAL FOCUSED DECISIONS FOR REPORTED EXPERIMENTS");
    expect(prompt).toContain(original._id);
    expect(prompt).toContain(offerAssessmentFixture().costBoundary);
    expect(prompt).toContain(futureCampaignTimingFixture().moment.evidence[0].claim);
    expect(prompt).toContain("not proof that this experiment tested the offer or used that window");
    expect(prompt).toContain("Actual exposure was not tracked");
    expect(prompt).toContain("Recorded value: 2 completed jobs");
    expect(prompt).toContain("Comparison value: Unknown");
    expect(prompt).toContain("offer exposure unknown");
  }
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("campaigns").collect())).toEqual([]);
});

it.each(["too_close", "capacity", "stale", "unknown"])("keeps %s timing from silently authorizing a dated campaign", async condition => {
  const { t, owner, slug, orgId } = await workspace(); state.timingMode = condition;
  await setTimingEvidence(t, orgId, Date.now() - (condition === "stale" ? 48 * 3600000 : 60000));
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const saved = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(saved.expert?.quality?.state).toBe(condition === "unknown" ? "passed" : "failed");
  if (condition !== "unknown") await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: saved._id, decision: "approve" })).rejects.toThrow(/checks/);
  else expect(saved.expert?.focusedMove?.timingAssessment).toMatchObject({ decision: "not_enough_evidence", proposedWindow: null });
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});


it("persists semantic evidence failures and blocks approval and action even when scores and gates pass", async () => {
  const { t, owner, slug, orgId } = await workspace(); state.unsupportedStateClaim = true;
  await owner.client.mutation(api.orgs.addFact, { slug, category: "audience", statement: "Synthetic test: no website traffic was reported; contacts and followers are unknown." });
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality?.state).toBe("failed");
  expect(plan.expert?.quality?.fixes).toContainEqual(expect.objectContaining({ rule: "invented_fact", path: "strategicDirection.whyThisBusiness" }));
  const revision = state.requests.find(req => JSON.stringify(req.messages).includes("A senior reviewer assessed your draft"));
  expect(JSON.stringify(revision?.messages)).toContain("Keep audience availability unknown.");
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  await expect(owner.client.mutation(api.workspace.startPlay, { slug, strategyId: plan._id, playId: "focused" })).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});
