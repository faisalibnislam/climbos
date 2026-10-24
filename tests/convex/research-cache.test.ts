import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("tenant research cache", () => {
  it("reuses a key only inside its workspace and purges expired rows", async () => {
    const t = setup();
    const userA = await asNewUser(t, "cache-a@example.com");
    const userB = await asNewUser(t, "cache-b@example.com");
    const orgA = (
      await userA.client.mutation(api.orgs.createWorkspace, {
        businessName: "Cache A",
      })
    ).orgId as Id<"organizations">;
    const orgB = (
      await userB.client.mutation(api.orgs.createWorkspace, {
        businessName: "Cache B",
      })
    ).orgId as Id<"organizations">;
    const cacheKey = "a".repeat(64);
    const expiresAt = Date.now() + 60_000;
    await t.mutation(internal.engine.putResearchCache, {
      orgId: orgA,
      cacheKey,
      agentId: "growth_strategy",
      modelKey: "gpt-6-luna",
      notes: "Sourced market evidence",
      sources: [{ url: "https://example.com/source", title: "Source" }],
      expiresAt,
    });

    expect(
      await t.query(internal.engine.getResearchCache, {
        orgId: orgA,
        cacheKey,
      }),
    ).toMatchObject({ notes: "Sourced market evidence" });
    expect(
      await t.query(internal.engine.getResearchCache, {
        orgId: orgB,
        cacheKey,
      }),
    ).toBeNull();

    await t.run(async (ctx) => {
      await ctx.db.insert("researchCache", {
        orgId: orgA,
        cacheKey: "b".repeat(64),
        agentId: "growth_strategy",
        modelKey: "gpt-6-luna",
        notes: "Expired",
        sources: [],
        createdAt: Date.now() - 60_000,
        expiresAt: Date.now() - 1,
      });
    });
    expect(
      await t.mutation(internal.engine.purgeExpiredResearchCache, {}),
    ).toBe(1);
    expect(
      await t.run((ctx) => ctx.db.query("researchCache").collect()),
    ).toHaveLength(1);
  });
});
