# ClimbOS handoff for Claude Code

This document is a product and engineering handoff for future ClimbOS work. It describes repository-backed behavior and boundaries; treat anything labeled limited or unavailable as a hard product constraint until code and provider access prove otherwise.

## Before editing

1. Read `AGENTS.md`, `docs/Capabilities.md`, and `docs/growth-intelligence/MASTER_INDEX.md`.
2. Read only the relevant growth-intelligence chapters and verify volatile platform requirements against current official documentation.
3. Inspect the actual UI and backend workflow before adding a feature. Prefer extending the existing engine over building a parallel workflow.
4. Run relevant focused tests; do not claim that an integration or workflow is live based only on a prompt, mock, screenshot, or fixture.

## Product direction

ClimbOS helps a nontechnical business owner decide what is preventing growth, choose a small number of evidence-backed next moves, prepare useful work, and learn from measured results. It should challenge the assumption that more marketing is always the answer. Its strategic exploration must include a practical option, an adjacent or unconventional option, and a bold speculative hypothesis, with evidence class, assumptions, risks, upside, effort, and a reversible test. An idea that needs an unavailable integration may still be proposed; its setup dependency and manual test must be explicit.

The growth-plan UI displays these options separately from costed execution plays. Owners can request balanced, conventional, surprising, or ambitious range; all preserve grounded, adjacent, and bold modes. The growth-plays agent retrieves at most two structurally relevant cases from `shared/knowledge/creativePrecedents.ts`; the current curated set has 37 reviewed cases, leaving 63 of the 100-case target unverified. Plans persist prompt/input hashes, prompt version, requested range, and exact retrieved IDs. Workspace editors can append option decisions, separate owner edits, test states, and evidence-labeled outcome notes; only the same tenant's recent records reach future strategy generation, as untrusted guidance rather than proof. Do not claim broader case coverage or treat precedent outcomes or owner notes as customer forecasts or causal estimates. Bold generation and display must not depend on matching precedent, high evidence, high fit, or immediate feasibility. Keep convention, why it persists, cost of breaking it, business action, customer behavior, transfer/differences, and novelty/evidence/fit/feasibility/risk separate and visible. Extend the existing run, schema, persistence, and approval workflows rather than creating a standalone idea generator.

Keep exploration separate from execution. Research, drafts, and recommendations do not authorize publishing, sending, spending, profile changes, or other consequential actions. Existing tenant, exact-content-version, destination, budget, action-scope, policy, audit, and approval checks are required.

## Existing architecture to reuse

- Business research, evidence, diagnosis, growth plays, deterministic economics, plan quality, and orchestration live in `shared/agents/`, `shared/knowledge/`, and `convex/jobs.ts`.
- The operator-facing Growth Home is `/app/[organization]/today`; it shows the top three plan opportunities, offers Simple/Detailed/Expert explanations, supports contextual questions, shows first-take results during eligible runs, and links to the complete plan.
- `convex/preview.ts` and `convex/previewRunner.ts` provide a bounded anonymous website preview. It is a single-page, low-cost preview, not a full site or market audit.
- Built-in specialist roles and routing are in `shared/agents/registry.ts`; user-configured specialist profiles and scheduled manual/daily/weekly runs are in `convex/customAgents.ts` and `/app/[organization]/settings/agents`.
- Customer outcomes, experiment records, deterministic analysis, and reusable learning are handled by `convex/playResults.ts`, `convex/learning.ts`, and `shared/growth/`. Weekly play-result gaps remain unknown rather than zeros; the owner-facing plan labels incomplete logs so partial periods are not described as on track or behind.
- Channel eligibility and evidence-aware recommendations use `shared/acquisition/`; saved owner relevance feedback is in `convex/acquisition.ts`.
- The calendar and autopilot workflow is in `/app/[organization]/content`, `/app/[organization]/autopilot`, `convex/autopilot.ts`, and `convex/publish.ts`. Follow the workspace policy and existing approval stages.
- SEO and AI-search capabilities use `shared/seo/`, `shared/aiSearch/`, `convex/seoOpportunities.ts`, and `convex/aiSearchVisibility.ts`. AI-search visibility measurements are manual samples or owner imports, not continuous share-of-voice monitoring.
- Design Critic findings live in the existing conversion audit (`ConversionAuditV2Schema`, `convex/jobs.ts`, `ConversionAuditView`). Finding feedback is tenant-scoped, version-referenced to its immutable audit run, and audited; direction briefs preserve source evidence, owner/admin-confirmed brand settings, unknowns, creative range, and customer-entered essentials. Research-derived brand settings remain unconfirmed until an owner/admin reviews and saves them; editor changes clear that confirmation. The preview is the ClimbOS page template, not a re-render or modification of the customer's external site. Saved page-version history, cross-page brand consistency mapping, and a deduplicated opportunity queue remain open product gaps.
- Page and outreach-subject experiments report results without auto-applying them. Starting variant exposure and applying an eligible B result require approver permission; apply is bound to the saved baseline hash and creates an audit event. The sample rules are fixed operational defaults, not business-specific power analysis. Preserve these safeguards in interface redesigns.
- Reviews and inbox workflows use `convex/reviews.ts`, `convex/inbox.ts`, and `/app/[organization]/reviews`. Review invitations are neutral and approval-bound; public review data sync and native public reply publishing are not implemented. Customer voice themes are heuristic phrase groups over a limited sample, not representative research.

## Non-negotiable evidence and trust rules

- Keep measured, owner-reported, source-reported, assumed, inferred, and calculated information distinct. Unknown values remain unknown.
- Never invent a contact, customer, customer demand, platform usage, audience size, conversion rate, review, testimonial, business capability, source, or revenue result.
- Use deterministic code for material arithmetic, permissions, validation, budgets, ranking gates, and approval binding. Use models for research synthesis, interpretation, and creative alternatives.
- Do not confuse attention metrics with qualified customers, revenue, or causal lift. Distinguish attribution from incrementality and forecasts from scenarios.
- Treat scenario and industry libraries as hypotheses for retrieval and evaluation, not rules that override a business's actual evidence.
- Community recommendations require current rules and useful participation before promotion; never automate community posts, comments, DMs, votes, or account activity.
- Public review invitations must use the same public destination for recipients regardless of sentiment. Never gate, reward, fabricate, or post reviews on customers' behalf.
- Do not generate thin or repetitive SEO content, promise search or AI citations, or claim that schema markup guarantees visibility.
- Verify current official platform policy, API access, OAuth scopes, eligibility, fees, and retention rules before implementation. Use a manual path where support is unavailable or owner setup is required.

## Production model and provider direction

ClimbOS uses its existing OpenAI-first, metered routing with Luna for basic paths and selected Sol escalation for expert work. Preserve the existing Gemini image route, cost reservations, usage accounting, and eligibility checks. Do not introduce a second production agent SDK or new model provider simply to create more role labels. Ask Faisal before switching the coding model if a higher or lower Codex tier appears necessary.

## UI handoff goals

When polishing the interface, build on the current navigation and design system rather than replacing workflows with static mockups. Keep the owner-facing surface plain and progressive: show the highest-priority finding and next action first, then expose evidence, assumptions, costs, effort, alternatives, and model detail on demand. Preserve progress states, partial failures, retry/resume behavior, and honest capability status. Keep the advanced plan, SEO/AEO, specialist and analytics work reachable without making the home screen a wall of controls.

Do not add a decorative score or unsupported “AI readiness”/growth number. Every displayed ranking or score must expose its input, method, evidence basis, and limitations.

## Local verification

Use the repository's package scripts from `package.json`; focused tests should cover the changed path, tenant boundaries, approval scope, failure states, and relevant business cases. `pnpm typecheck`, focused `pnpm exec eslint ...`, `pnpm exec vitest run ...`, and `git diff --check` are the current local checks. Report the exact commands run and the limitations of the coverage.
