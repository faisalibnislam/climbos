import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("learning from results", () => {
  it("uses actual first-send time and excludes CRM stages recorded before contact", async () => {
    const t = setup();
    const u = await asNewUser(t, "learn-cohort@example.com");
    const { orgId } = await u.client.mutation(api.orgs.createWorkspace, { businessName: "Cohort Co" });
    await t.run(async (ctx) => {
      const now = Date.now();
      const campaignId = await ctx.db.insert("outboundCampaigns", {
        orgId: orgId as Id<"organizations">,
        title: "Test campaign",
        brief: { who: "owners", where: "UK", count: 3 },
        status: "review",
        sequence: [],
        ownerNotes: [],
        excluded: [],
        sending: { status: "done", startedAt: now - 60 * 86_400_000, startedBy: u.userId as Id<"users">, senderName: "Owner", company: "Cohort Co", address: "owner@example.com", firstSentAt: now - 60 * 86_400_000, lastSentAt: now - 35 * 86_400_000 },
        createdBy: u.userId as Id<"users">,
        createdAt: now - 200 * 86_400_000,
        updatedAt: now,
      });
      const cases = [
        { company: "Old stage", stage: "booked" as const, sentAt: now - 60 * 86_400_000, stageUpdatedAt: now - 61 * 86_400_000, updatedAt: now, createdAt: now - 100_000 },
        { company: "New stage", stage: "booked" as const, sentAt: now - 60 * 86_400_000, stageUpdatedAt: now - 59 * 86_400_000, updatedAt: now, createdAt: now - 100_000 },
        // Queued long ago but delivered inside the window: the delivery belongs in the cohort.
        { company: "Late delivery", stage: "contacted" as const, sentAt: now - 60 * 86_400_000, stageUpdatedAt: now - 60 * 86_400_000, updatedAt: now - 60 * 86_400_000, createdAt: now - 200 * 86_400_000 },
      ];
      for (const [index, item] of cases.entries()) {
        const prospectId = await ctx.db.insert("prospects", {
          orgId: orgId as Id<"organizations">,
          campaignId,
          company: item.company,
          domain: `${index}.example.com`,
          website: `https://${index}.example.com`,
          location: "UK",
          sizeBand: "small",
          why: "Test fixture",
          evidence: [],
          trigger: "Test",
          fit: 1,
          timing: 1,
          contact: "Owner",
          firstLine: "Hello",
          stage: item.stage,
          stageUpdatedAt: item.stageUpdatedAt,
          ...(index === 1 ? { replyDisposition: "qualified" as const, replyDispositionUpdatedAt: now - 58 * 86_400_000 } : {}),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
        await ctx.db.insert("outboundSends", {
          orgId: orgId as Id<"organizations">,
          campaignId,
          prospectId,
          step: 0,
          to: `${index}@example.com`,
          scheduledFor: item.sentAt,
          status: "sent",
          sentAt: item.sentAt,
          attempts: 1,
          createdAt: item.createdAt,
        });
      }

      const activeCampaignId = await ctx.db.insert("outboundCampaigns", {
        orgId: orgId as Id<"organizations">,
        title: "Still sending",
        brief: { who: "owners", where: "UK", count: 1 },
        status: "review",
        sequence: [],
        ownerNotes: [],
        excluded: [],
        sending: { status: "on", startedAt: now - 60 * 86_400_000, startedBy: u.userId as Id<"users">, senderName: "Owner", company: "Cohort Co", address: "owner@example.com", firstSentAt: now - 60 * 86_400_000, lastSentAt: now - 60 * 86_400_000 },
        createdBy: u.userId as Id<"users">,
        createdAt: now - 200 * 86_400_000,
        updatedAt: now,
      });
      const activeProspectId = await ctx.db.insert("prospects", {
        orgId: orgId as Id<"organizations">,
        campaignId: activeCampaignId,
        company: "Active campaign",
        domain: "active.example.com",
        website: "https://active.example.com",
        location: "UK",
        sizeBand: "small",
        why: "Test fixture",
        evidence: [],
        trigger: "Test",
        fit: 1,
        timing: 1,
        contact: "Owner",
        firstLine: "Hello",
        stage: "contacted",
        stageUpdatedAt: now - 60 * 86_400_000,
        createdAt: now - 200 * 86_400_000,
        updatedAt: now - 60 * 86_400_000,
      });
      await ctx.db.insert("outboundSends", { orgId: orgId as Id<"organizations">, campaignId: activeCampaignId, prospectId: activeProspectId, step: 0, to: "active@example.com", scheduledFor: now - 60 * 86_400_000, status: "sent", sentAt: now - 60 * 86_400_000, attempts: 1, createdAt: now - 200 * 86_400_000 });
    });
    const { counts } = await t.query(internal.learning.countsForOrg, { orgId: orgId as Id<"organizations"> });
    expect(counts.outreach_reply).toEqual({ trials: 3, successes: 1 });
    expect(counts.outreach_qualified_reply).toEqual({ trials: 3, successes: 1 });
    expect(counts.outreach_booked).toEqual({ trials: 3, successes: 1 });
  });

  it("measures each workspace and pools by type only with 5+ workspaces", async () => {
    const t = setup();
    const orgs: Id<"organizations">[] = [];
    for (let i = 0; i < 10; i++) {
      const u = await asNewUser(t, `learn${i}@example.com`);
      const { orgId } = await u.client.mutation(api.orgs.createWorkspace, { businessName: `Learn ${i}` });
      orgs.push(orgId as Id<"organizations">);
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("landingPages", { orgId: orgId as Id<"organizations">, slug: `p-${i}`, title: "Offer", brief: "Offer", status: "live", color: "#000000", views: 100, leads: 5 + i, createdAt: now, updatedAt: now });
      });
    }
    await t.action(internal.learning.recompute, {});
    expect(await t.run(async (ctx) => (await ctx.db.query("learnedRates").collect()).some((row) => row.scope === "all"))).toBe(false);
    const ctx0 = await t.query(internal.learning.contextFor, { orgId: orgs[0] });
    expect(ctx0).toContain("THIS BUSINESS 5%");
    expect(ctx0).toMatch(/~100\/~1000, 10\+ workspaces/);
    expect(ctx0).toMatch(/each workspace contributes at most 100 trials/);
    // With only 9 contributing, nothing pooled is published.
    await t.run(async (ctx) => {
      const p = await ctx.db.query("landingPages").collect();
      await ctx.db.patch(p[9]._id, { views: 0, leads: 0 });
    });
    await t.action(internal.learning.recompute, {});
    expect(await t.query(internal.learning.contextFor, { orgId: orgs[0] })).not.toMatch(/workspaces, n=/);
  });

  it("keeps a sparse own rate visible and does not fall back to an all-business rate", async () => {
    const t = setup();
    const u = await asNewUser(t, "learn-sparse@example.com");
    const { orgId } = await u.client.mutation(api.orgs.createWorkspace, { businessName: "Sparse Learn" });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("landingPages", {
        orgId: orgId as Id<"organizations">,
        slug: "sparse",
        title: "Sparse",
        brief: "Sparse evidence",
        status: "live",
        color: "#000000",
        views: 20,
        leads: 1,
        createdAt: now,
        updatedAt: now,
      });
    });
    await t.action(internal.learning.recompute, {});
    const context = await t.query(internal.learning.contextFor, { orgId: orgId as Id<"organizations"> });
    expect(context).toMatch(/THIS BUSINESS 5% \(1\/20/);
    expect(context).toMatch(/cautious planning rate .* Wilson lower bound/);
    expect(context).not.toMatch(/ClimbOS all businesses/);
  });
});
