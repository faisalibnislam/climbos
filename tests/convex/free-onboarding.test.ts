import { afterEach, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { planJob, maxJobMicros } from "../../convex/lib/jobPlans";
import { creditsToMicros, FREE_CREDITS } from "../../shared/economics/credits";
import type { TurnRequest } from "../../shared/ai/types";
import { currentRateVersion } from "../../shared/economics";
const state = vi.hoisted(() => ({ calls: [] as TurnRequest[], pages: 0, failTruth: false, failTruthOnce: false, modelCost: 55000, profileSource: "https://business.example/" }));
vi.mock("../../convex/ai/research", async original => ({
  ...await original<typeof import("../../convex/ai/research")>(),
  researchWebsite: async (_site: string, limit: number) => { state.pages = limit; return { pagesFetched: 1, pages: [{ url: "https://business.example/", title: "Scenario agency tool", prices: [], status: "ok", text: "Scenario agency tool: forms for agencies. Published claim, not tested behavior." }] }; },
}));
vi.mock("../../shared/ai/anthropic", async original => ({
  ...await original<typeof import("../../shared/ai/anthropic")>(),
  anthropicTurn: async (req: TurnRequest) => {
    state.calls.push(req);
    const profile = { name: "Scenario agency tool", oneLineSummary: "Published agency form tools", businessType: "saas", audience: "Agencies", category: "Forms", facts: [{ category: "product", statement: "Form tools for agencies are described.", confidence: "high", sourceUrl: state.profileSource }], brandVoice: "Plain language", suggestedSuccessEvents: [] };
    const plan = focusedPlanFixture();
    let output: unknown;
    if (req.schema?.safeParse(profile).success) output = profile;
    else if (req.schema?.safeParse(plan).success) output = plan;
    else {
      const { fakeTurn } = await import("../../shared/agents/fake"); const result = await fakeTurn(req, currentRateVersion()); if (!result.ok) return result;
      output = result.output;
      if (state.failTruth || state.failTruthOnce) (output as {gates:{id:string;pass:boolean}[]}).gates.find(gate => gate.id === "G1")!.pass = false;
      state.failTruthOnce = false;
    }
    const text = JSON.stringify(output);
    return { ok: true, output, text, appended: [{ role: "assistant", content: text }], usage: { inputTokens: 200, outputTokens: 700, thinkingTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0, webFetches: 0, calls: 1 }, costMicros: req.schema?.safeParse(profile).success ? 1000 : state.modelCost, sources: [], actualModelId: "synthetic-test-model", stopReason: "end_turn" };
  },
}));
afterEach(() => { delete process.env.ANTHROPIC_API_KEY; delete process.env.CLIMBOS_FAKE_LLM; delete process.env.CLIMBOS_ENGINE; state.calls = []; state.failTruth = false; state.failTruthOnce=false; state.modelCost=55000; state.profileSource = "https://business.example/"; state.pages=0; });
it("quotes basic research plus a reviewed first plan inside the unchanged free grant", () => {
  const research = maxJobMicros(planJob("onboarding_research", { researchDepth: "starter", pages: 2 }));
  const plan = maxJobMicros(planJob("strategy", { planStyle: "starter" }));
  expect(research + plan).toBeLessThanOrEqual(creditsToMicros(FREE_CREDITS)); expect(FREE_CREDITS).toBe(50);
});
it("finishes the actual free onboarding path without topping up, deep research or duplicate starter generation", async () => {
  const t = setup(); delete process.env.CLIMBOS_ENGINE; delete process.env.CLIMBOS_FAKE_LLM; process.env.ANTHROPIC_API_KEY = "synthetic-test-key";
  const owner = await asNewUser(t, "free-starter@example.com");
  const {slug,orgId} = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Scenario agency tool", website: "https://business.example/" });
  expect((await owner.client.query(api.workspace.credits,{slug})).monthly.total).toBe(50);
  const research = await owner.client.mutation(api.orgs.startResearch,{slug,researchDepth:"starter"}); await t.finishAllScheduledFunctions(()=>undefined);
  const researchRun = await owner.client.query(api.content.runStatus,{slug,runId:research.runId});
  expect(researchRun?.status, JSON.stringify(researchRun)).toBe("verified"); expect(state.pages).toBe(1); // plus the homepage
  await owner.client.mutation(api.orgs.setGoal,{slug,kind:"more_customers",statement:"Find a useful customer test",horizonDays:14,monthlyAdBudget:0});
  const quote = await owner.client.query(api.workspace.planQuote,{slug,planStyle:"starter"});
  const generated = await owner.client.mutation(api.orgs.generatePlan,{slug,planStyle:"starter"}); await t.finishAllScheduledFunctions(()=>undefined);
  const saved = await t.run(async ctx=>({plan:(await ctx.db.query("strategies").withIndex("by_org",q=>q.eq("orgId",orgId)).first())!,run:(await ctx.db.get(generated.runId))!}));
  expect(saved.run.status).toBe("verified"); expect(saved.plan.expert?.quality?.state).toBe("passed"); expect(saved.plan.expert?.preparedWork).toHaveLength(1);
  expect(state.calls).toHaveLength(3); expect(state.calls.every(req=>!req.webSearch)).toBe(true);
  expect(state.calls[1].thinkingOff).toBe(true); expect(state.calls[1].maxTokens).toBe(11000); expect(state.calls[2].maxTokens).toBe(4000);
  expect(saved.run.estimateMicros).toBe(quote.reserveMicros);
  const before=state.calls.length; await owner.client.mutation(api.workspace.decidePlan,{slug,strategyId:saved.plan._id,decision:"approve"});await t.finishAllScheduledFunctions(()=>undefined);expect(state.calls.length).toBe(before);
  const credits=await owner.client.query(api.workspace.credits,{slug});expect(credits.monthly.total).toBe(50);expect(credits.available).toBeGreaterThan(0);expect(credits.paid).toBe(false);
  expect(await t.run(ctx=>ctx.db.query("subscriptions").collect())).toHaveLength(0);
});
it("keeps a free first plan blocked when the reviewer fails its truth check", async () => {
  const t = setup(); delete process.env.CLIMBOS_ENGINE; process.env.ANTHROPIC_API_KEY = "synthetic-test-key";
  const owner = await asNewUser(t, "free-blocked@example.com");
  const {slug,orgId} = await owner.client.mutation(api.orgs.createWorkspace,{businessName:"Scenario agency tool",website:"https://business.example/"});
  await owner.client.mutation(api.orgs.startResearch,{slug,researchDepth:"starter"}); await t.finishAllScheduledFunctions(()=>undefined);
  await owner.client.mutation(api.orgs.setGoal,{slug,kind:"more_customers",statement:"Find a useful customer test",horizonDays:14,monthlyAdBudget:0});
  state.failTruth = true;
  await owner.client.mutation(api.orgs.generatePlan,{slug,planStyle:"starter"}); await t.finishAllScheduledFunctions(()=>undefined);
  const plan = await t.run(ctx=>ctx.db.query("strategies").withIndex("by_org",q=>q.eq("orgId",orgId)).first());
  expect(plan?.expert?.quality?.state).toBe("failed");
  await expect(owner.client.mutation(api.workspace.decidePlan,{slug,strategyId:plan!._id,decision:"approve"})).rejects.toThrow();
  expect(state.calls).toHaveLength(5); // one bounded correction and its independent review
  expect((await owner.client.query(api.workspace.credits,{slug})).monthly.total).toBe(50);
});
it("supports a free owner description without a website and keeps its facts owner-reported",async()=>{
  const t=setup();process.env.ANTHROPIC_API_KEY="synthetic-test-key";state.profileSource="owner:description";
  const owner=await asNewUser(t,"free-text@example.com");const {slug}=await owner.client.mutation(api.orgs.createWorkspace,{businessName:"Scenario agency tool"});
  const run=await owner.client.mutation(api.orgs.startResearch,{slug,researchDepth:"starter",ownerText:"We make form tools for agencies."});await t.finishAllScheduledFunctions(()=>undefined);
  expect((await owner.client.query(api.content.runStatus,{slug,runId:run.runId}))?.status).toBe("verified");
  const view=await owner.client.query(api.orgs.onboardingState,{slug});expect(view.facts).toHaveLength(1);expect(view.facts[0].provenance).toBe("owner_supplied");expect(view.facts[0].sources[0]?.kind).toBe("owner_text");expect(state.pages).toBe(0);expect(state.calls).toHaveLength(1);
});
it("does not attach an invented profile citation to the real homepage",async()=>{
  const t=setup();process.env.ANTHROPIC_API_KEY="synthetic-test-key";state.profileSource="https://unread.example/proof";
  const owner=await asNewUser(t,"free-source@example.com");const {slug}=await owner.client.mutation(api.orgs.createWorkspace,{businessName:"Scenario agency tool",website:"https://business.example/"});
  await owner.client.mutation(api.orgs.startResearch,{slug,researchDepth:"starter"});await t.finishAllScheduledFunctions(()=>undefined);
  expect((await owner.client.query(api.orgs.onboardingState,{slug})).facts).toHaveLength(0);
});

it("automatically corrects one failed draft using unused reserved credits without raising the quote",async()=>{
  const t=setup();process.env.ANTHROPIC_API_KEY="synthetic-test-key";
  const owner=await asNewUser(t,"free-auto-repair@example.com");const {slug,orgId}=await owner.client.mutation(api.orgs.createWorkspace,{businessName:"Scenario agency tool",website:"https://business.example/"});
  await owner.client.mutation(api.orgs.startResearch,{slug,researchDepth:"starter"});await t.finishAllScheduledFunctions(()=>undefined);
  await owner.client.mutation(api.orgs.setGoal,{slug,kind:"more_customers",statement:"Find a useful customer test",horizonDays:14,monthlyAdBudget:0});
  const quote=await owner.client.query(api.workspace.planQuote,{slug,planStyle:"starter"});state.failTruthOnce=true;
  const generated=await owner.client.mutation(api.orgs.generatePlan,{slug,planStyle:"starter"});await t.finishAllScheduledFunctions(()=>undefined);
  const saved=await t.run(async ctx=>({plan:await ctx.db.query("strategies").withIndex("by_org",q=>q.eq("orgId",orgId)).order("desc").first(),run:await ctx.db.get(generated.runId)}));
  expect(saved.plan?.expert?.quality?.state).toBe("passed");expect(state.calls).toHaveLength(5);expect(saved.run?.costCapMicros).toBe(quote.maxCostMicros);expect(saved.run!.actualMicros).toBeLessThanOrEqual(quote.maxCostMicros);
  const credits=await owner.client.query(api.workspace.credits,{slug});expect(credits.monthly.total).toBe(50);expect(credits.available).toBeGreaterThan(0);
});

it("keeps the first reviewed draft when another full correction cannot fit its fixed cap",async()=>{
  const t=setup();process.env.ANTHROPIC_API_KEY="synthetic-test-key";state.failTruth=true;state.modelCost=140000;
  const owner=await asNewUser(t,"free-cap-stop@example.com");const {slug}=await owner.client.mutation(api.orgs.createWorkspace,{businessName:"Scenario agency tool",website:"https://business.example/"});
  await owner.client.mutation(api.orgs.startResearch,{slug,researchDepth:"starter"});await t.finishAllScheduledFunctions(()=>undefined);
  await owner.client.mutation(api.orgs.setGoal,{slug,kind:"more_customers",statement:"Find a useful customer test",horizonDays:14,monthlyAdBudget:0});
  const quote=await owner.client.query(api.workspace.planQuote,{slug,planStyle:"starter"});
  const generated=await owner.client.mutation(api.orgs.generatePlan,{slug,planStyle:"starter"});await t.finishAllScheduledFunctions(()=>undefined);
  const run=await t.run(ctx=>ctx.db.get(generated.runId));expect(state.calls).toHaveLength(3);expect(run?.status).toBe("verified");expect(run?.costCapMicros).toBe(quote.maxCostMicros);expect(run?.estimateMicros).toBe(quote.reserveMicros);
});

it("fits a realistic starter correction inside the same quoted ceiling", async () => {
  const t=setup();process.env.ANTHROPIC_API_KEY="synthetic-test-key";
  const owner=await asNewUser(t,"free-realistic-repair@example.com");
  const {slug,orgId}=await owner.client.mutation(api.orgs.createWorkspace,{businessName:"Scenario agency tool",website:"https://business.example/"});
  await owner.client.mutation(api.orgs.startResearch,{slug,researchDepth:"starter"});await t.finishAllScheduledFunctions(()=>undefined);
  await owner.client.mutation(api.orgs.setGoal,{slug,kind:"more_customers",statement:"Find a useful customer test",horizonDays:14,monthlyAdBudget:0});
  state.modelCost=83000;state.failTruthOnce=true;
  const quote=await owner.client.query(api.workspace.planQuote,{slug,planStyle:"starter"});
  const generated=await owner.client.mutation(api.orgs.generatePlan,{slug,planStyle:"starter"});await t.finishAllScheduledFunctions(()=>undefined);
  const saved=await t.run(async ctx=>({plan:await ctx.db.query("strategies").withIndex("by_org",q=>q.eq("orgId",orgId)).first(),run:await ctx.db.get(generated.runId)}));
  expect(saved.plan?.expert?.quality?.state).toBe("passed");expect(state.calls).toHaveLength(5);
  expect(saved.run?.costCapMicros).toBe(quote.maxCostMicros);expect(saved.run!.actualMicros).toBeLessThanOrEqual(quote.maxCostMicros);
  expect((await owner.client.query(api.workspace.credits,{slug})).monthly.total).toBe(50);
});
