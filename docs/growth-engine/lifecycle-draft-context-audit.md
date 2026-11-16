# Lifecycle email preparation follows the selected plan

17 November 2026. Follow-up to the plan-to-content consistency and lifecycle recommendation requirements. This closes the welcome-only preparation gap recorded in the marketing-send authorization audit; it does not claim complete lifecycle automation or validated commercial copy quality.

## Confirmed path and gaps

Detailed-plan work starts through cards.startPlanWork/startCardRun. First-win preparation starts through content.startFirstWin. Both reserve content_email work and call jobs.createContent; jobWrites.jobContext resolves an explicitly pinned same-tenant strategy. EmailSequenceSchema/emailSpec guide generation, emailToArtifacts saves an email_sequence draft, and the existing content review and marketing approval paths remain separate.

First-win preparation previously titled every email job Your welcome email and passed a welcome-only request even when the selected plan called for retention, reactivation or product education. The approved-plan summary carried audience names but omitted audience hypotheses, evidence, channel dependencies and later deliverables. Pending first-win plans did not have an approved-plan summary at all. The email schema also required a number for every delay, leaving no structured unknown timing state.

A later focused regression reproduced another issue: a pending starter plan pinned by identity was labeled as approved after supersession. Identity alone was being used as evidence of prior approval.

## Implemented behavior

- First-win jobs now say Your first email drafts, retain the selected email_lifecycle key and record whether the plan was approved at launch. Their request no longer forces a welcome sequence. Older queued starter briefs are superseded by the actual selected lifecycle context.
- The existing approved-plan context module formats the exact selected channel's purpose, complete deliverables, dependencies, measurement and recorded sources, with up to five audience records retaining hypotheses/evidence/sources and the plan's constraints. It explicitly distinguishes candidate audiences from an eligible contact segment and states when no audience is recorded. Additional audience records are disclosed as omitted.
- Selected context is wrapped as untrusted planning data in both v2 and legacy generation tasks. Missing/foreign originating plans, parked or duplicate channel matches, and context over 8,000 characters stop before generation rather than silently substituting a generic audience or cutting an eligibility qualifier.
- The shared email task follows the selected lifecycle purpose and asks for the smallest useful one-to-three-message sequence. Unknown audience, behavior, trigger, offer and permission stay unknown. It does not imply that a recorded general marketing opt-in proves eligibility for a specific message.
- Unknown relative email timing can be null. Drafts display timing to confirm; numeric delays are nonnegative whole days and displayed as proposed. A final schema check rejects malformed, empty or oversized sequences and invalid delays before persistence, including when a passing model review retains invalid output. No delay schedules anything.
- Superseded starter proposals require the recorded approved-at-launch state before they can contribute approved-plan context or offer constraints. Legacy starter jobs without that evidence cannot gain approval merely by being superseded. Existing approved action-card preparation retains its prior pinned-plan behavior. Currently approved plans remain usable as approved context.

Engine v3.125-lifecycle-draft-context. No new agent, provider, dependency, database table, Next.js component or publishing permission. New run metadata uses the existing JSON input; nullable delay is a generation contract and becomes display text in the existing artifact body. Historical drafts are not rewritten.

## Verification

The 16 focused cases exercise actual first-win/card reservation and scheduled job generation boundaries, old queued starter briefs, source-plan supersession, approval-state preservation, missing audience, missing/parked/duplicate/oversized plan context, valid unknown timing and invalid output rejection. Successful mocked generation saves a private draft with timing to confirm and no schedule, approval or action receipt. Most context cases intentionally stop at the model boundary, so they prove supplied context rather than model quality.

The first run showed three welcome-title failures and a missing-audience-context failure. Its supersession case was contaminated by scheduled work from early-failing tests; those tests were corrected to finish their scheduled work before asserting. A separate supersession approval-label regression failed independently before its fix. Final broader verification: 120 tests across eleven files, plus root/Convex typecheck and scoped lint. Exact commands are in Verification.

## Remaining limits

- No live model, real business, browser or provider send was exercised. Tests establish context wiring, typed output, private persistence and permissions; they do not establish useful lifecycle strategy or faithful interpretation of every audience qualifier.
- Plan audience hypotheses are not contact segments. Selecting real recipients still requires the separate marketing approval, opt-in, suppression and current audience checks.
- Numeric delays are structurally validated and labeled proposals; this batch does not independently prove that every model-chosen interval is supported by the source context. No sequence enrollment, event-triggered sending, automatic exit or scheduling was added.
- The richer selected-channel context applies to plan-bound email preparation. Generic direct requests retain the general approved-plan/research context and explicit owner request. Cross-channel semantic consistency remains an evaluation requirement.
- Pending-plan commercial ideas are still proposals. Recorded plan sources are not newly fetched evidence or verified customer behavior. The 8,000-character and five-audience bounds remain explicit.
- Unknown marketing-send reconciliation and its owner workflow remain open from the prior audit. The complete 410-row inventory and later owner specifications are not complete.
