import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("Meta conversion action choice", () => {
  it("lets editors choose only a Meta-reported action type, scoped to the workspace and audited", async () => {
    const t = setup();
    const owner = await asNewUser(t, "meta-owner@example.com");
    const viewer = await asNewUser(t, "meta-viewer@example.com");
    const other = await asNewUser(t, "meta-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Meta Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    const now = Date.now();
    const { metaCampaign, googleCampaign } = await t.run(async (ctx) => {
      const org = orgId as Id<"organizations">;
      await ctx.db.insert("memberships", { orgId: org, userId: viewer.userId, role: "viewer", status: "active", createdAt: now });
      const connectionId = await ctx.db.insert("connections", { orgId: org, provider: "meta_ads", status: "connected", scopes: ["ads_read"], isFixture: false, createdBy: owner.userId, createdAt: now, updatedAt: now } as never);
      const base = { orgId: org, status: "active" as const, budgetEnvelopeMinor: 0, currency: "USD", stopRules: [], createdAt: now, updatedAt: now };
      const metaCampaign = await ctx.db.insert("campaigns", { ...base, channel: "meta_ad", name: "Meta test" } as never);
      const googleCampaign = await ctx.db.insert("campaigns", { ...base, channel: "google_search_ad", name: "Google test" } as never);
      await ctx.db.insert("campaignPerformance", { orgId: org, campaignId: metaCampaign, connectionId, source: "meta_ads", status: "ready", startDate: "2026-10-01", endDate: "2026-10-20", currency: "USD", spendMinor: 30_000, reportedActions: [{ actionType: "lead", value: 6 }, { actionType: "link_click", value: 400 }], syncedAt: now });
      return { metaCampaign, googleCampaign };
    });

    await expect(owner.client.mutation(api.ads.setConversionAction, { slug, campaignId: metaCampaign, actionType: "purchase" })).rejects.toThrow(/Meta reported/);
    await expect(owner.client.mutation(api.ads.setConversionAction, { slug, campaignId: googleCampaign, actionType: "lead" })).rejects.toThrow(/Only Meta campaigns/);
    await expect(viewer.client.mutation(api.ads.setConversionAction, { slug, campaignId: metaCampaign, actionType: "lead" })).rejects.toThrow(/can't/i);
    await expect(other.client.mutation(api.ads.setConversionAction, { slug: otherSlug, campaignId: metaCampaign, actionType: "lead" })).rejects.toThrow();

    await owner.client.mutation(api.ads.setConversionAction, { slug, campaignId: metaCampaign, actionType: "lead" });
    const list = await owner.client.query(api.ads.list, { slug });
    expect(list.campaigns.find((c) => c.id === metaCampaign)).toMatchObject({ conversionActionType: "lead" });
    const audits = await t.run(async (ctx) => ctx.db.query("auditEvents").collect());
    expect(audits.some((a) => a.action === "campaign.conversion_action")).toBe(true);

    await owner.client.mutation(api.ads.setConversionAction, { slug, campaignId: metaCampaign, actionType: null });
    expect((await owner.client.query(api.ads.list, { slug })).campaigns.find((c) => c.id === metaCampaign)).toMatchObject({ conversionActionType: null });
  });
});
