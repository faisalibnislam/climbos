# Overlapping marketing sends — 17 November 2026

## Confirmed requirement and gap

Continuation of original rows 118 and 148 (customer email frequency and relationship pressure), following the existing Book 08 route and the preceding contact-frequency audit. This extends the current owner-set broadcast interval; it does not introduce a new lifecycle agent, scheduler, provider or default cadence.

The existing path bound every broadcast to its exact approved artifact, recipients, provider account, allowance and action, with a one-use execution claim. Two different approved artifacts could nevertheless claim the same recipient before either finished: history was updated only after a confirmed result. An uncertain result also left no completed timestamp, so a different broadcast could proceed. Five pre-fix regressions reproduced overlapping claims, missing running/uncertain/legacy holds and a newly enabled policy being bypassed at final dispatch.

## Implemented behavior

- Reuse `approvals.emailRecipientHashBatches`, freezing the validated recipient hashes at the successful execution claim, before provider writes. Final dispatch still revalidates exact current eligibility and approval scope and retains the dispatch snapshot.
- Add an index over the existing tenant/subject/outcome/reconciliation/finish/start fields. The frequency check reads running and uncertain email attempts in the same transaction that claims a new attempt. A competing claim for overlapping recipients is refused under the owner-selected interval. The current attempt excludes itself at final dispatch.
- Preserve a one-use claim on validation refusal. Mark its outcome as failed before provider activity, then use the existing receipt/allowance finalization. This known refusal does not create an unknown-contact hold that would unnecessarily block the valid competing broadcast.
- Match recipient hashes across different segments and artifacts. Disjoint audiences can proceed. With no owner-selected interval, this new frequency hold is not applied, while recipient evidence is still recorded so a later policy change can be checked before dispatch.
- Recheck in preview, approval, claim and immediately before dispatch. The existing owner-facing callout explains how many recipients are waiting for a marketing result. It promises no expiry for uncertain sends. An expired approval or invalidated uncertain result is not evidence of non-delivery.
- Completed failures release the overlap hold. Provider-confirmed completion moves to the recorded last-send timestamp. Existing recovery keeps the overlap hold until all original-recipient history and allowance accounting complete, then the normal owner interval applies.
- A bounded lookup reads at most eight other unresolved attempts. Missing, duplicate, malformed or count-inconsistent recipient snapshots, or a ninth pending attempt, produce an explicit incomplete-evidence hold. This is a processing bound, not a universal sending-frequency recommendation. No undocumented recipients are silently dropped.

## Verification

Tests exercise simultaneous claims and full local executors for different approved artifacts, one successful mocked provider send with the refused allowance released, active/uncertain/expired/legacy states, final policy recheck, self-exclusion, disjoint audiences, no-limit compatibility, definitive failure, incomplete/over-limit snapshots, tenant isolation, and 205-recipient recovery across partial and complete batches. Owner preview messages and existing recovery UI tests are included. See `docs/Verification.md` for the final command/results.

No paid model, live provider, real email, browser interaction, production load test or deployment. The added index is source-only until an authorized deployment. No generated files changed.

## Remaining limitations

This is coordination among ClimbOS marketing broadcasts under an owner-selected policy, not a universal contact-pressure scheduler. Outreach/review/service workflows and external tools are not all coordinated by the same transactional rule. Legacy attempts without a reliable recipient snapshot require owner/provider investigation; the fix does not invent or backfill their recipients or automatically clear uncertain attempts. A process interruption before dispatch still uses the existing manual investigation boundary when no provider dispatch identity is available. Local tests do not prove production concurrency performance or eliminate remote provider read/write races. Customer event ingestion, observed lifecycle states, enrollment/exits, semantic recommendation quality and the broader 410 requirements remain unfinished.
