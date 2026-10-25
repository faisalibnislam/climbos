import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("automation registry", () => {
  it("lists only the workspace's existing workflows and reports their stop control", async () => {
    const t = setup();
    const owner = await asNewUser(t, "registry@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Registry Co", website: "https://registry.example" });

    const before = await owner.client.query(api.automationRegistry.get, { slug });
    expect(before.entries.map((entry) => entry.id)).toEqual([
      "social_autopilot", "scheduled_specialists", "competitor_watch", "competitor_research_refresh", "website_change_watch", "approved_outbound_sending",
    ]);
    const siteWatch = before.entries.find((entry) => entry.id === "website_change_watch");
    expect(siteWatch).toMatchObject({ state: "active", siteWatchEnabled: true });
    expect(siteWatch?.handler).toContain("siteWatchActions.ts");

    await owner.client.mutation(api.automationRegistry.setWebsiteMonitor, { slug, enabled: false });
    const after = await owner.client.query(api.automationRegistry.get, { slug });
    expect(after.entries.find((entry) => entry.id === "website_change_watch")).toMatchObject({ state: "paused", siteWatchEnabled: false });

    // The flag is checked again at execution time, so a job queued before pause cannot run.
    await t.action(internal.siteWatchActions.check, { orgId: orgId as Id<"organizations">, scheduled: true });
    expect((await owner.client.query(api.siteWatch.facts, { slug }))?.siteCheckedAt).toBeFalsy();

    // Pausing the scheduler does not block an explicit manual check.
    process.env.CLIMBOS_FAKE_LLM = "ship";
    await t.action(internal.siteWatchActions.check, { orgId: orgId as Id<"organizations"> });
    expect((await owner.client.query(api.siteWatch.facts, { slug }))?.siteCheckedAt).toEqual(expect.any(Number));
    const latestActivity = (await owner.client.query(api.automationRegistry.get, { slug })).entries.find((entry) => entry.id === "website_change_watch");
    expect(latestActivity?.lastReceipt).toMatchObject({ summary: "Website snapshot", href: "visibility", at: expect.any(Number) });
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("rejects a website monitor toggle when the business has no website", async () => {
    const t = setup();
    const owner = await asNewUser(t, "no-site-registry@example.com");
    const { slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "No Site Co" });
    await expect(owner.client.mutation(api.automationRegistry.setWebsiteMonitor, { slug, enabled: false })).rejects.toThrow(/website/i);
  });

  it("reports legacy competitor sites as paused until owner confirmation", async () => {
    const t = setup();
    const owner = await asNewUser(t, "registry-legacy-watch@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Legacy Registry Co" });
    await t.run((ctx) => ctx.db.insert("competitorWatches", {
      orgId,
      name: "Old Rival",
      url: "https://old-rival.example",
      active: true,
      autoSeededAt: Date.now() - 1_000,
      createdAt: Date.now() - 1_000,
    }));

    const competitorWatch = (await owner.client.query(api.automationRegistry.get, { slug })).entries.find((entry) => entry.id === "competitor_watch");
    expect(competitorWatch).toMatchObject({ state: "paused", activeCount: 0, savedCount: 1, confirmationCount: 1 });
    expect(competitorWatch?.summary).toContain("paused for owner confirmation");
  });
});
