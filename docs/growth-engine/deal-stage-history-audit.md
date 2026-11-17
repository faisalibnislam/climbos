# Recorded sales stage history — 17 November 2026

The existing CRM retained only the current stage and latest transition timestamp. Requirements 113–116 and 120, and Book 11's buyer-progress and outcome-learning guidance, call for inspectable progress. No old journey was inferred from the current stage.

## Implemented

- Manual creation/updates, prospect progress, direct bookings, cancellation transitions and inbound capture now append dated stage events. The website-chat, landing-page, link-page and connected-product writers were traced. Recording timestamps describe ClimbOS capture, not a guessed external decision time.
- The helper records only actual transitions. Repeated same-stage writes, notes, value edits and qualification updates do not create stage events. Existing closing/reopening, booking identity, permission and webhook behavior remains unchanged; the history adds no new external action.
- The optional nested history retains the latest 100 events, a total count and whether recording began at creation. Legacy history stays unknown. Initial events record the initial stage without inventing transitions through earlier stages. Owner actor ids remain in the stored record; assistant output omits them.
- `crm.stageHistory` and the existing `get_pipeline view=history` return 20 complete events at a time with source distinctions, coverage and content-bound pagination. Changed records and unretained positions reject older-page requests. The assistant is instructed to distinguish recorded progress from buyer intent, payments or causal evidence.
- Customer progress exposes a collapsed Stage history section with earlier/latest navigation. A changed deal marks an open older page as a historical snapshot and requires returning to the latest record before further paging. Entry/review does not auto-submit a chat.
- Existing deal removal, bounded export and workspace purge cover the nested history. No new database table, agent, provider, forecast or probability model was added. Standard local Convex generation updated the API declaration for the new helper module.

## Verification

See Verification for commands. 85 focused tests across twelve files passed, including actual owner/prospect/booking/inbound writers, no duplicate transitions, legacy unknowns, 100-event retention, pagination/version boundaries, tenant/role checks, export/removal/purge and the actual assistant loop with a mocked model. Two desktop/mobile checks passed for paging, changed snapshots, unchanged consequential records, targeted axe/overflow and page errors. Mobile capture inspected. Typecheck and scoped lint are recorded alongside the final checks.

## Limits

No pre-existing transition history was backfilled. Retention is explicitly bounded. Stage edits are reports or recorded workflow events, not independent proof of a customer's intent, qualification or payment. Loss-reason edits and conversation transcripts are not stage events. No aggregate stage-conversion, calibrated close probability or causal sales analysis was introduced. Historical source completeness, real-model interpretation and business outcomes remain unverified. This closes a history-recording/review gap, not the full project scope.
