# Codex prompt: follow the approved ClimbOS experience

Use this prompt as the UX contract for the ClimbOS task I give you. The current simplified app is the approved baseline. Extend and improve it consistently; preserve working features and real customer data. Apply these requirements within the requested task's scope. This document does not independently authorize publishing, sending customer messages, spending money, or deploying.

## 1. Understand the current implementation first

Work in the ClimbOS repository.

Read `AGENTS.md`, `docs/AppExperience.md`, `docs/DesignSystem.md`, `docs/ContentDesign.md`, and relevant parts of `docs/Capabilities.md`. Route growth-related questions through `docs/growth-intelligence/MASTER_INDEX.md` and read only relevant chapters. Inspect the actual routes, components, backend functions, permissions, and tests before changing behavior. Documentation describes intent; verify implementation in source.

Before writing Next.js code, read the relevant installed guides in `node_modules/next/dist/docs/`, resolving the package location if necessary. Inspect Git status and preserve all unrelated changes. Reuse the existing stack, design tokens, components, and backend services. Keep the OpenAI-first engine, Convex/Vercel/Resend direction, Polar billing, and existing image-generation flows unless my task explicitly changes them.

## 2. Design for someone without business training

The owner may have never used business software. They should understand what each page does, what happens when they press a button, and what to do next without learning marketing terminology.

Use familiar, respectful language. Do not sound childish or assume the person understands business jargon. Lead with the useful answer, explain why it matters, then offer one clear next step. Ask one essential question at a time. Offer “I'm not sure” or “Help me choose” where meaningful, without inventing an answer on the person's behalf.

Use these kinds of translations in interface copy:

| Specialist wording | Everyday wording |
|---|---|
| Lead / prospect | Possible customer |
| Pipeline | Customer progress |
| Campaign | A group of posts, emails, or ads working toward one goal |
| Conversion | The relevant action, such as a booking, purchase, or signup |
| Channel | Where you reach people |
| Retention | Customers who keep buying or paying |
| Attribution | What may have helped bring this result |
| Revenue | Money from sales, before costs |
| Forecast | An estimate of what might happen |

Translate according to context, preserving the actual meaning. Never relabel revenue as profit, a contact as a customer, or an estimate as a recorded result. Keep exact stored values, tool identifiers, formulas, permissions, sources, and units intact. Explain necessary specialist terms on first use and make optional word help available.

## 3. Keep the shared chatbox as the main starting point

Home and business onboarding use the shared `src/components/ui/request-composer.tsx`. Extend it instead of creating inconsistent copies.

On Home, keep the dominant prompt “What would you like help with?” and the reassurance “Use your own words. You do not need to know marketing or business terms.” Use a visible input label, a meaningful example, and an explicit submit button. Place up to four relevant suggestions underneath the chatbox. Keep contextual page help secondary to the main task.

Suggestions prepare editable requests. They must never submit automatically, erase meaningful existing input, trigger paid generation, publish, or send a message. Command search must also hand a natural-language request to Home as an editable draft. Use deterministic local search for navigation and tool discovery.

Retain multiline editing, visible loading states, duplicate-submit protection, keyboard access, IME composition support, and mobile submission behavior. On a desktop keyboard, Enter sends and Shift+Enter adds a line; text composition must never accidentally send. Use explicit submission on mobile. Preserve drafts through appropriate navigation and isolate them by authenticated person and business.

Show real request progress and real outputs through existing services. Do not create a decorative chatbot, simulated completion, or a third competing conversation backend. Home requests and contextual page-help conversations currently use different services; explain that distinction honestly and preserve their histories. Do not add unsupported microphone, attachment, or voice controls.

## 4. Make first and additional business setup equally understandable

Start with “Tell us about your business.” When an existing owner adds another business, use “Tell us about your next business” and explain that its information and connected accounts are separate.

Accept a website or a plain description. Support businesses without a website. Extract useful details into editable fields and let the owner correct the name and facts. Keep a conventional form alternative and carry existing answers between the chat and form. Do not ask again for information already supplied.

Guide the owner through small, resumable steps: describe the business, learn about it, check the details, choose a goal, choose the review rules, and see the next steps. Hide optional research-depth settings under More options. Ask to connect accounts when a chosen task needs them, with a plain explanation of the benefit and access required.

Use specific actions such as “Create business & continue.” Explain when this creates a business space or starts research that uses credits. Keep the consequence of confirming remaining business facts visible beside the continuation action. Never invent missing business facts, customers, budgets, or permission.

Keep review choices understandable: Draft only, Review first, and Approved recurring work. Describe the exact scope of recurring permission. An advertising budget is separate from the subscription, and zero must remain a valid choice where supported. Adding a business must not silently change the subscription or grant new execution rights.

Preserve tenant isolation and role checks. An unauthorized business URL must show an access explanation, never silently switch to a different business. Reset temporary assistant state when the signed-in person or business changes. Prevent duplicate business creation on repeated clicks or retries.

## 5. Preserve the six main destinations

| Navigation label | What the owner should understand |
|---|---|
| Home | Ask for help, follow requests, and see the next step. |
| Your plan | Understand what to focus on and why. |
| Your work | Create and manage posts, emails, ads, pages, images, and videos. |
| Customers | Find possible customers, follow conversations, and manage customer progress. |
| Results | Understand what happened and what remains uncertain. |
| All tools | Find a tool using everyday words or specialist terms. |

Use `src/components/app/navigation.ts` as the shared navigation and tool-search registry. Add new tools to an appropriate existing area rather than adding another top-level destination by default. Preserve existing specialist routes, editors, records, and deep links. Tools must open real working destinations. Keep reviews, connected accounts, credits, settings, and pause controls easy to reach. Group technical configuration under Advanced tools with existing role restrictions.

Every page should explain its purpose briefly, show the relevant work or information, and make the next useful action clear. Show reasons next to recommendations rather than only in hover tooltips. Keep detailed editors and direct controls available; users should not have to chat to perform every action. Preserve the difference between the owner's assistant and chat installed on the owner's website for visitors.

## 6. Reveal detail when it becomes useful

Avoid a wall of features, metrics, setup fields, or recommendations. Show a small relevant set first, with a clear way to see more. Keep costs, approval consequences, required fields, errors, and blockers visible instead of hiding them under More options.

For work in progress, state what is happening and what the owner can do. For empty states, explain what belongs there and offer a useful first action. For errors, say what failed, what was saved, and how to recover. Never show an empty value as zero unless zero is known. For results, preserve source distinctions such as Recorded, Estimated, Reported by the platform, and Based on your inputs. Explain missing data, stale connections, assumptions, and uncertainty in ordinary language.

Use the existing Signal design system and shared components. Preserve typography, spacing, colors, focus states, and restrained styling. Extend the shared system when necessary. Test mobile layouts, keyboard navigation, readable contrast, labeled inputs, focus restoration, and reduced-motion behavior. In-page review links must scroll and move focus after their data has loaded.

## 7. Keep helpful explanations connected to safe, real execution

Reuse `shared/agents/ownerLanguage.ts` for owner-facing language guidance and keep related runtime, contextual assistant, and skill instructions consistent. Concise owner explanations must not arbitrarily shorten a requested article, email, page, or video script; generated deliverables still follow their requested format and channel requirements.

Connect requests to existing jobs, artifacts, editors, and review records. Preserve backend approval, entitlement, billing, budget, destination, artifact-version, and tenant checks. A simpler button label must never broaden an action's permission. “Approved recurring work” is scoped permission, not unlimited autonomy.

Make credit use understandable before paid work starts and preserve existing usage accounting. Do not call a model to filter a menu or perform arithmetic. Do not invent a prospect database, contact details, connected accounts, customer consent, outcomes, statistics, or available integrations. Do not imply that drafted content has been sent or that source-only backend changes are already live.

## 8. Verify the requested change and hand it back honestly

Complete the authorized local implementation without stopping after a plan. Run checks appropriate to the changed behavior and existing repository requirements. Use the navigation, onboarding, parser, permission, and `e2e/simple-app.spec.ts` regressions when relevant. Verify desktop and mobile flows affected by the task, including suggestion editing, draft preservation, workspace switching, review navigation, and existing tool links.

Use synthetic fixtures for UI checks that would otherwise send messages, publish, activate ads, create real customer companies, or consume paid AI. Distinguish fixture checks from authenticated live behavior. Never weaken permissions or assertions to obtain a passing result.

Run relevant type, lint, test, and build checks. Report the actual commands and outcomes. Historical results in `docs/AppExperience.md` are context, not proof that a new change passes. If the environment blocks a build, state the blocker precisely. An unstyled fallback build is not a verified release artifact. Backend source changes require the normal release process before they affect deployed behavior.

Finish with the concrete changes, files, verification, and material limitations. Keep work local unless I explicitly authorize another destination. Update relevant experience documentation when behavior changes. Preserve the approved simple experience throughout the task.
