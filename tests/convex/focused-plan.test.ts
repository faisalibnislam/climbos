import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { futureCampaignTimingFixture, evergreenTimingFixture, timingFacts, timingUrl } from "../fixtures/campaignTiming";
import { offerAssessmentFixture, offerFact } from "../fixtures/offerAssessment";
import { approvedPlanOfferTerms } from "../../shared/agents/approvedPlanContext";
import type { TurnRequest } from "../../shared/ai/types";
import type { RateVersion } from "../../shared/economics/rates";
const state = vi.hoisted(() => ({ requests: [] as TurnRequest[], failTruth: false, refusedTarget: false, unsupportedGuarantee: false, offerMode: "", timingMode: "" }));
vi.mock("../../shared/ai/turn", async original => ({
  ...await original<typeof import("../../shared/ai/turn")>(),
  modelTurn: async (req: TurnRequest, rates: RateVersion) => {
    state.requests.push(req);
    const days = Number(JSON.stringify(req.messages).match(/EXECUTION CYCLE: (14|30|90) days/)?.[1] ?? 14);
    const plan = focusedPlanFixture(days);
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
      plan.preparedWork[0].approvedOfferPlayName = plan.focusedMove.title;
    }
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
    return result;
  },
}));
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.CLIMBOS_FAKE_LLM; delete process.env.CLIMBOS_ENGINE; state.requests = []; state.failTruth = false; state.refusedTarget = false; state.unsupportedGuarantee = false; state.offerMode = ""; state.timingMode = ""; });

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

it("withholds unsupported refund copy even when the AI review approves it", async () => {
  const { t, owner, slug, orgId } = await workspace(); state.unsupportedGuarantee = true;
  await owner.client.mutation(api.orgs.generatePlan, { slug, planStyle: "focused" });
  await t.finishAllScheduledFunctions(() => undefined);
  const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
  expect(plan.expert?.quality?.state).toBe("failed");
  await expect(owner.client.mutation(api.workspace.decidePlan, { slug, strategyId: plan._id, decision: "approve" })).rejects.toThrow(/checks/);
  expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
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

it.each(["missing_assessment", "missing_cost", "validate_first"])("keeps %s promotion decisions honest through generation and approval", async mode => {
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
  await owner.client.mutation(api.playResults.recordExperimentOutcome, { slug, experimentId, expectedRevision: 0, executed: true, source: "owner_report", design: "none", result: "unclear", stopRuleHit: false, note: "Actual exposure was not tracked; no causal conclusion." });
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
