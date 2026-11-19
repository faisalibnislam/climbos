# Authenticated product milestones — 19 November 2026

## Confirmed gap and complete path

The audit followed `convex/http.ts`, agent-token/MCP authentication, analytics imports, customer progress, saved follow-ups, lifecycle planning, email preview/approval/dispatch and privacy workflows. Existing GA4/billing aggregates, owner observations and provider email receipts did not implement person-level product event ingestion. The growth corpus describes this architecture but was not treated as evidence it already existed.

The implemented path is **owner-defined event mapping → authenticated server POST → tenant/contact lookup → deduplicated source receipt → dated customer progress → existing planning and follow-up checks → exact owner email review → unchanged action boundary**. Owners configure it under **Customers → Product tracking**. It uses existing Convex HTTP actions, hashing, tenancy/permission checks, progress records, email controls and audit conventions. A dedicated write-only key is necessary: existing MCP tokens automatically include read access and are intended to act as agents. Product keys cannot read workspace data or use MCP. No agent, model, provider, calendar or analytics dependency was added.

## Behavior and evidence

- An owner/admin names a product scope and source and defines 1–8 exact event names, progress states and meanings. No activation/retention definition is invented for Livoform or any other product. Definitions are immutable; changing meaning requires revoking that source and creating a replacement. Historical reports keep their original source and definition.
- Server-side integration sends exactly `eventId`, `email`, `event`, `occurredAt`. The UTC-normalized occurrence timestamp must include an offset and be within the preceding seven days, never in the future. Arbitrary properties and tenant/scope overrides are rejected. The email matches one existing active tenant contact; unknown/ambiguous contacts are rejected, not created. Browser/app embedding of the secret is explicitly prohibited in setup guidance.
- Full random 256-bit keys are shown once. Only their hashes/prefixes are stored; they expire after one year. Rotation invalidates the old key. Revocation is permanent for that source. Every receipt transaction rechecks key expiry, current credential-owner membership/permission, workspace suspension/removal/emergency stop and fleet pause, including retries. Credentials can be rotated by a current authorized owner/admin while preserving the original definition author.
- Stable event IDs are hashed and deduplicated within the source. An identical retry returns the previous outcome without another observation. Changed payload under that ID is a conflict. Event order uses occurrence time, not delivery order; older events remain receipts without reversing progress. Incompatible milestones at the same timestamp set progress to Unknown until a newer observation or explicit owner correction resolves it.
- Source observations remain `source_reported`, with source, event, occurrence and receipt times. A receipt proves an authenticated report arrived, not independently verified activation, revenue or customer value. No event absence is interpreted as inactivity, churn or retention.
- Owner corrections take precedence, including Unknown. Later events for that scope are retained as `owner_override` receipts rather than silently replacing the correction. Other product scopes remain separate. Current reports and the most recent 20 revisions remain inspectable in the existing progress dialog.
- Existing enabled follow-ups can consume this dated progress. A changed milestone holds/exits existing entries immediately; the periodic tracker handles eligible enrollment under its existing consent and capacity bounds. Every due email still requires current exact-content/version/recipient/destination approval. Ordinary email preview uses the same observation hash, so changed progress invalidates the previous recipient preview/approval evidence.
- Existing planning receives bounded aggregated source-labeled progress, without email addresses or keys. The actual retention writer and frozen evidence snapshot retain the correct provenance; source reports are not relabeled owner-reported or measured.
- No consent, suppression, live price, approval, send, publish, billing or spend write occurs on intake. No paid/provider call or model job occurs. Unsubscribe handling remains separate. A deletion suppression prevents resurrecting erased telemetry even after contact re-import.

## Bounds, privacy and operations

- 20 retained source configurations per workspace, including revoked history; one unrevoked source per normalized product scope.
- 120 authenticated attempts per source per minute; 4 KB actual streamed body limit, even without Content-Length. Rejects extra properties.
- 1,000 retained event receipts per workspace. At capacity new events return a hold rather than being silently dropped. Identical retries remain recognizable while retained. This is deliberately bounded milestone intake, not a high-volume clickstream service.
- Daily cleanup removes receipts older than 30 days, in 500-row batches. Old timestamps cannot be replayed after this retention window because new receipts accept only seven-day-old events. Stored progress remains dated history, never refreshed by cleanup.
- Receipt storage contains hashed email-derived payload identity/event ID, an existing contact ID, event name, times and outcome; it does not store raw request bodies, email addresses, arbitrary event properties or full credentials. IDs should be opaque and stable.
- Workspace export includes definitions and receipts without credential hashes. Contact deletion removes associated receipts and progress before recording completion; workspace purge includes both new tables. Existing approval/audit retention is unchanged.
- Owner setup must send from the actual product server and instrument real milestones. There is no browser SDK, historical backfill, external vendor sync, inferred identity merge, account/subscription-level lifecycle, complete funnel/cohort analysis, automatic inactivity detection, or revenue attribution. Receipt counts are not customer counts or completeness claims.
- HTTP outcomes: 200 applied/older/owner_override/conflict (with duplicate flag); 400 invalid/unmapped/dated-outside-window; 401 unavailable credentials; 409 reused ID conflict or scope capacity; 413 body too large; 415 wrong content type; 422 unavailable contact; 429 source rate/workspace receipt cap; 503 retry the same ID after a transient processing failure. Permanent validation errors require correction, not blind retries.

## Changed paths

- `shared/growth/productTracking.ts`, `convex/productTracking.ts`, `convex/http.ts`, `convex/crons.ts`, `convex/schema.ts`: contract, configuration, authentication, transactional receipt processing and retention.
- `convex/lib/customerProgress.ts`, `shared/growth/customerProgress.ts`, `convex/jobs.ts`: attributed observations and planning evidence.
- `convex/lib/progressJourneys.ts`, `convex/lib/customerJourneys.ts`, `convex/marketing.ts`: shared immediate eligibility reconciliation; existing send controls retained.
- `convex/settings.ts`: export, contact erasure and workspace purge.
- `ProductTracking.tsx`, `WorkspaceHub.tsx`, `CustomerProgressDialog.tsx`, `CustomerJourneys.tsx`, `EmailSendPanel.tsx`: setup/receipts, source labels, current workflow wording and existing progress review.
- `convex/_generated/api.d.ts`: generated only through the established isolated local sync workflow.
- `tests/convex/product-tracking.test.ts`, `tests/convex/customer-progress.test.ts`, `e2e/product-tracking.spec.ts`: HTTP, data/provenance, permissions and owner workflow coverage.

## Verification

Local synthetic fixtures only. Paid API calls remain paused at the existing $100 cap; the $99.063401 used/held ledger was not changed. Runtime model routes, quality thresholds and budgets were not changed. No hosted deployment, email, customer contact, publishing, live offer or paid test was performed.

```sh
pnpm exec vitest run tests/convex/product-tracking.test.ts tests/convex/customer-progress.test.ts tests/convex/customer-journeys.test.ts tests/convex/marketing-authorization.test.ts tests/convex/marketing.test.ts tests/convex/contact-frequency.test.ts tests/convex/contact-frequency-history.test.ts tests/convex/customer-data.test.ts tests/convex/lifecycle-draft-context.test.ts tests/convex/planning-email-audience.test.ts tests/convex/channel-cache.test.ts
pnpm typecheck
```

270 tests across 11 related files passed (16.10 seconds), including actual HTTP routing and the mocked retention-writer boundary. App and Convex typechecks passed. Changed-file ESLint passed with the final visual correction.

Initial desktop/mobile product-tracking scenarios both passed. Visual inspection then exposed a generic error callout rendering when there was no error; it was corrected and the browser test now explicitly rejects that state. Final combined browser results are recorded below. This is scoped automated accessibility/interaction verification, not a full WCAG conformance claim. Initial backend failures were two new test fixtures using the wrong export contract and omitting a required business ID; those fixtures were corrected, then the complete focused matrix passed.

Fresh Livoform model quality, real telemetry coverage, actual customer outcomes and production integration remain unverified. This work does not turn prior failed paid strategy tests into a quality pass.

Final combined browser command (loopback fixtures):

```sh
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE="$PWD/bench/cache/offline-audit-20261118/backend.env" pnpm exec playwright test e2e/product-tracking.spec.ts e2e/customer-journeys.spec.ts e2e/lifecycle-email-audience.spec.ts --workers=1
```

**All six cases passed** (43.2 seconds): three desktop and three mobile, including the new no-false-error assertion. The settled desktop and mobile layouts were inspected.

## Owner recovery: return from a correction to future events

A manual correction intentionally blocks telemetry replacement. The audit found it lacked a recovery control. **Customer progress → Use future events for [product]** now explicitly releases that override for one available same-tenant source, retains the correction in history, and records an owner-reported Unknown state. Only a new event whose occurrence is strictly after the choice can replace it. Queued earlier events and duplicate old deliveries cannot restore a corrected value. A later manual correction cancels this selection again. A revoked waiting source can be replaced with a newly configured source without changing historical attribution.

The mutation checks current management permission, contact/source tenant, source availability, exact progress revision and matching product scope. It holds existing follow-up entries through the same reconciliation helper and creates an audit record, never consent or execution authorization. The existing progress dialog shows the boundary time and preserves separate source/owner labels. No new schema table, runtime model or provider was added.

The extended desktop/mobile browser scenario passed both cases (12.6 seconds), exercising correction → Unknown → future-event selection → harmless old duplicate → fresh source milestone → revocation, with no approval/send/job changes. Focused test totals are recorded in the ledger.
