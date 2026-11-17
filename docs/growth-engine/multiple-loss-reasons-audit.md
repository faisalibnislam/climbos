# Multiple reported loss reasons — 17 November 2026

## Confirmed gap and connected path

Book 11 section 13 explicitly permits multiple reasons and unknowns. The existing CRM form and schema allowed one reason; pipeline summaries counted that field, and business-model heuristics summed reason categories. Adding a list alone would overcount customers in model-risk checks.

The existing path is owner input → `crm.update` → optional nested deal fields → `pipelineOutcomes` → `jobContext` strategy/business-model inputs → existing model-check reasoning and owner review. Selected-record assistant reads use `crm.detail` and the existing tool result schema. No parallel agent or promotion system was added.

## Implemented

- Owners can explicitly save any of the seven existing reasons, add optional context, or leave all reasons unknown. Legacy single reasons remain readable; new lists do not invent a primary reason. Reopening clears current loss data as before.
- Edits require the reviewed reasons, context, close timestamp and stage sequence. Stale edits, duplicate reasons, conflicting old/new inputs and unreviewed legacy-client overwrites reject. A concurrent record change preserves the local draft and requires reviewing the latest record. Viewers see the reasons without edit controls; mutations enforce existing tenant/edit access.
- Each reason counts a distinct dated lost deal. A deal with several reasons stays one deal in the denominator and in the union of model-related reasons. Existing date, coverage and small-sample limits remain. Strategy context explicitly warns that categories overlap and cannot be summed as customer counts.
- The existing assistant sees every recorded reason. Business-model checks use the distinct-deal denominator rather than summed categories. The existing minimum-five and 40 percent review heuristics remain labeled heuristics, not causal findings.
- Changes create an audit record without copying private context into audit summaries. Existing nested-record export/deletion behavior remains. Recording a reason does not create an approval, message, scheduled action, webhook delivery or provider call. No model/provider routes changed; engine version is `v3.137-multiple-loss-reasons`.

## Verification

Two initial regressions failed on the missing list input and incorrect overlap counts. Final focused suite: 83 tests in nine files passed in 5.13 seconds, covering legacy/new input, unknowns, stale edits/reopened decisions, unique-deal arithmetic, actual strategy/model job context, selected-record review and tenant/approval boundaries. Two desktop/mobile browser checks passed in 17.7 seconds for legacy entry, explicit save/clear, unchanged action records, targeted accessibility/overflow and no page errors. Mobile capture inspected. Application and Convex typecheck and scoped ESLint passed. Isolated loopback sync passed in 4.86 seconds.

## Limits

Reasons and notes are owner reports, not verified customer statements or proof of causation. Reasons are the existing seven categories, not automatic objection extraction. No historical loss-reason revisions or transcript ingest was added; stage history is a separate record. Live-model interpretation, representative coverage and real business effects remain unverified. Targeted browser checks do not establish full accessibility conformance. Full project scope remains incomplete.
