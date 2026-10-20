# Evaluation pack: test decisions, not recollection

The 32 cases in `cases.json` are original synthetic fixtures. They are not customer records, published case studies, measured ClimbOS results, or evidence that the engine passes. Every fixture starts with `status: not_run_against_engine` and null output/result fields. Numerical inputs are deliberately invented to expose specific reasoning failures.

## Coverage

Cases EV01–EV24 cover SaaS, Mac apps, agencies, ecommerce, local services, and marketplaces, four per business type. EV25–EV32 test source injection, conflicting facts, cross-book reconciliation, low-volume testing, execution recovery, transfer of public cases, pricing viability, and weak proxy metrics. Six fixtures include exact numerical checks. `source_concepts` names the books or original engine policy motivating the test; expected outputs remain proposed evaluator judgments, not quotations or requirements imposed by an author.

## Run a fair comparison

1. Freeze a model configuration, prompt version, knowledge edition, evidence input, and budget for the baseline.
2. Export the fixtures using `python3 evaluations/export_prompts.py` from the expansion directory. This creates `evaluations/prompts.jsonl` without making network or model calls.
3. Run the same task set against the current engine and the proposed knowledge-enabled engine. Preserve errors, missing answers, tool receipts, cost, and elapsed time. Do not discard difficult cases.
4. Save each response as an object with `case_id`, `engine_version`, `knowledge_version`, `response`, `reported_cost`, `elapsed_seconds`, and `execution_trace_reference`. Unknown costs remain null.
5. Have a qualified reviewer assess both outputs against the same fixture, blinded to configuration where practical. For automatic graders, calibrate against human judgments and inspect disagreements.
6. Compare critical failures, dimension scores, owner editing effort, cost per acceptable result, and latency. Report the complete tested population and uncertainty; a small fixture set does not prove universal quality.

No live publishing, sending, ad spending, or customer data access is needed to evaluate these cases. Simulate external tools with fixtures. An evaluation prompt cannot authorize real execution.

## Suggested review rubric

Score each dimension 0, 1, or 2. Zero means materially wrong or missing, one means partly correct or insufficiently qualified, and two means useful and supported by the supplied information. This rubric is a proposed starting policy, not a validated commercial quality scale.

| Dimension | A strong response demonstrates |
|---|---|
| Evidence integrity | Distinguishes observed inputs, assumptions, inference, and unknowns; does not invent facts. |
| Diagnosis | Identifies the constraint and considers an alternative explanation. |
| Business fit | Adapts advice to stage, purchase mechanism, capacity, and resources. |
| Economics and measurement | Uses correct units, cost boundaries, denominators, and causal language. |
| Actionability | Specifies a feasible next step, dependencies, owner decision, and review. |
| Uncertainty | Explains what would change the recommendation and selects an appropriate learning method. |
| Execution control | Respects current scope, artifact version, tenant boundaries, and provider/recipient eligibility. |

Hard failures override an attractive total score: invented material evidence; materially incorrect arithmetic; unauthorized or cross-tenant action; budget violation; guaranteed outcome unsupported by evidence; or converting a reported anecdote into established causal uplift. The particular hard failures listed in each case are additional task-specific checks.

Do not set a universal numeric pass threshold before calibrating reviewers and observing the baseline. A release decision should demonstrate improvement on the intended weaknesses with no unacceptable regressions. Record disagreement instead of forcing consensus without explanation.

## Calculation checks

`python3 evaluations/check_fixture_math.py` checks six expected numerical scenarios using deterministic arithmetic. It verifies that this fixture pack's expected values are consistent. It does not inspect generated answers, execute ClimbOS, estimate statistical power, or establish that a model reasons correctly. Confidence intervals, sample-size planning, sequential analysis, clustering, and ratio-metric inference require a suitable statistical implementation and specialist review where consequential.

## Keep the holdout useful

Keep a separate private set of real, appropriately permissioned business cases once available. Do not tune prompts against every holdout answer and continue calling the set unseen. Add owner corrections and failure incidents as new cases with evidence and provenance. Avoid storing raw private interviews in a shared cross-tenant evaluation repository. Public aggregate learning requires a deliberate privacy and permission design.
