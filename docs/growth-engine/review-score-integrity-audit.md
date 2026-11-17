# Review score integrity — 17 November 2026

Engine: `v3.146-review-score-integrity`.

## Confirmed failure

The shared `assess` function rounded each model criterion to an integer before applying its rubric. A live synthetic education review with seven 3.5s and one 4 therefore incorrectly passed as 4/5. Required average is 4; its true average is 3.5625. Missing scores were merely defaulted, duplicated IDs used the last value, and invalid ranges were clamped.

## Repair and path

Provider critique → shared `assess` → bounded revision loop → `agentQuality` / `planQuality` → persisted strategy → existing owner review and server approval.

- Preserve finite fractional scores from 1 through 5. Compare the unrounded mean and minimum to the unchanged rubric. Round the mean only for display.
- Require each rubric criterion, including the expert verdict, exactly once. Missing, duplicate, nonfinite or out-of-range required scores produce an inspectable `review_scores` hard finding. Extra unrelated IDs never contribute to the score.
- A valid below-bar editorial review remains provisional. An invalid review cannot be approved as merely provisional. Existing review cards and server checks use the shared hard finding.
- Record review-validation errors in round history and prevent the fast-review shortcut from dropping them when retaining an unreviewed final revision. No additional model call or budget permission is introduced.
- Preserve the original raw critique and historical saved results. No automatic historical migration or new authorization.

## Verification

Eight initial unit failures reproduced fractional rounding and invalid-score handling. Focused runtime, quality, actual Convex job, approval, marketing authorization and tenant suites: **236 tests in eight files passed (13.42 seconds)**. Actual job fixtures confirm fractional scores persist as provisional with no action receipts, and duplicated scores persist as failed and cannot be approved. The runtime fast-review fixture confirms malformed scoring cannot be erased by an unreviewed revision. One pre-existing prompt expectation was updated to the already-implemented separate source/wording labels; runtime prompt text was not changed.

Command:

```sh
pnpm exec vitest run tests/unit/agent-lint.test.ts tests/unit/agent-escalation.test.ts tests/unit/agent-runtime.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts
```

Changed-file ESLint and diff checks passed. `pnpm typecheck` passed for application and Convex. No UI code changed in this batch, so no new browser verification is claimed.

Read-only reassessment of the unchanged saved education review gives average **3.56**, minimum **3.5**, ship **false**. Its original false-pass result remains available as failure evidence. See [live evaluation report](../Strategy-Quality-2026-11-17.md) for costs, independent comparison and limitations.

## Limits

Valid numeric scores remain AI editorial judgments, not objective truth or measured commercial performance. Display rounding can show 4.00 for a raw mean just below 4, but acceptance uses the raw value and stays false; regression coverage pins this boundary. Legacy records lacking raw criteria cannot be reliably regraded. No deployment, external business action, model switch or acceptance-threshold change. Full product acceptance remains incomplete.
