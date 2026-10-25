import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

/** Hubbard Ch 5: owners may give a range; it's validated, stored as their judgement, and a later single number replaces it. */
describe("owner ranges for unit economics", () => {
  it("validates, stores and replaces ranges", async () => {
    const t = setup();
    const owner = await asNewUser(t, "ranges@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Range Co" });
    await expect(owner.client.mutation(api.workspace.setUnitEconomics, { slug, monthlyChurn: 0.05, ranges: { churn: { low: 0.08, high: 0.02 } } })).rejects.toThrow(/low must be below high/);
    await expect(owner.client.mutation(api.workspace.setUnitEconomics, { slug, ranges: { churn: { low: 0.02, high: 0.08 } } })).rejects.toThrow(/give the value too/);
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, monthlyChurn: 0.05, ranges: { churn: { low: 0.02, high: 0.08 } } });
    const read = async () => t.run(async (ctx) => (await ctx.db.query("businesses").collect())[0].unitEconomics);
    expect((await read())?.ranges?.churn).toEqual({ low: 0.02, high: 0.08 });
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, monthlyChurn: 0.04 });
    expect((await read())?.ranges?.churn).toBeUndefined();
    expect((await read())?.monthlyChurn).toBe(0.04);
    await owner.client.mutation(api.workspace.setUnitEconomics, { slug, monthlyGrowthCashUsd: 0 });
    expect((await read())?.monthlyGrowthCashUsd).toBe(0);
    await expect(owner.client.mutation(api.workspace.setUnitEconomics, { slug, monthlyGrowthCashUsd: -1 })).rejects.toThrow(/Monthly growth cash looks wrong/);
  });
});
