# Provider setup

Run `pnpm setup:check` (or `pnpm setup:check --prod`) at any time. It lists what's missing without printing values. Put server values in `.env.local`, then run `pnpm env:sync` (dev) or `pnpm env:sync --prod --file .env.production.local`. That copies them into the Convex deployment.

## 1. Convex

- The project is `climbos` in team `faisal-islam`. The dev deployment is `vivid-zebra-520`; the **production** deployment is `kindly-quail-695` (`https://kindly-quail-695.convex.cloud`, HTTP actions at `https://kindly-quail-695.convex.site`). `npx convex dev` writes `NEXT_PUBLIC_CONVEX_URL` and `NEXT_PUBLIC_CONVEX_SITE_URL`.
- Run `pnpm auth:keys` once per deployment (`node scripts/generate-auth-keys.mjs --prod` for production). It sets `JWT_PRIVATE_KEY` and `JWKS`.
- Set `SITE_URL` (for example `https://climbos.app`), `OPS_EMAILS`, `CLIMBOS_SERVER_SECRET` (must equal the web app's value), `CLIMBOS_ENCRYPTION_KEY` (`openssl rand -base64 32`) and `CLIMBOS_ENCRYPTION_KEY_ID`.

## 2. AI providers

| Variable | Notes |
|---|---|
| `OPENAI_API_KEY` | Required in the Convex deployment for real text-agent work. Both Basic and Expert runs start on `gpt-6-luna`. In an explicitly selected Expert run, only eligible agents can use `gpt-6.1-sol` for a revision after the critic reports an eligible issue with evidence. This is a bounded revision route, not a workspace-wide model switch. There is no silent provider fallback. |
| `GEMINI_API_KEY` | Optional in setup checks; used for configured image and video generation routes. Image model IDs and per-attempt planning allowances are in `shared/ai/models.ts`; video generation is separately metered. Missing Gemini configuration does not disable OpenAI text work. |

Without `OPENAI_API_KEY`, real text-agent work is unavailable; the demo still works on fixtures. Without `GEMINI_API_KEY`, the configured image/video generation routes are unavailable while text work can continue.

These are **server-side Convex secrets**. Put them in `.env.local` for development or `.env.production.local` for production, then use `pnpm env:sync` or `pnpm env:sync --prod --file .env.production.local`; `scripts/env-sync.mjs` copies these values to Convex and does not put them in browser variables. `pnpm setup:check` reports whether the required OpenAI key is present and whether optional Gemini setup is present without printing secret values.

For the code-controlled routes and exact API model IDs, see [`shared/agents/routes.ts`](../shared/agents/routes.ts), [`shared/ai/models.ts`](../shared/ai/models.ts), and [`convex/ai/providers.ts`](../convex/ai/providers.ts). A configured key does not by itself prove that the provider account can access every model or that a request will succeed. Check the current [OpenAI model catalog](https://developers.openai.com/api/docs/models/all) and [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models) when changing a route; provider model availability can change independently of this repository.

ClimbOS's reservation and cost reports use the versioned rate snapshots in [`shared/economics/rates.ts`](../shared/economics/rates.ts), not a live provider price lookup. The snapshot records its source and effective date and can differ from an invoice because of later price changes, account terms, provider-side caching, or other billable features. Recheck the official [OpenAI API pricing](https://developers.openai.com/api/docs/pricing) and [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) before updating rates; do not treat ClimbOS estimates as a provider quote.

## 3. Resend (platform email: sign-in codes, invitations, alerts, digests)

**Done on 17 Oct 2026:**
- **Domain.** `climbos.app` was added to Resend (us-east-1, send-only, open and click tracking off). Its DNS records were added on Vercel DNS: DKIM `resend._domainkey` TXT, SPF `send` MX + TXT, return-path `rsend` CNAME, and a monitor-only `_dmarc` TXT (`p=none`).
- **Webhooks.** These are created for `email.delivered`, `email.bounced`, `email.complained`, `email.failed` and `email.suppressed`, at:
  - prod: `https://kindly-quail-695.convex.site/webhooks/resend`
  - dev: `https://vivid-zebra-520.convex.site/webhooks/resend`
- **Webhook secrets.** Their signing secrets are set as `RESEND_WEBHOOK_SECRET` directly on each Convex deployment.
- **Sender.** `RESEND_FROM="ClimbOS <hello@climbos.app>"`.

**Left to do:**
1. Create an API key in Resend with **Sending access**, limited to the `climbos.app` domain.
2. Put it in `AUTH_RESEND_KEY` in both env files and run the sync.

The sign-in page shows email sign-in once the key is present in Convex. No rebuild is needed.

Customer marketing never goes through this account. Customers connect their own Resend key in Connections.

## 4. Polar (billing)

Everything except the token is scripted. `pnpm polar:setup --file <env file> --sync` does the following:
- creates (or reuses) the five monthly plans and the one-off capacity pack: Basic $19, Starter $169, Growth $449, Pro $999, Business $2,299, Extra capacity pack $29;
- creates (or updates) the webhook endpoint `<NEXT_PUBLIC_CONVEX_SITE_URL>/webhooks/polar` with every event ClimbOS processes;
- writes `POLAR_PRODUCT_*` and `POLAR_WEBHOOK_SECRET` into the env file, then copies them into the matching Convex deployment.

Steps:
1. At **sandbox.polar.sh**, create an organization. Then go to Settings → Developers → New token, and create an organization access token with these scopes:
   - `products:read` and `products:write`
   - `checkouts:read` and `checkouts:write`
   - `customer_sessions:write`
   - `customers:read` and `customers:write`
   - `subscriptions:read` and `subscriptions:write`
   - `orders:read`
   - `refunds:read`
   - `webhooks:read` and `webhooks:write`
2. Put it in `POLAR_ACCESS_TOKEN`, with `POLAR_SERVER=sandbox`, in **both** env files. Each environment gets its own webhook and secret, so dev and prod get separate endpoints in the same sandbox organization.
3. Run the setup for each env file:
   - `pnpm polar:setup --file .env.local --sync`
   - `pnpm polar:setup --file .env.production.local --sync`
4. Test the full cycle in the sandbox: checkout → `order.paid` → allowance granted. Then try an upgrade, a top-up, a refund and a cancellation.
5. For real payments, repeat steps 1–3 on polar.sh with `POLAR_SERVER=production`. Before that, confirm with Polar:
   - seller eligibility and product acceptance;
   - payout country and currency;
   - whether prices are tax-inclusive or tax-exclusive (ClimbOS prices exclude tax);
   - the actual fee schedule. The model assumes Polar Starter, 5% + $0.50, plus 1.5% for non-US cards. Do **not** assume an Early Member tariff.

## 5. Google sign-in

OAuth runs on our own domain. `CUSTOM_AUTH_SITE_URL` on the Convex deployment points Convex Auth at the site, and `next.config.ts` proxies `/api/auth/signin/*` and `/api/auth/callback/*` to the deployment. Google therefore only ever sees climbos.app. The "Continue with Google" button appears by itself once both Google values exist in Convex; no rebuild is needed.

**Done on 17 Oct 2026:**
- `CUSTOM_AUTH_SITE_URL` is set to `https://climbos.app` (prod) and `http://localhost:3000` (dev).
- The proxy routes are deployed.

**Left to do in Google Cloud:**
1. Create a project, for example "ClimbOS".
2. **OAuth consent screen (Google Auth Platform → Branding).**
   - App name "ClimbOS", support email, logo optional.
   - Home page `https://climbos.app`, privacy policy `https://climbos.app/privacy`, terms `https://climbos.app/terms`.
   - Authorized domain `climbos.app`.
   - Audience: External, and **publish** the app.
   - Sign-in uses only `openid`, `email` and `profile`, so no Google verification review is needed for sign-in.
3. **Clients → Create client → Web application.**
   - Authorized JavaScript origins: `https://climbos.app` and `http://localhost:3000`.
   - Authorized redirect URIs: `https://climbos.app/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`.
4. Put the client ID and secret in `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in both env files, and run the sync.
5. *Optional:* the same Google Cloud project can hold the separate GA4 / Search Console / Ads OAuth client described below. Those scopes do need verification.

## 6. Integrations (optional; missing values show "Setup needed")

| Integration | Variables | Provider approvals needed before customer use |
|---|---|---|
| GA4 + Search Console | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. Redirect URI: `https://climbos.app/api/oauth/callback`. Scopes: `analytics.readonly`, `webmasters.readonly`. | Google OAuth consent screen verification (sensitive scopes) |
| Mobile site checks | `GOOGLE_PAGESPEED_API_KEY` (optional), `GOOGLE_CRUX_API_KEY` (optional) | PageSpeed runs one synthetic mobile Lighthouse check for performance, accessibility, and basic SEO signals on a page ClimbOS already read. SEO checks do not confirm indexing or rankings; accessibility checks are not a WCAG audit. The CrUX key enables 28-day aggregated phone performance metrics; without it, field data is shown as not configured. Create the key for Google's Chrome UX Report API. See [PageSpeed Insights API](https://developers.google.com/speed/docs/insights/rest) and [CrUX API](https://developer.chrome.com/docs/crux/api). |
| Google Ads (API v26) | Same client plus `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_ACCESS_LEVEL` (test, explorer, basic or standard) | Developer token **Basic or Standard** access. Test access can't touch production accounts. Permissible-use review. |
| Facebook Pages + Meta Ads (Graph v26.0) | `META_APP_ID`, `META_APP_SECRET`, `META_ADS_ACCESS_TIER` (limited or full) | App Review for `pages_manage_posts`, `pages_read_engagement`, `ads_management` and `ads_read`; Business Verification; Marketing API access tier |
| Instagram (Instagram Login) | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | App Review for `instagram_business_basic` and `instagram_business_content_publish`. Business or Creator accounts only. |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn app setup and the permissions required by the selected organization/profile publishing capability. |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` | X developer app and API access needed for the approved publishing capability. |
| Firecrawl | `FIRECRAWL_API_KEY` | None. Without it, the built-in bounded fetcher is used. |
| Cloudflare R2 | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` (a **private** bucket; an API token with Object Read & Write on that bucket only) | None. When set, new AI images and privacy exports go to R2 behind presigned URLs. |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | None. Session replay is off and text is masked. |

Customers connect Stripe (a **restricted read-only** key) and their own Resend key themselves in Connections. Neither needs platform setup.

## 7. Vercel

- **Project and repository.** Link the project to GitHub `faisalibnislam/climbos` and set the framework to Next.js. Domain: `climbos.app` (already on Vercel).
- **Environment variables (Production):**
  - `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`: the **production** Convex deployment.
  - `NEXT_PUBLIC_SITE_URL=https://climbos.app`
  - `CLIMBOS_SERVER_SECRET`: same value as in Convex prod.
  - optionally `NEXT_PUBLIC_POSTHOG_*`. (Sign-in methods are decided by Convex at runtime; there's no web flag for them.)
- **Done on 17 Oct 2026:** the project is linked to GitHub, the framework is set to Next.js, production and preview variables are set, and `climbos.app` and `www.climbos.app` are attached. Production webhooks therefore point at `https://kindly-quail-695.convex.site/webhooks/polar` and `/webhooks/resend`.
- **Optional:** build with `npx convex deploy --cmd 'pnpm build'` plus `CONVEX_DEPLOY_KEY` so that Convex and the site deploy together.
