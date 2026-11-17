# Customer concentration evidence — 17 November 2026

## Confirmed gaps

The current engine already computes billing-derived concentration and includes it in recommendation briefs. It did not need a new feature or agent. However, identity coverage divided customer net revenue after separate refunds by positive billing-event revenue before those refunds. A fully identified customer with a 20 percent refund appeared only 80 percent identified. A shared order reference used the first customer found, making ambiguous refund assignment depend on input order. Blank customer identifiers and unsafe aggregate arithmetic could also support misleading concentration.

## Changes and connected path

`jobWrites.jobContext` loads same-workspace, non-fixture payment records with existing currency and bounded-history rules. `shared/attribution/concentration.ts` now calculates identity coverage on one explicit positive-event basis (after embedded refunds, before separate refund rows), separately from positive customer net revenue. It detects conflicting source/currency/order identities, counts nonzero unassigned refunds and withholds top-customer shares if either issue could alter the conclusion. Blank identifiers remain unknown; invalid amounts and unsafe integer sums reject through the existing billing-signal failure path. Source namespaces stay distinct, and no customer IDs enter the summary.

The existing `jobs.ts` recommendation input reports the denominator, conflicts, unmatched refunds and remaining completeness limits. `v3.138-customer-concentration-basis` records the changed evidence semantics. No schema, provider, UI, permission or action changes were introduced. Existing single-source imports are not merged across providers.

## Verification

Five initial failures reproduced the coverage, conflict, missing-identity and arithmetic gaps. Final regression: 33 tests in five files passed in 2.64 seconds. The actual recommendation job is exercised through its normal context construction with a mocked model boundary: the prompt receives correct coverage and explicit conflict limits, excludes another tenant and customer identifiers, and creates no approval, artifact, message or action receipt. Other checks cover namespace isolation, input-order independence, unknown/zero refunds, currency/window boundaries, invalid amounts, overflow and existing permission controls. Application/Convex typecheck and scoped lint passed. No browser test was needed for this computation/prompt-only change.

## Limits

These are calculations from imported records, not verified cash, profit, causal dependence or complete business coverage. Identity coverage is not import completeness. Unmatched refunds can originate outside the read window; the engine asks for source review instead of assigning them. Existing import deduplication still assumes repeated source event IDs are redeliveries; full historical revision reconciliation is separate work. Real-model interpretation and business outcomes remain unverified. Full project scope remains incomplete.
