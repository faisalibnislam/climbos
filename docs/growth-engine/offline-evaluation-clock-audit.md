# Offline review timing context — 17 November 2026

## Confirmed gap

The paid industry harness received an evaluation clock in an earlier repair, but the separate offline `prepare` / `check` path still omitted it. The detailed play validator then used its historical 1970 fallback, allowing a saved campaign window that was already in the past to escape the past-start check. This made offline checks less trustworthy than the application.

## Repair

Both offline commands now use one exported input builder. It supplies the current evaluation instant and UTC date to the existing timing task and deterministic validator. The prompt explicitly distinguishes the evaluation clock from a confirmed business timezone or customer geography. Frozen source dates, facts, business website, 90-day horizon and zero supplied ad budget remain unchanged; no research timestamp or business location is invented. The original campaign-timing prompt, runtime engine and paid harness are unchanged.

## Verification

Two failing tests reproduced the missing clock and acceptance of an already-past window. After the repair, **110 tests in seven files passed (13.23 seconds)**:

```sh
pnpm exec vitest run tests/unit/offline-evaluation-input.test.ts tests/unit/industry-evaluation-input.test.ts tests/unit/campaign-timing.test.ts tests/unit/focused-plan.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts
pnpm strategy:review prepare --cases retail,education --out /private/tmp/climbos-offline-review-20261117
```

Both actual exported packs contain the evaluation clock, no business facts and no invented research-retrieval timestamp. The offline path imports no provider client or action adapter. `pnpm typecheck`, changed-file ESLint and diff checks passed.

## Limits

Offline schema and lint checks do not establish strategic quality, semantic source support, current research or business results. Evaluation UTC does not resolve missing business timezone. These packs are not tenant imports and authorize no publishing or sending. Full acceptance remains incomplete.
