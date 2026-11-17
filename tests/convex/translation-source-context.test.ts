import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { insertArtifact } from "../../convex/jobWrites";
import { socialTrendFixture } from "../fixtures/socialTrend";
import { asNewUser, makePaid, setup } from "./helpers";
const state = vi.hoisted(() => ({ body: "Der Leitfaden kostet $40.", messages: [] as unknown[] }));
const output = () => ({ title: "Leitfaden", headline: "", body: state.body, callToAction: "", hashtags: [], altText: "" });
vi.mock("../../shared/ai/turn", async original => ({ ...await original<typeof import("../../shared/ai/turn")>(), modelTurn: vi.fn(async args => {
  state.messages.push(args.messages);
  return { ok: true, output: { title: "Leitfaden", headline: "", body: state.body, callToAction: "", hashtags: [], altText: "" }, usage: { calls: 0 }, costMicros: 0 };
}) }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); state.messages = []; state.body = "Der Leitfaden kostet $40."; });
const terms = [{ playName: "Workshop guide", recommendation: "recommend_promotion", currency: "USD", allowedPrices: [40], allowedDiscountPercentages: [], allowedMechanisms: ["non_price_change"], urgencyClaim: null, eligibleAudience: null }];
async function fixture() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  const t = setup(), owner = await asNewUser(t, "translation-context@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Workshop" });
  await makePaid(t, orgId, 50_000_000); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const id = await t.run(async ctx => {
    await ctx.db.patch(orgId, { linkTracking: false });
    const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    const factId = await ctx.db.insert("businessFacts", { orgId, businessId: b._id, statement: "The workshop guide costs $40.", category: "pricing", confidence: "high", provenance: "owner_supplied", reviewState: "confirmed", sourceIds: [], createdAt: Date.now(), updatedAt: Date.now(), verifiedAt: Date.now() });
    const date = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
    const brief = { ...socialTrendFixture().copyBrief!, offerFactIndexes: [0], supportingFactIndexes: [0], supportingSourceUrls: ["https://example.com/observation"], trendEvidence: { sourceUrl: "https://example.com/observation", observationDate: date, observation: "A process reveal format", retrievedAt: Date.now() - 30 * 86400000 }, approvedOfferPlayName: "Workshop guide" };
    return insertArtifact(ctx, { orgId, businessId: b._id, factIds: [factId], createdBy: owner.userId, offerTermsSnapshot: terms, offerPlayNameSnapshot: "Workshop guide", item: { kind: "social_post", channel: "linkedin", title: "Original guide", body: "The workshop guide costs $40. It explains how to prepare, identify the question and review what is still unknown before running your workshop.", destinationUrl: "https://example.com/original", hashtags: [], factIndexes: [], copyBrief: brief, role: "social_media_manager" } });
  });
  return { t, owner, orgId, slug, id };
}
it("retains the source's original trend evidence and offer terms, with separate approval", async () => {
  const f = await fixture(), source = (await f.t.run(ctx => ctx.db.get(f.id)))!;
  const runId = await f.owner.client.mutation(api.translate.start, { slug: f.slug, artifactId: f.id, language: "German" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const [draft] = await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect());
  expect(draft).toMatchObject({ orgId: f.orgId, channel: "linkedin", status: "in_review" });
  const original = await f.t.run(ctx => ctx.db.get(source.currentVersionId!)), ver = await f.t.run(ctx => ctx.db.get(draft.currentVersionId!));
  expect(ver?.copyBrief?.trendEvidence).toEqual(original?.copyBrief?.trendEvidence);
  expect(ver?.approvedOfferTermsSnapshot).toEqual(terms);
  expect(ver?.copyBrief?.offerFactIds).toEqual(original?.copyBrief?.offerFactIds);
  expect(ver?.copyBrief?.offerFactIds).toHaveLength(1);
  expect(JSON.stringify(state.messages)).toContain("allowedPrices");
  await expect(f.owner.client.mutation(api.content.decide, { slug: f.slug, artifactId: draft._id, decision: "approve" })).rejects.toThrow(/30-day|trend/i);
  expect(await f.t.run(ctx => ctx.db.query("approvals").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});
it("keeps the launch version's body, title and destination when the source is edited", async () => {
  const f = await fixture();
  const runId = await f.owner.client.mutation(api.translate.start, { slug: f.slug, artifactId: f.id, language: "German" });
  await f.owner.client.mutation(api.content.edit, { slug: f.slug, artifactId: f.id, title: "CHANGED_SOURCE_TITLE", body: "CHANGED_SOURCE_BODY: The guide now costs $90.", destinationUrl: "https://example.com/changed", hashtags: [] });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(JSON.stringify(state.messages)).not.toContain("CHANGED_SOURCE");
  expect(JSON.stringify(state.messages)).toContain("Original guide");
  const [draft] = await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect());
  expect((await f.t.run(ctx => ctx.db.get(draft.currentVersionId!)))?.destinationUrl).toBe("https://example.com/original");
});
it("uses stored source terms at persistence instead of caller-supplied terms", async () => {
  const f = await fixture();
  const runId = await f.owner.client.mutation(api.translate.start, { slug: f.slug, artifactId: f.id, language: "German" });
  await expect(f.t.mutation(internal.translate.save, { runId, artifactId: f.id, language: "German", out: { ...output(), body: "Der Leitfaden kostet $90." }, offerTermsSnapshot: [{ ...terms[0], allowedPrices: [90] }] })).rejects.toThrow();
  expect(await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect())).toEqual([]);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
});
it("rejects a source from a different tenant at the internal read boundary", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "foreign-translation@example.com");
  const org = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  const foreign = await f.t.run(async ctx => {
    const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org.orgId)).first())!;
    return insertArtifact(ctx, { orgId: org.orgId, businessId: b._id, factIds: [], item: { kind: "social_post", channel: "linkedin", title: "FOREIGN_TITLE", body: "FOREIGN_BODY", hashtags: [], factIndexes: [], role: "social_media_manager" } });
  });
  const runId = await f.owner.client.mutation(api.translate.start, { slug: f.slug, artifactId: f.id, language: "German" });
  await expect(f.t.query(internal.translate.source, { runId, artifactId: foreign })).rejects.toThrow();
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(JSON.stringify(state.messages)).not.toContain("FOREIGN_");
});
it.each(["missing", "legacy"])("fails a %s-source job cleanly without selecting the latest version", async kind => {
  const f = await fixture();
  const runId = await f.owner.client.mutation(api.translate.start, { slug: f.slug, artifactId: f.id, language: "German" });
  await f.t.run(async ctx => {
    if (kind === "missing") { const source = (await ctx.db.get(f.id))!; await ctx.db.delete(source.currentVersionId!); }
    else await ctx.db.patch(runId, { input: JSON.stringify({ artifactId: f.id, language: "German" }) });
  });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await f.t.run(ctx => ctx.db.get(runId)))?.status).toBe("failed");
  expect(state.messages).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect())).toEqual([]);
});
it("rejects language substitution and does not duplicate a saved result on replay", async () => {
  const f = await fixture();
  const runId = await f.owner.client.mutation(api.translate.start, { slug: f.slug, artifactId: f.id, language: "German" });
  await expect(f.t.mutation(internal.translate.save, { runId, artifactId: f.id, language: "French", out: output() })).rejects.toThrow(/language/);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const [draft] = await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect());
  expect(await f.t.mutation(internal.translate.save, { runId, artifactId: f.id, language: "German", out: output() })).toBe(draft._id);
  expect(await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect())).toHaveLength(1);
});
it("rejects a changed generated price and leaves no translated artifact", async () => {
  const f = await fixture(); state.body = "Der Leitfaden kostet $90.";
  const runId = await f.owner.client.mutation(api.translate.start, { slug: f.slug, artifactId: f.id, language: "German" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await f.t.run(ctx => ctx.db.get(runId)))?.status).toBe("failed");
  expect(await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});
it("does not carry an approved source's approval or schedule into its translation", async () => {
  const f = await fixture();
  await f.t.run(async ctx => {
    const source = (await ctx.db.get(f.id))!, ver = (await ctx.db.get(source.currentVersionId!))!;
    await ctx.db.patch(source._id, { scheduledFor: Date.now() + 3_600_000 });
    await ctx.db.patch(ver._id, { copyBrief: { ...ver.copyBrief!, trendEvidence: undefined } });
  });
  await f.owner.client.mutation(api.content.decide, { slug: f.slug, artifactId: f.id, decision: "approve" });
  const runId = await f.owner.client.mutation(api.translate.start, { slug: f.slug, artifactId: f.id, language: "German" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const [draft] = await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect());
  expect(draft).toMatchObject({ status: "in_review" });
  expect(draft.approvalId).toBeUndefined(); expect(draft.scheduledFor).toBeUndefined();
  const approvals = await f.t.run(ctx => ctx.db.query("approvals").collect());
  expect(approvals).toHaveLength(1); expect(approvals[0].subjectId).toBe(f.id);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});
