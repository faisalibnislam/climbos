import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { AgentInput } from "../../shared/agents/types";
import { RATE_VERSIONS } from "../../shared/economics/rates";
import { demoBusinessModelCheck } from "../../shared/agents/businessModel";
import { asNewUser, setup } from "./helpers";

const state = vi.hoisted(() => ({ reply: null as unknown, inputs: [] as AgentInput[] }));
vi.mock("../../shared/agents/runtime", async original => ({
  ...await original<typeof import("../../shared/agents/runtime")>(),
  runAgent: vi.fn(async (_spec: unknown, input: AgentInput) => { state.inputs.push(input); return state.reply; }),
}));
afterEach(() => { state.reply = null; state.inputs = []; vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it.each(["unknown_fact", "unknown_source", "missing_research", "different_source_path", "invalid_date", "duplicate_mode", "invented_unknown_price", "malformed", "valid", "undated", "bold_without_precedent", "owner_as_measured", "source_as_measured", "segment_as_measured", "economics_as_measured", "economics_uncited", "owner_sourced_economics"] as const)("checks %s before making a business model result available to owners and later plans", async kind => {
  const t = setup();
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const network = vi.fn(() => { throw new Error("Unexpected network call"); });
  vi.stubGlobal("fetch", network);
  const owner = await asNewUser(t, "model-validation@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Synthetic studio" });
  await owner.client.mutation(api.orgs.addFact, { slug, category: "pricing", statement: "Owner reports analytics show customers pay $49 for the current plan." });
  const now = Date.now();
  const runId = await t.run(ctx => ctx.db.insert("workflowRuns", { orgId, kind: "business_model_check", title: "Synthetic model check", status: "executing", input: "{}", engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdBy: owner.userId, createdAt: now, updatedAt: now }));
  const initialContext = (await t.query(internal.jobWrites.jobContext, { runId }))!;
  const ownerRef = `fact:${initialContext.facts.findIndex(fact => fact.statement.includes("pay $49"))}`;
  const output = demoBusinessModelCheck("Synthetic studio");
  const sourceUrl = "https://research.example/Plans";
  output.marketSignals = [{ dimension: "substitutes", direction: "unknown", finding: "The source describes an alternative payment model.", basis: "research", evidenceRefs: [sourceUrl], observedAt: "2026-10-01", limitation: "A source claim does not establish customer demand." }];
  if (kind === "owner_as_measured") output.marketSignals[0] = { ...output.marketSignals[0], basis: "measured", evidenceRefs: [ownerRef] };
  if (kind === "source_as_measured") output.marketSignals[0].basis = "measured";
  if (kind === "segment_as_measured") output.segmentFit = [{ segment: "Small studios", dimensions: ["problem_severity", "willingness_to_pay", "reachability", "serviceability"].map(dimension => ({ dimension: dimension as NonNullable<typeof output.segmentFit>[number]["dimensions"][number]["dimension"], level: "medium", basis: "measured", evidenceRefs: [ownerRef], note: "Owner report mentions analytics." })) }];
  if (["economics_as_measured", "economics_uncited", "owner_sourced_economics"].includes(kind)) output.alternatives[0].unitEconomicsInputs = [{ input: "Current plan price", value: "$49", basis: kind === "economics_as_measured" ? "measured" : "owner_report", evidenceRefs: kind === "economics_uncited" ? [] : [ownerRef] }];
  if (kind === "unknown_fact") output.currentModel.evidenceRefs = ["fact:9999"];
  if (kind === "unknown_source") output.marketSignals[0].evidenceRefs = ["https://unread.example/plans"];
  if (kind === "different_source_path") output.marketSignals[0].evidenceRefs = [sourceUrl.toLowerCase()];
  if (kind === "invalid_date") output.marketSignals[0].observedAt = "2026-02-30";
  if (kind === "duplicate_mode") output.alternatives[2].mode = "grounded";
  if (kind === "invented_unknown_price") output.alternatives[0].unitEconomicsInputs[0].value = "$49";
  if (kind === "malformed") output.alternatives = [];
  if (kind === "undated") { delete output.marketSignals[0].observedAt; output.marketSignals[0].limitation = "Undated source; no customer demand evidence."; }
  if (kind === "bold_without_precedent") {
    output.alternatives[2].precedentIds = [];
    output.alternatives[2].evidenceRefs = [];
    output.alternatives[2].feasibility = "low";
    output.alternatives[2].novelty = "high";
    output.verdict.status = "at_risk";
    output.verdict.confidence = "low";
  }
  state.reply = { output, assessment: { ship: true, gatesPassed: true, average: 5, minimum: 5, lint: [], critique: { gates: [], criteria: [], fixes: [], strengths: [] } }, rounds: 1, history: [], research: kind === "missing_research" ? null : { notes: "Synthetic source describes a payment model; demand unknown.", sources: [{ url: sourceUrl }], retrievedAt: now } };
  await t.action(internal.jobs.businessModelCheck, { runId });
  const run = (await t.run(ctx => ctx.db.get(runId)))!;
  const good = ["valid", "undated", "bold_without_precedent", "owner_sourced_economics"].includes(kind);
  expect(run.status).toBe(good ? "verified" : "failed");
  expect(state.inputs[0].constraints?.factEvidenceBases?.[Number(ownerRef.slice(5))]).toBe("owner_reported");
  expect(state.inputs[0].task).toContain("every cited reference");
  const latest = await owner.client.query(api.businessModel.latest, { slug });
  if (good) {
    expect(latest.result?.check.alternatives.map(a => a.mode)).toEqual(["grounded", "adjacent", "bold"]);
    expect(latest.failure).toBeNull();
    expect(latest.result?.facts?.[Number(ownerRef.slice(5))]).toMatchObject({ statement: expect.stringContaining("pay $49"), basis: "owner_reported" });
  }
  else {
    expect(run.output).toBeUndefined();
    expect(run.userMessage).toContain("business model");
    expect(latest.result).toBeNull();
    expect(latest.failure).toMatchObject({ runId, message: run.userMessage });
  }
  const strategyId = await t.run(ctx => ctx.db.insert("workflowRuns", { ...run, _id: undefined, _creationTime: undefined, kind: "strategy", status: "executing", output: undefined } as never));
  const context = (await t.query(internal.jobWrites.jobContext, { runId: strategyId }))!;
  if (!good) expect(context.businessModelContext).toBe("");
  for (const table of ["artifacts", "approvals", "actionReceipts", "businessModelTests"] as const) expect(await t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
  expect(network).not.toHaveBeenCalled();
  if (kind === "unknown_fact") {
    const { _id, _creationTime, ...prior } = run;
    const previousId = await t.run(ctx => ctx.db.insert("workflowRuns", { ...prior, status: "verified", output: JSON.stringify(demoBusinessModelCheck("Earlier synthetic model")), userMessage: undefined, createdAt: now - 1 }));
    const retained = await owner.client.query(api.businessModel.latest, { slug });
    expect(retained.result?.runId).toBe(previousId);
    expect(retained.failure?.runId).toBe(runId);
    const other = await asNewUser(t, "model-validation-outsider@example.com");
    await expect(other.client.query(api.businessModel.latest, { slug })).rejects.toThrow();
    await t.run(ctx => ctx.db.insert("workflowRuns", { ...prior, status: "verified", output: JSON.stringify(demoBusinessModelCheck("New synthetic model")), userMessage: undefined, createdAt: now + 1 }));
    expect((await owner.client.query(api.businessModel.latest, { slug })).failure).toBeNull();
  }
});
