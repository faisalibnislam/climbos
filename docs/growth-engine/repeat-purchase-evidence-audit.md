# Repeat-purchase evidence — 17 November 2026

## Confirmed gap and existing flow

`jobWrites.jobContext` already supplies the deterministic repeat-purchase summary to strategy and business-model inputs. The helper ignored separate refund events and used a timestamp as an invented order identity when no order reference existed. A fully refunded second order could remain a repeat purchase. Direct calls could also count future orders in reorder timing.

## Implemented

The existing helper now validates dates, source/event identities and minor-unit amounts; deduplicates exact redeliveries; rejects conflicting copies; and groups partial captures by source, currency and actual order identity. It reconciles separately recorded refunds against those orders. Known subscription refunds stay outside the one-off-order measure. Future events stay unobserved, fully refunded orders are excluded, and a partial refund leaves a positive order eligible.

Missing material order identities, ambiguous customers, unmatched nonzero refunds, refunds before their charge, excessive refunds and unsafe sums produce a structured unknown with no rate or median. Unknown customers remain explicitly excluded; timestamps never invent distinct purchases. Strategy gets the reason to reconcile source records, and business-model checks retain an unknown repeat-purchase signal rather than silently omitting the uncertainty.

The definition remains descriptive: first positive order in loaded history, not first-ever customer acquisition. The brief now states that later refunds can change this cohort. Existing bounded-history, small-sample and non-causal labels remain. No raw records, saved reports, UI, schema, provider, or action permissions changed. Engine `v3.140-repeat-order-evidence`.

## Verification

Seven initial failures reproduced the missing refund reconciliation, unresolved identities and future observation gaps. Final command: `pnpm exec vitest run tests/unit/repeat-purchases.test.ts tests/unit/business-model-check.test.ts tests/convex/repeat-purchase-evidence.test.ts tests/convex/cohort-evidence.test.ts tests/convex/business-model-billing-evidence.test.ts tests/convex/crm-payment-evidence.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — **95 tests in eight files passed, 3.30 seconds**. The actual strategy/model job context uses twenty synthetic customers with refunded second orders, then an unmatched refund; the first state reports zero observed repeats and the second reports unavailable, without importing another tenant's refund or creating consequential records. Application/Convex typecheck and scoped lint passed. No UI changed; no browser or paid provider test ran.

## Limits

Reconciliation is limited to loaded source records and their reported identities. Missing older purchases/refunds, incomplete imports and cross-provider customer identity remain unresolved. This is observed positive-order repetition, not contractual retention, profit, lifetime value or causal growth. Prior reports are retained; no historical data migration occurred. Real-model interpretation and the full product scope remain unverified.
