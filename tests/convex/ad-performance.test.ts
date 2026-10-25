import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { setup, asNewUser } from "./helpers";

describe("campaign performance access", () => {
  it("does not allow a workspace to request another tenant's campaign report", async () => {
    const t = setup();
    const ownerA = await asNewUser(t, "ads-a@example.com");
    const ownerB = await asNewUser(t, "ads-b@example.com");
    const { slug: slugA } = await ownerA.client.mutation(api.orgs.createWorkspace, { businessName: "Workspace A" });
    const { slug: slugB } = await ownerB.client.mutation(api.orgs.createWorkspace, { businessName: "Workspace B" });
    const orgB = await t.run(async (ctx) => (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slugB)).unique())!);
    const campaignId = await t.run(async (ctx) => {
      const now = Date.now();
      const connectionId = await ctx.db.insert("connections", {
        orgId: orgB._id,
        provider: "google_ads",
        status: "connected",
        externalAccountId: "1234567890",
        scopes: ["https://www.googleapis.com/auth/adwords"],
        isFixture: false,
        createdBy: ownerB.userId,
        createdAt: now,
        updatedAt: now,
      });
      return ctx.db.insert("campaigns", {
        orgId: orgB._id,
        channel: "google_search_ad",
        name: "Private campaign",
        status: "active",
        budgetEnvelopeMinor: 10000,
        dailyBudgetMinor: 1000,
        currency: "USD",
        startDate: "2026-10-01",
        endDate: "2026-10-30",
        reviewAfterDays: 7,
        stopRules: [],
        externalId: "987654321",
        connectionId,
        activatedAt: now - 10 * 86_400_000,
        createdAt: now,
        updatedAt: now,
      });
    });

    await expect(ownerA.client.action(api.adPerformance.syncPerformance, { slug: slugA, campaignId }))
      .rejects.toThrow(/couldn't find that campaign/i);
    expect(slugB).not.toBe(slugA);
  });

  it("does not treat demo fixtures as live campaign data", async () => {
    const t = setup();
    const anonymous = await asNewUser(t, "demo-ads@example.com", { anonymous: true });
    const { slug } = await anonymous.client.mutation(api.demo.createDemoWorkspace, {});
    const campaigns = await anonymous.client.query(api.ads.list, { slug });
    const campaign = campaigns.campaigns.find((item) => item.channel === "google_search_ad");
    expect(campaign).toBeTruthy();
    await expect(anonymous.client.action(api.adPerformance.syncPerformance, { slug, campaignId: campaign!.id }))
      .rejects.toThrow(/demo workspaces do not contain live campaign results/i);
  });
});
