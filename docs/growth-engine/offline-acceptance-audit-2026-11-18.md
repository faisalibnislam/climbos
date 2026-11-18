# Offline acceptance audit — 18 November 2026

Scope: saved strategy replay, full local unit/Convex regression, desktop/mobile owner workflows, and reconciliation of the 410 original requirements plus later specifications. Paid API evaluation remains paused. Runtime model, routes, output budgets, revision limits and acceptance thresholds are unchanged. Tester access and founder time remain unknown. Nothing is deployed or sent to customers.

## Verified batch 1: offline replay and audit findings

The initial complete Vitest run executed 4,249 tests: 4,238 passed and 11 failed. Investigation distinguished product gaps from obsolete test expectations. Owner-workflow and requirements reconciliation results will be added below after completion.

- **Channel evidence reuse:** `convex/jobs.ts` hashed a fresh email-audience query timestamp into every strategy replan, preventing reuse even when the evidence was unchanged. The hash now excludes only that query clock. The actual writer/scorer still receives the dated snapshot; counts, coverage, limitations, customer-progress evidence, owner outcomes, economics, preferences, research, goal and existing expiry checks remain material. The actual Convex workflow tests cover unchanged inputs, recorded outcomes, economics, preferences, feedback, research, audience changes and expiry. Recommendations still create no action receipt.
- **Owner credit estimate:** the static growth-plan example said 122 credits while the unchanged current estimator returns 130. Updated the displayed example to match the estimator. No price, rate, reservation, budget or runtime-model setting changed.
- **Saved-plan checking:** the benchmark incorrectly treated calculator-added sensitivity labels such as “12m” as model-authored factual claims. Exclude the three calculator annotation fields from authored-copy lint; original play claims and budget/consistency checks remain checked. This is not independent verification of stored calculations.
- **Regression maintenance:** updated the routing test to assert the existing 32,000 draft / 16,000 critic / two-revision focused configuration. Updated the retry fixture expectation to preserve selection-aware first work: no automatic social/email job when neither channel was selected. Added the already-required explicit timing assessment to the benchmark fixture; the campaign-timing prompt and logic are untouched.
- **Shared offline validation:** `strategy:review check` now uses the same evidence normalization as runtime. New `replay --file` / `replay --dir` checks saved focused records with their actual input and historical evaluation clock. It cannot invent a missing clock, repair an old schema, call a model, or execute an action. Runtime defaults still use the current clock. Saved critic judgments are revalidated only when the current review contract can represent them; historical scores remain separate.
- **Generated API declaration:** the established local Convex sync added the existing `lib/focusedResearch` module to the generated declaration. No hosted deployment occurred.

### Saved results

84 files matching `*-focused-14.json` were inspected: 79 contain input records and five do not. Of the 79, 33 have no saved numeric evaluation clock. Under current contracts:

| Result | Count | Meaning |
|---|---:|---|
| Contract passed | 8 | Schema and deterministic lint only; editorial quality not assessed |
| Lint failed | 16 | Current deterministic checks reject at least one claim or inconsistency |
| Schema failed | 22 | Historical output cannot satisfy the current output contract |
| Uncheckable | 38 | Missing input/clock; no replacement evidence invented |

None of the 24 schema-compatible records includes all fields required by the current independent-review contract. No historical critic was silently upgraded. The latest saved Livoform agency draft remains rejected for unsupported numeric claims; its historical 3.5 score is unchanged. Contract passes do **not** prove originality, useful product-plan reasoning, real business outcomes, or fresh platform-policy validity.

[Per-record status, original scores and SHA-256 identifiers](offline-replay-2026-11-18.json). Source records and budget ledgers were not edited. The cumulative paid cap remains $100, with $99.063401 used or held in the prior ledger; this batch adds zero provider cost.

### Verification

```sh
pnpm exec vitest run tests/unit/offline-strategy-replay.test.ts tests/unit/anthropic-routing.test.ts tests/unit/bench-hard.test.ts tests/convex/channel-cache.test.ts tests/convex/credit-examples.test.ts tests/convex/plan-speed.test.ts tests/convex/retry.test.ts
# 47 passed, 7 files, 21.41 seconds
pnpm exec vitest run tests/unit/focused-*.test.ts tests/unit/offline-*.test.ts tests/convex/plan-approval.test.ts tests/convex/marketing-authorization.test.ts tests/convex/campaign-authorization.test.ts tests/convex/safety.test.ts tests/convex/planning-email-audience.test.ts
# 366 passed, 20 files, 20.49 seconds; overlapping checks, do not add as unique tests
pnpm strategy:review replay --dir bench/cache/anthropic-real-2026-11-09
# Expected nonzero exit: failures and unavailable historical context are reported above
```

Replay regressions cover frozen-clock behavior after the real clock advances, no fetch calls or record mutation, missing context, obsolete schemas, removed sources, insufficient capacity, unknown timezone and inadequate preparation time. Existing suites exercise originality, product eligibility, evidence-bound repair, observation scope and approval denial using local doubles. These checks cannot establish consistent performance from newly generated advice.

App and Convex `pnpm typecheck`, changed-file `pnpm exec eslint`, and `git diff --check` passed for this batch.
