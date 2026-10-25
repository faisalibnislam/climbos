# Growth engine audit

Mode: AUDIT_AND_DESIGN (spec §00, §01, §30). Date: 2026-10-18. Code at `38326f6` plus the Engine Lab pause.

## 1. Request lifecycle (as built)

| # | Stage | Where | What happens |
|---|---|---|---|
| 1 | Intake | `convex/schema.ts` `businesses`, `goals`, `businessFacts` | Name, site, type, currency, goal (statement, horizon, ad budget). **No price, margin, retention, owner hours or baseline metrics.** |
| 2 | Website read | `convex/ai/research.ts` `researchWebsite(site, 2)` | Homepage plus 2 same-origin links matched by regex (`pricing\|features\|about…`). Firecrawl only if `FIRECRAWL_API_KEY` is set; it is not set in prod. |
| 3 | Facts | `shared/ai/tasks.ts` `factsBlock` | Free-text `[i] (category) statement`. Source excerpts are purged by the `purgeExpiredSources` cron. |
| 4 | Brief | `convex/jobs.ts` `businessBrief(job)` | Business, goal, voice, learned rules, language, facts. |
| 5 | Quick take, channel fit | `convex/jobs.ts` `buildStrategy`; `scoreChannels` | Deterministic 8-factor score over 30 business types, plus an LLM channel-fit agent. |
| 6 | Insights | `convex/jobs.ts:662` | `JSON.stringify(insights).slice(0, 14_000)` plus pooled learned rates. |
| 7 | Growth plays | `shared/agents/runtime.ts` `runAgent` | research (OpenAI `web_search`) → draft (Basic: best of 2) → critic → revise. Lint: `lintCopy`, `untracedNumbers`, `lintPlays`, `lintEconomics`, `lintWordCaps`. |
| 8 | Plan | `convex/jobs.ts:733` | Locked numbers + `JSON.stringify(plays).slice(0, 14_000)` + scorecard + insights. Same runtime. |
| 9 | Consistency | `shared/agents/consistency.ts` `reconcile` | Luna pass; kept only if lint errors don't rise. |
| 10 | Save, show | `saveStrategy`; `src/components/app/plan/*` | Plan cards; the "Sources" panel lists **business facts only**, not web sources. |

### Model and API config

| Item | Value | Where |
|---|---|---|
| API | Responses API, `instructions` + `input`, strict `json_schema` | `shared/ai/openai.ts` |
| Models | Basic and Expert start on `gpt-6-luna`; paid Expert may use `gpt-6.1-sol` for an eligible revision after an evidence-backed critic escalation | `shared/agents/routes.ts`, `shared/agents/runtime.ts`, `convex/jobs.ts` |
| Effort | Draft high, critic medium/low; `thinkingOff` → `none` | `shared/agents/specs.ts` `base()`, `openai.ts` `effortFor` |
| Long turns | Background mode (`store:true`), resumed by `providerRef` | `convex/jobs.ts:331` |
| Retries | Rate limit ≤10 s sleep; one lint repair; `repair_budget` / `uncertain` stop states | `convex/jobs.ts:191-273` |
| Cost | Reservation before run; extra review and measured Expert escalation are reserved before each call. Growth-plan starting estimate: Basic 26 credits, Expert 19 | `shared/economics/credits.ts`, `convex/jobs.ts` |
| Email | Plan engine does not use Resend | `convex/jobs.ts` (no reference) |

## 2. Verified defects

Each one was checked in code. Its effect on quality is listed separately (§3).

| ID | Defect | Evidence |
|---|---|---|
| D1 | The number-trace lint can't see the task context. `evidenceOf` = brief + facts + untrusted context + research notes. Insights, scorecard, plays and locked numbers are excluded, so numbers taken from those inputs get flagged `invented_fact`, with the instruction "Remove them". | `shared/agents/specs.ts:228`, `shared/agents/lint.ts:76-124`. Offline re-lint of saved bench outputs (`bench/lint-audit.mts`): **31–54 `invented_fact` errors per plan, 9–32 per plays output.** |
| D2 | Silent truncation. Plays and insights are cut at 14,000 characters, mid-JSON. Research notes are cut at 40,000 characters, and the critic sees only 12,000 of them. | `convex/jobs.ts:662`, `:733`; `shared/agents/runtime.ts:218`, `:272`. Expert plays measured 12,319 characters *before* the `model` fields were added. |
| D3 | No intake for unit economics, so the model must assume price, margin and retention. | `goals` schema; `businessBrief` |
| D4 | Unknown numbers can't be left blank. `strictSchema` makes every field required, so the model has to guess. | `shared/ai/openai.ts` `strictSchema` |
| D5 | Web research sources never reach the plan. They live in step checkpoints, aren't saved with the strategy and aren't shown. No check that cited URLs were actually fetched. | `runtime.ts:218`; `PlanSections.tsx:466` |
| D6 | P10/P50/P90 aren't percentiles. P10 = P50×0.4 and P90 = P50×2. | `skills/growth-plays/SKILL.md:45` |
| D7 | The maths is too simple. Missing: churn, overlap between plays, contribution margin, allowable CAC and break-even CPC (spec §15–16). | `shared/agents/economics.ts` |
| D8 | Research depth: homepage + 2 regex-picked pages; no renderer in prod. | `convex/ai/research.ts` |
| D9 | Evaluation is n=1 (Formkit), one run per arm, with a judge from the same model family as the writer. | `bench/run.ts`; `bench/results/*` |
| D10 | Engine Lab sent cross-tenant critic text to the model with no redaction. **Paused 2026-10-18** (`ENGINE_LAB_PROPOSALS` must be `on`). | `convex/engineLab.ts` `recentFeedback`; `convex/engineLabActions.ts` |

## 3. Hypotheses (not proven)

| ID | Hypothesis | Test |
|---|---|---|
| H1 | D1 is the main cause of hedged, contradictory plans: revisions strip real numbers to satisfy the lint. | Re-run the saved inputs with D1 fixed; count numbers removed between draft and final. |
| H2 | D2 truncation actually happens on Expert plans in prod. | Log context sizes per run; check the share above 14k. |
| H3 | Best-of-two (Basic) and the critic loop add cost without enough quality. | Arm C (single call) vs arm B on the same evidence. |
| H4 | Guessed economics (D3, D4) drive the judge's "unprofitable play" complaints. | Same case with and without owner numbers. |
| H5 | JS-rendered sites give thin facts. | Compare text length from our fetcher vs a rendered fetch on five benchmark business sites. |

## 4. Likely causes of weak strategy quality (ranked)

1. **D1:** the lint tells writers to delete real numbers.
2. **D3 + D4:** no owner economics, and no way to say "unknown".
3. **D2:** key context silently cut.
4. **D7 + D6:** forecasts look precise but rest on heuristics.
5. **D5:** the owner can't inspect the evidence.
6. **D9:** we can't tell whether a change helped.

## 5. Status

D1–D8 and D10 have fixes live as of 2026-10-18 (see `backlog.md`). D9 (evaluation) has tooling ready but no paid runs yet: budget is $0.

## 6. Already live before this audit

These shipped before AUDIT_AND_DESIGN mode began: economics lint, locked numbers, consistency pass, word caps (`77fd896`, `85d8691`, `38326f6`). The owner chose to keep them and to measure them as arm B. Their interaction with D1 is untested.

## 7. Not inspected or verified

- Prod data: real run counts, failure rates, how often truncation hits, credit margin per plan.
- Owner outcomes after a plan (no outcome data yet).
- Human quality scores: none exist; the owner will review blind.
- The cmo-v1 benchmark was stopped by the owner, so there is no result for the live changes.
- Firecrawl output (no key).
- Tenant isolation in `learnedRates`: k≥5 is in code, but re-identification risk was not tested.
