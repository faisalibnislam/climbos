import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

/**
 * "Say the word and things happen": a wish becomes action cards; safe
 * internal work (drafts) starts by itself with the owner's words as the brief,
 * and nothing external runs without approval.
 */
describe("wishes", () => {
  it("marks the Home approval count as a lower bound when more drafts exist than the bounded query returns", async () => {
    const t = setup();
    const u = await asNewUser(t, "wish-approval-count@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first())!;
      for (let index = 0; index < 21; index += 1) {
        await ctx.db.insert("artifacts", {
          orgId: org._id,
          businessId: business._id,
          kind: "social_post",
          channel: "instagram",
          title: `Draft ${index + 1}`,
          status: "in_review",
          currentVersion: 1,
          createdAt: Date.now() + index,
          updatedAt: Date.now() + index,
        });
      }
    });

    const today = await u.client.query(api.workspace.today, { slug });
    expect(today.approvalsCount).toBe(20);
    expect(today.approvalsCountIsLowerBound).toBe(true);
    expect(today.approvals).toHaveLength(6);
    expect(today.next.find((item) => item.kind === "approvals")?.title).toBe("Review 20+ drafts");
  });

  it("returns an exact approval count when the bounded list is complete", async () => {
    const t = setup();
    const u = await asNewUser(t, "wish-approval-count-exact@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    const today = await u.client.query(api.workspace.today, { slug });
    expect(today.approvalsCount).toBe(3);
    expect(today.approvalsCountIsLowerBound).toBe(false);
  });

  it("seeds a clearly fictional opportunity for the editable Growth Home question flow", async () => {
    const t = setup();
    const u = await asNewUser(t, "demo-opportunity@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    const today = await u.client.query(api.workspace.today, { slug });
    expect(today.requestCostEstimateMicros).toBe(0);
    expect(today.autoDraftBudgetMicros).toBe(0);
    expect(today.strategy?.opportunities).toMatchObject([
      {
        id: "demo_opportunity",
        title: "Demo opportunity",
        why: expect.stringMatching(/fictional example/i),
        nextStep: expect.stringMatching(/evidence would be needed/i),
      },
    ]);
  });

  it("does not let a dependent action start until its prerequisite is complete", async () => {
    const t = setup();
    const u = await asNewUser(t, "wish-dependency@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    const { parentId, childId } = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
      const now = Date.now();
      const makeNote = (title: string, dependsOnActionCardIds?: Id<"actionCards">[]) => ctx.db.insert("actionCards", {
        orgId: org._id,
        ...(dependsOnActionCardIds ? { dependsOnActionCardIds } : {}),
        title,
        description: title,
        proposedEffect: "A note for your team.",
        kind: "note",
        roles: ["coo"],
        payload: "{}",
        costEstimateMicros: 0,
        externalEffect: false,
        status: "proposed",
        priority: 1,
        createdAt: now,
        updatedAt: now,
      });
      const parentId = await makeNote("Research the market");
      const childId = await makeNote("Write the recommendation", [parentId]);
      return { parentId, childId };
    });

    await expect(u.client.mutation(api.workspace.runCard, { slug, cardId: childId })).rejects.toThrow(/complete.*first/i);
    await u.client.mutation(api.workspace.runCard, { slug, cardId: parentId });
    await u.client.mutation(api.workspace.runCard, { slug, cardId: childId });
    expect(await t.run(async (ctx) => (await ctx.db.get(childId))?.status)).toBe("done");
  });

  it("a wish starts drafting immediately and carries the owner's words", async () => {
    const t = setup();
    const u = await asNewUser(t, "wish@example.com", { anonymous: true });
    const { slug } = await u.client.mutation(api.demo.createDemoWorkspace, {});
    await t.finishAllScheduledFunctions(() => undefined);

    const wish = "Write Instagram posts about our holiday pre-order deadline on Dec 20 and our new email newsletter";
    await u.client.mutation(api.workspace.sendChat, { slug, text: wish });
    await t.finishAllScheduledFunctions(() => undefined);

    const { cards, reply, runs } = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
      const msgs = await ctx.db.query("chatMessages").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).collect();
      const reply = msgs.filter((m) => m.author === "climbos" && m.actionCardIds.length > 0).sort((a, b) => b.createdAt - a.createdAt)[0]!;
      const cards = await Promise.all(reply.actionCardIds.map((id) => ctx.db.get(id)));
      const runs = await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).collect();
      return { cards: cards.filter(Boolean), reply, runs };
    });
    expect(reply.understood).toMatch(/holiday pre-order/i);
    const social = cards.find((c) => c!.kind === "generate_content" && JSON.parse(c!.payload).channel === "instagram")!;
    expect(JSON.parse(social.payload).agentArchetypeId).toBe("social_media_marketing");
    expect(social.status === "running" || social.status === "done").toBe(true); // started by itself
    expect(JSON.parse(social.payload).brief).toContain("Dec 20");
    const run = runs.find((r) => r._id === social.runId)!;
    expect(run.agentArchetypeId).toBe("social_media_marketing");
    expect(await u.client.query(api.workspace.runDetail, { slug, runId: run._id })).toMatchObject({ canReportSpecialistOutcome: true });
    expect(run.agentArchetypeSnapshot).toMatchObject({
      version: 1,
      id: "social_media_marketing",
      successMeasures: {
        businessOutcome: expect.stringMatching(/qualified visits, leads, or purchases/i),
        guardrail: expect.stringMatching(/not customer or revenue growth/i),
      },
    });
    const context = await t.query(internal.jobWrites.jobContext, { runId: run._id });
    expect(context?.agentArchetype).toMatchObject({ id: "social_media_marketing", role: "social_media_manager", successMeasures: run.agentArchetypeSnapshot?.successMeasures });
    expect(context?.agentArchetypeFeedbackText).toBe("");
    expect(JSON.parse(run.input).brief).toContain("Dec 20");
    expect(run.status).toBe("verified");
    // Every card that started is internal-only.
    expect(cards.filter((c) => c!.runId).every((c) => !c!.externalEffect)).toBe(true);

    const outsider = await asNewUser(t, "wish-outsider@example.com", { anonymous: true });
    const { slug: outsiderSlug } = await outsider.client.mutation(api.demo.createDemoWorkspace, {});
    await expect(outsider.client.mutation(api.workspace.rateBuiltInAgentRun, { slug: outsiderSlug, runId: run._id, rating: "helpful" })).rejects.toThrow(/couldn't find/i);
    await expect(outsider.client.query(api.workspace.builtInAgentRunFeedback, { slug: outsiderSlug, runId: run._id })).rejects.toThrow(/couldn't find/i);
    await expect(outsider.client.mutation(api.workspace.reportBuiltInAgentOutcome, {
      slug: outsiderSlug, runId: run._id, metric: "qualified leads", measureType: "count", unit: "leads", value: 2,
      cohort: "Instagram campaign", periodStart: Date.now() - 14 * 86_400_000, periodEnd: Date.now() - 86_400_000,
    })).rejects.toThrow(/couldn't find/i);

    await u.client.mutation(api.workspace.rateBuiltInAgentRun, { slug, runId: run._id, rating: "needs_work", note: "It focused on impressions, not purchases. Contact me at owner@example.com" });
    expect(await u.client.query(api.workspace.builtInAgentRunFeedback, { slug, runId: run._id })).toMatchObject({ rating: "needs_work", note: "It focused on impressions, not purchases. Contact me at [email]" });
    expect((await t.query(internal.jobWrites.jobContext, { runId: run._id }))?.agentArchetypeFeedbackText).toBe(""); // Current runs keep their creation-time snapshot.

    const periodEnd = Date.now() - 86_400_000;
    const periodStart = periodEnd - 14 * 86_400_000;
    await expect(u.client.mutation(api.workspace.reportBuiltInAgentOutcome, {
      slug, runId: run._id, metric: "Qualified lead rate", measureType: "rate", unit: "fraction", value: 0.08,
      cohort: "New leads from the Instagram campaign", periodStart, periodEnd,
    })).rejects.toThrow(/denominator/i);
    await u.client.mutation(api.workspace.reportBuiltInAgentOutcome, {
      slug, runId: run._id, metric: "Qualified lead rate", measureType: "rate", unit: "fraction", value: 0.08, denominator: 50,
      comparisonValue: 0.04, comparisonDenominator: 50, comparisonLabel: "prior 14-day campaign", cohort: "New leads from the Instagram campaign", periodStart, periodEnd,
    });
    expect(await u.client.query(api.workspace.builtInAgentRunOutcomes, { slug, runId: run._id })).toMatchObject([
      { metric: "Qualified lead rate", measureType: "rate", value: 0.08, denominator: 50, comparisonValue: 0.04, comparisonDenominator: 50, comparisonLabel: "prior 14-day campaign", cohort: "New leads from the Instagram campaign", periodStart, periodEnd },
    ]);
    await expect(outsider.client.query(api.workspace.builtInAgentRunOutcomes, { slug: outsiderSlug, runId: run._id })).rejects.toThrow(/couldn't find/i);

    await u.client.mutation(api.workspace.sendChat, { slug, text: "Write another Instagram post about our pre-order deadline." });
    await t.finishAllScheduledFunctions(() => undefined);
    const nextRun = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
      return (await ctx.db.query("workflowRuns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").collect()).find((entry) => entry.agentArchetypeId === "social_media_marketing")!;
    });
    expect(nextRun.agentArchetypeFeedbackSnapshot).toMatchObject({ sampleSize: 1, helpful: 0, needsWork: 1, capped: false });
    expect(nextRun.agentArchetypeOutcomeSnapshot).toMatchObject({ source: "workspace_member_report", windowDays: 180, reports: [{ metric: "Qualified lead rate", value: 0.08, denominator: 50, comparisonValue: 0.04, comparisonDenominator: 50, comparisonLabel: "prior 14-day campaign" }] });
    expect((await t.query(internal.jobWrites.jobContext, { runId: nextRun._id }))?.agentArchetypeFeedbackText).toContain("It focused on impressions, not purchases.");
    expect((await t.query(internal.jobWrites.jobContext, { runId: nextRun._id }))?.agentArchetypeOutcomeText).toContain("8.00% (50 eligible)");
    expect((await t.query(internal.jobWrites.jobContext, { runId: nextRun._id }))?.agentArchetypeOutcomeText).toContain("not independently verified or causal evidence");
  });
});
