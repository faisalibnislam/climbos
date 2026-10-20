# BK13 guide: Making Websites Win (Blanks & Jesson)

Edition 2026-10-20 · status: proposed reference · not authorization for external actions

## Source

| Field | Value |
|---|---|
| Title | Making Websites Win: Apply the Customer-Centric Methodology That Has Doubled the Sales of Many Leading Websites |
| Authors | Karl Blanks, Ben Jesson (Conversion Rate Experts) |
| Publisher | Not named in the file; copyright held by the authors |
| Year | **2018** per the copyright page (an earlier request said 2017; the tools described date from about 2017–2018) |
| ISBN | 978-1-5445-0052-2 (ebook); hardcover 978-1-5445-0053-9; paperback 978-1-5445-0051-5 |
| Format | EPUB, `docs/reference-books/Making_Websites_Win__Apply_the_Customer-Ce_-_Karl_Blanks.epub`; no edition statement |
| Extraction quality | Good for text (74 parts, about 59k words after removing duplicated list text). 127 inline images plus the cover are unreadable |
| Watermark | None found |
| Coverage | All 74 parts **read**, including front matter, Sections 1–4 and the goHenry case. **Unreadable:** every image (profit and power-law diagrams, the meek-tweaking duration graph, the objection/counter-objection template, the funnel-planner columns, the gap-analysis table headings, all wireframes and goHenry screenshots). Nothing reconstructed. Nothing skipped |

Locators use `partNNNN [element range]` from `epub_full.py`.

## Use this guide for

- Choosing **what to change** on a page or funnel step, and whether a requested "best practice" (guarantee, testimonials, countdown) fits the evidence.
- Picking **research methods** to learn why visitors stall at low traffic.
- Deciding **whether and how to measure** a page change at small-business volume.
- Structuring **long pages for complex or higher-ticket sales**.
- Designing a **guarantee** and checking it pays.
- Handling **not-ready visitors** and conversions that finish on someone else's site.

Business types: SaaS, ecommerce, agencies, apps, marketplaces, local services (higher-ticket for K5). Stages: pre-launch with a prototype through established; most useful early, when traffic is thin.

---

## BK13-K1 Diagnose before choosing a remedy (DiPS)

- **Decision:** which page change to make, and whether a proposed remedy is warranted at all.
- **Applies when:** any conversion or page request. **Not when:** an observable blocker (broken form, missing price) needs fixing now; fix it without diagnosis.
- **Evidence needed:** at least one source naming why people stall (user-test notes, buyer answers, exit survey, sales/support/chat objections, recordings) with counts; the page goal; traffic source and awareness stage.
- **Missing data:** output a diagnosis plan (K2) before any persuasion remedy.
- **Branches and steps:**
  - **Author guidance:** each kind of hesitation has its own counter. Can't tell what it does: explain it plainly. Can't see why they need it: benefits. Doubt it works: proof. Fit or compatibility worries: specifics where the question arises. Price feels high: justify value or change the offer (K7). Distrust the firm: credibility. Want to think: genuine reasons to act, or an intermediate step (K8).
  - **Author guidance:** a remedy that answers no diagnosed problem only adds clutter; guarantees help only when risk or credibility is the issue.
  - Steps: state goal → collect evidence → code reasons into classes with counts → pick the top or most blocking class → choose the matching remedy → place it where the worry arises → measure (K4) and re-diagnose if nothing moves.
- **Cash / labour / capability / measurement:** $0–100 for incentives; about 3–8 owner hours for 3–5 tests or buyer calls; ability to run a silent task test (ClimbOS drafts scripts and codes notes); a goal event, else label results unmeasured.
- **Metrics:** mentions per class (n of N); step conversion; whether the objection still appears in the next round.
- **Guardrails:** no invented proof, guarantees or urgency; diagnoses labelled "likely reason", never proven cause.
- **Stop / review:** same objection persists after the fix in 3–5 more tests → revisit the diagnosis; two remedies in a row fail → check whether the binding constraint sits elsewhere.
- **Alternatives:** no traffic → method marketing, selling in person, staff who talk to buyers; no customers → competitor reviews; no analytics → owner tally of enquiry questions.
- **Interpretation:** this is the book's strongest transferable rule. The current conversion audit is checklist-led and can drift into prescribing remedies without evidence.
- **Rule classes:**
  - **Proposed ClimbOS rule:** every "fix now" or "test" item names its problem class and evidence count; unevidenced items go to "Later" unless they are blockers. *(strategic_preference)*
  - **Proposed ClimbOS rule:** suggest a guarantee or other risk reducer only when risk or credibility is a top diagnosed class, or the owner asks. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** no diagnosis evidence → diagnosis plan first. *(missing_prerequisite)*
- **Relation to existing:** versions [conversion-audit](../../../../skills/conversion-audit/SKILL.md); duplicates the "match the reducer to the risk" point in [VOC and conversion copy CH-C5](../../blog-research/guides/03_voc_conversion_copy.md); consistent with [Book 10 §6](../../../../docs/growth-intelligence/books/10_paid_media_cro.md). Tension with [landing-pages](../../../../skills/landing-pages/SKILL.md), whose page structure includes risk reversal by default (step 7 of the section list).
- **Sources:** BK13-F8 part0021 [11–86]; BK13-F9 part0021 [81–83], part0061 [16–39]; BK13-F22 part0013 [23], part0054 [11–20]; BK13-F15 part0033 [15–97].

## BK13-K2 Choose diagnosis methods by traffic and customer base

- **Decision:** which research methods to use, given weekly visitors, reachable buyers, owner hours and consent basis.
- **Applies when:** K1 needs evidence. **Not when:** fresh, coded evidence already exists for the step.
- **Evidence needed:** weekly page visitors (or "unknown"); reachable recent buyers and the lawful contact basis; who talks to buyers; owner hours.
- **Missing data:** traffic unknown → start with methods that need none (tests, selling, staff interviews).
- **Branches:**
  - **Author guidance:** at a few visitors a day, user tests are the most productive method, followed by watching recordings, talking to people who sell face to face, studying competitors or adjacent firms, a prominent phone number and larger survey incentives.
  - **Author guidance:** ask recent buyers what almost stopped them; they qualified themselves and remember the barriers, while non-buyers are a mixed group whose price complaints can mislead.
  - **Author guidance:** become a customer yourself (including offline analogues); when selling to learn, try to close for real, since presenting it as a survey draws polite answers; interview sales, support and resellers.
  - **Author guidance:** user tests move from hallway testers, to target users, to walkthroughs with people who just bought.
  - Moderate traffic plus owner approval → recordings, form-field drop-off, click maps (look for anomalies), site-search logs.
  - Surveys and visitor-intention analysis only when the expected answer count is reachable (the book wants about 100 answers for the intention analysis).
  - Finance or health audiences → expect low participation; send compliance reviews in small chunks.
- **Steps:** write the research question → compute expected responses in code → pick 2–3 methods, cheapest first → draft scripts → owner approves contact, tools, consent → code findings → hand top class to K1.
- **Cash / labour / capability / measurement:** $0 to low; 2–10 owner hours per round; moderate skill (ClimbOS drafts); counts and coded themes only, no conversion claims.
- **Metrics:** sessions or responses (n); themes as n of N; new themes per extra session.
- **Guardrails:** consent for recordings and calls; contact customers only on a lawful basis; never purchased lists; never deceive testers.
- **Stop / review:** two consecutive sessions add no new theme → stop; expected responses below need within the horizon → switch method.
- **Alternatives:** no traffic and no customers → staff interviews plus competitor reviews; no owner time → paid remote tests only with an approved budget; no tools → log every phone and email question for two weeks.
- **Interpretation:** existing skills are text-mining-led; the observational methods here are the gap. Response-rate figures in the book are dated agency numbers.
- **Rule classes:**
  - **Proposed ClimbOS rule:** compute expected survey responses from owner traffic and a stated rate before recommending a survey. *(economic_feasibility)*
  - **Proposed ClimbOS rule:** recordings and heatmaps carry a consent and masking prerequisite where privacy law applies. *(external_requirement)*
  - **Proposed ClimbOS rule:** weight recent buyers' barrier evidence above non-buyer price complaints when choosing the first fix. *(contextual_heuristic)*
- **Relation to existing:** extends [voc-research](../../../../skills/voc-research/SKILL.md), [CH-C2](../../blog-research/guides/03_voc_conversion_copy.md), [BRP-13](../../blog-research/playbooks/BRP-13-voc-mining-and-survey.json) and the low-volume section of [06 experimentation](../../guides/06_experimentation.md). Duplicates the "almost stopped" question already in voc-research.
- **Sources:** BK13-F10 part0025 [12–60]; BK13-F11 part0025 [32], part0049 [24–27]; BK13-F13 part0028–0030; BK13-F14 part0031 [15–50], part0037, part0046; BK13-F15 part0033 [15–97]; BK13-F16 part0034–0035; BK13-F17 part0039–0045; BK13-F18 part0042 [21–38]; BK13-F20 part0047 [11–214]; BK13-F25 part0057 [43–128].

## BK13-K3 Problem taxonomy and where to work first

- **Decision:** which diagnosed problem, on which page, to tackle first; and whether conversion work should come before more traffic.
- **Applies when:** K1/K2 have produced coded classes. **Not when:** the computed binding constraint is demand.
- **Evidence needed:** page reach (share of buyers or visitors who see it); coded classes with counts; owner funnel numbers.
- **Missing data:** no analytics → rank by mention share only, labelled; no research → K2 first.
- **Branches and steps:**
  - **Author guidance:** sites underperform in a recurring set of ways: writing, usability, not offering what visitors want, unclear benefits, weak offer, low trust, risk, readiness, complexity, competitors, attention, urgency, handover and lifetime value. Find which apply, then go to that fix.
  - **Author guidance:** work where traffic flows; a page nobody sees, or one already converting fully, yields nothing. Clear writing is a precondition for persuasion.
  - Broken flows → fix at once. Comprehension → fix before persuasion. Usability → wireframe and test on one or two people. Trust in company and in product → treat separately. Demand binding → don't lead with conversion work.
  - Steps: list problems with class, count and page → compute priority in code → pick top 1–3 → size bold changes → record each as a hypothesis with a metric.
- **Cash / labour / capability / measurement:** $0; 1–2 owner hours; scoring in code; page reach from analytics or labelled owner estimate.
- **Metrics:** priority score; step conversion before/after (labelled); contribution per visitor.
- **Guardrails:** arithmetic in code; no profit forecast from hypothetical conversion doubling; book benchmarks never targets.
- **Stop / review:** top problem fixed but step still lags → re-diagnose; constraint moves → move the work.
- **Alternatives:** no reach data → mention share alone, labelled.
- **Interpretation:** the book gives a taxonomy and broad priorities but no scoring rule. Reach × mention share is a ClimbOS design, not the authors'. The book's compounding arithmetic assumes independent stage effects.
- **Rule classes:**
  - **Proposed ClimbOS rule:** order fixes as blockers, then comprehension and usability, then persuasion classes; within each, reach × mention share computed in code. *(strategic_preference)*
  - **Proposed ClimbOS rule:** show conversion leverage only as an owner-input scenario labelled hypothetical. *(strategic_preference)*
  - **Proposed ClimbOS rule:** don't put conversion work ahead of reach when the computed constraint is demand. *(contextual_heuristic)*
- **Relation to existing:** versions the prioritisation step in [conversion-audit](../../../../skills/conversion-audit/SKILL.md); finer-grained than [Book 10 §6](../../../../docs/growth-intelligence/books/10_paid_media_cro.md); [diagnosis.ts](../../../../shared/agents/diagnosis.ts) picks the weak stage but has no within-stage reason input.
- **Sources:** BK13-F4 part0015 [13–75]; BK13-F5 part0017 [11–61]; BK13-F12 part0027 [11–13]; BK13-F22 part0054 [11–20]; BK13-F23 part0055; BK13-F24 part0056; BK13-F28 part0060.

## BK13-K4 Bold changes and low-traffic measurement

- **Decision:** whether and how to measure a page change: A/B, earlier metric, pooled pages, bought traffic, user tests, or labelled before/after.
- **Applies when:** a diagnosed change is ready. **Not when:** the change is a cosmetic tweak; ship it if harmless or drop it.
- **Evidence needed:** weekly eligible visitors; baseline rate; minimum worthwhile effect; owner horizon; reversibility and cost of a wrong call.
- **Missing data:** no baseline → measure one first or use user tests; no tracking → no test.
- **Branches:**
  - **Author guidance:** small effects take disproportionately long to detect, so test bold, targeted changes rather than meek tweaks.
  - **Author guidance:** at low traffic, test only major pages, use earlier steps as metrics, apply one change across similar pages, consider buying traffic for a while, cap the duration, and fall back to user tests when every test would take months.
  - Run time within horizon → fixed-horizon test in whole weeks, read once, ratio check.
  - Outcome too rare → earlier step as primary, outcome as guardrail.
  - Similar low-traffic pages → pooled test with a per-page direction check.
  - Approved budget → buy traffic temporarily; count it as cost.
  - Still infeasible → user tests for comprehension; reversible fixes with before/after labelled observational.
- **Steps:** write decision and minimum effect → run `sampleSize` → choose branch → pre-register metric, guardrails, end date, decision rule → run whole weeks → read with `compareRates` and `sampleRatio`.
- **Cash / labour / capability / measurement:** $0 unless buying traffic; 1–2 hours setup; a split tool or ad-platform experiment; event on primary and guardrail metrics.
- **Metrics:** required weeks; rates per arm; expected false wins (tests × alpha).
- **Guardrails:** at least 7 days in whole weeks; no stopping early on a win; harm stops allowed; no causal wording without a valid significant read.
- **Stop / review:** planned end → decide once; guardrail breach → stop; weeks exceed horizon → change design.
- **Alternatives:** no randomisation → before/after labelled observational; no traffic → paid message test only with approved budget.
- **Interpretation:** a check against the authors' durations (which give no baseline) is consistent with a roughly 10% baseline at 80% power and 5% alpha. Their suggestion to stop at 85–90% confidence, and to promote a research-backed challenger without a significant read, conflicts with the library unless pre-registered and labelled directional.
- **Rule classes:**
  - **Proposed ClimbOS rule:** compute run time before recommending any page test; tweaks are never tested at small-business volume. *(economic_feasibility)*
  - **Proposed ClimbOS rule:** a lowered threshold is set before launch, only for cheap reversible changes, and the readout stays "directional". *(strategic_preference)*
  - **Proposed ClimbOS rule:** pooled tests report a per-page direction check. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** reconcile the horizon (6 weeks in the skill, 12 in code). *(unknown_to_investigate)*
- **Relation to existing:** candidate v2 of PB-landing-split in [contracts.ts](../../../../shared/playbooks/contracts.ts) (fixed 700/week floor → computed feasibility); uses [decisions.ts](../../../../shared/analysis/decisions.ts); conflicts in part with [05 trustworthy experimentation](../../blog-research/guides/05_trustworthy_experimentation.md) and [BK06](../../../../docs/growth-engine/book-review/BK06.md); aligns with [experiment-design](../../../../skills/experiment-design/SKILL.md).
- **Sources:** BK13-F2 part0014 [32–98], part0050 [11–12]; BK13-F5 part0017; BK13-F7 part0020 [11–58]; BK13-F21 part0050 [39–91].

## BK13-K5 Complex-sale page structure

- **Decision:** page length, what the next step asks, and how to organise many objections.
- **Applies when:** higher-ticket or multi-objection offers, five or more coded objections. **Not when:** low-ticket impulse purchases, or paid single-intent pages where one CTA must dominate.
- **Evidence needed:** objection list with counts (K2); counters from sales, support, chat or owner; available next steps (trial, consult, guide, purchase).
- **Missing data:** no objection data → transcribe the owner's recorded sales pitch or call notes.
- **Branches:**
  - **Author guidance:** keep an objection/counter-objection table ranked by frequency, for one visitor type at a time.
  - **Author guidance:** lower the commitment of the next step, then use as many words as an in-person sale would need; check persuasion was not just pushed downstream.
  - **Author guidance:** offer a direct path and a detailed path; split copy into labelled modules; keep headings shallow; use headings that state the point (or invite a click where one is wanted); reveal detail on the page rather than on new pages; provide fallbacks (search, help, chat, phone).
  - **Author guidance:** if readers ask "so what?", add the benefit; if they doubt it, add the feature or proof; for services, show what happens after they say yes.
  - Many variants → guide by the questions a good salesperson asks, not product codes.
- **Steps:** fill the table → pick the next-step commitment → order modules by frequency and where each arises → plain headings and copy, readability-tested → add disclosure and fallbacks → test with 3–5 users on mobile.
- **Cash / labour / capability / measurement:** $0; 4–10 hours; a page editor; disclosure clicks if tracked, step conversion.
- **Metrics:** top objections answered; primary-CTA clicks per module; downstream step rate.
- **Guardrails:** price, fees, cancellation and legal terms stay visible; no invented counters; disclosure controls usable by keyboard and screen readers; tap rather than hover on mobile.
- **Stop / review:** tests still show the top objection unanswered → move its counter up; downstream drop after lowering commitment → revisit.
- **Alternatives:** no designer → plain sections with alternating backgrounds.
- **Rule classes:**
  - **Proposed ClimbOS rule:** a brief for any offer with 5+ coded objections includes the table and where each counter sits. *(strategic_preference)*
  - **Proposed ClimbOS rule:** disclosure never hides price, mandatory fees, cancellation or required terms. *(external_requirement)*
  - **Proposed ClimbOS rule:** a lower-commitment step names the downstream metric that checks persuasion wasn't deferred. *(contextual_heuristic)*
- **Relation to existing:** extends [landing-pages](../../../../skills/landing-pages/SKILL.md) and [copy-fundamentals](../../../../skills/copy-fundamentals/SKILL.md); duplicates "answer questions in order" in [CH-C3](../../blog-research/guides/03_voc_conversion_copy.md) and [BRP-14](../../blog-research/playbooks/BRP-14-page-question-order-and-risk.json).
- **Sources:** BK13-F19 part0044 [52], part0063 [141]; BK13-F23 part0055 [9–335]; BK13-F26 part0058 [42–144]; BK13-F31 part0063 [9–483].

## BK13-K6 Guarantee design and safe rollout

- **Decision:** whether to add, change or extend a guarantee, which type, and how to roll it out without open-ended refund risk.
- **Applies when:** risk or scepticism is a diagnosed top class and the product delivers. **Not when:** low price and no bold claim; outcome depends mainly on the customer's own effort (guarantee the service, not the result).
- **Evidence needed:** diagnosed risk; orders per period, price, contribution per kept order, loss per claim including handling; claim period; owner confirmation the promise is deliverable.
- **Missing data:** no order history → narrow, capped satisfaction promise labelled pilot.
- **Branches and steps:**
  - **Author guidance:** match the type to the fear (result → performance; happiness → satisfaction; overpaying → price match); name it, word it positively, make it easy to claim, refund promptly, place it where risk is felt.
  - **Author guidance:** roll out by modelling uplift against claim rates, running a short test, waiting out the claim period, then computing net profit.
  - Grid shows loss at plausible claim rates → don't launch, or narrow terms honestly.
- **Cash / labour / capability / measurement:** refund reserve sized from the grid; 2–4 hours plus claim handling; a refund process; orders and claims tagged by cohort.
- **Metrics:** observed uplift (labelled); claim rate; net profit change per period.
- **Guardrails:** no outcome promises the business can't control; no hidden conditions; statutory rights never sold as extras.
- **Stop / review:** claim rate above the computed break-even → stop or revise; claims backlog → pause.
- **Alternatives:** no test capacity → before/after across a full claim period, labelled observational.
- **Interpretation:** the rollout is a sound economic gate that maps to a calculator ClimbOS lacks.
- **Rule classes:**
  - **Proposed ClimbOS rule:** any guarantee recommendation carries a code-computed scenario grid and break-even claim rate. *(economic_feasibility)*
  - **Proposed ClimbOS rule:** guarantees appear in copy only once the owner confirms them. *(missing_prerequisite)*
  - **Proposed ClimbOS rule:** don't present legal rights (such as withdrawal periods where they apply) as a special guarantee. *(external_requirement)*
- **Relation to existing:** extends [CH-C5](../../blog-research/guides/03_voc_conversion_copy.md) and [BRP-14](../../blog-research/playbooks/BRP-14-page-question-order-and-risk.json); confirmed-claim checks already live in [specs.ts](../../../../shared/agents/specs.ts); needs a new kind in [decisions.ts](../../../../shared/analysis/decisions.ts).
- **Sources:** BK13-F9 part0061 [16–39]; BK13-F29 part0061 [16–131].

## BK13-K7 Offer, range and pricing levers with a compliance filter

- **Decision:** which offer change to make when diagnosis points to the deal rather than clarity or trust.
- **Applies when:** a diagnosed offer problem. **Not when:** the top class is comprehension, trust or readiness; route there.
- **Evidence needed:** offer problem with counts; most-liked products (not just best sellers); margins; visitor intentions if available; dated prior prices for any reference price.
- **Missing data:** no traffic for price tests → stated willingness-to-pay interviews (labelled) or a new-customers-only pilot.
- **Branches:**
  - **Author guidance:** make the first purchase an easy yes built on the product customers like most.
  - **Author guidance:** offer instalments when cash is the constraint; add premium tiers when buyers aren't price-sensitive; give a reason for any deal; test prices fairly.
  - **Author guidance:** when many visitors want things you don't offer, explore in low-risk steps (refer or partner before building).
  - Strike-through "was" price → only with a genuine prior selling price meeting local rules.
  - Price split test → check legality and fairness; time-based tests are safer.
- **Steps:** confirm the offer problem → pick one lever → margin and break-even in code → compliance filter → pilot via PB-pricing-test or PB-price-increase → record.
- **Cash / labour / capability / measurement:** varies; 2–6 hours; billing changes; revenue and contribution per visitor, refunds.
- **Metrics:** contribution per visitor; take rate per tier; refund rate.
- **Guardrails:** no fake reference prices; no rolling fake deadlines; owner-approved price changes.
- **Stop / review:** contribution per visitor falls → revert; refunds above guardrail → stop.
- **Alternatives:** no intention data → site-search logs and a competitor offer scan.
- **Interpretation:** the chapter is a long idea list (summarised, not reproduced). Its durable core is "match the lever to the diagnosed reason". Display tricks such as odd prices have weak support here.
- **Rule classes:**
  - **Proposed ClimbOS rule:** a reference price needs an owner-confirmed prior price and period, else block it. *(external_requirement)*
  - **Proposed ClimbOS rule:** offer changes only when diagnosis names an offer problem. *(strategic_preference)*
  - **Proposed ClimbOS rule:** gap-analysis revenue estimates are labelled assumptions and computed in code. *(strategic_preference)*
- **Relation to existing:** extends PB-pricing-test and PB-price-increase in [contracts.ts](../../../../shared/playbooks/contracts.ts), [BRP-01](../../blog-research/playbooks/BRP-01-credit-allowance.json) to [BRP-06](../../blog-research/playbooks/BRP-06-price-increase.json); contradicts the book's neutral treatment of rolling offers, which [runtime.ts](../../../../shared/agents/runtime.ts) forbids.
- **Sources:** BK13-F3 part0014 [77]; BK13-F25 part0057 [43–128]; BK13-F27 part0059 [15–330].

## BK13-K8 Readiness funnel, attention, genuine urgency, handover

- **Decision:** ask for the sale now or offer intermediate steps; keep not-ready visitors; measure when the final conversion happens elsewhere.
- **Applies when:** most visitors browse, buying is trigger-driven, or a partner or sales team closes. **Not when:** visitors arrive ready and the step converts.
- **Evidence needed:** share not ready (exit answers or sales notes); buying triggers; consented channels; whether the final page is under the owner's control.
- **Missing data:** no consented audience and no budget → owner follow-up only with opted-in people; no retargeting.
- **Branches:**
  - **Author guidance:** most visitors aren't ready; offer a chain of rewarding intermediate steps (guides, tools, courses) until they are, and be remembered when triggers occur (contract end, a move, a project start).
  - **Author guidance:** for visitors who want time to think, look for genuine deadlines or scarcity with a stated reason.
  - **Author guidance:** when the sale completes on a partner's page, persuade and qualify before handing over, and track the true conversion.
- **Steps:** measure readiness mix → design each step with a clear reward → set consent and follow-up → define the true goal across the handover → review per step.
- **Cash / labour / capability / measurement:** $0 for owned steps, ad spend only if approved; 4–12 hours per step; an email tool for consented lists; step and partner-reported conversions.
- **Metrics:** opt-in rate; nurtured-to-buyer rate in a window; final conversions per visitor (not click-outs).
- **Guardrails:** consent records; genuine urgency only; no cold email via Resend.
- **Stop / review:** opt-ins rise but buyers don't → revisit the step; partner data unavailable → label click-outs as proxy.
- **Alternatives:** no email consent → content visitors can return to.
- **Interpretation:** the urgency chapter's travel-site pressure tactics are dated and partly non-compliant today.
- **Rule classes:**
  - **Proposed ClimbOS rule:** off-site conversion → partner-confirmed conversion is primary; click-outs labelled proxy. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** urgency or scarcity copy needs an owner-confirmed deadline or stock fact. *(external_requirement)*
  - **Proposed ClimbOS rule:** contact capture and retargeting need consent, and retargeting an approved budget. *(missing_prerequisite)*
- **Relation to existing:** extends PB-lead-magnet in [contracts.ts](../../../../shared/playbooks/contracts.ts), [lead-magnets](../../../../skills/lead-magnets/SKILL.md), [lifecycle-email](../../../../skills/lifecycle-email/SKILL.md) and [Book 10](../../../../docs/growth-intelligence/books/10_paid_media_cro.md).
- **Sources:** BK13-F30 part0062 [12–132]; BK13-F33 part0065 [16–88]; BK13-F34 part0066 [11–80]; BK13-F35 part0067 [12–65]; BK13-F36 part0068 [11–60].

---

## Dated benchmarks and reported uplifts

Context only. Never forecasts, targets or thresholds.

| Item | Value as reported | Type | Locator | Caveat |
|---|---|---|---|---|
| Detection time at 300 views/day | About 2 days for an 80% lift, 23 for 20%, several months for 10% | Author illustration | part0020 [11–58] | Baseline sits in an unreadable graph |
| Doubling arithmetic | About 19% per stage over four stages | Calculated | part0017 [11–61] | Assumes independent multiplicative effects |
| Survey completion | About 3% | Dated agency figure | part0025 [32] | ~2017, no sample |
| Test-recruitment response | About 5% with incentive | Dated agency figure | part0049 [24–27] | Lower in finance and health |
| Client results (Mobal, Moz, Crazy Egg, Sony, call-centre decision trees, daFlores, PhotoShelter, Sunshine) | From +12% to roughly tripled sales | Reported examples | part0007, part0044 [52], part0058, part0063 | Selected successes, no samples |
| goHenry | 78% landing page, 191% via social ads, 36% pricing page, 23% homepage, 8% and 11% activation, 470% growth in a year | Reported example (client-reported) | part0070 [9–295] | No samples, intervals or durations |
| Copyright-page disclaimer | Results described are not typical | Author statement | part0000 [16] | Applies to every uplift above |
| Tools named | Google Optimize, Universal Analytics, Consumer Surveys, AdWords and others since sunset, renamed or merged | Dated | part0026–0070 | Verify status before naming any tool |

## Disagreements and what decides

| Topic | Book | Existing ClimbOS | What decides |
|---|---|---|---|
| Guarantee by default | Only for diagnosed risk | [landing-pages](../../../../skills/landing-pages/SKILL.md) lists risk reversal in its standard page sections | Diagnosed hesitation evidence; with none, keep it optional |
| Conversion work as top priority | CRO is the most important activity for any site | [diagnosis.ts](../../../../shared/agents/diagnosis.ts) may find demand binding | Owner funnel numbers |
| Lower confidence (85–90%) and promoting a challenger without significance | Allowed | [05 trustworthy experimentation](../../blog-research/guides/05_trustworthy_experimentation.md), [BK06](../../../../docs/growth-engine/book-review/BK06.md) require valid reads | Reversibility and cost: cheap reversible changes may use a pre-registered directional rule; pricing and guarantees keep the strict read |
| 2-day test example | Used as illustration | Whole-week rule in [specs.ts](../../../../shared/agents/specs.ts) | Whole-week rule |
| Fallback horizon | About six months | ~6 weeks in [experiment-design](../../../../skills/experiment-design/SKILL.md), 12 weeks in [decisions.ts](../../../../shared/analysis/decisions.ts) | ClimbOS's tighter horizon; reconcile skill vs code |
| Several CTAs | Sometimes three paths | One primary CTA in [landing-pages](../../../../skills/landing-pages/SKILL.md) | Page job: paid single-intent pages keep one primary; homepages may carry more |
| Buyers vs public reviews | Ask buyers | [voc-research](../../../../skills/voc-research/SKILL.md) leans on public reviews | Purpose: barriers from buyers; positioning from reviews |
| Rolling deadlines, strike-through prices | Presented neutrally | Banned unless genuine ([runtime.ts](../../../../shared/agents/runtime.ts)) | ClimbOS rule; genuine, confirmed facts only |

## Not processed or uncertain

- All 127 images unreadable; any content only in figures (templates, tables, wireframes, the duration graph) is missing.
- Publisher not named in the file; year 2018 per copyright page vs 2017 in an earlier request.
- The baseline behind the meek-tweaking durations is inferred, not stated.
- Tool status reflects knowledge to mid-2026; verify before use.
- Reference pricing, urgency, statutory rights and recording consent rules vary by jurisdiction; flags here are not legal advice.
- Line numbers in code and skills were checked on 2026-10-20 and may move.
