import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, makePaid, setup } from "./helpers";

const CSV = [
  "email,first_name,consent,consent_source,consent_date,segment",
  "ana@example.com,Ana,yes,signup form,2026-09-01,newsletter",
  "ben@example.com,Ben,yes,,2026-09-02,newsletter",
  "cy@example.com,Cy,no,,,newsletter",
  "dee@example.com,Dee,yes,checkout checkbox,2026-09-03,newsletter",
  "not-an-email,X,yes,form,2026-09-01,newsletter",
  "ana@example.com,Ana dup,yes,signup form,2026-09-01,newsletter",
].join("\n");

describe("marketing consent and suppression", () => {
  it("never infers consent, excludes suppressed contacts and refuses segments with nobody opted in", async () => {
    const t = setup();
    const u = await asNewUser(t, "owner@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    const res = await u.client.action(api.marketing.importContacts, { slug, csv: CSV });
    expect(res.imported).toBe(4); // duplicate and invalid row skipped
    expect(res.withConsent).toBe(2); // Ben has "yes" but no source → no consent
    expect(res.invalid.some((i) => /not a valid email/i.test(i.message))).toBe(true);
    expect(res.invalid.some((i) => /source or date is missing/i.test(i.message))).toBe(true);

    let audience = await u.client.query(api.marketing.audience, { slug });
    const news = audience.segments.find((s) => s.segment === "newsletter")!;
    expect(news.total).toBe(4);
    expect(news.sendable).toBe(2);

    // Deleting/suppressing a consented contact removes them from the sendable count.
    await u.client.mutation(api.settings.deleteContact, { slug, email: "dee@example.com" });
    audience = await u.client.query(api.marketing.audience, { slug });
    expect(audience.segments.find((s) => s.segment === "newsletter")!.sendable).toBe(1);

    // Approving a send requires approved email content…
    const email = await t.run(async (ctx) => (await ctx.db.query("artifacts").collect()).find((a) => a.kind === "email_sequence")!);
    await expect(
      u.client.mutation(api.marketing.approveSend, { slug, artifactId: email._id, emailIndex: 0, segment: "newsletter", providerSegmentId: "seg_1", from: "Formkit <hello@formkit.app>" }),
    ).rejects.toThrow(/Approve the email content first/);
    await u.client.mutation(api.content.decide, { slug, artifactId: email._id, decision: "approve" });
    // …and a segment with at least one opted-in, unsuppressed person.
    await expect(
      u.client.mutation(api.marketing.approveSend, { slug, artifactId: email._id, emailIndex: 0, segment: "nobody", providerSegmentId: "seg_1", from: "Formkit <hello@formkit.app>" }),
    ).rejects.toThrow(/recorded marketing opt-in/);
    const ok = await u.client.mutation(api.marketing.approveSend, { slug, artifactId: email._id, emailIndex: 0, segment: "newsletter", providerSegmentId: "seg_1", from: "Formkit <hello@formkit.app>" });
    expect(ok.recipients).toBe(1);

    // Without the customer's own provider connected, the send fails honestly (no fake success).
    await t.finishAllScheduledFunctions(() => undefined);
    const receipts = await t.run(async (ctx) => (await ctx.db.query("actionReceipts").collect()).filter((r) => r.provider === "resend_marketing"));
    expect(receipts).toHaveLength(1);
    expect(receipts[0].status).toBe("failed");
    expect(receipts[0].summary).toMatch(/connect your own Resend/i);
    // The reserved send quota is released when nothing was sent.
    const period = await t.run(async (ctx) => (await ctx.db.query("usagePeriods").collect()).find((p) => p.source === "demo")!);
    expect(period.meterReserved.byoMarketingSends).toBe(0);
  });

  it("does not broadcast when the live provider segment has active contacts outside the approved local audience", async () => {
    const t = setup();
    const owner = await asNewUser(t, "segment-owner@example.com");
    const workspace = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Segment check business" });
    await makePaid(t, workspace.orgId);
    await t.run(async (ctx) => {
      const period = (await ctx.db.query("usagePeriods").withIndex("by_org_ends", (q) => q.eq("orgId", workspace.orgId)).collect()).find((entry) => entry.source === "subscription");
      if (period) await ctx.db.patch(period._id, { meterCaps: { ...period.meterCaps, byoMarketingSends: 10 } });
    });
    await owner.client.action(api.marketing.importContacts, {
      slug: workspace.slug,
      csv: ["email,consent,consent_source,consent_date,segment", "ana@example.com,yes,signup form,2026-10-01,newsletter"].join("\n"),
    });
    await t.mutation(internal.connections.storeConnection, {
      orgId: workspace.orgId,
      userId: owner.userId,
      provider: "email_resend",
      secret: JSON.stringify({ apiKey: "re_test_123" }),
      secretKind: "api_key",
      scopes: [],
      accountLabel: "Test Resend",
    });
    const artifactId = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", workspace.slug)).unique())!;
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first())!;
      const now = Date.now();
      const artifactId = await ctx.db.insert("artifacts", {
        orgId: org._id, businessId: business._id, kind: "email_sequence", channel: "email", title: "Approved note", status: "approved", currentVersion: 1, createdAt: now, updatedAt: now,
      });
      const versionId = await ctx.db.insert("artifactVersions", {
        orgId: org._id, artifactId, version: 1, headline: "A useful update", body: "Subject: A useful update\n\nHello, this is a useful update.", hashtags: [], claimFactIds: [], unsupportedClaims: [], contentHash: "approved-content-hash", createdAt: now,
      });
      await ctx.db.patch(artifactId, { currentVersionId: versionId });
      return artifactId;
    });

    const calls: { url: string; method: string }[] = [];
    const previousFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url.includes("/contacts/ana%40example.com") && method === "GET" && calls.filter((call) => call.url.includes("/contacts/ana%40example.com") && call.method === "GET").length === 1) {
        return new Response(JSON.stringify({ message: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/contacts") && method === "POST") {
        return new Response(JSON.stringify({ object: "contact", id: "ct_ana" }), { status: 201, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/contacts/ana%40example.com") && method === "GET") {
        return new Response(JSON.stringify({ id: "ct_ana", email: "ana@example.com", unsubscribed: false }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("/segments/seg_newsletter/contacts") && method === "GET") {
        return new Response(JSON.stringify({ has_more: false, data: [
          { id: "ct_ana", email: "ana@example.com", unsubscribed: false },
          { id: "ct_external", email: "outside@example.com", unsubscribed: false },
        ] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected ${method} ${url}`);
    });
    try {
      await owner.client.mutation(api.marketing.approveSend, {
        slug: workspace.slug, artifactId, emailIndex: 0, segment: "newsletter", providerSegmentId: "seg_newsletter", from: "Owner <hello@example.com>",
      });
      await t.finishAllScheduledFunctions(() => undefined);
    } finally {
      vi.stubGlobal("fetch", previousFetch);
    }

    expect(calls.some((call) => call.url.endsWith("/broadcasts") && call.method === "POST")).toBe(false);
    const receipt = await t.run(async (ctx) => (await ctx.db.query("actionReceipts").withIndex("by_org_created", (q) => q.eq("orgId", workspace.orgId)).collect()).find((entry) => entry.provider === "resend_marketing"));
    expect(receipt).toMatchObject({ status: "failed", summary: expect.stringMatching(/does not match.*1 opted-in.*1 extra active contact/i) });
  });
});
