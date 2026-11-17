## 17 November 2026 — complete contact-frequency checks

Owner-set broadcast frequency now uses exact send eligibility and an indexed latest outreach timestamp. See [the audit](growth-engine/contact-frequency-history-audit.md).

- `pnpm exec vitest run tests/convex/contact-frequency-history.test.ts tests/convex/contact-frequency.test.ts tests/unit/contact-frequency.test.ts tests/convex/marketing-authorization.test.ts tests/convex/marketing.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts` — 86 passed across seven files, 2.43 seconds.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/marketing.ts convex/lib/contactPressure.ts convex/schema.ts tests/convex/contact-frequency-history.test.ts tests/convex/marketing-authorization.test.ts` — passed.
- `git diff --check` — passed.

Five red regressions preceded the implementation. The late-frequency case preserves the approved consent identity and changes only the policy/history before dispatch. No real provider/model, browser, deployment or sending. Cross-broadcast contact locking, legacy unkeyed history and customer lifecycle state remain outside this repair.

## 17 November 2026 — retention evidence and final output validation

Retention advice now preserves recorded source classes, requires useful outcomes and decision rules for non-expansion plays, and can retain an unknown observation window. Real v2 jobs validate returned output again before saving it as verified. See [the audit](growth-engine/retention-recommendation-audit.md).

- `pnpm exec vitest run tests/unit/retention-expansion.test.ts tests/convex/retention-plan-validation.test.ts tests/convex/lifecycle-draft-context.test.ts tests/convex/engine-v2.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/unit/ai-tasks.test.ts tests/unit/agent-lint.test.ts tests/unit/agent-runtime.test.ts` — 66 passed across nine files, 6.96 seconds.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/jobs.ts shared/agents/specs.ts shared/ai/tasks.ts tests/unit/retention-expansion.test.ts tests/convex/retention-plan-validation.test.ts` — passed.
- `git diff --check` — passed.

Four new unit regressions and three job-boundary regressions failed before the repair. Job tests deliberately supply a passing model assessment while returning invalid output; the final check now rejects it. Correct owner reports and explicit unknown periods remain valid. Tests create no artifacts, approvals or action receipts. The first wider command named a nonexistent agent-contracts file; its 57 passing tests covered seven actual files, not that file. The final command above uses existing agent-lint/runtime files. No live model, paid evaluation, browser, provider, deployment or sending was involved. Automatic customer lifecycle enrollment remains unfinished.

## 17 November 2026 — translation source identity and inherited evidence

Translation now resolves a pinned tenant-bound source version, retains its offer/trend context and checks stored terms independently at save. The source-brief helper is shared with repurposing. See [the audit](growth-engine/translation-source-context-audit.md).

- `pnpm exec vitest run tests/convex/translation-source-context.test.ts tests/convex/translate.test.ts tests/convex/repurpose-source-context.test.ts tests/convex/repurpose.test.ts tests/convex/brand-writing-context.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/unit/offer-assessment.test.ts tests/convex/social-publish.test.ts tests/convex/publish-flow.test.ts` — final run: 118 passed across ten files, 4.24 seconds.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/lib/artifactSource.ts convex/repurpose.ts convex/translate.ts shared/agents/specs.ts tests/convex/translation-source-context.test.ts tests/convex/repurpose-source-context.test.ts` — passed.
- `git diff --check` — passed.

Four controlled regressions failed before the fix. Scheduler timers now ensure the edit-race tests actually edit before the worker reads. New tests cover historical evidence/fact retention, source/version/tenant/language binding, ignored caller authority, wrong-price rejection, deleted/legacy-source failure, replay and separate approval/schedule state. No real model, native-language quality evaluation, provider call, browser, deployment or external action. Localized semantic checks remain bounded and old completed translations are not migrated.

## 17 November 2026 — source constraints and complete repurposing batches

Existing source identity, offer snapshots and trend evidence now survive repurposing; final persistence checks the normalized batch independently. Incomplete requested formats fail rather than being silently omitted. See [the audit](growth-engine/repurpose-source-context-audit.md).

- `pnpm exec vitest run tests/convex/repurpose-source-context.test.ts tests/convex/repurpose.test.ts tests/convex/brand-writing-context.test.ts tests/convex/translate.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/unit/offer-assessment.test.ts tests/convex/social-publish.test.ts tests/convex/publish-flow.test.ts` — 109 passed across nine files, 3.81 seconds.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/repurpose.ts convex/repurposeActions.ts shared/agents/specs.ts tests/convex/repurpose-source-context.test.ts` — passed.
- `git diff --check` — passed.

Four new regressions failed before the fix. Follow-up validation caught broad persisted enum types (now parsed with existing enum schemas, unknown preserved) and missing required hashtags in new edit-test arguments (corrected). No provider calls, browser checks, paid model, deployment or external action. Model responses are mocked; semantic copy quality is not established. No generated files or unrelated `.gitignore` edits are included.

## 17 November 2026 — shared brand-writing context

Repurposing and landing writers previously omitted tone, restrictions and approved examples and clipped voice/rules to 600 characters. The shared writer context now retains these fields, separates confirmed settings from inferred edits, and requires enabled consent before including inferred rules. See [the audit](growth-engine/brand-writing-context-audit.md).

- `pnpm exec vitest run tests/convex/brand-writing-context.test.ts tests/unit/brand-writing-context.test.ts tests/convex/social-trend-generation.test.ts tests/convex/repurpose.test.ts tests/convex/landing.test.ts tests/convex/landing-fixture.test.ts tests/convex/brand.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/lifecycle-draft-context.test.ts` — 62 passed across ten files, 3.96 seconds.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/jobs.ts convex/landing.ts convex/repurpose.ts convex/repurposeActions.ts shared/agents/contentTasks.ts shared/agents/specs.ts tests/convex/brand-writing-context.test.ts tests/unit/brand-writing-context.test.ts tests/convex/social-trend-generation.test.ts` — passed.
- `git diff --check` — passed.

The initial specialist cases failed against the previous writer context. During follow-up verification, a case-sensitive assertion and an invalid index in new test setup failed and were corrected; neither required a production behavior workaround. Tests capture actual writer requests and use mocked generation; they do not establish semantic copy quality. No paid model, live provider, UI change, browser interaction or deployment. Plan snapshots and historical content are unchanged. The original 410 requirements and later owner specifications remain incomplete.

## 17 November 2026 — approved provider email payload

Fourteen regressions reproduced provider-content/identity gaps. Draft creation, the final pre-send read, send response and post-send read-back now check the expected payload/identity. Runtime plain text comes from the approved email and includes unsubscribe information; recovery uses the same complete payload hash. [Audit and limitations](growth-engine/marketing-provider-payload-audit.md).

- `pnpm exec vitest run tests/convex/marketing-authorization.test.ts tests/convex/marketing.test.ts tests/convex/contact-frequency.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/lifecycle-draft-context.test.ts tests/unit/integrations.adapters.test.ts tests/unit/email-recovery-ui.test.tsx` — 170 passed across eight files, 3.13 seconds.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/marketing.ts convex/schema.ts shared/integrations/resendMarketing.ts tests/convex/marketing-authorization.test.ts tests/unit/integrations.adapters.test.ts` — passed.
- `git diff --check` — passed.

No live provider/model, browser, sending or deployment. The optional payload-hash field is local. Older attempts lacking that hash remain manual. Remote read/write races, provider normalization and actual delivery remain unverified.

## 17 November 2026 — uncertain marketing-send recovery

Added exact original-broadcast read-back, an owner-facing check, separately dated receipts, one-time allowance reconciliation and bounded original-contact history updates. [Audit and limits](growth-engine/marketing-send-recovery-audit.md).

- `pnpm exec vitest run tests/convex/marketing-authorization.test.ts tests/convex/marketing.test.ts tests/convex/contact-frequency.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/lifecycle-draft-context.test.ts tests/unit/integrations.adapters.test.ts tests/unit/email-recovery-ui.test.tsx` — 144 passed, eight files, 3.23 seconds.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/marketing.ts convex/schema.ts shared/integrations/resendMarketing.ts src/components/app/content/detail/EmailSendPanel.tsx tests/convex/marketing-authorization.test.ts tests/unit/integrations.adapters.test.ts tests/unit/email-recovery-ui.test.tsx` — passed.
- `git diff --check` — passed.

No live provider, browser interaction, sending, deployment or paid-model evaluation. The optional schema additions are local. Legacy/no-dispatch/no-match cases remain unresolved. UI verification covers rendering, not full interactions or accessibility.

## 17 November 2026 — lifecycle-specific email preparation and unknown timing

First-win preparation now follows the selected email plan instead of forcing welcome copy. Exact bounded channel/audience/evidence/dependency context reaches generation; missing or ambiguous bindings stop. Email timing may remain null, and invalid structures/delays fail before saving. A separately reproduced approval-label bug now keeps superseded unapproved starter proposals from gaining approved status. See [the audit](growth-engine/lifecycle-draft-context-audit.md).

- `pnpm exec vitest run tests/convex/lifecycle-draft-context.test.ts tests/convex/first-win-reuse.test.ts tests/unit/approved-plan-context.test.ts tests/unit/ai-tasks.test.ts tests/unit/offer-assessment.test.ts tests/convex/marketing-authorization.test.ts tests/convex/marketing.test.ts tests/convex/research-context.test.ts tests/convex/engine-v2.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — final recheck: 120 passed across eleven files, 7.06 seconds.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/content.ts convex/jobs.ts convex/jobWrites.ts shared/agents/specs.ts shared/agents/contentTasks.ts shared/agents/approvedPlanContext.ts shared/ai/tasks.ts tests/convex/lifecycle-draft-context.test.ts` — passed without warnings.
- `git diff --check` — passed.

The focused file has 16 cases, included in the 120 total. Tests intercept the actual model boundary or return a controlled response; no live provider/model, browser, schedule, send or deployment occurred. Early test cleanup was corrected to avoid leaking scheduled jobs across cases. The numeric cadence's semantic evidence, generated-copy quality and full lifecycle automation remain unverified.

## 17 November 2026 — exact marketing audience and one-use send approval

Eight initial regressions reproduced missing audience/content/permission rechecks and duplicate execution in marketing email. Approval now binds local recipient identity, artifact version, rendered payload/sender, destination, credentials, reservation and policy. Current state is rechecked before preparation and send dispatch; unknown outcomes remain reserved and cannot retry. See [the scoped audit](growth-engine/marketing-send-authorization-audit.md).

- `pnpm exec vitest run tests/convex/marketing-authorization.test.ts tests/convex/marketing.test.ts tests/convex/contact-frequency.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/safety.test.ts tests/convex/send-idempotency.test.ts tests/convex/campaign-authorization.test.ts tests/convex/publish-flow.test.ts` — 153 passed across nine files, 4.82 seconds.
- `pnpm exec vitest run tests/convex/marketing-authorization.test.ts` — final 24 passed, including owner-query visibility of uncertain outcomes; overlaps the broader set.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/marketing.ts convex/schema.ts shared/policy/index.ts tests/convex/marketing-authorization.test.ts tests/convex/contact-frequency.test.ts` — passed without warnings.
- `git diff --check` — passed.

No live email/provider call, deployment, paid model evaluation or browser run. This adds optional backend approval fields using existing tables, with no generated file changes. The earlier intermediate schema placement and isolation-fixture errors were fixed and rerun. Local checks do not make external provider state atomic; unknown-send reconciliation and lifecycle drafting remain open.

## 17 November 2026 — selected ad platforms survive draft generation

Six initial regressions confirmed that selected Google/Meta plan jobs generated both platforms and accepted empty or mismatched results. Platform selection now reaches quote/research/spec/task and final validation; older unstarted cards resolve against the approved plan key. See [the scoped audit](growth-engine/ad-destination-consistency-audit.md).

- `pnpm exec vitest run tests/convex/plan-ad-destinations.test.ts tests/convex/plan-social-destinations.test.ts tests/unit/ad-destination-lint.test.ts tests/unit/agent-lint.test.ts tests/convex/engine-v2.test.ts tests/convex/campaign-authorization.test.ts tests/convex/campaign-activation-settings.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/plan-approval.test.ts` — final 140 passed across ten files, 8.90 seconds.
- `pnpm exec vitest run tests/convex/plan-ad-destinations.test.ts` — nine passed in the focused rerun; these overlap the broader set.
- `pnpm typecheck` — root and Convex passed.
- `pnpm exec eslint convex/ai/fixtures.ts convex/jobs.ts convex/lib/cards.ts convex/lib/jobPlans.ts shared/agents/specs.ts shared/agents/fake.ts tests/convex/plan-ad-destinations.test.ts` — passed without warnings.
- `git diff --check` — passed.

An intermediate expanded run passed 139 cases and failed one newly added test fixture missing action-card description/priority. The fixture was corrected and the complete focused set rerun green. No production workaround or removed test. Tests use deterministic providers; no live provider, paid-model evaluation, browser run, publishing, campaign creation or deployment was performed. No claim about live ad quality or results follows from these checks.

## 17 November 2026 — social destinations survive plan handoff

Three new actual routing regressions showed detailed-plan platform selections missing from reserved draft jobs. Shared named-platform selection now reaches cards, quotes, requests, research, schemas and fixtures; ambiguous/unknown/community labels wait instead of becoming generic platform jobs. First-win preparation follows selected, non-parked plan channels and no longer guesses from business type or unconditionally adds email. Final social output rejects destination mismatches instead of rewriting post.channel. See [the scoped audit](growth-engine/social-destination-consistency-audit.md).

- `pnpm exec vitest run tests/convex/plan-social-destinations.test.ts tests/convex/first-win-reuse.test.ts tests/unit/first-win-channels.test.ts tests/unit/social-intelligence.test.ts tests/unit/social-visuals.test.ts tests/convex/engine-v2.test.ts tests/convex/autopilot.test.ts tests/convex/publish-flow.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — 138 passed across ten files, 7.24 seconds.
- `pnpm exec vitest run tests/convex/plan-social-destinations.test.ts` — final eight cases additionally check that ambiguous/unknown/community selections also start no onboarding job; overlapping verification, not eight additional distinct tests.
- `pnpm typecheck` — root and Convex TypeScript passed.
- `pnpm exec eslint shared/growth/socialChannels.ts convex/content.ts convex/lib/cards.ts convex/lib/jobPlans.ts convex/jobs.ts convex/ai/fixtures.ts shared/agents/specs.ts tests/convex/plan-social-destinations.test.ts tests/convex/first-win-reuse.test.ts tests/unit/first-win-channels.test.ts` — passed without warnings.

The actual job tests use fixture/mocked providers; artifacts remain drafts/in review and no external-action receipts are created. An injected Facebook result for a LinkedIn request fails before saving. The initial multiple-platform test exposed an empty legacy channel in quote construction; quotes now receive the actual selected set. No generated files, live accounts, paid-model evaluations, browser checks or deployment. Bounded label recognition and generic direct-request defaults remain explicit limitations.

## 17 November 2026 — truthful reuse of starter preparation

Detailed plan activation previously marked both social/email work covered whenever any first-win job ID existed. New run inputs bind the originating plan and social quantity; reuse now verifies matching job state and usable same-tenant/current-version artifacts. Pending, paused and unknown outcomes remain explicit waiting states. Failure or missing preparation follows existing draft-only action cards and usage limits. Focused embedded drafts are unchanged. See [the scoped audit](growth-engine/plan-preparation-reuse-audit.md).

- `pnpm exec vitest run tests/convex/first-win-reuse.test.ts tests/unit/first-win-channels.test.ts tests/convex/plan-history.test.ts tests/convex/focused-plan.test.ts tests/convex/wish.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — 116 passed across seven files, 17.05 seconds.
- `pnpm exec vitest run tests/convex/first-win-reuse.test.ts` — final 16 passed, including the subsequently added actual first-win reservation/binding case. This overlaps the preceding run and is not an additional 16 distinct tests.
- `pnpm typecheck` — root and Convex TypeScript passed.
- `pnpm exec eslint convex/lib/cards.ts convex/content.ts tests/convex/first-win-reuse.test.ts` — passed.

Nine initial regressions failed before repair. Tests include no usable drafts, archived/broken versions, wrong destination, partial quantity, different/legacy plan, foreign run/version, pending/paused/uncertain states and separate social/email coverage. No provider jobs were executed by the new tests; no external-action receipts were produced. No browser, live-account or paid-model evaluation ran. Old unbound work and arbitrary copy quality remain unverified.

## 17 November 2026 — owner channel feedback in default plans

Closed two confirmed gaps: default focused/starter generation lacked explicit saved-channel feedback and its deterministic dismissal check; freshness compared a source/date-bearing snapshot with current preferences stripped of those fields. Strategy context now labels and carries owner preferences, shared scoring/plan validation reuses exact-channel exclusion, and generation/freshness use the same recorded values. Hard findings block approval/start without suppressing bold exploration or treating preferences as outcomes. See [the scoped audit](growth-engine/owner-channel-feedback-audit.md).

- `pnpm exec vitest run tests/unit/plan-channel-preferences.test.ts tests/unit/channel-limits.test.ts tests/convex/focused-plan.test.ts tests/convex/channel-cache.test.ts tests/convex/strategy-evidence.test.ts tests/unit/focused-paid-fit.test.ts tests/convex/plan-history.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — 130 passed in nine files, 21.45 seconds.
- `pnpm typecheck` — root and Convex TypeScript passed.
- `pnpm exec eslint shared/acquisition/scoring.ts shared/agents/types.ts shared/agents/specs.ts shared/agents/quality.ts convex/jobs.ts convex/workspace.ts tests/unit/plan-channel-preferences.test.ts tests/convex/focused-plan.test.ts` — passed.

Four unit regressions and one actual freshness query failed before their repairs. Initial job fixtures incorrectly used library IDs as the strategy's enum keys; corrected fixtures use the real `seo_content` key and canonical channel name. Four actual default-plan cases verify saved owner feedback, failed quality and blocked approval/start, then clearing and a newly passing plan. A separate query case checks unchanged feedback and invalidation after its source changes. Existing plan-history, cache, tenant and approval tests pass. No live-provider, paid-model, browser test or deployment ran. Free-form channel aliases and semantic compliance remain limitations; source/date completeness of old snapshots remains explicit.

## 17 November 2026 — recorded sources for channel and audience citations

Four new spec-level regressions showed prompt-only URLs and URL prefixes accepted as research, and recorded sources absent from prose rejected. `lintCites` now checks the structured research source list in focused/starter/detailed specs using the existing URL normalizer. Path case, query, scheme and host stay distinct. Persisted evidence-title matching uses the same identity rules. Six actual default-plan generation cases verify rejected/accepted sources, saved links, approval/start rejection and no action receipts. Engine v3.121-plan-source-membership. See [the scoped audit](growth-engine/plan-channel-evidence-audit.md).

- `pnpm exec vitest run tests/unit/plan-evidence-links.test.ts tests/convex/focused-plan.test.ts tests/unit/focused-plan.test.ts tests/unit/plan-quality.test.ts tests/convex/strategy-evidence.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — 127 passed in seven files, 7.91 seconds.
- `pnpm typecheck` — root and Convex TypeScript passed.
- `pnpm exec eslint shared/agents/specs.ts shared/agents/evidence.ts tests/unit/plan-evidence-links.test.ts tests/convex/focused-plan.test.ts` — passed.

The first integration run exposed a test assertion using the wrong persistence field; the next exposed optional fixes being absent on a passing plan. Assertions now inspect actual channel/audience `sources` and explicitly require passed quality for accepted references. The final test run is green. No browser, live-provider or paid-model test ran. No prompt or execution authority changed. Matching a recorded source does not establish claim truth, audience demand, causal evidence or recommendation quality; historical plans are not retroactively revalidated.

## 17 November 2026 — paid acquisition fit in default plans

Closed a confirmed bypass between scored channel recommendations and focused/starter plans. Both now reuse the same deterministic eligibility policy for explicit paid allocations, with recorded owner margin and only a supported diagnosis. The hard finding reaches saved quality and existing approval/start checks. Unknown margin, uncertain diagnosis, unpaid preparation and bold exploration remain distinct. See [the scoped audit](growth-engine/paid-acquisition-completion-audit.md).

- `pnpm exec vitest run tests/unit/focused-paid-fit.test.ts tests/unit/channel-limits.test.ts tests/unit/demand-gate.test.ts tests/convex/focused-plan.test.ts tests/unit/plan-quality.test.ts tests/convex/unsure-economics.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — 122 passed in eight files, 7.17 seconds.
- `pnpm typecheck` — root and Convex TypeScript passed (existing run completed successfully).
- `pnpm exec eslint shared/acquisition/scoring.ts shared/agents/types.ts shared/agents/specs.ts shared/agents/quality.ts convex/jobs.ts tests/unit/focused-paid-fit.test.ts tests/convex/focused-plan.test.ts` — passed.

The six added job cases use actual owner mutations, mocked model output, persistence and approval/start boundaries. No action receipts or granted approvals are created. No browser, live-provider or paid-model evaluation, deployment or model switch. Old plans and unstructured semantic intent are not retrospectively validated; broad strategy quality remains unproven.

## 17 November 2026 — chronological forecast-range coverage

Two red numerical regressions exposed interval evaluation using forecasts issued before all calibration outcomes were available. Calibration still uses targets strictly before its cutoff, but held-out evaluation now requires forecast origins and targets on/after that cutoff. The held-out minimum applies to the eligible errors; sparse coverage stays unknown. Output records `heldOutMethod: origin_after_calibration_v1` and explains overlapping, pooled errors. Point prediction and range-width formulas are unchanged. See [the rows 26–30 audit](growth-engine/forecast-learning-completion-audit.md) for the inspected paths, primary methodological source and limits.

Two further red actual-query cases exposed historical/unknown method markers presenting coverage as verified. `getForecast` now withholds those percentages/counts and the known old coverage sentence, adds an explanation through the existing warning display, and retains original points, ranges, training history and stored JSON. Creating a new forecast uses the repaired method; reading one never rewrites it.

- `pnpm exec vitest run tests/unit/forecast-calibration-cutoff.test.ts tests/unit/forecasting.test.ts tests/unit/forecast-forward-score.test.tsx tests/convex/forecast-evidence.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts` — 59 passed across six files, 2.33 seconds.
- `pnpm typecheck` — root and Convex TypeScript passed.
- `pnpm exec eslint shared/forecasting/intervals.ts shared/forecasting/forecast.ts shared/forecasting/index.ts convex/analytics.ts tests/unit/forecast-calibration-cutoff.test.ts tests/convex/forecast-evidence.test.ts` — passed.

Coverage includes original saved evidence, sparse/changed/missing observations, negative net revenue, no action side effects, and existing tenant/edit permissions. The deterministic 180-day synthetic case now evaluates 645 origin-eligible errors instead of 1,080 selected only by target date. This changes reported coverage scope, not a measured improvement in predictive performance. No browser/live-account/paid-model evaluation or deployment ran. Correlated errors, pooled horizon coverage, exchangeability assumptions and historical data completeness remain limitations; no causal or guaranteed future-coverage claim is made.

## 17 November 2026 — preserve recorded source classes in research findings

Twelve new unit cases reproduced evidence labels being accepted despite contradictory or absent source metadata across commercial findings, SWOT, audience needs and channel preferences. The existing insights linter now uses `referenceEvidenceBasis` and `constraints.factEvidenceBases` for every cited reference. Owner reports cannot become measured evidence because they mention analytics; published facts cannot become owner reports. A matching reference does not conceal another reference with a different source class. Missing metadata remains unknown; the model may separate findings or label an interpretation as inference. Known source URLs use the existing URL normalization and fact references retain existing case/whitespace tolerance. No prompt, provider, schema or UI was changed. Engine v3.119-insights-source-basis.

Verification:

- `pnpm exec vitest run tests/unit/insights-evidence-basis.test.ts tests/unit/research-quality.test.ts tests/convex/research-context.test.ts tests/unit/offer-timing-evidence-basis.test.ts tests/unit/focused-learning.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/unit/business-research-context.test.ts tests/unit/audience-evidence-support.test.tsx tests/convex/stopped-runs.test.ts` — 105 passed across 10 files, 2.89 seconds.
- `pnpm typecheck` — root and Convex TypeScript passed.
- `pnpm exec eslint shared/agents/specs.ts tests/unit/insights-evidence-basis.test.ts tests/unit/research-quality.test.ts tests/convex/research-context.test.ts` — passed.

Actual onboarding tests seed confirmed owner/researched facts and verify their recorded source classes reach the job. Correct owner labels are accepted; owner-to-measured and published-to-owner relabeling fail at final acceptance even with a passing mocked reviewer. Prior insights remain intact, owner-visible failure history and tenant isolation remain, and no network/approval/receipt/artifact action occurs. Unit coverage also preserves recorded measurements, researched claims and uncited hypotheses. Existing unit fixtures now supply explicit provenance instead of relying on wording. These checks validate provenance agreement, not source truth, claim meaning, independent demand, representative sampling or causal effects. Current business-fact ingestion supplies owner/researched provenance; this change adds no measured-data connector or historical migration. No browser/live-provider/paid-model evaluation ran.

## 17 November 2026 — final research acceptance before replacing insights

Six new actual onboarding-job cases first failed: unread citation, unavailable research, invented website quote, website claim used as demand evidence, nonexistent fact index, and malformed commercial structure all became verified. The shared runner can retain its best draft; a positive mocked reviewer verdict did not establish evidence validity. Real v2 onboarding now reuses its original insights spec/input and actual research metadata for schema and deterministic lint checks before saving. Errors preserve earlier insights and produce a visible failed-run reason. Valid source-backed language and labeled inferences still pass. Existing profile extraction and legacy/fixture behavior remain separate. Engine v3.118-insights-acceptance; see [the scoped audit](growth-engine/research-evidence-completion-audit.md).

Commands and results:

- `pnpm exec vitest run tests/convex/research-context.test.ts tests/unit/research-quality.test.ts tests/unit/business-research-context.test.ts tests/unit/audience-evidence-support.test.tsx tests/convex/free-onboarding.test.ts tests/convex/research-cache.test.ts tests/convex/local-research.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/stopped-runs.test.ts tests/convex/business-model-validation.test.ts` — 86 passed, 11 files, 4.44 seconds.
- `pnpm exec vitest run tests/convex/research-context.test.ts` — final 15 passed, including actual failed-run visibility to the owner and rejection of another tenant's read, 1.13 seconds.
- `pnpm typecheck` — root and Convex TypeScript passed.
- `pnpm exec eslint convex/jobs.ts shared/agents/specs.ts tests/convex/research-context.test.ts` — passed.

New cases assert no network calls or approvals, action receipts or artifacts. Rejected output cannot replace saved insights; valid research retains page-read timestamps/excerpt status. No UI/browser change, paid evaluation, deployment or external send. Final schema/source checks do not prove semantic support, representative demand, all evidence-label correctness or historical result validity. Full 410-row acceptance remains open.

## 17 November 2026 — visible plan-check reasons and preserved discussion drafts

The main failed-plan callout now exposes its saved first reason, expandable remaining reasons/fixes and an editable Explain these checks request. The browser test reproduced a shared ClimbPanel bug that overwrote an owner's unsent question; queued context now appends to current text and canceled effects cannot replay it. Existing approval and repair-generation paths are unchanged. See [the rows 11–20 audit](growth-engine/owner-experience-completion-audit.md).

Commands and observed results:

- `pnpm exec vitest run tests/unit/plan-check-summary.test.tsx tests/unit/request-composer.test.tsx tests/unit/plan-quality.test.ts tests/unit/focused-learning-ui.test.tsx tests/convex/owner-questions.test.ts tests/convex/focused-plan.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/climb.test.ts tests/unit/climb-tool-output.test.ts tests/unit/plan-timeline.test.ts` — 104 passed across 11 files, 7.04 seconds.
- `pnpm typecheck` — passed root and Convex TypeScript checks.
- `pnpm exec eslint src/components/app/plan/GoalWorkspace.tsx src/components/app/plan/PlanCheckSummary.tsx src/components/climb/ClimbPanel.tsx tests/unit/plan-check-summary.test.tsx e2e/plan-check-feedback.spec.ts` — passed.
- `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/plan-check-feedback.spec.ts e2e/focused-strategy-options.spec.ts` — four passed across desktop/mobile, 1.7 minutes, using the isolated local demo backend.

New browser coverage checks first reason visibility, disclosure of other checks, editable exact request text, preservation of manually typed text after reopening, and unchanged authority-bearing rows. Existing strategy coverage retains all three creative options and their action boundary. Both screenshots were inspected; scoped axe serious/critical and horizontal-overflow checks passed. The development issue indicator remains visible; these checks do not establish app-wide accessibility, an issue-free application, owner comprehension or real-model explanation quality. Tests use synthetic local data, not provider accounts. No deployment, external action, paid evaluation or model change.

## 17 November 2026 — enforce demand validation in starter/focused plans

Audit of the default growth-plan path confirmed that owner funnel diagnosis, capacity, lifecycle and demand concerns already reach generation. Two gaps remained: starter/focused specs did not run the detailed planner's demand gate, and `demand_gate` was absent from hard quality rules. Three new unit regressions failed before implementation: focused/starter produced no demand error, and final quality returned passed for a demand-gate error.

The focused spec now maps its channels into the existing demand policy. Ascending channel priority determines the primary recommendation, matching persistence; tied priorities are all primary. Explicit positive primary ad spend with supplied demand concerns is an error; supporting spend retains the existing warning. `demand_gate` is now a hard quality rule with an owner-readable reason. Both default plan styles retain strategic alternatives, save the failed draft for review, and refuse approval/start through the existing controls. No new schema, provider, agent, UI component or campaign-timing prompt was introduced. Engine v3.117-focused-demand-validation.

Commands run:

```sh
pnpm exec vitest run tests/unit/demand-gate.test.ts tests/unit/plan-quality.test.ts tests/unit/focused-plan.test.ts tests/unit/diagnosis-playbooks.test.ts tests/unit/business-lifecycle.test.ts tests/unit/capacity-service-area.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/offer-assessment.test.ts tests/unit/focused-campaign-timing.test.ts tests/convex/focused-plan.test.ts tests/convex/engine-v2.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/research-context.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/specs.ts shared/agents/quality.ts tests/unit/demand-gate.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts
git diff --check
```

Results: **188 tests across 14 files passed (9.52s)**; app/Convex typechecks, scoped lint and whitespace checks passed. New workflow cases use the real agent loop with synthetic model turns and an owner-reported pre-launch business. Proposed primary spend is inside the supplied ad budget, isolating demand failure from budget failure. Starter and focused plans retain their bold option, have failed quality, cannot be approved or started, and create no execution receipts. A supporting paid test remains saved at the correct minor-unit amount, its warning reaches review, and it does not become a hard failure. Unit cases cover tied/unsorted priorities and absence of supplied demand concerns. Initial integration setup failures were missing/incorrect fixture provenance and an assertion against the pre-persistence field name; these were corrected to the actual schema and storage units.

Limits: no paid model evaluation, browser verification, deployment or external spend. Historical saved quality states were not migrated. The guard uses explicit proposed ad spend and supplied demand concerns; it cannot identify every paid tactic expressed only in prose, and absence of a concern is not proof of validated demand. Wider diagnosis-to-action semantic alignment and real-business recommendation quality remain open. See `docs/growth-engine/growth-plan-completion-audit.md` for the scoped reconciliation of requirements 1–10; the complete 410-item and later owner scope is not marked complete.

## 17 November 2026 — validate business-model results before acceptance

Audit traced owner inputs and metered start through evidence hashes, deterministic first-party signals, market research, agent review, saved verdict, owner tests and future strategy context. The shared runner intentionally retains its best draft when revision is exhausted; the business-model job had no final acceptance check. Seven new failing boundary cases reproduced invalid output becoming verified despite a passing model assessment. Source normalization also conflated distinct URLs, and evidence-date validation accepted impossible dates.

New real v2 checks parse the current schema and reuse `lintAgentOutput` with the actual retained research before verified persistence. Failed checks cannot enter latest-result/next-plan context. URL validation preserves scheme, host, path and query identity while allowing host casing and same-page fragments. Date validation checks real calendar days; explicitly undated evidence remains allowed. The dedicated page shows the newest failed attempt separately and retains an earlier valid report; a later successful check clears the failure. Engine v3.116-business-model-validation.

Commands run:

```sh
pnpm exec vitest run tests/unit/business-model-check.test.ts tests/unit/business-model-freshness.test.ts tests/unit/business-model-view.test.tsx tests/convex/business-model-check.test.ts tests/convex/business-model-learning.test.ts tests/convex/business-model-validation.test.ts tests/convex/engine-v2.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/businessModel.ts shared/agents/specs.ts convex/businessModel.ts convex/jobs.ts 'src/app/app/[organization]/business-model/page.tsx' tests/unit/business-model-check.test.ts tests/convex/business-model-validation.test.ts
git diff --check
```

Results: **90 tests across 9 files passed (7.16s)**; app and Convex typechecks, scoped lint and whitespace checks passed. The new job tests mock the agent boundary, retain the actual job/query/context path and forbid network calls. Cases cover unknown fact/source, missing research, a different case-sensitive source path, impossible date, duplicate mode, number labeled unknown, malformed structure, valid evidence, undated evidence and a low-feasibility bold option without precedent. No artifacts, approvals, action receipts or test reports are created as recommendation side effects. Tenant isolation, previous-valid-result preservation and clearing the failure after success are checked. Existing suite coverage includes met/missed/unclear/not-run reporting, original-test learning, metering and permission boundaries.

Limits: this is not a paid real-model quality evaluation, live-provider check or browser verification of the added callout. Historical reports were not migrated/revalidated. Legacy fixture paths receive schema checks only; final evidence lint is applied to real v2 runs. Source membership and valid dates do not establish semantic support, correct source dates, authentic customer demand or reliable business viability/pivot judgment. The scoped audit is `docs/growth-engine/business-model-completion-audit.md`; the remaining 410-requirement completion work is still open.

## 17 November 2026 — preserve evergreen advice about trend chasing

Audit of the preceding social guard found a real false positive: “don’t chase viral trends” and “no viral gimmicks” required a dated current-trend source. The same detector missed plural-only positive instructions such as “follow current trends.” Six failing unit cases reproduced the post/calendar false positives and plural omission before implementation.

Social and calendar checks now share namesTrendReference. It strips only bounded explicit exclusions of generic trend material before checking each field independently. Definite references such as “this viral meme,” separate positive clauses, and “don’t miss this viral trend” still require evidence. No title or field can negate a different field. Explicit source/evidence metadata is always validated regardless of wording. The existing source/date/observation matcher and final pre-image/pre-save gate are unchanged. Engine v3.115-trend-reference-context; no provider, model route, schema, UI, generated file or action authority changed.

Verification commands:

```sh
pnpm exec vitest run tests/unit/social-trend-surfaces.test.ts tests/convex/social-trend-generation.test.ts tests/unit/social-intelligence.test.ts tests/unit/calendar-trend-evidence.test.ts tests/convex/calendar-trend-evidence.test.ts tests/convex/engine-v2.test.ts tests/convex/autopilot.test.ts tests/convex/social-publish.test.ts tests/convex/research-context.test.ts tests/convex/brand.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/publish-flow.test.ts tests/unit/trend-freshness.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/specs.ts tests/unit/social-trend-surfaces.test.ts tests/unit/calendar-trend-evidence.test.ts tests/convex/social-trend-generation.test.ts tests/convex/calendar-trend-evidence.test.ts
git diff --check
```

Results: **180 tests across 14 files passed (7.71s)**; app/Convex typecheck, scoped lint and whitespace checks passed. Actual createContent boundary tests save generic-exclusion advice as in-review work, reject a separate unsupported video reference, and reject incomplete declared evidence despite negative wording. The calendar mutation saves evergreen advice as a planned preview and refuses an unsupported later CTA without replacing it. No external network calls or action receipts occur in the new job cases; successful content requires the existing pending review. Existing brand inputs, Autopilot, tenant and publishing checks remain covered.

Limits: these exclusions are a deliberately narrow English grammar, not a general semantic classifier. Unrecognized educational phrasing may still require revision, while implicit or multilingual references may escape lexical detection unless metadata declares them. The model, source truth, creative effectiveness and live providers were not evaluated. No browser/UI change or deployment; no paid evaluation, external send/publish/spend or model switch. Existing .gitignore work remains untouched; whole-project acceptance remains open.

## 17 November 2026 — social trend checks across generated creative fields

Audit followed brand settings and job context into createContent and planSocialWeek, the shared social-intelligence/platform skills, research, model lint/revision, socialToArtifacts, calendar persistence and existing approval/publishing checks. Voice, humor/trend preferences and approved examples already reached both jobs. Weekly history already included qualified post reports with source/version/measurement limitations. No replacement agent or prompt was needed for those behaviors.

Confirmed gaps: trend detection inspected title/hook/body/angle but omitted carousel headings/body, video script, first comment, alt text, visual brief, image idea, shot directions and hashtags. Calendar proof and CTA references were likewise omitted. The model loop intentionally retains its best draft after exhausted revisions; createContent could save an unresolved missing/unmatched trend record as a verified run. Red unit tests reproduced all nine omitted social surfaces and both calendar fields. After correcting a fixture's missing initial brand profile, actual-job tests reproduced missing/unmatched evidence completing as verified despite a claimed passing AI assessment.

Extended the existing dated-record validator through socialTrendIssues, shared by model lint and a final createContent guard before images, saving or Autopilot routing. The guard uses research notes, URLs and retrieval time retained by the application, not a model-produced approval flag. Invalid retained trend output stops the batch with an owner-facing explanation; no automatic new generation is started. Valid run-bound evidence and original evergreen creative ideas still proceed to draft review. Calendar proof and CTA checks reuse the existing mutation validator, preserving its all-or-nothing behavior and earlier saved slots. Engine v3.114-social-trend-surface-validation. No provider, model route, schema, generated file, UI or action authorization was changed.

Verification commands:

```sh
pnpm exec vitest run tests/unit/social-trend-surfaces.test.ts tests/convex/social-trend-generation.test.ts tests/unit/social-intelligence.test.ts tests/unit/calendar-trend-evidence.test.ts tests/convex/calendar-trend-evidence.test.ts tests/convex/engine-v2.test.ts tests/convex/autopilot.test.ts tests/convex/social-publish.test.ts tests/convex/research-context.test.ts tests/convex/brand.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/publish-flow.test.ts tests/unit/trend-freshness.test.ts
pnpm typecheck
pnpm exec eslint convex/jobs.ts shared/agents/specs.ts tests/fixtures/socialTrend.ts tests/unit/social-trend-surfaces.test.ts tests/unit/calendar-trend-evidence.test.ts tests/convex/social-trend-generation.test.ts tests/convex/calendar-trend-evidence.test.ts
git diff --check
```

Results: **160 tests across 14 files passed (7.75s)**; app/Convex typecheck, scoped lint and whitespace checks passed. New job-boundary cases cover missing, mismatched, uncited and stale evidence, valid dated evidence and evergreen output with a nominal passing model assessment. Invalid cases save no artifacts or approvals; valid cases create review drafts only. Network calls are rejected by the test stub and no action receipts are created. A weekly preview case verifies matching humor/voice/example input and planned-only slots with no draft, approval, second run or external action. The calendar regression confirms CTA-only invalid evidence cannot replace earlier slots. Existing engine, Autopilot, publishing, brand and tenant tests cover the surrounding controls.

Limits: the new generation tests replace the model loop at its boundary; they establish application enforcement and supplied context, not the real model's creative quality or compliance with tone preferences. The detection rule remains bounded to English trend/meme/viral markers or explicit structured metadata. It can flag discussion of those words even when not claiming current popularity and cannot detect every implicit or multilingual reference. Matching a dated research record does not prove that its source semantically supports the claim or that the idea fits an audience. No continuous listening, legacy-draft migration, manual-edit redesign, live provider check, browser rerun, paid evaluation or deployment was performed. Whole-project acceptance remains open and unrelated .gitignore work is preserved.

## 17 November 2026 — exact saved step work from Home

Audit: the active focused-plan review already opened saved work without another AI job. A separate Home card selected the first successful result from the newest 30 organization-wide records and linked to a general plan anchor. Red regressions reproduced selected-plan work disappearing behind 35 unrelated rows, earlier success reappearing behind newer failed/working attempts, and malformed latest JSON crashing Home.

Home now uses the existing strategy/step index to read each actual saved step's latest attempt for the selected plan. It considers valid ready/needs-input results without falling back within a failed, working or malformed step; another valid step may still appear. All saved phases are considered, matching the existing plan-work library rather than imposing a new four-step cap. The result includes exact work, plan and step IDs. The existing editor is lazily opened in the shared dialog, pinned to the selected work ID. Explicitly opening the current result no longer labels it historical; a later attempt makes the pinned result historical without replacing its editor. Missing exact work has an unavailable state. Existing saveDraft revision/tenant/role controls remain in force, including edits to recoverable earlier work. No new agent, provider, schema, generated file or action path.

Verification commands:

```sh
pnpm exec vitest run tests/convex/prepared-work-home.test.ts tests/convex/step-work.test.ts tests/convex/focused-plan.test.ts tests/convex/goal-workspace.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts
pnpm typecheck
pnpm exec eslint convex/stepWork.ts src/components/app/plan/StepWork.tsx src/components/app/today/HomeCards.tsx tests/convex/prepared-work-home.test.ts e2e/prepared-work-home.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/prepared-work-home.spec.ts
git diff --check
```

Results: **135 tests across eight files passed (8.57s)**, including five new Home selection/permission cases and existing focused-plan/tenant/approval/publishing checks. App/Convex typecheck, scoped lint and isolated sync passed. **Two desktop/mobile browser checks passed (10.0s)**. They open the actual Home dialog, retain an unsaved original edit while a newer result arrives, save only the original version, close with Escape, restore trigger focus and reopen the newer version. Workflow runs, approvals, artifacts, action receipts and completion records remain unchanged. Automated serious/critical accessibility and document-overflow checks passed. The mobile screenshot was inspected; transient completion/save notices and the development badge are present, so this is not an app-wide visual/accessibility certification.

The first browser run failed after closing because the synthetic newer draft was shorter than the real 100-character output minimum. Home correctly omitted that invalid result. Correcting the fixture to a valid draft made both cases pass; no runtime validation was weakened. The local browser fixture is explicitly synthetic and imports only into the dedicated loopback demo. It does not exercise paid model generation or real publishing. The malformed-data fallback is specific to Home, not a general repair of every legacy work-detail reader. No hosted deployment, paid evaluation, external send/publish/spend or model switch occurred. Pre-existing .gitignore changes remain untouched; full-project acceptance remains open.

## 17 November 2026 — current focused workflow on the first demo visit

Audit: a fresh demo still seeded an empty expert outline, legacy multi-channel advice and a placeholder opportunity. The focused move, prepared brief, creative alternatives and primary learning control appeared only after the prior update-path repair. A failing actual-query regression confirmed the missing initial focused move.

The initial demo now reuses the same validated demoFocusedStrategy output as starter/focused updates. Persistence maps its synthetic audience fields explicitly and includes its direction, primary move, prepared brief, three options, milestones, proposed timing and proposed experiment. The sample plan retains its existing simulated approved state; no live approval is inferred. The primary experiment is not presented as already running. Review date follows the same illustrative timing; unsupported channel-cost placeholders and unrelated source references are removed. Existing demo creation remains idempotent: reopening returns the saved workspace, plan and private draft edits without resetting them. No migration of existing demos is attempted. Detailed update requests remain on their existing legacy fixture path.

Verification commands:

```sh
pnpm exec vitest run tests/convex/demo-focused-plan.test.ts tests/convex/wish.test.ts tests/convex/climb.test.ts tests/convex/landing-fixture.test.ts tests/convex/marketing.test.ts tests/convex/engine-v2.test.ts tests/convex/ad-budget-currency.test.ts tests/convex/contact-frequency.test.ts tests/convex/custom-agents.test.ts tests/convex/outbound.test.ts tests/convex/ad-performance.test.ts tests/convex/safety.test.ts tests/convex/local-research.test.ts tests/convex/calendar-awaiting-review.test.ts tests/convex/plan-approval.test.ts tests/convex/campaign-authorization.test.ts tests/convex/approval-claims.test.ts tests/convex/platform-ops.test.ts tests/convex/tenancy.test.ts tests/convex/publish-flow.test.ts tests/unit/local-demo-isolation.test.ts tests/unit/demo-focused-strategy.test.ts
pnpm exec vitest run tests/convex/demo-focused-plan.test.ts
pnpm typecheck
pnpm exec eslint convex/demo.ts tests/convex/demo-focused-plan.test.ts tests/convex/wish.test.ts e2e/demo-update-plan.spec.ts e2e/demo-flow.spec.ts e2e/recommendation-first.spec.ts e2e/play-result-money.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/demo-update-plan.spec.ts e2e/demo-flow.spec.ts e2e/recommendation-first.spec.ts e2e/play-result-money.spec.ts --grep 'demo update|plan: approved|Home leads|Plan presents|Channels show|Owners can define|weekly reports require'
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/demo-update-plan.spec.ts e2e/demo-flow.spec.ts e2e/recommendation-first.spec.ts --grep 'demo update|plan: approved|Home opens|Owners can define'
git diff --check
```

Results: **228 tests across 22 files passed (16.94s)**, covering demo consumers plus tenant, approval, campaign, publishing and isolation boundaries. The final **four-case demo regression rerun passed (2.11s)** after adding preservation of a real private draft edit on reopening. It also checks that first visit starts no workflow run and makes no network fetch. App/Convex typecheck, scoped lint and isolated local sync passed.

Browser verification covered **13 selected cases** across desktop/mobile: six passed in the initial run; seven failed on outdated or ambiguous test selectors and passed after correction (**25.5s** for the rerun). Tests now use the current Home heading/request field, Research disclosure route, explicit channel heading and timeline heading. Changing tabs remounts nested disclosures, so the not-run test reopens them before inspecting original setup. No product UI was changed to satisfy those selectors. The setup test no longer relies on an artificially running demo experiment: it saves a setup, reports not run through the actual primary outcome control, then verifies the setup is retained and a deviation can be recorded. The currency-reporting test now declares its own synthetic detailed play rather than depending on the removed demo placeholder. Plan options, channel discovery and weekly currency reports passed on both viewports; the detailed plan overview passed on desktop. The first-visit/update check verifies primary learning, prepared work and the bold alternative before a generation request, no initial workflow run, then a separate pending update with zero-cost fixture usage and unchanged artifact/action receipts. Applicable automated serious/critical accessibility and horizontal-overflow checks passed. This is selected local workflow coverage, not the full browser suite, full accessibility conformance or a production-scale test.

Changed: convex/demo.ts; the demo-generation and Home query tests; four affected browser test files; capability, handoff, audit, ledger and this verification note. Existing .gitignore work is preserved. No production agent prompt, provider, model, application UI, schema or generated file changed. Synthetic advice is not verified customer demand, research, business performance or expert-quality model output. No paid evaluation, external send/publish/spend, hosted deployment, merge or model switch occurred; full project acceptance remains open.

## 17 November 2026 — current demo update-plan workflow

Audit: actual starter/focused requests in a demo workspace completed as verified but saved only the legacy StrategySchema output. The focused production branch excludes fixtures, and runModelTask parsed all demo strategy output with the legacy schema. Two failing actual-generation tests reproduced the absent focusedMove. The separate generic fake-model sampler was not the path involved.

Added a deterministic, explicitly synthetic focused demo plan in shared/demo/focusedStrategy.ts, selected by the existing fixture adapter only for starter/focused requests. runModelTask validates it with the full existing FocusedStrategySchema before recording zero-cost fixture usage and checkpointing. The existing detailed fallback passes the requested style through; saveStrategy persists the current move, prepared private brief, three distinct strategic alternatives and uniquely named primary experiment. No production prompt, agent/provider/model route, schema, generated API, UI component or action adapter changed. Initial seeded showcase and explicitly detailed demo requests retain the legacy fixture format.

Verification commands:

```sh
pnpm exec vitest run tests/unit/demo-focused-strategy.test.ts tests/convex/demo-focused-plan.test.ts tests/convex/focused-plan.test.ts tests/convex/engine-v2.test.ts tests/convex/goal-workspace.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts tests/convex/landing-fixture.test.ts tests/unit/local-demo-isolation.test.ts
pnpm typecheck
pnpm exec eslint shared/demo/focusedStrategy.ts convex/ai/fixtures.ts convex/jobs.ts tests/unit/demo-focused-strategy.test.ts tests/convex/demo-focused-plan.test.ts e2e/demo-update-plan.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/demo-update-plan.spec.ts
git diff --check
```

Results: **143 tests across 11 files passed (12.56s)**; app/Convex typecheck, targeted ESLint and isolated local sync passed. **Two desktop/mobile browser checks passed (21.1s)** through the actual Update my plan confirmation, See the update, primary outcome control, all three strategy options and editable prepared draft. The tests inspect saved run/usage and unchanged artifact/action receipts; the prior plan remains approved and the new plan has a pending approval. Backend tests additionally throw on any fetch, reject outsiders, check nonempty zero-cost fixture usage, and validate primary learning, timing and prepared-work contracts. Unknown baseline/sample/capacity and absent precedent/research/model-verdict claims are checked. Explicit detailed requests retain four legacy channels.

Test-development corrections: initial authority assertions were adjusted to compare existing seeded receipts and allow the expected pending plan-review request, without allowing granted authority or external-action changes. The first browser run used dialog rather than the actual alertdialog role; it timed out on desktop, and the redundant mobile attempt was stopped before rerunning. The corrected run passed. Stable-view automated serious/critical accessibility and document-overflow checks passed; the inspected mobile screenshot includes the local development issue badge and fixed navigation, so this is not a console-cleanliness or complete visual-quality claim.

Limits: these are synthetic examples, not tailored real-business advice, retrieved research, paid-model evaluation, business outcomes or production-provider verification. The illustrative relative timing is explicitly assumed; it does not establish real readiness. Initial demo showcase modernization and full generic fake-model schema compatibility remain separate work. No external send, publish, spend, deployment, merge or model switch occurred. Unrelated .gitignore changes were preserved; the full project acceptance remains open.

## 17 November 2026 — preserve creative alternatives in assistant discussions

Audit: StrategyExplorationPanel displays saved grounded, adjacent and bold options and their owner feedback, but get_plan did not expose strategyExploration. A red actual-tool regression confirmed the options view was absent. The existing strategy generator, retrieval library, option schema and owner feedback workflow were already implemented; this change connects their saved output to the assistant rather than generating another portfolio or agent.

The existing read tool now supports view=options, then mode plus section=idea/evidence/test/feedback. The overview preserves all three modes with separate novelty/evidence/fit/feasibility/risk judgments; low evidence, low feasibility, uncertainty and no precedent never filter a valid bold option. Each section returns complete original fields, with possible upside in idea and assumptions/risks/capacity/reversible criteria in test. Missing or malformed legacy options stay explicit without hiding another valid mode. An oversized section is omitted intact with an inspection limitation; it is not reduced to a partial risk or ranked down. All outputs pass the existing schema and untrusted-text encoder within its context limit.

Feedback uses the existing tenant query. The option hash must match the exact saved option; a stored owner-edit hash is checked when available. Missing, mismatched or invalid/future-dated feedback is not replaced by an earlier preference. The returned source is owner-reported even when the owner's claimed evidence label says measured. Retirement is exposed as historical context. No feedback row or selection is changed by reading. Main Strategy options cards can fill a mode-specific editable discussion draft with the saved plan selected; they do not submit it or approve execution.

Verification commands:

```sh
pnpm exec vitest run tests/unit/strategy-options-view.test.ts tests/unit/plan-learning-view.test.ts tests/unit/climb-tool-output.test.ts tests/unit/creative-precedents.test.ts tests/unit/focused-learning-ui.test.tsx tests/convex/goal-workspace.test.ts tests/convex/climb.test.ts tests/convex/creative-strategy.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts
pnpm typecheck
pnpm exec eslint shared/climb/strategyOptions.ts convex/lib/climbTools.ts convex/lib/climbConfig.ts convex/creativeStrategy.ts src/components/app/plan/ExpertPlan.tsx src/components/app/plan/GoalWorkspace.tsx tests/unit/strategy-options-view.test.ts tests/convex/goal-workspace.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Results: **236 tests across 13 files passed (11.59s)**; app/Convex typecheck, scoped lint, isolated sync and diff check passed. **Two desktop/mobile browser checks passed (1.6m)**. The browser verifies the actual bold discussion draft, leaves it unsent, and confirms unchanged saved feedback plus no new chat messages, workflows, artifacts, approvals or action receipts; it also retains the existing primary-result workflow and stable-view accessibility/overflow checks. Final browser-file lint passed after adding the unchanged-feedback assertion. An early unit assertion incorrectly rejected the word scores in the disclaimer; the final check correctly rejects a composite score property. No real-model generation or provider action was exercised.

The creative precedent overview had a stale 75-case opening count. A runtime import counted 100 records, 100 distinct IDs and 25 expansion records, all with low research confidence. The document now distinguishes the original 75 from the 25 action-only additions and preserves historical dated counts below. The first tsx CLI count attempt hit a local IPC restriction; node --import tsx completed the read-only count. This inventory check is not a fresh external-source review and does not establish commercial effects or transfer validity.

Changed: shared/climb/strategyOptions.ts; convex/lib/climbTools.ts and climbConfig.ts; convex/creativeStrategy.ts (read-only retirement field); ExpertPlan.tsx and GoalWorkspace.tsx; the option-view unit test, goal-workspace regression and focused browser test; capability, handoff, precedent overview, audit, ledger and verification notes. No schema, generated files, agent, provider, model route, publishing or approval adapter changed. Unrelated .gitignore work was preserved. The installed Next.js client guide and React guidance already read in this continuation apply; existing components, tokens and composer are reused.

Limits: this makes saved options and owner feedback available to the assistant. It does not prove that a model will inspect all necessary sections, generate original ideas, compare them well, verify sources, or deliver business results. Evidence references remain the original saved references; this tool does not fetch their pages or resolve precedent source records. Legacy options that fail the current contract need inspection, and oversized sections remain visible in the saved application panel. Owner edits without a historical hash remain owner reports. No paid model evaluation, external send/publish/spend, deployment, merge or tier switch occurred. Protected strategy scope and full project acceptance remain active.

## 17 November 2026 — discuss saved results with the assistant

Audit: GoalWorkspace selections attach an exact strategy ID to the shared composer, but get_plan accepted no ID and returned only experiment name/status. A failing actual-query/tool regression reproduced the gap: a report on one saved goal was unavailable while another goal was selected. Generic get_results reads aggregate business analytics, not that experiment's report. The planning engine already consumes outcome briefs; this repair addresses the assistant read boundary and owner discussion entry point.

The existing get_plan tool now accepts strategyId, view=learning and optional experimentId. It rejects unavailable or foreign identities rather than allowing workspace.plan's fallback to substitute another plan. An explicitly selected historical overview omits the unrelated current goal, with an explanation. Overview lists experiment IDs and report availability. Learning returns original hypothesis/population/metric/comparison/method/window/stop conditions, the latest reported outcome and source/design, the existing deterministic outcome reading, owner note, and changed-definition/original-result context. Missing and not-run reports remain distinct. Invalid/future latest review dates are withheld without resurrecting earlier success. Whole records/details are omitted with explicit counts and limitations when necessary to fit below the tool encoder's 7,800-character boundary; requesting one test can retrieve its detail separately. No reviewer identity is exposed. Existing tool encoding validates the output and escapes untrusted text.

The primary learning card's Discuss next step button fills the existing editable assistant draft and attaches the selected plan. It does not submit the message or start a model call. Assistant instructions now direct result discussions to the learning view and distinguish observations from a proposed continue/change/stop decision. This prompt is not proof that a model always follows the instruction or reasons well.

Verification commands:

```sh
pnpm exec vitest run tests/unit/plan-learning-view.test.ts tests/unit/climb-tool-output.test.ts tests/unit/focused-learning-ui.test.tsx tests/unit/experiment-outcome.test.ts tests/unit/experiment-measurement.test.ts tests/convex/goal-workspace.test.ts tests/convex/climb.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts
pnpm typecheck
pnpm exec eslint shared/climb/planLearning.ts convex/lib/climbTools.ts convex/lib/climbConfig.ts src/components/app/plan/FocusedLearning.tsx tests/unit/plan-learning-view.test.ts tests/unit/focused-learning-ui.test.tsx tests/convex/goal-workspace.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Results: **167 tests across 12 files passed (6.14s)**; app/Convex typecheck, scoped ESLint, diff check and isolated local sync passed. **Two desktop/mobile browser checks passed (1.5m)**. The existing synthetic workflow still records/corrects outcomes and verifies matching Research display; it now clicks Discuss next step, verifies the intended editable text, edits it, and checks that no new chat messages, workflow runs, approvals, artifacts or action receipts were created. Stable-view automated accessibility/overflow checks also passed. Tool tests use the actual tenant query and outcome mutation, with no live-model call. The first new regression failed because the old tool omitted exact plan identity and report data; a subsequent assertion was corrected to match the actual no-authority wording.

Changed: convex/lib/climbTools.ts and climbConfig.ts; shared/climb/planLearning.ts; src/components/app/plan/FocusedLearning.tsx; three unit/Convex test files; the focused browser test; capability, handoff, ledger, requirement-audit and verification notes. No schema, generated files, model route, new agent/provider, execution adapter or authorization contract changed. Unrelated .gitignore work is preserved.

Limits: this exposes evidence to an existing read tool; it does not validate model retrieval choices, recommendation quality, reported population/exposure, source authenticity, causal outcomes or profitable continuation. The existing plan query remains bounded to 20 experiments. Large individual records can remain unavailable in tool context and need inspection in the saved plan. Full revision history, offer/timing assessments and every business constraint are not included in this learning view. Reported sources are member entries, including connected-tool/platform labels. No paid evaluation, live send/publish/spend, deployment, merge or model-tier switch occurred. Full project/410-row acceptance remains unproven.

## 17 November 2026 — report primary learning from Next steps

Audit: GoalWorkspace's default Next steps rendered only PlanTimeline. The existing primary experiment/outcome control required Research → Open research and plan details → Who to reach and how. The workspace query also read only the newest 20 experiments across the organization before selecting this strategy. A new failing regression inserted 25 newer tests for another plan and demonstrated that the selected plan's primary test disappeared.

Next steps now includes Check your progress for the saved focused recommendation. It shows the metric and proposed observation duration, expandable hypothesis/audience/comparison/stop conditions, and the existing ExperimentOutcome form and history. The form is keyed to the test; the panel is keyed to the strategy. Only a unique exact-name match is used. Missing or ambiguous matches show an explanation and an editable discussion draft, not a guessed test or automatic generation. Viewers can inspect reported outcomes without write controls. The query uses the existing by_strategy index with an explicit tenant filter, retaining the bounded 20-row read for that strategy. No schema, engine prompt/version, model, provider, execution or approval contract changed.

Verification commands:

```sh
pnpm exec vitest run tests/unit/focused-learning-ui.test.tsx tests/unit/experiment-outcome-ui.test.tsx tests/unit/focused-learning.test.ts tests/unit/experiment-outcome.test.ts tests/unit/experiment-measurement.test.ts tests/convex/goal-workspace.test.ts tests/convex/focused-plan.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts
pnpm typecheck
pnpm exec eslint src/components/app/plan/FocusedLearning.tsx src/components/app/plan/GoalWorkspace.tsx convex/workspace.ts tests/unit/focused-learning-ui.test.tsx tests/convex/goal-workspace.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Results: **203 tests in 12 files passed (9.87s)**; app/Convex typecheck, scoped lint and local sync passed. **Two desktop/mobile browser tests passed (1.5m)**. The browser checks find reporting on the initial Next steps view, inspect its saved test conditions, save Not run, record and correct a count, change to a negative KWD monetary observation with unknown comparison, then confirm the same report in Research. Tenant-scoped artifacts, approvals, action receipts and workflow rows remain unchanged. Stable-view serious/critical automated accessibility and horizontal-overflow checks passed. The mobile panel capture was inspected; its tall element screenshot includes the existing fixed navigation/development overlay, so it is not a clean full-page visual acceptance artifact.

Failures: the query regression initially returned no experiments instead of the selected plan's test. The first browser run stopped on two identically named Next steps tabs after opening advanced Research; the selector now uses the named Plan views tablist. The final run passed. These tests use synthetic local fixtures; they make no paid model/provider call or live external action.

Changed files: convex/workspace.ts; src/components/app/plan/GoalWorkspace.tsx and FocusedLearning.tsx; tests/convex/goal-workspace.test.ts and tests/unit/focused-learning-ui.test.tsx; e2e/focused-strategy-options.spec.ts; capability, handoff, requirement-audit, ledger and this verification document. Existing unrelated .gitignore changes were preserved. No generated files changed.

Limits: exact-name matching is structural, not semantic proof of a good test. Old plans are not backfilled. The per-strategy read remains bounded at 20, while new focused plans allow at most four experiments; oversized legacy records are not exhaustively rendered. Owner reports remain unverified observations, and task completion does not establish customer or revenue outcomes. This is a focused accessibility/workflow check, not representative-owner usability, whole-app accessibility, a development-console audit, real-model evaluation or full 410-requirement completion. Nothing was deployed or merged.

## 17 November 2026 — record the actual experiment metric

Audit path: Strategy.experiments.primaryMetricType → saved experiment → workspace plan query → shared ExperimentOutcome form → playResults.recordExperimentOutcome → analyses/revision history → outcomeLine/resultsBriefs → next strategy writer and reviewer. The plan contract already supported count, continuous and monetary metrics. The report contract/form only supported eligible/exposed/converted people and a note. Three red API tests demonstrated that typed metric values could not be recorded. Existing outcome history, source labels, tenant controls, recorded-design classification and later-learning selection were retained.

Engine v3.113-typed-experiment-observations adds an optional measurement to the existing outcome record: type, actual value or null, optional comparison value or null, unit/amount meaning, recorded currency for money, population/calculation scope and comparison basis. No new outcome table or agent was introduced. The form starts from the saved metric type where available; owners can choose conversion counts, counts of the named outcome, continuous measurements, money or notes only. It does not copy the plan's estimated baseline into actual observations. Missing is distinct from zero. Monetary input uses the existing exact decimal-to-minor-unit parser and currency formatter, including zero/three-decimal currencies and negative contribution; no currency conversion occurs. Unsupported precision, invalid currencies, nonfinite values, fractional/negative discrete counts and incomplete units/scope are rejected.

Typed values cannot also be conversion counts, cannot be attached to a not-run report, and cannot invoke the binary-rate significance calculator or automatic outcome verdict. Unknown observations remain valid. Reported comparisons include their scope; matching values do not verify comparability. Changes to values preserve corrections; changes to metric/unit/currency/scope create a separate analysis and mark changed post-result definitions exploratory. A prior not-run record does not predeclare an observed measurement definition. Older known non-binary reports containing conversion-style counts are flagged as having an unknown primary metric value, not interpreted as rates; legacy records with unknown type are not guessed or migrated.

The existing tenant-bound outcome reader includes values and their boundaries in future context. A real job-orchestration test with a stubbed model verifies both the next writer and reviewer receive a count observation, unknown comparison and unknown exposure. Reporting remains a workspace-member declaration even if its source selection says connected tool or platform report. It does not create campaigns, workflows, approvals or action receipts.

Verification commands:

```sh
pnpm exec vitest run tests/unit/experiment-measurement.test.ts tests/unit/experiment-outcome.test.ts tests/unit/experiment-outcome-ui.test.tsx tests/unit/experiment-feasibility.test.ts tests/unit/focused-learning.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts tests/convex/play-result-learning.test.ts tests/convex/play-results.test.ts tests/unit/design-learning.test.ts tests/unit/design-learning-note.test.ts tests/convex/design-learning.test.ts tests/convex/design-critic.test.ts
pnpm typecheck
pnpm exec eslint shared/growth/experimentOutcome.ts shared/agents/specs.ts convex/schema.ts convex/lib/experimentMeasurement.ts convex/playResults.ts src/components/app/plan/ExperimentOutcome.tsx tests/unit/experiment-measurement.test.ts tests/unit/experiment-outcome-ui.test.tsx tests/convex/experiment-outcomes.test.ts tests/convex/focused-plan.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Focused results: **242 tests across 17 files passed (9.40s)**; app/Convex typecheck and scoped ESLint passed. This includes exact currency round trips, unknown versus zero, negative contribution, impossible values, history/corrections, changed units, not-run transition, outsider/viewer rejection, stale-edit rejection, learning handoff and unchanged action boundaries. Existing design-learning and design-critic tests passed because the shared report form is also used there; the design assessment still does not estimate effects for these aggregate non-binary observations.

Final desktop/mobile browser checks both passed (about 92s), including recording a count, correcting it to zero, preserving an unknown comparison, saving negative KWD contribution at three-decimal precision, flagging a changed definition and leaving approval/action/workflow records unchanged. Serious/critical automated accessibility and horizontal-overflow checks passed; inspected the final mobile contribution capture. Changing measurement type now clears old values, units and scope instead of carrying count context into a money report. Two earlier selector attempts timed out because the accessible labels include '(optional)' without an intervening space; the final selectors use the actual observed names and bounded waits. A final focused API rerun (three cases) also verifies that reordered object keys do not create false changed-field entries when values are unchanged. An early typecheck caught string form fields leaking into the numeric inference preview; the preview now passes only explicitly parsed count fields. An early assertion incorrectly matched the phrase calculated difference inside the no-causal-proof disclaimer; the final assertion checks the absence of a randomized-comparison result and p-value instead.

Changed code: shared/growth/experimentOutcome.ts; convex/playResults.ts, schema.ts and lib/experimentMeasurement.ts; src/components/app/plan/ExperimentOutcome.tsx; shared/agents/specs.ts (version). The established local Convex sync regenerated two module-registration lines in convex/_generated/api.d.ts; this generated change was not hand-edited. Tests cover unit/UI, Convex generation/outcome/permission behavior and the focused desktop/mobile workflow. Capability, handoff, requirement-audit and implementation-ledger notes were updated. The installed Next.js use-client guide and React component guidance were consulted; the UI reuses existing controls and adds no network fetch or dependency.

Limits: values, aggregation, currency, population, cost boundary, comparison and dates remain member-reported, not independently verified or instrumented. There is no arbitrary-metric statistics engine, matched-cohort verification, automated success threshold, effect forecast or causal attribution. Aggregate money is not inferred revenue/profit, and an owner label does not validate its calculation. A changed report definition remains exploratory. Existing legacy data is not reclassified wholesale, and missing original metric type remains unknown. The design-specific assessment remains conservative/inconclusive where its exposure and comparison requirements are unmet. Full 410-row acceptance, real-model judgment and production effectiveness remain unproven. No paid model call, tier switch, external send/publish/spend, deployment or merge occurred.

## 17 November 2026 — recordable primary learning tests in focused plans

Audit path: focusedPlanTask → FocusedStrategySchema → focused/starter lint and reviewer rubric → hard plan quality → jobWrites.saveStrategy → existing Experiments review/setup/outcome controls → playResults.briefFor → future planning context. The prompt previously said to leave experiments empty unless statistical measurements justified one. A failing generation regression demonstrated a schema-valid primary test brief with no experiment row to record an outcome against. Historical cached real-model output also showed an empty list, but that old sample is not a current quality evaluation.

Engine v3.112-focused-learning-test requires one to four experiment records in new focused output and exactly one whose name equals focusedMove.title. The primary record declares its eligible population, assignment unit, primary metric/denominator, baseline/comparison, observation window, guardrails and stopping rule. Observational learning permits null baseline, meaningful-effect threshold and planned sample with explicit reasons. Baseline source classes must match all supplied references; missing metadata stays unknown. Impossible binary rates, negative counts, invalid sample sizes, random-assignment claims on observational methods and unsupported statistical splits fail hard quality. Unknown-baseline records cannot attach supposed known-baseline references. The proposed duration must fit the owner-selected cycle when one applies; adaptive planning retains its existing timing path. Shared persistence now retains one-day observational windows while statistical comparisons retain their existing seven-day minimum. No new experiment table, provider, agent or execution adapter was added.

Existing owner controls record met, missed, unclear and not-run reports, with tenant checks and outcome revisions. The section now explains that an observation alone does not prove cause instead of claiming every experiment has a control. Generation regressions verify all four states reach the existing learning brief, remain reports, reject an outsider and create no action receipts. A schema-valid mismatched primary test cannot pass approval even with a passing AI reviewer. The generic fake adapter also names its synthetic primary test consistently; the dedicated focused fixture exercises the full plan workflow.

Final verification commands:

```sh
pnpm exec vitest run tests/unit/focused-learning.test.ts tests/unit/focused-plan.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/focused-campaign-timing.test.ts tests/unit/plan-quality.test.ts tests/unit/experiment-feasibility.test.ts tests/unit/experiment-outcome.test.ts tests/unit/experiment-outcome-ui.test.tsx tests/convex/focused-plan.test.ts tests/convex/free-onboarding.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/fake.ts shared/agents/focusedPlan.ts shared/agents/focusedRubric.ts shared/agents/specs.ts shared/agents/quality.ts convex/jobWrites.ts src/components/app/plan/PlanSections.tsx tests/fixtures/focusedPlan.ts tests/unit/focused-learning.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Results: **255 tests across 15 files passed (10.14s)**; app/Convex typecheck, scoped ESLint and diff checks passed. Local fixture sync passed before browser verification. Both desktop and mobile browser checks passed (48.1s), including the recordable one-day test, saving Not run, persistence, no new action/approval/workflow records, horizontal overflow checks and serious/critical automated accessibility scans. Inspected the mobile saved-outcome capture. The browser fixture does not exercise model generation; the Convex tests exercise actual job orchestration with a stubbed model boundary. Later changes to lint and the fake adapter were covered by the final unit/workflow suite; the browser fixture and UI were unchanged.

Failures and corrections: the initial generation test expected one experiment but found zero. Three further red unit cases exposed an empty assignment unit, invalid observational numeric inputs and a fabricated extra baseline reference beside a valid one. An initial desktop scan hit the Outcome saved toast during its fade-in: the absence wait raced ahead of notification creation. The test now observes the confirmation before waiting for dismissal and scanning the stable view. One subsequent browser launch failed at the macOS sandbox permission boundary; the authorized launch outside that sandbox completed. An early test command named a nonexistent experiment-preregistration file; it established no coverage and is replaced by the actual experiment-feasibility/outcome files in the final command above. An initial fake-contract test used an invalid model-rate key, then exposed pre-existing generic full-focused sample failures for provenance hashes and timing.reason. The final fake-specific test intentionally covers only the new learning shape; full focused orchestration uses the dedicated schema-valid fixture. It does not establish that generic fake output satisfies the entire focused schema.

Changed code: shared/agents/focusedPlan.ts, focusedRubric.ts, specs.ts, quality.ts and fake.ts; convex/jobWrites.ts; src/components/app/plan/PlanSections.tsx. Changed tests: focusedPlan fixture, focused-learning and plan-quality unit tests, focused-plan Convex tests and focused-strategy-options browser test. Capability, handoff, ledger and requirement-audit notes were updated. The installed use-client Next.js guide was read before the UI copy edit. No generated files changed.

Limits: exact-name matching is a structural connection, not semantic proof that the proposed measurement tests the recommendation or matches every offer/timing condition. Reference/source-class checks do not establish numerical entailment, source authenticity or real measurement validity. Qualitative observations are recorded in notes, not a new arbitrary-metric time-series system. Existing saved plans are not backfilled. No stronger causal classification or experiment-definition execution permission is introduced. Observational outcome reports can be useful while sample size and baseline remain unknown. Real-model output quality, incremental generation cost, live business impact, whole-app accessibility and all 410 requirements remain unverified. No paid evaluation, live send, publishing, spending, deployment or model-tier switch occurred.

## 17 November 2026 — same-day buying and category-based timing assumptions

Requirement audit scope: diagnosis and assumptions (3, 10), sales-cycle awareness (84), and unsupported revenue timing (26). Traced owner acquisition.setDimension → stored owner/inferred category → profileFrom/mergeFit → strategyDiagnosis → diagnose → writer/reviewer → saved constraintDiagnosis → existing owner review. Also checked the shared channel limitChecks consumer. Two failing actual-workflow tests demonstrated that Same day maps to zero but diagnose rejected zero, discarding a valid funnel as conflicting_inputs in both starter and focused plans. Further inspection found direct diagnosis use of low-confidence inferred categories (unlike channel scoring), undisclosed category-to-day assumptions, and a first-revenue statement derived from generic channel learning and buying-cycle defaults.

Engine v3.111-buying-cycle-evidence accepts zero as same-day buying while retaining negative/nonfinite input rejection. A shared category estimate helper preserves owner/inferred origin, excludes low-confidence inferred or unknown categories, and is used by diagnosis and channel timing. Existing mapped durations remain explicit planning assumptions, not measured durations or forecasts. The diagnosis retains the explanation in its saved payload and writer/reviewer context; the existing expandable owner view displays it. When a short observation period may miss purchases under the category estimate, the next question asks for actual lead and purchase dates rather than treating the heuristic duration as a confirmed required wait. Known zero delivery capacity remains prioritized. Channel warnings now expose both component assumptions and call first-revenue timing unknown. No campaign-timing prompt, calendar integration, provider, table or action authority changed.

Verification:

```sh
pnpm exec vitest run tests/unit/channel-limits.test.ts tests/unit/channel-scoring.test.ts tests/unit/buying-cycle-evidence.test.ts tests/unit/diagnosis-playbooks.test.ts tests/unit/decision-books.test.ts tests/unit/decision-structured.test.ts tests/unit/decision-contract.test.ts tests/unit/demand-gate.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-speed.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts
pnpm exec vitest run tests/unit/acquisition.test.ts tests/unit/channel-decision.test.ts tests/unit/channel-jobs.test.ts
pnpm typecheck
pnpm exec eslint convex/jobs.ts shared/acquisition/scoring.ts shared/agents/diagnosis.ts shared/agents/specs.ts src/components/app/plan/ExpertPlan.tsx tests/unit/buying-cycle-evidence.test.ts tests/unit/channel-limits.test.ts tests/unit/diagnosis-playbooks.test.ts tests/convex/focused-plan.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Results: first regression command matched 13 files, 246 tests passed (10.14s). Its channel-scoring.test.ts filter has no file; the actual acquisition/channel suites were run in the second command, with 22 additional tests across three files passing. App/Convex typecheck and scoped lint passed. Local fixture sync passed (3.33s). Both desktop/mobile browser checks passed (32.2s), including visible estimate/source/uncertainty, preserved strategic options and no execution authority. Inspected the mobile diagnosis capture. Read the installed Next.js client-component guide before UI editing and applied the React review checklist; this adds static text without new state, effects, fetching or dependencies. A final plain-language edit replaced cohort-maturity jargon. The 31 workflow cases still passed; two wording assertions initially retained the old text, were updated, and all seven buying-cycle unit cases then passed. Both desktop/mobile browser checks passed again with the final wording (33.5s).

Limits: category defaults are still heuristic, not a calibrated distribution of purchase delays. No measured sales-cycle importer or matched-cohort maturation tracker was added. A sufficiently long reporting period alone does not prove every recent lead had time to buy; the explanation explicitly asks for group-specific dates. Missing/low-confidence timing does not prove maturity. Existing funnel readings remain conditional observations from owner reports, not causal diagnoses. Historical saved diagnoses are not rewritten. No real-model or live-provider test, deployment or external action ran. Full 410-requirement acceptance remains incomplete.

## 17 November 2026 — offer and timing evidence preserve recorded source classes

Audit path: businessFacts.provenance → jobs.constraintsOf → numbered writer/reviewer facts → focused/starter and detailed offer/timing validation → hard quality result → typed saved assessment → owner review and approval. The existing evidenceKind classified wording (for example, analytics) as a demand signal; it did not establish measurement provenance. Seven new regressions showed that exact quotes and valid references could still label owner reports as measured facts, or use an unrelated owner reference to relabel a source claim.

Added separate factEvidenceBases from stored provenance. Owner-supplied facts remain owner_reported, researched facts remain source_reported, and absent/demo provenance stays unknown. Both model stages receive the source class separately from the wording signal. Offer decision evidence, numeric inputs, risk statements, promotion history and payment-fee terms must match their cited source class; timing event evidence uses the same check. Decision-level support must contain the exact claim in a source of the claimed class. Mismatches are hard failures even when the AI reviewer passes. Risk/history schemas now represent reported evidence without forcing it into measured or hypothesis; the existing owner panel says reported by your team/source. Engine v3.110-offer-timing-source-basis. The original detailed timing task output still matches the saved before-change snapshot byte for byte.

Verification commands:

```sh
pnpm exec vitest run tests/unit/offer-timing-evidence-basis.test.ts tests/unit/offer-assessment.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/campaign-timing.test.ts tests/unit/focused-campaign-timing.test.ts tests/unit/agent-runtime.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-grounding.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/evidenceKind.ts shared/agents/types.ts shared/agents/offerAssessment.ts shared/agents/campaignTiming.ts shared/agents/specs.ts shared/agents/runtime.ts shared/agents/quality.ts convex/jobs.ts convex/schema.ts src/components/app/plan/offerPresentation.ts tests/fixtures/offerAssessment.ts tests/unit/offer-timing-evidence-basis.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Results: 223 tests across 14 files passed (10.67s); app/Convex typecheck and scoped lint passed. Local fixture sync passed. Playwright's retained report confirms both desktop/mobile checks passed (33.05s), including the owner-reported risk label, existing three-option review and no action authority; inspected the mobile offer capture. Initial direct focused-offer fixture failures were repaired by supplying their actual owner source metadata. An initial new-test TypeScript inference error was fixed by typing its context as OfferAssessmentContext. No new live provider or paid model evaluation ran.

Limits: source-class validation is not semantic entailment, source authenticity, representative demand, causal evidence or proof of offer effectiveness. Current business-fact ingestion does not supply independently measured records: a report mentioning an analytics dashboard remains an owner report. Explicit measured metadata is supported by the validator and tested, but no new verified-measurement connector was added. Historical saved plans are not reclassified or backfilled. Screenshot/fixture checks do not establish whole-app accessibility or live-provider behavior. No agent, provider, table, scheduling authority, publishing, spend or deployment was added. Full requirement-level acceptance remains outstanding.

## 17 November 2026 — experiment results retain original focused decision conditions

Audit path: saved strategies.expert.focusedMove and experiments → recordExperimentOutcome/revision history → outcomeLines/resultsBriefs → jobWrites.jobContext.resultsText/channelResultsText → jobs.businessBrief → next focused writer and reviewer. The existing outcome and correction workflows already represented met, missed, unclear and not-run reports, original test definitions, scope and observation limits. The learning context omitted the original focused move, including offer and campaign-timing assessments. Five focused regressions failed for that missing context after correcting the initial test fixture to use the actual persisted expert shape.

Extended the existing results reader with a separate, untrusted historical decision section keyed to the exact original strategy/version/goal. Included decisions retain the complete saved focusedMove, including costs, evidence labels, segment/eligibility, assumptions, capacity, test rules, date evidence and unknowns when present. Multiple tests from one plan share one decision record. A newer plan cannot replace the original conditions. Complete decisions are limited to 8,000 characters each and 16,000 total; an omitted decision retains its identity and an explicit unknown/inspect-original limitation. Existing bounded experiment selection remains unchanged. Reused weeklyLearningEligible to check original business, goal and run provenance, excluding foreign, missing and known fixture links before adding learning. Engine v3.109-experiment-decision-context.

The context explicitly distinguishes a saved proposal from evidence that a test used its terms or dates. Historical fact references are not today's fact indexes. Expired event evidence remains historical and is not refreshed or promoted to a current recommendation. No experiment-to-offer attribution is invented. Existing owner-report, not-run and causal limitations remain, as do correction handling and independent action approvals.

Verification commands:

```sh
pnpm exec vitest run tests/convex/experiment-outcomes.test.ts tests/convex/focused-plan.test.ts tests/convex/play-result-learning.test.ts tests/convex/play-results.test.ts tests/convex/research-context.test.ts tests/convex/strategy-evidence.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts tests/unit/experiment-outcome.test.ts
pnpm typecheck
pnpm exec eslint convex/playResults.ts shared/agents/specs.ts tests/convex/experiment-outcomes.test.ts tests/convex/focused-plan.test.ts
git diff --check
```

Results: **162 tests across 11 files passed** (9.96s); app/Convex typecheck, scoped ESLint and diff checks passed. New cases cover each outcome state, original versus newer terms, one context for multiple reports, per-record and combined limits without partial decisions, missing legacy assessments, foreign original business/goal provenance and cross-tenant isolation. Existing corrections, not-run handling, outcome history/export/deletion and permission checks remain green. The generation test runs the actual job orchestration with a stubbed model boundary: a saved original offer/timing plan receives an owner-reported unclear experiment result, then the next writer and reviewer both receive its conditions and exposure limitation. It proves the handoff, not model judgment. No campaigns or action receipts are created by this path.

Code changed: convex/playResults.ts and shared/agents/specs.ts (engine version). Tests changed: tests/convex/experiment-outcomes.test.ts and tests/convex/focused-plan.test.ts. Capability, handoff, ledger and requirement-audit notes updated. No UI or Next.js code, schema, provider, agent or generated files changed, so no browser rerun or backend deployment was needed for this increment.

Limits: the saved plan is historical context, not an independently verified record of actual delivery, exposure, costs, capacity or causal effect. There is no new exact experiment-to-offer binding. Detailed-play contexts retain their existing representation; this addition addresses focused decisions. Selection still samples six tested and four not-run experiments with the documented indexed/legacy limits. Large decision records are explicitly unavailable in model context. Source truth, source freshness for a new campaign, complete historical coverage, real-model quality and token-cost impact remain unverified. No paid evaluation, deployment, live send, publishing or spending occurred. All 410 requirements are not declared complete.

## 17 November 2026 — campaign timing in focused and starter recommendations

Traced owner facts/geography and workspace timezone → research metadata → buildStrategy focused/starter task → FocusedStrategySchema → shared lintCampaignTiming → plan quality → saveStrategy/typed Convex storage → GoalWorkspace → plan content hash and decidePlan. Detailed plays already supported the assessment; the default path lacked its structured field, validation, persistence and owner display. Initial focused tests failed on schema retention and unsupported timing. Reused the existing contract, validator and CampaignTimingSummary instead of adding a calendar service or agent. New model output requires the field; saved legacy plans may omit it. Evergreen moves use not_relevant and remain visually unchanged.

The original detailed campaign-timing instructions were extracted verbatim into campaignTimingTask and reused by the default path. An exact comparison of playsTask output against its pre-edit capture passed; no timing-policy prompt was rewritten. Focused task routing places the assessment on the primary move, separate from goal duration and speculative strategy alternatives. The engine persists the actual retrieval timestamp and strips an attempted model-authored 2099 timestamp in workflow coverage. Engine v3.108-focused-campaign-timing.

Additional red cases exposed null/unknown timezone rejection, the workspace date being used instead of a separately evidenced business-local date, a lead-time number borrowed from elsewhere in a source, and working days treated as calendar days. The trusted evaluation instant is refreshed after research; otherwise a newly retrieved source could incorrectly appear to be from the future. Known preparation/delivery spans must match the exact cited basis in calendar days. Unknown spans remain unknown. A perfect AI review previously left campaign_timing errors provisional; they are now hard quality failures in both detailed and focused plans.

Verification commands:

```sh
pnpm exec vitest run tests/unit/focused-campaign-timing.test.ts tests/unit/campaign-timing.test.ts tests/unit/plan-quality.test.ts tests/unit/focused-offer-assessment.test.ts tests/unit/agent-runtime.test.ts tests/convex/focused-plan.test.ts tests/convex/goal-workspace.test.ts tests/convex/free-onboarding.test.ts tests/convex/plan-grounding.test.ts tests/convex/research-context.test.ts tests/convex/plan-approval.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts tests/convex/publish-flow.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/planTasks.ts shared/agents/focusedPlan.ts shared/agents/specs.ts shared/agents/types.ts shared/agents/runtime.ts shared/agents/campaignTiming.ts shared/agents/quality.ts shared/agents/focusedRubric.ts shared/agents/fake.ts convex/jobs.ts convex/schema.ts src/components/app/plan/GoalWorkspace.tsx tests/fixtures/campaignTiming.ts tests/fixtures/focusedPlan.ts tests/unit/campaign-timing.test.ts tests/unit/focused-campaign-timing.test.ts tests/unit/plan-quality.test.ts tests/convex/focused-plan.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Results: **198 tests across 14 files passed** (11.86s), **two desktop/mobile browser checks passed** (32.2s), app/Convex typecheck and scoped ESLint passed, and isolated local Convex sync succeeded. Coverage includes supported date windows, insufficient preparation/capacity, unknown location/timezone, evergreen handling, stale/conflicting date evidence, exact lead-time support, different business-local dates, research-clock freshness, trusted metadata, changed-content approval rejection, existing offer consistency and tenant/publishing permission checks. Browser checks exercised the real review panel, sources disclosure, source link, lead times, offer panel, bold-option feedback and diagnosis. No horizontal overflow or serious/critical automated accessibility findings appeared in the checked stable views; the mobile timing screenshot was inspected. This does not establish app-wide accessibility or all transient states. External-action records were unchanged by owner review; generated plans created no campaigns or action receipts.

Changed code: shared/agents/{planTasks,focusedPlan,specs,types,runtime,campaignTiming,quality,focusedRubric,fake}.ts; convex/{jobs,schema}.ts; src/components/app/plan/GoalWorkspace.tsx. Tests: new tests/{fixtures/campaignTiming,unit/focused-campaign-timing.test}.ts; updated focused fixtures, timing/quality unit tests, focused-plan workflow tests and focused-strategy-options browser coverage. Capability, handoff, audit and ledger documents record this scope.

Limits: evidence checks use bounded English/date patterns and cited research-note text; they do not establish source truth, semantic relevance or independently measured capacity. Working-day conversion requires an evidenced calendar-day equivalent; no holiday/calendar dependency was added. The existing 24-hour source freshness rule is a product policy, not a universal event-validity guarantee. Fixture events are synthetic; this run did not research current real holidays, call a paid model or verify live recommendation quality/latency. Older plans are not backfilled. No scheduled posts, prices, budgets, provider permissions or live campaigns were changed. Local sync is not deployment. Full 410-requirement acceptance remains open.

## 17 November 2026 — focused offer assessment reaches the owner and later drafts

Traced owner facts/research and deterministic diagnosis → focused/starter task and schema → existing OfferAssessment lint/calculator → quality → saveStrategy and Convex schema → GoalWorkspace → planContentHash/decidePlan → approvedPlanContext/approvedPlanOfferTerms → existing draft checks. Detailed plans already carried the full assessment; the default schema dropped it, the default lint did not run it, and approved-term extraction read only detailed plays. Eight new cases failed before repair.

FocusedMove now optionally carries the existing full assessment. Primary promotion text in its summary/title/reason/preparation requires that assessment; ordinary recommendations and grounded/adjacent/bold exploration do not. Reused the existing alternatives, evidence, numeric-input, guardrail, capacity, history, risk, test and urgency validation. Mapped primary assessment errors to a hard quality rule, retaining exact field paths; a perfect AI review cannot grant approval. The writer/reviewer instructions describe the same contract. A new proposal can have different terms from an old approved offer, but prepared public copy must bind the intended one. Validation-first promotions stay internal briefs. No timing prompts, provider, agent or external action path were changed. Engine v3.107-focused-offer-assessment.

Existing saveStrategy parsing retains the nested field, with the existing typed offer validator reused in Convex. Inspection also found v3.106's optional prepared-copy offer binding absent from the database validator; it is now represented and verified through generation and reload. Approved-plan context now includes the focused assessment and handles persisted audience objects as well as legacy strings. Plan → Why this plan reuses OfferAssessmentPanel for contribution, alternatives, evidence, unknowns, capacity and the test. Existing saved records are not backfilled.

A separate red calculation case returned 100/95 contribution for empty cost arrays. Missing payment/delivery cost categories and applicable incentive costs now keep unit economics and horizon comparisons unknown, including private validation and older incomplete records. The horizon regression previously cast a partial fixture with a single unqualified all-costs line; it now uses the shared complete typed fixture with the same numeric totals. Arithmetic is unchanged when the required costs are explicit. These checks cannot establish that every real cost was disclosed.

Verification commands:

```sh
pnpm exec vitest run tests/unit/focused-offer-assessment.test.ts tests/unit/offer-assessment.test.ts tests/unit/offer-horizon.test.ts tests/unit/prepared-offer-terms.test.ts tests/unit/offer-disclosure-lint.test.ts tests/unit/approved-plan-context.test.ts tests/unit/focused-plan.test.ts tests/unit/plan-quality.test.ts tests/unit/design-guard.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-grounding.test.ts tests/convex/publish-flow.test.ts tests/convex/tenancy.test.ts tests/convex/approval-claims.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/approvedPlanContext.ts shared/agents/focusedPlan.ts shared/agents/focusedRubric.ts shared/agents/offerAssessment.ts shared/agents/specs.ts shared/agents/quality.ts convex/schema.ts src/components/app/plan/GoalWorkspace.tsx tests/fixtures/offerAssessment.ts tests/unit/offer-assessment.test.ts tests/unit/offer-horizon.test.ts tests/unit/focused-offer-assessment.test.ts tests/convex/focused-plan.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Final focused run: **186 tests across 14 files passed**. Workflow cases cover both focused and starter generation, exact persistence, approved terms unavailable before approval, tenant rejection, modified-price approval rejection, missing assessment/cost failures, validation-first approval without public-offer authority, and no campaign/action receipts. Unit cases also cover another diagnosed constraint, no-change, price/guardrail conflicts, capacity, unsupported urgency, new-versus-prior draft terms, unknown-cost display, horizons and preserved speculative alternatives. App/Convex typechecks, scoped lint and diff checks passed.

Browser: **2 desktop/mobile tests passed** (30.7 seconds), exercising the offer panel and calculated values, expandable tests/risks, existing strategy choices/learning, diagnosis, stable-view accessibility and overflow, and unchanged external-action records. Initial run expected decimal zeros that the existing money formatter omits; corrected the expectation. A later desktop run caught a contrast failure on an animating save notification; the test now waits for that notification to dismiss before auditing the stable review page. This does not certify transient toast accessibility. Inspected the mobile offer screenshot; fixed navigation/development chrome appears in the long element capture. The final cost-completeness change is covered by unit-render/horizon tests; the known-cost browser fixture is unchanged.

Limits: English mechanism detection and excerpt/number matching are bounded. Evidence labels remain supplied declarations; matching text does not establish semantic support or independent measurements. No paid real-model evaluation was run, so recommendation quality and the expanded starter response's actual cost/latency remain unverified. No historical assessment migration, new public-price editor, integration or live-account execution was added. Campaign timing was preserved. The broader 410-requirement acceptance audit remains open. Owner .gitignore edits remain untouched.

## 17 November 2026 — prepared public copy follows approved offer terms

Audit confirmed that prepared drafts already ran deadline/scarcity checks, but bypassed `lintApprovedOfferCopy`. A price from an unrelated fact could therefore pass general numerical evidence checks while contradicting the selected approved offer. Generic offer changes and validation-only offers likewise escaped this contract. A recognized money-back promise had no claim rule. Four of five new tests failed before repair.

PreparedWorkSchema now carries an optional exact approvedOfferPlayName. The following v3.107 audit found and added the missing Convex field validator; the initial v3.106 scope did not fully verify persistence of that optional field. Public prepared drafts reuse the existing price, discount, mechanism, audience, urgency and offer-selection validator; test_brief remains internal planning. The planning instructions describe that distinction. The shared claim checker recognizes money-back/refund-guarantee phrasing, requires affirmative eligible evidence and masks directly negated promises without masking a separate affirmative promise. The consequential refund check runs before softer unsupported-claim checks so another phrase cannot hide it. These are bounded English patterns, not complete interpretation of refund terms or guarantees.

A new actual focused workflow test revealed a second defect: the claim error stopped shipping but saved quality as provisional. Added the specific unsupported_refund_promise and approved-offer mismatch rules to hard plan quality, with plain-language explanations. The same test now saves failed quality and the existing approval mutation rejects the plan despite a perfect mocked AI review. No recommendation applies a price or discount, sends, publishes or spends. Engine v3.106-prepared-offer-terms.

Commands/results:

```sh
pnpm exec vitest run tests/unit/prepared-offer-terms.test.ts
pnpm exec vitest run tests/unit/prepared-offer-terms.test.ts tests/unit/offer-disclosure-lint.test.ts tests/unit/offer-assessment.test.ts tests/unit/focused-plan.test.ts tests/convex/focused-plan.test.ts tests/convex/publish-flow.test.ts tests/convex/tenancy.test.ts tests/convex/plan-grounding.test.ts tests/unit/plan-quality.test.ts tests/convex/approval-claims.test.ts tests/unit/claims-uplift.test.ts tests/unit/approved-plan-context.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/preparedWork.ts shared/agents/specs.ts shared/agents/offerLanguage.ts shared/agents/lint.ts shared/agents/focusedPlan.ts shared/agents/quality.ts tests/unit/prepared-offer-terms.test.ts tests/unit/offer-disclosure-lint.test.ts tests/convex/focused-plan.test.ts tests/unit/plan-quality.test.ts
git diff --check
```

Initial new-test run: **4 failed, 1 passed**. Intermediate workflow run: **1 failed, 121 passed**, exposing provisional quality. Final: **170 tests across 12 files passed**, including nine hard-quality rules, negative/future refund evidence, explicit denials, mixed denied/affirmative copy, unrelated prices, multiple offers, exact binding, internal proposals, generation/approval rejection and existing tenant/publication boundaries. App/Convex typechecks, lint and diff checks passed. No UI changed, so no browser run was needed. No paid model or hosted provider call occurred. A diagnostic tsx CLI command initially hit its sandbox IPC restriction; the same read-only probe ran successfully through node --import tsx without escalation.

Remaining limits: approved-term matching applies when terms are supplied; it does not manufacture a missing offer contract. Focused plans still lack the detailed path’s full structured promotion/economics assessment. Existing English term matching does not establish semantic equivalence, legal validity, actual refunds or commercial outcomes. Test briefs remain private proposals and convey no action authority. Historical plans were not migrated or re-reviewed. This is not whole-product acceptance. The owner’s pre-existing .gitignore edits remain untouched.

## 17 November 2026 — deterministic diagnosis reaches the default strategy workflow

Traced owner business facts/funnel → `jobContext`/`businessBrief` → `buildStrategy` style branch → agent input/review → `saveStrategy` → Plan review. Confirmed the detailed branch calculated and persisted a diagnosis, but starter/focused branches received only raw counts and did not save constraintDiagnosis. Two new actual-workflow tests failed with an undefined saved diagnosis before repair.

Extracted the unchanged detailed calculation into `strategyDiagnosis` inside jobs.ts and reused it for both default styles. The current input uses owner funnel, churn, remaining capacity, owner goal and existing profile sales-cycle/type interpretation. Its explanation now reaches writer and reviewer and the typed constraints; the trusted calculated object is attached after model generation and retained by existing persistence. The focused review criterion assesses the supported constraint or an evidence-supported alternative. Instructions keep uncertain/conflicting data provisional and preserve original adjacent/bold options. No new model, agent, provider or execution path. Engine v3.105-focused-diagnosis.

The existing Where you stand panel adds an expandable owner-data reading with observations, applicable reference text, immature sales-cycle warnings, qualification definition and competing explanation. It labels calculations as based on owner reports, distinct from independent measurement or proof of cause; existing missing-input/conflict guidance remains available. Existing saved plans without a calculated diagnosis are unchanged.

Commands/results:

```sh
pnpm exec vitest run tests/convex/focused-plan.test.ts -t 'carries deterministic diagnosis'
pnpm exec vitest run tests/convex/focused-plan.test.ts tests/convex/plan-grounding.test.ts tests/convex/channel-cache.test.ts tests/convex/tenancy.test.ts tests/unit/diagnosis-playbooks.test.ts tests/unit/focused-plan.test.ts tests/convex/plan-history.test.ts tests/unit/design-guard.test.ts
pnpm typecheck
pnpm exec eslint convex/jobs.ts shared/agents/focusedRubric.ts shared/agents/specs.ts src/components/app/plan/ExpertPlan.tsx tests/convex/focused-plan.test.ts e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Initial targeted run: **2 failed** on missing saved diagnosis. After repair: **97 tests across 8 files passed**, including both default styles, original 90-day leverage, writer/reviewer context, unknown evidence, zero capacity, conflicting legacy data, retained unproven bold options and no action receipts; existing plan-history, approval and tenancy checks pass. Typecheck/lint pass. Browser run initially failed because the new nested-details locator matched both parent and child; corrected the test selector. Final **2 desktop/mobile tests passed** (23.2 seconds), covering option selection/feedback without action authority, opening the diagnosis explanation, source/causality limits, accessibility and overflow. Inspected the mobile evidence screenshot; local development chrome remains visible. No full-suite rerun was needed for the focused passing scope.

Limitations: fixtures validate wiring and deterministic outputs, not live model adherence, causal diagnosis, representative business outcomes or source completeness. The calculator retains its existing reference assumptions and partial evidence model. No historic plans were backfilled. This does not add a semantic guarantee that generated strategy follows the diagnosis; that is assessed by the existing model reviewer. No paid model calls, hosted deployment, real publishing/sending or campaign actions occurred. The owner’s .gitignore changes remain untouched; the full 410-item acceptance audit remains active.

## 17 November 2026 — preserve the meaning of owner funnel counts

Audited requirement 3/10 through `PlanDetails` → `HelpClimbOS` → `workspace.setFunnel` → business record/job context → `jobs.diagnoseFor` → deterministic diagnosis and persisted plan. Backend schema/validation already supported custom periods, qualified-lead definitions, activation meaning and signup types. The active form omitted these and always resaved periodDays=30. An isolated desktop regression failed before the fix: an economics-only save changed 90 to 30 and removed qualifiedLeads, qualificationDefinition, activationKind and signupKind.

Extended the existing form using the OwnerFunnel type and shared labeled controls. It displays the actual measurement period, optional qualified leads/rule and activation/signup choices; unknown is explicit. It submits funnel data only after a funnel edit, so economics-only changes preserve even the original funnel timestamp. Clearing a qualified count intentionally removes its paired definition. Blank/invalid periods and missing qualification rules are checked before mutation; existing server count/order/permission rules remain. No new schema, model, prompt, provider or action path. Engine version is unchanged.

Verification:

```sh
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/owner-margin.spec.ts --project=desktop
pnpm exec vitest run tests/convex/plan-grounding.test.ts tests/convex/plan-history.test.ts tests/convex/tenancy.test.ts tests/unit/diagnosis-playbooks.test.ts tests/unit/design-guard.test.ts tests/convex/focused-plan.test.ts
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/owner-margin.spec.ts
pnpm typecheck
pnpm exec vitest run tests/convex/plan-grounding.test.ts
pnpm exec eslint src/components/app/plan/HelpClimbOS.tsx e2e/owner-margin.spec.ts tests/convex/plan-grounding.test.ts
git diff --check
```

The initial desktop run failed on the exact metadata loss. After repair: **73 focused tests across 6 files passed**; **2 desktop/mobile browser tests passed** (27.9 seconds), covering unchanged funnel on economics saves, retained 90-day definitions on count edits, blank-period rejection, explicit 60-day changes, intentional qualification removal, activation selection, reload persistence, accessibility, overflow and unchanged external-action records. Inspected the mobile screenshot. App/Convex typechecks and scoped lint passed. The generation test was then strengthened to require a saved monthly purchase leverage of 0.04 from 12 activated people over 90 days; all **7 tests** in that file passed again. The preceding full-suite baseline (3,011 tests) predates this UI increment; it was not rerun for this bounded change.

Limits: these counts and definitions remain owner reports, not independently validated cohorts. This does not recover definitions already overwritten, add optimistic concurrency to the funnel mutation, make economics/funnel saves one atomic operation, or change the unused legacy FunnelNumbers export. No real model calls, hosted deployment, external publication, sends or campaign actions occurred. The owner’s pre-existing .gitignore changes remain untouched.

## 17 November 2026 — full regression reconciliation and shared form controls

A full `pnpm exec vitest run` found 6 failing tests across 5 files (3,002 passed). Inspection separated stale assertions from two design-system violations. Campaign display tests still asserted that no spend monitoring existed despite the separately approved monitor; the stale-fact test expected earlier wording; the persistence test rejected a negative contribution margin that the current owner-economics contract intentionally permits. The metric-health fixture bypassed payment ingestion and therefore lacked the current payment-only billing provenance. These tests now check the current contracts without relaxing runtime validation or approval controls. Persistence coverage also explicitly accepts zero and negative margins while rejecting a margin above 100%. The revenue test now ingests dated refund events through the actual deterministic daily-materialization path.

Replaced the native cost-coverage select in `SharpenPlan` and the native reporting-date input in `WeeklyReportEditor` with the existing labeled Select and DatePicker. Preserved unknown costs, currency precision, UTC reporting weeks, date bounds, disabled states and stale-edit protection. Browser tests now select the actual shared controls rather than filling native inputs. No schema, calculation, prompt, provider, model route or execution permission changed; engine version remains v3.104.

Verification:

- `pnpm exec vitest run tests/convex/metric-health.test.ts tests/unit/design-guard.test.ts tests/unit/campaign-money-display.test.tsx tests/unit/evidence-kind-platform.test.ts tests/unit/agents/growth-plan-persistence.test.ts tests/convex/crm-payment-evidence.test.ts tests/convex/tenancy.test.ts tests/convex/play-result-history.test.ts tests/convex/segment-economics.test.ts` — **62 passed across 9 files**.
- `pnpm exec vitest run` — **3,011 passed across 403 files**, 99.76 seconds. This includes existing permission and authorization suites. Log: `/private/tmp/climbos-regression-fixed-20261117.log` (local, not a portable repository artifact).
- `pnpm typecheck` — app and Convex passed.
- `pnpm exec eslint src/components/app/plan/SharpenPlan.tsx src/components/app/plan/WeeklyReportEditor.tsx tests/convex/metric-health.test.ts tests/unit/agents/growth-plan-persistence.test.ts tests/unit/campaign-money-display.test.tsx tests/unit/evidence-kind-platform.test.ts e2e/play-result-money.spec.ts e2e/segment-economics.spec.ts` — passed.
- `CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync` — isolated loopback backend only.
- `E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/play-result-money.spec.ts e2e/segment-economics.spec.ts` — **4 passed**, desktop and mobile, 51.0 seconds. Checks cover historical reporting/corrections, money precision, unknown costs, saved cost coverage, accessibility and horizontal overflow, plus unchanged external-action records. Inspected the mobile customer-group screenshot.
- `git diff --check` — passed.

Limits: these results establish the current automated baseline and the two inspected form workflows, not completion of all 410 requirements, broad expert-level recommendation quality, production performance or live-provider readiness. No paid model calls, hosted deployment, customer messages, publications or campaign actions occurred. The owner's pre-existing `.gitignore` changes remain untouched.

## 17 November 2026 — recent social reports independent of calendar slots

The prior post-results increment created a working report path but selected planning history only through recent calendar slots. Two new regressions failed: a manually prepared post and a post whose slot was more than 28 days old both produced empty planning history after a fresh report. This contradicted the intended outcome-learning path even though the report itself was saved correctly.

Extended `autopilot.planningContext` using the existing `postMetrics.by_org_captured` index. It reads up to 121 recent nonfuture report rows and slots to detect overflow, considers at most 120 of each, and gives report candidates first use of the existing 12,000-character whole-record budget. Each post is resolved once through `latestPostResult`; invalid newer evidence still cannot revive a prior observation. Missing/foreign artifact references are withheld. Latest exact-version body text is supplied with a 1,200-character labeled excerpt limit, while media and historical audience exposure remain unassessed. A matching recent slot supplies its original intent; otherwise intent/audience remain unknown. Each record uses the existing untrusted-data wrapper. Review rejections distinguish matching from earlier/unmatched versions and remain preferences, not performance evidence. Owner UI wording now describes this expanded but bounded selection.

Commands and results:

```sh
pnpm exec vitest run tests/convex/post-results.test.ts tests/convex/autopilot.test.ts tests/convex/calendar-trend-evidence.test.ts tests/convex/research-context.test.ts tests/convex/tenancy.test.ts tests/convex/publish-flow.test.ts tests/unit/post-results.test.ts
pnpm exec vitest run tests/convex/post-results.test.ts tests/convex/autopilot.test.ts
pnpm typecheck
pnpm exec eslint convex/autopilot.ts shared/agents/specs.ts src/components/app/content/detail/PostResultsPanel.tsx tests/convex/post-results.test.ts e2e/post-results.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/post-results.spec.ts
git diff --check
```

**123 tests passed across seven files.** The two directly affected suites were rerun after the final reviewer-label clarification and passed. Added coverage includes manual/older posts, exact body context, corrections and duplicate slot references, report-row limits, exclusion of foreign post references and old/future report candidates, and prioritization over a full unreported calendar history. The actual `jobs.planSocialWeek` generation-boundary test now verifies an unlinked manual report reaches its input without an action receipt. Typecheck and targeted lint passed. **Two desktop/mobile browser checks passed in 13.1 seconds**, exercising the updated explanation and the existing record/correct/reload/history workflow, zero/unknown distinctions, action-table immutability, no horizontal overflow and no serious/critical automated accessibility findings. No full accessibility conformance or real model quality is claimed.

Limits: the independent candidate window follows report capture time, not publication time; historical measurement dates stay attached. Corrections can fill the 120-row read budget, and 12,000 characters can omit complete records; both limits are disclosed. Current exact-version validation, member-report provenance and no-causal-inference caveats remain. This is not complete all-time learning, provider metric syncing, automatic platform history ingestion, media analysis or continuous social listening. Existing calendar drafting and approval controls remain unchanged. No new provider, agent, dependency or live external action. Engine `v3.104-reported-social-learning`; full project completion remains unproven.

## 16 November 2026 — reuse channel scoring without treating proposals as observations

The preceding increment reproduced a pre-existing failure in the unchanged-input replan test on both current code and an archive of `da261294`. Traced `orgs.generatePlan` → `jobWrites.jobContext` → `playResults.resultsBrief` → `jobs.businessBrief` → channel input hash/scorer → saved acquisition profile. Diagnostic capture showed the second plan's new history consisted only of unreported proposals, including fresh plan/play identities and creation dates. Those changed the business brief despite no new outcome or owner input.

The existing results reader now derives full and report-bearing briefs from one bounded database read. Full strategy context retains unreported proposals and unknown outcomes. The channel scorer and cache key both receive the report-bearing variant; merely normalizing the hash while supplying different model inputs was avoided. Records with actual entries or summary issues are retained, as are experiment outcomes, CRM associations and owner feedback. No new cache, provider, agent or execution permission was introduced. Current research still runs/reuses its own existing mechanism before channel-cache eligibility is evaluated. The six-hour TTL, matching goal, library and current input hash requirements remain intact.

Verification:

```sh
pnpm exec vitest run tests/convex/channel-cache.test.ts tests/convex/plan-speed.test.ts tests/convex/strategy-evidence.test.ts tests/convex/play-results.test.ts tests/convex/play-result-history.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/research-context.test.ts tests/convex/tenancy.test.ts
pnpm exec vitest run tests/convex/play-result-learning.test.ts tests/convex/play-result-coverage.test.ts
pnpm typecheck
pnpm exec eslint convex/jobs.ts convex/jobWrites.ts convex/playResults.ts shared/agents/specs.ts tests/convex/channel-cache.test.ts
git diff --check
```

The first group passed **53 tests across eight files** and the second passed **21 tests across two files**: **74 total**. Typecheck, targeted lint and whitespace checks passed. The original `plan-speed` test is unchanged and now passes. Seven new workflow tests cover unchanged reuse, preserving full unknown history, adding an owner report, reusing that unchanged report, owner economics/preferences/feedback, changed research and expiry. Existing tests retain goal-change, evidence, result-history, invalid-summary and tenant checks. Test model calls are synthetic; no live provider/model call or external action was made. No Next.js/UI code changed and no browser suite was run for this backend-only increment.

Limits: reduced scoring calls are established in fixtures, not measured production latency, credits or total cost. Other meaningful context changes may correctly invalidate reuse; research and strategy writing still execute their existing workflows. The prior wider-suite run was interrupted, so this is not an all-tests-green claim. Full requirement acceptance and real strategy quality remain unproven. Engine `v3.103-channel-evidence-reuse`.

## 16 November 2026 — exact-post observation reports and weekly planning

Audit traced the existing postMetrics table → autopilot.planningContext → jobs.planSocialWeek generation input and the published-content detail screen. The table had no production report writer. Its planner reader selected insertion-order metrics without a measurement window, content-version identity or source caveat, and the oldest 120 slots could hide recent work while future slots were not excluded. The research step already receives audience/business/brand context; no duplicate context pipeline was added.

Implemented in `shared/growth/postResults.ts`, `convex/lib/postResults.ts`, `convex/postResults.ts`, schema, the existing Autopilot reader and content detail panel. Reports bind to the current published social artifact version/hash and workspace; source is server-assigned member report or synthetic demo. Completed local dates use deterministic timezone conversion, including DST, with a 366-date bound. Blank and explicit-zero measures differ; negative, fractional or unsafe counts fail. A measurement method/definition is required. Appending corrections retains prior reports and rejects stale expected report IDs. Latest incompatible, future, foreign, fixture-in-real-workspace or legacy observations are withheld rather than replaced with older evidence. No report write creates approvals, artifacts, workflow runs or action receipts; it records an audit event. A failing export regression preceded adding bounded report export and batched workspace deletion.

Weekly planning evaluates the newest 120 past slots within 28 days, deduplicates post references, retains complete observation records within 12,000 characters and states omissions. It carries qualified outcomes separately from impressions/interactions, with source, dates, methods, unknowns and non-causal limits. A mocked-generation-boundary test confirms the actual calendar job receives these values; this is not a paid model-quality evaluation. Owner corrections preload the latest compatible report. History is paginated; record times and content version remain visible. Errors remain inline without discarding form values.

Commands and results:

```sh
pnpm exec vitest run tests/unit/post-results.test.ts tests/convex/post-results.test.ts tests/convex/autopilot.test.ts tests/convex/tenancy.test.ts tests/convex/publish-flow.test.ts tests/convex/calendar-trend-evidence.test.ts tests/convex/research-context.test.ts tests/convex/experiment-outcomes.test.ts tests/convex/play-result-history.test.ts
pnpm typecheck
pnpm exec eslint shared/growth/postResults.ts convex/lib/postResults.ts convex/postResults.ts convex/autopilot.ts convex/schema.ts convex/settings.ts shared/agents/specs.ts src/components/app/content/detail/PostResultsPanel.tsx 'src/app/app/[organization]/content/[artifactId]/page.tsx' tests/unit/post-results.test.ts tests/convex/post-results.test.ts e2e/post-results.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/post-results.spec.ts
git diff --check
```

Results: **135 tests passed in nine files**, typecheck and targeted lint passed, and **two desktop/mobile browser checks passed in 10.2 seconds**. Browser checks exercised record → correction → reload → history, zero/unknown distinctions, unchanged action tables, no horizontal overflow and no serious/critical automated accessibility findings. A mobile screenshot was visually inspected; automated checks are not full WCAG conformance. The first browser attempt used an incorrect button selector for calendar gridcells and was stopped after its confirmed timeout; corrected checks passed. The local sync regenerated `convex/_generated/api.d.ts` through the established workflow. No deployed service or live external account was used.

Separate failure: an initial `pnpm test -- ...` invocation unintentionally selected the wider suite and was interrupted. The channel-cache test `tests/convex/plan-speed.test.ts` → “reuses channel scoring on a re-plan when nothing changed, and scores again for a new goal” failed with second-plan scoring steps 2 instead of 0. Running that test explicitly reproduced the same failure on the current tree and an isolated archive of unchanged commit `da261294` (after including its required documentation assets). This pre-existing failure remains open; the wider suite was not completed or claimed green.

Limits: observations are member reports, not verified customers, attribution or causal lift. Reports on posts outside recent calendar-linked slots do not reach this weekly context. One latest report is used per post; windows are not summed, complete history is not learned, and unversioned legacy records are not migrated. Export retains at most 1,000 latest reports with an explicit limit flag. No provider metric sync, continuous social listening, new agent or paid model call was added. Full 410-requirement acceptance and production provider readiness remain unproven. Engine `v3.102-social-post-observations`.

## 16 November 2026 — calendar trend evidence and complete draft context

Audit traced `planSocialWeek` → social calendar schema/lint → `autopilot.saveWeekPlan` → saved slots → `startDrafts` → `createContent` → individual-post validation → existing owner review/approval. Brand, humor and trend preferences already reach shared business context. Individual posts already require a dated matching observation; calendars previously accepted a source URL and an unknown-date note. Five failing cases reproduced missing, conflicting and stale evidence acceptance. The calendar's scheduler brief also passed through the 1,500-character owner-request cap, losing later slot instructions.

Calendar slots now carry optional structured trend evidence, use the same matching-source/date/observation validator, and are validated again before persistence. Freshness is checked against the actual local slot timestamp under the existing 30-day policy. Failed saves roll back without replacing prior slots. The retrieval timestamp comes from the engine research result, not model output. The existing Regular posting source disclosure displays observation date, retrieval time, exact URL, observation and audience-fit limitation.

The real drafting job now loads at most six ordered slots for its exact run, tenant and channel. A mismatch, excessive count or context above 30,000 characters is rejected rather than partially delivered. This context bypasses only the short owner-request truncation; it grants no action authority. Prior trend sources are labeled as inspiration and supplied to the same bounded research step for rechecking. A missing current signal calls for an evergreen treatment. Generated calendar URLs do not become owner-supplied URLs. Existing research call budgets, paid usage accounting, approval requirements and final publishing guards remain unchanged.

Commands and results:

```sh
pnpm skills:build
pnpm exec vitest run tests/unit/calendar-trend-evidence.test.ts tests/unit/social-intelligence.test.ts tests/unit/trend-freshness.test.ts tests/unit/trend-evidence-note.test.ts tests/convex/calendar-trend-evidence.test.ts tests/convex/research-context.test.ts tests/convex/autopilot.test.ts tests/convex/social-publish.test.ts tests/convex/calendar-awaiting-review.test.ts tests/convex/tenancy.test.ts
pnpm typecheck
pnpm exec eslint convex/autopilot.ts convex/jobs.ts convex/schema.ts shared/agents/specs.ts 'src/app/app/[organization]/autopilot/page.tsx' tests/unit/calendar-trend-evidence.test.ts tests/convex/calendar-trend-evidence.test.ts tests/convex/research-context.test.ts e2e/calendar-trend-evidence.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/calendar-trend-evidence.spec.ts
git diff --check
```

**69 tests across 10 files passed** (3.21 seconds). After the final generated-link source-classification change, the two affected backend suites passed again (14 tests). **Two desktop/mobile browser checks passed** (8.4 seconds), exercising source/date disclosure with no new artifacts, approvals, receipts or workflow runs. No horizontal overflow or serious/critical automated accessibility violations occurred in those tested states; this does not prove full accessibility conformance. The mobile card capture was inspected. Typechecks, scoped lint and diff checks passed. Runtime skill compilation updated the established generated bundle.

Limits: matching a research note is not independent semantic verification of its source. Audience fit, originality, humor appropriateness and commercial effect still require model/owner evaluation. A dated observation inside 30 days is not proof that a trend remains popular. Legacy slots without structured evidence remain unmodified; their notes do not acquire verified dates. This adds no continuous listening feed and performs no live-account publishing or paid model evaluation. Engine `v3.101-calendar-trend-evidence`; full product completion remains unproven.

## 16 November 2026 — zero and negative owner margins

The existing paid-channel guard recognized non-positive owner margins, but the real owner path could not supply them: both forms and the mutation rejected them, the override ignored them, zero disappeared from generation context, and the calculator treated losses as invalid. Eight focused failures reproduced this mismatch before repair. The existing path now retains signed contribution margins (including below -100%) and zero churn, labels them as owner inputs, validates finite values and coherent ranges, and supplies them to focused/starter generation. No new agent, provider, dependency or campaign-timing prompt change.

Deterministic contribution preserves negative values; acquisition allowances and break-even acquisition prices are unavailable for negative customer value. Payback with 100% monthly churn uses only first-month contribution. The growth-cash adverse scenario uses P90 customers when customer contribution is negative, because more customers deepen losses; nonnegative contribution retains P10. The owner UI and strategy cash line identify that distinction. Source concentration retains signed modeled contribution and withholds unrepresentable totals without discarding recorded source observations. These are cost-boundary-dependent calculations, not net profit or a bank-balance forecast.

Verification: **117 focused tests across 11 files passed** (1.93 seconds), including real saved owner input → paid-channel blocking, signed ranges, invalid/nonfinite input rejection, tenant/viewer restrictions, no new action/approval/workflow records, loss arithmetic, cash scenarios, output labels and the actual focused/starter generation boundary. Generation tests stop at a mocked model boundary; they are not real-model quality evidence. **Two desktop/mobile browser tests passed** (22.9 seconds): both forms save negative/ranged/zero margins, zero churn survives reload, replacing a range with a point removes the old range, and saving starts no workflow or external action. Checks found no horizontal overflow or serious/critical automated accessibility violations in that tested state; this is not full accessibility conformance. The mobile input capture was inspected. App and Convex typechecks, scoped ESLint and `git diff --check` passed.

Commands:

```sh
pnpm exec vitest run tests/unit/play-economics.test.ts tests/convex/unsure-economics.test.ts tests/unit/growth-calc.test.ts tests/unit/decision-voi.test.ts tests/unit/growth-cash-timing.test.ts tests/unit/growth-cash-timing-panel.test.tsx tests/unit/channel-limits.test.ts tests/unit/attribution.test.ts tests/convex/research-context.test.ts tests/convex/tenancy.test.ts tests/convex/growth-cash-timing.test.ts
pnpm typecheck
pnpm exec eslint convex/jobs.ts convex/workspace.ts shared/agents/economics.ts shared/agents/specs.ts shared/agents/voi.ts shared/attribution/platformConcentration.ts shared/growth/calc.ts src/components/app/plan/GrowthCashTiming.tsx src/components/app/plan/HelpClimbOS.tsx src/components/app/plan/SharpenPlan.tsx tests/convex/unsure-economics.test.ts tests/convex/research-context.test.ts tests/unit/play-economics.test.ts tests/unit/growth-calc.test.ts tests/unit/growth-cash-timing-panel.test.tsx tests/unit/attribution.test.ts tests/unit/decision-voi.test.ts e2e/owner-margin.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/owner-margin.spec.ts
git diff --check
```

Remaining limits: owner figures and included cost boundaries are not independently verified; observed zero churn is not evidence of zero future churn. Unknown retention still prevents a full customer-value/payback estimate even when non-positive margin already blocks paid acquisition. Existing saved plans are not rewritten and the owner must explicitly refresh to generate a new plan. No live account, paid model call or production deployment was exercised. Engine `v3.100-nonpositive-owner-margin`; the full 410-requirement and later-addition audit remains open.

## 16 November 2026 — customer-group cost evidence

Nine failing regression cases reproduced inferred complete cost coverage, non-finite arithmetic with missing/invalid inputs, two-decimal rounding of KWD and silent missing/invalid currency use. The owner form additionally coerced blank revenue and costs to zero. This affected the existing path from Plan details → `workspace.setUnitEconomics` → saved business economics → `segmentEconomicsBrief` → strategy generation. Focused plans without detailed plays also hid this editor.

The existing segment contract now permits unknown revenue and variable-cost totals, and has an optional explicit complete/incomplete/unknown cost-coverage declaration. Blank fields stay absent; explicit zero stays zero. Older rows without coverage remain unknown unless they list missing costs (incomplete). Complete coverage requires a cost total and no listed unknown costs. This is an owner declaration for the named boundary, not independent verification or net profit. Negative net revenue after refunds is retained; non-positive revenue has no contribution-margin percentage.

The same input checks run on save and before deterministic calculation. Unknown currency is never replaced with the workspace currency; unsupported currency/precision, invalid counts/periods and conflicting coverage withhold calculations and explain the issue. Money differences use the existing currency minor-unit helpers, including zero- and three-decimal currencies. UI money uses exact minor-unit formatting; per-customer averages are rounded and labeled. The shared strategy brief selects whole records within its budget and retains missing-cost, currency, comparison and no-execution caveats. The focused/starter generation regression inspects the actual input without a paid model call. Engine version: `v3.99-segment-cost-evidence`.

The existing optional editor is available in focused plan details even without detailed plays. It does not invent a period, cost boundary or zero total; owners choose cost coverage separately. No new agent, integration, model route or external action is introduced. Existing tenant/editor checks and economics audit logging remain in effect. Stored legacy totals are not rewritten, because old explicit and accidentally zero-filled amounts cannot be distinguished reliably.

Commands:

```sh
pnpm exec vitest run tests/unit/segment-economics.test.ts tests/convex/segment-economics.test.ts tests/convex/research-context.test.ts tests/convex/unsure-economics.test.ts tests/convex/tenancy.test.ts
pnpm typecheck
pnpm exec eslint shared/agents/segmentEconomics.ts shared/agents/economics.ts shared/agents/specs.ts convex/workspace.ts convex/schema.ts src/components/app/plan/SharpenPlan.tsx 'src/app/app/[organization]/plan/PlanDetails.tsx' tests/unit/segment-economics.test.ts tests/convex/segment-economics.test.ts tests/convex/research-context.test.ts e2e/segment-economics.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/segment-economics.spec.ts
git diff --check
```

Results: 41 tests passed in five focused files (1.99 seconds); app and Convex typechecks and scoped ESLint passed. Local Convex sync completed. Both desktop/mobile browser checks passed (24.9 seconds), including saving/reloading unknown totals, KWD precision, explicit coverage, rejection of contradictory coverage, serious/critical axe checks, horizontal-overflow checks and unchanged action records. Screenshots were visually reviewed. Initial browser setup failed on an extra fixture field, then an exact label selector timed out; the fixture was corrected to the existing persisted schema and the selector to the observed accessible combobox name. `git diff --check` passed.

Limits: owner-entered aggregates, not connected customer-level segment accounting; dates/cohort identity and cost completeness are not independently verified. Equal duration does not establish comparable observation windows. No exchange-rate conversion, automatic group exclusion, full-profit conclusion or causal/long-term value claim. Context remains bounded. Existing plan text requires a new reviewed plan; historical amounts are not retrospectively corrected. The source prompt is still absent from its historical Downloads path; this work maps to the retained specification and audit rows, not a fresh reading of that attachment. Full requirement completion and real-model/business effectiveness remain unproven.

## 16 November 2026 — original-attempt publishing results and recovery

Six failing regressions established that result writers could settle another tenant's artifact, overwrite a known result with a late callback, overwrite newer content, recover through a replacement account, treat an empty recent-feed sample as proof of failure, and accept mismatched content for a known post ID. The prior final-send claim checks remain intact.

New send receipts freeze the exact artifact version/hash, approval/hash, channel, connection/account and fixture state. The first provider result is retained separately from later resolution. Result writers check receipt/tenant/artifact identity, preserve terminal outcomes and first callbacks, and update the current artifact only when its original binding still matches. Results for superseded content remain on the old receipt and are audited. Repeated settlement does not repeat notices, trust changes or publication events.

Recovery now reads only a saved provider post ID using the frozen original version/account. Missing identity, container-only Instagram results, legacy receipts, inaccessible/missing posts and conflicting observations remain uncertain. Recent-feed searches no longer establish failure or unlock a retry. Existing LinkedIn, X, Facebook Page and Instagram read adapters are reused; exact returned ID and text/caption must match. LinkedIn additionally needs matching author and published lifecycle; X needs matching author. Connection and credential identity are checked again after the read. A read confirming an older version can update that receipt without changing newer work. The read checks content/identity, not every image, visual detail or delivery outcome.

Owners/admins/reviewers can use **Check provider result** on the existing uncertain-post panel when the original live account and post ID are available. The action checks tenant access and exact displayed attempt/version/approval before reading, and current requester permission before recording confirmation. It cannot send or retry. Manual posted/not-posted reports now bind one exact receipt, current version and approval, preserve other attempts, record explicit owner provenance and retain the earlier summary. An interrupted request without a recorded first result has a five-minute minimum review delay; this is a safety interval, not proof the provider operation ended. Legacy receipts retain an explicit unknown-account warning and a version/key-bound manual path; no identity is silently reconstructed. Stale and cross-tenant confirmations are rejected.

The detail page and activity timeline distinguish owner reports from provider verification; shared published status now says Recorded as posted rather than claiming all published rows were accepted by a platform. Earlier result and resolution time remain visible. Known legacy owner-confirmation summaries are labeled as owner reports without altering their stored evidence or inventing dates. Mobile visual inspection caught the misleading old header badge and prompted the final label regression. Final review also removed the unsupported platform-rejection claim for owner-reported non-publication; both outcomes now have desktop/mobile checks.

Verification commands:

```sh
pnpm exec vitest run tests/convex/publish-recovery.test.ts tests/convex/publish-flow.test.ts tests/convex/social-publish.test.ts tests/convex/autopilot.test.ts tests/convex/platform-connections.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/autopilot.test.ts
pnpm typecheck
pnpm exec eslint convex/content.ts convex/lib/approvals.ts convex/publish.ts convex/schema.ts src/components/app/roles.ts src/components/app/content/detail/UncertainPanel.tsx src/components/app/content/detail/PublishPanel.tsx src/components/app/content/detail/HistoryPanels.tsx tests/convex/publish-recovery.test.ts e2e/publish-recovery.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/publish-recovery.spec.ts
git diff --check
```

Results: 167 tests passed in nine focused files (5.91 seconds); app and Convex typechecks and scoped ESLint passed. Local Convex sync completed. Four desktop/mobile browser checks passed (19.5 seconds), covering both posted and not-posted owner reports. `git diff --check` passed. Coverage includes exact-ID read-back for all four adapters with HTTP mocked; changed account, secret and requester during the read; wrong ID/author/lifecycle/text and 404; superseded content; terminal callbacks; current and legacy manual reporting; stale bindings and viewer/foreign-tenant permissions. Browser coverage uses synthetic legacy receipts on the isolated loopback backend, confirms that only the selected receipt changes, with the original approval consumed only for a posted report, and checks owner labels, earlier-summary retention, page overflow and serious/critical axe findings. The read-action permission/provider behavior is exercised in backend tests, not a live browser-connected account.

Limits: no hosted deployment, live provider request, paid model call or new provider integration. Exact text matching can leave transformed/shortened-link content unresolved; absent identity and container-only results require manual investigation. Provider access and read permissions still depend on the account. Original write adapters and all media/placement verification have not been comprehensively re-audited here. Owner statements are declarations, not independent proof; a five-minute delay cannot guarantee a stalled operation will never finish. Once an outcome is resolved, duplicate/late callbacks do not replace it; independently conflicting later evidence needs separate owner investigation. Full production readiness, business effectiveness and the 410-requirement completion audit remain unproven.

## 16 November 2026 — final social-publishing authorization claim

Eight regressions first demonstrated that `beginReceipt` created a send intent after approval revocation, workspace pause, policy change, approver demotion, connection revocation, provider-account change, scope removal or package expiry. Earlier executor checks preceded asynchronous token/link preparation and did not protect this final transaction.

The existing artifact decision now binds the external provider account as well as connection, content, destination, schedule and policy. Legacy approvals without the current account identity require a new owner decision; the existing content query and review controls expose the reason. No account identity is silently backfilled. At the atomic send claim, the executor now checks exact tenant/business/version/approval identity, canonical attempt/provider/action, approval hash/status/expiry/scope, current policy and emergency stops, current publishing entitlement, approver and explicit requester permissions, connected account identity/capability/scopes/expiry, prepared credential identity, trend freshness and business evidence. Automatic approvals additionally require current enabled/eligible Autopilot, channel inclusion, the matching scheduled auto-routed slot, current mode/trust/topic/planner checks and Bounded Autopilot policy. The original routing review and first-post gates remain upstream; this reuses current routing rules rather than generating another approval.

Credentials are read before the claim and held for that attempt. The internal secret query supplies its row identity, so replacement in the same millisecond is detected without relying only on a timestamp. Account and token are not reselected after authorization. The intent and artifact's sending state are written together, preventing edits/rescheduling after the claim. Refusals are bound to the prepared artifact version, approval hash, status and schedule, and cannot overwrite newer work or an already claimed attempt. Future scheduled posts are left untouched until due. Existing provider adapters, idempotency and owner-facing error/reapproval surfaces are reused; there is no new provider, agent, schema migration or model change.

Commands:

```sh
pnpm exec vitest run tests/convex/publish-flow.test.ts tests/convex/social-publish.test.ts tests/convex/autopilot.test.ts tests/convex/platform-connections.test.ts tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/autopilot.test.ts
pnpm typecheck
pnpm exec eslint convex/publish.ts convex/lib/approvals.ts convex/connections.ts tests/convex/publish-flow.test.ts tests/convex/social-publish.test.ts
git diff --check
```

Results: 139 tests across eight files passed (4.93 seconds). The eight original failing cases now pass both at the mutation boundary and during the actual executor's mocked public-link read, with zero social-provider writes and zero send receipts. Additional cases cover legacy account approval and reapproval, secret rotation with an unchanged timestamp, replaced/edited/rescheduled work, a concurrent worker's late refusal, changed automatic authority, foreign tenant resources/requesters, invalid action/key, expired approval, future schedule, atomic edit locking duplicate attempt reuse, and malformed or unreadable credentials returning to review without a send. Existing LinkedIn/X mock-provider and fixture Autopilot positive paths pass. The content query exposes the legacy-account review reason and approver access. App and Convex typecheck, scoped lint and whitespace checks passed. No browser/UI code, hosted deployment, real provider action or paid model call was involved.

Limits: authorization is checked at the transaction that claims execution. It cannot recall a provider request already started; multi-step media adapters are not made cancelable between every provider request by this increment. OAuth scopes use the existing integration registry, not a new assertion of provider access or current commercial eligibility. Fixture acceptance is simulated. Historical receipt settlement/reconciliation still needs a separate audit for original-attempt identity and late callbacks; this change protects the pre-send refusal path, not every post-send result path. No production readiness, live-account validation or completion of all 410 requirements is claimed.

## 16 November 2026 — current business evidence at approval and publishing

Revalidated requirements 21–25 along the business-fact → job-context → drafting/review → approval → publishing path. Failing regressions demonstrated that future/non-finite confirmation timestamps were treated as fresh, and a positive capability fact could support approval despite a contradictory confirmed fact. Reads capped before filtering also let retired history hide newer facts. These are confirmed gaps; the broad semantic-evidence requirements remain partial.

Implemented:

- Invalid/future confirmation dates now yield an unknown age and require review. They are excluded from current job/approval evidence and remain explicitly unknown in model-facing text. The existing owner reconfirmation action supplies a new actual timestamp. Valid legacy records still use `updatedAt` when `verifiedAt` is absent; no historical verification is invented.
- Added `businessFacts.by_business_state_updated` and one shared tenant-checked active-fact reader. Planning reads up to 200 recent records in each active review state, then retains the existing 40 current/40 review-needed context limits with a coverage warning. The facts page reads up to 300 per state and discloses a capped view. Rejected history no longer consumes these slots. Source/history records remain intact. Other fact readers and duplicate-review operations have their existing bounds; this is not a whole-repository full-history migration.
- Artifact claim checks require complete coverage within 200 confirmed and 200 edited records; exceeding either bound requires owner review/removal of outdated or duplicate records before approval. The existing narrow price/trial/feature conflict detector runs without its six-item display cap at this boundary. Conflicted facts cannot independently support known capability/urgency claims. Recognized current copy terms are compared sentence by sentence against saved facts. Separately evidenced former-price wording is left to the existing reference-price check. Unrelated plain copy and separate monthly/yearly terms are preserved.
- App approval, approval email links and Autopilot reuse that checker. The social publishing executor now checks it after approval and again in the transaction that creates the send-intent receipt, before a provider write. A changed version/approval binding or unavailable version blocks that intent too. Previously attempted receipts retain their idempotent/reconciliation behavior. This does not authorize any new action or replace the existing approval/policy checks.

Engine version: `v3.98-current-fact-evidence`. The local Convex sync regenerated only the normal API module registration for `convex/lib/businessFacts.ts`.

Verification:

```sh
pnpm exec vitest run tests/unit/fact-freshness.test.ts tests/convex/approval-claims.test.ts tests/convex/siteWatch.test.ts tests/convex/fact-reconfirm.test.ts tests/convex/custom-agents.test.ts tests/convex/social-publish.test.ts tests/convex/publish-flow.test.ts tests/convex/autopilot.test.ts tests/convex/plan-grounding.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/unit/claims-uplift.test.ts tests/unit/plan-evidence-links.test.ts
pnpm typecheck
pnpm exec eslint convex/lib/businessFacts.ts convex/lib/claimCheck.ts convex/jobWrites.ts convex/jobs.ts convex/publish.ts convex/siteWatch.ts convex/schema.ts shared/agents/factFreshness.ts shared/agents/conflicts.ts shared/ai/tasks.ts 'src/app/app/[organization]/settings/facts/page.tsx' tests/unit/fact-freshness.test.ts tests/convex/approval-claims.test.ts tests/convex/custom-agents.test.ts tests/convex/social-publish.test.ts e2e/business-fact-evidence.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/business-fact-evidence.spec.ts
git diff --check
```

Results: 126 tests across 13 files passed. Both browser checks passed in 12.0 seconds. Typecheck, scoped lint, diff checks and isolated local schema sync passed. Regression coverage includes invalid/future dates, unchanged reconfirmation, contradictory capability evidence, current price conflicts, separately supported former prices, billing periods, more than six conflicts, 305 rejected records before new facts, capped active evidence, foreign-tenant supporting rows, planning-context exclusion and a fact changed after approval. The executor test recorded no provider requests and no send receipt for the changed-evidence case. Browser checks verified persistence, no approval/artifact/workflow/receipt changes, no page overflow and no serious/critical axe findings. The mobile capture was inspected; these checks do not prove full accessibility.

Limits: deterministic patterns are narrow English checks, not complete semantic truth, general entity resolution, or independent fact verification. Unrecognized wording and complex historical/conditional clauses still need owner review. A matching price alone does not verify all offer terms; existing approved-offer controls remain separate. View/model samples are bounded, and active-fact overflow deliberately blocks the checked approval path. This increment does not audit every outbound, advertising, billing or live-provider execution path. No real provider operation, paid model call, hosted deployment or model switch occurred. The 410-requirement completion audit and real-world recommendation quality remain unproven.

## 16 November 2026 — traceable strategy feedback selection

Audit confirmed that creative feedback was fetched by plan ID before report time, repeated updates to one option could all enter learning, and the inspection query marked more reports used than generation received. Original option/test conditions were not included in the learning brief. Rejection freshness used plan creation rather than the actual owner decision.

The existing feedback table now retains an optional exact option snapshot for new reports, using the existing option validator. A shared read-only selection powers both owner inspection and the strategy job context. It selects the latest report per plan/mode before eligibility filtering, so retiring the latest does not revive an older observation. A new report-time index retrieves recent feedback independently of plan age; a strategy-rejection decision-time index does the same for send-back notes. Missing/future/invalid dates remain unavailable. Same-tenant plan identity and option hashes are checked; older records without snapshots are usable only when their hash still matches the saved option.

Included records retain original audience, mechanism/action, assumptions, risks and complete reversible-test criteria beside the dated owner report and edit. Whole records fit a shared 10,000-character context ceiling (raised from the prior 4,000-character caller truncation); focused and detailed generation consume that same ceiling. Selection considers 80 recent feedback reports and 40 strategy rejections, includes at most eight option reports and five rejection notes, and discloses omissions. The owner list distinguishes included, replaced, retired, expired, invalid-date, untraceable and outside-sample states. Focused Plan → Strategy options now exposes the existing learning controls. Restoring a report makes it eligible for consideration; it does not promise inclusion or modify a previous plan. Engine: `v3.97-strategy-learning-selection`.

Verification commands:

```sh
pnpm exec vitest run tests/convex/strategy-learning-sources.test.ts tests/convex/creative-strategy.test.ts tests/convex/focused-plan.test.ts tests/unit/strategy-learning-list.test.tsx tests/convex/approval-claims.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts tests/convex/free-onboarding.test.ts tests/unit/focused-plan.test.ts
pnpm typecheck
pnpm exec eslint convex/creativeStrategy.ts convex/jobs.ts convex/schema.ts shared/agents/context.ts shared/agents/planTasks.ts shared/agents/specs.ts src/components/app/plan/GoalWorkspace.tsx src/components/app/plan/StrategyLearningSources.tsx tests/convex/strategy-learning-sources.test.ts tests/convex/focused-plan.test.ts tests/unit/strategy-learning-list.test.tsx e2e/focused-strategy-options.spec.ts
CLIMBOS_LOCAL_STATE_DIR=/private/tmp/climbos-calendar-check-20261116 pnpm local:demo sync
E2E_BASE_URL=http://127.0.0.1:3420 CLIMBOS_DESIGN_E2E_ENV_FILE=/private/tmp/climbos-calendar-check-20261116/backend.env pnpm exec playwright test e2e/focused-strategy-options.spec.ts
git diff --check
```

Results: 57 tests across nine files passed; desktop and mobile browser checks both passed (21.4 seconds). Typecheck, scoped lint and local schema sync passed. Regression cases cover 86 dated reports, repeated updates, retire/restore, expiry/future dates, complete-record budget, legacy hash mismatch, preserved original snapshot after a plan change, cross-tenant provenance, a recent rejection on a 500-day-old plan after 25 newer plans, missing rejection date and unchanged action/approval records. Actual focused model-boundary tests confirm original test conditions arrive; detailed-task tests confirm the complete bounded brief survives wrapping. Browser tests exercise selection, retirement, restoration and replacement, with unchanged approval/artifact/workflow/receipt rows, no page overflow and no serious/critical axe findings. Synthetic fixture selection and TypeScript errors found during testing were corrected before the passing run.

Limits: this is a bounded current selection, not a historical record of what every previous plan used. Frequent amendments can still occupy the recent candidate window; longer and older records can be omitted, visibly. Snapshots missing from old records cannot be reconstructed if the original option changed. A reported result does not independently establish exposure, unchanged test execution, causality or semantic truth; owner evidence labels remain declarations. Real-model quality/cost under the larger bounded context and broad business effectiveness remain unevaluated. No provider/model change, paid inference, hosted deployment, publication or sending occurred. The original 410-requirement acceptance audit remains incomplete.

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
