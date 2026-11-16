# Marketing email: exact approval and one-use execution

17 November 2026. Follow-up to the owner's tenant, audience, version, destination, approval, suppression and audit requirements. This audit follows an existing email workflow; it introduces no new provider or integration and makes no claim about current platform API eligibility or live delivery.

## Actual path inspected

Plan channel cards and first-win preparation -> jobs.createContent -> emailSpec and approved-plan/offer context -> emailToArtifacts -> content review -> EmailSendPanel -> marketing.approveSend -> scheduled executeSend -> existing Resend contact/segment/broadcast adapter -> finishSend -> artifact Activity receipts and quota accounting.

Confirmed existing behavior: email drafts carry a copy brief and approved offer constraints; drafting itself does not send. Sending requires an approved email, an approving member, recorded opt-in and an unsuppressed local segment. The provider segment is compared with locally eligible recipients before broadcasting. Unsubscribe handling, tenant access and a quota reservation already exist. These mechanisms do not prove that a proposed lifecycle segment is the right audience for a business.

## Confirmed failures and repairs

Eight initial regressions failed. A same-size local audience replacement was sent under the original approval; modified content/payload, changed approver role or policy and replacement credentials were not fully rechecked; a late unsubscribe could be missed; concurrent executors could both send.

New marketing approvals bind the exact artifact version, a deterministic hash of the complete eligible local contact records (including consent identity and personalization inputs), the selected local and provider segments, sender and rendered payload, connection and credential identity, reservation and current policy. The hash retains no plaintext addresses in the approval. An old approval missing this binding must be reviewed again.

The executor uses the existing approval-hash checker and current paid-access/permission checks. A mutation atomically claims one attempt before any provider write; a second mutation checks current local state and claims the send dispatch after provider preparation. Current content, audience, suppression, frequency, role, policy, expiry, pause, connection and reservation changes stop the send. The existing provider recipient-set comparison remains in place.

Duplicate approvals for an already approved or unresolved artifact send are rejected. An overlapping executor or replay cannot make another provider attempt. Finalization verifies tenant/reservation identity, requires a dispatch before recording verified sending, and records one receipt and one quota reconciliation. A known failure releases its reservation. An uncertain result keeps its allowance reserved and remains blocked from retry; an interrupted provider response cannot become success or a silently repeated send. Known provider identifiers remain available for inspection.

A complete audience must fit the existing 10,000-contact workspace verification bound; overflow no longer silently becomes a partial approved set. Consent-history overflow is also refused. This is a bounded implementation, not a scale claim. Contact frequency rules and the existing owner's single-email preview parsing are preserved.

## Implementation

- convex/marketing.ts: audience fingerprinting, exact request binding, current-state validation, initial/final claims, duplicate protection and idempotent outcome recording.
- convex/schema.ts and shared/policy/index.ts: four optional approval scope identity fields and an optional email dispatch timestamp. Existing tables and approval hash machinery are reused; legacy records remain readable.
- tests/convex/marketing-authorization.test.ts: 24 actual mutation/action tests with mocked providers.
- tests/convex/contact-frequency.test.ts: its isolated verified-result fixture now explicitly models a prior dispatch, matching the strengthened result contract.

No generated file, Next.js code, model route or live account was changed. The additive backend schema has not been deployed.

## Verification

The focused cases cover same-size audience replacement; content, payload, sender, destination and version changes; revoked permission; policy/credential changes; suppression, expiry, pause and frequency; legacy approvals; late suppression/content/policy changes; concurrent/replayed execution; duplicate approval; unknown responses and thrown provider calls; quota retention; foreign reservation isolation; parsed email compatibility; and local read overflow. Owner-facing content queries expose uncertain receipts with the known provider reference.

The broader run passed 153 tests across nine files, including tenant, approval, campaign, publishing and send-idempotency tests. The final focused run passed 24 overlapping cases. Root and Convex typechecks and scoped ESLint passed. Exact commands are recorded in Verification. Intermediate failures included a misplaced optional schema-field insertion and a test using two separate databases for a tenant-isolation case; both were corrected and the relevant tests rerun, with no removed cases.

## Remaining scope and limits

- No real email was sent and no hosted schema was deployed. Provider responses are mocked in these regression tests; live provider behavior remains unverified.
- Local claims and external provider operations cannot share a transaction. Provider segment or broadcast changes after reads remain a remote concurrency boundary; local request binding is not independent proof of the provider's final content or exact delivery audience.
- Unknown and interrupted attempts need provider inspection. This batch does not add automatic reconciliation or a new owner resolution UI; it deliberately grants no retry authority. An unresolved allowance remains held until a separately authorized reconciliation path resolves it.
- The bounded contact/consent scans are not validated at production scale. Existing audience preview counts remain summaries; execution requires complete verified local input.
- A consent record is owner-reported evidence, not independent proof of permission, relevance or legal compliance. No API/policy promise is added here.
- The first-win email brief still defaults to a welcome sequence even when the plan selects a different lifecycle purpose. Semantic audience/offer consistency in generated copy and richer lifecycle drafting remain the next confirmed recommendation-flow audit work. This batch does not complete the full 410 requirements or later product specifications.
