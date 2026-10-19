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
