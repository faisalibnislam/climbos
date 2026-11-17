# Strategy quality checks — 17 November 2026

These are isolated synthetic acceptance cases using ClimbOS's shared strategy generator and validators. They are not real businesses, measured growth, human expert sign-off or a complete Convex/browser acceptance test. Existing owner-authorized Haiku/Sonnet routes were used; no Codex model switch occurred.

## Four-case recheck with business-specific retrieval

`acceptance-v6-20261117` loaded engine **v3.152-offer-alternative-classification**, fingerprint `3c375f4bbddf1a423cec029ba52a9ea1acff94e52c50fde9dee049d0acb261aa`. Fourteen completed generation/review calls cost **$1.857688**. All four outputs were schema-valid. Two cleared the unchanged generation rubric; two did not:

| Case | Average / minimum | Saved ship result | Remaining issues |
|---|---:|---|---|
| Healthcare | 3.63 / 3.5 | False | Page specificity, clinician-confirmed process, enquiry handling and delayed-publication comparison remain weak. No deterministic lint findings. |
| Science / technical B2B | 4 / 4 | True | All eight scores are exactly 4. Distribution route/pitch, technical proof and late-publication measurement still need work. No deterministic lint findings. |
| Retail | 3.38 / 3 | False | Arbitrary demonstration topic, comparison denominators, staff scripts, repeat-purchase mechanism and staff/margin inputs remain weak. Style warnings remain. |
| Creator | 4 / 4 | True | All eight scores are exactly 4. Willingness to pay, collaboration specificity, consented critique format and workload remain open; style warnings remain. |

These are four synthetic samples, not an estimated overall pass rate or a claim that the changes caused higher quality. Retail scored lower than its prior v5 run. No gate, rubric threshold or score rounding was loosened. The plural-offer repair and cache-identity harness changes happened after this process loaded; do not relabel its generation evidence as v3.153 or retrofit new cache metadata.

### Separate anonymized comparison

```sh
pnpm strategy:anthropic --confirm-paid --stage industry-judge --cases science,creator --variant acceptance-v6-20261117 --compare-with acceptance-v4-20261117
```

Two separate calls, without the generation/review conversations, cost **$0.103841** and preferred v6 in both comparisons. Mapping was preserved in the records: science B=v6; creator A=v6. The judge reported no critical errors and a useful next step in both old and new drafts.

- **Science:** technical/procurement framing remained 4/5 and unsupported-claim avoidance 5/5 in both. Partner/education mechanism rose from 2 to 4 in this judge's assessment. It preferred the proposed engineer/purchaser page and partner-route research over reliance on existing enquiries, but still wanted concrete distribution and credible technical proof.
- **Creator:** paid-offer linkage rose from 2 to 3; collaboration/reusable learning remained 3; social situation fit remained 4. The preference was narrow. A passing generation rubric does not mean willingness to pay or a commercially viable offer was established. The judge's suggestion to invent a hypothetical price is not an owner instruction and was not implemented; supplied pricing and economic inputs still govern consequential recommendations.

These remain AI judgments, not independent human expertise, customer acceptance or measured impact. Current conditions differ across whole engine configurations; the comparison does not isolate retrieval, a model or a single prompt.

### Budget after these checks

All v6 generation and comparison calls: **16 completed calls, $1.961529**. Across the November 17 continuation: **55 completed calls, $6.871216**. The main ledger records **$57.295745** charged or held, plus historical **$1.896709**, totaling **$59.192454** against the cumulative $100 cap. Unresolved historical holds are retained, so this is not a statement that every held dollar was spent. The evaluation lock was released normally. No customer data, customer contact, publishing, live offer or campaign action was involved.

Healthcare/retail acceptance, repeated cross-industry quality, human judgment, real-business facts, operating capacity and measured outcomes remain open. The next real-business case requires an owner-selected website/goal and whatever business inputs are actually available; missing values must remain unknown. Neither the passing samples nor the old completed code-gap roadmap establishes completion of all 410 requirements.

## Retail and creator follow-up after context repair

The same approved synthetic briefs were rechecked as `acceptance-v5-20261117`, with engine **v3.150-declined-offer-clauses**, fingerprint `620bdb7431517dfd2b03b62125924ce5a1d4d10da050a39c85ab6265ee17955f`. Eight completed calls cost **$1.103572**. Both returned complete schema-valid output, and neither passed: retail **3.69 / 3.5**, creator **3.5 / 3** (average / minimum). Neither failed record was rewritten.

The default writer now used precedents (retail CP-062; creator CP-046), but the examples did not establish better strategy quality. Retail's retained two lint findings were false positives: comparing a demo with a discount and recording staffing uncertainty. [The alternative/unknown-wording repair](growth-engine/offer-alternative-classification-audit.md) removes both when re-linting the unchanged draft. Its original below-bar review remains unchanged: the central customer obstacle, distinctiveness, baseline and practical sequence still need improvement. Creator was lint-clean but needed a better buyer diagnosis, less week-one work, honest handling of a remembered baseline, and a more distinctive portfolio.

The process loaded before the [business-specific retrieval query](growth-engine/business-precedent-query-audit.md) repair. It is not post-repair quality evidence. The eight calls bring completed calls in this continuation to **39**, costing **$4.909687**. Main-ledger used/held **$55.334216** plus historical **$1.896709** totals **$57.230925** against the cumulative $100 cap. Holds remain intact. No customer or business action occurred.

## Four approved industry checks after scoring repair

The owner explicitly approved healthcare, science, retail and creator synthetic briefs for Anthropic quality tests within the cumulative $100 cap. The `acceptance-v4-20261117` process loaded engine **v3.147-reviewed-draft-selection**, fingerprint `23b7bd0d23b704031103fdde8cc6a7fb35b2e7d9f1dcb9c9225d645cbb1286be`. It completed **16 calls costing $1.929616**. All four returned complete schema-valid output, and **none cleared the rubric** after its allowed revision.

| Case | Retained review average / minimum | Material finding |
|---|---:|---|
| Healthcare | 3.63 / 3 | No deterministic lint issues; comparison with an existing booking-page improvement/no change and capacity-led sequencing remained weak. |
| Science/technical B2B | 3.88 / 3 | No deterministic lint issues; lacked a sufficiently useful diagnosis step and precise quote-ready definition; owner workload needed improvement. |
| Retail | 3.5 / 3 | Six original deterministic findings, including a false discount classification; unsupported evidence basis, missing history/capacity inputs and weak concrete test definition remain. |
| Creator | 3.75 / 3 | No deterministic lint issues; lesson needed closer connection to the actual portfolio and useful interpretation with little/unknown audience data. |

Audit of the real default path then found that its changed task heading omitted creative precedent context, while other paths truncated critic records. [That integration is repaired](growth-engine/strategy-precedent-context-audit.md), and [misleading lexical fit reasons](growth-engine/precedent-fit-signals-audit.md) were corrected. These changes happened after this process loaded; **do not relabel v4 as post-fix quality evidence**. [The retail clause fix](growth-engine/declined-offer-clause-audit.md) removes one false lint finding when rechecking the unchanged output; five other issues remain. No failed output or provider receipt was overwritten.

After v4, the main ledger held/charged **$54.230644** plus historical **$1.896709**, totaling **$56.127353** against the cumulative $100 cap. This includes retained historical holds and is not a claim that all held money was spent. Across the earlier runs and v4, 31 completed calls in this continuation cost **$3.806115**. No customer was contacted and nothing was published.

## What the live checks established

| Case/run | Saved result | Interpretation |
|---|---|---|
| Ecommerce, `acceptance-20261117` | Schema passed; ship false; average 3.63 | Benchmark lacked the application's timing clock. The primary fit-check premise and practical content were also weak. |
| Education, `acceptance-20261117` | Initial schema passed; retained ship false; average 3.5 | Invalid references, missing benchmark timing context, a false offer flag; attempted revision truncated at 16k tokens. |
| Ecommerce, `acceptance-v2-20261117` | Schema passed; ship false; average 3.5 | Timing was handled as evergreen. A further colon form of a declined offer was incorrectly flagged. Current deterministic lint on the unchanged output is clean after the repair, but its original AI assessment remains below the bar. |
| Education, `acceptance-v2-20261117` | No complete output | Draft stopped at 16k tokens, including reasoning. No incomplete plan was accepted. |
| Education, `acceptance-v3-20261117` | Schema passed; historical assessment falsely reported ship true / 4 after rounding | Raw average 3.5625, minimum 3.5: below the required average of 4. Corrected assessment: ship false / 3.56. Complete draft, not accepted quality. |

The v3 education writer/reviewer cost **$0.238062**. Its first draft used 11,631 output tokens, including 3,441 reasoning tokens, and incorrectly stopped without revision because of the rounding bug. It ran with a 24k ceiling, but used fewer than the earlier 16k limit: this sample does **not** prove that the ceiling change caused its better quality or completion. Prior truncations nevertheless exposed insufficient room for some valid runs. The extra ceiling is reserved before provider calls and never overrides stored spending caps.

Generation fingerprint for that education run: `4aad18e7b4a9a5097d20858dddd7ad395c5d297b5e9e87166e852d96a4bedcae`, engine `v3.144-strategy-output-budget`. It is a selected-file fingerprint, not a complete dependency manifest. Later reference-approval and score-integrity changes are deterministic and were tested separately; do not describe the paid run as generated by a later engine.

The original provider response and saved result were not rewritten. Read-only re-assessment with `v3.146-review-score-integrity` preserved all eight raw scores (seven 3.5s and one 4), returning average 3.56, minimum 3.5 and ship false. This is a deterministic correction, not a new model review. No historical strategy was silently regraded or approved.

## Separate held-out comparison

```sh
pnpm strategy:anthropic --confirm-paid --stage industry-judge --cases education --variant acceptance-v3-20261117 --compare-with industry-baseline
```

A separate Sonnet call, blind to the generation/review conversation, preferred the new education plan to the saved November baseline. Cost: **$0.037879**. Both use the same synthetic case, but different end-to-end engine configurations and evaluation dates; this does not isolate a model, prompt or budget effect.

| Held-out criterion | New plan | Preserved baseline |
|---|---:|---:|
| Teacher/user versus school/payer and buying timing | 5/5 | 3/5 |
| Reusable assets, school partnerships and learning evidence | 4/5 | 3/5 |
| No assumed student access or permission for minors' data | 5/5 | 4/5 |

The judge reported no critical errors and a useful next step in both plans. This preference does not override the failed generation rubric. These are **AI judgments**, not verified accuracy. It favored the new plan's separate teacher/payer sections, forwardable page, comparison design, and a bold classroom-practicals library informed by teacher notes. It still asked for explicit term/budget-cycle questions and a route to initial reviewers when existing teacher contacts are scarce. The model was also lenient about the phrase “No audience or contact permission exists”: the input establishes that none was supplied, not that none exists. That distinction should be clarified before a real owner uses such wording. There is no evidence of access to students, consent or classroom outcomes.

## Fixes triggered by failures

- [Evaluation clock](growth-engine/industry-evaluation-clock-audit.md): corrected standalone input; original campaign-timing prompt unchanged.
- [Declined promotion classification](growth-engine/declined-offer-classification-audit.md): non-offer work no longer requires discount economics merely for declining a discount.
- [Full strategy output budget](growth-engine/strategy-output-budget-audit.md): more room for the required portfolio, with matching reservations and unchanged caps/starter behavior; also the colon follow-up.
- [Reference approval](growth-engine/strategy-reference-approval-audit.md): invalid claimed sources block approval, while uncited original hypotheses stay available.

- [Review score integrity](growth-engine/review-score-integrity-audit.md): preserve fractional scores and reject malformed required reviews; never promote a borderline draft by rounding.

## Cost, reproducibility and remaining acceptance

The fifteen completed provider calls across these runs and the comparison cost **$1.876499**. The main ledger's charged/held total was **$52.301028**, plus **$1.896709** retained in the historical ledger: **$54.197737** conservatively used/held against the existing $100 allowance. Held totals include prior unresolved allocations and are not actual-spend claims. No hold was removed or reset. Rates were checked against [official pricing](https://platform.claude.com/docs/en/about-claude/pricing) on 17 November 2026.

Original ignored outputs, provider receipts, inputs and phase histories remain under `bench/cache/anthropic-real-2026-11-09/`; no failed output was rewritten. The benchmark uses frozen research and omits tenant diagnosis/learning and current external research. More industries, repeated runs, actual business inputs, original-strategy expert review, live-account permission tests, owner usability and measured outcomes remain separate acceptance work. A complete draft and a favorable comparative AI judgment do not establish accepted strategy quality, complete all 410 requirements or establish a 25-year marketing-director standard.
