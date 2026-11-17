# Focused strategy evidence review — 17 November 2026

## Review continuity and mechanism-first exploration — v3.157

The next audit confirmed that `draftOnce` forwarded only the critic's short top-level fixes list, dropping specific per-criterion reasoning and corrections. A failing runtime regression reproduced that loss. Focused revisions now receive bounded, recognized, non-duplicate criterion feedback, ordered by score, alongside existing strengths and assessed lint. Other rubrics keep their previous feedback path. Suggestions cannot override evidence, the schema or approval requirements.

The focused review instructions now cross-check an offered text asset against its complete `preparedWork` entry before declaring it missing. An authored outline can be ready for review without being a functioning form, tested integration or published URL. This is reviewer guidance, not a deterministic proof of semantic correctness. The acceptance bar and unsupported-claim enforcement are unchanged.

The protected exploration block appears once, earlier in the same focused task, with version `focused-exploration-v2`. It asks for distinct value exchanges and participant behavior before the primary tactic is selected, distinguishes structural changes from renamed concierge/reseller programs, and preserves grounded, adjacent and bold options with separate uncertainty dimensions. The duplicate bold paragraph was consolidated into that block. No Livoform-specific answer, new agent, provider, dependency, timing change or runtime model switch was added.

Verification: the new feedback case failed before the fix and passed afterward. The ten-file focused/permission command below initially returned 166 passes plus one stale prompt-version expectation; after updating that expectation, all 94 tests in the three affected files passed (15.41 seconds). The other seven files had passed unchanged. App and Convex `pnpm typecheck`, changed-file ESLint and `git diff --check` passed. These are local/mocked checks, not commercial outcomes.

```sh
pnpm exec vitest run tests/unit/focused-evidence-review.test.ts tests/unit/focused-plan.test.ts tests/unit/focused-learning.test.ts tests/unit/agent-escalation.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/safety.test.ts tests/unit/evaluation-identity.test.ts tests/unit/livoform-launch-input.test.ts tests/unit/strategy-prompt-cost.test.ts
pnpm exec vitest run tests/unit/focused-evidence-review.test.ts tests/unit/agent-escalation.test.ts tests/convex/focused-plan.test.ts
pnpm typecheck
```

Paid retest `launch-quality-v5-20261117` uses the same frozen public-source/owner-report evidence and unchanged runtime model. Its result must be inspected separately before claiming a quality improvement. The pre-run cumulative charged/held total was $61.841945 of $100.

## Confirmed gaps

The approved public launch acceptance failed quality at 3.75/5. Inspecting its actual output found unsupported qualitative business-state and comparative claims despite a passing automated truth gate and no lint findings. Its next-step workload, paid-value reasoning, alternative comparison, exposure handling and originality also needed improvement. The original run remains unchanged; see [acceptance audit](public-launch-acceptance-audit.md).

## Implemented path

Engine `v3.154-focused-evidence-review` extends the existing focused/starter strategy writer → critic → revision → quality → owner review path. It adds no agent, provider, action or integration.

- The focused critic must return three evidence-audit categories: business state, comparative claims, and capabilities/results. Each contains exact current-draft quotations and paths, supported/qualified/unsupported judgments, evidence explanations and corrections. Empty categories require an explanation.
- Runtime validation rejects incomplete/duplicate categories, malformed records and quotations absent from the current draft. Unsupported findings become existing hard `invented_fact` errors even if the model gives all gates and scores a pass. Existing approval and start boundaries retain those findings.
- The revision receives the complete assessed findings, including those produced by review validation, rather than only pre-review lint. Focused revisions cannot reuse a previous draft's semantic audit through the generic fast-review shortcut. Other rubrics retain their existing behavior.
- Existing focused-plan instructions and rubric anchors now require a concrete competing customer job/mechanism; locally qualified unknowns; paid value beyond free/current alternatives and relevant cost/support uncertainty; one coherent first action; conditional later exploration; separate exposure/activation/payment/repeat-use observations; and not-run handling for zero exposure. Bold exploration remains protected and is judged on the mechanism, not its label or presence of precedent. Numeric quality thresholds are unchanged.
- The approved paid harness fingerprints the new review module, and its focused recovery path uses the same review contract. Historical files are neither overwritten nor relabeled. No campaign-timing instructions were changed.

No new owner-facing fields or production storage contract were needed: the existing plan fields carry the improved recommendation, and existing quality findings explain blocked drafts. The fake-provider audit is explicitly synthetic, not semantic evidence.

## Verification

Seven failing cases reproduced missing/duplicate review acceptance, ignored unsupported claims, invented review quotations and stale final review. After the fix:

```sh
pnpm exec vitest run tests/unit/focused-evidence-review.test.ts tests/unit/focused-plan.test.ts tests/unit/focused-learning.test.ts tests/unit/agent-escalation.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/safety.test.ts tests/unit/strategy-prompt-cost.test.ts tests/unit/evaluation-identity.test.ts tests/unit/anthropic-budget.test.ts tests/unit/livoform-launch-input.test.ts
```

**197 tests passed across 12 files (11.47 seconds).** Includes actual mocked generation → persisted failed quality → approval/start rejection with no action receipts, plus original qualified hypotheses remaining acceptable. App/Convex typechecks, changed-file ESLint and diff checks passed.

## Limits and paid follow-up

### Latest status and next engineering pass

**Safeguards verified; overall strategy-quality improvement not established.** All implementation batches remain on `codex/trend-evidence-freshness`: `6813520e` (semantic evidence review), `8afa0b99` (same-evidence comparison), `e1e37d91` (shared protected task and consistent verdicts), and `32973545` (paid-outcome precision). No deployment or external business action occurred. The owner's pre-existing `.gitignore` change is untouched.

The owner requested a Codex-model switch only when needed. A switch to Astra for the remaining engineering/design work was requested after repeated conventional outputs and inconsistent reviewer judgments; no runtime model was changed. All paid processes have finished. The original provider route, scoring thresholds and cumulative cap remain intact.

Variant `launch-quality-v4-20261117`, engine v3.156, source hash `1179f9080e5c2471ea648e4503d1275ad71c145e9ad264a269130591e778433d`, completed three metered calls for **$0.570983**. The first draft preserved the corrected intent/payment distinction and economic actor boundary, but failed quality at **3.5 average, minimum 3**. Its optional revision returned an 83-character exploration duration against the existing 80-character schema limit. The engine correctly retained the reviewed first draft and recorded `invalid_output`; no final review of the invalid revision occurred. The bound was not silently widened and the result was not manually converted into a pass.

Inspection also found a likely reviewer false positive: it rejected an invitation offering an outline even though the outline was included as a complete separate prepared draft, which the writer contract permits. Whether the proposed product workflow itself works still requires verification; that is distinct from whether the textual outline has been prepared. This unresolved distinction can cause useful work to be discarded during revision.

Across this continuation: **13 paid calls, $2.023417**, with combined charged/held **$61.841945 / $100**. Unused authorization is **$38.158055**, subject to the existing per-call reservation and retained historical holds. This is ledger usage at configured rates, not an independently reconciled invoice. Every run and comparison is preserved locally in ignored cache files.

Remaining acceptance work:

1. Improve the buyer-value mechanism and concrete competing customer-job reasoning; merely naming paid features is insufficient.
2. Produce a meaningfully unconventional, business-relevant bold direction with a useful affected-user/payer test. Familiar concierge onboarding or a reseller arrangement should not earn high novelty solely from its label. Unknown feasibility and absent precedent must still not suppress exploration.
3. Preserve useful prepared examples through revision, and distinguish an already-authored draft from an unbuilt product feature or published asset. Do not replace the evidence audit with an unchecked model verdict.
4. Keep the first owner action manageable while preserving later product verification, exact recipient/content approval and lawful access requirements. A proposed channel is not verified reach.
5. Keep confirmed payment, workload limits, evidence sufficiency and each party's economic boundary distinct. The v4 first draft improved these, but did not pass overall quality.
6. Investigate bounded schema-failure recovery without corrupting historical results, removing constraints wholesale or silently spending more. The current fallback behaved honestly.
7. Test any next design change against counterfactual sparse-data cases and fresh Livoform output using the unchanged approved data/cap. Inspect actual claims and artifacts as well as scores; both isolated comparisons missed a known original error. No quality claim should rely on one self-review or a favorable A/B preference alone.

Useful paths for resuming: `shared/agents/focusedPlan.ts`, `focusedRubric.ts`, `focusedReview.ts`, `runtime.ts`, `specs.ts`; production assembly in `convex/jobs.ts`; `bench/strategy-quality/{livoformLaunch,anthropicLive,evaluationIdentity}.ts`; regression tests named below. Local private owner report and raw variants are under `bench/cache/anthropic-real-2026-11-09/`; the readable local report is `Livoform-Retest-2026-11-17.md`. Do not commit those private inputs or raw outputs.

### v3 retest and remaining measurement precision

Variant `launch-quality-v3-20261117`, engine v3.155, source hash `6a59ac5e158efb9b1c0fc8834177e2e20aedccaeca359e998db51a4d699e08ba`: four calls cost **$0.720914**. First draft: 3.5, failed gates and three unsupported claims. Revised draft: **4 average, minimum 4, all gates passed, no lint findings, ship true**. This is an automated acceptance pass for one case, not a proof of commercial quality.

The separate-context comparison ($0.065012) again preferred the original for paid-value explanation and alternative mechanisms. It missed the known original unsupported assertion, so no blanket improvement or independent truth-verification claim is made. Inspection of the passing v3 draft found that it still described checkout as payment and risked conflating customer payment-processing activity with the software vendor's economics. A proposed invitation cap was also being used as an evidence-sufficiency threshold. Passing the AI rubric did not resolve those issues.

Engine `v3.156-paid-outcome-precision` clarifies these distinctions in the existing writer/reviewer contracts: paid uptake needs explicitly confirmed successful payment with source provenance; merchant transactions are not vendor revenue; relevant fees need the correct actor and cost boundary; workload caps are not proof thresholds. Paid value must describe a buyer situation and consequence, not only list plan features. Two additional review-enforcement examples cover checkout and merchant-revenue confusion. **151 tests in eight files passed (13.08 seconds)**:

```sh
pnpm exec vitest run tests/unit/focused-evidence-review.test.ts tests/unit/focused-plan.test.ts tests/unit/focused-learning.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/safety.test.ts tests/unit/evaluation-identity.test.ts tests/unit/livoform-launch-input.test.ts
```

Combined charged/held before the next retest: **$61.270962 / $100**. Earlier drafts and assessments are unchanged.

### v2 paid retest — preserved failure

Variant `launch-quality-v2-20261117`, engine v3.154, selected-source hash `6495f512f0d5ed8b24e03976c925c470014e8404dd0d2c71c4d199b00dc42411`: four calls cost **$0.603600**. The first review explicitly identified an unsupported comparative claim despite passing its general truth gate; code blocked it and forwarded the correction. The revision removed that reported error but remained below quality: **3.56 average, minimum 3.5, ship false**. This is a verified enforcement improvement, not a quality-pass claim.

A separate-context comparison cost **$0.062908** and preferred the original draft for its prepared example, activation definition, distribution fallback and more distinct adjacent option. It also missed a previously identified unsupported business-state assertion in the original, so its favorable truth scores are not accepted as proof of accuracy. The comparison and the changed production rubric measure different things; neither overrides the preserved failures. Combined charged/held after these calls: **$60.485036 / $100**. No model or business action changed.

### Follow-up: shared exploration contract and consistent reviews

Engine `v3.155-protected-focused-task` fixes a confirmed assembly mismatch: the application appended `focusedExplorationTask`, but direct focused benchmark calls did not. `focusedPlanTask` now includes the complete protected exploration contract once, with a default balanced range; the application supplies its selected range to that builder and removes the duplicate append. The timing task is unchanged. This aligns that shared contract, not every production input or the full application journey.

A second confirmed inconsistency allowed a claim to be marked supported/qualified while requiring a factual correction. The review validator now refuses that contradiction; material corrections require an unsupported verdict. Reviewer guidance preserves separate standards for originality and feasibility, permits reasoned provisional decisions without invented demand, and prevents required permissions from being removed merely to reduce the count of owner tasks. Writer guidance asks for a usable worked example before its invitation, a concrete first-value observation and an honest fallback when distribution is not yet available.

Two failing regressions reproduced these gaps. **205 tests in 12 files passed (16.25 seconds)** using the previous main command with `tests/unit/industry-evaluation-input.test.ts` in place of `tests/unit/anthropic-budget.test.ts`. Production focused/starter job tests verify the exploration block appears exactly once. App/Convex typechecks, changed-file ESLint and diff checks passed. Read-only re-assessment of the unchanged v2 critique reproduces the contradictory-verdict error without modifying the saved result. Fresh paid output remains necessary to judge quality.

Comparison follow-up: the existing Anthropic harness now supports `launch-judge` for a separate-context comparison of two exact saved launch outputs against the six held-out questions. It refuses mismatched owner reports, public evidence or constraints and excludes generation instructions, histories and scores from the judge input. Its cache identity binds both candidates and evidence; the same request reservations and cumulative cap apply. **23 tests in five files passed (0.446 seconds)** using `pnpm exec vitest run tests/unit/livoform-launch-input.test.ts tests/unit/evaluation-identity.test.ts tests/unit/anthropic-budget.test.ts tests/unit/ai-qa-budget.test.ts tests/unit/evaluation-budget.test.ts`; app/Convex typechecks, changed-file ESLint and diff checks passed. The comparison still uses the same model family and is not an independent expert or field result.

The audit is still model judgment. Quote membership and category coverage do not establish semantic entailment, completeness, commercial usefulness or originality. This change makes the review inspectable and enforces its reported failures; it cannot promise discovery of every unsupported claim. Writer/rubric changes need a fresh real-provider acceptance run to establish whether this case improves. The owner authorized that retest within the existing cumulative $100 cap; $59.818528 was charged or held before it. No model switch, business action or deployment is authorized by generation.
