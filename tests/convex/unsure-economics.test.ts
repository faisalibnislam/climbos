import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("owner 'not sure' answers", () => {
  it("records not-sure numbers without keeping an owner figure, and a later answer clears not-sure", async () => {
    const t = setup();
    const owner = await asNewUser(t, "unsure@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Unsure Co" });
    const econ = () => t.run(async (ctx) => (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as never)).first())!.unitEconomics);

    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, revenuePerCustomerMonthUsd: 40, grossMargin: 0.6 });
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, unsure: ["margin", "churn"] });
    let u = await econ();
    expect(u).toMatchObject({ revenuePerCustomerMonthUsd: 40, unsure: ["margin", "churn"] });
    expect(u?.grossMargin).toBeUndefined();

    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, monthlyChurn: 0.05 });
    u = await econ();
    expect(u?.unsure).toEqual(["margin"]);
    expect(u?.monthlyChurn).toBe(0.05);
  });
});

describe("zero and negative owner economics", () => {
  it.each([0, -0.25, -2])("saves contribution margin %s and observed zero churn", async grossMargin => {
    const t = setup(); const owner = await asNewUser(t, "loss-margin@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Loss-making example" });
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, revenuePerCustomerMonthUsd: 20, grossMargin, monthlyChurn: 0 });
    expect((await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first()))?.unitEconomics).toMatchObject({ grossMargin, monthlyChurn: 0 });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 600 });
    const channels = (await owner.client.query(api.acquisition.view, { slug }))!.channels;
    expect(channels.find(channel => channel.id === "P01")?.limits).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "economics", verdict: "blocked" })]));
    expect(channels.filter(channel => channel.paid && ["primary", "in_plan"].includes(channel.status))).toEqual([]);
    for (const table of ["artifacts", "approvals", "actionReceipts", "workflowRuns"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("accepts ranges across zero and rejects contradictory or nonfinite values atomically", async () => {
    const t = setup(); const owner = await asNewUser(t, "margin-range@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Margin range" });
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, grossMargin: -0.25, ranges: { margin: { low: -0.5, high: 0 } } });
    const saved = await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first());
    for (const grossMargin of [0.5, 1.1, NaN, Infinity, -Infinity]) {
      await expect(owner.client.mutation(api.workspace.setUnitEconomics, { slug, grossMargin, ranges: { margin: { low: -0.5, high: 0 } } })).rejects.toThrow();
      expect(await t.run(ctx => ctx.db.get(saved!._id))).toEqual(saved);
    }
  });

  it("prevents viewers and other tenants from changing the owner's economics", async () => {
    const t = setup(); const owner = await asNewUser(t, "margin-owner@example.com");
    const viewer = await asNewUser(t, "margin-viewer@example.com"); const outsider = await asNewUser(t, "margin-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Private margins" });
    await t.run(ctx => ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, grossMargin: -0.25 });
    for (const user of [viewer, outsider]) await expect(user.client.mutation(api.workspace.setUnitEconomics, { slug, grossMargin: 0.8 })).rejects.toThrow();
    expect((await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first()))?.unitEconomics?.grossMargin).toBe(-0.25);
  });
});
