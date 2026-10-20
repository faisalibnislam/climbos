# Integrating the knowledge expansion and the six reference books

Written 2026-10-20 against `growth-engine-v2` @ 2f88495. **This is a plan.** No application code changed for it.

**Inputs read:**
- `docs/growth-expansion/`: index, RECONCILIATION, CLAUDE_CODE, six guides, evaluation pack, business-type playbooks, platform rules, public cases.
- `docs/reference-books/`: tables of contents and coverage only.
- `docs/growth-intelligence-2/` is byte-identical to `docs/growth-intelligence/`. There's nothing new in it; keep one copy.

## 1. What the books already gave us, and what's missing

The six EPUBs in `docs/reference-books/` have the same SHA-256 hashes as the expansion pack's BK01–BK06. So the pack is an adaptation of these exact files, but its own coverage notes call it "targeted reading", not exhaustive. All six files open. Coverage by chapter, from the EPUB tables of contents against the pack's locators:

| Book | Covered by the pack | High-value gaps for ClimbOS | Readability |
|---|---|---|---|
| BK01 Rumelt | Ch 3, 5, 7, 8, 16 | Ch 10 Focus; Ch 11 Growth (growth for its own sake); Ch 17–18 (quick closure, inside view vs outside view, herding) | Clean |
| BK02 Monetizing Innovation | Ch 4–7, 9, 12 | Ch 8 pricing strategy (penetration vs premium, strategy document); Ch 10 value communication; Ch 11 behavioural pricing tactics (each must be tested); Ch 14 implementation pitfalls | Clean |
| BK03 Obviously Awesome | Steps 1, 4–10, After | Ch 1–2 (positioning as context, the components); Step 3 (letting go of the old positioning); the Step 8 market-frame methods (the longest chapter) | Clean |
| BK04 Testing Business Ideas | Hypothesis types, evidence, decide | **The experiment library**: discovery tests (interviews, search and forum analysis, support analysis, ad and link tests, landing pages, explainer video, pre-sale, letter of intent, concierge, Wizard of Oz, etc.). Each has a cost, run time, evidence strength and prerequisites. The pack skipped it. | **Fragmented**: 4 split files, no chapter list, interleaved columns. Each test card needs careful reading, and some diagrams can't be read. |
| BK05 The Mom Test | Ch 1, 2, 5, 7, 8 | Ch 3 important questions (the "scary" questions, prepare your list of 3); Ch 4 keeping it casual; Ch 6 finding conversations (going to them, the advisory flip); note-taking notation | Clean |
| BK06 Trustworthy Experiments | Ch 2, 3 (peeking), 14, 19, 21, 22 | Ch 3 threats (novelty and primacy, Simpson's paradox, survivorship, intention-to-treat, multiple tests); Ch 6–7 metrics (OEC, guardrails, metric types); **Ch 10–11 complementary techniques and observational causal studies (the realistic toolkit for small businesses)**; Ch 15 ramping; Ch 23 long-term effects | Clean (TOC readable) |

**Rules for the new knowledge work:**
- Original ClimbOS applications with chapter references.
- No quotations, no page numbers, no business facts, no results.
- Author concept vs ClimbOS policy labelled, as the pack does.
- Unreadable parts of BK04 reported as such.

## 2. Already implemented vs proposed

**Implemented in this repo** (verified; most not yet evaluated):

| Capability | Where |
|---|---|
| Evidence source tags on economics and plays; checked receipts for cited pages | `shared/agents/provenance.ts` |
| Unknown economics → `needs_input`; unknown hours and audience in `quality.unknowns` | `shared/agents/quality.ts`, `convex/jobs.ts` `planUnknowns` |
| Unsourced numbers and miscounted customers are hard failures | `HARD_RULES`, `lintOutcomeNumbers` (`shared/agents/specs.ts`) |
| Channel and audience cites resolve to facts or read pages | `lintCites`, `resolveCites` (2f88495) |
| Conflicting prices and trial lengths kept side by side | `shared/agents/conflicts.ts` (2f88495) |
| Strategy kernel (constraint, competing explanations, options, falsifier) | `shared/agents/decision.ts`. **Behind the `decision_contract` flag, which lost bench Run 4 (1–1–3), so it's off.** |
| Low-price products: existing page and free route first; any paid plan counts | `lintLowPriceFirst`, `lintAnyPaidPlan` |
| Comparison positioning names a real alternative; offer claims checked | `lintComparisonPositioning` (specs.ts:715), `lintOfferClaims` (specs.ts:733) |
| Superlatives flagged | `shared/agents/lint.ts:132`. Warn only, not error. |
| Experiments in plans | Method enum at `shared/ai/tasks.ts:92`; `lintActionPlan` only checks that a dated test exists (specs.ts:548) |
| Sample-size formula | Prose only, in `skills/experiment-design/SKILL.md:38`; the model does the maths |
| Experiment outcomes with observed / attributed / incremental labels | Item 16, branch `claude/experiment-outcomes-b4045c` (8bf130d), not merged |
| Prompt-injection wrapping of untrusted pages | `untrusted()` in `shared/ai/tasks.ts`. Page reading (item 11) is in progress in another session. |
| Idempotent publishing and ads; cold email | Cold email is item 15, in progress |

**Not in the repo (proposed below):**
- Deterministic calculators for decisions: pricing, contribution, rate comparisons, sample-ratio mismatch, sample size.
- Delivery-capacity and service-area gates.
- Evidence strength for customer claims (stated interest, behaviour, payment).
- An experiment feasibility check.
- Business-type routing for Mac apps, agencies and marketplaces.
- Selected knowledge retrieval with exceptions.
- Platform-eligibility records.
- Rules for using public cases.
- Climb AI decision mode.

## 3. Prioritised plan

Order rule: measure first; deterministic code before prompt text. Run 4 showed that adding reasoning fields through prompts can make plans worse. Each slice ships with tests and is benched before release.

| # | Slice | Engine area | Evidence it's needed | Eval cases it targets | Type | Paid run? |
|---|---|---|---|---|---|---|
| **0** | **32-case harness and baseline** (section 4) | All | No harness exists; the pack's cases are unrun | All | Bench code | Yes, baseline |
| 1 | **Decision calculators** in `shared/analysis/` (contribution and margin with a declared cost boundary; price floor at a target margin; percentage-point vs relative change; sample-ratio check; sample size and duration; before/after with confounders flagged). Exposed as read-only Climb AI tools and used by the plan lints. | Pricing, experimentation | Formula in prose only (experiment-design:38); Climb AI has no calculators (`convex/lib/climbTools.ts`) | EV03, 06, 08, 12, 14, 15, 20, 28, 31 | Code | No |
| 2 | **Climb AI decision mode.** For a decision question (price, test result, "should I…"), use the calculators, label each evidence kind, name what would change the answer, and give the next step. Normal chat stays as it is. | Recommendations | Low effort, thinking off, ~60 words (`convex/climb.ts:48, :282`) | Most of EV02–EV32 | Prompt + routing | Bench |
| 3 | **Experiment feasibility lint.** An A/B or holdout needs a population and a minimum worthwhile effect. If it can't finish inside its duration at the stated traffic, it fails and must switch to an interview, assisted pilot, or one bigger change with a before/after label. | Experimentation | Only "a dated test exists" is checked (specs.ts:548) | EV05, 08, 14, 22, 28; BK06 Ch 10–11 | Code | No |
| 4 | **Capacity and service-area gates.** Delivery capacity (slots or hours a month) and service area become owner inputs, separate from owner hours. Plays can't forecast more customers than the business can serve, and a local business can't get national paid demand. | Channel selection, strategy | Only owner hours exist (`convex/schema.ts:371`); geography is just a score penalty (`shared/acquisition/scoring.ts:232`) | EV09, 11, 17, 21 | Code + schema | No |
| 5 | **Claim ledger in copy and positioning.** Unverified capabilities ("10x faster", "24/7 support", "leading platform") become errors unless a fact supports them. "No customers yet" means provisional positioning only. | Positioning | Superlatives are only a warning (`lint.ts:132`) | EV04, 07, 11, 23, 24 | Code | No |
| 6 | **Evidence strength on customer claims.** Facts and owner answers carry a kind: stated interest, observed behaviour, commitment or payment, or measured. Stated interest can't count as demand, and pricing advice must label stated willingness to pay. | Research, pricing | Facts only carry where they came from (`schema.ts:449`) | EV02, 10, 18, 27, 31 | Code + schema | No |
| 7 | **Business-type routing.** Add play catalogs for Mac apps, agencies and marketplaces, with decision branches from the pack (BT-02/03/06). Each catalog loads only for its type. | Strategy, channel selection | Only SaaS, local and ecommerce catalogs exist (`skills/plays-*`) | EV05–07, 09–12, 21–24 | Prompt knowledge | Bench |
| 8 | **Selected retrieval** (item 10 plus the pack). Index the guides, the reconciliation rules and the gap chapters as records (decision, applies when, doesn't establish, exceptions). Send each agent only the matching records, with their exceptions, instead of whole skill files. | All | Whole skill files go into every prompt (`shared/agents/runtime.ts:150`) | Cross-business cases | Prompt + code | Bench |
| 9 | **Platform eligibility records** (RULE-01..06) in the capability context. Blocked or unverified features stay unavailable (e.g. iOS product-page tests aren't assumed on macOS). | Channel selection | Capability context covers connections only (`shared/agents/capacity.ts:35`) | EV05, 19 | Code | No |
| 10 | **Public cases as hypotheses.** Another company's uplift can't enter a forecast; a lint blocks borrowed percentages in play models. | Recommendations | The `benchmark` source tag exists, but nothing guards transfer | EV30 | Code | No |
| 11 | **Knowledge docs (no app code).** New original guides, playbooks and eval cases for the gaps in section 1: BK04 experiment library, BK06 observational methods and metrics, BK02 pricing strategy and behavioural tactics (test-first), BK05 question design, BK01 outside view and focus. Plus additions to the reconciliation doc. | Knowledge | Section 1 | New cases EV33+ (kept as a separate dev set) | Docs | No |

Slices 1, 3, 4, 5, 6, 9 and 10 are deterministic and cheap, and can run in parallel sessions (different files). Slices 2, 7 and 8 change prompts and need the bench before release.

## 4. Running the 32 synthetic cases

**What the cases are:** decision questions with structured inputs and no website. EV01–24 cover four each of SaaS, Mac app, agency, ecommerce, local service and marketplace. EV25–32 are cross-business: injection, conflicting prices, reconciliation, low volume, recovery, public cases, pricing viability, weak metrics. They aren't full growth plans, so the harness tests two surfaces:

1. **Advisor (all 32):** Climb AI's real system prompt and production model route. Workspace tools are stubbed with "no data" fixtures; calculator tools, once built, are real. Prompts come from `evaluations/prompts.jsonl`, which never contains expected answers.
2. **Plan (6 plan-shaped cases: EV01, 09, 13, 17, 21, 06):** case inputs become a synthetic brief and confirmed facts. Research is off (frozen evidence). The real plays → plan → consistency path runs, as `bench/run.ts` does.

**Grading:**
- **Deterministic:** each case's `numeric_checks` (e.g. EV03 contribution $9, margin 0.30; EV08 1 point vs 50% relative; EV31 price floor $20) are matched in the response. Hard-rule lint runs on the plan outputs.
- **Blind judge:** a Sol judge per response with the pack's 7-dimension 0–2 rubric, plus that case's own hard failures. Any hard failure fails the case.
- **Arms compared:** pairwise, both orders, using the existing bench judging.
- **Owner review:** a blind markdown packet, since the pack recommends human review.

**Runs and outputs:**
- **Baseline:** current HEAD, before slices 1–10. Model ids, prompt hashes, `ENGINE_VERSION` and the knowledge edition are frozen into the results file.
- **After:** the same harness and settings on the changed engine.
- **Comparison report:** hard failures per case, rubric means overall and per business type, pairwise wins, cost per acceptable answer, and latency. Errors are kept and no case is dropped.

**Honesty notes:**
- I've already read every case's expected behaviours and hard failures, so the 32 are a dev set, not a holdout.
- The real holdout should be:
  - the existing bench businesses (5 SaaS, plus the non-SaaS cases being added in another session) for end-to-end plans;
  - real, permissioned owner cases later.
- New cases I write (slice 11) stay a separate set.

**Estimated cost per run** (Luna answers, Sol judge, based on past runs at ~$0.21 per plan):

| Item | Estimate |
|---|---|
| Advisor answers | ~$0.50 |
| Plan cases | ~$1.30 |
| Pointwise judging | ~$1.50 |
| **Baseline total** | **≈ $3.50** |
| Post-change run plus pairwise judging | ≈ $5 |
| **Whole comparison** | **≈ $8.50; suggested cap $10** |

**Files:**
- `bench/expansion/run.ts` (harness)
- `bench/expansion/grade.ts` (deterministic checks and judge)
- `bench/results/expansion-<label>.{json,md}` and a blind packet

Code and a dry run with the fake model need no spend.

## 5. Next steps after this plan

1. Build the harness (slice 0) and dry-run it with the fake model. Free.
2. Run the baseline: needs the owner's cap.
3. Build slices 1, 3, 4, 5, 6, 9 and 10 (parallel sessions where files don't overlap).
4. Build slices 2, 7 and 8, then run the post-change suite plus the end-to-end bench (needs a cap).
5. Slice 11 (knowledge docs) can start any time; it changes no app code.

Nothing here publishes, sends, spends or deploys.
