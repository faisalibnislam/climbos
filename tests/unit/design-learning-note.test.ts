import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DesignLearningNote } from "../../src/components/app/plan/DesignResults";

type Learning = NonNullable<ComponentProps<typeof DesignLearningNote>["learning"]>;
const learning: Learning = {
  experimentId: "test" as never, runId: "audit" as never, findingIndex: 0,
  pageId: "page" as never, pageVersion: 2, title: "Inquiry page", sourceUrl: "https://example.com/",
  direction: "Show the offer earlier", region: "Hero", audience: "Service buyers",
  objective: "More qualified inquiries", originalResult: "met",
  originalObservation: "The offer is unclear",
  metric: "Qualified inquiries", originalMetric: "Qualified inquiries", successRule: "Keep inquiries", originalSuccessRule: "Keep inquiries",
  baseline: null, publicationConfirmed: false, publicationApprovedAt: null, deviations: [],
  outcome: { n: 1, reviewedAt: 1, executed: true, source: "integration", design: "before_after", metric: "Qualified inquiries", successRule: "Keep inquiries", result: "met", stopRuleHit: false, inference: "observed", redefined: false },
  assessment: { state: "needs_evidence", summary: "More evidence is needed before using it as a design lesson.", limits: ["Publication approval for this exact page version is unverified."] },
};

it("shows reported source, unknown window and exact-version limitations without claiming a verified integration result", () => {
  const html = renderToStaticMarkup(createElement(DesignLearningNote, { learning }));
  expect(html).toContain("How later advice uses this result");
  expect(html).toContain("Page v2");
  expect(html).toContain("Publication approval unverified");
  expect(html).toContain("Connected tool, as reported by the person recording it");
  expect(html).toContain("Start unknown to End unknown");
  expect(html).toContain("does not publish a variant");
});

it("distinguishes recorded publication time from unknown historical time", () => {
  const html = renderToStaticMarkup(createElement(DesignLearningNote, { learning: { ...learning, publicationConfirmed: true, publicationApprovedAt: Date.UTC(2026, 9, 1) } }));
  expect(html).toContain("Publication approval recorded");
  expect(html).toContain("2026-10-01 (UTC)");
  const missing = renderToStaticMarkup(createElement(DesignLearningNote, { learning: null }));
  expect(missing).toContain("not used as a design lesson");
});
