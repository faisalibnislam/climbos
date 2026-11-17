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

Comparison follow-up: the existing Anthropic harness now supports `launch-judge` for a separate-context comparison of two exact saved launch outputs against the six held-out questions. It refuses mismatched owner reports, public evidence or constraints and excludes generation instructions, histories and scores from the judge input. Its cache identity binds both candidates and evidence; the same request reservations and cumulative cap apply. **23 tests in five files passed (0.446 seconds)** using `pnpm exec vitest run tests/unit/livoform-launch-input.test.ts tests/unit/evaluation-identity.test.ts tests/unit/anthropic-budget.test.ts tests/unit/ai-qa-budget.test.ts tests/unit/evaluation-budget.test.ts`; app/Convex typechecks, changed-file ESLint and diff checks passed. The comparison still uses the same model family and is not an independent expert or field result.

The audit is still model judgment. Quote membership and category coverage do not establish semantic entailment, completeness, commercial usefulness or originality. This change makes the review inspectable and enforces its reported failures; it cannot promise discovery of every unsupported claim. Writer/rubric changes need a fresh real-provider acceptance run to establish whether this case improves. The owner authorized that retest within the existing cumulative $100 cap; $59.818528 was charged or held before it. No model switch, business action or deployment is authorized by generation.
