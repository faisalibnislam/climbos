# Strategy reference approval — 17 November 2026

Engine: `v3.145-strategy-reference-approval`.

## Confirmed gap

`lintStrategyExploration` already rejected out-of-range facts, unread URLs, unrecognized reference strings and unretrieved precedent IDs. However, `exploration_evidence` and `creative_precedent` were absent from `HARD_RULES`. `agentQuality` recorded errors but `planQuality` could classify the plan as provisional, describing the findings as smaller wording/focus checks. `canDriveWork` trusted that summary state; owner approval could therefore proceed despite the recorded unsupported citations. A passing model critic did not resolve the invalid references.

The real focused and starter job regressions reproduced both errors: the stored plan was provisional, even though generation lint rejected its citations.

## Implemented behavior

Both existing citation error rules are now hard findings with readable explanations. The original options and citations remain saved and inspectable; the owner can request correction. Invalid claimed evidence prevents approval or starting work. For older plans with retained agent-error counts, `canDriveWork` checks recognized hard errors as well as the summary label, so an old provisional label cannot bypass the current rule. No historical result or status is rewritten. The default goal workspace now shows the current block and a refresh explanation for retained errors; the detailed review card disables approval using the same guard. Both preserve the saved explanation and readable drafts.

This does **not** require a bold idea to have a precedent, high confidence or immediate feasibility. An original, explicitly speculative idea with no citations and low evidence/feasibility remains eligible for review. The existing missing-citation warning remains a warning. A claimed source must resolve; absence of precedent is not an error. Grounded, adjacent and bold options are not deleted, rescored or collapsed into an execution ranking.

The shared quality path is used by focused/starter and detailed plans; detailed growth-play quality retains the original exploration findings. Existing tenant, exact approval, destination and budget enforcement remain unchanged. There is no new model call, agent, integration or execution side effect.

## Verification

Five initial unit failures plus two real-job failures demonstrated the gap. After the fix:

```sh
pnpm exec vitest run tests/unit/plan-quality.test.ts tests/unit/decision-structured.test.ts tests/unit/creative-precedents.test.ts tests/unit/focused-plan.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts
```

**319 tests passed in eight files, 14.21 seconds.** Tests cover unsupported facts/URLs/reference strings, an unretrieved case ID, uncited original bold hypotheses, stale provisional summaries, real focused/starter persistence, owner approval/start refusal, inspectable options and no action receipts. Four component assertions in two files also passed. Application/Convex typechecks, changed-file ESLint and diff checks passed. The Next.js client-boundary guide and React review guidance were applied; state is derived during rendering without new effects or fetches.

`CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env E2E_BASE_URL=http://127.0.0.1:3420 pnpm exec playwright test e2e/plan-check-feedback.spec.ts --workers=1` — **four desktop/mobile checks passed, 18.2 seconds**, including the existing editable explanation-composer flow. Initial browser checks exposed that the default goal workspace also needed the shared guard; it is now covered. Screenshots were inspected, no horizontal overflow or serious/critical automated accessibility finding was detected on these views, and authority records stayed unchanged. This is not full accessibility conformance.

## Limits

Reference resolution is not semantic proof that a source supports the inference, nor proof of business results. Legacy plans with no retained errors cannot be reconstructed from absent evidence and retain the existing compatibility behavior. Historical stored summaries remain unchanged, but both current owner views explain the block and approval is refused until refresh. Only the dedicated loopback demo was synced; no hosted deployment or live external action was exercised. Full specification acceptance remains incomplete.
