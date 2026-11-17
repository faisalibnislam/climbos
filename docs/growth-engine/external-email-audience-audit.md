# External email audience evidence — 17 November 2026

## Requirement and confirmed gaps

Original requirement 111 calls for recognizing missing email permission and audience data. This follows the recorded-audience audit and the master-index Book 08 relationship/permission route and Book 14 business-snapshot contract. The installed Next.js Vitest guide was read; no Next.js component was changed.

The previous `lintNoAudience` accepted any fact mentioning contacts, a newsletter or subscribers. Negative reports, competitor lists and a support-contact sentence could therefore bypass it. It also checked speculative strategy and private draft preparation as though they were immediate list use. Finally, `no_audience` was absent from the hard quality rules: an unsupported immediate-send recommendation could be saved as provisional and approved even when its final lint still reported the problem.

## Runtime path and changes

1. `convex/jobs.ts` supplies the actual workspace business name beside recorded fact source classes and the existing local eligible-audience count (including unknown/null).
2. `shared/growth/emailAudience.ts` interprets a bounded set of explicit external-audience reports. It requires recorded owner/source/measured provenance, an attributable business/owner statement, email/newsletter context and a positive reported count. It rejects unrelated, negative, historical, uncertain and third-party reports, and explicit withdrawn permission or purchased/scraped/rented list reports. Conflicting relevant reports require verification; the helper does not select a convenient positive claim.
3. Growth-play, detailed-strategy and focused-strategy validators pass facts as an array, preserving source-class indices even when a fact contains a line break. A report about analytics is not relabeled measured evidence.
4. List building, a verification-only next step, private drafting and the separate grounded/adjacent/bold exploration remain available. A combined build/check/draft instruction that also says to email the existing list still needs audience evidence.
5. `shared/agents/quality.ts` treats an unresolved `no_audience` finding as a failed quality gate. Existing owner-facing fixes explain the missing audience basis and the verification/draft alternatives. The existing `workspace.decidePlan` approval check refuses that failed plan. No separate authorization path was added.

Engine revision: `v3.131-external-audience-evidence`. The helper changes planning evidence only. A positive report never imports recipients, creates consent, changes a live offer, schedules, sends or grants an email approval.

## Verification

The earlier red tests reproduced the keyword bypass and exploration/draft false positives. Three additional failures demonstrated that the quality rule and actual generated-plan approval path still accepted unresolved audience findings. Five follow-up red cases reproduced withdrawn/purchased/scraped reports and two ordinary owned-newsletter wordings. Focused regressions also check multiline fact/source alignment, conflicting reports, source ownership, special characters in business names, all supported provenance classes, protected bold exploration, tenant isolation and existing send authorization.

The actual focused generation test uses a mocked model and passing critic, then checks saved quality, owner approval refusal and absence of email approvals/action receipts. Positive reported-list and draft-only cases remain available. Commands and final results are recorded in [Verification](../Verification.md).

## Limits and remaining work

This is a bounded English text interpretation, not comprehensive semantic verification of ownership, permission, list freshness, segment fit or deliverability. It recognizes explicit positive-count reports; an unrecognized phrasing or missing count calls for verification rather than inventing audience size. It does not resolve historical reports by date or independently verify public claims. Source reports stay reports. A positive local count does not prove that every proposed segment exists or matches the recommendation. Legacy callers without an audience constraint retain their existing behavior; production plan generation supplies it.

No historical plan migration, new provider, agent, UI component, customer-event enrollment or live integration was added. Sender eligibility, exact approvals and execution receipts remain separate controls. No paid model, live provider, real send, browser audit or deployment was used. Rows 111/112/118/119 and the broader product remain incomplete.
