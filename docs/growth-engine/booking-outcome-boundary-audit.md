# Booking outcome and follow-up boundary — 17 November 2026

## Existing behavior and confirmed gap

Book 11's buyer-progress and discovery route informed this work. Requirements 114 (follow-up) and 239 (deal-specific next actions) remain partial. The audit traced public booking creation in `convex/outbound.ts`, booking inbox items, `bookings.forInbox` and `setOutcome`, CRM synchronization, the no-show email action, `notifications.sendPlatformEmail`, and the owner inbox UI. Confirmation, reminder and cancellation paths were inspected but are not redesigned here.

Previously, recording a no-show scheduled an email in real workspaces. The UI immediately claimed “Rebook link sent”; the job marked `followUpSentAt` before calling the provider and ignored the returned send status. A prospect-linked booked deal could be downgraded with a note claiming follow-up was sent. The owner could not correct attendance through this UI. Recording an observed outcome therefore doubled as outreach and produced unsupported send claims.

## Implemented behavior

- `setOutcome` checks edit permission, booking tenant, confirmed status and a valid, non-future start date. Repeating the same outcome is idempotent. An outcome change writes an audit event with the actor and booking id. No job, email, approval or action receipt is created by recording the outcome.
- Prospect-linked CRM notes attribute the recorded or corrected observation to the owner and explicitly state that the update sent no follow-up. The deal's stage and next step remain unchanged, including when another call is scheduled. Foreign-workspace deals are untouched; the existing 200-note retention limit remains.
- The existing `sendNoShow` internal export is retained as a no-op returning `requires_owner_review`, so already queued jobs cannot resume the former unreviewed send path after this code is deployed. It does not read/decrypt guest data or contact a provider.
- `forInbox` checks both message and booking tenancy. A confirmed past no-show without a historical send marker offers a private text draft. Its rebooking URL is supplied only for an active booking page in the same tenant. Otherwise, the text asks the guest to suggest a time. It does not invent same-day timing or available slots.
- The inbox distinguishes the observation from outreach, allows attendance correction, and offers an editable draft with manual copy. Copying is not sending. Draft edits remain local to the current view; changed suggested text requires explicit reload before copying. Historical send markers are labeled unverified and do not produce a blind duplicate draft.

## Verification

The initial five new regressions failed against the old implementation. The final focused run passed **41 tests across six files**, including booking creation/cancellation, outcome correction, no queued no-show email, old-job neutralization without network access, legacy marker uncertainty, inactive-page fallback, CRM stage/next-step preservation, attributed notes, viewer/cross-tenant denial, and existing approval/tenancy tests. Root and Convex typechecks and changed-file lint passed. Commands are in [Verification](../Verification.md).

Desktop and mobile browser checks passed against the isolated loopback demo backend. They record a no-show, edit a draft, correct attendance, verify persisted outcomes/audits and inspect historical uncertainty. Chat, workflow, approval, receipt, webhook and email-log records remain unchanged. No horizontal overflow or serious/critical automated accessibility findings were reported; this is not a full accessibility conformance assessment. The mobile capture was visually inspected. Clipboard delivery itself was not exercised; its failure path tells the owner to copy the text directly.

## Remaining scope

This is a manual follow-up preparation path, not an approved in-app no-show sending integration. No guest address is decrypted for draft preparation. Draft edits and manual sends outside ClimbOS are not persisted or verified. No live provider, model evaluation, hosted deployment or real outreach was used. Booking confirmations, reminders and cancellation emails retain their prior behavior and need their own execution/result audit; this change must not be read as verification of those paths. Booking-to-deal identity is still prospect-based where present, not a complete appointment relation for every CRM record. Automatic stage transitions, local-day overdue handling, retained stage history and response-based follow-up learning remain separate gaps. Neither these two requirements nor the full 410-requirement scope is complete.
