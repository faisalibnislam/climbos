import { describe, expect, it } from "vitest";
import { unsupportedClaimIssue } from "../../convex/lib/claimCheck";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup, type T } from "./helpers";

async function demoInReview(t: T, email: string) {
  const u = await asNewUser(t, email, { anonymous: true });
  const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
  const target = await t.run(async (ctx) => {
    const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
    return (await ctx.db.query("artifacts").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).collect()).find((a) => a.status === "in_review" && a.channel === "instagram")!;
  });
  const setBody = (body: string) => t.run(async (ctx) => ctx.db.patch(target.currentVersionId!, { body }));
  return { ...u, slug, target, setBody };
}

describe("claim checks at approval", () => {
  it("blocks an edited post whose scarcity or scale claim has no confirmed fact behind it", async () => {
    const t = setup();
    const d = await demoInReview(t, "claims-block@example.com");
    await d.setBody("Only 3 spots left this week. Book now.");
    await expect(d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "approve" })).rejects.toThrow(/can't verify/i);
    await d.setBody("Trusted by thousands of local families.");
    await expect(d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "approve" })).rejects.toThrow(/can't verify/i);
    expect((await t.run(async (ctx) => ctx.db.get(d.target._id)))!.status).toBe("in_review");
  });

  it("approves the same claim once a confirmed owner fact supports it, and still lets send-backs through", async () => {
    const t = setup();
    const d = await demoInReview(t, "claims-ok@example.com");
    await d.setBody("Only 3 spots left this week. Book now.");
    await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "reject" });
    await t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("businessFacts", { orgId: d.target.orgId, businessId: d.target.businessId, statement: "Only 3 spots are left in this week's schedule.", category: "offer", confidence: "high", provenance: "owner_supplied", reviewState: "confirmed", sourceIds: [], createdAt: now, updatedAt: now, verifiedAt: now });
    });
    await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "approve" });
    expect((await t.run(async (ctx) => ctx.db.get(d.target._id)))!.status).not.toBe("in_review");
  });
  it("requires reconfirmation of future-dated evidence and keeps approval blocked meanwhile", async () => {
    const t = setup();
    const d = await demoInReview(t, "future-fact@example.com");
    const id = await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "product", statement: "Pro includes 24/7 support." });
    await t.run(ctx => ctx.db.patch(id, { verifiedAt: Date.now() + 86_400_000 }));
    await d.setBody("Get 24/7 support.");
    await expect(d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "approve" })).rejects.toThrow(/verify/i);
    await d.client.mutation(api.orgs.reviewFact, { slug: d.slug, factId: id, action: "confirm" });
    await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "approve" });
  });

  it("withholds both sides of a confirmed capability conflict until the owner resolves it", async () => {
    const t = setup();
    const d = await demoInReview(t, "conflicting-fact@example.com");
    await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "product", statement: "Pro includes 24/7 support." });
    const negative = await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "product", statement: "Pro does not include 24/7 support." });
    await d.setBody("Get 24/7 support.");
    await expect(d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "approve" })).rejects.toThrow(/verify|disagree/i);
    expect((await t.run(ctx => ctx.db.get(d.target._id)))!.status).toBe("in_review");
    await d.client.mutation(api.orgs.reviewFact, { slug: d.slug, factId: negative, action: "reject" });
    await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "approve" });
  });

  it("checks actual price and billing-period conflicts without blocking unrelated copy", async () => {
    const t = setup();
    const d = await demoInReview(t, "price-conflict-copy@example.com");
    await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "pricing", statement: "Pro is $19 per month." });
    const check = (copy: string) => t.run(ctx => unsupportedClaimIssue(ctx, d.target.businessId, [copy]));
    expect(await check("Pro is $29 per month.")).toMatch(/disagree/);
    expect(await check("Pro is $19 per month.")).toBeNull();
    expect(await check("Read our latest guide.")).toBeNull();
    await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "proof", statement: "The former Pro price was $29 per month." });
    expect(await check("Pro was $29 per month. Pro is $19 per month.")).toBeNull();
    // A separate annual price is not a contradiction with a monthly price.
    expect(await check("Pro is $190 per year.")).toBeNull();
    const conflict = await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "pricing", statement: "Pro is $29 per month." });
    expect(await check("Pro is $19 per month.")).toMatch(/disagree/);
    await d.client.mutation(api.orgs.reviewFact, { slug: d.slug, factId: conflict, action: "reject" });
    expect(await check("Pro is $19 per month.")).toBeNull();
  });

  it("does not let retired history hide a new fact or its conflicting update", async () => {
    const t = setup();
    const d = await demoInReview(t, "retired-fact-history@example.com");
    await t.run(async ctx => {
      for (let i = 0; i < 305; i++) await ctx.db.insert("businessFacts", { orgId: d.target.orgId, businessId: d.target.businessId, statement: `Retired note ${i}`, category: "other", confidence: "low", provenance: "owner_supplied", reviewState: "rejected", sourceIds: [], createdAt: Date.now() - 1000, updatedAt: Date.now() - 1000 });
    });
    await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "product", statement: "Pro includes 24/7 support." });
    const negative = await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "product", statement: "Pro does not include 24/7 support." });
    expect((await d.client.query(api.siteWatch.facts, { slug: d.slug }))?.conflicts.some(c => c.factIds.includes(negative))).toBe(true);
    await d.setBody("Get 24/7 support.");
    await expect(d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "approve" })).rejects.toThrow(/verify|disagree/);
    await d.client.mutation(api.orgs.reviewFact, { slug: d.slug, factId: negative, action: "reject" });
    await d.client.mutation(api.content.decide, { slug: d.slug, artifactId: d.target._id, decision: "approve" });
  });

  it("does not certify incomplete fact coverage or another tenant's supporting claim", async () => {
    const t = setup();
    const d = await demoInReview(t, "fact-coverage@example.com");
    const other = await demoInReview(t, "fact-coverage-other@example.com");
    await t.run(async ctx => {
      const now = Date.now();
      await ctx.db.insert("businessFacts", { orgId: other.target.orgId, businessId: d.target.businessId, statement: "Pro includes 24/7 support.", category: "product", confidence: "high", provenance: "owner_supplied", reviewState: "confirmed", sourceIds: [], createdAt: now, updatedAt: now });
    });
    expect(await t.run(ctx => unsupportedClaimIssue(ctx, d.target.businessId, ["Get 24/7 support."]))).not.toBeNull();
    const ids = await t.run(async ctx => {
      const ids = [];
      for (let i = 0; i < 201; i++) ids.push(await ctx.db.insert("businessFacts", { orgId: d.target.orgId, businessId: d.target.businessId, statement: `Active note ${i}`, category: "other", confidence: "low", provenance: "owner_supplied", reviewState: "confirmed", sourceIds: [], createdAt: Date.now(), updatedAt: Date.now() }));
      return ids;
    });
    expect(await t.run(ctx => unsupportedClaimIssue(ctx, d.target.businessId, ["Read our guide."]))).toMatch(/too many active/);
    await t.run(async ctx => { for (const id of ids) await ctx.db.patch(id, { reviewState: "rejected" }); });
    expect(await t.run(ctx => unsupportedClaimIssue(ctx, d.target.businessId, ["Read our guide."]))).toBeNull();
  });

  it("checks conflicts beyond the owner display's six-item preview", async () => {
    const t = setup();
    const d = await demoInReview(t, "many-conflicts@example.com");
    for (const tier of ["Starter", "Basic", "Personal", "Hobby", "Solo", "Plus", "Pro"]) {
      await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "pricing", statement: `${tier} is $19 per month.` });
      await d.client.mutation(api.orgs.addFact, { slug: d.slug, category: "pricing", statement: `${tier} is $29 per month.` });
    }
    expect(await t.run(ctx => unsupportedClaimIssue(ctx, d.target.businessId, ["Starter is $19 per month."]))).toMatch(/disagree/);
    expect(await t.run(ctx => unsupportedClaimIssue(ctx, d.target.businessId, ["Pro is $19 per month."]))).toMatch(/disagree/);
  });

});
