import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { RATE_VERSIONS } from "../../shared/economics/rates";
import { InsightsV2Schema } from "../../shared/agents/specs";
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
  alternatives: [], gaps: [], swotEvidence: [], swotMoves: [],
  commercialAssessment: { status: "insufficient_business_specific_evidence", evidence: [], unknowns: ["Paid demand is unknown."], nextTest: { question: "Will a buyer commit?", smallestTest: "Ask the owner to define a private buyer test.", successSignal: "A recorded buyer commitment.", decisionRule: "Set the decision rule before testing." } },
  vocPhrases: [{ phrase: "I keep chasing the missing brief", theme: "handoff", sourceUrl: "https://research.example/interview" }],
  objections: [{ objection: "Migrating our workflow is hard", force: "anxiety", counter: "Test a small migration", sourceUrl: "https://research.example/interview" }],
  positioningStatement: "A clearer handoff for small studios",
  confidenceNotes: "One reported conversation; customer identity and prevalence unknown",
  siteAssessment: [{ dimension: "offer_clarity", observation: "The page describes intake", evidenceQuote: "Collect a client brief", sourceUrl: "https://business.example/", implication: "Test whether the wording answers the buying question" }],
};

describe("persisted research in generation context", () => {
  afterEach(() => { captured.inputs.length = 0; captured.reply = null; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it.each(["valid", "unknown_source", "missing_research", "invented_quote", "site_claim_demand", "unknown_fact", "malformed", "inference"] as const)("validates %s research before replacing saved insights", async kind => {
    const t = setup();
    vi.stubEnv("CLIMBOS_FAKE_LLM", "");
    const network = vi.fn(() => { throw new Error("Unexpected network call"); });
    vi.stubGlobal("fetch", network);
    const owner = await asNewUser(t, "insights-page-evidence@example.com");
    const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Research context", website: "https://business.example/" });
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
    const output = InsightsV2Schema.parse(structuredClone(research));
    if (kind === "unknown_source") output.vocPhrases[0].sourceUrl = "https://unread.example/review";
    if (kind === "invented_quote") output.siteAssessment[0].evidenceQuote = "Our customers achieved a guaranteed return.";
    if (kind === "site_claim_demand") output.commercialAssessment.evidence = [{ dimension: "demand", finding: "The site claims demand.", basis: "site_claim", evidenceRefs: ["https://business.example/"], limitation: "Website claim only." }];
    if (kind === "unknown_fact") output.commercialAssessment.evidence = [{ dimension: "demand", finding: "An owner reports demand.", basis: "owner_report", evidenceRefs: ["fact:999"], limitation: "Owner report only." }];
    if (kind === "inference") output.commercialAssessment.evidence = [{ dimension: "problem", finding: "Studios may need clearer briefs.", basis: "inference", evidenceRefs: [], limitation: "Untested hypothesis; customer behavior unknown." }];
    const business = (await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first()))!;
    await t.mutation(internal.jobWrites.saveInsights, { runId, businessId: business._id, insights: JSON.stringify(research) });
    const prior = (await t.run(ctx => ctx.db.get(business._id)))!.insights;
    captured.reply = { output: kind === "malformed" ? { ...output, commercialAssessment: undefined } : output, assessment: { ship: true, gatesPassed: true, average: 5, minimum: 5, lint: [], critique: { gates: [], criteria: [], fixes: [], strengths: [] } }, rounds: 1, history: [], research: kind === "missing_research" ? null : { notes: "Synthetic research note", sources: [{ url: research.vocPhrases[0].sourceUrl }], retrievedAt: now, pageReads: [{ url: research.vocPhrases[0].sourceUrl, text: research.vocPhrases[0].phrase, retrievedAt: readAt }] } };
    await t.action(internal.jobs.onboardingResearch, { runId });
    const good = kind === "valid" || kind === "inference";
    const run = (await t.run(ctx => ctx.db.get(runId)))!;
    expect(run.status).toBe(good ? "verified" : "failed");
    const saved = await t.run(ctx => ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first());
    if (good) {
      expect(saved?.insights?.expert?.vocPhrases).toEqual([{ ...research.vocPhrases[0], evidenceStatus: "text_matched", sourceReadAt: readAt }]);
      if (kind === "inference") expect(saved?.insights?.commercialAssessment?.evidence[0]).toMatchObject({ basis: "inference", evidenceRefs: [] });
    } else {
      expect(saved?.insights).toEqual(prior);
      expect(run.userMessage).toContain("research");
      expect(run.output).toBeUndefined();
      const visible = await owner.client.query(api.workspace.runs, { slug });
      expect(visible.find(row => row.id === runId)).toMatchObject({ status: "failed", userMessage: run.userMessage });
      const outsider = await asNewUser(t, `outsider-${kind}@example.com`);
      await expect(outsider.client.query(api.workspace.runs, { slug })).rejects.toThrow();
    }
    expect(network).not.toHaveBeenCalled();
    for (const table of ["approvals", "actionReceipts", "artifacts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("keeps every saved Autopilot slot and its prior source in the actual drafting input", async () => {
    const t = setup(); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
    const owner = await asNewUser(t, "calendar-draft-context@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Calendar context" });
    const now = Date.now(); const sourceUrl = "https://research.example/observed-format";
    const runId = await t.run(async ctx => {
      const id = await ctx.db.insert("workflowRuns", { orgId, kind: "content_social", title: "Calendar draft input", status: "proposed", input: "{}", engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: now, updatedAt: now });
      for (let i = 0; i < 6; i++) await ctx.db.insert("calendarSlots", { orgId, weekOf: "2026-11-16", day: i + 1, slotAt: now + i * 86400000, channel: "linkedin", pillar: "Explain", purpose: "teach", format: "text", idea: `Saved idea ${i + 1}: ${"Synthetic context. ".repeat(20)}`, angle: "Explain a workflow", hookDraft: `Distinct hook ${i + 1}`, callToAction: `Complete final instruction ${i + 1}`, needsOwner: true, status: "drafting", draftRunId: id, trendEvidence: { sourceUrl, observationDate: "2026-11-15", observation: "A creator shows the process before its result.", retrievedAt: now - 1000 }, createdAt: now, updatedAt: now });
      return id;
    });
    await t.action(internal.jobs.createContent, { runId, job: "content_social", channel: "linkedin", quantity: 6, brief: "This older truncated scheduler argument must not replace the saved slots https://untrusted.example/generated-link" });
    expect(captured.inputs).toHaveLength(1);
    const input = captured.inputs[0];
    for (let i = 1; i <= 6; i++) expect(input.task).toContain(`Complete final instruction ${i}`);
    expect(input.task).not.toContain("older truncated scheduler argument");
    expect(input.ownerSuppliedUrls).toEqual([]);
    expect(input.task).toContain("not fresh research or publication approval");
    expect(input.research?.brief).toContain(sourceUrl);
    expect(input.research?.brief).toContain("do not invent an updated observation date");
    for (const table of ["artifacts", "approvals", "actionReceipts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  });

  it("records the research retrieval time from the actual calendar job, not the generated plan", async () => {
    const t = setup(); vi.stubEnv("CLIMBOS_FAKE_LLM", "");
    const owner = await asNewUser(t, "calendar-research-context@example.com");
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Calendar research" });
    const now = Date.now(), observed = new Date(now).toISOString().slice(0, 10), sourceUrl = "https://research.example/calendar-format";
    const evidence = { sourceUrl, observationDate: observed, observation: "A creator shows a process before its result." };
    const runId = await t.run(async ctx => {
      await ctx.db.insert("autopilotSettings", { orgId, enabled: false, mode: "always_ask", channels: [{ channel: "linkedin", postsPerWeek: 1 }], postingHours: [12], alwaysAskTopics: [], imagesPerWeek: 0, trust: [], updatedBy: owner.userId, createdAt: now, updatedAt: now });
      return ctx.db.insert("workflowRuns", { orgId, kind: "social_calendar", title: "Calendar research input", status: "executing", input: JSON.stringify({ preview: true }), engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdBy: owner.userId, createdAt: now, updatedAt: now });
    });
    const readAt = now - 1;
    captured.reply = { output: { weekTheme: "Explain the process", pillars: [], learningsApplied: [], slots: [{ channel: "linkedin", day: 1, pillar: "Explain", purpose: "teach", format: "text", idea: "Adapt this meme format", angle: "Make work visible", hookDraft: "Before the result", proof: "Source observation", callToAction: "Compare your process", needsOwner: true, ownerNote: "Audience fit is a hypothesis", trendSourceUrl: sourceUrl, trendEvidence: { ...evidence, retrievedAt: now + 100000 } }] }, assessment: null, rounds: 1, history: [], research: { notes: `TREND SIGNAL 1\nSource URL: ${sourceUrl}\nObserved date: ${observed}\nObserved signal: ${evidence.observation}`, sources: [{ url: sourceUrl }], retrievedAt: readAt } };
    await t.action(internal.jobs.planSocialWeek, { runId, weekOf: observed, fromDay: 1 });
    expect((await t.run(ctx => ctx.db.get(runId)))?.status).toBe("verified");
    expect((await t.run(ctx => ctx.db.query("calendarSlots").collect()))[0]?.trendEvidence).toEqual({ ...evidence, retrievedAt: readAt });
    for (const table of ["artifacts", "approvals", "actionReceipts"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
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
    if (kind === "strategy") {
      await t.run(async ctx => {
        const business = (await ctx.db.get(businessId))!;
        await ctx.db.patch(businessId, { unitEconomics: { ...business.unitEconomics, grossMargin: planStyle === "focused" ? 0 : -0.25, monthlyChurn: 0, updatedAt: Date.now(), segmentEconomics: [{ segment: "Segment with missing delivery costs", currency: "KWD", periodDays: 90, customers: 10, netRevenue: 10.123, costCoverage: "unknown", costBoundary: "Delivery costs not yet collected" }] } });
      });
      await t.action(internal.jobs.buildStrategy, { runId });
    }
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
      expect(text).toContain(`contribution margin ${planStyle === "focused" ? "0" : "-25"}%`);
      expect(text).toContain("monthly churn 0%");
      expect(text).toContain("Segment with missing delivery costs");
      expect(text).toContain("net revenue 10.123 KWD");
      expect(text).toContain("listed variable costs unknown");
      expect(text).toContain("contribution after listed costs unknown");
      expect(text).toContain("cost coverage unknown");
      expect(text).toContain("No spending or execution is authorized");
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
