# Exact reviewed email delivery — 19 November 2026

## Confirmed gap and existing path

Saved customer journeys already tracked due steps, versioned content, progress evidence, consent, suppression and frequency. The owner could review the exact eligible audience, but `marketing.approveSend` immediately queued execution. There was no durable owner-visible future delivery choice, cancellation or cleanup for an approval that never started. Existing provider execution already claims once, rechecks before dispatch, and retains uncertain outcomes for read-only reconciliation.

Read the repository instructions, growth index, relevant lifecycle/execution guidance, installed Next client-component guide and existing permission tests. The corpus's proposed lifecycle architecture was not assumed implemented. No provider API, dependency, agent or runtime model changed.

## Implemented

- Existing email review offers delivery now or an explicit local date/time. No suggested campaign timing or default future time is invented. The confirmation shows the exact local time and timezone offset; nonexistent daylight-saving times are rejected. Repeated local times resolve to an explicit instant shown before approval.
- Owner-selected delivery must be at least one minute ahead and within 23 hours. The one-hour attempt window must fit the current allowance period. These are authorization bounds, not recommendations about effective send times.
- Scheduled approvals require a current audience preview. The approval hash binds timestamp/window in addition to the existing tenant, email content/version, recipient set, destination, sender, credential, policy, reservation and optional journey revision/step. Later steps and new recipients are never authorized implicitly.
- The existing Convex scheduler invokes the same one-attempt send executor. Early invocation does not claim or contact the provider. Both claim and final dispatch recheck content, current audience/progress/consent/suppression, permission, plan/pause, frequency and the original allowance period. A closed window or changed evidence refuses delivery. Provider preparation may have occurred before a final refusal; it cannot authorize a send.
- The email screen retains pending delivery across reloads. Owners/admins can cancel before the execution claim, releasing the exact held allowance transactionally. Cancellation cannot recall a started email or resolve an unknown provider response.
- A bounded indexed cleanup every 15 minutes closes expired unstarted email approvals, including older immediate approvals that never started. Started or uncertain attempts remain with existing recovery; cleanup does not retry or contact a provider.
- Confirmed shared-account gap: existing send settlement/recovery only accepted a period owned directly by the workspace even though reservations can use its account's allowance. The shared period check now accepts the workspace or its exact current account, retaining reservation tenant checks. Cancellation, successful delivery and uncertain outcomes are tested against shared periods.

## Verification

- `pnpm exec vitest run tests/unit/email-schedule.test.ts tests/convex/marketing-authorization.test.ts tests/convex/customer-journeys.test.ts tests/convex/customer-progress.test.ts tests/convex/contact-erasure.test.ts` — **189 passed, five files**.
- `pnpm typecheck` — app and Convex passed.
- Scoped ESLint and `git diff --check` passed.
- Loopback-only `playwright test e2e/scheduled-email.spec.ts e2e/lifecycle-email-audience.spec.ts --workers=1` — **four desktop/mobile cases passed**. Scheduling exercises real local approval, persisted exact timestamp, reload, cancellation and reservation release. Only list discovery is simulated; the fixture has no provider credentials. Existing recipient review and changed-progress exclusion also pass. Serious/critical automated accessibility and overflow checks pass; the mobile confirmation screenshot was inspected. This is not full WCAG certification.
- Initial new tests used wrong fixture fields for suppression, pause and reserved meters; corrected to actual schema. The first browser run selected `dialog` instead of the existing `alertdialog`; corrected without weakening the assertion. All corrected cases pass.

## Boundaries

This is bounded unattended delivery of one exactly reviewed email, including a due saved follow-up step. It is not blanket recurring authorization, approval for unknown future recipients, automated sequence generation or a full lifecycle automation builder. A changed audience holds the whole send for fresh review rather than silently substituting recipients. Owners need their own eligible provider account, exact list, verified sender and allowance. Delivery time is an attempt window, not a guaranteed inbox arrival time. Local mocks verify authorization and state transitions, not real deliverability, customer outcomes or fresh AI strategy quality. Paid tests remain paused; no model, live campaign, deployment or budget changed.
