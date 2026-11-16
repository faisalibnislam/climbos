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
