# Plural offer mechanisms — 17 November 2026

Engine: `v3.153-plural-offer-mechanisms`.

## Confirmed gap

The promotion classifier matched singular words such as `discount` and `bonus` with word boundaries. `Offer discounts to first-time buyers` could therefore avoid the required structured offer assessment. Several plural mechanisms also escaped comparison with approved copy terms. A real generated-plan fixture demonstrated that this missing assessment could leave the plan approvable despite a passing AI review.

## Repair

Recognize singular/plural forms in the existing promotion and approved-mechanism patterns, including discounts, coupons, bonuses, bundles, free trials, guarantees, referral rewards, incentives and special offers. Related named price/code/gift/add-on/period/promise forms retain the same mechanism binding. Existing direct negative recommendations still do not propose an offer; directly negated trials recognize their plural form. No public content is edited or published by classification.

## Verification

Fourteen initial failures reproduced missing structured assessments, no-change copy violations, approved-mechanism mismatches and the generated-plan approval gap. **310 tests in ten files passed (13.57 seconds)**:

```sh
pnpm exec vitest run tests/unit/offer-assessment.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/offer-disclosure-lint.test.ts tests/unit/prepared-offer-terms.test.ts tests/unit/focused-plan.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts
```

The real Convex fixture now saves the unsupported plural offer with failed quality, rejects approval and creates no action receipts, even with a passing model review. Typechecks, changed-file ESLint and diff checks are recorded with the batch.

## Limits

This closes a concrete lexical bypass, not universal natural-language coverage or semantic evidence verification. Non-English and unrecognized paraphrases still require review. Current v6 paid evaluations loaded v3.152 before this repair and are not post-repair model-quality evidence. No model route, price, budget, contact, campaign or live offer changed.

Follow-up publication-boundary coverage: **79 tests in four files passed (1.47 seconds)** using `pnpm exec vitest run tests/convex/publish-flow.test.ts tests/convex/social-publish.test.ts tests/unit/offer-timing-evidence-basis.test.ts tests/unit/offer-horizon.test.ts`. An edited social artifact cannot add unapproved plural bonuses to an approved discount; exact valid terms can still be approved. Changed-test ESLint passed.
