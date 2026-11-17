# Review invitation dispatch and receipt boundaries

17 November 2026. Original automation requirements 141/146/148 and later owner requirements for neutral review invitations, exact approval and auditability remain in scope. The master index routed this audit to Book 08 sections 11–12 and Book 13 durable execution guidance. These are reference requirements; the actual code path was inspected.

## Existing path and reproduced defects

Owner review link and customer list → `reviews.prepareBatch` freezes recipients, content/template, destination and connected mailbox → `approveBatch` checks the exact hashes and customer-eligibility confirmation → `mailbox.sendReviewRequests` prepares the message → SMTP transport → saved request status → Reviews page. Existing suppression, 90-day invitation interval, neutral wording, private feedback, exact scope and tenant checks were retained.

Two new tests failed before implementation: pausing after approval still returned a sendable message, and invoking the worker again after success replaced `sent` with `failed`. The transport had no atomic claim, so independent workers could both read `queued`. SMTP timeouts were represented as failed, and mailbox credentials could change under the same connection id after preview. There was no current approver-permission, paid-feature, fleet-stop or workspace-state check at the final handoff.

## Implemented behavior

- The existing preview now captures the mailbox credential identity. Approval rejects a changed credential or paused workspace/fleet. Legacy previews without that identity need a fresh preview.
- A shared server helper supplies both read-only message preparation and transactional authorization. It checks current tenant, workspace state, approver membership/permission, sending entitlement, mailbox/credential identity, exact approved template/content/scope, destination, suppression and active prospect outreach.
- `claimRequest` compares the prepared payload hash and loaded credential identity in the same transaction that moves the request from queued to sending. Only one worker obtains a claim token. The hash covers the recipient, text, subject, unsubscribe destination and connection/credential identities. Advice, drafts, previews and queries do not claim or send.
- SMTP uses a stable Message-ID for the request. It is a lookup aid, not a provider deduplication guarantee. The existing fake mailbox now exercises the same actual worker path in tests, including timeout, rejection and crash scenarios.
- Results require the current claim token and sending state. Duplicate or stale workers cannot overwrite sent/failed/uncertain outcomes. SMTP acceptance is not proof of inbox delivery or a submitted review.
- Timeout or worker loss remains uncertain or receipt pending. It never automatically requeues. An unresolved invitation also blocks another invitation beyond the usual 90-day interval and remains active in the existing prospect/review collision check. Negative private feedback does not affect eligibility or neutral copy.
- A definitively blocked unstarted request or known SMTP rejection records `notSentConfirmed`. This permits a new owner preview without automatically sending or bypassing approval. Daily attempt limits still apply. Legacy queued work without mailbox identity remains receipt-unknown; it is not declared unsent or automatically replayed.
- Claim, blocked-dispatch and result transitions create audit records without message bodies or credentials. Reviews displays receipt pending, delivery unclear or mailbox accepted, together with the saved explanation.

## Verification

- Initial regression: two failures reproduced the pause and overwritten-success defects.
- `pnpm exec vitest run tests/convex/review-send-boundary.test.ts tests/convex/reviews.test.ts tests/convex/sending.test.ts tests/convex/sending-safety.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — **55 passed across six files, 7.61 seconds**. Includes concurrent claims, stale results, current pause/fleet/suspension/deletion, suppression, revoked role, mailbox/destination/payload/credential changes, paid access, cross-tenant and legacy approvals, repeated workers, timeout/crash non-replay, known rejection and fair invitation behavior after negative feedback.
- `CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env E2E_BASE_URL=http://127.0.0.1:3420 pnpm exec playwright test e2e/review-send-boundaries.spec.ts --workers=1` — **two desktop/mobile checks passed, 17.2 seconds**. Synthetic demo records only; visible acceptance/uncertainty, error text, no horizontal overflow or serious/critical targeted axe findings, unchanged consequential records and no page errors. Mobile capture inspected.
- `pnpm typecheck` — application and Convex passed.
- Scoped ESLint for changed runtime, UI and test files passed; `git diff --check` passed.
- Isolated loopback Convex sync passed in 26.11 seconds. No generated API change was required. No real mailbox, external message, paid model or hosted deployment was used.

## Limits and next work

SMTP cannot be recalled after handoff, and the final local claim cannot eliminate a remote-side race or prove inbox delivery. Worker loss can leave a request receipt-pending indefinitely; this batch exposes it and prevents replay but does not add an IMAP reconciliation or owner-resolution workflow. Historical sent/failed records are not independently reverified or migrated. Older in-flight application code must be drained before a future production rollout; no production rollout occurred here.

The owner-selected broadcast contact interval still does not include review history; full cross-workflow arbitration, customer-event ingestion, lifecycle enrollment and business-quality validation remain incomplete. The next contact-pressure extension must preserve the newly distinguished pending/unknown/known-unsent states and the neutral invitation policy. All original 410 requirements and later owner specifications remain in scope; this is a verified dispatch repair, not completion of that broader scope.

## Follow-up: 17 November 2026

[Receipt recovery](review-receipt-recovery-audit.md) now supplies owner-requested exact-message Sent-folder checks and source-labeled manual observations. It supersedes the missing-reconciliation-UI limitation above, while preserving uncertainty and requiring fresh approval for a new invitation. Continuous recovery, final-observation correction and full contact-frequency coordination remain incomplete.
