import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

/** S5 (REQ-STRAT-01/02/03): the flagged plan's decision and limits survive saving, and the Channels view applies the limits. */
const decision = {
  observations: [{ observation: "Orders flat while traffic grew", source: "owner", evidenceRefs: ["fact:0"] }],
  constraint: "retention",
  explanations: [
    { explanation: "Weak first order", evidenceFor: "Late-delivery reviews", evidenceAgainst: "4.6 rating" },
    { explanation: "No reason to return", evidenceFor: "No follow-up", evidenceAgainst: "" },
  ],
  limits: "No exit survey yet.",
  options: [
    { name: "Keep first-time buyers", kind: "retention", plays: ["Win back"], chosen: true, whyNot: "" },
    { name: "Buy traffic", kind: "acquisition", plays: [], chosen: false, whyNot: "Leaks the same way." },
  ],
  guidingPolicy: "Keep customers before buying new ones.",
  focus: { primaryPlay: "Win back", supportingMove: "Ask recent buyers what blocked reorder", maintenanceWork: "Review reorder rate weekly" },
  falsifier: "Fewer than 10 of 300 reorder by day 21.",
};

const strategy = (extra: Record<string, unknown>) =>
  JSON.stringify({
    summary: "Keep 30 more customers by day 90",
    positioning: "p",
    audiences: [],
    channels: [{ key: "retention", name: "Retention", why: "w", priority: 1, deliverables: [], dependencies: [], measurement: "m", suggestedMonthlyAdSpend: 0 }],
    experiments: [],
    constraints: [],
    measurementPlan: "m",
    firstActions: [],
    diagnosis: "d",
    affordableCac: "a",
    notDoing: [],
    northStar: { metric: "m", baseline: "0", target: "30" },
    leadingIndicators: [],
    phases: [],
    weekOneChecklist: [],
    risks: [],
    plays: [],
    economics: { revenuePerCustomerMonthUsd: 40, grossMargin: 0.6, monthlyChurn: 0.1, basis: "" },
    ...extra,
  });

async function run(t: ReturnType<typeof setup>, orgId: Id<"organizations">) {
  return t.run(async (ctx) => {
    const now = Date.now();
    return ctx.db.insert("workflowRuns", { orgId, kind: "strategy", title: "Plan", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "verified-2026-10-17", entitlementVersionId: "ent-credits-2026-10-18", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now });
  });
}

describe("decision contract persistence", () => {
  it("saves the structured decision and the limits; the Channels view applies them with live connections", async () => {
    const t = setup();
    const owner = await asNewUser(t, "decision@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Decision Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
    const id = orgId as Id<"organizations">;
    const profile = { types: ["b2b_saas"], dims: { customerType: { value: "b2b", confidence: "high", source: "owner" } }, budgetUsd: 0, horizonDays: 90 };
    await t.mutation(internal.jobWrites.saveStrategy, {
      runId: await run(t, id),
      strategy: strategy({
        decision,
        plays: [{
          name: "Win back", kind: "creative", unit: "customers", horizonDays: 90,
          actionContract: { diagnosis: "Retention", intendedEffect: "Recover customers", evidenceBasis: "assumption", evidenceNote: "Test the assumption.", evidenceRefs: [], targetOrAsset: "Past customers", resourcePlan: "One hour weekly", executionCapability: "owner", dependencies: [], measurement: { metric: "Orders", baseline: "Unknown", target: "10 orders", windowDays: 21, source: "Billing" } },
          model: { weeklyReach: 10, steps: [{ name: "order", rate: 0.2, low: 0.1, high: 0.3 }], monthlySpendUsd: 0, ownerHoursPerWeek: 1 },
        }],
      }),
      factIds: [],
      acquisition: JSON.stringify({ libraryVersion: "acq-2026-10-18", profile, adjustments: [], summary: [], limits: { ownerHoursPerWeek: 0 } }),
    });
    const saved = await t.run(async (ctx) => (await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", id)).first())!);
    expect(saved.expert?.version).toBe(7);
    expect(saved.expert?.decision).toEqual(decision);
    expect(saved.expert?.decisionAnalysis).toMatchObject({
      snapshotId: null,
      method: "seeded_joint_scenario_mean_v1",
      probabilityCalibrated: false,
      constraints: { monthlyAdBudgetUsd: 0, ownerHoursPerWeek: 0 },
      options: [
        { name: "Keep first-time buyers", chosen: true, calculated: true, feasible: false, playNames: ["Win back"] },
        { name: "Buy traffic", chosen: false, calculated: false, unavailableReason: "No mapped plays" },
      ],
    });
    expect(saved.acquisition?.limits).toEqual({ ownerHoursPerWeek: 0 });
    const view = await owner.client.query(api.acquisition.view, { slug });
    const picked = view!.channels.filter((c) => c.status === "primary" || c.status === "in_plan");
    // No owner hours: only channels ClimbOS runs end to end make the plan.
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((c) => c.exec === "auto")).toBe(true);
    // No ad budget: paid channels are blocked by cash.
    expect(view!.channels.find((c) => c.id === "P01")?.limits.some((l) => l.kind === "cash" && l.verdict === "blocked")).toBe(true);
  });

  it("a plan without the flag saves no decision and no limits (default path unchanged)", async () => {
    const t = setup();
    const owner = await asNewUser(t, "nodecision@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Plain Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
    const id = orgId as Id<"organizations">;
    await t.mutation(internal.jobWrites.saveStrategy, {
      runId: await run(t, id),
      strategy: strategy({}),
      factIds: [],
      acquisition: JSON.stringify({ libraryVersion: "acq-2026-10-18", profile: { types: ["b2b_saas"], dims: {} }, adjustments: [], summary: [] }),
    });
    const saved = await t.run(async (ctx) => (await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", id)).first())!);
    expect(saved.expert?.decision).toBeUndefined();
    expect(saved.expert?.decisionAnalysis).toBeUndefined();
    expect(saved.acquisition?.limits).toBeUndefined();
    const view = await owner.client.query(api.acquisition.view, { slug });
    expect(view!.channels.every((c) => c.limits.length === 0)).toBe(true);
  });
});
