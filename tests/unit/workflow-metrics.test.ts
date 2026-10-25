import { describe, expect, it } from "vitest";
import { summarizeWorkflowMetrics, type WorkflowMetricRun } from "../../shared/workflow/metrics";

describe("workflow metrics", () => {
  it("reports first-finding/action medians only after five real strategy runs", () => {
    const runs: WorkflowMetricRun[] = Array.from({ length: 5 }, (_, index) => ({
      kind: "strategy",
      status: index === 0 ? "verified" : "needs_approval",
      createdAt: 1_000,
      firstFindingAt: 1_000 + (index + 1) * 1_000,
      firstActionAt: index < 4 ? 2_000 + index * 1_000 : undefined,
      isFixture: false,
    }));
    runs.push({
      kind: "strategy",
      status: "verified",
      createdAt: 1_000,
      firstFindingAt: 500,
      firstActionAt: 500,
      isFixture: true,
    });

    expect(summarizeWorkflowMetrics(runs, false)).toMatchObject({
      runs: 5,
      strategyRuns: 5,
      firstFindingP50Ms: 3_000,
      firstFindingSamples: 5,
      firstActionP50Ms: null,
      firstActionSamples: 4,
      statusCounts: { verified: 1, needs_approval: 4 },
    });
  });

  it("keeps invalid negative timings out and exposes capped coverage", () => {
    const runs: WorkflowMetricRun[] = Array.from({ length: 5 }, (_, index) => ({
      kind: "strategy",
      status: "uncertain",
      createdAt: 5_000,
      firstFindingAt: index === 0 ? 4_999 : 6_000,
      isFixture: false,
    }));
    expect(summarizeWorkflowMetrics(runs, true)).toMatchObject({
      firstFindingP50Ms: null,
      firstFindingSamples: 4,
      coverageCapped: true,
      statusCounts: { uncertain: 5 },
    });
  });
});
