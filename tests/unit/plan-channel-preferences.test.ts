import { expect, it } from "vitest";
import { focusedStrategySpec, starterStrategySpec, strategySpec, lintPlanFit } from "../../shared/agents/specs";
import { canDriveWork, planQuality } from "../../shared/agents/quality";
import { focusedPlanFixture } from "../fixtures/focusedPlan";

it.each([focusedStrategySpec(), starterStrategySpec(), strategySpec()])("respects owner dismissal in $label without suppressing creative alternatives", spec => {
  const out = focusedPlanFixture();
  out.channels[0] = { ...out.channels[0], key: "seo_content", name: "Blog articles" };
  for (const preference of ["dismissed", "irrelevant"] as const) {
    const constraints = { ownerChannelPreferences: [{ channelId: "C01", preference, rationale: "We cannot maintain articles this cycle." }] };
    const issues = spec.lint!(out, { task: "Propose the next move", brief: "Synthetic business", facts: [], constraints }).filter(issue => issue.rule === "owner_channel_preference");
    expect(issues).toEqual([expect.objectContaining({ severity: "error", path: "channels[0]" })]);
    expect(canDriveWork(planQuality([], issues))).toBe(false);
    expect(out.strategyExploration.bold).toMatchObject({ precedentIds: [], evidenceStrength: "low" });
  }
});

it("matches explicit library IDs or exact normalized names/keys, without fuzzy bans", () => {
  const constraints = { ownerChannelPreferences: [{ channelId: "M10", preference: "dismissed" as const, rationale: "Not relevant to our customers." }] };
  for (const channel of [{ key: "M10", name: "Launch idea" }, { key: "custom", name: "Product Hunt" }, { key: "product_hunt", name: "Launch idea" }]) {
    expect(lintPlanFit({ channels: [{ ...channel, suggestedMonthlyAdSpend: 0 }] }, constraints)).toContainEqual(expect.objectContaining({ rule: "owner_channel_preference" }));
  }
  expect(lintPlanFit({ channels: [{ key: "launch_feedback", name: "Private product feedback", suggestedMonthlyAdSpend: 0 }] }, constraints)).toEqual([]);
});

it("keeps avoid/prefer/already-using as soft context and clearing removes exclusion", () => {
  const out = { channels: [{ key: "M10", name: "Product Hunt", suggestedMonthlyAdSpend: 0 }] };
  for (const preference of ["avoid", "prefer", "already_using"] as const) {
    expect(lintPlanFit(out, { ownerChannelPreferences: [{ channelId: "M10", preference, rationale: "Owner-reported preference only." }] })).toEqual([]);
  }
  expect(lintPlanFit(out, { ownerChannelPreferences: [] })).toEqual([]);
  expect(lintPlanFit(out, {})).toEqual([]);
});
