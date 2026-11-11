# Anthropic and a simpler ClimbOS

Owner direction, November 9, 2026: use Anthropic Haiku and Sonnet, keep code and business data local, test real Macloving/Livoform/Folevi plans with a cumulative $100 AI cap, and minimize API cost without sacrificing usefulness. The correct Livoform domain is `https://livoform.com/`; the supplied `.app` domain did not resolve during this audit.

## Provider policy

New runs use a versioned route: Haiku 5.5 for research and routine extraction, Sonnet 5.5 for strategy, creative drafts and substantive review. A single initial draft replaces the previous unconditional two-draft approach. Expert requests deeper reasoning within the same model/token envelope. Existing operator overrides and historical runs retain their stored routes; absent historical policy means the legacy phase policy, not a provider migration in the middle of a run. OpenAI remains an optional explicitly selected legacy provider. Image/video generation is unchanged.

The saved key stays in ignored, owner-readable `.env.anthropic.local`. It is not exposed to the frontend, fixtures, git, or command arguments. A tiny real Haiku call verified it; subsequent real Sonnet calls also returned successfully. No hosted environment was changed. `env:sync` now supports Anthropic and passes secrets through stdin, but it must not be used against a hosted deployment during this local-only work.

## Compatibility findings from real calls

Anthropic rejected the original plays schema (45 optional parameters). The nested plan schema also hit an internal grammar-size limit despite falling below the explicit optional/union limits. The adapter selects native structured output for small schemas and application-validated JSON for larger documents. In both paths the original Zod schema validates required fields, bounds, enums and null semantics before output can be accepted. There is no paid 400-error retry or provider fallback. This does not make grammar-free generation infallible: malformed or truncated initial output is rejected.

A malformed optional revision preserves an already reviewed draft and its original quality assessment. Its attempted cost remains metered. It cannot upgrade a failed draft into approved work. Network, permission and budget failures still propagate.

Native optional fields stay optional; required unknown values stay null. The adapter preserves signed thinking/tool blocks, uses the correct Haiku/Sonnet thinking controls, sets no retired sampling parameters, and disables implicit SDK retries. One end-of-prefix cache breakpoint covers stable instructions and schema without exceeding the provider's cache-breakpoint limit. Actual cache usage is metered; savings are not assumed. Costs are calculated separately for each API response, including cache read/write tokens and Haiku's long-context threshold.

## Cost control

- Research/extraction uses Haiku; substantive judgment starts on Sonnet pending measured cheaper-model acceptance.
- Task-sized output caps, one initial draft, bounded revisions, exact checkpoint reuse, and tenant-scoped research caching avoid repeated work. Historical performance tables and worked examples stay in source reference files but no longer enter the default live growth prompt. Only a relevant business catalog is loaded; unknown types get the general method rather than unrelated catalogs.
- The real evaluation compares a Haiku-first candidate with the same Sonnet reviewer and Sonnet repair path, using the same evidence. It must not change the global default merely because it is cheaper.
- A durable HTTP-boundary ledger reserves every attempt before sending it, including adapter continuations. Only official Anthropic Messages calls on approved Haiku/Sonnet IDs are allowed. Bounded search is allowed; other tools/actions/providers are rejected. Unknown usage retains its reservation. The ledger is never reset for a retry.
- The older $2 OpenAI ledger is preserved separately. Its authorization and receipts are not reused as Anthropic calls; the current runner conservatively counts that ledger’s used/held amount toward the new overall $100 cap too.
- Existing customer credit prices/entitlements are unchanged. Quotes and pricing examples reflect the selected provider. Synthetic regression wallets fund workflow tests; real business evaluation records contain no fabricated revenue or customers.

## Findings from the first real baselines

The original capability prompt embedded unsupported cold-email/creator reply rates and a universal $300 customer-value rule. The Livoform baseline used that rule to invent an agency/client-license multiplier. These instructions have been removed from both the static and workspace-specific capability context. Technical capacity is explicitly not an available audience, a consent record, owner capacity or a business result. Channel affordability must follow actual contribution and delivery costs; manual learning tests and one-to-many distribution remain available when appropriate.

The live skill compiler also stops injecting historical rate tables and catalog performance claims into the default strategy prompt. Source references remain on disk for deliberate verification. A citation to an indexed page still does not prove the product works or demand exists.

New plan quality records preserve failed or missing required truth, budget and permission gates. These failures block plan approval even if deterministic lint missed them. Editorial weaknesses can remain provisional.

## Experience

The four primary destinations are Home, Plan, AI activity and Results. Plan opens with Next steps; Why this plan explains who to reach, why they would choose the business and how it could grow; What we learned keeps earlier decisions and results. The 14/30/90-day choices remain. Backend version/cycle IDs remain intact, while everyday screens use plain names. Detailed ideas, economics, source material and controls are available on demand.

AI activity leads with actual runs and ready work; the optional request composer is collapsed. A plan can include up to three actual starter drafts with exact targets, evidence references and checks before use. These remain visibly unsent, unpublished drafts. Unknown private financial inputs do not turn the main page into a mandatory questionnaire. Financial decisions still wait for reliable inputs; optional input forms remain accessible.

Accepting a plan already queues eligible channel drafts exactly once within credits; this behavior is preserved and explained. Plan viewing, starter drafts and idea generation confer no publishing, sending, advertising, account or billing permission.

## Local real-business workspace

`pnpm local:real backend`, then `pnpm local:real configure`, `pnpm local:real sync`, and `pnpm local:real web` create a separate loopback deployment at `127.0.0.1:3330` and frontend at `127.0.0.1:3430`. Its state is in the OS temporary directory under `climbos-local-real`. It starts empty and imports actual source-backed AI outputs as customer workspaces with `isFixture: false`. No demo rows, fake LLM, provider credentials, marketing integrations or scheduled specialists are configured by this launcher.

The capped evaluation runs the production agent loop and adapter, then `scripts/import-real-plans.mjs` imports validated outputs, exact source/evidence records, actual usage and honest quality findings through the normal strategy persistence path. This path is internal, idempotent, and gated to the exact real-data loopback profile. It cannot import into a hosted or fixture deployment. Imported research does not assert that the application itself was functionally tested or that public website claims are proven.

Raw research, model responses, reviewed plans and receipts are ignored local artifacts under `bench/cache/anthropic-real-2026-11-09/`. The local app can display these without making a new paid request. The independent evaluation budget is not a fabricated customer subscription or business performance metric.

## Primary documentation checked

- [Current models](https://platform.claude.com/docs/en/models/overview)
- [Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview)
- [Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)
- [Sonnet thinking and compatibility changes](https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5)
- [Structured output limits](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)

Model prices and availability can change. The dated rate version preserves the prices used for these runs; provider billing records remain authoritative.

## November 10 cost and evidence corrections

The owner asked to minimize API cost while retaining quality. The strategy writer's fixed instruction text fell from 44,795 to 29,765 characters (about 34%) by keeping the strategy and experiment procedures while leaving duplicated reference material and examples on disk. This is a measured prompt-size reduction, not a claim of equal percentage billing savings or unchanged recommendation quality. The real paired routing test keeps Sonnet review and repair and compares the first 14 days on identical captured evidence; one software-business comparison cannot establish general Haiku/Sonnet equivalence.

The plan handoff now omits already-saved starter drafts, separate exploratory options and creative-review traces. It preserves the complete chosen execution portfolio, including every action, funnel step, evidence reference, cost and permission. The previous generic JSON trimmer could silently drop an entire chosen action from a long portfolio. A regression covers four large actions.

A low public price no longer forces a pricing-page rewrite, an arbitrary free-before-paid sequence or a mandatory extra product-funnel play. Price-derived channel preferences remain advisory; independent cash, economics, capacity, evidence and execution-permission checks remain enforced. Planning allowances are labelled priors rather than universal minimum viable spend. Public-copy checks still reject invented customer results, while internal test briefs can contain explicitly labelled proposed quantities.

The website reader now separates full-page technical observations from focused reading text. It selects an active product dialog or main/article region, includes published inactive tab panels, and excludes content inside hidden ancestors and closed dialogs. This fixes product routes that render their details over a long background homepage without changing full-page SEO heading counts. Captured HTML is reprocessed locally without another API call. The evaluation preserves the exact source pack per candidate; the earlier Macloving candidate predates this correction and is retained as evidence of the failure.

Marketplace and template suggestions require actual format/eligibility/interoperability evidence. A competitor's template gallery is not automatically a distribution destination. Source-reported creator coverage establishes subject fit, not availability, endorsement, contact permission or commercial results.

The new workflow also skips the extra paid “first take” preview. Code previews and actual saved agent work remain; the temporary preview did not feed the final recommendation. An interrupted Claude connection is now explicitly marked as billing-uncertain. Agent and legacy task wrappers stop, preserve the reservation for reconciliation and prevent automatic replay instead of recording an apparent free failure. Known rejected requests remain distinct. A synthetic connection-failure integration test verifies an uncertain run/step, an unresolved wallet reservation and a single provider attempt.

Claude agent turns have up to six minutes. The workflow stops starting new phases after 2.5 minutes and resumes from checkpoints, leaving room within [Convex's ten-minute Node action limit](https://docs.convex.dev/agents/workflows). Completed phases do not run again merely because the action yields. The default wrapper uses the stored route; explicit older routes keep their existing behavior.

Failed plan drafts now show their status before the recommendation and offer **Let AI fix this plan**. A new attempt receives bounded prior AI findings for the same goal, labelled as review guidance rather than business facts or permission. The currently approved plan remains the source for other work. No owner-written diagnosis is required. The normal credit quote, spending limits, stale-input checks and approval boundaries remain in force; this is not an automatic paid loop on page load.

## Real output-limit acceptance findings

The matched first-draft strategy request was byte-identical after removing only the model field. Sonnet produced a complete initial draft for $0.364101; Haiku hit its 32,000-token output limit for $0.023625 and produced no complete accepted draft. This is a failed cheaper-writer acceptance test, not a quality-equivalence finding. The strategy writer remains Sonnet. The saved request hashes and receipts remain in the local cache.

Real local Convex testing also found truncation in an eight-thousand-token Haiku research phase and a sixteen-thousand-token Sonnet business-insights draft. Haiku evidence gathering now disables extra thinking while retaining its search/fetch bounds; its resumed research phase completed. Business insights now has 24,000 tokens of output room, and social output room scales with requested item count (including reasoning). Quotes use the same limits as execution; static pricing examples were updated. These are ceilings, not billed usage, and avoid paying for answers that cannot finish. Completed steps remain checkpointed; prior failed attempts and actual charges are preserved. The fixed local test wallet is an owner-authorized evaluation allowance, not a subscription or invented business revenue.

The public free-credit allowance and commercial subscription prices have not been changed to hide higher task estimates. Launch pricing/free-onboarding affordability needs a separate product check against the final measured cost per completed job.

## Final focused and cost follow-up — 10 November

First-party plan creation, onboarding and AI refresh requests use the focused contract by default; detailed forecasts remain optional. Starter work is reused directly in the plan, with no new generation on approval. The selected contract reaches quotes and reservations. Fresh research is tied to the tenant and business website. Exact horizons and industry context survive the shorter worker path.

Source checks now retain explicit product-outreach refusals through the page reader, cache and checkpoints. Corrected recommendations exclude MacMost product pitches. The independent comparison preferred the new Macloving and Folevi plans but still favored earlier Livoform SEO/distribution substance. No model or workflow was declared universally equivalent. See [the final cost and quality record](Cost-and-Quality-2026-11-10.md) and [verification](Verification.md).
