/** Keep software checks, integration scope, judged quality and business outcomes distinct in bench reports. */
export interface EvidenceRow {
  outs: Record<string, { ok: boolean }>;
  comparisons?: Record<string, Record<string, { result?: string }>>;
  scores?: Record<string, unknown | null>;
  hard?: Record<string, { findings: unknown[]; skipped?: string } | null>;
}

export function evaluationEvidence(
  rows: readonly EvidenceRow[],
  arms: readonly string[],
  judgeNames: readonly string[],
  pointwise: boolean,
  blindReviewPacket: boolean,
): string[] {
  const outputs = rows.flatMap((row) => arms.map((arm) => row.outs[arm]).filter((output): output is { ok: boolean } => Boolean(output)));
  const hardChecks = rows.flatMap((row) => arms.map((arm) => row.hard?.[arm]).filter((check): check is { findings: unknown[]; skipped?: string } => Boolean(check) && !check!.skipped));
  const failedHardChecks = hardChecks.filter((check) => check.findings.length > 0).length;
  const comparisons = rows.flatMap((row) => Object.values(row.comparisons ?? {}).flatMap((byJudge) => Object.values(byJudge))).filter((result) => Boolean(result.result));
  const scores = pointwise ? rows.flatMap((row) => Object.values(row.scores ?? {}).filter((score) => score !== null && score !== undefined)) : [];

  return [
    "## Evidence classes (reported separately)",
    "",
    "| Evidence class | Evidence captured | Limit |",
    "|---|---|---|",
    `| Deterministic correctness | ${hardChecks.length ? `${hardChecks.length} strategy outputs re-linted; ${failedHardChecks} had at least one counted hard finding` : "No strategy hard-check results in this run"} | These plan lints do not replace unit, permission, state-transition or full regression tests. |`,
    `| Integration correctness | ${outputs.length} arm outputs recorded (${outputs.filter((output) => output.ok).length} completed, ${outputs.filter((output) => !output.ok).length} failed) | This benchmark does not exercise ad, social, email or CMS publishing integrations. |`,
    `| Decision/content quality | ${comparisons.length} pairwise judgments from ${judgeNames.join(", ") || "no judges"}; ${scores.length} pointwise scores${blindReviewPacket ? "; a blind owner-review packet was generated, but no owner scores are recorded" : ""} | Automated judges are quality signals, not independent expert-reference judgments. |`,
    "| Business impact | Not measured by this benchmark | Requires observed business outcomes and an appropriate attribution or experiment design. |",
    "",
  ];
}
