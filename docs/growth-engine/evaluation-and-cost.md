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

## 6. Proposal: the next paid check (not approved; $0 stands)

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
