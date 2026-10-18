import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("learning from results", () => {
  it("measures each workspace and pools by type only with 5+ workspaces", async () => {
    const t = setup();
    const orgs: Id<"organizations">[] = [];
    for (let i = 0; i < 5; i++) {
      const u = await asNewUser(t, `learn${i}@example.com`);
      const { orgId } = await u.client.mutation(api.orgs.createWorkspace, { businessName: `Learn ${i}` });
      orgs.push(orgId as Id<"organizations">);
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("landingPages", { orgId: orgId as Id<"organizations">, slug: `p-${i}`, title: "Offer", brief: "Offer", status: "live", color: "#000000", views: 100, leads: 5 + i, createdAt: now, updatedAt: now });
      });
    }
    await t.action(internal.learning.recompute, {});
    const ctx0 = await t.query(internal.learning.contextFor, { orgId: orgs[0] });
    expect(ctx0).toContain("THIS BUSINESS 5%");
    expect(ctx0).toMatch(/5 workspaces, n=500/);
    // With only 4 contributing, nothing pooled is published.
    await t.run(async (ctx) => {
      const p = await ctx.db.query("landingPages").collect();
      await ctx.db.patch(p[4]._id, { views: 0, leads: 0 });
    });
    await t.action(internal.learning.recompute, {});
    expect(await t.query(internal.learning.contextFor, { orgId: orgs[0] })).not.toMatch(/workspaces, n=/);
  });
});
