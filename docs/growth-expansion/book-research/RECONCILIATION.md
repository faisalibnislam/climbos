# Reconciliation: nine books vs the existing library

Edition 2026-10-20. This file lists where the new books disagree with existing ClimbOS guidance (skills, playbooks, Books 01–12, the BK01–BK06 reviews, blog research) or with each other, and what decides each case. Prefer **versioning** existing guidance: each BKP playbook names what it versions in `versions_existing`.

## Rule-class policy

An author's recommendation is not a rule until it is classed. Every proposed rule in [notes/](notes/) and in each playbook's `rule_classes` carries exactly one class:

| Class | Meaning | Engine behaviour | Count |
|---|---|---|---|
| external_requirement | Law or platform policy | Hard block; verify the current primary source before execution | 23 |
| missing_prerequisite | An input or capability the action needs | Not eligible yet; plan a measuring or setup step | 27 |
| economic_feasibility | Cash, margin, payback or capacity arithmetic | Computed in code; blocks only when the numbers fail | 25 |
| strategic_preference | Owner or ClimbOS choice among valid options | Affects ranking; owner can override | 62 |
| contextual_heuristic | Holds in some contexts | Default only where its context applies; otherwise advisory | 101 |
| unknown_to_investigate | Can't be settled from the sources | Flag; never stated as fact | 9 |

Principles applied throughout:
- A tactic can be eligible but low priority.
- A diagnostic hypothesis is not a proven cause.
- A book benchmark is not automatically right for a given business. Every dated figure is context in the guides' benchmark tables, never a threshold.
- Reported client uplifts (BK13, BK08, BK14) are examples, never forecasts.

## Disagreements and what decides

| # | Topic | Position A | Position B | What decides / resolution | Where |
|---|---|---|---|---|---|
| R01 | Weight of durability in an advantage | Book 01 §9 weighs durability equally with three other tests | Helmer: the barrier decides | Require an evidenced barrier only when spend depends on durability (heavy upfront or long payback) | BKP-01 |
| R02 | What counts as counter-positioning | Library calls flat pricing and no-contract models counter-positions (from a secondary summary) | Helmer: only when the incumbent earns real revenue from the old practice and copying would hurt it | Helmer's test; similar small rivals can copy, so it protects only against the incumbent | BKP-01; backlog CG-45 |
| R03 | Land-grab during takeoff | Helmer: invest heavily while the market is changing | ClimbOS cash and payback guardrails | Guardrails win unless there's evidence of fast change and the owner has the cash | BKP-01 |
| R04 | Retention first vs penetration first | Verna and diagnosis: retention outranks demand; growth-strategy retention-first | Sharp: growth comes mostly from more buyers; some loss is normal | Churn level for the business's size and whether it's controllable. Steady-state ceiling and replacement computed in code | BKP-21; CG-20, CG-28 |
| R05 | Niche vs all category buyers | Dunford (BK03, BK14) and the positioning skill: niche first, swap test as a gate | Sharp/Romaniuk: target all category buyers; distinctiveness over differentiation | **Owner decision: context-dependent.** Defaults for consumer repeat-purchase and everyday local services; contextual heuristics for niche B2B, capacity-limited services and early-stage products | BKP-18 |
| R06 | Loyalty cards | plays-local rates them "evidence strong" | Sharp: evidence is card completion, not extra sales; members-vs-non-members is biased | Judge with a holdout; downgrade the rating | BKP-23 |
| R07 | Brand name early in ads | meta-ads: never open with the brand name; vary the first frame | Romaniuk: early, consistent brand cues | Vary the content, keep identity cues, show the name or asset early | BKP-19 |
| R08 | Risk reversal by default | landing-pages adds a guarantee by default | Blanks/Jesson and Copyhackers CH-C5: only for a diagnosed risk | Conditional on diagnosis | BKP-24 |
| R09 | Funnel vs "forget the funnel" | ClimbOS diagnoses a funnel | The book rejects funnels that end at purchase, not stage ratios | Revenue model and data decide. Recurring businesses need stages after the sale; one-off jobs keep a purchase funnel plus reviews | BKP-06 |
| R10 | Who to interview | Book 02: stalled, churned, non-buyers | Forget the Funnel: best-fit recent payers | The decision decides: messaging uses best-fit, drop-off uses contrast groups | BKP-03 |
| R11 | Test confidence and duration | ExP (BK06), Guide 05: strict thresholds, whole weeks, at least 7 days | Blanks/Jesson: 85–90% confidence, 2-day example, promote at a fixed end date | Strict rule stays. A lower threshold only when pre-registered, for a cheap reversible change, labelled directional | BKP-05; CG-43 |
| R12 | Fallback horizon when a test is too slow | experiment-design skill: 6 weeks | `decisions.ts:171`: 12 weeks | The library is inconsistent with itself; use one constant (proposed default 6) | CG-14 |
| R13 | Channel focus | growth-strategy: 1 primary + 1 secondary chosen up front; profitability lint on every play | Traction: about 3 cheap parallel tests, then focus; near break-even is a go signal | Bullseye when nothing is proven. A "test" play kind is exempt from scaled-ROI checks but capped | BKP-09; CG-04, CG-05 |
| R14 | Cold sequence length | PB-cold-outreach: 1 follow-up | Skill: 4 steps; code allows 5; Kazanjy: more | First campaign is step 1 plus one follow-up; up to 4 after owner review of about 100 contacts | BKP-12; CG-24 |
| R15 | Objection handling | Skills: one attempt | Kazanjy: loop until none remain | Written: one attempt. Live call: distinct objections in turn. A repeated no is final | BKP-15 |
| R16 | Pressure tactics | ClimbOS policy bans false urgency, decoys and fake references | Kazanjy: inflated anchors, steering options, "prices may go up". Blanks/Jesson: rolling deadlines, "was" prices | **Policy wins.** Genuine limits only with an owner-confirmed fact | BKP-16, BKP-26; CG-07 |
| R17 | Re-contacting lost deals | Kazanjy: about 60 days later by default | reply-handling, Book 11: only with permission; cold contacts are also a legal question | Permission required | BKP-16 |
| R18 | Acquisition spend ceiling | Lean Analytics: at most a third of lifetime value | Guide 04 DS-C5: churn-weighted payback | Payback rule (no lifetime-value ratios in plans) | BKP-07 |
| R19 | Base-rate attribution | base-rates.md row 67 credits Lean Analytics with 2–5% free→paid | The book gives about 2% free→paid, about 15% no-card trial, 40–50% card trial (2013 data) | Fix the citation; keep the ranges only with their real sources; diagnosis picks the reference by free model | CG-02 |
| R20 | First demo | Book 11 §5: tailor to the buyer's priority task | Dunford: strongest differentiators first; custom demo on the second call | Whether the buyer already knows their requirements | BKP-17 |
| R21 | Pitch insight | positioning step 11 and landing-pages step 4: "what changed" | Dunford: that's the common mistake; the insight is what buyers misunderstand | Dunford, for considered purchases | BKP-17 |
| R22 | Vision stories | strategy-positioning.md recommends Raskin's "name a shift" | Dunford: vision suits investors and gives buyers a reason to wait | Audience decides: investors vs buyers | BKP-17 |
| R23 | Stickiness before fixing a conversion leak | Book 03 §2: rank constraints by system effect | Lean Analytics: stickiness first | Economics in code. If churn-weighted value is unknown, the conversion fix is allowed (charging is never gated) but scale isn't | BKP-07 |
| R24 | Negative word of mouth | Romaniuk/Sharp: rarely worth attention | ClimbOS: public local reviews matter | Keep review work for local businesses | BKP-10 |
| R25 | Concentration vs reach | Book 10: one tight hypothesis | Romaniuk: reach first | Business type and horizon | BKP-19 |
| R26 | Targeting heavy buyers | growth-plays line 130: prefer customers worth more | Sharp: the heavy-buyer fallacy (heavy buyers regress) | Payback numbers decide | BKP-21 |
| R27 | CRO first for everyone | Blanks/Jesson | `diagnosis.ts` may find demand or capacity binds | The owner's numbers decide | BKP-04 |
| R28 | Auto-renewal by default | Kazanjy | — | Owner and legal decision, not a default | BKP-02 |
| R29 | "No Power, no viable strategy" | Helmer (shareholder value in large markets) | Owner-run small businesses | Never tell an owner they have no viable strategy | BKP-01 |
| R30 | Interview enthusiasm scoring | Lean Analytics rewards demeanour | Mom Test (BK05): distrust enthusiasm | Commitments over demeanour | BKP-03 |

## Agreements worth recording

- Capacity first in diagnosis matches every book that addresses it.
- "Unknown" churn benchmarks for non-SaaS businesses match Sharp.
- The retention-lifecycle skill's discount discipline matches Sharp's promotion findings.
- No repo file asserts 80/20 or "retention is 5x cheaper" (BK10 check).
- BK15's own Dropbox example supports ClimbOS's low-price checks against default search ads.
