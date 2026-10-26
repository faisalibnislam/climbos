import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

async function ready(email: string) {
  const t = setup();
  const owner = await asNewUser(t, email);
  const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Details Co" });
  await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 100 });
  const biz = () => t.run(async (ctx) => (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as never)).first())!);
  return { t, owner, slug, orgId, biz };
}

describe("business details: several answers, approving guesses, budget, channels already used", () => {
  it("saves several answers for multiple-choice details and refuses them for single-choice ones", async () => {
    const { owner, slug, biz } = await ready("details-multi@example.com");
    await owner.client.mutation(api.acquisition.setDimension, { slug, key: "customerType", value: "b2b", values: ["b2b", "b2c"] });
    expect((await biz()).acquisition?.dims.customerType).toMatchObject({ value: "b2b", values: ["b2b", "b2c"], source: "owner" });
    await expect(owner.client.mutation(api.acquisition.setDimension, { slug, key: "aov", value: "low", values: ["low", "high"] })).rejects.toThrow(/one answer/);
    await expect(owner.client.mutation(api.acquisition.setDimension, { slug, key: "customerSize", value: "huge", values: ["huge"] })).rejects.toThrow(/options/);
    const view = await owner.client.query(api.acquisition.view, { slug });
    const ct = view!.dimensions.find((d) => d.key === "customerType")!;
    expect(ct).toMatchObject({ multi: true, values: ["b2b", "b2c"], valueLabel: "Businesses, Consumers" });
    expect(view!.dimensions.find((d) => d.key === "aov")!.options[0].label).toMatch(/Small/);
  });

  it("approves every AI guess as the owner's answer, leaving owner answers alone", async () => {
    const { t, owner, slug, biz } = await ready("details-guess@example.com");
    const b = await biz();
    await t.run(async (ctx) => ctx.db.patch(b._id, { acquisition: { types: ["saas_b2b"], typesSource: "inferred", dims: { geography: { value: "global", values: ["global"], confidence: "low", source: "inferred", evidence: "site" }, team: { value: "solo", confidence: "high", source: "owner" } }, channelPreferences: [], updatedAt: Date.now() } }));
    const r = await owner.client.mutation(api.acquisition.approveGuesses, { slug });
    expect(r.approved).toBe(1);
    expect((await biz()).acquisition?.dims.geography).toMatchObject({ source: "owner", confidence: "high", values: ["global"] });
  });

  it("changes the ad budget inline and moves the spending cap with it", async () => {
    const { t, owner, slug, orgId } = await ready("details-budget@example.com");
    await owner.client.mutation(api.orgs.setAdBudget, { slug, monthlyAdBudget: 250 });
    const goal = await t.run(async (ctx) => ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", orgId as never).eq("status", "active")).first());
    const policy = await t.run(async (ctx) => ctx.db.query("autonomyPolicies").withIndex("by_org_active", (q) => q.eq("orgId", orgId as never).eq("active", true)).first());
    expect(goal!.monthlyAdBudgetMinor).toBe(25_000);
    expect(policy!.maxMonthlyAdSpendMinor).toBe(25_000);
    await expect(owner.client.mutation(api.orgs.setAdBudget, { slug, monthlyAdBudget: -1 })).rejects.toThrow();
  });

  it("ranks a channel the owner already uses as an existing asset", async () => {
    const { owner, slug } = await ready("details-existing@example.com");
    const before = await owner.client.query(api.acquisition.view, { slug });
    const li = before!.channels.find((c) => /LinkedIn company page/i.test(c.name))!;
    await owner.client.mutation(api.acquisition.setChannelPreference, { slug, channelId: li.id, preference: "already_using", rationale: "The owner already uses this channel." });
    const after = await owner.client.query(api.acquisition.view, { slug });
    const li2 = after!.channels.find((c) => c.id === li.id)!;
    expect(li2.ownerPreference?.preference).toBe("already_using");
    expect(li2.score).toBeGreaterThanOrEqual(li.score);
  });
});
