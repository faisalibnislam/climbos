# Goal-first ClimbOS, local implementation

Implemented from the owner's approved conversational wireframes and subsequent correction that timing must fit the goal. Work remains local. This update does not import demo businesses, generate paid AI evaluations, publish, send messages, or change external accounts.

## Everyday flow

- Home starts with an understandable request or one actual item waiting for review. Suggestions fill editable text. The cost ceiling remains visible before submitting AI work.
- Your goals shows named saved goals and one recommendation at a time. Add or edit a goal in ordinary words; a real deadline is optional. Adding a goal and switching focus are deterministic, free database operations.
- Make it happen opens existing prepared drafts rather than charging to regenerate them. People can edit and save privately. AI discussion and alternative requests open editable contextual messages before submission.
- Your work defaults to the draft library, with AI activity, decisions and specialist tools in focused tabs. Saved edits remain attached to their exact plan and goal.
- The bigger plan, timing explanation, research, history and advanced controls stay available on demand. Main navigation has Home, Your goals and Your work. Results and existing customer tools remain under More.

## Timing contract

New focused AI jobs select preparation and first-review ranges, explain the reasoning and assumptions, state when to check progress, and distinguish outcome lag. Milestones use ordered relative-day windows selected for the approach, with actions and decision rules. Lints reject missing or reversed estimates, overlapping/gapped milestones, and a review that cannot allow preparation to finish. Sparse evidence is inconclusive, not a promise of success or failure.

The required legacy `horizonDays` field remains available for financial scenarios. It is explicitly distinguished from delivery timing in model context and is not offered as an owner-facing plan package. The focused task no longer receives this field as a mandatory milestone window. Existing detailed plans and historical milestones remain readable; their old day windows do not become new AI estimates. No existing plan has been regenerated for this UX verification.

## Data and permission boundaries

`organizations.focusedGoalId` selects the current goal. Revised goals link through `previousGoalId`; unrelated goals stay separate. Running strategy and request jobs retain their captured goal. Plan reads, context and version lists use that goal's thread. Approving a plan supersedes prior approvals within that thread, not a sibling goal.

`planDrafts` retains private edits separately from immutable strategy text, source evidence and approval hashes. Its write endpoint checks membership, role, exact plan/index, text bounds and expected revision. The editor preserves unsaved text on conflicting writes. Drafts are included in workspace exports and the workspace purge list. No publishable artifact or external-action job is created by saving.

The saved-work library is bounded: recent plans and up to 100 recent saved edits. Older plans remain in history. It skips unsaved drafts for archived goals so historical recommendations do not compete with current work.

## Verification

Local browser verification used the existing Livoform workspace. Its prepared pitch was opened and saved without changing the copy, then found under Your work. This created one real private draft record; the original plan and public accounts were unchanged. No synthetic goal was added to that real workspace.

Database tests use isolated fixtures for multi-goal selection, stable job binding, private edit persistence, optimistic conflicts, source-plan immutability, absent external jobs, exports, viewer restrictions and cross-tenant denial. Timing tests cover custom windows and invalid ranges. Existing plan-history regressions cover preservation of revised-goal history and restoration.

The local frontend is `http://127.0.0.1:3430`; Convex runs at `http://127.0.0.1:3330`.

Verified on 10 November:

- Full suite: 336 files, 2,159 tests passed (`pnpm exec vitest run --maxWorkers=2`).
- Type checks and full lint passed; the local production build passed.
- The running local backend was updated using the loopback-only script, preserving the existing database.
- Browser: actual Livoform recommendation, Make it happen, private save, retrieval outside the plan, editable suggestion with navigation preservation, contextual discussion handoff without submission, and 390px phone layouts for Goals and Work.
- The temporary verification request was cleared without submission. No paid model call, public send, website edit, new business, or synthetic goal was created for browser verification.
- Earlier browser automation tests were updated to the new labels/disclosures but not run in this pass; the browser checks above used the live local app.

## Limits

This change establishes the goal-first UI and persistence. It does not turn every request into a new goal automatically, infer private business facts, or grant AI unlimited execution rights. Existing data and approval requirements are preserved. The new timing contract is covered by offline/mocked AI regressions; no new live model-quality comparison was run for it.

## Owner's onboarding annotations, 10 November

The opening screen now reads **What's your wish?** and uses one centered message box with editable suggestions. Removed the glossary, AI-mode options, stage choices, form toggle, back link, autosave explanation, extracted-details preview, demo link, side panel, and explanatory paragraphs selected by the owner. Autosave still works. A business-name question appears only after submission if neither a name nor website can be inferred. Research cost remains visible before starting paid work.

The dedicated local evaluation account has an operator-granted business-count exemption. It requires both the account opt-in and the exact real-data loopback environment; hosted accounts and other local accounts retain their normal limits. The internal activation requires the existing $6 shared wallet ceiling. It does not increase the allowance, reset spending, create a subscription, unlock publishing, or change the overall $100 evaluation budget. New businesses share the same account period.

Verified: 337 test files / 2,165 tests passed; type checks and lint for the changed files passed. The production build passed with Next's supported Webpack option after the default Turbopack builder was blocked from binding a temporary process port. The running local backend was synced and the owner's count exemption activated successfully (`aiBudgetChanged: false`). Live browser checks confirmed all selected elements were removed, the existing Macloving message survived reload, and submitting a nameless wish asked one question without creating a business or starting AI research. The original message was restored afterward. No new paid API call was made, and no real business was created or deleted during these checks.

## Conversational business check

Replaced the facts checklist and business-details form with a centered conversation. Saved AI research is presented in small questions, with owner-supplied information kept separate from website research. Replies offer confirmation, correction, or uncertainty; corrections use a radio choice when several details are visible. Product and audience questions appear only when those categories are missing. There are no new mandatory currency, business-type, or measurement questionnaires. Existing business details remain unchanged.

The conversation retains its messages and unsent reply in this browser tab, keyed to the signed-in person and business. Fact changes themselves persist on the backend. Earlier messages collapse as the conversation grows. Sources remain available on demand. The new answer endpoint checks the exact displayed statements, applies a question atomically, preserves duplicate-fact handling, and enforces existing membership permissions. Continuing uses a separate endpoint that leaves skipped or unseen research unconfirmed; it never invokes the old confirm-all action. Confirmed/edited facts remain the existing engine's usable fact source.

This is a guided conversation over saved research, not a new paid model call for every click. Live browser verification used the owner's newly created `macloving-605o4` workspace: opened correction choices, checked the bounded reply field, canceled without editing, confirmed the already owner-stated name and goal, and verified the reply and next question survived reload. No product/audience answers were invented. All 339 test files / 2,170 tests passed, along with type checks and lint for the changed files. No new paid API call or external action was made.

## Goals, preferences and next steps as one conversation

`SetupConversation` replaces the goal cards, preferences questionnaire and final plan setup form. It carries the browser conversation forward from the business check. The server reuses an existing goal or the owner's original wish, keeps the existing approval policy, and moves straight to the costed plan action. A missing wish gets one question, with editable suggested replies and an optional research-derived focus clearly labeled as a suggestion. Saved website research remains available to the plan engine; website copy never supplies owner intent, ad-spending permission or publishing permission.

The free `prepareOnboardingConversation` mutation is idempotent, preserves existing goals/targets/budgets/policies, checks the expected goal before an explicit change, and does not create AI jobs. New goals use AI-selected timing. Legacy horizon fields remain financial-scenario inputs. New preferences default to the workspace's existing review-first policy and no ad budget unless supplied by the owner. The review-day question, model picker and mandatory approval-style question are removed. Goal, ad-budget and publishing changes are available as individual conversations on demand. Monetary input uses the workspace currency and its actual fraction digits; price/revenue/AI-budget text is not parsed as advertising permission.

Plan creation is an explicit quoted action. Progress is compact, with details on demand, and planned steps follow the actual starter/focused workflow. Removed the stale “90-day plan” progress label. Failure/revision states keep saved answers and offer a clearly costed retry. Ready plans open the existing recommendation rather than charging to regenerate it.

Verification: 341 test files / 2,180 tests passed; changed-file lint, type checks and a local Webpack production build passed. Additional access assertions confirm staff view-as remains read-only. Live browser testing carried the real Macloving wish through goals/preferences without re-asking it, then completed one real AI plan under a displayed 47-credit maximum within the existing local evaluation allowance. The account wallet remained capped at $6 inside the already reserved evaluation allocation; no refill occurred. A read-only check after that run showed $4.231315 spent and no reserved amount. No external publishing, email, ads or cloud deployment occurred.

The Macloving evaluation business was removed while its final page was being opened. It was not restored. Added an access-safe unavailable screen so removed/inaccessible businesses do not mount workspace widgets and throw unrelated query errors. Existing staff view-as access remains supported. The completed handoff was then verified with the remaining real Livoform workspace: conversational ready screen → “Show my next step” → the actual recommendation and prepared-work list. No new Livoform plan was generated for that check.
