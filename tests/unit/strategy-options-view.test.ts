import { expect, it } from "vitest";
import { focusedPlanFixture } from "../fixtures/focusedPlan";
import { OPTION_MODES, strategyOptionsView, StrategyOptionsOutputSchema } from "../../shared/climb/strategyOptions";
import { sha256Hex } from "../../shared/policy";
import { encodeToolOutput } from "../../convex/lib/climbTools";

const options = focusedPlanFixture().strategyExploration;
const plan = { id: "saved-plan", version: 1, options };

it("preserves all three modes with independent dimensions and no precedent gate", async () => {
  const result = await strategyOptionsView(plan);
  expect(result.options?.map(o => o.mode)).toEqual([...OPTION_MODES]);
  expect(result.options?.map(o => o.status)).toEqual(["available", "available", "available"]);
  expect(result.options?.[2]).toMatchObject({ evidenceBasis: "speculative_hypothesis", dimensions: { evidenceStrength: "low" } });
  expect(result.coverage).toContain("not an execution ranking");
  expect(result.coverage).toContain("does not disqualify bold");
  const encoded = JSON.parse(encodeToolOutput(result, 7_800, StrategyOptionsOutputSchema));
  for (const option of encoded.options) expect(option).not.toHaveProperty("score");
});

it.each(OPTION_MODES)("retains the complete %s idea, evidence, risks and reversible test", async mode => {
  const idea = await strategyOptionsView(plan, mode, "idea");
  const evidence = await strategyOptionsView(plan, mode, "evidence");
  const test = await strategyOptionsView(plan, mode, "test");
  expect(idea.details?.businessMechanism).toBe(options[mode].businessMechanism);
  expect(idea.details?.whyItCouldMatter).toBe(options[mode].whyItCouldMatter);
  expect(evidence.details?.precedentIds).toEqual([]);
  expect(evidence.details?.transferLogic).toBe(options[mode].transferLogic);
  expect(test.details?.reversibleTest).toEqual(options[mode].reversibleTest);
  expect(test.details?.risks).toEqual(options[mode].risks);
  expect(test.details?.assumptions).toEqual(options[mode].assumptions);
  for (const value of [idea, evidence, test]) expect(JSON.parse(encodeToolOutput(value, 7_800, StrategyOptionsOutputSchema)).truncated).toBeUndefined();
});

it("does not hide a valid bold idea when another legacy option is invalid or missing", async () => {
  const damaged = { ...plan, options: { grounded: { title: "Incomplete" }, bold: options.bold } };
  expect((await strategyOptionsView(damaged)).options?.map(o => o.status)).toEqual(["needs_review", "missing", "available"]);
  expect((await strategyOptionsView(damaged, "bold", "test")).details?.reversibleTest).toEqual(options.bold.reversibleTest);
  expect((await strategyOptionsView(damaged, "grounded")).details).toBeNull();
});

it("keeps version-matched owner feedback distinct from a measured finding and retains retirement", async () => {
  const feedback = { decision: "edited", testState: "observed", ownerEdit: "Owner's proposed variant", ownerEditHash: await sha256Hex("Owner's proposed variant"), optionHash: await sha256Hex(JSON.stringify(options.bold)), outcomeNote: "Owner says it helped", outcomeEvidence: "measured", createdAt: Date.now() - 2_000, retiredAt: Date.now() - 1_000 };
  const result = await strategyOptionsView(plan, "bold", "feedback", feedback);
  expect(result.details).toMatchObject({ sourceClass: "owner_reported", claimedOutcomeEvidence: "measured", retiredAt: feedback.retiredAt, ownerEdit: feedback.ownerEdit });
  expect(result.details?.basis).toContain("not independent verification");
  expect(result.details?.basis).toContain("historical");
  for (const patch of [{ optionHash: "different-option" }, { ownerEdit: "An unverified replacement" }, { createdAt: Date.now() + 86_400_000 }]) {
    expect((await strategyOptionsView(plan, "bold", "feedback", { ...feedback, ...patch })).details).toBeNull();
  }
  expect((await strategyOptionsView(plan, "bold", "feedback")).limitation).toContain("Do not infer a preference");
});

it("omits an oversized section intact without removing the bold option or cutting risks", async () => {
  const large = { ...plan, options: { ...options, bold: { ...options.bold, assumptions: Array(6).fill("<".repeat(220)), uncertainties: Array(6).fill("<".repeat(220)), risks: Array(6).fill("<".repeat(220)) } } };
  const result = await strategyOptionsView(large, "bold", "test");
  expect(result.option?.status).toBe("available");
  expect(result.option?.mode).toBe("bold");
  expect(result.details).toBeNull();
  expect(result.limitation).toContain("omitted in full");
  expect(JSON.parse(encodeToolOutput(result, 7_800, StrategyOptionsOutputSchema)).truncated).toBeUndefined();
});
