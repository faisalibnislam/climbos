# Declined offers inside a sentence — 17 November 2026

Engine: `v3.150-declined-offer-clauses`.

The approved synthetic retail run described “a demo with no discount gives shoppers a reason to visit.” The existing negative-phrase classifier only accepted punctuation or a few endings after the declined noun. It therefore demanded a promotion assessment for this sentence, and rejected a later no-change assessment for supposed promotion copy.

The shared recommendation-only helper now accepts the narrow clause verbs “gives”, “helps”, “keeps” and “tests” after its closed declined-mechanism list. It still preserves subsequent affirmative offers and ambiguous qualifiers such as “no discount limits”. It never strips terms from public copy or approved artifacts; evidence, margin, capacity, deadline and permission checks are unchanged.

Three red cases reproduced absent-assessment and no-change consistency errors. Final verification: **287 tests in ten files passed (12.30 seconds)**:

```sh
pnpm exec vitest run tests/unit/offer-assessment.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/offer-disclosure-lint.test.ts tests/unit/prepared-offer-terms.test.ts tests/unit/focused-plan.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts
```

Application/Convex typechecks, changed-file ESLint and diff checks passed. Read-only current lint on the unchanged retail result removes the false mechanism finding but retains its five other source/history/capacity/test findings. The historical draft and failed AI assessment remain unchanged; this is not a claim that the saved plan now passes.

This is bounded English classification, not universal language understanding or evidence of commercial effectiveness. No public-copy policy, provider route, live offer or execution authorization changed.
