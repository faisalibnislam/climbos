import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

/**
 * "Say the word and things happen": a wish becomes action cards; safe
 * internal work (drafts) starts by itself with the owner's words as the brief,
 * and nothing external runs without approval.
 */
describe("wishes", () => {
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
    expect(JSON.parse(run.input).brief).toContain("Dec 20");
    expect(run.status).toBe("verified");
    // Every card that started is internal-only.
    expect(cards.filter((c) => c!.runId).every((c) => !c!.externalEffect)).toBe(true);
  });
});
