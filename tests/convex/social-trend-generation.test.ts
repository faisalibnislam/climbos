import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { RATE_VERSIONS } from "../../shared/economics/rates";
import type { AgentInput } from "../../shared/agents/types";
import { currentTrendResearch, socialTrendFixture } from "../fixtures/socialTrend";
import { asNewUser, setup } from "./helpers";

const state = vi.hoisted(() => ({ reply: null as unknown, inputs: [] as AgentInput[] }));
vi.mock("../../shared/agents/runtime", async original => ({
  ...await original<typeof import("../../shared/agents/runtime")>(),
  runAgent: vi.fn(async (_spec: unknown, input: AgentInput) => { state.inputs.push(input); return state.reply; }),
}));
afterEach(() => { state.reply = null; state.inputs = []; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function workspace() {
  const t = setup(); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const network = vi.fn(() => { throw new Error("Unexpected network call"); }); vi.stubGlobal("fetch", network);
  const owner = await asNewUser(t, "social-trend-owner@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Synthetic studio" });
  await t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
    await ctx.db.insert("brandProfiles", { orgId, businessId: business._id, voice: "Plain", toneWords: [], colors: [], doNots: [], updatedAt: Date.now() });
  });
  await owner.client.mutation(api.brand.update, { slug, voice: "Dry and practical", toneWords: ["clever"], colors: [], doNots: ["No fabricated customers"], approvedExamples: ["Let the unanswered question do the talking."], socialHumor: "cheeky", socialTrendPolicy: "trend_aware" });
  const now = Date.now();
  const runId = await t.run(ctx => ctx.db.insert("workflowRuns", { orgId, kind: "content_social", title: "Synthetic trend validation", status: "executing", input: "{}", engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdBy: owner.userId, createdAt: now, updatedAt: now }));
  return { t, owner, orgId, slug, runId, network };
}

it.each(["missing", "unmatched", "uncited", "stale", "valid", "evergreen", "negative_only", "negative_and_current", "negative_with_bad_evidence"] as const)("validates %s trend evidence before saving generated posts despite a passing AI assessment", async kind => {
  const f = await workspace();
  const output = socialTrendFixture();
  const { evidence, research } = currentTrendResearch();
  if (kind !== "evergreen") output.posts[0].firstComment = "Try this current viral format for the next project review.";
  if (["valid", "unmatched", "uncited", "stale"].includes(kind)) {
    output.posts[0].trendSourceUrl = evidence.sourceUrl;
    output.posts[0].trendEvidence = { ...evidence, ...(kind === "unmatched" ? { observation: "An invented customer reaction" } : {}) };
  }
  if (kind.startsWith("negative_")) {
    output.posts[0].firstComment = "Don't chase viral trends. Explain the customer's actual problem.";
    output.posts[0].visualBrief = "No viral gimmicks. Use an original diagram.";
    if (kind === "negative_and_current") output.posts[0].videoScript = "Adapt this current meme to show the process.";
    if (kind === "negative_with_bad_evidence") output.posts[0].trendEvidence = evidence;
  }
  if (kind === "uncited") research.sources = [];
  if (kind === "stale") {
    const oldDate = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
    research.notes = research.notes.replace(evidence.observationDate, oldDate);
    output.posts[0].trendEvidence!.observationDate = oldDate;
  }
  state.reply = { output, assessment: { ship: true, gatesPassed: true, average: 5, minimum: 5, lint: [], critique: { gates: [], criteria: [], fixes: [], strengths: [] } }, rounds: 1, history: [], research: kind === "evergreen" ? null : research };
  await f.t.action(internal.jobs.createContent, { runId: f.runId, job: "content_social", channel: "linkedin", quantity: 1, images: 0 });
  const run = await f.t.run(ctx => ctx.db.get(f.runId));
  const artifacts = await f.t.run(ctx => ctx.db.query("artifacts").collect());
  const good = kind === "valid" || kind === "evergreen" || kind === "negative_only";
  expect(run?.status).toBe(good ? "verified" : "failed");
  expect(artifacts).toHaveLength(good ? 1 : 0);
  if (good) expect(artifacts[0]).toMatchObject({ orgId: f.orgId, status: "in_review" });
  else expect(run?.userMessage).toContain("trend");
  expect(state.inputs).toHaveLength(1);
  expect(state.inputs[0].brief).toContain("Dry and practical");
  expect(state.inputs[0].brief).toContain("humor=cheeky; trend use=trend_aware");
  expect(state.inputs[0].ownerApprovedExamples).toEqual(["Let the unanswered question do the talking."]);
  expect(f.network).not.toHaveBeenCalled();
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
  const approvals = await f.t.run(ctx => ctx.db.query("approvals").collect());
  expect(approvals.every(row => row.status === "pending")).toBe(true);
  if (!good) expect(approvals).toEqual([]);
});

it.each([true, false])("the primary writer respects voice-learning consent (%s)", async enabled => {
  const f = await workspace();
  await f.t.run(async ctx => {
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", f.orgId)).first())!;
    const brand = (await ctx.db.query("brandProfiles").withIndex("by_business", q => q.eq("businessId", business._id)).first())!;
    await ctx.db.patch(brand._id, { voiceLearningEnabled: enabled, learnedRules: [{ text: "LEARNED_STYLE_MARKER", at: Date.now() }] });
  });
  state.reply = { output: socialTrendFixture(), assessment: { ship: true, gatesPassed: true, average: 5, minimum: 5, lint: [], critique: { gates: [], criteria: [], fixes: [], strengths: [] } }, rounds: 1, history: [], research: null };
  await f.t.action(internal.jobs.createContent, { runId: f.runId, job: "content_social", channel: "linkedin", quantity: 1, images: 0 });
  expect(state.inputs).toHaveLength(1);
  expect(state.inputs[0].brief.includes("LEARNED_STYLE_MARKER")).toBe(enabled);
  expect(state.inputs[0].brief).toContain("No fabricated customers");
  expect(state.inputs[0].brief).toContain("OWNER-APPROVED COPY EXAMPLES");
  if (enabled) expect(state.inputs[0].brief).toContain("not owner-authored rules or verified facts");
  expect(f.network).not.toHaveBeenCalled();
  expect(await f.t.run(ctx => ctx.db.query("actionReceipts").collect())).toEqual([]);
});

it("carries the same owner voice and examples into weekly planning without granting publishing authority", async () => {
  const f = await workspace();
  const now = Date.now();
  const date = new Date(now); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  const weekOf = date.toISOString().slice(0, 10);
  await f.t.run(async ctx => {
    await ctx.db.patch(f.runId, { kind: "social_calendar", input: JSON.stringify({ preview: true }) });
    await ctx.db.insert("autopilotSettings", { orgId: f.orgId, enabled: false, mode: "always_ask", channels: [{ channel: "linkedin", postsPerWeek: 1 }], postingHours: [12], alwaysAskTopics: [], imagesPerWeek: 0, trust: [], updatedBy: f.owner.userId, createdAt: now, updatedAt: now });
  });
  state.reply = { output: { weekTheme: "Explain the review", pillars: [], learningsApplied: [], slots: [{ channel: "linkedin", day: 7, pillar: "Explain", purpose: "teach", format: "text", idea: "Review the missing brief", angle: "A clearer first conversation", hookDraft: "What is missing?", proof: "No customer outcomes supplied", callToAction: "Review an actual request", needsOwner: true, ownerNote: "Check that the process fits" }] }, assessment: null, rounds: 1, history: [], research: null };
  await f.t.action(internal.jobs.planSocialWeek, { runId: f.runId, weekOf, fromDay: 1 });
  expect((await f.t.run(ctx => ctx.db.get(f.runId)))?.status).toBe("verified");
  expect(state.inputs[0].brief).toContain("humor=cheeky; trend use=trend_aware");
  expect(state.inputs[0].brief).toContain("Dry and practical");
  expect(state.inputs[0].ownerApprovedExamples).toEqual(["Let the unanswered question do the talking."]);
  expect((await f.t.run(ctx => ctx.db.query("calendarSlots").collect()))[0]).toMatchObject({ orgId: f.orgId, status: "planned", needsOwner: true });
  for (const table of ["artifacts", "approvals", "actionReceipts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  expect(await f.t.run(ctx => ctx.db.query("workflowRuns").collect())).toHaveLength(1);
  expect(f.network).not.toHaveBeenCalled();
});
