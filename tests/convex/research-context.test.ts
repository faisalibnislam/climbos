import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";
import { RATE_VERSIONS } from "../../shared/economics/rates";
import type { AgentInput } from "../../shared/agents/types";

const captured = vi.hoisted(() => ({ inputs: [] as AgentInput[] }));
vi.mock("../../shared/agents/runtime", async (original) => ({
  ...await original<typeof import("../../shared/agents/runtime")>(),
  // Inspect the actual job's generation input without a paid model or provider call.
  runAgent: vi.fn(async (_spec: unknown, input: AgentInput) => {
    captured.inputs.push(input);
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
  afterEach(() => { captured.inputs.length = 0; vi.unstubAllEnvs(); });

  it.each([
    ["content_social", "focused"], ["content_ads", "focused"], ["content_email", "focused"],
    ["strategy", "focused"], ["strategy", "starter"],
  ] as const)("passes saved research to %s (%s) without authorizing actions", async (kind, planStyle) => {
    const t = setup();
    vi.stubEnv("CLIMBOS_FAKE_LLM", "");
    const owner = await asNewUser(t, `research-${kind}@example.com`);
    const { orgId } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Research context", website: "https://business.example/" });
    const { businessId, runId } = await t.run(async ctx => {
      const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first())!;
      const runId = await ctx.db.insert("workflowRuns", { orgId, kind, title: "Research context check", status: "proposed", input: JSON.stringify({ planStyle }), engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdAt: Date.now(), updatedAt: Date.now() });
      return { businessId: business._id, runId };
    });
    await t.mutation(internal.jobWrites.saveInsights, { runId, businessId, insights: JSON.stringify(research) });
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
    expect((await t.run(ctx => ctx.db.get(otherBusiness)))?.insights).toBeUndefined();
    for (const table of ["approvals", "actionReceipts", "artifacts"] as const) {
      expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
    }
  });
});
