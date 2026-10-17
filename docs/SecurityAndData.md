# Security and data handling

## Identity and tenancy

- **Authentication.** Convex Auth issues JWTs (RS256 keys in the Convex env) for email one-time codes (8 digits, 15-minute expiry, sent via Resend), Google OAuth (optional) and anonymous demo sessions. Session cookies are HTTP-only, managed by Convex Auth's Next.js integration, and last 30 days.
- **Authorization.** Every public Convex function resolves the workspace server-side and calls `requireOrgAccess(ctx, {slug|orgId}, permission)`. That checks identity, then an active membership, then the role's permission. Non-members get `NOT_FOUND`, so workspace existence isn't leaked. Document ids passed by a client are re-checked with `assertSameOrg`.
- **Roles.** Owner, admin, editor, reviewer and viewer (see `shared/policy`). Approving needs owner, admin or reviewer; editors can't approve. **Operators** are a separate email allowlist (`OPS_EMAILS`, verified non-anonymous users only) and never derive from customer roles. All operator actions are audited.
- **Tests.** `tests/convex/tenancy.test.ts` shows that a second tenant can't query, mutate, export, pause or decrypt the first tenant's data, and that role limits hold.

## Secrets

- Connector tokens and API keys are stored **AES-256-GCM encrypted** (`convex/lib/crypto.ts`). The additional authenticated data binds each ciphertext to `orgId + connectionId`, so a ciphertext copied to another tenant fails to decrypt (tested).
- **Key rotation.** Set `CLIMBOS_ENCRYPTION_KEY_PREVIOUS` to the old key, set a new `CLIMBOS_ENCRYPTION_KEY` and `CLIMBOS_ENCRYPTION_KEY_ID`; decryption tries both. Re-save a connection to re-encrypt it.
- Secrets are only decrypted inside internal functions used by actions. Public queries never return them. Platform secrets (AI keys, Polar, Resend) live only in the Convex environment. `NEXT_PUBLIC_*` values contain nothing secret.
- Logs and audit summaries never include tokens, contact lists or raw emails. Email addresses used for suppression are SHA-256 hashed.

## Webhooks

- **Polar.** Uses Standard Webhooks (HMAC-SHA256 over `id.timestamp.body`). Signatures are checked in constant time, with a 5-minute timestamp tolerance (replay protection) and a 1 MB body cap. Events are stored once per `webhook-id`, then processed asynchronously and idempotently. Grants are keyed by Polar order id. Purchases bind only to a workspace that started an authenticated checkout, with a stable Polar customer id.
- **Resend.** Same scheme, using Svix headers. Bounces and complaints become platform suppressions.

## Website research (SSRF)

`shared/integrations/website.ts`:
- Only http/https on ports 80/443. No credentials in the URL. No IP literals in private, loopback, link-local, CGNAT, multicast or reserved ranges (including IPv6 and `::ffff:`-mapped addresses and the 169.254.169.254 metadata address). No `localhost`, `*.local`, `*.internal` or single-label hosts.
- Every redirect hop is re-validated (at most 3). Hostnames are resolved and the resulting addresses checked (DNS-rebinding defense in the node runtime).
- Bodies are capped at 2 MB and text at 40k characters. robots.txt is respected for `ClimbOSBot`.
- Model-suggested URLs are never fetched. Only the owner's site and same-origin links are.

## Prompt-injection defenses

- Trusted policy (role charters plus shared rules) is separate from untrusted content. Website text, uploads and owner chat are wrapped in `<untrusted_content>`, and attempts to close the wrapper are stripped.
- Models only return schema-validated JSON. They can't call tools beyond an optional, capped web search. All execution authority lives in code: approvals, policies, capabilities and budgets.
- Unsupported or risky claims ("guaranteed", "#1", invented percentages) are flagged on the draft before approval. Facts used in content come only from *confirmed* facts.
- The fixture tests include adversarial cases: forged signatures, cross-tenant ids and stolen ciphertext.

## Payments and spend

- Checkout success redirects never grant access. Only verified webhook events and authoritative Polar state do.
- A past-due payment means read and export only. Revocation stops new paid work immediately. Cancelling at period end keeps access until the recorded end.
- Ad spend is paid directly to Google or Meta. ClimbOS enforces the owner's monthly envelope before creating campaigns and uses provider-side caps where supported (Meta campaign spend cap).

## Data retention and deletion

| Data | Default retention |
|---|---|
| Raw research excerpts (`factSources.excerpt`) | 30 days (cron clears them) |
| Detailed step outputs (generated text checkpoints) | 90 days |
| Aggregate metrics | 13 months (396 days) policy |
| Landing previews | 30 days |
| Demo workspaces | 7 days |
| Billing records, usage costs, audit trail | Kept for accounting, even after workspace deletion |

- **Export.** Settings → Privacy produces a JSON export of the workspace (connector secrets excluded).
- **Contact deletion.** Removes the contact and its consent records, and keeps a hashed suppression so the address is never emailed again.
- **Workspace deletion.** Owner only, after typing the workspace name. Activity stops at once, then content, facts, metrics, connections, secrets, contacts, runs and memberships are purged in batches. Billing and audit records are kept, with personal fields minimized.

## HTTP hardening

Security headers on every route: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy` and HSTS. `poweredByHeader` is off. Open redirects are prevented by `safeNextPath()`. OAuth uses single-use hashed `state` (10-minute expiry) and PKCE S256 for Google.

## Known gaps (tracked)

- **Content Security Policy.** Not yet enforced (Next.js inline scripts need nonces).
- **Attachment scanning.** Only CSV import exists today; no file uploads beyond CSV.
- **Formal review.** No external penetration test or legal review yet. The privacy, terms and security pages are marked as drafts.
