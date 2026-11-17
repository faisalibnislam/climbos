# Owner-selected public launch acceptance — 17 November 2026

## Purpose and input boundary

The next acceptance case uses the owner's selected website, Livoform. The earlier November 9 case and all historical results remain unchanged. `bench/strategy-quality/livoformLaunch.ts` combines a new, dated public-source pack with a strictly validated, locally supplied owner-report file. Private reports and prepared inputs stay in the existing ignored `bench/cache/` directory and are not committed.

Public pages read: [homepage](https://livoform.com/) and [pricing](https://livoform.com/pricing), inspected 17 November 2026. Publication/update dates were unavailable; the pricing search reader reported an older cached crawl. Page statements remain source-reported, not tested product behavior or demand. The pack distinguishes monthly versus annual billing and company versus seat prices. Homepage demonstration analytics are not evidence of business results. Three linked pages could not be retrieved; they are disclosed as uninspected and excluded from allowed source citations.

Owner statements remain owner-reported. They do not create measured funnel rates, a reporting interval, audience permission or a verified geographic market. The initial 14-day window and zero paid-media allocation are evaluation constraints, not claims about the business's actual deadline or budget. Costs and operating capacity remain unknown. No live database, customer account or business action is touched.

## Existing path reused

The dedicated `launch-acceptance` stage calls the existing focused strategy spec and `runAgent`, with its current model route, budget ledger, per-request reservation, output validation and result identity. It accepts only Livoform, the focused route and the dated pack; conflicting extra evidence or cheap-draft overrides are refused. Supplying owner context to a different stage fails rather than silently ignoring it. No provider, agent or production workflow was added.

The owner report file schema permits a fixed website, valid report date and bounded statements. It cannot supply a model, route, publishing permission or budget override. API transmission still requires the owner's applicable approval; a local prepared packet is not an executed test or quality pass.

## Verification

**22 tests in six files passed (0.475 seconds)**:

```sh
pnpm exec vitest run tests/unit/livoform-launch-input.test.ts tests/unit/industry-evaluation-input.test.ts tests/unit/evaluation-identity.test.ts tests/unit/anthropic-budget.test.ts tests/unit/ai-qa-budget.test.ts tests/unit/evaluation-budget.test.ts
```

Cases cover owner versus source provenance, absence of invented numeric funnel/audience/location inputs, pricing-unit caveats, failed source reads, explicit evaluation clock, withheld review questions, malformed date/website/empty reports, and existing cache/budget safeguards. A real local export produced three owner-report entries, two inspected source citations and six review questions with zero model calls. Private files are confirmed Git-ignored. Application/Convex typechecks, changed-file ESLint and diff checks passed. No result-quality claim is made before provider execution and review.

## Limits

This is a bounded shared-engine acceptance case, not a full browser/Convex production journey, verified product functionality or business outcome. Publication and community/platform recommendations need their own current checks and exact approvals. Public website claims and owner reports cannot establish causal demand or commercial viability.
