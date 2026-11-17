# Outgoing event delivery boundaries

17 November 2026. Scope: existing outgoing webhooks and original automation requirements 141/142/146/148. This is not customer lifecycle event ingestion or enrollment. The master-index route led to Book 13 sections on diagnosis, durable state, external execution and idempotency; actual `emitEvent`, delivery claims, transport, result recording, endpoint controls, cron and settings UI were inspected. The previously read installed Next.js client-component guide applies to the small settings change.

## Reproduced gaps

Three initial regressions failed: a paused workspace could claim a delivery; a delivery referencing another tenant's endpoint was accepted; and an inherited object property (`constructor`) was accepted as a subscribed event. Inspection also found that attempt results had no lease identity, crashed workers did not consume attempts, destination/permission changes were not checked immediately before POST, stored URLs could be silently truncated, and DNS resolution was not checked before transport. The schema comment incorrectly promised that leased rows were never posted twice.

## Implemented path

- Event validation now accepts own keys of the event catalog only. Overlong new URLs are rejected instead of truncated. Configuration, enable/disable, deletion and explicit test requests create audit entries without secrets or payloads. Test requests require an active destination and an unpaused workspace/fleet.
- Claim reads check tenant, endpoint subscription, destination validity, workspace existence/deletion/pause/suspension and the fleet stop. Paused work is deferred without blocking other due rows indefinitely. Invalid/orphan/cross-tenant destinations close without a new dispatch. Owner history also excludes mismatched-tenant rows.
- Each claim has a random attempt token, exact destination and payload hash. Attempts increment at claim, so lost workers cannot retry forever. The existing six-attempt limit and recorded-failure backoff remain; a reclaimed expired worker receives a different token.
- Before the first supported attempt, the JSON body gets `deliveryId` equal to its durable delivery record id. The same body/id survives retries and is covered by HMAC-SHA256 over `timestamp.body`. The request also includes `X-ClimbOS-Delivery-Id`; receivers should deduplicate the authenticated body id, not trust an unsigned header alone.
- `authorizeDispatch` checks the current token, unexpired lease, untouched payload, exact destination, subscription and live workspace/fleet state after DNS lookup and immediately before transport. It allows only one dispatch for that token and audits the start. Pause before dispatch releases the unstarted claim without consuming an attempt.
- Network work is isolated in `convex/webhookActions.ts` with the Node directive. Existing cron and queued `webhooks.deliverDue` references remain compatible through a forwarding action. DNS results must all be public according to the existing address validator; empty/private/mixed resolution blocks POST. Lookup is bounded to three seconds, requests to ten, with five concurrent deliveries and no redirects. Preparation failures remain distinct from uncertain post-dispatch failures.
- Results must match the current token and payload. Late results from superseded attempts cannot complete a newer attempt or change failure counters. Success requires an authorized dispatch and a 2xx code. Actual results are audited; HTTP acceptance does not establish what the receiver did.
- Previously attempted legacy rows without signed delivery identity stop with an explicit receipt-unknown explanation. They are not automatically replayed under a new identity. Never-attempted pending rows can acquire an identity on their first claim. Disabling an endpoint cancels future attempts but does not claim earlier receipt was impossible.
- The existing settings page displays the static failure/uncertainty explanation and receiver deduplication guidance. The exact approved-blog export fields, content version/hash and `publishAuthorized: false` remain unchanged.

## Verification

Final focused run: **62 tests across five files passed, 3.31 seconds**. The new suite covers pause, cross-tenant references/history, event-name validation, request/result fencing, payload/destination/subscription changes, fleet stop, suspension, bounded crashed-worker attempts, signed stable identity across retries, empty/private/mixed DNS, post-DNS pause, role checks, contradictory success codes and legacy unknown receipt. Existing outgoing-event, approved-blog export, platform operations, tenant and approval tests passed.

Desktop/mobile read-only checks passed in **20.8 seconds**, using inactive synthetic endpoints. They assert visible uncertainty/deduplication guidance, no horizontal overflow, no serious/critical targeted axe findings, and unchanged deliveries/audit/workflow/approval/receipt rows. No Test or enable button is clicked. The mobile capture was inspected. This does not establish full accessibility conformance.

Root/Convex type checks, scoped ESLint and diff checks passed. Only the isolated loopback backend was synced; the normal Convex workflow generated the new action's API types. Early expanded tests had invalid fleet fixtures and an array-driven test parameter shape; these fixtures were corrected before the final green run. DNS and HTTP are mocked in transport tests. No real receiver, paid model or hosted deployment was used.

## Receiver setup and remaining limits

Receivers must accept the additive `deliveryId` body property, verify the HMAC against the exact raw body and timestamp, enforce a suitable replay window, and deduplicate that signed id before consequential work. Strict receiver JSON schemas may need updating. No claim is made that Zapier, Make or a customer endpoint already implements that behavior. Legacy receipt-unknown rows require checking the actual destination; this batch adds no blind replay button or remote reconciliation API.

Delivery is at-least-once, not exactly-once. A network timeout or expired worker can follow a successful remote operation. Pausing cannot recall a request already dispatched. DNS checks happen before the normal HTTP client resolves/connects; this is not socket-level address pinning or proof against every DNS-rebinding race. Remote receiver behavior, live-network validation, sustained-load fairness and broader automation/lifecycle acceptance remain unverified or incomplete. All original requirements and later owner specifications remain in scope.
