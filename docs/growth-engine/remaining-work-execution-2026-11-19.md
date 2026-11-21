# Remaining-work execution record — 19 November 2026

The owner asked to complete the entire remaining-work list, continue across batches, and push verified changes. This record tracks that scope; it does not replace runtime implementation or acceptance. Paid calls remain paused, runtime model/routes unchanged, no deployment or live customer action. Preserve the owner's unrelated `.gitignore` changes.

| Area | Current execution state |
|---|---|
| Product analytics | Built bounded owner-defined person/account event funnels, activation and repeat-value windows, pending cohorts, correction exclusions and actual planning context. See `product-funnels-audit.md`. Real server instrumentation and evidence coverage remain setup-dependent. |
| Lifecycle Autopilot | Built exact reviewed delivery within 23 hours on the existing executor, with a one-hour window, current audience/permission/allowance rechecks, persistent owner review, cancellation and expiry cleanup. See `scheduled-email-delivery-audit.md`. No blanket recurring sequence authorization or unknown future audience; real provider setup/delivery remains unverified. |
| Sales calls/transcripts | Built permissioned plain-text transcript import, exact paged review through the existing selected-deal assistant, source/unknown labels, removal and export. See `deal-transcript-review-audit.md`. The Customer progress page also groups recurring English topics in up to 40 permissioned transcript imports. It links owners back to the selected deal, deduplicates exact text and separates topic counts from evidence of demand. Audio recording, speech transcription and semantic analysis remain incomplete; no paid transcription or recording permission is assumed. |
| AI-search monitoring | Owners can set a 7- or 30-day repeat interval on a saved panel, inspect each question’s current and previous period, and stop the checklist without losing observations. Failed attempts, no answer and missing observations are distinct. Interval changes start a new checklist. Date ranges are elapsed days from opt-in. The independent period queries retain baseline samples when current volume exceeds the display cap. Citation comparisons show the observed change in own-site citation rate. Collection is manual. |
| Customer-site editing | Pending audit of existing WordPress/landing/design adapters. Prefer version-bound proposed edits, preview/validation and existing approval over a parallel editor. Real customer sites require credentials and release approval. |
| Platform/release readiness | Local database snapshot restore drill passed. Production backups, encrypted credentials, binary assets, actual release recovery time and live integrations need separate verification. Verify current official rules/access before promising live integration. Owner/provider credentials and live release tests are separate from local fixtures. |
| Strategy quality and research | Preserve all known quality gates and bold exploration. Offline replay/editorial checks can verify known regressions, not a fresh Livoform runtime pass. Research missing source/outcome support without padding or inventing evidence. Paid evaluation remains paused. |

Do not mark a broad area complete solely from a green test suite. Preserve genuinely unverified or unavailable acceptance explicitly while continuing independent buildable work.

### 21 November verification

`pnpm exec vitest run tests/convex/ai-search-visibility.test.ts tests/convex/tenancy.test.ts tests/convex/safety.test.ts` passed 23 tests in three files. Covered boundary timestamps, previously missed questions, failed attempts, new and disabled schedules, idempotent settings, independent period limits and workspace permissions. Both TypeScript projects and ESLint on the changed code passed. No provider collection or live workspace verification.

### Strategy evidence and offline replay, 21 November

Reproduced a false strategy approval when a product-plan quotation occurred in combined notes but was attributed to a different listed URL. The production reviewer now requires the quote in both visible research and a retained read of that exact page, or in the referenced business fact with its recorded evidence class. The focused runtime and saved research path carry bounded page reads. Missing reads leave eligibility unknown. This checks attribution; interpreting the source still requires review.

The offline checker previously reported an output contract pass for a saved failed review. It now distinguishes failures from a currently checkable retained review and failures preserved from older reviews. Of 84 existing records, 38 lacked enough information for replay, 22 failed the current schema, 16 failed output lint, and eight passed output lint but retained failed historical reviews. Replay returned its expected nonzero verification status. These are historical records, including earlier contract versions. The latest saved Livoform agency case still fails, and the engine's fresh generation quality remains unknown.

196 local regressions passed across ten suites: offline strategy replay, focused plan eligibility, section revisions, research notes, evidence review, originality review, research cache, persisted focused plans, plan approval and tenant permissions. Type checks passed. The runtime model, paid cap and action permissions were unchanged.

### Recurring conversation topics, 21 November

The on-demand view counts distinct transcript texts mentioning each existing phrase group. Owners can find the source deal and read the full transcript. The overview exposes counts and source references only. Removal updates the sample immediately. Limits include English phrase coverage, speaker ambiguity and possible negation. No model or third-party transfer is involved.

34 tests across five suites passed (deal transcripts, pipeline review, customer voice, phrase groups and tenant access). The manual-monitoring Playwright test passed on desktop and mobile using the isolated local backend, covering both the repeat-check UI and opening a deal from a recurring topic. Type checks passed.

### Local release recovery, 21 November

`python3 scripts/rehearse-local-restore.py` passed with the installed CLI and cached Convex local backend. The script creates two synthetic tenants, adds a permissioned transcript, exports a snapshot, starts a separately keyed empty local instance, imports the archive, and compares exact rows in users, organizations, memberships, deals, deal transcripts, approvals and action receipts. It reads the recovered transcript through the application using the original identity and checks denial from the other tenant. The two databases and archive are temporary. The fixture excludes live credentials, stored media, hosted deployment state, queue recovery and real accounts. Do not infer a production recovery time or recovery point from this drill.
