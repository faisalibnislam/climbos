# Architecture

ClimbOS turns a business goal into a researched plan, reviewable work, approved execution and measured learning. Ten AI roles share one business record and one workflow engine; deterministic code owns money, permissions, statistics and every external write.

```
Browser (Next.js 16 on Vercel)
  ├─ Marketing: /, /pricing, /how-it-works, /security, /privacy, /terms
  ├─ Live preview (/api/preview → Convex, IP-hashed, rate-limited)
  ├─ App: /onboarding, /app/[org]/{today,plan,content,results,connections,settings/*}
  ├─ Operators: /ops (separate allowlist)
  └─ Server routes: /api/oauth/callback, /api/health, proxy.ts (optimistic auth redirect)
        │  reactive queries / mutations / actions (Convex client, JWT from Convex Auth)
        ▼
Convex (authoritative state + durable jobs)
  ├─ schema.ts            tenant-scoped tables, indexes start with orgId
  ├─ lib/tenancy.ts       requireOrgAccess(): identity + membership + permission on EVERY call
  ├─ engine.ts            runs, checkpointed steps, atomic reservations, reconcile-once, recovery
  ├─ jobs.ts ("use node") ten-role tasks: research, insights, strategy, content, chat, analysis
  ├─ ai/providers.ts      Claude + Gemini adapters (server-only keys), schema validation
  ├─ ai/fixtures.ts       deterministic demo adapter (never used for real workspaces)
  ├─ ai/research.ts       SSRF-safe website research (+ Firecrawl when configured)
  ├─ publish.ts / ads.ts  approval-checked external writes, receipts, reconciliation
  ├─ billing.ts           Polar checkout/portal (REST), webhook processing, grants
  ├─ connections*.ts      OAuth, encrypted secrets, capability states, syncs
  ├─ analytics.ts         daily materialization, attribution, deterministic forecasts
  ├─ notifications.ts     Resend platform mail, usage alerts, digests, suppressions
  ├─ ops.ts               operator console, fleet stop, circuits, reconciliation
  ├─ http.ts              /webhooks/polar, /webhooks/resend, /health, auth routes
  └─ crons.ts             recovery, retries, reconciliation, retention, syncs, digests
        │
        ▼
External: Anthropic, Google Gemini, Polar, Resend, Firecrawl, Google (GA4/SC/Ads), Meta (Pages/IG/Ads), Stripe (read-only)

shared/ (pure TypeScript, runs in browser, Node and Convex)
  economics/  rates, routing, entitlements, calculator, ledger, top-ups, CSV
  forecasting/ baselines, backtests, conformal intervals, funnel scenarios, PRNG
  attribution/ dedupe, first/last touch, claims (never summed), ROAS/ROI
  integrations/ provider adapters, OAuth/PKCE, capability evaluation, CSV, SSRF
  policy/     roles/permissions, job state machine, canonical hashes, approval checks
  billing/    subscription access, grant rules, Standard Webhooks verification
  ai/         model registry (verified ids), task contracts and schemas, prompt isolation
```

## Key decisions

| Decision | Why |
|---|---|
| **Convex for state and jobs** with a custom persisted state machine (not a workflow component) | Every step is written down before and after its external call, so a resumed run skips completed steps (`workflowSteps.output` checkpoint). Stuck runs are recovered by cron: model steps fail, provider writes become *uncertain*. Fully covered by `convex-test`. |
| **Reservations in mutations** | Convex mutations are serializable transactions, so check-and-reserve is atomic. Provider calls happen only in actions. |
| **Direct provider SDKs and REST**, no paid gateway | No markup. `@anthropic-ai/sdk` (structured output via `output_config`), `@google/genai`, and Polar/Resend/Firecrawl over REST. |
| **Claude + Gemini only** (owner decision) | The blueprint's GPT-6 Luna routes go to Claude Haiku 5.5 at identical rates; quality fallbacks are cross-provider. The economics are unchanged (tested). |
| **Convex Auth** (email code via Resend, Google, anonymous for demo) | No second paid auth vendor. Product user seats aren't developer seats. |
| **Cache Components off** in Next.js | Almost every route depends on the session cookie, and data is reactive on the client. Prerendering static shells bought little and broke auth. |
| **Polar via REST** for checkout, portal and subscriptions | The 1.0 SDK is a fresh rewrite. Signature verification mirrors the SDK exactly, and a test checks it against the official `validateEvent`. |
| **Convex file storage for images and exports** | R2 env vars are recognized by setup checks, but the R2 adapter isn't wired yet. See *Known limitations* in the README. |
| **Fixture adapters are separate modules** | Demo workspaces (`organizations.kind = "demo"`) use `ai/fixtures.ts` and fixture connections (`isFixture`). Production adapters never return fake success. |

## Request and job lifecycle

1. The user triggers work (onboarding, an action card, Create content, Refresh plan). The mutation checks membership and permission, the emergency/fleet stop and subscription access, then calls `createRunWithReservation` (concurrency limit, per-run step budget, worst-case reservation, entitlement version).
2. The mutation schedules a node action (`jobs.*`). Each step calls `engine.beginStep`, which returns a checkpoint if the step already ran, refuses when paused or over budget, and marks interrupted provider writes uncertain. The action then calls the provider, records usage (`engine.recordUsage`) and completes or fails the step.
3. Model output is parsed and validated against the task's schema, with at most one repair. Provider failures may fall back to the other provider after `reserveAdditional`. Circuit breakers open after 5 consecutive failures.
4. Results are saved through `jobWrites.*`. Artifacts get versions with a canonical content hash. Researched facts start as *needs review*.
5. `engine.finishRun` reconciles exactly once, using metered quantities derived from usage events, then triggers usage alerts.

## Approval-bound execution

`approvals.approvalHash = sha256(canonical JSON of {orgId, subject, actionKind, contentHash, scope{connection, destination, audience, spend, currency, window}, policyVersion, expiresAt})`. Immediately before any external write, `checkApprovalForExecution` re-checks:
- the approval is still approved and unexpired;
- the content hash matches the current version;
- the account, scope and policy version are unchanged;
- no emergency or fleet stop is active;
- the capability is ready.

Editing content or changing the approval rules invalidates approvals. The adapters independently refuse writes without an `ApprovedAction` that matches the exact target and value.

Idempotency keys are `org:publish:artifact:vN` (or `org:campaign:…`). A receipt is written *before* the provider call with status `uncertain`. If the action dies, nothing is retried blindly: `publish.reconcile` asks the provider first (Facebook: find the post by message; Instagram: check the media container).

## Data model

See `convex/schema.ts`. It covers every table the spec requires (organizations, memberships, businesses, businessFacts, factSources, goals, brandProfiles, connections, connectionCapabilities, consentRecords, suppressions, contacts, strategies, experiments, campaigns, artifacts, artifactVersions, approvals, autonomyPolicies, workflowRuns, workflowSteps, actionReceipts, usageReservations, usageEvents, rateVersions, polarCustomers, subscriptions, orders, creditPurchases, webhookEvents, metricDefinitions, metricDaily, revenueEvents, cohorts, forecastRuns, backtestRuns, syncCursors, auditEvents). It also adds: usagePeriods (the per-period ledger), checkoutSessions, chatMessages, actionCards, previews, touches, platformClaims, privacyRequests, fleetControls, emailLog, platformSuppressions, oauthStates and userPreferences. Every customer query reads through an index that starts with `orgId`. Reactive screens read materialized `metricDaily` rows, never raw histories.
