# BK12 guide: Lean Analytics (Alistair Croll and Benjamin Yoskovitz)

Edition 2026-10-20 · status: proposed reference · not authorization for external actions

## Source

| Field | Value |
|---|---|
| Title | *Lean Analytics: Use Data to Build a Better Startup Faster* |
| Authors | Alistair Croll, Benjamin Yoskovitz |
| Publisher | O'Reilly Media (The Lean Series, Eric Ries series editor) |
| Year / edition | First Edition, copyright 2013 (hardcover March 2013). This PDF is the February 2024 softcover reprint; only author bios were updated, so all content and data are 2013 |
| ISBN | 978-1-098-16818-6 (softcover, copyright page, PDF p.12) |
| Format | PDF, `docs/reference-books/Lean_Analytics_-_Alistair_Croll_Benjamin_Yoskovitz.pdf`, read through the extracted text |
| Extraction quality | Good. 439 pages. 24 blank separator pages. Figures are images (captions only). Four figure pages (PDF 79, 181, 292, 385) were OCR'd for the stage, gate and B2B-stage figures; their column alignment is uncertain. Table 20-1 (PDF 293–295) came out with interleaved columns |
| Watermark / stamps | None (last page is a publisher ad) |
| Locator note | Locators are PDF page indexes from the text's page markers. In the body, printed page = PDF index − 26 (Chapter 1 printed p.3 = PDF p.29) |

**Coverage**

| Part | PDF pages | Status |
|---|---|---|
| Foreword, preface, Parts One–Four, Ch 1–31 | 19–418 | read |
| Front matter and contents | 1–17 | skimmed |
| Appendix references; about the authors | 419; 437–439 | skimmed |
| Index | 421–435 | skipped (no substance) |
| 24 blank pages (10, 14, 18, 28, 56, 68, 70, 128, 138, 150, 162, 184, 252, 290, 296, 298, 318, 366, 372, 376, 378, 414, 420, 436) | — | unreadable (no text) |
| Other image-only figures (e.g. 101, 310–311, 323, 329, 333, 344–345, 350) | — | unreadable; surrounding text carries the point |

Low relevance but read: Ch 3 (founder fit), Ch 30 (intrapreneurs).

## Use this guide for

- Choosing what goes on the scoreboard and filtering vanity numbers.
- Setting one focus metric, its target's provenance, and when to switch.
- Deciding whether a business has earned paid scale or revenue optimisation (stage gates).
- Picking the right stickiness signal for the business model (e-commerce, SaaS, app, media, community, marketplace).
- Reading churn by cohort instead of blended averages.
- Structuring early problem interviews.
- Revenue-stage economics: breakeven time, referral-adjusted acquisition cost.
- Adjusting evidence for B2B with few, large customers.
- **Fit:** every business type; strongest for SaaS, apps, marketplaces and e-commerce. All numbers are 2007–2013 and are context, never ClimbOS thresholds.

## Frameworks

### BK12-K1 Actionable-metric test and vanity filter

- **Decision:** which number goes on the scoreboard (North Star, play outcome, leading indicators) and which stays diagnostic.
- **Applies when:** always. **Not when:** ad-funded media, where audience inventory is what earns revenue.
- **Evidence needed:** each metric's numerator, denominator and window; the decision it would change; whether it is cumulative or per period.
- **Missing data:** no analytics connected → owner's own period counts (bookings this month), labelled self-reported.
- **Branches and steps:**
  1. List the 3–5 numbers the owner watches; write the action each would trigger if it rose or fell.
  2. Cumulative count (total sign-ups, all-time customers, list size) → convert to a period flow or rate.
  3. Attention metric in a non-media business → keep as a leading indicator paired with its outcome.
  4. Ad-funded media → inventory is acceptable when paired with revenue per 1,000 and audience churn.
  5. Nobody would act on it → drop it.
- **Cash / labour / capability / measurement:** none / minutes / none / one definition per metric.
- **Metrics:** share of sign-ups active in the period; new paying customers per period; revenue per visitor; revenue per customer.
- **Guardrails:** an all-time count is never progress; show count and denominator beside any rate.
- **Stop/review:** when model or stage changes.
- **Alternatives:** tiny denominators → show counts, not just percentages.
- **Author guidance:** a good metric compares, is easy to grasp, is usually a ratio, and changes behaviour; agree the response to each outcome before the data arrive; metrics that only ever rise can't guide action.
- **Author guidance:** for ad-funded media, page views and uniques are revenue inventory.
- **Interpretation:** ClimbOS's stage-metric lint catches attention words but lets "total sign-ups to date" pass, and is blind to business model.
- **Proposed ClimbOS rules:**
  - Warn when a North Star or play outcome is cumulative ("total", "all-time", "to date", "list size"); suggest the per-period flow or rate. *(contextual_heuristic)*
  - Media businesses monetised per 1,000 may use inventory as the North Star only when paired with revenue per 1,000 (computed in code) and an audience-churn reading. *(contextual_heuristic)*
- **Relation to existing:** extends `lintStageMetric` in [specs.ts](../../../../shared/agents/specs.ts) (lines 749–757), [growth-plays](../../../../skills/growth-plays/SKILL.md) lens 4 and [Book 12](../../../../docs/growth-intelligence/books/12_analytics_forecasting_pricing.md) §1–2.
- **Sources:** BK12-F1 (PDF p.35–37), F2 (p.39–41), F3 (p.38–47), F4 (p.38), F23 (p.139–144).

### BK12-K2 One focus metric with a line in the sand

- **Decision:** which single number the next 2–12 weeks optimise, what counts as success, and when to switch.
- **Applies when:** a constraint or stage is diagnosed. **Not when:** used alone without a guardrail.
- **Evidence needed:** the riskiest assumption now; business-model maths implying a required value; the owner's own trend.
- **Missing data:** no model value and no baseline → measure a baseline period first, or plot the owner's improvement curve and treat where it flattens as the practical ceiling.
- **Branches and steps:**
  1. Name the riskiest question and the metric that answers it.
  2. Write the line and its source: model maths (preferred), owner baseline, or a dated external norm (orientation only).
  3. Write the action for hit, miss and in-between before data arrive; pair with one guardrail.
  4. Hit, or gains flatten below the line → switch to the next constraint the improvement exposed.
  5. Missed, but qualitative evidence shows a valuable segment uses the product differently → redefine for that segment and record why; never lower the line just to pass.
- **Cash / labour / capability / measurement:** none / about an hour / basic tracking / weekly readings.
- **Metrics:** the focus metric; one guardrail.
- **Guardrails:** every line change is logged with reason and date.
- **Stop/review:** hit → switch; flat for 3+ readings below the line → change metric or strategy; line changed twice without new evidence → review.
- **Alternatives:** no tracking → owner tallies by hand weekly.
- **Author guidance:** one metric tied to the riskiest question gets priority at each stage; targets come first from what the model needs, and from what is normal for similar businesses only when the model can't say; fixing one metric reveals the next constraint.
- **Reported example:** an accelerator start-up missed its weekly-usage line, found a segment getting value at lower use, and lowered the line on qualitative evidence.
- **Interpretation:** ClimbOS's "North Star plus leading indicators" matches in shape; it lacks line provenance and an explicit switch rule.
- **Proposed ClimbOS rules:**
  - Every North Star target carries a source tag: model, owner baseline, or external with year; external dated targets never drive a pass/fail verdict. *(strategic_preference)*
  - Three consecutive readings with diminishing gains below the line → suggest switching metric or strategy. *(contextual_heuristic)*
- **Relation to existing:** versions [growth-strategy](../../../../skills/growth-strategy/SKILL.md) "North Star by stage"; duplicates pre-registered rules in [experiment-design](../../../../skills/experiment-design/SKILL.md); target field in [specs.ts](../../../../shared/agents/specs.ts) and [goal.ts](../../../../shared/agents/goal.ts).
- **Sources:** BK12-F5 (p.48–49), F11 (p.81–85), F12 (p.86–87), F13 (p.87–88), F14 (p.85–86), F51 (p.373–375).

### BK12-K3 Stage gates mapped onto the ClimbOS constraint order

- **Decision:** whether a business has earned paid scale or revenue optimisation, and what it must prove first.
- **Applies when:** the owner's funnel numbers exist (measured or partial). **Not when:** capacity binds (delivery stays first, a ClimbOS rule from BK01); one-off purchase businesses read differently (below).
- **Evidence needed:** activation defined as value received, not setup; churn or cohort retention for recurring models; repeat, referral, review or satisfaction signals for one-off models; capacity headroom.
- **Missing data:** no churn → a 30-day cohort read or owner-reported retention, labelled; no activation event → interviews to define first value (PB-interviews).
- **Mapping (interpretation):**

  | Book stage | ClimbOS equivalent |
  |---|---|
  | Empathy | diagnosis basis none or constraint unknown → PB-interviews |
  | Stickiness | activation plus retention |
  | Virality | the referral side of demand |
  | Revenue | conversion, offer and economics optimisation |
  | Scale | paid demand expansion |

- **Current code:** `diagnose()` checks delivery, then retention (only when churn is supplied and the type is SaaS), then the lower raw rate of activation versus purchase, then weak-overall SaaS, then demand.
- **Branches and steps:**
  1. Run `diagnose()` as today.
  2. Compute a separate stage gate in code: stickiness evidenced, weak or unproven.
  3. Recurring models (SaaS, subscription commerce, apps, memberships) with no churn or cohort read, or setup-only activation → unproven.
  4. One-off models (roofing, weddings, acquisition-mode e-commerce) → read delivered value, never churn.
  5. While weak or unproven: paid acquisition only as a capped test with no expand step or budget raise; upsell and price optimisation on the existing base deferred unless driven by capacity; the plan names the missing measurement.
  6. Never gated: charging, first-purchase conversion fixes, capped reversible tests, owner override with a reason.
- **Cash / labour / capability / measurement:** none to compute / owner supplies churn or repeat data / deterministic code / activation definition, churn or repeat rate.
- **Metrics:** activation (value event); monthly churn or cohort retention; 90-day repeat or review/referral rate; churn-weighted payback.
- **Guardrails:** gate reasons shown to the owner; approval stays with the owner.
- **Stop/review:** re-evaluate when new churn or cohort data, or 30 more days of funnel data, arrive.
- **Alternatives:** network-effect products seed critical mass before stickiness can be read.
- **Author guidance:** five stages, each with a qualitative gate; keep the order unless there is a strong reason; paid acquisition before stickiness is usually premature; virality multiplies paid spend. The authors also say good businesses eventually build all three engines, so the order is about focus.
- **Author guidance:** charging early is fine; the revenue stage shifts focus to margins and reinvestment.
- **Reported example:** a 2012 SaaS start-up charged from launch, used payment as proof of stickiness, and checked churn before turning to acquisition (self-reported).
- **Interpretation:** the rule against optimising revenue before stickiness holds for recurring models; it does not mean "don't charge", and owner-funded businesses need cash.
- **Proposed ClimbOS rules:**
  - `diagnose()` returns a stickiness gate with reason and the next measurement; unproven for recurring models without churn or cohort data. *(missing_prerequisite)*
  - While the gate is weak or unproven, paid playbooks run only as capped tests and base upsell or price optimisation is deferred unless capacity drives it. *(strategic_preference)*
  - One-off types read delivered-value signals, never churn. *(contextual_heuristic)*
  - When activation and purchase-from-activated are both weak, prefer activation instead of comparing raw rates across different denominators. *(contextual_heuristic)*
  - The owner can override any gate with a logged written reason. *(strategic_preference)*
- **Relation to existing:** extends [diagnosis.ts](../../../../shared/agents/diagnosis.ts) (order at lines 130–138; activation-versus-conversion pick at line 134) and PB-paid-search-test in [contracts.ts](../../../../shared/playbooks/contracts.ts), whose "leak further down" avoid-condition (line 135) is prose that eligibility never checks while its expand step (line 145) raises spend. Aligns with [Book 03](../../../../docs/growth-intelligence/books/03_growth_experimentation.md) §2 and [Book 12](../../../../docs/growth-intelligence/books/12_analytics_forecasting_pricing.md).
- **Sources:** BK12-F9 (p.79, 179–182, 292), F10 (p.74, 180, 258, 303–304), F18 (p.117), F30 (p.229–230), F31 (p.233–236), F34 (p.267–268), F37 (p.272–273, 278–280), F40 (p.283–286), F42 (p.304).

### BK12-K4 Business model drives the metric

- **Decision:** which funnel and which stickiness signal apply, given how the business makes money.
- **Applies when:** the business type is classified. **Not when:** hybrids need both readings.
- **Evidence needed:** revenue source; purchase frequency; e-commerce repeat share in 90 days or 12 months; marketplace share of searches with at least one result, active listings, buyer-to-seller activity.
- **Missing data:** no order export → owner estimate of repeat buyers, labelled; marketplace without search logs → weekly tally of unanswered requests.
- **Branches and steps:**
  1. E-commerce with low repeat → rank acquisition and referral above loyalty programmes; optimise revenue per visitor and order size.
  2. E-commerce with high repeat → loyalty and frequency plays are reasonable.
  3. Marketplace with many empty searches → seed supply by hand before buying buyer traffic; measure satisfied transactions.
  4. Free app or game → read churn at day 1, week 1 and month 1; separate paying users from all users.
  5. Media or community → audience churn, engaged time, participation tiers by cohort.
  6. SaaS → activation, paid churn separate from free churn, upsell path.
  7. Compute the model's key ratio in code; use it to rank playbooks, not to grade against 2013 norms.
- **Cash / labour / capability / measurement:** none / owner export / code calculators / orders with customer IDs; search logs.
- **Metrics:** 90-day repeat rate; revenue per visitor; searches with a result; satisfied transactions; day-1/7/30 retention; revenue per paying user.
- **Guardrails:** loyalty forecasts assume modest repeat-rate uplift unless the owner has evidence.
- **Stop/review:** re-classify when the repeat trend changes for two quarters.
- **Alternatives:** none needed beyond labelled owner estimates.
- **Author guidance:** e-commerce revenue per customer multiplies conversion, repeat and order size; marketplaces should focus on the side with money and measure liquidity; free apps should track payers separately.
- **Reported example:** a consultant's e-commerce modes classify businesses by repurchase rate and say loyalty pushes fail in acquisition mode (circa 2012, no sample size).
- **Interpretation:** model-specific readings would change which playbooks rank first without adding any external threshold.
- **Proposed ClimbOS rules:**
  - Optional commerce inputs (repeat buyers in 90 days, first-time buyers); code computes the repeat rate; external bands only as dated grade-C references. *(contextual_heuristic)*
  - Marketplaces reporting many empty searches rank buyer-demand plays after supply seeding. *(contextual_heuristic)*
  - Any base-rate rows from this book live under a dated 2013 practitioner heading, never in diagnosis references. *(unknown_to_investigate)*
- **Relation to existing:** extends [diagnosis.ts](../../../../shared/agents/diagnosis.ts) (SaaS-only references, lines 61–68), [retention-lifecycle](../../../../skills/retention-lifecycle/SKILL.md), [plays-ecommerce-consumer](../../../../skills/plays-ecommerce-consumer/SKILL.md) and [Book 12](../../../../docs/growth-intelligence/books/12_analytics_forecasting_pricing.md) §4.
- **Sources:** BK12-F16 (p.99–100), F17 (p.103–108, 113), F22 (p.131–135), F23, F24 (p.151–161), F25 (p.163–178), F36 (p.271).

### BK12-K5 Cohort and segment reading

- **Decision:** whether recent changes made things better, and which early behaviour predicts staying or paying.
- **Applies when:** repeat businesses with start dates and activity or payments by month. **Not when:** cohorts are tiny (show counts like "3 of 10").
- **Evidence needed:** at least 3 cohorts with 3+ complete months for a survival read.
- **Missing data:** no billing connection → owner's reported monthly churn, labelled, or a manual list by start month.
- **Branches and steps:**
  1. Group customers by start month; compare at equal ages; compute churn by cohort in code.
  2. Fast or uneven growth → avoid start-of-period or averaged denominators.
  3. Freemium or trial → track free and paid churn separately.
  4. Immature cells → label, never zero.
  5. A behaviour separating retained from lost users → a candidate leading indicator; test causation before using it as a lever.
- **Cash / labour / capability / measurement:** none / low once connected / [cohorts.ts](../../../../shared/attribution/cohorts.ts) / events with customer IDs.
- **Metrics:** retention by cohort age; paid churn; first-month revenue per cohort.
- **Guardrails:** counts beside percentages.
- **Stop/review:** monthly as cohorts mature.
- **Alternatives:** simple lifetime = 1 ÷ monthly churn only as a labelled rough figure.
- **Author guidance:** blended averages can hide improving cohorts; churn maths misleads during fast growth; leading indicators come from comparing those who stayed with those who left.
- **Interpretation:** largely duplicates existing guidance; the useful part is the code gap.
- **Proposed ClimbOS rules:**
  - With 3+ mature cohorts, diagnosis uses observed cohort retention and labels the source; owner-typed churn is the fallback. *(missing_prerequisite)*
  - Churn shown to owners states its type (paid or free; customer or revenue) and denominator method. *(strategic_preference)*
- **Relation to existing:** duplicates [Guide 04 DS-C4](../../blog-research/guides/04_subscription_economics.md) and [Book 12](../../../../docs/growth-intelligence/books/12_analytics_forecasting_pricing.md) §4; code gap: [jobs.ts](../../../../convex/jobs.ts) line 971 passes only owner-typed churn to `diagnose()`. See also [BRP-18](../../blog-research/playbooks/BRP-18-cohort-retention.json).
- **Sources:** BK12-F3, F6 (p.50–53), F8 (p.43–44), F20 (p.121–124), F33 (p.261–265).

### BK12-K6 Empathy-stage interview evidence

- **Decision:** whether a problem is painful enough for enough reachable people, and which segment feels it most.
- **Applies when:** new offers and pivots. **Not when:** surveys are sent before you know what to ask.
- **Evidence needed:** about 15 interviews per stage with target people (not friends); how they solve it today; commitments (follow-up, introductions, pre-payment).
- **Missing data:** can't find 15 people → treat as a reachability warning; use paid panels or existing customers.
- **Branches and steps:**
  1. Broad space → open-ended interviews; count unprompted mentions.
  2. Known problems → ask for a ranking.
  3. Nobody solving it today → budget for creating awareness, or drop it.
  4. Strong signals cluster in one segment → that segment is the beachhead.
  5. Scale up with a survey whose success threshold is written in advance.
- **Cash / labour / capability / measurement:** low (incentives) / 15–30 hours / script / tally sheet.
- **Metrics:** share with an existing workaround; share offering a commitment; problem rank counts by segment.
- **Guardrails:** no public quotes without consent; never use ClimbOS's own email service for cold recruitment.
- **Stop/review:** after about 15 per segment, decide: proceed, narrow, or drop.
- **Alternatives:** existing-customer interviews.
- **Author guidance:** positive signs are urgency to pay, existing workarounds and offered follow-ups; the book offers an optional numeric score that it admits is arbitrary.
- **Interpretation:** weight commitments over enthusiasm; any numeric score is subjective and secondary.
- **Proposed ClimbOS rules:**
  - PB-interviews readouts tally workaround, commitment and unprompted mention per interview, by segment; any score labelled subjective. *(contextual_heuristic)*
- **Relation to existing:** duplicates [BK05](../../../../docs/growth-engine/book-review/BK05.md), [BK04](../../../../docs/growth-engine/book-review/BK04.md) and PB-interviews in [contracts.ts](../../../../shared/playbooks/contracts.ts); adds the open versus ranking interview modes for [voc-research](../../../../skills/voc-research/SKILL.md).
- **Sources:** BK12-F26 (p.185–199), F27 (p.201–203), F28 (p.213–218), F29 (p.222–227).

### BK12-K7 Revenue-stage economics

- **Decision:** whether and how fast to pour revenue back into acquisition.
- **Applies when:** stickiness is evidenced (K3). **Not when:** churn is unknown (no verdict).
- **Evidence needed:** revenue per customer per month; gross margin; acquisition cost including owner time; churn or cohort survival; measured referral rate if counting virality.
- **Missing data:** no churn → no-churn payback labelled as an upper bound on speed, no verdict (as DS-C1).
- **Branches and steps:**
  1. Compute time to customer breakeven and churn-weighted payback in code.
  2. Within horizon → raise caps in steps; compare payback by channel.
  3. Beyond horizon → fix value per customer or acquisition cost first.
  4. Measured referral rate k below 1 → effective CAC = paid CAC × (1 − k); no measured k → no discount.
  5. Check breakeven gates: variable costs, and survival with no new marketing.
- **Cash / labour / capability / measurement:** acquisition budget / low / [economics.ts](../../../../shared/agents/economics.ts), [calc.ts](../../../../shared/growth/calc.ts) / cost and revenue by channel.
- **Metrics:** months to breakeven; churn-weighted payback; effective CAC; magic number (variant labelled).
- **Guardrails:** spend never above the owner's cap; benchmarks carry era and basis.
- **Stop/review:** payback lengthens two periods in a row → pause the raise.
- **Alternatives:** none beyond labelled upper bounds.
- **Author guidance:** lifetime value must exceed acquisition cost with room for operations, and cash timing matters; at scale, compare payback and churn by channel.
- **Reported example:** a SaaS company moved from consumers to businesses after acquisition cost dwarfed annual price, later targeting payback within 12 months per channel (self-reported).
- **Interpretation:** the referral-adjusted CAC and simple breakeven time are worth adding; the "a third of lifetime value" rule should stay a labelled heuristic.
- **Proposed ClimbOS rules:**
  - Add `effectiveCac(paidCac, k)` for measured 0 ≤ k < 1 only; never default k. *(contextual_heuristic)*
  - Don't adopt "CAC ≤ 1/3 of lifetime value" as a gate; show it only as a dated rule of thumb beside churn-weighted payback. *(strategic_preference)*
- **Relation to existing:** versions [Guide 04 DS-C1 and DS-C5](../../blog-research/guides/04_subscription_economics.md) and [Book 12](../../../../docs/growth-intelligence/books/12_analytics_forecasting_pricing.md) §9; calculator would sit in [decisions.ts](../../../../shared/analysis/decisions.ts).
- **Sources:** BK12-F19 (p.118–119), F32 (p.254–258), F35 (p.270–271), F37, F39 (p.282–288), F44 (p.302, 311–317), F46 (p.325–327).

### BK12-K8 B2B and enterprise adjustments

- **Decision:** how to read evidence and pick metrics with few, large customers.
- **Applies when:** B2B SaaS, agencies, consulting, developer tools. **Not when:** self-serve SMB SaaS behaves like a consumer funnel.
- **Evidence needed:** named customers and revenue share; support and integration hours per customer; sales-stage conversion; buyer versus user contacts.
- **Missing data:** no CRM → the owner's spreadsheet of deals and hours.
- **Branches and steps:**
  1. Fewer than about 30 customers or prospects → census, not sampling; talk to every one; no significance tests.
  2. One or two customers dominate revenue or support → segment them, price support, avoid building only for them.
  3. Usage mandated by the employer → logins aren't satisfaction; measure outcomes against a pre-deployment baseline.
  4. Consulting revenue funds a product → track custom work per customer.
  5. B2B virality → references and case studies, not invite loops.
- **Cash / labour / capability / measurement:** low / moderate (calls) / CRM or spreadsheet / revenue, hours, tickets per customer.
- **Metrics:** top customer's revenue share; support hours per customer; stage conversion; time to first value against the client baseline.
- **Guardrails:** no customer named publicly without permission.
- **Stop/review:** quarterly customer profitability review.
- **Alternatives:** before/after reads instead of A/B tests at small n.
- **Author guidance:** enterprise research is a census of few buyers; buyers and users differ; integration is the main stickiness risk; growing prematurely can alienate early reference customers.
- **Interpretation:** nothing in ClimbOS checks concentration, integration cost or mandated usage; diagnosis treats a 10-customer B2B firm like a rate funnel.
- **Proposed ClimbOS rules:**
  - B2B types under about 30 customers get counts, not rates, and experiment lints block significance-style tests. *(contextual_heuristic)*
  - One customer above an owner-defined revenue share → a disentanglement step before scale. *(strategic_preference)*
- **Relation to existing:** extends [plays-saas-b2b](../../../../skills/plays-saas-b2b/SKILL.md), [experiment-design](../../../../skills/experiment-design/SKILL.md), [lint.ts](../../../../shared/agents/lint.ts) and [Guide 04 DS-C6](../../blog-research/guides/04_subscription_economics.md).
- **Sources:** BK12-F42, F52 (p.379–388), F53 (p.388–396).

## Dated benchmarks (context only, never thresholds)

All figures are 2007–2013 sources reported in the 2013 text. None is a ClimbOS threshold.

| Figure | Value as reported | Source and era | PDF p |
|---|---|---|---|
| E-commerce repurchase modes | 90-day repurchase roughly 1–15% / 15–30% / above 30% read as acquisition / hybrid / loyalty | One consultant, c. 2012 | 99–100 |
| Weekly growth | 5–7% good, 10% exceptional, 1% weak | Accelerator founder, c. 2012 | 303 |
| Monthly and daily use of registered users | about 30% monthly, 10% daily | VC rule, 2011 | 304–305 |
| Monthly churn | under 5% sticky, about 2% very good; start-up averages 12–19% | 2012 aggregates | 302, 331, 334 |
| Best SaaS churn | 1.5–3% a month | 2009–2012 VC sources | 331 |
| Acquisition cost versus lifetime value | at most one third; the book calls it a rule of thumb, not a hard rule | Widely cited rule | 311–312 |
| Card-required trials | 0.5–2% of visitors start, 40–50% convert; without card 5–10% start, about 15% convert | Vendor data, 100+ SaaS, c. 2012 | 325–327 |
| Free to paid | about 2%; one note-taking app under 1% in month one, about 12% after two years | Various, 2012 | 329, 340–341 |
| E-commerce conversion | about 2% typical, 10% exceptional; cart abandonment about 65% | 2007–2012 surveys | 319–323 |
| SaaS magic number | below 0.75 a problem, above 1 invest | 2008 definition (variants differ) | 270–271 |
| Viral coefficient | above 0.75 treated as good | Authors | 313 |
| Email | 20–30% open, above 5% click | Pre privacy-proxy era | 315 |
| Media ads | 0.5–2% click-through; below about 0.08% is noise | 2012 | 349 |
| Community participation | about 17 min a day; 25% lurk, 5–15% create | 2012 | 358–362 |
| App acquisition | paid installs $0.10–0.70; up to 80% day-one drop | 2012 app stores | 335–343 |

## Disagreements and what decides

| Topic | Positions | What decides |
|---|---|---|
| **Base-rates misattribution** | [base-rates.md](../../../../skills/growth-plays/reference/base-rates.md) line 67 cites "e.g. Lean Analytics" for 2–5% free to paid; the book's figure is about 2% (c. 2012). The adjacent trial rows (15–25% no card, 40–60% card) cite product-led growth literature; this book's figures for the same steps are about 15% (higher only when selling targets serious evaluators) and 40–50%. The same ranges are mirrored in `REF` in [diagnosis.ts](../../../../shared/agents/diagnosis.ts) (lines 64–67) and in [generated.ts](../../../../shared/skills/generated.ts) | Fix the attribution and add the era. Keep wider ranges only if another source supports their upper ends; stop citing this book for them (P2) |
| Small-business SaaS churn | ClimbOS reference 3–7% monthly (grade C) | This book doesn't support 7% as acceptable; it uses 5% as the line. Find another source or narrow the range |
| Acquisition cost rule | Book: at most a third of lifetime value; [Guide 04 DS-C5](../../blog-research/guides/04_subscription_economics.md): no LTV:CAC gate | DS-C5 wins for owner-funded businesses: churn-weighted payback within 12 months. The book's own 12-month payback example agrees |
| Single focus metric | Book: one metric; [Book 12](../../../../docs/growth-intelligence/books/12_analytics_forecasting_pricing.md) §1 and [BK06](../../../../docs/growth-engine/book-review/BK06.md) prefer composite criteria with guardrails | Keep both: one focus metric plus guardrails, matching the book's own point that metrics work in pairs |
| Stickiness before conversion | Book order: stickiness first; [Book 03](../../../../docs/growth-intelligence/books/03_growth_experimentation.md) §2 ranks constraints by system effect | Conversion fixes and charging are never gated; scale is gated until churn-weighted value is known |
| Growth-first | An accelerator's weekly-growth targets versus the gates | The authors side with gates for most businesses and call growth-first consumer-biased |
| Interview scoring | Book scores enthusiasm and demeanour; [BK05](../../../../docs/growth-engine/book-review/BK05.md) distrusts both | Weight commitments over demeanour |
| Loyalty as default lever | [retention-lifecycle](../../../../skills/retention-lifecycle/SKILL.md) assumes repeat is the lever; the book's e-commerce modes say loyalty pushes fail in acquisition mode | Owner's measured repeat rate and play cost, compared in code |
| Vanity metrics | ClimbOS lint treats views as never an outcome; the book allows inventory for ad-funded media | Business model: who pays for what |
| Book's own arithmetic | Trial example claims a 40% rise but its table goes 60 → 100 customers (+67%) (p.327); viral example prints 165 users and $6.06 where the series gives 166.67 and $6.00 (p.313); Ch 28 recap says churn below 2.5% against 5%/2% elsewhere (p.373) | Recompute in code; never copy summary sentences |

## Not processed or uncertain

- Figure alignment from OCR on PDF 79, 181, 292 and 385 (gate column); Table 20-1 columns interleaved.
- The magic-number prose says annual but the printed formula uses quarterly values without annualising.
- Other image-only figures were not OCR'd; captions and text only.
- Whether ClimbOS's 3–7% small-business SaaS churn range has another source.
- App-store tactics in the app chapters may now breach store rules; not assessed.
