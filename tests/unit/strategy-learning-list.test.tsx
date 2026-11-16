import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({ useQuery: vi.fn(), useMutation: vi.fn(() => vi.fn()) }));
const { StrategyLearningList } = await import("../../src/components/app/plan/StrategyLearningSources");

const data = {
  canEdit: true,
  maxAgeDays: 365,
  feedback: [
    { id: "f1" as never, mode: "bold", optionTitle: "Pay for results", decision: "rejected", testState: "not_started", outcomeNote: null, createdAt: Date.UTC(2026, 9, 1), retired: false, used: true },
    { id: "f2" as never, mode: "grounded", optionTitle: "Recurring plan", decision: "selected", testState: "observed", outcomeNote: "3 sign-ups", createdAt: Date.UTC(2025, 1, 1), retired: false, used: false },
  ],
  planNotes: [{ strategyId: "s1" as never, version: 2, note: "Too much ad spend", createdAt: Date.UTC(2026, 8, 1), retired: true, used: false }],
};

describe("strategy learning list", () => {
  it("shows what's used, expired or retired, with controls for editors only", () => {
    const html = renderToStaticMarkup(createElement(StrategyLearningList, { data, onFeedback: () => undefined, onPlanNote: () => undefined }));
    expect(html).toContain("What new plans learn from your feedback (1 included)");
    expect(html).toContain("Included for the next plan");
    expect(html).toContain("Expired");
    expect(html).toContain("not a record of what earlier plans used");
    expect(html).toContain("Retired");
    expect(html).toContain("Use again");
    expect(html).toContain("Stop using");
    expect(html).toContain("older than 365 days stop guiding plans automatically");
    expect(renderToStaticMarkup(createElement(StrategyLearningList, { data: { ...data, canEdit: false } }))).not.toContain("Stop using");
  });
  it("explains omitted records without mislabeling them expired or promising restoration", () => {
    const html = renderToStaticMarkup(createElement(StrategyLearningList, { data: { ...data, limited: true, feedback: [
      { ...data.feedback[0], used: false, reason: "superseded" },
      { ...data.feedback[1], used: false, reason: "context_limit" },
    ], planNotes: [{ ...data.planNotes[0], retired: false, createdAt: null, reason: "invalid_date" }] }, onFeedback: () => undefined }));
    expect(html).toContain("Replaced by a newer report");
    expect(html).toContain("Outside the current learning sample");
    expect(html).toContain("Date unknown");
    expect(html).toContain("Older records are outside this sample");
    expect(html).not.toContain("Expired");
    expect(html.match(/>Stop using</g)).toHaveLength(1);
  });

});
