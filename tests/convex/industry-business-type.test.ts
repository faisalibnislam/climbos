import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("owner-selected industry playbook type", () => {
  it("stores a catalog selection, returns it in settings, audits changes, and clears it", async () => {
    const t = setup();
    const owner = await asNewUser(t, "industry-type-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Bookstore Co" });

    await owner.client.mutation(api.orgs.saveBusinessDetails, { slug, industryBusinessTypeId: "BT-001" });
    const state = await owner.client.query(api.orgs.onboardingState, { slug });
    expect(state.business?.industryBusinessTypeId).toBe("BT-001");
    const business = await t.run(async (ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    expect(business?.industryBusinessTypeId).toBe("BT-001");

    await expect(owner.client.mutation(api.orgs.saveBusinessDetails, { slug, industryBusinessTypeId: "BT-999" })).rejects.toThrow(/industry catalog/i);
    await owner.client.mutation(api.orgs.saveBusinessDetails, { slug, industryBusinessTypeId: null });
    const cleared = await owner.client.query(api.orgs.onboardingState, { slug });
    expect(cleared.business?.industryBusinessTypeId).toBeNull();
    const history = await t.run(async (ctx) => ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).collect());
    expect(history.filter((event) => event.action === "business.industry_type_changed")).toHaveLength(2);
  });

  it("keeps another tenant from changing the selected type", async () => {
    const t = setup();
    const owner = await asNewUser(t, "industry-type-owner-2@example.com");
    const outsider = await asNewUser(t, "industry-type-outsider@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Private Bookstore" });
    await expect(outsider.client.mutation(api.orgs.saveBusinessDetails, { slug, industryBusinessTypeId: "BT-001" })).rejects.toThrow(/couldn't find that workspace/i);
    const business = await t.run(async (ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    expect(business?.industryBusinessTypeId).toBeUndefined();
  });
});
