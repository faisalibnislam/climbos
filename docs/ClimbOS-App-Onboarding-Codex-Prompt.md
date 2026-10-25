# ClimbOS app and onboarding: standalone Codex implementation prompt

Use this prompt for the authenticated ClimbOS product, first-business onboarding, and additional company/workspace onboarding. It is self-contained. The public marketing website and Jasper-inspired Solutions navigation have a separate brief in `docs/ClimbOS-Chat-First-UX-Codex-Prompt.md`; this prompt supplies the detailed application requirements. These are requested changes, not claims that they have already been implemented.

---

Implement a complete, connected, polished UX improvement for the existing ClimbOS app in the current repository.

Make the product easy for nontechnical business owners while retaining its advanced capabilities. The main interaction is a ChatGPT-like conversational composer directly below the main headline on the app home and business onboarding, with relevant suggestion chips immediately beneath it. Conversation helps customers express intent; structured editors, action cards, approvals, calendars, customer records, and results let them inspect and complete the work.

This is an implementation task. Deliver working local flows, appropriate tests, a running app, desktop/mobile visual verification, and a truthful handoff in one continuous task. Do not stop at a plan, a prototype, a design-system specimen, or a chat UI disconnected from the real application. Keep delivery local: no push, PR, deployment, live customer sends/publishing, ad activation, or spending. Do not rebuild the public marketing website as part of this app-only task. Preserve any homepage-to-sign-in onboarding handoff already implemented.

1. Understand the current system before editing.

Read applicable AGENTS.md instructions and the relevant installed Next.js guides in `node_modules/next/dist/docs/` before writing Next.js code. Read current `docs/Capabilities.md`, `docs/Architecture.md`, `docs/DesignSystem.md`, `docs/ContentDesign.md`, `docs/SecurityAndData.md`, `docs/ProviderSetup.md`, and `docs/Verification.md` as relevant. Read `docs/growth-intelligence/MASTER_INDEX.md`, then the relevant interface, evidence, authorization, and durable-workflow sections of books 13 and 14. Treat the knowledge corpus as reference, not permission to run external operations.

Inspect `git status`, applicable instructions, existing tests, and real frontend/backend behavior. This checkout has ongoing unrelated changes; preserve them. Never reset, discard, or broadly reformat unrelated work. Re-read files before changing them because the implementation is evolving.

Trace these real entry points and their backing Convex functions:

- `src/app/onboarding/page.tsx` and `src/components/app/onboarding/`
- `src/components/app/AppShell.tsx` and `CommandPalette.tsx`
- `src/app/app/[organization]/today/page.tsx`
- `src/components/app/wish/WishComposer.tsx`, `WishFeed.tsx`, and `api.workspace.sendChat`
- `src/components/climb/ClimbPanel.tsx`, its context, and `api.climb` functions
- Growth plan, creative-strategy decisions, plan history, content/campaign/calendar, content-detail review, automation settings, customer/outreach/pipeline/inbox/reviews, pages/studio/images/reels, search visibility, results, connections, usage, billing, team, and policy screens
- Existing preview-claim, authentication, entitlement, usage reservation/settlement, job, approval, external-write, and audit contracts

Create a concise implementation checklist mapping existing routes to the proposed navigation and workflows. Do not confuse existing code with configured live provider availability.

Keep the OpenAI-first execution engine, Convex/Vercel/Resend direction, existing image routes, Polar billing, and current model eligibility/usage rules. Do not replace providers, change plan prices, redesign economics, or rewrite the agent architecture to achieve a UX improvement. Reuse existing entities and add only the persistence/adapters genuinely needed for the requested flows.

2. Use one coherent product model.

The owner journey is: understand the business → choose a priority → prepare the work → review and approve → complete/publish → measure and learn.

Organize existing records into a comprehensible relationship: business/workspace → goal → campaign/initiative → tasks/assets → results. Reuse existing links, campaigns, jobs, artifacts, approvals, and metrics. Where a new relationship is necessary, implement the smallest typed, tenant-checked extension. Do not create a replacement campaign engine just to group navigation.

Every screen should make its purpose and next step clear. Show the essential decision first, then expose sources, assumptions, full reports, calculations, and technical details on request. Preserve important costs, uncertainty, and consequences in the primary decision flow.

Allow direct specialist work. Customers must be able to make one image or edit one post without first creating a campaign or talking to the assistant.

3. Build a shared composer with dependable behavior.

Create or extend reusable components in the existing Signal design system, then use them in app home, onboarding, and contextual assistant presentation. Follow existing fonts, token colors, typography, spacing, corner rules, icons, focus states, and density settings. ChatGPT-like refers to familiar composition and conversation behavior; retain ClimbOS branding and its design language.

The composer needs a visible label, multiline auto-growing input, clear submit control, concise helper/status text, and four short suggestion chips beneath it when space permits. Keep it visually dominant in the initial app-home and onboarding viewport. Do not put an unrelated large button above it that competes as the primary action.

Suggestions populate an editable request; they never submit, consume credits, create a workspace, change policy, or execute work. If meaningful text already exists, preserve it or offer an explicit replace/append choice. Use context-sensitive suggestions based on verified state, actual permissions, and useful next decisions. Avoid rotating promotional suggestions and unsupported platform promises.

Support Enter-to-send where appropriate on desktop, Shift+Enter for new lines, IME composition, explicit mobile submission, disabled/empty validation, slow/working state, failure recovery, and repeated-submit prevention. Preserve text and input context on failure. Give buttons meaningful accessible names.

Do not show attachment, voice, model, search, stop-generation, or upload controls unless their behavior is genuinely supported. Use subscribed job updates if token streaming is unavailable. A browser-side disabled button is not request idempotency: use a durable submission identity where required to prevent duplicate paid work and duplicate workspace creation.

After submission, show the accepted user message, real working status, and response/action result. Do not clear the input into an unexplained empty page. Preserve the conversation and drafts across relevant navigation/reload. Keep private drafts scoped to the authenticated user and the correct workspace or onboarding attempt. Clear or segregate client state on account/workspace changes.

Respect readers: do not force-scroll when someone has scrolled up; offer a new-response indicator. Do not autofocus on mobile unexpectedly or repeatedly announce every progress token to screen readers.

4. Implement first-business onboarding as a guided conversation.

Entry should work after ordinary signup, preserved public-home intake, an incomplete existing setup, and a business with no website. Respect invite flows: an invited member should enter their authorized workspace rather than be forced to create a business.

Initial heading: “Tell us about your business.”

Supporting text: “Add your website or describe what you do. We’ll help you choose a useful place to start.”

Input label: “Your business and goal”

Placeholder: “I run a local accounting firm. We help small businesses with bookkeeping and want more consultation inquiries. Our website is example.com.”

Suggestion chips:

- “I want more customer inquiries”
- “Help me market my business”
- “I’m launching something new”
- “I don’t have a website yet”

Treat example businesses as fictional examples. Never turn placeholder values into actual workspace facts.

Accept ordinary language. Extract name, website/description, goal, and constraints where explicitly supplied. Show an editable “Here’s what I understood” summary. Ask one necessary question at a time for missing essentials. Do not silently make a budget, audience, business name, or website claim more specific than the owner's input. Offer a conventional form alternative using the same persisted state.

Use these logical checkpoints without turning them into a long mandatory form wizard:

A. Business identity and workspace creation. Confirm the proposed business name and website/description; check creation entitlement and authorization before expensive research. Make the actual creation action explicit. Prevent duplicate creation on retries/reloads.

B. Business research. Show real progress and sources when supported. Explain inaccessible websites, partial reads, or setup problems and retain successful work. Support owner-provided facts when a website is absent. Do not call a synthetic progress animation completed research.

C. Fact and brand confirmation. Present a short grouped summary of the most important facts. Let the owner edit, reject, add, or leave unknown values. Prioritize facts required for the first action; secondary facts can stay unconfirmed, but must not become trusted publishing claims. Research-derived brand preferences remain unconfirmed until an authorized owner/admin saves them. Do not force approval of dozens of extracted statements just to continue.

D. Immediate priority. Offer “Get more inquiries,” “Increase purchases,” “Keep customers coming back,” “Launch an offer,” and “Help me decide.” Ask what a useful outcome means for this business. Use “I’m not sure” where an answer is genuinely unknown.

E. Practical constraints. Ask relevant questions about geography, capacity, time, deadline, spending, and existing channels. Ask only what affects the recommendation. Separate ad budget, subscription price, external-provider bills, and AI usage. A budget of zero is a valid no-paid-ads choice; unknown is not automatically zero.

F. Review style. Recommend “Review first.” Explain “Draft only” and “Approved recurring work” in ordinary language. Defaulting a UI does not grant standing execution permission; recurring automation needs its explicit bounded configuration.

G. Focused starting plan. Show the priority, reason, a small set of actions, dependencies, usage estimates, measures, and next review. Preserve existing quality/staleness gates and any expert strategy details behind deliberate disclosure.

H. First useful deliverable. Offer the most relevant draft, review, research task, or improvement brief. Show cost/scope before a metered run. Connect the generated record to its real editor and review flow. This is a value checkpoint, not a requirement to publish before entering the app.

Let users save/resume, correct earlier information, and finish setup later. Show what is already complete and what still blocks a particular task. Do not re-run completed research or planning simply because an onboarding screen was revisited. Resolve material changed-input staleness through existing contracts instead of silently keeping an old recommendation current.

Do not require every connection, specialist role, detailed brand questionnaire, or AI mode choice before delivering value. Keep model modes contextual and preserve their actual eligibility/cost/escalation behavior.

5. Implement additional company/workspace onboarding with strict separation.

Use the same composer and checkpoints from the workspace switcher's “Add company or workspace” action. Preserve `/onboarding?new=1` or an equivalent compatible entry. This flow creates a new business context and must not accidentally resume the current workspace's incomplete onboarding.

Heading: “Tell us about your next business.”

Supporting text: “Add its website or describe what it does. We’ll help you create a separate workspace.”

Suggestions:

- “I’m adding another business”
- “I manage a client’s marketing”
- “This business has no website”
- “I’m launching a new product”

For a new product, clarify whether it belongs to the current business or requires a separate workspace. Do not automatically multiply workspaces for campaigns or offers.

Before creating, explain the proposed name and entitlement impact. Check authorization and limits server-side; preserve entered information when blocked. Returning from a billing/settings screen must not automatically charge for or create a business.

Never inherit facts, brand, goals, contacts, audiences, connection credentials, approval policies, budgets, transcripts, or private assets from another company. Offer only appropriate global preferences, such as timezone, for confirmation. Any future deliberate template import must have explicit preview/selection and tenant checks; do not invent such a feature as an incidental shortcut.

Bind drafts, preview claims, pending research, and resumable state to the correct authenticated identity and intended workspace/attempt. Handle multiple browser tabs, canceled setup, session expiry, account switching, removed membership, duplicate submissions, and back navigation. A canceled new-workspace setup should return to the previous authorized workspace; if creation already occurred, clearly offer to resume that partial workspace rather than pretending it never existed.

Preserve public intake context when legitimately provided. Validate token ownership, expiry, single claim/replay behavior, target tenant, and current permission on the server. Do not trust a client-provided slug or an AI-selected tenant ID. Do not put business descriptions/transcripts into query parameters, analytics, or error logs.

6. Make Today the conversational app home.

Initial hierarchy:

- Current workspace and a restrained greeting/headline.
- The prominent composer directly below: “What would you like to work on?”
- Suggestions below: “What should I focus on this week?”, “Prepare posts for next week”, “Show what needs my approval”, “Explain my recent results”.
- One recommended next step and a compact review/exception summary.
- Active work, the current goal, and a short recent-results update at lower emphasis.

Show an urgent actionable failure above the conversation only when it deserves that priority. Avoid a wall of role avatars, metric tiles, idea decks, onboarding nags, or activity feeds competing with the primary action. Keep valuable existing components, but reorganize their prominence.

After a message, show a readable conversation with concise answers and concrete persisted action cards. Keep the composer near the latest exchange in conversation mode. Distinguish answering a question, preparing work, approving work, and executing an approved external action. Asking “How could we use ads?” should not create or activate an ad campaign.

If a request is ambiguous, ask the minimum clarification and preserve the original request. For a substantial chargeable job, present scope and estimated usage before dispatch when it is not already covered by a valid bounded policy. Do not add repetitive confirmation dialogs for simple navigation or reading available workspace information.

An action card should link to its actual run, artifact, campaign, or review screen. Opening an editor and returning must preserve the conversation and selection context. Do not bury deliverables solely inside chat text.

Differentiate “Nothing needs your review,” “No work is scheduled,” “Work is running,” “Not enough data yet,” and “A connection needs attention.” These are different states with different next steps.

7. Coordinate Today, Climb AI, and command search.

Audit `api.workspace.sendChat` and `api.climb` before changing routing: they currently represent different workflows/history. Reuse their capabilities through a minimal typed boundary where needed. Do not add a generic unbounded model endpoint that bypasses existing budgets, tools, provenance, or approvals.

Give the user a coherent experience: shared composer/response conventions, clear conversation context, persisted message-to-job/artifact references, and no duplicate dispatch from the command palette, home, or side panel. Preserve old history and pending approvals. Distinct existing threads can remain separate if clearly labeled and reachable; do not misleadingly imply they are one history.

Contextual Ask Climb should support “Explain this,” “Help edit this,” and “What happens if I approve?” with explicit current entity references. Validate all entity ownership and permissions on the server. Rendered page summaries, selected text, and model output are untrusted context, not authorization.

Command search should find pages, records, and tools without requiring an AI call. A typed request can be handed to the correct composer without auto-sending. Use “Ask Climb or find a tool…” instead of vague “Make a wish” language.

Only show New conversation/history controls if backed by real persisted behavior. If conversation persistence needs a small extension, implement tenant/member visibility and deletion/archive semantics consistently with current privacy policy. Do not silently expose one person's private drafts to every teammate.

8. Simplify the app shell and navigation.

Use stable primary destinations: Today, Growth plan, Work, Customers, Results, All tools. Keep a visible Review queue entry/count accessible from the shell and Today. A workspace menu provides Connections, Business & brand, Team, Usage & billing, Settings, and Activity. Keep Pause activity and Ask Climb available throughout.

Map existing routes into these groups; retain all existing deep links and useful functionality. Do not confuse fewer sidebar entries with removal of tools. Add functional overview pages where a group needs an entry, using actual persisted data and links rather than placeholder cards.

All tools should be searchable by everyday task and familiar specialist names. Group research/planning, content/creative, sales/customers, website/search, measurement, and operations. Explain unfamiliar terms. Optional personal pins are useful only if implemented persistently with correct user/workspace scope.

On mobile, offer Today, Review, Work, Results, and More using real working destinations. Keep workspace identity/switching and pause reachable. Preserve navigation and drafts after returning from an editor. Avoid rearranging the sidebar automatically when recommendations change.

9. Make the Growth plan usable at two depths.

The default view shows the confirmed goal, main constraint/opportunity, current priority, a concise recommended action sequence, required inputs/connections, spending/effort assumptions, success measure, and review date. Use plain language; explain technical terms on demand.

The deeper view preserves diagnosis, channel scorecards, research, competitor sources, economics, assumptions, alternatives, expert analysis, plan discussion/history, and quality/staleness indicators. Do not replace a detailed working plan with a generic AI summary or remove advanced controls.

Preserve plan versions and current approval gates. Approving a strategy is distinct from approving all its future sends/publishes/spend. Show exactly what the approval starts, what remains a draft, and what needs another decision. Keep the last good plan visible if a refresh fails and label outdated inputs clearly.

Preserve current creative exploration: grounded, adjacent, and bold options, requested creative range, source precedents, separate evidence/fit/feasibility/risk dimensions, reversible tests, and workspace-scoped selected/rejected/edited decisions and outcome notes. Current code and capabilities already include evolving controls here; inspect before editing. Do not suppress bold alternatives merely because they lack close precedent. Selecting an idea is neither proof it works nor execution permission. Retain distinctions between owner notes, measured results, and causal evidence.

Let owners correct a business fact, change a preference, defer a task, and report a result using existing supported actions. Explain which changes affect the current plan and when regeneration would consume usage. Do not automatically re-run expensive planning on each edit.

10. Make Work the home for prepared and active deliverables.

Provide a useful overview of campaigns/initiatives, content, calendar, creative assets, pages, and current jobs. Offer list/calendar views where meaningful. Preserve filters and return context. Show real status, campaign/goal relationship, destination, owner if supported, and next required action.

Campaign detail should show the brief, audience/offer, linked work, schedule, approvals, setup needs, usage/spend limits, and results. Reuse existing campaign records. If a relationship is unavailable, explain the current workflow and add only the minimum persisted links needed; do not invent synchronization that does not exist.

Creation should begin with the desired deliverable and a short request. Infer only confirmed brand/business context. Ask for missing essential offer, audience, channel, or destination information. Make channel-specific output visible in the editor. Preserve standalone creation.

For social/calendar, keep workspace timezone explicit, preserve scheduled versus review-pending states, and ensure moving an Autopilot post keeps its real slot consistent. A failed publish must not appear completed. Show a preview for the actual supported destination/media and an export path where automatic publishing is unsupported.

For images/design/video, share the existing asset library and context. Show supported provider/render readiness, usage estimate, running/failed/rendered status, and intended dimensions/format. Do not imply that a generated visual is a genuine customer/product photograph or that an unconfigured video pipeline completed production.

For email, separate drafting from eligible sending. Show exact recipients/segments, consent/suppression eligibility, sender, unsubscribe handling, content version, and timing at approval. Imported contacts are not automatically marketable. Preserve the distinction between customer Resend marketing sends and separately authorized mailbox outreach; do not repurpose Resend for cold outreach.

For ads, preserve paused creation and separately bounded activation. Show account, destination, dates, audience, budget ceiling, plan/connection prerequisites, and status. Report provider metrics without relabeling ROAS as causal profit.

11. Give Review a unified queue and precise item detail.

Collect existing reviewable work through authorized queries without creating a second conflicting approval ledger. Separate routine content, strategy approvals, budget/spend decisions, sends, page publication, experiment exposure/application, and exceptional or uncertain items.

Default to the next actionable item. Show the exact artifact version, preview, relevant claims/sources, account/destination, timing/timezone, audience/recipient scope, cost/maximum spend, and consequence. Offer Edit, Request changes, Defer where supported, Reject, and the exact approval action.

Material edits invalidate affected approval. Keep stale/expired approvals blocked with an explanation and path to renew. A reviewer's role in the UI must match server permission. An unauthorized person can request review rather than finding a nonfunctional approve button.

Batch review can help similar items, but must show each item/destination and exclusions. Do not combine unrelated high-impact spend and ordinary content into a broad “Approve everything” shortcut.

Retain the original approval binding to tenant, artifact version/hash, destination, time window, budget, recipient scope, and policy. Recheck at execution. Keep approvals consistent when initiated in chat, a list, or an editor.

12. Make Customers understandable and evidence-backed.

Provide clear views of inquiries/messages, prospects, pipeline, follow-ups, reviews, and website chat configuration using current records. Distinguish a researched prospect, imported contact, inbound lead, and recorded customer; do not assume purchase or consent from list membership.

Prospect detail should show the source, observation date, business fit reasoning, verified contact route or unknown state, stage, notes, planned outreach, and linked conversation/outcome. Keep public-source research bounded; do not present an invented lead database or guessed email address.

Pipeline stages should use language owners understand and preserve existing progression/booking flows. Make manual notes and manual completion explicit; do not infer confirmed bookings or sales from draft generation or an email attempt.

Inbox should distinguish connected messages, imported material, and owner-entered notes. Drafted replies are not published replies. Sensitive responses route to the right reviewer. Preserve current limited phrase-matching theme behavior, dated examples, correction/dismissal, and coverage limits; do not rename it full semantic customer intelligence.

Reviews should make manual import and native-publishing limits clear. Neutral review invitations show exact public destination, recipients, and template for approval, with the same public-review option regardless of sentiment. Never gate public reviews based on private feedback.

Keep the visitor-facing website chat widget clearly separate from the owner's Climb assistant. Show its configured knowledge, inquiry capture, and supported installation/setup path accurately.

13. Make website and search workflows specific and honest.

Website audit should show the actual sampled pages, source/capture context, evidence type, confidence, finding, customer consequence, and next action. Keep a short prioritized view with inspectable details. Preserve supported accept/defer/dismiss/correct/resolve/reopen behavior and audit linkage.

Design Critic directions should explain quick-fix/redesign/bold alternatives, trade-offs, assumptions, effort, and a measurable reversible next step. Preserve the editable page brief and confirmed brand context. A template preview is a ClimbOS template, not an edited rendering of the customer's website.

ClimbOS landing-page creation needs a clear distinction between draft editing, desktop/mobile preview, and publishing a ClimbOS-hosted page. Label live-page entitlement/setup before publication. If recoverable draft history remains absent, do not imply undo/history exists; show saved/unsaved state, preserve recoverable local input where safe, and make destructive replacement clear. Do not claim a new version-history engine unless you actually implement it within justified scope.

WordPress support should show “Create private draft” with the supported confirmation and read-back, never imply live publishing.

Search readiness should distinguish sampled static checks, connected Search Console snapshots, CSV generative-AI report imports, manual AI-answer observations, and copy-only structured-data drafts. Show matching property and freshness. Do not imply continuous AI market-share tracking, indexing/ranking guarantees, or automatic CMS schema installation.

14. Make Results explain decisions.

Start with progress against the selected goal, a plain-language summary, and the most useful next interpretation. Then show campaign/channel details, revenue, cohorts, search observations, experiments, and scenarios as appropriate to available data.

Every important number needs its period, unit, source, freshness, and material coverage/attribution limitation. Distinguish completed work from commercial outcomes, imports from platform claims, and observation from causation. Do not add platform conversions together as total revenue.

No-data, stale-data, partial-import, wrong-property, provider-error, and insufficient-sample states need different explanations and next actions. Missing data is not zero. Do not show invented graphs or fake success rates to fill an empty dashboard.

Scenarios need visible owner inputs, assumptions, deterministic arithmetic, uncertainty, and sensitivity where supported. Call them scenarios or estimates. Do not promise perfectly accurate growth/revenue forecasts.

Preserve bounded experiment design, exact variants, start/stop approvals, and meaningful windows/sample limits. Distinguish a measured difference from supported causal inference. Applying variant B requires the exact still-matching baseline and current authorization, and must remain idempotent. A graph must not silently apply a winner.

15. Make Connections and automation useful at the point of need.

Prompt for a connection when it enables the current task. Explain requested access, selected account/property, read versus write, what remains manual, and revocation/reconnection. Preserve supported OAuth/account-validation paths; do not ask customers to paste privileged operator secrets into chat.

Keep separate concepts: plan entitlement, customer connection readiness, operator/provider approval, and action lifecycle. A subscription upgrade cannot fix unsupported integration behavior or provider review. Offer draft/export/manual paths when supported.

Preserve current workspace automation registry/settings, website-monitor controls, Autopilot, job schedules, standing policies, and emergency stop. Make each automation discoverable in its relevant work context and in settings. Show what it does, trigger/schedule, timezone, allowed access/actions, limits, next run where reliably known, most recent outcome, and where to pause.

Use three understandable review styles: Draft only, Review first, Approved recurring work. Recurring setup needs explicit channel/account scope, cadence, brand/offer boundaries, usage/spend ceiling, expiry/review conditions, and escalation behavior. Do not add a global autonomy toggle that overrides more restrictive existing controls.

Pause should stop eligible future operations according to actual backend semantics. Explain in-flight or already-completed actions. Preserve role restrictions, revocation, and audit records. Do not claim pausing recalls email or removes published posts.

16. Make business settings, usage, and team controls approachable.

Organize workspace settings into Business & brand; Connections; Team & permissions; Review & automation policies; Usage & billing; Activity & data/privacy; and Advanced settings. Reuse current routes and keep technical webhooks/API/MCP/specialist configuration in the appropriate advanced area. Preserve existing supported functionality.

Business settings should allow correction of key facts and goals with their source/confirmation state. Brand settings should show tone, examples, preferences, and relevant unknowns. Distinguish a factual correction from a preference change and use existing staleness/version behavior for affected plans and actions.

Team views must use the repository's actual roles and permissions, not a newly invented role model. Clarify who may draft, edit, approve, connect accounts, manage billing, and stop/resume work. Server enforcement remains authoritative. Do not expose cross-workspace records through selectors or cached summaries.

Usage should show the real allowance, remaining credits, resets/expiry, estimates before jobs, and actual use afterward. Preserve reservation, settlement, failure/refund/reconciliation rules as implemented. Explain whether a retry may cost additional credits. Never change billing behavior to make a display convenient.

Show top-up/upgrade choices only when relevant, with real configured terms and an explicit purchase path. No automatic purchase because a chat request needs more credits. Keep subscription, AI usage, ads, and external provider costs distinct. Do not claim credits equal a universally guaranteed output quantity.

17. Make every state legible and recoverable.

Use one coherent status vocabulary while preserving the real state machine: Draft; Working; Needs information; Needs review; Approved; Scheduled; Executing; Confirmed completed; Outcome uncertain; Failed; Canceled; Archived where supported. Do not present states the backend cannot distinguish.

For every failure, show what happened, what remains saved, whether anything external may already have occurred, and one useful next step. Preserve successful drafts when a connection fails. Never blindly retry an uncertain external send/publish; reconcile using existing external IDs/idempotency safeguards first.

Use real progress, not fake percentages. Keep long-running work resumable and accessible outside chat. Respect existing cancellation semantics and report when an operation cannot be recalled. Restore meaningful drafts on recoverable errors without leaking them across identities.

Make mobile and accessibility requirements part of each screen: visible labels, keyboard/focus operation, text plus color statuses, screen-reader announcements, no focus traps, readable zoom, reduced motion, sufficient contrast, comfortable touch targets, and no sticky composer/navigation overlap when the keyboard opens. Verify the smallest supported layout around 375px.

18. Preserve evidence, permission, privacy, and cost boundaries.

Show measured, owner-reported, source-reported, assumed, inferred, and calculated information distinctly when it matters. Unknown is a valid state. No invented customers, testimonials, prices, results, contacts, statistics, or case studies.

Derive tenant identity from trusted authenticated server context and validate ownership/membership for each record. Prompt injection in websites, uploaded source material, model output, selected page text, or chat cannot grant tools/permissions. Preserve outbound eligibility/suppression and provider/network safety controls.

Bind consequential actions to the exact approved scope and recheck immediately before execution. Preserve budget ceilings, policy expiry, destination validation, and duplicate-operation protection. Keep current audit/activity linkage without logging secrets or full private chat input into ordinary telemetry.

Use existing accounting and job systems for model calls. Navigation, chip insertion, straightforward parsing, filtering, and material arithmetic should not incur unnecessary AI calls. Cache only with correct tenant/input/version scope. Do not silently raise budgets or change model routes to make a demo feel faster.

19. Test complete owner journeys, not just components.

Use current package scripts and repository conventions for relevant type checking, lint, unit/Convex regressions, production build, and browser verification. Add tests for material new behavior. Avoid brittle snapshots or tests that merely restate JSX.

Exercise these journeys with appropriate fixtures/mocks:

- Signup → natural-language business intro → edit extracted facts → choose goal/constraints → review style → plan → first real draft/editor.
- No website → owner description → confirmed essentials → useful starting plan without fabricated research.
- Preserved public-home context → sign-in → authorized claim → no duplicate paid research or unintended existing-workspace modification.
- Existing member → add company → entitlement check → new isolated workspace → resume → return to old workspace with no data bleed.
- New-product request → clarify campaign versus business → correct destination.
- Today question → real answer; Today work request → scoped job → persisted artifact; open editor → return with conversation intact.
- Palette/side-panel/home handoff → no duplicate jobs or disappearing approvals/history.
- Draft → edit → review exact version/destination → schedule/export using correct capability and permission; stale approval remains blocked.
- Missing/expired connection → preserved draft → useful setup/manual alternative.
- Strategy refresh failure → last valid plan/history preserved; creative decisions/outcomes remain correctly tenant-scoped.
- Recurring-work policy → bounded schedule → pause/revocation → correct future/in-flight behavior.
- Results with no/stale/partial data → truthful explanation; supported experiment application cannot double-apply or overwrite a changed baseline.
- Insufficient credits → preserved request → real allowance/top-up options without automatic purchase.

Include authorization/isolation cases for unprivileged members, removed membership, guessed record IDs, preview/resume replay, stale role changes, two workspaces/tabs, account switching, duplicate submits, and uncertain external outcomes. Confirm no writes run because a suggestion chip, navigation event, or AI answer requested them.

Mock consequential provider writes and paid model jobs during local verification. Do not spend real provider budgets, send real outreach, activate ads, or publish to customer accounts to demonstrate completion. Label fixtures and unavailable live-provider verification honestly.

Start the local app and visually inspect actual desktop and mobile flows, including chat empty/active/error states, keyboard behavior, onboarding/resume, workspace switcher, grouped navigation, editors, review, connections, results, and settings. Fix what the inspection reveals. Apply relevant React/verification skill instructions when triggered. A successful build does not prove usability or live integration readiness.

20. Deliver a reviewable local result.

Update affected design-system and UX documentation to match the implementation. Update capabilities only for behavior actually implemented and checked; preserve ongoing unrelated edits. Do not label configured-provider-dependent features universally ready.

The handoff must explain what changed, where to open/run it locally, how onboarding and adding companies behave, how the main conversation reaches persisted work, how existing chat paths are coordinated, where every major capability lives, and how approval/cost limits are maintained. Report tests and visual checks actually performed, pre-existing versus introduced failures, and any specifically unverified live behavior.

Completion means a nontechnical owner can express a goal in the prominent chatbox, confirm business context, choose a useful next step, inspect/edit the prepared work, understand and grant the correct approval, and interpret the recorded outcome. They can find every existing tool without learning the whole product on the first visit, and they can add a second company without mixing data, permissions, or conversations.
