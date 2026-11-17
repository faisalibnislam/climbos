# Declined alternatives and capacity wording — 17 November 2026

Engine: `v3.152-offer-alternative-classification`.

## Confirmed gaps and repair

The approved synthetic retail follow-up described a demo as “a safer first test than a discount.” The recommendation classifier treated the rejected comparison as the selected offer. It also rejected “Staff time and cover available” in the explicit unknowns list because its capacity check only recognized a narrower vocabulary.

The shared recommendation-only helper now recognizes a closed offer noun after “rather than”, “instead of” and narrow “safer/better … than” forms. A qualified or affirmative offer elsewhere still requires assessment. Public copy and exact approved offer terms are not stripped or rewritten. Capacity unknowns accept staff/staffing, stock and floor space, alongside the existing capacity/service/fulfillment vocabulary. Unrelated unknowns still fail; this does not claim any capacity is available.

## Verification

Six initially failing cases covered comparison wording, no-change consistency, the actual focused move and plain-language capacity. The initial capacity fixture also omitted its unrelated mandatory promotion-history unknown; that fixture was corrected while retaining the history check.

**296 tests in ten files passed (13.99 seconds)**:

```sh
pnpm exec vitest run tests/unit/offer-assessment.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/offer-disclosure-lint.test.ts tests/unit/prepared-offer-terms.test.ts tests/unit/focused-plan.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts
```

Application/Convex typechecks, changed-file ESLint and diff checks passed. Read-only re-linting of the unchanged v5 retail output now returns no deterministic findings. Its saved AI assessment remains ship=false, average 3.69. This correction does not regrade or approve it.

## Limits

Bounded English pattern checks are not full semantic understanding. The reviewer still found weak diagnosis, originality and test design. All historical outputs and receipts remain intact; no business input, deadline, forecast, model, budget or action authority was changed.
