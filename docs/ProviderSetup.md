# Provider setup

Run `pnpm setup:check` (or `pnpm setup:check --prod`) at any time. It lists what's missing without printing values. Put server values in `.env.local`, then run `pnpm env:sync` (dev) or `pnpm env:sync --prod --file .env.production.local`. That copies them into the Convex deployment.

## 1. Convex

- The project is `climbos` in team `faisal-islam`. The dev deployment is `vivid-zebra-520`; the **production** deployment is `kindly-quail-695` (`https://kindly-quail-695.convex.cloud`, HTTP actions at `https://kindly-quail-695.convex.site`). `npx convex dev` writes `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL`.
- Run `pnpm auth:keys` once per deployment (`node scripts/generate-auth-keys.mjs --prod` for production). It sets `JWT_PRIVATE_KEY` and `JWKS`.
- Set `SITE_URL` (for example `https://climbos.app`), `OPS_EMAILS`, `CLIMBOS_SERVER_SECRET` (must equal the web app's value), `CLIMBOS_ENCRYPTION_KEY` (`openssl rand -base64 32`) and `CLIMBOS_ENCRYPTION_KEY_ID`.

## 2. AI providers

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | Models `claude-sonnet-5-5` and `claude-haiku-5-5` (verified 17 Oct 2026). The web search tool is `web_search_20250305` at $10 per 1k searches. |
| `GEMINI_API_KEY` | Models `gemini-3.8-flash` and `gemini-3.1-flash-lite`. Images use `gemini-3.1-flash-lite-image`. `gemini-2.5-flash-image` was shut down on 2 Oct 2026. |

Without keys, real workspaces show "AI providers aren't available". The demo still works on fixtures.

## 3. Resend (platform email: sign-in codes, invitations, alerts, digests)

1. Verify **climbos.app** in Resend (SPF/DKIM DNS records on Vercel DNS).
2. Set `AUTH_RESEND_KEY` and `RESEND_FROM="ClimbOS <hello@climbos.app>"`.
3. Add a webhook at `https://<deployment>.convex.site/webhooks/resend` for the events `email.delivered`, `email.bounced` and `email.complained`. Set `RESEND_WEBHOOK_SECRET` (`whsec_…`).

Customer marketing never goes through this account. Customers connect their own Resend key in Connections.

## 4. Polar (billing)

1. Create a **sandbox** organization at sandbox.polar.sh and an organization access token with product, checkout, subscription and customer-session scopes. Set `POLAR_SERVER=sandbox` and `POLAR_ACCESS_TOKEN`.
2. Create products. Either run `node scripts/polar-setup.mjs` (it creates the plans and the pack in the sandbox and prints the product ids) or create them by hand:
   - Monthly recurring: Basic $19, Starter $169, Growth $449, Pro $999, Business $2,299.
   - One-time: "Extra capacity pack" $29.
   - Set `POLAR_PRODUCT_BASIC`, `_STARTER`, `_GROWTH`, `_PRO`, `_BUSINESS` and `_BOOST_29`.
3. Add a webhook at `https://<deployment>.convex.site/webhooks/polar` for the events `subscription.created`, `.active`, `.updated`, `.canceled`, `.uncanceled`, `.past_due`, `.revoked`, `.cycled`, `order.created`, `order.paid`, `order.updated`, `order.refunded`, `checkout.updated` and `customer.state_changed`. Set `POLAR_WEBHOOK_SECRET`.
4. Test the full cycle in the sandbox: checkout → `order.paid` → allowance granted, then upgrade, top-up, refund and cancel.
5. Before production, confirm with Polar:
   - seller eligibility and product acceptance;
   - payout country and currency;
   - whether prices are tax-inclusive or tax-exclusive (ClimbOS prices exclude tax);
   - the actual fee schedule. The model assumes Polar Starter, 5% + $0.50, plus 1.5% for non-US cards. Do **not** assume an Early Member tariff.

## 5. Google sign-in (optional)

Create an OAuth client (type Web) in Google Cloud. Set the redirect URI to `https://<deployment>.convex.site/api/auth/callback/google`. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in Convex and `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` in the web env.

## 6. Integrations (optional; missing values show "Setup needed")

| Integration | Variables | Provider approvals needed before customer use |
|---|---|---|
| GA4 + Search Console | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. Redirect URI: `https://climbos.app/api/oauth/callback`. Scopes: `analytics.readonly`, `webmasters.readonly`. | Google OAuth consent screen verification (sensitive scopes) |
| Google Ads (API v26) | Same client plus `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_ACCESS_LEVEL` (test, explorer, basic or standard) | Developer token **Basic or Standard** access. Test access can't touch production accounts. Permissible-use review. |
| Facebook Pages + Meta Ads (Graph v26.0) | `META_APP_ID`, `META_APP_SECRET`, `META_ADS_ACCESS_TIER` (limited or full) | App Review for `pages_manage_posts`, `pages_read_engagement`, `ads_management` and `ads_read`; Business Verification; Marketing API access tier |
| Instagram (Instagram Login) | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | App Review for `instagram_business_basic` and `instagram_business_content_publish`. Business or Creator accounts only. |
| Firecrawl | `FIRECRAWL_API_KEY` | None. Without it, the built-in bounded fetcher is used. |
| Cloudflare R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Recognized, but the adapter isn't wired yet; Convex storage is used |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | None. Session replay is off and text is masked. |

Customers connect Stripe (a **restricted read-only** key) and their own Resend key themselves in Connections. Neither needs platform setup.

## 7. Vercel

- **Project and repository.** Link the project to GitHub `faisalibnislam/climbos` and set the framework to Next.js. Domain: `climbos.app` (already on Vercel).
- **Environment variables (Production):**
  - `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`: the **production** Convex deployment.
  - `NEXT_PUBLIC_SITE_URL=https://climbos.app`
  - `CLIMBOS_SERVER_SECRET`: same value as in Convex prod.
  - `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`, and optionally `NEXT_PUBLIC_POSTHOG_*`.
- **Done on 17 Oct 2026:** the project is linked to GitHub, the framework is set to Next.js, production and preview variables are set, and `climbos.app` and `www.climbos.app` are attached. Production webhooks therefore point at `https://kindly-quail-695.convex.site/webhooks/polar` and `/webhooks/resend`.
- **Optional:** build with `npx convex deploy --cmd 'pnpm build'` plus `CONVEX_DEPLOY_KEY` so that Convex and the site deploy together.
