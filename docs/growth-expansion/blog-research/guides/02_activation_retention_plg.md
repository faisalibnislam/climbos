# Activation, retention and product-led growth (Elena's Growth Scoop)

Edition 2026-10-20. Source family `EV`. Original synthesis with attribution; no article text reproduced. Records: [source_registry.json](../source_registry.json), notes: [notes/EV.json](../notes/EV.json).

Elena Verna writes from running growth at large self-serve software companies. Her most useful contribution for ClimbOS is conditional: she says when a tactic applies and when it doesn't. Eight public posts were read in full; the requested starting post on retention techniques, and three others, are paywalled past their introduction.

## Articles read

| ID | Title | Author | Published | Access |
|---|---|---|---|---|
| EV-01 | [5 of my favorite new retention techniques that you may not have tried](https://www.elenaverna.com/p/5-of-my-favorite-new-retention-techniques) | Elena Verna | 2026-03-17 | paywalled |
| EV-02 | [I bet you are doing product activation all wrong.](https://www.elenaverna.com/p/hey-b2b-i-bet-you-are-measuring-activation) | Elena Verna | 2023-10-05 | full |
| EV-03 | [Retention: The situationship of SaaS](https://www.elenaverna.com/p/retention-the-situationship-of-saas) | Elena Verna | 2025-06-23 | full |
| EV-04 | [Subscription churn metrics and benchmarks for operators.](https://www.elenaverna.com/p/subscription-churn-benchmarks-and) | Elena Verna | 2025-03-28 | full |
| EV-05 | [Reverse Trials: Examples](https://www.elenaverna.com/p/reverse-trials-examples) | Elena Verna | 2024-04-12 | full |
| EV-06 | [To PLG or not PLG?](https://www.elenaverna.com/p/to-plg-or-not-plg) | Elena Verna | 2023-08-24 | full |
| EV-07 | [Don't reinvent user profiling during onboarding. This is what it should look like.](https://www.elenaverna.com/p/dont-reinvent-user-profiling-during) | Elena Verna | 2024-12-13 | full |
| EV-08 | [The DNA of a Great Pricing Page](https://www.elenaverna.com/p/the-dna-of-a-great-pricing-page) | Elena Verna | 2024-10-11 | full |
| EV-09 | [When should you invest in paid marketing?](https://www.elenaverna.com/p/when-should-you-invest-in-paid-marketing) | Elena Verna and Sarah Charlton | 2025-01-24 | full |
| EV-10 | [How to give away free product and make money doing it](https://www.elenaverna.com/p/how-to-give-away-free-product-and) | Elena Verna | 2026-09-08 | paywalled |
| EV-11 | [What The Freemium!?](https://www.elenaverna.com/p/what-the-freemium) | Elena Verna | 2023-08-17 | paywalled |
| EV-12 | [It's all about trials](https://www.elenaverna.com/p/trial-configurations-explained) | Elena Verna | 2023-04-03 | paywalled |

## Durable principles vs dated material

**Durable (author ideas, adopted with conditions):**
- Activation is the moment a user gets value, not the moment setup is finished.
- Churn has types and timing (failed payment, early cancel, renewal cancel); each needs a different fix.
- Pick the free-access model (trial, freemium, reverse trial) deliberately and judge it against a reference for that model.
- Paid acquisition is fuel for a working engine, not the engine itself; a capped test answers a different question from scaling.
- Ask only onboarding questions whose answers change a route or message.

**Dated or context-bound (kept as labelled references, never as universal thresholds):**
- Her conversion and churn targets (e.g. freemium and trial ranges, first-term churn, payment-recovery shares), stated from experience without source, sample or period.
- Budget and traffic thresholds for 'investing in paid' (startup context).
- Product examples (SurveyMonkey, Miro, Canva, Lovable) as observed at the time.

**How far to trust it:** Two retention posts are sponsored by Churnkey, which is also a cited data source. Examples come from large software companies; applying them to small businesses is ClimbOS's interpretation, labelled as such.

## EV-C1: Count activation at value received, not at setup finished

**Decision it helps make.** Which event ClimbOS treats as 'activated' when reading the owner's funnel and when running PB-activation-repair.

**Applies when**
- Self-serve software, apps or digital products with signups or trials
- The owner reports an 'activated' count or ClimbOS reads product events
- Collaborative or team products where value needs more than one person

**Avoid when**
- Service businesses where first value is a delivered job, attended session or first order (keep Book 08's business-specific milestones)
- Too few signups to compare later outcomes of users who did vs did not reach the event: keep the event as a labelled hypothesis
- The owner cannot observe any value event: measure first

**Evidence and prerequisites**
- Separate counts for setup completed and value received in the same signup cohort
- Later paid or retained rate for users who reached each stage vs those who did not
- The product's natural use frequency (daily, weekly, monthly, episodic) for the habit stage
- A countable value event (publish, send, receive, share, export, deploy type action)
- Cohort tracking by signup date

**Steps**
1. List setup steps separately from value events
2. Name the value event as the moment the user gets a result, using the verb test
3. Add a quantity only if the data supports one (her survey example used several responses)
4. Define habit as repeat use over a window matched to natural frequency, not 'active last week'
5. Compare paid and retained rates of users who reached setup, value and habit
6. Choose the earliest stage that clearly separates later payers or retainers
7. For team products make collaboration part of the activation event and put the invite in setup

**When data, traffic, budget or integrations are missing**
- Missing data: ask the owner to mark 10–20 recent signups as 'got the result' or not and compare who paid
- Low traffic: watch 3–5 new users (PB-activation-repair step) and record where value happens
- No integration: weekly manual count from the owner's admin view
- Small budget: needs no spend

**Metrics**
- Setup completion (diagnostic only)
- Value-event rate within a stated window
- Habit-loop rate
- Paid and retained rate conditional on each stage

**Guardrails**
- Never report setup completion as activation
- No vanity events (logins, page views)
- Pair any activation lift with later retention or paid conversion so empty test activity cannot inflate it

**Observation window.** Value event within a product-specific window stated up front; validate the definition over at least one full billing or renewal cycle of the cohort.

**Stop or review when**
- Activated users do not pay or retain better than non-activated: definition is wrong, move it
- Almost everyone reaches the event: it is setup, move it later
- Event cannot be measured reliably: revert to owner-marked sample

**Where it belongs in ClimbOS.** shared/agents/diagnosis.ts (OwnerFunnel.activated comment lists 'completed setup'; diagnose() activation vs conversion split); shared/playbooks/contracts.ts PB-activation-repair step 1; owner funnel input UI.

**Author guidance (source findings):** EV-02-F1, EV-02-F2, EV-02-F3, EV-02-F4, EV-03-F1, EV-03-F2, EV-06-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: Verna's setup/aha/habit split maps onto ClimbOS's activation-vs-conversion branch. Counting setup as activation inflates the activation rate and pushes the computed constraint toward 'conversion', which sends owners to price changes when users never got value.

**Proposed ClimbOS rule:** PROPOSED RULE: Change the OwnerFunnel.activated description to 'reached the result (not just finished setup)'. Add activationKind: 'setup' | 'value' | 'habit' | 'unknown'. When it is 'setup' or 'unknown', diagnosis basis drops to 'partial' and the plan's first step must define the value event. Team products may define activation at team level.

**Overlap with existing guidance:** Book 08 §2 already says activation is a business-specific milestone and warns against rewarding account creation; §7 pairs activation with downstream outcomes. PB-activation-repair already says 'define the first-value event'. New here: explicit setup vs value vs habit stages, the verb test, habit as frequency pattern, team-level activation, and the conflict with diagnosis.ts.

**Disagreements and what decides them:** diagnosis.ts includes 'completed setup' in the activated count, which Verna explicitly rejects. Her subtitle claim that nearly all monetization and retention problems come from activation is rhetoric, not data; do not encode it as a prior.

**Playbook:** [BRP-07](../playbooks/BRP-07-activation-definition.json) · **Evaluation case:** BR-EV08 ([cases.json](../evaluations/cases.json))

## EV-C2: Split churn by type and timing before picking a retention fix

**Decision it helps make.** When the computed constraint is retention, whether the first play is activation or feature-adoption repair, payment recovery, a cancellation flow, or annual-plan migration.

**Applies when**
- Recurring billing (subscriptions, memberships, retainers)
- Retention flagged weak, or the owner reports churn
- Billing data or a cancellation list is available

**Avoid when**
- One-off purchases (use repeat-purchase logic instead)
- Churn is fine and activation is weak: fix activation first
- Any proposed cancellation step that hides or obstructs cancelling
- No billing access and the owner cannot list recent cancellations

**Evidence and prerequisites**
- Share of churn from failed payments vs chosen cancellations
- When cancellations happen: soon after signup vs just before renewal
- First-term vs tenured churn
- Cancellation reasons
- Paid-feature use of churned vs retained customers
- Billing provider access or export
- A way to capture cancellation reasons

**Steps**
1. Split involuntary (failed payment) from voluntary churn
2. If involuntary is material: retries, card updater, failure alerts by email and in product; label as symptom treatment
3. If voluntary cancels cluster right after signup: treat as activation or expectation mismatch (EV-C1)
4. If voluntary cancels cluster before renewal: cancellation flow that shows what was used and will be lost, offers pause or downgrade, and targets offers only at at-risk or high-value customers
5. If churners never used key features: top-down critical-feature check or bottom-up 'what retained users use' and promote it
6. Offer annual plans to tenured monthly customers
7. Make reactivation one click

**When data, traffic, budget or integrations are missing**
- Missing data: ask the owner for the last 20 cancellations with date vs signup and renewal, reason, and failed-payment flag
- Low volume: read each cancellation and contact high-value accounts personally
- No integration: manual billing export
- Small budget: retries and dunning are often built into billing providers; verify current provider docs before claiming

**Metrics**
- Involuntary share of churn
- Failed-payment recovery rate
- First-term churn
- Cancellation-flow save rate and next-term retention of saved customers
- Resubscribe rate
- Annual-plan mix

**Guardrails**
- Cancelling stays easy and clear; check applicable consumer-protection rules before any flow change
- Discounts targeted, never blanket; check margin floor
- Report payment recovery as symptom treatment, not retention improvement
- Do not count a 'save' as retained until the next term passes

**Observation window.** Failed-payment recovery is readable within weeks; cancellation-flow and annual-migration effects need at least one renewal cycle of the affected cohort.

**Stop or review when**
- Saved customers churn next term at the same rate: saves only delay churn
- Discount saves push contribution below the floor
- Involuntary share is small: deprioritize payment recovery

**Where it belongs in ClimbOS.** shared/agents/diagnosis.ts (retention reading and COMPETING.retention); new playbooks PB-payment-recovery and PB-cancel-flow in shared/playbooks/contracts.ts; PB-lifecycle-email for alerts.

**Author guidance (source findings):** EV-03-F1, EV-03-F3, EV-03-F4, EV-04-F2, EV-04-F3, EV-04-F4, EV-04-F6. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: ClimbOS can flag retention but has no routing between root-cause fixes and symptom fixes. Verna's split gives that routing; her figures are too weakly sourced to be references.

**Proposed ClimbOS rule:** PROPOSED RULE: Add optional inputs failedPaymentShare and earlyCancelShare. If failedPaymentShare is material, PB-payment-recovery is eligible as a quick fix but cannot be the only play when activation is unmeasured. If earlyCancelShare dominates, route to PB-activation-repair. Verna's numbers (first-term churn about a quarter is good; failed payments about 40% of annual first-term churn; recover at least half of failed payments) are stored as 'author target, unsourced, 2025, dated' and never used as diagnosis references.

**Overlap with existing guidance:** diagnosis.ts already reads monthly churn against a 3–7% SaaS range; Book 08 covers reactivation messaging and consent. New: churn-type and timing split, payment recovery, cancellation-flow parts, annual migration, feature-adoption check.

**Disagreements and what decides them:** COMPETING.retention in diagnosis.ts names budget or seasonality; Verna would name weak activation or missed key features first. Propose listing both. Her 'about a quarter first-term churn is good' is per-term, not monthly; do not compare it with the 3–7% monthly range.

**Playbook:** [BRP-08](../playbooks/BRP-08-churn-split.json) · **Evaluation case:** BR-EV09 ([cases.json](../evaluations/cases.json))

## EV-C3: Win back churned customers with new value, segmented by current activity

**Decision it helps make.** Whether to spend effort reactivating past customers before or alongside acquiring new ones, and what to send.

**Applies when**
- A churned base that is large relative to monthly new signups
- Meaningful new value shipped since they left
- Consent or a lawful basis to contact them

**Avoid when**
- No consent (never cold-email past users through ClimbOS)
- Nothing has changed since they left
- They left because they were the wrong fit
- Very few churned customers: a personal note is cheaper than a sequence

**Evidence and prerequisites**
- Count of consented churned contacts
- Whether each still uses a free tier
- Main churn reasons
- List of changes shipped since each cohort left
- Suppression and consent handling (Book 08)
- A trial-restart or offer mechanism if used

**Steps**
1. Segment churned payers still active on free vs fully inactive
2. For still-active: time-limited paid-feature trial restart tied to a major launch
3. For inactive: slow sequence each showing one specific new capability, with occasional trial restarts
4. Hold out a share where volume allows
5. Compare expected reactivations times value with the same effort spent on new-user conversion

**When data, traffic, budget or integrations are missing**
- Missing data: owner exports past customers and marks reasons
- Low volume: personal email from the owner's own mailbox
- No integration: manual send from the owner's mailbox
- Small budget: zero spend

**Metrics**
- Paid reactivation rate per segment vs holdout
- Unsubscribes and complaints
- Next-term retention of reactivated customers

**Guardrails**
- Consent and suppression checked before every send
- Frequency caps
- Claims about what is new must be true and specific

**Observation window.** One launch cycle plus the next renewal of reactivated customers.

**Stop or review when**
- Unsubscribes or complaints rise above normal
- Reactivated customers churn again in their first term at the original rate

**Where it belongs in ClimbOS.** shared/playbooks/contracts.ts PB-lifecycle-email ('lapsed' moment) as a win-back variant; retention branch in diagnosis.ts.

**Author guidance (source findings):** EV-03-F5, EV-04-F6. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: Reactivation competes with acquisition for the same owner hours; it deserves a slot when the churned base is big and the product changed.

**Proposed ClimbOS rule:** PROPOSED RULE: When retention is the constraint and consented churned contacts exceed new signups for the period, PB-lifecycle-email's lapsed moment must be considered and its message must name a specific change since the customer left.

**Overlap with existing guidance:** Book 08 §6 already says reactivation messages should not pretend to know why someone left; PB-lifecycle-email lists 'lapsed'. New: segment by free-tier activity, tie to launches, trial restart, prioritization vs acquisition.

**Disagreements and what decides them:** None material. Her comparison is illustrative and stays out of forecasts.

**Playbook:** [BRP-09](../playbooks/BRP-09-win-back.json) · **Evaluation case:** BR-EV10 ([cases.json](../evaluations/cases.json))

## EV-C4: Choose the free-access model (trial, freemium, reverse trial) and compare against its own reference

**Decision it helps make.** Which free-access configuration a self-serve product should test, and which conversion reference applies to it.

**Applies when**
- Self-serve software with clear paid features
- Low marginal cost per free user, or a budget for it
- A free tier that is useful on its own (needed as the fallback in a reverse trial)

**Avoid when**
- High serving cost per free user with no cost cap (AI inference); her 2026 post argues free still pays at Lovable but its conditions are paywalled
- Sales-led, high-price products where self-serve is only defensive
- No meaningful free tier to fall back to
- High risk of repeat-account abuse without a control
- Service and local businesses (not applicable)

**Evidence and prerequisites**
- Current model and conversion by signup cohort
- Marginal cost per free user
- Whether free users ever see paid features
- Post-trial free retention if already running a trial
- Billing or plan system that supports time-limited entitlements and a clean downgrade
- Profiling to pick team vs individual trial where relevant (EV-C5)

**Steps**
1. Classify the current model
2. If freemium converts poorly and free users rarely see paid features, test a reverse trial for new signups: paid features for a fixed period, no card, then free
3. State the end date and what happens at the end on the trial screen; list paid benefits over free
4. Keep user data on downgrade
5. Measure paid conversion and post-downgrade free retention for the same cohorts
6. Cap and watch cost per free user and duplicate accounts

**When data, traffic, budget or integrations are missing**
- Missing data: measure current conversion by cohort first
- Low traffic: switch all new signups and compare before/after cohorts, labelled observational
- No integration: if plans cannot be time-limited, this is an engineering task, not a ClimbOS action
- Small budget: no media spend needed; watch serving cost

**Metrics**
- Paid conversion within the cohort window
- Post-downgrade free retention
- Cost per free user
- Duplicate or abusive accounts

**Guardrails**
- No silent auto-charge: no-card by default
- Clear end date and downgrade terms
- Data kept on downgrade
- Abuse monitoring

**Observation window.** Trial length plus one billing period, for both the old and new cohorts to mature.

**Stop or review when**
- Paid conversion not above the old baseline once cohorts mature
- Free retention falls after downgrade
- Serving cost exceeds the cap

**Where it belongs in ClimbOS.** shared/agents/diagnosis.ts REF.trialToPaid and REF.freeToPaid; skills/growth-plays/reference/base-rates.md rows for free plan, no-card trial, card trial; proposed PB-reverse-trial; PB-pricing-test.

**Author guidance (source findings):** EV-05-F1, EV-05-F2, EV-05-F3, EV-05-F4, EV-08-F3, EV-10-F1, EV-11-F1, EV-12-F1, EV-06-F2. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: Diagnosis compares every SaaS lead-to-paid rate with the no-card trial range. A reverse trial is a different model, and Verna's own figure for trials is lower than ClimbOS's, so the verdict near the boundary is not reliable.

**Proposed ClimbOS rule:** PROPOSED RULE: Add freeModel: 'freemium' | 'opt_in_trial' | 'card_trial' | 'reverse_trial' | 'none' to the owner profile and pick the reference by model. Store Verna's 3–5% freemium and 10–15% trial/reverse trial as 'author benchmark, unsourced, Oct 2024, dated'. When two weak references disagree and the rate falls between them, set verdict 'unknown' rather than 'weak'.

**Overlap with existing guidance:** base-rates.md has free plan 2–5%, no-card trial 15–25% and card trial 40–60% (grade C). Nothing in the library covers reverse trials.

**Disagreements and what decides them:** ClimbOS no-card trial 15–25% vs Verna's 10–15% for trial or reverse trial. Freemium ranges broadly agree (2–5% vs 3–5%). Her freemium/AI-cost conditions are paywalled, so the cost-related avoid_when is ClimbOS's own caution.

**Playbook:** [BRP-04](../playbooks/BRP-04-free-access-model.json) · **Evaluation case:** BR-EV05 ([cases.json](../evaluations/cases.json))

## EV-C5: Short signup profiling to test the 'wrong-fit signups' explanation and route help

**Decision it helps make.** What to ask at signup and how to route users to self-serve, automated help or a human.

**Applies when**
- Self-serve signups with mixed intent (personal vs work, small vs larger companies)
- Activation is the constraint and the competing explanation is wrong-fit signups
- B2B products where some signups merit sales or onboarding help

**Avoid when**
- A question will not change any segment, message or route
- Single-segment products
- Personal-use signups (skip company questions)
- Teams of two or fewer (skip the team-invite step)
- Webmail domains (never auto-join by domain)

**Evidence and prerequisites**
- Signup volume and current activation
- Owner's target customer description
- Whether any human help capacity exists
- Ability to add closed-answer questions to signup
- Privacy notice covering what is collected

**Steps**
1. Ask use (work or personal), role, and new vs migrating
2. Ask company size or industry only for work use and only if used
3. Offer a team invite for teams above two
4. Ask the job they came to do with closed options plus 'something else'
5. Segment activation and paid by answers
6. Route: migrations or high-value signups to a human; small gaps to in-app or email help; readers to docs

**When data, traffic, budget or integrations are missing**
- Missing data: start with one question (work vs personal)
- Low traffic: owner reviews each signup's answers by hand
- No integration: add a field to the existing signup form
- Small budget: avoid paid enrichment; for small businesses and consumers she finds it mostly wrong

**Metrics**
- Profiling completion and drop-off vs prior baseline
- Activation and paid rate by segment
- Share of 'something else' answers

**Guardrails**
- Collect only what is used and disclose it
- Closed inputs, plain design
- Measure drop-off rather than assume her 10–15% figure

**Observation window.** Until each key segment has enough signups to compare activation; state the count before starting.

**Stop or review when**
- Drop-off at profiling clearly above prior baseline and total activated users fall: shorten
- No segment differs in activation: profiling adds no decision value, cut to one question

**Where it belongs in ClimbOS.** shared/agents/diagnosis.ts COMPETING.activation (wrong-fit signups); PB-activation-repair; Book 08 §5 segmentation.

**Author guidance (source findings):** EV-07-F1, EV-07-F2, EV-07-F3, EV-07-F4, EV-02-F5, EV-02-F6, EV-06-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: diagnosis.ts already names wrong-fit signups as the competing explanation for weak activation but gives no way to test it. Profiling is that test.

**Proposed ClimbOS rule:** PROPOSED RULE: When the constraint is activation and no segment data exists, the plan's first step adds one to three closed profiling questions and the next diagnosis reads activation within the target segment. Routing to a human requires stated owner capacity.

**Overlap with existing guidance:** Book 08 §5 covers segmentation as a decision system; PB-activation-repair covers obstacle-fixing. New: concrete profiling content and conditions, first-party over enrichment for small businesses, and touch-level routing.

**Disagreements and what decides them:** Common advice to minimize onboarding questions conflicts with her view that a short structured profile costs little. Treat her drop-off figures as untested hypotheses and measure.

**Playbook:** [BRP-10](../playbooks/BRP-10-signup-profiling.json) · **Evaluation case:** BR-EV11 ([cases.json](../evaluations/cases.json))

## EV-C6: Break 'conversion' into pricing-page awareness, pricing to checkout, and checkout to paid

**Decision it helps make.** When the computed constraint is conversion for a self-serve product, which part of the purchase path to fix first.

**Applies when**
- Self-serve paid plans with a pricing page and online checkout
- Conversion flagged as the weak link

**Avoid when**
- Quote-based or custom-priced sales (use sales-stage logic)
- Too few pricing-page visitors to read the link rates: use a heuristic review instead
- Local services that sell by call or booking

**Evidence and prerequisites**
- Share of signups who view pricing
- Unique pricing visitors who start checkout
- Checkouts that complete
- Payment failures at checkout
- Which in-product triggers lead to upgrade
- Page and checkout events, or owner counts from site analytics and billing

**Steps**
1. Compute the three link rates for one cohort
2. Low awareness: add contextual upsells where each paid feature is hit in the product
3. Low pricing-to-checkout: review structure (about three plans, clear value metric, recommended plan, who each plan is for, accumulating features, price visible, pricing in navigation)
4. Low checkout completion: check payment methods, currency and billing timing
5. Consider add-ons for features few customers on a plan use
6. Change one thing for new buyers and read it via PB-pricing-test

**When data, traffic, budget or integrations are missing**
- Low traffic: heuristic page review and 3–5 user walkthroughs
- Missing data: site analytics page views plus billing export
- No integration: owner-run counts
- Small budget: no spend needed

**Metrics**
- Pricing-page awareness rate
- Pricing-to-checkout rate
- Checkout completion
- Payment success rate
- Visits before purchase

**Guardrails**
- No decoy tiers or hidden costs (existing PB-pricing-test guardrail)
- Plan labels such as 'most popular' must be true
- Existing customers' terms unchanged

**Observation window.** Whole weeks until each link has a readable count; for price changes use PB-pricing-test's window.

**Stop or review when**
- Fixed link improves but paid conversion is flat: the constraint moved, recompute
- Contribution per customer falls

**Where it belongs in ClimbOS.** shared/agents/diagnosis.ts 'purchase' reading and playStage 'conversion'; PB-pricing-test in shared/playbooks/contracts.ts.

**Author guidance (source findings):** EV-08-F1, EV-08-F2, EV-08-F3, EV-08-F4. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: ClimbOS's conversion branch currently goes straight to package or price. Many self-serve conversion problems are discovery or checkout problems that a price test would not fix.

**Proposed ClimbOS rule:** PROPOSED RULE: When conversion binds for a self-serve type and pricing-path counts exist, compute the three sub-links and require the bankable play to target the weakest. If counts are missing, the first step collects them. PB-pricing-test is preferred only when pricing-to-checkout is the weak sub-link.

**Overlap with existing guidance:** PB-pricing-test covers package and price changes with margin guardrails; Book 08 §5 warns pricing-page visits don't prove budget. New: the sub-link decomposition, contextual upsells, checkout failure causes, add-on rule.

**Disagreements and what decides them:** None with the library. Her case for public prices in B2B may conflict with owners running custom quotes; treat as a test, not a rule.

**Playbook:** [BRP-11](../playbooks/BRP-11-conversion-path-split.json) · **Evaluation case:** BR-EV12 ([cases.json](../evaluations/cases.json))

## EV-C7: Gate 'scale paid acquisition' separately from a capped paid learning test

**Decision it helps make.** Whether ClimbOS recommends scaling paid acquisition, a small capped learning test, or building cheaper channels first.

**Applies when**
- The owner asks for ads or the plan considers paid
- A budget exists

**Avoid when**
- Retention or product fit is unproven
- No conversion tracking
- Landing page not ready
- The budget cannot cover a learning curve and the owner expects scaled returns

**Evidence and prerequisites**
- Retention (monthly churn; for B2B, net revenue retention over a year where available)
- Conversion tracking on a business event
- Landing page readiness
- Baseline non-paid traffic
- Budget and how long the owner can fund learning
- Tracked paying-customer conversion
- An intent-matched landing page
- Spend caps

**Steps**
1. Check retention before acquisition spend
2. Check the landing page (one goal, clear value, fast, mobile, trust signals)
3. Check tracking
4. Decide fuel (jump-starts a product or content loop) vs engine (must pay back and compound)
5. If gates fail but the owner wants a test: run PB-paid-search-test as a capped learning question only
6. Avoid known mistakes: bidding on own brand, homepage as destination, unmanaged daily budgets, starting broad, stale creative

**When data, traffic, budget or integrations are missing**
- Small budget: capped PB-paid-search-test labelled 'cannot show scaled ROI'
- Low traffic: product-led and owned channels first (sharing, referrals, templates, comparison pages)
- Missing data: measurement first
- No integration: draft-only campaign plan

**Metrics**
- Cost per paying customer vs value
- Payback period
- Retention of the paid cohort vs others

**Guardrails**
- Hard spend cap and stop date
- Never forecast scaled returns from a small test
- Verify current platform rules before acting

**Observation window.** Test: the planned end date in PB-paid-search-test. Scaling decision: paid-cohort retention over at least one renewal cycle.

**Stop or review when**
- Cost per paying customer above value at the planned end
- Paid cohort churns faster than other cohorts

**Where it belongs in ClimbOS.** shared/playbooks/contracts.ts PB-paid-search-test (budget_min 300); RECONCILIATION.md §4 loops vs bottlenecks; plan agent's paid recommendations.

**Author guidance (source findings):** EV-09-F1, EV-09-F2, EV-09-F3, EV-09-F4, EV-06-F1. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** INTERPRETATION: Her budget and traffic gates are about reaching scaled, efficient paid growth for startups, not about whether a small business may run a bounded test. ClimbOS's $300 minimum is for a readable test. Both can hold if recommendations say which question they answer.

**Proposed ClimbOS rule:** PROPOSED RULE: Add an 'intent' field to paid plays: 'learning_test' | 'scale'. 'scale' requires measured retention, tracked conversion and a passed landing check; 'learning_test' keeps current PB-paid-search-test rules and must state that it cannot establish scaled ROI. Verna's thresholds are stored as 'author rule of thumb, unsourced, Jan 2025, startup context'.

**Overlap with existing guidance:** PB-paid-search-test already avoids paid when tracking is missing or a leak exists downstream; RECONCILIATION §4 and Reforge A01/A02 cover loops and boosts. New: explicit fuel vs engine, the scale vs test split, and the mistakes list.

**Disagreements and what decides them:** Her budget threshold is about forty times ClimbOS's $300/month test minimum ($75k over six months is about $12.5k a month); reconciled by separating test from scale. Her churn gate has no period and cannot be compared with monthly references. Local businesses with strong search intent may justify paid at lower traffic; that is ClimbOS interpretation, not hers.

**Playbook:** [BRP-12](../playbooks/BRP-12-paid-test-vs-scale.json) · **Evaluation case:** BR-EV13 ([cases.json](../evaluations/cases.json))

## Not read or excluded

- https://www.elenaverna.com/p/how-to-improve-your-voluntary-churn: Paywalled (2024-06-06); only title, subtitle (six tactics) and a Churnkey sponsor note visible.
- https://www.elenaverna.com/p/the-mom-and-pop-saas-era-has-arrived: Paywalled (2026-06-18); intro only: argues cheaper building lets domain experts and small businesses build software. No guidance visible.
- https://www.elenaverna.com/p/congrats-your-sales-problems-in-plg: Paywalled (2026-09-11); intro only, no guidance visible.
- https://www.elenaverna.com/p/why-when-and-how-to-add-sales-to: Marked paid in archive (2024-01-11); not fetched.
- https://www.elenaverna.com/p/why-ai-doesnt-mean-the-end-of-freemium: Marked paid in archive (2025-12-12); not fetched.
- https://www.elenaverna.com/p/should-your-new-feature-be-free-or: Marked paid in archive (2024-09-20); not fetched.
- https://www.elenaverna.com/p/we-stopped-forcing-the-subscription: Marked paid in archive (2026-02-13); not fetched.
- https://www.elenaverna.com/p/dirty-dozen-of-plg-b2b-saas-health: Marked paid in archive (2023-04-07); not fetched.
- https://www.elenaverna.com/p/try-this-onboarding-email-series: Marked paid in archive (2024-03-07); not fetched.
- https://www.elenaverna.com/p/how-to-grow-word-of-mouth: Marked paid in archive (2023-06-16); word-of-mouth loop not read. No free dedicated growth-loops post was found on the site.
- https://www.elenaverna.com/p/five-plg-tactics-every-sales-led: Public (2025-03-17) but not fetched within scope.
- https://www.elenaverna.com/p/elenas-2024-b2b-product-led-sales: Public (2024-08-08) but not fetched; product-led sales is enterprise-leaning.
- https://www.elenaverna.com/p/examples-of-proven-sales-plays-to: Public (2025-02-26) but not fetched.
- https://www.elenaverna.com/p/my-9-favorite-growth-frameworks: Public (2024-10-25) but not fetched.
- https://www.elenaverna.com/p/two-ways-to-visualize-importance: Public (2024-06-27) but not fetched.
- https://www.elenaverna.com/p/what-on-earth-is-going-on-with-ai: Public (2026-10-16, AI pricing and packaging) but not fetched; candidate for a follow-up on credit/usage pricing.
- https://subscription-stories.castos.com/episodes/freemium-free-trial-and-free-surprises-with-elena-verna-of-reforge-when-does-it-make-sense-to-give-it-away-and-when-doesn39t-it: Third-party podcast; out of scope (source family is the newsletter). A secondhand claim of 10–40% conversion lifts from reverse trials appears only in third-party summaries and is excluded.
