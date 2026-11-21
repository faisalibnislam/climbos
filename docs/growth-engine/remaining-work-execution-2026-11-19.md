# Remaining-work execution record — 19 November 2026

The owner asked to complete the entire remaining-work list, continue across batches, and push verified changes. This record tracks that scope; it does not replace runtime implementation or acceptance. Paid calls remain paused, runtime model/routes unchanged, no deployment or live customer action. Preserve the owner's unrelated `.gitignore` changes.

| Area | Current execution state |
|---|---|
| Product analytics | Built bounded owner-defined person/account event funnels, activation and repeat-value windows, pending cohorts, correction exclusions and actual planning context. See `product-funnels-audit.md`. Real server instrumentation and evidence coverage remain setup-dependent. |
| Lifecycle Autopilot | Built exact reviewed delivery within 23 hours on the existing executor, with a one-hour window, current audience/permission/allowance rechecks, persistent owner review, cancellation and expiry cleanup. See `scheduled-email-delivery-audit.md`. No blanket recurring sequence authorization or unknown future audience; real provider setup/delivery remains unverified. |
| Sales calls/transcripts | Built permissioned plain-text transcript import, exact paged review through the existing selected-deal assistant, source/unknown labels, removal and export. See `deal-transcript-review-audit.md`. The Customer progress page also groups recurring English topics in up to 40 permissioned transcript imports. It links owners back to the selected deal, deduplicates exact text and separates topic counts from evidence of demand. Owners can capture local microphone audio, download or discard it, and separately prepare transcripts on compatible devices. Live meeting integrations, speaker identification and real-device accuracy remain unverified. |
| AI-search monitoring | Owners can set a 7- or 30-day repeat interval on a saved panel, inspect each question’s current and previous period, and stop the checklist without losing observations. Failed attempts, no answer and missing observations are distinct. Interval changes start a new checklist. Date ranges are elapsed days from opt-in. The independent period queries retain baseline samples when current volume exceeds the display cap. Citation comparisons show the observed change in own-site citation rate. Collection is manual. |
| Customer-site editing | The blog editor supports original, proposed and approved page copy, private mobile/desktop previews and recovery. WordPress draft confirmation and read-back bind the exact reviewed content and site. Local fixtures only per owner. Live page updates, site-specific theme rendering and remote rollback remain outside this workflow. |
| Platform/release readiness | Local database snapshot restore drill passed. Production backups, encrypted credentials, binary assets, actual release recovery time and live integrations need separate verification. Verify current official rules/access before promising live integration. Owner/provider credentials and live release tests are separate from local fixtures. |
| Strategy quality and research | Preserve all known quality gates and bold exploration. Offline replay/editorial checks can verify known regressions, not a fresh Livoform runtime pass. Reviewed all 27 previously missing outcome references. The 100 precedents now include 51 organization/participant-reported and 49 independently corroborated outcomes. Many are participation or program delivery measures. Paid evaluation remains paused. |

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

### Creative precedent outcome evidence, 21 November

27 existing records now include a dated primary or participant source for an observed result. No cases were added. Each keeps its original mechanism and limitations. The runtime formatter prints the access date for each source separately. Measures include program delivery, participation, actual product use, released work and unit volume. A company filing is still a company-reported source. The direction of the observation is preserved, including lower year-end rental subscribers. These measures do not establish transferable returns or causal growth.

For examples see [Rent the Runway’s annual report](https://www.sec.gov/Archives/edgar/data/1468327/000114036125020178/ny20043016x3_ars.pdf), [the interview with Ahrefs’ CMO](https://dowhatworks.substack.com/p/how-vibe-coding-helps-ahrefs-optimize) and [Scratch Foundation’s report](https://annualreport.scratchfoundation.org/pdf/Scratch-Report_2024.pdf). Complete references and individual evidence limits are attached to the respective runtime records.

Verification: 89 tests passed across precedent retrieval, the in-app creative strategy workflow and tenant permissions. Both TypeScript projects, changed-file lint and diff checks passed.

### Local audio and device-only speech, 21 November

The existing deal transcript form now offers separate audio recording and device-only transcription after an explicit participant-permission attestation. Audio is held in browser memory and may be downloaded. Transcription checks availability for the browser language, requires local processing and an installed pack, and has no cloud fallback. Captured words enter the draft only when chosen. Editing and the pre-existing permission-to-store check precede saving. Physical microphone capture, meeting audio feeds, real speech accuracy and actual installed language coverage were not tested.

The original transcript import/removal workflow passed on desktop and mobile. The additional local capture test initially stopped before any synthetic audio had been encoded. After waiting for the real recorder to emit a nonempty chunk, both desktop and mobile checks passed. Browser tests exercised native MediaRecorder with generated audio and a simulated local speech recognizer, including unavailable packs, consent, track release, review, and no automatic persistence. Type checks and scoped lint passed. See [on-device recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/processLocally) and [language-pack availability](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/available_static).

### WordPress page copy and draft verification, 21 November

The article editor owns the proposal. An editor records the page address, source revision label and original article version. The source copy is owner-supplied. A workspace approver can accept the exact proposal for the rehearsal or restore its original version. The last approved copy survives restoration and subsequent edits. Rehearsal decisions have their own audit records and grant no publication permission.

The private-draft connector separately rechecks the approved version, content hash, approval, connection, displayed site address and page title. Older articles with no page headline use the internal name shown in confirmation. A repeated worker cannot create a second post for the same attempt. An interrupted attempt becomes uncertain and requires inspection. The connector requests raw title and body with edit context and compares them against the approved submission. Missing or transformed content leaves the outcome uncertain. See the official [WordPress posts reference](https://developer.wordpress.org/rest-api/reference/posts/) and [global request parameters](https://developer.wordpress.org/rest-api/using-the-rest-api/global-parameters/).

Verification used local fixtures only:

- `pnpm exec vitest run tests/convex/wordpress-{drafts,connection}.test.ts tests/unit/wordpress.test.ts tests/convex/{tenancy,safety}.test.ts` passed 33 tests across five files. Coverage includes changed terms, exact body, permission denials, duplicate worker claims, interrupted requests and copy recovery.
- `pnpm exec playwright test e2e/wordpress-page-rehearsal.spec.ts --workers=1` with the isolated local demo environment passed on desktop and mobile. Both sessions used the article editor, checked the preview at 390 and 1280 pixels, reloaded the approval, restored the original, and reopened the previously approved copy. The preview stayed within the selected width and its source links did not navigate. Screenshots are produced with the test results.
- Both TypeScript projects, scoped ESLint and the patch whitespace check passed.

The browser renders the private copy in a plain template. The connector tests simulate WordPress REST responses. That first test batch used simulated REST responses. The separate core compatibility fixture below covers an actual in-memory installation.


### WordPress core compatibility fixture, 21 November

`scripts/rehearse-wordpress.mjs` boots a pinned WordPress 6.8.3 archive with PHP 8.3 and SQLite in memory. The browser sends requests directly to the local request handler and blocks other origins. The fixture uses synthetic copy rendered by the ClimbOS article formatter. It sends that copy to the WordPress REST posts controller, then checks the exact raw title, raw body, ID and draft status. This covers actual WordPress serialization. ClimbOS connector authorization, authentication header construction and destination safeguards have separate tests.

For an existing synthetic page, the fixture captures a native revision before changing it. It renders original, revised and restored content with the bundled Twenty Twenty-Five theme at 390 and 1280 pixels. It checks the heading, body text and viewport width, plus the proposed link destination and focus. WordPress retained the original title and raw body after native restoration. The first run without an explicit baseline did not find a matching revision. No external site or publishing account took part. The app’s rehearsal remains private. Native page update and rollback here are fixture operations, not features exposed on a connected site.

To reproduce from the repository root with Node 24, installed project dependencies and Chromium:

```sh
fixture_dir=$(mktemp -d)
npm install --prefix "$fixture_dir" --ignore-scripts --no-audit --no-fund @wp-playground/cli@3.1.65
curl --fail --location --output "$fixture_dir/wordpress-6.8.3.zip" https://wordpress.org/wordpress-6.8.3.zip
node --experimental-wasm-jspi --import tsx scripts/rehearse-wordpress.mjs "$fixture_dir"
```

Only setup downloads public test software. The core archive checksum is checked by the script. The final fixture and its scoped ESLint check passed. Compatibility with other WordPress versions, custom themes, plugins, authentication configurations and hosting remains unverified. [Official WordPress Playground tooling](https://wordpress.github.io/wordpress-playground/developers/local-development/wp-playground-cli/).
