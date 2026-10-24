import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

const profile = {
  archetypeId: "chief_growth_strategist",
  name: "Careful growth lead",
  objective: "Find one measurable way to improve customer growth.",
  instructions: "Use short sentences and identify unknowns.",
  allowedActions: ["research", "analyze_results", "note"],
  knowledge: ["growth_library" as const],
  permission: "read_only" as const,
  maxRunCredits: 10,
  maxActionsPerRun: 2,
  successMetric: "The recommendation includes evidence and a measurable next step.",
};

describe("custom specialist profiles", () => {
  it("exposes 30 reusable roles and rejects capabilities outside a profile's permission", async () => {
    const t = setup();
    const owner = await asNewUser(t, "specialist@example.com", { anonymous: true });
    const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
    const library = await owner.client.query(api.customAgents.list, { slug });
    expect(library.archetypes).toHaveLength(30);

    await expect(owner.client.mutation(api.customAgents.create, {
      slug,
      ...profile,
      allowedActions: ["research", "generate_content"],
    })).rejects.toThrow(/permission level/);

    const { id } = await owner.client.mutation(api.customAgents.create, { slug, ...profile });
    const saved = await owner.client.query(api.customAgents.list, { slug });
    expect(saved.agents).toContainEqual(expect.objectContaining({ id, name: profile.name, maxRunCredits: 10, trigger: "manual", modelRouting: "automatic", status: "active" }));
  });

  it("binds runs to their tenant and records manual specialist identity", async () => {
    const t = setup();
    const alice = await asNewUser(t, "specialist-alice@example.com", { anonymous: true });
    const bob = await asNewUser(t, "specialist-bob@example.com", { anonymous: true });
    const aliceWorkspace = await alice.client.mutation(api.demo.createDemoWorkspace, {});
    const bobWorkspace = await bob.client.mutation(api.demo.createDemoWorkspace, {});
    const { id } = await alice.client.mutation(api.customAgents.create, { slug: aliceWorkspace.slug, ...profile });

    await expect(bob.client.mutation(api.workspace.runCustomAgent, { slug: bobWorkspace.slug, agentId: id, request: "Review our growth plan." })).rejects.toThrow(/couldn't find/);
    const { messageId } = await alice.client.mutation(api.workspace.runCustomAgent, { slug: aliceWorkspace.slug, agentId: id, request: "Write an Instagram post and refresh the growth plan." });
    const message = await t.run((ctx) => ctx.db.get(messageId));
    expect(message).toMatchObject({ customAgentId: id, status: "thinking", text: "Write an Instagram post and refresh the growth plan." });
    await t.finishAllScheduledFunctions(() => undefined);
    const result = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", aliceWorkspace.slug)).unique())!;
      const messages = await ctx.db.query("chatMessages").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).collect();
      return messages.find((row) => row.author === "climbos" && row.replyTo === messageId)!;
    });
    expect(result.actionCardIds).toEqual([]);
    expect(result.text).toContain("outside the configured capabilities");
  });

  it("blocks actions that exceed a specialist's projected per-run budget", async () => {
    const t = setup();
    const owner = await asNewUser(t, "budgeted-specialist@example.com", { anonymous: true });
    const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
    const { id } = await owner.client.mutation(api.customAgents.create, {
      slug,
      ...profile,
      permission: "draft",
      allowedActions: ["refresh_plan"],
      maxRunCredits: 1,
      maxActionsPerRun: 1,
    });
    const { messageId } = await owner.client.mutation(api.workspace.runCustomAgent, { slug, agentId: id, request: "Refresh my growth strategy plan." });
    await t.finishAllScheduledFunctions(() => undefined);
    const card = await t.run(async (ctx) => {
      const reply = (await ctx.db.query("chatMessages").collect()).find((row) => row.author === "climbos" && row.replyTo === messageId);
      return reply?.actionCardIds.length ? await ctx.db.get(reply.actionCardIds[0]) : null;
    });
    expect(card?.status).toBe("blocked");
    expect(card?.blockedReason).toContain("per-run budget");
  });
});
