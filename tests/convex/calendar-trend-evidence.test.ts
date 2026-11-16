import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { RATE_VERSIONS } from "../../shared/economics/rates";

const now = Date.parse("2026-11-16T08:00:00Z");
const sourceUrl = "https://research.example/process";
const evidence = { sourceUrl, observationDate: "2026-11-15", observation: "A creator reveals the result after showing each step." };
const research = { notes: `TREND SIGNAL 1\nSource URL: ${sourceUrl}\nObserved date: ${evidence.observationDate}\nObserved signal: ${evidence.observation}`, sources: [{ url: sourceUrl }], retrievedAt: now - 1000 };
const calendar = () => ({ weekTheme: "Explain the work", pillars: [], learningsApplied: [], slots: [{ channel: "linkedin", day: 1, pillar: "Explain", purpose: "teach", format: "text", idea: "Adapt a current meme to explain the process", angle: "Make hidden work visible", hookDraft: "Before the result", proof: "Source observation only", callToAction: "Compare your process", needsOwner: true, ownerNote: "Fit to this business is a hypothesis.", trendSourceUrl: sourceUrl, trendEvidence: { ...evidence } }] });
async function seed() {
  const t = setup(); const owner = await asNewUser(t, "calendar-evidence@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Calendar evidence" });
  const runId = await t.run(async ctx => {
    await ctx.db.insert("autopilotSettings", { orgId, enabled: false, mode: "always_ask", channels: [{ channel: "linkedin", postsPerWeek: 1 }], postingHours: [12], alwaysAskTopics: [], imagesPerWeek: 0, trust: [], updatedBy: owner.userId, createdAt: now, updatedAt: now });
    return ctx.db.insert("workflowRuns", { orgId, kind: "social_calendar", title: "Synthetic calendar preview", status: "executing", input: JSON.stringify({ preview: true }), engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 10, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdBy: owner.userId, createdAt: now, updatedAt: now });
  });
  return { t, owner, orgId, slug, runId };
}

describe("calendar source persistence and draft context", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now); });
  afterEach(() => vi.useRealTimers());

  it("retains the engine retrieval date and exposes it without approving or drafting a preview", async () => {
    const { t, owner, orgId, slug, runId } = await seed();
    const plan = calendar();
    Object.assign(plan.slots[0].trendEvidence, { retrievedAt: now + 999999 });
    await t.mutation(internal.autopilot.saveWeekPlan, { runId, weekOf: "2026-11-16", fromDay: 1, plan, research });
    const slots = await t.run(ctx => ctx.db.query("calendarSlots").collect());
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ orgId, status: "planned", trendEvidence: { ...evidence, retrievedAt: research.retrievedAt } });
    const view = await owner.client.query(api.autopilot.get, { slug });
    expect(view.weeks[0].slots[0].trendEvidence).toEqual({ ...evidence, retrievedAt: research.retrievedAt });
    for (const table of ["artifacts", "approvals", "actionReceipts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("workflowRuns").collect())).toHaveLength(1);
    const other = await asNewUser(t, "other-calendar@example.com");
    await expect(other.client.query(api.autopilot.get, { slug })).rejects.toThrow();
  });

  it.each(["missing", "wrong_observation", "future_retrieval", "stale_at_posting"] as const)("rejects %s evidence atomically without replacing prior slots", async kind => {
    const { t, runId } = await seed();
    await t.mutation(internal.autopilot.saveWeekPlan, { runId, weekOf: "2026-11-16", fromDay: 1, plan: calendar(), research });
    const before = await t.run(ctx => ctx.db.query("calendarSlots").collect());
    const plan = calendar();
    if (kind === "wrong_observation") plan.slots[0].trendEvidence = { ...evidence, observation: "An unsupported claim about customers" };
    await expect(t.mutation(internal.autopilot.saveWeekPlan, { runId, weekOf: kind === "stale_at_posting" ? "2026-12-21" : "2026-11-16", fromDay: 1, plan, research: kind === "missing" ? undefined : { ...research, retrievedAt: kind === "future_retrieval" ? now + 1000 : research.retrievedAt } })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.query("calendarSlots").collect())).toEqual(before);
    expect(await t.run(ctx => ctx.db.query("weekPlans").collect())).toHaveLength(1);
  });

  it("binds the complete ordered drafting context to the run's tenant and channel", async () => {
    const { t, orgId, runId } = await seed();
    const draftId = await t.run(async ctx => {
      const original = (await ctx.db.get(runId))!;
      const { _id: _id, _creationTime: _creationTime, ...fields } = original;
      void _id; void _creationTime;
      const id = await ctx.db.insert("workflowRuns", { ...fields, kind: "content_social" });
      for (let i = 0; i < 6; i++) await ctx.db.insert("calendarSlots", { orgId, weekOf: "2026-11-16", day: i + 1, slotAt: now + i * 86400000, channel: "linkedin", pillar: "Explain", purpose: "teach", format: "text", idea: `Slot ${i + 1}: ${"Synthetic context. ".repeat(20)}`, angle: "Explain a workflow", hookDraft: "Before the result", callToAction: `Unique call ${i + 1}`, needsOwner: true, status: "drafting", draftRunId: id, trendEvidence: { ...evidence, retrievedAt: research.retrievedAt }, createdAt: now, updatedAt: now });
      return id;
    });
    const context = await t.query(internal.autopilot.draftingContext, { runId: draftId, channel: "linkedin" });
    expect(context?.count).toBe(6);
    expect(context!.brief.length).toBeGreaterThan(1500);
    expect(context?.brief).toContain("Unique call 6");
    expect(context?.brief).toContain("not fresh research or publication approval");
    expect(context?.trendSourceUrls).toEqual([sourceUrl]);
    await expect(t.query(internal.autopilot.draftingContext, { runId: draftId, channel: "facebook" })).rejects.toThrow();
    const other = await asNewUser(t, "bad-slot@example.com");
    const foreign = await other.client.mutation(api.orgs.createWorkspace, { businessName: "Foreign" });
    await t.run(async ctx => { const first = (await ctx.db.query("calendarSlots").collect())[0]; await ctx.db.patch(first._id, { orgId: foreign.orgId }); });
    await expect(t.query(internal.autopilot.draftingContext, { runId: draftId, channel: "linkedin" })).rejects.toThrow();
  });
});
