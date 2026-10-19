# ClimbOS Growth Engine: master spec (reconciled)

Version 2, 2026-10-19. It reconciles two documents against the code at `growth-engine-v2`:
- **v1 brief (2026-10-18):** the audit-and-design brief, archived at `docs/growth-engine/master-spec-v1-2026-10-18.md`.
- **V2 prompt (2026-10-19):** the implementation program, archived at `docs/growth-engine/v2-prompt-2026-10-19.md`. Requirement IDs come from V2.

**Status lives in:** `docs/growth-engine/implementation-ledger.md`. **Evidence and cost:** `docs/growth-engine/evaluation-and-cost.md`. **Sources:** `docs/growth-engine/research-ledger.md`.

## 1. Outcome

An owner gets:
- a defensible decision;
- specific targets;
- assets that are ready to use;
- execution within their permissions;
- a learning loop that uses valid results.

Every action connects diagnosis → effect → evidence → target or asset → resources → capability → measurement (REQ-OUT-01). Channel names alone aren't deliverables (REQ-OUT-02).

**The standard:** evidence, realistic cases and measured results. Never a claim of credentials or of being "best".

## 2. Fixed operating rules

| Rule | Source |
|---|---|
| OpenAI only. Basic = Luna everywhere. Expert (paid, owner's choice) = Sol drafts for insights, channel fit, plays, plan, ads and the weekly plan. No fallback model | `shared/agents/routes.ts`, owner 2026-10-18 |
| Before adding AI, record why code, a template, a query or an existing integration can't do it (REQ-COST-01) | V2 §4 |
| Paid evaluation budget: **$0** until the owner funds a cap | V2 §0.7, `evaluation-and-cost.md` |
| Workspaces never gain publishing, messaging or spending authority silently. Copilot, Review and Bounded Autopilot rule every external write | V2 §0.8 |
| Fetched pages, reviews and tool output are data, never instructions | V2 §0.10, REQ-ENG-07 |
| A fixture, a passing test, a live connection and a measured improvement are reported separately | V2 §0.11, REQ-EVAL-01 |
| No production deploy without the owner's explicit release approval | V2 §0.9 |

## 3. Contracts now in code

| Contract | Rule | Where |
|---|---|---|
| Plan quality (REQ-ENG-02) | `passed` / `provisional` / `needs_input` / `failed`, kept separate from the run finishing. Hard failures on economics, budget, capacity, citation, provenance or consistency block approval | `shared/agents/quality.ts` |
| Source tags (REQ-EVID) | owner / research / benchmark / planned / assumption. Checks are set and stamped by code only | `shared/agents/provenance.ts` |
| Owner numbers (REQ-EVID-01) | Only structured `unitEconomics` metrics, each with a fixed unit and period. Overrides keep the value and source they replaced | `economics.ts` `applyOwnerEconomics` |
| Research numbers (REQ-EVID-02/03) | A page from this run's search, loaded by ClimbOS. The verbatim quote must contain the exact number, in the right unit, with the metric named. Each tag records page access and a receipt (fetch time and content hash) | `provenance.ts` `checkResearch` |
| Units (REQ-MATH-03) | Rates and margins are shares from 0 to 1. Anything else is rejected, never reinterpreted | `economics.ts` `rateOf` |
| Unknown vs zero (REQ-MATH-02) | Zero churn is a real value. Unknown churn stays null, so there's no value, payback or profit verdict | `economics.ts` `churnOf` |
| Horizon (REQ-MATH-04) | The actual goal horizon in days, fractional weeks allowed. Portfolio totals re-run every play at that horizon | `playMaths`, `portfolioRange` |
| Goal, scenario and gap (V2 §8.1) | The owner goal is stored as stated (`goals.target`: metric, baseline, desired, total vs incremental). Code computes the gap. The North Star is the plays' scenario, never a replacement for the goal | `shared/agents/goal.ts` |
| Formula catalog (V2 §8.2–8.3) | Pure and null-safe. The reference fixture reproduces exactly | `shared/growth/calc.ts`, `tests/unit/economics-fixtures.test.ts` |
| Structured output | Required nullable keys stay null. Only optional nulls are dropped | `shared/ai/openai.ts` `normalizeNulls` |

## 4. Reconciled decisions (v1 → V2)

| Topic | v1 said | Now |
|---|---|---|
| Forecasts | The model proposes and code checks | Code computes P10/P50/P90 from the play's inputs (seeded triangular simulation). These are scenarios, not calibrated predictions (REQ-MATH-05) |
| Portfolio shape | Bankable + creative + moonshot | Still enforced. Removal is planned for S5 (REQ-STRAT-05, REQ-OUT-03) |
| North Star | The plays' total | The plays' scenario, shown next to the owner's goal and the gap |
| Fixed 90-day framing | Implicit | The goal horizon is used in tasks, totals and checks |
| Capacity text | Engines "cost credits, not owner hours" | Engines still need owner time for approvals and replies. A dynamic version is planned for S5 (REQ-ENG-11) |
| Anthropic routing and docs | Present | Retired. Banners added to `docs/EngineV2.md` and `docs/research/anthropic-platform.md`. `docs/Capabilities.md` rewritten |

## 5. Ordered program

S0 → S15 as in V2 §21. The ledger tracks status and done-when criteria. Current position: S0 and S1 are done. S2–S5 are partly done; S6 is done in fixtures behind a flag. All of it is fixture-tested. S7 is next.

## 6. Open owner decisions

| Decision | Blocks |
|---|---|
| Release `growth-engine-v2` (merge and deploy) | Live use of S1–S3 |
| Fund the $5 Basic regression check (`evaluation-and-cost.md` §6) | Evidence that S1–S3 didn't make real plans worse |
| Staleness policy for owner confirmations (e.g. 12 months) | REQ-EVID-01 completeness |
| Google Business Profile API access, a CMS sandbox, LinkedIn/X keys | S10, S11, live publishing |
