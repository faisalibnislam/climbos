## 16 November 2026 — protected exploration in the default strategy path

Audit: the detailed growth-plays path already required `StrategyExplorationSchema`, supplied the protected exploration instructions, retrieved precedents and persisted the result. Focused/starter plans used a separate schema without that field, asked for internal comparison only, never activated the existing task-triggered precedent retrieval, and did not consume the already-loaded creative owner feedback. A failing schema regression reproduced the missing required output.

Implemented in the existing path:

- Require the shared grounded/adjacent/bold schema in focused/starter model output and reuse its citation/precedent/exact-duplicate-mechanism checks. Speculative options remain valid with no precedent, low evidence/feasibility and high risk. Distinct wording alone does not satisfy the exact-duplicate check; that check is not a semantic originality detector.
- Keep one primary recommendation/prepared-work package; separately retain alternatives with challenged convention, mechanism/action, audience/conditions, evidence labels, assumptions/risks/capacity and reversible continue/change/stop tests. The existing retrieval hook now supplies bounded precedents to writer/reviewer; case absence never blocks a novel option. No campaign-timing prompt or calculation changed.
- Preserve creative range, retrieved IDs and application-generated prompt/input hashes. Model-produced provenance is overwritten. Retain prior alternative proposals during refresh and include the existing tenant-scoped exploration feedback as preferences/labelled reports, not facts or authorization.
- Add explicit originality, business relevance, transfer and reversible-test criteria to the focused reviewer and skill rubric. Regenerate `shared/skills/generated.ts` through the established script.
- Reuse the existing options panel in a direct Plan tab, loaded on demand. Preserve old plans without backfilling invented options. Selecting an option records feedback; it does not approve or start external work. Existing plan approval can remain pending after generation.

Commands:

```sh
pnpm skills:build
pnpm exec vitest run tests/unit/focused-plan.test.ts tests/convex/focused-plan.test.ts tests/convex/free-onboarding.test.ts tests/convex/creative-strategy.test.ts tests/convex/goal-workspace.test.ts tests/unit/decision-structured.test.ts tests/unit/creative-precedents.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/focusedPlan.ts shared/agents/focusedRubric.ts shared/agents/specs.ts convex/jobs.ts src/components/app/plan/GoalWorkspace.tsx src/components/app/plan/ExpertPlan.tsx tests/unit/focused-plan.test.ts tests/convex/focused-plan.test.ts tests/convex/free-onboarding.test.ts tests/fixtures/focusedPlan.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Results: 153 tests passed across 10 files; app/Convex typechecks, scoped lint and isolated local sync passed. Generation tests exercise actual jobs/persistence with synthetic model responses, verify the precedent block reaches the writer, preserve free-starter quotation/allowance and unchanged model-call count, and show later focused runs receiving owner option feedback. Browser checks cover desktop/mobile option visibility, expandable evidence/tests, selecting the unproven bold option, persisted feedback and no new approval/action/artifact/run. Automated checks found no serious/critical accessibility violations or horizontal page overflow. The first browser fixture incorrectly put top-level plan fields inside `expert`; it was corrected to the actual saved schema, then both checks passed. Mobile capture was inspected; temporary toast/fixed navigation overlaps in the element capture are not a full-page layout assessment.

Limits: no paid model benchmark or live-provider action ran. These tests establish preservation, retrieval, persistence, visibility and permission behavior, not consistently surprising ideas, semantic evidence support, improved business results, production latency or actual per-run cost. Existing model routes, token ceilings and budget checks remain unchanged; larger outputs still need measured quality/cost evaluation. Earlier saved focused plans remain valid and have no invented alternatives.

## 16 November 2026 — customer-message feedback into strategy

Confirmed gap: `reviews.voiceThemes` displayed saved corrections and dismissals, but strategy generation never consumed that feedback. Added failing generation-boundary assertions for focused/starter plans, then connected the existing sample through `customerVoice` → `jobWrites.jobContext` → `jobs.businessBrief` → agent input. The existing Reviews query now reuses the same reader.

Behavior and boundaries:

- Use only the same tenant's last 180 days of non-demo messages and recent CRM notes. Exclude future-dated messages/notes. Select up to 500 messages and 250 recently updated deals, then at most 500 combined records; disclose caps. Fixture messages no longer displace real messages before the returned-row limit. The message query filters fixture records before taking results; this is a bounded returned sample, not a claim of a fixed number of database records scanned.
- Preserve stored receipt/note dates, channels and source links; these dates are not independently verified publication dates. Distinguish owner-pasted reviews/CRM notes from other message reports. Deduplicate repeated stable source IDs and give same-timestamp CRM notes distinct IDs. Counts are records, not distinct customers; repeated text across different records is not declared independent evidence.
- Preserve corrected versus suggested labels, owner notes and review dates. Exclude dismissed groups and their private notes/examples from the new strategy context; clearing restores the suggested grouping. Existing owner feedback is group-level until cleared, not a version-specific classification of each subsequent message. The UI and model context disclose that limitation.
- Redact known author/contact names from excerpts and email/phone patterns from excerpts and model-bound correction notes. This is not comprehensive PII detection. Keep complete theme/source records within a 10,000-character budget; disclose omissions instead of breaking citation associations. Only strategy jobs collect this additional context.
- Explain that English phrase groups can combine positive, negative and negated statements. They do not establish sentiment, representative demand, customer authenticity or causal outcomes. Private excerpts are for analysis, not approved testimonials. No action authorization is created.

Verification:

```sh
pnpm exec vitest run tests/convex/customer-voice.test.ts tests/convex/research-context.test.ts tests/convex/reviews.test.ts tests/unit/voice-themes.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts
pnpm typecheck
pnpm exec eslint convex/lib/customerVoice.ts convex/reviews.ts convex/jobWrites.ts convex/jobs.ts shared/reviews/voiceThemes.ts shared/agents/specs.ts 'src/app/app/[organization]/reviews/page.tsx' tests/convex/customer-voice.test.ts tests/convex/research-context.test.ts tests/convex/reviews.test.ts tests/unit/voice-themes.test.ts e2e/customer-voice-learning.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/customer-voice-learning.spec.ts
git diff --check
```

Results: 37 focused unit/Convex tests passed, app and Convex typechecks passed, scoped lint passed, and isolated local sync passed. Two desktop/mobile browser checks passed (16.3 seconds): source/interpretation/limit copy, correction → dismissal → restore, three audit events, no new approvals/artifacts/actions/runs, no horizontal overflow and no serious/critical automated accessibility findings. The first browser attempt used the wrong audit table name; corrected the test to the existing `auditEvents` table and reran successfully. Mobile capture was inspected; the saved-state toast temporarily overlays part of the element screenshot. This is local fixture/model-boundary evidence, not a paid model evaluation, production-provider test or full accessibility assessment.

## 16 November 2026 — customer-language source-text evidence

The existing phrase-bank lint checked source URL membership but did not prove that quoted words appeared in text ClimbOS read. Traced `PageFetcher` → OpenAI/Anthropic turn result → business-insights research/checkpoint/cache → onboarding `AgentMeta` → `saveInsights` → saved expert research → downstream drafting/strategy and owner research UI.

Implemented:

- Carry at most eight 8,000-character actual page excerpts separately from the source URL index. Capture the actual read timestamp. Only business-insights research retains these excerpts in its existing cache; other agents do not acquire larger research caches. The existing tenant/expiry/deletion lifecycle applies. This adds no network read, paid research call or platform integration.
- Keep original read times through cache reuse. Search snippets/model notes cannot stand in for fetched page text. Background-response metadata preserves URL/read counts but cannot restore page text; such missing evidence remains unchecked rather than triggering a new fetch.
- In `saveInsights`, examine at most 40 phrase candidates, ignoring model-supplied verification flags. Retain only exact case-sensitive text matches with layout whitespace normalized, from a matching external page URL. Preserve scheme, query and path case; fragments identify the same fetched page. Unknown business website/source text/read time, nonmatching wording, and business-site copy are withheld and counted separately. Unknown timestamps are not replaced with save time.
- Persist source-read timestamps and `text_matched` status with retained phrases. Store counts of matched/nonmatched/unchecked/business-site candidates without treating them as distinct customers or representative demand. Legacy records remain readable and explicitly unchecked.
- Add an expandable customer-language panel inside the existing owner research section. It exposes wording, research theme, source, original read date and limitations. Text matching does not authenticate the writer, identify own versus competitor customers, establish publication permission, prove semantics or show prevalence. No approval or action control changed.

Verification commands:

```sh
pnpm exec vitest run tests/unit/customer-language-evidence.test.ts tests/unit/customer-language-ui.test.tsx tests/unit/pageFetch.test.ts tests/unit/research-cache.test.ts tests/unit/anthropic-adapter.test.ts tests/unit/business-research-context.test.ts tests/unit/research-quality.test.ts tests/convex/research-context.test.ts tests/convex/research-cache.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts
pnpm typecheck
pnpm exec eslint shared/ai/types.ts shared/ai/pageFetch.ts shared/ai/openai.ts shared/ai/anthropic.ts shared/ai/tasks.ts shared/agents/types.ts shared/agents/runtime.ts shared/agents/provenance.ts shared/agents/specs.ts convex/schema.ts convex/engine.ts convex/jobs.ts convex/jobWrites.ts src/components/app/plan/PlanSections.tsx tests/unit/customer-language-evidence.test.ts tests/unit/customer-language-ui.test.tsx tests/unit/pageFetch.test.ts tests/unit/research-cache.test.ts tests/unit/anthropic-adapter.test.ts tests/convex/research-context.test.ts tests/convex/research-cache.test.ts e2e/customer-language-evidence.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/customer-language-evidence.spec.ts
git diff --check
```

Results: **96 tests across 12 files passed**, application/Convex typecheck and scoped lint passed, and isolated loopback sync succeeded. Provider adapters used mocked services. The onboarding regression resumes synthetic profile/page checkpoints, receives mocked research-phase evidence through the actual job handler and verifies the persisted phrase/date with zero network calls. Five downstream job cases verify that unsupported/forged candidates are removed before generation while valid research survives; tenant and approval regressions remain green.

Final browser run: **two desktop/mobile checks passed in 17.8 seconds** with synthetic data in the isolated backend. It verifies matched and legacy states, exact source/read date, omission explanation, usable source controls without opening external links, no horizontal overflow, no serious/critical automated accessibility findings, and unchanged artifact/approval/action/run records. The first attempt missed the enclosing collapsed “What we found” section; test navigation was corrected. Mobile render inspection led to using the existing surface color token; the final browser run includes that change. Next.js's installed use-client guide and React review guidance were consulted. These checks do not establish full accessibility conformance or real-provider operation.

Remaining: matches cover only retained excerpts, not full-page absence or semantic support. External-site copy may still be a publisher's claim rather than a genuine customer statement; authenticity and customer-pool attribution remain unknown. Legacy/cache/background records without text cannot be retroactively verified. Other free-text research fields are outside this phrase-bank check. No live model-quality evaluation, production deployment or external publishing was performed. The broad product acceptance audit remains incomplete.

## 16 November 2026 — persisted research in drafting and focused strategy

Traced `saveInsights` → stored `business.insights.expert` → `jobContext` → `businessResearchContext` / `planContext` → actual social, ad, email and focused/starter strategy generation inputs. Four initial regression cases failed because the saved positioning and associated research never reached generation. Starter uses the same affected branch and is included in the final five-case integration matrix. Detailed strategy already included the saved insight object; it was not replaced.

Implemented in the existing context path:

- Read selected research fields from flat model output or nested persisted expert records, keeping explicit flat values (including cleared arrays) authoritative. Include confidence notes and a valid saved generation timestamp; absent/invalid generation time stays unknown.
- Supply saved research to starter/focused strategy generation, matching the research already included in its saved snapshot/evidence. Restore nested research to downstream drafting through the existing shared helper.
- Keep approved plan terms distinct from research proposals. Describe language records as research-reported candidates, not verified testimonials; a source link alone does not prove wording, customer identity, authenticity, publication permission or prevalence. Generation time is not retrieval/verification time.
- Bound context at 8,000 JSON characters by omitting complete records/fields with an explicit limitation. Retained quotations/source links remain complete, the original object stays unchanged, and omitted evidence is not treated as absence.

Verification:

```sh
pnpm exec vitest run tests/unit/business-research-context.test.ts tests/unit/research-quality.test.ts tests/convex/research-context.test.ts tests/convex/approval-claims.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts
pnpm typecheck
pnpm exec eslint shared/ai/tasks.ts shared/agents/specs.ts convex/jobs.ts tests/convex/research-context.test.ts tests/convex/plan-approval.test.ts tests/unit/business-research-context.test.ts
git diff --check
```

Focused regression/authorization result: **64 tests passed across seven files**. Application and Convex typecheck, scoped ESLint and diff checks passed. `CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync` successfully bundled/synced functions to the already-running isolated backend at `127.0.0.1:3320`; it was not a hosted deployment. The integration test writes through the real persistence mutation and invokes the real job actions, intercepting and stopping at the model boundary. It verifies source context, cross-tenant save rejection, foreign-context exclusion, and absence of artifacts, approvals and action receipts. It does not exercise a live model or provider publication. The first wider run also found an older weekly-report test creating verified jobs without recorded completion times; its fixture now supplies distinct completion times, matching the existing reporting contract. No reporting runtime change was needed.

Remaining limits: source URL membership still does not establish exact quote support or semantic truth; the saved language records lack independently verified customer identity, permission and source freshness. Context selection is bounded, not exhaustive. No live quality benchmark, provider write, browser check or production deployment was performed for this backend/context-only increment. The original 410-requirement acceptance audit remains incomplete.

## 16 November 2026 — weekly scenario position and next-decision review

Traced saved weekly reports through `actualsFor` → `playActuals` → `diagnoseShortfall` → `PlayResults` / `ExpertPlan` and `resultsBrief` → strategy job context. The initial focused regressions reproduced a large volume shortfall labeled On track and zero reported reach treated as proof the work never ran. Inspection also confirmed that the spend branch accepted any informative funnel step while a later step could remain thin; the final regression explicitly exercises an uncertain downstream conversion step.

Implemented:

- Replaced the weekly status Poisson mixture over scenario endpoints with descriptive `below_scenario`, `within_scenario` and `above_scenario` states. Existing incomplete/open/unknown/too-early states remain. Full-horizon references do not establish statistical confidence, causal lift or success against the owner's test criteria. Earlier references explicitly assume even delivery and do not model ramp-up or conversion delays. No saved forecast or report values were changed.
- Separated scenario position from the next decision. The shared review trigger catches low reach even when conversion holds, and weak conversion even when higher reach brings enough customers to meet the reference. Both owner UI and future-plan context use it. Missing/open windows cannot justify these diagnostics.
- Zero or absent reach leaves execution unknown, and zero downstream counts prompt a tracking check without claiming tracking is proven broken. Uncertain later steps block an increased-spend suggestion. Cost/value comparison requires matching known currency; recorded cash is still displayed in its own currency. Otherwise supported reach expansion is a review proposal requiring current capacity, cash, stop-rule and approval checks.
- Original stop rules now reach the owner card. Insufficient evidence and completed horizons no longer instruct an automatic extension. Small deviations can be visibly below a reference while the diagnostic remains inconclusive. The standalone statistical coverage helper is documented as requiring genuine prediction intervals; it is not used for these scenarios.
- Updated badges, comparison explanation and neutral next-check presentation. Mobile inspection found crowded scenario labels, resolved with grid spacing. No new query, client effect, provider, dependency or external-action path was introduced. The installed Next.js use-client guide and React review guidance were consulted.

Verification commands:

```sh
pnpm exec vitest run tests/unit/weekly-decision.test.ts tests/unit/weekly-decision-ui.test.tsx tests/unit/play-actuals.test.ts tests/unit/shortfall.test.ts tests/unit/decision-books.test.ts tests/unit/play-cost-per-customer.test.tsx tests/unit/play-results-retention.test.tsx tests/convex/play-result-learning.test.ts tests/convex/play-result-coverage.test.ts tests/convex/play-result-money.test.ts tests/convex/play-result-history.test.ts tests/convex/play-results.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts
pnpm typecheck
pnpm exec eslint shared/growth/actuals.ts shared/growth/diagnostics.ts convex/playResults.ts shared/agents/specs.ts src/components/app/plan/PlayResults.tsx src/components/app/plan/ExpertPlan.tsx tests/unit/weekly-decision.test.ts tests/unit/weekly-decision-ui.test.tsx tests/unit/play-actuals.test.ts tests/unit/shortfall.test.ts tests/unit/decision-books.test.ts tests/convex/play-result-learning.test.ts e2e/play-result-money.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/play-result-money.spec.ts
git diff --check
```

Results: **119 tests passed across 14 focused files**, including 11 new decision/UI cases. Typecheck, scoped lint, isolated local function sync and diff checks passed. Desktop/mobile browser checks exercised actual large-shortfall and unknown-execution cards, original stop-rule visibility, report editing/history, currency changes, duplicate-summary withholding and unchanged approval/action/workflow records. Both passed after label spacing in **34.3 seconds**; no horizontal overflow or serious/critical automated accessibility violations were found. The final mobile screenshot was inspected. The subsequent shared trigger extension for weak conversion despite adequate total volume passed the final unit/UI suite and local sync; it does not add a browser interaction.

Limits: reports do not independently verify execution, exposure, unique customers, attribution or causal impact. Existing reach and Bayesian funnel thresholds are diagnostic review heuristics with model assumptions, not owner-approved business stop criteria. Missing historical inputs remain unknown. Partial-horizon reference interpolation still assumes even delivery; it is not a timing-aware forecast. No automatic scaling, stop action, price change, spending, publishing, provider call or hosted deployment occurred. Expert recommendation quality and the full 410-requirement acceptance audit remain open. Engine version: `v3.92-weekly-decision-evidence`.

## 16 November 2026 — original weekly learning across plan versions

Traced owner `playResults.log` → current report and append-only revision → original strategy/report-time index → `resultsBrief` → `jobWrites.jobContext.resultsText` → `jobs` performance context. A new regression failed before implementation: after seven newer untested plans, the older reported play produced an empty learning brief. The inspected forecast contract also defines input scenarios, while the old brief treated P10/P90 as an 80% probability interval.

Implemented the existing path, without another agent/provider:

- Optional `strategies.weeklyReportedAt` and tenant/report-time index, maintained atomically with reporting. Recent plan creation/restoration does not copy this metadata. The report metadata does not alter the plan content hash or approval scope.
- Select up to eight eligible recently reported plans from 40 indexed candidates, plus four newest plans for legacy fallback; prioritize reported plays and retain up to six complete play records. Original audience, mechanism, kind, proposed test, stop/continue rules, plan/play identity, scenario, horizon, saved currency/goal when present, funnel labels and report dates remain attached as bounded untrusted historical data. Missing original fields remain null. Current corrections count once; revision snapshots are not independent observations.
- Original business/goal/run links must stay within the tenant. Known fixture and orphaned run sources are excluded from learning. Real-workspace reporting rejects known fixture runs; demo workspaces can still demonstrate reporting. Invalid saved report times withhold summaries. No approval, action receipt or workflow is created by reporting, reading or indexing.
- Descriptive low/high scenario comparisons replace binomial probability coverage, confidence and automatic range-widening claims. Only selected complete, completed, aligned whole-week horizons qualify; later reports do not inflate that horizon. Historical shortfall diagnostics no longer apply today's business prices/margins to an old baseline; a new decision must recheck confirmed economics and capacity.
- `migrations:weeklyOutcomeReviewIndex` is operator-only, explicitly tenant-scoped, paginated and preview-first. It copies the maximum valid existing saved report time per plan, skips broken/fixture provenance and is idempotent. Preview all pages with the workspace `orgId` and default `dryRun: true`; after authorized rollout, restart with `dryRun: false` and follow returned cursors until `done`. No production backfill ran.

Verification commands:

```sh
pnpm exec vitest run tests/convex/play-result-learning.test.ts tests/convex/play-result-coverage.test.ts tests/convex/play-result-history.test.ts tests/convex/play-result-money.test.ts tests/convex/play-results.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/play-actuals.test.ts tests/unit/shortfall.test.ts tests/unit/decision-books.test.ts
pnpm typecheck
pnpm exec eslint convex/playResults.ts convex/migrations.ts convex/schema.ts shared/agents/specs.ts tests/convex/play-result-learning.test.ts tests/convex/play-result-coverage.test.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/play-result-money.spec.ts
git diff --check
```

Results: **115 tests passed across 11 focused files**, including eight new learning tests. App/Convex typecheck, scoped lint, diff checks and the isolated local schema/function sync passed. Both existing desktop/mobile reporting checks passed in **30.7 seconds**. Coverage includes older reported plans, the actual strategy job-context reader, repeated corrections, unchanged plan hash and action records, fixture/orphan/tenant boundaries, invalid saved timestamps, historical context after current economics change, tenant-scoped preview/apply pagination and maximum-date/idempotent backfill, plus scenario comparison without probability claims. No Next.js component changed.

Limits: this is bounded selection, not exhaustive history or semantic relevance retrieval. Each play retains the 520-report summary budget; larger histories are withheld. Old unindexed plans need authorized migration or a new report/correction. Original fields absent from legacy plans cannot be recovered or inferred from today's business. Owner counts, exposure, execution and causal impact remain independently unverified; this does not establish predictive calibration or real-model recommendation quality. No hosted deployment, live-provider operation, campaign send or spend occurred. The full 410-requirement completion audit remains open. Engine version: `v3.91-original-weekly-learning`.

## 16 November 2026 — weekly summary completeness and reporting windows

Traced `playResults.forStrategy` and `resultsBrief` through the same `actualsFor` reader, `playActuals`, shortfall diagnostics and plan cards. Three new regressions failed before the repair: a valid play disappeared behind 405 unrelated rows, 62 recorded weeks produced a 60-week/600-customer subtotal instead of 62/620, and three completed missing weeks after the last report were reported as no missing weeks.

Implemented:

- Reused the existing play-ID/week and play-name/week indexes to read relevant rows from the plan-creation UTC week through the current week. ID and legacy-name rows are deduplicated by row ID. Each indexed read and combined set has a 520-record budget plus sentinel. Overflow never becomes a partial total. A legacy name change without a saved stable ID remains unresolvable.
- Checks reject duplicate weeks, incompatible tenant provenance, ambiguous play identity, invalid UTC week alignment, missing/inconsistent funnel counts, invalid model rates, changed saved step labels, and invalid cash/hours/retention numbers before aggregation. Unusable histories return an explicit issue with no actuals, retained-money summary, cost advice or calibration. Individual-week editing remains separate. Source money with unknown currency retains the prior explicit unavailable-cost handling.
- The observation window includes all completed weeks after plan creation, including trailing weeks with no report. A current-week report is included as provisional; an unreported open week is excluded. Empty windows produce unknown-results wording rather than measured zeros. Missing/open weeks withhold full-week forecast comparisons and increased-spend diagnoses. Recorded-week totals remain visible with a scope explanation. Windows beyond the original forecast horizon cannot be compared with that shorter forecast.
- Forecast range coverage now uses only completed, exactly aligned whole-week horizons with every week present and a valid saved range. It excludes later results from the tested horizon. Fractional-week horizons cannot be established from weekly aggregates, so they are not included. This is range coverage of owner reports, not proof of calibrated predictions or causal impact.
- UI and future-plan context share the assessment. Context prioritizes reported plays before empty ones and discloses its bounded four-newest-plan sample and six report/diagnosis-line limit. Engine version: `v3.90-weekly-summary-coverage`.

Verification commands:

```sh
pnpm exec vitest run tests/convex/play-result-coverage.test.ts tests/convex/play-result-history.test.ts tests/convex/play-result-money.test.ts tests/convex/play-results.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/play-actuals.test.ts tests/unit/shortfall.test.ts tests/unit/play-cost-per-customer.test.tsx tests/unit/play-results-retention.test.tsx tests/unit/retention-actuals.test.ts tests/unit/decision-books.test.ts
pnpm typecheck
pnpm exec eslint convex/playResults.ts shared/growth/actuals.ts shared/growth/diagnostics.ts shared/agents/specs.ts src/components/app/plan/PlayResults.tsx src/components/app/plan/ExpertPlan.tsx tests/convex/play-result-coverage.test.ts tests/convex/play-results.test.ts tests/unit/play-actuals.test.ts tests/unit/shortfall.test.ts e2e/play-result-money.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/play-result-money.spec.ts
git diff --check
```

Results: 115 tests passed in 13 focused files; typecheck, scoped lint and local function sync passed. Two desktop/mobile tests passed in 24.0 seconds, including missing-week wording, unavailable duplicate summaries, preserved editing/history behavior, unchanged action records, no horizontal overflow and serious/critical accessibility scans. The final mobile unavailable-summary screenshot was inspected. Coverage includes the three reproduced defects, completely unreported periods, current-week versus completed-week comparisons, future/pre-plan exclusion, duplicate/foreign/invalid/overflow evidence, empty-play sampling, post-horizon exclusion, fractional horizons and unchanged action records. An initial browser run failed because a broad text locator matched both the forecast card and new reporting explanation; the selector now identifies the specific forecast-card message.

Remaining: reads are bounded, not an unlimited materialized history. Over 520 relevant rows is explicitly unavailable; old unrecorded play renames and legacy step definitions cannot be reconstructed. The reporting week begins Monday UTC and the plan's creation week remains its reporting start; this is not independently verified execution start. Summary dates reflect query evaluation, not continuous clock polling. Current-week figures are owner reports, not verified complete periods. Automatic weekly learning can omit reports on plans older than the four-newest-plan sample. Source completeness, unique customer identity, causal attribution, calibrated prediction quality and full requirement-level acceptance remain unproven. No deployment or external action was performed.

## 16 November 2026 — historical weekly reporting and protected corrections

Path inspected: existing plan card → weekly report form → `playResults.log` → current `playResults` row → actuals/learning, plus existing experiment revision/history and workspace export/deletion conventions. The existing mutation supported a past-week argument but the UI never sent it; corrections overwrote values without a saved revision or original snapshot. The correction lookup read only the first 400 strategy rows. A regression proved a second save with no version token silently overwrote the first.

Implemented:

- `weekForPlay` reads an exact normalized Monday UTC week via stable play ID and legacy name fallback. `by_strategy_play_week` avoids the old correction scan limit. Ambiguous duplicates block correction and produce a visible read issue rather than selecting a winner or adding another row. Permissions and original strategy/business/report tenants are checked.
- New/current reports carry a monotonic revision. Updating an existing report requires its exact ID and revision; missing or stale tokens fail without applying changes. Creating a report is still compatible with older clients, but they cannot blindly overwrite an existing one. Original explicit currency may be retained when correcting after a settings change, with the currently reviewed workspace currency checked separately. Unknown legacy currency is not inferred or converted.
- `playResultRevisions` stores immutable snapshots atomically with each current-row write and audit event. New snapshots retain step labels, counts, hours, currency and optional repeat-customer amounts. A legacy current row is preserved as revision zero on its first correction. Earlier revisions do not enter current actuals as additional results. `weeklyHistoryPage` is tenant-bound, read-only and paginated (maximum 25 per page). Workspace export includes up to 1,000 reports and 1,000 revisions with separate limited flags; workspace deletion includes the history table.
- The existing plan report now offers a UTC week selector, loaded saved values, explicit unknown/zero wording and visible history. Viewers can review but cannot save. Stale reactive updates keep the draft intact and disable Save until the owner explicitly reloads. Date selection is disabled while a save is in flight. Opening another week starts that week's form. Unknown/conflicting old money is not silently prefilled in a different currency. Existing original units remain visible in history.

Verification commands:

```sh
pnpm exec vitest run tests/convex/play-result-history.test.ts tests/convex/play-result-money.test.ts tests/convex/play-results.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/play-actuals.test.ts tests/unit/shortfall.test.ts tests/unit/play-cost-per-customer.test.tsx tests/unit/play-results-retention.test.tsx tests/unit/retention-actuals.test.ts tests/unit/decision-books.test.ts
pnpm typecheck
pnpm exec eslint convex/playResults.ts convex/schema.ts convex/settings.ts shared/agents/specs.ts src/components/app/plan/PlayResults.tsx src/components/app/plan/WeeklyReportEditor.tsx tests/convex/play-result-history.test.ts tests/convex/play-result-money.test.ts tests/convex/play-results.test.ts e2e/play-result-money.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/play-result-money.spec.ts
git diff --check
```

Results: 99 tests in 12 focused files passed, including stale/blind writes, current-only learning, a renamed legacy report after 405 unrelated rows, revision pagination, optional-field removal, historical currency correction, invalid weeks, duplicate rejection, viewer/tenant controls, export/deletion and unchanged action records. Typecheck, scoped lint and isolated local schema/index sync passed. Two desktop/mobile browser checks passed in 27.0 seconds, exercising currency changes, missing forecasts, historical-week entry, saved values, an intervening server edit, preserved unsaved input, explicit reload, correction history, a visible duplicate-report block, overflow and serious/critical accessibility checks. The rendered mobile history was inspected. Engine version: `v3.89-weekly-report-history`.

Limits: summary calculations still read up to 400 rows per strategy and 60 per play; this increment fixes exact editing/history access, not complete aggregate retrieval or trailing missing-week detection. Previously overwritten versions cannot be recovered. A legacy row with no stable ID cannot be matched after an otherwise unrecorded name change. Ambiguous duplicates need data review; they are not automatically merged. All core fields are still required, and weeks use UTC rather than customer-local boundaries. No new causal evidence, measured recommendation quality or complete 410-requirement acceptance is established. No deployment, live provider action, sending, publishing or spending occurred.

## 16 November 2026 — weekly reports preserve money units and missing forecasts

Path inspected: `PlayResults` owner form → `playResults.log` → `playResults` rows → `actualsFor` / `playActuals` → cash-cost and shortfall checks → plan review and `resultsBrief` → future strategy context. Existing code already checked numeric bounds, funnel consistency, edit permission, tenant identity and reporting weeks. It did not store spending currency, required only reach in the form, and substituted zero for absent forecast ranges.

Confirmed fixes:

- New reports store optional `spendCurrency` alongside the historical whole-unit `spendUsd` field. Positive spend and any supplied retention-money amount require an explicit recognized currency matching current business settings. Zero without money inputs can remain currency-unknown. Exact decimal parsing rejects unsupported precision; totals sum integer minor units. Invalid, mixed, legacy-unknown or current-currency-incompatible spending cannot produce an affordability recommendation. There is no FX conversion or automatic migration of legacy money.
- The form requires explicit reach, every funnel count, spending and hours. Blank values are not zero. It captures currency on opening and rejects a changed currency until the owner reopens/re-enters the form. Optional retention money rejects excess precision rather than rounding. A new plan/play remounts the form. Retention display/context preserve saved currency and decimal units. Reports still require all core fields; partial-field reporting is not introduced.
- Missing, nonfinite, negative or unordered original P10/P50/P90 ranges remain unavailable. They cannot become zero forecasts, performance classifications or calibration observations. The idea stays visible; invalid ranges are omitted only from numerical comparison charts. The plan card and weekly review explain the unavailable comparison. Browser screenshot inspection first reproduced NaN and an invented zero; final desktop/mobile checks assert both are absent.
- Invalid reporting dates are rejected. Existing viewer/foreign-tenant restrictions remain enforced; tests confirm reporting does not create approvals, action receipts or workflow runs. Engine version: `v3.88-weekly-report-money`.

Verification actually run:

```sh
pnpm exec vitest run tests/convex/play-result-money.test.ts tests/convex/play-results.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/play-actuals.test.ts tests/unit/shortfall.test.ts tests/unit/play-cost-per-customer.test.tsx tests/unit/play-results-retention.test.tsx tests/unit/retention-actuals.test.ts tests/unit/decision-books.test.ts
pnpm typecheck
pnpm exec eslint convex/playResults.ts convex/schema.ts shared/agents/specs.ts shared/growth/actuals.ts shared/growth/diagnostics.ts src/components/app/plan/PlayResults.tsx src/components/app/plan/ExpertPlan.tsx tests/convex/play-result-money.test.ts tests/convex/play-results.test.ts tests/unit/play-actuals.test.ts tests/unit/shortfall.test.ts tests/unit/play-cost-per-customer.test.tsx tests/unit/play-results-retention.test.tsx e2e/play-result-money.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/play-result-money.spec.ts
git diff --check
```

Results: **93 tests passed in 11 files**; app/Convex typecheck, scoped lint, local schema sync and diff check passed. **Two browser tests passed in 15.1 seconds**, covering explicit values, KWD precision, currency change during editing, unavailable forecast/cost, unchanged action records, no horizontal overflow and automated serious/critical accessibility checks. The final mobile screenshot was inspected. Initial money unit regressions failed before implementation; intermediate expectation failures were corrected to assert preserved currency precision instead of whole-unit rounding.

Remaining: weekly queries still read at most 400 strategy rows and 60 rows per play; corrections use a bounded lookup and overwrite the current weekly row without dedicated revision history or stale-value protection. The form still exposes only the current UTC week. Missing older weeks, partial input availability, missing trailing weeks and complete high-volume history need a separate completion pass. Old positive spending without currency remains unavailable until owner-confirmed; no currency was inferred from today's settings. Owner reports, selected source labels and scenario ranges do not independently verify payments, attribution, causal results or calibrated forecast quality. No production deployment, migration, provider action, send or spend occurred. The full requirement audit and product goal remain incomplete.

## 16 November 2026 — experiment learning survives new plans and preserves original context

Path inspected: owner outcome form → `playResults.recordExperimentOutcome` → current analyses plus append-only revisions → `resultsBrief` → `jobWrites.jobContext` → strategy business brief. Existing behavior already validates counts/dates, preserves unknown allocation, separates observed/reported comparisons from causal proof, binds editor access to the workspace, rejects stale form revisions and retains correction history. The separate design-learning path checks exact page versions.

Three new regressions **failed before the fix**: a reported result vanished after newer plans pushed its plan outside the four-plan sample; a reported experiment beyond the first ten was omitted; and changing away from, back to, then away from the original definition could quote the first original “met” report instead of its later “missed” report.

Changes:

- Optional `experiments.outcomeReviewedAt` is updated atomically with each report and indexed by workspace. Candidate selection reads the 40 most recently reported distinct tests plus the existing bounded recent-plan legacy fallback, orders by the current report date, and includes up to six tested and four not-run tests. Multiple corrections cannot occupy multiple candidate slots. The latest matching original-definition analysis supplies the original result; a not-run correction cannot revive an older success. Stored redefinition labels are reassessed against actual original criteria.
- Each included report retains experiment/plan identity, plan version, review time, original hypothesis, audience, variants, metric, stopping rule, analysis success rule, planned method/duration, guardrails, deviation count/latest note and owner note. These are bounded excerpts wrapped as untrusted historical data, with explicit incomplete-history and transfer limits. Missing variants remain unknown. Owner reporting remains unverified; no success, causal impact or new action permission is inferred. Engine version: `v3.87-experiment-learning-context`.
- Generic learning excludes foreign-tenant, missing-source, known fixture and design-linked reports. Writes validate the original plan/run tenant and reject known demo plan tests in real workspaces. Demo workspaces retain fixture reporting for local verification. The design-specific context remains separate.
- `migrations:experimentOutcomeReviewIndex` provides an internal, tenant-scoped paginated preview/apply path for older reports. Args: required `orgId`, optional `cursor`, `limit` (default 50, maximum 100), and `dryRun` (default true). Review all preview pages, then apply from the start with `dryRun:false`, passing each returned cursor until `done`. Only the last analysis's existing valid review time is copied; missing/future/invalid dates and broken/fixture source links are not invented or repaired. Repeated applications are idempotent. No automatic scheduler or provider action is created. Production application remains a separately authorized rollout step.

Verification actually run:

```sh
pnpm exec vitest run tests/convex/experiment-outcomes.test.ts tests/convex/play-results.test.ts tests/convex/strategy-learning-sources.test.ts tests/convex/design-learning.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/experiment-outcome.test.ts tests/unit/experiment-outcome-ui.test.tsx tests/unit/strategy-prompt-cost.test.ts
pnpm typecheck
pnpm exec eslint convex/playResults.ts convex/migrations.ts convex/schema.ts shared/agents/specs.ts tests/convex/experiment-outcomes.test.ts
pnpm exec eslint e2e/design-learning.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/design-learning.spec.ts
git diff --check
```

Results: **60 tests passed across nine focused files**; app/Convex typecheck and scoped lint passed. The isolated local sync installed the optional index successfully. **Four desktop/mobile browser tests passed in 24.8 seconds**, exercising reporting, corrections, stale forms, history, unknown allocation, signed comparisons and unchanged approval/action records. The first browser run had two accessibility failures on a newly appearing toast during its 360 ms fade-in (trace showed blended text contrast 2.1:1). The test now waits for that toast's computed opacity to reach 1 while retaining it in the accessibility scan; no app styles or scan rules were changed. Final scans passed.

Limits: selection remains bounded and recency-based, not complete-history semantic retrieval. Before the backfill is applied, older unindexed reports outside recent-plan fallback may be omitted. Design reports can occupy the indexed candidate read but remain excluded from this generic summary. Original plan provenance missing on legacy records cannot independently establish whether data was synthetic. Context preservation and deterministic selection are verified; improved real-model judgment, cross-industry quality and business outcomes are not. No production migration, deployment, live provider action, campaign send, publishing or spend occurred. The 410-requirement completion audit remains open.

## 16 November 2026 — business-model outcomes retain their original hypothesis

Audit path: saved Business Model Check → owner test report → `businessModelTests` append-only rows → `jobWrites.jobContext` → untrusted business brief → later strategy/model check, plus the owner page and workspace export/deletion. Existing code already preserved the latest report per alternative beyond 200 updates, guarded tenant/edit permissions, kept measured evidence owner-labelled, and withheld stale model verdicts from plan constraints.

Confirmed gaps: a newer check without test reports replaced the only check read for learning, dropping prior reports from the planning context. A regression reproduced an empty context despite a saved prior result. Reports carried only generic mode labels, without the original alternative/test alongside the outcome. The React form had no run-version key, so a new reactive check could retain an older hypothesis's draft. Updates had no stale-form check; there was no paginated owner history or explicit met/missed/unclear/not-run classification.

Implemented through the existing workflow:

- New reports optionally record **met**, **missed**, **unclear** or **not run** separately from the owner's decision. Contradictory progress/result combinations are refused. Missing legacy outcomes remain unknown; adopting/dropping a proposal is not classified as a successful/failed test. Even owner-selected measured evidence remains unverified owner reporting.
- An optional `workflowRuns.lastBusinessModelTestAt` timestamp and indexed query retain recently reported checks independently of repeated untested reruns. Planning uses latest reports per original target from up to three eligible checks, sampled from ten recently reported checks plus ten newest checks for legacy coverage. Each report carries the original check/report identity, dates, proposal, test, success/stop criteria, result, evidence label, decision and note. Repeated corrections are not independent experiments. Real learning excludes fixture, foreign-tenant, malformed and ambiguous source hypotheses. Unrelated content jobs receive none of this model-test context.
- The brief labels the historical context and limits. Each report has its own untrusted 2,000-character excerpt so a long earlier report cannot consume all later reports' space. Missing/truncated details remain unknown; this is bounded context, not a complete-history or semantic-relevance guarantee. Engine version is `v3.86-business-model-learning`.
- The owner page has a lazy, paginated Test history view with original test/criteria, report date and prior updates. Viewers can inspect it but cannot report results. Workspace export/deletion continues through the existing table handling.
- Forms are keyed to the original check. The current UI sends its last-seen report ID (or null for a first report); a concurrent newer report causes rejection before insertion. Owners keep their unsaved text and explicitly reload the newer saved result. Successful saves advance the form version. Older callers may omit the version guard and still append; they do not overwrite past rows. Recording an outcome or viewing history does not launch tests, change prices, create approvals, send, publish or spend.

Verification:

```text
pnpm exec vitest run tests/convex/business-model-learning.test.ts tests/convex/business-model-check.test.ts tests/convex/strategy-learning-sources.test.ts tests/convex/strategy-evidence.test.ts tests/convex/creative-strategy.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/business-model-check.test.ts tests/unit/business-model-freshness.test.ts tests/unit/business-model-view.test.tsx tests/unit/strategy-prompt-cost.test.ts
80 passed across 12 files

E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/business-model-context.spec.ts
4 passed in 28.6s: desktop Chromium and Pixel 7 emulation
```

Application/Convex typecheck, changed-file ESLint and `git diff --check` passed. The browser exercised a reactive new check replacing an open unsaved form, explicit unclear-result saving, stale-report rejection/reload, older-history visibility, preserved bold options, unchanged external-action records, automated accessibility and no horizontal overflow. A mobile capture was inspected. The workflow tests use synthetic evidence and fixture model responses; no real-model quality or business-impact claim follows. Local backend sync was loopback-only, and no generated files needed manual editing.

Remaining: older unindexed checks outside the ten-newest fallback may be omitted from automatic context until another report indexes their check; paginated owner history remains available. History can contain incomplete/subjective evidence, and very long context fields are excerpted. There is no causal inference from these labels, verified performance, automatic implementation of a pivot or demonstrated expert-quality improvement. Complete requirements reconciliation and real-business evaluation remain open. No hosted deployment or live external action was performed.

## 16 November 2026 — provider settings checked before campaign activation

Audit path: owner-prepared campaign → `ads.decide` exact-scope approval → scheduled `executeCampaignWrite` → atomic `claimCampaignWrite` → Google/Meta adapter → result receipt, campaign state and owner card. Existing permission, budget reservation, scope/hash, cancellation and no-replay guards were present. The activation branch previously sent ENABLED/ACTIVE without checking whether the provider campaign's current budget/settings still matched the approved local record. Failed requests also lacked a campaign-card explanation.

Implemented:

- Google reads the exact campaign, customer currency/timezone, average daily amount in micros, budget period/sharing, channel type and account-local start/end timestamps. Complete single-row evidence is required. The budget must match exactly, without rounding or assuming two decimal currency units; shared/unknown budgets, changed dates and unknown settings block activation.
- Meta reads exact campaign/account identity, paused status, traffic objective and total cap in currency subunits, plus account currency/timezone. Changed/missing caps block activation. The approved local start day must have arrived and the end day must not have passed. This does not verify child ad-set schedules, daily budgets, targeting or creative; the owner dialog says to review those in Meta.
- A final internal mutation reuses the existing permission, tenant, policy, emergency-stop, current-budget and artifact/scope checks after the provider read. The read must have started within 60 seconds and after this execution claim. A one-use dispatch claim and the structured provider observation/time are saved on the exact approval. Settings can still change externally after observation; no transactional provider lock is claimed.
- A rejected preflight never sends a start, changes a budget, or retries an action. It records a failed request, leaves the local paused state intact and shows the reason on the existing card. Permission/account/terms changes during the read cannot authorize a write. A dispatched attempt cannot be relabeled as never dispatched. Existing interrupted-result recovery remains read-only.
- Creation behavior is unchanged. No new agent, provider, calendar integration or automated retries were added. The schema additions are optional for historical records. `convex/_generated/api.d.ts` was regenerated by the normal isolated `local:demo sync` workflow, not edited manually.

Verification:

```text
pnpm exec vitest run tests/convex/campaign-activation-settings.test.ts tests/convex/campaign-recovery.test.ts tests/convex/campaign-authorization.test.ts tests/convex/ad-monitoring.test.ts tests/convex/ad-budget-currency.test.ts tests/convex/ad-report-integrity.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/integrations.adapters.test.ts tests/unit/integrations.core.test.ts tests/unit/spend-monitor.test.ts
283 passed across 11 files (46 new activation-settings cases)

E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/campaign-authorization.spec.ts
2 passed in 24.0s: desktop Chromium and Pixel 7 emulation

pnpm typecheck
Passed application and Convex typechecking
```

Changed-file ESLint and `git diff --check` passed. Browser checks cover the failed-start explanation, approval dialog limits, existing create/start/cancellation/recovery states, automated accessibility and horizontal overflow. The mobile capture was inspected. Provider behavior was tested through the actual adapters with stubbed fetch; the browser used isolated demo fixtures. No real campaign was created, activated, paused or otherwise changed.

Primary references checked on 16 November 2026 (publication date not established): [Google campaign fields](https://developers.google.com/google-ads/api/fields/v26/campaign) documents customer-local start/end timestamps; [Google budget fields](https://developers.google.com/google-ads/api/fields/v26/campaign_budget) documents micros, DAILY period and explicit sharing; [Meta campaign reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign-group) documents campaign ownership, status, objective and subunit spend cap, with delivery schedules at ad-set level. These sources support the requested fields, not live account access or observed production behavior.

Remaining: authorized live-account verification; complete child-ad/targeting/destination/schedule validation; provider edits between observation and write or afterward; account-specific eligibility and billing behavior. Google average daily budgets are not lifetime caps. Existing spend monitoring is a delayed-report pause trigger, not a guaranteed billing ceiling. The 410-requirement audit and full product goal remain incomplete. No hosted deployment or live action was performed.

## 16 November 2026 — read-only interrupted campaign recovery

Confirmed gap: `ads.decide` → queued `executeCampaignWrite` → `claimCampaignWrite` correctly refused replay, but a lost response could leave a campaign permanently unresolved in the owner UI. Provider name-lookup helpers existed without an application recovery path; Google took the first row and Meta the first name match, without proving uniqueness or complete pagination. Original result persistence also accepted duplicate callbacks and could apply a late success after the account/terms had changed.

Implemented in the existing campaign workflow:

- New create claims persist an operation-specific provider name (human-readable title plus approval reference) and provider identity before the external call; both Google and Meta actually receive that saved name. Names remain within the existing Google 255-character limit. Approval, budget, creation-paused and subsequent start controls remain in place.
- Current approvers can use **Check provider result** after five minutes. Recovery uses the approved activation ID, the create result's saved ID (including a valid older receipt), or a complete, unambiguous match to the unique create reference. It does not link legacy requests by a reusable title. It performs only provider reads; Google uses its read-only search endpoint, and Meta uses GET. Missing, truncated, duplicate, malformed, wrong-ID and unexpected-status evidence cannot resolve the request or permit replay.
- The query and recording mutation both enforce current membership, approval permission, exact tenant, account/provider, campaign scope/content hash and intact original approval binding. A read that takes more than five minutes cannot update state. The original authorization may have expired or the workspace may be stopped: reading a result is not new spending permission. Read recovery does not require a paid subscription. Demo campaigns refuse live reads.
- Positive recovery records an independent receipt and audit entry, consumes the old request, preserves the original receipt, and updates the observed local state. It does not invent the original activation time, verify delivery or imply full settings verification. Unknown observations remain dated and visible beside the recovery control. A late original callback cannot overwrite recovered state. Duplicate original result callbacks are ignored; a response for changed account/terms is retained as uncertain without attaching the old external identity to the changed local campaign.

Verification:

```text
pnpm exec vitest run tests/convex/campaign-recovery.test.ts tests/convex/campaign-authorization.test.ts tests/convex/ad-monitoring.test.ts tests/convex/ad-budget-currency.test.ts tests/convex/ad-report-integrity.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/integrations.adapters.test.ts tests/unit/integrations.core.test.ts tests/unit/spend-monitor.test.ts
237 passed across 10 files

E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/campaign-authorization.spec.ts
Desktop Chromium and Pixel 7 emulation passed
```

`pnpm typecheck` passed for the application and Convex; changed-file ESLint and `git diff --check` passed. The local demo sync was isolated to loopback. No generated file needed a manual edit.

Tests cover both real adapter paths with stubbed fetch: unique-name creation, known-ID and name-based recovery, original receipt preservation, no replay, empty/duplicate/truncated reports, wrong identity/status, legacy limitations, current permissions, in-flight account/term/member changes, stale reads, expired approvals, emergency stop, demo isolation, duplicate callbacks and late responses for changed scope. The existing approval regression now expects the earlier unresolved-write guard. Browser fixtures cover the recovery control, its read-only explanation, demo refusal with no receipt/state change, existing cancel/start workflows, accessibility scan and overflow. They do not simulate live-provider recovery success; that path is verified by the stubbed action tests.

Primary-source check, retrieved 16 November 2026 (publication dates not recorded): [Google campaign fields](https://developers.google.com/google-ads/api/fields/v26/campaign) documents selectable/filterable campaign identity, name and status; [Meta campaign reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign-group) documents campaign reads and status. The Meta account-campaign listing reference returned HTTP 429, so its current filter semantics and live account access are not claimed newly verified. Existing adapters are reused; no new API entitlement is promised.

Limits: no automatic recovery or external retry; no proof of failure from absence or PAUSED after an uncertain activation. Legacy attempts without a unique reference or recorded provider ID, changed identities/terms, multiple unresolved attempts and unexpected current statuses still need manual provider review. Status may change after observation. Full current budget/settings reconciliation before activation, real-account eligibility and provider behavior remain separate acceptance work. No hosted deployment or real campaign action was performed.

## 16 November 2026 — explicitly approved campaign spend-limit pauses

Inspected path: campaign preparation and existing budget scope → policy permission → owner review in Ads → `adMonitoring.configure` → indexed cron dispatch and `claimCheck` → existing Google/Meta account/report adapters → deterministic spend assessment → `observe` authorization and single pause claim → existing status-write/read-back adapters → receipt, campaign state, audit and owner notification → read-only reconciliation. Manual performance advice remains separate. The prior policy default and recommendation text did not implement or authorize a monitor.

Implemented:

- A new explicit approval subject using the existing approval store, hash and policy validator, bound to tenant, exact account/campaign, current artifact version, campaign terms, dates, audience/destination, currency/daily/total budget and stop rules. Approval duration follows the existing policy (1–336 hours); owner/admin/reviewer approval is required. The old default-true preference does not enroll any campaign. Disabling stops future checks without changing live campaign state.
- Every five minutes, the cron dispatches at most 20 due campaigns; each has a 15-minute check interval and atomic lease. Queue throughput is bounded, not a 15-minute service guarantee. Reads use the approved start date through today's partial day in the verified ad account timezone. Campaigns requiring more than 90 days of reporting remain unknown; Google reads at most two pages and Meta five account-level pages. Empty/malformed/truncated/duplicate/out-of-window reports, missing currency/timezone, invalid spend and unsafe totals cannot trigger a pause. Google sums micros and floors once at currency precision to avoid rounding a below-limit amount up to the threshold; Meta retains exact decimal minor units.
- Current permission of the approving member, policy, emergency stop, account/provider/scopes, artifact version, terms and expiration are rechecked before reading and before claiming the pause. An over-five-minute read cannot authorize the action. A disable or material change during retrieval prevents it. Foreign account/approval references are ignored rather than exposed or invalidated. Malformed secrets produce a fixed reconnect message without credential fragments.
- At or above the approved planned total, one atomic execution claim precedes one pause attempt. Missing or zero conversions never establish tracking failure. Read errors remain unknown and retry on a later due check while authority remains valid. External pause attempts never automatically retry. A verified read-back must name the exact campaign; failed and uncertain outcomes are distinct and visible. The durable receipt, audit and owner notice record the result. Unresolved claims block renewed approval. After five minutes an approver can request read-only reconciliation; only exact-campaign PAUSED status can confirm the result, with permission and destination checked again before recording. ACTIVE/unknown/wrong-ID responses do not replay an action.
- The Ads UI presents scope, threshold, cadence, expiry, account-local observation and uncertainty. Review cancellation creates no approval. Changed terms remount the confirmation. Policies now describes permission for separately approved monitors. Demo monitors perform no live provider reads or writes. Stopping a monitor does not pause its campaign.

Verification commands/results:

```text
pnpm exec vitest run tests/convex/ad-monitoring.test.ts tests/unit/spend-monitor.test.ts tests/convex/campaign-authorization.test.ts tests/convex/ad-report-integrity.test.ts tests/convex/ad-budget-currency.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/integrations.adapters.test.ts tests/unit/integrations.core.test.ts
215 passed across 9 files

E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/campaign-spend-monitor.spec.ts
2 passed: desktop Chromium and Pixel 7 emulation
```

`pnpm typecheck` passed for the application and Convex. Changed-file ESLint and `git diff --check` passed. Convex types were regenerated through the isolated local backend workflow; no generated file was hand-edited.

Provider tests use synthetic credentials and stubbed fetch; they exercise both actual adapter paths without contacting providers. Cases include absent approval, expired/changed terms, permission and tenant isolation, artifact-version changes, interrupted claims, source uncertainty, below-threshold rounding, threshold breach, single-write behavior and read-only recovery. Browser checks use isolated demo campaigns, inspect the stored approval and absence of action receipts, test cancellation and stopping, and run accessibility/overflow checks. The initial accessibility scan ran during the entrance animation; waiting for its actual completion resolved the transient contrast result. These scans do not establish full accessibility conformance.

Current primary-source review (retrieved 16 November 2026; publication dates not recorded): [Google campaign update sample](https://developers.google.com/google-ads/api/samples/update-campaign) supports status-only PAUSED updates; [Google data freshness](https://support.google.com/google-ads/answer/2544985?hl=en-en) states that cost reports can lag and later change; [Meta campaign reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign-group) documents campaign reads and updates; [Meta authorization](https://developers.facebook.com/documentation/ads-commerce/marketing-api/get-started/authorization) documents ad permissions, account access and review requirements. The code reuses existing providers/scopes; no app access approval or live eligibility is inferred from these documents.

Limits: provider reporting, queue and pause delays can cause spending beyond the threshold. This is not a hard billing cap, profitability diagnosis, or tracking-health monitor. Account eligibility, configured credentials, Google developer-token access and applicable Meta app review/access remain operator setup and live-validation requirements. Permission-controlled safety pauses deliberately do not require a currently paid subscription; they cannot increase spend. A disable or policy change cannot recall a request already claimed/sent. Only the latest spend observation is stored on the campaign; failure changes and action outcomes are audited, not a complete immutable daily spend ledger. Interrupted creation/activation recovery, 90-day-plus campaigns, production load, and real-account execution remain separate work. No hosted deployment or real campaign action was performed.

## 16 November 2026 — campaign report integrity before monitoring

Audit path: `adPerformance.syncPerformance` → `googleAds.getCampaignMetrics` / `metaAds.getInsights` → shared HTTP/Graph pagination and row parsing → daily aggregation → `ads.recordPerformanceSnapshot` → `ads.list` → `CampaignCard` efficiency advice. The missing automatic monitor could not safely reuse these inputs: twelve initial regressions reproduced accepted empty, missing-spend, duplicate and truncated Google reports; accepted missing-currency, duplicate, negative-spend and truncated Meta reports; missing snapshot source identity; Meta's wrong report cutoff; and guessed unknown timezones.

Confirmed repairs:

- Report parsing distinguishes missing from explicit zero. Required spend/click/impression data must be valid; optional Google conversions/value remain absent when any daily row lacks them. Meta action totals remain absent when a daily row lacks action data. Bad values are rejected, not silently normalized. Meta provider decimal text is retained for exact minor-unit conversion; Google micros are summed safely and rounded once. Converted monetary results are not revenue forecasts.
- Daily rows require valid in-window dates and unique days. Google results must match the requested campaign. Meta still reads bounded account-level pages and selects the exact campaign; unrelated known campaigns are excluded, unidentifiable rows are refused, and every selected row must report the expected currency. Overflow, malformed action totals, negative spend and incomplete pages are rejected.
- The shared cursor-loop guard now marks a repeated cursor incomplete. Google malformed row arrays and Meta malformed report pages/missing continuation cursors fail. Existing Graph consumers retain their non-strict behavior; the strict page contract is enabled for ad insights. No unfinished page set is saved as a complete campaign report.
- Both providers require the account's recognized timezone. Meta reads `timezone_name` with existing account details. Windows exclude the current account-local day and remain capped at 90 days. No UTC/workspace fallback is invented. The UI states the actual account timezone and row count; calendar window duration is not called a count of observed rows.
- Saved reports retain request start, account/campaign identity, timezone, row count and validation version. The final mutation rechecks current tenant membership, provider/account/campaign/currency and expected date window. An earlier-started request cannot replace a newer saved report. Readers withhold mismatched or legacy unvalidated snapshots and explain the required refresh. Old values are not migrated. A rejected refresh leaves the earlier stored report unchanged.

Verification:

```text
pnpm exec vitest run tests/convex/ad-report-integrity.test.ts tests/unit/campaign-report.test.ts tests/convex/ad-performance.test.ts tests/convex/campaign-authorization.test.ts tests/convex/ad-budget-currency.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/campaign-performance.test.ts tests/unit/integrations.adapters.test.ts tests/unit/integrations.core.test.ts tests/unit/integrations.social.test.ts tests/unit/integrations.csv.test.ts tests/unit/campaign-money-display.test.tsx
225 passed across 13 files

pnpm exec vitest run tests/unit/campaign-report.test.ts tests/unit/campaign-performance.test.ts
32 passed after decimal-text and calendar-window wording checks

pnpm exec vitest run tests/convex/ad-report-integrity.test.ts
22 passed after adding in-flight campaign/member changes

pnpm typecheck
application and Convex passed
```

Changed-file ESLint and `git diff --check` passed. Tests use synthetic credentials and stubbed fetch; Google calls only its read-only search endpoint and Meta only GET. Assertions verify no approvals, action receipts, pause or campaign-state changes from reporting. Tenant isolation, account/campaign changes, membership loss, old requests, source drift and legacy reports are exercised. The broad suite also covers existing approval and budget behavior. These counts overlap and should not be added as unique tests.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/campaign-report-evidence.spec.ts` — desktop Chromium and Pixel 7 emulation passed, two checks in 9.6 seconds. Isolated demo fixtures show validated spend/cost-per-conversion and timezone/row context, while withholding a legacy total and preserving the stored value. No external write receipts, page errors, horizontal overflow or serious/critical axe findings. Screenshot inspected; the follow-up calendar-day wording is covered by the focused unit test. This does not establish full accessibility or live provider operation.

Current primary documentation inspected 16 November 2026:

- [Google reporting pagination](https://developers.google.com/google-ads/api/docs/reporting/paging), updated 13 November 2026: REST callers must follow page tokens to finish reading a report.
- [Google zero metrics](https://developers.google.com/google-ads/api/docs/reporting/zero-metrics), updated 13 November 2026: segmented reports can omit all-zero rows. Therefore a missing day is not itself evidence of broken tracking; ClimbOS does not fabricate explicit daily observations or turn an entirely empty response into a verified zero result.
- [Meta Ads Insights](https://developers.facebook.com/documentation/ads-commerce/marketing-api/insights), no publication date recorded: reporting requires `ads_read` and supports dated reports from ad objects.
- [Meta Ad Account reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-account), no publication date recorded: `timezone_name` provides the account timezone. This increment adds no new OAuth scope or provider.

Limits and next work: these are owner-triggered reads through yesterday, not a current-spend monitor. Google optional missing metrics and Meta missing action rows deliberately reduce available advice; the system cannot prove why a provider omitted them. Provider delays, modeled conversions, corrections, refunds, attribution and true tracking health remain distinct. Successful snapshots still replace the previous successful snapshot; no immutable reporting history or durable failed-refresh log was added. Meta retains its bounded account-level report read and can refuse large accounts. No auto-pause, new approval, deployment, paid model request or live API call occurred. Any automatic pause implementation must independently bind owner authorization to campaign/account/threshold/scope and use an appropriate fresh measurement, with explicit unknown/error and reconciliation states. Full requirement-level verification remains open.

## 16 November 2026 — exact ad-budget entry and current spending-policy checks

Traced owner entry in Policies, Business & goal, Plan and onboarding → policy/goal storage → ad draft preparation → campaign review → exact approval → atomic execution claim → Google/Meta monetary payload. Initial focused tests reproduced JPY amounts multiplied by 100, KWD/CLF precision lost, excess precision rounded, ambiguous old policy values shown as confirmed and goal changes leaving the spending policy in a different currency.

New input uses the existing exact decimal parser and recognized currency set. Excess precision, negative/non-finite/unsafe amounts and unsafe totals are rejected. Campaigns and materially changed policies carry `currency-minor-v1`; older positive non-two-decimal amounts are not reinterpreted or migrated. Owners confirm the intended policy amount; confirmation starts a new policy version even if its raw integer stays the same. Ambiguous campaigns require a newly prepared record and renewed approval. Their old values remain unchanged and their daily/total display is withheld. Two-decimal legacy budgets and zero retain compatible interpretation. Target cost already used currency-aware conversion and remains separately displayed.

Goal setters reject excess precision, carry goal/business currency into the policy and restrict confirmation of unknown/cross-currency limits to policy managers. Current forms send the displayed currency to reject stale submissions. Preparation checks the shared rolling 31-day planned reservation; approval and execution recheck known units, consistent totals/dates, matching currency and current cap. Unit version joins the approval scope. Missing or excessive history remains a refusal, not an assumed zero. Preparing or confirming a policy does not write to an ad provider.

Meta now reads the selected account currency before creation/activation. Mocked action tests verify missing/mismatched currency causes no POST and matching KWD sends the exact integer `spend_cap`. Google already checks account currency on creation; payload tests now cover JPY, KWD and CLF conversion to micros. These are arithmetic/adapter checks, not claims that each provider accepts all tested ISO currencies.

The UI calls the amount a planned total. Google currently uses average daily `amountMicros`, not campaign-total budgeting; Meta creates a campaign with a total spend cap and still needs ad-set setup. Screenshot review also revealed the old “Auto-pauses if” promise. Repository tracing found only the Pause all caller of `pauseCampaignForStop`, not a spend/tracking-loss monitor. Campaign cards now describe pause conditions for review; Policies labels the flag a saved preference. This wording correction does not implement the missing monitor. Existing stored stop rules remain in approval hashes, unchanged. Pause all is a request, not immediate confirmed cessation of billing.

Verification commands and actual results:

```text
pnpm exec vitest run tests/convex/ad-budget-currency.test.ts tests/convex/campaign-authorization.test.ts tests/convex/safety.test.ts tests/convex/tenancy.test.ts tests/convex/ad-performance.test.ts tests/convex/approval-claims.test.ts tests/unit/campaign-budget.test.ts tests/unit/campaign-scope.test.ts tests/unit/campaign-money-display.test.tsx tests/unit/integrations.adapters.test.ts tests/unit/integrations.csv.test.ts
150 passed across 11 files

pnpm exec vitest run tests/convex/onboarding-defaults.test.ts tests/convex/goal-kinds.test.ts tests/convex/acquisition-profile.test.ts tests/convex/business-details.test.ts tests/unit/integrations.adapters.test.ts
67 passed across 5 files (includes 3 added Google payload cases; adapter coverage overlaps the first run)

pnpm exec vitest run tests/unit/campaign-money-display.test.tsx
2 passed after adding the monitoring-disclosure assertions

pnpm typecheck
application and Convex checks passed
```

Changed-file ESLint and `git diff --check` passed. The existing campaign authorization fixture now removes its unrelated seeded demo reservation before exercising its own campaign; it does not loosen the shared cap.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/ad-budget-currency.spec.ts e2e/campaign-authorization.spec.ts` — four checks passed in 38.5 seconds on desktop Chromium and Pixel 7 emulation. The new isolated demo fixture verifies blocked preparation before confirmation, blank legacy policy amount, KWD 100.123 stored as 100123, retained old 60000 policy, KWD 1.234/day over 14 days stored as 17276, exact target cost, zero campaign execution approvals/receipts from preparation, and legacy campaign refusal with preserved raw values. Existing checks exercise queue cancellation, fixture create/start and interruption refusal. After the monitoring disclosure changed, the budget pair was rerun with explicit disclosure assertions. No page errors, horizontal overflow or serious/critical axe findings. Screenshots reviewed; this is not full accessibility conformance or live-account testing.

Provider sources inspected 16 November 2026:

- [Google campaign budgets overview](https://developers.google.com/google-ads/api/docs/campaigns/budgets/overview), updated 13 November 2026: average daily budgets and separate campaign-total budgeting. Existing ClimbOS requests use the daily path.
- [Google campaign budget fields](https://developers.google.com/google-ads/api/fields/v26/campaign_budget): micros express the advertiser account currency.
- [Meta campaign reference](https://developers.facebook.com/documentation/ads-commerce/marketing-api/reference/ad-campaign-group): integer account-currency subunits for `spend_cap`; campaign-level dates do not replace ad-set setup. No publication date recorded. The dedicated Meta currency page returned HTTP 429/cache failure; full currency eligibility/minimums were not verified.

Remaining limits: no live provider acceptance, spend, billing or automatic-monitor verification; shared UTC 31-day planning is not a provider billing cap. Existing oversized/ambiguous history needs owner/operator review. No general automatic migration or interrupted-write reconciliation was added. Automatic monitoring must use real, complete, dated measurements and exact configured policy; do not infer tracking failure from zero conversions or absent imports. The complete 410-item behavioral audit and business-quality evaluation remain open. No hosted deployment, live send or live campaign action occurred.

## 16 November 2026 — campaign approval persistence, cancellation and replay

Traced campaign preparation and owner review → `ads.decide` → persisted approval scope → scheduled `executeCampaignWrite` → provider/fixture adapter → action receipt and campaign state. The database rejected the existing account/review scope fields; after fixing that schema mismatch, regressions reproduced queued writes executing after rejection, local rejection falsely marking active ads paused, missing execution-time approver permission checks, and duplicate approval creation. The unit contract also omitted the total campaign budget and external campaign identity.

Approval persistence now accepts the existing account and review terms and binds the total budget and external campaign identity. The content hash includes the displayed stop rules. Changes require new approval; legacy hashes are not rewritten. Owner rejection invalidates pending approvals and is audited, preserves a recorded paused state, and never claims to pause live ads. The worker checks campaign state/action, tenant and subject, account/provider, current approver permission, paid access, policy, expiry and emergency stop before an atomic execution claim. Repeated approval clicks reuse the current matching approval; concurrent queue deliveries and older duplicate approvals cannot claim two writes for the same campaign. Definitive failed attempts require renewed approval. Unknown provider results remain uncertain.

An unfinished execution claim is retained even if policy changes invalidate approval. The UI distinguishes queued approval from started processing, supports cancellation of a queued start, and prevents resubmitting an unfinished request. A claimed attempt is not automatically retried after a crash or lost result. Provider-side reconciliation of such an interruption is still a manual operator task; a claim is not proof that the request reached the provider. Cancellation cannot recall an already-sent request. Changes after the atomic claim cannot be made atomic with a third-party network request.

Verification:

```text
pnpm exec vitest run tests/unit/campaign-scope.test.ts tests/unit/campaign-budget.test.ts tests/unit/campaign-money-display.test.tsx tests/convex/campaign-authorization.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/convex/ad-performance.test.ts tests/convex/approval-claims.test.ts
60 passed across 8 files
pnpm typecheck
passed: application and Convex
```

Changed-file ESLint and diff checks passed. Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/campaign-authorization.spec.ts`. Desktop Chromium and Pixel 7 checks cover cancellation of queued creation/activation, rejection of those queue entries when replayed, the visible unresolved-claim state with disabled submission, and fixture-only creation/activation through the real UI and local schema. Stored approvals retain the account, total budget, review terms and execution timestamps; activation binds the exact synthetic external campaign. Exactly two successful receipts are fixture-verified, with no live provider writes. No page errors, horizontal page overflow or serious/critical axe findings; screenshots inspected. Initial browser attempts used an incorrect `dialog` role and internal status labels; corrected to the existing `alertdialog`, “Not created” and “Running” UI. Visual review also replaced the misleading underlying “Needs approval” badge during a queued/started write with “Approved, queued” or “Result pending”. The React review adds no effects or subscriptions. No real provider write, spending, hosted deployment, budget conversion or historical money migration is part of this increment.

Remaining monetary work: fixed-*100 daily/monthly budget inputs, currency-consistent policy/goal updates, old non-two-decimal budget confirmation, current cap checks through execution, and provider-specific monetary conventions. The exact approval repair does not establish those amounts are correct or that a platform enforces ClimbOS's displayed daily/total limits. The full 410-item behavioral audit and broader real-business quality evaluation remain open.

## 16 November 2026 — exact currency display across shared money views

Traced stored minor-unit amounts → `src/components/app/money.ts::minorToDisplay` → Results metrics/charts, attribution and ad-spend tables, forecast details, campaign approval cards, plan ad-allocation summaries, creator reports and billing/admin order amounts. The old helper divided every currency by 100 and rounded larger totals to whole units. Direct runtime checks showed 1,200 JPY minor units as ¥12 and 12,345 KWD minor units as KWD 123.45. Twenty of the initial 23 focused cases failed before the repair.

The shared helper now delegates to `shared/economics/currency.ts::formatMinorMoney`, retaining each recognized currency's decimal scale and all stored minor units. Integer/fraction formatting uses BigInt to preserve the final minor unit near the safe-integer boundary; negative subunit amounts, zero, refunds and larger totals retain their exact representation. Missing/unsupported currency or invalid/unsafe/fractional stored amounts display Unknown. Results and creator-report callers no longer substitute USD for missing currency. Current-runtime currency enumeration is supplemented by the three accounting units already represented in the import exponent table (CLF, UYW, UYI); the initial enumeration-only change was caught by the four-decimal CLF test and corrected. This does not add foreign-exchange conversion or rewrite any saved money, forecast, approval or billing record. USD provider-cost and credit formatting remains separate.

Verification:

```text
pnpm exec vitest run tests/unit/money-display.test.ts tests/unit/attribution-presentation.test.tsx tests/unit/forecast-forward-score.test.tsx tests/unit/campaign-money-display.test.tsx tests/unit/results-coverage.test.tsx tests/unit/pipeline-money.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/convex/ad-performance.test.ts
67 passed across 9 files
pnpm typecheck
passed: application and Convex
```

Changed-file ESLint and diff checks passed. Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/money-display.spec.ts` — two passed in 11.8 seconds, desktop Chromium and Pixel 7 emulation. Isolated fixture Results show a KWD 12.345 subtotal and separate attribution tables displaying ¥1,200, KWD 12.345 and $1,000.01. Stored ledger/daily records, campaigns, approvals, action receipts, forecasts and webhook deliveries remain unchanged by reading. No page errors, horizontal page overflow or serious/critical axe findings; screenshots inspected. Component regressions verify forecast and campaign-card money, unknown currency and no execution requests from rendering. The React review found no new hooks, effects, subscriptions or component structures. No external provider calls, live spending or hosted deployment.

Confirmed next gap: `convex/ads.ts::prepareCampaign` still computes a daily budget with `Math.round(args.dailyBudget * 100)` and some audit/stop-rule text uses `/100`; `convex/settings.ts::updatePolicy` uses `*100` and its policy read uses `/100`, while goal setters already use currency-dependent helpers. Correct display does not repair those writers or establish the original intent of old non-two-decimal budgets. Audit preparation → policy → approval scope → provider adapter before enabling affected live campaigns; preserve original records and require exact renewed approval for corrected consequential amounts. Provider-specific monetary conventions, budget-input precision and old-value reconciliation remain unverified. Separate Results-explanation coverage and the full 410-item behavioral audit also remain open.

## 16 November 2026 — owner-recorded sales versus payment evidence

Traced owner `crm.create/update` → CRM sale mirrors in `revenueEvents` → billing-day materialization, Results/Home, attribution, first-payer forecasts, repeat-payment cohorts, strategy/model-check context and Results explanation. Six new regression cases failed before the fix: a won deal counted as a payer, a recorded sale plus imported payment doubled revenue, a legacy JPY sale appeared as payment evidence, old daily aggregates remained usable, repeated imports did not repair those aggregates, and CRM-only history could produce a paying-customer forecast.

CRM mirrors remain stored for compatibility and owner-reported deals remain visible in Customer progress and strategy pipeline context. A shared source rule now excludes these mirrors from payment calculations, including old mirrors with unconfirmed currency units. Other imports are still source observations, not independently verified cash or profit. The rule does not resolve duplicate Stripe/CSV or other cross-provider imports. Bounded reads retain their overflow checks before exclusion, so omitted payment history is not silently accepted.

New billing-day aggregates record `payments-excluding-crm-v1`. Real legacy `billing` aggregates without that basis are unavailable in Results/Home, forecasts and the Results-explanation context until the affected billing dates are re-imported. Re-importing an existing event rebuilds its day without duplicating the event. Invalid money, unsafe totals and a 10,001-record rebuild sentinel reject the transaction rather than saving a partial refreshed total. The rebuild retains its bounded three-day query window. Fixture daily data remains synthetic. First-payer forecast evidence is now v3, so old v2 definitions cannot silently be scored against the corrected population. Business-model evidence hashes include the changed billing basis; old model evidence requires review. Original forecast history and CRM amounts are not bulk rewritten.

Verification:

```text
pnpm exec vitest run tests/convex/crm-payment-evidence.test.ts tests/convex/crm.test.ts tests/convex/strategy-evidence.test.ts tests/convex/first-payer-evidence.test.ts tests/convex/cohort-evidence.test.ts tests/convex/analytics-new-customers.test.ts tests/convex/analytics-coverage.test.ts tests/convex/forecast-evidence.test.ts tests/convex/attribution-evidence.test.ts tests/convex/business-model-check.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/results-coverage.test.tsx tests/unit/climb-tool-output.test.ts tests/unit/attribution-presentation.test.tsx
136 passed across 15 files
pnpm typecheck
passed: application and Convex
```

Changed-file ESLint and diff checks passed. Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/crm-payment-evidence.spec.ts` — two passed in 7.4 seconds, desktop Chromium and Pixel 7 emulation. Isolated demo records initially show no payment/customer/cohort evidence from a CRM sale and an unavailable legacy aggregate; adding a synthetic billing record shows one $10 payment, not two. Source separation is visible in the interface. No page errors, horizontal page overflow or serious/critical axe findings; screenshots inspected. Workflow, approval, action-receipt, forecast and webhook-delivery records remain unchanged by the read checks. The first browser run used a funnel-row locator where the no-data view renders a metric card; the corrected test follows the actual UI. The strategy test runs the real workflow with a fake model, verifies both pipeline evidence and the payment exclusion reach the writer, and creates no external-action receipt. No real-model evaluation, provider action, hosted deployment or migration was performed.

Remaining limits: owner/import provenance is not payment verification; cross-provider deduplication and complete import coverage remain unresolved. Historical daily totals need an explicit source refresh, and the bounded rebuild can reject high-volume windows. The separate Results explanation still needs a broader period/coverage audit beyond the legacy-billing guard added here. A further code lead found during browser review is `src/components/app/money.ts::minorToDisplay`, which still divides all currencies by 100; trace its JPY/KWD consumers before changing the shared presentation helper. The 410-item behavioral audit and real-business quality evaluation remain open.

## 16 November 2026 — CRM values, currency precision and unknowns

The 410-item inventory review led into `crm.create/update/list` → persisted `deals` → `syncRevenue` and queued `deal.won` payloads → Customer progress and the assistant `get_pipeline` tool. Six initial regressions demonstrated existing monetary defects: JPY multiplied by 100, KWD rounded to hundredths, missing values summed as zero, negative values clamped to zero, excess precision silently rounded, and unsafe amounts accepted. A separate new-version test initially failed because the old schema had no unit-version field; that initial schema failure is not behavioral proof.

The path now reuses the existing currency helpers and validates whole minor units, non-negative input, safe integer bounds and supported precision. Entry does not silently round. The displayed currency is checked at save; existing deals retain their currency. New or reconfirmed values carry `currency-minor-v1`. Old non-two-decimal values and invalid stored amounts stay unknown in this view/tool and need owner review; no historical value is guessed or bulk rewritten. A newly entered won deal now has its close timestamp and recorded-revenue row, and synthetic demo sales are marked fixtures. Missing versus explicit zero values remain distinct in queued sale payloads, with an owner-reported evidence label. Existing configured webhook/event behavior is preserved; tests inspect queued payloads without delivering them externally.

Customer progress uses separate recorded subtotals per currency, with missing/review counts. The existing 500-record read now has a 501st-record sentinel and visible coverage; a capped, mixed-currency, incomplete or unsafe value cannot become a whole-pipeline total. The assistant uses the same summaries, explicit major-currency units and owner-report limitations. Possible value is not a probability-weighted forecast, confirmed payment or profit. Actual value changes are audited. An unchanged blank field cannot clear an unconfirmed legacy amount merely by receiving and losing focus.

Verification:

```text
pnpm exec vitest run tests/convex/crm.test.ts tests/convex/crm-loss-reasons.test.ts tests/unit/pipeline-money.test.ts tests/unit/pipeline-outcomes.test.tsx tests/unit/climb-tool-output.test.ts tests/convex/tenancy.test.ts tests/convex/webhooks.test.ts tests/convex/safety.test.ts
49 passed across 8 files
pnpm typecheck
passed: application and Convex
```

Changed-file ESLint and diff checks passed. Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/pipeline-money.spec.ts` — final rerun: two passed in 16.9 seconds, desktop Chromium and Pixel 7 emulation. The add form retains its entry currency while open; a changed currency requires reopening and re-entering the value. The tests inspect separate currencies and missing/legacy labels, add KWD 9.876 as 9,876 minor units, edit it to 4.321 as 4,321 units, and verify an untouched legacy JPY amount remains stored but unconfirmed. Desktop and mobile screenshots inspected. No page errors, horizontal page overflow or serious/critical axe findings. Workflow, approval, action-receipt and webhook-delivery records in the isolated workspace are unchanged by these local form checks. No model calls, external sending or hosted deployment.

Remaining limits: older CRM-derived revenue rows already copied into the revenue ledger are not automatically migrated by this change. Confirming a won deal's correct value updates its corresponding recorded row; until then, downstream analytics/provenance paths require a dedicated audit and must not be represented as verified cash receipts. Currency precision alone does not establish payment, profitability, customer identity or forecast quality. The pipeline remains a newest-500 view rather than a paginated full ledger. Real-account performance, conversation intelligence and the requirement-level 410-item behavioral audit remain open. The inventory/code-location check is not completion proof.

## 16 November 2026 — recorded-charge cohorts and strategy evidence

Traced `revenueEvents` → `analytics.cohorts` / `computeCohorts` → Results, and the shared calculator → `jobWrites.jobContext` → `jobs` strategy writer. All six initial integration regressions failed before repair: refunded entry, earlier history outside the displayed window, fixture/future contamination, malformed amounts, missing customer IDs and capped history.

Cohort entry now uses the first recorded positive charge before refunds, per source/customer and selected currency, in UTC. Refunds change recorded net amounts, not entry or charge activity. Identical event identities are deduplicated; conflicting copies, ambiguous order/refund ownership, invalid dates/amounts/identities, missing positive-charge customer IDs and unsafe totals withhold figures with a reason. Future charges and zero charges cannot establish entry. Unfinished follow-up months remain null; entry-month counts are provisional. Recorded zero activity is not verified churn, particularly for annual or irregular billing.

The owner query establishes entry from the loaded ledger before filtering visible cohort months. It uses an existing fixture-aware index for real workspaces, rejects mixed real/synthetic demo records, and reads at most 10,001 records as a sentinel for the existing 10,000-record bound. Overflow withholds the calculation rather than reassigning old customers. Only cohorts whose entry month starts within the account's history window are displayed; earlier records establish identity without extending visible history entitlement. This is bounded history, not a scalable unlimited aggregation service.

Strategy subscription cohorts reuse this assessment and withhold percentages when the shared history read is capped. Their scope remains subscription charges; Results includes orders and subscription charges. Both use the same recorded-charge/refund definition, source scoping and uncertainty rules. The strategy integration test exposed an adjacent crash in concentration calculations on malformed money. That context boundary now withholds affected billing signals, retains a plain-language evidence issue, and lets the strategy writer continue without invented figures. A fake-model full-plan test confirms the issue reaches the actual writer; no live model quality claim is made.

Results now says “Recorded repeat payments,” shows counts beside percentages and exposes the import-completeness limitation outside collapsed details. The first browser pass caught that limitation hidden inside the existing Definition disclosure; this was corrected and rechecked. Empty histories no longer claim that the business has no paying customers. Existing tenant checks and action authorization are unchanged; calculations and reads create no action receipts or approvals.

Verification:

```text
pnpm exec vitest run tests/unit/cohorts.test.ts tests/convex/cohort-evidence.test.ts tests/convex/analytics-new-customers.test.ts tests/convex/first-payer-evidence.test.ts tests/unit/repeat-purchases.test.ts tests/unit/customer-concentration.test.ts tests/unit/refund-exposure.test.ts tests/convex/strategy-evidence.test.ts tests/convex/safety.test.ts tests/convex/tenancy.test.ts
76 passed across 10 files
pnpm typecheck
passed: application and Convex
```

Changed-file ESLint and diff checks passed. Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/first-payer-evidence.spec.ts` — two passed in 9.0 seconds (desktop Chromium and Pixel 7 emulation). The fixture retains the original entry month after a full refund, then replaces the table with an explicit unavailable reason when an earlier malformed payment is appended. No page errors, horizontal page overflow or serious/critical axe findings; desktop and mobile screenshots inspected. Read-only Results leaves workflow, approval, receipt and forecast records unchanged. The final refund-identity guard is additionally covered by the focused unit suite; the browser fixture does not exercise that conflict.

Remaining limits: complete provider import coverage, contractual retention/churn, merged identities across providers, refund reconciliation against settled billing, high-volume aggregation, real business outcomes and the full 410-row audit are not established. One-off repeat-purchase and source/concentration calculations retain their separate definitions and require their own remaining evidence audit; the malformed-money guard is not a claim that all such paths are repaired. No hosted deployment, paid/live model request or external campaign action occurred; only the isolated loopback backend was synced.

## 16 November 2026 — first recorded payers, refunds and shared history bounds

Traced `revenueEvents` → `firstRecordedPayerDays` → Results/assistant metric and first-payer forecast creation/forward scoring. Five new integration regressions failed against the original path: fully refunded first payments could make later renewals new customers; fixture history influenced real-workspace counts; zero charges became observed payer days; a known old customer with 1,200 later payments became unavailable because every history loaded 1,000 rows; malformed older money could support a count instead of uncertainty.

The definition now counts the earliest recorded positive non-refund charge **before** refund amounts, scoped by billing source and customer ID. Later refunds do not reset acquisition. Free orders and refund-only observations do not create observed payer days. Real-workspace period/history reads exclude fixtures through two new indexes before applying bounds; mixed real/synthetic demo observations are unavailable. Selected dates use the existing local-midnight helper and exclude today's incomplete data. Period change remains unavailable because complete import coverage is unknown.

The period read has a 2,001-row sentinel. Customer history and duplicate-identity verification share one 2,000-document budget with an overflow sentinel, instead of reading up to 1,000 events for each of 2,000 customers. Each history stops at the first positive charge, so later renewals need not be loaded to establish an existing payer. Invalid earlier records, conflicting first-payment identities, truncated period reads and exhausted history budgets return explicit unknowns. Evidence problems remain visible even when every loaded payer record is malformed. This is a bounded calculation, not an unlimited historical aggregator or a production load/byte-size benchmark.

Results and first-payer forecasts reuse this definition. New forecast evidence uses `billing-first-recorded-v2`; old v1 source snapshots are not silently compared with corrected outcomes. Original saved training history is retained. No historical event is rewritten, no customer identities are merged across billing providers, and no ingestion/provider/authorization behavior is added.

Verification:

```text
pnpm exec vitest run tests/convex/first-payer-evidence.test.ts tests/convex/analytics-new-customers.test.ts tests/convex/forecast-evidence.test.ts tests/convex/analytics-coverage.test.ts tests/convex/attribution-evidence.test.ts tests/unit/climb-tool-output.test.ts tests/convex/safety.test.ts tests/convex/tenancy.test.ts
80 passed across 8 files
pnpm typecheck
passed: application and Convex
```

Targeted ESLint and diff checks passed. Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/first-payer-evidence.spec.ts` — two passed in 9.9 seconds, desktop Chromium and Pixel 7 emulation. Synthetic workspaces show zero first-recorded payers for a renewal whose first charge was refunded, then reactively show an unavailable count and invalid-history reason after an earlier malformed payment is appended. No page errors, horizontal page overflow or serious/critical axe findings; screenshots inspected. Reading Results leaves workflow, approval, receipt and forecast records unchanged. The malformed-only-period visibility follow-up passed the final focused checks; browser fixtures exercise a malformed earlier record with a valid current charge.

Confirmed remaining issue from the same browser fixture: the separate cohort table initially treats the renewal as a November first-paid customer and moves that month to July when a malformed older amount is appended. `analytics.cohorts` / `computeCohorts` still use their own bounded-window/net-positive definition and need a complete follow-up across owner view and strategy context. This increment does not claim that retention or all customer-history paths are repaired. Complete provider coverage, causal acquisition, cross-provider identity matching, large-history aggregation and the full 410-item audit remain open. Only the isolated local backend was synced; no hosted deploy, live provider/model operation or external sending occurred.

## 16 November 2026 — attribution definitions and bounded source evidence

Traced billing ingestion and saved touches/platform observations → `analytics.overview` → existing first/last-touch calculator → Results “Where it came from” tab → `get_results` assistant contract. Confirmed that the attribution read started at UTC midnight and lacked an upper bound despite the displayed completed local-day range, took only the first 20 touches per customer without disclosure, included synthetic records in real-workspace attribution/claims, and silently accepted capped or conflicting observations. The table labeled order/payment-event counts as customers and called arithmetic self-reconciliation “Matches billing.” The ROAS card divided revenue from any ad-like channel name by Google/Meta spend without establishing a shared scope.

The existing overview now reads billing inside the displayed completed local dates using the existing timezone helper. A new `touches.by_org_occurred` index reads the bounded 30-day lookback without a per-customer 20-row cutoff. Billing and touch reads each use a 2,001-row sentinel, withholding attribution beyond 2,000 records. Real workspaces exclude fixture billing/touches/claims; relevant legacy touches lacking billing-source identity require a source refresh rather than an inferred customer match. Invalid money/currency/source identities, conflicting duplicate event identities, invalid channels and unsafe reconciliation withhold channel credit with owner-visible and assistant-preserved reasons. Identical-event deduplication, source/customer scoping, separate currencies, refunds and negative net values remain supported. Null-prototype channel/currency accumulators keep unusual external channel names as data.

Platform observations are bounded to the selected reported dates, with per-platform read sentinels and duplicate platform/date/currency and numeric checks. Invalid/capped totals remain unavailable, missing workspace-currency spend remains null, and records retain owner-reported/platform-reported/unknown/mixed origins. These are imported platform-date observations; matching timezone, account coverage and conversion definitions are not established. The Results card no longer presents a regex-derived revenue/spend ratio as ROAS. It retains recorded spend and explains the missing match; separate deterministic economics and modeled return calculations are unchanged.

The UI says “Payment events” and “Rows reconcile,” and explains renewals/repeat orders versus unique customers and arithmetic versus independent billing verification. First/last touch is explicitly limited to recorded touches in the lookback. Missing touch evidence is not proof of no marketing influence. Invalid evidence gets an unavailable message, not “no revenue.” Public provider APIs, spend, scheduling and approval behavior are unchanged. The React review retained the existing state/segmented-control patterns, table semantics and component library.

Verification:

```text
pnpm exec vitest run tests/convex/attribution-evidence.test.ts tests/unit/attribution-presentation.test.tsx tests/unit/attribution.test.ts tests/convex/analytics-new-customers.test.ts tests/convex/analytics-coverage.test.ts tests/unit/climb-tool-output.test.ts tests/convex/safety.test.ts tests/convex/tenancy.test.ts
81 passed across 8 files
pnpm typecheck
passed: application and Convex
```

Targeted ESLint and diff checks passed. Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/attribution-evidence.spec.ts` — two passed, desktop Chromium and Pixel 7 emulation. The isolated synthetic workspace contains repeat payments for one customer, an unmatched paid-channel label and an owner-imported claim. Checks cover definitions, unknown ROAS, source-origin labels and reactive conflicting-event warnings; workflow/approval/receipt records remain unchanged. No page errors, horizontal page overflow or serious/critical axe findings were observed. Mobile table overflow uses the existing table container; screenshots were inspected. The first browser attempt failed because the test did not open the source tab; the corrected test follows the actual navigation.

Remaining limits: these records do not establish complete imports, identity reconciliation across billing systems, independent truth, or causal impact. The first/last-touch method uses a fixed elapsed 30-day lookback. Refunds inherit an order's channel only if that order is in the selected event window; otherwise the existing refund-time rule applies and is disclosed. Matching claim and billing account/time definitions and qualified ROAS remain open. The separate `firstRecordedPayerDays` per-customer historical scan and other overview/cohort/AI-referral reads still need a transaction-wide scale/integrity audit; these focused changes do not prove the whole Results query fits all high-volume workloads. No full suite, live provider/model call, hosted deployment or external sending occurred. Only the loopback backend was synced. The 410-item audit remains partial.

## 16 November 2026 — weekly and shared report evidence integrity

Traced recorded activity → `reports.countsFor` → `reportBetween` → owner weekly view, `get_weekly_report`, client share, and weekly email/markdown formatting. Confirmed that mutable artifact/prospect timestamps could become publication/reply events, old queued sends and later job completions could be missed, post snapshots could become period reach, and the larger of two differently defined click totals was presented as one measure. Truncated reads and unknown values did not survive all output surfaces.

Reports now count distinct publication confirmations by verification time, recorded mailbox sends by send time (including later bounces), outbound reply messages by received time, prospects/bookings by creation time, currently won deals by recorded won time, completed jobs by finish time, and usage by event time. Five event indexes support these reads. Publication/export/fixture distinctions are retained; real workspaces exclude fixture publication receipts, replies and jobs. Reply counts are messages, not people or unanswered conversations. Deal status is owner-recorded, not verified payment; confirmed bookings are not attendance. No recommendation authorizes execution.

Period reach stays unknown because the current post-snapshot contract cannot establish it. Impressions never substitute for reach. Tracked-link counts use only complete UTC-day buckets contained in the selected window, with exact bucket dates and partial-boundary exclusions disclosed; partial windows cannot produce a period comparison. They remain distinct from platform clicks, customers and sales. Invalid or duplicate click buckets, missing publication identity, invalid usage values and read truncation withhold the affected count. Estimated usage retains its estimate label and cannot support a measured period change.

Every metric read has a sentinel. Usage and tracked-link reads are each bounded at 2,000 records per period, so the two periods' maximum activity scan is 30,018 documents, leaving room for the existing bounded context reads. This follows the current [Convex transaction limits](https://docs.convex.dev/production/state/limits), checked 16 November 2026. This is not a production byte-size or load benchmark; unusually large source documents can still exhaust a transaction's byte budget. Scaling beyond these counts requires aggregation or a separately designed paginated report, not presenting a truncated sample as a complete total.

Nullable values and explanatory notes pass through the app, assistant output schema, shared reports and email/markdown templates. Headline selection cannot turn an unknown send count into zero. Suggestions no longer promise that enabling outbound produces booked calls or treat every recorded reply as unanswered. Dates and upcoming-call labels use the workspace timezone. Public demo reports label synthetic activity and continue excluding internal credits/jobs; token revocation and tenant authorization remain enforced.

Verification:

```text
pnpm exec vitest run tests/convex/report-evidence.test.ts tests/convex/clientReports.test.ts tests/unit/weekly-report.test.ts tests/unit/weekly-report-email.test.ts tests/unit/climb-tool-output.test.ts tests/convex/safety.test.ts tests/convex/tenancy.test.ts
41 passed across 7 files
pnpm typecheck
passed: application and Convex
```

Targeted ESLint passed on all changed TypeScript files and the browser regression. Local browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/report-evidence.spec.ts` — two passed in 10.3 seconds, desktop Chromium and Pixel 7 emulation. Tests exercise the owner weekly page and an owner-created loopback share link, unknown reach despite large snapshot counters, preserved evidence notes, hidden internal measures, unchanged workflow/approval/action receipts, no page errors or horizontal overflow, and no serious/critical axe findings. Desktop owner and mobile share screenshots were inspected. The subsequent scan-budget tightening passed the focused regression/type/lint checks; the browser fixtures do not exercise high-volume histories.

Limits: these are counts of recorded events, not proof of complete provider/business coverage, unique customers, revenue attribution or causal growth. CRM status, source corrections and deletions can change historical reports; they are not immutable snapshots. UTC-day click storage cannot reconstruct local partial-day counts. Other attribution/follower paths and the full 410-item completion audit remain open. No full-suite run, paid model evaluation, live provider operation, hosted deployment or email sending occurred. Only the isolated loopback backend was synced.

## 16 November 2026 — honest totals, period comparisons and activity counts

Traced ingestion → the existing daily series reader → Results overview and Home snapshot → active `ThisWeekCard` / Results components → the assistant's `get_results` output contract. Confirmed that incomplete current/prior windows could produce growth percentages, overlapping sources could be summed into a headline total, and the UI divided unrelated analytics/billing populations into conversion rates. Eight new integration regressions failed before implementation.

Daily summaries now return nullable totals, recorded/expected day counts and coverage reasons. Missing days permit a clearly labeled recorded subtotal, but no period-change percentage. Duplicate/overlapping, mixed-source, invalid/non-finite, negative-count, mixed-fixture, truncated or incompatible/unknown workspace-setting observations withhold totals and chart points. Full matching calendar windows retain deterministic comparisons, including explicit zeros and negative net revenue. Source or fixture changes between otherwise complete periods withhold comparison. Fractional/non-finite reporting windows are rejected. These checks retain existing ingestion and permissions rather than silently fixing or rewriting source records.

First-payer Results use only dates with identified imported payment observations; neither missing current days nor a previous-only payment become invented zero days. Customer totals remain source-scoped counts from imported history. Truncated history withholds the count; unknown import completeness withholds period comparisons. This does not establish the number of all customers or identity reconciliation between providers.

The active Home Results card, the reusable snapshot component and Results show the same coverage/unknowns. Incomplete revenue series are not drawn as a continuous full-period chart. Visits, sign-ups and payers remain visible as separate activity counts, without conversion-rate or funnel graphics that imply matched people. The assistant tool preserves nullable totals, sample coverage, comparison reasons and health alerts and describes the same interpretation limits.

Verification:

```text
pnpm exec vitest run tests/convex/analytics-coverage.test.ts tests/convex/metric-health.test.ts tests/convex/home-snapshot.test.ts tests/convex/analytics-new-customers.test.ts tests/unit/climb-tool-output.test.ts tests/unit/home-business-snapshot.test.tsx tests/unit/results-coverage.test.tsx tests/convex/safety.test.ts tests/convex/tenancy.test.ts
66 passed across 9 files
pnpm typecheck
passed: application and Convex
```

Targeted ESLint on changed code/tests and `git diff --check` passed. Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/results-coverage.spec.ts` — two passed in 10.2 seconds, desktop Chromium and Pixel 7 emulation. Demo-only isolated workspaces exercise partial Results, a reactive overlapping-source total becoming unavailable, and the actual Home Results tab. No page errors, horizontal overflow or serious/critical axe findings; desktop/mobile screenshots were inspected. Workflow, approval, action-receipt and forecast records remain unchanged by reading the views. Only the loopback fixture backend was synced; no external provider action, paid model call or deployment.

Limits: a full set of daily rows is recorded-day coverage, not proof of complete provider/business coverage or unchanged provider account identity. These changes do not create linked-customer funnel instrumentation, reconcile competing sources, establish causation, or validate the separate weekly-report, client-report, attribution and follower paths. Legacy rows lacking workspace settings stay unknown until refreshed; no historical settings are invented. The 410-item completion audit remains open.

## 16 November 2026 — calendar-aware metric-health alerts

Traced `metricDaily` ingestion → bounded `analytics.series` read → tenant-scoped `analytics.overview` → deterministic `metricHealth` → the existing Results `HealthAlertsSection`. Confirmed that row slices treated sparse observations as calendar days, allowing separated zeros to become a consecutive-zero warning and old observations to become recent anomalies. Ten new regressions failed against the original helper before the repair.

The helper now uses actual calendar windows: consecutive recorded zero days; an observed baseline inside the preceding 14 days (minimum seven observations); and recent-week outliers against the preceding 28 calendar days (minimum 14 observations). Internal gaps within the bounded relevant history are disclosed as unknown, never synthesized as zero. Baseline sample counts appear in the explanation. Invalid/duplicate dates and non-finite values withhold statistical alerts. Current/future days are excluded; a one/two-day reporting lag is still tolerated by the existing freshness heuristic.

The Results reader also checks raw rows before aggregation hides duplicates. A 2,001-row sentinel detects the existing 2,000-row read limit; duplicate/overlapping observations, mixed sources, negative counts, or different/unknown workspace currency/timezone settings produce a check-source warning instead of an unusual-day or zero-run claim. Negative net revenue remains permissible. Existing totals remain visible with the warning; this increment does not reconcile their source populations or redesign Home totals and period comparisons. Workspace settings are not independent proof of provider reporting settings.

Verification:

```text
pnpm exec vitest run tests/unit/metric-health.test.tsx tests/convex/metric-health.test.ts tests/unit/forecasting.test.ts tests/convex/analytics-new-customers.test.ts tests/convex/safety.test.ts tests/convex/tenancy.test.ts
70 tests passed across 6 files
pnpm typecheck
passed: application and Convex
pnpm exec eslint convex/analytics.ts shared/forecasting/health.ts tests/unit/metric-health.test.tsx tests/convex/metric-health.test.ts
passed
```

The Convex tests exercise the actual overview with an America/Los_Angeles date boundary, missing days followed by explicit-zero recovery, viewer access, denied cross-tenant/anonymous reads, fixture exclusion, source overlap, unknown legacy metadata, currency changes and read truncation. Workflow, approval, action-receipt and forecast tables remain unchanged by reading Results. A server-rendered check verifies the owner-facing unknown-not-zero explanation in the existing alert component. No browser session, full suite, paid model evaluation, production sync, external action or deployment was run for this increment. Automated health thresholds remain heuristics, not calibrated business-specific detection, causal diagnosis or an authorization to act. Requirements 293 and 295 remain partial.


## 16 November: comparable forecast evidence and honest accuracy checks

Audit covered requirement clusters 26/28/29 (unsupported numbers and data limits), 295 (measurement failures), 311–315 (baseline, confidence and calibration), and 328/329 (insufficient data and plain-language forecasts). Actual path: integration/revenue ingestion → `metricDaily` or identified billing history → `analytics.createForecast` → deterministic `shared/forecasting` → saved forecast/backtest → `analytics.getForecast` → Results forecast detail. Confirmed defects: the creation mutation zero-filled missing observations; forward scoring only read the most recent 120 days; the detail chart re-read current history instead of preserving the training data; current workspace currency could relabel old amounts; first-payer forecasts used an obsolete counter instead of the billing-derived definition; negative net revenue was clamped to zero; the UI invented “about 80%” coverage when the held-out result was absent.

New owner-created forecasts use the latest uninterrupted observed segment ending yesterday, with at least seven days for the existing weekly baseline. Earlier gaps and excluded history are disclosed, never zero-filled. Missing recent observations require a source refresh; an unsupported horizon is rejected instead of silently changed to 30 days. Duplicate daily values, overlapping source totals, negative counts and truncated reads cannot become a forecast. Net revenue may remain negative. Daily ingestion now records the workspace currency/timezone basis; old or incompatible rows remain unknown, and only a comparable consecutive refreshed segment may be used. The basis records workspace settings, not independent verification of a provider's reporting timezone or complete business coverage.

First-payer forecasts reuse identified, source-scoped first positive payments from billing. Renewals and duplicate payments cannot become new customers through the old counter. A zero first-payer count is represented only on a date with an identified billing observation; dates without such observations remain missing. Existing billing/customer read bounds are enforced for this forecast path. These counts describe the imported history, not all customers or causal acquisition.

The existing forecast JSON now retains version-1 evidence: original currency, timezone, metric definition, source identity and exact training points. Later import corrections do not rewrite that training snapshot. Forward checks query the forecast's actual date window, including reports older than 120 days, and exclude uncompleted current/future days. Changed settings, definitions or sources withhold incompatible comparisons. Legacy projections remain accessible without inventing original currency, history or forward accuracy. Scoring rejects duplicate/invalid observations, malformed ranges and calendar gaps; a shortened prediction array cannot count as a fully observed horizon. The relative difference uses the absolute forecast denominator so negative net-revenue comparisons keep their direction.

The owner view shows the actual forecast window and saved timezone, labels absent observations as unknown rather than claiming no days passed, and distinguishes estimated intervals from observed held-out coverage. Missing coverage no longer becomes an asserted 80% result. The selected first-payer label now matches its actual definition. No agent, provider, paid model call, scheduled review or external action was added.

Focused regression/permission command:

```text
pnpm exec vitest run tests/convex/forecast-evidence.test.ts tests/unit/forecast-forward-score.test.tsx tests/unit/forecasting.test.ts tests/convex/analytics-new-customers.test.ts tests/convex/safety.test.ts tests/convex/tenancy.test.ts
64 tests passed across 6 files
```

Coverage includes missing and explicit-zero days, insufficient recent history, immutable training values, a 200-day-old forecast, partial/completed outcomes, currency/timezone changes, overlapping sources, duplicate values, unknown legacy metadata, a 2,001-row read boundary, renewed/duplicate customer payments, negative counts versus negative revenue, invalid scoring inputs, absent held-out evidence, tenant isolation, viewer read/edit permissions and unchanged workflow/approval/action tables.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/forecast-evidence.spec.ts` — **2 passed in 13.3 seconds**, desktop Chromium and Pixel 7 emulation. The real owner form creates a fixture forecast; the detail shows its original basis. A synthetic historical forecast changes reactively from six observed days to all seven after a recorded zero, without creating a workflow, approval or external action. No page errors, horizontal overflow or serious/critical axe violations were observed; screenshots were inspected. This does not establish full accessibility conformance or production load performance.

App/Convex typecheck, targeted ESLint and diff checks passed. Only the isolated local fixture backend was synced. Remaining limits: incomplete imports and changing provider definitions may still limit comparability; workspace metadata cannot independently verify provider timezone/account coverage; no automatic source refresh or historical metadata backfill is attempted; old training snapshots cannot be recovered. Forward observations may be revised by later source corrections and are not causal attribution. Interval calibration relies on historical errors resembling future errors; this increment does not establish business-specific predictive accuracy or complete the broad forecast/recommendation requirements.

## 16 November: business-model advice freshness and retry consistency

Confirmed gap: a saved `at_risk` or `insufficient_evidence` judgment could constrain later plans indefinitely, despite changed business inputs. The owner view also described the old model as current. The inspected path is owner-started `businessModel.start` → `jobWrites.jobContext` → `jobs.businessModelCheck` → persisted workflow output → `businessModel.latest` and `BusinessModelCheckView` → later strategy context and demand-validation constraints.

The check now captures versioned hashes of eight bounded evidence groups in its existing run input before any model step: workspace, business (including discovery and industry selection), reviewed facts, brand, goal, billing, pipeline and saved competitor changes. It also stores a hash of the actual serializable agent input and engine version. No new raw customer/billing copy is stored. A retry keeps the first identity, permits unchanged checkpoint continuation, and stops before model work if the evidence or effective prompt changed. Legacy checkpoints and malformed snapshots cannot silently acquire a new identity. Existing progress and accounting remain available.

Current plan context uses a saved verdict as a constraint only while the checked groups match and the check is within its 30-day product review interval. Changed, old or untraceable reports remain readable; their grounded, adjacent and bold alternatives remain visible and named as historical hypotheses in future context. This does not override independent demand evidence or authorize execution. The owner sees changed groups and historical headings, with limitations available under “What was checked.” Rechecking stays owner-started and metered. Engine: `v3.85-business-model-freshness`.

Focused regression/permission command:

```text
pnpm exec vitest run tests/unit/business-model-check.test.ts tests/unit/business-model-view.test.tsx tests/unit/business-model-freshness.test.ts tests/unit/pipeline-outcomes.test.tsx tests/convex/business-model-check.test.ts tests/unit/repeat-purchases.test.ts tests/unit/customer-concentration.test.ts tests/unit/refund-exposure.test.ts tests/convex/design-learning.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/convex/engineLab.test.ts tests/convex/engine-v2.test.ts tests/unit/agent-runtime.test.ts
84 tests passed across 14 files
```

Coverage includes unchanged/changed/review-due/unknown snapshots, future capture rejection, edited historical refunds versus irrelevant import ordering, removal of stale verdicts from later-plan constraints, preserved creative alternatives, actual checkpoint resumes, full-prompt-only changes, malformed/legacy snapshots, tenant/viewer restrictions and no new action receipts or model usage when a changed retry is stopped. After owner-copy refinement, `pnpm exec vitest run tests/unit/business-model-check.test.ts tests/unit/business-model-view.test.tsx tests/unit/business-model-freshness.test.ts tests/convex/business-model-check.test.ts` passed all 29 tests across four files.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/business-model-context.spec.ts` — **four passed in 15.3 seconds**, desktop Chromium/mobile emulation. The actual owner button starts a fixture check, its evidence initially matches, and an imported synthetic owner-fact update changes the reactive report to historical without creating another workflow, approval or action. Legacy reports and 209-entry decision histories remain readable. Automated serious/critical axe checks and horizontal-overflow checks pass; screenshots are inspected. This is not full accessibility conformance.

App/Convex typecheck, targeted ESLint and `git diff --check` pass. Local sync regenerated the new helper's API type reference. No hosted deployment, external publishing, campaign action or paid model evaluation occurred. The displayed comparison covers eight groups and the existing capped workspace sample, not every possible contextual influence, changes outside the read bounds, or live websites. The full-input hash additionally protects resumptions; it is not a continuously recomputed semantic truth check. The 30-day interval is a product reminder, not evidence the judgment is wrong or an optimal industry-specific lifetime. Legacy reports lack reconstructable snapshots; the latest-check lookup remains bounded to ten runs. Broad recommendation quality and the full 410-requirement completion remain unproven.

## 16 November: business-model decision continuity and evidence limits

Audited requirement clusters 2/9 (viability and model alternatives), 28/30 (limited evidence and learning), 60 (slowdown versus structural decline), and 120 (sales outcomes informing strategy). Confirmed runtime path: imported billing and owner CRM records → `jobWrites.jobContext` → deterministic `ownerModelSignals` → business-model task; saved alternative-test reports → owner `businessModel.latest` and later strategy context. The previous UI read the first 200 test records in target/index order, while future-plan context collected all records then kept the latest 200 across targets. Frequent updates to one alternative could hide another alternative's latest decision or produce UI/context disagreement.

Both readers now share four bounded indexed lookups in `convex/lib/businessModelTests.ts`, one latest record per deciding/grounded/adjacent/bold test, with parent tenant validation and row tenant checks. Test reports stay append-only, and their notes remain untrusted input. Guidance no longer says an observed owner report automatically outranks the earlier verdict; it requires checking the audience, metric, observation period and evidence quality. Export includes the latest 1,000 business-model test records with an explicit truncation flag; workspace deletion purges them. These records were previously absent from both privacy paths.

Viability context now carries actual billing/pipeline read limits and the bounded competitor sample. Billing-derived trends are labeled calculated from imported records rather than independently measured business facts. A truncated read that cannot cover both 90-day windows withholds its revenue comparison; when the read demonstrably covers both windows, the calculation remains available with import-coverage and seasonality limits. Repeat-purchase observations retain their partial-history caveat. Unknown reporting currency withholds only monetary comparisons, retaining owner stage, pipeline and competitor evidence. Partial pipeline loss proportions do not become headwind/neutral judgments, and missing loss reasons are counted explicitly. Existing ±15% revenue and 40% loss flags are disclosed as review heuristics, not validated business thresholds. Future-dated payment observations are excluded from this check, and the shared pipeline summary now excludes future deal closes from observed wins/losses, reasons and notes. Grounded, adjacent and bold alternatives remain required; no precedent, evidence-confidence or feasibility gate was added to bold generation. Engine version: `v3.84-business-model-evidence-limits`.

Focused regression command: `pnpm exec vitest run tests/unit/business-model-check.test.ts tests/unit/business-model-view.test.tsx tests/unit/pipeline-outcomes.test.tsx tests/convex/business-model-check.test.ts tests/unit/repeat-purchases.test.ts tests/unit/customer-concentration.test.ts tests/unit/refund-exposure.test.ts tests/convex/design-learning.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts` — **59 passed across 10 files**. Cases include 209 saved reports across four targets, matching owner/context decisions, export/deletion and cross-tenant exclusion, 10,001 billing records and 2,001 deals through the actual context query, full-window versus incomplete-window comparisons, future timestamps, unknown currency with retained non-monetary evidence, missing reasons, and no new approvals/action receipts. The first run exposed two expected assertion updates for calculated provenance and expanded limits; those assertions were updated without weakening the numerical expectations. `pnpm exec vitest run tests/convex/engineLab.test.ts tests/convex/engine-v2.test.ts tests/unit/agent-runtime.test.ts` — **17 passed across 3 files** after the engine-version change.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/business-model-context.spec.ts` — **2 passed in 10.1 seconds**, desktop Chromium and Pixel 7 emulation. Isolated synthetic demo records exercise the actual query and owner form with 209 test entries; the latest adjacent decision and older still-current grounded/bold decisions are visible. Browser reads leave workflow, test, approval and action records unchanged. No page errors, horizontal overflow or serious/critical WCAG-tagged axe violations were observed; screenshots were inspected. This is not full accessibility conformance.

Typecheck, changed-file ESLint and diff checks passed. Local Convex sync regenerated only the API type references for the new helper module. No hosted deployment, provider call, campaign action or paid model evaluation occurred. Imports may still omit accounts/periods even when the bounded query covers its comparison window. Loss reasons and test outcomes remain owner reports; thresholds are not calibrated predictors of viability. The existing latest-check search considers ten recent runs. Real-model judgment quality, stale verdicts after material business changes and full requirement-level completion remain unproven.

## 16 November: recoverable experiment outcome history

Confirmed gap: same-definition corrections replaced the latest analysis and concurrent owner forms could overwrite each other. `recordExperimentOutcome` now requires the revision opened by the editor, rejects stale writes before any mutation, and atomically appends a typed history record while updating the existing current-analysis projection. First edits of legacy experiments preserve every still-available analysis as a labeled legacy snapshot; earlier overwritten corrections cannot be recovered. Changed definitions remain separate analyses. No model/provider, publishing, scheduling or approval action was added.

Owners can expand Outcome history from either the plan or Design Critic result view. The read-only query checks tenant membership and experiment ownership, paginates history, and omits internal member identifiers. Each entry exposes the saved inputs, report date, changed fields, analysis number and current-report marker. Missing inputs remain unrecorded. History is loaded only when opened. The edit revision is captured when the form opens, so reactive updates cannot silently authorize a stale draft. Workspace export includes up to 1,000 history records with an explicit truncation flag; workspace deletion purges the records. Future strategy/design learning continues to use the current analysis projection, not superseded corrections as additional evidence.

Focused regression command: `pnpm exec vitest run tests/unit/experiment-outcome.test.ts tests/unit/experiment-outcome-ui.test.tsx tests/convex/experiment-outcomes.test.ts tests/unit/blog-research-p1.test.ts tests/unit/design-learning.test.ts tests/convex/design-learning.test.ts tests/unit/design-learning-note.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts` — **62 tests passed across 9 files**. Added checks cover original/corrected/redefined values, changed-field provenance, stale-write rejection with no history changes, legacy preservation, twelve-record pagination, viewer read versus edit access, cross-tenant rejection, export/deletion, current-only learning and no new action/approval/workflow records.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/design-learning.spec.ts` — **4 passed in 33.2 seconds** on desktop Chromium and Pixel 7 emulation. Two open browser editors demonstrate that a stale Save is rejected and its form remains open. Reloaded history preserves the original met report, unclear correction and current not-run report; an older report expands to its original inputs. Existing reported-comparison checks also pass. No horizontal overflow, page errors or serious/critical WCAG-tagged axe violations were observed. Desktop/mobile screenshots were inspected. A rerun initially matched both the expected app toast and the development error overlay; the final test targets the exact owner-facing message. Final history labels use plain-language design/assignment names. This is not a complete accessibility audit.

`pnpm typecheck`, changed-file ESLint and `git diff --check` passed. Convex schema/functions were synchronized only to the existing isolated loopback fixture backend. No hosted deployment, live provider operation, paid evaluation or external action occurred. Older clients without `expectedRevision` must refresh before recording outcomes. History makes reports recoverable; it does not independently verify assignment, exposure, business performance or causality. The existing twelve-definition limit remains; correction history is paginated separately.

## 16 November: trustworthy reported experiment comparisons

Confirmed end-to-end path: `ExperimentOutcome` collects member-entered counts/design/source → `playResults.recordExperimentOutcome` validates and saves an analysis → workspace/design queries present it → `resultsBrief` / `outcomeLine` feed generic outcomes to subsequent strategy, while `assessDesignLearning` qualifies design-specific reports. Actual bounded page/outreach A/B execution lives in a separate workflow and is unchanged.

Confirmed defects: the form defaulted unknown allocation to 50% and holdout assignment to random; a reported randomized design could receive a green “Incremental” badge without explicit assignment; selecting a tool source looked independently verified; missing allocation bypassed the split check; a harmful comparison's lower conversion interval was clipped to zero; permissive date parsing accepted rolled-over dates; historical stored labels controlled not-run grouping. Those are now repaired. Assignment and allocation start unknown, fractional percentages are preserved, random-comparison classification requires an explicit random report, and UI/future-plan wording separates member statements and calculated comparisons from verified causal effects. Signed intervals retain losses. Invalid/legacy counts produce a readable evidence problem instead of throwing. Exact ISO dates are validated, including leap days and future starts. Not-run grouping follows `executed` rather than a historical inference label. The existing persisted `incremental` enum remains for compatibility, but is treated as a reported-design classification, not proof of incrementality.

Focused command: `pnpm exec vitest run tests/unit/experiment-outcome.test.ts tests/unit/experiment-outcome-ui.test.tsx tests/convex/experiment-outcomes.test.ts tests/unit/blog-research-p1.test.ts tests/unit/design-learning.test.ts tests/convex/design-learning.test.ts tests/unit/design-learning-note.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts` — **59 passed across 9 files**. Coverage includes unknown/contradictory assignment, known and missing split, split warnings/mismatch, signed loss intervals, invalid historical counts, strict dates, legacy label reassessment, source classification, met/missed/unclear/not-run outcomes, future-plan wording, downstream design learning, cross-tenant/viewer rejection and no new action/workflow records.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/design-learning.spec.ts` — **4 passed in 26.8 seconds**. Isolated synthetic fixtures exercised the original design-learning workflow plus unknown → reported random → supplied allocation, including a 50.5% input, on desktop Chromium and Pixel 7 emulation. The tests compare page/version/workflow/approval/action records before and after, check no horizontal overflow and serious/critical WCAG-tagged axe violations, and retain screenshots that were inspected. The first added browser attempt had an assertion race before save completion; the corrected test waits for the Update outcome button before inspecting persisted state. Final typecheck, changed-file ESLint and diff checks passed.

Limits: manually reported assignment, data source, exposure, maturity and test execution remain unverified. A mathematical rate difference alone does not establish a valid experiment or business causality. Original criteria remain saved, but same-definition corrections still replace the latest analysis; the separate full outcome-revision-history requirement is not closed by this increment. No paid model evaluation, external account operation or hosted deployment occurred.

## 16 November: brand consistency map and intentional exceptions

Confirmed gap: approved brand profiles, published landing snapshots and saved design documents existed, but owners could not compare their recurring values or record scoped exceptions. Settings → Brand kit now lazily opens a map that separates owner-confirmed rules, deterministic saved-document observations, possible differences, and owner/admin decisions. It compares hosted-page accent colors and CTA wording plus saved-design backgrounds, text fonts and text/shape colors. Published snapshots take precedence over newer unpublished edits; design assets explicitly remain drafts. Variation is not automatically a defect, and no uniform template or composite design score is imposed.

`brand.reviewPattern` binds each append-only decision to the exact source fingerprints and confirmed-rule snapshot, rejects concurrent stale reviews, requires reasons for corrections/exceptions, and records an audit event. Confirm, correct, dismiss, intentional exception and reopen states are supported. Changed source versions or rules require fresh review; historical observations remain inspectable. Strategy and conversion-audit job context consume only the latest decision per pattern, with a source-labeled policy that prohibits expanding exceptions, treating stale decisions as rules, suppressing bold directions or authorizing actions. Workspace export and deletion include the new records. No provider, new agent or model call was added.

Focused command: `pnpm exec vitest run tests/unit/brand-consistency.test.ts tests/convex/brand-consistency.test.ts tests/convex/brand.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts` — **24 passed across 5 files**. Coverage includes published-versus-draft values, unresolved and bounded design tokens, approved-versus-unconfirmed palette checks, distinct-source recurrence, tenant isolation, owner/admin-only confirmation, snapshot preservation, concurrent-review rejection, changed design/brand invalidation, actual strategy/audit job context, data export/deletion and no new approval/action records.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/brand-consistency.spec.ts` — **2 passed in 12.9 seconds**. Desktop Chromium and Pixel 7 emulation used the isolated loopback demo and synthetic data. Tests open exact source details, save an exception, confirm changed brand context through the existing form, verify the old snapshot and stale decision, reopen review, check audit records, and compare page/design/workflow/approval/action tables before and after. The initial scan found small source-link targets; increasing their height fixed it. Final serious/critical WCAG-tagged axe and horizontal-overflow checks passed; screenshots were inspected. Final `pnpm typecheck`, changed-file ESLint and `git diff --check` passed. This is not full accessibility conformance or production verification.

Limits: at most 30 newest hosted-page records and 30 most recently updated design records are sampled; unsupported/malformed/oversized design content is flagged partial. External-site styles, raster image pixels, rendered layout, interactions and semantic brand judgments are not inspected. UI shows the latest five decisions per pattern; export includes up to 100 with a truncation flag. Advice uses complete decision records within 8,000 characters and at most three source/value samples per decision, with explicit scope. Stored snapshots preserve observations, not a restorable design document; source links open the current editor. These decisions do not edit any page, asset or brand rule, and do not send, publish or spend. No hosted deployment or live-model quality evaluation occurred.

## 16 November: cross-page design opportunity queue

Confirmed gap: Design Critic already stored exact-run findings, owner review states and append-only decision events, but owners had to open each audit separately. `designCritic.opportunitiesPage` now reads the existing tenant/kind/date index with native pagination and returns sanitized saved findings plus their exact reviews. Failed, fixture-in-real-workspace, malformed and incomplete records stay explicit; they do not prevent loading older audits. No new table, provider or agent was added.

Your work → Design opportunities compares saved evidence, customer relevance, classification, confidence, suggested changes, effort, assumptions and risks. Grouping uses lens and region; repeats use the exact page URL (including path case, query and fragment), viewport, classification and automated check IDs or matching observation text. It keeps the latest observation visible and earlier records recoverable without increasing confidence. This is a conservative comparison aid, not semantic deduplication or proof of a shared root cause. Missing source/identity remains separate. Every item links to its original audit and finding anchor. Capture time is exposed only for a matching reviewed page and viewport; the audit-record date is the completion date when present, otherwise creation, not a fabricated capture date.

The queue reuses `DesignFindingReview` and the existing `setFeedback` permission/audit path. Browser testing exposed a pre-existing defect: the shared Button defaults to `type="button"`, but both finding-review forms depended on submit. Explicit `type="submit"` now makes initial and updated reviews work. Corrections apply to the exact original finding and remain visible in both locations; they never resolve other pages automatically.

Focused command: `pnpm exec vitest run tests/unit/design-opportunities.test.ts tests/convex/design-opportunities.test.ts tests/convex/design-critic.test.ts tests/convex/design-decisions-across-audits.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts` — **33 passed across 6 files**. Cases include older findings behind ten unavailable records, conservative repeat grouping, distinct page variants/viewports/checks, retained bold alternatives, unsafe/missing URLs, malformed output, exact-version corrections, capture-page mismatch, tenant isolation, viewer read/edit boundaries and no new external-action records.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/design-opportunities.spec.ts e2e/design-learning.spec.ts`. The dedicated loopback demo uses synthetic data and no connected providers. The queue test loads older audits, expands repeat observations and bold options, saves a correction, opens its exact audit anchor, updates the correction there and checks two review-history events. Workflow, approval, action-receipt and landing-page snapshots must remain unchanged. Final browser result: **4 passed in 29.4 seconds**. Desktop Chromium and Pixel 7 emulation passed no-horizontal-overflow and serious/critical WCAG-tagged axe checks; queue screenshots were inspected. Final `pnpm typecheck`, changed-file ESLint and `git diff --check` passed. These checks do not establish full accessibility conformance, semantic audit quality or production-scale performance.

Remaining limits: groups and counts cover loaded audit pages; complete history requires Load older design audits. This does not run a fresh crawl, verify external page state, infer unrecorded effort/dependencies or produce a hidden priority score. Brand consistency maps and intentional-exception tracking remain outstanding. No hosted deployment, model call, campaign send or external publication occurred.

## 16 November: design outcomes inform later audits and plans

Confirmed existing path: Design Critic stores finding/direction decisions, retains original evidence, creates versioned landing drafts with measurement plans, links an exact draft version to an experiment, and accepts structured result reports. Prior finding decisions already reached later audits. Confirmed gap: generic plan outcome lines lost the page-version/publication/measurement context, and later website audits received no design-outcome context.

The new `convex/lib/designLearning.ts` resolves the experiment, audit, page, saved revision, strategy and goal within one tenant. It excludes fixture audits and invalid source links. `shared/growth/designLearning.ts` assesses publication and measurement evidence, dates, baseline/count availability, changed definitions, deviations, stop rules and comparison suitability. Existing deterministic rate-comparison checks are reused only for matching pre-registered binary-rate tests with a planned split. Reports remain owner/member-entered, including claimed integration sources; no tracking, randomization or exposure verification is invented.

`landing.setLive` and the explicitly approved A/B-variant application path record the first publication approval observed by these code paths on the exact saved revision, after existing permission checks. Direct publishing also rejects a draft that differs from its saved revision. Saved revision content remains immutable. Later edits, republishing and newer publications do not erase that version's approval evidence. Historical last-published versions can establish publication, but their missing timestamps remain unknown. Design-linked experiments no longer take the less-specific generic channel-outcome path. Both strategy and conversion-audit context include bounded, source-labeled reports inside an untrusted-data wrapper, with trusted policy explicitly prohibiting automatic winners, universal style rules or execution permission.

The existing finding-result UI shows a plain-language evidence assessment and expandable version, publication, stated source, observation window and limitations. No new agent, provider, external integration or automatic publishing was added. Record selection reads the newest 100 workspace experiments, considers at most 20 design reports and fits complete records into a 10,000-character budget; it discloses truncation and never cuts off a record's evidence limits.

Verification command: `pnpm exec vitest run tests/unit/design-learning.test.ts tests/unit/design-learning-note.test.ts tests/convex/design-learning.test.ts tests/convex/design-critic.test.ts tests/convex/design-decisions-across-audits.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/landing.test.ts tests/convex/landing-draft-renders.test.ts tests/unit/conversion-audit-design-direction.test.ts tests/convex/safety.test.ts tests/convex/tenancy.test.ts`. Focused results: **58 tests passed across 11 files**. Tests exercise approved v2 followed by edited/published v4, same-version republishing, both runtime context paths, met/missed/unclear/not-run reports, missing inputs, invalid dates, rate-test checks, historical timestamp uncertainty, data-source labeling, text-budget integrity, tenant isolation and viewer/stale-version approval rejection. The final checks also cover approved A/B-variant revision metadata, rejection of draft/revision mismatch and malformed original direction links. Server-rendered component checks passed. Desktop Chromium and Pixel 7 browser emulation also passed against the isolated loopback demo; no paid model evaluation of this new learning flow was run.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env CLIMBOS_CALENDAR_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/design-learning.spec.ts e2e/calendar-pagination.spec.ts` — **4 passed in 33.9 seconds**. The new design flow checks saved v2 results beside current draft v4, reported-source wording, expanded evidence limits, owner updates to unclear and not-run, and persistence after reload. It compares complete page/revision, approval, receipt and workflow snapshots to prove those reads and outcome updates did not publish or execute work. Desktop/mobile screenshots were inspected; no page errors, horizontal overflow, or serious/critical WCAG-tagged axe findings occurred. This is not full accessibility conformance. The first combined run exposed concurrent fixture-import contention; opt-in local fixture suites now use one worker and share the same loopback-only import helper. The calendar regression passed again after that helper extraction. Synthetic records exist only in newly opened demo workspaces; the test exercises the non-fixture audit linkage using imported synthetic metadata, not a real model audit or real publication. The local Convex sync regenerated `convex/_generated/api.d.ts` for the new helper module. Final `pnpm typecheck`, ESLint on all changed source/test/config files, and `git diff --check` passed.

Remaining limits: member reports are not independent measurements; this does not establish causal impact, validate the original audit's semantic correctness, track per-version traffic automatically, or edit a customer's external site. General experiment corrections retain their existing behavior. Brand consistency maps, intentional exceptions and a dedicated cross-page design queue remain separate work. No hosted deployment, campaign send or external page publication occurred.

## 16 November: calendar browser verification and accessible link names

Exercised the real `usePaginatedQuery` hooks against an isolated, credential-free Convex backend at 127.0.0.1:3320 and Next app at 127.0.0.1:3420. The new opt-in `e2e/calendar-pagination.spec.ts` refuses nonlocal frontend/backend targets and imports only into a verified demo workspace. Each browser receives 351 synthetic review posts with matching Autopilot slots. It loads all pages, verifies one link per post, moves away and back to confirm pagination resets, switches weekly/monthly/daily views, checks the workspace timezone, opens a post for review, and compares approval/receipt/workflow IDs before and after. Fixture imports grant no publishing permission and invoke no provider.

The first full browser pass exposed a real accessible-name mismatch: custom calendar link labels used raw status names and a different text order from the visible link. Links now derive their names from the visible time, channel, title and human-readable status. The Autopilot marker is spelled out and its row can wrap. The shared serious/critical WCAG-tagged axe scan passed after the repair; it does not establish full WCAG conformance.

Browser command: `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_CALENDAR_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/calendar-pagination.spec.ts` — desktop Chromium and Pixel 7 emulation passed. No horizontal page overflow or browser page errors were observed. Desktop/mobile screenshots were inspected in the local Playwright output. The final browser rerun passed both projects in 11.9 seconds. The two component regression files also passed (5 tests); `pnpm typecheck`, changed-file ESLint and `git diff --check` passed.

Scope: this closes the prior browser-interaction verification gap for these calendar paths. It is not a production load test, Safari/Firefox or assistive-technology verification, a hosted deployment, or proof that every application workflow is complete. The isolated local sync updated the development `.env.local` public Convex URLs to fixture ports 3320/3321; hosted settings and credentials were not changed. No model, mail, social or advertising provider was called.

## 16 November: reach every calendar item in the selected range

Confirmed gaps: each calendar source stopped at 300 rows, and the review query selected the newest 300 workspace drafts before applying the date range. Added read-only `content.calendarPage` with one native pagination cursor per source and the existing tenant view permission. Existing indexes bound scheduled time, slot time, and review creation time before paging; invalid/reversed/nonfinite ranges are refused. Slot mapping rejects foreign artifact links and follows actual rescheduled times. Shared identity merging shows a linked post once, with Autopilot details independent of source arrival order. The older snapshot endpoint retains its cap for compatibility but shares the corrected range and mapping.

The daily/weekly/monthly calendar now requests 100 rows per source initially and lets owners load further pages. Counts and empty days remain qualified while any source is incomplete; empty filtered pages retain the continuation control. Workspace/timezone/range changes remount the grid. Calendar reads do not approve, schedule, publish, create workflow runs or change content.

Verified: `pnpm exec vitest run tests/convex/calendar-pagination.test.ts tests/convex/calendar-awaiting-review.test.ts tests/unit/content-calendar.test.ts tests/unit/content-calendar-pages.test.ts tests/convex/autopilot.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/convex/publish-flow.test.ts` — **57 tests passed across 8 files**. Coverage includes 351 linked posts/slots, 351 older review drafts behind 351 newer out-of-range drafts, empty skipped-slot pages, moved posts, half-open date boundaries, tenant denials, foreign linked artifacts, no action records, timezone-bound UI query arguments, partial/exhausted counts and deduplication. `pnpm typecheck`, changed-file ESLint and `git diff --check` passed. After the final partial-day wording change, the two calendar UI files passed again (5 tests).

Limits: component checks use server rendering and mocked query hooks; no browser interaction, live Convex deployment, connected provider operation or large-scale performance benchmark was run. Loading all entries requires the owner to request further pages. The legacy snapshot endpoint remains capped, and the 62-day maximum query window remains. No dependency or schema change was required.

## 16 November: complete saved trend provenance

Confirmed gaps: declared per-post trend metadata bypassed evidence checks when copy avoided the words trend/meme/viral, and the research retrieval timestamp was dropped before saving the draft. Generation lint now checks any declared trend URL or evidence independently of those words. `runAgentTask` passes its existing engine-recorded research timestamp to `socialToArtifacts`; only that trusted timestamp is stored in the version-bound copy brief. Model-supplied timestamps are discarded and unknown retrieval time stays unknown. Optional schema support preserves legacy records. Supporting sources retain the exact evidence URL as well as its normalized-equivalent declared reference.

The owner note displays the source observation date, actual research retrieval time in UTC, and an HTTP(S) source link. Missing historical timestamps remain explicitly unrecorded. Copy edits retain the evidence in the version/content-hash path. Approval/execution freshness checks reject impossible retrieval chronology when a timestamp exists. The generic evergreen fixture no longer invents an optional trend URL without research.

Verified: `pnpm exec vitest run tests/unit/social-intelligence.test.ts tests/unit/trend-freshness.test.ts tests/unit/trend-evidence-note.test.ts tests/convex/engine-v2.test.ts tests/convex/publish-flow.test.ts tests/convex/social-publish.test.ts tests/convex/autopilot.test.ts tests/convex/safety.test.ts` — **74 tests passed across 8 files**. App/shared and Convex type checks, changed-file ESLint and diff checks passed. UI verification used server-rendered component assertions, not browser inspection. No paid model call, live provider operation or deployment occurred.

Limits: retrieval time describes the bounded research run; it is not the source publication date or proof of source accuracy. Unknown historical retrieval times are not reconstructed. Declared metadata and explicit trend wording are checked; the system cannot reliably infer every undeclared cultural reference or prove commercial value.

## 16 November: trend freshness at approval and execution

Confirmed gap: social generation compared dated observations with research retrieval time, but saved drafts could be approved and posted after the existing 30-day product window. The shared `trendFreshnessIssue` now checks exact valid UTC observation dates, source membership, future observations, and age at the later of now or the intended posting day. Central approval and schedule-extension code enforce it; email approval returns a useful refusal, Autopilot routes the item to owner review, and the executor sends expired drafts back to review before provider access. Existing receipt reconciliation remains ahead of this check to avoid duplicating previously attempted posts. Existing errors and audit/notification paths explain the refusal.

Verification: `pnpm exec vitest run tests/unit/trend-freshness.test.ts tests/convex/social-publish.test.ts tests/convex/approval-claims.test.ts tests/unit/social-intelligence.test.ts tests/unit/creative-precedents.test.ts tests/convex/autopilot.test.ts tests/convex/safety.test.ts tests/convex/publish-flow.test.ts` — **138 passed in 8 files**. `pnpm typecheck` passed. Changed-file ESLint and diff checks passed. These are local tests with fixture/mocked providers; no live post, deployment, or paid model call was performed.

Limitations: the 30-day policy is not proof of a trend's actual relevance or lifetime. The check uses saved structured trend evidence; legacy or evergreen drafts without that metadata are unchanged. Source membership is not semantic verification. Refreshing research still requires a new reviewed draft; the system never invents a more recent observation.

Count correction: runtime `CREATIVE_PRECEDENTS` includes 75 base records plus 25 imported records from `creativePrecedentExpansion.ts`. The existing regression verifies 100 unique source-backed records. The prior 75-only status report missed that import; 25 additional records are not required to reach the numerical target. The expansion records remain low-confidence action precedents without demonstrated commercial outcomes.

## 11 November: Macloving plan passed after source-backed repairs

The actual saved plan in `macloving-3a1n4` is **passed, 4.0/5**, with required gates passed, no hard failures or automatic errors, ten supplied research sources, and a completed independent second review. Strategy `js7v3wqp75pw24wb9g459n5jds8j147j` remains `needs_approval`; its quality status is not publication approval or proof of demand. Thresholds and rubric gates were not lowered. This supersedes the earlier 3.71/5 snapshot below.

Five real plan revisions cost **$1.882196**, including two failed optional revisions caused by field-size limits. Receipts: `n97wpsx3261q9td45hw1w7ja3d8j06ey` $0.324661; `n97gk7y4gm9ne41fj7t04qnm018j178x` $0.331224; `n97w7wckx3hs49kw4ajf196m9h8j0akc` $0.414505; `n97ndtpywygdst8zpew6mc84898j0fzp` $0.393766; `n97pnkk5tx4bscvkqbcc5a82498j0acm` $0.418040. Failed attempts and source corrections remain in history. An earlier 4.0 draft still contained an outdated Preview comparison, so it was not treated as final: current Apple documentation corrected batch resizing and menu instructions, and the model rewrote and re-reviewed the plan. The latest guide keeps built-in Preview as a valid alternative, describes Diet Image from its published page, and does not claim native-app testing.

The revised plan contains a complete how-to page with proposed title/description, a complete LinkedIn post pointing to the inspected existing app page, and a proposed demo shot list explicitly marked unrecorded. Its three ordered steps have two tasks each. Preparation and first-review timing follow the work; month/quarter/year progression is conditional, not a fixed-duration plan menu or forecast. Private business economics, demand and owner capacity remain unknown.

Repairs capture tenant/goal/website-bound prepared work at enqueue, preserve owner edits and prior-version preparation, and retain next-horizon and compounding reasoning. Page draft capacity is 6000 characters, non-page drafts retain a 2400-character limit, and the collapsed next-horizon field is bounded at 1000 characters. Plan evidence also reaches Make it happen without turning source summaries into verbatim page reads. Missing keyword-tool data is a limitation, not owner research homework.

Regression suite: **2,227 tests passed in 351 files**, 83.61 seconds. Final keyword-homework and step-work regressions: **14 passed in two files**, including the newly added case. App/shared and Convex types, full ESLint plus final changed-file lint, and the dedicated local Webpack production build passed. Browser testing exercised provisional repair, price quote, live review/revision, passing output, current-run progress, and Make it happen on the passing version. All backend updates targeted loopback only. The owner-authorized local allowance extension preserves all usage and uncertain holds; cumulative committed/allocated funds are $52.321238 of $100. Nothing was published, sent, deployed or marked complete.

Final Make it happen checks on the passing version produced a source-backed guide with a chosen title and description, plus a search-wording decision and native-app test log. No owner question was asked. Owner tasks were reduced to testing actual app behavior on copies and checking the local macOS requirement; keyword-tool research is no longer delegated. The local reader could not load Apple's page during preparation, so it retained that limitation and did not claim a new successful first-party fetch. The guide preserves the corrected batch workflow and does not claim a live guide URL. Three preparation receipts were $0.112483 (`n97gde83xv30pwm152bfav35dx8j1m9z`), $0.124772 (`n97tkwdqg9y0dt4ytsz4hhk9t58j1rdq`) and $0.203173 (`n97ys6naj90r3m8es3e47qpscd8j1kk9`). Total this round: **$2.322624** across eight jobs, including failures and retries. Final wallet: **$8.182278 spent, $0.004900 held, $12 ceiling**, all inside the $20 local allocation. Exact saved quality, private drafts, limitations and receipts are in `real-business-plans/2026-11-11/macloving-quality-check.json`.

## 11 November: Macloving chat → plan → Make it happen

**2,222 tests passed in 349 files** (91.37 seconds), with app/shared and Convex type checks, ESLint and the dedicated-local Webpack production build passing. All backend changes were synced only to 127.0.0.1:3330. The app remains at 127.0.0.1:3430. The fresh real Macloving test workspace is `macloving-3a1n4`; the owner's earlier Macloving conversation and plan were preserved. No demo business or invented private business figures were introduced.

The initial real chat exposed two defects: repeated filler and website knowledge that was read but not stored as offer/businessModel fields. Source-matched memory repair now runs automatically; core public knowledge permits planning without a mandatory stage/time interview. Missing private resources remain unknown. The repaired live reply was 15 words and asked no further question. The three paid chat turns in this test cost $0.005252 total; older messages remain visible as historical output rather than being rewritten.

The first real plan failed its truth gate on free-app/collection claims and invented first-person wording. The correction route's former 40k-token estimate prevented a full revision fitting its quote despite cheaper actual requests. A supplied-context token floor plus actual prompt estimates now lets a bounded correction and independent review run inside the unchanged cap. Live repair performed both rounds. Its required gates passed; the plan remains **provisional, 3.71/5**, below the broader expert-quality bar, not market-validated or automatically approved. No rating or original plan text was manually changed to make it pass.

The first preparation still delegated public app-page and community checks and included GUIDE-ADDRESS. Fixes make the reader follow the relevant observed product URL and check the named community's rules itself, and reject unfinished destinations. The final live preparation read `https://macloving.app/apps/dietimage` and produced substantive SEO guide copy plus an independent owned-channel post using that real destination. App details were checked against the first-party page; this is evidence of published product claims, not a native-app execution test. No owner question was needed during either preparation job. Reddit blocked the rules read through robots; that placement remains held, while independent prepared work stays usable. The actual guide has not been published, and no traffic or sales result is claimed.

Browser checks exercised wish submission, URL research, saved business memory, planning, the quoted cheaper repair, automatic correction/review, opening the plan, Make it happen, source-linked deliverables, separate internal notes, saving a small grammar edit, exact copied-text comparison and edit persistence after reload. A task mark survived reload and was undone; all task marks were left undone. Publishing was never marked complete. Home and its prepared-work link were checked against the actual saved result. Viewing, editing, copying and navigation started no extra model job. The model-generated source record remains immutable; the small copy edit is stored separately.

Recorded Macloving API usage was **$0.762544**: chat $0.005252, first plan $0.166054, bounded plan correction $0.326906, first preparation $0.083319, improved preparation $0.181013. Run receipts: `n97h2arx5kzdbpektjzmnbw2r58j0fcv`, `n97w461vzrpww4eh6wy41vjznd8j01cn`, `n97zt71z46c63x7cy61qsj2f5d8j1vjh`, `n97g88vh3t5mfbc9ayh07ny4m58j0r3r`, `n97p2zmspty9mwdwjkwa6gsha18j03nm`, `n97hry569aymkt0jwra3q1sxks8j11ek`, `n97g8ebbt82a8yp98bszfbd5sx8j0702`. Final wallet snapshot: $5.859654 spent plus $0.004900 previously held against the unchanged $6 local cap, inside the already reserved allocation under the $100 project authorization. No refill, new subscription, remote deployment, external publishing or prospect message occurred.

## 11 November: AI step preparation and simpler workspace

Latest local regression suite: **2,214 tests passed in 349 files**, 109.36 seconds. App/shared and Convex type checks, ESLint and a dedicated-loopback Webpack production build passed. The first concurrent build/typecheck attempt hit generated `.next/types` churn; the subsequent sequential typecheck passed. These results supersede the older counts below. Final small presentation/hash-navigation changes were also checked with types/lint and the local browser.

The retained sage/lime palette now frames a quieter app shell, focused Home tabs, a compact conversation composer, and an ordered plan rail with one active work panel. Routine replies target 15–30 words and are capped at 45; long deliverables remain possible. The server ends intake when core context is adequate, including older conversations that were stuck on optional model questions.

Real Livoform preparation used the configured Haiku/Sonnet route, public web searches and bounded source/contact-page reads. Four measured jobs cost **$0.443382 total** ($0.051192, $0.123248, $0.139573, $0.129369). The first output asked an unnecessary future permission question; a later output delegated public research; the third failed source checks and hid useful work. Prompt/validation changes reject those delegations, automatically follow observed contact links, retain private validation diagnostics, preserve earlier work through retries, and keep independently usable parts of a partially failed result with visible limitations.

The final live job saved three private drafts: a named candidate/permission research log, a held outreach draft and a LinkedIn post. Contact permission remains unknown for the candidates; a source quote or saved pitch is not consent, proven fit or proven effectiveness. The final repaired output still tried to delegate one public check, so that owner task was held back and the partial-result notice was displayed. This is operational evidence of research/preparation, not a claim that the wider distribution strategy passed expert quality review or that marketing execution is complete. No outreach, publishing or customer-growth measurement occurred.

Browser verification exercised the real result, a saved copy edit and reload persistence, history traversal through a failed attempt to an earlier successful result, the Home prepared-work link, focused plan/Home tabs, and the Review work shortcut. A same-page Next Link hash bug was fixed and re-exercised: Review work selects Needs you, leaving that tab clears the hash, and the shortcut selects it again. At a 390px viewport, document width stayed 390px; the temporary override was reset. Task progress remained zero after preparation and draft editing. Source limitations are collapsed behind a compact warning, not hidden.

The loopback-only wallet was **$5.097110 spent plus $0.004900 held against its unchanged $6 cap** after these jobs. Later owner activity may change that snapshot. It is within the pre-reserved local allocation under the cumulative $100 authorization; no wallet refill, remote deployment or demo seeding occurred. Synthetic regression tests remain isolated from real businesses and do not make model API calls.

## 11 November: local plan timeline

The earlier timeline wireframe is now implemented on the local plan page. The default Next steps tab shows the saved phases in order, one expanded current step, task counts and progress. Prepared work, Why this plan and Research are separate focused tabs. Existing plans retain their saved timing; no fixed-duration picker or invented tasks was added. New plan generation supports a variable number of tasks in each phase.

Full suite: **2,200 tests passed in 346 files**. App/Convex type checks, lint, local Webpack production build and patch whitespace checks passed. The final legacy-checklist adjustment also passed its seven focused progress/unit regressions. Only loopback Convex was updated; no hosted deployment was performed.

Live Livoform browser checks exercised task completion, reload persistence, undo, opening a real saved private draft and returning to unchanged progress. The temporary completion mark was undone. The AI-help button opened an editable, unsent step-specific message; its test draft and selection were cleared. A read-only database check confirmed the browser's saved progress. The local evaluation wallet remained at the same 6,000,000-microdollar ceiling and 4,450,901-microdollar recorded spend as the preceding discovery-chat check. No paid AI call or external marketing action was triggered by this layout work.

Progress is team-reported completion of the exact saved task, not evidence of publishing, plan approval or a business outcome. Tests cover tenant isolation, viewer write rejection, changed task text, conflicting revisions, repeat submissions, undo, export and separate progress for revised plans. The public-page research and strategy-quality limitations in the dated records below are unchanged.

## 10 November: conversational onboarding

Conversational onboarding uses a genuine budgeted AI interview, durable source-labeled business memory and an immutable handoff to planning. **2,196 tests passed in 345 files**; app/Convex types, lint and the local production build passed. Changes were applied only to loopback Convex. Earlier [implementation, measured costs and quality limits](Local-Gaps-Completion-2026-11-10.md) and dated records below remain historical evidence.

Live browser verification used the existing owner-created `macloving-2n255` business without creating demo businesses. The AI asked for the website, read the real homepage, pricing and productivity pages, accepted an audience correction and moved to missing marketing/time context. Read-only local database checks confirmed persisted website, goal, offer, audience and business model with owner/public-source distinctions. A reload retained the conversation. The test did not invent private customer counts, stage or resources, and did not start a new paid plan before those answers. The “Finish later” action and six-stage UI are absent from the new entry.

Focused regressions cover website retention when AI extraction omits it, preservation of valid memory through an AI repair, inaccessible/unsafe or competitor sites, no paid scraper, premature-plan refusal, tenant/member boundaries, duplicate requests, captured plan context, owner time/ad limits, explicit failed-plan retries, and data export/deletion. Automated cases use isolated test databases and mocked inference; they are not additional live provider evidence. The AI evaluation wallet ceiling was not raised or reset.

The ordered plan timeline is an interactive **wireframe proposal**, exercised for step expansion, task completion/progress and prepared-work preview. It has not replaced the current production plan page. Preparing a draft and completing a task are separate states; timing follows the actual goal rather than fixed 14/30/90-day buckets.

# Verification

Latest local verification: **10 Nov 2026** on macOS, Node 24.22.2, pnpm 10.34.5, Next 16.4.2 and Convex 1.47.0. Code and data remain local. The separate real-business profile uses Convex at 127.0.0.1:3330 and the app at 127.0.0.1:3430. Its three workspaces contain public-source research and actual model outputs, with no demo seeding. Synthetic automated tests use their own ephemeral databases. No hosted deployment, external publishing, prospect messaging or advertising was exercised.

The owner selected Anthropic Haiku/Sonnet and authorized a cumulative $100 AI evaluation. These later instructions supersede the earlier $2 OpenAI-only authorization. Remote inference is explicitly authorized; the app and database stay local. Historical receipts and uncertain holds remain intact. See [costs, quality and limitations](Cost-and-Quality-2026-11-10.md).

## Current results

| Check | Result |
|---|---|
| Full unit and Convex integration suite | **2,137 passed in 331 files**, 74.33 seconds |
| TypeScript, app/shared and Convex | Clean |
| ESLint | Clean |
| Production build with dedicated local configuration | Passed; no hosted build or deployment |
| Real-workspace browser checks | **19 passed**: all three businesses’ Home/Plan/AI activity/Results; focused quoting; direct existing-draft review; desktop/mobile overflow; exercised accessibility; no AI or external write triggered |
| Earlier isolated fixture browser suite | **44 passed** before the final real-business follow-up; not a fresh app-wide result for this final revision |
| Local backend paid workflow | Real research plus detailed Macloving workflow tested; new focused jobs completed for all three businesses; checkpoints, actual models and costs retained |
| Final real recommendations | Corrected public-source focused drafts imported idempotently from already-paid outputs; no duplicated generation charge |
| Patch whitespace | Clean |

Focused regressions cover quote/reservation/worker agreement, 14/30/90-day milestones, actual horizon and creativity context, tenant/website research reuse, critical review failures, source refusals through fetch/cache/checkpoints, refusal enforcement despite AI critic approval, approval/staleness/tenant guards, zero-generation reuse of prepared drafts, source-correction idempotence, and preservation of original draft text and paid receipts. Local imports create no subscription or fabricated business performance.

Real browser testing exposed and repaired notification-badge contrast and a mismatch between the visible capped count and accessible name. Direct draft review opens an existing draft before plan approval; optional AI settings select the focused contract by default. The quote is inspected and canceled without starting a job. The standalone comparison report also passed business selection, prepared-draft and historical source-correction checks with all network requests blocked. Final desktop and mobile screenshots are retained in the ignored evaluation cache.

## Quality boundary

The focused 14-day workflow cost about $0.39–$0.41 per business in the public-source harness, versus $1.43–$1.60 for the earlier recommendation-plus-plan workflow. This compares different workflow scopes and improved evidence, not isolated model equivalence. A blinded common-dimension AI comparison preferred the corrected focused Macloving and Folevi recommendations, while preferring Livoform’s earlier SEO/distribution detail. The current simple Livoform draft remains provisional. No review has established commercial outcomes or expert quality across all requested industries.

MacMost’s first-party contact policy invalidated earlier suggested product outreach. Newly retrieved explicit refusals are retained in source metadata and deterministic checks block matching pitches. Unknown policies remain unknown. This detector handles explicit patterns, not all natural-language contact rules. Human source entailment, representative-owner usability, broad industry acceptance and live provider execution remain unverified. Full research’s worst-case quote also exceeds the unchanged 50-credit free allowance; commercial free-onboarding affordability needs a measured product/pricing review.

Current plans, earlier alternatives, native seven-channel social drafts, SEO page drafts, AI judgments and costs are inspectable in the [local real-business report](real-business-plans/2026-11-09/index.html). Social/SEO alternatives did not pass publication readiness and remain drafts. The [spec inventory](growth-engine/spec-coverage.md) retains unsupported provider capabilities and unverified requirements rather than relabeling them complete.

## Historical focused verification — 25 Oct 2026

- Competitor watcher and research presentation regressions: `pnpm exec vitest run tests/convex/competitors.test.ts tests/unit/swot-presentation.test.ts tests/unit/research-quality.test.ts` — **34 passed**. Covers exact changed-line binding for suggested tests, dropping unsupported suggestions, retained evidence, sourced comparison details, retained not-relevant feedback, no watch/credit side effect on dismissal, manual re-add, and tenant isolation. The competitor file alone has **13 passed**.
- Offer and campaign timing regressions: `pnpm exec vitest run tests/unit/offer-assessment.test.ts tests/unit/campaign-timing.test.ts tests/unit/decision-contract.test.ts tests/convex/plan-history.test.ts tests/convex/publish-flow.test.ts` — **72 passed**.
- Type checks: `pnpm typecheck` — clean for app/shared and Convex.
- Focused lint: `pnpm exec eslint convex/competitors.ts convex/schema.ts src/app/app/'[organization]'/competitors/page.tsx tests/convex/competitors.test.ts` — clean.
- `git diff --check` — clean.
- No browser verification of the competitor page was run for these latest changes.

## Historical automated checks — 18 Oct 2026

| Check | Command | Result |
|---|---|---|
| TypeScript, web + shared | `npx tsc --noEmit -p tsconfig.json` | Clean |
| TypeScript, Convex | `npx tsc --noEmit -p convex/tsconfig.json` (also `convex deploy --typecheck enable`) | Clean |
| Lint | `pnpm lint` | 0 errors |
| Unit + Convex integration tests | `pnpm test` | **389 passed** (31 files) |
| Production build | `pnpm build` | Passes; 32 routes |
| End-to-end + accessibility | `pnpm test:e2e` against the dev deployment | **18 passed** (public site, demo flow, outbound + booking; axe WCAG 2.2 AA) |
| Engine benchmark | `pnpm bench` | See `docs/EngineV2.md` → Benchmark results |
| Prod smoke | curl + capture worker | Pages 200, MCP 401 without token, screenshot worker 200 in ~20 s |
| Economics gate | `pnpm econ:export` | PASS: every plan ≥ 30% at heavy use and under combined stress |

## What the tests prove (mapped to the acceptance list)

1. **Tenant isolation** (`tests/convex/tenancy.test.ts`). A second tenant can't query, mutate, export or pause the first tenant's workspace, drafts, facts, connections, analytics or billing (the response is `NOT_FOUND`). Ids from another tenant are refused even with the caller's own slug. Secrets are encrypted at rest and never returned by public queries. A ciphertext copied to another tenant fails to decrypt (AAD binding). Role limits and the operator allowlist are enforced server-side.
2. **Cost ceilings** (`tests/unit/billing-policy.test.ts`, `tests/convex/safety.test.ts`):
   - 50 serialized reservations never break the ledger invariants.
   - 10 truly concurrent content jobs stop exactly at the meter cap (3 × 2 posts = 6).
   - Failed jobs keep the real provider cost, release their meters and reconcile exactly once.
   - Retries consume budget, and the seventh model step in a run is refused.
   - A fallback without capacity fails closed.
   - Top-ups cover only the full stressed cost.
3. **Pricing** (`tests/unit/economics.test.ts`):
   - All 12 workbook rows reproduce to the micro-dollar: every cost line, fees, totals, margins, stress rows, minimum prices and caps.
   - Heavy stress margins are 36.6% / 40.2% / 36.6% / 37.2%.
   - Changes to price, support minutes, image attempts, customer count or a vendor rate propagate correctly.
   - Invalid denominators and inputs throw clear errors.
   - The $19 Basic plan passes the gate under price-weighted fixed allocation. A separate test documents that it would fail under strict per-head allocation at 10 customers.
   - The Gemini 2027 reprice still passes. The $29 top-up keeps about 54% stressed margin.
4. **Polar webhooks** (`tests/convex/billing.test.ts`; `tests/unit/billing-policy.test.ts` also checks signatures against the official `@polar-sh/sdk` `validateEvent`):
   - Duplicate, replayed and out-of-order events grant exactly once.
   - Forged signatures, tampered bodies and replays outside tolerance are rejected (HTTP 403 at the endpoint).
   - Cancel at period end keeps access until the end; revocation stops new work immediately and never re-opens the free allowance.
   - An unpaid renewal is read-only until a paid renewal grants the new period, once.
   - Upgrades raise caps once. Top-up grants are idempotent, and a refund revokes unused capacity.
   - Purchases can't bind to a workspace that never started an authenticated checkout.
5. **Approvals and execution** (`tests/unit/billing-policy.test.ts`, `tests/convex/safety.test.ts`):
   - Edits invalidate approvals.
   - Expiry, a different account, scope or policy changes, emergency stop and an unavailable capability all block execution.
   - Publishing the same version twice is a no-op (idempotency key and intent receipt).
   - Unconnected channels never fake a publish; they fall back to export packs.
   - The ad envelope is enforced.
6. **Consent and honest states** (`tests/convex/marketing.test.ts`; `tests/unit/integrations.*`):
   - Consent is never inferred ("yes" without a source and date is imported as planning-only).
   - Suppressed or deleted contacts are excluded, and a segment with nobody opted in is refused.
   - Without the customer's own provider, the send fails honestly and its quota reservation is released.
   - Personal Instagram accounts show "unsupported account type". Pending provider review, missing setup and stale syncs show their honest capability states.
7. **Forecasting** (`tests/unit/forecasting.test.ts`, `tests/unit/attribution.test.ts`):
   - Seeded runs are reproducible, the leakage guard throws on misuse, and sparse data returns `insufficient_evidence` with no interval.
   - Calibrated intervals reach the expected held-out coverage, and widths never shrink as the horizon grows.
   - The funnel examples reproduce exactly.
   - Attribution reconciles to the cent with an unattributed bucket, refunds and separate currencies. Platform claims can't be summed.
   - Cohorts (`tests/unit/cohorts.test.ts`) group customers by first paid month, ignore refunds and other currencies, and never report an unfinished month as churn.
8. **Formkit demo end-to-end** (`e2e/demo-flow.spec.ts`; Convex demo test):
   - **Today:** goal, next actions, chat → costed action card → job → drafts.
   - **Content:** approve an Instagram draft → publish → "Demo: simulated acceptance" receipt.
   - **Plan:** approved plan with channels, experiments and SWOT.
   - **Results:** unattributed revenue, monthly customer cohorts (complete months only), platform-reported claims, forecast detail with backtests.
   - **Connections:** per-capability states and the no-contact-database statement.
   - **Settings:** Billing usage meters and Policies.
   - **Pause all** then resume. Mobile layout at Pixel 7 size. Keyboard skip link.
9. **Accessibility and layout.** axe-core WCAG 2.0/2.1/2.2 A/AA scans with zero serious or critical violations on landing, pricing, sign-in, Today, content list and detail, Plan, Results, forecast detail, Connections, Billing and Policies. No horizontal scroll at 375px on public pages and the five app sections. One `h1` and one `main#main` per page. Skip link works.

## Historical manual and visual inspection

- Checked in the browser on the dev deployment and on **production (climbos.app)**: landing hero with live preview, `/demo` → Today (desktop 1366×900 and mobile 375×812), the chat-to-card-to-job loop, Plan, Content list, and content detail with the simulated-publish copy.
- **Bugs found and fixed during inspection:**
  - The page jumped to the chat on load.
  - Action cards appeared twice.
  - The parser mistook an email domain for a website and missed "I run …" names.
  - The Vercel project had no framework set, so every route returned 404 until it was set to Next.js.
- **Found with live AI (17 Oct 2026) and fixed:**
  - Claude answers for business insights and the growth plan were cut off at their output limits (3,000 and 4,000 tokens). A repair at the same limit can't fix a cut-off answer.
  - Repair steps were never closed, so they stayed "running".
  - "[n]" fact markers appeared in text owners read.
  - After the fixes, a fresh onboarding finished first time: research $0.07, plan $0.04.

## Historical adapter verification status

| Adapter | Status |
|---|---|
| Demo fixtures (AI, Instagram, Google Ads, GA4, Search Console, Stripe) | **Fixture-verified** (deterministic, labelled demo) |
| Claude (`claude-sonnet-5-5`, `claude-haiku-5-5`) | **Live-verified 17 Oct 2026** on dev and production. Real onboarding for two public businesses: research, insights and a growth plan. Real answers exposed output limits that were too tight; budgets were raised and the repair path fixed (see below). |
| Gemini (`gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-3.1-flash-lite-image`) | **Live-verified** for text: fact extraction in onboarding and the landing-page preview on climbos.app. All model ids confirmed in the key's model list. Image generation is not yet exercised live. |
| Resend (sign-in codes, platform mail, webhooks) | `climbos.app` is **verified** (DKIM, SPF, return-path). Dev and prod webhooks are created, and both accepted correctly signed test events (HTTP 200) and rejected unsigned ones (403). **Email sign-in still needs `AUTH_RESEND_KEY`.** Until then the sign-in page says email codes aren't on yet. |
| Polar (checkout, portal, webhooks, reconciliation) | Webhook processing tested end-to-end in Convex tests; signatures verified against the official SDK. `pnpm polar:setup` creates the products and the webhook. **Sandbox not yet verified**: no token |
| Google sign-in | The OAuth proxy on climbos.app reaches the Convex auth routes (dev and prod), and `CUSTOM_AUTH_SITE_URL` is set. **Awaiting a Google Cloud OAuth client**; the button appears automatically once it's configured |
| Firecrawl / built-in website reader | The built-in fetcher's SSRF and robots logic is unit-tested. The live fetch runs in production once AI keys exist |
| GA4, Search Console, Google Ads, Meta Ads, Facebook Pages, Instagram, Stripe, customer Resend | Implementation-tested against mocked provider responses on current API versions (Google Ads v26, Graph v26.0). **Awaiting credentials and provider approvals**; they show "Setup needed" in the product |
| Cloudflare R2 | Key format and presigned-URL signing are unit-tested (`tests/unit/r2.test.ts`). **Not live-verified**: no R2 credentials |
| PostHog | Loads only when its key is set (session replay off, text masked). **Not live-verified** |

Nothing in this repository claims a live provider connection that hasn't been made.
