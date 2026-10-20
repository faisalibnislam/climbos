# Subscription economics: cost per customer, payback, churn, cash (For Entrepreneurs)

Edition 2026-10-20. Source family `DS`. Original synthesis with attribution; no article text reproduced. Records: [source_registry.json](../source_registry.json), notes: [notes/DS.json](../notes/DS.json).

David Skok's SaaS metrics pages (mostly 2009-2016) remain the clearest definitions of cost per customer, payback, churn types and the cash trough. ClimbOS's payback and 12-month value formulas already agree with his gross-margin version; the gaps are in what goes into them. Seven pages were read; formulas and charts embedded as images were not readable.

## Articles read

| ID | Title | Author | Published | Access |
|---|---|---|---|---|
| DS-01 | [SaaS Metrics 2.0 – A Guide to Measuring and Improving What Matters](https://www.forentrepreneurs.com/saas-metrics-2/) | David Skok | not stated | partial |
| DS-02 | [SaaS Metrics 2.0 – Detailed Definitions](https://www.forentrepreneurs.com/saas-metrics-2-definitions-2/) | David Skok | not stated | partial |
| DS-03 | [What's your TRUE customer lifetime value (LTV)? – DCF provides the answer](https://www.forentrepreneurs.com/ltv/) | David Skok (with Stan Reiss) | not stated | partial |
| DS-04 | [Startup Killer: the Cost of Customer Acquisition](https://www.forentrepreneurs.com/startup-killer/) | David Skok | not stated | partial |
| DS-05 | [How Sales Complexity Impacts your Startup's Viability](https://www.forentrepreneurs.com/sales-complexity/) | David Skok | not stated | partial |
| DS-06 | [Unlocking the Path to Negative Churn](https://www.forentrepreneurs.com/why-churn-is-critical-in-saas/) | David Skok | not stated | partial |
| DS-07 | [SaaS Economics – Part 1: The SaaS Cash Flow Trough](https://www.forentrepreneurs.com/saas-economics-1/) | David Skok | not stated | partial |

## Durable principles vs dated material

**Durable (author ideas, adopted with conditions):**
- Cost per customer is fully loaded: media, people and other acquisition costs in the same period.
- Payback should use gross margin; churn-weighted payback is longer and must be labelled.
- Customer churn, revenue churn and expansion are different numbers; expansion can make net churn negative.
- Cohorts beat one blended churn rate once data exist.
- Fast growth deepens the cash trough before it pays back; upfront or annual payment shrinks it.
- The sales motion must be affordable at the price (sales-complexity fit).

**Dated or context-bound (kept as labelled references, never as universal thresholds):**
- LTV at least 3x CAC (assumes simple LTV and gross margin of 80%+; Skok later said it needs revision).
- Payback under 12 months, best 5-7 (2009-2011; later relaxed for well-funded companies).
- Net revenue churn red flags and NRR targets (venture-backed and public SaaS).
- A 10% discount rate (2016 cost of capital).

**How far to trust it:** Rules of thumb are venture-backed SaaS norms of their time; ClimbOS keeps formulas and drops the thresholds as pass/fail gates. Worked examples here are recomputed by the validator.

## DS-C1: Label payback by definition; keep the churn-weighted gate

**Decision it helps make.** Whether a play pays back, and which payback number and benchmark to show the owner.

**Applies when**
- Any play with revenue per customer, gross margin, churn and a CAC.

**Avoid when**
- Churn is unknown. ClimbOS already returns null (economics.ts:206); keep that behaviour.

**Evidence and prerequisites**
- Revenue per customer per month
- Contribution or gross margin with its cost boundary
- Monthly churn with its type (customer or revenue)
- Fully loaded CAC (DS-C2)

**Steps**
1. Compute the GM-adjusted no-churn payback (DS-FX3) and the churn-weighted payback (DS-FX4).
2. Use the churn-weighted figure for the verdict.
3. Show both, labelled 'per surviving customer' and 'expected, with churn'.
4. When citing external benchmarks, attach their era and basis (no churn, GM ≥ 80%, venture-backed).

**When data, traffic, budget or integrations are missing**
- Missing churn: show only the no-churn payback, labelled as an upper bound on speed, with no verdict.
- No cohorts: use the owner's churn, tagged as an assumption.
- Small sample: give a range across churn of 0.5×–2× (economics.ts:405 already does this).

**Metrics**
- payback_gm_months
- payback_churn_months
- value_12m

**Guardrails**
- Never compare the churn-weighted payback with Skok's '<12' or '5–7 months' without a label.
- Never present LTV:CAC 3× as a pass/fail test.

**Observation window.** 12 months, the ClimbOS horizon (economics.ts:89-90).

**Stop or review when**
- Re-run when the owner confirms churn or margin.
- Re-run when observed cohort churn differs from the input by 50% or more.

**Where it belongs in ClimbOS.** shared/growth/calc.ts:56-71; shared/agents/economics.ts:207-219, 312-313

**Author guidance (source findings):** DS-01-F2, DS-02-F4, DS-02-F6, DS-03-F6. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: Skok's payback is per surviving customer. ClimbOS's is an expected value over a decaying cohort, which is stricter and better suited to owner-funded businesses.

**Proposed ClimbOS rule:** Proposed rule: the locked numbers show 'payback X months with churn (Y months per surviving customer)'. Benchmarks always carry era and basis.

**Overlap with existing guidance:** Book 01 §6 (01_business_strategy_economics.md:78) already asks for cumulative month-by-month payback, and Book 12 (12_analytics_forecasting_pricing.md:111) gives the no-churn example.

**Disagreements and what decides them:** Skok later accepted 18–24 month paybacks for well-capitalised companies. ClimbOS's 12-month horizon follows Skok's own reasoning that startups without cheap capital cannot wait, so for small businesses 12 is defensible.

**Playbook:** [BRP-17](../playbooks/BRP-17-unit-economics-definitions.json) · **Evaluation case:** BR-EV21 ([cases.json](../evaluations/cases.json))

## DS-C2: Fully loaded CAC with a cost boundary, including non-media costs

**Decision it helps make.** Which costs count in cost per customer.

**Applies when**
- Every play cost and every observed channel CAC.

**Avoid when**
- Comparing channels on mixed boundaries (Book 01:72).

**Evidence and prerequisites**
- Media spend
- Owner and staff hours with their value
- Tools, freelancers, creative, data and ClimbOS credits attributable to the play
- A cost-boundary label

**Steps**
1. Add an 'other monthly costs' input per play (tools, freelance, creative, data).
2. Pass it to cacFull instead of 0 (economics.ts:203).
3. Show media-only CAC next to it (calc.ts:28-32).
4. Put retention and account-management costs (Skok's CORE) in gross margin, not in CAC.

**When data, traffic, budget or integrations are missing**
- Missing hours: use the default $50 per hour (economics.ts:83-88), flagged as assumed.
- No tool costs known: show 0 and mark it 'not included'.

**Metrics**
- cac_media
- cac_full
- cost_boundary

**Guardrails**
- Do not apply Skok's early-stage practice of counting only part of senior salaries to owner time; for an owner-operator those hours do not scale away (DS-02-F10).

**Observation window.** The play horizon (economics.ts:193).

**Stop or review when**
- Review when a cost category is added or removed.

**Where it belongs in ClimbOS.** shared/growth/calc.ts:34-40; shared/agents/economics.ts:199-203, 381

**Author guidance (source findings):** DS-04-F2, DS-01-F3, DS-07-F3, DS-03-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: valuing owner time at an hourly rate is a ClimbOS extension. It is consistent with Skok's rule of no exclusions, though Skok never mentions founder time.

**Proposed ClimbOS rule:** Proposed rule: cacFull receives the play's non-media costs. The margin question (economics.ts:381) asks for cost 'to deliver and keep' a customer.

**Overlap with existing guidance:** Book 01:72-76 and Book 12:105-111 already define the cost boundary; the code drops 'other'.

**Disagreements and what decides them:** None material.

**Playbook:** [BRP-17](../playbooks/BRP-17-unit-economics-definitions.json) · **Evaluation case:** BR-EV22 ([cases.json](../evaluations/cases.json))

## DS-C3: Separate customer churn, revenue churn and expansion

**Decision it helps make.** Which churn drives value and payback, and whether expansion counts.

**Applies when**
- Recurring businesses with customers of different sizes, or with upsell, usage or seat pricing.

**Avoid when**
- One-off purchase businesses: use repeat rate instead.

**Evidence and prerequisites**
- Monthly MRR lost from churn and downgrades
- Expansion MRR
- Customer counts
- Revenue per customer per month (cohorts.ts revenueMinor)

**Steps**
1. Ask or measure customer churn and revenue churn separately.
2. Add optional monthly expansion.
3. Use net revenue churn for value and payback, capped at 12 months (DS-EX4).
4. Use customer churn for customer-count goals (goal.ts:71).

**When data, traffic, budget or integrations are missing**
- Missing revenue churn: fall back to customer churn, labelled 'customer churn used as proxy'.
- Small sample: show a range.

**Metrics**
- customer_churn
- mrr_churn
- expansion
- net_mrr_churn
- nrr

**Guardrails**
- Never let negative net churn produce unbounded value; keep the 12-month cap.
- Expansion must be observed, or tagged as an assumption.

**Observation window.** Monthly, read over at least 3 complete months.

**Stop or review when**
- Review if expansion assumed above 0 is not observed within 90 days.

**Where it belongs in ClimbOS.** shared/agents/economics.ts:44-74, 382; shared/growth/calc.ts:48-54, 90-94; shared/agents/goal.ts:71

**Author guidance (source findings):** DS-01-F4, DS-01-F5, DS-02-F7, DS-03-F1, DS-06-F2. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: ClimbOS's single churn field mixes the customer and revenue concepts.

**Proposed ClimbOS rule:** Proposed rule: add monthlyRevenueChurn and monthlyExpansion as optional inputs. The value formula uses (1 + g)(1 − c_rev), with g and c_rev both observed or tagged as assumed.

**Overlap with existing guidance:** Book 12:49 already warns that accounts and revenue retain differently.

**Disagreements and what decides them:** Skok's expansion LTV uses linear dollar growth; the proposal uses compound growth over 12 months. Both are labelled simplifications.

**Playbook:** [BRP-17](../playbooks/BRP-17-unit-economics-definitions.json) · **Evaluation case:** BR-EV23 ([cases.json](../evaluations/cases.json))

## DS-C4: Cohort survival instead of blended churn when billing data exist

**Decision it helps make.** Whether to use a single churn rate or the observed survival curve.

**Applies when**
- Payments are connected (convex/analytics.ts:311 computeCohorts) and at least 3 cohorts have 3 or more complete months.

**Avoid when**
- Cohorts smaller than about 20 customers; show counts instead.
- Annual contracts before their first renewal (DS-02-F8).

**Evidence and prerequisites**
- Monthly cohort retention and revenue (cohorts.ts:19-28)
- Connected billing

**Steps**
1. Average retention by cohort age, weighted by cohort size.
2. Feed the survival curve S_t into the payback and value sum instead of (1 − c)^t.
3. Flag early-month churn concentration.
4. Compare newer cohorts with older ones to show whether fixes worked.

**When data, traffic, budget or integrations are missing**
- No cohorts: use the owner's churn as an assumption.
- Small sample: show raw counts and a wide range.

**Metrics**
- retention_by_age
- survival_weighted_value_12m
- first_month_churn

**Guardrails**
- Immature months stay null, never zero (cohorts.ts:5-7 already does this).
- Do not extrapolate past the observed months without a label.

**Observation window.** Up to 6 months as computed today (analytics.ts:311 maxMonths 6), extended to 12 for value.

**Stop or review when**
- Review when a new cohort completes month 3.

**Where it belongs in ClimbOS.** shared/attribution/cohorts.ts; convex/analytics.ts:311; shared/agents/economics.ts:126-130

**Author guidance (source findings):** DS-01-F6, DS-03-F4, DS-03-F5, DS-02-F8. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: ClimbOS computes cohorts but economics ignores them, so value assumes a constant hazard even when early churn dominates.

**Proposed ClimbOS rule:** Proposed rule: when cohort data meet the minimum, observed survival replaces monthlyChurn in playMaths, tagged 'measured'.

**Overlap with existing guidance:** Book 12 §4 (12_analytics_forecasting_pricing.md:43-53) and Book 01:86-92 already call for cohort-based contribution.

**Disagreements and what decides them:** None.

**Playbook:** [BRP-18](../playbooks/BRP-18-cohort-retention.json) · **Evaluation case:** BR-EV25 ([cases.json](../evaluations/cases.json))

## DS-C5: No uncapped LTV or LTV:CAC 3× gate

**Decision it helps make.** How to express customer value.

**Applies when**
- Always.

**Avoid when**
- Never use the uncapped form.

**Evidence and prerequisites**
- Same as DS-C1

**Steps**
1. Keep 12-month churn-weighted contribution as the allowable CAC.
2. If a longer view is wanted, show 24-month value discounted at a stated rate and labelled as a forecast.

**When data, traffic, budget or integrations are missing**
- Missing churn: show no value at all (current behaviour).

**Metrics**
- value_12m

**Guardrails**
- Never show LTV = ARPA × GM / churn as a headline.
- Never use 3× as a threshold.

**Observation window.** 12 months.

**Stop or review when**
- (none recorded)

**Where it belongs in ClimbOS.** shared/agents/economics.ts:139-142, 207

**Author guidance (source findings):** DS-03-F1, DS-03-F2, DS-03-F6, DS-03-F7, DS-02-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: Skok's own 2016 revision supports ClimbOS's capped approach.

**Proposed ClimbOS rule:** Proposed rule: keep as is, and add a lint that rejects any plan text quoting a lifetime value or a 3× rule.

**Overlap with existing guidance:** Book 01 §7 (01_business_strategy_economics.md:82-92); Book 12:109.

**Disagreements and what decides them:** Skok still treats LTV as useful for comparing segments. ClimbOS can compare segments on 12-month value instead.

**Playbook:** [BRP-17](../playbooks/BRP-17-unit-economics-definitions.json) · **Evaluation case:** BR-EV24 ([cases.json](../evaluations/cases.json))

## DS-C6: Match sales touch to customer value (sales-complexity fit)

**Decision it helps make.** Which acquisition motion a price point can afford.

**Applies when**
- Choosing between self-serve, light-touch outreach and high-touch selling.

**Avoid when**
- When the play has its own measured CAC; use playMaths instead of the heuristic.

**Evidence and prerequisites**
- Price
- Gross margin
- Churn
- Hours per customer of the motion
- DS-C1, DS-C2

**Steps**
1. Compute the CAC-aware minimum price (DS-FX17) for the motion's expected CAC.
2. If price is below it, recommend lowering touch (demo video, comparison page, published objections, trial) or raising value or price.
3. Replace the static $25 and $300 thresholds with this computed check where inputs exist.

**When data, traffic, budget or integrations are missing**
- Missing economics: keep the static heuristic (scoring.ts:109; capacity.ts:14), labelled as a ClimbOS rule of thumb, not Skok's.

**Metrics**
- price_min_per_month
- touch_hours_per_customer

**Guardrails**
- Do not claim Skok's 10× per tier as a measured number for a given business; it was his rough estimate.

**Observation window.** Per plan.

**Stop or review when**
- Review when price or touch level changes.

**Where it belongs in ClimbOS.** shared/acquisition/scoring.ts:109-155, 236-245; shared/agents/capacity.ts:14,55; shared/analysis/decisions.ts:53-67

**Author guidance (source findings):** DS-05-F1, DS-05-F2, DS-05-F4, DS-04-F5, DS-04-F6. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: ClimbOS already encodes Skok's direction but with fixed thresholds that are not derived from his work.

**Proposed ClimbOS rule:** Proposed rule: add a 'cac_price_floor' kind to decisions.ts calculate() using DS-FX17.

**Overlap with existing guidance:** scoring.ts price-fit logic and capacity.ts rule.

**Disagreements and what decides them:** Skok placed channel or partner sales in a danger zone. ClimbOS's partner plays (scoring.ts:119) are lighter-weight referrals; treat them as their own case.

**Playbook:** [BRP-19](../playbooks/BRP-19-sales-touch-fit.json) · **Evaluation case:** BR-EV26 ([cases.json](../evaluations/cases.json))

## DS-C7: Show the cash trough and the upfront-payment lever

**Decision it helps make.** Whether the owner can fund a play's growth before it pays back.

**Applies when**
- Any play with spend before contribution arrives, especially when scaling spend.

**Avoid when**
- Businesses paid upfront with contribution at or above CAC in month 0.

**Evidence and prerequisites**
- Monthly spend schedule
- Customers per month
- Contribution timing
- Billing terms
- DS-C1

**Steps**
1. Simulate the monthly cumulative cash for the portfolio over 24 months (DS-FX16).
2. Report the lowest cash point, its month and the cash breakeven month.
3. Show the effect of annual prepayment or a deposit.

**When data, traffic, budget or integrations are missing**
- Missing timing: assume contribution starts the month after acquisition, labelled.

**Metrics**
- trough_amount
- trough_month
- cash_breakeven_month

**Guardrails**
- Do not call a play affordable because value exceeds CAC if the trough is larger than the owner's stated cash.

**Observation window.** 24 months.

**Stop or review when**
- Pause scaling if the observed trough runs deeper than planned by 25% or more.

**Where it belongs in ClimbOS.** shared/agents/economics.ts:298-319 (lockedNumbers), to be added

**Author guidance (source findings):** DS-01-F8, DS-01-F9, DS-07-F1, DS-07-F2. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: Skok's trough is about venture-funded scaling. For a small owner, the trough is personal cash.

**Proposed ClimbOS rule:** Proposed rule: lockedNumbers adds a line 'lowest cash point −X in month M, breakeven month B'.

**Overlap with existing guidance:** Book 12:141 and Book 01:96 call for it; there is no code yet.

**Disagreements and what decides them:** None.

**Playbook:** [BRP-20](../playbooks/BRP-20-cash-trough.json) · **Evaluation case:** BR-EV27 ([cases.json](../evaluations/cases.json))

## Not read or excluded

- https://www.forentrepreneurs.com/saas-economics-2/: Not fetched; budget went to the 7 core pages. Part 2 covers growth hiring and annual prepayment cash effects. The trough conclusions here rely on DS-01 and DS-07.
- https://www.forentrepreneurs.com/demystifying-churn/: Not fetched; overlaps DS-01 and DS-06.
- https://www.forentrepreneurs.com/multi-axis-pricing-a-key-tool-for-increasing-saas-revenue/: Not fetched; it is on expansion pricing design, outside the formula scope.
- https://www.forentrepreneurs.com/predictable-revenue/: Not fetched; outbound process rather than economics.
- https://www.forentrepreneurs.com/sales-marketing-machine/inbound-marketing/: Not fetched; out of scope.
- SaaS-Metrics spreadsheets linked from DS-01/DS-03 (xlsx): Not downloaded: the task is read-only and file downloads need permission. Spreadsheets are also excluded by the copyright brief.
- https://web.archive.org/cdx/search/cdx?url=forentrepreneurs.com/*: Tried for first-capture dates; WebFetch is blocked from web.archive.org, so publication dates stay null.
- Formula and chart images on all pages: Not readable through WebFetch. Symbolic forms of the image-only formulas are labelled as standard forms, not verified.
