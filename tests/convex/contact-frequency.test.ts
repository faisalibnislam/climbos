import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { sha256Hex } from "../../shared/policy";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

const CSV = ["email,first_name,consent,consent_source,consent_date,segment", "ana@example.com,Ana,yes,signup form,2026-09-01,newsletter", "dee@example.com,Dee,yes,checkout checkbox,2026-09-03,newsletter"].join("\n");

describe("contact frequency limit", () => {
  it("is owner-set, holds a broadcast when someone was emailed too recently, and leaves sends alone without a limit", async () => {
    const t = setup();
    const u = await asNewUser(t, "freq-owner@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    await u.client.action(api.marketing.importContacts, { slug, csv: CSV });
    const email = await t.run(async (ctx) => (await ctx.db.query("artifacts").collect()).find((a) => a.kind === "email_sequence")!);
    await u.client.mutation(api.content.decide, { slug, artifactId: email._id, decision: "approve" });
    const orgId = email.orgId as Id<"organizations">;

    await expect(u.client.mutation(api.settings.setContactFrequency, { slug, days: 0 })).rejects.toThrow(/1 to 90/);
    expect(await u.client.query(api.marketing.frequencyPreview, { slug, segment: "newsletter" })).toBeNull();

    // Ana got a ClimbOS broadcast two days ago.
    await t.run(async (ctx) => {
      const ana = (await ctx.db.query("contacts").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect()).find((c) => c.displayName === "Ana")!;
      await ctx.db.patch(ana._id, { lastMarketingEmailAt: Date.now() - 2 * 86_400_000 });
    });
    await u.client.mutation(api.settings.setContactFrequency, { slug, days: 7 });
    const preview = await u.client.query(api.marketing.frequencyPreview, { slug, segment: "newsletter" });
    expect(preview).toMatchObject({ limitDays: 7, recentlyEmailed: 1, activeOutreach: 0 });
    const args = { slug, artifactId: email._id, emailIndex: 0, segment: "newsletter", providerSegmentId: "seg_1", from: "Formkit <hello@formkit.app>" };
    await expect(u.client.mutation(api.marketing.approveSend, args)).rejects.toThrow(/within your 7-day limit/);

    await u.client.mutation(api.settings.setContactFrequency, { slug, days: null });
    expect((await u.client.mutation(api.marketing.approveSend, args)).recipients).toBe(2);
    const audits = await t.run(async (ctx) => ctx.db.query("auditEvents").collect());
    expect(audits.filter((a) => a.action === "policy.contact_frequency")).toHaveLength(2);

    // A provider-verified send records when each accepted contact was last emailed.
    const { approvalId, reservationId } = await t.run(async (ctx) => ({
      approvalId: (await ctx.db.query("approvals").collect()).find((a) => a.subjectType === "email_send")!._id,
      reservationId: (await ctx.db.query("usageReservations").collect()).find((r) => r.purpose === "email_send")!._id,
    }));
    await t.mutation(internal.marketing.finishSend, { approvalId, reservationId, status: "verified", sent: 1, summary: "ok", recipientHashes: [await sha256Hex("dee@example.com")] });
    const dee = await t.run(async (ctx) => (await ctx.db.query("contacts").withIndex("by_org", (q) => q.eq("orgId", orgId)).collect()).find((c) => c.displayName === "Dee")!);
    expect(dee.lastMarketingEmailAt).toBeGreaterThan(Date.now() - 60_000);
  });

  it("only owners and admins can change the limit", async () => {
    const t = setup();
    const owner = await asNewUser(t, "freq-perm@example.com");
    const editor = await asNewUser(t, "freq-editor@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Freq Co" });
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: orgId as Id<"organizations">, userId: editor.userId, role: "editor", status: "active", createdAt: Date.now() }));
    await expect(editor.client.mutation(api.settings.setContactFrequency, { slug, days: 7 })).rejects.toThrow(/can't/i);
    await owner.client.mutation(api.settings.setContactFrequency, { slug, days: 14 });
    expect((await owner.client.query(api.settings.policies, { slug })).contactFrequencyDays).toBe(14);
  });
});
