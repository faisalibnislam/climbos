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

Command search uses local filtering. A natural-language request is handed to Home as an editable draft rather than dispatched from search. Handoff keys are scoped to the signed-in person and workspace. The assistant provider resets transient state when the workspace or authenticated identity changes.

Onboarding starts with a business description, accepts a business without a website, shows an editable name, and offers a conventional form using the supplied information. Additional-business setup explains its separate data context and retains the existing workspace creation and research functions. An explicit unauthorized setup URL shows an access explanation rather than silently falling back to another company's setup.

Analysis-depth choices are available under More options. Goal and approval wording uses ordinary language. Continuing through fact review still confirms all remaining facts; this consequence stays visible next to the button. Approval, entitlement, spending, and tenant enforcement continue in the existing backend functions.

Pages explain their purpose before technical details. Optional “What do these words mean?” help defines business terms without replacing precise stored data. Results distinguish Recorded, Linked to a source, Estimated, Reported by the platform, and Based on your inputs. These presentation labels preserve their original underlying metric kinds and calculations.

`shared/agents/ownerLanguage.ts` supplies the same everyday-language guidance to the contextual assistant and the agent runtime. The owner-brevity skill and generated registry have matching guidance. The change applies to owner-facing explanations, preserves technical field names, source labels, uncertainty, and permissions, and keeps requested publishable copy subject to its channel requirements. Backend instruction changes require the normal backend release process to take effect outside local tests.

Verification lives in `tests/unit/app-navigation.test.ts`, `tests/unit/onboarding-language.test.ts`, the parser regressions, and `e2e/simple-app.spec.ts`. Browser checks use synthetic demo data and the design-system specimen; they do not perform live customer sends, publishing, ad activation, or paid AI generation. Authenticated owner onboarding is covered by rendering and permission regressions, rather than creating real additional customer companies during UI checks.


## Verification on 25 October 2026

- Full suite: `pnpm exec vitest run --maxWorkers=2` — 201 files, 1,503 tests passed. The first unrestricted run hit 5-second timeouts under parallel load; reducing workers resolved them without weakening assertions or changing timeouts.
- Focused onboarding, navigation, parser, and permission checks: 33 passed after the later wording changes.
- Browser: `E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test e2e/simple-app.spec.ts --project=desktop --project=mobile` — all 4 passed, including accessibility scans, draft preservation in both chat paths, local tool search, existing editor links, and the loaded review-section scroll/focus handoff.
- Type checks and the app lint checks passed. No live customer publishing, outreach, ad activation, or paid AI generation was used for verification.
- `pnpm build` was blocked by a Turbopack CSS worker's port-binding restriction (`EPERM`) in this environment. The supported Webpack fallback compiled and completed TypeScript checks, but does not produce the existing Tailwind utility styling with the current Turbopack-only loader setup. It is not a verified production artifact. The existing build configuration was retained, and visual/browser verification used the styled development app.
- The local frontend is available with `pnpm dev --hostname 127.0.0.1`. Backend instruction changes remain source changes until the normal backend release process is performed. No deployment was performed here.
