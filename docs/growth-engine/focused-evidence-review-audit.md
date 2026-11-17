# Focused strategy evidence review — 17 November 2026

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
