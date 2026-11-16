# Owner understanding and progress: completion audit

17 November 2026. Scope: retained improvement requirements 11–20, the owner's chat-first instructions, and growth-intelligence Book 14 section 15. The original Downloads prompt is unavailable at its referenced path; the retained inventory supplies the numbered scope. This is a current path audit, not full product acceptance.

## Requirement reconciliation

| Row | Requirement | Current implementation and evidence | Remaining acceptance work |
|---|---|---|---|
| 11 | Plain business language | Home and `GoalWorkspace` lead with next steps; the new `PlanCheckSummary` exposes saved reasons without raw schema paths/rule names. | Model-written explanations can still use jargon; representative comprehension testing remains. |
| 12 | Support owners unfamiliar with marketing | Why this plan, editable Talk it through requests and structured owner questions provide explanation and unknown choices. | No broad novice-owner evaluation establishes understanding. |
| 13 | Avoid information overload | Main plan separates Next steps, Strategy options, Prepared work, Why this plan and Research; detailed checks use disclosure. | Cognitive load and time to a useful decision remain unmeasured. |
| 14 | Explain the next action | Home selects saved work; plan timeline exposes steps and existing private-work preparation. Failed plans now show the reason and an editable explanation request. | This does not establish that every recommended next action is commercially correct. |
| 15 | Keep simple tasks simple | Saved drafts open without regeneration. The assistant now appends contextual discussion requests to existing unsent text instead of overwriting it. | Broader task completion and editing-effort benchmarks remain. |
| 16 | Explain recommendations | Why this plan retains rationale, offer economics, timing and direction. Failed-check reasons and fixes are now available on the main plan. | Saved explanation visibility does not prove its truth or causal validity. |
| 17 | Distinguish urgent from optional | Failed, provisional and stale-input states are distinct; blocking checks precede optional strategy/research detail. | No universal business-urgency classifier or validated urgency ranking is claimed. |
| 18 | Adapt explanation depth | Optional discussion and expandable details offer simpler explanations on request. | Persistent adaptation to the owner's knowledge level is not established. |
| 19 | Reduce dashboard overload | Primary navigation is Home, Your goals and Your work; specialist tools remain available through secondary navigation. | App-wide usability and accessibility remain unverified. |
| 20 | Communicate progress | `RunProgress` uses recorded workflow steps; `PlanTimeline` uses saved task completion, and experiments expose reported results separately. | Completed tasks do not prove customer/revenue progress; provider failures and all journey states were not exhaustively exercised here. |

All ten broad rows remain partial. This replaces the old generic UX description for the inspected path, not the remaining 390 requirements or later owner specifications.

## Confirmed gaps closed

The main failed-plan callout previously said only that AI found issues; the actual saved reasons were buried in advanced research review. It now shows the first saved reason immediately and retains other reasons/fixes behind What needs fixing. Legacy missing explanations are explicitly unknown. The existing paid repair action is unchanged.

Explain these checks selects the saved plan and fills an editable Climb AI request. Browser testing then exposed a second gap: consuming a queued request replaced existing unsent composer text. The shared panel now appends it using current state, with stable effect dependencies and cleanup to prevent canceled/replayed queue consumption. The provider remains keyed by workspace and user in `AppShell`.

No recommendation, approval, execution, provider, schema or engine prompt was added. Opening or discussing a check does not submit a message, charge for generation, approve a plan, complete a task or start external work.

## Verification and limits

The browser regression first failed because the saved reason was absent, then reproduced the lost draft after adding the explanation control. Final desktop/mobile runs pass for the new explanation flow and existing grounded/adjacent/bold discussion flow. The new test checks exact draft text, preservation of the owner's question, no duplicate queued text, and unchanged workflow, approval, receipt, artifact, message and task-progress rows. Screenshots were inspected at both viewports; targeted axe serious/critical and overflow checks passed. Development issue badges remain visible; this is not a claim of an issue-free application or full WCAG conformance.

104 focused unit/Convex tests across 11 files, root and Convex type checks, scoped ESLint, and four browser tests passed. Exact commands are in `docs/Verification.md`. No live-model evaluation, paid work, external send, publication or deployment occurred. The older `e2e/focused-experience.spec.ts` contains expectations for an earlier demo layout and was not run or reconciled in this batch; no full-suite green claim is made.

Next: continue the requirement audit into intelligence/evidence and decision quality. Carry forward the unresolved owner-usability and adaptive-explanation requirements rather than marking them complete from fixture tests.
