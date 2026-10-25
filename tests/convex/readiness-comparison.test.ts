import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("competitor readiness comparison", () => {
  it("compares the business with active watched competitors in the same workspace only", async () => {
    const t = setup();
    const owner = await asNewUser(t, "readiness-owner@example.com");
    const other = await asNewUser(t, "readiness-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Readiness Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    expect(await owner.client.query(api.competitors.readinessComparison, { slug })).toBeNull();
    const now = Date.now();
    await t.run(async (ctx) => {
      const org = orgId as Id<"organizations">;
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org)).first())!;
      await ctx.db.patch(business._id, { siteReadiness: { status: "complete", checkedAt: now, startedAt: now, findings: [{ id: "missing-description", level: "attention", title: "t", evidence: "e", nextStep: "n" }] } as never });
      await ctx.db.insert("competitorWatches", { orgId: org, name: "Rival", url: "https://rival.example", active: true, lastReadinessFindingIds: [], lastReadinessAt: now, createdAt: now });
      await ctx.db.insert("competitorWatches", { orgId: org, name: "Paused", url: "https://paused.example", active: false, lastReadinessFindingIds: [], lastReadinessAt: now, createdAt: now });
    });
    const result = await owner.client.query(api.competitors.readinessComparison, { slug });
    expect(result?.youBehind).toEqual(["Search description"]);
    expect(result?.checks[0].competitors.map((c) => c.name)).toEqual(["Rival"]);
    expect(await other.client.query(api.competitors.readinessComparison, { slug: otherSlug })).toBeNull();
  });
});
