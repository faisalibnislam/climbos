# Customer progress observations and lifecycle planning

17 November 2026. This implements a manual evidence path for customer lifecycle recommendations; automated event ingestion and enrollment remain unfinished. The original 410 requirements and later owner specifications remain in scope.

## Confirmed starting behavior

Read the master-index lifecycle route and Book 08 sections on relationship evidence, lifecycle states, onboarding exits, measurement and durable state. Inspected contacts/consent/suppression schemas, CSV import, marketing audience queries, shared planning context, the retention schema/validator, actual job orchestration, owner work output, and contact/workspace privacy paths. Read the installed Next.js client-component and Vitest guides before UI work; reused existing controls and event-driven mutations.

Contacts had segments, consent and delivery history. Business lifecycle described business maturity, not individual customer progress. Retention advice already required offering/value/trigger evidence and outcome rules, but there was no structured way to record a contact's dated progress in a product or journey. A segment named customers did not establish activation, retention or churn.

## Implemented path

1. In Connections, the uploaded-contacts card has **Customer progress**. An authenticated workspace member looks up a known email address. The server hashes it and resolves exactly one active tenant contact; it does not expose a raw contact list or guess ambiguous identities.
2. Members with `manage_connections` can record a product/journey scope, progress state, owner-defined criterion, evidence and observation date. Supported states are evaluating, started, activated, retained, expanding, at risk, exited and unknown; the owner interface uses plain labels. Signup, opens, clicks, consent or spend do not infer any of these states.
3. `marketing.recordContactProgress` verifies tenant, contact, role, expected revision, field limits and a real calendar date no later than the current UTC date. Dates are owner-selected calendar dates, not inferred event instants. A stale editor must reload. The mutation records the actor, recorded time and an audit event.
4. A tenant/contact-indexed `contactProgress` record stores the latest observation for each of up to 20 normalized product/journey scopes, the latest 20 history entries and total revision count. Updating one product does not replace another. Earlier history can be omitted and the UI says so. A correction can explicitly restore Unknown. The separate table keeps narrative history out of existing marketing recipient scans.
5. The existing `planningEmailAudience` reader joins up to 100 progress records to its up-to-1,000 active contacts. Missing, deleted, foreign, malformed, conflicting or future observations cannot become known customer states. Partial coverage is explicit; missing reports are unknown, not inactive. Up to eight complete groups reach the model, with omitted-group counts. Grouping requires the same normalized scope, state, criterion, evidence and date; the count is calculated over recorded contacts and is not a retention/churn rate or an independent customer count.
6. Shared business context receives the dated evidence and limits. The actual retention job also receives citable `fact:N` entries with `owner_reported` provenance and an owner evidence kind. No contact name, email, hash or user id is intentionally included in these generated group statements; owner-authored narrative remains untrusted text and is not automatically anonymized.
7. Before retention model work, the existing compute-checkpoint mechanism freezes the full input and progress evidence. Retries use that original snapshot; a newly started plan sees corrections. Real partially executed legacy runs without this snapshot stop with an explanation rather than relabeling earlier model work using current observations. Verified outputs retain the snapshot and fact references for inspection through the existing work-output view.
8. Contact deletion removes its progress record; workspace purge includes the new table. Workspace export includes up to 100 progress records with an explicit limited flag. Existing historical generated plans retain their saved evidence under the workspace's existing retention behavior; contact deletion is not a rewrite of earlier plan outputs.

## Authorization and scope

Saving an observation cannot create consent, enroll a contact, schedule, send, publish, change billing or spend. Existing sending eligibility and exact approval controls remain separate. An at-risk or exited observation is not itself an unsubscribe, and an activated/retained observation is not marketing permission. Current progress and entry/exit conditions must be checked before any proposed intervention; no new automatic action consumes these states.

The scope is a person in a named product or journey. This does not establish account, installation, subscription or order-level identity. Observations are historical owner reports; current activity, independently measured progress, causal lift and real commercial impact remain unknown. No arbitrary inactivity threshold or performance forecast is introduced.

## Verification

Focused backend, shared-helper and permission regression: **69 tests across seven files passed, 6.07 seconds**. Coverage includes record/read, absent progress, independent product scopes, explicit uncertainty corrections, stale-write rejection, invalid/future dates, missing evidence, privacy/role boundaries, recent-history caps, deletion, workspace purge, bounded export/planning, actual writer provenance, retry snapshots, new-plan corrections, and legacy retry rejection. Existing marketing, retention validation and approval suites remain green.

Desktop/mobile checks save an activated report, correct it to Unknown, inspect history, reload and confirm persistence. They compare consent, chat, workflow, approval, receipt, webhook and email-log records before/after. The first browser run passed both projects in 23.2 seconds, including no page errors, no horizontal overflow and no serious/critical automated accessibility findings. The mobile capture was inspected. Final verification commands/results are recorded in `docs/Verification.md`; this is not full accessibility conformance.

The initial isolated sync caught an import before the Node runtime directive in `jobs.ts`; that placement was corrected before successful sync and browser checks. The established local Convex workflow generated the API type update. No generated files were hand-edited.

Tests mock the model boundary; they prove evidence delivery, validation and persistence, not reasoning quality or owner comprehension. No paid model, provider operation, live message, hosted deployment, production-data import or new external integration was used. Engine revision: `v3.134-customer-progress-evidence`.

## Remaining lifecycle work

Automatic event ingestion, independently verified milestones, explicit machine-evaluated entry/exit rules, workflow enrollment, per-recipient rechecks at dispatch, contact pressure across every workflow, richer history/export coverage and live-model/owner evaluation remain incomplete. This evidence foundation must not be described as a finished lifecycle automation engine or as completion of all original requirements.
