import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { RATE_VERSIONS } from "../../shared/economics/rates";
import type { AgentInput } from "../../shared/agents/types";

const captured = vi.hoisted(() => ({ inputs: [] as AgentInput[], reply: null as unknown }));
vi.mock("../../shared/agents/runtime", async (original) => ({
  ...await original<typeof import("../../shared/agents/runtime")>(),
  // Inspect the actual job's generation input without a paid model or provider call.
  runAgent: vi.fn(async (_spec: unknown, input: AgentInput) => {
    captured.inputs.push(input);
    if (captured.reply) return captured.reply;
    throw new Error("Test stopped at generation boundary");
  }),
}));

const research = {
  audiences: [], competitors: [], positioning: "Research proposal, not an approved offer", pricingNotes: "Unknown",
  swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] }, journey: [], opportunities: [],
  alternatives: [], gaps: [],
  vocPhrases: [{ phrase: "I keep chasing the missing brief", theme: "handoff", sourceUrl: "https://research.example/interview" }],
  objections: [{ objection: "Migrating our workflow is hard", force: "anxiety", counter: "Test a small migration", sourceUrl: "https://research.example/interview" }],
  positioningStatement: "A clearer handoff for small studios",
  confidenceNotes: "One reported conversation; customer identity and prevalence unknown",
  siteAssessment: [{ dimension: "offer_clarity", observation: "The page describes intake", evidenceQuote: "Collect a client brief", sourceUrl: "https://business.example/", implication: "Test whether the wording answers the buying question" }],
};

describe("persisted research in generation context", () => {
  afterEach(() => { captured.inputs.length = 0; captured.reply = null; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("carries actual research-phase page evidence through onboarding into the saved phrase bank", async () => {
    const t = setup();
    vi.stubEnv("CLIMBOS_FAKE_LLM", "");
    const network = vi.fn(() => { throw new Error("Unexpected network call"); });
    vi.stubGlobal("fetch", network);
    const owner = await asNewUser(t, "insights-page-evidence@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Research context", website: "https://business.example/" });
    const now = Date.now();
    const runId = await t.run(async ctx => {
      const runId = await ctx.db.insert("workflowRuns", { orgId, kind: "onboarding_research", title: "Source evidence", status: "executing", input: "{}", engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 10, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now });
      const profile = { name: "Research context", oneLineSummary: "Client brief tool", businessType: "saas", audience: "Small studios", category: "Intake tools", facts: [], brandVoice: "Clear", suggestedSuccessEvents: [] };
      for (const [index, output] of [[0, [{ url: "https://business.example/", status: "ok", text: "Collect a client brief" }]], [1, profile], [300, {}]] as const) {
        await ctx.db.insert("workflowSteps", { orgId, runId, index, kind: index === 0 ? "research" : "model", label: "Synthetic completed checkpoint", status: "succeeded", idempotencyKey: `${orgId}:${runId}:s${index}`, attempt: 1, costMicros: 0, output: JSON.stringify(output) });
      }
      return runId;
    });
    const readAt = now - 5000;
    captured.reply = { output: research, assessment: null, rounds: 1, history: [], research: { notes: "Synthetic research note", sources: [{ url: research.vocPhrases[0].sourceUrl }], retrievedAt: now, pageReads: [{ url: research.vocPhrases[0].sourceUrl, text: research.vocPhrases[0].phrase, retrievedAt: readAt }] } };
    await t.action(internal.jobs.onboardingResearch, { runId });
    expect((await t.run(ctx => ctx.db.get(runId)))?.status).toBe("verified");
    const saved = await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first());
    expect(saved?.insights?.expert?.vocPhrases).toEqual([{ ...research.vocPhrases[0], evidenceStatus: "text_matched", sourceReadAt: readAt }]);
    expect(network).not.toHaveBeenCalled();
    for (const table of ["approvals", "actionReceipts", "artifacts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it.each([
    ["content_social", "focused"], ["content_ads", "focused"], ["content_email", "focused"],
    ["strategy", "focused"], ["strategy", "starter"],
  ] as const)("passes saved research to %s (%s) without authorizing actions", async (kind, planStyle) => {
    const t = setup();
    vi.stubEnv("CLIMBOS_FAKE_LLM", "");
    const owner = await asNewUser(t, `research-${kind}@example.com`);
    const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Research context", website: "https://business.example/" });
    if (kind === "strategy") {
      for (const author of ["Private Alice", "Private Bob"]) {
        await owner.client.mutation(api.reviews.addReview, { slug, author, text: `${author}: setup is confusing; private@example.com`, source: "google" });
        await owner.client.mutation(api.reviews.addReview, { slug, author, text: "Friendly service DISMISSED EXAMPLE", source: "google" });
      }
      await owner.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "onboarding", status: "corrected", correctedLabel: "Reliability", note: "Owner interpretation: investigate recurring errors first." });
      await owner.client.mutation(api.reviews.setVoiceThemeFeedback, { slug, themeKey: "service", status: "dismissed", note: "DISMISSED PRIVATE NOTE" });
    }
    const { businessId, runId } = await t.run(async ctx => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
      const runId = await ctx.db.insert("workflowRuns", { orgId, kind, title: "Research context check", status: "proposed", input: JSON.stringify({ planStyle }), engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: Date.now(), updatedAt: Date.now() });
      return { businessId: business._id, runId };
    });
    const candidates = [
      ...research.vocPhrases,
      { ...research.vocPhrases[0], phrase: "Invented customer praise", evidenceStatus: "text_matched", sourceReadAt: Date.now() },
      { ...research.vocPhrases[0], phrase: "The business markets itself", sourceUrl: "https://business.example/" },
      { ...research.vocPhrases[0], phrase: "Search-only unsupported words", sourceUrl: "https://unread.example/" },
    ];
    const readAt = Date.now() - 1000;
    await t.mutation(internal.jobWrites.saveInsights, { runId, businessId, insights: JSON.stringify({ ...research, vocPhrases: candidates }), pageReads: [{ url: research.vocPhrases[0].sourceUrl, text: research.vocPhrases[0].phrase, retrievedAt: readAt }] });
    const saved = (await t.run(ctx => ctx.db.get(businessId)))!.insights!.expert!;
    expect(saved.vocReview).toEqual({ candidateCount: 4, matchedCount: 1, notMatchedCount: 1, uncheckedCount: 1, businessSiteCount: 1 });
    expect(saved.vocPhrases).toEqual([{ ...research.vocPhrases[0], evidenceStatus: "text_matched", sourceReadAt: readAt }]);
    const other = await asNewUser(t, `other-${kind}@example.com`);
    const otherWorkspace = await other.client.mutation(api.orgs.createWorkspace, { businessName: "OTHER TENANT PRIVATE RESEARCH" });
    const otherBusiness = await t.run(async ctx => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", otherWorkspace.orgId)).first())!;
      return business._id;
    });
    await expect(t.mutation(internal.jobWrites.saveInsights, { runId, businessId: otherBusiness, insights: JSON.stringify(research) })).rejects.toThrow("Business mismatch");
    if (kind === "strategy") await t.action(internal.jobs.buildStrategy, { runId });
    else await t.action(internal.jobs.createContent, { runId, job: kind, quantity: 1 });
    expect(captured.inputs, JSON.stringify(await t.run(ctx => ctx.db.get(runId)))).toHaveLength(1);
    const input = captured.inputs[0];
    const text = `${input.task}\n${input.brief}`;
    expect(text).toContain(research.positioningStatement);
    expect(text).toContain(research.vocPhrases[0].phrase);
    expect(text).toContain(research.vocPhrases[0].sourceUrl);
    expect(text).toContain(research.objections[0].objection);
    expect(text).toContain(research.siteAssessment[0].evidenceQuote);
    expect(text).toContain(research.confidenceNotes);
    expect(text).toContain("not verified testimonials");
    expect(text).toContain("not a source retrieval or verification date");
    expect(text).not.toContain("OTHER TENANT PRIVATE RESEARCH");
    expect(text).not.toContain("Invented customer praise");
    expect(text).not.toContain("Search-only unsupported words");
    if (kind === "strategy") {
      expect(text).toContain("Owner interpretation: investigate recurring errors first.");
      expect(text).toContain('"label":"Reliability"');
      expect(text).toContain("not unique customers");
      expect(text).not.toContain("DISMISSED EXAMPLE");
      expect(text).not.toContain("DISMISSED PRIVATE NOTE");
      expect(text).not.toContain("Private Alice");
      expect(text).not.toContain("private@example.com");
    }
    expect((await t.run(ctx => ctx.db.get(otherBusiness)))?.insights).toBeUndefined();
    for (const table of ["approvals", "actionReceipts", "artifacts"] as const) {
      expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
    }
  });
});
