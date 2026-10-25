import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { asNewUser, setup } from "./helpers";

const profile = {
  archetypeId: "chief_growth_strategist",
  name: "Deal reviewer",
  objective: "Learn from each won deal.",
  instructions: "",
  allowedActions: ["research", "analyze_results", "note"],
  knowledge: ["growth_library" as const],
  permission: "read_only" as const,
  maxRunCredits: 10,
  monthlyBudgetCredits: 100,
  maxActionsPerRun: 2,
  successMetric: "Names one lesson with evidence.",
};

describe("event-triggered specialists", () => {
  it("validates events, starts once per cooldown after a won deal, and respects the workspace pause", async () => {
    const t = setup();
    const owner = await asNewUser(t, "events-owner@example.com");
    const { slug, orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Events Co" });
    await expect(owner.client.mutation(api.customAgents.create, { slug, ...profile, trigger: "event", triggerEvents: [] })).rejects.toThrow(/at least one supported event/);
    await expect(owner.client.mutation(api.customAgents.create, { slug, ...profile, trigger: "event", triggerEvents: ["chat.started"] })).rejects.toThrow(/at least one supported event/);
    await expect(owner.client.mutation(api.customAgents.create, { slug, ...profile, trigger: "event", triggerEvents: ["deal.won"], eventCooldownHours: 2 })).rejects.toThrow(/6 to 168 hours/);
    const { id } = await owner.client.mutation(api.customAgents.create, { slug, ...profile, trigger: "event", triggerEvents: ["deal.won"] });
    const listed = (await owner.client.query(api.customAgents.list, { slug })).agents.find((a) => a.id === id)!;
    expect(listed).toMatchObject({ trigger: "event", triggerEvents: ["deal.won"], eventCooldownHours: 24 });

    const agent = () => t.run(async (ctx) => ctx.db.get(id as Id<"customAgents">));
    const won = async (name: string) => {
      const dealId = await owner.client.mutation(api.crm.create, { slug, name, stage: "talking" });
      await owner.client.mutation(api.crm.update, { slug, id: dealId, stage: "won" });
    };
    // A lead created by hand is a different event: no run.
    await owner.client.mutation(api.crm.create, { slug, name: "Just a lead" });
    expect((await agent())?.lastEventRunAt).toBeUndefined();

    await won("First win");
    const first = (await agent())?.lastEventRunAt;
    expect(first).toEqual(expect.any(Number));
    const scheduled = await t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter((f) => f.name.includes("runScheduledCustomAgent")));
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].args[0]).toMatchObject({ triggerEvent: "deal.won" });

    // Within the cooldown, another win doesn't start a second run.
    await won("Second win");
    expect((await agent())?.lastEventRunAt).toBe(first);

    // With scheduled specialists paused, events start nothing.
    await t.run(async (ctx) => ctx.db.patch(id as Id<"customAgents">, { lastEventRunAt: undefined }));
    await owner.client.mutation(api.customAgents.setScheduledEnabled, { slug, enabled: false });
    await won("Third win");
    expect((await agent())?.lastEventRunAt).toBeUndefined();
    void orgId;
  });
});
