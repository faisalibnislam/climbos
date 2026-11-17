# Review reward validation — 17 November 2026

The existing deterministic copy validator missed neutral-sounding incentives, rewards for review edits/removals and some happy-customer targeting phrases. Correcting runtime playbooks alone would not reject those outputs. In addition, planning and lifecycle advice did not consistently apply the existing review checks to the proposed action text.

## Implemented

- Extended existing review-incentive/gating patterns to cover representative honest-review rewards, gift cards, change/removal rewards and satisfaction-targeted invitations. Messages now state ClimbOS's owner-defined policy without asserting a universal legal or platform rule.
- A narrowly matched direct prohibition is not treated as an affirmative recommendation. A later affirmative clause and “do not hesitate to” still reject. Other manipulation checks retain their prior behavior.
- Shared review checks now apply to existing plan mechanism, trigger, audience, distribution route, unit and first-action fields, and to lifecycle messages/triggers. Quoted source claims and general explanation fields were not indiscriminately added to these action checks.
- The actual retention job's final acceptance rejects a rewarded-review proposal even when the mocked model critic reports that it passes. Copy/plan creation never gains send, publish or approval authority. Engine `v3.142-review-reward-validation`.

## Verification

Five initial failing cases reproduced the missing checks. One intermediate negative-copy case exposed an article before a directly prohibited gift; the prohibition matcher was corrected and the test retained.

`pnpm exec vitest run tests/unit/manipulation-lint.test.ts tests/unit/agent-lint.test.ts tests/unit/decision-contract.test.ts tests/unit/review-playbook-policy.test.ts tests/convex/retention-plan-validation.test.ts tests/convex/reviews.test.ts tests/convex/review-send-boundary.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — **203 tests in ten files passed, 7.44 seconds**. Includes actual growth-play action fields, final lifecycle acceptance, neutral copy, contradictory clauses, review invitation/send and marketing permission boundaries. Application/Convex typecheck, scoped ESLint and diff checks passed. No UI or live provider action changed.

## Limits

These deterministic English-language patterns catch specified known forms, not every paraphrase or language. Model review and exact action permissions remain necessary; this is not a universal semantic-policy guarantee or evidence of business performance. Existing saved drafts were not rewritten. Full product scope remains incomplete.
