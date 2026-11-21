# ClimbOS — handoff

> Read this first if you are a Claude (or any agent) picking this project up, on this Mac or another one. Then read CLAUDE.md / AGENTS.md. Keep this file current: after every change to the project, update "Current state", "Next steps" and "Change log", and commit it.

Last updated: 2026-11-21 · Written on: Faisal's MacBook Pro M5

## 1. What this is

ClimbOS is "your AI growth team": a small-business owner states a business goal, and coordinated AI specialists research the business, build a costed growth plan, prepare the work (social posts, ads, email, outreach, SEO, landing pages, reviews, booking pages) and measure results. Deterministic code owns money, permissions, statistics and every external write; the owner approves anything that goes live.

- Audience: non-technical small-business owners (local services, small SaaS, agencies, ecommerce).
- Platform: web (Next.js 16 on Vercel + Convex). PWA with push. No native apps.
- Billing: Polar (merchant of record), credits and plans (`docs/PricingAndEconomics.md`).
- Status: **in development, with an older version live**. Production at https://climbos.app (www redirects to apex) was last deployed from `origin/main` (latest commit 2026-10-28). Since then ~213 commits of unreleased work live on branch `codex/trend-evidence-freshness` (pushed to GitHub, not merged, not deployed).
- The owner's real test businesses are their own products (Livoform, Macloving, Folevi, Involets); ClimbOS demo data uses a "Formkit" workspace.

## 2. Where it lives

- GitHub: `https://github.com/faisalibnislam/climbos` (remote `origin`). Default branch `main`.
- Current branch on this Mac: **`codex/trend-evidence-freshness`**. This is the active development branch; per `docs/Claude-Code-Handoff.md` "Continue on `codex/trend-evidence-freshness`".
- Path on this Mac: `/Volumes/Corsair/Github External/Airly Studio External/climbos`, also `~/Documents/GitHub/Airly Studio/climbos` (the parent folder is a symlink to the Corsair drive). On a new Mac: `git clone https://github.com/faisalibnislam/climbos.git && git checkout codex/trend-evidence-freshness`.
- Hosting: Vercel project `climbos` (scope `faisalibnislam`, linked in `.vercel/`). Convex production deployment `kindly-quail-695`, dev deployment `vivid-zebra-520`.
- Related: `docs/Claude-Code-Handoff.md` (very detailed running log of every batch since 2026-10-25; newest entries at the top), `docs/growth-engine/` (per-feature audits, the 410-requirement reconciliation), root `ClimbOS_Growth_Engine_Master_Spec.md`, `docs/ClimbOS-Complete-Product-Specification.md`. No shared packages with other repos.

## 3. Setting up on a new Mac

Toolchain: Node (types target 20; this Mac runs Node 24, exact required version unverified), **pnpm 10.34.5** (`packageManager` field; enable with `corepack enable`), Next.js 16.4.2, React 19.3, Convex 1.47, Vitest 5, Playwright 1.64, Tailwind 4, `tsx`, Python 3 (only for `pnpm growth-intelligence:build`).

```bash
git clone https://github.com/faisalibnislam/climbos.git
cd climbos
git checkout codex/trend-evidence-freshness
corepack enable
pnpm install
npx convex dev --once     # links the Convex dev deployment, writes .env.local
pnpm auth:keys            # Convex Auth signing keys (once per deployment)
pnpm env:sync             # copies server keys from .env.local into the Convex DEV deployment
pnpm dev                  # http://localhost:3000 ; /demo is a seeded fixture workspace
pnpm setup:check          # which keys/approvals are missing (never prints values)
```

No-credentials alternative: `pnpm local:demo` prints the isolated local-backend demo workflow (cached Convex local backend; does not touch `.env.local` or hosted deployments). `pnpm local:real` uses a separate empty local Convex DB for real-output evaluation.

Local env files (gitignored, names only in section 7): `.env.local`, `.env.production.local`, `.env.anthropic.local` (owner-readable, holds only the Anthropic key used by the paid evaluation runner), plus two old backups `.env.local.bak-20261018` and `.env.local.bak-openai`.

Accounts the machine needs: GitHub, Convex (`npx convex login`), Vercel CLI (`vercel link`), and only if doing provider work: Anthropic console, Google AI Studio (Gemini), OpenAI (historical runner), Polar, Resend, Firecrawl, Cloudflare R2, PostHog, Google Cloud/Ads, Meta, LinkedIn, X developer apps. No Apple signing.

## 4. Architecture

Full map: `docs/Architecture.md`.

- **Frontend** (`src/app`): marketing `(marketing)`, `/onboarding`, the app at `/app/[org]/...` (today, plan, content, autopilot, outbound, visibility, pipeline, reviews, pages, images, reels, results, connections, chat, settings), `/ops` operator console (allowlist `OPS_EMAILS`), `/demo`, `/book/[slug]` booking pages, `/l/CODE` tracked links, `/bio`, `/review`, `/report`, `/studio`, `/widget`, `/design-system`, `api/` (OAuth callback, health, preview). Components in `src/components`.
- **Convex** (`convex/`, ~120 modules): `schema.ts` (tenant-scoped, indexes start with `orgId`), `lib/tenancy.ts` (`requireOrgAccess` on every call), `engine.ts` (runs, checkpointed steps, atomic reservations, reconcile-once, recovery), `jobs.ts` (Node actions for the AI roles), `jobWrites.ts`, `publish.ts`/`ads.ts` (approval-checked external writes with receipts written before the call), `lib/approvals.ts` (approval hash binds tenant, content hash, destination, audience, spend, policy version), `billing.ts` (Polar REST + webhook), `connections*.ts` (OAuth, encrypted secrets), `analytics.ts`, `notifications.ts` (Resend), `ops.ts`, `http.ts` (`/webhooks/polar`, `/webhooks/resend`, `/health`, auth), `crons.ts`, `lib/r2.ts`.
- **Shared pure TS** (`shared/`, runs in browser, Node and Convex): `economics/` (rates, entitlements, ledger), `forecasting/`, `attribution/`, `integrations/` (adapters, OAuth/PKCE, SSRF), `policy/` (roles, job state machine, approval checks), `billing/`, `ai/` (`anthropic.ts`, `openai.ts`, `gemini.ts`, `models.ts`, `modelChoice.ts`, `pageFetch.ts`), `agents/` (diagnosis, specs, runtime, offer and timing checks), `knowledge/`, `growth/`, plus many feature folders.
- **AI routing**: since 2026-11-09 owner direction, new text runs use Anthropic (Haiku for research/extraction, Sonnet for strategy, drafts and review) per `docs/Anthropic-and-Simple-Experience-2026-11-09.md`; Gemini for image/video; OpenAI remains as an adapter and historical runner; admin can choose models (`claude/model-selection` branch, `modelChoice.ts`). Note `AGENTS.md` and `docs/Architecture.md` still say "OpenAI-first" (stale; see Gotchas).
- **Knowledge corpus**: `docs/growth-intelligence/` (start at `MASTER_INDEX.md`), `docs/growth-intelligence-2`, `docs/growth-expansion`, `skills/` (compiled into prompts by `pnpm skills:build`). `docs/reference-books*/` hold local book files (gitignored, 327 MB, not on GitHub).
- **Benchmarks** (`bench/`): strategy-quality harnesses (`offline.ts`, `live.ts`, `anthropicLive.ts`), cases, results. `bench/cache/` (1.4 GB, gitignored) holds cached runs **and the paid-call budget ledger**.
- **External services**: Convex, Vercel, Anthropic, Google Gemini, OpenAI (historical), Polar, Resend (platform mail + webhooks), Firecrawl (optional research), Cloudflare R2 (optional storage), PostHog, Google (GA4, Search Console, Ads, PageSpeed, CrUX), Meta (Pages, Instagram, Ads), LinkedIn, X, WordPress, Stripe (read-only).

## 5. Build, run, test

```bash
pnpm dev                 # Next dev server (run `npx convex dev` alongside to push functions)
pnpm build               # production build
pnpm typecheck           # tsc for app and convex
pnpm lint                # eslint
pnpm test                # vitest: unit + convex-test integration
pnpm vitest run --project convex          # Convex tests only (per docs/Operations.md)
pnpm test:e2e            # Playwright (desktop + mobile @mobile); start the app first; E2E_BASE_URL overrides
pnpm strategy:review prepare              # offline industry review packs, no model calls
pnpm econ:export [--rates <id>] [--out file.csv]
pnpm setup:check [--prod]
pnpm bench               # bench/run.ts (uses TMPDIR=/private/tmp/claude-501, a path specific to this Mac)
```

Paid commands (do not run without the owner's explicit go-ahead; paid testing is currently **paused**): `pnpm strategy:anthropic --stage plans --variant improved --confirm-paid`, `pnpm strategy:quality --confirm-paid --cases livoform`.

Before any deploy (docs/Operations.md): `pnpm typecheck && pnpm test && pnpm lint && pnpm build`.

## 6. Release / deploy

- **Every push to `main` deploys the web app to production on Vercel** (GitHub integration; `vercel.json` pins `pnpm install --frozen-lockfile` and `pnpm build`). Pushes to other branches build previews.
- **Convex is not deployed by Vercel.** Production functions go out with `npx convex deploy -y` from a logged-in machine; deploy Convex **before** web code that depends on new functions. (Automating it via `CONVEX_DEPLOY_KEY` + `npx convex deploy --cmd 'pnpm build'` is documented but not set up.)
- No GitHub Actions workflows exist in this repo.
- Version: `package.json` says 0.1.0; there is no release/versioning process. A public `/changelog` page exists.
- **Owner authority as of 2026-11-18** (`docs/Claude-Code-Handoff.md`): verified pushes to `codex/trend-evidence-freshness` are allowed; **no deployment, no PRs, no merges to main, no real customer actions** (posts, messages, launches, prices, ad spend) without a new explicit instruction. Merging this branch into main would deploy ~213 commits plus additive schema changes that need `npx convex deploy` first.

## 7. Secrets and accounts (locations only, never values)

| Secret | Where it lives | New Mac |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `CLIMBOS_SERVER_SECRET` | Vercel project env; local copies in `.env.local` / `.env.production.local` | `vercel env pull` or `npx convex dev --once` |
| `JWT_PRIVATE_KEY`, `JWKS` | Convex deployment env (`pnpm auth:keys`) | Nothing to move |
| `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `AUTH_RESEND_KEY`, `RESEND_FROM`, `RESEND_WEBHOOK_SECRET`, `POLAR_SERVER`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `FIRECRAWL_API_KEY`, `OPS_EMAILS`, `SITE_URL`, `CUSTOM_AUTH_SITE_URL`, `CLIMBOS_ENCRYPTION_KEY`, `CLIMBOS_ENCRYPTION_KEY_ID`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `AUTH_GOOGLE_ID`/`SECRET`, `GOOGLE_OAUTH_CLIENT_ID`/`SECRET`, `GOOGLE_ADS_*`, `GOOGLE_PAGESPEED_API_KEY`, `GOOGLE_CRUX_API_KEY`, `META_APP_ID`/`SECRET`, `META_ADS_ACCESS_TIER`, `INSTAGRAM_APP_ID`/`SECRET`, `LINKEDIN_CLIENT_ID`/`SECRET`, `X_CLIENT_ID`/`SECRET` | Convex deployment env (prod `kindly-quail-695`, dev `vivid-zebra-520`), pushed from local env files with `pnpm env:sync [--prod --file .env.production.local]`. Full list and setup: `docs/ProviderSetup.md` | Nothing to move unless working locally; never change `CLIMBOS_ENCRYPTION_KEY` without migrating stored secrets |
| Local-only dev flags `NEXT_PUBLIC_ENABLE_DEV_LOGIN`, `ANTHROPIC_WORKSPACE_ID` | `.env.local` (never in production) | Recreate |
| Anthropic key for paid evaluations | `.env.anthropic.local` (repo root, gitignored, mode 600) | Copy securely only if the owner wants paid runs on the new Mac |
| **Paid-call budget ledger** (not a secret, but must not be lost or reset) | `bench/cache/anthropic-real-2026-11-09/budget.json` (gitignored). Cumulative $100 cap, $99.063401 used/held as of 2026-11-18 | Copy `bench/cache/` (or at least that folder) to the new Mac before any paid run |
| `CONVEX_DEPLOY_KEY` | Not set anywhere yet (Convex deploys are manual) | — |

## 8. Rules and conventions

Read `AGENTS.md`, `README.md`, `docs/Claude-Code-Handoff.md` (top entries), `docs/Architecture.md`, `docs/SecurityAndData.md`, and for a task, `docs/growth-intelligence/MASTER_INDEX.md`. Rules most likely to be broken:

- Next.js 16 has breaking changes: read `node_modules/next/dist/docs/` first. `next dev` re-adds the agent-rules block to `AGENTS.md`.
- **Never** deploy, open PRs, merge to main, or take real customer actions without explicit owner instruction. Paid model calls are paused; never reset or delete the budget ledger.
- **Preserve the local `.gitignore` modification** (uncommitted on purpose per the existing handoff); do not commit or revert it unless the owner says so.
- Every Convex call checks tenancy with `requireOrgAccess`; external writes need a matching approval rechecked right before execution; receipts are written before provider calls and uncertain outcomes are never blindly retried.
- Keep measured, owner-reported, source-reported, assumed, inferred and calculated values distinct; never invent business inputs (revenue, customers, budgets); deterministic code does the arithmetic.
- No automated community activity (Reddit/forum posts, DMs), no review gating or rewards, no fabricated scarcity.
- Customer-facing content stays brand-neutral; preserve grounded / adjacent / bold strategy options.
- Each change batch gets an audit doc in `docs/growth-engine/` and a dated entry at the top of `docs/Claude-Code-Handoff.md`, with honest limits.

## 9. Current state (as of 2026-11-21)

Focused revisions can replace one complete strategy option while preserving the others. Offline replay reproduced the complete comparison-v4 result using just its changed bold option.

Focused originality review now binds the decision to the exact bold metric and continue rule. See the [Livoform offline strategy review](docs/growth-engine/livoform-offline-strategy-2026-11-21.md) for the saved failure, paired tests and editorial options.

A second WordPress fixture exercises actual WordPress 6.8.3 with its bundled Twenty Twenty-Five theme. It verifies raw draft content, six rendered page states and native revision recovery after capturing an explicit baseline. The fixture runs in memory and adds no app dependency.

Blog articles support a private WordPress page-copy rehearsal. The owner can save original copy, edit a proposal, preview at 390 and 1280 pixels, approve it for the rehearsal, and recover the original. The separate private-draft connector now binds the exact reviewed title, body version, approval and destination, and checks the raw saved body. Verified using local fixtures only.

All 100 creative cases now cite a source for a reported outcome. In 51 cases the source is the organization or a participant. A disposable Convex recovery drill verified a restored workspace, exact transcript text and tenant isolation. Run `python3 scripts/rehearse-local-restore.py` with local ports 3330 and 3331 free. Customer progress supports local microphone recordings and optional device-only transcription. The Customer progress page also surfaces recurring conversation topics from permissioned transcripts, with source links. Focused strategy review checks subscription eligibility quotes against the cited page read or labeled business fact. Offline replay preserves historical review failures. The Visibility page now supports opt-in repeat checklists and independently sampled citation comparisons. See the [execution record](docs/growth-engine/remaining-work-execution-2026-11-19.md) for coverage and limits. The handoff and ignore rules were committed in `8ebe0d93`.

**Earlier branch inventory (19 November):**
- Unpushed: local `main` is 3 commits ahead of `origin/main` (merge of "AI-led onboarding, focused plans and local quality evaluation"); `growth-engine-v2` is 2 ahead of its remote. Both are already contained in the pushed `codex/trend-evidence-freshness`.
- Local-only branch: `claude/strange-germain-c51138` (a 2026-10-26 merge of PR #5, already in main).
- Stashes: none. Worktrees: none besides the main checkout (`.claude/worktrees/` exists but is empty of registered worktrees).
- Gitignored local data not on GitHub: `bench/cache/` (1.4 GB, includes the paid budget ledger), `docs/reference-books/` and `docs/reference-books-2/` (327 MB of book files), env files.

**Recent activity (last ~20 commits, 2026-11-18 to 2026-11-19, newest first):** permissioned conversation-transcript review in deals; exact scheduled email delivery with cancel/expiry; source-backed product funnels for people and accounts; contact-erasure completeness; resuming product events after a manual correction; authenticated product milestones feeding customer progress; exact email-audience review; lifecycle planning from saved follow-up state; owner-reviewed customer follow-up journeys; owner workflow verification and full-requirements reconciliation (410 items); strategy evidence replay and offline audit fixes; many strategy-quality repairs (originality bound to the comparison test, numeric evidence checks, research restrictions, creative context across checkpoint resumes). Commit volume: 48 on 11-16, 99 on 11-17, 54 on 11-18, 9 on 11-19.

**What works:** production (older main) at climbos.app; locally, the branch passes focused test suites per batch (each audit in `docs/growth-engine/` lists its exact tests). Full-suite status today is unverified.

**Half-done / honest limits (from `docs/growth-engine/requirements-scope-2026-11-18.md`):** saved Livoform plan quality still fails acceptance checks; 2 of 4 synthetic industry cases pass (science, creator; healthcare and retail below the bar); authenticated event intake and exact approved email delivery exist, while live setup and recurring journeys remain open; real provider flows need credentials and platform approvals; schema changes on the branch are additive and undeployed; tester access and founder time unknown.

## 10. Next steps / open work

For later authorized generation, inspect whether the writer uses option-level repairs and preserves earlier strengths. The saved replay verifies reconstruction only.

Fresh Livoform originality and reviewer calibration remain unverified under the paid-call pause. Compare future recommendations with the paired-control examples when evaluation resumes.

Keep WordPress verification on local fixtures per the owner. The disposable installation covers one core version and stock theme. Customer themes, plugins, hosting permissions and live change recovery remain unverified.

1. Get the owner's decision on shipping: merge `codex/trend-evidence-freshness` into main (deploy Convex first with `npx convex deploy -y`, then push main) or keep developing on the branch. Do not do this without explicit approval.
2. Continue the requirement gaps listed as partial/unverified in `docs/growth-engine/requirements-reconciliation-2026-11-18.md` and `requirements-scope-2026-11-18.md` (independent strategy acceptance for Livoform, healthcare and retail cases after page-bound plan review; lifecycle telemetry; email/semantic consistency).
3. Paid evaluation is paused at $99.063401 of the $100 cap; any further paid testing needs a new owner budget.
4. Keep commercial transfer and causal claims unverified unless new evidence supports them. All 100 cases have a cited observation, including program activity and research output.
5. From `docs/ProductRoadmap.md` (older, 2026-10-18): asset library (#13), Google Business Profile API for reviews, auto top-up via Polar.
6. Resolve the provider-direction contradiction: update `AGENTS.md` / `docs/Architecture.md` ("OpenAI-first") to match the Anthropic routing actually in use (guess: docs are stale; confirm with the owner).
7. Confirm the production backup and key-recovery process with the operator. The disposable local drill uses synthetic records. Consider automating Convex deploys (`CONVEX_DEPLOY_KEY` in Vercel) so web and functions cannot drift.
8. Verify recording and speech accuracy on real consenting users’ devices, including installed language coverage. Check conversation-topic usefulness with owner-supplied records. Verify manual repeat checks with a real owner panel. Automatic provider collection requires authorized access.

## 11. Gotchas

- `origin/main` is far behind the real work; checking out `main` on a new Mac gives a version from 2026-10-28. Work on `codex/trend-evidence-freshness`.
- Pushing to `main` deploys only the web app; Convex functions must be deployed by hand first, or the site calls functions that do not exist.
- `pnpm env:sync` without `--prod` targets dev; with `--prod` it writes production secrets. The 2026-11-09 doc says it must not be used against a hosted deployment during evaluation work.
- The paid runners read `.env.anthropic.local` directly and refuse to run without `--confirm-paid`; they strip other provider keys from the environment. A lock file (`budget.lock`) guards the ledger; a stale lock after a crash blocks runs.
- `pnpm bench` hardcodes `TMPDIR=/private/tmp/claude-501`, which exists only for this Mac's user; adjust on another machine.
- Playwright e2e needs the app running; calendar/design suites can use a dedicated fixture backend (`CLIMBOS_CALENDAR_E2E_ENV_FILE`, `CLIMBOS_DESIGN_E2E_ENV_FILE`) with one worker.
- `AGENTS.md` says "Keep the OpenAI-first engine", while README and the 2026-11-09 owner direction route text to Anthropic Haiku/Sonnet. Follow the newest owner direction recorded in `docs/Claude-Code-Handoff.md`.
- Demo workspaces use fixture adapters only; production adapters never return fake success. A passing fixture is not evidence of real provider behaviour.
- `docs/Claude-Code-Handoff.md` is a long append-at-top log; read the top dated entries, not the whole file.
- The repo lives on the external Corsair drive (`~/Documents/GitHub/Airly Studio` is a symlink). Large ignored folders (`bench/cache`, reference books) will not come with a clone.

## 12. Change log

- 2026-11-21 — Enabled focused revisions of individual grounded, adjacent and bold options with full-plan validation.

- 2026-11-21 — Required a bold test’s measure and continuation rule to support the claimed comparison. Replayed 47 Livoform focused-plan files offline.

- 2026-11-21 — Verified WordPress core private draft read-back and explicit baseline revision recovery with desktop and mobile renders of the default theme.

- 2026-11-21 — Added versioned page-copy rehearsal and recovery to the existing article editor. Fixed stale WordPress confirmations, headline selection, duplicate worker attempts and incomplete read-back verification.

- 2026-11-21 — Added consented browser-local audio capture and optional on-device transcription to the existing deal import.

- 2026-11-21 — Researched the 27 remaining outcome-source gaps and added dated, attributable observations to the runtime case library.

- 2026-11-21 — Rehearsed snapshot recovery on two fresh local instances and verified access after restoration.

- 2026-11-21 — Added a local cross-transcript topic view and exercised it and the AI-search checklist on desktop and mobile.

- 2026-11-21 — Bound plan eligibility reviews to actual page excerpts and corrected offline replay verdicts.

- 2026-11-21 — Added manual AI-search check schedules, missed-check reporting and protected the comparison baseline on busy panels.

- 2026-11-19 — Handoff created.
