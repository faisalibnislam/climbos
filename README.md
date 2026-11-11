# ClimbOS

**Your AI growth team.** Tell ClimbOS your business goal. Ten coordinated AI specialists research your business, build a costed growth plan, create the work and measure what happens. You approve anything that goes live.

- Web: Next.js 16 (App Router) on Vercel · `climbos.app`
- Backend: Convex (state, auth, durable jobs, crons, webhooks)
- AI: Anthropic Haiku/Sonnet for new text workflows; optional explicit legacy/provider overrides; Google Gemini for image/video generation (direct, no gateway)
- Billing: Polar (merchant of record) · Platform email: Resend · Research: built-in fetcher or Firecrawl

```
User → "Help Formkit get more paying customers in 90 days, $600/mo ads"
     → research (sourced facts you confirm) → growth plan (you approve)
     → drafts (social, ads, email, SEO, landing pages) → approval → publish / export → results & forecasts
```

## Isolated local review

For a local database, synthetic data and no paid provider credentials, use the [isolated demo workflow](docs/Local-Audit-2026-11-09.md#run-the-isolated-demo). Run `pnpm local:demo` for commands. The launcher uses a cached Convex local backend and does not change `.env.local` or configure a hosted deployment.

The latest local work implements the tracked buildable specification gaps, preserves unknown financial inputs, and adds bounded search/design checks and manual launch/profile preparation. The owner experience now uses four main destinations and Focused tabs, with 14/30/90-day cycles, continuing reviews, AI preparation and choice-based questions. See the [implementation record](docs/Specification-Completion-2026-11-09.md) and [AI acceptance results](bench/strategy-quality/RESULTS-2026-11-09.md). The live quality tests did not establish expert-level recommendations; this remains local, unreleased work.

## Start with your configured Convex deployment

The following workflow can link to a hosted development deployment. It is separate from the isolated local review above.

```bash
pnpm install
```

```bash
npx convex dev --once          # links the Convex dev deployment and writes .env.local
```

```bash
pnpm auth:keys                 # generates sign-in keys in Convex (once per deployment)
```

```bash
pnpm env:sync                  # copies server keys from .env.local into Convex
```

```bash
pnpm dev                       # http://localhost:3000
```

- Open **http://localhost:3000/demo** for a seeded Formkit workspace. It uses synthetic data and fixture adapters; nothing posts, emails or spends.
- `pnpm setup:check` shows which keys and approvals are missing. Values are never printed.
- `/ops` opens for emails listed in `OPS_EMAILS`.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server (Convex functions are pushed by `npx convex dev`) |
| `pnpm local:demo` | Instructions for a separate fixture backend and frontend; no hosted configuration or paid provider keys |
| `pnpm strategy:review prepare` | Export eight offline industry review packs; no model calls |
| `pnpm build` | Production build |
| `pnpm test` | Unit (economics, forecasting, attribution, integrations, billing/policy) plus Convex integration tests |
| `pnpm test:e2e` | Playwright end-to-end and accessibility tests (start the app first) |
| `pnpm typecheck` / `pnpm lint` | TypeScript and ESLint |
| `pnpm econ:export [--rates <id>] [--out file.csv]` | Economics CSV and the 30% stress-margin gate |
| `pnpm setup:check [--prod]` | Configuration presence check |
| `pnpm env:sync [--prod --file …]` | Push server env to Convex |
| `pnpm auth:keys` | Generate Convex Auth keys |
| `node scripts/polar-setup.mjs` | Create Polar sandbox products and write their ids |

## Documentation

- [Architecture](docs/Architecture.md): the system map, job engine and approval-bound execution
- [Capabilities](docs/Capabilities.md): current product workflows, connection states, and honest limits
- [Pricing & economics](docs/PricingAndEconomics.md): plans, margins, formulas and enforcement
- [Security & data](docs/SecurityAndData.md): tenancy, secrets, webhooks, SSRF, retention, deletion
- [Forecasting](docs/Forecasting.md): attribution, backtests, intervals, scenarios
- [Provider setup](docs/ProviderSetup.md): every key, webhook and approval needed
- [Operations](docs/Operations.md): `/ops`, crons, incidents, backups, deploys
- [Verification](docs/Verification.md): what was tested and how

## Status

The repository contains implemented planning, drafting, approval, demo and integration paths. Automated fixture tests verify specific behavior; they do not establish expert strategy quality, complete specification coverage or business results. The latest [local audit](docs/Local-Audit-2026-11-09.md) records changes, verification and remaining work. Live provider behavior requires credentials and, where applicable, provider approvals. Older live-verification records in [Verification](docs/Verification.md) are dated historical evidence.


The historical OpenAI quality runner remains available separately: `pnpm strategy:quality --confirm-paid --cases livoform`. It requires an existing `OPENAI_API_KEY` environment variable, sends public/synthetic briefs to OpenAI, and uses a persistent cumulative $2 reservation ledger. It makes paid calls; `pnpm strategy:review` remains offline. Read [the evaluation instructions](bench/strategy-quality/README.md) before using it. A local app does not make an OpenAI API call local inference.

Current local real-business evaluation: `pnpm strategy:anthropic --stage plans --variant improved --confirm-paid`. This makes paid Anthropic calls under the owner-authorized cumulative $100 ledger; do not delete/reset the ledger. `pnpm local:real` uses a separate empty local Convex database for real outputs. See [Anthropic routing, cost controls and the simpler experience](docs/Anthropic-and-Simple-Experience-2026-11-09.md).
