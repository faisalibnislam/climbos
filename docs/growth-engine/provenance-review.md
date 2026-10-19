# Provenance review: commit 404c466

Scope: source tags on growth-play inputs.

- **Mode:** read-only review.
- **Changes:** no code or production changes.
- **Evidence:** file:line references plus adversarial probes. The probes are local scripts: no model calls, no network.

## Verdict

The tags can't be upgraded by the model. Zod strips any `check` the model writes (`shared/ai/openai.ts:263`), and the JSON schema forbids extra fields (`:32`). The problem is that two of the code checks are too weak: they label coincidences as verified.

## Findings

| # | Severity | Where | What's wrong | Probe result |
|---|---|---|---|---|
| F1 | High | `shared/agents/provenance.ts:131-135` | An `owner` tag is kept as `owner_facts` when the number appears **anywhere** in confirmed facts. The check ignores metric, unit, period and business. | "80% of our customers are agencies" confirms an 80% margin. "29 countries" confirms $29 revenue. "5% discount" confirms 5% churn. "$29 per year" confirms $29 a month. A competitor's "$29/month" confirms ours. |
| F1b | High | `convex/orgs.ts:362-370`, `convex/jobWrites.ts:136` | "Confirmed facts" include researched website facts that one "Confirm all" click approves. `owner_facts` therefore doesn't mean the owner gave the number. `job.facts` doesn't even carry `provenance` (`jobWrites.ts` `jobContext`). | Design gap |
| F2 | High | `provenance.ts:102-113, 136-137` | `research_notes` means "a matching number sits within 3 lines of any mention of the cited **domain** in the model-written notes". This shows the page was retrieved, not that it supports the claim. | "15% off annual plans" checks a 15% trial-to-paid rate. A different page on the same domain counts. Only one of rate/low/high has to match: an unrelated "30% of visitors bounce" checks a 2% reply rate. |
| F2b | Medium | `convex/jobs.ts:417` | Every source URL is appended to the end of the notes, so every cited domain lands next to the notes' final Sources section. That widens the area where coincidences match. | "250 employees" next to a Sources list checks a reach of 250 |
| F2c | Medium | Notes are model-written | Even a perfect match is against the research model's summary, not the page text. Nothing reads the actual page. | — |
| F3 | Medium | `provenance.ts:61` | The `ownerHour` tag becomes `owner_input` whenever `ownerHourUsd > 0`, whatever its tag says. | A bare `ownerHourUsd: 50` shows "confirmed by you" |
| F4 | Low | `provenance.ts:43-48`, `convex/jobWrites.ts` (`expert` is `v.any`) | A persisted `check` is trusted on read without any marker of who set it. Today only server code writes it, but nothing guards that. | A saved `check: "research_notes"` is shown as-is |
| F5 | Info | `convex/workspace.ts:401` | Owner economics are re-applied when the plan is read. Values and tags become `owner_input`, but the locked plan text was written with the old values. The existing "answers newer than plan" banner covers this. | Legitimate, not a silent upgrade |

### Full path audit: can any step silently upgrade a check?

| Step | Code | Upgrades? |
|---|---|---|
| Model output | `openai.ts:263` (Zod parse strips unknown keys), `:32` (`additionalProperties: false`) | No |
| `verifyTags` | `provenance.ts:127-176` | **Yes, too easily (F1, F2)**. The default branch drops `check` (fine). |
| Owner override | `economics.ts` `applyOwnerEconomics` | Only for metrics the owner set in `unitEconomics` (legitimate) |
| `withDerivedAssumed` | `provenance.ts` | No: derives `assumed` from the tags |
| `withForecasts` / `playMaths` / `lockedNumbers` | `economics.ts` | No: read only |
| Consistency pass | `shared/agents/consistency.ts` | No: edits plan text only |
| Persistence | `jobWrites.ts` `saveStrategy` | Stores as given, unvalidated (F4) |
| Read-time owner override | `workspace.ts:401` | Legitimate (F5) |
| `read()` / `economicsSources` | `provenance.ts:43-61` | **`ownerHour` fallback (F3)**; trusts persisted checks (F4) |
| UI | `ExpertPlan.tsx` | No: renders what it gets |
| Resume after yield | `runtime.ts` (research phase checkpoint) | No: notes come back from the checkpoint |
| Missing notes | — | Research stays `reported` (correct) |

## Proposed minimal fixes

**F1, F1b: owner verified from structured inputs only.**
- Drop number matching against facts.
- `owner` is kept only when `businesses.unitEconomics` has that exact metric. Each metric has a fixed unit and period: revenue per customer per month, margin share, monthly churn, hour value, hours a week. `applyOwnerEconomics` then sets `owner_input`.
- A model-tagged `owner` for anything else becomes `assumption`, with the reason "not confirmed by you; add it under Sharpen this plan".
- Record `confirmedAt` (`unitEconomics.updatedAt`) on the tag so the owner can see how current it is.
- **Decision needed:** should confirmations older than some age (for example 12 months) count as stale?

**F2: research verified against the page itself.**
- Each `research` tag must carry a verbatim `quote` (at most 200 characters) from the cited page.
- After the plays agent finishes, our own fetcher (`convex/ai/research.ts`) retrieves each cited URL: at most 8, with a 10-second timeout, honouring robots.txt, at no model cost.
- A tag is `source_verified` only if all of these hold:
  - the page loaded;
  - the quote appears in the page text (normalized);
  - the quote contains the number in the right unit (% for rates, currency plus a per-month marker for revenue);
  - the quote names or implies the metric (a step-name keyword, or "reply", "convert", "churn", "margin").
- Otherwise:
  - `retrieved`: the page loaded but the claim couldn't be matched;
  - `reported`: no page, or no quote.
- Stop counting low/high-only matches. Stop appending URLs to the notes for matching (F2b).
- The UI shows "verified on page", "page retrieved, claim not matched" or "not checked".

**F3: `ownerHour` is `owner_input` only when `sources.ownerHour.check === "owner_input"`.**
- `applyOwnerEconomics` sets that today.
- A bare `ownerHourUsd` reads as `reported`.

**F4: guard persisted checks.**
- Code stamps each check with a `checkedBy` engine version.
- `read()` accepts a check only when that stamp is present. Anything else reads as `reported`.

These are four small changes in `provenance.ts`, `economics.ts`, `jobs.ts` and `jobWrites.ts` (pass fact provenance and the fetch step), plus one schema field (`quote`). There's no change to routing and no new model calls. The fetch is our own code.

## Test gaps (none of these exist today)

| Case | Expected after the fix |
|---|---|
| Coincidental owner match ("80% of customers", "29 countries", competitor price) | `assumption` |
| Wrong unit or period ("$29/year" for revenue per month, "5% discount" for churn) | not verified |
| Researched fact confirmed with "Confirm all" | not owner |
| Unrelated research passage with the same number | `retrieved` or `reported` |
| Only low/high matches | not verified |
| Same domain, different page | not verified |
| Stale citation: page 404, moved, or quote no longer present | `reported` or `retrieved` |
| Missing notes or a failed research phase | `reported` |
| Quote present but number in another unit | not verified |
| Legacy plan: no tags, tags without check, forged `check` without stamp | not labelled / reported |
| `ownerHourUsd` without an owner tag | `reported` |
| Read-time owner override | `owner_input` only for metrics in `unitEconomics` |

## Real-model end-to-end test (needs an approved budget)

**Proposal:** one Basic and one Expert plan on the Formkit case.

- **Command:** `bench/run.ts --cases formkit --tasks strategy --arms basic,expert --pointwise off --max-usd 3`
- **Judge:** none.
- **Afterwards:** an offline script reports:
  - each tag's source and check;
  - how many `owner` tags were downgraded;
  - research verified vs retrieved vs reported;
  - unsupported claims (`invented_fact`, `citation` and `provenance` lint findings).
- **Expected cost:** about $1.30–1.60, from earlier bench runs. The run stops automatically at $3.
- **Order:** best after the fixes, so the run measures the hardened checks. It can also run first as a baseline.

## Results after the fixes (branch `provenance-hardening`, 2026-10-19)

**Implemented:** F1–F4, plus adversarial tests in `tests/unit/provenance.test.ts`. All 633 tests pass. The branch is not pushed or deployed.

**Real-model run:** Formkit, Basic + Expert, no judge, capped at $3.

- Command: `bench/run.ts --arms basic,expert --compare none --pointwise off --max-usd 3`
- Offline report: `bench/provenance-report.mts`

| | Basic | Expert |
|---|---|---|
| Cost | **$0.264** | **$0.918** (total $1.18) |
| Time | 24 min | 30 min |
| Pages returned by search | 9 | 14 |
| Input tags after checks | 11 assumption · 7 planned · 2 benchmark (not checked) | 20 assumption · 6 planned · 1 benchmark (not checked) |
| Research tags | 0 | 0 |
| "Owner" tags downgraded | 0 (no owner economics in this case) | 0 |
| Funnel text citing pages the tags don't claim | 0 | 0 |
| Unsupported numbers in text (lint) | 4 | 1 |

**What the unsupported numbers are:** planner-made test sizes ("Planned: spend $108 over 21 days for about 36 clicks", "$120 fully loaded") and a date ("by Oct 26"). None is a factual claim about the business or market. The lint flags them because its label words don't include "planned" and it doesn't recognise month-day dates.

**Not exercised by the real run:**
- **Research verification:** both models chose assumption or benchmark over research, so no research tag reached the page check. The page check is covered only by unit tests.
- **Owner verification:** this bench case has no owner-confirmed economics.

**Observations**
- **Revenue:** both arms labelled revenue an assumption ($57 and $47.50 per account), derived from the confirmed pricing fact (Pro $6/seat, Business $19/seat) times an assumed seat count. That's an honest label for a derived number.
- **Benchmarks:** the benchmark tags point at the outreach rates ClimbOS supplies in the prompt, which are model-reported and correctly not checked.
- **Trade-off:** requiring a verbatim quote seems to push the writer away from research tags entirely. That's honest, but more plays will read as assumption-based scenarios even when they're loosely grounded.

**Possible next steps (not done)**
1. Add "planned" and month-day dates to the lint's label and date rules. This removes the false positives above.
2. Allow `research` from the owner's own site pages already fetched at onboarding (`pagesText`). Verify quotes against that cached text, so real prices can be "verified on page" without a web search.
3. Run one bench case with owner economics set, to exercise the owner path end to end.
