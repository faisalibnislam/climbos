# Review invitation receipt recovery

17 November 2026. Follow-up to [dispatch boundaries](review-send-boundary-audit.md), original requirements 141/146/148 and the owner's neutral-review, evidence and approval requirements. The master index routed this work to Book 08 section 12 and Book 13 sections 6–7. Existing review dispatch, request persistence, mailbox credentials, outbound reconciliation, owner review UI, export and purge were inspected before implementation.

## Confirmed gap and chosen path

The preceding repair stopped duplicate invitations but left timeout/crash results pending or unknown with no owner-facing way to record investigation. Existing outbound reconciliation searches a Sent folder by Message-ID alone and can retry on a missing result; that behavior was not copied into review recovery. Review recovery must preserve unknowns and never authorize a resend.

New review dispatches retain the original message, sender, recipient, credential/connection identity, payload hash and stable Message-ID before SMTP handoff. The ID is derived from a hash of the full review-request id, avoiding truncation of the raw id. The canonical payload hash is checked again before recovery. A changed business name, review URL or current template does not replace the original message.

## Owner workflow and evidence

- Reviews offers **Check original mailbox** for an unresolved attempt with a saved dispatch identity. A receipt-pending worker must be at least two minutes old before review; elapsed time is not interpreted as non-delivery. This availability is recalculated on a query/reload, not a live countdown.
- The action reads the original connected mailbox using its original credential identity. It opens a single identified Sent folder read-only, searches the exact Message-ID and requires exactly one result. Sender, recipient, subject, absence of extra Cc/Bcc recipients, a simple plain-text structure and the complete decoded body must match the saved message. Only CRLF versus LF and one terminal newline are normalized. Credential and permission checks run again when recording the observation.
- Reads have a 20-second outer deadline, a 10-second connection timeout, bounded response/literal sizes and a 32 KiB body cap. Unsupported multipart/flowed messages, oversized content, missing or duplicate results, changed credentials and errors remain unknown. There is no mailbox write, flag mutation, resend, scheduling or new provider.
- A matching Sent copy records source evidence separately from the original uncertainty. The check time is not invented as a send time. A matching copy does not prove inbox delivery or review submission.
- **Record what I found** records sent, not sent or still unknown with an explanation. The dialog identifies the exact recipient and shows the original sender/message/attempt time when available; legacy attempts explain the missing snapshot. Manual results are labeled owner-reported, with actor, time, original status/error and audit history retained.
- Recovery uses a revision and immutable-attempt fingerprint. Stale checks, other tenants and unauthorized roles are rejected. A completed resolution cannot be silently overwritten by a late worker; an unknown observation can still retain a later valid native acceptance from the original claim. Final sent/not-sent owner decisions are not editable in this first recovery UI; correcting a mistaken final decision remains follow-up work.
- Owner-reported not sent makes a fresh recipient preview possible; it never authorizes another message. A new invitation still needs the normal current-state eligibility checks and explicit exact-scope approval. No outcome depends on customer sentiment or private feedback.
- Recent 100 invitation records and 100 approval batches now appear in the workspace export with explicit history-limit flags; standalone request/claim tokens are omitted. Original message text can contain its original review/unsubscribe links. Connector credentials are not exported. Workspace purge now includes invitation batches as well as requests; existing batches were previously omitted.

## Primary documentation consulted

[ImapFlow Client API](https://imapflow.com/docs/api/imapflow-client/) retrieved 17 November 2026 documents read-only mailbox locks, UID-based fetches and bounded decoded text downloads. The installed `imapflow` declarations were also inspected. These interfaces support the implementation; they do not guarantee that every mailbox keeps a Sent copy. No platform review-data API, paid plan entitlement or provider-wide delivery guarantee is asserted.

## Verification

- `pnpm exec vitest run tests/convex/review-receipt-recovery.test.ts tests/convex/review-send-boundary.test.ts tests/convex/reviews.test.ts tests/convex/sending.test.ts tests/convex/sending-safety.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — **81 passed across seven files, 7.73 seconds**. Includes actual action routing, original-message recovery after business changes, all mismatches/unknowns, crash waiting period, manual outcomes, stale/late results, role/tenant boundaries, legacy observations, fake SMTP non-replay, mocked IMAP transport/read-only behavior, credential changes during read, and export/purge.
- `CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env E2E_BASE_URL=http://127.0.0.1:3420 pnpm exec playwright test e2e/review-send-boundaries.spec.ts --workers=1` — **two desktop/mobile checks passed, 18.8 seconds**. Owner unknown then not-sent observations, source labels, reload persistence, two audit events, unchanged action/approval/workflow/email records, no page errors, horizontal overflow or serious/critical targeted axe findings. Mobile result capture inspected. These browser checks use legacy synthetic records and exercise manual observation; the provider-read path is tested with mocked IMAP.
- `pnpm typecheck` and scoped lint passed for runtime, UI and tests. An initial TypeScript failure caught an unsupported toast tone; it was corrected to the existing `info` tone.
- Final isolated loopback backend sync passed in **5.18 seconds**; no generated API changes were required. No real mailbox, live email, paid model or hosted deployment was used.

## Remaining boundaries

Sent folders can be incomplete or modified; matching a copy is source-reported evidence, not independent delivery proof. Unsupported formats and legacy attempts need manual observation. There is no automatic resend, continuous reconciliation, general historical migration or final-observation correction UI. The full owner-selected frequency policy still needs to include review history and other lifecycle paths. Full accessibility, production mailbox compatibility, business impact and the entire 410-requirement/later-specification scope remain unverified or incomplete.
