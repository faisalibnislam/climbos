import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import type { Doc } from "../../convex/_generated/dataModel";

async function campaignFixture() {
  const t = setup();
  const owner = await asNewUser(t, "campaign-owner@example.com", { anonymous: true });
  const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
  const campaignId = await t.run(async ctx => {
    const org = (await ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", slug)).unique())!;
    // Isolate authorization from the demo campaign that already reserves the monthly cap.
    for (const c of await ctx.db.query("campaigns").withIndex("by_org", q => q.eq("orgId", org._id)).collect()) await ctx.db.delete(c._id);
    const connectionId = await ctx.db.insert("connections", {
      orgId: org._id, provider: "meta_ads", status: "connected", externalAccountId: "demo_meta_ads",
      scopes: [], isFixture: true, createdBy: owner.userId, createdAt: Date.now(), updatedAt: Date.now(),
    });
    return ctx.db.insert("campaigns", {
      orgId: org._id, channel: "meta_ad", name: "Approval test", status: "needs_approval",
      dailyBudgetMinor: 1000, budgetEnvelopeMinor: 10000, currency: "USD",
      startDate: "2026-11-17", endDate: "2026-11-26", targetCostPerConversionMinor: 2000,
      reviewAfterDays: 7, stopRules: ["Owner-approved stop rule"], connectionId,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
  });
  const approve = async (action: "create_paused" | "activate" = "create_paused") => {
    await owner.client.mutation(api.ads.decide, { slug, campaignId, action });
    return t.run(async ctx => (await ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "campaign_activation").eq("subjectId", campaignId)).order("desc").first())!);
  };
  const receipts = () => t.run(async ctx => (await ctx.db.query("actionReceipts").collect()).filter(r => r.campaignId === campaignId));
  return { t, owner, slug, campaignId, approve, receipts };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-16T12:00:00Z")); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("campaign write authorization", () => {
  it("persists the exact account, total budget and review terms before a fixture write", async () => {
    const f = await campaignFixture();
    const approval = await f.approve();
    expect(approval.scope).toMatchObject({ totalSpendLimitMinor: 10000, targetCostPerConversionMinor: 2000, reviewAfterDays: 7 });
    expect(approval.scope.externalAccountId).toBeTruthy();
    expect(await f.receipts()).toHaveLength(0);
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: approval._id });
    expect(await f.receipts()).toMatchObject([{ status: "fixture_verified" }]);
  });

  it("invalidates queued approval when the owner rejects an unpublished campaign", async () => {
    const f = await campaignFixture();
    const approval = await f.approve();
    await f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: f.campaignId, action: "reject" });
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: approval._id });
    expect(await f.t.run(ctx => ctx.db.get(f.campaignId))).toMatchObject({ status: "draft" });
    expect(await f.t.run(ctx => ctx.db.get(approval._id))).toMatchObject({ status: "invalidated" });
    expect((await f.receipts()).some(r => r.status === "fixture_verified")).toBe(false);
  });

  it("does not report a live campaign paused merely because reject was requested", async () => {
    const f = await campaignFixture();
    await f.t.run(ctx => ctx.db.patch(f.campaignId, { status: "active", externalId: "live-campaign" }));
    await expect(f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: f.campaignId, action: "reject" })).rejects.toThrow(/pause/i);
    expect(await f.t.run(ctx => ctx.db.get(f.campaignId))).toMatchObject({ status: "active" });
  });

  it("checks the approving member's current permission before executing", async () => {
    const f = await campaignFixture();
    const approval = await f.approve();
    await f.t.run(async ctx => {
      const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", approval.orgId).eq("userId", f.owner.userId)).unique())!;
      await ctx.db.patch(member._id, { role: "viewer" });
    });
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: approval._id });
    expect((await f.receipts()).some(r => r.status === "fixture_verified")).toBe(false);
  });

  it("deduplicates repeated approval before the queued write starts", async () => {
    const f = await campaignFixture();
    const first = await f.approve();
    const second = await f.approve();
    expect(second._id).toBe(first._id);
    const rows = await f.t.run(ctx => ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "campaign_activation").eq("subjectId", f.campaignId)).collect());
    expect(rows.filter(a => a.status === "approved")).toHaveLength(1);
  });

  it.each([
    ["total spend cap", { budgetEnvelopeMinor: 15000 }],
    ["daily amount", { dailyBudgetMinor: 1500 }],
    ["currency", { currency: "KWD" }],
    ["end date", { endDate: "2026-11-27" }],
    ["destination", { destinationUrl: "https://example.com/changed" }],
    ["audience", { audience: "Different audience" }],
    ["stop rules", { stopRules: ["Different rule"] }],
    ["conversion target", { targetCostPerConversionMinor: 3000 }],
    ["review window", { reviewAfterDays: 14 }],
    ["campaign state", { status: "draft" }],
  ] satisfies Array<[string, Partial<Doc<"campaigns">>]>)("rejects a changed %s before execution", async (_name, patch) => {
    const f = await campaignFixture();
    const approval = await f.approve();
    await f.t.run(ctx => ctx.db.patch(f.campaignId, patch));
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: approval._id });
    expect(await f.receipts()).toMatchObject([{ status: "failed" }]);
    expect(await f.t.run(ctx => ctx.db.get(approval._id))).toMatchObject({ status: "invalidated" });
  });

  it("cancels a queued activation while preserving the recorded paused state", async () => {
    const f = await campaignFixture();
    await f.t.run(ctx => ctx.db.patch(f.campaignId, { status: "created_paused", externalId: "demo_campaign" }));
    const approval = await f.approve("activate");
    await f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: f.campaignId, action: "reject" });
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: approval._id });
    expect(await f.t.run(ctx => ctx.db.get(f.campaignId))).toMatchObject({ status: "created_paused" });
    expect((await f.receipts()).some(r => r.status === "fixture_verified")).toBe(false);
  });

  it("binds activation to the external campaign that was approved", async () => {
    const f = await campaignFixture();
    await f.t.run(ctx => ctx.db.patch(f.campaignId, { status: "created_paused", externalId: "approved_campaign" }));
    const approval = await f.approve("activate");
    expect(approval.scope.externalCampaignId).toBe("approved_campaign");
    await f.t.run(ctx => ctx.db.patch(f.campaignId, { externalId: "different_campaign" }));
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: approval._id });
    expect(await f.receipts()).toMatchObject([{ status: "failed" }]);
  });

  it.each(["account", "provider", "tenant", "disconnected"])("blocks changed connection %s", async change => {
    const f = await campaignFixture();
    const approval = await f.approve();
    const outsider = await asNewUser(f.t, "outside@example.com");
    const { slug } = await outsider.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
    await f.t.run(async ctx => {
      const c = (await ctx.db.get(f.campaignId))!;
      const other = (await ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", slug)).unique())!;
      await ctx.db.patch(c.connectionId!, change === "account" ? { externalAccountId: "changed" } : change === "provider" ? { provider: "google_ads" } : change === "tenant" ? { orgId: other._id } : { status: "revoked" });
    });
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: approval._id });
    expect(await f.receipts()).toMatchObject([{ status: "failed" }]);
  });

  it.each(["expiry", "policy", "emergency stop", "unsupported action"])("blocks %s at execution", async change => {
    const f = await campaignFixture();
    const approval = await f.approve();
    await f.t.run(async ctx => {
      if (change === "expiry") await ctx.db.patch(approval._id, { expiresAt: Date.now() - 1 });
      if (change === "unsupported action") await ctx.db.patch(approval._id, { actionKind: "delete" });
      if (change === "policy") {
        const p = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", approval.orgId).eq("active", true)).first())!;
        await ctx.db.patch(p._id, { version: p.version + 1 });
      }
      if (change === "emergency stop") await ctx.db.patch(approval.orgId, { emergencyStop: { active: true, at: Date.now(), by: f.owner.userId } });
    });
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: approval._id });
    expect(await f.receipts()).toMatchObject([{ status: "failed" }]);
  });

  it("does not accept another tenant's approval or let an outsider decide", async () => {
    const f = await campaignFixture();
    const approval = await f.approve();
    const outsider = await asNewUser(f.t, "outsider@example.com");
    const { slug } = await outsider.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
    await expect(outsider.client.mutation(api.ads.decide, { slug, campaignId: f.campaignId, action: "create_paused" })).rejects.toThrow(/couldn't find/i);
    await f.t.run(async ctx => {
      const other = (await ctx.db.query("organizations").withIndex("by_slug", q => q.eq("slug", slug)).unique())!;
      await ctx.db.patch(approval._id, { orgId: other._id });
    });
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: approval._id });
    expect(await f.receipts()).toHaveLength(0);
  });

  it("claims concurrent queue deliveries only once and ignores replay", async () => {
    const f = await campaignFixture();
    const approval = await f.approve();
    const args = { campaignId: f.campaignId, approvalId: approval._id };
    await Promise.all([f.t.action(internal.ads.executeCampaignWrite, args), f.t.action(internal.ads.executeCampaignWrite, args)]);
    await f.t.action(internal.ads.executeCampaignWrite, args);
    expect(await f.receipts()).toMatchObject([{ status: "fixture_verified" }]);
    const stored = await f.t.run(ctx => ctx.db.get(approval._id));
    expect(stored).toMatchObject({ status: "consumed", executionStartedAt: Date.now(), executionFinishedAt: Date.now() });
  });

  it("serializes old duplicate approvals for the same campaign", async () => {
    const f = await campaignFixture();
    const approval = await f.approve();
    const duplicate = await f.t.run(async ctx => {
      const { _id, _creationTime, ...copy } = approval;
      void _id; void _creationTime;
      return ctx.db.insert("approvals", copy);
    });
    await Promise.all([approval._id, duplicate].map(approvalId => f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId })));
    expect((await f.receipts()).filter(r => r.status === "fixture_verified")).toHaveLength(1);
  });

  it("keeps an interrupted claimed write visible and blocks retry even after policy invalidation", async () => {
    const f = await campaignFixture();
    const approval = await f.approve();
    const args = { campaignId: f.campaignId, approvalId: approval._id };
    expect((await f.t.mutation(internal.ads.claimCampaignWrite, args))?.error).toBeNull();
    await f.t.run(ctx => ctx.db.patch(approval._id, { status: "invalidated", invalidatedReason: "Policy changed during request" }));
    await f.t.action(internal.ads.executeCampaignWrite, args);
    await expect(f.approve()).rejects.toThrow(/already started/i);
    await expect(f.owner.client.mutation(api.ads.decide, { slug: f.slug, campaignId: f.campaignId, action: "reject" })).rejects.toThrow(/already started/i);
    expect(await f.receipts()).toHaveLength(0);
    const data = await f.owner.client.query(api.ads.list, { slug: f.slug });
    expect(data.campaigns.find(c => c.id === f.campaignId)?.writeState).toBe("started");
  });

  it("requires a new approval after a definite failed attempt", async () => {
    const f = await campaignFixture();
    const approval = await f.approve();
    const args = { campaignId: f.campaignId, approvalId: approval._id };
    await f.t.mutation(internal.ads.claimCampaignWrite, args);
    await f.t.mutation(internal.ads.recordCampaignResult, { ...args, action: "create_paused", status: "failed", summary: "Provider rejected the request before creating a campaign." });
    await f.t.action(internal.ads.executeCampaignWrite, args);
    expect(await f.receipts()).toHaveLength(1);
    const next = await f.approve();
    expect(next._id).not.toBe(approval._id);
    await f.t.action(internal.ads.executeCampaignWrite, { campaignId: f.campaignId, approvalId: next._id });
    expect((await f.receipts()).filter(r => r.status === "fixture_verified")).toHaveLength(1);
  });

  it("keeps an uncertain provider result unknown and refuses a fresh create", async () => {
    const f = await campaignFixture();
    const approval = await f.approve();
    const args = { campaignId: f.campaignId, approvalId: approval._id };
    await f.t.mutation(internal.ads.claimCampaignWrite, args);
    await f.t.mutation(internal.ads.recordCampaignResult, { ...args, action: "create_paused", status: "uncertain", newStatus: "uncertain", summary: "Request sent; provider result unknown." });
    await f.t.action(internal.ads.executeCampaignWrite, args);
    await expect(f.approve()).rejects.toThrow(/already started/i);
    expect(await f.receipts()).toMatchObject([{ status: "uncertain" }]);
    expect(await f.t.run(ctx => ctx.db.get(approval._id))).toMatchObject({ status: "invalidated", executionFinishedAt: Date.now() });
  });
});
