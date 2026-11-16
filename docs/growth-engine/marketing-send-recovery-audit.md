# Read-only recovery for uncertain marketing sends

17 November 2026. Extends the existing owner-approved Resend marketing path. This is a status observation and local accounting workflow, never a send retry.

## Inspected behavior and confirmed gap

`marketing.approveSend` binds the exact local content/version, recipients, destination, credential and reservation. `executeSend` claims preparation and dispatch once. `finishSend` preserves uncertain provider outcomes and holds the reserved allowance. The owner could see an uncertain receipt, but had no recovery action; a completed external send could therefore remain blocked indefinitely. A worker interruption before `finishSend` also lost the provider broadcast identity from durable state.

The existing provider adapter already has a GET broadcast operation. The owner-facing email form lives in `src/components/app/content/detail/EmailSendPanel.tsx`, mounted by the existing artifact detail route. Existing ad recovery provided the pattern for original-request binding, current access checks, separately recorded observations and late-result protection.

## Implemented behavior

- Dispatch now saves the exact provider broadcast ID and original recipient hashes before the send adapter is called. Hashes are stored in batches of 200 so the existing 10,000-contact bound does not exceed Convex's 8,192-element per-array limit. Existing approval scope remains unchanged.
- The email view lists up to ten unresolved attempts, disclosing omission. Its recovery control remains visible when the current email draft has changed or is no longer approved. Owners, admins and reviewers with approval permission can request a check after five minutes. Older attempts without dispatch identity/recipient evidence explain the manual limitation.
- `checkSendResult` reads only the original broadcast through the originally bound connection and credential. No list search, contact sync, draft creation, send, scheduling or provider write occurs during recovery.
- Confirmation requires matching broadcast ID, unique request name, segment and the exact subject/HTML/sender hash from the signed approval. The provider must report `sent` with an explicit-timezone timestamp consistent with the dispatch and no later than the observation. A one-minute tolerance allows small clock differences. Missing or conflicting content, read failures, draft/queued/sending/scheduled states, invalid timestamps and absent evidence remain unknown. Absence never proves a send did not happen.
- Tenant membership and approval permission, original connection/credential, signed scope, recipient snapshot, allowance and unresolved state are checked before the read and again before recording. A fingerprint rejects concurrent changes. Expired approval, a stopped workspace or changed current draft does not grant sending authority and does not prevent a historical read.
- A separately dated recovery receipt and audit event preserve the original uncertain receipt/outcome. A confirmed observation updates original recipients' last-email times in batches of 200, retaining any newer history, then moves the original reserved count into used allowance exactly once. This is accounting for the approved attempt, not proof of delivery to every recipient. The unresolved hold remains until accounting completes. Batch cursors and recovery identity prevent replay; late original callbacks cannot overwrite a confirmed recovery.
- The schema adds optional recipient-snapshot and recovery-progress fields to the existing approvals table. No new table, provider, dependency or agent is added. Generated files are unchanged. No hosted schema deployment was performed.

## Primary documentation checked

Retrieved 17 November 2026:

- [Retrieve Broadcast](https://resend.com/docs/api-reference/broadcasts/get-broadcast): GET by exact ID and returned identity, segment, sender, subject, HTML, status and sent timestamp. The implementation retains sender/subject in the existing parser; absent fields remain absent.
- [List Broadcasts](https://resend.com/docs/api-reference/broadcasts/list-broadcasts): reviewed but deliberately not used for recovery because a name match alone is insufficient.
- [Broadcast overview](https://resend.com/docs/dashboard/broadcasts/introduction) and [API key management](https://resend.com/docs/dashboard/api-keys/introduction): existing own-account API access still applies. This work adds no OAuth integration, pricing assumption or commercial-plan entitlement. Read authorization failures remain unknown; a working key is not assumed.

The recovery stores a limited status observation, existing approval-scoped recipient hashes and original-attempt identifiers. It does not persist the fetched provider HTML as a second copy or import a provider contact database. Account credentials remain in the existing secret store.

## Verification

- 144 tests across eight files passed in 3.23 seconds. The marketing authorization file has 50 cases, including 26 recovery additions. Four owner-view render checks and two adapter read/parsing checks are included in the total.
- Coverage includes exact success, changed current draft/audience, original contact history, allowance conservation, a 205-recipient batched recovery, repeated/overlapping checks, late callbacks, interrupted workers, foreign tenants, role/credential changes before and during a read, tampered scope, recent attempts, legacy evidence, changed reservations, expired approval/stopped workspace, conflicting provider fields and unknown reads.
- Root and Convex typecheck, scoped ESLint and diff whitespace checks passed. Exact commands are recorded in `docs/Verification.md`.
- Early verification caught a role-reference implementation error and test fixtures with insufficient allowance/invalid mock API-key format. These were corrected before the passing run; these failures are not claimed as pre-existing product defects.

## Remaining limitations

No real provider call, paid model, browser interaction, live email, production deployment or general production-scale test was performed. UI coverage is server rendering, not a full browser accessibility audit. Provider normalization of content may prevent an exact hash match; this conservatively leaves the result unresolved.

This confirms the provider's current report for one broadcast, not actual delivery, opens, customer outcomes, the exact externally delivered recipient set or absence of remote edits between observations. Pre-dispatch interruptions, lost legacy identities, changed credentials, missing payload fields and negative/no-send outcomes still need manual provider investigation; they cannot be marked safe to retry through this control. Local accounting uses durable scheduled mutation batches, but no new administrative repair workflow is added for permanent accounting failures. The broad lifecycle, strategy and 410-requirement acceptance scope remains open.
