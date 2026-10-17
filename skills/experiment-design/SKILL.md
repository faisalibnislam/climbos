---
name: experiment-design
description: Design and read out marketing experiments that work at small-business volumes. Use when a plan, positioning or channel choice needs validating, when an owner wants to A/B test something, or when a test has finished and needs a readout. Covers choosing the right test type (message lab, smoke test, sequential before/after, cold-email reply test, customer conversations, holdout), volume maths, testing big swings high in the funnel, a pre-registration card with guardrails and scale/kill/iterate thresholds set in advance, and honest readouts labelled directional or strong.
---

## Purpose

You help a small business learn fast without fooling itself. Classic A/B testing mostly fails at small-business traffic: significance maths assumes a sample size fixed in advance, and peeking then stopping when a result "looks significant" makes the reported significance meaningless. Detecting a modest lift on a low conversion rate can take months of traffic a small site doesn't have. Great experiment design therefore tests big swings, measures high in the funnel where volume exists, uses ad platforms and outreach as message labs, counts qualitative evidence, and writes the decision rule before the test starts. A great readout reports what happened against that rule, with denominators, confounds and a confidence label, and turns it into one next action.

## Inputs you will get

- **The question to answer** (from a growth plan, positioning validation, a conversion audit or the owner).
- **Business brief and confirmed facts:** traffic, leads, sales, current conversion rates, spend, list sizes, time available.
- **Hypothesis sources:** VoC bank, competitor gaps, audit findings.
- **For a readout:** the original pre-registration card and the observed numbers.

When something is missing:
- No baseline rate: don't invent one. Use the business's own data, a rate from the research notes with its source and a "directional" label, or design a short baseline-measurement week first. Mark `[NEEDS FACT: current weekly sessions on the booking page]`.
- No original card for a readout: say the test was not pre-registered, so the result is directional at best, and propose a properly registered rerun if the decision matters.

## Procedure

1. **Write the decision first.** What will the owner do differently depending on the result? If no outcome would change a decision, don't run the test.

2. **Choose the test type** that the volume can support:
   - **Message lab (ads):** 3–5 genuinely different angles or offers run as ads to the same audience. Use the platform's A/B test feature or separate ad sets with equal budgets. If the algorithm is free to shift spend between ads in one ad set, you are watching a selection, not a test; report it that way.
   - **Smoke test / fake door:** a landing page, waitlist or refundable pre-order for an offer that doesn't exist yet, measured by sign-ups or deposits.
   - **Cold-email or outreach reply test:** two angles to matched, randomly split lists; reply and positive-reply rates as metrics.
   - **Sequential before/after:** change one big thing, compare equal-length windows with the same weekday mix, nothing else changed. Always "directional".
   - **Holdout (retention and email):** randomly hold back part of a segment from a flow, only when the segment is large enough for the volume maths.
   - **Customer conversations:** 5–10 calls with a fixed question script. At small scale this often beats statistics.
   - **Classic A/B on a page:** only if the volume maths below says it can finish within about 6 weeks.

3. **Test big swings.** Only test changes that could plausibly move the metric 30% or more: a new offer, new positioning, new channel, new price, a guarantee. Button colours and word tweaks are undetectable at this scale.

4. **Measure high in the funnel when volume is low.** Ladder: impressions → CTR → landing-page click-through → leads → booked calls → sales. Pick the highest step that still reflects the decision, and keep a lower step as a secondary read.

5. **Do the volume maths and show it.** Standard approximation for a two-variant test on a rate (80% power, 5% two-sided): visitors per variant ≈ 16 × p × (1 − p) ÷ d², where p is the baseline rate and d is the absolute difference you want to detect. Worked examples:
   - Landing-page purchase rate 3%, detect a 30% relative lift (d = 0.009): about 5,750 visitors per variant. Usually impossible for a small site; move up the funnel.
   - Landing-page click-through 20%, detect 30% relative (d = 0.06): about 710 visitors per variant. Often feasible.
   - Cold-email reply rate 4%, detect a doubling to 8% (d = 0.04): about 385 contacts per variant.
   Divide by weekly volume to get the run time. If it exceeds about 6 weeks, change the metric, the test type or the size of the swing.

6. **Set guardrail metrics** that stop a "winning" variant that does damage: refund or cancellation rate, unsubscribes, spam complaints (stay under 0.3% and ideally under 0.1% for bulk email, per Gmail sender rules), bounce rate on outreach (pause above 2%), lead quality (booked-call rate, not just form fills), margin per order when testing discounts.

7. **Pre-register on a card** (template in the reference): name, hypothesis with its evidence, primary metric, guardrails, baseline and its source, the swing you expect, volume needed with the maths, minimum and maximum run time, decision rule, cost and hours, owner, dates, confounds to watch.

8. **Write the decision rule as thresholds, not p-values.** Three outcomes, set before launch: **scale** ("≥25% relative lift in ad CTR after ≥4,300 impressions per variant, with cost per booked call no worse → roll the message out to the site and Google Business Profile"), **kill** ("<10% → drop"), **iterate once** (anything between: one revision, then decide). Say plainly that these are business thresholds, not significance tests.

9. **Control what you can.** One change per test. Same audience, budget, schedule and weekday mix across variants. Note seasonality, holidays, press, price changes and tracking changes. Don't run two tests on the same audience at once.

10. **Do not peek-and-stop.** Check that data is flowing in the first days (tracking works, spend is pacing), but make the decision only at the pre-registered volume or maximum run time. A guardrail breach is the only early stop.

11. **Write the readout:**
    - What ran, dates, and the registered rule (quoted).
    - Observed numbers with denominators per variant ("14 booked / 312 clicks = 4.5% vs 9 / 298 = 3.0%").
    - The decision the rule gives: scale, kill or iterate. Don't move the goalposts.
    - Confidence: **strong** (registered, volume reached, clean execution, lift well above threshold) or **directional** (sequential, under volume, confounds present, or a selection rather than a test).
    - Confounds and anything that broke.
    - Qualitative evidence (reply text, call notes) quoted verbatim.
    - One next action and what it means for the plan.

12. **Maintain the backlog.** Rank the next tests by expected impact on the 90-day goal, confidence and cost; run them sequentially on any shared audience.

## Quality bar

- **Decision-led:** each test names the decision it informs.
- **Feasible:** volume maths shown; run time within about 6 weeks or the design is changed.
- **Big swings:** tested changes could plausibly move the metric 30%+.
- **Right funnel level:** the metric sits where the volume is.
- **Pre-registered:** hypothesis, metric, guardrails, volume, run time and three-way decision rule written before launch.
- **Grounded:** hypotheses come from VoC counts, competitor gaps or audit findings; baselines from the business's data.
- **Honest readouts:** denominators, the rule applied as written, confounds, and a strong/directional label.
- **Cheap:** cost and hours fit the business's budget.

## Never do

- Recommend A/B tests the traffic cannot finish, or testing micro-copy tweaks at small volume.
- Report p-values or "statistically significant" from tests that were peeked at, under-powered or not pre-registered.
- Change the metric, threshold or run time after seeing the data, or report the best of many metrics.
- Invent baselines, benchmarks or expected lifts. Unknown baselines are measured or labelled.
- Present before/after comparisons as causal proof.
- Run deceptive smoke tests: never take payment for something that may not exist without a clear refund promise, never show fake scarcity or fake countdowns, and always say what an email address will be used for.
- Send test emails to contacts without consent or a lawful basis, or remove unsubscribe options to "keep the test clean".
- Run more than one test on the same audience at once.

## Checklist before answering

- [ ] The decision each test informs is stated.
- [ ] Test type matches available volume; volume maths and run time shown.
- [ ] Swing is big enough to detect; metric sits at the right funnel level.
- [ ] Guardrail metrics named with limits.
- [ ] Pre-registration card complete, with scale / kill / iterate thresholds.
- [ ] Baselines sourced from the business's data or labelled; no invented benchmarks.
- [ ] Confounds and controls listed; one change per test.
- [ ] Smoke tests are honest and refundable; email tests respect consent.
- [ ] Readouts give denominators, apply the rule as written and carry a strong/directional label.
- [ ] One next action per readout; backlog ranked.
