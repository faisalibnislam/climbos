import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { insertArtifact } from "../../convex/jobWrites";
import { socialTrendFixture } from "../fixtures/socialTrend";
import { asNewUser, makePaid, setup } from "./helpers";
const state = vi.hoisted(() => ({ body: "Review the workshop guide for $40. Read the full process before choosing.", formats: ["linkedin"], messages: [] as unknown[] }));
vi.mock("../../shared/ai/turn", async original => ({ ...await original<typeof import("../../shared/ai/turn")>(), modelTurn: vi.fn(async args => {
  state.messages.push(args.messages);
  return { ok: true, output: { items: state.formats.map(format => ({ format, title: "Workshop guide", body: state.body, hashtags: [] })) }, usage: { calls: 0 }, costMicros: 0 };
}) }));
afterEach(() => { vi.unstubAllEnvs(); state.messages = []; state.formats = ["linkedin"]; state.body = "Review the workshop guide for $40. Read the full process before choosing."; });
const terms = [{ playName: "Workshop guide", recommendation: "recommend_promotion", currency: "USD", allowedPrices: [40], allowedDiscountPercentages: [], allowedMechanisms: ["non_price_change"], urgencyClaim: null, eligibleAudience: null }];
async function fixture() {
  const t = setup(), owner = await asNewUser(t, "source-context@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Workshop" });
  await makePaid(t, orgId, 50_000_000); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const id = await t.run(async ctx => {
    const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    const date = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
    const brief = { ...socialTrendFixture().copyBrief!, supportingSourceUrls: ["https://example.com/observation"], trendEvidence: { sourceUrl: "https://example.com/observation", observationDate: date, observation: "A process reveal format", retrievedAt: Date.now() - 30 * 86400000 }, approvedOfferPlayName: "Workshop guide" };
    return insertArtifact(ctx, { orgId, businessId: b._id, factIds: [], createdBy: owner.userId, offerTermsSnapshot: terms, offerPlayNameSnapshot: "Workshop guide", item: { kind: "social_post", channel: "facebook", title: "Original guide", body: "The workshop guide costs $40. It explains how to prepare, identify the question and review what is still unknown before running your workshop.", hashtags: [], factIndexes: [], copyBrief: brief, role: "social_media_manager" } });
  });
  return { t, owner, orgId, slug, id };
}
it("pins source version, carries original offer and trend evidence, and grants no approval", async () => {
  const f = await fixture(); const original = await f.t.run(ctx => ctx.db.get(f.id));
  const runId = await f.owner.client.mutation(api.repurpose.start, { slug: f.slug, artifactId: f.id, formats: ["linkedin"] });
  await f.t.finishAllScheduledFunctions(() => undefined);
  const run = await f.t.run(ctx => ctx.db.get(runId));
  expect(JSON.parse(run!.input)).toMatchObject({ sourceArtifactId: f.id, sourceVersionId: original!.currentVersionId });
  const [draft] = await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect());
  expect(draft).toMatchObject({ orgId: f.orgId, channel: "linkedin", status: "in_review" });
  const ver = await f.t.run(ctx => ctx.db.get(draft.currentVersionId!));
  expect(ver?.approvedOfferTermsSnapshot).toEqual(terms);
  expect(ver?.offerPlayNameSnapshot).toBe("Workshop guide");
  expect(ver?.copyBrief?.trendEvidence?.observationDate).toBe(new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10));
  expect(ver?.copyBrief?.channel).toBe("linkedin");
  expect(JSON.stringify(state.messages)).toContain("allowedPrices");
  await expect(f.owner.client.mutation(api.content.decide, { slug: f.slug, artifactId: draft._id, decision: "approve" })).rejects.toThrow(/30-day|trend/i);
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("approvals").collect())).toEqual([]);
});
it.each(["Get the guide for $90.", "Get the guide for $40. Only 3 spots left!"])("rejects generated offer changes before saving (%s)", async body => {
  const f = await fixture(); state.body = body;
  const runId = await f.owner.client.mutation(api.repurpose.start, { slug: f.slug, artifactId: f.id, formats: ["linkedin"] });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect((await f.t.run(ctx => ctx.db.get(runId)))?.status).toBe("failed");
  expect(await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect())).toEqual([]);
});
it("rejects mixed artifact and webpage sources before reserving work", async () => {
  const f = await fixture();
  await expect(f.owner.client.mutation(api.repurpose.start, { slug: f.slug, artifactId: f.id, url: "https://example.com/other", formats: ["linkedin"] })).rejects.toThrow(/one source|either/i);
  expect(await f.t.run(ctx => ctx.db.query("workflowRuns").collect())).toEqual([]);
});
it("uses the original version when the owner edits the source before the worker runs", async () => {
  const f = await fixture();
  const before = await f.t.run(ctx => ctx.db.get(f.id));
  const runId = await f.owner.client.mutation(api.repurpose.start, { slug: f.slug, artifactId: f.id, formats: ["linkedin"] });
  await f.owner.client.mutation(api.content.edit, { slug: f.slug, artifactId: f.id, hashtags: [], body: "CHANGED_SOURCE_MARKER: The guide now costs $90. This new text must not silently replace the version selected for repurposing." });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect((await f.t.run(ctx => ctx.db.get(f.id)))?.currentVersionId).not.toBe(before?.currentVersionId);
  expect(JSON.stringify(state.messages)).not.toContain("CHANGED_SOURCE_MARKER");
  expect(JSON.stringify(state.messages)).toContain("The workshop guide costs $40");
  const [draft] = await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect());
  await f.owner.client.mutation(api.content.edit, { slug: f.slug, artifactId: draft._id, hashtags: [], body: "Get the guide for $90." });
  await expect(f.owner.client.mutation(api.content.decide, { slug: f.slug, artifactId: draft._id, decision: "approve" })).rejects.toThrow(/offer terms/);
});
it("rejects another tenant's source and a cross-artifact version pointer", async () => {
  const f = await fixture(), other = await asNewUser(f.t, "foreign-source@example.com");
  const workspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Foreign" });
  await expect(other.client.mutation(api.repurpose.start, { slug: workspace.slug, artifactId: f.id, formats: ["linkedin"] })).rejects.toThrow();
  await f.t.run(async ctx => {
    const source = (await ctx.db.get(f.id))!;
    const second = await insertArtifact(ctx, { orgId: f.orgId, businessId: source.businessId, factIds: [], item: { kind: "social_post", channel: "facebook", title: "Other", body: "A different draft", hashtags: [], factIndexes: [], role: "social_media_manager" } });
    const secondArt = (await ctx.db.get(second))!;
    await ctx.db.patch(f.id, { currentVersionId: secondArt.currentVersionId });
  });
  await expect(f.owner.client.mutation(api.repurpose.start, { slug: f.slug, artifactId: f.id, formats: ["linkedin"] })).rejects.toThrow(/does not belong/);
});
it("fails a queued job cleanly if its pinned version is unavailable", async () => {
  const f = await fixture();
  const runId = await f.owner.client.mutation(api.repurpose.start, { slug: f.slug, artifactId: f.id, formats: ["linkedin"] });
  await f.t.run(async ctx => { const source = (await ctx.db.get(f.id))!; await ctx.db.delete(source.currentVersionId!); });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect((await f.t.run(ctx => ctx.db.get(runId)))?.status).toBe("failed");
  expect(state.messages).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect())).toEqual([]);
});
it("rechecks the whole saved batch at persistence rather than trusting the worker", async () => {
  const f = await fixture();
  const runId = await f.owner.client.mutation(api.repurpose.start, { slug: f.slug, artifactId: f.id, formats: ["linkedin", "email"] });
  await expect(f.t.mutation(internal.repurpose.save, { runId, items: [{ format: "linkedin", title: "Good", body: "Get the guide for $40.", hashtags: [] }, { format: "email", title: "Bad", body: "Get the guide for $90.", hashtags: [] }] })).rejects.toThrow();
  expect(await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect())).toEqual([]);
  state.formats = ["linkedin", "email"];
  await f.t.finishAllScheduledFunctions(() => undefined);
});
it.each(["missing", "duplicate", "unexpected"])("does not label a %s-format result complete", async kind => {
  const f = await fixture();
  const formats = kind === "missing" ? ["linkedin", "email"] as const : ["linkedin"] as const;
  if (kind === "duplicate") state.formats = ["linkedin", "linkedin"];
  if (kind === "unexpected") state.formats = ["linkedin", "email"];
  const runId = await f.owner.client.mutation(api.repurpose.start, { slug: f.slug, artifactId: f.id, formats: [...formats] });
  await f.t.finishAllScheduledFunctions(() => undefined);
  expect((await f.t.run(ctx => ctx.db.get(runId)))?.status).toBe("failed");
  expect(await f.t.run(ctx => ctx.db.query("artifacts").withIndex("by_run", q => q.eq("runId", runId)).collect())).toEqual([]);
});
