# BK11 guide: How Brands Grow Part 2 (Jenni Romaniuk and Byron Sharp)

Edition 2026-10-20 · status: proposed reference · not authorization for external actions

## Source

| Field | Value |
|---|---|
| Title | *How Brands Grow. Part 2*, subtitled for emerging markets, services and durables, new brands and luxury brands (CIP entry) |
| Authors | Jenni Romaniuk, Byron Sharp. Chapter co-authors: Robert East (word of mouth), Magda Nenycz-Thiel (physical availability, online shopping) |
| Publisher | Oxford University Press Australia & New Zealand, South Melbourne |
| Year / edition | 2016, "first published"; no edition statement, so first edition |
| ISBN | 9780195596267 (hardback), from the copyright page, PDF p.8 |
| Format | Scanned PDF with no text layer: `docs/reference-books/How_Brands_Grow_Part_2_-_Jenni_Romaniuk.pdf` |
| Extraction quality | Fair. Apple Vision OCR. Prose clean on 250 of 254 pages (confidence 0.90–1.00). Tables and charts garbled: split columns, misread digits (e.g. a Cyrillic letter for 3). Only numbers that also appear in prose, or unambiguous table averages, are used |
| Low-confidence pages | PDF pp.3, 4 and 252 returned no text (likely blank or image); PDF p.64 at 0.83 (table values ignored) |
| Watermark / stamps | No piracy marks. Library-copy marks: a QATAR NATIONAL LIBRARY stamp (PDF p.7, p.253), a call number on the cover, publisher footer on many pages |
| Locator note | PDF page = printed page + 18 in the body (PDF 19 = p.1). Locators below give PDF page, then printed page in brackets |

**Coverage**

| Part | PDF pages (printed) | Status |
|---|---|---|
| Front matter, introduction | 1–18 (i–xiii) | read (pp.3–4 no text) |
| Ch1–Ch11 | 19–239 (1–221) | read; garbled tables not used |
| A Final Note | 240 (222) | read |
| Reference list | 241–251 (223–233) | skimmed (spot-checked citations) |
| Back matter | 252–254 | p.252 unreadable; rest is advert and blurb |

## Use this guide for

- Checking a growth bet against penetration-first evidence on the owner's own data.
- Mapping buying situations (category entry points, CEPs) for content and ad rotation.
- Auditing brand identity cues and their consistency.
- Planning reach on a small budget: breadth, continuity, adding a second platform.
- Setting realistic expectations for word of mouth and referrals.
- Auditing physical availability (presence, buyability, findability) before buying demand.
- Launching a new brand, location, line or variant.
- Reading where new customers come from.
- **Best fit:** consumer and local repeat businesses, e-commerce, hospitality, consumer apps. **Contextual:** B2B SaaS, agencies, capacity-limited services.

## When the laws apply

Owner decision (2026-10-20): Ehrenberg-Bass laws are **defaults** for consumer and repeat-purchase categories and **contextual heuristics** for niche B2B, capacity-limited services and early-stage products.

| Business condition | Status | What ClimbOS does |
|---|---|---|
| Consumer or repeat purchase, capacity free | Default | Penetration-first (K1), CEP breadth (K2), consistent assets (K3), reach-first (K4), availability audit (K6) |
| Buyer chooses from memory in the moment (local category search, habitual goods) | Default | CEP breadth over a single differentiating claim |
| Buyer deliberately compares a few vendors (considered B2B) | Heuristic | Dunford differentiation leads; CEPs become trigger events; reach means coverage of listed decision-makers |
| Listable B2B niche already mostly penetrated | Heuristic | Book's niche ceiling: growth from a new area, adjacent category or expansion revenue |
| Capacity-limited service (one practitioner, fixed client slots) | Set aside for growth | A niche can fill capacity; route to PB-capacity or PB-price-increase |
| New brand or product without evidenced fit | Heuristic | Validation first (PB-concierge, PB-interviews), then the two-stage launch (K7) |
| Under about 20 customers | Heuristic | Word of mouth can't be the bankable play; own-data checks not yet possible |
| Strong existing search demand on a tiny budget | Heuristic | Demand capture first; label reach-building as the next step |

## Frameworks

### BK11-K1 Penetration-first growth check on own data

- **Decision:** whether the main growth bet recruits new and light buyers or leans on loyalty, VIP, cross-sell or heavy-buyer programmes.
- **Applies when:** consumer or repeat business, capacity free. **Not when:** capacity binds; listable niche already mostly penetrated; durables bought every few years; brand-new products with no repeat history.
- **Evidence needed:** unique and new buyers per quarter; purchases per buyer; buyer-level counts for a frequency distribution; capacity utilisation for services.
- **Missing data:** no customer IDs → new versus returning counts over 90 days; no transactions → a measurement step first, cheap reversible plays (diagnosis "unknown" path).
- **Branches and steps:**
  1. Decompose growth into change in buyers and change in purchases per buyer, in code.
  2. Compute the top-20% share and its stability across two periods.
  3. List penetration barriers: entry price or size, hours, service area, missing variants, channels.
  4. Owner proposes a VIP programme as the engine → show the headroom arithmetic and that about half of top buyers drop out next period.
  5. Loyalty unusually high for the size → look for restricted reach before celebrating.
  6. Retention reads weak → keep the fix-the-leak rule, add the size-normal explanation, split churn by reason.
- **Cash / labour / capability / measurement:** none / 1–2 owner hours or zero if connected / POS, shop or billing export / customer ID per transaction, quarterly windows.
- **Metrics:** unique and new buyers per quarter; purchases per buyer; top-20% share; top-20% stability; utilisation.
- **Guardrails:** never recommend "firing" light customers; a loyalty programme isn't the growth engine without a penetration mechanism; label patterns as consumer defaults, not universal laws.
- **Stop/review:** quarterly. Two quarters of frequency-led growth with flat buyers in a niche or capacity-bound business → keep the loyalty-led plan and record why.
- **Alternatives:** if low-value customers can't pay back acquisition, value-targeting wins on economics.
- **Author guidance:** share changes show up mostly as penetration changes; unusual loyalty doesn't predict growth; heavy buyers have little headroom; the frequency distribution has a long-tailed shape and growth mainly shrinks the non-buyer group.
- **Author guidance:** track brand metrics quarterly rather than yearly.
- **Reported example:** a sponsor bank moved from cross-selling to penetration and reported customer numbers up about 29% while products per customer barely moved (no counterfactual).
- **Interpretation:** small businesses can't compare against rivals, but they can check the within-brand patterns on their own records, which is enough to stop 80/20-driven loyalty plans.
- **Proposed ClimbOS rules:**
  - For consumer repeat types not capacity-bound, the bankable demand play recruits new or light buyers unless a capacity or listable-niche condition is recorded. *(strategic_preference)*
  - Top customers picked from one period carry the "about half won't be top next period" note; no VIP sizing from one period. *(contextual_heuristic)*
  - A retention diagnosis for a consumer repeat business adds the size-normal, circumstantial-churn explanation and requires a churn-reason split before product changes. *(contextual_heuristic)*
  - Growth decomposition, Pareto share and heavy-buyer stability are deterministic calculators. *(missing_prerequisite)*
- **Relation to existing:** extends [growth-plays](../../../../skills/growth-plays/SKILL.md) line 130, [diagnosis.ts](../../../../shared/agents/diagnosis.ts) line 76, [BRP-08](../../blog-research/playbooks/BRP-08-churn-split.json), PB-capacity in [contracts.ts](../../../../shared/playbooks/contracts.ts). Overlaps [BK10 K1–K3](BK10_how_brands_grow.md).
- **Sources:** BK11-F1 (PDF pp.21–33 (3–15)), F2 (pp.25–27 (7–9)), F3 (p.27 (9)), F4 (pp.28, 31–32, 37–38), F5 (pp.35–36 (17–18)), F6 (pp.36–37), F7 (pp.42–43 (24–25)), F9 (pp.45–48 (27–30)), F10 (pp.48–49), F11 (pp.49–52 (31–34)), F13 (pp.55–57).

### BK11-K2 Category entry point map and mental availability

- **Decision:** which buying situations to link the business to, which one each piece of content carries next, and whether marketing builds mental availability.
- **Applies when:** local services, consumer e-commerce, hospitality, consumer apps. **Not when:** single-occasion categories (emergency locksmith) where breadth matters little; tiny areas where survey samples are too small to measure.
- **Evidence needed:** VoC snippets, reviews and sales notes that mention the moment of need; situation search queries; optionally a pick-any survey of category buyers (customers and non-customers) with a "none" option.
- **Missing data:** no survey → a qualitative CEP list ranked by VoC frequency and search demand, used for rotation, with no mental-share claims; no VoC → start from search queries and category leaders' reviews.
- **Branches and steps:**
  1. Generate situations in buyer words, before any brand: why, when, where, with whom, with what.
  2. Rank by commonness; map existing posts, pages and ads to them; find neglected common situations.
  3. One situation per execution; rotate across a calendar; record when each was last used.
  4. If surveyed: compute mental market share, mental penetration and network size in code with n shown.
  5. High mental penetration but low network size → broaden situations. Mental share above sales share → look for price or availability barriers. Below → widen situations and reach.
  6. New brand → lead with common situations, not a rare "ownable" one.
  7. Considered B2B → situations become trigger events; ask prospects which vendors came to mind; label small n.
- **Cash / labour / capability / measurement:** zero for the map, paid panel for measurement (cost unknown) / 2–4 hours / VoC coding with a situation field / pick-any grid of category buyers.
- **Metrics:** the three survey metrics; share of content by situation over 4–8 weeks (ClimbOS proxy).
- **Guardrails:** never survey only customers and call it market mental availability; include "none"; no invented situation statistics.
- **Stop/review:** network size flat after two waves on a new situation → check branding and reach before changing the message.
- **Alternatives:** Search Console impressions on situation queries as a low-confidence proxy.
- **Author guidance:** buyers retrieve brands through situational cues; bigger brands link to more of them; a single consideration question misses context-specific choice; positioning is the temporary sum of current messages, so each execution should carry one situation and campaigns should rotate them.
- **Author guidance:** current users give two to three times more brand associations than non-users, so customer-only samples inflate every metric.
- **Interpretation:** the cheapest high-value idea in Part 2 for small owners; copy-fundamentals' "one reader in a specific moment" is already a CEP in all but name.
- **Proposed ClimbOS rules:**
  - Content, ad and page plans tag each piece with one buying situation; a 4–8 week calendar covers several common ones. *(strategic_preference)*
  - The three survey metrics are computed in code from a grid with n shown; the model never estimates them. *(missing_prerequisite)*
  - A customer-only reading is labelled biased. *(contextual_heuristic)*
  - A new brand's main launch message isn't a rare situation unless the business is deliberately niche or capacity-limited. *(contextual_heuristic)*
- **Relation to existing:** new; partly contradicts [positioning](../../../../skills/positioning/SKILL.md) lines 29 and 79 (delete or ban parity) for memory-driven categories; touches [social-calendar](../../../../skills/social-calendar/SKILL.md), [copy-fundamentals](../../../../skills/copy-fundamentals/SKILL.md), [voc-research](../../../../skills/voc-research/SKILL.md) and [Book 09](../../../../docs/growth-intelligence/books/09_social_community.md) line 37.
- **Sources:** BK11-F18 (pp.82–84 (64–66)), F19 (pp.88–91 (70–73)), F20 (pp.90, 92–96), F21 (pp.98–99 (80–81)), F22 (pp.101–103 (83–85)), F43 (pp.213–220).

### BK11-K3 Distinctive asset audit and consistent identity

- **Decision:** which identity elements (colour treatment, logo, owner's face or character, van or shopfront, sound, short phrase) to build, protect or drop, and how to execute them.
- **Applies when:** any business with recurring public creative. **Not when:** forced rebrand (legal, merger) — then plan re-education.
- **Evidence needed:** inventory of every asset across site, socials, listings, vehicle, packaging, ads; optionally a masked-asset survey of category buyers.
- **Missing data:** no survey → the lay-it-all-out consistency check plus an informal masked check with a few locals, labelled anecdotal; no fame or uniqueness claims.
- **Branches and steps:**
  1. Lay out all collateral together; list what repeats and what clashes.
  2. Choose one or two assets usable at the shopfront and at the start of videos; pair each with the name prominently.
  3. Check legibility at thumbnail size.
  4. Variants and new services: parent assets first, then a twist.
  5. If surveyed: score fame (share of category buyers who link the asset to the brand) and uniqueness (share of the asset's links that go to this brand) in code; high on both → lean on it; unique but little known → keep pairing with the name; known but shared → never use alone; low on both → no head start.
  6. Category-generic colour (blue in dental) → execute it in a distinctive way.
- **Cash / labour / capability / measurement:** zero for the audit / 1–2 hours / brand kit in ClimbOS / optional masked survey.
- **Metrics:** fame; uniqueness; share of published pieces carrying the declared assets in the first frame or slide (ClimbOS proxy).
- **Guardrails:** don't derive assets from the current claim; never copy a competitor's assets; no logo, pack or colour change "for freshness"; distinctive, not odd.
- **Stop/review:** re-test yearly or after a major campaign; if a competitor copies an asset, pair it more tightly with the name.
- **Alternatives:** the owner's face and a recurring post format are the cheapest assets for owner-led businesses.
- **Author guidance:** distinctiveness (being recognised and found) is separate from differentiation (reasons to buy); build assets through reach, prominent pairing with the name, and consistency; managers overrate their assets, so measure.
- **Author guidance:** online, visually rich asset branding outperformed name-only branding in cited theses (dated, thin detail).
- **Interpretation:** the audit is cheap and fits the owner-led social content ClimbOS already produces.
- **Proposed ClimbOS rules:**
  - Every set of posts or ads carries the same one or two declared assets in the first frame or slide while angles vary. *(strategic_preference)*
  - Video ads make the business identifiable early (asset in frame 1 or name on screen) and again later; a hook-first opening is fine if branding sits inside it. *(contextual_heuristic)*
  - No logo, pack or colour change without a recorded reason and a re-education plan. *(contextual_heuristic)*
  - Never imitate a competitor's distinctive assets (trade-dress risk). *(external_requirement)*
  - Fame and uniqueness computed in code with n shown. *(missing_prerequisite)*
- **Relation to existing:** contradicts [meta-ads](../../../../skills/meta-ads/SKILL.md) lines 42, 55, 93, 114, [instagram-posts](../../../../skills/instagram-posts/SKILL.md) line 104 and [social-visual-briefs](../../../../skills/social-visual-briefs/SKILL.md) line 52. Proposed: version those skills (v2) with the synthesis below; no new skill. A warn-level lint could sit in [lint.ts](../../../../shared/agents/lint.ts).
- **Sources:** BK11-F23 (pp.105–111 (87–93)), F24 (pp.115–126 (97–108)), F25 (pp.123–124), F26 (pp.111–115), F39 (pp.187–188), F43.

### BK11-K4 Reach-first media for a small budget

- **Decision:** how to spend limited paid or owned media on reach versus frequency, burst versus continuity, which platform to add, and where.
- **Applies when:** consumer, local, hospitality, consumer apps with physical availability in the area and a working conversion path. **Not when:** capacity-bound; tiny budget with strong existing search demand (capture first); regulated categories with targeting limits.
- **Evidence needed:** platform unique reach and frequency for the area; approved monthly budget; where the business can deliver; peak-season share of sales.
- **Missing data:** no reach data → platform estimate, labelled; no budget → owned reach (storefront, vehicle, packaging, Google Business Profile, partners, flyers).
- **Branches and steps:**
  1. Compute the response rate needed for the target at each reach level: target ÷ (category buyers × reach), in code.
  2. Broad targeting within the area; watch frequency against unique reach.
  3. Frequency rising while reach plateaus → widen within the area, add a different media family, or hold budget.
  4. Highly seasonal → a seasonal burst is acceptable; otherwise continuous lower weight.
  5. Second platform only with a stated reason it reaches different people; prefer a different media family.
  6. B2B with a listed target set → reach = share of listed decision-makers reached per period.
- **Cash / labour / capability / measurement:** any budget within approved caps / setup plus a weekly check / ad account with reach reporting / reach, frequency, cost per 1,000 reached, sales versus baseline.
- **Metrics:** unique reach in area; average frequency; cost per 1,000 reached; sales or inquiries versus baseline.
- **Guardrails:** no minimum-frequency-of-three planning; don't trade reach for "engagement" without comparing cost per category buyer reached; external actions need owner approval; respect special ad category and geographic rules (verify current platform policy before execution).
- **Stop/review:** weekly frequency versus reach; quarterly sales versus baseline; stop a channel whose reach is mostly duplicated.
- **Alternatives:** demand capture first where search demand exists (Book 10 economics-first test).
- **Author guidance:** reach is the primary media objective; the first exposure in a period does most work; bursts over-hit heavy media users; advertise where you sell; smaller platforms' audiences mostly also use the big ones; formats that make people work for exposure reach mostly existing heavy buyers.
- **Interpretation:** the reach arithmetic is simple and actionable through Meta's reach and frequency reports; the evidence is mostly TV and panels and ignores search demand capture.
- **Proposed ClimbOS rules:**
  - Paid social drafts for consumer and local businesses default to broad targeting within the service area unless eligibility, capacity or a listed B2B set requires narrowing. *(contextual_heuristic)*
  - When an owner proposes a low-reach tactic, show the required response rate computed in code. *(missing_prerequisite)*
  - Prefer continuous lower-weight presence to a single burst unless sales are highly seasonal. *(strategic_preference)*
  - A second similar social platform on a small budget is flagged without a stated reach reason. *(contextual_heuristic)*
  - Ad geography matches where the business can deliver. *(missing_prerequisite)*
- **Relation to existing:** extends [Book 10](../../../../docs/growth-intelligence/books/10_paid_media_cro.md) (lines 24, 66), [Book 09](../../../../docs/growth-intelligence/books/09_social_community.md) line 33, [growth-plays](../../../../skills/growth-plays/SKILL.md) line 119, [scoring.ts](../../../../shared/acquisition/scoring.ts) line 224, [BRP-12](../../blog-research/playbooks/BRP-12-paid-test-vs-scale.json).
- **Sources:** BK11-F12 (pp.29–30, 53–55), F14 (pp.57–59 (39–41)), F27 (p.129 (111)), F28 (pp.130–132), F29 (pp.130, 132–133), F30 (pp.133–142), F31 (pp.138–139).

### BK11-K5 Word of mouth and referral calibration

- **Decision:** how much growth to expect from word of mouth and referrals, how to read WOM, referral, review and NPS numbers, and how to respond to negative WOM.
- **Applies when:** any business with experienced customers. **Not when:** fewer than about 20 customers as the main engine.
- **Evidence needed:** "how did you hear" counts; referral counts and outcomes; customer base size; recent product, price or staff changes; review counts and ratings.
- **Missing data:** no source field → add one at intake first.
- **Branches and steps:**
  1. Count WOM and referral sources per 100 customers; small raw WOM is expected for a small base.
  2. New business → plan controllable reach; keep a referral moment as support.
  3. Negative WOM after a real change → fix the cause and respond; without a real change → respond, log, no strategy change.
  4. Label referred customers as partly non-incremental; ask "would you have bought anyway" or use a holdout where volume allows.
  5. WOM play → fresh stories worth retelling and a named share moment.
  6. Use NPS as satisfaction only; add lapsed-customer feedback.
- **Cash / labour / capability / measurement:** low / low / source capture and referral links / source field, referral attribution, reviews.
- **Metrics:** referral share of new customers; WOM per 100 customers; positive-to-negative ratio; referred-customer retention.
- **Guardrails:** no fake or undisclosed incentivised reviews or endorsements; NPS isn't WOM volume; not all referred customers are incremental.
- **Stop/review:** PB-referrals stop rule; review negative-WOM handling only after a real change.
- **Alternatives:** too few customers → borrow credibility (partners, creators) or build reach first.
- **Author guidance:** positive WOM is far more common than negative; volume tracks market share; most recipients were already likely buyers; givers' own memories are reinforced; new brands can't rely on WOM.
- **Interpretation:** public local reviews persist and are read by in-market searchers, so the book's view that negative WOM seldom deserves attention doesn't carry over to them.
- **Proposed ClimbOS rules:**
  - Under about 20 customers, referrals or WOM can't be the bankable play (matches PB-referrals). *(contextual_heuristic)*
  - Referral forecasts scale with the base and are labelled partly non-incremental. *(contextual_heuristic)*
  - One negative post or review triggers fix-and-respond, not a strategy change, unless it reflects a real change. *(contextual_heuristic)*
  - NPS isn't used as WOM volume. *(contextual_heuristic)*
  - Review and referral incentives follow platform rules and disclosure law; verify current rules before execution. *(external_requirement)*
- **Relation to existing:** extends PB-referrals and PB-local-listing in [contracts.ts](../../../../shared/playbooks/contracts.ts), [growth-plays](../../../../skills/growth-plays/SKILL.md) §5 and [Book 09](../../../../docs/growth-intelligence/books/09_social_community.md).
- **Sources:** BK11-F8 (p.44 (26)), F32 (pp.146–154 (128–136)), F33 (pp.154–160), F34 (pp.150–152, 160–162), F42.

### BK11-K6 Physical availability audit: presence, relevance, prominence

- **Decision:** where the business must be present to be bought, which formats, price points and payment options remove barriers, and how easy it is to find, before buying more demand.
- **Applies when:** almost every small business; most fixes are operational. **Not when:** capacity limits make more presence pointless; channel fees erase margin.
- **Evidence needed:** when and where category buyers buy; current hours, channels, booking and payment, service area; entry price and size options; findability on key searches and listings; channel of recent new customers.
- **Missing data:** no source data → add a "how did you book" field first.
- **Branches and steps:**
  1. Presence: list buying occasions and check coverage.
  2. Relevance: entry formats (trial size, intro session, monthly payment), price points, payment options.
  3. Prominence: findability in search, maps, marketplaces, listings; thumbnail legibility.
  4. Rank gaps by occasions lost and cost to fix; fix blocking gaps before a demand play.
  5. Advertising where the business can't sell → fix the overlap first.
  6. Plan to cut a channel (phone, branch, demo call) → first check how many new customers bought through it; separate sales channels from servicing channels.
  7. Online: add it by occasions covered and category comfort, starting with what suits delivery; choose the largest marketplaces first.
  8. Restricting availability to look exclusive → not supported; decide on channel economics.
- **Cash / labour / capability / measurement:** often free / 2–3 hours / booking, payment and listing tools / source channel, out-of-hours enquiries.
- **Metrics:** out-of-hours inquiry share; buying occasions covered; presence on key situation queries; cart or booking abandonment.
- **Guardrails:** each channel weighed against cost and margin; no sales-channel removal without source data; no scarcity tactics without evidence.
- **Stop/review:** after adding a channel, check whether it added new buyers or moved existing ones.
- **Alternatives:** margin calculator in [decisions.ts](../../../../shared/analysis/decisions.ts) for fee-heavy channels.
- **Author guidance:** physical availability has three parts (being where buying happens, being buyable, being easy to find); mental and physical availability must overlap; shoppers add channels rather than switch.
- **Reported example:** a 2013 consultancy report cited by the authors found bank branches still drove most new account openings across many countries (dated).
- **Interpretation:** the most directly actionable framework in Part 2; it gives a principled reason to fix availability before adding demand.
- **Proposed ClimbOS rules:**
  - Before a demand play, run the three-part availability check and fix blocking gaps. *(contextual_heuristic)*
  - Don't remove a channel new customers buy through without source data. *(contextual_heuristic)*
  - Don't recommend restricted distribution for exclusivity. *(strategic_preference)*
  - Add online by occasions covered and economics. *(economic_feasibility)*
- **Relation to existing:** extends PB-local-listing, [conversion-audit](../../../../skills/conversion-audit/SKILL.md), [Book 10](../../../../docs/growth-intelligence/books/10_paid_media_cro.md) line 22 (operational readiness) and the demand branch of [diagnosis.ts](../../../../shared/agents/diagnosis.ts) line 137.
- **Sources:** BK11-F35 (pp.163–166 (145–148)), F36 (pp.168–182), F37 (pp.182–183), F38 (pp.184–186), F39, F40 (pp.195–204), F41 (pp.194–195, 202–203), F45 (pp.222–239), F46.

### BK11-K7 Two-stage launch

- **Decision:** how to launch a new brand, location, line or variant so it wins first sales, then keeps recruiting medium and light buyers; how much cannibalisation is normal.
- **Applies when:** the offer has been tested with buyers. **Not when:** product-market fit isn't evidenced (validate first); products needing demonstration, where demos and WOM matter more.
- **Evidence needed:** launch budget by month; distribution or stock commitments; evidence the offer works; overlap with the parent's buyers; non-repeat reasons gathered neutrally.
- **Missing data:** no overlap data → skip the cannibalisation benchmark; track total sales across parent and variant.
- **Branches and steps:**
  1. Stage 1: wide reach for first sales and distribution; heavy category buyers respond first without targeting.
  2. Stage 2: stay present for medium and light buyers.
  3. Priority memories: what it is, how it looks, where to buy; name clear and early.
  4. Lead with common situations; borrow existing cultural or category cues.
  5. Low early repeat → expected; check withdrawn promotion or availability before cutting support.
  6. Overlap with the parent about 10 points above comparable offers → flag excess cannibalisation; fix by widening the variant's distribution and memory links, unless blocking a competitor is the aim.
- **Cash / labour / capability / measurement:** enough to stay present after launch week / launch plus ongoing content / clear branding and listing / first-time buyers per month, quarterly repeat, rejection reasons, overlap.
- **Metrics:** first-time buyers per month; repeat by quarter; overlap versus benchmark; rejection reasons.
- **Guardrails:** influencers aren't the main mechanism; no differentiation lead before the category is clear; low early repeat isn't rejection without evidence.
- **Stop/review:** after one and two quarters.
- **Alternatives:** validation playbooks PB-concierge and PB-interviews.
- **Author guidance:** new brands settle to normal metrics for their share quickly and grow through penetration; first buyers know little about the brand; continuity after launch matters.
- **Interpretation:** the priority-memory rule agrees with Dunford's category-first homepage hierarchy in BK03.
- **Proposed ClimbOS rules:**
  - Launch plans keep presence for at least three months after launch week (ClimbOS policy, not from the book). *(strategic_preference)*
  - Launch messaging states category, name, look and where to buy before any differentiation claim. *(contextual_heuristic)*
  - Flag cannibalisation only at about 10 points above comparable sharing. *(contextual_heuristic)*
  - Low early repeat is labelled expected and investigated neutrally first. *(contextual_heuristic)*
  - No fit evidence → validation first. *(missing_prerequisite)*
- **Relation to existing:** extends [positioning](../../../../skills/positioning/SKILL.md) line 38 and [BK03](../../../../docs/growth-engine/book-review/BK03.md); [Book 04](../../../../docs/growth-intelligence/books/04_gtm_launches.md) not cross-checked in this pass.
- **Sources:** BK11-F16 (pp.70–78), F34, F42 (pp.207–212 (189–194)), F43 (pp.213–220 (195–202)), F44 (pp.213–214).

### BK11-K8 Where new customers come from

- **Decision:** which competitors the business mostly wins from and loses to, whether a sub-market locks it out, and whether its customer profile shows a restriction.
- **Applies when:** growing or established businesses with an intake step. **Not when:** the main alternative is DIY or doing nothing (use Dunford's alternatives).
- **Evidence needed:** source of business at intake (previous provider, who else they called); lost-deal destinations; rough competitor size proxies (low confidence); customer profile versus the category.
- **Missing data:** reviews and sales notes mentioning previous providers, labelled anecdotal.
- **Branches and steps:**
  1. Add a source-of-business field; tally against rough competitor size.
  2. Switching in line with size → normal; expect most switchers from the biggest rivals.
  3. Two-sided excess sharing with one rival (about 10 points) → possible partition; check for a missing variant or format.
  4. One-sided excess → check availability gaps first.
  5. Skewed customer profile → check location, price, variant and channel restrictions before positioning explanations.
- **Cash / labour / capability / measurement:** none / low once the field exists / intake form or CRM field / source answers.
- **Metrics:** new customers by previous provider; lost deals by destination; deviation from size-proportional expectation.
- **Guardrails:** no strategy around one rival from a handful of anecdotes; no competitor shares without a source.
- **Stop/review:** re-tally quarterly.
- **Alternatives:** comparison-page priorities from the tally.
- **Author guidance:** competing brands sell to similar customer profiles; larger profile gaps in banking had functional causes; local brands aren't a separate sub-market.
- **Interpretation:** an intake field approximates the duplication question without panel data.
- **Proposed ClimbOS rules:**
  - Teardowns default to size-proportional competition and flag a closest rival only with switching evidence. *(contextual_heuristic)*
  - Source of business is a standard intake field. *(missing_prerequisite)*
  - A skewed profile is checked for restrictions before positioning explanations. *(contextual_heuristic)*
- **Relation to existing:** extends [competitor-teardown](../../../../skills/competitor-teardown/SKILL.md), [positioning](../../../../skills/positioning/SKILL.md) (alternatives) and PB-comparison-page.
- **Sources:** BK11-F12, F15 (pp.62–66 (44–48)), F16 (pp.70–78 (52–60)), F17 (pp.78–79 (60–61)).

## Dated benchmarks (context only, never thresholds)

| Figure | Value | Context and date | Locator |
|---|---|---|---|
| Top 20% of buyers' share of sales | about 40–60%; emerging-market table average about 53% | Repeat consumer categories | BK11-F10, PDF pp.48–49 |
| Top-20% buyers still top next period | about half; Malaysian averages about 39% (soap), 48% (noodles) | Panel data; rows OCR'd unreliably | BK11-F11, pp.49–52 |
| Business-client defection beyond marketers' influence | about 60%; service issue 4% | One study, 2009 | BK11-F7, pp.42–43 |
| Associations by user status | about 48% current, 19% former, 10% never | Cross-study average | BK11-F18, pp.82–84 |
| Brands deviating >10 points on any profile trait | 2.5% | Fast food, 11 emerging markets | BK11-F15, pp.62–66 |
| Positive versus negative WOM | about 3:1 (range 2–5) | Mostly conversational WOM | BK11-F32, pp.146–154 |
| WOM from close ties | 85% | China survey, 2014 | BK11-F32 |
| Positive WOM lift | +0.9 points average; 63% of recipients already at 70%+ | US cars, self-reported | BK11-F33, pp.154–160 |
| Reach worked example | 1,000 people × 60% × 5% = 30 sales | Illustrative | BK11-F27, p.129 |
| Online versus offline share loyalty | dog food 21% offline, 33% online | UK, 2013 | BK11-F40, pp.195–204 |
| Time per online purchase | over half take about 13 seconds | UK/US grocery panels, 2013–14 | BK11-F40 |
| Channel share loyalty | about 30% | Four emerging markets, 2012–14 | BK11-F36 |
| Top reach touch-points | pack, TV, flyers above digital | One personal-care category, 2012 | BK11-F31 |
| Luxury awareness–ownership correlation | about 0.9 | Online samples, 2015 | BK11-F45 |

## Disagreements and what decides

| Topic | BK11 says | Existing library says | What decides |
|---|---|---|---|
| Niche positioning (Dunford) | Target the whole category; niche brands have limited potential | [BK03](../../../../docs/growth-engine/book-review/BK03.md) rule 2 (Big Fish default); [positioning](../../../../skills/positioning/SKILL.md) lines 38 and 70; [Guide 03](../../guides/03_positioning.md) starts from a candidate segment | Capacity and scale goal. A niche can fill a capacity-limited service; it caps a scalable consumer product. Proposed: separate who the message speaks to from who media reaches |
| Parity attributes | Big brands link to many common, often generic situations | [positioning](../../../../skills/positioning/SKILL.md) lines 29 and 79 delete or ban parity | Buying mode: memory-driven choice favours situation breadth; deliberate comparison favours differentiation. Swap test still applies to branding |
| Early branding | Brand recognisable early and identical across executions | [meta-ads](../../../../skills/meta-ads/SKILL.md), [instagram-posts](../../../../skills/instagram-posts/SKILL.md), [social-visual-briefs](../../../../skills/social-visual-briefs/SKILL.md) push branding late or small | Synthesis: first-frame content varies, identity cues stay constant, name early without "Introducing". Correct-branding recall would settle it; rarely measurable for small advertisers |
| Narrow test versus reach | Don't target narrower than category buyers | [Book 10](../../../../docs/growth-intelligence/books/10_paid_media_cro.md) lines 24, 66: one tight hypothesis; breadth is testable | Business type and horizon; holdout or geo test at scale; otherwise show both, labelled |
| Problem territories | Breadth of situations; effortful formats reach heavy buyers | [Book 09](../../../../docs/growth-intelligence/books/09_social_community.md) line 37: a small set of territories | Compatible if territories rotate as situations |
| Prefer valuable customers | Heavy-buyer fallacy | [growth-plays](../../../../skills/growth-plays/SKILL.md) line 130 | Payback in [calc.ts](../../../../shared/growth/calc.ts): if cheap customers can't pay back, value-targeting wins |
| Retention binds | Higher churn is normal for small brands | [diagnosis.ts](../../../../shared/agents/diagnosis.ts) line 131 | Not contradicted for SaaS with real leaks; add the size-normal explanation for consumer repeat types |
| Negative WOM | Rarely worth attention | Local review work (PB-local-listing) | Reviewer disagrees with the book: public persistent reviews reach in-market buyers; keep review work |
| Evidence limits | Claims reach B2B, services, emerging markets | Owner decision: heuristic outside consumer repeat | B2B support is two tables; emerging-market data mostly urban online panels; launch advice assumes a tested product; search capture not discussed |

## Not processed or uncertain

- Per-row table and chart values (garbled OCR); check the scan if exact figures matter.
- PDF pp.3, 4 and 252 returned no text.
- The book gives no minimum survey size or situation count; every ClimbOS threshold here (20 customers, 3 months, 10 points as a flag) is labelled policy or rule of thumb.
- [Book 04](../../../../docs/growth-intelligence/books/04_gtm_launches.md) and the Part 1 reading were not cross-checked by the original reviewer; see [BK10](BK10_how_brands_grow.md) for Part 1.
- Online and platform findings date from 2013–15.
