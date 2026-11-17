# Email sender setup readiness — 17 November 2026

## Requirement and real path

Original requirement 119 asks ClimbOS to evaluate email deliverability readiness. The Book 08 relationship/deliverability route and Book 14 snapshot contract were consulted. Actual execution is draft generation → artifact review → one selected email and audience → separate exact send approval → provider adapter → receipt. Customer-event enrollment and automated lifecycle sequences are not implemented by this change.

Previously the send form instructed the owner to use a verified domain but never read its status. Planning knew a provider was connected and had local audience records, but no sender-setup observation. A connection is not a domain verification or an inbox-placement result.

## Implementation

- The existing Resend adapter now exposes a read-only domain check. It validates one sender address, reads at most five 100-domain pages, selects only an exact domain match, and retrieves that domain. Missing/malformed/truncated/conflicting responses stay unknown. Parent domains and other subdomains are not substitutes.
- A verified result requires an exact response identity, verified domain status, sending enabled and reported SPF/DKIM records present and verified. Disabled sending or known pending/failing states request setup attention. Partial verification remains unknown with a manual-inspection explanation: partial status can still permit sending, so it is not labeled impossible.
- The approved-email form has an explicit **Check sender setup** button. It does not run on render or typing. It shows the checked domain, UTC capture time, provider report and important limits. Changing the sender hides a different domain's result. Existing send approval and executor behavior remain intact; this advisory check does not grant permission or add a separate send command.
- `marketing.checkSender` requires the same approval role that can use this send form. It uses the workspace's existing encrypted connection. An internal save rechecks current membership, tenant, provider, connection and credential identity after the read. A credential rotation, disconnect or access loss prevents stale cross-account storage.
- Only the latest minimal domain/state/time/message/provider-endpoint observation is stored on the connection, bound to its credential ID; no raw DNS records, recipient list, sender local part or API key is returned/stored in that report. The existing audit log records the check. Disconnected, rotated, fixture or future-dated reports are not reused.
- Actual job context and writer briefs receive the dated provider observation with an explicit historical label and recheck instruction. With no observation, readiness stays unknown. The report does not relabel permission or audience interest as measured facts. Engine version: `v3.132-email-sender-readiness`.

Files: `shared/growth/emailReadiness.ts`, the existing `shared/integrations/resendMarketing.ts`, `convex/lib/emailReadiness.ts`, `convex/marketing.ts`, `convex/schema.ts`, `convex/jobWrites.ts`, `convex/jobs.ts`, `shared/agents/specs.ts`, `EmailSenderCheck.tsx` and `EmailSendPanel.tsx`, plus focused tests and documentation. The email approval explanation now distinguishes content approval from a later exact-sender/audience send approval instead of incorrectly describing email as export-only. The established local Convex sync regenerated `convex/_generated/api.d.ts`, also registering existing source-helper modules; it was not hand edited.

## Official source checks

All pages below were retrieved on 17 November 2026; publication dates were not provided on these documentation pages.

- [List domains](https://resend.com/docs/api-reference/domains/list-domains): authenticated GET listing, identity/name/status/capability fields and pagination response.
- [Retrieve domain](https://resend.com/docs/api-reference/domains/get-domain): authenticated GET detail with capability and DNS-record status fields.
- [Managing domains](https://resend.com/docs/dashboard/domains/manage-domains): meanings of verified, partial and failing statuses; DNS-record representation can vary. Domain counts depend on the owner's plan. ClimbOS does not create domains or buy capacity.
- [Verified domains](https://resend.com/docs/dashboard/domains/introduction): individual subdomain setup and separation of domain verification from additional deliverability controls.
- [API authentication](https://resend.com/docs/api-reference/introduction): bearer key and User-Agent requirements; read failures/rate limits remain unknown.
- [API key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key): sending-only keys are not general domain-reading access. The feature uses existing account credentials; it neither creates a key nor expands permissions. If access is unavailable, inspect the domain manually in Resend.

No new account, OAuth integration, commercial plan, retention promise or provider write was introduced. The stored report follows the existing connection lifecycle; the audit record follows the existing workspace audit lifecycle.

## Verification and limits

Focused adapter cases cover exact identities, disabled sending, pending/failing/partial statuses, missing or conflicting DNS records, malformed lists, pagination limits, HTTP errors and invalid sender input. Convex cases cover role/tenant isolation, connection changes during the read, hiding old reports, audit logging and absence of execution effects. The actual writer-boundary regression verifies all three result states with capture time and limitations. Render checks cover explicit interaction, mismatched domains and plain-language limits. Final commands/results and browser coverage are in [Verification](../Verification.md).

This is a provider-reported sender-setup check, not a deliverability certification. DMARC alignment, sender reputation, account quotas, warm-up suitability, complaints, bounces, inbox placement, audience permission/fit and customer outcomes remain separately unverified. Only the latest checked domain is retained, not a complete domain inventory or historical planning snapshot. Partial provider status needs owner inspection. No automatic periodic refresh or live DNS query occurs, and a prior successful report is not a current send preflight. No real provider credentials, email, paid model or hosted deployment were used in validation. Requirement 119 remains partial; full lifecycle automation and broader product requirements remain open.
