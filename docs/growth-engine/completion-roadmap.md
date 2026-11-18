# ClimbOS buildable-gap completion roadmap

**Created:** 25 October 2026. **Reconciled:** 18 November 2026. This is the historical 22-gap code inventory, not a declaration that all 410 requirements or later owner requests are complete. Its original release sequence and branch are superseded by the current work instructions: continue on `codex/trend-evidence-freshness`, push verified batches, preserve user changes, and ask before switching Codex models. Do not infer PR, merge, deployment, customer action or paid-call authority from this document. The owner later paused all paid evaluation under the $100 cap; $99.063401 used or held remains unchanged.

## Current acceptance work

- **Recommendation quality:** the November 17 paid checks still contain below-bar results. Retrieval integration, fractional scoring, draft selection and offer false positives have been repaired, but code tests are not proof of original, useful strategy quality. Preserve failed outputs and [the current quality report](../Strategy-Quality-2026-11-17.md).
- **Requirement-level acceptance:** the [complete 410-row reconciliation](requirements-reconciliation-2026-11-18.md) and [later-contract scope audit](requirements-scope-2026-11-18.md) are complete as audits, with actual runtime paths, local test groups and explicit remaining boundaries. A shared repair can cover many requirements without establishing every scenario or real-world outcome.
- **Evidence and execution:** continue checking concrete gaps in source semantics, timing, offer consistency, outcome coverage and exact approval boundaries. Follow the [implementation ledger](implementation-ledger.md); do not rebuild capabilities solely because an older paragraph says they are missing.
- **Owner and live-system validation:** full owner usability, current provider eligibility/access, external-site editing/re-rendering, real exposure and measured business outcomes remain distinct acceptance work. Report unsupported paths and missing credentials rather than guessing or silently executing them.

The table below records the original buildable gaps. “Done” is scoped to those increments and their recorded tests.

This roadmap lists code gaps only. It excludes work that needs live outcomes, real customers, provider approvals, credentials, or calendar time (see the handoff's "What remains" list). Candidates came from two read-only audits of audit rows 1–205 and 206–410 plus the handoff, checked against code on 25 October 2026. Re-verify each one against the code before building it; an audit finding is a lead, not proof.

Status: **Done**, **Next**, or **Planned**. Size: S (one module + tests), M (backend + UI + tests), L (several subsystems).

| # | Gap | Audit rows | Size | Status |
|---:|---|---|:-:|---|
| 0a | Growth cash timing view, plan input, reserve and monthly-limit hard checks | 122, 319 | M | Done (`48176a7`, `2fd5207`, `00d1b6d`, `590d9a9`) |
| 0b | Verbatim excerpt checks for play action evidence | 24; handoff 3 | M | Done (`9faf0d7`) |
| BM | Business model check: outdated-model detection, three alternative models, pivot-or-persist, test tracking (owner request) | 2, 9 | L | Done (see ledger) |
| 1 | Logged cost per customer compared with the plan's affordable cost per customer; spend advice withheld when it isn't justified | 296–298, 324, 403 | S–M | Done (see ledger) |
| 2 | Repeat-purchase rate and time to second order for order-based businesses (unknown without customer IDs) | 30, 37, 121–130; handoff 2 | S–M | Done (see ledger) |
| 3 | "Still accurate" reconfirmation for facts due for review | 22–29, 136 | S | Done (see ledger) |
| 4 | Lost-deal reasons and objections captured in the CRM and given to the diagnosis | 3, 81–90, 111–120, 232, 238, 248, 249, 399 | M | Done (see ledger) |
| 5 | Stalled deals and overdue next steps detected (stage-change time) | 234, 239, 245, 246 | S–M | Done (see ledger) |
| 6 | One-time setup costs in plays, timed by the cash view and reserve check | 122, 319; handoff 12 | M | Done (see ledger) |
| 7 | Design and conversion finding decisions carried across audit runs, with a deduplicated queue | 71–80; handoff 4 | M–L | Done (see ledger) |
| 8 | Saved forecasts scored against actuals (error, bias, interval coverage) | 314, 315, 327, 408 | S–M | Done (see ledger) |
| 9 | Possible tracking breaks and unusual swings in connected metrics | 292, 293, 295, 407 | S–M | Done (see ledger) |
| 10 | Owner-chosen Meta conversion action so cost-per-conversion advice works | 46 | M | Done (see ledger) |
| 11 | Excerpt checks extended to audience needs, decision observations and other prose references | 24; handoff 3 | S–M | Done (see ledger) |
| 12 | Lead fit and timing scores checked against outreach outcomes | 278, 290, 400 | S | Done (see ledger) |
| 13 | Owner-recorded AI-answer accuracy (incorrect claim vs correct fact) | 372, 374, 397 | M | Done (see ledger) |
| 14 | LocalBusiness structured data and `sameAs` links with owner attestation | 365–367 | S–M | Done (see ledger) |
| 15 | Search readiness compared with monitored competitors | 357, 359, 364 | M | Done (see ledger) |
| 16 | Structured, sourced competitor battlecards | 206, 207, 393 | M | Done (see ledger) |
| 17 | Owner view, retire and expiry of past strategy feedback | 135 | M | Done (see ledger) |
| 18 | Owner-set contact frequency limit across broadcasts, outreach and review invitations | 148 | M | Done (see ledger) |
| 19 | Warning when a link destination no longer shows the approved offer | 44 | M | Done (see ledger) |
| 20 | Per-provider sync freshness limits | 147 | S | Done (see ledger) |
| 21 | Event-triggered specialist runs (draft-only, budgeted, debounced) | 337, 349, 381–410 | L | Done (see ledger) |
| 22 | Specialist usage summary beyond the 500-run / 100-report caps | 149 | S | Done (see ledger) |

## Release boundary

Current authorization covers verified commits and pushes to the feature branch. Production changes require a separate concrete release decision under the then-current owner instructions. Do not follow the historical plan to open/merge a PR or deploy merely because the table is marked done. Use focused tests for the changed behavior; broaden them when failures or a release decision justify it.

## Historical estimate

The original five-to-seven-session estimate applied only to the 22 listed code gaps. It is not an estimate for the entire product, current strategy-quality acceptance, all 410 requirements, provider approval or observed business outcomes. No completion date for those is established by this roadmap.
