# ClimbOS: chat-first product UX and structured marketing website

Paste the instructions below into Codex from the ClimbOS repository. This is a proposed implementation brief, not evidence that these changes have been built or tested.

For a standalone, detailed implementation brief focused on the authenticated product and first/additional company onboarding, use [ClimbOS app and onboarding prompt](ClimbOS-App-Onboarding-Codex-Prompt.md). When applying both briefs, that document supplies the detailed internal-app requirements; this document supplies the marketing website and Solutions structure. Inspect existing implementation before repeating shared work.

---

Implement a complete, polished UX improvement for the existing ClimbOS application and marketing website in the current repository.

The central requirement is a ChatGPT-like conversational composer as the primary call to action on the public homepage, the authenticated app home, and onboarding when creating the first or an additional company/workspace. Put the composer directly beneath the main headline, with useful suggestion chips immediately beneath it. Combine that entry point with a simpler, guided product experience and a structured Solutions menu organized by use case, role, and industry.

Deliver the implementation, appropriate tests, a running local experience, visual inspection, and a truthful handoff as one continuous task. Do not stop at a plan, mockup, component gallery, or a frontend that is disconnected from the real workflows. Do not push, create a PR, deploy, or perform live customer publishing, email sending, ad activation, or spending.

1. Inspect the repository and preserve its working systems.

Read applicable AGENTS.md instructions. Before writing Next.js code, read the relevant installed guides in `node_modules/next/dist/docs/`; this repository has explicit instructions about breaking changes. Read `docs/Capabilities.md`, `docs/DesignSystem.md`, `docs/ContentDesign.md`, the relevant architecture/provider/security documents, and `docs/growth-intelligence/MASTER_INDEX.md`. Use the index to read only relevant chapters, especially the interface and execution guidance in book 14 and the approval/reliable-system guidance in book 13.

Start with `git status` and inspect existing changes. This checkout has active, unrelated changes in strategy, agents, schema, SEO, tests, and documentation. Preserve them. Read current files rather than relying on this brief's snapshot. Do not reset, overwrite, reformat, or stage unrelated work. Follow current repository conventions and existing package scripts.

Inspect the actual implementation behind these starting points:

- `src/app/(marketing)/page.tsx`
- `src/components/marketing/{layout,sections,content,LivePreview,pricing,plans}.tsx` or the corresponding `.ts` modules
- `src/app/api/preview/route.ts` and `convex/preview.ts`
- `src/components/app/AppShell.tsx`
- `src/app/app/[organization]/today/page.tsx`
- `src/components/app/wish/WishComposer.tsx`, `WishFeed.tsx`, and the `api.workspace.sendChat` workflow
- `src/components/climb/{ClimbPanel,context}.tsx` and the `api.climb` workflows
- `src/components/app/onboarding/{OnboardingFlow,parseIntro,options}`
- `src/components/app/CommandPalette.tsx`
- Existing action cards, job lifecycle, content review, publishing controls, connection states, credit accounting, and entitlement checks
- Existing design-system references under `/design-system/v2`

The home wish flow and contextual Climb assistant currently use different APIs and histories. Map what each can do before changing either. Share presentation and introduce the smallest appropriate orchestration boundary; preserve useful existing conversations, action cards, job references, confirmations, and history. Do not blindly merge histories, silently reroute every request to a different assistant, or create a third disconnected chat product.

Keep the OpenAI-first engine, Convex/Vercel/Resend direction, existing image-provider paths, and Polar billing. Do not change models, economics, pricing, external providers, or entitlement policy as an incidental UX change. Use deterministic parsing and calculations where appropriate; do not add model calls for chip selection, navigation, or other ordinary interface behavior.

2. Establish the product's organizing journey.

Organize the experience around: understand my business → choose a priority → prepare work → review and approve → complete or publish → measure and learn.

Customers should always understand: what to do next, why it matters, what ClimbOS will do, what it needs from them, what it costs, and what happens after approval.

Use one business goal with related campaigns/initiatives, tasks, assets, and results. Reuse current records and relationships where they support this. A post, image, email, or landing page should be reachable in the context of the work it supports. Standalone tools must remain available. Do not invent a replacement campaign engine or make schema migrations merely to rename navigation.

3. Build one reusable composer presentation with context-specific behavior.

Create or extend the shared design-system components first. Use the same visual family, input behavior, suggestion treatment, validation, and status feedback across marketing, app home, and workspace onboarding. Keep public, authenticated, and workspace-creation controllers and permissions distinct.

The composer should have:

- A prominent multiline, auto-growing text input with a visible concise label, generous whitespace, and a clear submit control.
- ChatGPT-like familiarity in composition and interaction, expressed in ClimbOS's Signal design language. Preserve existing fonts, tokens, corner rules, colors, icon family, and density behavior. Do not import ChatGPT branding or impose oversized pill styling against the design system.
- Four concise suggestion chips below the input where space permits. Chips insert or augment an editable request; they never auto-submit, create a workspace, consume credits, or run a job. Do not overwrite a meaningful draft without an explicit choice.
- Correct empty, focus, composing, submitting, working, clarification, unavailable, rate-limited, recoverable-error, and insufficient-usage states.
- Keyboard support: Enter submits on desktop when appropriate, Shift+Enter adds a line, and IME composition never triggers accidental submission. Keep mobile multiline typing comfortable and provide an explicit send button.
- Preservation of entered text on failure, navigation where appropriate, and authentication handoff.
- Duplicate-submission prevention. Use existing request/job deduplication or extend it narrowly where required; a disabled button alone does not make an expensive request idempotent.
- Accessible names, focus management, status announcements, reduced motion, and usable touch targets. Do not move focus or auto-scroll someone who is reading older messages; offer a new-message indicator when appropriate.

Do not add attachment, microphone, web-browsing, model-picker, or upload controls unless the corresponding implementation is supported and useful in that context. Do not imply streaming or cancellation if the backend does not implement it. Show honest subscribed job progress where that is the available mechanism.

4. Make the public homepage composer the main CTA.

The first viewport should contain the navigation, a clear headline, one short explanation, the composer, suggestions beneath it, and a low-emphasis demo link. Remove the competing website/goal form and large duplicate signup CTA from this hero. Reuse its useful backend behavior. A compact header CTA may scroll to/focus the composer. Other page sections may retain appropriate contextual CTAs.

Use this copy as the baseline, refining length for the real layout:

Headline: “What would you like to grow?”

Supporting text: “Tell ClimbOS about your business and what you want to achieve. Get a clear next step, then prepare the work with guidance along the way.”

Composer label: “Your business and goal”

Placeholder: “I run a local accounting firm. Help me get more qualified inquiries. Our website is example.com.”

Suggestions:

- “Help me find more customers”
- “Plan my next campaign”
- “Improve my website”
- “Help me choose where to start”

Helper text: “Add a website if you have one. You can review what ClimbOS understands before continuing.”

Submit label: “Get started”

Secondary link: “Explore the demo”

Use public conversation as bounded business intake and preview, not an unrestricted anonymous agent. Understand a website, business description, and desired outcome from ordinary language. Show an editable interpretation; ask one missing essential question at a time instead of rejecting a natural-language request with a URL-only error. Unknown values remain unknown. A generic chip without a business should lead to a focused question about that business.

Reuse the existing rate-limited public preview when a valid website and the required information are present. If the visitor has no website, collect a description and preserve it into authenticated onboarding; do not pretend the existing website-preview backend supports website-free research. A small focused extension is acceptable if implemented with equivalent controls. Do not expose authenticated tools publicly.

Show actual results and real job states when a preview is possible. If preview configuration is unavailable, explain that and offer the demo or a preserved sign-in handoff. Never substitute unlabelled fixtures or fabricated research results.

Preserve request text, selected solution context, verified preview identity, and reusable completed research through sign-in. Avoid repeating paid work. Treat preview tokens and resume state as untrusted input: validate ownership, claim eligibility, expiry, and workspace binding on the server. Do not place business descriptions or full transcripts in URLs, analytics events, error logs, or session replay. Reuse secure preview-claim behavior, adding bounded server-controlled handoff state only if needed. Prevent duplicate claims, replay, and accidental imports into an existing unrelated workspace.

Public sessions have bounded input, turns, lifetime, model/tool usage, and abuse limits. Preserve existing network/robots protections. A request arriving through sign-in must be revalidated before any consequential or chargeable action; authentication does not implicitly approve a job or external write.

5. Make authenticated Today a conversational home with actionable depth.

At `/app/[organization]/today`, make the central composer the dominant initial interaction directly under the greeting/headline. Make the current business/workspace clear. Use “What would you like to work on?” as the heading and “Ask about your business, prepare work, or choose your next step…” as an initial placeholder.

Start with useful, permission-aware suggestions such as:

- “What should I focus on this week?”
- “Prepare posts for next week”
- “Show what needs my approval”
- “Explain my recent results”

Adapt suggestions to verified context, connected capabilities, unfinished work, and available data. If an action needs setup, either choose a more suitable suggestion or label the setup requirement. Do not suggest a platform as a recommended acquisition channel simply because the business is categorized as SaaS or ecommerce. Do not turn example quantities into promised outcomes.

After submission, transition into a readable conversation with the composer near the latest exchange. Show short answers, editable briefs, concrete action cards, and links to persisted work. Keep long research, sources, assumptions, calculations, alternatives, and execution logs behind deliberate disclosure.

Keep the goal, one recommended next action, review queue, active work, and a brief results summary accessible around/below the conversation. Prioritize urgent problems and approvals without turning the home into competing dashboards. A conversation is not the only way to find saved work.

Allow navigation to an editor and return without losing the conversation. Keep context/history explicitly scoped. If individual conversation creation/selection is needed, implement it using a real persistent model; do not show fake “New chat” or history controls. Preserve existing records and scope visibility to the appropriate member/role.

Unify the customer experience of Today, the command palette, and the contextual Climb side panel. They may retain distinct purposes, but drafts and actions should not be dispatched twice or disappear between surfaces. Clearly label any genuinely separate conversation context. Use shared presentation and existing action services instead of a broad unrelated backend rewrite.

6. Use the same composer when adding a company/workspace.

Both first-workspace signup and the workspace switcher's “Add company or workspace” action must open the same recognizable conversational onboarding experience. Preserve the existing `/onboarding?new=1` entry path or a compatible redirect. A new-company request must never accidentally resume or modify another company's onboarding.

Heading for an additional workspace: “Tell us about your next business.”

Supporting text: “Add its website or describe what it does. We’ll help you set up a separate workspace.”

Suggestions:

- “I’m adding another business”
- “I manage a client’s marketing”
- “This business has no website yet”
- “I’m launching a new product”

For the new-product suggestion, clarify whether this is a campaign in the existing business or a genuinely separate business before creating another workspace.

Support input such as: “I also run Northstar Accounting at example.com. We help local businesses with bookkeeping and want more consultation inquiries.” Treat this as an illustrative fictional business, not a researched fact.

The flow should:

- Extract an editable name, website/description, business type where known, audience, and goal. Ask for missing essentials without repeating information already supplied.
- Explain the intended workspace name and creation before the explicit creation action. Deduplicate repeated submissions.
- Check account entitlement and creation permissions on the server. Explain any limit before costly research; preserve the draft if creation is blocked.
- Create isolated company data. Never inherit another workspace's facts, brand, contacts, connection credentials, messages, budgets, or approval policy. Global preferences such as timezone can be suggested and confirmed.
- Bind drafts/resume state to the correct user and onboarding attempt; account switching, sign-out, or multiple tabs must not mix businesses.
- Let invited members access only the setup they are authorized to perform. Do not infer owner/admin permission from knowing a slug.
- Let someone cancel or leave setup and return to their prior workspace, and resume a partial workspace without creating another one.

The remainder of onboarding should use concise conversational steps with structured controls: business understanding → owner fact confirmation → one immediate priority → relevant constraints → review style → focused plan → first useful deliverable. Show an editable summary and progress. Keep a conventional form alternative. Do not request all integrations, a full brand questionnaire, or model-selection decisions before providing value.

Recommend “Review first.” Keep “Draft only” and “Approved recurring work” understandable and consistent. Recurring execution requires explicit bounded rules; creating a workspace or choosing a goal never authorizes publishing, sending, or spending.

7. Simplify app navigation without removing capability.

Use these stable primary destinations:

- Today: conversation, next step, approvals, active work.
- Growth plan: business understanding, goal, diagnosis, priorities, research, creative alternatives.
- Work: campaigns, content, calendar, email/ad drafts, pages, images, videos, creative assets.
- Customers: prospects, outreach, booking, pipeline, inbox, reviews, follow-ups, website chat configuration.
- Results: goal progress, analytics, revenue, search observations, experiments, scenarios.
- All tools: searchable specialist tools with optional personal pins.

Keep Connections, Business & brand, Team, Usage & billing, Activity, and other settings in a consistent workspace area. Keep Ask Climb and Pause activity readily accessible. Never confuse the owner's AI assistant with the customer-facing website chat widget.

Preserve existing routes/deep links. Reorganize access using current pages and records before adding new abstractions. Hide irrelevant complexity with useful grouping and progressive disclosure, not by removing features or making every screen an accordion. Explain “Customers,” “Work,” and any unfamiliar terms at their entry points.

On mobile, prioritize Today, Review, Work, Results, and More using real destinations/views. Review must open the actual review queue; do not add a placeholder route. Preserve account switching and pause access. Ensure 375px layouts, keyboard-open input, sticky composer, safe-area insets, and navigation do not overlap.

8. Use consistent action cards, approval, setup, results, and cost communication.

Each action should explain what it is, why it is relevant, what ClimbOS will do, what the owner needs to do, estimated credits/separate spend, and the next outcome measure or review step. Use specific buttons: Prepare drafts, Review email, Approve and schedule, Create paused campaign, Export, or Mark complete.

Keep drafting, approval, scheduling, attempted execution, confirmed external completion, and measured outcomes distinct. Preserve server-side authorization bound to tenant, exact artifact version, destination/account, recipient scope, budget, timing, and current policy. A chat request cannot grant permissions. Changed material content invalidates affected approval. Batch review must preserve inspection of each item and its destination.

Introduce automation in the relevant campaign: “Draft only,” “Review first,” and “Approved recurring work.” Show the actual limits, exclusions, expiry/review period, remaining allowance, exceptions, and pause behavior. Explain that pausing future work does not recall completed sends or delete published material.

Offer integrations at the moment they help. Explain what access permits. Distinguish plan entitlement, connection readiness, provider/operator setup, and action status. An upgrade must not be presented as fixing a provider-review or unsupported-channel issue. Preserve manual/export alternatives and do not discard successful drafts when execution is unavailable.

Show real progress and recovery actions. For uncertain external outcomes, reconcile before retrying; prevent duplicate execution. Preserve credit reservation, settlement, and audit behavior. Explain usage before a job starts and actual usage afterward. Changing input or clicking a chip costs nothing. Keep ad spend and external provider bills separate from subscription/credits. Do not invent a universal output count per credit allowance.

Results should explain what happened, what the evidence supports, what is missing, and what to consider next. Keep activity counts separate from inquiries/purchases, imported revenue, attribution, and forecasts. Show source, period, freshness, coverage, and uncertainty. Calculate material arithmetic in deterministic code. Keep unknown inputs unknown and label scenarios explicitly.

Preserve documented limitations: sampled website audits, manual AI-answer observations, partial integration coverage, private WordPress drafts, manually imported reviews, bounded experiments, and ClimbOS-hosted pages versus a customer's existing website. Re-read current capabilities because this checkout is changing. Do not imply recoverable page-draft history if it is still absent. This task does not authorize implementing every missing capability in the capability document.

9. Build a structured public website information architecture.

Use this primary navigation: Product · Solutions · How it works · Resources · Pricing. Keep Sign in and a restrained “Get started” entry. Use Product in the singular. Keep security, privacy, terms, status, and changelog accessible. Use real routes and preserve existing SEO/canonical behavior.

Product explains capabilities and their connection. Solutions explains customer situations. How it works explains the journey. Resources teaches and helps evaluation. Pricing explains subscription, usage, limits, and external costs.

The Solutions reference is the owner's supplied Jasper screenshot, also reflected in the navigation at https://www.jasper.ai/. The structural inspiration is three clearly separated groups: Solutions by use case, Solutions by role, and Solutions by industry. Use the information hierarchy, not Jasper's branding, images, card artwork, exact wording, or product promises.

On desktop, create an intentional wide mega-menu within the viewport. Lead with a compact editorial introduction beside four featured use-case cards; follow with separated, scannable role and industry link groups. Include “View all solutions.” Use the existing Signal tokens, flat color treatments, typography, subtle dividers, and original icons/illustration where suitable. Do not copy the screenshot's grid texture, gradients, photographs, or unsupported guarantees.

Support click, keyboard, Escape, focus return, outside dismissal, clear expanded state, and comfortable pointer movement. Keep header dropdowns as ordinary accessible website navigation; do not apply application-menu keyboard semantics incorrectly. If hover is supported, click/touch/keyboard must be equally reliable. On smaller screens, use an accessible drawer/disclosure pattern with expandable Use cases, Roles, and Industries; no clipped mega-menu or horizontal scrolling.

Use this ClimbOS-specific taxonomy and baseline copy:

Featured use cases:

- Growth strategy & launches: “Turn your business goals into clear priorities, launch plans, and practical next steps.” Route: `/solutions/use-cases/growth-strategy`.
- Content & campaigns: “Prepare coordinated posts, emails, visuals, and campaign work in your brand voice.” Route: `/solutions/use-cases/content-campaigns`.
- Search & AI visibility: “Review search readiness, inspect available search data, and track selected AI-answer observations.” Route: `/solutions/use-cases/search-ai-visibility`.
- Customer acquisition & follow-up: “Research relevant companies, prepare tailored outreach, and organize inquiries and follow-ups.” Route: `/solutions/use-cases/customer-acquisition`.

Additional use cases on the hub:

- Website conversion: evidence-backed page reviews, prioritized improvements, and editable page briefs. Route slug `website-conversion`.
- Paid advertising: Google/Meta campaign preparation, paused creation where ready, exact activation approvals, and available metrics. Route slug `paid-advertising`.
- Retention & reputation: lifecycle drafts, eligible customer follow-up, imported reviews, and approved neutral review invitations. Route slug `retention-reputation`.
- Results & experiments: connected/imported results, bounded comparisons, and explicit scenario assumptions. Route slug `results-experiments`.

Solutions by role, under `/solutions/roles/`:

- Business owners & founders (`business-owners`): choose priorities and review prepared work without operating every specialist tool.
- Marketing & growth teams (`marketing-teams`): coordinate campaigns, approvals, and measurement.
- Content & social managers (`content-social`): manage brand guidance, drafts, assets, and schedules.
- Sales & business development (`sales-teams`): inspect sourced prospects, review outreach, and track conversations.
- Ecommerce managers (`ecommerce-managers`): connect offers, campaign work, follow-up, and recorded business results.
- Agencies & consultants (`agencies-consultants`): organize authorized client work in separate workspaces; do not promise unimplemented white labeling or client-portal features.

Solutions by industry/business type, under `/solutions/industries/`:

- SaaS & technology (`saas-technology`): launch preparation, qualified demand, activation/lifecycle drafts, and business measurement.
- Ecommerce & retail (`ecommerce-retail`): product campaigns, page improvements, repeat-purchase messaging, and eligible revenue imports.
- Local service businesses (`local-services`): service offers, inquiry capture, local partnership research, and customer follow-up.
- Professional services (`professional-services`): positioning, consultation offers, sourced prospect research, and trust-oriented content.
- Agencies & studios (`agencies-studios`): distinct client business contexts, campaign work, assets, approvals, and results.
- Creators & small brands (`creators-small-brands`): consistent content, launch offers, sourced partnership research, and audience follow-up where eligible.

Build `/solutions` as a substantive hub using these three groups, with search/filtering only if it improves the actual page. Build meaningful detail pages for every linked solution using shared layout/data, not thin duplicates or empty placeholders. Each page needs a distinct problem, audience/context, example starting prompt, realistic workflow, relevant current capabilities, output examples clearly marked illustrative, requirements/limits, meaningful outcome measures, related links, and contextual CTA.

Use a shared typed content registry for hub/menu/page consistency. Do not produce a combinatorial page for every role × industry × use-case pairing. Detail-page content must remain genuinely specific despite shared components.

A solution-page CTA should open/focus the composer with an editable relevant request and trusted solution identifier. Carry this context through sign-in/onboarding. It is a starting preference, not evidence about the visitor, a locked channel recommendation, or authorization to execute.

Do not copy Jasper claims about guaranteed AI citations, rankings, personalization infrastructure, full continuous monitoring, or enterprise functionality. Do not target regulated sectors by implying specialist compliance capabilities the product does not have.

10. Arrange the homepage and supporting pages around comprehension.

Homepage order:

1) Hero with the primary composer and suggestions.
2) A clear product walkthrough from request to recommendation, prepared work, approval, and result explanation.
3) Featured Solutions by use case, with links to role/industry discovery.
4) The simple understand → plan → prepare → approve → learn workflow.
5) One coherent, explicitly illustrative campaign example showing linked assets and decisions.
6) A compact connected capability overview.
7) Approval, budget, pause, and owner-control explanation.
8) Supported integration paths and honest setup/manual alternatives.
9) Real evidence when available; otherwise clearly labeled product examples, without fabricated social proof.
10) Pricing preview from the existing authoritative billing configuration.
11) Focused FAQ.
12) Final CTA that returns to the composer and preserves an existing draft.

Avoid duplicating the same workflow explanation across sections. The walkthrough demonstrates the interface; the short step section explains responsibility. Move the ten AI executive/specialist roles into an optional deeper Product explanation instead of placing a large role grid before people understand the workflow. Customers should not need to select an AI CEO/CMO before making progress.

Provide a clear Product overview and working capability entry points for growth planning, content/creative, customer outreach, pages/conversion, results/learning, and integrations. Reuse existing useful destinations. Use a hub and in-page anchors where a dedicated page would add no distinct information. No dead links.

Resources should contain a working guided demo, substantive practical guides, clear getting-started help, and the existing changelog. Reuse existing help content where suitable and author a small useful starting set if none exists. Do not expose an empty blog, imaginary events, invented customer stories, or unfinished resource links. Keep developer API/MCP material in its appropriate secondary location.

Pricing must use current live configuration/entitlements rather than old planning documents. Explain inclusions, credit consumption, resets, actual top-up terms, workspace/seats, external costs, setup dependencies, and what happens at the allowance limit. Label worked usage examples as estimates supported by real code. Do not change the billing model or promise every provider connection becomes ready after payment.

Audit marketing claims against current runtime paths and `docs/Capabilities.md`. Resolve stale wording such as LinkedIn/X publishing readiness versus export-only descriptions, and overly broad advertising/publishing claims. Reuse an authoritative capability source where feasible while preserving tenant-specific readiness checks in the application. Distinguish what is supported in code from what is configured and ready for a particular customer. Do not call pricing or credits universal capability unlocks.

11. Verify the complete experience and hand it off honestly.

Use existing scripts for appropriate linting, type checks, unit/Convex regressions, and production build. Read applicable React/verification skill instructions when triggered. Add behavior-focused tests for changed, material boundaries rather than tests that mirror JSX.

Verify at least:

- Public composer parses a website/description and goal, asks a necessary clarification, preserves edits, handles no website, and shows honest preview-unavailable/rate-limit states.
- Suggestion chips never submit, spend, overwrite meaningful text silently, or create records.
- Sign-in preserves intended input/context. Preview/resume claim ownership, expiry, replay prevention, and duplicate-job behavior hold.
- Authenticated questions and work requests use the real existing services, preserve histories/job links, and do not dispatch twice across Today, command palette, and ClimbPanel.
- New-company onboarding creates/resumes the intended workspace, enforces limits, handles invited-member permissions, preserves separate business data, and survives cancellation/reload/account switching.
- Tenant isolation and exact approvals remain enforced for artifacts, destinations, recipient scope, budgets, and automation.
- No data, brand facts, contacts, connection credentials, or private conversation crosses workspaces through UI state, caches, subscriptions, or handoff tokens.
- Uncertain external results cannot be retried into duplicate sends/publishes.
- Every Solutions/menu/resource/product link has a meaningful working destination, page metadata, and appropriate contextual composer handoff.
- Mega-menu works with keyboard, pointer, touch, Escape, outside click, and focus return. Mobile drawers and sticky elements do not trap focus or cover content.
- Composer handles IME, multiline text, repeated submit, failure/retry, reduced motion, screen-reader status, 375px layouts, zoom, and mobile virtual keyboards.

Use deterministic fixtures/mocks for external writes and clearly identify them. Do not consume paid live AI/provider budgets or perform real sends/publishes to prove UI completion without separate explicit authorization. If live providers are unavailable, fully verify local flows and mocked contracts and report exactly which live claims remain unverified. Existing public preview access is not permission to run unbounded paid research.

Start the local app, inspect desktop and mobile in a browser, exercise the main flows, and fix observed issues. Inspect the real mega-menu and input/focus/error states, not just static screenshots. A successful build is not evidence that a provider connection works. Do not hide pre-existing failures; distinguish them from regressions and report commands/results.

Update affected UX/design-system documentation and `docs/Capabilities.md` only to match actually implemented behavior. Do not overwrite ongoing unrelated edits or mark unverified functionality Built.

The final handoff should identify changed files, describe the public-home → authentication → workspace journey, app conversation behavior, new-company onboarding, Solutions taxonomy, local run instructions, verification results, and remaining concrete limitations. Keep the delivery local.

The work is complete when a nontechnical customer can start from the prominent chatbox, express a goal without learning specialist terminology, confirm the business context, reach useful persisted work, understand the next approval/cost, and find the relevant solution without being confronted by the entire feature catalogue.

---

Reference for the requested Solutions grouping: [Jasper navigation](https://www.jasper.ai/), checked 25 October 2026, and the owner's supplied screenshot. This reference informs information hierarchy only; ClimbOS copy and capability claims must come from its own verified implementation.
