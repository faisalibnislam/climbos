# Trustworthy experiments and proportionate growth decisions

Source: *Trustworthy Online Controlled Experiments*, Ron Kohavi, Diane Tang, and Ya Xu, uploaded EPUB. This guide provides original ClimbOS applications with source-specific locators in [sources-b.json](sources-b.json). Internal EPUB paths and extracted element numbers identify the edition inspected; they are not printed pages.

## What the source contributes

The source treats experiment results as inputs to a practical decision. It discusses statistical sensitivity, the size of an effect that matters commercially, exposure and duration, randomization, metric trade-offs, and the costs of launching a change. Its trustworthiness checks include assignment balance, measurement reliability, A/A testing, and the relationship between randomization and analysis units. [BK06-L01, BK06-L02, BK06-L04, BK06-L05, BK06-L06](sources-b.json)

It also explains why repeatedly checking ordinary significance results and stopping at a favorable moment can mislead, and why interference between variants can distort transfer from a test to full launch. Those topics inform the operating rules below. The proposed ClimbOS schemas, release gates, formulas, and examples are original design guidance, not a claim that the authors prescribe this application architecture. [BK06-L03, BK06-L07](sources-b.json)

## Start with the decision and the feasible population

ClimbOS should ask what action depends on the experiment and what difference would justify that action. A headline test, a pricing change, and an onboarding workflow have different costs and consequences. A tiny improvement can matter at large scale and remain commercially irrelevant to a small operation. Statistical significance does not answer whether the improvement pays for implementation, maintenance, support, or customer harm.

Define eligible units, assignment unit, exposure, observation window, primary metric, guardrails, minimum worthwhile effect, analysis method, and decision policy before the test begins. Eligibility should not depend on behavior caused by the treatment unless the design explicitly handles that selection. If accounts share users or collaborators influence one another, independent user assignment may be inappropriate.

## A proposed readiness and analysis workflow

1. **Check feasibility.** Estimate eligible traffic, baseline uncertainty, expected observation delay, and the sample required for the chosen effect and method. Use a tested statistical implementation, not model-generated arithmetic.
2. **Validate instrumentation.** Verify assignment, exposure, events, deduplication, timezones, and outcome windows. An A/A test can reveal problems in the system, but one successful test does not prove every future experiment is valid.
3. **Lock the plan.** Record metric definitions and analysis timing. Choose a fixed-horizon or suitable sequential method deliberately. Do not mix their decision rules after seeing results.
4. **Monitor safety and data quality.** Operational stopping for severe harm is different from early stopping to declare efficacy. Preserve the stopping reason and any effect on interpretation.
5. **Check trustworthiness before uplift.** Inspect missing data, assignment balance, leakage, bot effects, and implementation changes. A convincing-looking effect is unusable when a serious validity problem remains unresolved.
6. **Evaluate the decision.** Compare effect estimates and uncertainty with economic importance, guardrails, and launch costs. Permit outcomes such as ship, stop, revise, investigate, or remain inconclusive.
7. **Preserve the record.** Keep the original hypothesis, exposures, exclusions, analysis version, result, decision, and subsequent outcomes. Do not rewrite the initial prediction after a favorable result.

## Distinguish effect sizes and uncertainty

For a simple conversion comparison, absolute change is treatment conversion minus control conversion. Relative change is that difference divided by control conversion, when the control value is positive. A move from 10% to 12% is two percentage points and a 20% relative increase. Neither number alone states statistical precision or business value.

As an illustrative planning calculation, 1,000 eligible new visitors each month, a hypothetical 10% baseline, and a genuine two-percentage-point absolute improvement would imply 20 additional conversions before considering uncertainty, eligibility differences, implementation effects, and downstream quality. If the conversion is merely a signup, it does not mean 20 paying customers. ClimbOS should carry the metric definition into every downstream calculation.

Do not estimate lifetime revenue by multiplying a noisy signup lift by an unsupported lifetime value. Model observed contribution and uncertain downstream conversion separately. A treatment improving clicks while damaging retention or increasing support cost may be commercially unattractive. The owner needs the trade-off, not a green “winner” badge based on one favorable metric.

## Hypothetical failure that should block a decision

An invented onboarding test plans equal assignment but observes 700 control accounts and 300 treatment accounts. Treatment also reports higher activation. The counts alone do not identify the cause: assignment, exposure logging, filtering, or an implementation defect may be responsible. The engine should investigate the mismatch before recommending rollout. It should not “repair” the analysis by randomly discarding control observations until sample sizes match.

Suppose the treatment event fires only after a setup step while the control event fires at entry. That measurement difference creates a selected treatment population. Repair logging and run a justified new analysis or experiment. Preserve the invalid run as a learning record; do not relabel it a successful test because the remaining treatment users look engaged.

## Low-volume businesses need other learning paths

Controlled experiments are not always the best first tool. A local service with few bookings can learn from task observation, interviews, usability tests, improved instrumentation, and carefully documented pilots. These methods answer different questions and may support a modest reversible decision without proving a causal revenue effect.

ClimbOS should return a feasible learning plan when a proposed A/B test cannot resolve a useful effect within the owner's horizon. It can propose one substantial variant, a longer window, a more sensitive outcome if commercially appropriate, or a qualitative method. It must not guarantee that “running longer” will produce significance. A non-significant result does not automatically establish no meaningful effect.

## AI-native implementation

The model can help draft hypotheses, audit a plan for missing definitions, explain calculations, and investigate suspicious event patterns. It should not choose exclusions after seeing which choice creates a winner. Trusted code handles assignment, metric computation, statistical analysis, and budget enforcement. Human or rule-based review checks the commercial decision in context.

Proposed experiment records include `assignmentUnit`, `analysisUnit`, `eligibilityVersion`, `primaryMetricVersion`, `guardrails`, `analysisPlanVersion`, `minimumWorthwhileEffect`, `samplePlan`, `plannedDecisionDate`, `qualityChecks`, and `decisionRationale`. Store estimates, intervals, and missing-value reasons explicitly. A confidence interval and a subjective confidence label are different fields with different meanings.

Convex can persist run state and assignment references in the intended architecture, subject to repository-specific design. Vercel can render the owner decision view. OpenAI-first model calls explain and review the evidence without replacing deterministic analysis. External deployment, messaging, or campaign changes remain governed by explicit action authorization.

## Proposed acceptance tests

- Percentage-point and relative changes are calculated and labeled correctly.
- An unresolved assignment imbalance blocks a causal winner recommendation.
- A fixed-horizon test does not declare success because an interim ordinary p-value crossed a threshold.
- Account-randomized data is not treated as independent pageviews without a suitable analysis.
- An inconclusive interval is reported honestly rather than converted into proof of equality.
- A favorable primary metric cannot silently override a violated material guardrail.
- Shared budgets or network effects trigger an interference review before extrapolation.

The two experiment playbooks in [books-b.json](../playbooks/books-b.json) cover readiness and result-to-decision review. They are reference contracts, not a shipped statistical engine.
