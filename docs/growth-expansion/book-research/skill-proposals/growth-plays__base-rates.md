# growth-plays/reference/base-rates.md: proposed revision

Diff: `growth-plays__base-rates.diff` · size 4,565 → 6,157 bytes (+35%; new dated rows were requested). The growth-plays playbook (SKILL + reference) grows +14% in total. Status: proposal.

## Verification (done against `text/lean_analytics.txt`, 2013 content, 2024 reprint)

- PDF p.325 (Ch 23, Totango, 100+ SaaS): no card ≈15% of trials pay; card 40–50%; trial starts 0.5–2% with card vs 5–10% without.
- PDF p.326–327: the 25% appears only in a third funnel where marketing courts "serious evaluators".
- PDF p.331: best SaaS churn 1.5–3%/month; get under 5% before scaling (MacLeod).
- PDF p.341 (Ch 24, Free Mobile App): "aim for a conversion from free to paid of 2%".
- PDF p.99 (Ch 8): Hillstrom repurchase modes <40 / 40–60 / >60%.
- The old row cited Lean Analytics for 2–5%. The book says ~2%. The 40–60% card row has no source for 60%.

## Changes

| # | Change | Source refs | Rule class | Why |
|---|---|---|---|---|
| 1 | Free → paid: keep the 2–5% ClimbOS range; source now reads "Lean Analytics (2013) ~2%; Verna (2024, unsourced) 3–5%" | BK12-F48, BK12 verification; RECONCILIATION #1 | correction | Misattribution fixed. Range kept because diagnosis.ts REF mirrors it. |
| 2 | No-card trial: keep 15–25%; source states LA ~15%, 25% only for serious evaluators; Verna 10–15% | BK12-F46 | correction | Upper end weakly supported, now visible |
| 3 | Card trial: 40–60% → 40–50% with LA/Totango source | BK12-F46 | correction | 60% had no source; not used by code |
| 4 | Intro: "ClimbOS planning ranges; upper ends weakly sourced" | — | — | Honest provenance |
| 5 | New "Dated book references (context only)" table, each row with grade, date and scope: Totango trial starts; SaaS churn; Hillstrom modes; buyer concentration 40–60% (not 80%) and heavy-buyer instability; perceived differentiation ~10%; promo elasticity; Founding Sales author views (grade D) | BK12-F46, F47, F16; BK10-F14, F22, F28; BK11-F10, F11; BK09b-F5, F23, F37 | dated_benchmark (never a threshold) | Gives agents correct reference points instead of folk numbers, kept out of REF |
| 6 | "Folk numbers never cited as fact": 80/20, "retention 5× cheaper" | BK10-F14, BK10-K2 | strategic_preference | Blocks common myths |
| 7 | "No reliable benchmark" list adds small-business sales win rates | BK09b | — | Only grade-D author views exist |

## Rejected

| Proposal | Decision |
|---|---|
| Replace ClimbOS ranges with the book's numbers | Rejected: book benchmarks are dated context. Changing REF in diagnosis.ts is an owner decision (see RECONCILIATION #1). |
| BK12-K4 app day-1 drop (2012) row | Rejected: app-store economics changed; no skill uses it |
| BK12-F47 Price Intelligently / Evernote figures | Not added; low value, second-hand |

## Follow-up (code, not applied)

- `shared/agents/diagnosis.ts:63-68` REF text still says "practitioner range, grade C". It could cite the sources above. Ranges are unchanged, so no behaviour change.
