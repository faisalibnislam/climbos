# Complete contact erasure and durable suppression — 19 November 2026

The product-tracking audit followed the existing `settings.deleteContact` path because new event receipts must disappear with their contact. Local regressions reproduced three material gaps in that existing path:

1. It read/deleted only the first 50 consent records and then deleted the contact, leaving additional consent history behind while reporting completion.
2. It took only ten matching contact identities and could report completion after deleting that partial set.
3. When an unsubscribe suppression already existed, deletion kept that reason instead of recording deletion suppression. Re-importing the contact could therefore allow product-event intake to recreate erased progress.

The smallest correction retains the existing transaction and permissions. Deletion reads one beyond each supported bound, deletes all supported consent history (up to 100 records per contact), and rejects an oversized contact set (more than ten matching identities) or consent history before reporting completion. Any later failure rolls back earlier deletions in the same transaction. A pre-existing suppression is strengthened to `deletion`; it never becomes less restrictive. Existing source-event intake already refuses that deletion suppression.

`tests/convex/contact-erasure.test.ts` covers complete history, exceeded consent/contact bounds, atomic rollback when a later duplicate fails, pre-existing unsubscribe → deletion → re-import → rejected telemetry, tenant isolation and unauthorized calls. Four of the original five cases failed against the prior implementation and passed after the fix. A sixth verifies transaction rollback across duplicate identities; its first fixture omitted a required evidence field and was corrected before verification.

Changed implementation: `convex/settings.ts`. No UI, provider, runtime model, approval scope, external send, paid call or deployment changed. Existing historical audit/approval retention policies are unchanged. Oversized legacy identity/history sets still require review; they are held explicitly rather than silently reported erased. This is not a claim that every historical business record is deleted by the contact-only operation.

Focused verification: all **193 tests in six directly affected files** passed (contact erasure, product tracking, progress, journeys, marketing and marketing authorization). The final combined checks are recorded in Verification and the implementation ledger.

Final combined command:

```sh
pnpm exec vitest run tests/convex/contact-erasure.test.ts tests/convex/product-tracking.test.ts tests/convex/customer-progress.test.ts tests/convex/customer-journeys.test.ts tests/convex/marketing-authorization.test.ts tests/convex/marketing.test.ts tests/convex/contact-frequency.test.ts tests/convex/contact-frequency-history.test.ts tests/convex/customer-data.test.ts tests/convex/lifecycle-draft-context.test.ts tests/convex/planning-email-audience.test.ts tests/convex/channel-cache.test.ts
pnpm typecheck
pnpm exec eslint convex/settings.ts tests/convex/contact-erasure.test.ts
git diff --check
```

**279 tests in 12 files passed** (8.88 seconds). App/Convex types, scoped lint and diff checks passed. No additional browser check was required for this backend-only correction; the product tracking and approval owner workflows were verified separately as documented in the linked tracking audit.
