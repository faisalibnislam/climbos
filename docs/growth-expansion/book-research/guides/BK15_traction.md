# BK15 guide: Traction (Weinberg & Mares)

Edition 2026-10-20 · status: proposed reference · not authorization for external actions

## Source

| Field | Value |
|---|---|
| Title | Traction: A Startup Guide to Getting Customers |
| Authors | Gabriel Weinberg, Justin Mares |
| Publisher | S-curves Publishing |
| Year | 2014 |
| Edition | First edition, hardcover, per the copyright page. **Not** the 2015 Portfolio revised edition that some existing ClimbOS docs cite |
| ISBN | 978-0976339601 |
| Format | EPUB, `docs/reference-books/Traction_-_Gabriel_Weinberg_and_Justin_Mares.epub` |
| Extraction quality | Good: 29 HTML parts with clean text. Figures are images (Bullseye rings, search demand curve, two growth charts, a partner map, photos). The table of contents labels chapter 9 as "8", a typo in the file |
| Watermark | OceanofPDF marks present: an "OceanofPDF.com" line at the end of every part and an oceanofpdf.com file in the archive |
| Coverage | **Read:** front matter, prologue, chapters 1–24. **Skimmed:** afterword (thanks and forum only). **Unreadable:** figures. Nothing skipped |

Locators use `split_NNN [element range]`, meaning `text/part0000_split_NNN.html` in `epub_full.py`.

## Use this guide for

- **Which acquisition channels to test now**, and which single channel to focus on after the tests.
- **Sizing and reading a first channel test** without demanding early profit.
- Checking whether a channel can **supply enough customers** for the goal.
- **How much acquisition to run while retention leaks.**
- Spotting **channel bias and saturation**.
- **Viral loop arithmetic** for referral-capable products.

Business types: all library types (SaaS, local services, agencies, ecommerce, apps, marketplaces). Stages: pre-launch, early with no proven channel, and growth that has flattened.

## Bullseye vs ClimbOS channel selection

**Interpretation:** ClimbOS ranks channels and commits; Bullseye tests a few in parallel, then focuses on the one the data favours.

| Bullseye step (author guidance) | ClimbOS today | Match |
|---|---|---|
| Brainstorm a realistic idea for every channel, against founder bias | [growth-strategy](../../../../skills/growth-strategy/SKILL.md) asks for the brainstorm; [scoring.ts](../../../../shared/acquisition/scoring.ts) priors favour type starters (85/70/40) and the candidate set is the top 30 plus starters | Skill yes; code biased |
| Rank into promising, possible, long-shot; inner circle of about three | 8 factors plus eligibility, price fit, hours and budget bands: richer than the book's guesses. But the skill's inner ring is one primary plus one secondary | Ranking stronger; ring meaning differs |
| Cheap tests in parallel | Plays carry test, kill and scale rules ([specs.ts](../../../../shared/agents/specs.ts)); the skill launches 2–3 tests after committing, on the middle ring; [frameworks-and-base-rates](../../../../docs/research/plays/frameworks-and-base-rates.md) has the Bullseye shape but isn't code | Partial |
| Focus on the winner from test data | `select()` marks the top prior "primary" before any test; logged results reach the next plan only as prompt text ([playResults.ts](../../../../convex/playResults.ts)) | No |
| Early tests may run below profit | [economics.ts](../../../../shared/agents/economics.ts) errors on any non-moonshot play above value at P50; PB-paid-search-test stops above value ([contracts.ts](../../../../shared/playbooks/contracts.ts)) | Conflicts |
| Re-run when the channel saturates | Competition fixed at 50; no decay trigger | No |

**Interpretation:** ClimbOS is stronger on hard eligibility, low-ticket price fit, owner hours and sales-cycle limits, budget bands, arithmetic in code and consent. It is weaker on test-then-focus, on feeding results back into scoring and on saturation.

## The 19 channels mapped to the ClimbOS library

Mapping only; the book's per-channel tactics are not reproduced. IDs from [library.ts](../../../../shared/acquisition/library.ts).

| Traction channel | ClimbOS family | Library IDs | Note |
|---|---|---|---|
| Viral marketing | product_led, referral | V07–V14, V09, R02, N11, N15 | Loop maths in K8 |
| Public relations | pr | X05, S16, X06 | |
| Unconventional PR | pr (nearest) | X05, E08, X04 | **No dedicated ID** for stunts or customer appreciation |
| Search engine marketing | paid_search | P01, P02, P15, X09 | Price fit gates low-ticket |
| Social and display ads | paid_social | P05–P14, P16, P19, P20, P25 | |
| Offline ads | traditional, local | E12–E18, D10, P21–P23 | |
| SEO | organic_search, local, marketplaces | S01–S20 | Library adds AI search (S14) |
| Content marketing | content, video_audio | C01–C25 | |
| Email marketing | email, retargeting | X01–X03, C18 | Cold email is outreach (D01), owner mailbox only |
| Engineering as marketing | product_led | C09–C11, V03, V11, V17, S06 | |
| Targeting blogs | content, creators, communities, marketplaces | P24, R18, N01, M10 | |
| Business development | partnerships, distribution | R03–R17, R20, D15, M21 | |
| Sales | outreach | D01–D20 | |
| Affiliate programs | partnerships, creators | R01, R18 | |
| Existing platforms | marketplaces | M01–M25, S17, S18, V17 | |
| Trade shows | events | E02, E03, D13 | |
| Offline events | events, communities, marketplaces | E01, E04, E06–E10, N12, N13, X10 | |
| Speaking engagements | video_audio, events, pr (nearest) | C13, E05, E07, X06 | **No dedicated ID** |
| Community building | communities | N01–N15, O04, O14–O20 | |

**Interpretation:** the library covers all 19, with three thin spots (speaking, stunts, customer appreciation), and goes beyond the book with AI search, maps, reviews, marketplaces and procurement. The strategy output schema in [tasks.ts](../../../../shared/ai/tasks.ts) has a 9-value channel key and can't name most of these families.

---

## BK15-K1 Bullseye: test the inner circle in parallel, then focus

- **Decision:** which channels to test now, and which single one to concentrate on after the readout.
- **Applies when:** no channel has first-party evidence, or the current one has flattened. **Not when:** an existing channel already brings most customers below value and isn't flattening; focus on it.
- **Evidence needed:** current customer sources with rough shares; value per customer from code; budget and owner hours; per candidate, guessed cost per customer, reachable customers and time to a readable signal, each tagged as a guess.
- **Missing data:** no attribution method → set one up first (unique URL or code, source question).
- **Branches:**
  - **Author guidance:** brainstorm across every channel, research how similar and failed firms acquired customers, and write down guesses for each idea.
  - **Author guidance:** the inner circle is about three, cut where enthusiasm drops; test several at once because tests take time, but not so many that focus slips.
  - **Author guidance:** focus on the one that tested well, since one channel tends to dominate at any stage; if none works, repeat using what the tests revealed.
  - Budget or hours fund only one readable test → test sequentially, fastest signal first, and say the plan is slower.
  - Focus channel saturates → rerun; reconsider earlier long-shots.
- **Steps:** audit sources → brainstorm per family (K6) → attach guesses → rank → pick up to three → design cheap tests (K2) → read all at their dates → focus.
- **Cash / labour / capability / measurement:** test caps must fit the budget band; test hours within the owner's hours; per-test source tagging and a read date.
- **Metrics:** full cost per customer per test (spend plus owner time); reachable volume vs the goal gap; customer fit; days to first customer.
- **Guardrails:** no test exceeds its cap; no external action without owner approval; no assumed list, partner or permission.
- **Stop / review:** each test's read date; the plan's day-45 decision point.
- **Alternatives:** no budget → unpaid tests only; no owner hours → channels ClimbOS can run.
- **Interpretation:** slow channels (SEO, content, partnerships) lose to fast ones at a common read date; judge them on leading indicators within their own windows. Two versus four customers is not a winner.
- **Rule classes:**
  - **Proposed ClimbOS rule:** with no first-party results, mark up to three eligible channels "test", each with a cap, read date and cost/volume/fit questions; "primary" only from a readout. *(strategic_preference)*
  - **Proposed ClimbOS rule:** skip new tests when an existing channel supplies most customers below value and isn't flattening. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** check summed test caps and hours against budget and hours in code. *(economic_feasibility)*
  - **Proposed ClimbOS rule:** a rerun after all tests fail cites what they showed before adding channels. *(contextual_heuristic)*
- **Relation to existing:** versions step 8 of [growth-strategy](../../../../skills/growth-strategy/SKILL.md) and `select()` in [scoring.ts](../../../../shared/acquisition/scoring.ts); matches [frameworks-and-base-rates](../../../../docs/research/plays/frameworks-and-base-rates.md); [Book 05 §9](../../../../docs/growth-intelligence/books/05_channel_strategy.md) partly reconciles the secondary channel.
- **Sources:** BK15-F2 split_004 [53–62], [174–189]; BK15-F3 split_005 [46–87]; BK15-F4 split_005 [89–125]; BK15-F5 split_005 [127–161]; BK15-F6 split_005 [163–191]; BK15-F7 split_005 [197–208].

## BK15-K2 Cheap channel tests: test, don't optimise

- **Decision:** how to size and read a first channel test so it answers "focus or not", not "already profitable?".
- **Applies when:** inner-circle tests and the first weeks in a new focus channel. **Not when:** tracking is missing (set it up first); low-ticket products where price fit already rules the channel out.
- **Evidence needed:** the assumption tested (cost, volume, conversion or time); value per customer from code; tracking.
- **Missing data:** exposure too small to observe the event → inconclusive, not failed.
- **Branches:**
  - **Author guidance:** tests validate model assumptions; testing isn't optimisation, so a few variants suffice; don't test until tracking exists.
  - **Author guidance:** don't expect early paid tests to profit; a search campaign near break-even after a few weeks suggests a channel worth focusing on. Cost per acquisition is cost per click divided by conversion.
  - Cost per customer at or below value with a readable sample → focus candidate; raise the cap in steps.
  - Above value but within an owner-set band, with a named lever → one bounded optimisation round, labelled a learning test.
  - Far above value → stop for this product.
  - Clicks but no conversions → fix the destination first.
- **Steps:** write the channel's assumptions → smallest exposure that tests one → few variants → cap and read date → read once → decide focus, one round, or stop.
- **Cash / labour / capability / measurement:** test cap only; setup and a read, owner hours counted as cost; ad account connection for paid; paid conversions, not clicks.
- **Metrics:** cost per customer vs value; reachable volume.
- **Guardrails:** hard cap and stop date; no scaled-return forecast from a test; verify current platform rules before acting; concept tests use truthful pages.
- **Stop / review:** read date; cap reached.
- **Alternatives:** no ad budget → direct asks to small sites or newsletters, community posts, partner placements; no integration → draft-only campaign.
- **Rule classes:**
  - **Proposed ClimbOS rule:** add a "test" play kind exempt from the P50 loss error but requiring a cap, read date, stated go band and a "can't show scaled ROI" label. *(economic_feasibility)*
  - **Proposed ClimbOS rule:** PB-paid-search-test gains one bounded optimisation round within an owner-set band; no default band from this book. *(strategic_preference)*
  - **Proposed ClimbOS rule:** no channel test launches without a source-tagging method. *(missing_prerequisite)*
- **Relation to existing:** extends PB-paid-search-test in [contracts.ts](../../../../shared/playbooks/contracts.ts) and [BRP-12](../../blog-research/playbooks/BRP-12-paid-test-vs-scale.json); conflicts with the loss check in [economics.ts](../../../../shared/agents/economics.ts) and the play kinds in [specs.ts](../../../../shared/agents/specs.ts).
- **Sources:** BK15-F5 split_005 [127–161]; BK15-F9 split_006 [71]; BK15-F14 split_007 [49–89]; BK15-F16 split_007 [134–155]; BK15-F22 split_012 [29–229].

## BK15-K3 Moving the needle: ceiling vs the goal, by phase

- **Decision:** can a channel supply enough customers for the current goal and phase, or is it supporting or early-only?
- **Applies when:** a numeric goal with a date exists. **Not when:** no goal; set one first (K5).
- **Evidence needed:** customers needed (goal minus baseline); reachable audience with a source; conversion rates with source tags.
- **Missing data:** no reach data → labelled assumption, with the first test designed to measure reach.
- **Branches:**
  - **Author guidance:** traction work should make a meaningful change to the current goal; what counts shifts by phase; small channels matter early and fade later; large goals need very large reach at typical conversion rates.
  - **Author guidance:** drop channel strategies that can't plausibly deliver enough customers within the budget.
  - High estimate can't cover a meaningful part of the gap → not a focus candidate.
  - First customers, cheap but unscalable → fine early; plan its replacement.
- **Steps:** compute the gap in code → reach × rates at P10/P50/P90 → compare with gap and horizon → label focus-capable, supporting or early-only.
- **Cash / labour / capability / measurement:** estimation only; reach source per channel; weekly reach logging.
- **Metrics:** ceiling customers within horizon; share of gap covered.
- **Guardrails:** arithmetic in code; reach carries a source tag; shared audiences already discounted for overlap.
- **Stop / review:** each plan rebuild; baseline crosses a phase boundary.
- **Rule classes:**
  - **Proposed ClimbOS rule:** a channel whose high-estimate customers can't cover the gap can't be primary or focus. *(economic_feasibility)*
  - **Proposed ClimbOS rule:** optional per-channel ceiling hint in the library, used only as a warning. *(contextual_heuristic)*
- **Relation to existing:** extends [economics.ts](../../../../shared/agents/economics.ts) (play-level ranges) and [planTasks.ts](../../../../shared/agents/planTasks.ts); [Book 05 §4](../../../../docs/growth-intelligence/books/05_channel_strategy.md) already warns about limited inventory. The `Channel` type in [library.ts](../../../../shared/acquisition/library.ts) has no ceiling field.
- **Sources:** BK15-F10 split_006 [104–150]; BK15-F16 split_007 [134–155]; BK15-F30 split_019 [24–178].

## BK15-K4 Leaky bucket and the 50% rule

- **Decision:** how much acquisition to run while activation or retention is weak, and when to scale.
- **Applies when:** subscription, app and repeat-purchase businesses with a retention or activation constraint. **Not when:** retention is stable; scale in steps.
- **Evidence needed:** churn or repeat rate by cohort; activation rate; owner hours for traction work.
- **Missing data:** no cohorts → monthly churn plus interviews.
- **Branches:**
  - **Author guidance:** before product-market fit much acquisition spend leaks, so don't scale; a steady trickle of test users shows how leaky the bucket is.
  - **Author guidance:** founders should split time roughly evenly between product and traction, in parallel; a good product rarely finds customers by itself.
  - **Author guidance:** before pivoting, look for pockets of very engaged users and learn why.
  - Pre-launch → start traction work now (permissioned list, truthful message tests, content).
  - Owner of a running service business → don't apply the split literally; reserve explicit weekly hours.
- **Steps:** read the diagnosis constraint → if leaking, cap acquisition at test level and fix the leak → watch whether later cohorts retain better → release scale after retention holds over a renewal cycle.
- **Cash / labour / capability / measurement:** test caps only while leaking; explicit hours; cohort tracking.
- **Metrics:** churn by cohort.
- **Guardrails:** never scale paid while contribution is negative or retention is broken.
- **Stop / review:** each cohort's first renewal.
- **Interpretation:** with constant new customers per month and a churn rate, the base tends toward their ratio, so lowering churn lifts the ceiling more than extra acquisition. The leak may be offer or price, not product.
- **Rule classes:**
  - **Proposed ClimbOS rule:** under a retention or activation constraint, plans may keep capped tests but no scale plays, and say why. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** store the even time split as founder-stage author advice; plans use the owner's stated hours. *(strategic_preference)*
- **Relation to existing:** extends [BRP-12](../../blog-research/playbooks/BRP-12-paid-test-vs-scale.json), [BRP-18](../../blog-research/playbooks/BRP-18-cohort-retention.json), [growth-strategy](../../../../skills/growth-strategy/SKILL.md) and [diagnosis.ts](../../../../shared/agents/diagnosis.ts).
- **Sources:** BK15-F8 split_006 [26–102]; BK15-F11 split_006 [154–158]; BK15-F12 split_006 [199–223].

## BK15-K5 Critical path

- **Decision:** what to work on now and what to drop, given one traction goal.
- **Applies when:** any plan. **Not when:** the plan already carries one significant goal and a pruned milestone path; then only the re-plan trigger is new.
- **Evidence needed:** the goal and why it matters (break-even, capacity, hiring or funding trigger); candidate milestones.
- **Missing data:** no clear goal → the diagnosis's binding constraint defines the first milestone.
- **Branches:**
  - **Author guidance:** pick one goal tied to a significant change for the company; list only milestones strictly needed; order by dependency; work on the first; set numeric time-bound sub-goals; re-assess after each milestone.
  - Goal without business significance (followers) → ask what changes when it's hit.
  - Off-path milestone → not-doing list with a reason.
- **Steps:** state goal and significance → list and order milestones → work the first → sub-goals → re-assess at each milestone and weekly.
- **Cash / labour / capability / measurement:** weekly review; sub-goal per period.
- **Metrics:** sub-goal attainment.
- **Guardrails:** week-1 list of five items or fewer (existing lint).
- **Stop / review:** milestone completion; weekly check.
- **Interpretation:** an over-pruned path can drop upkeep that protects current revenue (reviews, support).
- **Rule classes:**
  - **Proposed ClimbOS rule:** plans record the goal's significance in one line; completing a milestone prompts a re-plan. *(strategic_preference)*
- **Relation to existing:** duplicates the decision contract in [planTasks.ts](../../../../shared/agents/planTasks.ts) and the later steps of [growth-strategy](../../../../skills/growth-strategy/SKILL.md); add one sentence, not a playbook.
- **Sources:** BK15-F17 split_008 [28–128].

## BK15-K6 Channel bias and saturation

- **Decision:** is the candidate set skewed to familiar channels, and when does a working channel need a decay review?
- **Applies when:** brainstorming, and while a focus channel runs. **Not when:** a bias argument would override eligibility or price fit; it never does.
- **Evidence needed:** the full eligible list; cost and response trend of the focus channel; cited evidence of competitor use.
- **Missing data:** no competitor research → competition stays neutral.
- **Branches:**
  - **Author guidance:** founders overlook channels that are out of sight, disliked or tedious; a channel rivals dismiss can be a temporary edge.
  - **Author guidance:** tactics saturate as they get crowded, and one serious competitor raises a channel's cost, so keep running small experiments and watch uncrowded new platforms.
  - Family missing from the candidate set → add its best eligible channel as a "bias check" entry.
  - Competitors crowd a channel → lower competition, with a cite.
  - Focus channel cost rises over several reads (owner-set count) → decay review.
  - New relevant platform → capped early test, platform-failure risk stated.
- **Steps:** brainstorm per family → mark owner dislikes as bias, not evidence → score competition from evidence → track the focus trend.
- **Cash / labour / capability / measurement:** brainstorm time; competitor research; cost-per-customer trend.
- **Metrics:** families represented; focus-channel cost trend.
- **Guardrails:** competition claims cite evidence; bias-check entries are brainstorm items, not plan items.
- **Rule classes:**
  - **Proposed ClimbOS rule:** the candidate set adds the best eligible channel from each missing family, tagged "bias check". *(strategic_preference)*
  - **Proposed ClimbOS rule:** competition moves from neutral only with a cited delta. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** rising cost across an owner-set number of reads triggers a Bullseye rerun prompt. *(contextual_heuristic)*
- **Relation to existing:** extends [growth-strategy](../../../../skills/growth-strategy/SKILL.md), [growth-plays](../../../../skills/growth-plays/SKILL.md) and [scoring.ts](../../../../shared/acquisition/scoring.ts); results feed via [playResults.ts](../../../../convex/playResults.ts).
- **Sources:** BK15-F2 split_004 [53–62]; BK15-F13 split_007 [28–47]; BK15-F18 split_008 [151–289]; BK15-F34 split_023 [24–254].

## BK15-K7 Channel fit and cheapest test per channel

- **Decision:** does a candidate channel fit this business, and what is the cheapest test of cost, volume and fit?
- **Applies when:** brainstorm and test design. **Not when:** library eligibility or price fit already rules it out.
- **Evidence needed:** business type, price and margin, buying motion, geography; where customers already gather.
- **Missing data:** no research on gathering places → treat fit as a guess and test reach first.
- **Branches (summary, per mapping table above):**
  - **Author guidance:** each chapter pairs a fit condition with a small first test; the durable pattern is a single cheap, trackable exposure before any commitment.
  - **Author guidance:** permissioned email lists are worth building whatever the focus channel; bought lists are spam.
  - **Author guidance:** trade shows and events need attendee fit and a check that expected sales cover cost.
  - **Interpretation:** that break-even uses contribution per sale, not price; the book's example uses price.
- **Steps:** map the idea to library IDs → check fit → choose the cheapest test → size it with K2 and check the ceiling with K3.
- **Cash / labour / capability / measurement:** per channel; unique URL or code for any untracked channel.
- **Metrics:** cost per customer, volume, fit per test.
- **Guardrails:** no fake reviews, fake scarcity or misleading stunts; platform rules verified at execution time; cold email only through the owner's mailbox, never Resend.
- **Alternatives:** blocked channel → playbook alternatives in [contracts.ts](../../../../shared/playbooks/contracts.ts).
- **Rule classes:**
  - **Proposed ClimbOS rule:** verify platform-specific tactics from this book against current policy before use. *(external_requirement)*
  - **Proposed ClimbOS rule:** trade-show and event break-even uses contribution per sale. *(economic_feasibility)*
  - **Proposed ClimbOS rule:** consider IDs for speaking, publicity stunts (capped moonshot) and customer appreciation. *(unknown_to_investigate)*
- **Relation to existing:** extends [library.ts](../../../../shared/acquisition/library.ts), [frameworks-and-base-rates](../../../../docs/research/plays/frameworks-and-base-rates.md) and [Book 05](../../../../docs/growth-intelligence/books/05_channel_strategy.md); schema gap in [tasks.ts](../../../../shared/ai/tasks.ts).
- **Sources:** BK15-F19 split_009 [34–375]; F20 split_010 [36–292]; F21 split_011 [28–353]; F22 split_012 [29–229]; F24 split_013 [27–206]; F25 split_014 [30–304]; F26 split_015 [39–327]; F27 split_016 [32–199]; F28 split_017 [34–194]; F29 split_018 [28–198]; F30 split_019 [24–178]; F31 split_020 [32–251]; F32 split_021 [24–335]; F33 split_022 [24–245]; F34 split_023 [24–254]; F35 split_024 [32–219]; F36 split_025 [24–195]; F37 split_026 [24–184]; F38 split_027 [24–176].

## BK15-K8 Viral loop maths

- **Decision:** can a referral or viral loop drive growth, or only compound other channels; which lever to work on.
- **Applies when:** activation works and users get value. **Not when:** activation is broken (referrals feed a leak) or the product isn't inherently shareable (referral prompt at best, no viral claims).
- **Evidence needed:** invites per user over a window; invite click-through and signup rates; time from signup to invitee signup.
- **Missing data:** no event tracking → per-customer referral codes.
- **Branches:**
  - **Author guidance:** the viral coefficient is invites per user times invite conversion; above 1 means exponential growth; the authors treat values above about 0.5 as strongly helpful; cycle time matters as much; most loops need ongoing seeding; look for high-coefficient segments.
  - **Interpretation:** below 1, total users approach seeded users divided by (1 − K); standard maths, not stated in the book.
- **Steps:** measure invites and conversion (click-through × signup) → find the weakest factor → shorten cycle time → measure by segment → keep seeding.
- **Cash / labour / capability / measurement:** reward cost if incentivised; engineering time for in-product loops; event tracking by cohort.
- **Metrics:** K; cycle time in days; seeded multiplier.
- **Guardrails:** no "viral" or "exponential" claims without measured K ≥ 1; consent for invite emails; no address-book spam; incentives within platform rules.
- **Stop / review:** PB-referrals stop rule.
- **Rule classes:**
  - **Proposed ClimbOS rule:** add `viralCoefficient` and `seededTotal` (K < 1) to [calc.ts](../../../../shared/growth/calc.ts); plays cite computed values. *(contextual_heuristic)*
  - **Proposed ClimbOS rule:** no viral-growth claim without measured K ≥ 1 over a stated window. *(contextual_heuristic)*
- **Relation to existing:** extends PB-referrals in [contracts.ts](../../../../shared/playbooks/contracts.ts), the K-factor line in [plays-ecommerce-consumer](../../../../skills/plays-ecommerce-consumer/SKILL.md) and the referral notes in [plays-saas-b2b](../../../../skills/plays-saas-b2b/SKILL.md).
- **Sources:** BK15-F19 split_009 [34–375]; BK15-F9 split_006 [71].

---

## Dated benchmarks and reported uplifts

Context only. Never forecasts, targets or thresholds.

| Item | Value as reported | Type | Locator | Caveat |
|---|---|---|---|---|
| Dropbox search-ads test | About $230 per customer for a $99 product | Reported example | split_006 [71] | Company figure, not verified |
| Mint | Blogs, PR and search ads tested; focused on blogs, then PR | Reported example | split_005 [197–208]; split_019 [63–96] | 2007 conditions, self-reported |
| Weekly A/B testing habit | Claimed 2–3× channel efficiency | Dated benchmark | split_007 [102] | Unsourced; needs traffic most small firms lack |
| Search-ad click-through | About 2% average, under 1.5% for low quality | Dated benchmark | split_012 [168] | Unsourced 2014 figure |
| Viral coefficient | Above 1 exponential; above ~0.5 strongly helpful | Author threshold | split_009 [34–375] | Rule of thumb |
| Content commitment | At least six months once tests justify focus | Author guidance | split_016 [32–199] | Two case studies |
| Test sizing | A few hundred dollars per test | Dated | split_005 [127–161] | 2014 prices |
| Offline ad prices, network fees, platform sizes | Various | Dated | split_013, split_014, split_022 | 2014 US data |

## Disagreements and what decides

| Topic | Book | Existing ClimbOS | What decides |
|---|---|---|---|
| Inner ring | About three tested in parallel, then one dominant | One primary plus one secondary chosen before tests, 70–80/20–30 split ([growth-strategy](../../../../skills/growth-strategy/SKILL.md)); bands allow 4–6 channels at higher budgets | First-party readouts; whether the second item is really acquisition (often conversion or trust work, per [Book 05 §9](../../../../docs/growth-intelligence/books/05_channel_strategy.md)) |
| Early profitability | Near break-even is promising | Any non-moonshot P50 loss errors ([economics.ts](../../../../shared/agents/economics.ts)) | Label: capped learning test vs bankable play |
| Everyone should try search ads | Yes | Price fit blocks low-ticket | ClimbOS price fit; the book's own Dropbox case supports it |
| Lists and cold contact | Bought mailing lists and cold calls appear as options | Consent and legal checks; cold email only via the owner's mailbox | ClimbOS policy |
| Copying another product's invite text | Suggested | Original copy | Copy mechanics, not words |
| 50% time split | Founder default | Owner's stated hours | Owner hours |
| Ring labels and edition | 2014 text: most promising, possible, long-shot | Some docs cite secondary notes and the 2015 edition | Cite this 2014 primary text |

## Not processed or uncertain

- Figures unreadable; the Bullseye ring diagram and growth charts are known only from surrounding text.
- Differences from the 2015 revised edition were not checked.
- Whether an inner circle of roughly three tests suits owners with 2–10 hours a week; it may often mean two.
- Any near-break-even band would be owner policy; the book gives no number.
- Platform names, prices and network lists are 2014 data; verify before any use.
- Code and skill references were checked on 2026-10-20 and may move.
