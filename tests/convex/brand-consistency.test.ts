import { expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { brandConsistencyBrief } from "../../convex/lib/brandConsistency";

async function fixture() {
  const t = setup();
  const owner = await asNewUser(t, "brand-map@example.com");
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Map" });
  const ids = await t.run(async ctx => {
    const b = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    const brandId = await ctx.db.insert("brandProfiles", { orgId, businessId: b._id, voice: "Clear", toneWords: [], colors: ["#112233"], doNots: [], updatedAt: 1 });
    const pages = [];
    for (let i = 0; i < 2; i++) pages.push(await ctx.db.insert("landingPages", { orgId, slug: `map-${orgId}-${i}`, title: `Page ${i}`, brief: "Test", status: "live", version: 2, publishedVersion: 1, color: "#ffffff", content: JSON.stringify({ ctaLabel: "Draft text" }), publishedColor: i ? "#445566" : "#112233", publishedContent: JSON.stringify({ ctaLabel: "Ask us" }), views: 0, leads: 0, createdAt: i, updatedAt: i }));
    const designId = await ctx.db.insert("designs", { orgId, title: "Saved poster", format: "custom", doc: JSON.stringify({ version: 1, pages: [{ background: { kind: "solid", color: "#445566" }, layers: [{ type: "text", fontFamily: "Inter", color: "#112233" }] }] }), pages: 1, createdBy: owner.userId, createdAt: 1, updatedAt: 1 });
    return { brandId, pages, designId };
  });
  return { t, ...owner, slug, orgId, ...ids };
}

it("uses published rather than edited draft values, distinguishes unconfirmed rules, and keeps draft assets explicit", async () => {
  const f = await fixture();
  const map = await f.client.query(api.brand.consistency, { slug: f.slug });
  expect(map.rules).toBeNull();
  expect(map.patterns.find(p => p.key === "page_accent")?.outsidePalette).toEqual([]);
  expect(map.patterns.find(p => p.key === "page_cta")?.repeatedValues).toEqual(["Ask us"]);
  expect(map.patterns.find(p => p.key === "design_fonts")?.observations[0].source.approval).toBe("saved_draft");
  await f.client.mutation(api.brand.update, { slug: f.slug, voice: "Clear", toneWords: [], colors: ["#112233"], doNots: [] });
  expect((await f.client.query(api.brand.consistency, { slug: f.slug })).patterns.find(p => p.key === "page_accent")?.outsidePalette).toEqual(["#445566"]);
});

it("binds exceptions to current sources, preserves snapshots, rejects concurrent decisions and feeds later advice without authorizing actions", async () => {
  const f = await fixture();
  const map = await f.client.query(api.brand.consistency, { slug: f.slug });
  const pattern = map.patterns.find(p => p.key === "page_accent")!;
  const args = { slug: f.slug, key: pattern.key, fingerprint: pattern.fingerprint, state: "intentional_exception" as const, note: "Different accent for the seasonal offer, only on these pages." };
  await expect(f.client.mutation(api.brand.reviewPattern, { ...args, note: "" })).rejects.toThrow(/Explain/);
  const id = await f.client.mutation(api.brand.reviewPattern, args);
  await expect(f.client.mutation(api.brand.reviewPattern, args)).rejects.toThrow(/Another review/);
  expect(await f.t.run(ctx => brandConsistencyBrief(ctx, f.orgId))).toContain('"current":true');
  const saved = (await f.client.query(api.brand.consistency, { slug: f.slug })).decisions[0];
  expect(saved).toMatchObject({ id, state: "intentional_exception", current: true });
  expect(JSON.parse(saved.snapshot).pattern.observations).toHaveLength(2);
  for (const kind of ["strategy", "conversion_audit"] as const) {
    const runId = await f.t.run(ctx => ctx.db.insert("workflowRuns", { orgId: f.orgId, kind, title: "Context check", status: "executing", input: "{}", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: "test", entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 0, researchTools: 0, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: 1, updatedAt: 1 }));
    const context = await f.t.query(internal.jobWrites.jobContext, { runId });
    expect(context?.brandConsistencyText).toContain("intentional_exception");
    expect(context?.brandConsistencyText).toContain("#445566");
  }
  // A new published version invalidates the decision rather than silently expanding its scope.
  await f.t.run(ctx => ctx.db.patch(f.pages[0], { publishedVersion: 3, publishedColor: "#778899" }));
  await expect(f.client.mutation(api.brand.reviewPattern, { ...args, expectedDecisionId: id })).rejects.toThrow(/source versions/);
  const changed = await f.client.query(api.brand.consistency, { slug: f.slug });
  expect(changed.decisions[0].current).toBe(false);
  expect(changed.decisions[0].snapshot).toBe(saved.snapshot);
  expect(await f.t.run(ctx => brandConsistencyBrief(ctx, f.orgId))).toContain("Do not apply this prior decision");
  const current = changed.patterns.find(p => p.key === pattern.key)!;
  await f.client.mutation(api.brand.reviewPattern, { ...args, fingerprint: current.fingerprint, expectedDecisionId: id, state: "corrected", note: "The new accent is a draft choice to review." });
  const exported = JSON.parse(await f.t.query(internal.settings.exportData, { orgId: f.orgId }));
  expect(exported.brandPatternDecisions).toHaveLength(2);
  await f.t.run(async ctx => {
    expect(await ctx.db.query("approvals").collect()).toHaveLength(0);
    expect(await ctx.db.query("workflowRuns").collect()).toHaveLength(2);
    expect(await ctx.db.query("actionReceipts").collect()).toHaveLength(0);
    expect((await ctx.db.get(f.brandId))?.colors).toEqual(["#112233"]);
  });
  await f.t.mutation(internal.settings.purgeWorkspaceBatch, { orgId: f.orgId });
  expect(await f.t.run(ctx => ctx.db.query("brandPatternDecisions").collect())).toEqual([]);
});

it("rejects viewer/editor confirmations, isolates tenant state and invalidates reviewed asset or brand changes", async () => {
  const f = await fixture();
  const other = await asNewUser(f.t, "other-map@example.com");
  const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other" });
  await expect(other.client.query(api.brand.consistency, { slug: f.slug })).rejects.toThrow();
  expect((await other.client.query(api.brand.consistency, { slug: otherSlug })).patterns).toEqual([]);
  const pattern = (await f.client.query(api.brand.consistency, { slug: f.slug })).patterns.find(p => p.key === "design_fonts")!;
  for (const role of ["editor", "viewer"] as const) {
    const member = await asNewUser(f.t, `${role}-map@example.com`);
    await f.t.run(ctx => ctx.db.insert("memberships", { orgId: f.orgId, userId: member.userId, role, status: "active", createdAt: Date.now() }));
    expect((await member.client.query(api.brand.consistency, { slug: f.slug })).canReview).toBe(false);
    await expect(member.client.mutation(api.brand.reviewPattern, { slug: f.slug, key: pattern.key, fingerprint: pattern.fingerprint, state: "confirmed", note: "" })).rejects.toThrow();
  }
  await f.client.mutation(api.brand.reviewPattern, { slug: f.slug, key: pattern.key, fingerprint: pattern.fingerprint, state: "confirmed", note: "" });
  await f.t.run(ctx => ctx.db.patch(f.designId, { doc: JSON.stringify({ version: 1, pages: [] }), updatedAt: 2 }));
  expect((await f.client.query(api.brand.consistency, { slug: f.slug })).decisions[0].current).toBe(false);
  const pagePattern = (await f.client.query(api.brand.consistency, { slug: f.slug })).patterns.find(p => p.key === "page_accent")!;
  await f.client.mutation(api.brand.reviewPattern, { slug: f.slug, key: pagePattern.key, fingerprint: pagePattern.fingerprint, state: "confirmed", note: "" });
  await f.client.mutation(api.brand.update, { slug: f.slug, voice: "New direction", colors: ["#aaaaaa"], toneWords: [], doNots: [] });
  expect((await f.client.query(api.brand.consistency, { slug: f.slug })).decisions.every(d => !d.current)).toBe(true);
});
