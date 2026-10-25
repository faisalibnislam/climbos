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
    expect(html).toContain("What new plans learn from your feedback (1 in use)");
    expect(html).toContain("Used in new plans");
    expect(html).toContain("Expired");
    expect(html).toContain("Retired");
    expect(html).toContain("Use again");
    expect(html).toContain("Stop using");
    expect(html).toContain("older than 365 days stop guiding plans automatically");
    expect(renderToStaticMarkup(createElement(StrategyLearningList, { data: { ...data, canEdit: false } }))).not.toContain("Stop using");
  });
});
