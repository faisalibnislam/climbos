import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { encodeToolOutput, toolByName } from "../../convex/lib/climbTools";
import { linkClicksBetween } from "../../convex/links";
import { asNewUser, setup, type T } from "./helpers";

const day = 86_400_000;
const now = Date.UTC(2026, 10, 16, 12); // Monday; last week is Nov 9–16 UTC.
async function workspace(t: T, email = "report-owner@example.com") {
  const owner = await asNewUser(t, email);
  const w = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Report evidence" });
  const orgId = w.orgId as Id<"organizations">;
  await t.run(ctx => ctx.db.patch(orgId, { timezone: "UTC" }));
  const business = await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first());
  return { ...owner, ...w, orgId, businessId: business!._id };
}

describe("weekly and shared report evidence", () => {
  beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(now); });
  afterEach(() => vi.restoreAllMocks());

  it("uses publication confirmation time, distinct provider post IDs, and never mutable artifact edits", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      const a = await ctx.db.insert("artifacts", { orgId: w.orgId, businessId: w.businessId, kind: "social_post", channel: "instagram", title: "Post", status: "published", currentVersion: 1, createdAt: now - 60 * day, updatedAt: now - day });
      for (const [i, verifiedAt, status, action, externalId] of [
        [0, now - 20 * day, "verified", "instagram.publish_media", "old"],
        [1, now - day, "verified", "instagram.publish_media", "new"],
        [2, now - day, "verified", "instagram.publish_media", "new"],
        [3, now - day, "fixture_verified", "instagram.publish_media", "fixture"],
        [4, now - day, "verified", "export", "export"],
      ] as const) await ctx.db.insert("actionReceipts", { orgId: w.orgId, artifactId: a, provider: "instagram", action, idempotencyKey: `receipt-${i}`, status, externalId, summary: "Fixture", createdAt: now - 60 * day, verifiedAt });
      await ctx.db.insert("postMetrics", { orgId: w.orgId, artifactId: a, channel: "instagram", source: "platform", capturedAt: now - day, impressions: 50000, reach: 20000, clicks: 1000 });
    });
    const report = await w.client.query(api.reports.weekly, { slug: w.slug, weeksAgo: 1 });
    expect(report.lines.find(l => l.key === "postsPublished")).toMatchObject({ value: 1, note: expect.stringContaining("publication confirmations") });
    expect(report.lines.find(l => l.key === "reach")).toMatchObject({ value: null, change: null, note: expect.stringContaining("Impressions are not reach") });
    expect(report.lines.find(l => l.key === "clicks")?.value ?? 0).toBe(0);
    const tool = toolByName("get_weekly_report");
    expect(tool?.output).toBeDefined();
    const encoded = JSON.parse(encodeToolOutput(report, 20_000, tool?.output));
    expect(encoded.lines.find((l: { key: string }) => l.key === "reach").value).toBeNull();
  });

  it("counts received reply messages and old queued sends, not later prospect edits", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      const campaignId = await ctx.db.insert("outboundCampaigns", { orgId: w.orgId, title: "Old campaign", brief: { who: "Businesses", where: "Unknown", count: 1 }, status: "review", sequence: [], ownerNotes: [], excluded: [], createdBy: w.userId, createdAt: now - 100 * day, updatedAt: now });
      const prospectId = await ctx.db.insert("prospects", { orgId: w.orgId, campaignId, company: "Example", domain: "example.com", website: "https://example.com", location: "Unknown", sizeBand: "Unknown", why: "Fixture", evidence: [], trigger: "Unknown", fit: 0, timing: 0, contact: "Unknown", firstLine: "Fixture", stage: "won", createdAt: now - 100 * day, updatedAt: now - day });
      await ctx.db.insert("outboundSends", { orgId: w.orgId, campaignId, prospectId, step: 0, to: "fixture@example.com", scheduledFor: now - day, status: "bounced", sentAt: now - day, attempts: 1, createdAt: now - 100 * day });
      await ctx.db.insert("communityMessages", { orgId: w.orgId, channel: "email", kind: "email", externalId: "reply-old", prospectId, authorName: "Example", text: "Private reply", receivedAt: now - 20 * day, status: "replied", createdAt: now - 20 * day, updatedAt: now - day });
      await ctx.db.insert("communityMessages", { orgId: w.orgId, channel: "email", kind: "email", externalId: "reply-new", prospectId, authorName: "Example", text: "Private reply", receivedAt: now - day, status: "replied", createdAt: now - day, updatedAt: now });
    });
    const report = await w.client.query(api.reports.weekly, { slug: w.slug, weeksAgo: 1 });
    expect(report.lines.find(l => l.key === "replies")?.value).toBe(1);
    expect(report.lines.find(l => l.key === "emailsSent")?.value).toBe(1);
    expect(report.headline).toContain("reply message");
    expect(JSON.stringify(report)).not.toContain("Private reply");
    expect(report.next).not.toContain("Answer 1 reply.");
  });

  it("shows click counts only for full UTC days and does not mix platform snapshots", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      const linkId = await ctx.db.insert("links", { orgId: w.orgId, code: "testcode", url: "https://example.com", label: "Example", source: "manual", clicks: 600, createdAt: now - 30 * day });
      for (const [date, clicks] of [["2026-11-09", 100], ["2026-11-10", 200], ["2026-11-11", 300]] as const) await ctx.db.insert("linkClickDays", { orgId: w.orgId, linkId, day: date, clicks });
    });
    const partial = await t.run(ctx => linkClicksBetween(ctx, w.orgId, Date.UTC(2026, 10, 9, 12), Date.UTC(2026, 10, 11, 12)));
    expect(partial).toMatchObject({ value: 200, comparable: false, note: expect.stringContaining("2026-11-10 through 2026-11-10") });
    const complete = await t.run(ctx => linkClicksBetween(ctx, w.orgId, Date.UTC(2026, 10, 9), Date.UTC(2026, 10, 12)));
    expect(complete).toMatchObject({ value: 600, comparable: true });
    expect(await t.run(ctx => linkClicksBetween(ctx, w.orgId, now - 1000, now))).toMatchObject({ value: null, comparable: false });
  });

  it("withholds capped totals and preserves evidence notes through public shares and access checks", async () => {
    const t = setup(); const w = await workspace(t); const other = await workspace(t, "other-report@example.com");
    await t.run(async ctx => {
      for (let i = 0; i < 1001; i++) await ctx.db.insert("deals", { orgId: w.orgId, name: `Deal ${i}`, stage: "won", source: "manual", currency: "USD", notes: [], wonAt: now - day, createdAt: now - 100 * day, updatedAt: now - day });
    });
    const report = await w.client.query(api.reports.weekly, { slug: w.slug, weeksAgo: 1 });
    expect(report.lines.find(l => l.key === "dealsWon")).toMatchObject({ value: null, change: null, note: expect.stringContaining("read limit") });
    expect(report.headline).toContain("unavailable");
    await expect(other.client.query(api.reports.weekly, { slug: w.slug })).rejects.toThrow();
    const before = await t.run(ctx => ctx.db.query("actionReceipts").collect());
    const url = await w.client.mutation(api.clientReports.createLink, { slug: w.slug });
    const token = url.split("/report/")[1];
    const shared = await t.query(api.clientReports.shared, { token });
    expect(shared?.lines.find(l => l.key === "dealsWon")).toMatchObject({ value: null, note: expect.stringContaining("read limit") });
    expect(shared?.lines.some(l => l.key === "creditsUsed" || l.key === "jobsDone")).toBe(false);
    expect(await t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual(before);
    const links = await w.client.query(api.clientReports.branding, { slug: w.slug });
    await w.client.mutation(api.clientReports.revoke, { slug: w.slug, id: links.links[0].id });
    expect(await t.query(api.clientReports.shared, { token })).toBeNull();
  });

  it("counts job finishes and usage events in their actual periods, not when a job was created", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      await ctx.db.insert("workflowRuns", { orgId: w.orgId, kind: "strategy", title: "Old job finished last week", status: "verified", input: "{}", roles: [], estimateMicros: 0, actualMicros: 999_000_000, rateVersionId: "r1", entitlementVersionId: "e1", routingVersionId: "r1", budget: { modelSteps: 1, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now - 100 * day, updatedAt: now, finishedAt: now - day });
      await ctx.db.insert("usageEvents", { orgId: w.orgId, type: "model_call", provider: "fixture", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: 0, estimated: false, createdAt: now - day });
    });
    const report = await w.client.query(api.reports.weekly, { slug: w.slug, weeksAgo: 1 });
    expect(report.lines.find(l => l.key === "jobsDone")?.value).toBe(1);
    expect(report.lines.find(l => l.key === "creditsUsed")?.value ?? 0).toBe(0);
    await expect(t.query(api.reports.weekly, { slug: w.slug })).rejects.toThrow();
  });

  it("counts bookings by creation time and keeps cancellations separate", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      const pageId = await ctx.db.insert("bookingPages", { orgId: w.orgId, slug: "fixture", title: "Fixture", durationMin: 30, timezone: "UTC", days: [1], startHour: 9, endHour: 17, bufferMin: 0, noticeHours: 24, active: true, createdAt: now, updatedAt: now });
      for (const [i, createdAt, status] of [[0, now - day, "confirmed"], [1, now - 20 * day, "confirmed"], [2, now - day, "cancelled"]] as const) {
        await ctx.db.insert("bookings", { orgId: w.orgId, pageId, name: `Guest ${i}`, emailHash: "fixture", emailCiphertext: "fixture", emailIv: "fixture", emailKeyId: "fixture", startAt: now + 120 * day, endAt: now + 120 * day + 30 * 60000, status, createdAt });
      }
    });
    const report = await w.client.query(api.reports.weekly, { slug: w.slug, weeksAgo: 1 });
    expect(report.lines.find(l => l.key === "callsBooked")).toMatchObject({ value: 1, note: expect.stringContaining("Currently confirmed") });
  });

  it("withholds usage and click totals when their shared transaction read budget is exhausted", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      const linkId = await ctx.db.insert("links", { orgId: w.orgId, code: "capped-clicks", url: "https://example.com", label: "Fixture", source: "manual", clicks: 2001, createdAt: now - 30 * day });
      for (let i = 0; i < 2001; i++) {
        await ctx.db.insert("usageEvents", { orgId: w.orgId, type: "model_call", provider: "fixture", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: 1_000_000, estimated: false, createdAt: now - day });
        await ctx.db.insert("linkClickDays", { orgId: w.orgId, linkId, day: "2026-11-15", clicks: 1 });
      }
    });
    const report = await w.client.query(api.reports.weekly, { slug: w.slug, weeksAgo: 1 });
    for (const key of ["creditsUsed", "clicks"]) expect(report.lines.find(l => l.key === key)).toMatchObject({ value: null, change: null, note: expect.stringContaining("2,000-record read limit") });
  });

  it("keeps estimates and invalid click records from becoming comparable measured totals", async () => {
    const t = setup(); const w = await workspace(t);
    await t.run(async ctx => {
      const linkId = await ctx.db.insert("links", { orgId: w.orgId, code: "duplicate-clicks", url: "https://example.com", label: "Fixture", source: "manual", clicks: 2, createdAt: now - 30 * day });
      for (let i = 0; i < 2; i++) await ctx.db.insert("linkClickDays", { orgId: w.orgId, linkId, day: "2026-11-15", clicks: 1 });
      await ctx.db.insert("usageEvents", { orgId: w.orgId, type: "model_call", provider: "fixture", inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, quantity: 1, costMicros: 1_000_000, estimated: true, createdAt: now - day });
    });
    const report = await w.client.query(api.reports.weekly, { slug: w.slug, weeksAgo: 1 });
    expect(report.lines.find(l => l.key === "creditsUsed")).toMatchObject({ value: expect.any(Number), change: null, note: expect.stringContaining("estimated charges") });
    expect(report.lines.find(l => l.key === "clicks")).toMatchObject({ value: null, change: null, note: expect.stringContaining("duplicate or invalid") });
  });
});
