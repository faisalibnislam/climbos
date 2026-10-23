# Book 12 — Analytics, Forecasting, Pricing, and Growth Economics

**ClimbOS Growth Intelligence Library · Research cutoff: October 19, 2026**

This book explains how to turn imperfect business observations into defensible growth decisions. Its purpose is not to make every owner a statistician. It is to make the assumptions behind a recommendation visible, calculate consistently, and protect the business from persuasive arithmetic that conceals weak evidence. All worked businesses, prices, results, budgets, and operating thresholds in this book are hypothetical unless a source is explicitly identified. Formkit may be used as an implementation fixture only after its actual facts have been verified; none of the hypothetical data below describe Formkit.

## 1. Build a decision system before building a dashboard

A useful analytics system begins with a recurring decision: whether to improve onboarding, stop an acquisition experiment, change a price, hire delivery capacity, or investigate declining retention. The dashboard is a view of that decision system. If a metric cannot change an action, explain a tradeoff, or detect a harmful outcome, it probably does not deserve prominent placement. This is an editorial criterion, not an argument against collecting supporting data.

Use a five-part decision contract. State the decision owner, the alternatives, the deadline, the evidence that could distinguish the alternatives, and the cost of being wrong. For example, an owner considering a landing-page redesign has three alternatives: leave the page unchanged, repair one confusing section, or rebuild the entire flow. A useful evidence pack includes qualified visitor volume, progression to the next meaningful step, recordings or interviews where appropriate, and downstream customer quality. A total-pageview chart alone cannot justify the rebuild.

Next distinguish a business outcome from a driver and a diagnostic. Contribution is an outcome. Qualified demonstrations attended might be a driver. Mobile form errors are a diagnostic. They have different jobs. Displaying all three as equally important metrics encourages teams to optimize the easiest number rather than the most valuable behavior. A designer reducing form errors should be able to explain how the repair might increase completed inquiries and, eventually, economically worthwhile customers.

Avoid making a single metric carry every obligation. Revenue can increase while cash falls. Conversion can increase while refunds rise. Activation can increase because the definition was weakened. Pair each primary outcome with guardrails and a definition-change log. A growth decision is good when its intended outcome improves without unacceptable harm to economics, customer experience, compliance, or operational capacity.

For ClimbOS, create `DecisionRecord` objects before generating charts. Each object should point to metric definitions, evidence observations, alternatives, and an owner-visible recommendation. The first interface should answer: “What should I decide this week, what evidence supports it, and what would change the answer?” Advanced users can open the complete calculations. Nontechnical owners should still see the observation window and the most consequential assumption without opening an inspector.

## 2. Define metrics as contracts rather than labels

“Conversion rate” is incomplete until numerator, denominator, observation window, eligibility rules, and unit are specified. A trial-to-paid rate measured by signup cohort differs from payments received during a calendar month divided by trials started during that month. Both calculations can be produced correctly by software while answering different questions. Name them differently and never compare them without reconciling the population.

A metric contract should contain a stable identifier, plain-language definition, entity grain, event prerequisites, timezone, currency where relevant, filters, aggregation method, late-arrival policy, and accountable owner. Record whether a metric is additive across time, across entities, both, or neither. Orders can usually be added across disjoint periods after deduplication; conversion rates cannot be meaningfully summed. Distinct customers cannot be summed across overlapping channels without identity reconciliation.

Consider a hypothetical appointment service. It receives 100 inquiries, books 40 appointments, completes 30 services, and earns 900 currency units of contribution. Inquiry-to-booking is 40%. Booking-to-completion is 75%. Contribution per inquiry is nine units. If the owner wants more completed services, the bottleneck might be booking availability or attendance rather than traffic. Reporting only 40 bookings hides ten failures to complete and may reward the wrong intervention.

Unknown values require a deliberate representation. A missing integration is not zero traffic. A customer without a cancellation event is not necessarily retained forever. A payment without currency cannot safely enter a multicurrency total. Use null values with reasons such as `not_connected`, `not_observed`, `pending_window`, or `definition_incompatible`. Give downstream calculators explicit rules for these states. Silent replacement with zero creates false certainty and can reverse strategic recommendations.

For ClimbOS, maintain a versioned metric catalog in code and persist the version used by every report. Store raw source values separately from normalized observations. If an owner corrects a metric definition, create a new version and either recompute historical values consistently or label the break. Never rewrite the history of a previous decision without preserving its original inputs. The practical acceptance criterion is simple: another analyst should reproduce the displayed value from the recorded observations, formula, filters, and date range.

## 3. Establish a trustworthy data pipeline

Data quality is not a preliminary ceremony that disappears once a connector works. It is an ongoing estimate of whether a particular dataset can support a particular decision. A weekly revenue trend may tolerate a short delay that would make an intraday spending decision unsafe. A source can therefore be usable for strategic review and blocked for automation at the same time.

Inspect freshness, coverage, grain, duplicates, missingness, consistency, and reconciliation. Freshness asks when the last complete observation arrived, not merely when the API was contacted. Coverage asks whether all relevant stores, campaigns, devices, or accounts are represented. Grain asks what one row means. Reconciliation compares the analytical total with an independently authoritative business record, such as settled payments, while explaining legitimate differences such as taxes, refunds, timing, and currency conversion.

Build ingestion in layers. Preserve the original payload and its retrieval metadata when permitted. Normalize identifiers and units without discarding the original values. Deduplicate using the source's stable event identifier where available. Apply documented business definitions. Materialize aggregates only after these checks. A model can help describe an unfamiliar payload, but it should not independently decide that two different customer records represent the same person when that merger materially affects billing or privacy.

A hypothetical store reports 120 purchases in analytics and 110 settled orders in its payment records. Do not immediately accuse one system of being wrong. Investigate test transactions, duplicate events, abandoned payment attempts marked too early, refunds, reporting timezones, and delayed settlement. Present a reconciliation table that explains each adjustment and leaves an explicit unexplained residual. A small unexplained amount may permit directional reporting while still blocking precise return-on-ad-spend claims.

For ClimbOS, assign quality issues to the metrics they affect. A delayed advertising connector should not block an unrelated customer interview summary. Conversely, a broken payment event should block recommendations that depend on measured purchase conversion. Proposed starting policy: display a metric-specific quality badge, warn on incomplete windows, and block automatic budget changes whenever required spend or conversion inputs fail their contract. Calibrate these policies against actual customer workflows; no universal freshness threshold fits every business.

## 4. Analyze funnels and cohorts without mixing populations

A funnel is a sequence of eligible transitions. Define the entity that travels through it, the time allowed between transitions, and the events that count. For an account-based product, the entity may be a company account rather than an individual user. Five employees from one paying company are not five acquired customers. For a marketplace, supply activation and demand conversion need separate funnels because their constraints differ.

Use cohort analysis when the timing of entry matters. A signup cohort follows the people or accounts that entered during the same period. Measure their activation and conversion at the same age, such as seven or thirty days after entry. Comparing a three-day-old cohort with a mature cohort makes the latest performance look artificially weak. Label immature cells and avoid combining them into an apparently final conversion rate.

Retention also needs an explicit event. Returning to a website, using a core feature, renewing a subscription, and retaining revenue are different definitions. A product can retain accounts while losing revenue through downgrades. It can retain revenue through expansion while losing many small customers. Separate logo retention, gross revenue retention, and net revenue retention instead of allowing one favorable measure to conceal another deterioration.

Hypothetical example: 200 accounts begin a trial. Within thirty days, 60 activate and 24 pay. Activation is 30%, activated-to-paid is 40%, and signup-to-paid is 12%. Suppose another acquisition source produces 100 trials, 50 activations, and 15 paying customers. That source has fewer signups but a 15% paid conversion rate. Whether it deserves more investment depends on acquisition cost, retained contribution, and the feasibility of acquiring more similar accounts. A funnel alone does not determine channel profitability.

ClimbOS should compute these transitions from eligible populations rather than letting the model infer them from disconnected totals. Store cohort age, entity type, and window in every result. Let owners drill from a recommendation into the relevant segment, such as small agencies using mobile onboarding. Where sample sizes are small, report the observed count beside the percentage. “Three of ten” communicates fragility more honestly than an isolated “30%” badge. AI can summarize likely friction, but the output should distinguish measured transition loss from a hypothesis about its cause.

## 5. Understand attribution, incrementality, and evidence strength

Attribution allocates credit for observed outcomes. Incrementality asks what would have happened without an intervention. These are different questions. An advertising platform may correctly assign credit under its chosen rules to a purchase that the customer would have made anyway. An untracked recommendation may create incremental demand without receiving attribution. Treat attributed revenue as a measurement view, not a proof of causality.

Google's current attribution documentation describes model-dependent credit assignment and changes to available models. It also explains that conversion credit can change after the original event. Build reporting that records the attribution model and acknowledges revisions rather than assuming all imported totals are final. See [Google Analytics attribution documentation](https://support.google.com/analytics/answer/10596866). The implications below are ClimbOS design recommendations, not claims that the platform's attribution model establishes causal lift.

Use an evidence ladder. Randomized experiments with sound implementation can support stronger causal claims than uncontrolled before-and-after comparisons. Quasi-experiments may help when randomization is impractical, but require credible assumptions about comparison groups and concurrent changes. Observational trends and interviews remain valuable for generating hypotheses and explaining mechanisms. They should not be upgraded into controlled evidence because the narrative sounds plausible.

For a hypothetical branded search campaign, ask whether turning off part of the campaign for an eligible randomized group reduces total profitable purchases, not merely platform-attributed purchases. Before executing, examine spillover, customer experience, measurement loss, and statistical feasibility. If the business is too small for a useful experiment, use a bounded operational test and report the uncertainty. A small business should not be encouraged to run a sophisticated study whose result cannot distinguish commercially relevant outcomes.

ClimbOS should label outcomes as `attributed`, `experiment_estimated`, `observational`, or `owner_reported`. Its recommendation engine can use each type but must adapt its language. “Attributed purchases increased” is different from “the intervention increased purchases.” Store experiment eligibility, assignment method, exclusions, and analysis plan before examining results. The practical decision criterion is whether the strength of evidence matches the reversibility and financial exposure of the proposed action. Weak evidence can justify a cheap exploratory test; it rarely justifies an irreversible expansion.

## 6. Make experiments economically informative

Begin with the decision threshold, not an arbitrary sample-size target. If a business would only adopt a change that increases contribution by enough to cover its implementation and maintenance, the experiment should be designed around that commercially meaningful difference. Statistical significance for a tiny improvement may be commercially useless, while a large but uncertain improvement may warrant another bounded test.

Define the unit of assignment and analysis. Assigning individuals while analyzing accounts can create dependence when employees influence each other. Repeated visits from one person are not independent new people. Record the primary metric, observation window, exclusion rules, guardrails, minimum detectable effect, and planned decision date. Avoid repeatedly checking results and stopping whenever the preferred variant looks good unless the analysis method explicitly supports sequential monitoring.

A useful normal-approximation intuition for two equally sized groups is that required sample grows as variance increases and shrinks roughly with the square of the effect being detected. Exact planning depends on baseline rates, desired power, significance level, allocation, and method. Use a tested statistical implementation rather than asking a language model to improvise a calculator. For established proportion-test behavior, consult [R's power calculation documentation](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/power.prop.test.html); implementation availability and approximation conditions must be checked.

Hypothetical example: a business has only twenty qualified purchases per month. It proposes testing five headline variants simultaneously for two weeks. Even before calculating formal power, the decision is suspect because outcomes are sparse and fragmented across treatments. A better first step may be qualitative message testing, one substantial variant, and a longer observation window if economics permit. This does not guarantee a conclusive result; it aligns the test with available evidence and cost.

For ClimbOS, implement an experiment feasibility gate before producing a calendar. Estimate eligible traffic, expected outcomes, required duration, cash exposure, and operational constraints. If the test is infeasible, propose a cheaper method to reduce uncertainty. Define three possible outcomes: adopt, reject, and inconclusive. Inconclusive is a legitimate result. The engine should never turn it into a success because the owner prefers a decisive answer. Store the original plan alongside deviations so later learning reflects what actually happened.

## 7. Construct forecasts from explicit drivers

A forecast is a conditional statement about future outcomes. It is not a promise and is not improved by writing more decimal places. Begin with a driver model that the owner can inspect. For a simple acquisition flow, qualified visits multiplied by eligible signup rate, activation rate, paid conversion, and contribution per acquired customer yields a scenario for acquired contribution. Each factor must refer to compatible populations and windows.

Separate a baseline forecast from an intervention scenario. The baseline estimates what might happen without the proposed change, given existing momentum and known conditions. The intervention scenario changes selected drivers and accounts for implementation delays. Comparing next month's optimistic scenario with this month's actual result does not isolate the intervention. Seasonality, underlying trend, pricing changes, and capacity may explain much of the difference.

When historical time series are available, compare candidate methods with simple baselines using appropriate held-out periods. Forecasts should be evaluated on data not used to fit them, and time order matters. The established forecasting text [Forecasting: Principles and Practice](https://otexts.com/fpp3/accuracy.html) explains out-of-sample accuracy and related evaluation concepts. ClimbOS should translate this into rolling historical backtests rather than choosing whichever method makes the most attractive chart.

Hypothetical example: 2,000 qualified visits produce 100 trials, 40 activations, and 12 paying accounts. With 50 units of first-period contribution per new account, acquired contribution is 600 units. A proposed onboarding change assumes activations rise to 50 while downstream activated-to-paid conversion remains 30%. The scenario yields fifteen paying accounts and 750 units of contribution, an increase of 150 before implementation costs. This is an assumption-driven scenario, not measured incremental value or a statistical prediction interval.

For ClimbOS, require every forecast driver to resolve to measured evidence, an owner-supplied assumption, or an explicit scenario setting. Store formula versions and carry units through the computation. Return `insufficient_data` when a required driver is unknown. An owner may choose to supply an assumption, but the interface should reveal its influence. Do not quietly replace missing rates with an industry average and then present the result as personalized intelligence.

## 8. Represent uncertainty honestly

Uncertainty has several sources: noisy observations, unknown parameters, future randomness, changing conditions, and structural model error. A forecast that varies conversion rate while holding everything else fixed captures only part of this uncertainty. A scenario range represents selected assumptions. A confidence interval estimates uncertainty about a parameter under assumptions. A predictive interval concerns future outcomes under a model. These terms should not be interchangeable in product copy.

Start with transparent scenarios when data is limited. Choose plausible low, central, and high input assumptions and explain their basis. Keep dependencies coherent. If lower-quality traffic grows, it may be unreasonable to increase visit volume and conversion rate independently. If higher prices reduce demand, a high-price scenario cannot automatically retain the same conversion. Use correlated assumptions or explicit mechanisms rather than multiplying every optimistic value together.

Sensitivity analysis asks which uncertain input most changes the decision. Hold other inputs fixed for an initial one-at-a-time view, then examine combinations where interactions matter. If the recommendation changes when conversion moves from 3.0% to 2.9%, it is fragile. If it remains attractive across a broad range of plausible values and capacity limits, it is more robust. Robustness is often more useful to an owner than an apparently precise central estimate.

Hypothetical example: an experiment costs 300 units and may create between five and fifteen retained customers. Contribution per retained customer is assumed to be forty units. The low outcome yields 200 contribution and a loss of 100 after experiment cost; the high yields 600 and a gain of 300. Without probabilities, do not compute an “expected return” by averaging endpoints and imply that it is statistically justified. Describe the break-even requirement: at least eight customers are needed to exceed the cost with whole-customer counts.

ClimbOS should display the driver that most threatens the recommendation and the cheapest way to learn about it. If retention dominates lifetime-value uncertainty, buying more traffic may be premature. Forecast outputs should include method, observation window, assumption set, calibration history where available, and known omissions. AI can explain these uncertainties in ordinary language, but deterministic validation should prevent “likely,” “guaranteed,” or “95% confidence” from appearing without supporting methodology.

## 9. Calculate unit economics with consistent cost boundaries

Customer acquisition cost is a family of measures, not a single natural constant. Paid-media CAC includes a different set of costs from fully loaded acquisition CAC. A channel's acquisition period may differ from the customer's conversion period, especially in longer sales cycles. State what costs are included and how acquisition activity is matched to acquired customers. [Stripe's SaaS CAC discussion](https://stripe.com/en-mt/resources/more/cac-in-saas) provides relevant cost and measurement context; the formulas here are explicit analytical definitions.

For a defined cohort, calculate acquisition CAC as eligible acquisition cost divided by acquired paying customers. If there are no acquired customers, report undefined or an economically appropriate unbounded interpretation; do not display zero. Calculate realized contribution as revenue less the variable costs selected in the cost policy, including refunds and payment costs where applicable. Keep taxes collected on behalf of authorities outside revenue unless the accounting policy requires otherwise.

Lifetime value requires more care than dividing average revenue by churn. The simple steady-state relationship assumes stable economics and retention behavior that many young businesses do not have. Prefer observed cumulative contribution by cohort and a clearly labeled forecast for unobserved future periods. Discount future contribution if the decision requires present-value comparison. Explain the discount-rate assumption instead of treating one rate as universally correct.

Hypothetical example: acquiring twenty customers costs 1,000 units in media and 400 in acquisition labor. Paid-media CAC is fifty; the defined broader CAC is seventy. Each customer contributes ten units monthly before acquisition cost. Ignoring churn, cash timing, and discounting, contribution payback is five months on media cost and seven on the broader measure. Those simplifications matter. A business with poor retention may never achieve the apparent seven-month payback.

For ClimbOS, publish a cost-boundary selector and preserve the selected policy in exported reports. Distinguish gross margin, contribution margin, operating profit, and cash flow. A recommendation should not compare a revenue-based lifetime value with a contribution-based CAC threshold. Include the acquisition cost, customer survival assumptions, contribution schedule, and payback calculation in the evidence panel. If the inputs do not support lifetime value, offer a shorter observed contribution horizon and say what remains unknown.

## 10. Price according to value, architecture, and customer behavior

Pricing combines willingness to pay, alternatives, customer value, cost exposure, and the buying experience. Cost-plus arithmetic establishes a floor under stated assumptions; it does not establish the best market price. A value metric should broadly rise with customer benefit, be understandable before purchase, and be measurable without creating surprise. If an expensive internal process is invisible to the buyer, charging directly for that process may feel arbitrary.

For ClimbOS, consider the tradeoffs among per-workspace subscriptions, usage allowances, additional execution volume, and higher-touch service. Seats may suit collaboration value but can discourage bringing colleagues into review. Charging per generated word rewards verbosity rather than decision quality. Unlimited research can create unbounded cost exposure. Usage-based approaches require clear metering and customer understanding; see [Stripe's usage-based SaaS pricing discussion](https://stripe.com/resources/more/usage-based-pricing-for-saas-how-to-make-the-most-of-this-pricing-model) for the model's mechanics and tradeoffs.

Conduct pricing research in stages. Interview different customer segments about existing workflows, alternatives, approval processes, and the financial consequence of the problem. Test comprehensible package descriptions. Observe real purchase or renewal behavior where feasible. Stated willingness to pay is useful but should not be treated as a binding order. Keep acquisition channel and customer maturity visible; a founder seeking occasional advice and an agency operating multiple client workspaces may value different packages.

Hypothetical example: two packages both offer ten growth plans. One includes auditable evidence, versioned assumptions, and measurement follow-through; the other offers only text exports. A customer with costly advertising decisions may value the former substantially more. That does not prove a particular premium. It suggests testing whether trustworthy decisions and reduced review effort are valuable differentiators rather than competing solely on the amount of generated content.

In ClimbOS, implement pricing experiments with entitlement contracts rather than scattered feature flags. A package version should define allowances, overage behavior, support scope, evidence refresh frequency, and external-execution limits. Explain what happens when an allowance is exhausted before a customer begins an expensive action. Do not silently stop a partially completed paid workflow or charge an unapproved overage. Evaluate price changes using conversion, retained contribution, customer understanding, support burden, and renewal behavior together.

## 11. Enforce ClimbOS's contribution-margin target

The product requirement is at least 30% contribution margin under an explicit cost policy. That is not a claim of 30% company-wide net profit. Define net recognized product revenue, then subtract the variable costs included in the policy: model calls, paid retrieval, allocated incremental hosting and database usage, email delivery, payment processing, customer-specific execution fees, refunds, and variable support where material. Salaries, fixed tools, taxes, and overhead require separate treatment and may change the final operating result.

For net revenue P and included variable cost C, contribution margin is `(P - C) / P`. To achieve target margin m with no revenue-proportional fee outside C, the minimum price is `C / (1 - m)`. If a payment fee is `f × P + k`, and other included cost is C, solve `P >= (C + k) / (1 - m - f)`. The denominator must be positive. Keep gross sticker price, discounts, credits, and revenue recognition consistent rather than substituting one for another.

Hypothetical example: other included monthly variable cost is twelve dollars, the fixed transaction fee is thirty cents, the revenue-proportional fee is 3%, and the target margin is 30%. The analytical floor is `12.30 / 0.67`, or approximately $18.36. These are illustrative cost assumptions, not provider prices. At $25 net product revenue, included cost is $13.05 and contribution is $11.95, giving 47.8% contribution margin under this policy. Additional variable support could reduce it.

Average cost is insufficient for an allowance decision. Model the distribution across light, typical, and heavy users, plus failure and retry costs. A profitable average can conceal a segment that repeatedly consumes more than its revenue. Reserve expected usage cost before starting expensive work and reconcile actual cost afterward. Use transparent limits, smaller evidence refreshes, caching where valid, and task-appropriate model routing to reduce waste before degrading the customer's essential outcome.

ClimbOS should maintain a versioned provider-price registry, usage ledger, entitlement ledger, and margin calculator. No model name, current token price, or hosting allowance is hard-coded in this book because those values can change. The implementation must verify actual provider billing definitions, discounts, regional terms, and tax treatment. Release a package only after its defined heavy-use scenario meets the target or its overage policy prevents an uncontrolled subsidy.

## 12. Treat cash, capacity, and timing as growth constraints

A strategy can produce positive modeled contribution and still fail because cash is paid before receipts arrive. Annual prepayments, refunds, inventory purchases, advertising charges, and customer payment terms have different timing. Build a cash schedule separate from the profit model. Show the lowest projected cash balance and the assumptions that drive it. Do not tell a small owner that a campaign is affordable merely because its average forecast return is positive.

Capacity creates another boundary. A service business with ten remaining delivery slots cannot sell fifty additional appointments without changing its operating system. An agency may have unused design capacity but no project-management capacity. A marketplace may attract demand that cannot be fulfilled. Model the limiting resource and the consequence of exceeding it, including delays, overtime, churn, or refunds. Growth planning should optimize worthwhile throughput rather than unconstrained leads.

Hypothetical example: a service package contributes eighty units and requires two specialist hours. The firm has twenty spare specialist hours, so incremental capacity is ten packages. A proposed campaign promises thirty sales from a six-hundred-unit media budget. Even if the forecast were credible, only ten packages fit existing capacity, producing eight hundred contribution before acquisition cost. The apparent upside of thirty packages is not available without additional delivery arrangements and costs.

Use the constraint to choose an intervention. If demand is weak, acquisition may be appropriate. If demand exceeds capacity, improve scheduling, raise prices carefully, remove low-value work, reduce delivery time without harming quality, or invest in capacity. Each alternative changes the economics differently. The owner should compare them rather than letting the marketing tool automatically recommend more traffic whenever revenue growth is requested.

For ClimbOS, record cash ceilings, labor availability, inventory, appointment slots, and customer-specific restrictions as first-class constraints. A recommendation exceeding one should be blocked or marked conditional with the required change. AI can help identify overlooked bottlenecks, but the feasibility calculation should run in code. The interface should translate the result into a concrete instruction: “This plan requires eight more specialist hours than currently available,” accompanied by alternatives the owner can actually evaluate.

## 13. Use AI to explain and investigate, not to fabricate precision

AI is useful for translating a business question into candidate analyses, identifying suspicious patterns, drafting metric definitions, summarizing cohort differences, and explaining uncertainty. It is especially useful when an owner does not know which question to ask. It should not silently choose currencies, invent missing baselines, compute financial formulas freehand, or interpret every correlation as a cause.

Design an analytical workflow with explicit boundaries. The model proposes a query plan against approved metrics. A deterministic layer validates entities, permissions, dates, units, and query scope. The calculation engine returns values and quality annotations. The model explains those returned results and identifies competing explanations. A final validator checks that every reported number resolves to an approved calculation and that uncertainty language matches the method.

A hypothetical alert says revenue fell 15%. The first investigation should establish whether this reflects complete comparable periods. Next separate customer count, purchase frequency, realized price, refunds, and currency effects. Then inspect segments and timing. AI can propose hypotheses such as a checkout failure or a customer mix change. It cannot establish either hypothesis merely because it is common in marketing advice. Attach the evidence needed to confirm or reject each explanation.

Automation is appropriate for repeated, reversible monitoring tasks: incomplete data warnings, cost anomalies, cohort maturity notifications, and scheduled reconciliation. Material changes such as changing prices or shifting budgets should require authorization appropriate to their scope. A connected analytics account grants data access, not permission to spend or publish. Preserve this distinction in the application rather than relying on a prompt to remember it.

For ClimbOS, build an `AnalysisRequest` contract with question, approved datasets, snapshot, allowed operations, cost ceiling, and output schema. Never send tenant secrets or irrelevant raw customer data to a model merely because they exist. Store concise supporting evidence, not hidden reasoning traces. Evaluate the workflow on synthetic known-answer calculations, missing-data cases, and ambiguous business situations. Measure unsupported-claim rate and owner correction burden alongside latency and cost. The goal is fewer costly misunderstandings, not a more confident dashboard narrator.

## 14. Machine-readable playbooks

The following playbooks are implementation-ready knowledge contracts, not authorization to access a real account or execute a financial action. Bind their symbolic metric identifiers to tenant-scoped observations before use. Null values are deliberately allowed when the corresponding fact is unavailable.

```yaml
playbook_id: analytics.forecast_readiness.v1
purpose: Choose a defensible forecast mode
required_inputs:
  - business_snapshot_id
  - target_metric_definition_id
  - observation_window
  - metric_quality_status
optional_inputs:
  - historical_series_id
  - intervention_driver_assumptions
steps:
  - id: validate
    operation: validate_metric_contract
    fail_state: blocked_incompatible_definition
  - id: quality
    operation: check_freshness_coverage_duplicates
    fail_state: blocked_unreliable_input
  - id: choose_method
    branches:
      - when: no_valid_historical_series
        result: assumption_scenarios_only
      - when: historical_series_and_adequate_backtest_windows
        result: compare_simple_baselines_and_candidate_models
      - when: historical_series_but_insufficient_windows
        result: descriptive_trend_with_explicit_limitations
  - id: sensitivity
    operation: identify_decision_changing_assumptions
  - id: capacity
    operation: validate_cash_labor_inventory_constraints
output_contract:
  fields:
    - method
    - input_evidence_ids
    - formula_versions
    - assumptions
    - forecast_window
    - scenario_or_interval_type
    - limitations
    - decision_recommendation
execution_authority: none
```

```json
{
  "playbook_id": "pricing.contribution_floor.v1",
  "currency": "USD",
  "inputs": {
    "other_included_variable_cost": 12,
    "fixed_payment_fee": 0.3,
    "proportional_payment_fee": 0.03,
    "target_contribution_margin": 0.3
  },
  "formula": "(other_included_variable_cost + fixed_payment_fee) / (1 - target_contribution_margin - proportional_payment_fee)",
  "expected_result_rounded": 18.36,
  "rounding": "display_two_decimals_calculate_full_precision",
  "assertions": [
    "all_costs_nonnegative",
    "denominator_positive",
    "currency_consistent",
    "cost_policy_version_present",
    "actual_provider_prices_not_inferred_from_example"
  ],
  "prohibited_interpretations": [
    "minimum_price_is_optimal_market_price",
    "contribution_margin_is_company_net_profit",
    "illustrative_fees_are_current_provider_prices"
  ],
  "execution_authority": "none"
}
```

Implement these as validated schemas and deterministic functions. The YAML branch labels require application logic; they are not executable code by themselves. The JSON fixture should become a known-answer calculator test. Extend it with zero revenue, missing currency, nonpositive denominator, discounts, refunds, and heavy-use distribution cases. A correct implementation preserves the distinction between computation, recommendation, and execution.

## 15. A complete operating review for a hypothetical SaaS

Consider a hypothetical self-serve business deciding how to use its next month of growth effort. It has 2,000 qualified visits, 100 trials, forty activations, and twelve paying customers from a mature cohort. Monthly contribution per newly paying customer is fifty units before acquisition cost. Acquisition expenditure is six hundred units. On this narrow first-period view, acquired contribution equals acquisition expenditure. That does not establish lifetime profitability because future retention and support costs remain uncertain.

The owner proposes doubling media spend. Begin by asking whether qualified traffic scales at the same cost and quality. Neither follows automatically from current results. Next inspect onboarding. If twenty trial accounts encountered the same reproducible setup error, repairing it might be a lower-cost hypothesis than doubling traffic. The error observation still does not prove those accounts would have paid; it identifies a plausible mechanism worth investigating.

Create three alternatives: maintain current media and repair the error, run a bounded audience test, or make no acquisition change while measuring retention. Compare cash exposure, labor, evidence strength, time to useful observation, and potential downside. Suppose the repair takes six hours, the audience test requires two hundred units, and retention observation requires another month. These are planning assumptions. The owner may reasonably combine the repair with retention instrumentation while deferring the larger media increase.

Write the decision in an auditable record. The recommended next step is a repair with a defined activation metric and a mature-cohort observation window. The scale condition is improved retained contribution with acceptable acquisition economics, not merely more trials. The stop condition includes unexpected support burden or deteriorating paid conversion. The next review date should correspond to the time required for the cohort to mature, not an arbitrary weekly reporting habit.

ClimbOS implementation should link the repair recommendation to the observed error, the assumed mechanism, estimated labor, relevant cohort, and calculation results. After execution, record the actual repair date and whether the planned population was exposed. If the owner never deploys the repair, do not label the strategy unsuccessful. If activation improves during a simultaneous price promotion, record the confounder. The learning system becomes valuable by preserving these distinctions over many decisions.

## 16. Implementation checklist and acceptance criteria

Implement the analytics module in layers. First create the metric catalog and deterministic formulas. Then ingest one authoritative source and reconcile it. Add quality status and source provenance before building broad dashboards. Next implement mature-cohort reporting, scenario modeling, contribution economics, and capacity gates. Only then add natural-language explanations and alerting. This order reduces the chance that a polished interface hides an unstable foundation.

The minimum useful owner experience has four linked views. The decision view states the recommended next action. The evidence view explains measured observations and gaps. The economics view exposes formulas, cost boundaries, and sensitivity. The learning view records what was executed and what happened afterward. These views can share a compact interface, but their underlying concepts should remain distinct. An owner must be able to change an assumption without altering a measured historical fact.

For the Convex-backed design, persist immutable snapshots, metric definitions, observations, quality issues, calculations, forecasts, pricing packages, usage records, and outcome reviews. Enforce tenant scope from authenticated server context. Keep expensive external calls outside deterministic calculations. The Vercel interface should show progress, partial failures, and stale inputs explicitly. Use Resend only for authorized notifications with the same tenant and recipient checks as other outbound actions.

Acceptance requires more than successful rendering. Verify that the known-answer examples reproduce, incompatible units are rejected, immature cohorts are labeled, absent data is not coerced to zero, and scenario ranges never acquire confidence-language labels without a supported method. Confirm that a pricing change or new provider price invalidates affected margin calculations. Confirm that recalculation cannot silently authorize a budget or price change.

Finally, review the product's language. “Estimated under these assumptions” should accompany uncertain scenarios. “Observed” should identify actual measured outcomes. “Attributed” should remain distinct from “caused.” “At least 30% contribution margin” should identify included costs and usage assumptions. These are not cosmetic caveats; they determine whether the owner understands the decision. An analytics product earns trust when its numbers remain reproducible, its recommendations survive reasonable scrutiny, and its uncertainty leads to a useful next step.

## 17. Calibrate forecasts and audit recommendation changes

Once forecasts are stored, review them against outcomes at the same horizon and definition. A forecast for thirty-day paid conversion cannot be assessed using payments collected after seven days. Preserve the forecast as it was issued, including its assumptions, rather than recomputing it with newer information and comparing that revised number with reality. Otherwise the system evaluates hindsight instead of forecasting skill.

For point forecasts, report directional bias and an error measure appropriate to the data. Absolute error is easy to explain in business units. Percentage error becomes problematic near zero and can make small businesses dominate a comparison. For interval forecasts, examine how often observed outcomes fall inside the stated interval and how wide the interval is. A system that predicts an enormous range can achieve high coverage without providing useful guidance. Assess calibration and sharpness together under the chosen method.

Hypothetical example: ClimbOS repeatedly predicts twelve paying customers for comparable thirty-day windows, while observed outcomes are usually six to eight. Investigate optimistic assumptions, incomplete conversion windows, traffic-quality differences, and implementation shortfalls before replacing the forecasting model. If the proposed interventions were not executed, that is a scenario-adherence issue as well as an outcome difference. Record both rather than pretending the model alone caused the miss.

Recommendation auditing asks a related question: why did the advised action change? A new decision may follow from new evidence, changed owner constraints, a corrected formula, or a different strategy policy. Store that reason. An owner should not receive contradictory advice across two runs without an explanation. When the evidence did not change, compare the candidates and identify whether the difference reflects nondeterminism rather than a defensible update.

For ClimbOS, create a scheduled forecast review only when the outcome window has matured and the owner has authorized the notification. Link each review to the original forecast, actual observations, execution status, and confounders. Use accumulated errors to improve assumptions and model selection, with held-out evaluation before changing production policy. The useful deliverable is a better-calibrated next decision, not a retrospective claim that every unexpected outcome was impossible to foresee.

## References and research boundaries

Primary documentation and established methodological references were checked for this edition on October 19, 2026. Provider documentation is mutable; implementation must recheck affected capabilities and billing terms. Publication dates were not established for the live documentation pages. No benchmark or hypothetical business result in this book is presented as a real company outcome.

- Google Analytics, [Get started with attribution](https://support.google.com/analytics/answer/10596866). Supports the distinction between available attribution models and credit assignment; does not establish causal lift for ClimbOS customers.
- Hyndman and Athanasopoulos, [Forecasting: Principles and Practice — Evaluating point forecast accuracy](https://otexts.com/fpp3/accuracy.html). Supports out-of-sample evaluation and forecast-accuracy concepts; does not validate a particular ClimbOS forecasting model.
- Stripe, [Usage-based pricing for SaaS](https://stripe.com/resources/more/usage-based-pricing-for-saas-how-to-make-the-most-of-this-pricing-model). Supports pricing-model mechanics and tradeoffs; does not supply the hypothetical fees used above.
- Stripe, [CAC in SaaS](https://stripe.com/en-mt/resources/more/cac-in-saas). Relevant methodological reference retrieved for this edition; retrieval status is recorded in the source registry.
- R statistical documentation, [Power calculations for two-sample proportions](https://stat.ethz.ch/R-manual/R-devel/library/stats/html/power.prop.test.html). Relevant methodological reference retrieved for this edition; retrieval status is recorded in the source registry.
