# Complete strategy output budget — 17 November 2026

Engine: `v3.144-strategy-output-budget`.

## Live evidence

The corrected-input command was:

```sh
pnpm strategy:anthropic --confirm-paid --stage industries --cases ecommerce,education --variant acceptance-v2-20261117 --plan-style focused
```

Five completed metered calls cost **$0.667183**. The main ledger charged/held total became **$52.025087**; with the separately retained historical **$1.896709**, the combined conservative total is **$53.921796** of the existing $100 allowance. No hold was reset or released.

Ecommerce produced a complete revised plan, but its assessment remained ship false, average 3.5. Its timing error was gone. A new phrasing, “No offer change: price and margin are unknown,” exposed a missing colon boundary in the narrow offer classifier. That punctuation case is now covered. Re-running the current deterministic lint against the unchanged saved output returns no findings, but the original AI assessment remains unchanged and below acceptance. This is a lint repair, not a new passing AI review.

Education's first draft stopped at exactly **16,000 output tokens**, including **6,715 thinking tokens**. The previous education revision also stopped at exactly 16,000, including 8,690 thinking tokens. Thus two paid responses could not finish the full required portfolio and prepared-work structure. Truncated text was not parsed as a complete plan, and no failed result was promoted to accepted.

## Changes and cost boundary

`phaseTokenLimits` now gives full `growth_strategy` drafts/revisions the existing complex-task ceiling of **24,000 tokens** instead of 16,000. The schema, grounded/adjacent/bold scope, reasoning effort, model route, single revision limit and quality bar are unchanged. This is additional room for a complete response, not a guarantee against all truncation. Requests for a smaller explicit ceiling remain smaller.

The starter plan retains its separate **11,000-token** ceiling, draft thinking setting and revision-within-initial-cap policy. Other agent ceilings are unchanged. The existing `agentSteps` and `agentRevisionSteps` derive quote and revision reservations from the same spec used by the worker. Actual measured usage remains the charge basis; a larger ceiling can increase reserved credit and maximum possible cost. Existing stored run caps are not enlarged. `claimProviderCall` checks the current request envelope against that run before provider access and stops if it cannot fit.

The offer classifier now treats a colon as a phrase boundary, while a real bonus or other offer after the colon still requires an assessment. The paid evaluation fingerprint also includes routes and offer-language/assessment files. It remains a selected-file fingerprint, not a complete dependency manifest.

## Verification

Two red regressions reproduced the 16k ceiling and colon false positive before the repairs.

```sh
pnpm exec vitest run tests/unit/anthropic-routing.test.ts tests/unit/anthropic-budget.test.ts tests/unit/offer-assessment.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/focused-plan.test.ts tests/convex/focused-plan.test.ts tests/convex/safety.test.ts tests/convex/anthropic-uncertain.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts
```

**231 tests passed in ten files, 13.83 seconds.** The actual Convex focused job receives 24,000 tokens with a matching quote; starter limits, revision reservations, concurrency caps, uncertain provider charges and existing approval/tenant boundaries are covered. Application/Convex typechecks, changed routing/helper/test ESLint and diff checks passed.

No post-ceiling-increase paid result is claimed in this batch. There was no browser/UI change, deployment, live campaign or provider business action. Synthetic cases do not establish expert quality across industries, causal growth or production acceptance. The unchanged ecommerce draft still needs better business-specific content; full scope remains incomplete.
