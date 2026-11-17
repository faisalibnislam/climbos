# Business-model billing signals — 17 November 2026

## Confirmed gap

The existing `ownerModelSignals` revenue comparison independently summed imported rows, bypassing the validity checks used by other billing-derived signals. Fractional amounts could produce a decline, exact redeliveries could produce growth, conflicting copies were summed, and unsafe totals could be rounded. Book 12's metric-contract and reconciliation guidance applies to this actual path, not a proposed subsystem.

## Changes

Within the existing model-signal calculation, source-event identities now deduplicate exact copies and detect financial/customer/date conflicts, including conflicting currencies for the same identity. Same-currency invalid dates, amounts or missing source identities withhold billing direction. Safe integer totals and differences are required before a percentage is computed. Future events stay excluded; currencies are never combined. Existing 90-day windows, coverage warnings and explicitly heuristic direction thresholds remain.

Invalid billing inputs yield an explicit unknown revenue signal and no repeat-purchase conclusion from those inputs. Independent owner-reported lifecycle, sales and competitor evidence remains available. The actual `jobWrites.jobContext` business-model path receives the corrected brief; no separate agent, schema, UI, provider or new execution authority was added. Engine `v3.139-model-billing-evidence` preserves the changed input semantics.

## Verification

Five red regressions first reproduced the defects. `pnpm exec vitest run tests/convex/business-model-billing-evidence.test.ts tests/unit/business-model-check.test.ts tests/convex/business-model-check.test.ts tests/convex/business-model-learning.test.ts tests/convex/pipeline-planning-evidence.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` passed **90 tests in seven files, 4.73 seconds**. The actual job context covers invalid amounts, duplicates, conflicts, unsafe sums, tenant-separated records and no consequential action records; existing model workflow, learning and permission tests passed. Application/Convex typecheck, scoped ESLint and diff checks passed. No UI change or browser test; no paid live-model call.

## Limits

Validated imports do not establish complete accounts, collected cash, seasonally adjusted trends, profit or causation. Missing event identities now require source reconciliation rather than a fabricated growth figure. Prior saved reports and source records were not rewritten. Separate repeat-purchase refund semantics and broader historical source reconciliation still need their own audit. Real advice quality and full project scope remain incomplete.
