# Operations runbook

## Operator console (`/ops`)

Access requires a signed-in, non-anonymous user whose email is in `OPS_EMAILS`. Everyone else gets a "not found" page, and the backend refuses independently. Every operator action is written to the audit log.

| Panel | What to look for | Action |
|---|---|---|
| Health | Fleet stop, provider circuit breakers (open after 5 consecutive failures, half-open after 60s) | Reset a circuit after a provider incident |
| Jobs needing attention | Failed (7 days), **uncertain** outcomes, stuck runs (>10 min), unresolved reservations | Check the provider directly, then **Resolve** an uncertain run as verified or failed. This reconciles its reservation. |
| Webhooks | Failed or lagging Polar and Resend events | Retry (bounded to 5 attempts). Cron also retries every 15 min. |
| Costs & margin | 24h spend by provider, 7-day estimate vs actual, runs over estimate, preview spend | If actual exceeds estimate repeatedly, review token budgets in `shared/ai/tasks.ts` |
| Economics | 15 plan/profile rows for any rate version, margin gate status, CSV download | If the gate fails for a new rate version, don't enable it. Reprice, or reduce caps. |
| Reconciliation | Monthly revenue vs provider-reported variable cost by plan, unresolved reservation value | Compare with vendor invoices (Vercel, Convex, Resend, Firecrawl, Polar payouts) |
| Fleet controls | Fleet emergency stop (blocks all new chargeable work, every tenant), preview budget | Use during incidents. Customers keep read and export. |

## Scheduled jobs (`convex/crons.ts`)

| Job | Cadence |
|---|---|
| Recover stuck runs | Every 5 min |
| Retry failed webhooks | Every 15 min |
| Reconcile subscriptions with Polar | Daily 04:10 UTC |
| Purge raw research excerpts (30 days), previews (30 days), demos (7 days), step outputs (90 days) | Daily 05:00–05:45 UTC |
| Sync GA4 and Stripe | Daily 06:00 UTC |
| Token expiry checks | Daily 06:30 UTC |
| Digests (daily users every day, weekly users on Mondays) | Daily 13:00 UTC |

## Incident playbooks

- **AI provider outage.** Circuits open automatically and jobs fall back cross-provider, each with its own reservation. If both providers are down, jobs fail with "AI providers aren't available" and only the calls actually made are charged. Reset circuits once the provider recovers.
- **Cost spike.** Turn on the fleet stop if needed, inspect *Costs & margin*, lower the preview budget, and check for a rate change.
- **Rate rollback.** Rate versions are code (`shared/economics/rates.ts`). Roll back by deploying the previous version. Every job keeps the rate version it was priced with.
- **Polar outage or late webhooks.** Access isn't granted until events arrive. The daily reconciliation, and the manual retry in `/ops`, fix late or out-of-order state.
- **Uncertain publish.** The receipt stays *uncertain* and is never retried blindly. Check the platform, then resolve it in `/ops`.
- **Ad spend concern.** The customer presses *Pause all activity*. ClimbOS requests pauses and reports confirmed or unknown per campaign. Platforms can still report small amounts of spend after the pause.

## Backups and restore

- Convex keeps point-in-time backups on paid plans. Use the dashboard's *Backup & Restore* to snapshot before risky migrations.
- To verify a restore: restore into a dev deployment, then run `pnpm vitest run --project convex` against code at the same commit, and spot-check a demo workspace.
- Workspace exports (Settings → Privacy) let customers keep their own copy.

## Deploys

| Piece | Where | How |
|---|---|---|
| Web (Next.js) | Vercel project `climbos` (`faisalibnislam`), domains `climbos.app` and `www.climbos.app` (308 to apex) | Every push to `main` deploys to production via the GitHub integration. `vercel.json` pins the framework, install and build commands. |
| Backend (Convex) | Production deployment `kindly-quail-695` (dev: `vivid-zebra-520`) | `npx convex deploy -y` from a logged-in machine. To automate it in Vercel, create a production deploy key in the Convex dashboard, add it as `CONVEX_DEPLOY_KEY`, and set the build command to `npx convex deploy --cmd 'pnpm build'`. |

Deploy the Convex functions **before** pushing web code that depends on new functions. Before either, run `pnpm typecheck && pnpm test && pnpm lint && pnpm build`.
