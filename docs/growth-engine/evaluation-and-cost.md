# Evaluation and cost control

The approved paid evaluation budget is **$0**: the owner set it on 2026-10-18, and the V2 program reaffirms it.

- §1 runs for free.
- §2 and §6 need a budget the owner funds explicitly.
- One exception: the owner separately approved one capped real-model check on 2026-10-19 (up to $3, $1.18 spent). See §5.

**Four kinds of evidence, never merged (REQ-EVAL-01):**

| Kind | Means | Examples here |
|---|---|---|
| Fixture | Deterministic tests with fake models | `npx vitest run` |
| Model run | A real model on a bench case, judged | `bench/results/*` |
| Live use | Real workspaces in production | `/ops` engine quality |
| Business outcome | Measured results for a real business | `playResults`, learned rates (S4) |

## 1. Free, now

| Check | Tool | Gives |
|---|---|---|
| Offline re-lint of saved outputs | `npx tsx bench/lint-audit.mts` | Lint error counts per run (D1 size) |
| Unit tests | `npx vitest run` (fake LLM) | 672 pass on 2026-10-19 (branch `growth-engine-v2`) |
| Calculator fixture | `tests/unit/economics-fixtures.test.ts` (V2 §8.3) | Exact maths, plus zero/unknown churn, percent inputs, fractional horizon |
| Plan quality fixtures | `tests/unit/plan-quality.test.ts`, `tests/convex/plan-approval.test.ts` | A failed plan can't be approved |
| Goal gap fixtures | `tests/unit/goal-gap.test.ts` | Goal stays as stated; the gap is computed in code |
| Context-size probe | Replay saved bench inputs, measure characters per block | How often the 14k cuts bite (H2) |
| Website depth | Our fetcher on 5 Airly sites (fetch only, no LLM) | Text length per site (H5) |

## 2. Paid comparison (needs approval)

**Cases:** Formkit, Meetrao, Involets, Taskeni, Folevi. These are the owner's own sites, approved for evaluation.

**Arms (spec §02):**

| Arm | What | Git ref |
|---|---|---|
| A | Engine before the CMO changes | `bd071ca` |
| B0 | Live engine | `c5dfc09` (main, deployed 2026-10-19) |
| B1 | B0 + V2 S1–S3 (quality, provenance, maths, goal) | `growth-engine-v2` |
| C | One focused call per mode, same evidence and calculator | branch |
| D | Staged: diagnose → candidates → select. Only if C loses to B1 | branch |

**Estimated cost**, from bench history: Basic about $0.21/plan, Expert about $0.99, single call about 30% of that.

| Scope | Plans | Model cost | Judge | Total |
|---|---|---|---|---|
| Expert only, A/B1/C, 5 cases | 15 | ~$11 | ~$1.5 | **~$13** |
| Both modes, A/B0/B1/C, 5 cases | 40 | ~$20 | ~$4 | **~$24** |
| + 1 repeat per arm (variance) | 80 | ~$40 | ~$8 | ~$48 |

Each run stops when it reaches the approved cap (`bench/run.ts` gets a `--max-usd` flag).

## 3. Scoring

- **Owner, blind.** Plans are shuffled and arm names hidden. About 10 minutes per plan, using the spec §26 rubric:

  | Criterion | Weight |
  |---|---|
  | Decision usefulness | 25 |
  | Evidence and honesty | 20 |
  | Economics correct | 20 |
  | Feasibility for this owner | 15 |
  | Focus | 10 |
  | Clarity | 10 |

  15 plans take about 2.5 h.
- **Model judge (Sol),** as a second signal only. It is the same family as the writer, so it can't decide alone.
- **Hard gates**, which fail the plan whatever the score:
  - a maths error against the calculator;
  - a number that can't be traced;
  - a money-losing play marked "do now";
  - an action that would need approval but isn't flagged.
- **Decision rule:** keep a change only if it wins on owner score in ≥4 of 5 cases with no new hard-gate failures, at ≤+25% cost (owner cap).

## 4. Cost and margin (spec §24)

**Prices.** The 2026-10-19 snapshot (V2 §17.1) matches `shared/economics/rates.ts`:

| Model | Input | Cached input | Cache write | Output |
|---|---|---|---|---|
| Luna | $0.10 | $0.01 | $0.125 | $0.50 |
| Sol | $2.00 | $0.10 | $2.50 | $10.00 |

All prices are per 1M tokens. Historical runs keep their frozen rate versions (`RATE_VERSIONS`).


| | Basic | Expert |
|---|---|---|
| Credits charged | 26 | 133 |
| Credit cost basis (1 credit = 1¢) | $0.26 | $1.33 |
| Measured model cost (bench) | $0.18–0.21 | ~$0.99 |
| Revenue at Starter ($15 = 1,100 credits) | $0.35 | $1.81 |
| Revenue at top-up $50 = 4,000 credits | $0.33 | $1.66 |

Controls:

- **Keep:** reservation before each run, usage recorded per step, rate-limit backoff, one repair, background resume.
- **Add:**
  - a per-run hard cap at 1.5× the reserved amount (stop with "partial" and keep what's done);
  - an alert when a step's cost exceeds 2× its median;
  - cost per *quality-passing* plan on the /ops dashboard.
- **Arm C**, if it ties, cuts cost about 60–70%. Then either the price drops or more research can be added within the same credits.

## 5. Measured runs and errata

| Run | Cost | What it shows | Limit |
|---|---|---|---|
| tune-v2 (2026-10-18), Formkit strategy | Basic about $0.214, Expert about $0.991 | The judge preferred Basic | One case, judged by the same model family |
| provenance e2e (2026-10-19), Formkit, Basic + Expert | $1.18 in total (approved cap $3) | 0 research tags and 0 owner tags; 5 false-positive lint flags | One case. The research-verification path wasn't exercised |

**Erratum, tune-v2:**
- **The error:** `bench/results/2026-10-18-13-31-tune-v2.md` line 11 says "Opus judge". The actual pointwise judge was `gpt-6.1-sol` (`bench/run.ts`).
- **The fix:** on 2026-10-19 the generator was changed to print the real judge model (`POINTWISE_JUDGE`).
- **Historical file:** left unedited.

## 6. Basic regression check (approved 2026-10-19, $5 cap): run and result

**Why it changes a decision.** S1–S3 change the planner's instructions:
- the goal horizon replaces the fixed 90 days;
- "be ambitious" becomes "say so when the goal is out of reach";
- the goal gap appears in the locked numbers.

Unit tests can't show whether real plans got better or worse. This check decides whether `growth-engine-v2` is released.

**Design:**

| | |
|---|---|
| Cases | Formkit, Meetrao, Involets, Taskeni, Folevi (owner's sites) |
| Arms | B0 (`c5dfc09`) vs B1 (`growth-engine-v2`), Basic only |
| Plans | 10 (5 cases × 2 arms) |
| Model cost | About $0.26 per plan, so about $2.60 |
| Judge | Sol pairwise, about $0.15 per pair, so about $0.75 |
| Retries ceiling | +30% |
| **Cap** | **$5**. `bench/run.ts --max-usd 5` stops at the cap |
| Owner time | About 50 minutes, reviewing blind (§3) |

**Stop rule:** stop on the cap, or on any hard-gate failure in B1. Investigate that failure before going further.

**Decision:**
- Release B1 only if it wins or ties in at least 4 of 5 cases on the owner's score, with no new hard-gate failures and a cost within +25%.
- Then optionally add the Expert arm: 10 more plans, about $10 more, cap $15.

**Command when funded:**

```
pnpm bench --cases formkit,meetrao,involets,taskeni,folevi --tasks strategy --arms basic --refs c5dfc09,growth-engine-v2 --compare pairwise --max-usd 5
```

`--refs` doesn't exist yet. Until it does, run each arm from its own checkout.

### Result (2026-10-19)

**What ran:** Basic only. B0 = `c5dfc09` (detached worktree). B1 = `befc3c9`, which is S1–S4 plus the S5 capability context; the S5/S6 flags were off. Both arms used the same 5 prepared cases.

**Judge:** Sol, pairwise, both orders; a win counts only when both orders agree. Pointwise scores are 1–10.

**Files:** `bench/results/2026-10-19-02-50-regress-b0.*`, `…-regress-b1.*` and `2026-10-19-03-22-regress-judge.*`. The blind owner packet is `…-regress-judge-blind.md`; its key is in `…-blind-key.json`.

| | B0 | B1 |
|---|---|---|
| Model cost (5 plans) | $1.07 | $1.16 |
| Mean time per plan | about 20.9 min | about 20.8 min |
| Pairwise vs the other arm | — | 2 wins, 3 losses, 0 ties |
| Pointwise overall (mean) | 4.0 | 3.6 |

**Total spent:** $2.79 of the $5 cap (case preparation $0.015, plans $2.23, judge $0.54).

**Decision rule:** win or tie in at least 4 of 5 cases. B1 didn't meet it (2 of 5). B1 isn't released as run, and per the stop rule no more money was spent.

**Why B1 lost:**
- **Folevi:** the plays list was empty, so the plan became measurement prerequisites.
- **Meetrao:** the same comparison-page play appeared twice, forecasting about 1 customer.
- **Formkit:** play units were "organic page visit" and "eligible trigger event". Funnels ending at a click or sign-up were counted as customers.

**Where B1 was better:**
- Truth scores were higher in 3 of 5 cases.
- It said when the goal was out of reach (the Involets and Taskeni wins).

**Fixes since (free, deterministic):**
- `no_plays` is a hard failure.
- The play unit must be a paying outcome, and the funnel's last step must reach payment (both are hard economics findings).
- Repeated moves are flagged.
- The default plays task again requires at least one real volume engine and distinct moves, while still forbidding rates above the evidence.

**Re-checked offline** against the saved outputs: the new checks flag the Folevi and Formkit failures and none of the other 8 plans. The Meetrao duplicate is semantic, and word overlap doesn't catch it (known gap).

### Run 2 (2026-10-19, approved within the same cap)

**What ran:** B1 at `5c0d2cd` (the fixes above; the S5/S6 flags were off) against the saved B0 outputs. Same cases, same judge.

**Files:** `bench/results/2026-10-19-03-31-regress-b1fix.*` and `2026-10-19-03-57-regress-judge2.*`, including the blind packet.

| | B0 | B1 run 2 |
|---|---|---|
| Model cost (5 plans) | $1.07 | $1.27 |
| Pairwise | — | 1 win (Involets), 1 tie (Formkit), 3 losses |
| Pointwise overall (mean) | 4.0 | 3.6 |

**Cumulative spend:** $4.62 of the $5 cap. $0.38 is left, which isn't enough for another round.

**Decision rule:** not met (2 of 5 wins or ties). B1 stays unreleased.

**Why it still lost** (maths recomputed offline, `playMaths` over the saved outputs):
1. **Timid inputs.** The writers chose tiny reach. Folevi was 10–50 people a week, against B0's 50–500, which gives about 0 customers and plays that lose money, so the plan says "don't run them". Meetrao was similar. This came from the softened task wording ("never raise reach…", "only reach you can buy"). B0's "be ambitious" wording got better-judged plans.
2. **Headline vs inputs (REQ-MATH-06).** Formkit's headline was the simulation's P50 (6.6) while its inputs give 2.7 at the most-likely rates. Skewed ranges cause this, and the judge counted it as an arithmetic error. B0 has the same latent issue (Taskeni: point 19, P50 26).

**Fixes since (free; 733 tests pass):**
- **Ambition restored.** The default plays task again says "Be ambitious… move the goal" with weekly engines, keeps "each play a distinct move", takes rates from the evidence and volume from ClimbOS engines, and adds "if it can't reach the goal, say so; ClimbOS shows the gap".
- **Headline basis.** Headline customers (the saved `p50`, the locked numbers, totals and the goal gap) now use the most-likely rates, the same basis as cost per customer. The simulation supplies the range, widened to include the headline.

**What holds up across both runs:**
- B1 is more honest about goal gaps; the judge rewarded this in Involets (both runs) and Taskeni (run 1).
- Its truth scores were higher in 3 of 5 cases in run 1.

**What doesn't hold up:** less ambitious inputs lose to B0.

### Run 3 (2026-10-19, separately approved cap of $2.50)

**What ran:** B1 at `a43557c` (ambition restored, headline on the most-likely basis) against the saved B0 outputs.

**Files:** `bench/results/2026-10-19-04-03-regress-b1fix2.*` and `2026-10-19-04-28-regress-judge3.*`, including the blind packet.

| | B0 | B1 run 3 |
|---|---|---|
| Model cost (5 plans) | $1.07 | $1.17 |
| Pairwise | — | **3 wins** (Involets, Formkit, Taskeni), 2 losses (Meetrao, Folevi) |
| Pointwise overall (mean) | 4.0 | 3.6 |

**Spend:** $1.72 of $2.50 for this run; $6.34 across all three runs.

**Trend:** 2–3, then 1–1–3, then 3–2. The decision rule (at least 4 of 5) is still not met.

**Why B1 won:**
- **Formkit and Involets:** it separated benchmarks from assumptions and admitted when there was no route to the goal.
- **Taskeni:** a named outreach engine with weekly volume.

**Why it still loses (Meetrao, Folevi):** B0's plays are more specific self-serve conversion mechanisms; B1 restricted success to a narrow plan or segment.

These losses are about strategy specificity, not maths. The S5 decision contract (flagged) and the structured decision fields target them.

**Next decision-changing step:** flag `decision_contract` on for the bench arm and compare. It needs funding (cap about $2.50).

### Run 4 (2026-10-19, separately approved cap of $2.50): decision contract on

**What ran:** the same B1 with the `decision_contract` flag on (`bench/run.ts --flags decision_contract`) against the saved B0 outputs.

**Files:** `bench/results/2026-10-19-06-28-regress-b1dc.*` and `2026-10-19-06-55-regress-judge4.*`, including the blind packet.

| | B0 | B1 + decision contract |
|---|---|---|
| Model cost (5 plans) | $1.07 | $1.10 |
| Pairwise | — | **1 win** (Formkit), 1 tie (Folevi), 3 losses (Involets, Meetrao, Taskeni) |
| Pointwise overall (mean) | 4.0 | 3.4 |

**Spend:** $1.64 of $2.50 for this run; $7.98 across all four runs.

**Trend:** 2–3, then 1–1–3, then 3–2, then 1–1–3. The contract made plans worse; it stays off.

**Why it lost:**
- **Channel fit vs price:** labour-heavy plays (creator recruitment, partner outreach) for $6/month self-serve products (Involets, Taskeni).
- **Unverified assets:** Meetrao's play rested on a five-page asset that the research never confirmed; B0 started from the confirmed Cal.com page.

**Next fixes (deterministic, no spend):** price-aware channel scoring (low ARPU → self-serve channels first) and a rule that plays may only build on assets the research verified. Re-evaluating needs a new cap.

**Fixes made (not yet re-evaluated):**
- **Price fit** (`shared/acquisition/scoring.ts`): the entry price comes from owner revenue per customer, else the pricing facts. Below $25/month (unless sales-led), per-customer selling and partner or creator recruitment rank lower, and self-serve channels rank higher. The scorecard says why, and the plays task gets a PRICE FIT line.
- **Verified assets** (`lintAssets` in `shared/agents/specs.ts`, plus the plays task): an existing page, integration or list needs a URL the writer read, and a claimed count needs that many URLs. Otherwise the play says "To build" and building it is the first action today.

### Run 5 (2026-10-19, separately approved cap of $2.50): price-aware channels + verified assets

**What ran:** B1 at `6417aba` (price-aware channel scoring, plays only build on verified assets; decision contract off) against the saved B0 outputs.

**Files:** `bench/results/2026-10-19-09-16-regress-b1fix3.*` and `2026-10-19-09-38-regress-judge5.*`, including the blind packet.

| | B0 | B1 run 5 |
|---|---|---|
| Model cost (5 plans) | $1.07 | $1.14 |
| Pairwise | — | **3 wins** (Involets, Taskeni, Formkit), 2 losses (Meetrao, Folevi) |
| Pointwise overall (mean) | 4.2 | 3.8 |

**Spend:** $1.68 of $2.50 for this run; $9.66 across all five runs.

**Trend:** 2–3, 1–1–3, 3–2, 1–1–3, 3–2. Ties the best run; the release rule (at least 4 of 5) is still not met.

**Why it won:** forecast honesty. Assumptions are labelled, and it says when the activity can't reach the goal (Involets, Taskeni, Formkit).

**Why it lost:**
- **Meetrao:** commits to four new comparison pages with no demand baseline; B0 starts from the existing Cal.com page.
- **Folevi:** too passive, mostly "collect data, pause growth"; B0 runs two concrete tests on existing trial and comparison pages.

**Next fixes (deterministic, no spend):** improve existing verified assets before building new ones; never return a data-only plan, so there is always at least one concrete test on an existing asset inside the horizon.

**Done (no spend, not yet benched):** plays lint `assets_first` (a new asset of a kind the business already has needs some play to improve the existing one first; more than one new asset at once needs a demand baseline or goes in scaleIf) and `existing_test` (at least one play tests a confirmed existing asset inside the horizon); plan lint `data_only` ("keep plays paused" / "should not launch", export-only experiments, no dated action). Replayed on Run 5 outputs: flags Meetrao, Folevi and Formkit; Involets and Taskeni pass.

### Run 6 (2026-10-19, separately approved cap of $2.50): existing assets first, never data-only

**What ran:** B1 at `13b5be5` (Run 5 engine plus "improve existing assets before new ones" and "always one concrete test on an existing asset") against the saved B0 outputs.

**Files:** `bench/results/2026-10-19-13-33-regress-b1fix4.*` and `2026-10-19-13-56-regress-judge6.*`, including the blind packet.

| | B0 | B1 run 6 |
|---|---|---|
| Model cost (5 plans) | $1.07 | $1.14 |
| Pairwise | — | **3 wins** (Involets, Formkit, Taskeni), 1 tie (Folevi), 1 loss (Meetrao) |
| Pointwise overall (mean) | 4.2 | 3.4 |

**Spend:** $1.69 of $2.50 for this run; $11.35 across all six runs.

**Trend:** 2–3, 1–1–3, 3–2, 1–1–3, 3–2, 3–1–1. The best run so far (fewest losses), but the release rule (at least 4 wins of 5) is still not met.

**What changed:** Folevi moved from a loss to a tie (no longer "collect data only"). Wins still come from forecast honesty.

**Why it still loses:**
- **Meetrao:** it edits two existing pages but doesn't say how qualified visitors will reach them. B0 pairs the comparison page with a distribution test (creators).
- **Pointwise gap (3.4 vs 4.2):** absolute scores reward B0's more ambitious, concrete plays, so honesty alone isn't winning the absolute rubric.

**Next fix (deterministic):** every play that improves an asset must also name its distribution route to qualified visitors (channel, volume, cost). Re-evaluating needs a new cap.

**Done (not yet re-evaluated):** plays have a `route` field. `lintDistribution` sends back any play that changes or builds a page, listing or flow when its route lacks:
- a channel;
- visitors a week with a source tag, or how it will be measured;
- cost;
- owner time.

Search or existing traffic counts only with a measured number. `lintPlanDistribution` needs a dated route action in the plan. When every picked channel is a page channel, the scorecard names a channel that sends people. Replay flags both Run 6 Meetrao plays and its plan.

### Run 7 (2026-10-19, approved cap $4.50): distribution routes, and the speed flags

**What ran:** B1 at `c356c00` (every asset play names its distribution route; also the faster pipeline: research in parallel with channel scoring) and B2 = the same with `--flags fast_review,lean_plan`, both against the saved B0 outputs.

**Files:** `bench/results/2026-10-19-14-25-regress-b1route.*`, `2026-10-19-14-25-regress-b1fast.*` and `2026-10-19-16-19-regress-judge7.*`, including the blind packet.

| | B0 | B1 (c356c00) | B2 (+ fast_review, lean_plan) |
|---|---|---|---|
| Model cost (5 plans) | $1.07 | $1.06 | $0.95 |
| Mean time per plan | 1228 s | 1077 s | 887 s |
| Pairwise vs B0 | — | **3 wins**, 2 losses (Meetrao, Folevi) | 2 wins, 3 losses |
| Pointwise overall (mean) | 4.0 | 3.4 | 3.2 |

**Spend:** $3.03 of $4.50 (plans $2.01, judge $1.02); $14.38 across all seven runs.

**Trend for B1:** 2–3, 1–1–3, 3–2, 1–1–3, 3–2, 3–1–1, 3–2. Still short of the release rule (at least 4 of 5).

**Speed:** the parallel research saved about 12% (1077 s vs ~1230 s). The speed flags save another ~18% but cost quality (2–3), so they stay off. Where the time goes (B1, mean per phase): plays draft A/B 226/183 s, plan draft A/B 186/175 s, plays and plan revisions 139/146 s, channel scoring 112 s, research 64–68 s each, reviews ~30 s. Drafting effort, not review, is the cost.

**Why B1 still loses:**
- **Meetrao:** still proposes building/buying traffic for a $30/year product. B0 improves the existing buyer-intent page and tests creator distribution before any spend.
- **Folevi:** narrows success to one paid plan (Pro) instead of converting across paid plans with a conservative revenue proxy.

**Next:** for low-price products, require the first play to improve an existing high-intent page plus a no-spend distribution test before any paid traffic; and count conversion to any paid plan. Re-evaluating needs a new cap.

**Built after Run 7 (not yet evaluated):** `lintLowPriceFirst` (below $25/month per customer the first play improves an existing high-intent page with a free route; any spend waits for that result) and `lintAnyPaidPlan` (plays and the North Star count new customers on any paid plan, lowest paid price as the revenue proxy), with matching guidance in the plays and plan tasks and the PRICE FIT line.

**Built (not yet evaluated): five lenses from marketing books**, summarised in our own words in `skills/growth-plays` ("Five lenses") and `skills/growth-strategy` ("North Star by stage"), with a reviewer criterion (Q8 "Pull and positioning") and fallback SaaS funnel ranges in the plays base rates. Code checks: `lintSelfServeFunnel` (product-led growth: low-price products get a funnel play), `lintComparisonPositioning` (positioning: alternative, difference, segment), `lintOfferClaims` (offers: no unconfirmed guarantees), `lintStageMetric` (stage metrics: no vanity North Star), `lintReferralDrivers` (word of mouth: trigger and share mechanism).

**Built (not yet evaluated): P0 grounding slice from the Growth Intelligence Library (Books 13 and 14), `ENGINE_VERSION` v2.7-grounded-numbers.** Gap review and backlog: `docs/growth-engine/library-gap-plan.md`.
- **Unsourced numbers are a hard failure:** `invented_fact` is in `HARD_RULES`. A failed plan lists each finding and where it is (`quality.fixes`).
- **Customer counts checked everywhere:** every count in the prose must be calculated by code, the goal or a fact (`lintOutcomeNumbers`, ±15%). Previously only the North Star was checked.
- **Consistency pass sees the failures:** it gets the failing checks in its prompt (no extra call). The plan agent's hard checks are judged on the final plan only.
- **Workspace currency throughout:** minor units follow the currency (`shared/economics/currency.ts`). The library's USD thresholds are scaled by dated reference rates.
- **Evidence record per version:** `planEvidence` stores facts, insights, research notes, skill hashes, models, engine and currency.
- **Approval bound to content:** the approval binds to the plan's content hash, and approving re-checks it. `generationCostMicros` is now the run's cost at save.
- **Unknowns stated:** owner hours and email audience go in the brief and in `quality.unknowns`. `lintNoAudience` blocks sends to a list that isn't there.
- **Bench parity:** the bench applies the same customer-count check.

**Built (not yet evaluated): items 8 and 9, `ENGINE_VERSION` v2.8-cited-sources.**
- **Cites:** channels and audiences carry `cites` ("fact:N" or a URL the research read). `lintCites` fails cites that don't resolve as `citation`, a hard rule.
- **Sources saved and shown:** cites resolve at save to fact ids or titled pages (`sources`) and show as chips on each channel and audience.
- **Final checks see the research:** the final plan checks now get the research notes and pages, so cited URLs resolve.
- **Conflicting facts:** `findConflicts` covers two prices for one tier (same currency and period) and two trial lengths. Both values go in the brief, the evidence record and on the review card.
- **Also fixed:** a channel's ad spend is saved in the currency's own minor units.
- **Cost:** no extra model calls. The plan output adds a few tokens per channel.

**Built (not yet evaluated): knowledge expansion slices 0, 1, 3, 4, 5, 6, 9 and 10, `ENGINE_VERSION` v2.9-expansion-checks.** Plan: `docs/growth-engine/expansion-integration-plan.md`.
- **Slice 0, 32-case harness:** `bench/expansion/run.ts` and `grade.ts`.
  - Climb AI's real prompt, model and tools on all 32 cases; the plan path on 6.
  - Number checks run in code; a blind judge scores the 7-point rubric, and any hard failure fails the case.
  - Pairwise mode and a blind packet for owner review.
  - Dry run with the fake model only; no paid run.
- **Slice 1, decision calculators:** in `shared/analysis/`, exposed as the Climb AI `calculate` tool: margin, price floor, rate comparison, sample ratio, sample size, before/after.
- **Slice 3, experiment feasibility:** split and holdout tests must name an eligible count and be able to finish; "stop when significant" is blocked.
- **Slice 4, capacity and service area:** a new owner input for new customers a month, a hard capacity rule on forecasts, and service-area targeting for local or regional paid reach.
- **Slice 5, claim ledger:** speed multipliers, 24/7, leadership, user counts, awards and full automation need evidence.
- **Slice 6, evidence strength:** each fact is labelled by kind (site says, stated opinion, behaviour, commitment, measured); proof-of-demand language needs more than opinions.
- **Slice 9, platform rules:** planning notes (RULE-01/02/05/06); Mac apps can't plan App Store product page tests.
- **Slice 10, borrowed uplift:** another business's reported lift can't be a funnel rate or a promise.
- **Cost:** no extra model calls. The calculator tool may add a Climb AI turn when it's used.
- **Release:** needs the baseline and comparison runs on the 32 cases plus the end-to-end bench (owner cap).

**Built (not yet evaluated): research reads pages (gap-plan item 11).** `webFetch` was never sent to OpenAI, so research saw search snippets only. No OpenAI SDK is installed and the adapter calls the Responses API directly, so there's no capped page-fetch tool to switch on. Instead, the adapter offers a `fetch_page(url)` function tool and runs it with ClimbOS's own fetcher (`shared/ai/pageFetch.ts`).
- **Rules (in code):** public http(s) only; private, loopback, link-local and metadata addresses refused, including after DNS and on every redirect. robots.txt honoured; 2 MB and 15 s per page; about 4k tokens of text per page.
- **Untrusted page text:** it's returned as a tool result inside `<untrusted_content>`. The budget, domain lists and tools are set by code, never by page text.
- **Budget and sources:** `maxUses` caps real reads (refused URLs don't count), and after `maxUses + 2` rounds the model must answer. Reads count in `webFetches`. Each page read becomes a research source, so source checks can verify it.
- **Background turns:** follow-up calls chain by `previous_response_id`, with the read count and URLs saved on response metadata. A turn that yields mid-loop now meters the calls it has already made (`convex/jobs.ts`, bench).
- **Where it runs:** only where a DNS lookup is passed in (jobs and bench). Other callers keep search only.
- **Cost per plan (estimated, Luna):** plays research (4 reads) adds 1–4 Responses calls and about 40–80k input tokens, mostly cached, plus 1–3k output: about $0.005–0.01 and 10–40 s. Insights research (8 reads) adds about $0.01–0.03. Prospecting and creator scout (25 reads) can add up to 27 calls and about $0.10–0.15 when uncached. Page reads have no per-call fee. Search calls don't change.
- **Not yet checked:** a live call to confirm OpenAI accepts the resent output items (stateless) and the chained background calls. Run cost estimates don't include read calls yet. A page could still lead the model to a public URL with data in its query string. The research context is the business brief, so exposure is low.

**Built: cold email sends once (gap 15, Books 13 §7 and 14 §11).** `convex/outboundSending.ts`, `convex/mailbox.ts`; tests in `tests/convex/send-idempotency.test.ts` (fake mailbox, no real sends).
- **Stable key:** `opKey` = org + prospect + step + approved content hash (`sendOpKey`, no time). The Message-ID is derived from it. A duplicate row with the same key is canceled.
- **Payload bound:** the first try stores `payloadHash`; a retry with a different email goes to owner review, not out.
- **Leases:** hand-off and claim leases. Only the lease holder may claim, once. Unclaimed and expired: queued again. Claimed and expired: `uncertain`, never straight to the queue.
- **Check before resend:** an uncertain email (worker died, timeout, dropped connection) is looked up by Message-ID in the IMAP Sent folder. Found: sent. Not found: sent again with the same Message-ID. Only for Gmail and Microsoft 365 SMTP (they keep a Sent copy). Other mailboxes go to the owner ("It sent / Send again / Skip").
- **Per recipient:** each row keeps its own result. A campaign is done only when no row is queued, sending or uncertain. A duplicate success report doesn't queue a second follow-up.
- **Revoked mailbox:** nothing is handed over while it's not connected. A refused sign-in marks it expired and tells the owner. No retries.
- **Limits:** Sent-folder lookup isn't checked against a live Gmail or Microsoft 365 mailbox yet. A Sent copy that arrives late could cause one resend (the lookup runs at least 2 minutes after a lost answer, 12 after a lease).

**Built (not yet evaluated): structured experiment outcomes (gap item 16, Book 14 §14, Book 13 §9).**
- **Outcome per test:** `experiments.analyses` holds eligible, exposed and converted counts, the comparison group, window, source, design, result against the metric and stop rule, and whether the test ran.
- **Label set in code:** `inferenceOf` (`shared/growth/experimentOutcome.ts`). Platform report → attributed. Holdout or randomized with both groups → incremental. Anything else → observed. Not carried out → not_run.
- **No overwrite on redefinition:** a changed metric or rule after results is appended and marked `redefined`. The same definition corrects the latest analysis. The original hypothesis, metric and stop rule are never edited.
- **Owner form:** on each experiment card (`ExperimentOutcome.tsx`) via `playResults.recordExperimentOutcome`. It previews the label before saving.
- **Learning:** `resultsBrief` adds EXPERIMENT OUTCOMES. Only incremental lines may say "incremental"; observed and attributed lines say they are not proof of cause. Tests that weren't run sit under TESTS NOT RUN, out of the lessons. A redefined result is exploratory and keeps the original verdict.
- **Not done:** forecast and backtest runs still aren't linked to plays. The UI hasn't been checked in a browser against a live backend.

**Built (free, offline; no paid run yet): mixed cases and hard-failure scoring** (library-gap-plan items 12 and 13).
- **Case sets:** `--cases saas` (default, the unchanged B0 five), `--cases mixed`, `--cases all`, or ids mixed in (`mixed,formkit`). An unknown name stops the run.
- **Mixed set** (from `bench/cache`):

  | Case | Type | Horizon | Ads/month |
  |---|---|---|---|
  | Animalz | agency | 90 d | $0 |
  | Bell Brothers | local service | 60 d | $1,500 |
  | Tartine | local food | 60 d | $400 |
  | CrossFit South Brooklyn | local fitness | 60 d | $60 |
  | Finch | consumer app | 90 d | $1,000 |
  | Tiny Habits | creator | 90 d | $150 |
- **Hard failures scored apart from the judge** (`bench/hard.ts`): each strategy output gets the production hard lint. That's the plays lint, plus the final-plan lint as `convex/jobs.ts` runs it.
  - Any counted finding makes that arm lose the comparison, whatever the judge says. If both arms fail, it's still a loss.
  - The judge's own call is kept as `judged`.
  - Results JSON gets `hard` per case. The markdown gets a "Hard failures" table and a "Decided by hard checks" column.
- **Imported (older) outputs:** plays `invented_fact` findings aren't counted without saved research notes. The channel budget check is skipped when only scorecard rows were saved. Live arms now save both (`evidence`).
- **Offline re-check of saved 2026-10-19 runs:**
  - B1/B2 trip `economics` ("loses money") on 4–5 of 5 SaaS plans.
  - B0 trips `invented_fact`/`consistency` on all 5.
  - So under this rule, the release check (≥ 4 of 5 wins) first needs plays that don't lose money.

**Built (not yet evaluated): cycle 2 from ChatGPT's notes (owner chose all four improvements and build-first), `ENGINE_VERSION` v3.0-diagnosis-playbooks.**
- **Diagnosis in code** (`shared/agents/diagnosis.ts`):
  - Reads the weakest link from the owner's "last 30 days" numbers (visitors, leads, first value, new customers), plus churn and capacity.
  - Reference ranges are used only where `base-rates.md` has them (grade C). Without numbers the result is "unknown", plus what to measure.
  - The model only explains the result and names a competing explanation.
  - `lintDiagnosisFit` requires plays to work on a measured activation, conversion, retention or delivery constraint.
- **Playbook contracts** (`shared/playbooks/contracts.ts`):
  - 15 typed contracts, each with a decision, the constraint it works on, when it applies and when to avoid it, requirements, steps, outcome, guardrail, stop/revise/expand rules and fallbacks, with sources.
  - Eligibility is decided in code. The plays agent gets what fits (constraint first) and what doesn't, with the fallback.
  - `lintEligibility` blocks plays built on an ineligible playbook.
  - Plans save `constraintDiagnosis` and `playbooks`.
- **Separate confidence** (`shared/agents/confidence.ts`): problem, fix and forecast evidence per play, computed in code, shown as three chips on each play card.
- **Failure diagnostics** (`shared/growth/diagnostics.ts`):
  - Checks in order: did it run, is it measured, was reach short, which step fails, is there enough data.
  - One next step. More spend only when conversion holds and reach alone is short.
  - Shown on the plan-vs-actual card and carried into the next plan's brief.
- **Owner feedback reasons** (`convex/feedback.ts`, `ownerFeedback` table):
  - Reasons: done (with result), already tried, too expensive, can't do it, wrong fact, not relevant.
  - A wrong fact goes back to review; the rest reach the next plan as constraints.
  - Shown on play and channel cards.
- **Cost:** no extra model calls.
- **Release:** needs the 32-case comparison and the end-to-end bench (owner cap). UI not yet checked in a browser.

**Built (not yet evaluated): blog-research backlog P1, `ENGINE_VERSION` v3.1-trust-checks.** See `docs/growth-expansion/blog-research/BACKLOG.md`.
- **Experiment outcomes:** a comparison is called "incremental conversions" only with a valid split and a significant difference. Otherwise it reads "no reliable difference", or that the split doesn't match its plan. A planned share can now be recorded.
- **Split check:** a warning band (p < 0.01) with the over-represented arm and a stage checklist; the block stays at p < 0.001.
- **Plan experiments:** need a whole week and 1–3 numeric guardrails. Stopping early for harm is allowed. Feasibility is sized on the owner's measured rate for the metric when known.
- **Cost per customer:** includes a play's other monthly costs (tools, freelancers, creative). The margin question asks for the costs to deliver and keep a customer.
- **Payback:** labelled "with churn", and the per-surviving-customer figure is shown alongside.
- **Activation kind:** a setup-only count makes the diagnosis partial.
- **Price increases:** classed under economics, with a new PB-price-increase contract.

**Built (not yet evaluated): trust, claims, and intent checks, `ENGINE_VERSION` v3.2-trust-claims-intent.**
- Publishable claims use owner-confirmed, observed, or measured capability facts; website claims and stated opinions do not substantiate them. Selected high-risk claims and named integrations are checked deterministically.
- Every agent receives a trust-evidence posture. The prompt distinguishes proof-building from evidence-backed credibility, while leaving brand age/reputation unknown when not recorded.
- SEO briefs classify search intent as awareness, evaluation, purchase, or unclear; a deterministic cross-check compares the label with query evidence and page type.
- **Limit:** regex and phrase checks catch high-risk cases but do not semantically match every product feature or query. No paid real-model comparison has been run for this version.

**Built (not yet evaluated): per-play sensitivity and affirmative-claim checks, `ENGINE_VERSION` v3.3-sensitivity-claims.** Each play now receives deterministic, one-input-at-a-time customer or net-contribution sensitivity for explicit reach, funnel-rate and owner economics ranges. The top three drivers are added to the plan agent's locked numbers. Claim evidence must be affirmative; requests and negated capabilities no longer substantiate a promise. These are labeled scenarios, not calibrated probabilities or joint outcomes; the UI still needs to render the attached values.

**Built (not yet evaluated): exact-run fact reference checks, `ENGINE_VERSION` v3.4-fact-reference-guards.** SEO, social, ad, and email agent outputs now fail quality checks if they cite an index outside the facts supplied to that run; the existing artifact saver binds valid indexes to tenant-scoped fact IDs. This verifies reference integrity, not semantic support for each sentence.

**Built (not yet evaluated): answer-first SEO content package, `ENGINE_VERSION` v3.5-answer-first-content.** SEO briefs now include a direct answer, research-informed FAQs, and standalone citable business claims. Fact indexes must resolve against the run's ordered facts, source URLs must have been read in the run, and the generated artifact includes answer-first copy, FAQs, and citations. This does not test live AI-search visibility, semantic citation fit, or guarantee rankings.

**Built (not yet evaluated): simulated CAC bounds, `ENGINE_VERSION` v3.6-simulated-cac-range.** Per-play CAC P10–P90 is derived as the inverse of the seeded customer draws used by the customer forecast; bounds are unbounded when a draw has no customers. This is a scenario range from input assumptions, not a calibrated empirical forecast. No paid real-model evaluation has been run for this change.

**Built (not yet evaluated): numeric comparison of structured strategy options, `ENGINE_VERSION` v3.7-decision-choice-check.** When multiple decision options map to measurable plays, deterministic lint checks the chosen option against the same-horizon customer, contribution, cost, budget, owner-time and delivery limits. A contradiction is a warning for the reviewer, not a hard gate; qualitative alternatives and reasons still require judgment. No paid real-model evaluation has been run for this change.

**Built (not yet evaluated): structured strategy focus, `ENGINE_VERSION` v3.8-structured-strategy-focus.** Flagged decision outputs now identify the exact primary play, supporting move, and recurring maintenance work; code verifies the primary play exists. Persisted schema remains compatible with earlier decisions. Live-model quality and UI rendering remain unverified.

**Built (not yet evaluated): capacity watch diagnosis, `ENGINE_VERSION` v3.10-capacity-watch.** Owner-reported capacity use at 80% is surfaced as a watch signal rather than a proven delivery constraint; the diagnosis supports delivery only when the stated monthly limit has been reached or exceeded, or the owner reports zero capacity. This is not a peak-load, commitments, staffing, inventory, or support-capacity model. No paid real-model evaluation has been run for this change.

**Built (not yet evaluated): measurement-period validation, `ENGINE_VERSION` v3.11-measurement-period-validation.** An explicitly supplied zero, negative, or non-finite funnel period now creates a conflicting-input diagnosis instead of silently falling back to 30 days. An omitted period retains the documented 30-day default. This guards deterministic normalization, not the accuracy of owner-provided counts. No paid real-model evaluation has been run for this change.
