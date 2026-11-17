# Industry evaluation clock audit — 17 November 2026

## Confirmed gap

The real focused-plan job in `convex/jobs.ts` supplies `timingContext` and the existing `campaignTimingTask` instructions. The isolated `industries` branch in `bench/strategy-quality/anthropicLive.ts` supplied neither. A qualified `prepare_first` or `not_enough_evidence` result therefore failed the actual campaign-timing validator for lack of an application current date, even with no invented event or window. This was an evaluation-input defect, not evidence that the application's timing context was missing.

The benchmark now uses `industryInput` to supply a deterministic UTC evaluation clock and the existing timing instructions. UTC is explicitly a synthetic workspace convention, not an owner-confirmed business timezone or customer geography. Facts, source dates, readiness, local geography and capacity remain unchanged or unknown. A qualified draft can pass timing validation while unsupported timezone assertions still fail. No campaign-timing prompt, production runtime, routes, approval controls or model selection changed. The tracked source hash now includes the new input helper and timing validator; it is a selected-file fingerprint, not a complete dependency manifest.

## Preserved live evidence before the repair

Owner-authorized command:

```sh
pnpm strategy:anthropic --confirm-paid --stage industries --cases ecommerce,education --variant acceptance-20261117 --plan-style focused
```

Engine `v3.142-review-reward-validation`; selected-source hash `c61054aa748827f2a74570c1ecf66303ac4c833a19f2cc20402fabba8415f084`. Actual provider was the existing `claude-sonnet-5-5` route. This was not a Codex model switch. Cases and public research snapshots were synthetic/frozen; no tenant records or external business actions changed.

| Case | Recorded assessment | Interpretation |
|---|---|---|
| Ecommerce | Schema passed; ship false; AI rubric average 3.63 | Timing context was absent. The proposed page fit-check also lacked evidence that fit was the actual obstacle; demonstration and repeat-customer mechanisms were weak. This is not an accepted commercial strategy. |
| Education | Schema passed for retained initial draft; ship false; AI rubric average 3.5 | Missing timing context, invalid `Brief:` references and an offer-assessment flag. The attempted revision was cut off at its output limit, so the result retained the initial draft and its failures. The offer flag on a denial of discount merits a separate runtime fix. |

Seven completed metered calls cost **$0.933375**. Main ledger charged/held total became **$51.357904**; the separate historical ledger retains **$1.896709**, for a conservative combined **$53.254613** against the existing $100 allowance. Holds were not released or reset. Current rate table was checked against [official Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) on 17 November 2026. Cumulative held amounts are not the same as actual spend.

Original ignored cache records and phase receipts remain intact under `bench/cache/anthropic-real-2026-11-09/`. No failed output was edited into a passing one. A fresh corrected-input run must use a new variant; the old results cannot establish post-fix model quality.

## Verification and limits

Three initially failing regression cases reproduced absent timing context and invalid-clock handling. After the fix:

```sh
pnpm exec vitest run tests/unit/industry-evaluation-input.test.ts tests/unit/focused-campaign-timing.test.ts tests/unit/campaign-timing.test.ts tests/unit/anthropic-budget.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts
```

**126 tests passed in six files, 4.21 seconds.** This includes the actual focused-plan validator and existing authorization/budget guards. New input-module and test ESLint, application/Convex typecheck and diff checks are recorded in `docs/Verification.md` when complete.

This harness exercises shared generation and validation, not the entire Convex job or browser. It still omits tenant-specific diagnosis, prior learning, current research and execution state; it is not evidence of full production parity, industry expertise or business outcomes. No UI changed. Existing failed cases remain useful counterexamples, not claims that all 410 requirements are complete.
