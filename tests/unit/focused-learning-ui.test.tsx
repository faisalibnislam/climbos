import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { focusedPlanFixture } from "../fixtures/focusedPlan";

vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn()) }));
const { FocusedLearning } = await import("../../src/components/app/plan/FocusedLearning");
type Props = ComponentProps<typeof FocusedLearning>;
const fixture = focusedPlanFixture();
const experiment: Props["experiments"][number] = {
  ...fixture.experiments[0], id: "primary" as never, status: "proposed", variants: null,
  decisionOwner: null, plannedCost: null, preregisteredAt: null, currency: "USD",
  deviations: [], analyses: [], outcomeRevision: 0,
};
const render = (overrides: Partial<Props> = {}) => renderToStaticMarkup(createElement(FocusedLearning, {
  title: fixture.focusedMove.title, slug: "workspace", experiments: [experiment], canEdit: true, onAsk: vi.fn(), ...overrides,
}));

it("shows the saved primary test and outcome control without requiring research navigation", () => {
  const html = render({ experiments: [{ ...experiment, id: "other" as never, name: "Unrelated test", primaryMetric: "Wrong metric" }, experiment] });
  for (const value of ["Check your progress", experiment.primaryMetric, experiment.population, experiment.baselineBasis!, experiment.stoppingRule, "1 day once the test runs", "Record outcome", "does not approve or start outside work"]) expect(html).toContain(value);
  expect(html).not.toContain("Wrong metric");
  expect(html).not.toContain("Start test");
});

it("keeps absent and ambiguous links explicit instead of attaching an unrelated test", () => {
  const absent = render({ experiments: [{ ...experiment, name: "Another recommendation" }] });
  expect(absent).toContain("no linked test");
  expect(absent).toContain("Discuss the test");
  expect(absent).not.toContain("Record outcome");
  const duplicate = render({ experiments: [experiment, { ...experiment, id: "duplicate" as never }] });
  expect(duplicate).toContain("More than one saved test");
  expect(duplicate).not.toContain("Record outcome");
});

it("lets viewers inspect reported outcomes without exposing write controls", () => {
  expect(render({ canEdit: false })).toContain("No outcome recorded yet");
  const html = render({ canEdit: false, experiments: [{ ...experiment, analyses: [{ n: 1, executed: false, source: "owner_report", design: "none", metric: experiment.primaryMetric, successRule: experiment.stoppingRule, result: "unclear", stopRuleHit: false, inference: "not_run", redefined: false, reviewedAt: 1 }] }] });
  expect(html).toContain("Not run");
  expect(html).toContain("Outcome history");
  expect(html).toContain("Discuss next step");
  expect(html).not.toContain("Record outcome");
  expect(html).not.toContain("Update outcome");
  expect(render({ canEdit: false, experiments: [] })).not.toContain("Discuss the test");
});

it("does not manufacture a missing legacy comparison or guardrail", () => {
  const html = render({ experiments: [{ ...experiment, baselineBasis: undefined, guardrails: [] }] });
  expect(html).toContain("Not recorded in this saved test");
  expect(html).toContain("None recorded in this saved test");
});
