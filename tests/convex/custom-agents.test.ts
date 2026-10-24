import { describe, expect, it } from "vitest";
import { api, internal } from "../../convex/_generated/api";
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
  monthlyBudgetCredits: 100,
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
    expect(saved.agents).toContainEqual(expect.objectContaining({ id, name: profile.name, maxRunCredits: 10, monthlyBudgetCredits: 100, trigger: "manual", modelRouting: "automatic", status: "active" }));
  });

  it("supplies a bounded monthly budget when older settings clients omit the new field", async () => {
    const t = setup();
    const owner = await asNewUser(t, "legacy-settings-specialist@example.com", { anonymous: true });
    const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
    const { monthlyBudgetCredits: _monthlyBudgetCredits, ...legacyProfile } = profile;
    const { id } = await owner.client.mutation(api.customAgents.create, { slug, ...legacyProfile });

    const saved = await owner.client.query(api.customAgents.list, { slug });
    expect(saved.agents.find((agent) => agent.id === id)?.monthlyBudgetCredits).toBe(100);
  });

  it("schedules daily profiles and preserves their trigger when older clients edit settings", async () => {
    const t = setup();
    const owner = await asNewUser(t, "scheduled-specialist@example.com", { anonymous: true });
    const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
    const now = Date.now();
    const { id } = await owner.client.mutation(api.customAgents.create, { slug, ...profile, trigger: "daily" });

    let saved = await owner.client.query(api.customAgents.list, { slug });
    expect(saved.agents.find((agent) => agent.id === id)).toMatchObject({ trigger: "daily", nextTriggerAt: expect.any(Number) });
    expect(saved.agents.find((agent) => agent.id === id)!.nextTriggerAt).toBeGreaterThan(now);

    await owner.client.mutation(api.customAgents.update, { slug, agentId: id, ...profile, name: "Updated by older settings" });
    saved = await owner.client.query(api.customAgents.list, { slug });
    expect(saved.agents.find((agent) => agent.id === id)).toMatchObject({ trigger: "daily", name: "Updated by older settings", nextTriggerAt: expect.any(Number) });
  });

  it("claims due profiles once and advances their next run before dispatch", async () => {
    const t = setup();
    const owner = await asNewUser(t, "claim-scheduled-specialist@example.com", { anonymous: true });
    const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
    const { id } = await owner.client.mutation(api.customAgents.create, { slug, ...profile, trigger: "daily" });
    const now = Date.now();
    await t.run(async (ctx) => { await ctx.db.patch(id, { nextTriggerAt: now - 1 }); });

    expect(await t.query(internal.customAgents.dueAgentIds, { now })).toEqual([id]);
    expect(await t.mutation(internal.customAgents.claimDueAgent, { agentId: id, now })).toEqual({ agentId: id });
    expect(await t.mutation(internal.customAgents.claimDueAgent, { agentId: id, now })).toBeNull();
    expect(await t.query(internal.customAgents.dueAgentIds, { now })).toEqual([]);
  });

  it("does not start scheduled work for demo workspaces", async () => {
    const t = setup();
    const owner = await asNewUser(t, "demo-scheduled-specialist@example.com", { anonymous: true });
    const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
    const { id } = await owner.client.mutation(api.customAgents.create, { slug, ...profile, trigger: "daily" });
    const result = await t.mutation(internal.workspace.runScheduledCustomAgent, { agentId: id });
    expect(result).toEqual({ started: false, reason: "workspace_unavailable" });
  });

  it("removes exact duplicate confirmed facts from agent context but keeps their source records", async () => {
    const t = setup();
    const owner = await asNewUser(t, "deduplicated-facts@example.com", { anonymous: true });
    const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
    const { businessId, orgId } = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
      const business = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first())!;
      const now = Date.now();
      const sourceBase = { orgId: org._id, businessId: business._id, kind: "owner_text" as const, status: "ok" as const, fetchedAt: now, expiresAt: now + 30 * 86_400_000 };
      const olderSource = await ctx.db.insert("factSources", { ...sourceBase, title: "Owner report, original", excerpt: "Our product has 10 paid customers." });
      const newerSource = await ctx.db.insert("factSources", { ...sourceBase, title: "Owner report, corrected wording", excerpt: " OUR PRODUCT HAS 10 PAID CUSTOMERS! " });
      const base = { orgId: org._id, businessId: business._id, category: "product" as const, confidence: "high" as const, reviewState: "confirmed" as const, provenance: "owner_supplied" as const, createdAt: now - 10_000 };
      await ctx.db.insert("businessFacts", { ...base, sourceIds: [olderSource], statement: "Our product has 10 paid customers.", updatedAt: now - 5_000 });
      await ctx.db.insert("businessFacts", { ...base, sourceIds: [newerSource], statement: " OUR PRODUCT HAS 10 PAID CUSTOMERS! ", updatedAt: now });
      await ctx.db.insert("businessFacts", { ...base, category: "pricing", sourceIds: [], statement: "Our Pro plan is $20 per month.", updatedAt: Date.now() - 61 * 86_400_000 });
      return { businessId: business._id, orgId: org._id };
    });
    const { id } = await owner.client.mutation(api.customAgents.create, { slug, ...profile });
    const { messageId } = await owner.client.mutation(api.workspace.runCustomAgent, { slug, agentId: id, request: "Review the business facts." });
    const runId = await t.run(async (ctx) => (await ctx.db.get(messageId))?.runId ?? null);
    if (!runId) throw new Error("Expected workflow run");

    const context = await t.query(internal.jobWrites.jobContext, { runId });
    const matching = context?.facts.filter((fact) => fact.category === "product" && /10 paid customers/i.test(fact.statement)) ?? [];
    expect(matching).toHaveLength(1);
    expect(matching[0]?.statement).toBe(" OUR PRODUCT HAS 10 PAID CUSTOMERS! ");
    expect(context?.facts.find((fact) => fact.category === "pricing" && /Pro plan/.test(fact.statement))).toBeUndefined();
    expect(context?.staleFacts.find((fact) => fact.category === "pricing" && /Pro plan/.test(fact.statement))?.freshness).toMatchObject({ reviewSuggested: true, daysOld: 61 });
    const stored = await t.run(async (ctx) => (await ctx.db.query("businessFacts").withIndex("by_business", (q) => q.eq("businessId", businessId)).collect()).filter((fact) => /10 paid customers/i.test(fact.statement)));
    expect(stored).toHaveLength(2);
    expect(stored.every((fact) => fact.orgId === orgId)).toBe(true);
    expect(stored.flatMap((fact) => fact.sourceIds)).toHaveLength(2);
    expect(await t.run(async (ctx) => (await ctx.db.query("factSources").withIndex("by_business", (q) => q.eq("businessId", businessId)).collect()).filter((source) => /Owner report/.test(source.title ?? "")))).toHaveLength(2);
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
    if (!message) throw new Error("Expected custom specialist request message");
    if (!message.runId) throw new Error("Expected custom specialist workflow run");
    const runContext = await t.query(internal.jobWrites.jobContext, { runId: message.runId });
    expect(runContext?.specialist).toMatchObject({ archetypeId: profile.archetypeId, objective: profile.objective, instructions: profile.instructions, allowedActions: profile.allowedActions });
    expect(runContext?.specialistFeedbackText).toBe("");
    await alice.client.mutation(api.customAgents.update, { slug: aliceWorkspace.slug, agentId: id, ...profile, name: "Changed while running", permission: "draft", allowedActions: ["generate_content", "refresh_plan"] });
    await t.finishAllScheduledFunctions(() => undefined);
    const result = await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", aliceWorkspace.slug)).unique())!;
      const messages = await ctx.db.query("chatMessages").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).collect();
      return messages.find((row) => row.author === "climbos" && row.replyTo === messageId)!;
    });
    expect(result.actionCardIds).toEqual([]);
    expect(result.text).toContain(profile.name);
    expect(result.text).toContain("outside the configured capabilities");
    expect(message.runId).toBeTruthy();
    await alice.client.mutation(api.workspace.rateCustomAgentRun, { slug: aliceWorkspace.slug, runId: message.runId!, rating: "needs_work", note: "That request was outside the profile's research scope." });
    const originalRunContext = await t.query(internal.jobWrites.jobContext, { runId: message.runId! });
    expect(originalRunContext?.specialistFeedbackText).toBe(""); // Later ratings don't rewrite the inputs to a completed run.
    const profileView = await alice.client.query(api.customAgents.list, { slug: aliceWorkspace.slug });
    expect(profileView.agents[0]?.recentRuns[0]).toMatchObject({ id: message.runId, rating: "needs_work", feedbackNote: "That request was outside the profile's research scope." });
    expect(profileView.agents[0]?.workspaceReportedFeedback).toMatchObject({ source: "workspace_member_report", windowDays: 90, sampleSize: 1, helpful: 0, needsWork: 1, capped: false });
    await alice.client.mutation(api.workspace.rateCustomAgentRun, { slug: aliceWorkspace.slug, runId: message.runId, rating: "helpful", note: "The research checklist was useful." });
    await t.run(async (ctx) => {
      const rating = await ctx.db.query("customAgentFeedback").withIndex("by_run_user", (q) => q.eq("workflowRunId", message.runId!).eq("userId", alice.userId)).unique();
      if (rating) await ctx.db.patch(rating._id, { createdAt: Date.now() - 100 * 86_400_000, updatedAt: Date.now() });
    });
    const revisedView = await alice.client.query(api.customAgents.list, { slug: aliceWorkspace.slug });
    expect(revisedView.agents[0]?.workspaceReportedFeedback).toMatchObject({ sampleSize: 1, helpful: 1, needsWork: 0 });
    const { messageId: nextMessageId } = await alice.client.mutation(api.workspace.runCustomAgent, { slug: aliceWorkspace.slug, agentId: id, request: "Review this week's customer research." });
    const nextMessage = await t.run((ctx) => ctx.db.get(nextMessageId));
    expect(nextMessage?.runId).toBeTruthy();
    const nextRunContext = await t.query(internal.jobWrites.jobContext, { runId: nextMessage!.runId! });
    expect(nextRunContext?.specialistFeedbackText).toContain("1 helpful, 0 needs work");
    expect(nextRunContext?.specialistFeedbackText).toContain("The research checklist was useful.");
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

  it("enforces monthly caps against completed usage before reserving another run", async () => {
    const t = setup();
    const owner = await asNewUser(t, "monthly-budget-specialist@example.com", { anonymous: true });
    const { slug } = await owner.client.mutation(api.demo.createDemoWorkspace, {});
    const { id } = await owner.client.mutation(api.customAgents.create, { slug, ...profile, maxRunCredits: 10, monthlyBudgetCredits: 10 });
    await t.run(async (ctx) => {
      const org = (await ctx.db.query("organizations").withIndex("by_slug", (q) => q.eq("slug", slug)).unique())!;
      const now = Date.now();
      const prior = {
        orgId: org._id,
        customAgentId: id,
        kind: "climb_chat",
        title: "Prior specialist request",
        status: "verified" as const,
        input: "{}",
        roles: [],
        estimateMicros: 5_000_000,
        actualMicros: 5_000_000,
        rateVersionId: "verified-2026-10-17",
        entitlementVersionId: "ent-credits-2026-10-18",
        routingVersionId: "r1",
        budget: { modelSteps: 1, researchTools: 0, repairs: 0 },
        used: { modelSteps: 1, researchTools: 0, repairs: 0 },
        isFixture: true,
        createdAt: now,
        updatedAt: now,
      };
      await ctx.db.insert("workflowRuns", prior);
      await ctx.db.insert("workflowRuns", { ...prior, status: "paused", estimateMicros: 5_000_000, actualMicros: 0, createdAt: now + 1, updatedAt: now + 1 });
    });

    await expect(owner.client.mutation(api.workspace.runCustomAgent, { slug, agentId: id, request: "Draft one new campaign idea." })).rejects.toThrow(/monthly budget/);
  });
});
