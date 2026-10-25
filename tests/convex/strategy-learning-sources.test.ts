import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { creativeStrategyLearningBrief } from "../../convex/creativeStrategy";
import { asNewUser, makePaid, setup } from "./helpers";

describe("owner control over strategy learning", () => {
  beforeEach(() => { process.env.CLIMBOS_ENGINE = "v2"; process.env.CLIMBOS_FAKE_LLM = "ship"; });
  afterEach(() => { delete process.env.CLIMBOS_ENGINE; delete process.env.CLIMBOS_FAKE_LLM; });

  it("lists feedback, lets editors retire and restore it, and expires old items, within the workspace", async () => {
    const t = setup();
    const owner = await asNewUser(t, "learning-owner@example.com");
    const viewer = await asNewUser(t, "learning-viewer@example.com");
    const other = await asNewUser(t, "learning-other@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Learning Co" });
    const { slug: otherSlug } = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Other Co" });
    await owner.client.mutation(api.orgs.setGoal, { slug, kind: "more_customers", statement: "More customers", horizonDays: 90, monthlyAdBudget: 0 });
    await makePaid(t, orgId as Id<"organizations">);
    await t.run(async (ctx) => ctx.db.insert("memberships", { orgId: orgId as Id<"organizations">, userId: viewer.userId, role: "viewer", status: "active", createdAt: Date.now() }));
    await owner.client.mutation(api.orgs.generatePlan, { slug, creativeRange: "surprising" });
    await t.finishAllScheduledFunctions(() => undefined);
    const strategy = (await t.run(async (ctx) => ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId as Id<"organizations">)).order("desc").first()))!;

    await owner.client.mutation(api.creativeStrategy.recordFeedback, { slug, strategyId: strategy._id, mode: "bold", decision: "rejected", testState: "not_started", outcomeEvidence: "unknown" });
    let sources = await owner.client.query(api.creativeStrategy.learningSources, { slug });
    expect(sources.feedback).toHaveLength(1);
    expect(sources.feedback[0]).toMatchObject({ mode: "bold", decision: "rejected", retired: false, used: true });
    expect(await t.run(async (ctx) => creativeStrategyLearningBrief(ctx, orgId as Id<"organizations">))).toContain("bold option");

    const feedbackId = sources.feedback[0].id;
    await expect(viewer.client.mutation(api.creativeStrategy.setFeedbackRetired, { slug, feedbackId, retired: true })).rejects.toThrow(/can't/i);
    await expect(other.client.mutation(api.creativeStrategy.setFeedbackRetired, { slug: otherSlug, feedbackId, retired: true })).rejects.toThrow();
    await owner.client.mutation(api.creativeStrategy.setFeedbackRetired, { slug, feedbackId, retired: true });
    sources = await owner.client.query(api.creativeStrategy.learningSources, { slug });
    expect(sources.feedback[0]).toMatchObject({ retired: true, used: false });
    expect(await t.run(async (ctx) => creativeStrategyLearningBrief(ctx, orgId as Id<"organizations">))).not.toContain("bold option");

    await owner.client.mutation(api.creativeStrategy.setFeedbackRetired, { slug, feedbackId, retired: false });
    // Older than a year: kept in the list but no longer used.
    await t.run(async (ctx) => ctx.db.patch(feedbackId, { createdAt: Date.now() - 400 * 86_400_000 }));
    sources = await owner.client.query(api.creativeStrategy.learningSources, { slug });
    expect(sources.feedback[0]).toMatchObject({ retired: false, used: false });
    expect(await t.run(async (ctx) => creativeStrategyLearningBrief(ctx, orgId as Id<"organizations">))).not.toContain("bold option");
    expect((await other.client.query(api.creativeStrategy.learningSources, { slug: otherSlug })).feedback).toEqual([]);
  });
});
