# Book 03 — Growth Models and Trustworthy Experimentation

**ClimbOS Growth Intelligence Library · Research cutoff: October 19, 2026**

This book explains how to turn a growth ambition into a causal model, a feasible learning program, and a defensible allocation decision. Its frameworks and examples are original synthesis. Numerical cases are hypothetical teaching cases, never reported results for ClimbOS, Formkit, or a named customer. Statistical calculations belong in tested deterministic functions. Model-generated explanations must preserve the assumptions and limitations of those calculations.

## 1. Growth is a system of flows, stocks, and constraints

“Get more customers” describes an outcome without specifying a mechanism. A useful growth model identifies the people who could become customers, the transitions they must complete, the time those transitions require, and the economic consequences of success. It also identifies what can stop growth after acquisition succeeds. A service company can run out of delivery hours. A subscription product can acquire customers who leave before recovering acquisition cost. A marketplace can add buyers faster than sellers can fulfill demand.

Begin with stocks and flows. A stock exists at a point in time: active customers, qualified opportunities, available inventory, or cash. A flow changes a stock during a defined period: new customers, cancellations, won opportunities, replenishment, and spending. Mixing them creates plausible but invalid plans. Monthly leads cannot be compared directly with today's opportunity stock. Annual contract value cannot be divided by one month's advertising expense and called monthly profitability. Every model input needs a unit, period, population, and source.

A basic subscription stock equation is active customers next month equals current active customers plus new activated customers minus customers lost. Revenue needs another layer because customer counts and customer value can move differently. A company may lose several small accounts while expanding a large account. Track customer retention, recurring revenue retention, and contribution separately. A customer whose usage increases expensive inference or support consumption can grow revenue while reducing contribution. ClimbOS should expose these distinctions without making the owner learn financial jargon first.

Build the model backward from the decision. If the decision is whether to hire a salesperson, model qualified opportunities, sales capacity, win probability, sales-cycle timing, onboarding capacity, and contribution after commissions. If the decision is whether to improve self-serve onboarding, model eligible signups, activation, paid conversion, time to value, retention, and incremental engineering effort. A universal funnel is useful as vocabulary but inadequate as a decision model. Different businesses have different bottlenecks and different opportunities to intervene.

A practical model starts small. Draw five to eight commercially meaningful states and label the transitions. Distinguish a first visit from a returning visit, a trial from an activated trial, and a signed contract from collected revenue where those differences affect the decision. Write the accounting identity before estimating parameters. Then ask what evidence would change the recommended action. If a variable cannot change any decision within the current planning horizon, it may belong in background analysis rather than the primary model.

## 2. Diagnose before optimizing

Growth diagnosis means considering competing explanations for the same symptom. Falling new revenue could reflect fewer qualified visitors, lower conversion, a shift toward smaller customers, slower sales cycles, inventory problems, or a measurement break. A single dashboard total cannot distinguish them. ClimbOS should ask which explanations are consistent with observed evidence, what evidence contradicts each explanation, and what inexpensive check separates the leading alternatives.

Use a decomposition appropriate to the business. For a simple transactional business, revenue equals qualified visits multiplied by purchase probability multiplied by net order value. For a sales-led service, collected contribution depends on qualified leads, meeting rate, proposal rate, win rate, project value, delivery cost, and collection timing. For a recurring product, combine new-customer contribution with cohort retention and expansion. These are accounting approximations, not causal laws. Changing one parameter may alter another, so the model must not silently assume independence.

Consider a hypothetical software business reporting fewer paid accounts despite stable traffic. First validate that the definition of a paid account and the observation window did not change. Next compare traffic by source, geography, device, and new versus returning users. Stable total traffic can conceal a decline in qualified traffic. Then inspect signup errors and payment failures. Finally inspect cohort maturity: recent trial users may not have had time to purchase. This sequence prevents an expensive redesign from becoming the default response to a broken event or a delayed cohort.

Rank constraints by their effect on the system, not by how visibly broken they appear. A low conversion rate at a high-volume early stage may matter less than a retention problem that destroys all acquisition economics. Conversely, a poor retention average can conceal one healthy segment worth expanding. Diagnosis should produce a conditional statement: given this segment, this time period, and this evidence, this constraint appears most decision-relevant. Confidence should rise through discriminatory evidence, not through increasingly forceful wording.

A useful diagnostic artifact contains the symptom, its definition, the leading explanation, alternative explanations, supporting evidence, missing evidence, and the next separating test. Assign an owner and due date to the separating test. If the test is checking an event implementation, call it a measurement repair. If it is interviewing customers about an objection, call it qualitative discovery. If it randomly changes an experience and measures outcomes, call it a controlled experiment. Each produces a different kind of evidence.

## 3. Translate a growth model into an economic model

Volume alone cannot determine whether growth is attractive. Use contribution after incremental variable costs as a bridge between customer behavior and commercial value. Specify which costs are included. Hosting, model inference, payment processing, fulfillment, support, commissions, refunds, and incentives can all matter. Fixed overhead belongs in a separate operating model unless the decision changes it. Calling gross revenue “profit” makes almost every acquisition idea appear better than it is.

A practical acquisition limit is the contribution available within an acceptable recovery period. Suppose a hypothetical subscription earns $30 monthly revenue per customer and incurs $9 monthly variable service cost. Monthly contribution is $21 before acquisition cost and fixed overhead. If management permits a four-month payback and assumes every acquired customer remains for those four months, the simplified acquisition ceiling is $84. That retention assumption is optimistic when cancellations occur early. A better model multiplies each month's contribution by the probability that the customer is still active.

For a hypothetical cohort with survival probabilities of 1.00, 0.85, 0.75, and 0.65 over four contribution months, expected contribution is $21 multiplied by 3.25, or $68.25. Spending $80 to acquire such a customer misses the four-month recovery objective even though the naive calculation suggested room. Do not infer lifetime value from these four months unless a separately justified retention model supports the extrapolation. Short evidence windows should produce short-horizon values and explicitly uncertain longer scenarios.

Distinguish average acquisition cost from marginal acquisition cost. A channel's historical average includes easy opportunities that may already be exhausted. The next $500 can be less efficient than the previous $500. Likewise, a founder's first customers may arrive through personal relationships that cannot scale. Ask how cost and quality change as reach expands. Budget decisions should compare the expected contribution from the next feasible increment, with uncertainty, against the next best use of cash and labor.

Cash timing is an additional constraint. An annual prepaid contract may finance delivery sooner than a monthly subscription, while a long enterprise sales cycle can consume cash before any contract closes. A profitable forecast can still be unaffordable. Add a cash schedule with payment dates, refund exposure, ad charges, labor commitments, and implementation expenses. ClimbOS should reject a plan that exceeds available cash even when its expected eventual contribution is positive. Owners need both an economic case and a survival path.

## 4. Sensitivity analysis finds the useful question

A point forecast hides the assumptions that drive the recommendation. Sensitivity analysis asks how the output changes when an input changes within a plausible range. Begin with one-way sensitivity: vary one input while holding the rest constant. Then inspect combinations that could occur together. Poor traffic quality and low conversion often move together, so independent optimistic assumptions can create an unrealistic upside case.

Take a hypothetical campaign with $600 media spend, a $2 cost per click, 5% click-to-trial conversion, and 20% trial-to-paid conversion. The calculated path is 300 clicks, 15 trials, and three expected paid customers. These are expected values, not promises that exactly three customers will arrive. At $60 ninety-day contribution per customer, expected contribution before advertising is $180, leaving negative $420 after media spend and before labor. A plan that celebrates fifteen trials while ignoring this outcome is optimizing an intermediate metric.

Now vary cost per click from $1 to $3. With the same conversion assumptions, expected paid accounts range from six to two. The campaign remains unattractive at $60 short-horizon contribution unless another assumption changes materially. That tells the team that a small ad-copy improvement is unlikely to rescue the economic case. It should investigate a higher-value segment, better retention, a cheaper acquisition mechanism, or a different objective such as tightly bounded message discovery. Relabeling the objective does not make customer acquisition profitable; it makes the learning purchase explicit.

Sensitivity also identifies the best measurement investment. If the recommendation changes only when trial-to-paid conversion exceeds 40%, learning that conversion accurately has high decision value. If the recommendation remains unchanged across every plausible click cost, obtaining a more precise click estimate is less urgent. Ask which uncertainty can reverse the decision and what it would cost to reduce it. This is a more useful research agenda than collecting every metric available in an integration.

Represent uncertain inputs as ranges with provenance. An owner estimate, a historical cohort interval, and a borrowed industry benchmark are not interchangeable. The interface can show a simple conservative, central, and favorable scenario while retaining full assumptions in the evidence view. Avoid assigning precise scenario probabilities without evidence. A central scenario is not automatically the statistical mean, and a favorable scenario is not a target management can demand into existence.

## 5. Choose the right learning method

Not every uncertainty deserves an A/B test. Interviews reveal vocabulary, motives, and process details. Usability observation reveals confusion and task failure. Historical analysis reveals patterns worth explaining. Controlled experiments estimate effects under specified conditions. Technical audits reveal whether measurement and execution work. A useful learning program uses these methods in sequence and acknowledges what each cannot establish.

If the uncertainty is “Do target buyers recognize this problem?”, interview people matching the intended buying context and ask for recent concrete examples. Do not ask whether they like the proposed product and treat politeness as demand. If the uncertainty is “Can users complete the task?”, observe real task attempts. If the uncertainty is “Does removing this step improve paid conversion?”, a randomized comparison may be appropriate when sample and implementation permit. If there is almost no traffic, creating a fake statistical experiment produces less information than direct buyer conversations.

Use a decision tree. First ask whether an answer could change a current decision. If no, defer the research. If yes, ask whether the uncertainty concerns behavior under a proposed intervention or understanding the existing situation. For existing situations, validate records and use targeted qualitative or descriptive analysis. For interventions, ask whether assignment can be controlled, outcomes measured, and sufficient observations obtained within the business horizon. If all are feasible, design a controlled experiment. Otherwise choose a weaker but explicit design and limit its causal claims.

A low-volume business can test a major proposition through a concierge offer. The team manually delivers an outcome to a small number of suitable customers and records purchase resistance, fulfillment effort, and repeat demand. This can establish feasibility and uncover objections. It does not estimate the future conversion rate of a scaled automated product. The correct conclusion might be that three buyers paid under intensive founder involvement, with delivery requiring five hours each. That is commercially useful evidence without pretending to be population-level proof.

Combine methods without laundering their weaknesses. An interview-informed hypothesis followed by a well-run experiment can yield strong learning. Ten interviews followed by an uncontrolled revenue increase do not become a randomized result merely because both are documented. ClimbOS should display an evidence ladder: exploratory, descriptive, quasi-experimental, randomized, or replicated. These labels describe design strength for a particular claim, not a universal ranking of the people doing the work.

## 6. Write a hypothesis that can fail

A hypothesis should name the segment, intervention, mechanism, primary outcome, expected direction, guardrails, and decision consequence. “Improve onboarding” is a project. “For newly registered small-team administrators, a guided first-project setup will increase seven-day qualified activation by reducing uncertainty about the next step” is a testable hypothesis. Add what would count as a commercially meaningful change and what harms would stop deployment.

Define activation through customer value rather than arbitrary activity. Opening a screen or clicking a button may be too weak. A hypothetical scheduling product might define activation as publishing a usable booking page and receiving a legitimate booking. A different product could need repeated collaboration before value occurs. ClimbOS must use the business's actual value mechanism; it must not invent an activation event for Formkit or any other named product without evidence. Event definitions should include exclusions, deduplication, identity rules, and the time window.

Choose one primary decision metric where possible. Secondary metrics help interpret mechanisms and guardrails monitor harm, but selecting the best-looking metric afterward turns noise into apparent evidence. For onboarding, the primary metric could be qualified activation within seven days. Guardrails could include support contacts, error rate, cancellation, accessibility failures, and infrastructure cost. A secondary measure such as setup completion time can support a mechanism without replacing the primary outcome after results disappoint.

Make the hypothesis falsifiable in business terms. If activation rises but retention falls enough to erase contribution, the intervention may not be worth shipping. If the confidence interval includes both useful benefit and meaningful harm, the result is uncertain rather than a win. If there is a severe instrumentation problem, the result is invalid rather than negative. Distinguishing invalid, inconclusive, unfavorable, and favorable outcomes prevents teams from treating every non-win as the same lesson.

Precommit the analysis and decision rules in a short experiment contract. Include eligibility, randomization unit, allocation, exposure definition, sample plan, minimum duration, follow-up window, exclusions, statistical method, primary metric, guardrails, and planned subgroup analyses. Record who can stop the test for operational harm. Freeze a version before launch; amendments remain possible but must be timestamped and explained. The purpose is not bureaucracy. It is protecting the decision from convenient reinterpretation after seeing results.

## 7. Statistical power is a feasibility constraint

An experiment can only distinguish effects that are large enough relative to noise and sample size. Statistical power is the probability that the planned procedure detects a specified effect under its assumptions. It is not the probability that a positive result is true. A minimum detectable effect is a planning input: the smallest change the experiment is designed to detect reliably. Choose it from commercial relevance before checking whether the required sample is affordable.

For an equal-allocation comparison of independent binary outcomes, a common approximate per-arm sample formula is n approximately equal to the square of the sum of two terms, divided by the squared absolute difference between p1 and p0. The first term is z at one minus alpha over two, multiplied by the square root of two times pooled probability times one minus pooled probability. The second is z at target power, multiplied by the square root of p0 times one minus p0 plus p1 times one minus p1. This is a normal approximation, not a universal calculator for all experiments.

For a hypothetical change from 5% to 6%, with two-sided alpha 0.05 and power 0.80, the approximation gives roughly 8,150 observations per arm, or about 16,300 total. A business with 500 eligible visitors per week needs roughly thirty-three weeks before additional outcome maturation. This is unlikely to support a ninety-day decision. Verify exact implementation conventions against a trusted statistical package: R's `power.prop.test` explicitly defines sample size per group. [R power documentation](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/power.prop.test.html).

Reducing the sample requirement by changing the desired detectable improvement to something enormous is only sensible if that improvement is plausible and useful. Testing a radically different offer may justify a large target effect. Claiming that a tiny color change will double sales just to obtain a manageable sample does not. Likewise, moving to an easier intermediate outcome is useful only when that outcome has a credible relationship to the commercial decision. A click uplift with unknown downstream quality does not establish profitable growth.

Sample planning must reflect the randomization unit. If accounts are randomized, individual users within the same account are correlated. Counting each user as independent overstates information. Repeated purchases from the same person also need appropriate treatment. Revenue distributions can be highly skewed, so binary conversion formulas do not estimate revenue-test sample size. ClimbOS should route unsupported designs to an analyst and show why, rather than outputting a confident number from the wrong formula.

## 8. Protect the experiment from broken measurement

Random assignment must be stable, appropriately scoped, and recorded before outcomes. A person who sees treatment on one device and control on another can contaminate the comparison. An organization that shares settings may need account-level assignment. A referral intervention may affect people outside the assigned unit. Decide whether interference is material and choose a design that respects the business mechanism. Stable hashing is an implementation technique, not proof that assignment is unbiased end to end.

Keep assignment, exposure, and outcome records separate. Assignment says which variant a unit was allocated to. Exposure says whether the unit had an opportunity to experience the intervention. Outcome says what happened afterward. Excluding assigned people because they did not complete a treatment-dependent step can introduce selection bias. Start with intention-to-treat analysis when appropriate, then use carefully defined exposure analysis to understand mechanisms. Preserve the original eligible population even if secondary analyses use subsets.

Sample ratio mismatch is a warning that observed variant counts differ more than expected from the configured allocation. It can arise from assignment defects, logging loss, joins, or treatment-dependent filtering. Microsoft's published experimentation practice emphasizes diagnosing mismatch before trusting effect estimates. The ClimbOS implication is to block automated “winner” labels when allocation checks fail and surface the underlying counts. The specific threshold must be chosen and documented for the platform rather than copied as a magic universal value. [Microsoft SRM analysis](https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/).

Run an A/A check when introducing new assignment or telemetry infrastructure. Both groups receive the same experience while the system verifies allocation, event consistency, join logic, and expected variability. One uneventful A/A test cannot prove correctness, but systematic imbalance or unexplained metric differences demand investigation. Trace individual synthetic journeys and reconcile totals with independent operational records. A dashboard showing internally consistent numbers can still be consistently wrong if every layer shares the same faulty event.

Define handling for bots, internal users, refunds, duplicate events, timezone boundaries, delayed events, and incomplete identity. Apply exclusions symmetrically and preferably from pre-treatment information. Track data freshness and ingestion completeness by variant. If one variant changes page speed and therefore changes the probability that a client-side event arrives, the measurement system can manufacture an effect. Server-side outcomes can help where appropriate, but they introduce their own identity and consent requirements and still need validation.

## 9. Analyze effects without converting uncertainty into certainty

Report absolute effects and relative effects together. Moving from 5% to 6% is one percentage point absolute improvement and 20% relative improvement. The relative figure can sound dramatic while the absolute figure determines customers and contribution. Include eligible counts, observed outcomes, missingness, observation windows, and uncertainty intervals. A useful owner summary says what changed, how certain the estimate is, why it matters economically, and which decision remains justified.

For a hypothetical experiment with 10,000 independently assigned units per arm, 500 control conversions and 600 treatment conversions imply observed rates of 5% and 6%. The estimated absolute difference is one percentage point. A simple unpooled normal standard error is approximately 0.322 percentage points, giving an illustrative 95% interval of about 0.37 to 1.63 percentage points. This calculation assumes independent observations and adequate approximation; it does not validate instrumentation or establish that the result generalizes to every segment.

Translate that interval into a decision range. At a future eligible volume of 20,000, the observed point estimate corresponds to 200 additional conversions if the effect transfers unchanged. The approximate interval corresponds to roughly 74 to 326. These are scenario translations of effect uncertainty, not a complete predictive interval. Future traffic mix, implementation changes, seasonality, and random future outcomes add uncertainty. If contribution is $40 per incremental conversion and maintenance costs $1,000 per period, the point scenario is $7,000 net incremental contribution before other changed costs.

Avoid repeatedly checking an ordinary fixed-horizon test and stopping at the first attractive result. Monitoring operational harm is necessary, but efficacy stopping requires a method that accounts for repeated looks. Choose a valid sequential procedure or follow the predeclared horizon. Bayesian analysis also requires explicit priors, likelihood, utility, and stopping considerations; adding a probability label does not remove the need for design discipline. ClimbOS should present the method actually used and prohibit mixing incompatible outputs into one confidence score.

Multiple variants, outcomes, and segments increase opportunities for chance findings. Predefine a small set of commercially relevant comparisons and use an appropriate multiplicity strategy when making confirmatory claims. Exploratory subgroup findings can guide a follow-up test, but they should remain exploratory. If one of twenty segments looks positive after an overall null result, the next step is usually replication or a theory-informed targeted study, not automatic segment-specific deployment advertised as proven personalization.

## 10. Attribution, incrementality, and learning from imperfect evidence

Attribution assigns credit to touchpoints under a specified rule or model. Incrementality asks what happened because of an intervention compared with what would otherwise have happened. Those are different questions. A customer can click a branded advertisement immediately before purchasing while already intending to buy. Attribution can correctly record the click while overstating the additional sales caused by the advertisement if interpreted causally. Conversely, a useful educational interaction may influence demand without receiving the final recorded click.

Google's Conversion Lift documentation describes controlled comparisons between exposed and control groups and explicitly notes that the feature is not available to every account. This makes lift a useful capability to evaluate, not a guaranteed option to promise in every ClimbOS plan. Eligibility, measurement design, and feasibility must be checked against the current account. [Google Conversion Lift](https://support.google.com/google-ads/answer/12003020?hl=en). A small business without eligible access should receive a different measurement plan, rather than instructions requiring tools it cannot use.

When randomization is infeasible, consider an interrupted time series, matched geography, staggered rollout, or carefully chosen comparison group. Each relies on assumptions. A before-and-after comparison is vulnerable to seasonality and concurrent changes. A matched geography may differ in unobserved demand. A staggered rollout can be confounded if enthusiastic customers receive treatment first. Record the assumptions and plausible alternative explanations. The evidence can still guide a bounded decision, but the system must avoid presenting its estimate as experimentally established causality.

Use triangulation thoughtfully. Sales records may show growth, interviews may identify a new reason for choosing the product, and channel data may show more qualified inquiries. Together they strengthen a commercial story, particularly when they align on timing and segment. Yet three observational signals can share the same confounder. A competitor outage could produce all three. Include a counterfactual question in every result review: what else could have generated this pattern, and what observation would make that explanation less plausible?

For a practical low-volume plan, define a narrow decision and a reversible next step. A local service business could pilot an offer in a limited area, record qualified inquiries and delivered contribution, compare with its own seasonal history, and interview buyers. The conclusion might justify extending the pilot while retaining uncertainty about incremental lift. This is often better business judgment than waiting indefinitely for ideal identification. The essential discipline is matching the strength of the claim to the strength of the design.

## 11. Prioritize an experiment portfolio instead of an idea list

An experiment backlog becomes useful only when it reflects dependencies, capacity, downside, and information value. Scoring frameworks such as impact, confidence, and ease can structure conversation, but their scores are managerial estimates. Multiplying three subjective numbers does not produce measured expected value. Use scores to expose disagreement and screen obvious mismatches, then examine the few decisions where the ranking matters. A mandatory measurement repair can outrank a seemingly high-impact marketing experiment because every downstream result depends on it.

Start with eligibility gates. Does the experiment address a current constraint? Can the team execute it within capacity? Is the proposed action authorized? Is the success metric meaningful and measurable? Is the likely sample sufficient? Does the downside fit a documented limit? An idea that fails these gates should be repaired or parked before ranking. Gates prevent impressive expected returns from compensating for missing permissions, fabricated inputs, or a broken funnel.

Next estimate commercial exposure and learning value separately. Commercial exposure includes spend, labor, customer disruption, implementation debt, and possible brand harm. Learning value concerns whether the result can change an important decision. An inexpensive test of a trivial issue may have low value. A moderately expensive test that resolves whether to pursue a whole segment may have high value. Document the decision that will change under favorable, unfavorable, and uncertain outcomes. If every possible result leads to the same action, the proposed experiment may be unnecessary.

Allocate capacity across exploitation, exploration, and reliability work. Exploitation improves an already credible mechanism. Exploration investigates new segments, offers, or channels. Reliability ensures tracking and execution remain trustworthy. There is no universal correct percentage split. A business facing immediate cash pressure may concentrate on proven demand; a plateaued product with healthy cash reserves may explore more. ClimbOS should ask for the business horizon and risk capacity and then propose a portfolio justified by those constraints.

Dependencies should be explicit. A pricing test may require accurate billing events, a support briefing, and a rollback path. A referral test may require a working invitation flow and fraud controls. A paid acquisition test may require a credible landing page and conversion instrumentation. Represent these as a dependency graph in the planner. Do not schedule dependent work before prerequisites complete. Also reserve analysis and review time: a team capable of launching five tests but analyzing only one has a decision bottleneck, not an experimentation advantage.

## 12. AI changes the cost of variation, not the burden of evidence

AI can reduce the effort required to generate hypotheses, summarize interviews, draft variants, and explain results. This increases the risk of producing more variations than the business can evaluate. The scarce resource often shifts from production to qualified attention, reliable measurement, and decision capacity. An AI-native growth program should optimize useful learning per unit of cost, not the number of generated assets or experiments launched.

Use an evidence-constrained hypothesis generator. Give the model the current business snapshot, diagnosed constraint, relevant customer evidence, approved claims, available assets, and capacity. Require each proposed experiment to cite the evidence motivating it and identify the assumption it tests. Reject suggestions that require capabilities the business does not possess. For example, an outbound sequence cannot assume a prospect database or consented audience exists. Missing prerequisites belong in the proposed plan rather than being silently filled with invented contacts.

Use AI for qualitative coding with review. A model can group interview passages into themes, identify contradictions, and retrieve supporting quotations. Preserve original passages and respondent context so a reviewer can challenge the coding. Count respondents, not repeated mentions, when summarizing theme prevalence. A talkative respondent should not become five independent votes. Avoid presenting model-generated summaries as customer language unless each quoted phrase actually appears in the source. Sensitive interview content requires appropriate access controls and retention rules.

Separate creative quality from experimental validity. An AI-generated landing page may be persuasive, accessible, and on-brand while the test assignment is broken. Conversely, a statistically valid experiment may compare two weak propositions. Use independent checks: factual and brand review for assets, technical validation for execution, and methodological review for inference. The model can assist all three but should not merge them into an unexplained overall score. A critical failure in one dimension should remain visible even when other dimensions look strong.

Evaluate the AI workflow itself. Build fixed fixtures containing a clear bottleneck, a misleading surface metric, missing data, low sample volume, correlated outcomes, and an attractive but unauthorized action. Score whether the engine identifies the right uncertainty, refuses invalid calculations, and proposes feasible next steps. OpenAI's evaluation guidance supports task-specific datasets and evaluation rather than impressions alone. The proposed ClimbOS evaluation should compare a simple baseline with a staged approach under comparable evidence and budgets. [OpenAI evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

## 13. Proposed ClimbOS modules and contracts

The architecture here is a proposed implementation mapping, not a description of verified production code. Use the existing repository's conventions after inspection. The Business Snapshot module owns identity, goals, resources, and constraints. The Evidence Ledger stores observed, owner-reported, source-reported, assumed, inferred, and calculated inputs separately. The Growth Model module expresses stocks, flows, dependencies, and formulas. The Experiment Planner turns a selected uncertainty into a versioned contract. The Outcome Review module compares actual execution and measured results with the predeclared decision rule.

Convex is the proposed durable owner for tenant-scoped snapshots, experiments, approvals, run state, and outcome history. Vercel provides the owner-facing intake, experiment review, and evidence interface. OpenAI-first model calls assist diagnosis and explanation through typed adapters. A deterministic math library performs scenario arithmetic, interval calculations, budget checks, and design validation. Resend may deliver authorized owner notifications or approved lifecycle messages; its presence does not imply permission to contact prospects. Keep action execution separate from recommendation generation.

An experiment record needs immutable versions. Include tenant, business snapshot, hypothesis, evidence references, assignment unit, eligible population, intervention asset hashes, allocation, start and end times, maturation window, metric definitions, analysis method, budget reservation, owner approval, and result status. A content edit after approval creates a new asset version and can invalidate the approval. A metric definition edit after launch creates an analysis amendment rather than rewriting history. Historical results must remain reproducible from the versions actually used.

Implement a finite state workflow: draft, eligibility_checked, approved, scheduled, running, paused, completed_observation, analyzed, reviewed, and archived. Invalid and cancelled are explicit outcomes. A running experiment can pause for a guardrail breach without being labeled unsuccessful. An experiment that ended yesterday may still await a seven-day conversion window. A recommendation that was never executed cannot be scored as a business failure. These distinctions allow ClimbOS to learn from reality instead of from its own generated plans.

The interface should progressively disclose detail. An owner sees the decision, expected exposure, primary metric, required effort, and next review date. Advanced users can open formulas, statistical assumptions, data checks, and source records. Display “sample too small for the requested distinction” as a useful decision, with an alternative learning method. Do not pressure the owner to run a weak test merely to fill a dashboard. The product's commercial value includes preventing wasted experiments and protecting scarce attention.

## 14. Two executable knowledge playbooks

The following YAML and JSON are knowledge contracts, not permission to run external actions. Formula identifiers must resolve to audited deterministic implementations. Proposed thresholds belong to the owner policy and should be validated with fixtures before release. Unknown values remain null rather than acquiring silent defaults. A runtime validator should reject missing provenance, incompatible periods, and out-of-range probabilities before any model produces an owner-facing forecast.

```yaml
playbook_id: growth_experiment_design_v1
status: proposed
module: ExperimentPlanner
inputs:
  business_snapshot_id: required
  primary_metric_definition_id: required
  baseline_probability: nullable
  target_probability: nullable
  eligible_units_per_week: nullable
  randomization_unit: required
  observation_window_days: required
  evidence_ids: required
policy:
  external_actions_allowed: false
  no_prospect_database_assumed: true
  alpha: 0.05
  power: 0.80
  allocation: [0.5, 0.5]
  test_family: fixed_horizon_two_sided
steps:
  - validate_tenant_scope
  - validate_metric_population_period_and_units
  - check_independence_and_interference_assumptions
  - calculate_sample_with_verified_proportion_method_if_applicable
  - calculate_duration_including_outcome_maturation
  - compare_duration_and_exposure_to_owner_limits
  - choose_randomized_or_alternative_learning_design
  - require_approval_for_exact_intervention_version
outputs:
  feasibility: [feasible, infeasible, unknown, specialist_review]
  sample_per_arm: nullable
  estimated_duration_days: nullable
  limitations: required
  alternative_learning_plan: nullable
```

```json
{
  "playbook_id": "growth_outcome_review_v1",
  "status": "proposed",
  "module": "OutcomeReview",
  "required_inputs": [
    "experiment_contract_version",
    "assignment_counts",
    "metric_counts",
    "data_freshness",
    "actual_execution_log",
    "guardrail_results",
    "analysis_method_version"
  ],
  "checks_before_effect_claim": [
    "population_matches_contract",
    "allocation_integrity_checked",
    "outcome_window_mature",
    "missingness_reviewed",
    "exclusions_symmetric",
    "multiplicity_and_stopping_respected"
  ],
  "permitted_result_states": [
    "invalid",
    "inconclusive",
    "unfavorable",
    "favorable",
    "awaiting_observation"
  ],
  "commercial_translation": {
    "formula": "incremental_units_times_contribution_minus_changed_costs",
    "future_volume_kind": "assumption",
    "effect_kind": "estimated_from_experiment",
    "predictive_interval_claim_allowed": false
  },
  "automatic_deployment": false,
  "human_review_required": true
}
```

To implement these playbooks, first define schemas with discriminated unions for supported and unsupported designs. Store input provenance alongside each numeric value. Test the 5% versus 6% sample case, zero denominators, insufficient traffic, account clustering, incomplete observation, and contradictory variant counts. Add an outcome fixture where conversion rises but contribution falls. The expected behavior is a qualified commercial rejection or review, not a conversion-based winner label. After those deterministic checks pass, evaluate model explanations for preservation of the validated conclusion.

## 15. Operating cadence and durable learning

Run a weekly experiment review focused on decisions. Begin with data-quality failures and operational guardrails. Then examine completed observation windows, followed by upcoming decisions and capacity conflicts. Avoid reviewing every live metric as though every fluctuation requires intervention. End with explicit actions: continue observation, repair measurement, stop for harm, replicate, ship with monitoring, or archive. Record who owns the next step and which evidence justified it. This makes the meeting an allocation mechanism rather than a presentation ritual.

Maintain an experiment journal with failures, inconclusive results, and rejected ideas. A failed proposition can save more money than a small successful optimization earns. However, do not reward failure counts as a vanity metric. Reward clear hypotheses, sound execution, honest interpretation, and decisions that improve resource allocation. The goal is not to maximize the percentage of experiments called winners. A suspiciously high win rate can indicate weak controls, selective reporting, trivial comparisons, or a habit of relabeling every outcome positively.

Lessons need scope. “Shorter forms work” is too broad. A useful lesson states that for a defined audience and task, removing a particular optional field changed a specified outcome under a given implementation, with uncertainty and guardrail findings. Later contexts may differ. ClimbOS should retrieve analogous cases with their limitations and ask whether the causal mechanism plausibly transfers. A historical result is evidence for a new hypothesis, not a universal command to repeat the old tactic.

Review the model when reality diverges from its assumptions. If acquisition brings customers with unexpectedly high support cost, update the contribution model and segment strategy. If activation improves without paid conversion, reconsider whether activation captures customer value. If an apparently scalable loop saturates quickly, revise the reachable population and replenishment assumptions. The learning system must be able to change its underlying explanation, not merely adjust forecast percentages until they match the latest chart.

A mature growth practice earns confidence through traceability. An owner should be able to move from recommendation to hypothesis, from hypothesis to evidence, from evidence to measured outcome, and from outcome to the next decision. AI can make that chain easier to construct and inspect. It cannot replace missing observations with confident prose. ClimbOS succeeds when it helps a business choose the next useful action, understand its exposure, and learn enough to choose again with better information.

### A worked decision review

Consider a hypothetical team reviewing the onboarding experiment described earlier. The effect estimate is positive, assignment checks pass, and the observation window is complete. Yet the support guardrail shows a material increase in tickets among newly activated accounts. The team should calculate the incremental support cost and inspect whether the additional activity reflects useful adoption or confusion. It should not suppress the guardrail because the primary metric won. If the contribution case remains favorable after support cost, a limited rollout with monitoring may be reasonable. If support capacity is already constrained, a repair can be a prerequisite.

Now suppose the same conversion counts arrive with evidence that one variant dropped mobile events. The appropriate result becomes invalid pending diagnosis. The numerical uplift has not changed, but the evidential status has. This distinction is central to trustworthy growth intelligence: arithmetic correctness cannot rescue an untrustworthy data-generating process. ClimbOS should preserve both the calculated estimate and the invalidity reason, prevent an automated winner label, and create a concrete investigation task. Once repaired, the team may need a fresh experiment rather than a cosmetic recalculation of the compromised run.

## References and evidence boundaries

Primary references were retrieved October 19, 2026. Documentation can change; recheck live capabilities and experiment eligibility during implementation. The framework, cases, prioritization policies, architecture, and playbooks in this book are original proposed applications rather than externally validated ClimbOS results.

- **G03-S1:** Microsoft Research, *Diagnosing Sample Ratio Mismatch in A/B Testing*, published September 14, 2020. https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/
- **G03-S2:** R stats documentation, *Power Calculations for Two-Sample Test for Proportions*. https://stat.ethz.ch/R-manual/R-devel/library/stats/html/power.prop.test.html
- **G03-S3:** Google Ads Help, *About Conversion Lift*. https://support.google.com/google-ads/answer/12003020?hl=en
- **G03-S4:** OpenAI, *Evaluation best practices*. https://developers.openai.com/api/docs/guides/evaluation-best-practices
