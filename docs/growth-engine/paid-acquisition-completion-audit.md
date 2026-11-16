# Paid acquisition eligibility in focused plans

17 November 2026. Scoped follow-up to retained requirement 33 (knowing when paid advertising is a bad idea), within the ongoing strategy audit. This is not acceptance of all strategy requirements or evidence of commercial effectiveness.

## Confirmed path and gap

`workspace.setUnitEconomics` records supplied economics/capacity. `jobs.buildStrategy` obtains the business context and deterministic diagnosis, then uses `constraintsOf` for focused/starter generation. Those routes call `focusedStrategySpec` or `starterStrategySpec`, persist quality through `jobWrites.saveStrategy`, and expose the saved plan for owner review. `workspace.decidePlan` and `workspace.startPlay` reject plans whose quality cannot drive work.

The existing channel scorer (`shared/acquisition/scoring.ts::limitChecks`) already blocked paid acquisition for supplied non-positive contribution margin or a supported activation, conversion, retention, delivery or economics constraint. The default focused/starter route did not run that scorer, and its shared `lintPlanFit` checked budget but not those same conditions. Owner margin also did not reach that shared validation contract. A model could therefore allocate paid spend within budget despite the same business being ineligible in the scored path.

## Repair

- Extract the existing policy into `paidAcquisitionBlocks` and reuse it in scoring and `lintPlanFit`.
- Carry the recorded owner margin through `constraintsOf`, preserving zero, negative and absent values.
- Reject explicit positive `suggestedMonthlyAdSpend` when that policy blocks it. Only a supported, non-unknown diagnosis supplies the diagnostic block. Ambiguous, conflicting or insufficient evidence does not become a supported constraint.
- Make `paid_acquisition_fit` a hard quality finding with a plain-language explanation and exact channel field, using existing owner review and approval enforcement.
- Keep zero-spend preparation and the separate grounded/adjacent/bold exploration unchanged. Unknown margin alone does not reject a bounded proposal. A passing eligibility check is never spending authorization.

No new agent, provider, integration, prompt, database field or UI component. Engine version: `v3.120-paid-acquisition-fit`. The existing focused, starter and detailed strategy specs all use `lintPlanFit`.

## Evidence

Eight unit cases cover both focused schemas, all five supported non-acquisition constraints, zero/negative/positive/unknown margins, uncertain diagnosis, unpaid preparation and retained low-evidence bold options. Six added actual Convex generation cases exercise both focused/starter paths using owner mutations for zero margin, negative margin and zero delivery capacity. They verify saved failed quality, blocked approval/start, preserved bold options, no action receipts and no granted approvals.

The focused run passed 122 tests in eight files, including existing channel limits, demand checks, quality, unknown economics, tenancy and approval-claim tests. Root and Convex type checks and scoped ESLint passed. Exact commands are in `docs/Verification.md`. No browser, paid-model or live-provider evaluation ran in this batch.

## Remaining work

This validates explicit structured paid allocations; it does not semantically recognize every paid tactic concealed in natural-language prose, retroactively revalidate old plans, prove the diagnosis is causal or establish expert-level recommendation quality. Owner inputs are not independently verified. The policy reuses the existing product decision; this batch does not establish that paid experiments are universally inappropriate for every business with these constraints. Creative hypotheses remain available outside immediate execution recommendations.

Requirement 33 remains partial at its broad scope. The remaining requirements 31–40 need continued path-by-path reconciliation and business-quality evaluation; they are not closed by this repair. Next audit focus: channel selection and consistency between the proposed move, channel allocations and prepared work, preserving unconventional alternatives.
