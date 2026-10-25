import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { factFreshness } from "../../shared/agents/factFreshness";
import { asNewUser, setup } from "./helpers";

const DAY = 86_400_000;

describe("reconfirming a fact that is due for review", () => {
  it("lets editors mark an unchanged fact as still accurate, resetting its review age without editing it", async () => {
    const t = setup();
    const owner = await asNewUser(t, "reconfirm-owner@example.com");
    const viewer = await asNewUser(t, "reconfirm-viewer@example.com");
    const other = await asNewUser(t, "reconfirm-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Fact Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    const old = Date.now() - 200 * DAY;
    const factId = await t.run(async (ctx) => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first())!;
      await ctx.db.insert("memberships", { orgId: orgId as Id<"organizations">, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() });
      return ctx.db.insert("businessFacts", { orgId: orgId as Id<"organizations">, businessId: business._id, category: "pricing", statement: "The starter plan costs $29 a month.", confidence: "high", reviewState: "confirmed", provenance: "owner_supplied", sourceIds: [], verifiedAt: old, createdAt: old, updatedAt: old });
    });
    expect(factFreshness("pricing", old, Date.now(), old).reviewSuggested).toBe(true);

    await expect(viewer.client.mutation(api.orgs.reviewFact, { slug, factId, action: "confirm" })).rejects.toThrow(/can't/i);
    await expect(other.client.mutation(api.orgs.reviewFact, { slug: otherSlug, factId, action: "confirm" })).rejects.toThrow(/couldn't find that fact/);

    await owner.client.mutation(api.orgs.reviewFact, { slug, factId, action: "confirm" });
    const fact = (await t.run(async (ctx) => ctx.db.get(factId)))!;
    expect(fact).toMatchObject({ statement: "The starter plan costs $29 a month.", reviewState: "confirmed", updatedBy: owner.userId });
    expect(fact.verifiedAt).toBeGreaterThan(old);
    expect(factFreshness(fact.category, fact.updatedAt, Date.now(), fact.verifiedAt).reviewSuggested).toBe(false);
    const audits = await t.run(async (ctx) => ctx.db.query("auditEvents").collect());
    expect(audits.some((row) => row.action === "fact.confirm" && row.subjectId === factId)).toBe(true);
  });
});
