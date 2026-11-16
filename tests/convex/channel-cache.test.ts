import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { readExpertPlan } from "../../shared/agents/planCompatibility";
import { asNewUser, makePaid, setup } from "./helpers";
const observed = vi.hoisted(() => ({ requests: [] as string[], researchSuffix: "" }));
vi.mock("../../shared/agents/fake", async original => {
  const actual = await original<typeof import("../../shared/agents/fake")>();
  return { ...actual, fakeTurn: async (...args: Parameters<typeof actual.fakeTurn>) => {
    observed.requests.push(JSON.stringify(args[0].messages));
    const result = await actual.fakeTurn(...args);
    if (result.ok && !args[0].schema && observed.researchSuffix) {
      const text = `${result.text}\n${observed.researchSuffix}`;
      return { ...result, output: text, text, appended: [{ role: "assistant" as const, content: text }] };
    }
    return result;
  } };
});
async function seed(name = "Cache context") {
  const t = setup(), owner = await asNewUser(t, `${name.replaceAll(" ", "-")}@example.com`);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: name });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More paying customers", horizonDays: 90, monthlyAdBudget: 300 });
  await makePaid(t, orgId);
  const generate = async () => {
    await owner.client.mutation(api.orgs.generatePlan, { slug }); await t.finishAllScheduledFunctions(() => undefined);
    const plan = (await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").first()))!;
    expect(plan.runId).toBeTruthy();
    const steps = await t.run(ctx => ctx.db.query("workflowSteps").withIndex("by_run", q => q.eq("runId", plan.runId!)).collect());
    return { plan, scoring: steps.filter(step => step.label.startsWith("Channel scoring")) };
  };
  return { t, owner, slug, orgId, generate };
}
beforeEach(() => { vi.stubEnv("CLIMBOS_ENGINE", "v2"); vi.stubEnv("CLIMBOS_FAKE_LLM", "ship"); observed.requests.length = 0; observed.researchSuffix = ""; });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("channel evidence reuse", () => {
  it("reuses unchanged evidence while preserving empty proposals for strategy writing", async () => {
    const f = await seed();
    const first = await f.generate();
    expect(first.scoring.length).toBeGreaterThan(0);
    const second = await f.generate();
    expect(second.scoring).toHaveLength(0);
    expect(second.plan.acquisition?.inputHash).toBe(first.plan.acquisition?.inputHash);
    expect(second.plan.acquisition?.adjustments).toEqual(first.plan.acquisition?.adjustments);
    const context = await f.t.query(internal.jobWrites.jobContext, { runId: second.plan.runId! });
    expect(context?.resultsText).toContain("no weekly results reported");
    expect(context?.channelResultsText).not.toContain("no weekly results reported");
    expect(context?.channelResultsText).not.toContain("ORIGINAL PLAN AND REPORT");
    expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  });

  it("retains real reports and forces scoring when an owner records an outcome", async () => {
    const f = await seed(); const first = await f.generate();
    const play = readExpertPlan(first.plan.expert!)!.plays![0];
    await f.owner.client.mutation(api.playResults.log, { slug: f.slug, strategyId: first.plan._id, playName: play.name, reach: 10, steps: play.model!.steps.map(() => 0), spendUsd: 0, ownerHours: 1, currency: "USD" });
    observed.requests.length = 0;
    const second = await f.generate();
    expect(second.scoring.length).toBeGreaterThan(0);
    expect(second.plan.acquisition?.inputHash).not.toBe(first.plan.acquisition?.inputHash);
    const input = observed.requests.find(text => text.includes("CANDIDATES (id"));
    expect(input).toContain("ORIGINAL PLAN AND REPORT");
    expect(input).toContain(first.plan._id);
    expect(input).toContain("not independently verified");
    expect(input).not.toContain("no weekly results reported");
    const third = await f.generate();
    expect(third.scoring).toHaveLength(0);
    expect(third.plan.acquisition?.inputHash).toBe(second.plan.acquisition?.inputHash);
  });

  it.each(["economics", "preference", "feedback", "research", "expiry"] as const)("re-scores changed %s", async change => {
    const f = await seed(); const first = await f.generate();
    if (change === "economics") await f.t.run(async ctx => { const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", f.orgId)).first())!; await ctx.db.patch(b._id, { unitEconomics: { ...b.unitEconomics, grossMargin: 0, updatedAt: Date.now() } }); });
    if (change === "preference") await f.owner.client.mutation(api.acquisition.setChannelPreference, { slug: f.slug, channelId: "M10", preference: "irrelevant", rationale: "Our customers do not use this launch community." });
    if (change === "feedback") await f.t.run(ctx => ctx.db.insert("ownerFeedback", { orgId: f.orgId, strategyId: first.plan._id, subjectKind: "channel", subjectKey: "M10", subjectLabel: "Launch community", reason: "not_relevant", note: "Our audience is elsewhere", createdBy: f.owner.userId, createdAt: Date.now() }));
    if (change === "research") observed.researchSuffix = "New source observation: audience use is uncertain; validate first.";
    if (change === "expiry") { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + 7 * 3600000); }
    const next = await f.generate();
    expect(next.scoring.length).toBeGreaterThan(0);
    if (change !== "expiry") expect(next.plan.acquisition?.inputHash).not.toBe(first.plan.acquisition?.inputHash);
  });
});
