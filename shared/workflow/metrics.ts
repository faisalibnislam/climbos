const MIN_TIMING_SAMPLE = 5;

export type WorkflowStatus =
  | "proposed"
  | "cost_reserved"
  | "preparing"
  | "needs_approval"
  | "approved"
  | "scheduled"
  | "executing"
  | "verified"
  | "failed"
  | "uncertain"
  | "paused"
  | "canceled";

export interface WorkflowMetricRun {
  kind: string;
  status: WorkflowStatus;
  createdAt: number;
  firstFindingAt?: number;
  firstActionAt?: number;
  isFixture: boolean;
}

function median(values: number[]): number | null {
  if (values.length < MIN_TIMING_SAMPLE) return null;
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? Math.round((values[middle - 1] + values[middle]) / 2)
    : values[middle];
}

/** Descriptive operator metrics only; timing and current status are not business outcomes. */
export function summarizeWorkflowMetrics(
  runs: WorkflowMetricRun[],
  coverageCapped: boolean,
) {
  const realRuns = runs.filter((run) => !run.isFixture);
  const strategyRuns = realRuns.filter((run) => run.kind === "strategy");
  const firstFindingDurations = strategyRuns.flatMap((run) =>
    run.firstFindingAt !== undefined && run.firstFindingAt >= run.createdAt
      ? [run.firstFindingAt - run.createdAt]
      : [],
  );
  const firstActionDurations = strategyRuns.flatMap((run) =>
    run.firstActionAt !== undefined && run.firstActionAt >= run.createdAt
      ? [run.firstActionAt - run.createdAt]
      : [],
  );
  const statuses: WorkflowStatus[] = [
    "proposed", "cost_reserved", "preparing", "needs_approval", "approved", "scheduled",
    "executing", "verified", "failed", "uncertain", "paused", "canceled",
  ];
  const statusCounts = Object.fromEntries(statuses.map((status) => [
    status,
    realRuns.filter((run) => run.status === status).length,
  ])) as Record<WorkflowStatus, number>;

  return {
    windowDays: 30,
    runs: realRuns.length,
    strategyRuns: strategyRuns.length,
    firstFindingP50Ms: median(firstFindingDurations),
    firstFindingSamples: firstFindingDurations.length,
    firstActionP50Ms: median(firstActionDurations),
    firstActionSamples: firstActionDurations.length,
    statusCounts,
    coverageCapped,
  };
}
