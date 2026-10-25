# ClimbOS development handoff for Claude Code

| Field | State |
|---|---|
| Prepared | 25 October 2026 |
| Repository | `climbos` |
| Branch | `growth-engine-v2` |
| Handoff commit before this document | `7ee9e8b` (`Improve competitor discovery evidence and creative cases`) |
| Remote | `origin/growth-engine-v2` |
| Deployment | None performed by this work; a branch push is not a production release. |

This handoff records what has been built, what was checked, what remains unverified, and how to continue safely. It is a starting point for repository work, not proof that every capability works with live providers or real customer outcomes.

## Start here

Before editing, Claude Code should:

1. Run `git status --short --branch`, `git log -5 --oneline`, and confirm it is on `growth-engine-v2`. Preserve any user changes already present.
2. Read `AGENTS.md`, `docs/Capabilities.md`, `docs/growth-intelligence/MASTER_INDEX.md`, this handoff, and `docs/growth-engine/implementation-ledger.md`.
3. Use `docs/growth-engine/improvement-requirement-audit.md` for the numbered 410-item traceability map. It says the requests are cross-cutting, not 410 independent features. Update its rows and the implementation ledger as material work is completed.
4. Follow the master index to read only the chapters/playbooks needed for the current task. The growth-intelligence corpus is reference material, not evidence that a proposed architecture exists in the app.
5. Inspect the actual UI, schemas, validators, backend mutations/actions, persistence, tests, and permissions along the relevant end-to-end path before changing it.
6. Before changing Next.js files, read the relevant current guide under `node_modules/next/dist/docs/`. This repository's installed Next.js version may differ from familiar conventions.
7. Make a small, complete, reviewable improvement to an existing flow. Run focused regression and authorization tests. Report what ran and what remains unknown.

## Project intent and owner decisions

ClimbOS is intended to help nontechnical business owners understand what is constraining growth, compare evidence-based options, prepare useful work, and learn from outcomes. The product should improve the shared growth engine and agents; visual polish and final interface work can continue in Claude Code. Avoid creating isolated feature agents or treating every requirement as a separate subsystem when an existing research, decision, content, approval, or learning workflow can be extended.

The owner has specifically asked for:

- Business-specific growth recommendations and channel advice, with evidence and uncertainty visible. Do not promise that the product performs like a senior human marketing director until quality is validated against real scenarios and outcomes.
- Original strategic exploration as a protected capability. When a strategy exploration warrants it, keep **grounded**, **adjacent**, and **bold** options distinct. Bold ideas may lack a direct precedent or immediate integration; do not suppress them because they are novel or speculative. Explain the convention challenged, mechanism, business fit, assumptions, risks, upside, resources, and a small reversible test. Keep novelty, evidence, fit, feasibility, risk, and upside separate rather than collapsing them into one score.
- Social content intelligence tailored to the specific business, audience, platform, and brand. Trend or meme claims need current source evidence and platform fit. Treat attention as distinct from qualified outcomes.
- Selective owned-content, community, review, comparison, launch, and discovery recommendations. Recommend a channel only when customer evidence, audience, geography, eligibility, rules, economics, and owner capacity support it. Distinguish research, participation, discovery, launch feedback, and authority from acquisition. Do not automate Reddit/community activity.
- Fair review invitations and selective review-platform guidance. The same public-review invitation and destination must be offered regardless of sentiment. Do not gate, reward, fabricate, or post reviews for customers.
- Google SEO and AI-search readiness with current evidence, clear sampling limits, and no guarantee of indexing, ranking, citation, or traffic.
- Website and design critique that points to actual evidence, provides actionable directions, preserves owner choice and version history, and distinguishes heuristic review from measured performance.
- Monthly, weekly, and daily calendar views for scheduled posts and Autopilot slots, including review-pending items. Autopilot follows each workspace's selected policy and safeguards. Recommendations never schedule, publish, send, or spend without the relevant exact-scope approval.
- Product-facing ClimbOS copy must not include unrelated studio/vendor branding.
- An owner preference allows legally permissible aggressive persuasion, including some dark-pattern-style techniques. This is not legal advice or a lawfulness determination. Fabricated claims, known illegality, unauthorized charges, and platform-rule violations remain prohibited; legally sensitive tactics require current jurisdiction-specific review.
- The supplied 1,000-scenario and 25,000-playbook materials are reference material. Use useful scenarios through existing bounded retrieval, preserve hypothesis labels, and do not blindly import source instructions or treat examples as verified outcomes.

## What is already in the repository

### Shared intelligence and evidence path

The repository already has a shared research → diagnosis → strategy → deterministic economics → quality review → owner approval → execution → outcome-learning path. Main areas include:

- `convex/jobs.ts`, `convex/engine.ts`, `shared/agents/`, `shared/knowledge/`: orchestration, role/task contracts, research, prompt construction, retrieval, provenance, plan quality, and validation.
- `convex/lib/approvals.ts`, `convex/publish.ts`, `convex/outbound.ts`, and related mutations: action authorization, approval binding, and external-effect boundaries.
- `convex/playResults.ts`, `convex/learning.ts`, `shared/growth/`: experiment/play outcomes, deterministic analysis, and scoped learning.
- `shared/acquisition/`, `convex/acquisition.ts`: channel choices, eligibility, evidence, constraints, and owner relevance feedback.
- `docs/Capabilities.md`: owner-facing description of implemented paths and their boundaries. Check it against runtime code; it is not a substitute for tracing behavior.

Keep measured, owner-reported, source-reported, assumed, inferred, and calculated information distinct. Unknown is a valid state. Deterministic code should handle material arithmetic, dates, feasibility, permissions, validation, budgets, and approval binding; models may research, synthesize, and generate alternatives but their structured outputs must be checked.

### Work completed on the current branch

The branch contains many earlier changes beyond the latest batch. The current ledger is the detailed history and status source. Recent representative work includes:

- Owner-visible growth priorities, targets, activity snapshot, plan explanations, contextual questions, and onboarding first-take continuity.
- Growth diagnosis and acquisition improvements, including explicit unknown-capacity handling and a zero-capacity block; budgets, hours, known capacity, channel evidence, and existing capability influence recommendations.
- Offer and campaign safeguards, evidence-bound offer facts/terms, urgency/scarcity checks, cost/profit distinctions, and approval boundaries for consequential work.
- Strategy execution and decision contracts extended with more owner context and deterministic checks; historical outcomes stay unknown when data are incomplete.
- A production creative-strategy retrieval library that informs the existing growth-strategy task. As of this handoff it contains **74 reviewed cases (CP-001–CP-074)**; **26** of the 100-case research target remain unverified and excluded. Do not fabricate cases to reach 100. Each case is source-backed and retains transfer conditions and causal limits. Retrieval informs but does not gate bold ideas.
- Social publishing intelligence includes owner-selected brand humor/trend preferences, run-bound source evidence for trend references, platform-destination validation, and copy-similarity warnings. This is implementation and fixture coverage, not proof of recommendation quality or platform-policy compliance in live outputs.
- A bounded website conversion audit with sourced page observations, proposed implementation directions, screenshot review where configured, a ClimbOS-hosted landing-page draft path, version-bound measurement plans, and approval boundaries. It does not edit or re-render the customer's external website or prove conversion impact.
- Search Readiness and AI-search workflows covering sampled static HTML, crawler rules, Google Search Console context/imports, manual AI-answer observations, and limited PageSpeed paths. Sampling does not establish indexing, ranking, complete crawl coverage, AI-answer share, or business impact.
- A monthly/weekly/daily content calendar and Autopilot workflow with workspace policy and review safeguards. Recent changes disclose the 300-post / 300-slot query cap; a capped result can be incomplete.
- Review workflows support neutral owner-triggered invitations, manual review import, optional private feedback, suppression/unsubscribe handling, and audit controls. Native review sync/replies are not generally implemented; “handled” is not a platform-verified public reply.
- Competitor monitoring includes owner-controlled cadence, change summaries, pause/resume, per-tenant relevance dismissal, and owner selection before monitoring. The latest change improves discovery evidence: candidate identity and cited discovery URL must share a canonical company-owned domain; mismatched saved suggestions are filtered. This improves source-to-destination integrity, not independent market relevance ranking.
- Operational improvements include task/model/step cost visibility, cache-hit accounting, scoped knowledge-source cadence, more accurate action status, and accessibility/navigation improvements. These do not establish cost savings, quality improvements, or app-wide accessibility conformance.
- The user-facing UX prompt has been made portable by removing a machine-specific local path. A full tracked-repo search for the former studio name returned no matches at the time of handoff.

### Latest batch: `7ee9e8b`

Files changed in the latest pushed batch:

- `shared/agents/specs.ts`: research prompt now describes independent competitor discovery and requires direct company-site identity verification; source lint rejects candidate/evidence host mismatches.
- `shared/competitors/candidates.ts`: filters mismatched candidate and evidence hosts, including saved/legacy suggestions.
- `shared/knowledge/creativePrecedents.ts`: adds CP-074, J&P Organics' flexible pay-as-you-go CSA cadence, with operator, survey, and extension sources and explicit limits.
- `tests/convex/competitors.test.ts`, `tests/unit/competitor-candidates.test.ts`, `tests/unit/research-quality.test.ts`, `tests/unit/creative-precedents.test.ts`: targeted regression tests.
- `tests/unit/product-brand-copy.test.ts` and `docs/ClimbOS-Simple-UX-Codex-Prompt.md`: check and remove an owner-facing local-path/branding leak.
- `docs/growth-engine/creative-strategy-precedents.md` and `docs/growth-engine/implementation-ledger.md`: record CP-074, the competitor evidence work, and current limitations.

The J&P Organics record uses a 2009 university oral-history profile, a 2016 peer-reviewed survey of 536 current/former subscribers, and an agricultural extension guide. The survey is non-randomized and does not establish incremental orders, retention, or profit. The case is a transfer hypothesis, not a forecast for a ClimbOS customer.

## What remains and should guide the next work

These are known open gaps, not a complete substitute for checking the requirement audit and ledger before choosing work:

1. **Live quality and outcomes:** Most changed paths are fixture/regression tested. No broad held-out real-model evaluation demonstrates expert-level strategy quality across diverse businesses. Business outcomes, causality, channel fit, and forecast calibration remain limited or unmeasured.
2. **Traceability and evidence:** Research sources are often linked to a run or object rather than every claim/sentence. A URL's presence does not prove the cited page supports the exact claim. Expand claim-level linkage where material, and test support matching and provenance preservation.
3. **Design critique limits:** The external customer website is not edited or re-rendered. The current draft flow creates a ClimbOS-hosted page, with limited sampled screenshots and version-bound measurement. Cross-page brand consistency mapping, a deduplicated opportunity queue, full journey interaction checks, customer-site re-rendering, and measured external-site outcomes remain open. Automated checks and screenshots are not WCAG conformance.
4. **SEO limits:** The site audit is bounded and primarily static-HTML; JavaScript-rendered pages, full crawl coverage, local/off-site factors, continuous answer-engine checks, and proof of citations remain unsupported or unverified. Search Console and manually observed answers are samples with setup constraints. Never state that an SEO recommendation guarantees ranking, traffic, or AI citation.
5. **Review and platform integrations:** Native review sync/replies and several platform integrations are blocked or unsupported pending official API access, credentials, provider eligibility, scopes, plan limits, and data-retention verification. Keep manual paths clear. Do not scrape platforms or imply an API exists without checking current primary documentation.
6. **Autopilot/calendar scale and validation:** Existing caps and policy behavior are explicit, but calendar completeness at maximum query caps and live scheduling/publishing with each provider must be separately validated. Approval must remain bound to tenant, exact content version, destination, audience/schedule, budget, and action scope.
7. **Accessibility and UX:** Some keyboard/accessibility safeguards exist, but there is no app-wide accessibility conformance result. Continue with focused keyboard and assistive-technology checks and plain-language owner review.
8. **Documentation drift:** The confirmed 73-versus-74 creative-precedent count discrepancy in `docs/Capabilities.md` has been corrected in the current follow-up change. Continue checking all owner-facing capability statements against runtime behavior; other copy may still drift.
9. **Requirement completion:** `docs/growth-engine/improvement-requirement-audit.md` maps 410 numbered items. Its own introduction says most are partially implemented and that the first 350, AEO/GEO items, and specialist requirements are shared/cross-cutting. Do not mark a row complete merely because one path or fixture exists. Update row status only after checking current code and coverage; distinguish shipped, fixture-only, blocked, and unverified behavior.
10. **Provider setup and production:** This branch is not a deployment. Verify environment variables, provider credentials, permissions, migrations, and account eligibility in an authorized environment before claiming a live integration. Do not deploy or change live business campaigns as part of a code change.

## Repository guardrails

- Preserve existing user changes. Avoid broad formatting or unrelated rewrites.
- Do not add a parallel agent/provider/calendar subsystem unless an end-to-end audit demonstrates an architectural need.
- Never invent prices, margins, costs, timing, capacity, audience behavior, demand, customer lists, reviews, campaign performance, or revenue. Keep unknowns explicit; ask only for missing facts that could change the recommendation.
- Keep recommendation generation separate from action. No sending, publishing, scheduling, price changes, ad spend, profile changes, or other external effects as a generation side effect.
- Preserve tenant isolation, permissions, policy checks, and approvals tied to exact tenant, artifact/content version, destination, audience, budget, and action scope. Fail closed for unsupported or unknown action kinds.
- Verify volatile platform rules and API access from current official sources before recommending an integration. Record the supported claim, access date, and limits.
- Use the existing OpenAI-first metered routing, cost reservation/accounting, and Gemini image path. Do not change providers or the coding model casually. If a different Codex model tier is genuinely needed, ask the owner before switching; for Claude Code use its currently selected model unless there is a concrete reason to request a change.
- Do not put unrelated brand names into customer-facing ClimbOS copy.
- Keep creative strategy original. Case retrieval must improve reasoning, never act as a precedent gate for bold options.

## Verification performed for the latest pushed batch

The following commands passed before commit `7ee9e8b`:

```text
pnpm exec vitest run tests/unit/product-brand-copy.test.ts tests/unit/creative-precedents.test.ts tests/unit/research-quality.test.ts tests/unit/competitor-candidates.test.ts tests/convex/competitors.test.ts
  5 files passed; 112 tests passed

pnpm typecheck
  app and Convex TypeScript checks passed

pnpm exec eslint shared/agents/specs.ts shared/competitors/candidates.ts shared/knowledge/creativePrecedents.ts tests/unit/product-brand-copy.test.ts tests/unit/creative-precedents.test.ts tests/unit/research-quality.test.ts tests/unit/competitor-candidates.test.ts tests/convex/competitors.test.ts
  passed

git diff --check
  passed
```

This was a focused check of the latest batch, not a full repository test suite or a live-model/provider test. The preceding batch `c154357` also passed its documented focused tests (52 across five files), app/Convex typecheck, changed-file ESLint, and diff check. See the ledger for earlier batches and their own exact scopes.

## Suggested first Claude Code session

Start by verifying the checked-out state and reading the files listed under **Start here**. The 73/74 creative-case documentation mismatch has been corrected; compare `docs/Capabilities.md`, the 410-row audit, and the implementation ledger for other stale claims. Choose a high-impact, bounded runtime gap by evidence and owner impact, trace its complete current flow, and implement only the confirmed gap with focused permission/regression tests. Continue on `growth-engine-v2`, keep work synced to `origin/growth-engine-v2` after successful verification, and do not deploy or create a PR unless the owner separately asks.

## Prompt to give Claude Code

```text
Continue ClimbOS development from the current repository and branch. Read docs/Claude-Code-Handoff.md, AGENTS.md, docs/Capabilities.md, docs/growth-intelligence/MASTER_INDEX.md, docs/growth-engine/improvement-requirement-audit.md, and docs/growth-engine/implementation-ledger.md first. Verify the current git state and preserve every existing change.

Treat the handoff as a status snapshot, not proof of implementation. Audit the actual code before editing. Follow the relevant growth-intelligence reading route and read the current Next.js guide under node_modules/next/dist/docs/ before changing Next.js code. The confirmed 73-versus-74 creative-precedent count in docs/Capabilities.md has been corrected; check for any other stale owner-facing claims against current runtime behavior.

Then continue the remaining ClimbOS work in small, complete, evidence-based increments. Choose the next material gap from the requirement audit and implementation ledger, trace its existing path end to end, and implement only what that audit confirms. Preserve the existing shared engine and original grounded/adjacent/bold strategy capability. Never invent missing business facts or suppress bold ideas because they are novel. Keep unknowns and provenance explicit; use deterministic code for material calculations and authorization. Preserve tenant isolation and exact approval binding for external actions. Do not send, publish, schedule, spend, alter live pricing, deploy, or create a PR.

Run focused regression and permission tests for each change, typecheck and targeted lint where relevant, update the requirement audit and implementation ledger, and report files, behavior, exact test commands/results, and limitations. Keep this branch synced to origin/growth-engine-v2 after verified work, as previously authorized. Use the currently selected model; ask me before changing to a different Codex model tier if that becomes necessary. Do not stop after a plan or partial implementation—continue until the selected gap is completed and verified, then proceed to the next clear gap.
```
