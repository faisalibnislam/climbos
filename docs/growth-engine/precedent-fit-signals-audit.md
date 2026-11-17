# Honest precedent retrieval reasons — 17 November 2026

Engine: `v3.149-precedent-fit-signals`.

## Confirmed gaps

The retrieval matcher counted common instruction words such as “one”, “not”, “can” and “but” as a shared creative mechanism. A query containing only grammar and missing-input labels still returned two cases. It also fed all business prose into geography and business-model dimensions: a synthetic business with no supplied location received reasons such as “geography: offer, capacity, term”. Those were textual collisions, not geographic evidence.

## Repair

Exclude common grammatical words and explicit missing-input labels from matching. Geographic reasons now use only the supplied served-area field; business-model reasons use only supplied industry/type fields. General brief/fact text remains available for audience/context and transfer constraints, without silently becoming location or model evidence. Existing mechanism eligibility, at-most-two runtime retrieval, separate evidence/causal labels and uncited bold hypotheses remain unchanged.

## Verification

Two initial regressions reproduced the false mechanism and dimension claims. **214 tests in seven files passed (13.54 seconds)**, including existing real precedent retrieval examples, unknown/sector-only cases, full writer/reviewer context, starter/focused persistence and approval isolation:

```sh
pnpm exec vitest run tests/unit/creative-precedents.test.ts tests/unit/agent-escalation.test.ts tests/unit/strategy-exploration.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts
```

Application/Convex typecheck, changed-file ESLint and diff checks passed. No new provider or permission capability.

## Limits

Lexical overlap still does not establish semantic fit. Long generic task instructions can influence which examples are retrieved; source-backed transfer conditions must be assessed for the specific business. Geography/type mentioned only in unstructured prose will not appear as a structured fit reason until captured in its corresponding field. Scores are internal retrieval ordering, not measured business confidence or a ranking of the generated grounded/adjacent/bold portfolio. No live-model improvement, production outcome or full product completion is established by these tests.
