import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("owner-reported business stage", () => {
  it("stores, audits and clears the stage through the tenant-scoped business editor", async () => {
    const t = setup();
    const owner = await asNewUser(t, "stage-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Stage Co" });

    await owner.client.mutation(api.orgs.saveBusinessDetails, { slug, lifecycleStage: "early_traction" });
    let business = await t.run(async (ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    expect(business?.lifecycleStage).toMatchObject({ stage: "early_traction", provenance: "owner_reported" });
    expect(business?.lifecycleStage?.updatedAt).toBeTypeOf("number");
    expect((await owner.client.query(api.orgs.onboardingState, { slug })).business?.lifecycleStage).toMatchObject({ stage: "early_traction", provenance: "owner_reported" });

    await owner.client.mutation(api.orgs.saveBusinessDetails, { slug, lifecycleStage: null });
    business = await t.run(async (ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    expect(business?.lifecycleStage).toBeUndefined();
    const history = await t.run(async (ctx) => ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).collect());
    expect(history.filter((event) => event.action === "business.lifecycle_stage_changed")).toHaveLength(2);
  });

  it("does not allow another tenant to set or clear the stage", async () => {
    const t = setup();
    const owner = await asNewUser(t, "stage-owner@example.com");
    const outsider = await asNewUser(t, "stage-outsider@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Private Stage Co" });
    await expect(outsider.client.mutation(api.orgs.saveBusinessDetails, { slug, lifecycleStage: "decline" })).rejects.toThrow(/couldn't find that workspace/);
    const business = await t.run(async (ctx) => ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first());
    expect(business?.lifecycleStage).toBeUndefined();
  });
});
