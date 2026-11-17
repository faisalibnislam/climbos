# Keep a passing reviewed draft — 17 November 2026

Engine: `v3.147-reviewed-draft-selection`.

## Confirmed gap and repair

The review loop selected the highest aggregate rank before checking whether the newest version passed. A draft with one criterion below its minimum and a very high other score could outrank a version that passed every requirement. Both sequential revision and best-of-two selection reproduced this failure. The loop could stop on a passing revision but return the older failing draft.

The shared rank now prioritizes a complete rubric/lint/gate pass. Within other results, existing gate, lint and editorial ordering remains intact. This ranks reviewed versions of one artifact; it does not rank grounded, adjacent or bold strategy options or add an evidence-precedent requirement. No model, threshold, budget, revision allowance or authorization changed.

## Verification

Two new failing runtime cases reproduced the bug. After repair, **238 tests in eight focused runtime/quality/Convex/permission files passed in 12.48 seconds**:

```sh
pnpm exec vitest run tests/unit/agent-escalation.test.ts tests/unit/agent-lint.test.ts tests/unit/agent-runtime.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts
```

Both regressions require the passing draft to be retained with exactly two drafts and two critiques, avoiding an unnecessary extra revision. `pnpm typecheck`, changed-file ESLint and diff checks passed. Budget-harness regression: five tests in three files passed (0.142 seconds).

## Limits

Passing an AI rubric is not measured commercial quality. Historical results remain unchanged. No UI or deployment work in this batch; full product acceptance remains incomplete.
