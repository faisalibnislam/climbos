# Evaluation and cost control

The approved paid evaluation budget is **$0** (owner, 2026-10-18). Everything in §1 runs for free. §2 needs a budget before it runs.

## 1. Free, now

| Check | Tool | Gives |
|---|---|---|
| Offline re-lint of saved outputs | `npx tsx bench/lint-audit.mts` | Lint error counts per run (D1 size) |
| Unit tests | `npx vitest run` (fake LLM) | 502 pass on 2026-10-18 |
| Calculator fixture | New unit test (spec §18) | Exact maths |
| Context-size probe | Replay saved bench inputs, measure characters per block | How often the 14k cuts bite (H2) |
| Website depth | Our fetcher on 5 Airly sites (fetch only, no LLM) | Text length per site (H5) |

## 2. Paid comparison (needs approval)

**Cases:** Formkit, Meetrao, Involets, Taskeni, Folevi. These are the owner's own sites, approved for evaluation.

**Arms (spec §02):**

| Arm | What | Git ref |
|---|---|---|
| A | Engine before the CMO changes | `bd071ca` |
| B0 | Live engine | `38326f6` |
| B1 | B0 + Phase B fixes | branch |
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
