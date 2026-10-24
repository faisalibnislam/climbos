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
    await owner.client.mutation(api.brand.update, { slug, voice: "Friendly expert", toneWords: ["warm", " direct "], colors: ["#123456", "nope"], doNots: ["No emojis", ""], approvedExamples: ["  Example with spacing  ", "Example with spacing", "", "Second example", "Third example", "Fourth example"], socialHumor: "cheeky", socialTrendPolicy: "trend_aware", voiceLearningEnabled: true });
    let b = await owner.client.query(api.brand.get, { slug });
    expect(b).toMatchObject({ voice: "Friendly expert", toneWords: ["warm", "direct"], colors: ["#123456"], doNots: ["No emojis"], approvedExamples: ["Example with spacing", "Second example", "Third example"], socialHumor: "cheeky", socialTrendPolicy: "trend_aware", voiceLearningEnabled: true, canEdit: true, canManageVoiceLearning: true });
    await owner.client.mutation(api.brand.update, { slug, voice: "Friendly expert", toneWords: ["warm"], colors: ["#123456"], doNots: ["No emojis"] });
    expect((await owner.client.query(api.brand.get, { slug })).approvedExamples).toEqual(["Example with spacing", "Second example", "Third example"]);
    expect((await owner.client.query(api.brand.get, { slug })).socialHumor).toBe("cheeky");
    await owner.client.mutation(api.brand.update, { slug, voice: "Friendly expert", toneWords: ["warm", " direct "], colors: ["#123456"], doNots: ["No emojis"], approvedExamples: [] });
    expect((await owner.client.query(api.brand.get, { slug })).approvedExamples).toEqual([]);

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

  it("exposes brand editing permissions and protects owner-only style consent", async () => {
    const t = setup();
    const owner = await asNewUser(t, "brand-access-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Brand Access Co" });
    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first();
      await ctx.db.insert("brandProfiles", { orgId: orgId as Id<"organizations">, businessId: business!._id, voice: "Plain", toneWords: [], colors: [], doNots: [], updatedAt: Date.now() });
    });
    const editor = await asNewUser(t, "brand-access-editor@example.com");
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: orgId as Id<"organizations">, userId: editor.userId as Id<"users">, role: "editor", status: "active", createdAt: Date.now() }));
    expect(await editor.client.query(api.brand.get, { slug })).toMatchObject({ canEdit: true, canManageVoiceLearning: false });
    await expect(editor.client.mutation(api.brand.update, { slug, voice: "Plain", toneWords: [], colors: [], doNots: [], approvedExamples: ["Must be owner approved"] })).rejects.toThrow(/Only an owner or admin can approve brand examples/);
    await expect(editor.client.mutation(api.brand.update, { slug, voice: "Plain", toneWords: [], colors: [], doNots: [], voiceLearningEnabled: true })).rejects.toThrow(/Only an owner or admin can change voice learning consent/);
    const viewer = await asNewUser(t, "brand-access-viewer@example.com");
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: orgId as Id<"organizations">, userId: viewer.userId as Id<"users">, role: "viewer", status: "active", createdAt: Date.now() }));
    expect(await viewer.client.query(api.brand.get, { slug })).toMatchObject({ canEdit: false, canManageVoiceLearning: false });
  });

  it("keeps voice learning off by default and deletes samples and rules when consent is withdrawn", async () => {
    const t = setup();
    const owner = await asNewUser(t, "voice-consent@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Consent Co" });
    await t.run(async (ctx) => {
      const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first();
      await ctx.db.insert("brandProfiles", { orgId: orgId as Id<"organizations">, businessId: business!._id, voice: "Plain", toneWords: [], colors: [], doNots: [], learnedRules: [{ text: "No emojis", at: Date.now() }], updatedAt: Date.now() });
    });
    expect((await owner.client.query(api.brand.get, { slug })).voiceLearningEnabled).toBe(false);
    await t.run(async (ctx) => {
      const { recordVoiceSample } = await import("../../convex/brand");
      await recordVoiceSample(ctx, orgId as Id<"organizations">, "email", "AI draft with enough length to compare", "Owner version has enough length to compare.");
    });
    expect((await owner.client.query(api.brand.get, { slug })).pending).toBe(0);

    await owner.client.mutation(api.brand.update, { slug, voice: "Plain", toneWords: [], colors: [], doNots: [], voiceLearningEnabled: true });
    await t.run(async (ctx) => {
      const { recordVoiceSample } = await import("../../convex/brand");
      for (let i = 0; i < 2; i++) await recordVoiceSample(ctx, orgId as Id<"organizations">, "email", `AI draft ${i} has enough length to compare`, `Owner version ${i} has enough length to compare.`);
    });
    await owner.client.mutation(api.brand.learnNow, { slug });
    await owner.client.mutation(api.brand.update, { slug, voice: "Plain", toneWords: [], colors: [], doNots: [], voiceLearningEnabled: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const brand = await owner.client.query(api.brand.get, { slug });
    expect(brand.voiceLearningEnabled).toBe(false);
    expect(brand.learnedRules).toEqual([]);
    expect(brand.pending).toBe(0);
    expect(await t.run((ctx) => ctx.db.query("voiceSamples").withIndex("by_org_used", (q) => q.eq("orgId", orgId as Id<"organizations">).eq("used", false)).collect())).toEqual([]);
  });
});
