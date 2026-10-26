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
