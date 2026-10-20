# BK07 guide: 7 Powers (Helmer)

Edition 2026-10-20 · status: proposed reference · not authorization for external actions

Labels used throughout: **Author guidance** (what the book advises, paraphrased), **Reported example** (a case or figure the book reports), **Interpretation** (our reading for ClimbOS), **Proposed ClimbOS rule** (not yet in code or skills). Locators are EPUB file plus element range from `epub_full.py`. Finding ids (F1–F24) and framework ids (K1–K7) come from the BK07 reading record, which is not stored in the repo.

## Source

| Field | Value |
|---|---|
| Title | 7 Powers: The Foundations of Business Strategy |
| Author | Hamilton Helmer |
| Publisher, year | Deep Strategy LLC, 2016 (OPF date 2016-11-16); no edition statement |
| ISBN | 978-0-9981163-2-7 (Kindle), per copyright page text00002.html [15]–[17]; hardbound and paperback ISBNs also listed |
| Format | EPUB, `docs/reference-books/7_Powers_-_Hamilton_Helmer.epub` |
| Extraction quality | Good for prose. Every figure is missing (the summary chart, intensity tables, Power Progression charts, the Fig 9.7 histogram, investing charts) and so are the final margin equations after each appendix. Some paragraphs print twice. Note 44 refers to a "Chapter 10" that does not exist (it means Ch 9). |
| Watermark | OceanofPDF marks present: an "OceanofPDF.com" line at the end of each content file and an oceanofpdf.com file in the archive |

**Coverage**

| Status | Sections |
|---|---|
| Read | Copyright; Foreword; Introduction; Ch 1–9 (incl. Appendix 8.1, toolkit, glossary); Chapter Notes (notes 8, 10, 12, 40, 42, 43, 44, 72, 77, 89, 91, 100–103, 111, 112 used) |
| Skimmed | Acknowledgments |
| Skipped | Bibliography (list only); About the author; back cover |
| Unreadable | All figures and the appendix result equations (images not in the file) |

## Use this guide for

| Decision | Business types | Stages |
|---|---|---|
| Is the owner's edge durable, or copyable execution? | all | any with a defined offer |
| Which advantage types are realistic for this business, and which to rule out | local services, SaaS, agencies, ecommerce, marketplaces | any |
| What to build this quarter: business model, installed base, or protection | SaaS, local services, agencies, marketplaces | early, growing, established |
| Whether a different business model is a real counter-position | local services, agencies, B2B SaaS, ecommerce | pre-launch, early |
| Whether to build follow-on value with existing customers before more acquisition | SaaS, agencies, recurring local services | growing, established |
| Copy a competitor cheaper, or invent, and how big a bet | all | pre-launch, early |

## K1 · Benefit and Barrier test, Barrier first, per competitor

- **Decision:** does growth rest on a durable advantage or on copyable execution?
- **Author guidance:** lasting advantage needs two things together. A Benefit (higher price, lower cost or lower investment, and big enough to matter) and a Barrier (why rivals cannot or will not compete it away). Benefits are common; Barriers are rare, so examine the Barrier first. Advantage is always relative to a specific rival, including substitutes and likely entrants, and each separate business line is judged on its own. Operational excellence is needed but can be copied, so it is not an advantage of this kind (F2, F3, F16).
- **Applies when:** a plan leans on an advantage, for example to justify price, heavy upfront spend or a long payback. **Not when:** the plan only needs fast-payback, reversible tests.
- **Evidence needed:** the claimed edge in the owner's words; customer evidence of the Benefit (price vs alternatives, retention, cost per job); named rivals by class (direct, substitute or DIY, entrant); why each cannot copy. **Missing data:** no rival data means Barrier = unknown, run competitor-teardown; no customer data means Benefit = unknown, run PB-interviews.

| If | Then (Interpretation) |
|---|---|
| Benefit evidenced and a named Barrier holds against every relevant rival | Record the advantage type; price, retention or spend may be sized to it |
| Benefit evidenced, no Barrier (rivals could copy within months) | Execution advantage: valid basis, but keep commitments short-payback and reversible |
| Barrier holds against big incumbents but not like-sized peers | Partial: name the rival it fails against |
| No Benefit evidence | Unknown: research task before any claim |

- **Steps:** write the edge → name the Barrier type → check it is material → test per rival class → record a source per element → label: advantage type, execution advantage or unknown.
- **Cash / labour / capability / measurement:** none; 30–60 owner minutes; competitor-teardown or voc-research output helps; price vs alternatives, retention, win/loss reasons.
- **Guardrails:** no advantage claim without a named Barrier and non-inference evidence; an execution advantage is not a failure. **Review:** when a rival copies the edge, a substitute appears, or price or retention evidence contradicts the claim.
- **Alternatives:** no rival or customer data, so use the unknown branch and a research task.

| Proposed ClimbOS rule | Class |
|---|---|
| An advantage claim names its Barrier type, the rival it holds against and one non-inference evidence item, or it is labelled "execution advantage" or "unknown" | strategic preference |
| Never tell an owner there is "no viable strategy" because no durable advantage was found | contextual heuristic |
| Judge advantage per separate offer (an agency's retainer vs its one-off audits) | contextual heuristic |
| Require a named Barrier only when the advantage is used to justify heavy upfront spend or long payback | economic feasibility |

- **Relation to existing:** *versions* the four-test advantage review in [book 01 §9](../../../../docs/growth-intelligence/books/01_business_strategy_economics.md) (customer relevance and economic fit map to Benefit; durability maps to Barrier, now typed and per rival) and BK01 rules 2 and 5 in [BK01](../../../../docs/growth-engine/book-review/BK01.md). Supports [positioning](../../../../skills/positioning/SKILL.md): a differentiator is a Benefit, not a Barrier.
- **Sources:** F1 (text00006.html [49], [57]–[61]); F2 (text00006.html [152]–[162]; text00017.html [233]–[239]); F3 (text00006.html [165], [170]; note 10 text00020.html [43]); F16 (text00014.html [67]–[103]); F24 (text00006.html [15]; text00017.html [264]–[273]).

## K2 · Which advantage types a small business can realistically reach

- **Decision:** which of the seven types to consider, and which to rule out fast.
- **Author guidance:** each type has its own Benefit and Barrier. Scale economies need a material fixed cost and a real lead in volume (F5). Network effects are bounded by the network's real scope and tend to tip (F7). Switching costs only pay off on follow-on sales to customers you already have (F11). Branding in the strict sense takes a long, uncertain build; high awareness from big ad budgets is really scale, and B2B goods rarely earn an emotional premium (F13, F14). A cornered resource must pass five screening tests, and a single talented person usually fails the "sufficient" test (F15). Process advantage is rare even for giants (F16).
- **Interpretation (ours, not Helmer's):** realistic for owner-run firms are route density in chosen neighbourhoods (a bounded scale effect), switching costs built through stored data, workflows or relationships, counter-positioning against chains or legacy providers that profit from a disliked practice, and occasionally an exclusive asset (lease, licence, proprietary data). Mostly out of reach: network effects outside small bounded marketplaces, strict-sense branding, process advantage.

| If (business shape) | Then (Interpretation) |
|---|---|
| Route-based local service (lawn, pest, cleaning, pool) | Consider density: cluster acquisition by area, track cost per job by area |
| Recurring service, SaaS with stored data, agency or accountant relationship | Consider switching costs (K5) |
| Challenger whose incumbents earn from a practice customers dislike | Consider counter-positioning (K4) |
| Exclusive asset on terms not priced at its value | Run the five screening tests and record each result |
| Marketplace or community | Network effect only if it can tip locally and the benefit is material; otherwise treat it as a channel |
| Young business, or spec-driven B2B buyers | Rule out branding and process advantage as near-term; reputation and process are Benefits |

- **Evidence needed:** business type and geography; fixed vs variable cost; repeat or add-on purchases; any exclusive asset; years in the niche. **Missing data:** no cost data, so skip scale and mark unknown.
- **Cash / labour / capability / measurement:** none; owner input on costs and assets; cost per job by area, add-on attach rate.
- **Guardrails:** large-company cases are illustrations only; judge industry economics and own position separately, both must hold. **Review:** when model, geography or a recurring offer changes.
- **Failure modes (Interpretation):** treating reviews as a Barrier (rivals collect reviews too); calling a key person a cornered resource; copying Netflix-scale logic to a firm with no fixed-cost lead.

| Proposed ClimbOS rule | Class |
|---|---|
| Consider at most three candidate types and rule out the rest in one line each | strategic preference |
| Don't project a brand price premium inside a 90-day plan; brand work is a conversion Benefit | contextual heuristic |
| A cornered-resource claim records a pass or fail per screening test | strategic preference |

- **Relation to existing:** *new*. No library file maps advantage types to small-business models; nearest is [book 01 §9](../../../../docs/growth-intelligence/books/01_business_strategy_economics.md). Route-density note proposed for [plays-local](../../../../skills/plays-local/SKILL.md).
- **Sources:** F5 (text00008.html [43]–[55], [88]–[102], [128]–[137]); F7 (text00009.html [43]–[55], [73]–[92], [133]–[137]); F11 (text00011.html [46]–[86]); F13 (text00012.html [70]–[109]); F14 (text00012.html [111]–[123]); F15 (text00013.html [86]–[143]); F16 (text00014.html [67]–[103]).

## K3 · Stage check: what to build now

- **Decision:** prioritise the business model, capture of an installed base, or protection, this quarter.
- **Author guidance:** advantage types open at different times. Counter-positioning and cornered resources are set before takeoff; scale, network and switching-cost advantages during takeoff; process and branding only in stability (F20). Takeoff ends when the unit's own growth drops below roughly 30–40% a year, an experience-based cutoff that is not the product life cycle (F21). In takeoff, buyers mainly want to know whether they can get the thing at all; in stability they shop for the best deal and rivals price customers at their full value. Strong results in a boom often look like an advantage when they are not (F22).
- **Interpretation:** the buyer-question proxy and the timing logic are usable; the 30–40% number is not, because a small base makes growth rates noisy. Local takeoffs do happen (a new regulation, a new housing area, a new platform).

| If | Then (Interpretation) |
|---|---|
| No compelling offer or traction yet | Work on the offer and business model; acquisition only as learning tests |
| Market in flux and buyers asking "who can do this?" | Prefer plays that put new customers on recurring or embedded arrangements; spend still under cash and payback guardrails |
| Buyers compare deals; rivals know customer value | Don't buy share on lock-in assumptions; deepen existing customers |
| Growth only from a tiny base, no flux signal | Stage unknown; spend as if stable |

- **Evidence needed:** customer or unit counts now and 12 months ago; market-flux signals collected separately; how buyers ask; retention. **Missing data:** no growth history means ask for both counts; no flux signals means default to stability rules for spending.
- **Steps:** compute 12-month unit growth in code and keep the base → list flux signals → pick a stage or "unknown" → name at most three open types → set the quarter's emphasis.
- **Cash / labour / capability / measurement:** depends on branch; owner input; growth with base, retention, attach rate.
- **Guardrails:** stage is a labelled heuristic, never a computed certainty; takeoff never overrides cash floor, capacity or payback. **Review:** each quarter, or when growth slows sharply.

| Proposed ClimbOS rule | Class |
|---|---|
| Read a stage only when the 12-month starting base reaches an owner-configurable minimum (e.g. 30 customers); otherwise "unknown" | contextual heuristic |
| In stability or unknown stages, affordable acquisition cost excludes lock-in lifetimes that haven't been observed | economic feasibility |
| In a takeoff branch, prefer recurring or embedded arrangements over one-off sales | strategic preference |
| No stage input today; stage reading needs new optional diagnosis inputs | unknown to investigate |

- **Relation to existing:** *extends* the growth-trap material in [BK01](../../../../docs/growth-engine/book-review/BK01.md) (Ch 11) and step 4 of [growth-strategy](../../../../skills/growth-strategy/SKILL.md). Code gap: [diagnosis.ts](../../../../shared/agents/diagnosis.ts) lines 11–26 have no growth-history or flux input (P3).
- **Sources:** F12 (text00011.html [93]–[123]); F20 (text00017.html [94]–[177]); F21 (text00017.html [79], [97]–[105], [287]); F22 (text00017.html [78]–[93], [177], [210]–[215]).

## K4 · Counter-positioning test for small challengers

- **Decision:** will incumbents leave a new model alone, and against whom does that protect?
- **Author guidance:** a newcomer adopts a better model that the incumbent rationally declines to copy because copying would hurt its existing business (cannibalisation, managers' bias or incentives). If the model looks unattractive to the incumbent even on its own terms, that is not counter-positioning. It protects only against the incumbent, not other challengers with the same model, so it needs a second advantage against like rivals. The damage shrinks as the challenger grows, so a response eventually comes; the author suggests not trumpeting superiority (F9, F10).
- **Applies when:** the rival is a chain, franchise or legacy provider earning real revenue from the practice the new model removes. **Not when:** rivals are small peers who can change prices overnight.
- **Evidence needed:** incumbents' pricing unit, fees, terms and channel; how much of their revenue depends on the removed practice; the new model's own margin at a realistic volume (computed in code); which like-model rivals could copy. **Missing data:** no incumbent revenue data means collateral damage = unknown, so present it as a differentiator.

| If | Then (Interpretation) |
|---|---|
| New model profitable on its own AND a named incumbent loses material revenue by copying | Counter-position against that incumbent; expect a delayed response, not none |
| New model unattractive on its own | Not a counter-position |
| Rivals earn little from the old practice | A copyable differentiator |
| Holds against incumbent, peers can copy freely | Partial; pair with another Benefit/Barrier (switching costs, density) |

- **Steps:** list top rivals' models → estimate revenue at risk from copying → compute standalone margin → check like-model rivals separately → write the hook only after tests pass → set a review trigger.
- **Cash / labour / capability / measurement:** launch-pricing losses only if capped and approved; 1–2 hours; competitor-teardown; new-model margin, customers won from the named incumbent.
- **Guardrails:** comparative claims true, current and sourced; below-cost pricing only as an owner-approved capped test. **Stop/review:** incumbent adopts the model in a segment (re-run K1); margin falls below owner floor.

| Proposed ClimbOS rule | Class |
|---|---|
| Label a model "counter-position" only if both the standalone-margin and named-incumbent revenue-at-risk tests pass; else "differentiator" | strategic preference |
| Each counter-position names the like-model rivals it does not protect against | strategic preference |
| Comparative hooks about rivals' fees or terms must be verified current facts | external requirement |

- **Relation to existing:** *versions* §1.6 of [frameworks-and-base-rates](../../../../docs/research/plays/frameworks-and-base-rates.md) (lines ~141–152, built from a secondary summary; it has the cannibalisation idea and a margin check but no standalone test, like-rival limit or shrinking-damage dynamic) and the counter-positioning prompt at line 23 of [growth-plays](../../../../skills/growth-plays/SKILL.md). Feeds step 3 of [competitor-teardown](../../../../skills/competitor-teardown/SKILL.md).
- **Sources:** F9 (text00010.html [60]–[64], [74], [81]–[125]); F10 (text00010.html [146]–[149], [158]–[167], [267]–[286]); F20 (text00017.html [94]–[177]).

## K5 · Switching costs through follow-on value, never traps

- **Decision:** invest in follow-on offers and genuine embedding with existing customers before, or instead of, more acquisition?
- **Author guidance:** switching cost is what a customer expects to lose by moving supplier for further purchases: financial, procedural (learning, error risk) or relational. The Benefit exists only on follow-on sales. It is non-exclusive: in a mature market every player can value a customer, so the Benefit gets bid away at acquisition; most of the value comes from capturing customers before that. Add-ons deepen it (F11, F12).
- **Reported example:** SAP raising prices on locked-in clients (text00011.html [93]–[123]). ClimbOS does not adopt exploitation of captive customers.
- **Applies when:** follow-on purchases exist (renewals, add-ons, repeat jobs). **Not when:** one-off products (no Benefit), or retention is broken (fix it first).
- **Evidence needed:** follow-on purchase types; attach or repeat rate; what customers would lose by leaving; retention. **Missing data:** no customers, so not applicable.

| If | Then (Interpretation) |
|---|---|
| Follow-ons exist and attach rate is low | Build one value-adding follow-on (maintenance plan, add-on service, annual plan); measure attach |
| One-off product | No Benefit; focus on referrals or conversion |
| Proposal makes leaving harder rather than staying better | Reject; propose genuine embedding |
| Retention weak | PB-lifecycle-email or PB-activation-repair first |

- **Steps:** list follow-ons → classify current switching costs by kind → pick one follow-on → measure attach and retention of attached vs not → review pricing for embedded customers with notice (PB-price-increase).
- **Cash / labour / capability / measurement:** low; design and delivery hours; ability to deliver it; attach rate, retention split.
- **Guardrails:** customers can always leave and take their data; price changes to existing customers only with notice and owner approval; renewal and cancellation terms clear and lawful locally. **Stop/review:** attach flat after 8 weeks, revise; complaints or refunds rise, stop.
- **Alternatives:** no delivery capacity means PB-capacity first.

| Proposed ClimbOS rule | Class |
|---|---|
| Never raise switching costs by restricting exit (blocked export, hidden cancellation, surprise renewal) | external requirement |
| With follow-ons available and attach below the owner's target, rank a follow-on play ahead of acquisition plays of similar cost | strategic preference |
| Switching-cost claims don't raise affordable acquisition cost unless observed retention supports the longer lifetime | economic feasibility |
| A follow-on-offer playbook may overlap BRP-03 package architecture; check before adding | unknown to investigate |

- **Relation to existing:** *extends* PB-lifecycle-email and PB-price-increase in [contracts.ts](../../../../shared/playbooks/contracts.ts), the bundle ethics note in [BK02](../../../../docs/growth-engine/book-review/BK02.md), and the buyer-side switching-cost view in [book 02](../../../../docs/growth-intelligence/books/02_research_positioning.md). Overlap check needed with [BRP-03](../../blog-research/playbooks/BRP-03-package-architecture.json). Proposed home: [retention-lifecycle](../../../../skills/retention-lifecycle/SKILL.md).
- **Sources:** F11 (text00011.html [46]–[86]); F12 (text00011.html [93]–[123]; note 44 text00020.html [206]); F20 (text00017.html [94]–[177]).

## K6 · Advantage ledger: where growth comes from

- **Decision:** what advantage the plan rests on, and how that sizes spend.
- **Author guidance:** potential value is market scale times advantage (a qualitative identity, not a forecast); operational excellence realises it but is not itself the advantage (F4).
- **Interpretation:** BK01 asks "what advantage does growth come from?"; Helmer adds the durability test. Use the identity only qualitatively: a play either widens reach or protects share and margin.

| If | Then (Interpretation) |
|---|---|
| Evidenced advantage | Plan names it; at least one play deepens or protects the Barrier |
| Execution advantage only | Plan says so; spend sized to short payback; one play aims to build a Barrier over time |
| Growth riding a market tide | Flag the margin-after-slowdown risk |
| Unknown | First-week task gathers rival and retention evidence |

- **Evidence needed:** K1 result; growth-source class from BK01; concentration of customer sources (e.g. one referral partner). **Missing data:** field type "none yet" or "unknown" is valid.
- **Steps:** fill type, Benefit, Barrier, rival, evidence, stage → classify growth source → tag each play (uses advantage / builds Barrier / execution only) → check spend sizing.
- **Cash / labour / capability / measurement:** none; plan generation; deterministic lint; field presence and evidence sources.
- **Guardrails:** no invented rivals or rival facts; short owner-facing text. **Review:** when K1 inputs change.

| Proposed ClimbOS rule | Class |
|---|---|
| The decision record gains an optional advantage field (type, Barrier, rival, evidence source, stage); "none yet" is valid | strategic preference |
| Lint warns when plan text claims a moat, network effect or lock-in not recorded in that field with non-inference evidence | strategic preference |
| With "none yet" or "unknown", plays needing payback beyond the plan guardrail are blocked | economic feasibility |

- **Relation to existing:** *versions* BK01 rules 2 and 5 ([BK01](../../../../docs/growth-engine/book-review/BK01.md)) and the StrategyDecision record in [01_strategy](../../guides/01_strategy.md), which has no advantage field. Code gaps: `DecisionSchema` in [decision.ts](../../../../shared/agents/decision.ts) lines 28–42 has no advantage field (P2); the claims ledger in [lint.ts](../../../../shared/agents/lint.ts) does not cover strategic claims (P3).
- **Sources:** F1 (text00006.html [49], [57]–[61]); F2 (text00006.html [152]–[162]); F4 (text00006.html [86]–[127]; text00017.html [241]–[252]); F22 (text00017.html [78]–[93]).

## K7 · Copy cheaper or invent, and how big a bet

- **Decision:** copy a rival's offer at a lower price, or invent a different one, and how large a commitment.
- **Author guidance:** every lasting advantage starts with an invention (product, process, business model or brand); copying does not create one. Strategy is found through experiments, and most inventions don't produce an advantage. There are three routes to a compelling offer: capabilities-led (need unproven; stay in the game, avoid big commitments), customer-led (need known; delivery risk) and competitor-led (beat an existing offer; needs big commitments and lined-up complements). The author rejects a fixed "10x better" rule (F18, F19).
- **Interpretation:** for small firms, "invention" usually means a new offer, package or model, not technology.

| If | Then (Interpretation) |
|---|---|
| Plan is same offer, lower price, where rivals can match | Show break-even volume in code; expect matching; prefer a differentiated offer test |
| Capabilities-led | Small staged commitments; look for an early Barrier |
| Customer-led | Test delivery feasibility first |
| Competitor-led | Needs a clearly better whole offer; larger commitment only with owner approval |

- **Cash / labour / capability / measurement:** sized to the path; varies; unit economics in code; volume vs break-even, adoption.
- **Guardrails:** loss ceilings for learning bets; owner approval for large commitments. **Stop:** volume below break-even by the review date ends the price cut. **Alternative:** no cash means PB-concierge.

| Proposed ClimbOS rule | Class |
|---|---|
| A "match the rival at a lower price" play shows break-even volume and the expected rival response | economic feasibility |
| Capabilities-led bets start as capped tests with a stated learning goal | contextual heuristic |

- **Relation to existing:** *extends* §12 sequencing and the low-price position in §9 of [book 01](../../../../docs/growth-intelligence/books/01_business_strategy_economics.md); uses the margin and price-floor calculators in [decisions.ts](../../../../shared/analysis/decisions.ts).
- **Sources:** F5 (text00008.html [43]–[55]); F18 (text00016.html [105]–[180]); F19 (text00016.html [194]–[283]).

## Dated benchmarks (context only, never thresholds)

| Figure | Context | Date | Why not a threshold |
|---|---|---|---|
| Takeoff ends below ~30–40% annual unit growth | Author's experience with large markets (F21) | 2016 book | Heuristic; small bases make growth rates noisy; untested for small firms |
| ~60% of 108 cases had cost slopes of 70–85% per doubling of output | Cited 1990 experience-curve study (F17) | 1990 data | Manufacturing; histogram missing from the file; author uses it to argue the reverse of a position advantage |
| Concentrated personal equity returns well above the S&P 500 | Author's own investing, Appendix 8.1 (F23) | 1994–2015 | Self-reported, unaudited, single investor; irrelevant to small-business growth |
| Explore up to three new advantage types per stage | Author guidance (F24) | 2016 | A planning cap, not an evidence result |
| Netflix originals, Intel, BranchOut, Vanguard, SAP, Pixar, Toyota cases | Reported examples (F6, F8) | various | Venture or large-company hindsight; illustrations only |

## Disagreements and what decides

| Topic | BK07 | Existing library | What decides |
|---|---|---|---|
| Counter-position examples | Only counts where the rival earns real revenue from the old practice | [frameworks-and-base-rates](../../../../docs/research/plays/frameworks-and-base-rates.md) §1.6 hooks such as "no call-out fee" read as counter-positions | Per rival, revenue-at-risk evidence; otherwise call it a differentiator |
| Weight of durability | The Barrier decides | [Book 01 §9](../../../../docs/growth-intelligence/books/01_business_strategy_economics.md) makes durability one of four equal tests | Plan goal: require a Barrier only when the advantage justifies heavy upfront spend or long payback |
| "No advantage, no strategy" | Read literally, a firm without one lacks a viable strategy | BK01 and book 01 accept focus and execution | Owner-income plans: execution is valid; never use the phrase with owners |
| Takeoff land-grab | Win share while the market is in flux | [growth-strategy](../../../../skills/growth-strategy/SKILL.md) favours bounded reversible tests | Evidence of flux AND owner cash; without both, guardrails win |
| Exploiting locked-in customers | Presented as a Benefit (SAP) | ClimbOS ethics | Policy: excluded |
| Branding for small B2B trades | Weak | Local reputation can earn a modest premium | Owner's own price-vs-rival evidence |

## Not processed or uncertain

- Fig 9.7 (the evidence for the stage pattern, built from the author's students' papers) is unreadable, so its strength is unchecked.
- The small-business availability map (K2) is our interpretation, not the author's.
- The 30–40% cutoff and the "exhaustive seven types" claim are the author's, not tested here.
- Code-gap line numbers were checked on 2026-10-20 for `decision.ts` and `diagnosis.ts`; others come from the reading record and should be rechecked before code work.
- Platform, consumer and contract law on renewals and cancellation were not researched; K5's exit rule needs a jurisdiction check before it is written into customer-facing terms.
