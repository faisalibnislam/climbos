# Trustworthy experimentation (Microsoft Experimentation Platform)

Edition 2026-10-20. Source family `EXP`. Original synthesis with attribution; no article text reproduced. Records: [source_registry.json](../source_registry.json), notes: [notes/EXP.json](../notes/EXP.json).

Microsoft's ExP articles (2020-2024) describe how a large experimentation platform keeps results trustworthy: checks before, during and after a test, sample-ratio-mismatch diagnosis, alerting, A/A tests, metric sensitivity and external validity. They extend the Kohavi book review (BK06) with operational detail. Eight articles were read in full.

## Articles read

| ID | Title | Author | Published | Access |
|---|---|---|---|---|
| EXP-01 | [Patterns of Trustworthy Experimentation: Pre-Experiment Stage](https://www.microsoft.com/en-us/research/articles/patterns-of-trustworthy-experimentation-pre-experiment-stage/) | Widad Machmouchi, Somit Gupta, Ruhan Zhang, Aleksander Fabijan | 2020-07-31 | full |
| EXP-02 | [Patterns of Trustworthy Experimentation: During-Experiment Stage](https://www.microsoft.com/en-us/research/articles/patterns-of-trustworthy-experimentation-during-experiment-stage/) | Widad Machmouchi, Somit Gupta, Ruhan Zhang | 2021-01-25 | full |
| EXP-03 | [Patterns of Trustworthy Experimentation: Post-Experiment Stage](https://www.microsoft.com/en-us/research/articles/patterns-of-trustworthy-experimentation-post-experiment-stage/) | Widad Machmouchi, Somit Gupta | 2021-12-24 | full |
| EXP-04 | [Diagnosing Sample Ratio Mismatch in A/B Testing](https://www.microsoft.com/en-us/research/articles/diagnosing-sample-ratio-mismatch-in-a-b-testing/) | Aleksander Fabijan, Vaibhav Kumar Bajpai, Trevor Blanarik, Max Caughron, Kewei Chen, Ruhan Zhang, Adam Gustafson, Venkata Kavitha Budumuri, Stephen Hunt | 2020-09-14 | full |
| EXP-05 | [Alerting in Microsoft's Experimentation Platform (ExP)](https://www.microsoft.com/en-us/research/articles/alerting-in-microsofts-experimentation-platform-exp/) | Ankita Agrawal, Vaibhav Kumar Bajpai, Jiannan Lu | 2021-03-03 | full |
| EXP-06 | [p-Values for Your p-Values: Validating Metric Trustworthiness by Simulated A/A Tests](https://www.microsoft.com/en-us/research/articles/p-values-for-your-p-values-validating-metric-trustworthiness-by-simulated-a-a-tests/) | Carl Mitchell, Andy Drake, Jonathan Litz, Garnet Vaz | 2020-10-21 | full |
| EXP-07 | [Beyond Power Analysis: Metric Sensitivity Analysis in A/B Tests](https://www.microsoft.com/en-us/research/articles/beyond-power-analysis-metric-sensitivity-in-a-b-tests/) | Wen Qin, Widad Machmouchi, Alexandre Matos Martins | 2021-04-06 | full |
| EXP-08 | [External Validity of Online Experiments: Can We Predict the Future?](https://www.microsoft.com/en-us/research/articles/external-validity-of-online-experiments-can-we-predict-the-future/) | Not listed on the page (Microsoft Experimentation Platform group) | 2024-11-20 | full |

## Durable principles vs dated material

**Durable (author ideas, adopted with conditions):**
- Check the split before reading any effect; diagnose a mismatch by stage.
- Only a valid, significant comparison earns causal wording.
- Guardrails are harm limits set in advance; stopping early for harm is allowed, stopping early on a win is not.
- Run whole weeks and look at results by week (novelty, spikes).
- Choose a metric that can move in the time available; keep the business outcome as a guardrail.
- Validate a new split mechanism with a dry run before trusting it.

**Dated or context-bound (kept as labelled references, never as universal thresholds):**
- ExP's p < 0.0005 split threshold and alert priorities (Microsoft-scale volumes).
- Effect drift figures from specific Microsoft products.

**How far to trust it:** Written for very high traffic; several practices (simulated A/A p-value studies, variance reduction) don't transfer to small businesses. ClimbOS adopts the logic, not the scale assumptions.

## EXP-C1: Split check before any lift (SRM gate with warn tier and diagnosis)

**Decision it helps make.** May ClimbOS read or report an effect from this split test yet?

**Applies when**
- ab_split or holdout with a planned allocation
- owner, integration or ad tool reports per-arm counts

**Avoid when**
- before/after or observational designs (no planned split)
- platform-run tests that do not expose per-arm counts (label attributed)

**Evidence and prerequisites**
- planned split
- observed units per arm at the analysis date
- unit definition (visitor, lead, contact)
- assignment done before exposure
- same unit counted in both arms

**Steps**
1. Run sampleRatio on planned vs observed
2. p < 0.001: block effect, show diagnosis
3. 0.001 <= p < 0.01: warn, hide winner wording until the owner confirms the cause is ruled out
4. Diagnose in order: assignment (manual picking, IDs) -> execution (redirect or extra step in one arm) -> logging (one arm tracked differently, filters) -> analysis (counting only people who reached a step one arm changed)
5. Note which arm is over and when the gap began
6. Never trim an arm to rebalance

**When data, traffic, budget or integrations are missing**
- low traffic: switch to alternating weeks or a before/after labelled observational
- no randomization: before/after with confounders
- no instrumentation: manual tally of sends per arm before any outcome count

**Metrics**
- units per arm
- SRM p-value
- direction of imbalance

**Guardrails**
- no effect wording while SRM unresolved

**Observation window.** Checked at every recorded analysis, cumulative from test start.

**Stop or review when**
- p < 0.001 unresolved after investigation: stop and restart the test
- imbalance appears after a mid-test change: restart from the change date

**Where it belongs in ClimbOS.** shared/analysis/decisions.ts:112-128 (sampleRatio); wire into convex/playResults.ts:108-130 and shared/growth/experimentOutcome.ts

**Author guidance (source findings):** EXP-04-F2, EXP-04-F3, EXP-04-F4, EXP-05-F1, EXP-02-F5. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: ExP's 0.0005 is tuned for thousands of tests with large arms; at a few hundred units a real skew often lands between 0.001 and 0.01, so a warn tier catches more real problems at an acceptable false-alarm rate for one test at a time.

**Proposed ClimbOS rule:** PROPOSED RULE: block at p < 0.001 (keep), warn at p < 0.01, always print which arm is over and the stage checklist.

**Overlap with existing guidance:** decisions.ts:120 block; BK06.md:217 already proposes the warn band; guide 06 lines 35-39 hypothetical 700/300.

**Disagreements and what decides them:** ExP threshold 0.0005 vs ClimbOS/Kohavi 0.001: not a correction worth making at small scale; the gap is the missing warn tier and diagnosis.

**Playbook:** [BRP-21](../playbooks/BRP-21-experiment-trust-gates.json) · **Evaluation case:** BR-EV28 ([cases.json](../evaluations/cases.json))

## EXP-C2: Incremental wording only after a valid, significant read

**Decision it helps make.** Can a recorded outcome say the change caused extra conversions?

**Applies when**
- design randomized or holdout
- both arms counted

**Avoid when**
- SRM failed or warned and unresolved
- planned end not reached
- metric redefined after results (already exploratory)

**Evidence and prerequisites**
- per-arm units and conversions
- planned split
- planned end date
- original metric and rule
- EXP-C1 split check passes

**Steps**
1. Run sampleRatio
2. Run compareRates with plannedEndReached
3. Set reading: srm_fail | too_early | no_reliable_difference | difference_detected
4. Only difference_detected may print 'about N incremental conversions'
5. Surprising large effects (Twyman): add 'replicate before scaling spend'

**When data, traffic, budget or integrations are missing**
- low traffic: report as directional with the interval of plausible changes
- no randomization: observed label (existing)
- no instrumentation: not_run or owner tally labelled observed

**Metrics**
- absolute change in points
- relative change
- p-value
- method (Fisher or z)

**Guardrails**
- guardrail bounds not breached (EXP-C3)

**Observation window.** Fixed: the planned duration, read once at the end.

**Stop or review when**
- no reliable difference: do not scale; decide on cost/simplicity or test a bigger change

**Where it belongs in ClimbOS.** shared/growth/experimentOutcome.ts:48-54, :88-93, :102-118; convex/playResults.ts:121

**Author guidance (source findings):** EXP-03-F1, EXP-03-F6, EXP-04-F2. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: ExP treats setup and SRM checks as preconditions for interpreting any metric movement; ClimbOS's design-only 'incremental' label skips them.

**Proposed ClimbOS rule:** PROPOSED RULE: 'incremental' stays a design label; claim wording depends on a computed reading field.

**Overlap with existing guidance:** compareRates already returns the right verdict and notes (decisions.ts:93-108); it is just not used by experimentOutcome.

**Disagreements and what decides them:** None with BK06; this is a wiring gap.

**Playbook:** [BRP-21](../playbooks/BRP-21-experiment-trust-gates.json) · **Evaluation case:** BR-EV29 ([cases.json](../evaluations/cases.json))

## EXP-C3: Guardrails as pre-set harm bounds, with harm stops allowed

**Decision it helps make.** Did the change cause harm that blocks shipping, and may the test stop early for it?

**Applies when**
- any live test touching customers: email, offers, pricing, booking flow, ads

**Avoid when**
- data-only plans with no exposure

**Evidence and prerequisites**
- 1-3 guardrails each with a numeric bound written before launch
- guardrail counts per arm
- guardrail measurable in both arms

**Steps**
1. At plan time: name guardrails with bounds (e.g. unsubscribe rate <= 1.0%, refunds <= 2 per 100 orders)
2. During test: check bounds weekly; a breach in treatment (with a minimum count) pauses the test: this is a harm stop, not peeking
3. At the end: goal up or flat and all guardrails within bounds -> ship-eligible; any breach -> no ship, or an explicit trade-off weighed in advance
4. Do not read a non-significant guardrail rise as 'safe'

**When data, traffic, budget or integrations are missing**
- low traffic: absolute bounds with a minimum count instead of significance
- no randomization: compare guardrail to the pre-period, labelled observed
- no instrumentation: owner-reported complaints/refunds log

**Metrics**
- unsubscribe or complaint rate
- refunds/cancellations
- no-shows
- support contacts
- page errors

**Guardrails**
- the guardrails themselves

**Observation window.** Same as the test; checked weekly.

**Stop or review when**
- bound breached with minimum count met: pause and review
- two weekly breaches: stop

**Where it belongs in ClimbOS.** shared/ai/tasks.ts:94 (guardrails), shared/agents/specs.ts:845 (PEEKING), :853-871 (lint), shared/growth/experimentOutcome.ts (no guardrail fields)

**Author guidance (source findings):** EXP-02-F1, EXP-02-F3, EXP-05-F1, EXP-05-F2, EXP-03-F5, EXP-07-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: ExP's 'metric out of range' alert (bounds plus TOST) cannot prove safety at small n, but a breach of an absolute bound is still detectable; so small businesses get the bound half of the method, not the equivalence half.

**Proposed ClimbOS rule:** PROPOSED RULE: ab_split/holdout lint requires 1-3 guardrails with a number; harm-subject stop rules are exempt from PEEKING; any breach blocks 'met'.

**Overlap with existing guidance:** BK06.md:190-194 and guide 06 line 62 say the same; playbooks/contracts.ts has prose guardrails per playbook (e.g. :196 unsubscribes) but no bounds.

**Disagreements and what decides them:** Current PEEKING regex can reject a legitimate harm stop; ExP endorses auto-shutdown for harm.

**Playbook:** [BRP-21](../playbooks/BRP-21-experiment-trust-gates.json) · **Evaluation case:** BR-EV30 ([cases.json](../evaluations/cases.json))

## EXP-C4: Whole weeks and a by-week view for novelty and spikes

**Decision it helps make.** Is the test long enough, and is the effect fading or a one-week artifact?

**Applies when**
- any ab_split/holdout
- gimmick-prone changes: subject lines, offers, new badges, creative

**Avoid when**
- time-boxed events (read EXP for event tests; label as event-specific)

**Evidence and prerequisites**
- durationDays
- per-week counts per arm (optional but needed for the flag)
- dates recorded

**Steps**
1. Lint: durationDays >= 7, warn if not a multiple of 7
2. At analysis: show each week's absolute change
3. Flag 'possible novelty' if week 1 change is more than double later weeks' change
4. Flag 'check data' if one week holds most conversions or a holiday/event falls in it
5. If flagged and reversible: extend or rerun before scaling

**When data, traffic, budget or integrations are missing**
- low traffic: compare week 1 vs the rest only, as a caution
- no randomization: same weekly view on before/after, labelled observed
- no instrumentation: owner notes events per week

**Metrics**
- absolute change per week
- conversions per week per arm

**Guardrails**
- guardrail bounds per week

**Observation window.** Minimum 7 days; 14+ for gimmick-prone changes (interpretation).

**Stop or review when**
- novelty flag: rerun or extend before scaling
- spike flag: verify data for that week

**Where it belongs in ClimbOS.** shared/agents/specs.ts:864 (duration), shared/analysis/decisions.ts:149 (note only), shared/growth/experimentOutcome.ts (no per-week fields)

**Author guidance (source findings):** EXP-02-F6, EXP-08-F1, EXP-08-F2, EXP-08-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: ExP's daily date segmentation becomes weekly at small-business volume; the flag is a caution because the per-week difference itself is not testable at this n.

**Proposed ClimbOS rule:** PROPOSED RULE: durationDays < 7 is an error for ab_split/holdout; optional weekly counts drive novelty and spike flags.

**Overlap with existing guidance:** BK06.md:203-209 and :226-227 propose novelty and duration checks; not implemented.

**Disagreements and what decides them:** BK06.md:226 suggests flagging a >50% decay from week 1; at small n this will fire on noise often, so keep it a caution label.

**Playbook:** [BRP-22](../playbooks/BRP-22-experiment-duration-and-metric.json) · **Evaluation case:** BR-EV31 ([cases.json](../evaluations/cases.json))

## EXP-C5: Pick a metric that can move; keep the outcome as a guardrail

**Decision it helps make.** Which primary metric makes this test feasible inside the horizon?

**Applies when**
- primary metric is a rare outcome (bookings, sales) at low traffic

**Avoid when**
- the proxy has no plausible link to the outcome
- proxy is easily gamed (clicks via bait)

**Evidence and prerequisites**
- weekly eligible units
- baseline for the outcome and for the candidate proxy
- proxy measured in both arms

**Steps**
1. Size the outcome with sampleSize at its own baseline
2. If weeks exceed the horizon, size a nearer step (e.g. 'clicked Book now')
3. Use the proxy as primary, keep bookings as a guardrail/secondary read
4. Count only units the change can reach (triggered), and dilute by reach rate before claiming site-wide impact
5. If the proxy is still infeasible: before/after or qualitative path

**When data, traffic, budget or integrations are missing**
- low traffic: one bigger change, longer window, or interviews
- no randomization: before/after on the proxy, labelled observed
- no instrumentation: manual counts of booking clicks for 2 weeks

**Metrics**
- proxy rate
- outcome rate
- trigger rate

**Guardrails**
- outcome rate does not fall
- proxy not gamed

**Observation window.** Whole weeks from sampleSize, within the plan horizon.

**Stop or review when**
- proxy up but outcome down: no ship

**Where it belongs in ClimbOS.** shared/agents/specs.ts:841-843, :853-871; shared/analysis/decisions.ts:131-153

**Author guidance (source findings):** EXP-07-F1, EXP-07-F2, EXP-07-F3, EXP-03-F4, EXP-01-F2. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: ExP's movement probability is estimated from corpora of past tests; ClimbOS can approximate it only with the baseline and MDE, so the actionable part is sizing per metric and using nearer funnel steps.

**Proposed ClimbOS rule:** PROPOSED RULE: size feasibility with the primary metric's baseline when known; suggest the nearest feasible funnel step otherwise.

**Overlap with existing guidance:** BK06.md:174 (surrogate metric), guide 06 lines 41-45 (low-volume paths); decisions.ts:150 already redirects >12-week tests.

**Disagreements and what decides them:** The generous fixed baseline at specs.ts:842 is intentional ('only clearly impossible tests fail'); ExP's sensitivity framing argues it should be metric-specific when the baseline is known.

**Playbook:** [BRP-22](../playbooks/BRP-22-experiment-duration-and-metric.json) · **Evaluation case:** BR-EV32 ([cases.json](../evaluations/cases.json))

## EXP-C6: Small-business A/A: a dry run of the split, not a p-value study

**Decision it helps make.** Is the owner's split mechanism trustworthy before the first real test?

**Applies when**
- first owner-built split (two email lists, alternating landing pages, staff assigning leads)
- after a tracking change

**Avoid when**
- platform-native split tools with proven assignment and exposed counts (still run the SRM check)

**Evidence and prerequisites**
- one week of both arms identical
- per-arm units and event types
- the same tracking in both arms

**Steps**
1. Run both arms identical for 7 days
2. sampleRatio passes (not warn)
3. Every event type appears in both arms; no unit in both arms
4. Do not judge conversion p-values: rare events give few possible outcomes
5. If unit-level history exists (e.g. an email list with past opens), ClimbOS can re-randomize it offline about 100 times in code and check that about 5% fall below 0.05

**When data, traffic, budget or integrations are missing**
- low traffic: dry run only
- no randomization: skip; use before/after
- no instrumentation: fix tracking first (diagnostics 'tracking' verdict)

**Metrics**
- units per arm
- event types per arm
- share of simulated p-values below 0.05

**Guardrails**
- no customer-visible difference during the dry run

**Observation window.** 7 days.

**Stop or review when**
- SRM warn or missing events: fix before any real test

**Where it belongs in ClimbOS.** New check beside shared/analysis/decisions.ts; guide 06_experimentation.md:20

**Author guidance (source findings):** EXP-06-F1, EXP-06-F3, EXP-03-F2, EXP-01-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: ExP's A/A is a statistical calibration on large logs; at small scale, its trust-check purpose (assignment and telemetry parity) transfers, its p-value calibration mostly does not.

**Proposed ClimbOS rule:** PROPOSED RULE: recommend a 7-day dry run before an owner's first manual split; pass = SRM pass + event parity.

**Overlap with existing guidance:** BK06.md:26 (A/A ~5% at 0.05); guide 06 line 20 (one A/A does not prove all future tests); diagnostics.ts:38-44 tracking check.

**Disagreements and what decides them:** None; ExP adds the rare-event caution (EXP-06-F3) that BK06 review does not mention.

**Playbook:** [BRP-23](../playbooks/BRP-23-split-dry-run.json) · **Evaluation case:** BR-EV33 ([cases.json](../evaluations/cases.json))

## Not read or excluded

- https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/page/2/: HTTP 404; listing pages 2 and 3 were read at ?pg=2 and ?pg=3 instead.
- https://www.microsoft.com/en-us/research/articles/a-a-b-testing-evaluating-microsoft-teams-across-build-releases/: Not fetched (build-release A/A'/B is Microsoft infrastructure, low relevance).
- https://www.microsoft.com/en-us/research/articles/why-tenant-randomized-a-b-test-is-challenging-and-tenant-pairing-may-not-work/: Not fetched (enterprise tenant randomization).
- https://www.microsoft.com/en-us/research/articles/more-trustworthy-a-b-analysis-less-data-sampling-and-more-data-reducing/: Not fetched (data pipeline scale).
- https://www.microsoft.com/en-us/research/articles/it-takes-a-flywheel-to-fly-kickstarting-and-keeping-the-a-b-testing-momentum/: Not fetched (organizational adoption).
- https://www.microsoft.com/en-us/research/articles/deep-dive-into-variance-reduction/: Read in full but not selected; used only as a limitation note on CUPED (Var multiplier 1/(1-R^2); many metrics gain 1.05x or less on one surface).
- https://www.microsoft.com/en-us/research/articles/stedii-properties-of-a-good-metric/: Read in full (via ?p=832888) but not selected; overlaps EXP-07.
- https://www.microsoft.com/en-us/research/articles/treatment-effect-assessment-at-scale-accounting-for-correlated-metrics-and-metric-relevance-in-modern-experimentation/: Read in full (2026-07-15) but not selected; scorecards with hundreds of metrics. Takeaway noted in EXP.md: ExP moved from Fisher's method to Benjamini-Hochberg; irrelevant metrics cost power.
- https://www.microsoft.com/en-us/research/articles/data-quality-fundamental-building-blocks-for-trustworthy-a-b-testing-analysis/: Read in full but not selected; overlaps EXP-03 and EXP-06.
- https://www.microsoft.com/en-us/research/articles/a-b-interactions-a-call-to-relax/: Read in full but not selected; concurrent-test interactions were rare (about 1 in 50,000 pair-metric checks in one product).
- https://www.microsoft.com/en-us/research/articles/for-event-based-a-b-tests-why-they-are-special/: Read in full but not selected; time-boxed event tests, recommends sequential tests if monitoring frequently.
- https://www.microsoft.com/en-us/research/articles/a-b-testing-and-covid-19-data-driven-decisions-in-times-of-uncertainty/: Read in full but not selected; the closest ExP article to 'decisions under uncertainty'. Point: randomized arms share shocks, raw baselines do not.
- https://www.microsoft.com/en-us/research/articles/measurably-improve-your-product-by-combining-qualitative-and-quantitative-methods/: Read in full but not selected; qual+quant workflow, no low-traffic guidance.
- (no URL found): No ExP article dedicated to 'misleading results / pitfalls' or 'decisions under uncertainty' by that name was found in the three listing pages; Covid-19 and post-experiment articles are the nearest.
