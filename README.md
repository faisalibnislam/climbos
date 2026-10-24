# ClimbOS

**Your AI growth team.** Tell ClimbOS your business goal. Ten coordinated AI specialists research your business, build a costed growth plan, create the work and measure what happens. You approve anything that goes live.

- Web: Next.js 16 (App Router) on Vercel · `climbos.app`
- Backend: Convex (state, auth, durable jobs, crons, webhooks)
- AI: OpenAI for text models and Google Gemini for image/video generation (direct, no gateway)
- Billing: Polar (merchant of record) · Platform email: Resend · Research: built-in fetcher or Firecrawl

```
User → "Help Formkit get more paying customers in 90 days, $600/mo ads"
     → research (sourced facts you confirm) → growth plan (you approve)
     → drafts (social, ads, email, SEO, landing pages) → approval → publish / export → results & forecasts
```

## Quick start (local)

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

The application, data model, job engine, economics, billing logic, approvals, demo and all screens are built and tested locally. Live provider behaviour requires the owner's credentials and, for ads and social publishing, provider approvals. See [Provider setup](docs/ProviderSetup.md) and the *Adapter verification* table in [Verification](docs/Verification.md). Nothing in this repository claims a provider approval that hasn't been granted.
