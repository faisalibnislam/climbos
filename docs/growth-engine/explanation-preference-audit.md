# Personal explanation preference and request binding

17 November 2026. Scope: original improvement row 18 and the owner-understanding workflow, informed by growth-intelligence Book 14 section 15. This closes explicit preference persistence and a reproduced request-binding defect; it does not complete the broad adaptive-explanation requirement.

## Observed path and change

The existing Profile page stored personal name, digest and usage-alert settings through authenticated `settings.preferences` / `settings.updatePreferences`. Climb AI used one shared short-answer default. Expandable plan detail existed, but no saved personal explanation preference reached an assistant request.

Profile now offers Concise, Guided and Detailed through the existing radio cards and explicit Save action. The existing `userPreferences` row stores the enum per authenticated user across workspaces. Omitted fields from older clients preserve the saved choice, and missing legacy values default to Concise. There is no caller-supplied user id or inferred competence label.

`climb.send` reads the authenticated person's choice and snapshots it on the user message and workflow input. `climb.respond` appends allowlisted static guidance from that message snapshot after its existing cached rules. Changing settings while a request is in flight cannot change its selected depth. Old messages without a snapshot retain the concise default. An explicit request in the current message takes priority.

Guidance applies to explanations for the owner. It does not change a customer's brand voice or the requested format of generated public content. Every mode retains material uncertainty, evidence labels, required approval choices and grounded/adjacent/bold strategy options when relevant. Detailed responses remain subject to the existing model/output budget; no provider or route changed.

A new regression reproduced `climb.context` accepting one message with another same-workspace processing run. Context now requires the exact message/run link, matching creator and `climb_chat` kind as well as matching tenant. A mismatched pair returns before a model call. Existing public action authentication and permission checks remain in place.

## Verification

- Seven new backend/helper cases cover default and omitted settings, another user's privacy, unauthenticated denial, all three depths at the actual assistant model boundary, in-flight stability, wrong-run rejection, invalid values and legacy messages.
- Six focused suites passed: 32 tests in the final recorded rerun (3.53 seconds). Relevant assistant context, tool-output, approval-claim and tenant suites are included.
- Root and Convex TypeScript checks passed. Scoped ESLint and diff whitespace checks passed.
- Desktop and mobile Playwright checks passed in the isolated loopback demo. They save Guided and Detailed, reload and inspect persistence, preserve other users' settings, and assert no new chat/workflow/approval/receipt/webhook/email-log records. No page errors, horizontal overflow or serious/critical automated accessibility violations were detected in the tested state. The mobile capture was inspected; full-page capture includes the fixed navigation overlay and development badge. This is not full accessibility conformance.
- The first focused run exposed the wrong-run bug (5/6 passed); it was fixed before the final seven-case suite and 32-test combined result.

The model boundary is mocked: tests establish delivered guidance, not real-model obedience, comprehension or better business outcomes. No paid model evaluation, hosted deployment, external message or publishing action was used. Only the isolated local backend was synced.

## Remaining scope

This is an explicit personal preference, not inferred knowledge-level adaptation. Generated plan writers and public marketing copy do not inherit it. Comprehensive novice-owner evaluation, jargon handling, decision comprehension, task completion and all 410 original requirements plus later specifications remain open. No new execution authority, approval bypass or autonomous work starts when this preference is saved.
