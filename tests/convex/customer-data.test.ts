import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("no customers yet / no data yet", () => {
  it("saves the owner's status and planned price without inventing customer figures", async () => {
    const t = setup();
    const owner = await asNewUser(t, "custdata@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "New Co" });
    const biz = () => t.run(async (ctx) => (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as never)).first())!);

    await owner.client.mutation(api.orgs.saveOnboardingIntro, { slug, intro: {}, businessStage: "just_launched" });
    expect((await biz()).customerData?.status).toBe("no_customers_yet");

    await owner.client.mutation(api.workspace.setCustomerData, { slug, status: "no_customers_yet", plannedPriceMonth: 29 });
    expect((await biz()).customerData).toMatchObject({ status: "no_customers_yet", plannedPriceMonth: 29 });
    expect((await biz()).unitEconomics?.revenuePerCustomerMonthUsd).toBeUndefined();

    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, revenuePerCustomerMonthUsd: 50, grossMargin: 0.5 });
    await owner.client.mutation(api.workspace.setCustomerData, { slug, status: "no_data_yet" });
    const after = await biz();
    expect(after.customerData?.status).toBe("no_data_yet");
    expect(after.unitEconomics).toMatchObject({ unsure: ["revenue", "margin", "churn"] });
    expect(after.unitEconomics?.revenuePerCustomerMonthUsd).toBeUndefined();

    await owner.client.mutation(api.workspace.setCustomerData, { slug, status: null });
    expect((await biz()).customerData).toBeUndefined();

    await owner.client.mutation(api.orgs.saveOnboardingIntro, { slug, intro: {}, businessStage: "launching_soon" });
    expect((await biz()).lifecycleStage?.stage).toBe("pre_launch");

    const other = await asNewUser(t, "custdata-other@example.com");
    await expect(other.client.mutation(api.workspace.setCustomerData, { slug, status: "no_customers_yet" })).rejects.toThrow();
  });
});
