# Verification

Last run: **17 Oct 2026** on macOS, Node 24.21, pnpm 10.34, Next 16.4.2, Convex 1.47.

## Automated checks

| Check | Command | Result |
|---|---|---|
| TypeScript, web + shared | `npx tsc --noEmit -p tsconfig.json` | Clean |
| TypeScript, Convex | `npx tsc --noEmit -p convex/tsconfig.json` (also `convex deploy --typecheck enable`) | Clean |
| Lint | `pnpm lint` | 0 errors |
| Unit + Convex integration tests | `pnpm test` | **234 passed** (13 files) |
| Production build | `pnpm build` | Passes; 32 routes |
| End-to-end + accessibility | `pnpm test:e2e` against the dev deployment | **15 passed**: 6 public-site, 9 demo-flow |
| Economics gate | `pnpm econ:export` | PASS: every plan ≥ 30% at heavy use and under combined stress |

## What the tests prove (mapped to the acceptance list)

1. **Tenant isolation** (`tests/convex/tenancy.test.ts`). A second tenant can't query, mutate, export or pause the first tenant's workspace, drafts, facts, connections, analytics or billing (the response is `NOT_FOUND`). Ids from another tenant are refused even with the caller's own slug. Secrets are encrypted at rest and never returned by public queries. A ciphertext copied to another tenant fails to decrypt (AAD binding). Role limits and the operator allowlist are enforced server-side.
2. **Cost ceilings** (`tests/unit/billing-policy.test.ts`, `tests/convex/safety.test.ts`):
   - 50 serialized reservations never break the ledger invariants.
   - 10 truly concurrent content jobs stop exactly at the meter cap (3 × 2 posts = 6).
   - Failed jobs keep the real provider cost, release their meters and reconcile exactly once.
   - Retries consume budget, and the seventh model step in a run is refused.
   - A fallback without capacity fails closed.
   - Top-ups cover only the full stressed cost.
3. **Pricing** (`tests/unit/economics.test.ts`):
   - All 12 workbook rows reproduce to the micro-dollar: every cost line, fees, totals, margins, stress rows, minimum prices and caps.
   - Heavy stress margins are 36.6% / 40.2% / 36.6% / 37.2%.
   - Changes to price, support minutes, image attempts, customer count or a vendor rate propagate correctly.
   - Invalid denominators and inputs throw clear errors.
   - The $19 Basic plan passes the gate under price-weighted fixed allocation. A separate test documents that it would fail under strict per-head allocation at 10 customers.
   - The Gemini 2027 reprice still passes. The $29 top-up keeps about 54% stressed margin.
4. **Polar webhooks** (`tests/convex/billing.test.ts`; `tests/unit/billing-policy.test.ts` also checks signatures against the official `@polar-sh/sdk` `validateEvent`):
   - Duplicate, replayed and out-of-order events grant exactly once.
   - Forged signatures, tampered bodies and replays outside tolerance are rejected (HTTP 403 at the endpoint).
   - Cancel at period end keeps access until the end; revocation stops new work immediately and never re-opens the free allowance.
   - An unpaid renewal is read-only until a paid renewal grants the new period, once.
   - Upgrades raise caps once. Top-up grants are idempotent, and a refund revokes unused capacity.
   - Purchases can't bind to a workspace that never started an authenticated checkout.
5. **Approvals and execution** (`tests/unit/billing-policy.test.ts`, `tests/convex/safety.test.ts`):
   - Edits invalidate approvals.
   - Expiry, a different account, scope or policy changes, emergency stop and an unavailable capability all block execution.
   - Publishing the same version twice is a no-op (idempotency key and intent receipt).
   - Unconnected channels never fake a publish; they fall back to export packs.
   - The ad envelope is enforced.
6. **Consent and honest states** (`tests/convex/marketing.test.ts`; `tests/unit/integrations.*`):
   - Consent is never inferred ("yes" without a source and date is imported as planning-only).
   - Suppressed or deleted contacts are excluded, and a segment with nobody opted in is refused.
   - Without the customer's own provider, the send fails honestly and its quota reservation is released.
   - Personal Instagram accounts show "unsupported account type". Pending provider review, missing setup and stale syncs show their honest capability states.
7. **Forecasting** (`tests/unit/forecasting.test.ts`, `tests/unit/attribution.test.ts`):
   - Seeded runs are reproducible, the leakage guard throws on misuse, and sparse data returns `insufficient_evidence` with no interval.
   - Calibrated intervals reach the expected held-out coverage, and widths never shrink as the horizon grows.
   - The funnel examples reproduce exactly.
   - Attribution reconciles to the cent with an unattributed bucket, refunds and separate currencies. Platform claims can't be summed.
8. **Formkit demo end-to-end** (`e2e/demo-flow.spec.ts`; Convex demo test):
   - **Today:** goal, next actions, chat → costed action card → job → drafts.
   - **Content:** approve an Instagram draft → publish → "Demo: simulated acceptance" receipt.
   - **Plan:** approved plan with channels, experiments and SWOT.
   - **Results:** unattributed revenue, platform-reported claims, forecast detail with backtests.
   - **Connections:** per-capability states and the no-contact-database statement.
   - **Settings:** Billing usage meters and Policies.
   - **Pause all** then resume. Mobile layout at Pixel 7 size. Keyboard skip link.
9. **Accessibility and layout.** axe-core WCAG 2.0/2.1/2.2 A/AA scans with zero serious or critical violations on landing, pricing, sign-in, Today, content list and detail, Plan, Results, forecast detail, Connections, Billing and Policies. No horizontal scroll at 375px on public pages and the five app sections. One `h1` and one `main#main` per page. Skip link works.

## Manual and visual inspection

- Checked in the browser on the dev deployment and on **production (climbos.app)**: landing hero with live preview, `/demo` → Today (desktop 1366×900 and mobile 375×812), the chat-to-card-to-job loop, Plan, Content list, and content detail with the simulated-publish copy.
- **Bugs found and fixed during inspection:**
  - The page jumped to the chat on load.
  - Action cards appeared twice.
  - The parser mistook an email domain for a website and missed "I run …" names.
  - The Vercel project had no framework set, so every route returned 404 until it was set to Next.js.

## Adapter verification status

| Adapter | Status |
|---|---|
| Demo fixtures (AI, Instagram, Google Ads, GA4, Search Console, Stripe) | **Fixture-verified** (deterministic, labelled demo) |
| Claude (`claude-sonnet-5-5`, `claude-haiku-5-5`) | Implementation-tested with code paths and schemas. **Not yet live-verified**: no `ANTHROPIC_API_KEY` provided |
| Gemini (`gemini-3.8-flash`, `gemini-3.1-flash-lite`, `gemini-3.1-flash-lite-image`) | Implementation-tested. **Not yet live-verified**: no `GEMINI_API_KEY` |
| Resend (sign-in codes, platform mail, webhooks) | Implementation-tested (signature tests). **Not live-verified**: no `AUTH_RESEND_KEY`, so email sign-in doesn't work yet |
| Polar (checkout, portal, webhooks, reconciliation) | Webhook processing tested end-to-end in Convex tests; signatures verified against the official SDK. **Sandbox not yet verified**: no token or products |
| Firecrawl / built-in website reader | The built-in fetcher's SSRF and robots logic is unit-tested. The live fetch runs in production once AI keys exist |
| GA4, Search Console, Google Ads, Meta Ads, Facebook Pages, Instagram, Stripe, customer Resend | Implementation-tested against mocked provider responses on current API versions (Google Ads v26, Graph v26.0). **Awaiting credentials and provider approvals**; they show "Setup needed" in the product |
| Cloudflare R2, PostHog | R2 is recognized but **not wired** (Convex storage is used). PostHog loads only when its key is set |

Nothing in this repository claims a live provider connection that hasn't been made.
