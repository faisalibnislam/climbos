# Offline acceptance audit — 18 November 2026

Scope: saved strategy replay, full local unit/Convex regression, desktop/mobile owner workflows, and reconciliation of the 410 original requirements plus later specifications. Paid API evaluation remains paused. Runtime model, routes, output budgets, revision limits and acceptance thresholds are unchanged. Tester access and founder time remain unknown. Nothing is deployed or sent to customers.

## Verified batch 1: offline replay and audit findings

The initial complete Vitest run executed 4,249 tests: 4,238 passed and 11 failed. Investigation distinguished product gaps from obsolete test expectations. Completed owner-workflow and requirements reconciliation results are recorded in batch 2 below.

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

## Verified batch 2: owner workflows and full scope reconciliation

### Confirmed gaps fixed

- Customer-progress and sales-qualification observation dates bypassed the existing design-system calendar convention. Both now use the shared labeled date picker, disallow future UTC dates and retain the existing server validation. A missing required date keeps saving unavailable. The browser checks exercise actual calendar selection instead of filling a native input.
- Demo plan steps showed “Make it happen” and a paid credit quote even though `stepWork.start` correctly rejected demo work. The existing quote now exposes availability; the UI explains the limit and links to owned-business setup. Real preparation quotes are unchanged. Existing private demo drafts remain viewable/editable, and stale-information notices remain visible. The backend demo restriction, tenant/role checks, reservation and exact-step bindings remain authoritative. New regression confirms rejection creates no workflow, prepared work or completed task.
- Updated obsolete browser expectations to current labels and actual states: Home/Work tabs, ad-monitor limitations, platform-result provenance, source attribution, editable-request entry points and primary navigation. A checkbox now waits for the persisted reactive update. The margin test previously spread a nonexistent first commercial play from the newer focused demo; it now builds an explicitly synthetic, schema-checked scenario. These are test-fixture repairs, not changes to production economics or permissions.
- Reconciled all 410 original IDs and all nine later supplied implementation attachments (eight unique documents), plus subsequent direct owner requirements. Corrected the old specialist boundary: five supported events do have draft-only scheduling and cooldown/pause controls; this is not 30 independent autonomous agents. Linked current audits from Capabilities, Verification, the consolidated specification, roadmap and Claude handoff. Historical budget and release statements are explicitly superseded.

### Files changed in the owner-workflow/audit batch

- Backend and permission regression: `convex/stepWork.ts`, `tests/convex/step-work.test.ts`.
- Owner controls: `src/components/app/plan/StepWork.tsx`, `src/components/app/connections/CustomerProgressDialog.tsx`, `src/components/app/pipeline/DealQualification.tsx`.
- Browser checks/helpers: `e2e/ad-budget-currency.spec.ts`, `customer-progress.spec.ts`, `deal-qualification.spec.ts`, `demo-flow.spec.ts`, `email-sender-check.spec.ts`, `focused-experience.spec.ts`, `helpers.ts`, `owner-margin.spec.ts`, `recommendation-first.spec.ts`, `simple-app.spec.ts` (all under `e2e/`).
- Audit/handoff: the dated scope, reconciliation Markdown/JSON and browser inventory linked below; `docs/Capabilities.md`, `docs/Verification.md`, `docs/Claude-Code-Handoff.md`, `docs/ClimbOS-Complete-Product-Specification.md`, plus the growth-engine roadmap, original requirement table, implementation ledger and this verification record.

### Executed local checks

```sh
env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY -u GEMINI_API_KEY \
  -u FIRECRAWL_API_KEY -u RESEND_API_KEY -u POLAR_ACCESS_TOKEN \
  pnpm exec vitest run --reporter=default --reporter=json \
  --outputFile=/tmp/climbos-offline-audit-vitest-final-20261118.json
# 4,257 passed, 476 files, 232.72 seconds; complete unit/backend suite

pnpm exec vitest run tests/convex/step-work.test.ts \
  tests/convex/step-work-actions.test.ts tests/unit/step-work.test.ts \
  tests/unit/design-guard.test.ts tests/convex/customer-progress.test.ts \
  tests/convex/deal-qualification.test.ts
# 68 passed, 6 files, 6.16 seconds after the demo availability fix
# Overlaps the full suite and includes the one newly added demo regression.

pnpm typecheck
# App/shared and Convex checks passed after the final UI changes.
# ESLint passed for every changed TS/TSX file; git diff --check passed.
```

The full suite includes permission, tenant, approval, campaign/offer/timing, sending/review fairness, recovery, budget, strategy evidence and library tests. The added demo test ran in the focused rerun; the full-suite count is deliberately not relabeled as a later 4,258-test full run.

### Browser environment and coverage

Used `scripts/local-demo.mjs` through `pnpm local:demo` with isolated loopback Convex at `127.0.0.1:3320` and Next at `127.0.0.1:3420`. The launcher explicitly blanks OpenAI, Anthropic, Gemini, Firecrawl, Resend and Polar credentials. Demo receipts are simulated. Tests that need saved-record histories insert only synthetic local fixture records, with zero provider execution.

The initial full run completed the desktop inventory but later encountered a local SQLite “database or disk is full” failure and stopped during mobile checks. Subsequent filesystem inspection showed free space; the exact storage failure cause was not established. The original synthetic state/logs were preserved, copied to the ignored local cache on the workspace volume and restarted. Every affected failure and unrun case is accounted for in the final inventory. The interrupted run is not reported as a clean full-suite pass.

Browser rechecks used:

```sh
E2E_BASE_URL=http://127.0.0.1:3420 \
CLIMBOS_CALENDAR_E2E_ENV_FILE="$PWD/bench/cache/offline-audit-20261118/backend.env" \
CLIMBOS_DESIGN_E2E_ENV_FILE="$PWD/bench/cache/offline-audit-20261118/backend.env" \
pnpm exec playwright test --project=mobile --workers=1 --reporter=list,json
```

The same isolated configuration was used for targeted desktop rechecks of `ad-budget-currency`, `customer-progress`, `deal-qualification`, `email-sender-check`, `demo-flow`, `focused-experience`, `prepared-work-home`, `owner-margin`, `recommendation-first` and `simple-app`. JSON run reports and the earlier passed rows are reconciled against the current test inventory, preserving initial failures rather than erasing them.

**Final inventory: 140 passing cases — 78 desktop and 62 mobile; zero unresolved failures or skipped cases.** The complete recovered mobile run passed all 62 in 12.4 minutes. Desktop acceptance combines the initial passing rows and targeted rechecks, rather than claiming the interrupted initial run was clean. The machine-readable inventory identifies the latest successful source report for every case. Final targeted desktop checks repeat the current saved-work and demo-limitation workflows after the last UI adjustment.

Visual inspection of retained mobile calendar and buying-context screenshots confirmed the visible date/source/unknown-state disclosures within the emulated viewport. Screenshots and traces are retained only in ignored local audit cache/test output; raw fixture databases and local credentials are not committed.

The checks include monthly/weekly/daily calendar pagination, exact-version trend sources, approved simulated publishing and campaign states, fair review/receipt recovery, observation correction, economics/margins/currencies, experiment not-run outcomes, source/error disclosure, business-model context, design learning, private draft versions, chat draft preservation/IME, keyboard navigation and pause. Assertions reject unwanted side effects where fixtures support that check. Serious/critical axe findings and horizontal overflow are checked on specified surfaces; this does not certify full WCAG conformance or actual owner comprehension. Desktop Chromium and Pixel 7 emulation do not cover every device/browser.

### Audit artifacts and limits

- [All 410 original IDs, references, tested workflow groups and remaining boundaries](requirements-reconciliation-2026-11-18.md); [machine-readable paths/hashes](requirements-reconciliation-2026-11-18.json).
- [Later owner contracts, end-to-end trace, source fingerprints, library quality and remaining work](requirements-scope-2026-11-18.md).
- [Per-case owner-workflow inventory](owner-workflow-verification-2026-11-18.json).

Audit coverage is complete for the preserved original inventory and available later specifications. Broad feature acceptance remains partial. New model quality, real-business usefulness, current third-party policy/access, missing case-study outcome evidence, full lifecycle/call/media telemetry, external-site editing and production acceptance remain outside what these offline results establish. No paid calls, runtime-model changes, live campaigns or deployment occurred. The user's unrelated `.gitignore` edits are preserved and excluded from the verified commits.
