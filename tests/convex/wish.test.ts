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
    expect(JSON.parse(run.input).brief).toContain("Dec 20");
    expect(run.status).toBe("verified");
    // Every card that started is internal-only.
    expect(cards.filter((c) => c!.runId).every((c) => !c!.externalEffect)).toBe(true);
  });
});
