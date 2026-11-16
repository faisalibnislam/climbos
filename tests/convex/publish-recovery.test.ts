import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { PUBLISH_X_ACTION } from "../../shared/integrations/x";
import { PUBLISH_PAGE_POST_ACTION } from "../../shared/integrations/facebookPages";
import { PUBLISH_INSTAGRAM_ACTION } from "../../shared/integrations/instagram";
import { contentHash } from "../../shared/policy";
import { asNewUser, makePaid, setup, type T } from "./helpers";

async function attempt(t: T, email = "recovery@example.com", provider: "linkedin" | "x" | "facebook_pages" | "instagram" = "linkedin") {
  const channel = provider === "facebook_pages" ? "facebook" : provider;
  const account = provider === "linkedin" ? "urn:li:person:original" : "123";
  const scopes = { linkedin: ["openid", "profile", "w_member_social"], x: ["tweet.read", "tweet.write", "users.read", "offline.access"], facebook_pages: ["pages_show_list", "pages_manage_posts", "pages_read_engagement"], instagram: ["instagram_business_basic", "instagram_business_content_publish"] }[provider];
  const owner = await asNewUser(t, email);
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Recovery example" });
  await makePaid(t, orgId);
  const connectionId = await t.mutation(internal.connections.storeConnection, { orgId, userId: owner.userId, provider, externalAccountId: account, accountType: provider === "instagram" ? "business" : undefined, accountLabel: "Original account", scopes, expiresAt: Date.now() + 86_400_000, secretKind: "oauth", secret: JSON.stringify({ accessToken: "test-token" }) });
  const body = "An original useful idea.";
  const imageStorageId = provider === "instagram" ? await t.run(ctx => ctx.storage.store(new Blob(["synthetic media"], { type: "image/png" }))) : undefined;
  const artifactId = await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    const artifactId = await ctx.db.insert("artifacts", { orgId, businessId: business._id, kind: "social_post", channel, title: "Original post", status: "in_review", currentVersion: 1, createdAt: Date.now(), updatedAt: Date.now() });
    const versionId = await ctx.db.insert("artifactVersions", { orgId, artifactId, version: 1, body, imageStorageId, hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: await contentHash({ body, hashtags: [], channel, imageRef: imageStorageId }), createdAt: Date.now() });
    await ctx.db.patch(artifactId, { currentVersionId: versionId });
    return artifactId;
  });
  await owner.client.mutation(api.content.decide, { slug, artifactId, decision: "approve" });
  const c = (await t.query(internal.publish.publishContext, { artifactId }))!;
  const secret = (await t.query(internal.connections.getSecret, { connectionId }))!;
  const begin = await t.mutation(internal.publish.beginReceipt, { artifactId, versionId: c.version!._id, approvalId: c.approval!._id, approvalHash: c.approval!.approvalHash, connectionId, connectionUpdatedAt: c.connection!.updatedAt, secretId: secret.secretId, provider, action: { linkedin: "linkedin.publish_post", x: PUBLISH_X_ACTION, facebook_pages: PUBLISH_PAGE_POST_ACTION, instagram: PUBLISH_INSTAGRAM_ACTION }[provider], idempotencyKey: c.idempotencyKey });
  if (!("receiptId" in begin) || !begin.receiptId) throw new Error("Expected authorized attempt");
  return { owner, orgId, slug, artifactId, versionId: c.version!._id, approvalId: c.approval!._id, connectionId, receiptId: begin.receiptId, body };
}

async function uncertain(t: T, a: Awaited<ReturnType<typeof attempt>>, externalId?: string) {
  await t.mutation(internal.publish.finishReceipt, { receiptId: a.receiptId, artifactId: a.artifactId, status: "uncertain", externalId, summary: "Provider response not confirmed." });
}

describe("publishing result identity and recovery", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-16T12:00:00Z")); });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("does not settle another tenant's artifact with a receipt", async () => {
    const t = setup(); const a = await attempt(t); const b = await attempt(t, "other@example.com");
    const before = await t.run(ctx => ctx.db.get(b.artifactId));
    await t.mutation(internal.publish.finishReceipt, { receiptId: a.receiptId, artifactId: b.artifactId, status: "verified", summary: "Wrong subject", externalId: "urn:li:share:1" });
    expect(await t.run(ctx => ctx.db.get(b.artifactId))).toEqual(before);
    expect((await t.run(ctx => ctx.db.get(a.receiptId)))?.status).toBe("uncertain");
    await t.mutation(internal.publish.settleFromReceipt, { receiptId: a.receiptId, artifactId: b.artifactId });
    expect(await t.run(ctx => ctx.db.get(b.artifactId))).toEqual(before);
  });

  it("ignores a late failed callback after a confirmed result", async () => {
    const t = setup(); const a = await attempt(t);
    await t.mutation(internal.publish.finishReceipt, { receiptId: a.receiptId, artifactId: a.artifactId, status: "verified", summary: "Confirmed", externalId: "urn:li:share:1" });
    const before = await t.run(async ctx => ({ artifact: await ctx.db.get(a.artifactId), receipt: await ctx.db.get(a.receiptId), audits: await ctx.db.query("auditEvents").collect() }));
    await t.mutation(internal.publish.finishReceipt, { receiptId: a.receiptId, artifactId: a.artifactId, status: "failed", summary: "Late failure" });
    expect(await t.run(async ctx => ({ artifact: await ctx.db.get(a.artifactId), receipt: await ctx.db.get(a.receiptId), audits: await ctx.db.query("auditEvents").collect() }))).toEqual(before);
  });

  it("records an old attempt's response without changing newer work", async () => {
    const t = setup(); const a = await attempt(t);
    await t.run(ctx => ctx.db.patch(a.artifactId, { currentVersion: 2, status: "in_review", approvalId: undefined }));
    const newer = await t.run(ctx => ctx.db.get(a.artifactId));
    await t.mutation(internal.publish.finishReceipt, { receiptId: a.receiptId, artifactId: a.artifactId, status: "verified", summary: "Original was accepted", externalId: "urn:li:share:1" });
    expect(await t.run(ctx => ctx.db.get(a.artifactId))).toEqual(newer);
    expect((await t.run(ctx => ctx.db.get(a.receiptId)))?.status).toBe("verified");
  });

  it("does not read a replacement provider account to recover an older attempt", async () => {
    const t = setup(); const a = await attempt(t); await uncertain(t, a, "urn:li:share:1");
    await t.run(ctx => ctx.db.patch(a.connectionId, { externalAccountId: "urn:li:person:different" }));
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: "urn:li:share:1", author: "urn:li:person:different", commentary: a.body }), { status: 200 })); vi.stubGlobal("fetch", fetch);
    await t.action(internal.publish.reconcile, { receiptId: a.receiptId });
    expect(fetch).not.toHaveBeenCalled();
    expect((await t.run(ctx => ctx.db.get(a.receiptId)))?.status).toBe("uncertain");
  });

  it("keeps a missing provider id uncertain instead of treating an empty recent-feed sample as failure", async () => {
    const t = setup(); const a = await attempt(t); await uncertain(t, a);
    const fetch = vi.fn(async () => new Response(JSON.stringify({ elements: [] }), { status: 200 })); vi.stubGlobal("fetch", fetch);
    await t.action(internal.publish.reconcile, { receiptId: a.receiptId });
    expect((await t.run(ctx => ctx.db.get(a.receiptId)))?.status).toBe("uncertain");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not confirm mismatched content returned for a known provider id", async () => {
    const t = setup(); const a = await attempt(t); await uncertain(t, a, "urn:li:share:1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "urn:li:share:1", author: "urn:li:person:original", commentary: "Different content" }), { status: 200 })));
    await t.action(internal.publish.reconcile, { receiptId: a.receiptId });
    expect((await t.run(ctx => ctx.db.get(a.receiptId)))?.status).toBe("uncertain");
  });
  it.each(["unchanged", "new_version"] as const)("uses the original exact post and records a provider read: %s", async change => {
    const t = setup(); const a = await attempt(t); await uncertain(t, a, "urn:li:share:1");
    if (change === "new_version") await t.run(async ctx => {
      const original = (await ctx.db.get(a.versionId))!;
      const { _id, _creationTime, ...fields } = original; void _id; void _creationTime;
      const body = "A newer different idea.";
      const versionId = await ctx.db.insert("artifactVersions", { ...fields, version: 2, body, contentHash: await contentHash({ body, hashtags: [], channel: "linkedin" }) });
      await ctx.db.patch(a.artifactId, { currentVersionId: versionId, currentVersion: 2, status: "in_review", approvalId: undefined });
    });
    const before = await t.run(ctx => ctx.db.get(a.artifactId));
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("GET");
      return new Response(JSON.stringify({ id: "urn:li:share:1", author: "urn:li:person:original", commentary: a.body, lifecycleState: "PUBLISHED" }), { status: 200 });
    }); vi.stubGlobal("fetch", fetch);
    if (change === "unchanged") {
      const r = (await a.owner.client.query(api.content.get, { slug: a.slug, artifactId: a.artifactId })).recovery!;
      expect(r.canCheckProvider).toBe(true);
      expect(await a.owner.client.action(api.publish.checkResult, { slug: a.slug, artifactId: a.artifactId, receiptId: r.receiptId, versionId: r.versionId, approvalId: r.approvalId, approvalHash: r.approvalHash })).toBe("verified");
    } else await t.action(internal.publish.reconcile, { receiptId: a.receiptId });
    expect(fetch).toHaveBeenCalledTimes(1);
    const receipt = (await t.run(ctx => ctx.db.get(a.receiptId)))!;
    expect(receipt.status).toBe("verified");
    expect(receipt.providerResult).toMatchObject({ status: "uncertain", summary: "Provider response not confirmed." });
    expect(receipt.resolution).toMatchObject({ source: "provider_read", outcome: "posted" });
    const after = await t.run(ctx => ctx.db.get(a.artifactId));
    if (change === "new_version") expect(after).toEqual(before);
    else expect(after?.status).toBe("published");
    const audits = await t.run(ctx => ctx.db.query("auditEvents").collect());
    await t.action(internal.publish.reconcile, { receiptId: a.receiptId });
    await t.mutation(internal.publish.finishReceipt, { receiptId: a.receiptId, artifactId: a.artifactId, status: "failed", summary: "Late callback" });
    expect(await t.run(ctx => ctx.db.get(a.receiptId))).toEqual(receipt);
    expect(await t.run(ctx => ctx.db.query("auditEvents").collect())).toEqual(audits);
  });

  it.each(["account", "secret", "post_id", "author", "draft", "missing_author", "not_found", "permission"] as const)("keeps recovery uncertain on changed or incomplete evidence: %s", async change => {
    const t = setup(); const a = await attempt(t); await uncertain(t, a, "urn:li:share:1");
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (change === "account") await t.run(ctx => ctx.db.patch(a.connectionId, { externalAccountId: "urn:li:person:new" }));
      if (change === "secret") await t.mutation(internal.connections.rotateSecret, { connectionId: a.connectionId, secret: JSON.stringify({ accessToken: "changed" }), expiresAt: Date.now() + 86_400_000 });
      if (change === "permission") await t.run(async ctx => {
        const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", a.orgId).eq("userId", a.owner.userId)).unique())!;
        await ctx.db.patch(member._id, { role: "viewer" });
      });
      return new Response(JSON.stringify({ id: change === "post_id" ? "urn:li:share:2" : "urn:li:share:1", author: change === "missing_author" ? undefined : change === "author" ? "urn:li:person:new" : "urn:li:person:original", commentary: a.body, lifecycleState: change === "draft" ? "DRAFT" : "PUBLISHED" }), { status: change === "not_found" ? 404 : 200 });
    }));
    const r = (await a.owner.client.query(api.content.get, { slug: a.slug, artifactId: a.artifactId })).recovery!;
    expect(await a.owner.client.action(api.publish.checkResult, { slug: a.slug, artifactId: a.artifactId, receiptId: r.receiptId, versionId: r.versionId, approvalId: r.approvalId, approvalHash: r.approvalHash })).toBe("uncertain");
    expect((await t.run(ctx => ctx.db.get(a.receiptId)))?.status).toBe("uncertain");
    expect((await t.run(ctx => ctx.db.get(a.artifactId)))?.status).toBe("uncertain");
  });

  it.each(["posted", "not_posted"] as const)("records one exact owner-reported outcome and preserves other attempts: %s", async outcome => {
    const t = setup(); const a = await attempt(t); await uncertain(t, a, "urn:li:share:1");
    const oldId = await t.run(async ctx => {
      const r = (await ctx.db.get(a.receiptId))!;
      const { _id, _creationTime, ...fields } = r; void _id; void _creationTime;
      return ctx.db.insert("actionReceipts", { ...fields, idempotencyKey: "older-attempt", publication: { ...r.publication!, version: 0 }, createdAt: Date.now() - 86_400_000 });
    });
    const older = await t.run(ctx => ctx.db.get(oldId));
    const view = await a.owner.client.query(api.content.get, { slug: a.slug, artifactId: a.artifactId });
    const r = view.recovery!;
    await a.owner.client.mutation(api.content.resolveUncertain, { slug: a.slug, artifactId: a.artifactId, receiptId: r.receiptId, versionId: r.versionId, approvalId: r.approvalId, approvalHash: r.approvalHash, outcome });
    const saved = (await t.run(ctx => ctx.db.get(a.receiptId)))!;
    expect(saved.resolution).toMatchObject({ source: "owner", outcome, by: a.owner.userId });
    expect(saved.providerResult?.status).toBe("uncertain");
    expect(await t.run(ctx => ctx.db.get(oldId))).toEqual(older);
    await t.mutation(internal.publish.finishReceipt, { receiptId: a.receiptId, artifactId: a.artifactId, status: "verified", externalId: "urn:li:share:1", summary: "Late provider result" });
    expect(await t.run(ctx => ctx.db.get(a.receiptId))).toEqual(saved);
    const after = await a.owner.client.query(api.content.get, { slug: a.slug, artifactId: a.artifactId });
    expect(after.receipts.find(row => row.id === a.receiptId)?.resolutionSource).toBe("owner");
    expect(after.status).toBe(outcome === "posted" ? "published" : "failed");
  });

  it.each(["stale_version", "stale_approval", "other_receipt", "viewer", "other_tenant"] as const)("rejects an owner confirmation with %s", async change => {
    const t = setup(); const a = await attempt(t); const b = await attempt(t, "foreign@example.com");
    await uncertain(t, a); await uncertain(t, b);
    const r = (await a.owner.client.query(api.content.get, { slug: a.slug, artifactId: a.artifactId })).recovery!;
    let client = a.owner.client;
    if (change === "stale_version") await t.run(ctx => ctx.db.patch(a.artifactId, { currentVersionId: b.versionId }));
    if (change === "stale_approval") await t.run(ctx => ctx.db.patch(a.approvalId, { approvalHash: "changed" }));
    if (change === "viewer") await t.run(async ctx => {
      const member = (await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", a.orgId).eq("userId", a.owner.userId)).unique())!;
      await ctx.db.patch(member._id, { role: "viewer" });
    });
    if (change === "other_tenant") client = b.owner.client;
    await expect(client.mutation(api.content.resolveUncertain, { slug: a.slug, artifactId: a.artifactId, receiptId: change === "other_receipt" ? b.receiptId : r.receiptId, versionId: r.versionId, approvalId: r.approvalId, approvalHash: r.approvalHash, outcome: "not_posted" })).rejects.toThrow();
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(client.action(api.publish.checkResult, { slug: a.slug, artifactId: a.artifactId, receiptId: change === "other_receipt" ? b.receiptId : r.receiptId, versionId: r.versionId, approvalId: r.approvalId, approvalHash: r.approvalHash })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect((await t.run(ctx => ctx.db.get(a.receiptId)))?.status).toBe("uncertain");
    expect((await t.run(ctx => ctx.db.get(b.receiptId)))?.status).toBe("uncertain");
  });

  it("keeps legacy recovery manual and bounds a confirmation of an interrupted request", async () => {
    const t = setup(); const a = await attempt(t);
    await t.run(ctx => ctx.db.patch(a.receiptId, { publication: undefined }));
    await t.mutation(internal.publish.settleFromReceipt, { artifactId: a.artifactId, receiptId: a.receiptId });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await t.action(internal.publish.reconcile, { receiptId: a.receiptId });
    expect(fetch).not.toHaveBeenCalled();
    const view = await a.owner.client.query(api.content.get, { slug: a.slug, artifactId: a.artifactId });
    const r = view.recovery!; expect(r.legacy).toBe(true); expect(r.externalAccountId).toBeNull();
    const args = { slug: a.slug, artifactId: a.artifactId, receiptId: r.receiptId, versionId: r.versionId, approvalId: r.approvalId, approvalHash: r.approvalHash, outcome: "not_posted" as const };
    await expect(a.owner.client.mutation(api.content.resolveUncertain, args)).rejects.toThrow(/five minutes/);
    vi.setSystemTime(Date.now() + 5 * 60_000);
    await a.owner.client.mutation(api.content.resolveUncertain, args);
    expect((await t.run(ctx => ctx.db.get(a.receiptId)))?.resolution?.source).toBe("owner");
  });

  it("labels explicit legacy owner confirmations without inventing a provider observation", async () => {
    const t = setup(); const a = await attempt(t);
    await t.run(async ctx => {
      await ctx.db.patch(a.receiptId, { publication: undefined, status: "verified", summary: "Confirmed by the owner after checking the platform." });
      await ctx.db.patch(a.artifactId, { status: "published" });
    });
    const before = await t.run(ctx => ctx.db.get(a.receiptId));
    const view = await a.owner.client.query(api.content.get, { slug: a.slug, artifactId: a.artifactId });
    expect(view.receipts.find(r => r.id === a.receiptId)?.resolutionSource).toBe("owner");
    expect(await t.run(ctx => ctx.db.get(a.receiptId))).toEqual(before);
    expect(before?.providerResult).toBeUndefined();
    expect(before?.resolution).toBeUndefined();
  });

  it.each(["x", "facebook_pages", "instagram"] as const)("reads only the known original %s post and retains its initial uncertainty", async provider => {
    const t = setup(); const a = await attempt(t, `${provider}@example.com`, provider);
    const externalId = provider === "facebook_pages" ? "123_456" : "456";
    await uncertain(t, a, externalId);
    const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("GET");
      const data = provider === "x" ? { data: { id: externalId, author_id: "123", text: a.body } }
        : provider === "facebook_pages" ? { id: externalId, message: a.body } : { id: externalId, caption: a.body };
      return new Response(JSON.stringify(data), { status: 200 });
    }); vi.stubGlobal("fetch", fetch);
    await t.action(internal.publish.reconcile, { receiptId: a.receiptId });
    expect(fetch).toHaveBeenCalledTimes(1);
    const receipt = await t.run(ctx => ctx.db.get(a.receiptId));
    expect(receipt).toMatchObject({ status: "verified", providerResult: { status: "uncertain" }, resolution: { source: "provider_read" } });
    expect((await t.run(ctx => ctx.db.get(a.artifactId)))?.status).toBe("published");
  });

});
