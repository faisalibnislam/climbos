# Spec coverage: ClimbOS Complete Product Specification vs the repository

Checked 2026-10-26 on `growth-engine-v2`. Four read-only audits compared sections 3–14 and 19 of `docs/ClimbOS-Complete-Product-Specification.md` with runtime code (not prompts or docs alone), and the top claims were spot-checked by hand.

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
| §19 | 75 reviewed precedents in runtime; bold option visible | `creativePrecedents.ts` (pinned by test), `ExpertPlan.tsx` |

## Still partial or missing (buildable), ranked by owner impact

| # | Spec | Gap | Size |
|---|---|---|---|
| 1 | §3.1 | **Done (2026-10-26).** `lintDemandGate`: when insights find insufficient business-specific evidence, or the latest business model verdict is at risk or insufficient evidence, the primary play can't carry ad spend, and supporting paid plays are flagged as tests. | M |
| 2 | §9 | **Done (2026-10-26).** Offer assessments carry `persuasion[]` (mechanism, use, legal status, evidence needed, lower-risk alternative), checked by `lintPersuasion`. Copy now needs evidence for reference prices, star ratings, no-hidden-fees and cancel-anytime promises, and a free trial must state its end terms. A review-gating guard already exists via `lintManipulation`. | M |
| 3 | §8 | The selected draft isn't re-rendered on desktop and mobile after a change. The original customer page isn't kept: screenshots expire after 30 days and no HTML snapshot is stored. | M |
| 4 | §8 | **Done (2026-10-26).** Design measurement plans now require audience, guardrail, observation days (1–365) and decision rule (older plans stay valid). `designFindingReviewEvents` keeps an append-only history of each finding decision, with the linked page-draft version and screenshot time, shown as Review history in the audit view. | S |
| 5 | §6 | Items awaiting review aren't on the calendar, and autopilot slots don't deep-link to the slot. | M |
| 6 | §3.1 | Constraint list lacks price, trust, acquisition, repeat purchase, referral and cash. | M |
| 7 | §6 | No typed list of eight intended jobs per channel. App stores, directories and some others have no guidance group. Recommendations have no unknowns, setup steps or smallest-check fields. | M |
| 8 | §12 | Experiment pre-registration lacks variants, decision owner, a deviations log and costs. Cross-tenant learning has no opt-in. | M |
| 9 | §9 | Payment fee is only checked for presence: no percentage-plus-fixed recalculation and no horizon break-even. | S |
| 10 | §4 | No structured segment fit (severity, willingness to pay, reachability, serviceability). Precedents aren't retrieved for the business model check. | M |
| 11 | §7 | FAQs aren't required to cite. Readiness reads only the homepage, with no viewport, internal-link finding or schema-vs-page check. AI-search observations have no explicit "brand cited" flag per URL. | M |
| 12 | §8 | Design directions aren't linted for distinct levels, effort or risk. Page results don't link back to the finding. | S |
| 13 | §13 | Approval scope binds no audience or budget. | S–M |
| 14 | §6 | No Product Hunt launch-prep artifact, no Medium human-edit gate before export, no thin or duplicate blog-batch lint, and no GBP owner-control check. | M |
| 15 | §5.3 | Precedent `evidenceClass` is free text. The low-confidence record is retrieved like any other. The 25 unverified cases have no tracked backlog. | S |
| 16 | §14 | The 1,000-problem library is reachable only by regex alias. The 25k playbooks are used only for an unambiguous business type. | S–M |
| 17 | §3.3 | The parent studio name is still in internal identifiers (`convex/airly*`, `shared/airly`, the `airlyLinks` table). The brand test scans only two docs. Renaming needs a table migration. | M |
