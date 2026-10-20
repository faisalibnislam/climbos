# Pricing, packaging and AI monetization (Growth Unhinged)

Edition 2026-10-20. Source family `GU`. Original synthesis with attribution; no article text reproduced. Records: [source_registry.json](../source_registry.json), notes: [notes/GU.json](../notes/GU.json).

Kyle Poyar's newsletter is the strongest public source on how software companies are moving from seats to usage, credits and outcome pricing. For ClimbOS it matters twice: owners ask how to price their own offers, and ClimbOS itself sells credits. Most practical sections of these posts sit behind the paid tier; what's below comes from the public parts of eight posts (two read in full).

## Articles read

| ID | Title | Author | Published | Access |
|---|---|---|---|---|
| GU-01 | [Why everyone’s switching to AI credits](https://www.growthunhinged.com/p/ai-credit-pricing) | Kyle Poyar | 2025-09-03 | partial |
| GU-02 | [Your pricing is (probably) broken](https://www.growthunhinged.com/p/your-pricing-is-broken) | Kyle Poyar | 2025-10-22 | partial |
| GU-03 | [A new framework for AI agent pricing](https://www.growthunhinged.com/p/ai-agent-pricing-framework) | Manny Medina (guest; intro by Kyle Poyar) | 2025-04-09 | full |
| GU-04 | [The state of SaaS pricing](https://www.growthunhinged.com/p/the-state-of-usage-based-pricing) | Kyle Poyar | 2024-02-21 | partial |
| GU-05 | [Your guide to SaaS packaging 201](https://www.growthunhinged.com/p/your-guide-to-saas-packaging-201) | Kyle Poyar | 2023-09-13 | partial |
| GU-06 | [Your guide to reverse trials](https://www.growthunhinged.com/p/your-guide-to-reverse-trials) | Kyle Poyar (with Lauryn Isford, then Airtable) | 2022-06-29 | partial |
| GU-07 | [Customers don't care about your AI feature](https://www.growthunhinged.com/p/ai-messaging-study) | Kristen Berman (guest, Irrational Labs) | 2025-01-29 | full |
| GU-08 | [What I learned from tracking 443 SaaS pricing pages](https://www.growthunhinged.com/p/state-of-saas-pricing-changes-2024) | John Kotowski and Rob Litterst (guests, PricingSaaS; intro by Kyle Poyar) | 2024-10-16 | partial |

## Durable principles vs dated material

**Durable (author ideas, adopted with conditions):**
- Charge in a unit that tracks the value the customer gets and the cost you carry; check the fit before optimising the number.
- Averages hide heavy users: test any allowance or unlimited plan against its most expensive customers.
- Every plan and add-on needs a one-sentence reason for who it is for.
- Compare free-access models on paid customers per visitor, not on conversion rates with different denominators.
- Mainstream buyers respond to outcomes, not to the 'AI' label.

**Dated or context-bound (kept as labelled references, never as universal thresholds):**
- Survey shares of companies using usage or credit pricing (2022-2025, venture-backed SaaS samples).
- Reported conversion gaps between free plans, trials and reverse trials (single-vendor or anecdotal).
- Claims that model costs will fall 10-100x (forecast, vendor-sourced).

**How far to trust it:** Two posts are sponsored by a usage-billing vendor (Metronome) and one guest author sells outcome-based billing; treat advocacy for those models as interested. Numbers are dated survey or rule-of-thumb figures for venture-backed software and are never used as small-business benchmarks.

## GU-C1: Credit allowance with heavy-user guardrails

**Decision it helps make.** Whether to sell variable-cost work (AI generation, research, messages, jobs) as unlimited, pure pay-as-you-go, or a plan allowance in credits with top-ups, and how to rate each action so heavy users don't erase margin.

**Applies when**
- Delivery cost per customer varies widely with use (AI calls, data lookups, sends, minutes)
- Customers want a predictable bill but usage differs a lot between them
- The business offers several actions with very different cost or value

**Avoid when**
- Cost per customer is flat and low (credits add confusion for no margin benefit)
- Buyers can't relate credits to anything they value and no estimator can be shown
- No metering exists to count usage per customer

**Evidence and prerequisites**
- Per-customer variable cost for at least one full billing cycle
- Share of total variable cost from the top 10% of customers
- Cost per action type, versioned by date
- Customer comprehension check of the credit unit (can they predict their bill?)
- Usage metering per customer and action
- Billing that supports allowances and top-ups
- Provider-price registry (book 12 §11)

**Steps**
1. Compute cost per customer per month; rank customers; record the top-decile cost share
2. List actions; set credit rates by value to the buyer, with a floor of cost / (1 − target margin)
3. Size each plan's allowance so a customer who uses it all still meets the margin floor
4. Offer clearly priced top-ups or a fair-use limit for the heavy tail rather than raising everyone's price
5. Show the credit cost before any expensive action and a balance meter; never auto-charge overage without consent
6. Re-rate actions when provider costs or value change, with notice

**When data, traffic, budget or integrations are missing**
- No metering: use a fair-use cap on the top plan and review manually monthly
- Low volume: one plan plus a single paid add-on for the costly action
- Small budget/no billing integration: sell prepaid packs by invoice
- Missing cost data: use provider invoices ÷ active customers as an average and flag distribution as unknown

**Metrics**
- Contribution margin per customer (distribution, not just average)
- Top-decile share of variable cost
- Share of customers hitting allowance; top-up attach rate
- Billing-surprise support tickets and refunds
- Breakage (unused credits) tracked separately from earned margin

**Guardrails**
- Fully used allowance meets the margin floor; breakage is never the plan that makes the margin
- No hidden overage; balance and per-action cost visible
- Re-rating applies only with advance notice; purchased credits keep their stated value
- Do not degrade the core promised outcome to save cost

**Observation window.** Two full billing cycles after launch or re-rating; heavy-user share reviewed monthly.

**Stop or review when**
- Top-decile customers are contribution-negative after two cycles: re-rate or cap
- Surprise-bill tickets or refunds rise: simplify the unit or add an estimator
- Conversion drops versus the prior flat plan with no margin gain: revert

**Where it belongs in ClimbOS.** Plan engine (offer/economics diagnosis), PB-pricing-test variant, margin calculator, pricing page advice. Separately: ClimbOS's own credit pricing review (see GU.md arithmetic).

**Author guidance (source findings):** GU-01-F2, GU-01-F3, GU-01-F4, GU-01-F5, GU-02-F2, GU-04-F2, GU-08-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: Kyle's case for credits is mainly about cost concentration and the vendor's freedom to re-rate actions; buyer predictability is the cost. For small businesses the same logic applies to any capped package of variable work (e.g., included revisions, call minutes).

**Proposed ClimbOS rule:** Proposed ClimbOS rule: when a customer's variable cost per account varies by more than a set ratio, the engine checks the top-decile cost share and the margin of a fully used allowance before recommending flat or unlimited pricing; recommendations must pass the margin floor at full allowance use, excluding breakage.

**Overlap with existing guidance:** Extends guides/02_monetization.md (heavy-use scenario, allowance + top-up hypothesis) and growth-intelligence book 12 §10–11 (distribution over average, reserve cost before expensive work). Adds the concentration metric, re-rating, and the breakage rule. Versions PB-pricing-test with a credit/allowance variant.

**Disagreements and what decides them:** Book 12 warns usage pricing needs clear metering and understanding; GU-01 claims credits feel simple to buyers. Decide by a comprehension test: if owners cannot predict their monthly credit use within a reasonable band, prefer plan tiers with a fair-use cap. GU-03 predicts 10–100x cost falls; GU-01 says newest-model costs had not fallen by late 2025. Rule: price on current observed cost, never on forecast declines.

**Playbook:** [BRP-01](../playbooks/BRP-01-credit-allowance.json) · **Evaluation case:** BR-EV01 ([cases.json](../evaluations/cases.json))

## GU-C2: Charging-model eligibility gates (seat, flat, usage-hybrid, workflow, outcome)

**Decision it helps make.** Which billing unit fits a business whose product does work for the customer: per person, flat subscription, usage allowance, per completed job/workflow, or per result.

**Applies when**
- Owner is choosing or changing what they charge per (not just how much)
- The product or service automates work previously done by staff or contractors
- Owner is drawn to outcome or success pricing

**Avoid when**
- Pricing is set by a dominant marketplace or regulation
- Fewer than a handful of customers and no delivery history (start with a simple fixed offer and learn)

**Evidence and prerequisites**
- Can the outcome be defined, measured and attributed to the business without dispute?
- Variance of delivery cost per job
- Customer's current alternative and its cost (staff time, agency, contractor)
- Customer's need for bill predictability
- Cash buffer to carry delivery cost before outcome fees are paid
- Job/usage tracking
- Written outcome definition and attribution method if outcome pricing is considered
- Contract or terms template

**Steps**
1. Describe what the customer values and how they measure it
2. Gate outcome pricing: measurable + attributable + performance predictable + cash can carry the lag; otherwise drop to workflow or job pricing, or add an outcome bonus on a base fee
3. Gate per-job/workflow pricing: jobs are standard enough to price; cap or surcharge long-running jobs
4. Gate usage pricing: volume varies a lot between customers; for small buyers prefer a hybrid (base plan + allowance) over pure pay-as-you-go
5. Gate replacement framing (price against a hire): the offer covers a defined role's typical output; price as a share of that cost and expect cheaper copycats
6. Compare two or three candidate models with the owner's own numbers before any price-point optimisation

**When data, traffic, budget or integrations are missing**
- Attribution unclear: base fee + capped success bonus
- Low volume: fixed-scope package per job
- No tracking integration: monthly retainer with a stated volume ceiling

**Metrics**
- Contribution per job and per customer
- Share of disputed outcome invoices
- Days from delivery cost to cash received
- Win rate and churn by model

**Guardrails**
- Outcome definitions written before work starts; no retroactive redefinition
- No outcome pricing in regulated categories where contingent fees are restricted without owner/legal review
- Show total expected cost range to the buyer

**Observation window.** One full sales cycle plus one delivery cycle per model tried; outcome models need at least the attribution window plus payment terms.

**Stop or review when**
- Disputes over outcomes exceed an agreed share: move to base + bonus
- Workflow jobs run margin-negative repeatedly: add caps or re-scope
- Buyers stall on unpredictability: add a base plan or ceiling

**Where it belongs in ClimbOS.** Plan engine offer/economics stage and Climb AI pricing questions; owner-input form fields (outcome measurability, attribution, cash buffer); new contract field for PB-pricing-test 'billing unit' changes.

**Author guidance (source findings):** GU-03-F2, GU-03-F3, GU-03-F4, GU-03-F5, GU-04-F2, GU-04-F3, GU-04-F4, GU-02-F1. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: GU-03's four models map to small-business terms as retainer-per-role, pay-as-you-go, per-job and success fee. The durable content is the gating conditions, not the forecast.

**Proposed ClimbOS rule:** Proposed ClimbOS rule: the engine may recommend outcome or success pricing only when the owner confirms a written outcome definition, an attribution method and cash to carry delivery cost; otherwise it offers base + bonus or per-job pricing and explains which gate failed.

**Overlap with existing guidance:** Extends guides/02_monetization.md ('compare charging models before optimizing a price point') and book 12 §10 with explicit eligibility gates. Complements BK02 Ch 8 strategy-type eligibility (penetration/skimming/maximisation), which covers price level, not billing unit.

**Disagreements and what decides them:** GU-03 (vendor of outcome billing) says outcome pricing wins long term; GU-02 says no model is perfect and to optimise the current one. For small businesses ClimbOS sides with GU-02 by default; outcome pricing only when the gates pass. GU-04's survey shows small-customer sellers prefer hybrids, consistent with 02_monetization's predictability concern.

**Playbook:** [BRP-02](../playbooks/BRP-02-charging-model.json) · **Evaluation case:** BR-EV02 ([cases.json](../evaluations/cases.json))

## GU-C3: Package architecture and expansion levers

**Decision it helps make.** How to structure tiers and add-ons, and which lever to add when a single flat offer leaves no room for customers to pay more as they get more value.

**Applies when**
- One flat price for everyone, little or no expansion revenue
- Best customers clearly get more value than others
- A new capability is launching and the owner asks whether to include it or charge for it

**Avoid when**
- Customer count too small to tell segments apart (start with one offer plus one add-on)
- Tier differences would gate something the entry plan needs to deliver its promise
- Operating more packages would overload support or billing

**Evidence and prerequisites**
- Segments with different jobs or willingness to pay (interviews, purchase data)
- Which features or services customers name as the reason they buy
- Adoption timing of features after purchase
- Cost to deliver each capability
- Ability to bill tiers/add-ons
- Plan entitlements written down

**Steps**
1. Write one sentence per plan: who it is for and why they buy
2. Default to three tiers when segments differ; one offer when they don't
3. Run the add-on test for each capability: polarising, different buyer/budget, replaces another vendor, adopted later, or costly to serve
4. Limit first purchase to one or two add-ons
5. Pick one expansion lever to test: premium tier, paid add-on, usage limit by tier, lite access level, minimum team size, or a disclosed annual escalator on new contracts
6. Fold proven add-ons into a higher tier periodically to keep the lineup simple

**When data, traffic, budget or integrations are missing**
- Low traffic: offer the premium option in sales conversations and log acceptance before publishing
- Service business: premium = faster turnaround or priority access; add-on = optional extra service
- No billing integration: separate invoice line items

**Metrics**
- Premium uptake share
- Add-on attach rate
- Revenue per customer and contribution per customer
- Downgrades and cannibalisation from top tier
- 'Which plan?' questions and plan-choice time

**Guardrails**
- Entry plan must deliver its advertised outcome
- No decoy-only tiers (BK02 rule)
- Escalators disclosed at signup, applied only per contract terms
- Existing customers' terms unchanged during tests (PB-pricing-test)

**Observation window.** At least one full renewal or repurchase cycle; 8–12 weeks of new signups for uptake reads, longer at low volume.

**Stop or review when**
- Premium uptake well below plan and base conversion falls: rethink tier boundaries
- Add-on causes billing confusion or complaints: bundle it
- More than two add-ons routinely needed: repackage

**Where it belongs in ClimbOS.** Pricing page advice, plan engine offer stage, PB-pricing-test (versioned variant: 'add an expansion lever'), Climb AI packaging Q&A, revenue calculator.

**Author guidance (source findings):** GU-02-F2, GU-02-F3, GU-02-F4, GU-02-F5, GU-05-F1, GU-05-F2, GU-05-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: the add-on test is the most transferable piece for small businesses; numeric uptake and pricing ratios are software heuristics to use only as starting assumptions.

**Proposed ClimbOS rule:** Proposed ClimbOS rule: every package recommendation states each plan's buyer and reason in one sentence, passes the add-on test for each extra, and shows expansion revenue as uptake × price difference with owner-supplied or clearly labelled assumed uptake.

**Overlap with existing guidance:** Extends guides/02_monetization.md (coherent package boundaries) and BK02 review Ch 10/11 (benefit lines per plan, compromise tier, no decoys). New: add-on eligibility test, expansion-lever menu, rebundling cadence. Versions PB-pricing-test.

**Disagreements and what decides them:** BK02 Ch 11 treats a middle tier as a compromise-effect tactic; GU-02 warns everyone defaulting to the middle can be a symptom of arbitrary plans. Decide by plan-choice data: if most buyers choose the middle and the top tier sees near-zero uptake, revisit boundaries rather than adding anchors.

**Playbook:** [BRP-03](../playbooks/BRP-03-package-architecture.json) · **Evaluation case:** BR-EV03 ([cases.json](../evaluations/cases.json))

## GU-C4: Free plan vs free trial vs reverse trial

**Decision it helps make.** Which try-before-you-buy model to use for a self-serve product or a sampleable service, given acquisition, conversion speed and cash needs.

**Applies when**
- Self-serve software, app or digital product
- Service businesses considering a free first session or sample (by analogy)
- Owner debating freemium vs trial, or conversion from free is low

**Avoid when**
- High-touch sales where trials are run by hand anyway
- Free usage carries material variable cost the business can't fund
- Value can't be experienced within any trial length and there's no free tier option

**Evidence and prerequisites**
- Visitor-to-signup and signup-to-paid rates by model (owner data, or labelled fallbacks from base-rates.md)
- Time to first value
- Variable cost per free user
- Cash runway or payback requirement
- Whether value grows with more users (virality/network)
- Feature gating or plan entitlements
- Product analytics for signup, first value and conversion
- Lifecycle emails before trial end

**Steps**
1. Measure time to first value; if longer than a plausible trial, lean freemium or reverse trial
2. Estimate paid customers per 1,000 visitors for each model using owner data or labelled assumptions
3. Account for timing: trials convert sooner, which matters if cash funds acquisition
4. Consider a reverse trial: full features for a limited time, then a free tier
5. Test one model change for new signups only; compare paid per visitor, not paid per signup

**When data, traffic, budget or integrations are missing**
- Low traffic: sequential before/after with whole-week cohorts and caveats
- No gating ability: time-limited trial by account flag
- Service business: paid first session at a discount instead of free

**Metrics**
- Paid customers per 1,000 visitors
- Signup-to-paid within a fixed window
- Median days to purchase
- Free-user variable cost
- Retention of converted users by model

**Guardrails**
- Never compare trial and freemium conversion rates directly (different denominators)
- Clear notice before a trial ends; no silent card charge
- Downgrade keeps the user's data

**Observation window.** At least two full trial lengths plus a 30–60 day window for freemium conversions; whole weeks.

**Stop or review when**
- Paid per visitor falls versus baseline after the window: revert
- Free-user cost exceeds the agreed budget: tighten the free tier
- Support load from downgrades spikes: improve messaging

**Where it belongs in ClimbOS.** Plan engine activation/conversion stage; PB-activation-repair (alternative branch); calculator for paid-per-visitor comparison; base-rates.md fallbacks.

**Author guidance (source findings):** GU-06-F1, GU-06-F2, GU-06-F3, GU-07-F2. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: the useful decision variable is paid customers per visitor over a fixed window, with conversion timing as a cash factor; the reverse trial is a hedge when time-to-value is short but acquisition matters.

**Proposed ClimbOS rule:** Proposed ClimbOS rule: trial-model recommendations must compute paid per 1,000 visitors and days to cash for each candidate, and must never compare per-trial and per-free-user conversion directly.

**Overlap with existing guidance:** Extends skills/growth-plays/reference/base-rates.md (free plan 2–5%, trial 15–25%, card-required 40–60%; grade C) with the denominator caveat and reverse-trial option; complements PB-activation-repair. No existing reverse-trial coverage found in docs/skills/shared.

**Disagreements and what decides them:** Base-rates implies a much larger gap (roughly 3–12x) between trial and free-plan conversion than GU-06's 2–3x. Not contradictory: different denominators and sources. Resolve by using owner data and per-visitor comparison.

**Playbook:** [BRP-04](../playbooks/BRP-04-free-access-model.json) · **Evaluation case:** BR-EV04 ([cases.json](../evaluations/cases.json))

## GU-C5: Lead with the outcome, not the AI label

**Decision it helps make.** How to describe and price an AI-enabled feature or service on landing and pricing pages.

**Applies when**
- Owner adds AI to a product or service and wants to mention it or raise price because of it
- Pricing page or ad copy leads with 'AI-powered'

**Avoid when**
- Audience is explicitly early adopters or tech buyers seeking AI tools (findings may not apply)
- Disclosure of AI use is required by law or platform policy (disclose, but still lead with benefit)

**Evidence and prerequisites**
- Measured outcome of the feature (time saved, errors reduced) from the owner's own users
- Comprehension or preference check of copy variants where traffic allows
- A way to measure the feature's effect (feature flag, before/after)

**Steps**
1. Rewrite headline around the customer's result in plain language
2. Quantify the gain only with the owner's measured data
3. Let users try the feature before it becomes paid where cost allows
4. If 'AI' is used, pair it with a concrete use case
5. Justify any price change with delivered value, not the AI label

**When data, traffic, budget or integrations are missing**
- No measurement yet: describe the task removed, without numbers
- Low traffic: 5-second or comprehension test with a few customers

**Metrics**
- Landing conversion
- Upgrade rate to plan containing the feature
- Feature adoption among trial users

**Guardrails**
- No invented or borrowed performance stats
- Required AI disclosures kept
- No price increase justified solely by 'now with AI'

**Observation window.** Whole weeks until each variant has enough visitors for the agreed decision rule; otherwise qualitative test.

**Stop or review when**
- Benefit-led copy underperforms the AI-led version with adequate sample: keep AI framing for this audience

**Where it belongs in ClimbOS.** Content/copy generation rules, pricing page advice, Climb AI copy review, landing-split playbook (PB-landing-split) hypothesis library.

**Author guidance (source findings):** GU-07-F1, GU-07-F2, GU-07-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: the study supports benefit-first copy for mainstream buyers; it does not show AI mentions harm early-adopter audiences.

**Proposed ClimbOS rule:** Proposed ClimbOS rule: generated copy leads with the customer outcome; 'AI' appears only as supporting detail unless the owner's audience is AI-seeking; no price justification rests on the AI label.

**Overlap with existing guidance:** Extends BK02 review Ch 10 (benefits not features, no unproven advantages) with direct evidence on AI labels. Mentions of 'AI-powered' exist in docs/research/acquisition-framework.md and channel-content.md; check those for conflicting copy advice.

**Disagreements and what decides them:** None with BK02. Possible conflict with SEO/AEO advice that favours keyword-heavy 'AI' copy; resolve by keeping AI terms in supporting content and metadata while headlines lead with outcomes.

**Playbook:** [BRP-05](../playbooks/BRP-05-outcome-first-ai-messaging.json) · **Evaluation case:** BR-EV06 ([cases.json](../evaluations/cases.json))

## GU-C6: Segmented price increase with value proof

**Decision it helps make.** Whether and how to raise list prices, especially on popular or unlimited plans, without losing price-sensitive customers.

**Applies when**
- Prices unchanged while value or costs rose
- Unlimited or flat top plan attracts heavy users
- Owner considers a single large increase

**Avoid when**
- Diagnosis points to weak value, delivery or communication (fix those first, BK02)
- Existing contracts forbid changes before renewal
- No record of added value to explain the change

**Evidence and prerequisites**
- Revenue and customer counts per plan
- Variable cost per plan, incl. heavy users
- Changelog of value added since last price change
- Price thresholds relevant to the segment
- Contract/notice terms for existing customers
- Owner authorisation and a reviewed migration plan for existing customers
- Customer communication template

**Steps**
1. Decide new-customer vs existing-customer scope separately
2. Raise most on the plan with the most demonstrated value; protect the entry price below a key threshold
3. For unlimited plans, prefer adjusting usage limits or adding a usage component over a very large jump
4. Compute the churn level at which revenue and contribution break even
5. Announce with the value record and adequate notice
6. Monitor churn and downgrades by plan against the break-even

**When data, traffic, budget or integrations are missing**
- Low volume: apply to new customers first and observe
- No cost data: raise on new customers only and add a fair-use clause
- Thin evidence: small steps tied to product improvements (BK02 Ch 12)

**Metrics**
- Revenue and contribution per plan
- Churn and downgrade rate vs break-even
- New-customer conversion at new price
- Complaints/refunds

**Guardrails**
- Existing customers get advance notice per terms; no silent changes
- Not a pricing test (PB-pricing-test keeps existing terms unchanged)
- No fake 'was' prices

**Observation window.** One renewal cycle for existing customers; 8–12 weeks of new signups.

**Stop or review when**
- Churn exceeds the computed break-even: pause and review
- Conversion of new customers falls sharply: reconsider level or packaging

**Where it belongs in ClimbOS.** New playbook candidate (PB-price-increase, proposed) beside PB-capacity, whose signature currently captures 'price increase' only as a capacity response; plan engine economics stage; calculator for break-even churn.

**Author guidance (source findings):** GU-08-F1, GU-08-F2, GU-08-F3, GU-08-F4, GU-02-F3. See the findings in [source_registry.json](../source_registry.json).

**Interpretation (ours):** Interpretation: the cases show segmentation (protect entry price, raise the core plan, tie to value) and suggest limit changes beat large jumps on unlimited plans; no outcomes were reported, so these are patterns, not proof.

**Proposed ClimbOS rule:** Proposed ClimbOS rule: any price-increase recommendation shows per-plan increases, the break-even churn, scope (new vs existing), required notice and the value record; increases on unlimited plans first consider limit or usage changes.

**Overlap with existing guidance:** Extends BK02 review (Ch 8 increase cadence; Ch 12 small steps tied to improvements) and PB-capacity (price increase as a capacity response). Fills the gap where 'price increase' routes only to delivery/capacity in shared/agents/diagnosis.ts.

**Disagreements and what decides them:** PB-pricing-test forbids changing existing customers' terms; a price increase is a separate, owner-authorised migration, not a test. 02_monetization requires a reviewed migration plan, consistent with this rule.

**Playbook:** [BRP-06](../playbooks/BRP-06-price-increase.json) · **Evaluation case:** BR-EV07 ([cases.json](../evaluations/cases.json))

## Not read or excluded

- https://www.growthunhinged.com/t/pricing: Pricing tag index blocked by Cloudflare bot verification (403 via WebFetch and curl; browser pane stuck on verification). Not bypassed. Article list built from the publisher's public Substack archive API instead; posts published on beehiiv after 2026-01-12 could not be listed or read.
- https://www.growthunhinged.com/: Homepage blocked by the same bot verification; 2026 posts (post-migration to beehiiv) unavailable.
- https://www.growthunhinged.com/p/whats-changing-with-ai-monetization: Preview read (about half). Not selected: overlaps GU-03 (AI 'FTE' pricing) and its survey figures (2024 SaaS benchmarks: 54% of AI products priced beyond seats) add little durable guidance for small businesses.
- https://www.growthunhinged.com/p/from-selling-access-to-selling-work: Preview read (about 40%). Not selected: overlaps GU-03; its value-capture claim (subscriptions capture ~10–15% of claimed value vs ~20–30% for success-based) is the author's unsourced estimate. Section on the downsides of success-based pricing was not visible.
- https://www.growthunhinged.com/p/the-best-growth-tactics-of-2025: Fully read (public). Not selected: self-selected poll of 130 readers naming their top experiment; category shares (outbound/ABM 20%, partners 20%, events 16%) are popularity, not effectiveness, and skew B2B software.
- https://www.growthunhinged.com/p/how-to-optimize-your-pricing-page: Preview read (about a third). Not selected: overlaps GU-08 and BK02 Ch 10/11 (benefit-led plans; stay under thresholds; charm endings like $9.99 may signal cheap consumer product in B2B).
- https://www.growthunhinged.com/p/your-guide-to-plg-pricing-201: Preview only (~20%); mostly about multi-user software teams, low relevance to small-business owners.
- https://www.growthunhinged.com/p/how-ai-apps-make-money: Preview only (~25%): 2024 review of 40 AI app pricing pages (7 in 10 subscription, half with free plan). Dated and descriptive; not selected.
- https://www.growthunhinged.com/p/how-to-optimize-your-free-trial: Preview under 10% of text; too little readable to use.
- https://www.growthunhinged.com/p/your-guide-to-price-testing: Preview only ~40 words; body not readable.
- https://www.growthunhinged.com/p/free-to-paid-conversion-at-scale: Preview ~100 words; body not readable.
- https://www.growthunhinged.com/p/your-guide-to-plg-benchmarks: Preview ~40 words; body not readable.
- https://www.growthunhinged.com/p/the-ai-churn-wave: Preview ~35 words; body not readable.
