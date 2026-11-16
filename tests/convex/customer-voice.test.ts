import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { customerVoice } from "../../convex/lib/customerVoice";
import { customerVoiceBrief } from "../../shared/reviews/voiceThemes";
import { RATE_VERSIONS } from "../../shared/economics/rates";

it("uses current corrections, omits dismissals, restores cleared groups, and keeps context tenant-scoped and read-only", async () => {
  const t = setup();
  const owner = await asNewUser(t, "voice-learning@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Customer voice" });
  const other = await asNewUser(t, "other-voice@example.com");
  const otherWorkspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other voice" });
  const viewer = await asNewUser(t, "viewer-voice@example.com");
  await t.run(ctx => ctx.db.insert("memberships", { orgId, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
  await expect(viewer.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "dismissed" })).rejects.toThrow();
  for (let i = 0; i < 2; i++) {
    await owner.client.mutation(api.reviews.addReview, { slug, author: "Secret Name", text: "Setup was confusing Secret Name secret@example.com +1 202 555 0123", source: "google", sourceUrl: `https://reviews.example/item/${i}` });
    await other.client.mutation(api.reviews.addReview, { slug: otherWorkspace.slug, author: "Other", text: "setup OTHER TENANT ONLY", source: "google" });
  }
  const runId = await t.run(ctx => ctx.db.insert("workflowRuns", { orgId, kind: "strategy", title: "Voice context", status: "proposed", input: "{}", engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: Date.now(), updatedAt: Date.now() }));
  const context = async () => (await t.query(internal.jobWrites.jobContext, { runId }))!.customerVoiceText;
  const before = await t.run(async ctx => Promise.all([ctx.db.query("approvals").collect(), ctx.db.query("actionReceipts").collect(), ctx.db.query("artifacts").collect(), ctx.db.get(runId)]));
  const suggested = JSON.parse(await context());
  expect(suggested.themes[0]).toMatchObject({ label: "Getting started", status: "suggested", count: 2, evidenceBasis: "owner_reported" });
  expect(suggested.themes[0].examples[0].sourceUrl).toMatch(/^https:\/\/reviews.example\/item\//);
  expect(await context()).not.toMatch(/Secret Name|secret@example.com|202 555|OTHER TENANT ONLY/);
  await owner.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "corrected", correctedLabel: "Reliability", note: "Check recurring errors; email secret@example.com" });
  expect(JSON.parse(await context()).themes[0]).toMatchObject({ label: "Reliability", suggestedLabel: "Getting started", status: "corrected", ownerNote: "Check recurring errors; email [email]", reviewedAt: expect.any(Number) });
  await owner.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "dismissed", note: "Private dismissal" });
  expect(await context()).toBe("");
  expect((await owner.client.query(api.reviews.voiceThemes, { slug })).themes[0].status).toBe("dismissed");
  await owner.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "clear" });
  expect(JSON.parse(await context()).themes[0].status).toBe("suggested");
  await expect(other.client.query(api.reviews.voiceThemes, { slug })).rejects.toThrow();
  await expect(other.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "dismissed" })).rejects.toThrow();
  expect(await t.run(async ctx => Promise.all([ctx.db.query("approvals").collect(), ctx.db.query("actionReceipts").collect(), ctx.db.query("artifacts").collect(), ctx.db.get(runId)]))).toEqual(before);
  await t.run(ctx => ctx.db.patch(runId, { kind: "content_social" }));
  expect(await context()).toBe("");
});

it("excludes future, stale and fixture records before sampling and gives same-time CRM notes distinct identities", async () => {
  const t = setup();
  const owner = await asNewUser(t, "voice-sample@example.com");
  const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Voice sample" });
  const now = Date.now();
  await t.run(async ctx => {
    for (let i = 0; i < 503; i++) await ctx.db.insert("communityMessages", { orgId, channel: "support", kind: "email", externalId: `sample:${i}`, authorName: "Private", text: i < 500 ? "Setup FIXTURE" : i === 500 ? "Setup FUTURE" : i === 501 ? "Setup STALE" : "Setup real message", receivedAt: i < 500 ? now : i === 500 ? now + 86_400_000 : i === 501 ? now - 181 * 86_400_000 : now - 1000, isFixture: i < 500, status: "new", createdAt: now, updatedAt: now });
    await ctx.db.insert("deals", { orgId, name: "Private", email: "private@example.com", stage: "lead", source: "manual", currency: "USD", notes: [{ text: "Setup note one Private private@example.com", at: now - 1000 }, { text: "Setup note two", at: now - 1000 }, { text: "Setup FUTURE NOTE", at: now + 86_400_000 }], createdAt: now, updatedAt: now });
  });
  const sample = await t.run(ctx => customerVoice(ctx, orgId));
  expect(sample.sourceCount).toBe(3);
  expect(sample.limited).toBe(false);
  expect(sample.themes[0]).toMatchObject({ count: 3, evidenceBasis: "mixed" });
  expect(new Set(sample.themes[0].examples.map(row => row.id)).size).toBe(3);
  const brief = customerVoiceBrief(sample);
  expect(brief).not.toMatch(/FIXTURE|FUTURE|STALE|private@example.com|Private/);
  expect(brief).toContain("not unique customers");
});

it("discloses a capped message/deal sample instead of implying full coverage", async () => {
  const t = setup();
  const owner = await asNewUser(t, "voice-cap@example.com");
  const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Capped sample" });
  const now = Date.now();
  await t.run(async ctx => {
    for (let i = 0; i < 501; i++) await ctx.db.insert("communityMessages", { orgId, channel: "support", kind: "email", externalId: `cap:${i}`, authorName: "Customer", text: "Setup feedback", receivedAt: now - i, status: "new", createdAt: now, updatedAt: now });
    for (let i = 0; i < 251; i++) await ctx.db.insert("deals", { orgId, name: "Customer", stage: "lead", source: "manual", currency: "USD", notes: [], createdAt: now, updatedAt: now - i });
  });
  const sample = await t.run(ctx => customerVoice(ctx, orgId));
  expect(sample).toMatchObject({ sourceCount: 500, limited: true });
  expect(sample.themes[0].count).toBe(500);
  expect(JSON.parse(customerVoiceBrief(sample)).limited).toBe(true);
});
