# Product-event funnels and explicit account cohorts — 19 November 2026

The existing `shared/attribution/cohorts.ts` and `analytics.cohorts` calculate billing cohorts and repeat-charge observations. They do not calculate product activation or repeat-use sequences. This increment extends the existing product-event intake and customer-progress path rather than changing those billing definitions.

## Owner workflow and contract

Customers → Product tracking → **Define a measurement** saves an immutable definition for one source: named product, person/account unit, entry event, first-value event, repeat-value event, first-value deadline, repeat-value window and lookback. Events must exist in that source's immutable mappings. All business observation windows are entered by the owner; no guessed defaults. Technical bounds are 20 definitions, 30 UTC dates including today and a repeat window ending by day 21. Changing meaning requires removing/recreating a definition; prior workflow inputs keep their original text.

The deterministic evaluator groups each person's or explicitly reported account's **first recorded entry in the loaded period**, not a proven first-ever signup. It requires first value strictly after entry and no later than the supplied activation deadline. Repeat value must be a distinct later event, within the owner's half-open window measured from entry. Both rates use mature recorded entrants as the denominator, not only activated entrants. A seven-day late-arrival allowance matches the endpoint's acceptance window; unfinished periods remain pending, never zero. Counts accompany rates and daily UTC cohorts show maturity separately.

Optional `accountRef` accepts an opaque ID supplied by the product server. Only its hash is persisted and it is bound into retry-payload identity. Accounts stay separate per source/tenant; no email-domain merge, company inference or linkage across sources. Relevant events without an explicit account hash withhold account figures. Two people with the same explicit account ID count once in that source's account report.

Owner corrections exclude their disputed progress from the event analysis. Explicit future-event resumption retains its cutoff even after a new source milestone arrives, so old disputed signup/export events cannot silently return to the denominator. Conflicting receipts are excluded; missing/deleted/ambiguous progress contacts remain excluded. Counts and reasons are visible. The raw event store bound withholds calculations rather than pretending a truncated dataset is complete.

## Existing intelligence and authorization

`convex/lib/productFunnels.ts` → `planningEmailAudience` → `emailAudienceBrief` → the actual `jobWrites.jobContext` supplies up to three saved definitions and calculated summaries to the existing planner. Names/labels remain untrusted data. Evidence is explicitly calculated from source reports, not independently measured customer value, revenue, consent or causal impact. No agent, provider or runtime model changes. No recommendation or measurement sends, schedules, publishes or spends.

Workspace export and purge include `productFunnels`. Contact erasure removes the original receipts and observations, so the report immediately loses that evidence. Saved definitions contain no email identities. Source tokens remain write-only, membership/tenant/pause checked, revocable and unrelated to action approval. The product event intake still does not create contacts or email permission.

## Local verification

```sh
pnpm exec vitest run tests/unit/product-funnels.test.ts tests/convex/product-funnels.test.ts tests/convex/product-tracking.test.ts tests/convex/customer-progress.test.ts tests/convex/channel-cache.test.ts tests/convex/planning-email-audience.test.ts tests/convex/customer-journeys.test.ts tests/convex/marketing-authorization.test.ts tests/convex/contact-erasure.test.ts
pnpm typecheck
```

243 tests across nine files passed (11.81 seconds). The backend file was then extended to verify the actual job context, not only the shared planning helper, and rechecked. Final app/Convex typechecks and scoped ESLint passed, including the added actual-job-context assertion. One initial test incorrectly expected a valid 21-day lookback to be rejected; the invalid-window fixture was corrected to 20 days without loosening validation.

Four desktop/mobile cases passed (28.7 seconds): measurement setup/pending windows/removal and existing product tracking/manual correction/resumption/revocation. Accessibility and overflow checks passed; the rendered layout was inspected. These are scoped checks, not a WCAG certification. No real customer, provider or paid-model calls were used.

## Limits

This is bounded source-event sequence analysis, not a complete behavioral analytics platform. Coverage beyond received records is unknown; zero means no qualifying event recorded. Only existing contacts are observed. First-ever signup, automatic inactivity/churn, high-volume clickstream collection, historical backfill, causal attribution, lifetime account membership and complete commercial retention are not inferred. Deleted/corrected evidence can change live reports; previously saved plan inputs remain historical. A real product still needs server instrumentation. Paid model evaluation remains paused, including fresh Livoform strategy acceptance.
