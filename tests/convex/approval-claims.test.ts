import { describe, expect, it } from "vitest";
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
});
