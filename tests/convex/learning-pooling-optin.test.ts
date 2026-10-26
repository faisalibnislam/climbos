import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

describe("cross-business learning is opt-in", () => {
  it("pools only workspaces whose owner opted in", async () => {
    const t = setup();
    const orgs: { orgId: Id<"organizations">; slug: string; client: Awaited<ReturnType<typeof asNewUser>>["client"] }[] = [];
    for (let i = 0; i < 10; i++) {
      const u = await asNewUser(t, `pool-optin${i}@example.com`);
      const { orgId, slug } = await u.client.mutation(api.orgs.createWorkspace, { businessName: `Pool ${i}` });
      orgs.push({ orgId: orgId as Id<"organizations">, slug, client: u.client });
      await t.run(async (ctx) => {
        const now = Date.now();
        await ctx.db.insert("landingPages", { orgId: orgId as Id<"organizations">, slug: `pool-${i}`, title: "Offer", brief: "Offer", status: "live", color: "#000000", views: 100, leads: 5 + i, createdAt: now, updatedAt: now });
      });
    }
    await t.action(internal.learning.recompute, {});
    await t.finishAllScheduledFunctions(() => undefined);
    const pooledRows = async () => t.run(async (ctx) => (await ctx.db.query("learnedRates").collect()).filter((row) => row.scope.startsWith("type:")));
    expect(await pooledRows()).toEqual([]);

    for (const o of orgs) await o.client.mutation(api.settings.setLearningPooling, { slug: o.slug, optedIn: true });
    expect(await orgs[0].client.query(api.settings.learningPooling, { slug: orgs[0].slug })).toMatchObject({ optedIn: true, canChange: true });
    await t.action(internal.learning.recompute, {});
    await t.finishAllScheduledFunctions(() => undefined);
    expect((await pooledRows()).length).toBeGreaterThan(0);

    const audit = await t.run(async (ctx) => (await ctx.db.query("auditEvents").withIndex("by_org_created", (q) => q.eq("orgId", orgs[0].orgId)).collect()).map((e) => e.action));
    expect(audit).toContain("privacy.learning_pooling_on");
  });
});

describe("experiment pre-registration", () => {
  it("locks variants, decision owner and cost once running, and appends deviations", async () => {
    const t = setup();
    const owner = await asNewUser(t, "prereg-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Prereg Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
    const experimentId = await t.run(async (ctx) => {
      const now = Date.now();
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).first())!;
      const goalId = (await ctx.db.query("goals").withIndex("by_org_status", (q) => q.eq("orgId", orgId as Id<"organizations">).eq("status", "active")).first())!._id;
      const strategyId = await ctx.db.insert("strategies", { orgId: orgId as Id<"organizations">, businessId: business._id, goalId, version: 1, status: "approved", summary: "s", audiences: [], positioning: "p", channels: [], constraints: [], measurementPlan: "m", reviewDate: "2026-11-01", sourceFactIds: [], generationCostMicros: 0, createdAt: now } as never);
      return ctx.db.insert("experiments", { orgId: orgId as Id<"organizations">, strategyId, name: "Evening slots", hypothesis: "Evening slots raise bookings.", population: "Website visitors", method: "pre_post_observational", primaryMetric: "Bookings", guardrails: [], durationDays: 28, stoppingRule: "Stop after 28 days.", status: "proposed", createdAt: now } as never);
    });
    const plan = { slug, experimentId, variants: [{ key: "A", description: "Current daytime-only schedule" }, { key: "B", description: "Add two evening slots" }], decisionOwner: "Sam (owner)", plannedCost: { cashMinor: 0, currency: "USD", ownerHours: 3, basis: "Owner estimate" } };
    await expect(owner.client.mutation(api.playResults.preregisterExperiment, { ...plan, variants: [plan.variants[0]] })).rejects.toThrow(/2 to 4 versions/);
    await expect(owner.client.mutation(api.playResults.logExperimentDeviation, { slug, experimentId, note: "Moved start date" })).rejects.toThrow(/hasn't started/);
    await owner.client.mutation(api.playResults.preregisterExperiment, plan);
    await t.run(async (ctx) => ctx.db.patch(experimentId, { status: "running" }));
    await expect(owner.client.mutation(api.playResults.preregisterExperiment, plan)).rejects.toThrow(/has started/);
    await owner.client.mutation(api.playResults.logExperimentDeviation, { slug, experimentId, note: "Started a week late because of a holiday." });
    const row = (await t.run(async (ctx) => ctx.db.get(experimentId)))!;
    expect(row).toMatchObject({ decisionOwner: "Sam (owner)", variants: plan.variants, plannedCost: { ownerHours: 3 }, deviations: [{ note: "Started a week late because of a holiday." }] });

    const other = await asNewUser(t, "prereg-other@example.com");
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    await expect(other.client.mutation(api.playResults.logExperimentDeviation, { slug: otherSlug, experimentId, note: "Not mine to change" })).rejects.toThrow();
  });
});
