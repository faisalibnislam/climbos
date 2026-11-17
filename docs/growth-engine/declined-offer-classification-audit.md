# Declined offer classification — 17 November 2026

Engine: `v3.143-declined-offer-classification`.

## Observed problem and runtime path

A real-provider synthetic education plan recommended a private school-approval pack comprehension check. Its reason said that the test “needs no ads, audience or discount.” `focusedStrategySpec` called `lintFocusedOffer` → `lintOfferAssessment`; the existing keyword detector found “discount” and demanded the full promotion economics contract. That was a false positive: the proposed work declined a discount rather than offering one. The same shared validator serves detailed growth plays. The preserved failed benchmark is documented in [the evaluation-clock audit](industry-evaluation-clock-audit.md).

## Change

Recommendation classification now recognizes direct refusals and closed lists such as “no ads, audience or discount,” “without a discount,” and “do not offer a discount.” It removes only the recognized negative phrase from its temporary classifier text. The stored recommendation is unchanged. A separate affirmative offer in another sentence, field or clause still requires the complete evidence, alternatives, costs, capacity and test assessment. Ambiguous wording such as “no discount restrictions apply” still requires review rather than being exempted.

This applies to deciding whether a recommendation proposes a promotion and to checking an explicitly selected `no_change`/`improve_other_constraint` result. The public-copy, exact approved offer terms, scarcity/deadline, approval, tenant, destination and action checks are unchanged. It does not make a new offer available or confer approval. No recommendation can apply a discount, change billing, send, publish, schedule or spend.

No strategy, campaign-timing or provider prompt was rewritten. No agent, schema, dependency, UI or persisted data migration was added. The full offer contract is still required for affirmative mechanisms; ordinary comprehension or conversion work can now say why it does not need a discount without being misclassified.

## Verification

Five initially failing tests reproduced the direct negative wording and the actual focused-plan validator failure. Regression cases cover direct lists, required/proposed clauses, sentence and newline boundaries, affirmative later offers, non-price free shipping/trial/bonus mechanisms, ambiguous discount restrictions, and conflicting copy under a no-change assessment.

```sh
pnpm exec vitest run tests/unit/offer-assessment.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/offer-disclosure-lint.test.ts tests/unit/decision-contract.test.ts tests/unit/industry-evaluation-input.test.ts tests/convex/focused-plan.test.ts tests/convex/marketing-authorization.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts
```

**241 tests passed in nine files, 15.61 seconds.** One further no-change consistency regression was then added and its full offer-assessment test file rerun; see Verification.md for that result and static checks. Existing tests retain positive-margin calculations, failed economics, missing costs, capacity, approved-copy term consistency and authorization coverage.

## Boundaries

This is deliberately a narrow English-language classifier, not a complete semantic interpretation of every paraphrase or language. Unrecognized refusals can still be held for review. A passing lint result is not proof of a sound business strategy. The earlier education benchmark also had invalid evidence references and a truncated revision; this change alone does not turn it into an accepted result. Saved plans are not rewritten or automatically approved. Full product acceptance remains incomplete.
