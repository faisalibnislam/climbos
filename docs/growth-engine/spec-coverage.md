# Spec coverage: ClimbOS Complete Product Specification vs the repository

Checked 2026-10-26 on `growth-engine-v2`. Four read-only audits compared sections 3–14 and 19 of `docs/ClimbOS-Complete-Product-Specification.md` with runtime code (not prompts or docs alone), and the top claims were spot-checked by hand.

**10 Nov cost/UX follow-up:** focused owner plans now include a concrete recommendation and already-prepared work, exact 14/30/90-day milestones, bounded paid revision and matching quote/reservation logic. Fresh research reuse is tenant/website-bound; explicit creator contact refusals can block outreach despite a passing AI critic. Draft review and approval reuse existing work without another model call. Detailed portfolios remain available. [Verification](../Verification.md) and [cost/quality evidence](../Cost-and-Quality-2026-11-10.md) record results and unresolved acceptance limits; earlier capabilities are not globally relabeled complete.

**Focused update, 2026-11-09:** [the local audit](../Local-Audit-2026-11-09.md) records repairs to strategy direction, research-aware channels, creator discovery, native social routing, search recommendations and owner UX. Gap 7's deferred channel decision fields are now implemented for new channel reviews: unknowns, setup, labeled/unknown hours, concrete first step, smallest check, alternative and change-course condition. Legacy records may omit them. The older table below remains a dated inventory; unmodified partial items are not being relabeled complete. The current reconciliation below supersedes the older deferred-feature inventory. Model quality remains a separate acceptance question.

Gap 8 now has an owner form inside each experiment: define variants, decision owner and planned limits before the test, then record append-only changes when running. The original setup remains locked after starting. Saving setup starts no work. Baseline, audience, measurement and stopping-rule details remain in the existing plan and experiment contract.

- **Covered** means code enforces it.
- **Partial** means some of it is enforced and some depends on the prompt.
- **Missing** means nothing implements it.

Sections 1–2, 15–18 and 20 describe purpose, authority, the current snapshot, architecture and handoff. They set no new product behavior, so they were not scored.

## Fixed in this pass

| Spec | Gap found | Now |
|---|---|---|
| §9, §13 | Approving an edited post that had no approved-offer snapshot ran no claim lint. Fake scarcity, deadlines, scale or capability claims could be approved. | Approval in the app, by email and by autopilot re-runs `lintClaims` against current confirmed owner, behavior and measured facts. An unsupported claim blocks approval, or sends an autopilot slot back to "ask". See `convex/lib/claimCheck.ts`. |
| §6, §11 | Vote requests, review incentives, review gating and virality promises were blocked only by prompt text. | `lintManipulation` (in `shared/agents/lint.ts`) returns errors wherever the claim lint runs: generated copy, plays, plans, and approval. |
| §11 | A Yelp URL was accepted as the review-invitation destination, although Yelp asks businesses not to solicit reviews. | `reviewDestinationProblem` rejects it when the link is saved and again before a batch is prepared. Saving or removing the link is now audited. |
| §11 | Nothing stopped public review replies from revealing private information. | Before a public review reply draft is saved, `publicReplyPrivacyIssue` holds it back if it contains an email address, phone number, order or account reference, or a six-word run copied from that customer's private feedback. |
| §4.2 | A research market signal in the business model check could have no date. | A research signal now needs `observedAt` or a limitation that says it is undated. |
| §5.2 | Exploration `evidenceRefs` were never checked. | Each reference must be `fact:N` within range, a page read in this run, or a retrieved precedent ID. An option with an evidence label but no citation gets a warning; the option is never removed. |
| §11 | The referral playbook said "happy customers". | It now says "existing customers". |

Tests: `tests/convex/approval-claims.test.ts`, `tests/unit/manipulation-lint.test.ts`, `tests/unit/reply-privacy.test.ts`, plus new cases in `business-model-check.test.ts` and `decision-structured.test.ts`. Full suite: 274 files and 1,892 tests pass, with typecheck and lint clean.

## Covered (code-enforced)

| Spec | Requirement | Evidence |
|---|---|---|
| §3 | Every recommendation carries evidence, confidence, risk, smallest test, and stop/continue/revise | `shared/agents/specs.ts` action contract and `lintActionContracts` |
| §3 | Untrusted inputs are wrapped as data | `convex/jobs.ts`, `shared/agents/businessModel.ts` |
| §4.2 | Business model check: cited current model, labelled verdict with what would change it, exactly one grounded, adjacent and bold model with a unit-economics basis and smallest test, next direction, owner test log fed into plans, no automatic price or operations changes | `shared/agents/businessModel.ts`, `convex/businessModel.ts`, `convex/jobWrites.ts` |
| §5 | Three exploration modes with bold always kept; five dimensions kept separate with no single score; exploration kept apart from approval; precedent retrieval is mechanism-first and doesn't gate original ideas | `specs.ts` (StrategyExplorationSchema), `ExpertPlan.tsx`, `convex/creativeStrategy.ts`, `shared/knowledge/creativePrecedents.ts` |
| §6 | Channel recommendations need evidence, confidence, a date, purpose and measurement; owner dismissals are saved and audited; votes and impressions are never treated as customers; forum rules must be checked; trend evidence must be dated; calendar views, 300-item cap and proposed ≠ scheduled; autopilot is opt-in and policy-bound | `shared/acquisition/scoring.ts`, `convex/acquisition.ts`, `recommendationGroups.ts`, `ContentCalendar.tsx`, `convex/autopilot.ts` |
| §7 | Search Console kept separate from demand; refresh-or-new-page rule; overlap warning; original-contribution labels; robots respected and static-fetch limits stated | `shared/seo/*`, `specs.ts` SEO lints |
| §8 | Design Critic lenses and classifications; owner chooses a direction and previews it in the editor; publish blocked until a measurement plan exists for that exact version; customer-voice themes with counts and examples | `specs.ts`, `convex/designCritic.ts`, `convex/landing.ts`, `shared/reviews/voiceThemes.ts` |
| §9–10 | Constraint-first diagnosis, advisory-only offers, scarcity and deadline lint, campaign timing validation | `specs.ts` offer, timing and claim lints |
| §11 | Neutral, identical invitation with frozen destination and recipients; private feedback optional and equally visible; reply drafts only; platform sync shown as manual | `convex/reviews.ts`, `src/app/review/[slug]`, `convex/inbox.ts` |
| §12–13 | Observational vs causal labels, unknown is not zero, approval bound to tenant, content hash, destination, schedule, policy and expiry, fail-closed, audit, idempotency, emergency pause | `convex/lib/approvals.ts`, `convex/publish.ts`, `tests/convex/safety.test.ts` |
| §19 | 100 source-backed precedents in runtime (75 base plus 25 imported action records); bold option visible | `creativePrecedents.ts` (pinned by test), `ExpertPlan.tsx` |

## Buildable-gap reconciliation — 9 November 2026

This replaces the older deferred-feature inventory. “Implemented” describes inspectable local behavior, not live-provider capability, semantic truth, or measured business results. Source and model-quality limitations remain explicit.

| Prior gap | Spec | Current implementation and boundary |
|---|---|---|
| 1 | §3.1 | Demand and diagnosis gates remain enforced; no spend is authorized by a recommendation. |
| 2 | §9 | Persuasion and offer evidence checks remain enforced, including truthful terms and fair review rules. |
| 3 | §8 | Exact saved draft captures now include bounded desktop/mobile DOM observations for overflow, language, headings, names, alt attributes and small text. This is not a complete accessibility audit. Original page evidence remains recoverable. |
| 4 | §8 | Measurement plans and append-only finding decisions remain linked to the page version and capture date. |
| 5 | §6 | Daily/weekly/monthly views now paginate scheduled posts, Autopilot slots and unscheduled review drafts independently. The review range is indexed before pagination, linked items are deduplicated, and partial counts remain explicit until every source is exhausted. Older clients retain the capped compatibility query. |
| 6 | §3.1 | Expanded diagnosis vocabulary and discriminating checks remain available. Sparse measurements do not establish a diagnosis. |
| 7 | §6 | New channel reviews persist unknowns, setup, effort basis/unknown hours, first step, smallest check, alternative and change-course condition; library priors remain separate from business evidence. |
| 8 | §12 | Experiment setup and append-only changes now have an owner form. Proposed tests start no execution. |
| 9 | §9 | `offerHorizon` and the offer panel compare contribution over the same period using an owner-entered sales count; blank volume or missing costs stay unknown. Currency minor units and whole-unit break-even are calculated in code. No demand forecast or missing fixed cost is invented. |
| 10 | §4 | Business Model Check receives at most two relevant precedents; citations are checked against that retrieved set and cited analogy/source/limits are visible. Original alternatives need no precedent. |
| 11 | §7 | Owner-started readiness scans read at most three same-origin static pages after robots checks, retain dates and bounded text/link samples, and distinguish blocked/failed pages. Sampled incoming-link observations are not whole-site orphan detection. Schema drafts show fresh exact-URL text/profile parity; fetched HTML cannot establish rendered visibility. Viewports are recorded only by the separate render capture. |
| 12 | §8 | A finding can link a chosen draft's exact version and measurement plan to a proposed observational experiment and its append-only outcome analyses. Edits require another version-specific plan; before/after association is not causation. The November 16 extension carries exact-version publication evidence and assessed owner-recorded design outcomes into later audits and plans; unverified/inconclusive/not-run reports remain evidence gaps rather than winning-design claims. |
| 13 | §13 | Existing scoped approval/permission guards remain. New preparation and test-definition paths send, publish and spend nothing. |
| 14 | §6, §11 | Product Hunt, Google Business Profile and G2 now have tenant-scoped, append-only preparation drafts with owner-reported eligibility/control, evidence, exact destination, message and measurement. They provide a manual handoff, not a provider integration. No votes, incentivized reviews or rating selection. |
| 15 | §5.3 | 100 distinct source-backed precedents are in runtime retrieval. The 25 new cases have reviewed primary action sources, low confidence, explicit transfer conditions and no asserted commercial outcomes. No anonymous backlog was fabricated. |
| 16 | §14 | Industry/scenario retrieval continues to use the selected business type and bounded context. Library breadth is not evidence of expert results in every industry. |
| 17 | §3.3 | Owner-facing brand isolation remains covered. Historical internal module/table identifiers remain for compatibility; changing production storage/API names is not an owner-facing feature and would require a separately tested migration. |

Additional repairs found through real-model testing: structured planning limits and research source indexes now reach both writer and reviewer; missing revenue/margin/churn can remain null through generation, storage, arithmetic and UI; current portfolio checks no longer force a bankable play or inflate volume to satisfy a fixed minimum. The OpenAI adapter preserves supported schema bounds instead of discarding them. See the current [completion and validation record](../Specification-Completion-2026-11-09.md).


## New owner UX requirements — 9 November 2026

Focused tabs are implemented across the core owner experience, with four primary destinations and specialist tools on demand. Plan supports 14-, 30- and 90-day execution cycles, persisted milestone checks, scoped reviews, paginated history and prior-review context for the next plan. Chat questions use validated single/multiple choices, unknown and optional Other input, with member binding and replay rejection. AI research/preparation instructions are proactive, while existing external-action approval scopes remain enforced. See [the current implementation record](../Specification-Completion-2026-11-09.md). Product behavior is implemented; measured usability, expert strategy quality and cross-industry business outcomes are still acceptance limitations.

## Additional design workflow — 16 November 2026

The cross-page design opportunity queue is available in Your work. It reuses paginated audit records and exact-finding review controls, keeps evidence/relevance/effort/confidence separate, retains earlier matching observations without treating them as independent evidence, and links back to each original finding. Saved capture time requires a matching page and viewport. This closes the additional design-workflow queue requirement within the saved audit scope; it does not establish semantic grouping or live site state. The later brand-map increment below separately addresses saved pattern review and intentional exceptions. Initial and updated finding-review buttons now submit their existing forms. See [Verification](../Verification.md).


## Brand consistency and intentional exceptions — 16 November 2026

The additional-design workflow's brand-map requirement now has an owner-facing path in Settings → Brand kit, using existing published landing snapshots and saved design documents. It distinguishes owner-confirmed rules, deterministic saved-value observations, possible variation/palette mismatches, and exact-snapshot owner decisions. Owners/admins can confirm, correct, dismiss or reopen a pattern, or explain an intentional exception. These decisions do not change a brand rule or any page/asset. New source versions and changed approved rules invalidate prior decisions for future advice, while preserving the old observations in append-only history. Both strategy and conversion-audit job context consume the bounded, tenant-scoped decision brief with an explicit no-execution and no-universal-template policy.

Coverage is limited to 30 newest hosted-page records and 30 most recently updated saved designs; only explicit live published page snapshots contribute. Design assets are marked drafts. Image pixels, external website styles, layout and semantic brand interpretation are not inspected. UI shows five recent reviews per pattern; workspace export includes at most 100 decision records with a truncation flag. This is not proof of full visual consistency or measured design quality. See the dated verification record for permission, lifecycle and browser evidence.
