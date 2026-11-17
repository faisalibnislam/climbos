import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import { sha256Hex } from "../../shared/policy";
import { asNewUser, setup } from "./helpers";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 17, 12);

async function fixture() {
  const t = setup();
  const owner = await asNewUser(t, "frequency-history@example.com", { anonymous: true });
  const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
  await owner.client.action(api.marketing.importContacts, { slug, csv: "email,consent,consent_source,consent_date,segment\nana@example.com,yes,signup form,2026-09-01,newsletter" });
  const emailHash = await sha256Hex("ana@example.com");
  const contact = await t.run(async ctx => (await ctx.db.query("contacts").collect()).find(c => c.emailHash === emailHash)!);
  const orgId = contact.orgId;
  const email = await t.run(async ctx => (await ctx.db.query("artifacts").collect()).find(a => a.orgId === orgId && a.kind === "email_sequence")!);
  await owner.client.mutation(api.content.decide, { slug, artifactId: email._id, decision: "approve" });
  await owner.client.mutation(api.settings.setContactFrequency, { slug, days: 7 });
  const approve = () => owner.client.mutation(api.marketing.approveSend, { slug, artifactId: email._id, emailIndex: 0, segment: "newsletter", providerSegmentId: "seg-1", from: "Owner <hello@example.com>" });
  const preview = () => owner.client.query(api.marketing.frequencyPreview, { slug, segment: "newsletter" });
  return { t, owner, orgId, contact, slug, approve, preview };
}

async function outreach(f: Awaited<ReturnType<typeof fixture>>, timestamps: number[]) {
  await f.t.run(async ctx => {
    const campaignId = await ctx.db.insert("outboundCampaigns", { orgId: f.orgId, title: "Prior outreach", brief: { who: "Owner supplied", where: "Unknown", count: 1 }, status: "review", sequence: [], ownerNotes: [], excluded: [], createdBy: f.owner.userId, createdAt: NOW, updatedAt: NOW });
    const prospectId = await ctx.db.insert("prospects", { orgId: f.orgId, campaignId, company: "Example", domain: "example.com", website: "https://example.com", location: "Unknown", sizeBand: "Unknown", why: "Owner supplied", evidence: [], trigger: "Unknown", fit: 0, timing: 0, contact: "Ana", publicEmail: "ana@example.com", firstLine: "Hello", stage: "contacted", createdAt: NOW, updatedAt: NOW });
    for (const sentAt of timestamps) await ctx.db.insert("outboundSends", { orgId: f.orgId, campaignId, prospectId, step: 0, to: "ana@example.com", recipientHash: await sha256Hex("ana@example.com"), scheduledFor: sentAt, status: "sent", sentAt, attempts: 1, createdAt: NOW });
  });
}

describe("complete contact frequency history", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
  afterEach(() => vi.useRealTimers());

  it.each(["last", "first"])("uses actual latest send time when a recent send was inserted %s among more than 20", async position => {
    const f = await fixture();
    const old = Array.from({ length: 25 }, (_, i) => NOW - (10 + i) * DAY);
    await outreach(f, position === "last" ? [...old, NOW - DAY] : [NOW - DAY, ...old]);
    expect(await f.preview()).toMatchObject({ recentlyEmailed: 1, clearAt: NOW + 6 * DAY });
    await expect(f.approve()).rejects.toThrow(/within your 7-day limit/);
    expect(await f.t.run(ctx => ctx.db.query("approvals").filter(q => q.eq(q.field("subjectType"), "email_send")).collect())).toEqual([]);
  });

  it("checks a valid opt-in after five withdrawn records against the same send audience", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      const original = (await ctx.db.query("consentRecords").collect()).find(r => r.contactId === f.contact._id)!;
      await ctx.db.patch(original._id, { withdrawnAt: NOW - DAY });
      const { _id: _id, _creationTime: _time, ...fields } = original;
      for (let i = 0; i < 4; i++) await ctx.db.insert("consentRecords", { ...fields, withdrawnAt: NOW - DAY });
      await ctx.db.insert("consentRecords", { ...fields, capturedAt: NOW - DAY });
      await ctx.db.patch(f.contact._id, { lastMarketingEmailAt: NOW - DAY });
    });
    expect(await f.preview()).toMatchObject({ recentlyEmailed: 1 });
    await expect(f.approve()).rejects.toThrow(/within your 7-day limit/);
  });

  it.each(["future consent", "missing source", "suppressed", "deleted"])("does not include %s in the eligible frequency audience", async state => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.contact._id, { lastMarketingEmailAt: NOW - DAY, ...(state === "deleted" ? { deletedAt: NOW } : {}) });
      const consent = (await ctx.db.query("consentRecords").collect()).find(r => r.contactId === f.contact._id)!;
      if (state === "future consent") await ctx.db.patch(consent._id, { capturedAt: NOW + DAY });
      if (state === "missing source") await ctx.db.patch(consent._id, { source: " " });
      if (state === "suppressed") await ctx.db.insert("suppressions", { orgId: f.orgId, emailHash: f.contact.emailHash, reason: "unsubscribe", source: "owner", createdAt: NOW });
    });
    expect(await f.preview()).toMatchObject({ recentlyEmailed: 0, activeOutreach: 0, message: null });
    await expect(f.approve()).rejects.toThrow(/Nobody in this segment/);
  });

  it("holds an incomplete consent history instead of reporting that it is clear", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 100; i++) await ctx.db.insert("consentRecords", { orgId: f.orgId, contactId: f.contact._id, purpose: "marketing_email", basis: "opt_in", source: "Owner", evidence: "Owner record", capturedAt: NOW - DAY, withdrawnAt: NOW });
    });
    await expect(f.preview()).rejects.toThrow(/consent history needs review/);
    await expect(f.approve()).rejects.toThrow(/consent history needs review/);
  });

  it("does not use another workspace's history for the same address", async () => {
    const f = await fixture();
    const other = await asNewUser(f.t, "other-frequency@example.com");
    const { orgId } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other workspace" });
    await outreach({ ...f, orgId, owner: other }, [NOW - DAY]);
    expect(await f.preview()).toMatchObject({ recentlyEmailed: 0, activeOutreach: 0, message: null });
    await expect(other.client.query(api.marketing.frequencyPreview, { slug: f.slug, segment: "newsletter" })).rejects.toThrow();
  });

  it.each(["queued", "sending", "uncertain"] as const)("holds a recipient with %s outreach independently of completed history", async status => {
    const f = await fixture();
    await outreach(f, [NOW - 30 * DAY]);
    await f.t.run(async ctx => {
      const send = (await ctx.db.query("outboundSends").collect())[0];
      await ctx.db.patch(send._id, { status, sentAt: undefined });
    });
    expect(await f.preview()).toMatchObject({ recentlyEmailed: 0, activeOutreach: 1 });
    await expect(f.approve()).rejects.toThrow(/active outreach sequence/);
  });

  it("clears at the exact owner-selected interval without requiring a longer delay", async () => {
    const f = await fixture();
    await outreach(f, [NOW - 7 * DAY]);
    expect(await f.preview()).toMatchObject({ recentlyEmailed: 0, activeOutreach: 0, message: null });
    expect((await f.approve()).recipients).toBe(1);
  });
});
