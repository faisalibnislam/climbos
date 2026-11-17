import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import type { AgentInput } from "../../shared/agents/types";
import { RATE_VERSIONS } from "../../shared/economics/rates";
import { asNewUser, setup } from "./helpers";
const state = vi.hoisted(() => ({ mode: "valid", inputs: [] as AgentInput[] }));
vi.mock("../../shared/agents/runtime", async original => ({ ...await original<typeof import("../../shared/agents/runtime")>(), runAgent: vi.fn(async (_spec: unknown, input: AgentInput) => {
  state.inputs.push(input);
  const ref = (text: string) => `fact:${input.facts.findIndex(fact => fact.includes(text))}`;
  const claim = (text: string) => input.facts.find(fact => fact.includes(text))!;
  const output = { segments: [], plays: [{ type: "upsell", name: "Explain the Team plan", trigger: "second editor", message: "Prepare an explanation of the Team plan for owner review.", channel: "email", expansionAssessment: {
    decision: "recommend", offering: "Team plan", customerNeed: "Working with another editor", customerValueSignal: "request team access",
    offerEvidenceBasis: "owner_reported", offerEvidenceRef: ref("Team plan"), offerEvidenceClaim: claim("Team plan"),
    valueEvidenceBasis: state.mode === "wrong_basis" ? "measured" : "owner_reported", valueEvidenceRef: ref("request team access"), valueEvidenceClaim: claim("request team access"),
    timingEvidenceBasis: "owner_reported", timingEvidenceRef: ref("second editor"), timingEvidenceClaim: claim("second editor"),
    primaryOutcome: state.mode === "no_outcome" ? "" : "Qualified requests for team access", comparison: "Compare with the owner-recorded baseline", observationWindowDays: state.mode === "unknown_window" ? null : 30,
    continueRule: "Continue after the owner reviews contribution and support burden", stopRule: "Stop when the message is unhelpful or permission is withdrawn", ownerInputs: ["Confirm the observation window and the contribution threshold"], unknowns: [],
  } }] };
  return { output: state.mode === "malformed" ? { plays: [] } : output, assessment: { ship: true, gatesPassed: true, average: 5, minimum: 5, lint: [], critique: { gates: [], criteria: [], fixes: [], strengths: [] } }, rounds: 1, history: [], research: null };
}) }));
afterEach(() => { state.mode = "valid"; state.inputs = []; vi.unstubAllEnvs(); });
async function fixture() {
  const t = setup(), owner = await asNewUser(t, "retention-quality@example.com");
  const { orgId, slug } = await owner.client.mutation(api.orgs.createWorkspace, { businessName: "Studio tools" });
  for (const statement of ["Owner confirms the Team plan is available.", "Owner reports that customers request team access.", "Owner reports the usage trigger is a second editor."]) await owner.client.mutation(api.orgs.addFact, { slug, statement, category: "product" });
  vi.stubEnv("CLIMBOS_FAKE_LLM", "");
  const now = Date.now();
  const runId = await t.run(ctx => ctx.db.insert("workflowRuns", { orgId, kind: "retention_plan", title: "Retention advice", status: "executing", input: "{}", engine: "v2", roles: [], estimateMicros: 0, actualMicros: 0, rateVersionId: RATE_VERSIONS[0].id, entitlementVersionId: "test", routingVersionId: "test", budget: { modelSteps: 20, researchTools: 5, repairs: 0 }, used: { modelSteps: 0, researchTools: 0, repairs: 0 }, isFixture: false, createdBy: owner.userId, createdAt: now, updatedAt: now }));
  return { t, runId };
}
it.each(["valid", "wrong_basis", "malformed", "no_outcome", "unknown_window"])("checks %s retention output before recording it as verified despite a passing model assessment", async mode => {
  const f = await fixture(); state.mode = mode;
  await f.t.action(internal.jobs.simplePlanJob, { runId: f.runId, task: "retention_plan" });
  const run = await f.t.run(ctx => ctx.db.get(f.runId));
  const valid = mode === "valid" || mode === "unknown_window";
  expect(run?.status).toBe(valid ? "verified" : "failed");
  expect(state.inputs).toHaveLength(1);
  if (!valid) { expect(run?.output).toBeUndefined(); expect(run?.userMessage).toMatch(/retention|lifecycle|recommendation/i); }
  if (mode === "unknown_window") expect(JSON.parse(run!.output!).plays[0].expansionAssessment.observationWindowDays).toBeNull();
  for (const table of ["artifacts", "approvals", "actionReceipts"] as const) expect(await f.t.run(ctx => ctx.db.query(table).collect())).toEqual([]);
});
