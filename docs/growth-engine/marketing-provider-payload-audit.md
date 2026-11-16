# Approved email payload at the provider boundary

17 November 2026. Follow-up to exact marketing authorization and uncertain-send recovery. The scope is the existing Resend broadcast path, not a new provider or lifecycle automation engine.

## Confirmed gap and inspected path

`marketing.approveSend` binds the local email version, rendered HTML/subject/sender, audience, destination and allowance. `executeSend` verifies the local state and provider segment, creates a provider draft, claims dispatch and calls `sendBroadcast`. The adapter previously checked only draft status and an unsubscribe link before sending. Its creation read-back and post-send verification likewise did not require the approved payload to match. A provider draft with different content, sender or segment could therefore reach POST send, and changed content could be marked verified.

Fourteen new regressions failed before the repair. Twelve showed changed or absent provider fields reaching the send request; one showed mismatched creation read-back being accepted; one showed changed post-send content marked verified.

## Implemented behavior

- The existing adapter has one canonical material-payload representation: segment, sender, subject, HTML, plain text, request name, reply addresses and topic. Absent optional fields have explicit defaults. Malformed optional field types and conflicting legacy/current segment IDs cannot be silently discarded.
- Draft creation read-back must match the submitted payload and returned ID, still be a draft and have no prior send/schedule evidence. Mismatches remain uncertain; creation never sends.
- `sendBroadcast` requires the expected payload as well as its existing exact-ID/timing approval. Its final pre-send read must match the expected payload and draft state. Mismatch prevents POST send. A broadcast already outside draft state is left uncertain rather than described as a safe failed send; no resend is attempted.
- A successful send response must identify the requested broadcast. Post-send read-back must retain the expected payload before the adapter reports an accepted state. Missing/mismatched response identity or changed payload stays uncertain, retaining the existing hold and recovery requirement.
- The runtime passes the same approved draft to creation and sending. Its plain-text alternative is derived from the selected approved artifact email and includes the opt-in explanation and unsubscribe placeholder. Local validation and provider drafting share the same email-selection helper.
- Dispatch records the complete provider-payload hash in an optional approval field. Historical recovery must match it as well as the original signed local content binding. Changed plain text, reply addresses or topic cannot bypass this through the recovery control. Older attempts without the complete hash remain manual; no historical hash is guessed.

No agent, dependency, generation prompt, calendar logic, UI component or generated file was changed. The optional schema field is not deployed. Existing approval, tenant, audience, suppression, contact-frequency, one-use dispatch and allowance controls remain in force.

## Primary documentation

Reviewed 17 November 2026:

- [Create Broadcast](https://resend.com/docs/api-reference/broadcasts/create-broadcast): draft creation and HTML/plain-text payload fields. The application continues to create with send disabled.
- [Retrieve Broadcast](https://resend.com/docs/api-reference/broadcasts/get-broadcast): returned broadcast identity, segment, sender, subject, HTML/text, reply address, topic and status.
- [Send Broadcast](https://resend.com/docs/api-reference/broadcasts/send-broadcast): the send-by-ID endpoint and ID-bearing response. This work adds no new OAuth scope, pricing assumption or account entitlement.

## Verification and limits

Final focused suite: 170 passing tests across eight files, 3.13 seconds. This includes the 14 initially failing cases, exact successful transmission/read-back, missing expected payload, malformed/conflicting provider fields, incorrect response identity, matching runtime draft/send payloads, a plain-text unsubscribe footer, recovery tampering and legacy-hash rejection, plus existing tenant/permission/contact-frequency/recovery tests. Root/Convex typecheck, scoped ESLint and diff checks pass. Exact commands are in Verification.

Provider tests use scripted HTTP responses and the runtime tests use controlled adapters. No live provider, model, browser, email, deployment or production-load test ran. Exact matching may withhold verification if the provider normalizes stored HTML, text or sender formatting; live normalization behavior remains unverified. The provider may also change after a read: these checks are not an atomic remote write lock and do not prove the exact delivered recipient set, delivery or customer outcomes. Existing optional scheduling support is not a newly verified scheduling workflow. Provider-default fields outside the declared payload, such as tracking configuration, are not comprehensively bound by this change. Full lifecycle enrollment/triggers/exits and broader requirement acceptance remain open.
