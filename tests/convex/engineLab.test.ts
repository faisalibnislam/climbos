import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { asNewUser, setup } from "./helpers";

describe("engine lab", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    process.env.CLIMBOS_FAKE_LLM = "ship";
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CLIMBOS_FAKE_LLM;
  });

  it("does not score or promote a rule when the tested agent fails its quality gates", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const customer = await asNewUser(t, "c@example.com");
    await expect(customer.client.query(api.engineLab.overview, {})).rejects.toThrow();
    const id = await t.mutation(internal.engineLab.saveProposal, { agentId: "growth_plays", rules: "- Name the activation milestone for freemium products.", rationale: "Reviewers flagged missing upgrade paths." });
    await ops.client.mutation(api.engineLab.test, { id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const o = await ops.client.query(api.engineLab.overview, {});
    const p = o.proposals.find((x) => x.id === id)!;
    expect(p.status).toBe("proposed");
    expect(p.test?.error).toMatch(/failed its quality gates/);
    expect(p.test?.baseline).toBeUndefined();
    expect(p.test?.variant).toBeUndefined();
    expect(await t.query(internal.engineLab.addendumFor, { agentId: "growth_plays" })).toBe("");
    await expect(ops.client.mutation(api.engineLab.decide, { id, decision: "approved" })).rejects.toThrow(/completed, error-free comparison/);
  });

  it("never promotes an untested proposal or a rule that fails its screening comparison", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const untested = await t.mutation(internal.engineLab.saveProposal, { agentId: "growth_plays", rules: "- Candidate rule", rationale: "Test requirement." });
    await expect(ops.client.mutation(api.engineLab.decide, { id: untested, decision: "approved" })).rejects.toThrow(/completed, error-free comparison/);

    const tested = await t.mutation(internal.engineLab.saveProposal, { agentId: "growth_plays", rules: "- Candidate rule", rationale: "No improvement." });
    await t.mutation(internal.engineLab.recordArm, { id: tested, arm: "baseline", score: 4, costMicros: 0 });
    await t.mutation(internal.engineLab.recordArm, { id: tested, arm: "variant", score: 4, costMicros: 0 });
    await expect(ops.client.mutation(api.engineLab.decide, { id: tested, decision: "approved" })).rejects.toThrow(/did not improve/);
    expect(await t.query(internal.engineLab.addendumFor, { agentId: "growth_plays" })).toBe("");
  });

  it("does not promote proposals whose comparison has an error", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const id = await t.mutation(internal.engineLab.saveProposal, { agentId: "growth_plays", rules: "- Candidate rule", rationale: "Comparison failed." });
    await t.mutation(internal.engineLab.recordArm, { id, arm: "baseline", score: 4, costMicros: 0, error: "variant failed" });
    await t.mutation(internal.engineLab.recordArm, { id, arm: "variant", score: 5, costMicros: 0 });
    await expect(ops.client.mutation(api.engineLab.decide, { id, decision: "approved" })).rejects.toThrow(/completed, error-free comparison/);
    expect(await t.query(internal.engineLab.addendumFor, { agentId: "growth_plays" })).toBe("");
  });

  it("tests growth-plan rules with the growth-plan agent", async () => {
    const t = setup();
    const ops = await asNewUser(t, "ops@example.com");
    const id = await t.mutation(internal.engineLab.saveProposal, { agentId: "growth_strategy", rules: "- Keep the plan focused on the measured constraint.", rationale: "Growth-plan reviewer feedback." });
    await ops.client.mutation(api.engineLab.test, { id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const result = (await ops.client.query(api.engineLab.overview, {})).proposals.find((p) => p.id === id)!;
    expect(result.status).toBe("proposed");
    expect(result.test?.baseline).toBeTypeOf("number");
    expect(result.test?.variant).toBeTypeOf("number");
  });
});
