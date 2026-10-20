# BK10 guide: How Brands Grow (Byron Sharp)

Edition 2026-10-20 · status: proposed reference · not authorization for external actions

## Source

| Field | Value |
|---|---|
| Title | *How Brands Grow* (no subtitle in this file) |
| Authors | Byron Sharp. Chapter co-authors in this file: Jenni Romaniuk (differentiation vs distinctiveness), John Dawes and John Scriven (price promotions) |
| Publisher | Original print edition Oxford University Press, 2010. This file is a self-described updated e-book edition distributed via BookBaby (iTunes metadata); no publisher page in the text |
| Year | 2014 e-book build (OPF date 2014-09-16); metadata release date 2010-03-01 refers to the original |
| ISBN | 9781483534701 (e-book metadata) |
| Format | EPUB, `docs/reference-books/How_Brands_Grow_-_Byron_Sharp.epub` |
| Extraction quality | Good. Chapter XHTML and footnotes extract cleanly; data tables are real text. Charts are images (only values stated in prose are used). The table of contents skips from Chapter 12 to a "Chapter 14" FAQ; there is no Chapter 13 in the file. One promotion break-even table cell looks wrong (see Disagreements) |
| OCR | None needed |
| Watermark / stamps | None |
| Locator note | Locators are `OPS/<file>.xhtml [element range]`. File numbers are offset from chapter numbers: `chapter-6.xhtml` is book Ch 2, `chapter-17.xhtml` is the FAQ |

**Coverage**

| Part | Status |
|---|---|
| Preface; Ch 1–12 (chapter-4 to chapter-16.xhtml) | read |
| FAQ chapter (chapter-17.xhtml) | read |
| Footnotes 1–99 | read |
| Cover, reviews, author bios, contact page | skimmed |
| Bibliography | skimmed (used only to confirm cited sources exist) |
| Chart images (Figs 1.1–1.5, 4.1–4.5, 6.1, 7.1–7.2, 9.1, 10.1, 12.1) | not transcribed; two checked visually |
| Unreadable | none |

## Use this guide for

- Splitting a growth goal into more buyers versus more purchases per buyer.
- Deciding how much effort goes to churn reduction versus acquisition.
- Reading "top customer" and VIP numbers without the 80/20 myth.
- Choosing a positioning mode: niche differentiation or category-wide distinctiveness.
- Weighing reach, continuity and ease of buying against demand capture.
- Checking whether a discount or loyalty programme can pay.
- **Best fit:** consumer repeat-purchase businesses (cafés, salons, DTC consumables, local retail, hospitality), growing or established.
- **Weak fit:** niche B2B, contract or seat-based SaaS, capacity-limited services, pre-launch or very early products.

## When the laws apply

Owner decision (2026-10-20): Ehrenberg-Bass laws are **defaults** for consumer and repeat-purchase categories and **contextual heuristics** for niche B2B, capacity-limited services and early-stage products.

| Business condition | Status of BK10 laws | What ClimbOS does |
|---|---|---|
| Consumer, repeat purchase, many substitutes, capacity free | Default | Apply K1, K3, K5, K6, K7; positioning in category-buyer mode (K4) |
| Local service bought at a moment of need (plumber, locksmith, lawyer) | Heuristic | Demand capture first; reach only as cheap always-on presence; acquisition emphasis (K2) holds |
| Niche B2B, a few hundred reachable accounts, sales-led | Heuristic | "Reach all buyers" means covering the account list over time; Dunford positioning stays default; no Pareto law for contracts |
| Capacity-limited service (utilisation at or above 0.8) | Set aside | Capacity and price first (PB-capacity); no penetration push |
| Pre-launch or under about 20 customers | Heuristic | Laws can't be checked on own data; use only basic memory-building, consistent cues, one area at a time |
| Subscription with churn well above reference and mostly controllable | K2 overridden | Retention binds; acquisition kept at replacement level |
| Hybrid (marketplace, B2B2C) | Per side | Gate each side separately |

## Frameworks

### BK10-K1 Penetration versus frequency check

- **Decision:** whether a growth target should come mainly from more buyers or from more purchases per buyer.
- **Applies when:** repeat-purchase consumer business, many substitutes, capacity free. **Not when:** contracts or seat expansion (SaaS, retainers), one-off purchases, capacity-bound.
- **Evidence needed:** unique buyers in the last 12 months; purchases per buyer; an estimate of category buyers in reach (labelled); category purchase rate if known.
- **Missing data:** no buyer-level data → use transactions plus a labelled customer-count estimate, or a 4-week name tally; no category size → keep buyer counts, skip penetration share.
- **Branches and steps:**
  1. Decompose sales into buyers × purchases per buyer, in code.
  2. State the target both ways.
  3. If it needs frequency up by more than roughly 10–20% with flat buyers, flag it as against the norm and show the penetration version beside it.
  4. If required purchases per buyer exceed what buyers buy from the whole category, mark it infeasible.
  5. If capacity binds, hand off to PB-capacity.
- **Cash / labour / capability / measurement:** none / owner export of buyers and orders / POS, shop or CRM export / 12-month unique buyers and orders.
- **Metrics:** unique buyers per period; purchases per buyer; new versus returning share.
- **Guardrails:** no frequency-only default plan for consumer repeat businesses without the double-jeopardy note; arithmetic in code.
- **Stop/review:** after one full purchase cycle. Buyers rising with flat frequency is the expected pattern, not a failure.
- **Alternatives:** contract B2B → expansion revenue is a legitimate lever; double jeopardy is context only.
- **Author guidance:** within a category, smaller brands have far fewer buyers who buy slightly less often; penetration varies much more than frequency. Growth plans that depend on large loyalty gains work against this pattern.
- **Reported example:** effectiveness-award analyses where most growth cases were penetration-led (dated, self-selected).
- **Interpretation:** strong default for consumer repeat businesses; for niche B2B the evidence is one concrete-supplier table and FAQ assertions.
- **Proposed ClimbOS rules:**
  - Frequency growth above about 20% with flat buyers in a repeat B2C plan must show the penetration-led version too. *(contextual_heuristic)*
  - Required purchases per buyer above the category rate is blocked by a deterministic check. *(economic_feasibility)*
  - No frequency target without buyer-level counts; ask first. *(missing_prerequisite)*
- **Relation to existing:** new. [growth-strategy skill](../../../../skills/growth-strategy/SKILL.md) has no buyers × frequency split; the helper would sit in [calc.ts](../../../../shared/growth/calc.ts). Retention plays in [retention-lifecycle](../../../../skills/retention-lifecycle/SKILL.md) assume frequency is an easy lever.
- **Sources:** BK10-F1 (`chapter-6.xhtml [24]-[236]`), F2 (`chapter-6 [286]-[288]`), F3 (`chapter-6 [237], [300]-[338]`), F4 (`chapter-6 [238]-[283]`), F35 (`chapter-17 [22]-[60]`).

### BK10-K2 Retention versus acquisition with a steady-state ceiling

- **Decision:** how much effort goes to churn reduction versus new customers.
- **Applies when:** any business with repeat customers and a churn or defection reading. **Not when:** capacity binds (delivery first).
- **Evidence needed:** churn rate; new customers per month; active customers; churn reasons split into controllable (value, onboarding, failed payment) and uncontrollable (moved, closed, no longer needs).
- **Missing data:** no reasons → 5–10 exit conversations or a one-question cancel survey first; no churn rate → repeat-rate proxy, retention marked unknown.
- **Branches and steps:**
  1. Compute the steady-state ceiling (new per month ÷ monthly churn) and replacement acquisition (churn × base), in code.
  2. Churn far above reference and mostly controllable → retention binds; acquisition continues at least at replacement level.
  3. Churn normal for the business's size and mostly uncontrollable → acquisition is the growth lever; retention is maintenance.
  4. Small business with higher churn than the leader → some of the gap is size alone; don't call it a product failure without reasons.
- **Cash / labour / capability / measurement:** none / owner tags churn reasons / billing or booking export / monthly cohorts and exit reasons.
- **Metrics:** monthly churn; ceiling; replacement acquisition; controllable share of churn.
- **Guardrails:** no "retention is five times cheaper" or "5% retention doubles profit" claims; retention plays say what share of churn they can touch.
- **Stop/review:** a retention fix that leaves churn unchanged after one renewal cycle returns effort to acquisition.
- **Alternatives:** tiny base with noisy monthly churn → use quarterly windows and counts.
- **Author guidance:** defection also follows double jeopardy; growing brands grew through unusually strong acquisition while their defection stayed normal for their size.
- **Author guidance:** the popular retention-profit claims trace to a thought experiment, not measurement.
- **Reported example:** a regional bank's higher defection explained by branch footprint rather than satisfaction (bank data).
- **Interpretation:** Sharp's conclusion rests on low, category-normal, largely uncontrollable defection. Small SaaS with high early churn sits outside that evidence. Both views agree acquisition never stops.
- **Proposed ClimbOS rules:**
  - Diagnosis adds the ceiling and replacement acquisition whenever both inputs exist. *(contextual_heuristic)*
  - The retention competing explanation names uncontrollable and size-related churn. *(contextual_heuristic)*
  - Block the two folk retention claims as fact. *(strategic_preference)*
  - When retention binds, keep acquisition at or above replacement unless capacity binds. *(contextual_heuristic)*
  - Collect churn reasons before calling non-SaaS churn weak. *(missing_prerequisite)*
- **Relation to existing:** versions [diagnosis.ts](../../../../shared/agents/diagnosis.ts) (COMPETING.retention at line 76; retention verdict line 131; brief "Don't add demand above it" line 149) and [growth-strategy](../../../../skills/growth-strategy/SKILL.md) line 33 ("fix before paying to acquire more"). Extends [EV-C2 churn split](../../blog-research/guides/02_activation_retention_plg.md) and [BRP-08](../../blog-research/playbooks/BRP-08-churn-split.json).
- **Sources:** BK10-F8 (`chapter-7 [22]-[38]`), F9 (`chapter-7 [38]-[169]`), F10 (`chapter-7 [172]-[173]`), F11 (`chapter-7 [177]-[183]`), F12 (`chapter-7 [186]-[232]`).

### BK10-K3 Light buyers, real Pareto and buyer moderation

- **Decision:** whether to concentrate on current heavy customers or reach light and non-buyers; how to read "top customers" analyses.
- **Applies when:** consumer repeat business with customer IDs on orders. **Not when:** account-based B2B where concentration comes from contract size; one-off purchases; under about 100 customers (describe, don't decile).
- **Evidence needed:** customer-level purchases for 12 months, ideally 24.
- **Missing data:** no customer IDs → skip; use category-buyer reach logic instead.
- **Branches and steps:**
  1. Compute revenue share of top 20%, middle 30% and bottom 50%, in code, with the period stated.
  2. Compare two consecutive periods for the same customers before labelling anyone VIP.
  3. Owner asserts 80/20 without data → ask for the export.
  4. Plan targets only last period's heaviest buyers → add the moderation caveat and reach to light buyers.
  5. Capacity-limited service choosing higher-value clients → a capacity decision (PB-capacity), not a Pareto play.
- **Cash / labour / capability / measurement:** none / an export / customer IDs / two-period comparison.
- **Metrics:** top-20% share; next-period share of last period's top 20%; share of sales from last period's non-buyers.
- **Guardrails:** no segments or lookalikes built on one period's heavy buyers without the moderation caveat.
- **Stop/review:** a heavy-buyer programme that shows member lift is checked against the moderation baseline before expanding.
- **Alternatives:** B2B ICP from best customers stays fit-based (Dunford); this caveat applies only partly.
- **Author guidance:** most buyers of any brand are light buyers; the heaviest fifth deliver roughly half of annual volume, not four-fifths; next period, heavy buyers buy less and some non-buyers buy, with no real behaviour change.
- **Interpretation:** a strong default for consumer repeat businesses; contract concentration in agencies and B2B is a different quantity.
- **Proposed ClimbOS rules:**
  - Any top-customer statistic comes from data with the period stated; never assume 80/20. *(missing_prerequisite)*
  - VIP plays aimed at last period's heaviest buyers carry the moderation note. *(contextual_heuristic)*
  - In B2C repeat plans, at least one acquisition play reaches light or non-buyers. *(strategic_preference)*
- **Relation to existing:** new. Touches [retention-lifecycle](../../../../skills/retention-lifecycle/SKILL.md), [plays-local](../../../../skills/plays-local/SKILL.md) (SMS VIP club) and [prospecting](../../../../skills/prospecting/SKILL.md) (keep fit-based B2B). No repo file asserts 80/20.
- **Sources:** BK10-F7 (`chapter-6 [429]-[430]`), F13 (`chapter-8 [32]-[75]`), F14 (`chapter-8 [78]-[233]`), F15 (`chapter-8 [236]-[301]`), F16 (`chapter-8 [303]-[340]`), F19 (`chapter-11 [36]-[240]`).

### BK10-K4 Positioning mode: niche differentiation or category-buyer distinctiveness

- **Decision:** whether positioning centres on a narrow best-fit segment and differentiated value, or on all category buyers in reach with a distinctive, consistent identity.
- **Applies when (category-buyer mode):** consumer repeat or everyday local service with many interchangeable rivals; buyers choose by habit or salience. **Not when:** new or complex B2B/SaaS where buyers compare features, few customers, early stage (Dunford mode stays default).
- **Evidence needed:** purchase frequency; number of interchangeable rivals; how buyers choose (evaluate or habit); best-fit customer evidence; brand cues already in use.
- **Missing data:** no survey budget → audit consistency only and ask 5–10 customers what they recall; no cues yet → choose simple ones and keep them.
- **Branches and steps:**
  1. Classify the category on the conditions above; pick a mode and say why.
  2. Both modes: run a brand-cue audit (name, colour, logo, character, phrase, style) across site, listings, posts and ads.
  3. Real, large functional difference (allergy-free, specialist) → state it, expect a sub-partition, still reach the wider category.
  4. Narrowing by geography or capacity → compatible with Sharp; grow area by area.
  5. Category-buyer mode → the swap test is advisory, not a gate.
- **Cash / labour / capability / measurement:** none (survey optional) / 1–2 hours / site and social access / fame and uniqueness only with survey data.
- **Metrics:** asset fame; asset uniqueness; cue consistency across touchpoints.
- **Guardrails:** never invent competitor gaps; no rebrand without evidence the current assets lack fame; "everyone" is never an excuse to skip customer research.
- **Stop/review:** revisit the mode when a best-fit pattern appears or the business moves from niche to mass category.
- **Alternatives:** mixed businesses (e.g. B2B service with local walk-in trade) → one mode per line of business.
- **Author guidance:** competing brands sell to near-identical customer profiles; few users of any brand, including leaders, see it as different; invest in distinctive assets judged by fame and uniqueness, used consistently for years.
- **Author guidance:** most so-called niche brands are brands short of physical or mental availability.
- **Interpretation:** Dunford answers how buyers who evaluate see your value; Sharp answers how near-substitutes win habitual choices. Many ClimbOS SaaS owners fit Dunford, many local and DTC owners fit Sharp. Distinctiveness helps both.
- **Proposed ClimbOS rules:**
  - The positioning skill selects a mode from category conditions and records why. *(contextual_heuristic)*
  - In category-buyer mode, "all category buyers in the service area" is an acceptable segment and the swap test is advisory. *(contextual_heuristic)*
  - Every positioning output includes a brand-cue consistency check. *(strategic_preference)*
  - Fame or uniqueness claims need survey data; otherwise label them unmeasured. *(missing_prerequisite)*
  - Which mode wins for early local consumer brands is unknown; track outcomes by mode in bench. *(unknown_to_investigate)*
- **Relation to existing:** contradicts [positioning skill](../../../../skills/positioning/SKILL.md) lines 29 (delete parity attributes), 38 (Big Fish default), 57 (swap test as gate) and 70 (never "everyone") for consumer repeat categories; contradicts [BK03](../../../../docs/growth-engine/book-review/BK03.md) engine decision rule 2; sits beside [Guide 03](../../guides/03_positioning.md). Extends [social-visual-briefs](../../../../skills/social-visual-briefs/SKILL.md) beyond a visual kit.
- **Sources:** BK10-F5 (`chapter-6 [341]-[348]`; `footnotes [97]-[103]`), F17 (`chapter-9 [17]-[971], [1287]-[1302]`), F18 (`chapter-10 [64]-[356]`), F21 (`chapter-11 [412]-[596]`), F22 (`chapter-12 [238]-[567]`), F23 (`chapter-12 [572]-[622]`).

### BK10-K5 Mental and physical availability in channel choice

- **Decision:** how to weigh broad reach, continuous presence and ease of buying against high-intent demand capture.
- **Applies when:** recurring consumer category with a budget that can buy steady reach in the area. **Not when:** recency categories (people search shortly before buying: emergency trades, insurance, legal, furniture), where demand capture comes first; very small budgets.
- **Evidence needed:** purchase frequency; whether buyers search just before buying; monthly budget; service area or distribution footprint; hours, ordering routes, delivery coverage.
- **Missing data:** no tracking → "how did you hear" at checkout; no budget → free reach and availability fixes.
- **Branches and steps:**
  1. Classify recency and frequency.
  2. Audit physical availability (hours, locations, apps, stockists, booking friction); fix it before buying awareness.
  3. Pick demand-capture channels per scoring.
  4. Recurring B2C with budget → add one reach channel at even monthly spend; judge it over months.
  5. Budget too small to buy meaningful reach → listings, signage, partner newsletters, consistent posting.
  6. New brand → plant the basics (what it is, how it looks, where to buy); grow one area at a time.
  7. Every creative carries a brand cue early and at the end.
- **Cash / labour / capability / measurement:** varies, zero for availability fixes / owner time on listings and creative / ad accounts only if paid / reach, frequency, branded search, new-buyer counts.
- **Metrics:** monthly reach in area; weeks with any presence; branded search; new buyers per month.
- **Guardrails:** no paid reach without owner budget approval; impressions are not people reached; even spend unless a real seasonal peak exists.
- **Stop/review:** reach channels reviewed at about 3 months on new-buyer trend and branded search, not 8-week inquiries; capture channels keep existing stop rules.
- **Alternatives:** no ad budget → availability fixes, local listings, partner placements, organic posting.
- **Author guidance:** reach all category buyers continuously, be easy to buy, get noticed, keep memories fresh and brand-linked, stay consistent, remove reasons not to buy.
- **Author guidance:** in categories where attention appears only near purchase, advertising acts faster and plain informational search or directory ads can work (footnote 69).
- **Interpretation:** ClimbOS scoring already favours demand capture, which matches Sharp's own exception and suits tiny budgets. The gap is recurring consumer businesses with real budgets: the engine has no notion of reach, continuity or physical availability.
- **Proposed ClimbOS rules:**
  - For recurring B2C, read the frequency dimension and soften the intent penalty on broad-reach families by a bounded amount when the budget band supports them. *(contextual_heuristic)*
  - A physical-availability check runs before any awareness spend for consumer businesses. *(strategic_preference)*
  - Paid reach plans spread spend evenly by month unless the owner names a seasonal peak. *(contextual_heuristic)*
  - Reach channels use a 3-month window and new-buyer trend for stop rules. *(contextual_heuristic)*
  - Whether reach beats capture for small recurring-B2C budgets is unknown; geo holdout when budget allows. *(unknown_to_investigate)*
- **Relation to existing:** extends [scoring.ts](../../../../shared/acquisition/scoring.ts) (frequency dimension declared at line 23 but unread by priors; STAGE_INTENT at line 224), [library.ts](../../../../shared/acquisition/library.ts), [Book 05](../../../../docs/growth-intelligence/books/05_channel_strategy.md) §1 and [Book 09](../../../../docs/growth-intelligence/books/09_social_community.md) §3. Partly conflicts with [meta-ads](../../../../skills/meta-ads/SKILL.md) line 114 (see Disagreements).
- **Sources:** BK10-F24 (`chapter-13 [62]-[124]`), F25 (`chapter-5 [119]-[126]`; `chapter-13 [128]`), F26 (`footnotes [434]`; `chapter-13 [142]`), F32 (`chapter-16 [236]-[291]`), F33 (`chapter-16 [294]-[306], [548]`), F34 (`chapter-16 [403]-[499]`), F35.

### BK10-K6 Price promotion break-even and reach check

- **Decision:** whether to run a temporary discount, how deep, and what it can achieve.
- **Applies when:** established brand considering a temporary cut. **Not when:** perishable capacity (empty slots, end-of-day stock), which is yield management, outside this evidence; new-product trial offers.
- **Evidence needed:** contribution margin at normal price; discount depth; expected lift (own history or a range); share of promo buyers who bought before; whether rivals match.
- **Missing data:** no margin → block the promotion recommendation until the owner gives it; no history → one shallow, short test with a clear baseline window.
- **Branches and steps:**
  1. Compute required lift = discount ÷ (margin − discount), in code; block when discount ≥ margin.
  2. Expected lift below required → don't run, or cut shallower.
  3. Goal is new customers for an established brand → promo buyers are mostly existing buyers; prefer reach and availability.
  4. Promotions more often than about one in four weeks → warn about reference-price erosion; plan a wind-down.
  5. Subtract a post-promo dip where stockpiling is possible; report incremental contribution, not volume.
- **Cash / labour / capability / measurement:** forgone margin / low / sales by day and customer / baseline versus promo period, share of new buyers.
- **Metrics:** incremental contribution; share of promo buyers new to the brand; post-promo dip; promo frequency.
- **Guardrails:** no discount in a first lifecycle touch; no fake urgency; owner confirms every offer.
- **Stop/review:** stop repeating a promo with negative incremental contribution; review frequency quarterly.
- **Alternatives:** feature or visibility support instead of depth.
- **Author guidance:** promotions lift sales only while they run, mostly from existing buyers, with no lasting effect for established brands; in-store promotions reach few category buyers.
- **Interpretation:** the break-even formula is exact; elasticity averages are dated grocery figures and only a labelled fallback.
- **Proposed ClimbOS rules:**
  - Add a promotion break-even calculator to decisions.ts. *(economic_feasibility)*
  - A promotion play can't claim new-customer acquisition for an established brand without new-buyer data. *(contextual_heuristic)*
  - No promotion recommendation without owner-confirmed margin. *(missing_prerequisite)*
  - Book elasticity is a labelled fallback, never a forecast. *(contextual_heuristic)*
- **Relation to existing:** extends [decisions.ts](../../../../shared/analysis/decisions.ts) (no promo calculator today) and agrees with offer discipline in [retention-lifecycle](../../../../skills/retention-lifecycle/SKILL.md) line 43; touches PB-pricing-test in [contracts.ts](../../../../shared/playbooks/contracts.ts).
- **Sources:** BK10-F27 (`chapter-14 [15]-[124], [225]`), F28 (`chapter-14 [127]-[146]`), F29 (`chapter-14 [149]-[196]`), F30 (`chapter-14 [203]-[222]`).

### BK10-K7 Loyalty programmes, cross-sell and VIP clubs

- **Decision:** whether to start a loyalty, points or VIP programme or a cross-sell push, what to promise, and how to evaluate it.
- **Applies when:** retail, food, hospitality, local service or DTC considering a card or club. **Not when:** the goal is new buyers (weak lever).
- **Evidence needed:** pre-period purchases for members and non-members; who joins (heavy, light, new); cost including rewards paid to people who would buy anyway.
- **Missing data:** no POS IDs → total visits versus prior-year same weeks, labelled weak.
- **Branches and steps:**
  1. State the programme's real job: consented list, data, a reason to message, or a frequency nudge.
  2. Evaluation that compares members with non-members → reject; use a holdout or same-customer pre/post.
  3. Cross-sell target of a big jump in products per customer → flag as unlikely.
  4. Expect small effects.
- **Cash / labour / capability / measurement:** rewards plus tool / staff habits / POS with customer IDs / holdout or pre/post.
- **Metrics:** incremental visits versus holdout; share of members who were new; reward cost per incremental visit.
- **Guardrails:** never report member-versus-non-member gaps as programme effect; consent rules unchanged.
- **Stop/review:** incremental visits near zero after 90 days → keep only if the list or data job justifies the cost.
- **Alternatives:** small shop → a plain stamp card with no growth promise.
- **Author guidance:** loyalty programmes mostly enrol existing buyers, produce small effects, and are usually measured with selection bias; cross-sell ratios barely differ between rivals.
- **Interpretation:** a stamp card can raise card completion without moving total visits.
- **Proposed ClimbOS rules:**
  - Loyalty plays state their job and can't be the only retention or growth play. *(contextual_heuristic)*
  - Loyalty/VIP evaluation needs a holdout or same-customer pre/post. *(missing_prerequisite)*
  - The retention fit check counts a loyalty play only when paired with a churn-reason fix. *(contextual_heuristic)*
- **Relation to existing:** contradicts [plays-local](../../../../skills/plays-local/SKILL.md) (endowed-progress card rated strong on completion evidence, tracked by member visit frequency) and the playStage mapping in [diagnosis.ts](../../../../shared/agents/diagnosis.ts) line 157 (any "loyalty" wording counts as retention).
- **Sources:** BK10-F6 (`chapter-6 [351]-[426]`), F15, F31 (`chapter-15 [27]-[291]`).

### BK10-K8 Applicability gate

- **Decision:** which BK10 rules apply as defaults, heuristics or not at all for a given business.
- **Applies when:** always, before any BK10 claim enters a plan.
- **Evidence needed:** customer type; purchase frequency; interchangeable rivals; reachable buyers or accounts; capacity; stage or customer count; sales motion; contract versus transactional.
- **Missing data:** ask the 1–3 dimension questions already listed by scoring before applying any default.
- **Branches and steps:** follow the "When the laws apply" table; write a status per framework into the plan brief so agents phrase claims at the right strength.
- **Cash / labour / capability / measurement:** none / none / profile data / none.
- **Metrics:** share of plans with a gate status; bench cases passing.
- **Guardrails:** never cite a BK10 law as certain for niche B2B, capacity-limited or pre-launch businesses.
- **Stop/review:** re-gate when profile dimensions change.
- **Alternatives:** low-confidence dimensions → treat as heuristic.
- **Author guidance:** the FAQ claims the laws apply to small, service and B2B brands, and advises new brands to plant basic memories and grow region by region.
- **Interpretation:** the evidence base is overwhelmingly mature consumer categories with unconstrained supply; the gate turns the owner decision into statuses.
- **Proposed ClimbOS rules:**
  - Compute a BK10 status per plan from profile dimensions; agents phrase claims at that strength. *(strategic_preference)*
  - Capacity utilisation at or above 0.8 suppresses penetration advice. *(economic_feasibility)*
  - In niche B2B, "reach all buyers" becomes list coverage using only owner-sourced or public data; no assumed prospect database; cold email only from the owner's mailbox. *(external_requirement)*
  - Whether double jeopardy holds for small SaaS is unknown; collect bench evidence. *(unknown_to_investigate)*
- **Relation to existing:** new; uses dimensions in [scoring.ts](../../../../shared/acquisition/scoring.ts) and the capacity rule in [diagnosis.ts](../../../../shared/agents/diagnosis.ts) (lines 91–96, 130). Bench cases belong in [cases.ts](../../../../bench/expansion/cases.ts).
- **Sources:** BK10-F1, F4, F10, F26, F35.

## Dated benchmarks (context only, never thresholds)

| Figure | Value | Context and date | Locator |
|---|---|---|---|
| Top 20% of buyers' share of volume | about 50% annual; about 35% quarterly | FMCG household panels, pre-2010 | BK10-F14 `chapter-8 [78]-[233]` |
| Next-year volume from prior non-buyers | 14% for one stable sauce brand | US panel | BK10-F15 |
| Users calling their brand different | about 10% on average; 18% in one agency dataset among accepters | Consumer categories and retail banks | BK10-F22 |
| Growth cases reporting penetration growth | 82% versus 2% loyalty-only | Award entries, 1990s–2013, self-selected | BK10-F3 |
| Ads recognised and correctly branded | about 40% × 40% ≈ 16% | One Australian TV study, 143 ads | BK10-F25 |
| Temporary-promotion elasticity | about −2.3 to −2.6 average, usually −1 to −4 | Consumer goods meta-analyses | BK10-F28 |
| In-store promotion reach | about 2% of category buyers in the worked example | Retail-distributed brands | BK10-F30 |
| Annual defection in some service categories | 3–5% | Services; mature markets | BK10-F10 |
| Distribution needed for high share | about 80%+ weighted | Packaged goods | BK10-F33 |
| Cross-sell, products per customer | only small gaps between rivals (no single figure carried here) | Two Australian financial datasets | BK10-F6 `chapter-6 [351]-[426]` |
| Brand fanatics and switching-cost loyalty | small revenue share (1995); Apple slightly above expectation (2011) | Single-brand cases | BK10-F21 |

## Disagreements and what decides

| Topic | BK10 says | Existing library says | What decides |
|---|---|---|---|
| Niche positioning (Dunford) | Rivals share customers; most niches are availability gaps; low perceived differentiation is normal | [BK03](../../../../docs/growth-engine/book-review/BK03.md) rule 2 makes Big Fish, Small Pond the default; [positioning](../../../../skills/positioning/SKILL.md) forbids "everyone" (line 70) and deletes parity (line 29); [Guide 03](../../guides/03_positioning.md) starts from a candidate segment | Buying mode, substitutability, frequency, stage. Owner rule: Sharp default only for consumer repeat; Dunford default for B2B, SaaS and early products |
| Retention first | Acquisition drives growth; defection is mostly size and circumstance | [growth-strategy](../../../../skills/growth-strategy/SKILL.md) line 33; [diagnosis.ts](../../../../shared/agents/diagnosis.ts) line 149; [EV-C2](../../blog-research/guides/02_activation_retention_plg.md) | Churn versus a size-matched norm and the controllable share. High controllable churn: retention first. Normal churn: acquisition |
| Loyalty card evidence | Small effects, biased measurement | [plays-local](../../../../skills/plays-local/SKILL.md) rates the stamp card strongly | A holdout on total visits per customer |
| Brand early in ads | Branding is a hurdle most ads fail | [meta-ads](../../../../skills/meta-ads/SKILL.md) line 114: never open with the brand name | Synthesis: no throat-clearing intro, but a brand cue in the first frame and at the end |
| Intent-weighted scoring | Reach light buyers continuously | [scoring.ts](../../../../shared/acquisition/scoring.ts) line 224 down-weights unaware-stage channels | Recency category and budget band; investigate in bench |
| Universality | FAQ asserts the laws fit small, service and B2B brands | Owner decision: heuristic there | Bench evidence on owner data over time |
| Book arithmetic | Break-even table: 40% margin, 5% cut shows 10% | Formula gives 5 ÷ 35 ≈ 14.3% | Compute in code; don't copy the table |

## Not processed or uncertain

- Chart values in image figures; only prose-stated numbers used.
- No Chapter 13 in the file; whether content is missing is unknown.
- Whether double jeopardy and buyer moderation hold in small SaaS or niche B2B: one concrete-supplier table plus assertions.
- Evidence is sponsor-funded institute research, mostly 1990s–2013 consumer panels and award entries.
- Bibliography only skimmed.
- Sibling guide for Part 2: [BK11](BK11_how_brands_grow_2.md).
