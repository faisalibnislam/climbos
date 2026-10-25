# ClimbOS app: understandable without business training

The application uses task-based navigation and plain-language explanations. Existing specialist routes remain available.

| Main destination | What it is for |
|---|---|
| Home | Describe what you need, follow requests, and choose a next step. |
| Your plan | Understand what to focus on and why. |
| Your work | Open the existing post/email/ad editor and calendar, regular posting, pages, images, video tools, or design editor. |
| Customers | Open customer research, customer progress, messages, reviews, and visitor-chat setup. |
| Results | Read available business measurements with source and uncertainty labels. |
| All tools | Find existing tools through everyday or specialist search terms. |

`src/components/app/navigation.ts` owns the navigation labels, tool explanations, aliases, and legacy-route grouping. Tool directories link to the real existing editors and records. Connections and review remain directly accessible; technical settings are grouped under Advanced tools without changing permission checks.

Home and first/additional business onboarding share `RequestComposer`. A suggestion only adds editable text; it never starts work. Existing input is preserved when another suggestion is selected. The contextual Climb panel follows the same suggestion behavior and labels its separate page-help conversation.

Content review shows the draft's intended reader, objective, core idea, and exact growth-plan item when the copy is tied to one. Planned Autopilot slots show the same plan item before drafting, so owners can see which approved offer the post will use.

Date-sensitive growth recommendations lead with a plain-language timing choice, suggested dates when supported, and why that moment may matter to the business. Missing information stays visible; preparation, delivery, capacity, source claims, and evidence dates are available in an expandable detail section.

Offer recommendations explain whether to consider a change, check details first, improve another business issue, or keep the offer. They describe who the idea is for, what evidence supports it, money left after listed costs, risks, and a small test; missing facts remain unknown and any live change still needs the existing approval.

Command search uses local filtering. A natural-language request is handed to Home as an editable draft rather than dispatched from search. Handoff keys are scoped to the signed-in person and workspace. The assistant provider resets transient state when the workspace or authenticated identity changes.

Onboarding starts with a business description, accepts a business without a website, shows an editable name, and offers a conventional form using the supplied information. Additional-business setup explains its separate data context and retains the existing workspace creation and research functions. An explicit unauthorized setup URL shows an access explanation rather than silently falling back to another company's setup.

Analysis-depth choices are available under More options. First-time setup shows the selected research mode's maximum credit estimate before the owner continues; the estimate follows the same engine reservation calculation, and unused reserved credits are returned. Goal and approval wording uses ordinary language. Continuing through fact review still confirms all remaining facts; this consequence stays visible next to the button. Approval, entitlement, spending, and tenant enforcement continue in the existing backend functions.

Pages explain their purpose before technical details. Optional “What do these words mean?” help defines business terms without replacing precise stored data. Results distinguish Recorded, Linked to a source, Estimated, Reported by the platform, and Based on your inputs. These presentation labels preserve their original underlying metric kinds and calculations. Growth-play results show how many elapsed weeks have an owner entry; a missing week stays unknown, not zero, and prevents the play from being labeled ahead, on track, or behind for the full period.

Specialist settings show each profile's ClimbOS credit budget, recent run costs, and team-reported usefulness ratings when available. The monthly total includes credits used or set aside; runs still in progress or waiting for review may include estimates. Older profiles without a stored monthly limit still show known usage and say that no limit is recorded. Credit usage is not customer revenue, business profit, or measured time saved. Team ratings are labeled as opinions, separate from measured business results. If the bounded usage query cannot return a complete total, the screen says usage is unavailable rather than presenting the limit as recorded spend. Existing run, edit, and archive controls remain the way to change or stop a specialist.

“Pause all activity” sets the workspace stop first, cancels unstarted jobs, removes schedules from all waiting posts, and requests a pause for every recorded active ad campaign. Cleanup drains indexed batches so workspaces with more than one page of queued items are covered. Resuming does not reschedule posts. A provider action already handed off may still finish, and an external ad pause can remain unverified if the provider is unavailable.

Business insights describe what helps the business, what gets in the way, and what to watch. Each finding stays compact until the owner opens “Evidence and why it matters.” That detail shows its recorded basis, confidence, strategic implication, and source links. Missing support is called out as an idea to check, not a confirmed fact. Optional next steps connect the findings and show a first test and measure; these are suggestions to review, not established advantages. Commercial evidence uses a plain-language status while retaining whether the evidence supports a small test, is mixed, or remains insufficient.

Growth-run experience timing is recorded from the existing workflow: the first finding timestamp is set only when a quick-take opportunity links to confirmed business facts, and the first-action timestamp is set when an owner starts a linked plan action. Hypotheses and generic progress previews do not count as findings. These timestamps measure workflow response and owner follow-through; they do not measure business growth. Run completion and actual AI/research usage remain available from the existing run and usage records. Starting an action is not evidence that an external change was published, sent, or completed.

`shared/agents/ownerLanguage.ts` supplies the same everyday-language guidance to the contextual assistant and the agent runtime. The owner-brevity skill and generated registry have matching guidance. The change applies to owner-facing explanations, preserves technical field names, source labels, uncertainty, and permissions, and keeps requested publishable copy subject to its channel requirements. Backend instruction changes require the normal backend release process to take effect outside local tests.

Verification lives in `tests/unit/app-navigation.test.ts`, `tests/unit/onboarding-language.test.ts`, the parser regressions, and `e2e/simple-app.spec.ts`. Browser checks use synthetic demo data and the design-system specimen; they do not perform live customer sends, publishing, ad activation, or paid AI generation. Authenticated owner onboarding is covered by rendering and permission regressions, rather than creating real additional customer companies during UI checks.


## Verification on 25 October 2026

- Full suite: `pnpm exec vitest run --maxWorkers=2` — 201 files, 1,503 tests passed. The first unrestricted run hit 5-second timeouts under parallel load; reducing workers resolved them without weakening assertions or changing timeouts.
- Focused onboarding, navigation, parser, and permission checks: 33 passed after the later wording changes.
- Browser: `E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test e2e/simple-app.spec.ts --project=desktop --project=mobile` — all 4 passed, including accessibility scans, draft preservation in both chat paths, local tool search, existing editor links, and the loaded review-section scroll/focus handoff.
- Type checks and the app lint checks passed. No live customer publishing, outreach, ad activation, or paid AI generation was used for verification.
- `pnpm build` was blocked by a Turbopack CSS worker's port-binding restriction (`EPERM`) in this environment. The supported Webpack fallback compiled and completed TypeScript checks, but does not produce the existing Tailwind utility styling with the current Turbopack-only loader setup. It is not a verified production artifact. The existing build configuration was retained, and visual/browser verification used the styled development app.
- The local frontend is available with `pnpm dev --hostname 127.0.0.1`. Backend instruction changes remain source changes until the normal backend release process is performed. No deployment was performed here.
