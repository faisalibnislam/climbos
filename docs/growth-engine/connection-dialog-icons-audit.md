# Service icons before connection titles — 17 November 2026

## Owner requirement and confirmed gap

The owner requested colored service icons before popup titles. Connection cards had platform marks, but API-key, WordPress, import and disconnect dialogs had plain titles; Stripe and WordPress cards used generic symbols.

The existing provider mark is now shared by cards and dialog titles. Stripe, Resend and WordPress use installed local brand artwork; other social providers retain their existing marks and colors. Resend stays black and white, matching its mark. CSV/contact imports use colored semantic icons rather than inventing a service logo. All marks are decorative beside visible, wrapping title text, with unchanged accessible dialog names. No external image request, dependency, credential handling, permission or action behavior was added.

Changed components: `ProviderMark.tsx`, `ConnectionCard.tsx`, `ApiKeyDialog.tsx`, `WordPressConnectDialog.tsx`, `RevenueCsvDialog.tsx`, `ContactsCsvDialog.tsx` under `src/components/app/connections/`.

## Verification

The local browser check used a new synthetic fixture on the dedicated loopback backend. It opened and closed the actual Stripe, Resend and WordPress setup dialogs at 1366×900 and 390×844, verified one decorative title icon, Escape dismissal and focus restoration, and compared connection/secret/approval/action/workflow records before and after. All six checks passed with no changes to those records or browser page errors. Serious/critical axe findings and horizontal overflow were absent after the opening animation completed. Desktop Stripe/WordPress and mobile Stripe screenshots were inspected.

An initial scan ran during animation and flagged transient contrast; the final scan waited for the real animation to finish. An initial Resend locator used a shortened service name; the final check used the existing visible label. Neither required changing the product's colors, labels or workflow. Temporary verification script and captures are under `/private/tmp/climbos-service-icons*`, not committed or delivered as product code.

Application/Convex typechecks, changed-component ESLint and diff checks passed. No extra unit tests were added for this presentation change. The import and disconnect title wiring is typechecked but not claimed as independently exercised by the six setup-dialog checks. OAuth screens belong to providers and were not modified. No hosted deployment, real connection or external business action. Full app accessibility and broader acceptance remain unverified.
