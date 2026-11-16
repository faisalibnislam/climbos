import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn()) }));
const { ExperimentOutcome, OutcomeHistoryEntry } = await import("../../src/components/app/plan/ExperimentOutcome");
type Experiment = ComponentProps<typeof ExperimentOutcome>["e"];
const experiment: Experiment = { id: "test" as never, method: "ab_split", primaryMetric: "Qualified inquiries", stoppingRule: "Keep support time within the owner's limit", analyses: [{ n: 1, executed: true, source: "integration", design: "randomized", exposed: 300, conversions: 15, controlSize: 300, controlConversions: 60, metric: "Qualified inquiries", successRule: "Keep support time within the owner's limit", result: "missed", stopRuleHit: false, inference: "incremental", redefined: false, reviewedAt: 1 }] };

it("does not display a causal badge for legacy unknown assignment and labels reported sources", () => {
  const html = renderToStaticMarkup(createElement(ExperimentOutcome, { slug: "workspace", e: experiment, canEdit: false }));
  expect(html).toContain("Observed only");
  expect(html).toContain("Member-entered; reported source: connected tool");
  expect(html).toContain("Observation window incomplete");
  expect(html).toContain("not proof of causal impact");
  expect(html).not.toContain("Incremental");
  expect(html).not.toContain("Update outcome");
});

it("distinguishes a reported random comparison from a known split and handles damaged old counts", () => {
  const render = (patch: Partial<Experiment["analyses"][number]>) => renderToStaticMarkup(createElement(ExperimentOutcome, { slug: "workspace", e: { ...experiment, analyses: [{ ...experiment.analyses[0], assignment: "random", ...patch }] }, canEdit: true }));
  expect(render({})).toContain("planned split is unknown");
  const harmful = render({ plannedSharePct: 50 });
  expect(harmful).toContain("Reported random comparison");
  expect(harmful).toContain("A calculated rate difference");
  expect(harmful).toMatch(/likely -[\d.]+ to -[\d.]+ points/);
  expect(render({ plannedSharePct: 50, conversions: 301 })).toContain("counts conflict or are invalid");
});


it("makes the saved report inspectable without presenting old or missing values as current facts", () => {
  const html = renderToStaticMarkup(createElement(OutcomeHistoryEntry, { a: experiment.analyses[0], title: "Revision 1 · Earlier saved analysis", changedFields: ["result", "assignment"], legacy: true }));
  expect(html).toContain("Earlier overwritten corrections are unavailable");
  expect(html).toContain("Changed: Reported result, Reported assignment");
  expect(html).toContain("Qualified inquiries");
  expect(html).toContain("Not recorded");
  expect(html).toContain("Member-entered; reported source: connected tool");
  expect(html).not.toContain("· Current");
  expect(html).toContain("Random split");
  expect(html).not.toContain(">randomized<");
});
