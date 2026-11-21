# Remaining-work execution record — 19 November 2026

The owner asked to complete the entire remaining-work list, continue across batches, and push verified changes. This record tracks that scope; it does not replace runtime implementation or acceptance. Paid calls remain paused, runtime model/routes unchanged, no deployment or live customer action. Preserve the owner's unrelated `.gitignore` changes.

| Area | Current execution state |
|---|---|
| Product analytics | Built bounded owner-defined person/account event funnels, activation and repeat-value windows, pending cohorts, correction exclusions and actual planning context. See `product-funnels-audit.md`. Real server instrumentation and evidence coverage remain setup-dependent. |
| Lifecycle Autopilot | Built exact reviewed delivery within 23 hours on the existing executor, with a one-hour window, current audience/permission/allowance rechecks, persistent owner review, cancellation and expiry cleanup. See `scheduled-email-delivery-audit.md`. No blanket recurring sequence authorization or unknown future audience; real provider setup/delivery remains unverified. |
| Sales calls/transcripts | Built permissioned plain-text transcript import, exact paged review through the existing selected-deal assistant, source/unknown labels, removal and export. See `deal-transcript-review-audit.md`. Audio recording, speech transcription and aggregate conversation analysis remain incomplete; no paid transcription or recording permission is assumed. |
| AI-search monitoring | Owners can set a 7- or 30-day repeat interval on a saved panel, inspect each question’s current and previous period, and stop the checklist without losing observations. Failed attempts, no answer and missing observations are distinct. Interval changes start a new checklist. Date ranges are elapsed days from opt-in. The independent period queries retain baseline samples when current volume exceeds the display cap. Citation comparisons show the observed change in own-site citation rate. Collection is manual. |
| Customer-site editing | Pending audit of existing WordPress/landing/design adapters. Prefer version-bound proposed edits, preview/validation and existing approval over a parallel editor. Real customer sites require credentials and release approval. |
| Platform/release readiness | Pending focused integration and operational-recovery audit. Verify current official rules/access before promising live integration. Owner/provider credentials and live release tests are separate from local fixtures. |
| Strategy quality and research | Preserve all known quality gates and bold exploration. Offline replay/editorial checks can verify known regressions, not a fresh Livoform runtime pass. Research missing source/outcome support without padding or inventing evidence. Paid evaluation remains paused. |

Do not mark a broad area complete solely from a green test suite. Preserve genuinely unverified or unavailable acceptance explicitly while continuing independent buildable work.

### 21 November verification

`pnpm exec vitest run tests/convex/ai-search-visibility.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts` passed 23 tests in three files. Covered boundary timestamps, previously missed questions, failed attempts, new and disabled schedules, idempotent settings, independent period limits and workspace permissions. Both TypeScript projects and ESLint on the changed code passed. No provider collection or live workspace verification.
