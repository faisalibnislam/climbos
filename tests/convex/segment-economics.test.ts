import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

const row = { segment: "Service clients", currency: "KWD", periodDays: 90, customers: 10, netRevenue: 10.123, costBoundary: "Service hours and payment fees" };

describe("owner segment economics persistence and permissions", () => {
  it("preserves unknown totals, explicit zeros and currency without executing actions", async () => {
    const t = setup(); const owner = await asNewUser(t, "segments@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Segments" });
    const business = () => t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first());
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, segmentEconomics: [row] });
    expect((await business())?.unitEconomics?.segmentEconomics).toEqual([row]);
    const confirmed = { ...row, variableCosts: 0, costCoverage: "complete" as const };
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, segmentEconomics: [confirmed] });
    expect((await business())?.unitEconomics?.segmentEconomics).toEqual([confirmed]);
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, segmentEconomics: [{ ...row, netRevenue: -10.123, variableCosts: 3.001, costCoverage: "incomplete", unknownCosts: ["Support"] }] });
    expect((await business())?.unitEconomics?.segmentEconomics?.[0]).toMatchObject({ netRevenue: -10.123, variableCosts: 3.001, costCoverage: "incomplete" });
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, segmentEconomics: [] });
    expect((await business())?.unitEconomics?.segmentEconomics).toEqual([]);
    for (const table of ["artifacts", "approvals", "actionReceipts", "workflowRuns"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
    expect((await t.run(ctx => ctx.db.query("auditEvents").collect())).filter(event => event.action === "business.unit_economics").length).toBeGreaterThan(0);
  });
  it.each([
    { currency: "ZZZ" }, { currency: "" }, { currency: "JPY", netRevenue: 1.5 },
    { costCoverage: "complete" as const }, { costCoverage: "complete" as const, variableCosts: 0, unknownCosts: ["Fees"] },
    { variableCosts: -1 }, { customers: 0 }, { periodDays: 0 },
  ])("rejects invalid or conflicting input without changing saved evidence: %j", async changed => {
    const t = setup(); const owner = await asNewUser(t, "owner-segment@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Validation" });
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, segmentEconomics: [row] });
    const before = await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first());
    await expect(owner.client.mutation(api.workspace.setUnitEconomics, { slug, segmentEconomics: [{ ...row, ...changed }] })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.get(before!._id))).toEqual(before);
  });
  it("rejects viewers and other tenants", async () => {
    const t = setup(); const owner = await asNewUser(t, "owner-segment@example.com"); const viewer = await asNewUser(t, "viewer-segment@example.com"); const outsider = await asNewUser(t, "outsider-segment@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Private segments" });
    await t.run(ctx => ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    for (const user of [viewer, outsider]) await expect(user.client.mutation(api.workspace.setUnitEconomics, { slug, segmentEconomics: [row] })).rejects.toThrow();
    expect((await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first()))?.unitEconomics?.segmentEconomics).toBeUndefined();
  });
});
