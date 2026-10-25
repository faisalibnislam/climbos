# ClimbOS buildable-gap completion roadmap

**Created:** 25 October 2026. **Owner decision:** complete every code gap that can be built and tested in the repository, then open a PR from `growth-engine-v2`, merge to `main`, and deploy to production for live testing with connected provider accounts. The production deploy and merge are confirmed with the owner immediately before they run.

This roadmap lists code gaps only. It excludes work that needs live outcomes, real customers, provider approvals, credentials, or calendar time (see the handoff's "What remains" list). Candidates came from two read-only audits of audit rows 1–205 and 206–410 plus the handoff, checked against code on 25 October 2026. Re-verify each one against the code before building it; an audit finding is a lead, not proof.

Status: **Done**, **Next**, or **Planned**. Size: S (one module + tests), M (backend + UI + tests), L (several subsystems).

| # | Gap | Audit rows | Size | Status |
|---:|---|---|:-:|---|
| 0a | Growth cash timing view, plan input, reserve and monthly-limit hard checks | 122, 319 | M | Done (`48176a7`, `2fd5207`, `00d1b6d`, `590d9a9`) |
| 0b | Verbatim excerpt checks for play action evidence | 24; handoff 3 | M | Done (`9faf0d7`) |
| 1 | Logged cost per customer compared with the plan's affordable cost per customer; spend advice withheld when it isn't justified | 296–298, 324, 403 | S–M | Done (see ledger) |
| 2 | Repeat-purchase rate and time to second order for order-based businesses (unknown without customer IDs) | 30, 37, 121–130; handoff 2 | S–M | Done (see ledger) |
| 3 | "Still accurate" reconfirmation for facts due for review | 22–29, 136 | S | Next |
| 4 | Lost-deal reasons and objections captured in the CRM and given to the diagnosis | 3, 81–90, 111–120, 232, 238, 248, 249, 399 | M | Planned |
| 5 | Stalled deals and overdue next steps detected (stage-change time) | 234, 239, 245, 246 | S–M | Planned |
| 6 | One-time setup costs in plays, timed by the cash view and reserve check | 122, 319; handoff 12 | M | Planned |
| 7 | Design and conversion finding decisions carried across audit runs, with a deduplicated queue | 71–80; handoff 4 | M–L | Planned |
| 8 | Saved forecasts scored against actuals (error, bias, interval coverage) | 314, 315, 327, 408 | S–M | Planned |
| 9 | Possible tracking breaks and unusual swings in connected metrics | 292, 293, 295, 407 | S–M | Planned |
| 10 | Owner-chosen Meta conversion action so cost-per-conversion advice works | 46 | M | Planned |
| 11 | Excerpt checks extended to audience needs, decision observations and other prose references | 24; handoff 3 | S–M | Planned |
| 12 | Lead fit and timing scores checked against outreach outcomes | 278, 290, 400 | S | Planned |
| 13 | Owner-recorded AI-answer accuracy (incorrect claim vs correct fact) | 372, 374, 397 | M | Planned |
| 14 | LocalBusiness structured data and `sameAs` links with owner attestation | 365–367 | S–M | Planned |
| 15 | Search readiness compared with monitored competitors | 357, 359, 364 | M | Planned |
| 16 | Structured, sourced competitor battlecards | 206, 207, 393 | M | Planned |
| 17 | Owner view, retire and expiry of past strategy feedback | 135 | M | Planned |
| 18 | Owner-set contact frequency limit across broadcasts, outreach and review invitations | 148 | M | Planned |
| 19 | Warning when a link destination no longer shows the approved offer | 44 | M | Planned |
| 20 | Per-provider sync freshness limits | 147 | S | Planned |
| 21 | Event-triggered specialist runs (draft-only, budgeted, debounced) | 337, 349, 381–410 | L | Planned |
| 22 | Specialist usage summary beyond the 500-run / 100-report caps | 149 | S | Planned |

## Release steps (after the gaps)

1. Run the full test suite, typecheck and lint; fix or report failures.
2. Check the production Convex and Vercel environment variables and provider credentials; report what is missing for Google, Meta, Resend and Stripe.
3. Confirm with the owner, then open the PR to `main`, merge it, deploy the Convex functions and schema, and confirm the Vercel production deployment.
4. Smoke-test the production site and report what was and wasn't verified.

## Estimate

At about four tested increments per working session, the 22 planned gaps are roughly five to seven sessions, plus one for release. Individual gaps may grow once traced; update this table as each lands.
