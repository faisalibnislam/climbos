# Contact frequency history — 17 November 2026

## Requirement and actual path

Original audit rows 111, 118 and 148 concern permission/audience readiness, behavior-aware frequency and relationship pressure. Read AGENTS, the master index, relevant Book 08 lifecycle/pressure sections and the installed Next.js Vitest guide. The corpus's proposed event/state architecture was not treated as implemented behavior or used to justify a new lifecycle subsystem.

Traced owner policy (`settings.setContactFrequency`) → imported contacts/consent/suppression → owner preview (`marketing.frequencyPreview`) → exact-recipient approval (`approveSend`) → current-state claim and final dispatch authorization → provider result/recovery → `lastMarketingEmailAt`. Existing outreach states and timestamps feed the broadcast frequency check through `outreachHistoryByHash`. The existing UI displays the server's hold rationale. No new screen, prompt, agent or provider is needed for this repair.

Confirmed existing behavior: an optional owner-selected 1–90-day interval; active outreach holds; exact approved email/audience/account/reservation binding; permission and suppression checks at execution; provider result history; uncertain-send recovery. This is an owner policy, not an inferred optimal marketing cadence. Marketing approval sends one selected email, not an automatic customer lifecycle sequence.

## Gaps reproduced and repaired

1. Outreach history used the first 20 sent records in creation order. A newer send outside that sample could be missed. Added a tenant/recipient/status/send-time index and query the greatest recorded `sentAt`; insertion/queue order cannot substitute for send time.
2. Frequency checked only five consent records while sending checked up to 100. A customer with five withdrawn records and a valid sixth opt-in could receive a broadcast without their recent email history being considered. Frequency now reuses the exact eligible-recipient resolver and, at approval/execution, the already-resolved recipient set.
3. The preview's separate eligibility logic accepted future consent dates and missing provenance, and silently reported clear for incomplete histories. It now shares the actual send checks: invalid, suppressed and deleted contacts are excluded; excessive/incomplete consent history raises the existing review-needed error. It does not silently discard recipients from an approved audience.

Five failing regressions reproduced these behaviors before the implementation change (after correcting a missing `evidence` field in one new test fixture). Final tests also cover latest-send insertion order, tenant isolation, active queued/sending/uncertain outreach, the exact interval boundary, approval refusal with no new email approval, and frequency changing after provider reads but before dispatch. The late-change test retains the same consent and recipient identity from approval, so an audience-hash mismatch cannot mask the frequency check.

## Validation and limitations

Final verification: 86 tests across seven files, root/Convex typecheck and scoped ESLint passed. Commands/results are in `docs/Verification.md`. Tests exercise local Convex functions with fixtures and mocked provider operations. No real send, provider access, deployment or model evaluation occurred. No generated files were edited. The new index is source-only until a future authorized backend deployment.

This repair does not establish individual customer activation/retention state, automatic enrollment/exits, or a shared scheduler across all communication types. History lookup covers outreach rows with recorded recipient hashes and send times; legacy unkeyed history and activity outside ClimbOS remain incomplete. Review invitations, service messages and external tools are not included in this particular broadcast interval. Unknown provider outcomes are not proof that no message was sent. This increment also does not add a per-contact lock across different simultaneous marketing broadcasts; approval-level deduplication is distinct from that remaining coordination work. No claim is made that this owner-selected interval is optimal for any audience.

The full 410 requirements and later owner specifications remain incomplete. Preserve the unrelated `.gitignore` changes.

Subsequent follow-up: [marketing contact overlap](marketing-contact-overlap-audit.md) closes the above cross-broadcast coordination gap for the owner-selected interval. Other cross-workflow, legacy and lifecycle limits remain.
