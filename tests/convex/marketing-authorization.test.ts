import { afterEach, expect, it, vi } from "vitest";
import type { FunctionArgs } from "convex/server";
import { api, internal } from "../../convex/_generated/api";
import { sha256Hex } from "../../shared/policy";
import { asNewUser, makePaid, setup } from "./helpers";

const provider = vi.hoisted(() => ({ synced: [] as string[], drafts: 0, sends: 0, outcome: "verified" as "verified" | "uncertain" | "throw", onRead: null as null | (() => Promise<void>), recovery: null as null | Record<string, unknown>, reads: 0, onRecovery: null as null | (() => Promise<void>), lastDraft: null as unknown, sentDraft: null as unknown }));
vi.mock("../../shared/integrations/resendMarketing", async original => ({
  ...await original<typeof import("../../shared/integrations/resendMarketing")>(),
  upsertMarketingContact: vi.fn(async ({ contact }: { contact: { email: string } }) => { provider.synced.push(contact.email); return { status: "verified", data: { email: contact.email, unsubscribed: false } }; }),
  listSegmentContacts: vi.fn(async () => { await provider.onRead?.(); return { ok: true, data: { truncated: false, items: provider.synced.map(email => ({ email, unsubscribed: false })) } }; }),
  createDraftBroadcast: vi.fn(async ({ draft }: { draft: unknown }) => { provider.lastDraft = draft; provider.drafts++; return { status: "verified", externalId: "broadcast-test" }; }),
  getBroadcast: vi.fn(async () => { provider.reads++; await provider.onRecovery?.(); return provider.recovery ? { ok: true, data: provider.recovery } : { ok: false, providerMessage: "Read unavailable" }; }),
  sendBroadcast: vi.fn(async ({ expectedDraft }: { expectedDraft: unknown }) => { provider.sentDraft = expectedDraft; provider.sends++; if (provider.outcome === "throw") throw new Error("Lost provider response"); return { status: provider.outcome, externalId: "broadcast-test" }; }),
}));
afterEach(() => { provider.synced = []; provider.drafts = 0; provider.sends = 0; provider.outcome = "verified"; provider.onRead = null; provider.recovery = null; provider.reads = 0; provider.onRecovery = null; provider.lastDraft = null; provider.sentDraft = null; });

async function fixture(body = "A useful update for subscribers.", recipients = 1, withdrawnConsents = 0) {
  const t = setup(), owner = await asNewUser(t, "email-boundary@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Email boundary" });
  await makePaid(t, orgId);
  await t.run(async ctx => {
    const period = (await ctx.db.query("usagePeriods").withIndex("by_org_ends", q => q.eq("orgId", orgId)).collect()).find(p => p.source === "subscription")!;
    await ctx.db.patch(period._id, { meterCaps: { ...period.meterCaps, byoMarketingSends: Math.max(100, recipients) } });
  });
  const importContact = (email: string) => owner.client.action(api.marketing.importContacts, { slug, csv: `email,consent,consent_source,consent_date,segment\n${email},yes,signup form,2026-10-01,newsletter` });
  await importContact("ana@example.com");
  if (withdrawnConsents) await t.run(async ctx => {
    const consent = (await ctx.db.query("consentRecords").collect())[0];
    await ctx.db.patch(consent._id, { withdrawnAt: Date.now() });
    const { _id: _id, _creationTime: _time, ...fields } = consent;
    for (let i = 1; i < withdrawnConsents; i++) await ctx.db.insert("consentRecords", { ...fields, withdrawnAt: Date.now() });
    await ctx.db.insert("consentRecords", { ...fields, capturedAt: Date.now() });
  });
  if (recipients > 1) await owner.client.action(api.marketing.importContacts, { slug, csv: "email,consent,consent_source,consent_date,segment\n" + Array.from({ length: recipients - 1 }, (_, i) => `extra-${i}@example.com,yes,signup form,2026-10-01,newsletter`).join("\n") });
  await t.mutation(internal.connections.storeConnection, { orgId, userId: owner.userId, provider: "email_resend", secret: JSON.stringify({ apiKey: "test-key" }), secretKind: "api_key", scopes: [], accountLabel: "Test account" });
  const artifactId = await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    const artifactId = await ctx.db.insert("artifacts", { orgId, businessId: business._id, kind: "email", channel: "email", title: "An update", status: "approved", currentVersion: 1, createdAt: Date.now(), updatedAt: Date.now() });
    const versionId = await ctx.db.insert("artifactVersions", { orgId, artifactId, version: 1, headline: "An update", body, hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "fixture", createdAt: Date.now() });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    return artifactId;
  });
  await owner.client.mutation(api.marketing.approveSend, { slug, artifactId, emailIndex: 0, segment: "newsletter", providerSegmentId: "seg-news", from: "Owner <hello@example.com>" });
  const args = await t.run(async ctx => {
    const scheduled = (await ctx.db.system.query("_scheduled_functions").collect()).find(f => f.name.includes("executeSend"))!;
    await ctx.scheduler.cancel(scheduled._id);
    return scheduled.args[0] as FunctionArgs<typeof internal.marketing.executeSend>;
  });
  return { t, owner, slug, orgId, artifactId, args, importContact };
}

async function anotherApprovedEmail(f: Awaited<ReturnType<typeof fixture>>, segment = "newsletter") {
  const artifactId = await f.t.run(async ctx => {
    const source = (await ctx.db.get(f.artifactId))!;
    const artifactId = await ctx.db.insert("artifacts", { orgId: f.orgId, businessId: source.businessId, kind: "email", channel: "email", title: "Another update", status: "approved", currentVersion: 1, createdAt: Date.now(), updatedAt: Date.now() });
    const versionId = await ctx.db.insert("artifactVersions", { orgId: f.orgId, artifactId, version: 1, headline: "Another update", body: "Another useful message.", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "fixture", createdAt: Date.now() });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    return artifactId;
  });
  await f.owner.client.mutation(api.marketing.approveSend, { slug: f.slug, artifactId, emailIndex: 0, segment, providerSegmentId: `seg-${segment}`, from: f.args.from });
  return f.t.run(async ctx => {
    const approval = (await ctx.db.query("approvals").withIndex("by_subject", q => q.eq("subjectType", "email_send").eq("subjectId", artifactId)).first())!;
    const scheduled = (await ctx.db.system.query("_scheduled_functions").collect()).find(s => s.name.includes("executeSend") && (s.args[0] as { approvalId?: string }).approvalId === approval._id)!;
    await ctx.scheduler.cancel(scheduled._id);
    return scheduled.args[0] as FunctionArgs<typeof internal.marketing.executeSend>;
  });
}

async function prepareReview(f: Awaited<ReturnType<typeof fixture>>) {
  await f.owner.client.mutation(api.reviews.setReviewUrl, { slug: f.slug, url: "https://g.page/r/synthetic/review" });
  await f.t.mutation(internal.connections.storeConnection, { orgId: f.orgId, userId: f.owner.userId, provider: "email_mailbox", secret: JSON.stringify({ email: "owner@example.com" }), secretKind: "api_key", scopes: [], accountLabel: "owner@example.com" });
  return f.owner.client.mutation(api.reviews.prepareBatch, { slug: f.slug, people: [{ name: "Ana", email: "ana@example.com" }] });
}

it("a running broadcast blocks review approval and a fresh preview for its exact tenant and recipient", async () => {
  const f = await fixture(), batch = await prepareReview(f);
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect((await f.t.mutation(internal.marketing.claimSend, f.args))?.error).toBeNull();
  await expect(f.owner.client.mutation(api.reviews.approveBatch, { slug: f.slug, batchId: batch.batchId, contentHash: batch.contentHash, scopeHash: batch.scopeHash, confirmEligibleRecipients: true })).rejects.toThrow(/contact limit/);
  await expect(f.owner.client.mutation(api.reviews.prepareBatch, { slug: f.slug, people: batch.recipients })).rejects.toThrow(/contact limit/);
  expect(await f.t.run(ctx => ctx.db.query("reviewRequests").collect())).toEqual([]);
  expect(provider.sends).toBe(0);
});

it("queued review approval blocks a previously approved broadcast at claim, without touching the provider", async () => {
  const f = await fixture(), batch = await prepareReview(f);
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  await f.owner.client.mutation(api.reviews.approveBatch, { slug: f.slug, batchId: batch.batchId, contentHash: batch.contentHash, scopeHash: batch.scopeHash, confirmEligibleRecipients: true });
  await f.t.action(internal.marketing.executeSend, f.args);
  expect(provider.synced).toEqual([]);
  expect(provider.sends).toBe(0);
  expect((await f.owner.client.query(api.marketing.frequencyPreview, { slug: f.slug, segment: "newsletter" }))?.activeReview).toBe(1);
});

it("cannot claim a broadcast and approve an overlapping review batch concurrently under the same policy", async () => {
  const f = await fixture(), batch = await prepareReview(f);
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  const outcomes = await Promise.allSettled([
    f.t.mutation(internal.marketing.claimSend, f.args).then(result => Boolean(result && !result.error)),
    f.owner.client.mutation(api.reviews.approveBatch, { slug: f.slug, batchId: batch.batchId, contentHash: batch.contentHash, scopeHash: batch.scopeHash, confirmEligibleRecipients: true }).then(result => result.queued > 0),
  ]);
  expect(outcomes.filter(result => result.status === "fulfilled" && result.value)).toHaveLength(1);
  expect(provider.sends).toBe(0);
});

it("holds review invitations when an unresolved broadcast has incomplete historical recipient evidence", async () => {
  const f = await fixture(), batch = await prepareReview(f);
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect((await f.t.mutation(internal.marketing.claimSend, f.args))?.error).toBeNull();
  await f.t.run(ctx => ctx.db.patch(f.args.approvalId, { emailRecipientHashBatches: undefined }));
  await expect(f.owner.client.mutation(api.reviews.prepareBatch, { slug: f.slug, people: [{ name: "Another", email: "other@example.com" }] })).rejects.toThrow(/contact limit/);
  await expect(f.owner.client.mutation(api.reviews.approveBatch, { slug: f.slug, batchId: batch.batchId, contentHash: batch.contentHash, scopeHash: batch.scopeHash, confirmEligibleRecipients: true })).rejects.toThrow(/contact limit/);
  expect(provider.sends).toBe(0);
});

it("rechecks a newly enabled policy before review dispatch even when both workflows were approved without a limit", async () => {
  const f = await fixture(), batch = await prepareReview(f);
  await f.owner.client.mutation(api.reviews.approveBatch, { slug: f.slug, batchId: batch.batchId, contentHash: batch.contentHash, scopeHash: batch.scopeHash, confirmEligibleRecipients: true });
  const request = (await f.t.run(ctx => ctx.db.query("reviewRequests").first()))!;
  const job = (await f.t.query(internal.reviews.prepareRequest, { id: request._id }))!;
  expect((await f.t.mutation(internal.marketing.claimSend, f.args))?.error).toBeNull();
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect(await f.t.mutation(internal.reviews.claimRequest, { id: request._id, credentialId: job.credentialId, payloadHash: job.payloadHash })).toBeNull();
  await f.t.mutation(internal.reviews.failUnstartedRequest, { id: request._id });
  expect(await f.t.run(ctx => ctx.db.get(request._id))).toMatchObject({ status: "failed", notSentConfirmed: true, error: expect.stringContaining("contact limit") });
  // The rejected, unstarted review releases its hold; the original broadcast can now proceed under its own scope.
  expect(await f.t.mutation(internal.marketing.authorizeSendDispatch, { ...f.args, externalId: "synthetic-draft" })).toMatchObject({ ok: true });
  expect(provider.sends).toBe(0);
});

it("serializes different approved broadcasts for the same recipient under an owner frequency limit", async () => {
  const f = await fixture();
  const second = await anotherApprovedEmail(f);
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  const claims = await Promise.all([f.t.mutation(internal.marketing.claimSend, f.args), f.t.mutation(internal.marketing.claimSend, second)]);
  expect(claims.filter(c => c && !c.error)).toHaveLength(1);
  expect(claims.find(c => c?.error)?.error).toMatch(/marketing send result/);
  expect(provider.sends).toBe(0);
});

it.each(["running", "uncertain", "expired", "legacy"] as const)("holds another broadcast for a %s send and explains it in the existing preview", async state => {
  const f = await fixture();
  const second = await anotherApprovedEmail(f);
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect((await f.t.mutation(internal.marketing.claimSend, f.args))?.error).toBeNull();
  if (state === "uncertain") await f.t.mutation(internal.marketing.finishSend, { approvalId: f.args.approvalId, reservationId: f.args.reservationId, status: "uncertain", sent: 0, summary: "Provider response unknown" });
  if (state === "expired") await f.t.run(ctx => ctx.db.patch(f.args.approvalId, { expiresAt: Date.now() - 1 }));
  if (state === "legacy") await f.t.run(ctx => ctx.db.patch(f.args.approvalId, { emailRecipientHashBatches: undefined }));
  const preview = await f.owner.client.query(api.marketing.frequencyPreview, { slug: f.slug, segment: "newsletter" });
  expect(preview?.message).toMatch(state === "legacy" ? /cannot verify.*earlier email/i : /marketing send result/);
  await f.t.action(internal.marketing.executeSend, second);
  expect(provider.synced).toEqual([]);
  expect(provider.drafts).toBe(0);
  expect(provider.sends).toBe(0);
  await expect(anotherApprovedEmail(f)).rejects.toThrow(state === "legacy" ? /cannot verify.*earlier email/i : /marketing send result/);
});

it("rechecks a frequency limit enabled between claim and dispatch", async () => {
  const f = await fixture();
  const second = await anotherApprovedEmail(f);
  expect((await f.t.mutation(internal.marketing.claimSend, f.args))?.error).toBeNull();
  expect((await f.t.mutation(internal.marketing.claimSend, second))?.error).toBeNull();
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect(await f.t.mutation(internal.marketing.authorizeSendDispatch, { ...second, externalId: "second-draft" })).toMatchObject({ ok: false, message: expect.stringContaining("marketing send result") });
});

it("executes only one of two overlapping broadcasts and releases the refused attempt's allowance", async () => {
  const f = await fixture();
  const second = await anotherApprovedEmail(f);
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  await Promise.all([f.t.action(internal.marketing.executeSend, f.args), f.t.action(internal.marketing.executeSend, second)]);
  expect(provider.sends).toBe(1);
  expect(provider.drafts).toBe(1);
  const receipts = await f.t.run(ctx => ctx.db.query("actionReceipts").collect());
  expect(receipts.map(r => r.status).sort()).toEqual(["failed", "verified"]);
  const reservations = await f.t.run(ctx => ctx.db.query("usageReservations").collect());
  expect(reservations.filter(r => r.purpose === "email_send").map(r => r.status)).toEqual(["reconciled", "reconciled"]);
});

it("keeps no-limit behavior while retaining recipient evidence for a later policy change", async () => {
  const f = await fixture();
  const second = await anotherApprovedEmail(f);
  for (const args of [f.args, second]) {
    expect((await f.t.mutation(internal.marketing.claimSend, args))?.error).toBeNull();
    expect(await f.t.mutation(internal.marketing.authorizeSendDispatch, { ...args, externalId: String(args.approvalId) })).toMatchObject({ ok: true });
    expect((await f.t.run(ctx => ctx.db.get(args.approvalId)))?.emailRecipientHashBatches?.flat()).toHaveLength(1);
  }
  expect(await f.owner.client.query(api.marketing.frequencyPreview, { slug: f.slug, segment: "newsletter" })).toBeNull();
});

it("allows disjoint audiences under the same policy and ignores its own claim at dispatch", async () => {
  const f = await fixture();
  await f.importContact("bea@example.com");
  await f.t.run(async ctx => {
    const hash = await sha256Hex("bea@example.com");
    const newContact = (await ctx.db.query("contacts").withIndex("by_org_email", q => q.eq("orgId", f.orgId).eq("emailHash", hash)).first())!;
    await ctx.db.patch(newContact._id, { segments: ["other"] });
  });
  const second = await anotherApprovedEmail(f, "other");
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  for (const args of [f.args, second]) {
    expect((await f.t.mutation(internal.marketing.claimSend, args))?.error).toBeNull();
    expect(await f.t.mutation(internal.marketing.authorizeSendDispatch, { ...args, externalId: String(args.approvalId) })).toMatchObject({ ok: true });
  }
});

it("a definitively failed attempt releases the frequency hold", async () => {
  const f = await fixture();
  const second = await anotherApprovedEmail(f);
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect((await f.t.mutation(internal.marketing.claimSend, f.args))?.error).toBeNull();
  await f.t.mutation(internal.marketing.finishSend, { approvalId: f.args.approvalId, reservationId: f.args.reservationId, status: "failed", sent: 0, summary: "Stopped before provider dispatch" });
  expect((await f.t.mutation(internal.marketing.claimSend, second))?.error).toBeNull();
});

it.each(["missing", "duplicate", "count", "invalid hash", "too many"] as const)("holds incomplete pending-recipient evidence: %s", async fault => {
  const f = await fixture();
  const second = await anotherApprovedEmail(f);
  await f.t.mutation(internal.marketing.claimSend, f.args);
  await f.t.run(async ctx => {
    const a = (await ctx.db.get(f.args.approvalId))!;
    const hash = (await ctx.db.query("contacts").collect())[0].emailHash;
    if (fault === "missing") await ctx.db.patch(a._id, { emailRecipientHashBatches: undefined });
    if (fault === "duplicate") await ctx.db.patch(a._id, { emailRecipientHashBatches: [[hash, hash]], scope: { ...a.scope, spendLimitMinor: 2 } });
    if (fault === "count") await ctx.db.patch(a._id, { emailRecipientHashBatches: [[hash]], scope: { ...a.scope, spendLimitMinor: 2 } });
    if (fault === "invalid hash") await ctx.db.patch(a._id, { emailRecipientHashBatches: [["unknown"]] });
    if (fault === "too many") {
      const { _id: _id, _creationTime: _time, ...fields } = a;
      for (let i = 0; i < 8; i++) await ctx.db.insert("approvals", fields);
    }
  });
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect((await f.t.mutation(internal.marketing.claimSend, second))?.error).toMatch(/cannot verify.*earlier email/i);
  expect(provider.sends).toBe(0);
});

it("does not use another tenant's unresolved recipient snapshot", async () => {
  const f = await fixture();
  const other = await asNewUser(f.t, "other-pending-send@example.com");
  const otherOrg = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other pending send" });
  await f.t.run(async ctx => {
    const approval = (await ctx.db.get(f.args.approvalId))!;
    const { _id: _id, _creationTime: _time, ...fields } = approval;
    const hash = (await ctx.db.query("contacts").collect())[0].emailHash;
    await ctx.db.insert("approvals", { ...fields, orgId: otherOrg.orgId, executionStartedAt: Date.now(), emailRecipientHashBatches: [[hash]] });
  });
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect((await f.t.mutation(internal.marketing.claimSend, f.args))?.error).toBeNull();
});

it("rejects a same-size audience replacement before any provider write", async () => {
  const f = await fixture();
  await f.t.run(async ctx => { const contact = (await ctx.db.query("contacts").collect())[0]; await ctx.db.patch(contact._id, { segments: ["other"] }); });
  await f.importContact("bea@example.com");
  await f.t.action(internal.marketing.executeSend, f.args);
  expect(provider.synced).toEqual([]);
  expect(provider.sends).toBe(0);
});

it.each(["content", "payload", "role", "policy", "credentials", "suppression", "sender", "destination", "version", "expired", "paused", "frequency", "legacy"] as const)("rechecks %s before touching the provider", async change => {
  const f = await fixture();
  if (change === "content") await f.t.run(async ctx => { const a = (await ctx.db.get(f.artifactId))!; await ctx.db.patch(a.currentVersionId!, { body: "Changed since approval" }); });
  if (change === "payload") f.args.html = "Unapproved message";
  if (change === "sender") f.args.from = "Another <other@example.com>";
  if (change === "destination") f.args.providerSegmentId = "other-segment";
  if (change === "version") await f.t.run(async ctx => { const a = (await ctx.db.get(f.artifactId))!; const old = (await ctx.db.get(a.currentVersionId!))!; const { _id: _id, _creationTime: _creationTime, ...fields } = old; const id = await ctx.db.insert("artifactVersions", { ...fields, version: 2 }); await ctx.db.patch(a._id, { currentVersionId: id, currentVersion: 2 }); });
  if (change === "expired") await f.t.run(ctx => ctx.db.patch(f.args.approvalId, { expiresAt: Date.now() - 1 }));
  if (change === "paused") await f.t.run(ctx => ctx.db.patch(f.orgId, { emergencyStop: { active: true, at: Date.now(), by: f.owner.userId } }));
  if (change === "frequency") await f.t.run(async ctx => { await ctx.db.patch(f.orgId, { contactFrequencyDays: 7 }); const contact = (await ctx.db.query("contacts").collect())[0]; await ctx.db.patch(contact._id, { lastMarketingEmailAt: Date.now() }); });
  if (change === "legacy") await f.t.run(async ctx => { const a = (await ctx.db.get(f.args.approvalId))!; await ctx.db.patch(a._id, { scope: { ...a.scope, recipientSetHash: undefined } }); });
  if (change === "role") await f.t.run(async ctx => { const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.orgId).eq("userId", f.owner.userId)).unique())!; await ctx.db.patch(member._id, { role: "viewer" }); });
  if (change === "policy") await f.t.run(async ctx => { const policy = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", f.orgId).eq("active", true)).first())!; await ctx.db.patch(policy._id, { version: policy.version + 1 }); });
  if (change === "credentials") await f.t.mutation(internal.connections.storeConnection, { orgId: f.orgId, userId: f.owner.userId, provider: "email_resend", secret: JSON.stringify({ apiKey: "replacement-account" }), secretKind: "api_key", scopes: [] });
  if (change === "suppression") await f.t.run(async ctx => { const contact = (await ctx.db.query("contacts").collect())[0]; await ctx.db.insert("suppressions", { orgId: f.orgId, emailHash: contact.emailHash, reason: "unsubscribe", source: "test", createdAt: Date.now() }); });
  await f.t.action(internal.marketing.executeSend, f.args);
  expect(provider.synced).toEqual([]);
  expect(provider.drafts).toBe(0);
  expect(provider.sends).toBe(0);
});

it.each(["suppression", "content", "policy", "frequency"] as const)("rechecks late %s before dispatch", async change => {
  const f = await fixture(undefined, 1, change === "frequency" ? 5 : 0);
  provider.onRead = async () => f.t.run(async ctx => {
    if (change === "suppression") { const contact = (await ctx.db.query("contacts").collect())[0]; await ctx.db.insert("suppressions", { orgId: f.orgId, emailHash: contact.emailHash, reason: "unsubscribe", source: "test", createdAt: Date.now() }); }
    if (change === "content") await ctx.db.patch(f.artifactId, { status: "draft" });
    if (change === "policy") { const policy = (await ctx.db.query("autonomyPolicies").withIndex("by_org_active", q => q.eq("orgId", f.orgId).eq("active", true)).first())!; await ctx.db.patch(policy._id, { version: policy.version + 1 }); }
    if (change === "frequency") {
      await ctx.db.patch(f.orgId, { contactFrequencyDays: 7 });
      const contact = (await ctx.db.query("contacts").collect())[0];
      await ctx.db.patch(contact._id, { lastMarketingEmailAt: Date.now() });
    }
  });
  await f.t.action(internal.marketing.executeSend, f.args);
  expect(provider.sends).toBe(0);
  if (change === "frequency") {
    expect(provider.synced).toEqual(["ana@example.com"]);
    const receipts = await f.t.run(ctx => ctx.db.query("actionReceipts").collect());
    expect(receipts).toContainEqual(expect.objectContaining({ status: "failed", summary: expect.stringContaining("within your 7-day limit") }));
  }
});

it("claims one attempt and records one result for overlapping executors", async () => {
  const f = await fixture();
  await Promise.all([f.t.action(internal.marketing.executeSend, f.args), f.t.action(internal.marketing.executeSend, f.args)]);
  expect(provider.sends).toBe(1);
  expect(provider.drafts).toBe(1);
  const receipts = await f.t.run(ctx => ctx.db.query("actionReceipts").collect());
  expect(receipts).toHaveLength(1);
  expect(receipts[0].status).toBe("verified");
  await f.t.action(internal.marketing.executeSend, f.args);
  expect(provider.sends).toBe(1);
});

it.each(["uncertain", "throw"] as const)("holds %s send outcomes without replay or releasing their reserved allowance", async outcome => {
  const f = await fixture();
  provider.outcome = outcome;
  await f.t.action(internal.marketing.executeSend, f.args);
  await f.t.action(internal.marketing.executeSend, f.args);
  expect(provider.sends).toBe(1);
  const reservation = (await f.t.run(ctx => ctx.db.get(f.args.reservationId)))!;
  expect(reservation.status).toBe("unresolved");
  expect((await f.t.run(ctx => ctx.db.get(reservation.periodId)))!.meterReserved.byoMarketingSends).toBe(1);
  const visible = await f.owner.client.query(api.content.get, { slug: f.slug, artifactId: f.artifactId });
  expect(visible.receipts).toContainEqual(expect.objectContaining({ provider: "resend_marketing", status: "uncertain", externalId: "broadcast-test" }));
  await expect(f.owner.client.mutation(api.marketing.approveSend, { slug: f.slug, artifactId: f.artifactId, emailIndex: 0, segment: "newsletter", providerSegmentId: "seg-news", from: "Owner <hello@example.com>" })).rejects.toThrow(/unresolved send/);
});

it("rejects duplicate approval while a send is waiting", async () => {
  const f = await fixture();
  await expect(f.owner.client.mutation(api.marketing.approveSend, { slug: f.slug, artifactId: f.artifactId, emailIndex: 0, segment: "newsletter", providerSegmentId: "seg-news", from: "Owner <hello@example.com>" })).rejects.toThrow(/approved or unresolved/);
  expect(provider.sends).toBe(0);
});

it("cannot execute or reconcile using another tenant's reservation", async () => {
  const f = await fixture();
  const outsider = await asNewUser(f.t, "other-email-owner@example.com");
  const other = await outsider.client.mutation(api.orgs.createWorkspace, { businessName: "Other email workspace" });
  await makePaid(f.t, other.orgId);
  const reservationId = await f.t.run(async ctx => {
    const period = (await ctx.db.query("usagePeriods").withIndex("by_org_ends", q => q.eq("orgId", other.orgId)).collect()).find(p => p.source === "subscription")!;
    return ctx.db.insert("usageReservations", { orgId: other.orgId, periodId: period._id, purpose: "email_send", walletMicros: 0, topupMicros: 0, meters: { byoMarketingSends: 1 }, status: "held", createdAt: Date.now() });
  });
  await f.t.action(internal.marketing.executeSend, { ...f.args, reservationId });
  expect(provider.synced).toEqual([]);
  expect(provider.sends).toBe(0);
  await f.t.mutation(internal.marketing.finishSend, { approvalId: f.args.approvalId, reservationId, status: "failed", sent: 0, summary: "Wrong reservation" });
  expect((await f.t.run(ctx => ctx.db.get(reservationId)))!.status).toBe("held");
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it("preserves the owner's parsed single-email subject and text", async () => {
  const f = await fixture("Subject: The reviewed subject\nPreview: A preview\n\nThe reviewed message.");
  expect(f.args.subject).toBe("The reviewed subject");
  expect(f.args.html).toContain("The reviewed message.");
  expect(f.args.html).not.toContain("Subject:");
  await f.t.action(internal.marketing.executeSend, f.args);
  expect(provider.sends).toBe(1);
  expect(provider.lastDraft).toMatchObject({ subject: "The reviewed subject", text: expect.stringContaining("The reviewed message."), html: f.args.html, from: f.args.from, segmentId: "seg-news" });
  expect(provider.lastDraft).toMatchObject({ text: expect.stringContaining("Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}") });
  expect(provider.sentDraft).toEqual(provider.lastDraft);
});

it("does not turn an incomplete local contact scan into an approved audience", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    for (let i = 0; i < 10_000; i++) await ctx.db.insert("contacts", { orgId: f.orgId, emailHash: `extra-${i}`, emailDomain: "example.com", source: "csv_import", segments: ["other"], createdAt: Date.now() });
  });
  await f.t.action(internal.marketing.executeSend, f.args);
  expect(provider.synced).toEqual([]);
  expect(provider.sends).toBe(0);
  const receipt = (await f.t.run(ctx => ctx.db.query("actionReceipts").collect()))[0];
  expect(receipt.summary).toContain("complete audience");
});

async function uncertainFixture(recipients = 1) {
  const f = await fixture(undefined, recipients);
  provider.outcome = "uncertain";
  await f.t.action(internal.marketing.executeSend, f.args);
  const dispatchedAt = Date.now() - 6 * 60_000, sentAt = Date.now() - 60_000;
  await f.t.run(ctx => ctx.db.patch(f.args.approvalId, { executionStartedAt: dispatchedAt, emailSendDispatchedAt: dispatchedAt }));
  provider.recovery = { id: "broadcast-test", name: `climbos-${f.args.approvalId}`, segmentId: "seg-news", subject: f.args.subject, html: f.args.html, from: f.args.from, text: (provider.lastDraft as { text: string }).text, status: "sent", sentAt: new Date(sentAt).toISOString() };
  return { ...f, sentAt, recoveryArgs: { slug: f.slug, artifactId: f.artifactId, approvalId: f.args.approvalId } };
}

it("recovers the exact original send with separate evidence, one quota charge and original recipient history", async () => {
  const f = await uncertainFixture();
  const before = await f.t.run(ctx => ctx.db.query("actionReceipts").collect());
  expect((await f.owner.client.query(api.marketing.unresolvedSends, { slug: f.slug, artifactId: f.artifactId })).items).toHaveLength(1);
  // Current draft and audience need not still match the historical approved request.
  await f.t.run(async ctx => { await ctx.db.patch(f.artifactId, { status: "draft" }); const contact = (await ctx.db.query("contacts").collect())[0]; await ctx.db.patch(contact._id, { segments: [] }); });
  await f.importContact("new@example.com");
  expect(await f.owner.client.action(api.marketing.checkSendResult, f.recoveryArgs)).toMatchObject({ confirmed: true });
  await f.t.finishAllScheduledFunctions(() => undefined);
  const approval = (await f.t.run(ctx => ctx.db.get(f.args.approvalId)))!;
  expect(approval.executionOutcome).toBe("uncertain");
  expect(approval.executionReconciledAt).toBeTypeOf("number");
  expect(approval.status).toBe("consumed");
  const reservation = (await f.t.run(ctx => ctx.db.get(f.args.reservationId)))!;
  const period = (await f.t.run(ctx => ctx.db.get(reservation.periodId)))!;
  expect(reservation.status).toBe("reconciled");
  expect(period.meterReserved.byoMarketingSends).toBe(0);
  expect(period.meterUsed.byoMarketingSends).toBe(1);
  expect((await f.t.run(ctx => ctx.db.query("contacts").collect())).map(c => c.lastMarketingEmailAt)).toEqual([f.sentAt, undefined]);
  const receipts = await f.t.run(ctx => ctx.db.query("actionReceipts").collect());
  expect(receipts[0]).toEqual(before[0]);
  expect(receipts[1]).toMatchObject({ action: "reconcile_email_send", status: "verified" });
  expect((await f.owner.client.query(api.marketing.unresolvedSends, { slug: f.slug, artifactId: f.artifactId })).items).toEqual([]);
  await f.t.action(internal.marketing.executeSend, f.args);
  await f.t.mutation(internal.marketing.finishSend, { approvalId: f.args.approvalId, reservationId: f.args.reservationId, status: "failed", sent: 0, summary: "Late callback" });
  await expect(f.owner.client.action(api.marketing.checkSendResult, f.recoveryArgs)).rejects.toThrow(/no longer unresolved/);
  expect(provider.sends).toBe(1);
  expect(provider.drafts).toBe(1);
  expect((await f.t.run(ctx => ctx.db.get(reservation.periodId)))!.meterUsed.byoMarketingSends).toBe(1);
});

it.each(["id", "name", "segmentId", "subject", "html", "text", "replyTo", "topicId", "from", "status", "sentAt", "missing", "future", "early"] as const)("keeps a conflicting or incomplete %s read unknown", async field => {
  const f = await uncertainFixture();
  if (field === "missing") provider.recovery = null;
  else if (field === "future") provider.recovery!.sentAt = new Date(Date.now() + 60_000).toISOString();
  else if (field === "early") provider.recovery!.sentAt = new Date(Date.now() - 24 * 3600_000).toISOString();
  else provider.recovery![field] = "different";
  expect(await f.owner.client.action(api.marketing.checkSendResult, f.recoveryArgs)).toMatchObject({ confirmed: false });
  expect((await f.t.run(ctx => ctx.db.get(f.args.reservationId)))!.status).toBe("unresolved");
  expect((await f.t.run(ctx => ctx.db.get(f.args.approvalId)))!.executionReconciledAt).toBeUndefined();
  expect(provider.sends).toBe(1);
  expect(provider.drafts).toBe(1);
});

it.each(["role", "credential", "scope", "legacy", "legacy_payload", "recent", "reservation"] as const)("rejects recovery with changed %s before reading the provider", async change => {
  const f = await uncertainFixture();
  await f.t.run(async ctx => {
    const a = (await ctx.db.get(f.args.approvalId))!;
    if (change === "role") { const m = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.orgId).eq("userId", f.owner.userId)).unique())!; await ctx.db.patch(m._id, { role: "viewer" }); }
    if (change === "scope") await ctx.db.patch(a._id, { scope: { ...a.scope, destination: "other" } });
    if (change === "legacy") await ctx.db.patch(a._id, { emailRecipientHashBatches: undefined });
    if (change === "legacy_payload") await ctx.db.patch(a._id, { emailProviderPayloadHash: undefined });
    if (change === "recent") await ctx.db.patch(a._id, { emailSendDispatchedAt: Date.now() });
    if (change === "reservation") await ctx.db.patch(f.args.reservationId, { status: "released" });
  });
  if (change === "credential") await f.t.mutation(internal.connections.storeConnection, { orgId: f.orgId, userId: f.owner.userId, provider: "email_resend", secret: JSON.stringify({ apiKey: "replacement" }), secretKind: "api_key", scopes: [] });
  await expect(f.owner.client.action(api.marketing.checkSendResult, f.recoveryArgs)).rejects.toThrow();
  expect(provider.reads).toBe(0);
  expect(provider.sends).toBe(1);
});

it("rejects foreign recovery and listing without reading the provider", async () => {
  const f = await uncertainFixture();
  const other = await asNewUser(f.t, "recovery-outsider@example.com");
  const workspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other recovery" });
  await expect(other.client.action(api.marketing.checkSendResult, { ...f.recoveryArgs, slug: workspace.slug })).rejects.toThrow();
  await expect(other.client.query(api.marketing.unresolvedSends, { slug: workspace.slug, artifactId: f.artifactId })).rejects.toThrow();
  expect(provider.reads).toBe(0);
});

it.each(["credentials", "role", "completed"] as const)("rechecks late %s before recording recovery", async change => {
  const f = await uncertainFixture();
  provider.onRecovery = async () => {
    if (change === "credentials") await f.t.mutation(internal.connections.storeConnection, { orgId: f.orgId, userId: f.owner.userId, provider: "email_resend", secret: JSON.stringify({ apiKey: "new" }), secretKind: "api_key", scopes: [] });
    else await f.t.run(async ctx => {
      if (change === "completed") await ctx.db.patch(f.args.approvalId, { executionReconciledAt: Date.now() });
      else { const m = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", f.orgId).eq("userId", f.owner.userId)).unique())!; await ctx.db.patch(m._id, { role: "viewer" }); }
    });
  };
  await expect(f.owner.client.action(api.marketing.checkSendResult, f.recoveryArgs)).rejects.toThrow();
  expect((await f.t.run(ctx => ctx.db.query("actionReceipts").collect()))).toHaveLength(1);
});

it("allows historical read-back while stopped and approval expired, without approving another send", async () => {
  const f = await uncertainFixture();
  // Expiry is already part of the signed binding; advance the test clock instead of altering it.
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 25 * 3600_000);
  try {
    await f.t.run(ctx => ctx.db.patch(f.orgId, { emergencyStop: { active: true, at: Date.now(), by: f.owner.userId } }));
    expect(await f.owner.client.action(api.marketing.checkSendResult, f.recoveryArgs)).toMatchObject({ confirmed: true });
    await f.t.finishAllScheduledFunctions(() => undefined);
    expect(provider.sends).toBe(1);
  } finally { vi.restoreAllMocks(); }
});

it("keeps the exact provider identity before a worker can lose its final result", async () => {
  const f = await fixture();
  await f.t.mutation(internal.marketing.claimSend, f.args);
  expect(await f.t.mutation(internal.marketing.authorizeSendDispatch, { ...f.args, externalId: "before-crash" })).toMatchObject({ ok: true });
  const a = (await f.t.run(ctx => ctx.db.get(f.args.approvalId)))!;
  expect(a.executionExternalId).toBe("before-crash");
  expect(a.emailRecipientHashBatches).toHaveLength(1);
  expect(a.executionFinishedAt).toBeUndefined();
  await f.t.run(ctx => ctx.db.patch(a._id, { emailSendDispatchedAt: Date.now() - 6 * 60_000 }));
  provider.recovery = { id: "before-crash", name: `climbos-${a._id}`, segmentId: "seg-news", subject: f.args.subject, html: f.args.html, from: f.args.from, text: "A useful update for subscribers.\n\nYou're receiving this because you opted in to emails from Email boundary.\nUnsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}", status: "sent", sentAt: new Date(Date.now() - 60_000).toISOString() };
  expect(await f.owner.client.action(api.marketing.checkSendResult, { slug: f.slug, artifactId: f.artifactId, approvalId: a._id })).toMatchObject({ confirmed: true });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect(provider.sends).toBe(0); // Recovery made only the read.
  expect((await f.t.run(ctx => ctx.db.get(f.args.reservationId)))!.status).toBe("reconciled");
});

it("applies recovered history in bounded batches and resists replay and late callbacks", async () => {
  const f = await uncertainFixture(205);
  await f.owner.client.mutation(api.settings.setContactFrequency, { slug: f.slug, days: 7 });
  expect(await f.owner.client.query(api.marketing.frequencyPreview, { slug: f.slug, segment: "newsletter" })).toMatchObject({ activeMarketing: 205, recentlyEmailed: 0 });
  expect(await f.owner.client.action(api.marketing.checkSendResult, f.recoveryArgs)).toMatchObject({ confirmed: true });
  const a = (await f.t.run(ctx => ctx.db.get(f.args.approvalId)))!;
  expect(a.emailRecipientHashBatches?.map(batch => batch.length)).toEqual([200, 5]);
  const batch = { approvalId: a._id, offset: 0, checkedAt: a.emailRecovery!.checkedAt };
  await f.t.mutation(internal.marketing.finishEmailRecovery, batch);
  await f.t.mutation(internal.marketing.finishEmailRecovery, batch); // Old cursor does not progress twice.
  await f.t.mutation(internal.marketing.finishSend, { approvalId: a._id, reservationId: f.args.reservationId, status: "failed", sent: 0, summary: "Late failure" });
  expect((await f.t.run(ctx => ctx.db.get(a._id)))!.emailRecovery?.nextOffset).toBe(200);
  expect((await f.t.run(ctx => ctx.db.get(f.args.reservationId)))!.status).toBe("unresolved");
  expect(await f.owner.client.query(api.marketing.frequencyPreview, { slug: f.slug, segment: "newsletter" })).toMatchObject({ activeMarketing: 205, recentlyEmailed: 200 });
  await f.t.finishAllScheduledFunctions(() => undefined);
  const contacts = await f.t.run(ctx => ctx.db.query("contacts").collect());
  expect(contacts).toHaveLength(205);
  expect(contacts.every(c => c.lastMarketingEmailAt === f.sentAt)).toBe(true);
  const frequency = await f.owner.client.query(api.marketing.frequencyPreview, { slug: f.slug, segment: "newsletter" });
  expect(frequency).toMatchObject({ recentlyEmailed: 205, clearAt: f.sentAt + 7 * 86_400_000 });
  expect(frequency?.activeMarketing).toBeUndefined();
  const r = (await f.t.run(ctx => ctx.db.get(f.args.reservationId)))!;
  expect((await f.t.run(ctx => ctx.db.get(r.periodId)))!.meterUsed.byoMarketingSends).toBe(205);
  expect(provider.sends).toBe(1);
});

it("accepts only one overlapping recovery result and one allowance charge", async () => {
  const f = await uncertainFixture();
  const results = await Promise.allSettled([f.owner.client.action(api.marketing.checkSendResult, f.recoveryArgs), f.owner.client.action(api.marketing.checkSendResult, f.recoveryArgs)]);
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect((await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).filter(r => r.action === "reconcile_email_send")).toHaveLength(1);
  expect(provider.sends).toBe(1);
});
