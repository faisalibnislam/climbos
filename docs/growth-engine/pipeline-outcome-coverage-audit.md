# Sales outcome coverage and recommendation inputs — 17 November 2026

## Scope and inspected path

Original requirements 116 (lost-deal patterns) and 120 (sales outcomes informing marketing) remain partially implemented. The growth-library route was Book 11, especially discovery/qualification, buyer progress, product integration and learning from decisions. Its proposed architecture was not treated as implemented functionality.

The actual path is owner CRM creation/stage changes and optional loss reason/note (`convex/crm.ts`) → tenant-indexed, bounded deal read (`convex/jobWrites.ts`) → deterministic `pipelineOutcomes` and `ownerModelSignals` → `businessBrief` and business-model task inputs (`convex/jobs.ts`) → existing strategy/model generation and review. Loss notes are separately wrapped as untrusted owner text. Existing model-check results and owner test reports feed subsequent strategy context. Existing CRM fields, owner-facing model checks, plan review and approval controls are reused; this change adds no publishing, sending or sales action.

Before this repair, recent loss counts/reasons already reached strategy and viability/pivot checks. However, undated won/lost records fell back to their latest edit date. A new note could make a historical decision appear recent. A truncated 2,000-deal planning sample still produced a numeric aggregate win rate. Null rates could become 0% in the business-model summary.

## Changes

- Only a finite, safe-integer, supported, non-future recorded close date places a decision in the observation window. Record creation/import time and note-edit time are never substitutes. A valid decision before record creation remains usable, since imported history can predate its CRM record.
- Missing and invalid/future close dates are counted explicitly. Truncated reads retain their bounded-record counts and reasons but withhold the aggregate win rate. Unknown is distinct from a complete recorded sample with zero wins.
- Strategy and business-model inputs both receive coverage limitations. The existing loss-reason review heuristic withholds its direction when date coverage or the bounded read is incomplete. Recorded reasons remain owner reports, not proof of causation. Entry sources such as manual/booking/outbound are explicitly not verified acquisition attribution.
- Observation boundaries are validated deterministically. Valid, complete records retain their existing ratio and small-sample qualification. No historical deal records are rewritten.
- A broader regression exposed a checkpoint issue from the recent audience-context addition: an otherwise unchanged business-model input acquired a different audience read timestamp on every resume. Business-model briefs now identify the workflow start as a stable reference and explicitly say records are refreshed for that workflow. Queries still reread current counts/eligibility; changes to the effective inputs still fail the existing full-prompt identity check. This is not a claim that the refreshed records existed at workflow start. Other workflows retain the actual read timestamp. No hash check was removed or relaxed.
- Engine version is `v3.133-pipeline-outcome-coverage`.

## Verification

Unit regressions cover legacy edits, truncated reads, invalid/future dates, valid imported history, zero versus unknown rates, empty/undated samples and invalid observation bounds. New Convex regressions exercise actual strategy and business-model context, the 2,001-row read, cross-tenant exclusion, real owner stage transitions and absence of approvals/action receipts/webhooks. Existing CRM role/isolation, payment separation, plan approval, model learning and checkpoint tests were included. See [Verification](../Verification.md) for commands/results.

The initial focused run showed four old expectations that assumed edit-date fallback or numeric rates despite missing dates; these were updated to assert the corrected behavior, with complete-data positive cases retained. Broader testing reproduced the unchanged-input checkpoint failure; its existing test now passes while the changed-audience-input rejection test also passes. No real model/provider calls, browser test, hosted deployment, schema migration or external action was performed for this repair.

## Remaining limits

These are summaries of owner-recorded stages, not independently verified sales, payment conversions, acquisition attribution, complete customer cohorts or causal diagnoses. The 2,000-row limit remains. Older undated records need owner-supported dates; this change intentionally does not invent or backfill them or add a historical-date editing screen. Missing loss reasons remain unknown. The existing 40% loss-reason flag is explicitly a review heuristic, not a calibrated model-health threshold; complete reads can still contain selection and reporting bias.

Actual context propagation and deterministic safeguards are tested; expert-quality generated advice and owner comprehension are not established by these tests. This does not add conversation analysis, complete sales qualification, deal event history, a universal lifecycle tracker or automatic follow-up. Approval remains separate from recommendations. The full 410-requirement project and later owner specifications are still incomplete.
