import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

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
});
