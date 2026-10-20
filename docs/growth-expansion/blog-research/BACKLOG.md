# Implementation backlog from the blog research

Edition 2026-10-20, against `growth-engine-v2` at 1f28e6d. File and line references were re-checked on that date. **Proposed work only; nothing here is implemented yet.** The order is correctness first, then deterministic inputs, then prompt and skill changes that need a bench run.

## P1: correctness fixes in existing checks (deterministic, small, no model cost)

| # | Change | Where (verified) | Why | Playbook | Test |
|---|---|---|---|---|---|
| 1 | "Incremental" wording only after a valid split and a significant read. Keep the design label, but word the claim from `compareRates` and `sampleRatio` results. | `shared/growth/experimentOutcome.ts:48` (`inferenceOf`), `:113` (prints "about N incremental conversions") | 18/120 vs 12/120 prints "about 6 incremental" while the two-proportion test gives p = 0.2416 | BRP-21 | Unit: that case reads "no reliable difference". |
| 2 | Split check: keep the block at p < 0.001, add a warning band below p = 0.01, return which arm is over plus a stage checklist | `shared/analysis/decisions.ts:120` | 230/170 on 50/50 gives p = 0.0027, which passes silently today | BRP-21 | Unit: 230/170 warns; 9,000/1,000 blocks. |
| 3 | Split and holdout tests need 1-3 guardrails with a numeric harm bound; harm stop rules are exempt from the peeking check | `shared/agents/specs.ts:845` (`PEEKING`), `shared/ai/tasks.ts:94` (guardrails may be empty) | ExP allows early harm stops; today "stop when complaints rise significantly" is rejected | BRP-21 | Unit: harm stop passes, win stop fails, missing guardrail fails. |
| 4 | Split tests need at least 7 days; feasibility uses the primary metric's baseline when the brief gives it | `shared/agents/specs.ts:842` (fixed 10% → 15%), `:864` (`Math.max(1, …)`) | A 35-day test at 300 visitors a week passes today but needs far longer at a realistic baseline | BRP-22 | Unit: 5-day test fails; known low baseline makes a long test fail. |
| 5 | Cost per customer includes non-media costs (tools, freelancers, creative) | `shared/agents/economics.ts:203` passes `0` as "other" to `cacFull` | Understates cost per customer (worked example: $400 vs $425) | BRP-17 | Unit: DS-EX7 numbers. |
| 6 | The margin question asks for the cost "to deliver and keep" a customer | `shared/agents/economics.ts:381` | Skok counts retention and account-management costs in gross margin | BRP-17 | Copy test. |
| 7 | Label payback by definition in the locked numbers ("with churn" vs "per surviving customer") | `shared/agents/economics.ts` `lockedNumbers` | The same inputs give 6, 7.5 or 8.37 months depending on definition | BRP-17 | Unit: label present. |
| 8 | Activation means value received: fix the `activated` comment and add `activationKind` (setup / value / habit / unknown); setup or unknown lowers the basis to partial | `shared/agents/diagnosis.ts:17-18`; the funnel form already labels it "Got first value" | Counting setup as activation pushes the diagnosis toward "conversion" wrongly | BRP-07 | Unit: setup kind gives basis partial. |
| 9 | "Price increase" is no longer classed only as a delivery play; add a PB-price-increase contract | `shared/agents/diagnosis.ts:150` (`playStage`), `shared/playbooks/contracts.ts` | Increases also fix economics and under-pricing, not just capacity | BRP-06 | Unit: classification and contract eligibility. |

## P2: new owner inputs and calculations (deterministic)

| # | Change | Where | Playbook |
|---|---|---|---|
| 10 | Optional inputs for revenue churn and monthly expansion; value uses them when present, tagged observed or assumed | `shared/agents/economics.ts:44-74`, `shared/growth/calc.ts` | BRP-17 |
| 11 | Observed cohort survival replaces single churn when the cohort minimum is met (at least 3 cohorts with 3+ months, about 20+ customers each) | `convex/analytics.ts:311` (`computeCohorts`) → economics | BRP-18 |
| 12 | Cash trough line in the locked numbers, plus a `cash_trough` calculator kind | `shared/agents/economics.ts` `lockedNumbers`, `shared/analysis/decisions.ts` | BRP-20 |
| 13 | `cac_price_floor` calculator: the lowest price whose 12-month contribution covers acquisition | `shared/analysis/decisions.ts` | BRP-19 |
| 14 | `freeModel` owner field; diagnosis picks the reference by model and says "unknown" when weak references disagree | `shared/agents/diagnosis.ts:59` (`REF`), `convex/schema.ts` (businesses.funnel) | BRP-04 |
| 15 | Conversion sub-steps (pricing-page visits, checkout starts) in the funnel; the conversion constraint names the weakest sub-step | `shared/agents/diagnosis.ts`, funnel form | BRP-11 |
| 16 | Churn split inputs (failed-payment share, early-cancel share); new contracts PB-payment-recovery and PB-cancel-flow (no obstruction); COMPETING.retention also lists weak activation | `shared/agents/diagnosis.ts`, `shared/playbooks/contracts.ts` | BRP-08 |
| 17 | Paid plays carry intent `learning_test` or `scale`; scale needs measured retention and tracked conversion | `shared/playbooks/contracts.ts` (PB-paid-search-test), `shared/agents/specs.ts` | BRP-12 |
| 18 | Optional weekly counts per arm on experiment outcomes; novelty shown as a caution label | `shared/growth/experimentOutcome.ts`, outcome form | BRP-22 |

## P3: skills and prompts (needs a bench comparison before release)

| # | Change | Where | Playbook |
|---|---|---|---|
| 19 | `voc-research`: an adjacent-outcome review pool (confidence capped at medium), owner-approved survey or post-purchase poll, risk-type column | `skills/voc-research/SKILL.md` | BRP-13 |
| 20 | `landing-pages`: arrival match, question order, each proof once, one dominant risk with a matching reducer near the CTA | `skills/landing-pages/SKILL.md` | BRP-14 |
| 21 | Critic warnings `proof_type_mismatch` and `missing_consequence` | critic rubric (`skills/copy-fundamentals`), `shared/agents/runtime.ts` critic | BRP-15 |
| 22 | `lifecycle-email`: audit an existing flow first (map, contacts with no next step, protect/fix/queue); "where did you get stuck?" email and usage recap only from real events | `skills/lifecycle-email/SKILL.md` | BRP-16 |
| 23 | Copy rule: lead with the outcome; "AI" only as supporting detail unless the audience seeks AI tools | `skills/copy-fundamentals`, `skills/landing-pages` | BRP-05 |
| 24 | Lint flags plan text quoting lifetime value or a 3x rule | `shared/agents/lint.ts` | BRP-17 |
| 25 | Pricing advice: charging-model gates, tier and add-on test, credit-allowance margin at full use | `skills/growth-strategy`, Climb AI `calculate` | BRP-01, 02, 03 |

## P4: owner decisions (not engineering)

- **ClimbOS's own credit margins.** `shared/economics/credits.ts` prices packs for a 10% / 12% margin after fees; the library's rule is at least 30% contribution margin. Decide which applies to ClimbOS's own pricing (RECONCILIATION #17).
- **Licensing.** Confirm you're comfortable with original paraphrased synthesis of the public articles (no text reproduced).

## How to measure

Add the 33 synthetic cases in [evaluations/cases.json](evaluations/cases.json) to the expansion harness (`bench/expansion/`) as a separate set. Compare before and after each P1-P3 change under a cost cap the owner approves. P1 and P2 changes are covered by unit tests and need no paid run.
