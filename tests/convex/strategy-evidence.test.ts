import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";

const requests = vi.hoisted(() => [] as string[]);
vi.mock("../../shared/agents/fake", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../shared/agents/fake")>();
  return { ...actual, fakeTurn: async (...args: Parameters<typeof actual.fakeTurn>) => {
    requests.push(JSON.stringify(args[0].messages));
    return actual.fakeTurn(...args);
  } };
});

describe("strategy evidence and owner control survive a re-plan", () => {
  beforeEach(() => { process.env.CLIMBOS_ENGINE = "v2"; process.env.CLIMBOS_FAKE_LLM = "ship"; requests.length = 0; });
  afterEach(() => { delete process.env.CLIMBOS_ENGINE; delete process.env.CLIMBOS_FAKE_LLM; });

  it("carries invalid billing evidence into the actual strategy writer without an external action", async () => {
    const t = setup();
    const owner = await asNewUser(t, "strategy-invalid-billing@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Billing Evidence Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Understand repeat customer activity", horizonDays: 90, monthlyAdBudget: 0 });
    await makePaid(t, orgId);
    await t.run(ctx => ctx.db.insert("revenueEvents", { orgId, source: "stripe", sourceEventId: "invalid-amount", customerRef: "customer", currency: "USD", amountMinor: 1.5, refundedMinor: 0, kind: "subscription_payment", occurredAt: Date.now() - 90 * 86_400_000, isFixture: false, ingestedAt: Date.now() }));
    await owner.client.mutation(api.orgs.generatePlan, { slug });
    await t.finishAllScheduledFunctions(() => undefined);
    expect(requests.some(request => request.includes("OBSERVED SUBSCRIPTION COHORTS: unavailable") && request.includes("imported amounts are invalid"))).toBe(true);
    expect(await t.run(ctx => ctx.db.query("strategies").withIndex("by_org", q => q.eq("orgId", orgId)).collect())).toHaveLength(1);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  });

  it("gives channel scoring the shared research, saves the direction, and re-scores changed owner preferences", async () => {
    const t = setup();
    const owner = await asNewUser(t, "strategy-evidence@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Strategy Evidence Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Reach the right paying customers", horizonDays: 90, monthlyAdBudget: 0 });
    await makePaid(t, orgId);
    const generate = async () => {
      await owner.client.mutation(api.orgs.generatePlan, { slug });
      await t.finishAllScheduledFunctions(() => undefined);
      return t.run(async (ctx) => (await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").first())!);
    };
    const first = await generate();
    expect(first.expert?.strategicDirection?.ambition).toBeTruthy();
    expect(first.acquisition?.adjustments[0]?.decisionBrief).toMatchObject({ effortBasis: "unknown", ownerHoursPerWeek: null });
    expect(requests.find((request) => request.includes("CANDIDATES (id"))).toContain("FAKE RESEARCH NOTES");
    const firstHash = first.acquisition?.inputHash;
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/);
    await owner.client.mutation(api.acquisition.setChannelPreference, { slug, channelId: "M10", preference: "irrelevant", rationale: "Our buyers do not use this launch community." });
    const second = await generate();
    expect(second.acquisition?.inputHash).not.toBe(firstHash);
    const view = await owner.client.query(api.acquisition.view, { slug });
    expect(view?.channels.some((channel) => channel.decisionBrief?.smallestCheck)).toBe(true);
    expect(view?.channels.find((channel) => channel.id === "M10")?.ownerPreference).toMatchObject({ preference: "irrelevant" });
    const runs = await t.run(async (ctx) => ctx.db.query("workflowSteps").collect());
    expect(runs.filter((step) => step.runId === second.runId && step.label.startsWith("Channel scoring"))).not.toHaveLength(0);
    const outsider = await asNewUser(t, "outside-strategy@example.com");
    await expect(outsider.client.query(api.workspace.plan, { slug })).rejects.toThrow();
  });
  it("persists short-cycle milestones and carries the classified review into the next writer", async () => {
    const t = setup(); const owner = await asNewUser(t, "short-cycle-plan@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Short Cycle" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "Reach the right people", horizonDays: 14, monthlyAdBudget: 0 }); await makePaid(t, orgId);
    const generate = async () => { await owner.client.mutation(api.orgs.generatePlan, { slug }); await t.finishAllScheduledFunctions(() => undefined); return (await t.run((ctx) => ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").first()))!; };
    const first = await generate();
    expect(first.expert?.phases.map((phase) => phase.days)).toEqual(["1–7", "8–14"]);
    expect(first.expert?.phases.every((phase) => phase.firstAction && phase.howToCheck && phase.decisionRule)).toBe(true);
    const cycle = (await owner.client.query(api.planningCycles.view, { slug })).goal!;
    await owner.client.mutation(api.planningCycles.continueCycle, { slug, expectedGoalId: cycle.id, lengthDays: 30, summary: "Owner wants to change the approach", carryForward: "Re-check the recommendation before more outreach", evidenceBasis: "unknown", evidenceNote: "No outcome measurement supplied." });
    requests.length = 0;
    const next = await generate();
    expect(next.expert?.phases.map((phase) => phase.days)).toEqual(["1–7", "8–14", "15–21", "22–30"]);
    expect(requests.some((request) => request.includes("PREVIOUS CYCLE REVIEW") && request.includes("Re-check the recommendation before more outreach") && request.includes("not independently verified"))).toBe(true);
  });

});
