# ClimbOS capabilities and boundaries

Last checked against the repository: 25 October 2026. This is an implementation guide, not a claim that every customer account is connected or every provider has approved ClimbOS.

## Availability labels

- **Built:** implemented in the application and covered by local checks.
- **Needs setup:** the code exists, but an owner connection, operator credential, provider review, or workspace permission is required for real use.
- **Limited:** available only for a bounded sample or specific workflow, as described.
- **Unavailable:** no supported integration or behavior is implemented; use the stated manual or export path.

The Connections screen reports the current state for each workspace. Credentials and provider approvals can change availability without a code change. Demo workspaces use labeled fixtures; a fixture result is not evidence of a live provider operation.

## What businesses can do

| Area | Current capability | Availability and limits |
|---|---|---|
| Business research | Read the public homepage and a bounded set of same-site pages; extract page-cited facts for owner review; organize audiences, offers, positioning, competitors, objections, SWOT, and business unknowns. | Built. Website access respects robots rules and blocks private-network destinations. Website statements are not independent proof of demand or performance. |
| Growth planning | Turn an owner goal and known constraints into prioritized channels, plays, action cards, and experiments with prerequisites, costs, measures, and stop rules. Recalculate deterministic scenario economics and compare portfolio choices when inputs permit. | Built. Forecasts and scenario ranges depend on supplied inputs; they are not promised results or causal lift. Unknown inputs remain unknown. |
| Specialist work | Configure specialized profiles for growth strategy, research, competitive intelligence, SEO and AI-search readiness, conversion, social, ads, sales, lifecycle, revenue, brand, PR, and related tasks. These profiles use ten shared, metered execution roles. | Built. The profiles are coordinated workflows, not independent human experts. Work quality and business outcomes still require evaluation. |
| AI model modes | Basic mode uses the configured Luna route. Expert mode can escalate selected strategy and planning tasks to Sol after a measured review condition. | Built. OpenAI availability and workspace eligibility are required. There is no silent provider fallback. Image generation uses configured Google Gemini routes. |
| Social content | Draft channel-specific posts, variants, alt text, content angles, trend-aware ideas, and calendars. Brand settings can include tone, humor/trend preferences, and approved writing examples. | Built. Trends need current source evidence; category and platform checks still apply. A draft or calendar entry is not proof of expected engagement or sales. |
| Social planning and publishing | Plan weekly content and schedule approved posts under each workspace's publishing policy. | Built; real publishing needs connected accounts, operator credentials, and any required provider review. Facebook Pages, professional Instagram, LinkedIn, and X have supported publish paths when their capability state is ready. TikTok, Pinterest, and YouTube use manual export paths. Instagram publishing requires an eligible professional account and supported media. |
| Creative assets | Create image concepts and generated images, manage reusable assets, edit supported designs, and prepare short-form video/Reel assets. | Built with configured image/video providers and usage limits. A generated visual is not a real customer, product, or performance result. Some editing and rendering options depend on worker/provider configuration. |
| Paid advertising | Draft Google Search and Meta campaigns, inspect available metrics, and request campaign activation or pause actions. | Needs setup. Campaigns are created paused; activation is checked against approval for the exact account, destination, dates, and spend. Provider access level and app review affect live use. A reported ROAS is not causal ROI or full profit. |
| Customer discovery and sales | Research public companies, creators, and potential partners; retain source evidence; prepare qualification, booking, and tailored outreach workflows; manage prospect stages and collaboration outcomes. | Built with bounded public-source research. Contact routes must be supported by evidence. Sending requires an authorized, configured mailbox and the applicable approval and suppression checks; no shared bought-contact database is assumed. |
| Email and lifecycle | Draft onboarding, nurture, retention, and sales follow-up messages; manage eligible contacts and suppression state. | Drafting is built. Marketing sends require the customer's configured Resend account, consented and unsuppressed recipients, and the send workflow's approval checks. An imported contact is not automatically eligible to receive marketing. |
| Landing pages and lead capture | Draft, edit, and host ClimbOS landing pages; collect page views and form leads into the workspace pipeline/inbox. | Built. A ClimbOS-hosted page is not an edit to the customer's existing website. Live page limits depend on workspace plan. |
| Website conversion audit | Review the homepage plus up to four prioritized same-site pages, sampled social posts, page evidence, conversion paths, technical observations, and available performance data. When the authenticated render worker is available, send temporary desktop/mobile screenshots of one already-read page for visual review. | Limited sample. Screenshots are synthetic and temporary. They do not test full journeys, form behavior, accessibility conformance, or actual conversion impact. Social review is also bounded; sampled posts do not represent a complete account history. |
| Search and AI-search visibility | Check sampled static HTML for search-readiness signals; use Google Search Console snapshots when the matching property is connected; import a bounded CSV export of Google's Generative AI report; record fixed AI-answer questions and owner-observed mentions/citations over time. | Built with setup and sampling limits. AI-answer observations are manual samples, not continuous monitoring or market share. Search checks do not establish indexing, rankings, or citations by answer engines. |
| Reviews and inbox | Manage manually imported reviews, draft suitable responses, route sensitive items for owner review, collect private feedback, and review supported connected-channel messages. | Limited. Reviews can be recorded and drafted, but Google Business Profile review retrieval and native public reply publishing are not implemented. |
| Analytics and results | Read supported GA4 and Search Console data, import revenue from Stripe read-only access or CSV, review funnel and attribution views, analyze cohorts, and run deterministic forecasts/backtests/scenarios. | Needs setup for live providers. Import coverage, attribution rules, and data freshness are shown where available. Platform conversion claims are not combined into total revenue, and association is not presented as causation. |
| Climb AI workspace assistant | Ask about workspace information, request research or drafts, and turn requests into bounded action cards and jobs. A website chat widget can answer from configured business information and collect inquiries. | Built. Access follows workspace roles, tool limits, usage budgets, and action approvals. The assistant cannot grant itself permission to publish, send, or spend. |
| Operations and controls | Manage connections, team roles, brand settings, policies, approvals, usage, billing, activity, and pause controls. Operators have a separate knowledge and service console. | Built. External writes are tenant-scoped and checked against approved content, destination, budget, time window, current policy, and provider capability. |

## Connection and write summary

| Service or data source | Read / import | Write / publish | Requirements or limit |
|---|---|---|---|
| Public website | Bounded same-site page reads; screenshot and performance checks where configured | ClimbOS landing pages can be hosted; edits to the customer's own CMS are not general website writes | Public HTTP(S), robots and network safety checks; screenshot worker and Google PageSpeed key are optional |
| Google Analytics 4 | Visits, events, and supported reports | None | Google OAuth setup and access to the selected property |
| Google Search Console | Dated query/page snapshots, URL inspection, and matched-property context | None | Google OAuth setup and selected property must match the business website; dedicated generative-AI report is CSV import |
| Google Ads / Meta Ads | Supported campaign metrics | Create paused campaigns; approved, bounded activation/pause actions | Operator credentials, account access level, provider permissions/review, and exact approval |
| Facebook Pages / Instagram | Supported sampled posts and returned metrics; Instagram still-image samples | Approved supported posts | Meta/Instagram app setup and permissions; Instagram requires a Business or Creator account |
| LinkedIn / X | Limited account data as returned by the integration | Approved posts when the configured OAuth capability is ready | Provider app credentials and permissions; otherwise use drafts/export |
| TikTok / Pinterest / YouTube | No connected account history in the current integration | No automatic publishing | Prepare and export platform-ready drafts |
| WordPress | Connection validation and draft read-back | Create a private draft from an approved article after separate confirmation | Connected site and Application Password; ClimbOS does not publish the article live |
| Customer's Resend account | Supported contact/segment access | Consent-checked marketing send workflow | Customer-owned API key, eligible recipients, suppression/unsubscribe handling, and approval |
| Stripe / revenue CSV | Stripe revenue import is read-only; CSV revenue and contact imports are validated and bounded | None | Stripe restricted read key or owner-prepared CSV; ClimbOS billing uses Polar |

This table describes implemented paths, not current production status for any particular customer. Check the workspace Connections screen and `docs/ProviderSetup.md` for current setup instructions.

## Boundaries

- ClimbOS does not invent customers, testimonials, statistics, results, contacts, or business facts.
- Drafting a recommendation does not authorize sending, publishing, changing a live campaign, or spending money.
- No tactic guarantees growth, conversion lift, search ranking, or answer-engine citation.
- A scenario library entry is a proposed hypothesis; it must be checked against the business's evidence, budget, capacity, geography, and permissions.
- Sensitive or legally uncertain tactics require current, jurisdiction-specific review. The product's checks are not legal advice or a legal determination.
- Read [Architecture](Architecture.md), [Security and data](SecurityAndData.md), [Provider setup](ProviderSetup.md), and [Verification](Verification.md) for system design, controls, setup, and test evidence.
