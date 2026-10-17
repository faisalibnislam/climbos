## Reference: pre-registration card and readout template

**Experiment card**
```
Name:            Arrival-time guarantee in Google Ads copy
Decision:        Whether to make the guarantee the lead message on the site and GBP
Hypothesis:      Because 11/52 competitor reviews complain about no-shows,
                 a guarantee will lift ad CTR and booked-call rate.
Primary metric:  Ad CTR (volume exists here); secondary: booked calls / clicks (directional)
Guardrails:      Cost per booked call no worse than baseline; refund requests unchanged
Baseline:        CTR 4.0%, last 8 weeks (owner's Google Ads data)
Expected swing:  ≥30% relative (d = 1.2 pts)
Volume needed:   16 × 0.04 × 0.96 ÷ 0.012² ≈ 4,300 impressions per variant (≈2 weeks at current spend)
Run time:        min 14 days, max 28 days
Decision rule:   CTR ≥25% relative lift and guardrail holds → roll to site + GBP;
                 <10% → drop; between → iterate once
Confounds:       School holidays start day 18; no other ad or site changes during the test
Cost / effort:   £0 extra spend, 1 hour
Owner, dates:    Owner; 21 Oct – 11 Nov
```

**Volume quick table** (two variants, 80% power, 5% two-sided, ≈16·p(1−p)/d² per variant)

| Baseline rate | Detect relative lift | Absolute d | ≈ per variant |
|---|---|---|---|
| 3% | +30% | 0.9 pts | 5,750 |
| 3% | +100% | 3 pts | 520 |
| 10% | +30% | 3 pts | 1,600 |
| 20% | +30% | 6 pts | 710 |
| 4% (reply rate) | +100% | 4 pts | 385 |

These are planning approximations, not guarantees. Use them to decide whether a test is feasible, then state the threshold rule you will apply.

**Readout**
```
Test:            [name], [dates]
Registered rule: "[quoted from the card]"
Result:          Variant A: [x] / [n] = [rate]; Variant B: [x] / [n] = [rate]
Decision:        Scale | Kill | Iterate once (per the rule)
Confidence:      Strong | Directional, because [...]
Confounds:       [...]
Qualitative:     "[verbatim reply or call note]" ([source])
Next action:     [one action, owner, date]
```

**Message-lab defaults (ads)**
- 3–5 concepts that differ in angle, persona or offer, each rooted in a VoC theme; near-duplicates (colour, CTA wording) are not concepts.
- Equal budgets per ad set or the platform's A/B tool; same audience, placements and schedule.
- Leading read: CTR and thumb-stop; deciding read: cost per lead or booked call.
- The winning angle informs the homepage headline test next.
