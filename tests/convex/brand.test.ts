import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("brand kit + voice learning", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("saves the kit and learns rules after 5 owner edits", async () => {
    const t = setup();
    const owner = await asNewUser(t, "brand@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Brand Co" });
    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first();
      await ctx.db.insert("brandProfiles", { orgId: orgId as Id<"organizations">, businessId: business!._id, voice: "Plain", toneWords: [], colors: [], doNots: [], updatedAt: Date.now() });
    });
    await owner.client.mutation(api.brand.update, { slug, voice: "Friendly expert", toneWords: ["warm", " direct "], colors: ["#123456", "nope"], doNots: ["No emojis", ""] });
    let b = await owner.client.query(api.brand.get, { slug });
    expect(b).toMatchObject({ voice: "Friendly expert", toneWords: ["warm", "direct"], colors: ["#123456"], doNots: ["No emojis"] });

    await t.run(async (ctx) => {
      const { recordVoiceSample } = await import("../../convex/brand");
      for (let i = 0; i < 5; i++) await recordVoiceSample(ctx, orgId as Id<"organizations">, "linkedin", `Hey!! 🚀 Big news number ${i} for everyone out there`, `We have news (${i}). Short and plain, as always.`);
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    b = await owner.client.query(api.brand.get, { slug });
    expect(b.learnedRules.length).toBeGreaterThan(0);
    expect(b.pending).toBe(0);
    await owner.client.mutation(api.brand.removeRule, { slug, index: 0 });
    expect((await owner.client.query(api.brand.get, { slug })).learnedRules.length).toBe(b.learnedRules.length - 1);
  });
});
