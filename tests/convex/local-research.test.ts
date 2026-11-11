import { afterEach, describe, expect, it, vi } from "vitest";
import { setup, asNewUser } from "./helpers";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { api, internal } from "../../convex/_generated/api";

afterEach(() => vi.unstubAllEnvs());
it("binds public-source corrections for a local acceptance workspace to its owner, account and exact website", async () => {
  const t = setup(), owner = await asNewUser(t, "correction-owner@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Correction test", website: "https://business.example/" });
  vi.stubEnv("CLIMBOS_LOCAL_REAL_RESEARCH", "true"); vi.stubEnv("SITE_URL", "http://127.0.0.1:3430"); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const website = (await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first()))!.website!;
  const args = { ownerEmail: "correction-owner@example.com", slug, website, notes: "Isolated public-source correction test, not business data.", sources: [{ url: "https://vendor.example/documentation" }] };
  await expect(t.mutation(internal.localResearch.recordResearchUpdate, args)).rejects.toThrow(/authorized local/);
  await t.run(async ctx => { const org = (await ctx.db.get(orgId))!; await ctx.db.patch(org.accountId!, { localWorkspaceTesting: true }); });
  await expect(t.mutation(internal.localResearch.recordResearchUpdate, { ...args, website: "https://changed.example/" })).rejects.toThrow(/website/);
  await expect(t.mutation(internal.localResearch.recordResearchUpdate, { ...args, ownerEmail: "someone-else@example.com" })).rejects.toThrow(/owner/);
  expect(await t.mutation(internal.localResearch.recordResearchUpdate, args)).toMatchObject({ reused: false, corrected: [] });
  expect(await t.mutation(internal.localResearch.recordResearchUpdate, args)).toMatchObject({ reused: true, corrected: [] });
});
it("aligns an imported draft's cycle without rebilling, and preserves a later owner change",async()=>{
  const t=setup(),owner=await asNewUser(t,"horizon-import@example.com");
  vi.stubEnv("CLIMBOS_LOCAL_REAL_RESEARCH","true");vi.stubEnv("SITE_URL","http://127.0.0.1:3430");vi.stubEnv("CLIMBOS_FAKE_LLM","");
  const payload={ownerEmail:"horizon-import@example.com",name:"Livoform",website:"https://livoform.com/",acquisitionType:"b2b_saas",key:"isolated-horizon-test",horizonDays:14,sourceHash:"a".repeat(64),costMicros:1000,phases:[{label:"Synthetic unit-test phase only",model:"synthetic-test-model",costMicros:1000,status:"completed"}],plan:focusedPlanFixture(),assessment:null,sources:[{url:"https://livoform.com/"}],researchNotes:"Isolated test only, never imported into real workspace."};
  const first=await t.action(internal.localResearch.importFocusedPlan,{payload:JSON.stringify(payload)});
  const run=await t.run(ctx=>ctx.db.get(first.runId));
  const goal=(await owner.client.query(api.planningCycles.view,{slug:first.slug})).goal!;
  await t.run(ctx=>ctx.db.patch(goal.id,{horizonDays:90})); // Reproduce the old import binding bug.
  const aligned=await t.action(internal.localResearch.importFocusedPlan,{payload:JSON.stringify(payload)});
  expect(aligned.runId).toBe(first.runId);expect(aligned.strategyId).not.toBe(first.strategyId);
  expect((await owner.client.query(api.planningCycles.view,{slug:first.slug})).goal?.lengthDays).toBe(14);
  expect(await t.run(ctx=>ctx.db.get(first.runId))).toEqual(run);
  expect(await t.action(internal.localResearch.importFocusedPlan,{payload:JSON.stringify(payload)})).toEqual(aligned);
  const active=(await owner.client.query(api.planningCycles.view,{slug:first.slug})).goal!;
  await owner.client.mutation(api.planningCycles.changeLength,{slug:first.slug,expectedGoalId:active.id,lengthDays:30});
  await expect(t.action(internal.localResearch.importFocusedPlan,{payload:JSON.stringify(payload)})).rejects.toThrow(/owner changed/);
  expect((await owner.client.query(api.planningCycles.view,{slug:first.slug})).goal?.lengthDays).toBe(30);
});
describe("local real-research import boundary", () => {
  it("does not seed demo data in the dedicated real-business profile", async () => {
    const t = setup(); const owner = await asNewUser(t, "real-profile@example.com");
    vi.stubEnv("CLIMBOS_LOCAL_REAL_RESEARCH", "true");
    await expect(owner.client.mutation(api.demo.createDemoWorkspace, {})).rejects.toThrow(/Demo data is disabled/);
    expect(await t.run(async (ctx) => ctx.db.query("organizations").collect())).toHaveLength(0);
  });
  it("requires the exact dedicated profile and a real requested business", async () => {
    const t = setup();
    const owner = await asNewUser(t, "local-owner@example.com");
    const args = { ownerEmail: "local-owner@example.com", name: "Macloving", website: "https://macloving.app/", acquisitionType: "desktop_app", key: "unit-boundary", horizonDays: 14, input: '{"localResearchKey":"unit-boundary"}', costMicros: 0, phases: "[]", summary: "Synthetic unit-test setup only; this is never imported into the real local database." };
    await expect(t.mutation(internal.localResearch.prepare, args)).rejects.toThrow(/loopback/);
    vi.stubEnv("CLIMBOS_LOCAL_REAL_RESEARCH", "true"); vi.stubEnv("SITE_URL", "http://127.0.0.1:3430"); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
    await expect(t.mutation(internal.localResearch.prepare, { ...args, website: "https://foreign.example/" })).rejects.toThrow(/three owner-requested/);
    const first = await t.mutation(internal.localResearch.prepare, args);
    const second = await t.mutation(internal.localResearch.prepare, args);
    expect(second.runId).toBe(first.runId);
    const org = await t.run(async (ctx) => ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", first.slug)).first());
    expect(org?.kind).toBe("customer"); expect(org?.createdBy).toBe(owner.userId);
    const run = await t.run(async (ctx) => ctx.db.get(first.runId));
    expect(run?.isFixture).toBe(false);
    await expect(t.mutation(internal.localResearch.setEvaluationBudget, { ownerEmail: args.ownerEmail, allocationMicros: 100000000 })).rejects.toThrow(/capped/);
    const funded = await t.mutation(internal.localResearch.setEvaluationBudget, { ownerEmail: args.ownerEmail, allocationMicros: 10000000 });
    expect(funded.ceilingMicros).toBe(6000000);
    await t.run(async (ctx) => { const period = (await ctx.db.query("usagePeriods").collect())[0]; await ctx.db.patch(period._id, { walletSpentMicros: 2000000 }); });
    const repeated = await t.mutation(internal.localResearch.setEvaluationBudget, { ownerEmail: args.ownerEmail, allocationMicros: 10000000 });
    expect(repeated.ceilingMicros).toBe(6000000); expect(repeated.spentMicros).toBe(2000000);
    await t.mutation(internal.localResearch.enableWorkspaceTesting, { ownerEmail: args.ownerEmail });
    const extended = await t.mutation(internal.localResearch.increaseEvaluationBudget, { ownerEmail: args.ownerEmail, allocationMicros: 20000000, authorization: "local-convex-total-20000000" });
    expect(extended.ceilingMicros).toBe(12000000); expect(extended.spentMicros).toBe(2000000);
    expect(await t.mutation(internal.localResearch.increaseEvaluationBudget, { ownerEmail: args.ownerEmail, allocationMicros: 20000000, authorization: "local-convex-total-20000000" })).toEqual(extended);
    await expect(t.mutation(internal.localResearch.setEvaluationBudget, { ownerEmail: args.ownerEmail, allocationMicros: 10000000 })).rejects.toThrow(/larger/);
    await expect(t.mutation(internal.localResearch.increaseEvaluationBudget, { ownerEmail: args.ownerEmail, allocationMicros: 10000000, authorization: "local-convex-total-10000000" })).rejects.toThrow(/reduce/);
    vi.stubEnv("SITE_URL", "https://climbos.app");
    await expect(t.mutation(internal.localResearch.increaseEvaluationBudget, { ownerEmail: args.ownerEmail, allocationMicros: 30000000, authorization: "local-convex-total-30000000" })).rejects.toThrow(/loopback/);
    const subscriptions = await t.run(async (ctx) => ctx.db.query("subscriptions").collect());
    expect(subscriptions).toHaveLength(0);
  });
});

it("imports already-paid focused work idempotently and blocks it when a first-party source correction refuses the pitch", async () => {
  const t = setup(); const owner = await asNewUser(t, "focused-import@example.com");
  vi.stubEnv("CLIMBOS_LOCAL_REAL_RESEARCH", "true"); vi.stubEnv("SITE_URL", "http://127.0.0.1:3430"); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const plan = focusedPlanFixture(); plan.preparedWork[0] = { ...plan.preparedWork[0], kind: "creator_pitch", target: "MacMost — product suggestion" };
  const payload = { ownerEmail: "focused-import@example.com", name: "Macloving", website: "https://macloving.app/", acquisitionType: "desktop_app", key: "synthetic-import-test-only", horizonDays: 14, sourceHash: "a".repeat(64), costMicros: 1000, phases: [{ label: "Synthetic unit-test phase", model: "synthetic-test-model", costMicros: 1000, status: "completed" }], plan, assessment: null, sources: [{ url: "https://macloving.app/" }], researchNotes: "Synthetic regression only, never inserted into the real local database." };
  const first = await t.action(internal.localResearch.importFocusedPlan, { payload: JSON.stringify(payload) });
  expect(await t.action(internal.localResearch.importFocusedPlan, { payload: JSON.stringify(payload) })).toEqual(first);
  const before = await t.run(ctx => ctx.db.get(first.runId));
  const args = { ownerEmail: payload.ownerEmail, slug: first.slug, notes: "Synthetic first-party policy regression", sources: [{ url: "https://macmost.com/contact", productPitchPolicy: { status: "refused" as const, evidence: "No marketing partnerships or free products for review." } }] };
  const corrected = await t.mutation(internal.localResearch.recordResearchUpdate, args);
  expect(corrected.corrected).toEqual([first.strategyId]);
  const saved = await t.run(ctx => ctx.db.get(first.strategyId));
  expect(saved?.expert?.quality?.state).toBe("failed"); expect(saved?.expert?.preparedWork?.[0].draft).toBe(plan.preparedWork[0].draft);
  expect(await t.run(ctx => ctx.db.get(first.runId))).toEqual(before);
  expect((await t.mutation(internal.localResearch.recordResearchUpdate, args))).toMatchObject({ reused: true, corrected: [] });
  await expect(t.mutation(internal.localResearch.recordResearchUpdate, { ...args, ownerEmail: "someone-else@example.com" })).rejects.toThrow(/owner/);
  await t.run(async ctx => { const org = (await ctx.db.get((await ctx.db.get(first.runId))!.orgId))!; const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org._id)).first())!; await ctx.db.patch(b._id, { website: "https://changed.example/" }); });
  await expect(t.mutation(internal.localResearch.recordResearchUpdate, args)).rejects.toThrow(/website/);
  const wallet = await t.run(ctx => ctx.db.query("usagePeriods").collect()); expect(wallet.every(period => period.walletSpentMicros === 0)).toBe(true);
  expect(await t.run(ctx => ctx.db.query("subscriptions").collect())).toHaveLength(0);
  expect(owner.userId).toBeTruthy();
});
