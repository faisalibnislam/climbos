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

  it.each(["sent", "queued", "sending", "uncertain"] as const)("includes %s review invitations in the broadcast policy", async status => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("reviewRequests", { orgId: f.orgId, name: "Ana", email: "ana@example.com", token: "synthetic", status, ...(status === "sent" ? { sentAt: NOW - DAY } : {}), createdAt: NOW - DAY }));
    const preview = await f.preview();
    expect(preview?.message).not.toBeNull();
    expect(preview).toMatchObject(status === "sent" ? { recentlyEmailed: 1, clearAt: NOW + 6 * DAY } : { activeReview: 1 });
    await expect(f.approve()).rejects.toThrow(/review|7-day/);
  });

  it("uses the actual latest review send time across more than 100 records and clears exactly at the limit", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 105; i++) await ctx.db.insert("reviewRequests", { orgId: f.orgId, name: "Ana", email: "ana@example.com", token: `synthetic-${i}`, status: "sent", sentAt: NOW - (i === 0 ? 1 : 20) * DAY, createdAt: NOW });
    });
    expect(await f.preview()).toMatchObject({ recentlyEmailed: 1, clearAt: NOW + 6 * DAY });
    vi.setSystemTime(NOW + 6 * DAY);
    expect((await f.preview())?.message).toBeNull();
  });

  it.each(["sent_folder", "owner_reported"] as const)("uses %s observation only as a conservative upper bound without inventing send time", async source => {
    const f = await fixture();
    const id = await f.t.run(ctx => ctx.db.insert("reviewRequests", { orgId: f.orgId, name: "Ana", email: "ana@example.com", token: "synthetic", status: "sent", recovery: { source, outcome: "sent", at: NOW - DAY, by: f.owner.userId, note: "Checked the original send", originalStatus: "uncertain" }, createdAt: NOW - 50 * DAY }));
    expect(await f.preview()).toMatchObject({ recentlyEmailed: 0, recentReviewObservations: 1, clearAt: NOW + 6 * DAY, message: expect.stringContaining("exact send time is unknown") });
    expect((await f.t.run(ctx => ctx.db.get(id)))?.sentAt).toBeUndefined();
    vi.setSystemTime(NOW + 6 * DAY);
    expect((await f.preview())?.message).toBeNull();
  });

  it.each(["undated sent", "unconfirmed failed", "too many undated"])("holds %s history rather than using creation time as send time", async scenario => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < (scenario === "too many undated" ? 101 : 1); i++) await ctx.db.insert("reviewRequests", { orgId: f.orgId, name: "Ana", email: "ana@example.com", token: `synthetic-${i}`, status: scenario === "unconfirmed failed" ? "failed" : "sent", ...(scenario === "too many undated" ? { recovery: { source: "owner_reported" as const, outcome: "sent" as const, at: NOW - 20 * DAY, by: f.owner.userId, note: "Owner observation", originalStatus: "uncertain" } } : {}), createdAt: NOW - 200 * DAY });
    });
    expect(await f.preview()).toMatchObject({ unknownReviewHistory: true, clearAt: null });
    await expect(f.approve()).rejects.toThrow(/cannot verify the timing/);
  });

  it.each(["known rejection", "owner not sent", "different address", "different tenant", "no limit"])("does not hold a broadcast for %s", async scenario => {
    const f = await fixture();
    const other = await asNewUser(f.t, "other-review-history@example.com");
    const w = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
    if (scenario === "no limit") await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: null });
    await f.t.run(ctx => ctx.db.insert("reviewRequests", { orgId: scenario === "different tenant" ? w.orgId : f.orgId, name: "Ana", email: scenario === "different address" ? "unrelated@example.com" : "ana@example.com", token: "synthetic", status: scenario === "known rejection" || scenario === "owner not sent" ? "failed" : "uncertain", ...(scenario === "known rejection" ? { notSentConfirmed: true } : {}), ...(scenario === "owner not sent" ? { recovery: { source: "owner_reported" as const, outcome: "not_sent" as const, at: NOW, by: f.owner.userId, note: "Confirmed rejection", originalStatus: "uncertain" } } : {}), createdAt: NOW }));
    expect((await f.preview())?.message ?? null).toBeNull();
    expect((await f.approve()).recipients).toBe(1);
  });

  it.each(["ciphertext", "address hash"])("holds an unverifiable %s join without exposing the address or decrypt error", async problem => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.insert("reviewRequests", { orgId: f.orgId, name: "Ana", email: "ana@example.com", token: "synthetic", status: "sent", sentAt: NOW, createdAt: NOW });
      await ctx.db.patch(f.contact._id, problem === "ciphertext" ? { emailCiphertext: "invalid" } : { emailHash: await sha256Hex("changed@example.com") });
    });
    const preview = await f.preview();
    expect(preview).toMatchObject({ unknownReviewHistory: true });
    expect(preview?.message).not.toMatch(/ana@|decrypt|secret/);
  });

  it.each(["future send", "invalid send", "future observation"])("keeps %s evidence unknown instead of calculating a clearance date", async problem => {
    const f = await fixture();
    await f.t.run(ctx => ctx.db.insert("reviewRequests", { orgId: f.orgId, name: "Ana", email: "ana@example.com", token: "synthetic", status: "sent", ...(problem === "future observation" ? { recovery: { source: "owner_reported" as const, outcome: "sent" as const, at: NOW + DAY, by: f.owner.userId, note: "Invalid future observation", originalStatus: "uncertain" } } : { sentAt: problem === "invalid send" ? -1 : NOW + DAY }), createdAt: NOW }));
    expect(await f.preview()).toMatchObject({ unknownReviewHistory: true, clearAt: null, recentlyEmailed: 0 });
  });

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
    expect((await f.owner.client.query(api.marketing.audience, { slug: f.slug })).segments).toContainEqual(expect.objectContaining({ segment: "newsletter", sendable: 1 }));
    await expect(f.approve()).rejects.toThrow(/within your 7-day limit/);
  });

  it.each(["future consent", "missing source", "suppressed", "deleted", "withdrawn at zero", "deleted at zero"])("does not include %s in the eligible frequency audience", async state => {
    const f = await fixture();
    await f.t.run(async ctx => {
      await ctx.db.patch(f.contact._id, { lastMarketingEmailAt: NOW - DAY, ...(state === "deleted" ? { deletedAt: NOW } : {}) });
      const consent = (await ctx.db.query("consentRecords").collect()).find(r => r.contactId === f.contact._id)!;
      if (state === "future consent") await ctx.db.patch(consent._id, { capturedAt: NOW + DAY });
      if (state === "missing source") await ctx.db.patch(consent._id, { source: " " });
      if (state === "withdrawn at zero") await ctx.db.patch(consent._id, { withdrawnAt: 0 });
      if (state === "deleted at zero") await ctx.db.patch(f.contact._id, { deletedAt: 0 });
      if (state === "suppressed") await ctx.db.insert("suppressions", { orgId: f.orgId, emailHash: f.contact.emailHash, reason: "unsubscribe", source: "owner", createdAt: NOW });
    });
    expect(await f.preview()).toMatchObject({ recentlyEmailed: 0, activeOutreach: 0, message: null });
    const segments = (await f.owner.client.query(api.marketing.audience, { slug: f.slug })).segments;
    expect(segments.find(s => s.segment === "newsletter")?.sendable ?? 0).toBe(0);
    await expect(f.approve()).rejects.toThrow(/Nobody in this segment/);
  });

  it("holds an incomplete consent history instead of reporting that it is clear", async () => {
    const f = await fixture();
    await f.t.run(async ctx => {
      for (let i = 0; i < 100; i++) await ctx.db.insert("consentRecords", { orgId: f.orgId, contactId: f.contact._id, purpose: "marketing_email", basis: "opt_in", source: "Owner", evidence: "Owner record", capturedAt: NOW - DAY, withdrawnAt: NOW });
    });
    await expect(f.preview()).rejects.toThrow(/consent history needs review/);
    await expect(f.owner.client.query(api.marketing.audience, { slug: f.slug })).rejects.toThrow(/consent history needs review/);
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
