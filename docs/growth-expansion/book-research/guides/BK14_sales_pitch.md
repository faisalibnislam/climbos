# BK14 guide: Sales Pitch (April Dunford)

Edition 2026-10-20 · status: proposed reference · not authorization for external actions

## Source

| Field | Value |
|---|---|
| Title | Sales Pitch (any subtitle appears only on the cover image and is not recorded) |
| Author | April Dunford |
| Publisher | Ambient Press per the copyright page (the OPF metadata lists April Dunford) |
| Year | 2023 (OPF date 2023-08-28) |
| ISBN | 9781999023034 (ebook); paperback 9781999023027 |
| Format | EPUB, `docs/reference-books/Sales_Pitch_-_April_Dunford.epub`; edition not stated |
| Extraction quality | Good. All 20 chapters, introduction and conclusion extracted as clean text. Figures 1–3 and diagram images not extractable. The chapter 11 pros/cons table extracts with duplicated cells but is readable; pull quotes lose some spaces |
| Watermark | OceanofPDF marks present: an oceanofpdf.com file in the archive and an "OceanofPDF.com" line at the end of every section |
| Coverage | **Read:** copyright, contents, introduction, chapters 1–20, conclusion, "how to learn more" and author page. **Skipped:** cover, title, half-title, praise, dedication and part dividers (non-substantive or image-only). **Unreadable:** figures and diagrams |

Locators use `OEBPS/<file>.xhtml [element range]` from `epub_full.py`.

## Use this guide for

- Deciding **whether a pitch storyboard fits** the purchase at all.
- Checking **positioning is ready** before building a pitch, and mapping it to pitch steps.
- Structuring a **first sales conversation**: opening frame, alternatives, fit check, demo, proof, objections, next step.
- **Testing and rolling out** a pitch in a founder-led business.
- Diagnosing pipelines that stall in **no decision**.
- Reusing the pitch story on **homepages, explainers, buyer's guides and onboarding**.

Business types: B2B SaaS, developer tools, agencies, consulting, professional services; high-ticket local or consumer jobs only in compressed form. Stages: pre-launch (thesis positioning) through established sales teams.

## Versioning against *Obviously Awesome* (BK03)

Compare with [BK03 review](../../../../docs/growth-engine/book-review/BK03.md) and [03 positioning guide](../../guides/03_positioning.md).

| Repeated (version, don't duplicate) | New in Sales Pitch |
|---|---|
| Five positioning components and their order; the so-what chain from feature to value | Considered vs unconsidered purchases; buying is hard for first-time buyers |
| Status quo counts as a competitive alternative | "No decision" as the main rival, driven by fear; don't add options |
| Only shortlisted competitors matter | Alternatives grouped into approaches with pros and cons; rules for naming rivals |
| Value grouped into themes (now three or fewer; BK03 notes allowed one to four) | Insight derived backwards from differentiated value, not from a trend |
| Thesis positioning before patterns appear; periodic review | Perfect-world agreement check as a fit test |
| Sales story order sketched in OA's final chapter | Full eight-step storyboard, timing, demo vs slides |
| Cross-functional positioning team | Pitch to the champion first; multi-product "what do we pitch" decision |
| Optional trend component | Dropped; trend-as-insight named as a common mistake |
| — | Table-stakes items handled as objections; don't raise objections you can't answer |
| — | Pitch pilot with one rep, rollout, ownership, recertification |
| — | Reuse map across marketing and product assets |

**Interpretation:** BK14 versions BK03's sales-story sketch into a full method. The positioning content repeats BK03 and should not be stored twice; add only the mapping and the new decision rules as a v2 section.

---

## BK14-K1 Pitch applicability gate (considered vs unconsidered purchase)

- **Decision:** build a full storyboard, a compressed "help them choose" version, or none.
- **Applies when:** a sales conversation exists (call, demo, consult, site visit) or buyers study a long page or video. **Not when:** low-price, immediate, single-buyer or habitual purchases.
- **Evidence needed:** sales motion, sales cycle, order size, number of people deciding, alternatives buyers actually shortlist.
- **Missing data:** default to no storyboard and say why; the owner can override.
- **Branches:**
  - **Author guidance:** considered purchases carry real downside, research and several people; unconsidered ones are low-stakes and picked from what's in front of the buyer.
  - **Author guidance:** problem/solution suits a landscape where the status quo is the only rival; a product walkthrough suits expert buyers whose status quo closely resembles the product.
  - **Reported example:** the author's own bathroom-fixture purchase stalled under a feature-led pitch and closed quickly once a rep taught three choice criteria and gave an honest recommendation.
  - **Interpretation:** for local services, urgent or low-ticket phone jobs need fast answers on price, timing and next step; high-ticket considered jobs (renovation, legal, financial planning) get a compressed guide: two or three criteria, when the cheaper option is fine, an honest pick, one next step.
- **Steps:** read motion, cycle, order size, decision group → classify → choose full, compressed or none → record the reason.
- **Cash / labour / capability / measurement:** none; rep or owner call time; someone who can guide a conversation; nothing to measure for the decision.
- **Metrics:** share of sales conversations ending with an agreed next step.
- **Guardrails:** the gate is a preference, not a hard block.
- **Stop / review:** price, motion or buying group changes.
- **Alternatives:** no sales conversation → carry insight and value themes into a page or buyer's guide (K7).
- **Rule classes:**
  - **Proposed ClimbOS rule:** generate a storyboard only for sales-assisted or sales-led motions, medium or long cycles, or high order values; otherwise skip and explain. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** local services get the compressed form only for high-ticket considered jobs. *(strategic_preference)*
- **Relation to existing:** versions the pitch step in [positioning](../../../../skills/positioning/SKILL.md), which writes a pitch for every business including B2C and local; versions [strategy-positioning](../../../../docs/research/strategy-positioning.md) and the motion ladder in [Book 11 §1](../../../../docs/growth-intelligence/books/11_sales_partnerships.md). Gate inputs exist in [scoring.ts](../../../../shared/acquisition/scoring.ts).
- **Sources:** BK14-F1 Chapter1 [31]–[37]; BK14-F2 Chapter1 [42]–[81]; BK14-F10 Chapter4 [21]–[144]; BK14-F31 Chapter17 [60]–[109].

## BK14-K2 Positioning prerequisites and positioning-to-pitch mapping

- **Decision:** is positioning ready to pitch from; what is pitched, to whom; which component feeds each step.
- **Applies when:** K1 passes. **Not when:** alternatives, differentiated value or best-fit customers are undefined; repair positioning first.
- **Evidence needed:** the five components with evidence; shortlists from real deals; who sits in the first call.
- **Missing data:** no customers → label the pitch a positioning thesis and plan validation with first buyers.
- **Branches:**
  - **Author guidance:** weak positioning gives a weak pitch; work the five components in order first.
  - **Author guidance:** pre-launch positioning is a loose thesis; review positioning a couple of times a year.
  - **Author guidance:** multi-product firms decide whether call one pitches the company or a lead product.
  - **Author guidance:** tune the pitch to the champion and arm them for the economic buyer, users, IT, legal and purchasing.
  - **Author guidance:** leave out rivals that never reach shortlists.
  - **Author guidance (mapping):** insight comes from value plus best-fit; alternatives from alternatives; perfect world from value; introduction from category; the value step from value plus capabilities; proof from proof. Objections and the ask come from sales experience.
- **Steps:** check each component → map to pitch steps → take objections and ask from sales history → name audience and pitched unit → set review triggers.
- **Cash / labour / capability / measurement:** none; owner plus anyone who talks to customers; positioning skill output; last deals and their shortlists.
- **Metrics:** components evidenced vs hypothesis; share of deals where pitched alternatives matched the real shortlist.
- **Guardrails:** no pitch claim without a positioning component behind it.
- **Stop / review:** a new shortlisted competitor, capability change or buyer change invalidates the pitch version.
- **Alternatives:** no customers → broad thesis plus wide exposure, as in BK03's exploration mode.
- **Rule classes:**
  - **Proposed ClimbOS rule:** a pitch references a positioning version; when the version changes, the pitch is marked stale. *(missing_prerequisite)*
  - **Proposed ClimbOS rule:** cap value themes at three in pitch and messaging outputs. *(contextual_heuristic)*
- **Relation to existing:** versions [03 positioning](../../guides/03_positioning.md) (add a "from position to pitch" v2 section) and [BK03](../../../../docs/growth-engine/book-review/BK03.md); duplicates BK03 on the components. The statement-centred output in [positioning](../../../../skills/positioning/SKILL.md) and [specs.ts](../../../../shared/agents/specs.ts) stays an internal summary only.
- **Sources:** BK14-F13 Chapter7 [21]–[120]; BK14-F14 Chapter8 [27]–[85]; BK14-F15 Chapter8 [91]–[137]; BK14-F16 Chapter8 [138]–[171]; BK14-F17 Chapter9 [25]–[34].

## BK14-K3 The setup: insight, alternatives as approaches, perfect-world agreement

- **Decision:** how to open so the market frame points at the firm's differentiated value, and whether the prospect fits.
- **Applies when:** K2 passes and the prospect is qualified. **Not when:** the landscape is very limited; compress to insight then perfect world.
- **Evidence needed:** value themes; best-fit traits; real alternatives with evidence for pros and cons.
- **Missing data:** a con about a named rival with no evidence → write it as an approach-level trade-off with a source, or mark it as needing a fact.
- **Branches:**
  - **Author guidance:** the insight is the hidden problem a best-fit buyer must grasp to see why your value matters; derive it from the value; keep it to about a slide and a minute or two; never skip it.
  - **Author guidance:** group rivals into approaches, give pros and cons for this buyer, and run discovery here as a two-way conversation.
  - **Author guidance:** name a rival only if the prospect has likely seen it or it appears in nearly every deal; classify honestly, never falsely; don't introduce options buyers hadn't considered.
  - **Author guidance:** the perfect world states purchase criteria and ends with an agreement check; disagreement usually means the prospect has ruled themselves out. The setup typically runs five to ten minutes.
- **Steps:** one insight from value and best-fit → 2–5 approaches including the status quo → short pros and cons → discovery questions → criteria mapped to value themes → agreement check.
- **Cash / labour / capability / measurement:** none; drafting and call time; honest knowledge of rival approaches; notes on agreement or disagreement.
- **Metrics:** setup minutes over call minutes; share of calls with agreed criteria; share of disagreements later judged bad-fit.
- **Guardrails:** every claim about an alternative needs evidence; no invented research behind the insight.
- **Stop / review:** prospects don't recognise their situation → rewrite approaches; good-fit prospects disagree → back to K2.
- **Alternatives:** no live calls → place insight and approaches on a long-form page or buyer's guide.
- **Interpretation:** the agreement check turns the pitch into a fit test; it is the most useful new decision rule.
- **Rule classes:**
  - **Proposed ClimbOS rule:** flag an insight that would read the same for the top competitor, or that matches a generic-trend pattern. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** claims about a named competitor's limits need cited evidence. *(external_requirement)*
  - **Proposed ClimbOS rule:** each perfect-world criterion maps to a value theme; unmapped ones drop. *(strategic_preference)*
  - **Proposed ClimbOS rule:** warn when setup exceeds about a fifth of first-call time. *(contextual_heuristic)*
- **Relation to existing:** versions [positioning](../../../../skills/positioning/SKILL.md) and the B2B order in [landing-pages](../../../../skills/landing-pages/SKILL.md), both of which define the insight as what changed; versions [strategy-positioning](../../../../docs/research/strategy-positioning.md) and [Book 11 §3](../../../../docs/growth-intelligence/books/11_sales_partnerships.md). Competitor-limit claims are not yet covered by [lint.ts](../../../../shared/agents/lint.ts).
- **Sources:** BK14-F6 Chapter2 [36]–[44]; BK14-F7 Chapter2 [55]–[98]; BK14-F18 Chapter10 [18]–[112]; BK14-F19 Chapter11 [20]–[165]; BK14-F20 Chapter12 [22]–[56]; BK14-F29 Chapter19 [70]–[122].

## BK14-K4 The follow-through: introduction, value-led demo, matched proof, objections, ask

- **Decision:** how to show the product, prove it, pre-empt worry and pick the next step.
- **Applies when:** K3 done; confirmed facts exist for timelines, certifications and integrations. **Not when:** a buyer arrives with tested requirements (RFP, prior trial); then tailor, still covering differentiators.
- **Evidence needed:** value themes and the features behind each; proof tagged by industry, role and starting status quo; unspoken objections from lost or stalled deals.
- **Missing data:** no proof yet → demo the mechanism, offer a pilot as the ask, mark proof as needing a fact.
- **Branches:**
  - **Author guidance:** introduce briefly with the category; use family, platform or architecture diagrams for multi-product, platform or infrastructure offers.
  - **Author guidance:** spend most of the call on value, demoed theme by theme, not as a walkthrough; slides are fine for infrastructure; mark what's outside the base product.
  - **Author guidance:** things every vendor must have (a security certification, a standard integration) aren't differentiators; handle them as objections.
  - **Author guidance:** your own statement isn't proof; match proof to the prospect's industry, role and status quo.
  - **Author guidance:** raise common unspoken worries proactively (deployment, cost, adoption) with specific timelines; don't raise one you can't answer, and treat it as something to fix.
  - **Author guidance:** end with one clear, easy next step; poor fits get a clear exit.
- **Steps:** one-line introduction → up to three value themes (claim, features, demo or slide) → matched proof per theme → optional 1–3 objections → one ask.
- **Cash / labour / capability / measurement:** none; demo prep; a demo environment or screenshots; next-step agreement per call.
- **Metrics:** first calls with an agreed next step; bad-fit prospects exiting at call one.
- **Guardrails:** deployment times, certifications and customer names only from confirmed facts.
- **Stop / review:** next-step agreement stays low after the pilot → simplify the ask before rewriting the story.
- **Rule classes:**
  - **Proposed ClimbOS rule:** a theme every shortlisted alternative also delivers moves to objections or parity notes. *(strategic_preference)*
  - **Proposed ClimbOS rule:** every pitch output ends with exactly one primary next step. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** certification and deployment-time statements pass the claim lint. *(external_requirement)*
- **Relation to existing:** extends [sales-follow-up](../../../../skills/sales-follow-up/SKILL.md) and [Book 11 §5](../../../../docs/growth-intelligence/books/11_sales_partnerships.md); adds the missing introduction and objection steps to [positioning](../../../../skills/positioning/SKILL.md); claim checks in [lint.ts](../../../../shared/agents/lint.ts).
- **Sources:** BK14-F8 Chapter3 [23]–[61]; BK14-F9 Chapter3 [63]–[92]; BK14-F21 Chapter13 [20]–[50]; BK14-F22 Chapter14 [22]–[84]; BK14-F23 Chapter15 [20]–[71]; BK14-F24 Chapter16 [20]–[102]; BK14-F25 Chapter17 [20]–[54].

## BK14-K5 Pitch pilot, rollout and upkeep (founder-led adaptation)

- **Decision:** when a new pitch is good enough to adopt, and how to stop it drifting.
- **Applies when:** a storyboard has become a deck, demo and script. **Not when:** no qualified calls yet; test insight and criteria in interviews (PB-interviews) instead.
- **Evidence needed:** qualified first calls per week; the old pitch; call notes or consented recordings.
- **Missing data:** low volume → qualitative pass/fail plus leading indicators, labelled observational.
- **Branches:**
  - **Author guidance:** pilot with one respected rep on real qualified prospects; builders listen and debrief each call; allow only small wording fixes.
  - **Author guidance:** pass when the tester stops wanting changes and prefers the new pitch; fail when the best rep still prefers the old one after several uses; usual causes are sales not involved or weak positioning.
  - **Author guidance:** results show slowly: more progression and earlier exits of bad leads first, close rates later.
  - **Interpretation:** in founder-led sales the owner is the tester and ClimbOS supplies the debrief questions.
- **Steps:** pick tester → run on qualified calls → debrief where they lost interest, got excited, were confused → decide → roll out with a recorded pitch, practice and a check → name an owner, recheck on positioning change, recertify.
- **Cash / labour / capability / measurement:** none; listening and debrief time; consent if recording; per-call notes.
- **Metrics:** leading: progression to next step, early exit of bad fits; lagging: close rate, lead quality.
- **Guardrails:** recording needs consent; no close-rate "win" without an adequate sample (`sampleSize`).
- **Stop / review:** fail criteria; positioning version change.
- **Rule classes:**
  - **Proposed ClimbOS rule:** when computed weeks to a readable result exceed 12 at the owner's call volume, present the test as a qualitative pilot, not an A/B test. *(economic_feasibility)*
  - **Proposed ClimbOS rule:** each pilot logs per-call debrief answers and the next-step outcome. *(contextual_heuristic)*
- **Relation to existing:** new; uses [decisions.ts](../../../../shared/analysis/decisions.ts) and fits [06 experimentation](../../guides/06_experimentation.md) and [experiment-design](../../../../skills/experiment-design/SKILL.md).
- **Sources:** BK14-F26 Chapter18 [26]–[93]; BK14-F27 Chapter19 [24]–[67]; BK14-F28 Chapter19 [43]–[44]; BK14-F29 Chapter19 [70]–[122].

## BK14-K6 "Do nothing" as the main competitor

- **Decision:** what a stalled or lost pipeline is losing to, and what the pitch must compete against.
- **Applies when:** considered sales with a deal record (even a short owner list). **Not when:** unconsidered purchases (K1).
- **Evidence needed:** closed opportunities coded won, lost to a rival, no decision, disqualified; what the buyer used before.
- **Missing data:** no history → ask the owner for the last five who didn't buy and why; under about ten deals → shares are directional.
- **Branches:**
  - **Author guidance:** always position against the status quo, including the case for change; fear of a wrong choice is the dominant emotion in business buying.
  - **Author guidance:** buyers ask why you over the alternatives, and want help understanding options and pitfalls.
  - High no-decision share → work on confidence (criteria, proof, deployment answers, a smaller first step), not on attacking rivals or cutting price.
  - Losses mostly to one rival → name it and sharpen the value against it.
- **Steps:** code each closed deal → compute no-decision share and decided win rate in code → name the status quo → add a case for change.
- **Cash / labour / capability / measurement:** none; coding past deals; deal outcome codes.
- **Metrics:** no-decision share of closed deals; win rate among decided deals.
- **Guardrails:** the cited no-decision range is a dated secondhand figure, never a reference range.
- **Stop / review:** re-code quarterly.
- **Rule classes:**
  - **Proposed ClimbOS rule:** add optional deal-outcome counts to owner inputs; compute shares deterministically. *(missing_prerequisite)*
  - **Proposed ClimbOS rule:** never use the book's cited range as a diagnosis benchmark. *(contextual_heuristic)*
- **Relation to existing:** extends [Book 11](../../../../docs/growth-intelligence/books/11_sales_partnerships.md) §4 and §13, [positioning](../../../../skills/positioning/SKILL.md), [voc-research](../../../../skills/voc-research/SKILL.md); needs sales-stage fields in [diagnosis.ts](../../../../shared/agents/diagnosis.ts). Rule on reference ranges follows [base-rates](../../../../skills/growth-plays/reference/base-rates.md).
- **Sources:** BK14-F3 Chapter1 [120]–[133]; BK14-F4 Chapter1 [133]–[141]; BK14-F5 Chapter2 [26]–[31]; BK14-F19 Chapter11 [20]–[165].

## BK14-K7 Reusing the pitch story beyond sales calls

- **Decision:** which assets carry which parts of the pitch.
- **Applies when:** an approved storyboard exists. **Not when:** K1 says no storyboard; use offer and proof copy.
- **Evidence needed:** the pitch version; who uses vs who buys; publishing permission per channel.
- **Missing data:** no publishing permission → drafts only.
- **Branches:**
  - **Author guidance:** homepages lead with category, value themes and proof and needn't follow the story.
  - **Author guidance:** explainer videos can run the whole arc; buyer's guides turn the insight and approaches into a criteria checklist and signal active shopping.
  - **Author guidance:** product-led onboarding should surface differentiated value; end-user and buyer stories may differ.
  - **Author guidance:** talks, research and books carry the insight, not the pitch.
- **Steps:** pick asset → pick the parts it needs → keep all on one version → run claims through the lint → owner approves before publishing.
- **Cash / labour / capability / measurement:** low, video extra; writing time; owner publishing access; guide downloads that become calls, onboarding reaching first value.
- **Metrics:** guide download-to-qualified-call rate; activation to first value.
- **Guardrails:** owner approval before publishing; guide comparisons follow the same evidence rule; consent before nurturing guide leads.
- **Stop / review:** positioning version change invalidates derived assets.
- **Alternatives:** no video budget → a long-form page section in the same order.
- **Rule classes:**
  - **Proposed ClimbOS rule:** homepage briefs use category, up to three themes and proof; full order only for long-form pages, explainers and buyer's guides. *(strategic_preference)*
  - **Proposed ClimbOS rule:** add the buyer's guide as a lead-magnet type for considered B2B purchases. *(contextual_heuristic)*
- **Relation to existing:** versions [landing-pages](../../../../skills/landing-pages/SKILL.md) and [lead-magnets](../../../../skills/lead-magnets/SKILL.md); extends the one-version rule at the end of [03 positioning](../../guides/03_positioning.md); onboarding via [lifecycle-email](../../../../skills/lifecycle-email/SKILL.md).
- **Sources:** BK14-F30 Chapter20 [21]–[90]; BK14-F31 Chapter12 [62]–[147], Chapter14 [91]–[153].

---

## Dated benchmarks and reported uplifts

Context only. Never forecasts, targets or thresholds.

| Item | Value as reported | Type | Locator | Caveat |
|---|---|---|---|---|
| Purchases ending in no decision | 40–60% | Secondhand (Dixon & McKenna, 2022) | Chapter1 [120]–[133] | Vendor-research B2B sample; not verifiable here |
| What buyers valued in reps | Teaching ranked highest | Secondhand (*The Challenger Sale*, 2011) | Chapter2 [26]–[31] | 2011 research |
| Method origin | Start-up revenue on a path to double within months; company later acquired | Reported example | Chapter5 [53]–[88] | Self-reported, no comparison |
| Author's base | 200+ pitches using the structure | Author statement | Chapter5 [53]–[88] | Practice, not a study |
| Setup length | Five to ten minutes typical; mistakes range from 90 seconds to 10 minutes in a 30–60 minute call | Author guidance | Chapter12 [22]–[56]; Chapter19 [70]–[122] | Heuristic |
| Client cases (Help Scout, LevelJump, Postman, Funnel, Gearset) | Company claims such as user and deployment counts | Reported examples | Chapter2 [55]–[98]; Chapter12; Chapter14; Chapter17 | Figures as of about 2022–23 |

## Disagreements and what decides

| Topic | Sales Pitch | Existing ClimbOS | What decides |
|---|---|---|---|
| Insight definition | Derived from differentiated value; trend openers named as a mistake | [positioning](../../../../skills/positioning/SKILL.md) and [landing-pages](../../../../skills/landing-pages/SKILL.md) define it as what changed | Present-tense purchase with a shortlist → Dunford; investor or category-creation content → a shift narrative is acceptable |
| Who gets a pitch | Considered purchases | Positioning skill writes one for every business, with a local example | Purchase stakes and decision group, not business label |
| Vision narratives | Suit investors; give buyers reasons to wait | [strategy-positioning](../../../../docs/research/strategy-positioning.md) lists a "name the shift" narrative for decks | Audience: investors vs buyers |
| First-call demo | Show your best value, customise in call two | [Book 11 §5](../../../../docs/growth-intelligence/books/11_sales_partnerships.md) tailors to the buyer's priority task | First-time unsure buyer → Dunford; buyer with tested requirements → tailor |
| Discovery | Seller teaches as well as asks | Book 11 §3 is buyer-led | Compatible: ask and teach |
| Positioning statement | Usable output is the story | [specs.ts](../../../../shared/agents/specs.ts) still centres a statement | Keep the statement as an internal summary only |
| Measured comparison | Expert judgement for long cycles | Experimentation guidance prefers measured reads | Computed sample size vs call volume |
| Trend reports as magnets | Insight-led research is useful | [lead-magnets](../../../../skills/lead-magnets/SKILL.md) avoids trend reports | Does the research test the insight with real data tied to the value? |
| Value-theme count | Three or fewer | BK03 notes allowed one to four | Use three as the cap in pitch outputs |

## Not processed or uncertain

- Figures 1–3 and diagrams unreadable; any content only in them is missing. Templates mentioned are on the author's site, not in the book.
- Subtitle not in text or metadata; recorded title is *Sales Pitch*.
- The 40–60% and Challenger findings are secondhand and dated.
- Evidence for the method is the author's practice; no controlled comparison.
- Local-service and consumer branches are ClimbOS inference beyond the book's B2B scope.
- Code and skill references were checked on 2026-10-20 and may move.
