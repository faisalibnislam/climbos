# Plan preparation reuse: completion evidence audit

17 November 2026. Scoped audit of requirements 41–43: execution preparation, separation from external actions and truthful capability/status reporting. Relevant library route: Book 14 sections 10–11; these are reference requirements, not runtime proof.

## Inspected path

`jobWrites.saveStrategy` can request `content.startFirstWin` after a first detailed plan. The starter jobs reserve existing credits and prepare social/email artifacts; they do not publish or send. Separately, owner plan approval reaches `workspace.decidePlan` → `cards.startPlanWork`, which either reuses focused prepared work or creates draft-only action cards for active detailed-plan channels. Existing reservation, busy/credit waiting, approval, tenant and downstream publishing controls remain in place.

## Confirmed defect

For version-one detailed plans, `startPlanWork` treated any nonempty organization `firstWinRunIds` list as proof that both social and email preparation were covered. It did not inspect job status, kind, plan identity or actual artifacts. Nine initial regressions demonstrated false coverage for failed/canceled/uncertain/running jobs, empty verified results, archived or broken artifacts, unbound legacy runs, and email work when only social existed.

## Repair

New first-win jobs record the exact strategy ID and social quantity in their existing run input; a missing plan cannot launch them. Reuse reads only same-tenant social/email first-win records bound to the approved version-one plan. Each verified job must retain enough usable artifacts of the matching kind/channel/business and readable current versions with matching artifact identity/version and tenant. Archived, failed, uncertain, publishing or missing artifact states are not counted as usable preparation.

Coverage is tracked separately for social and email and requires all matching jobs of that kind to be covered. Active jobs are waiting/in progress, preserving the existing busy retry path rather than creating duplicate work. Paused and uncertain jobs remain explicit waiting states and are not automatically replaced. Missing/failed/canceled preparation uses the existing action-card/credit path. A prepared draft remains subject to its own review and publishing permissions; coverage does not mean approval, delivery or business success.

Focused plans retain their existing reuse of the drafts embedded in the plan; no additional AI generation is introduced for them. This change adds no provider, UI component, schema field, public action or model route.

## Verification and remaining scope

The focused tests exercise actual Convex records and `startPlanWork`, including missing/incomplete/archived drafts, current-version integrity, wrong destination, foreign job/version, different/unbound plan, partial quantity, paused/unknown states and separate social/email completion. An actual `startFirstWin` reservation test checks the new plan binding; its scheduled provider jobs are not executed. Existing plan-history, focused-plan, wish, tenant and approval tests also pass. Exact results are in Verification.

This is evidence of truthful preparation reuse, not complete marketing-material verification. It does not judge copy quality, guarantee assets are publishable, prove campaigns work or add unsupported integrations. Old jobs without exact plan identity are not retroactively certified. Reads are bounded to eight first-win run IDs and seven artifacts per run; ordinary first-win work creates up to four jobs with at most three social drafts. Out-of-contract evidence does not establish coverage. Partial failed preparation may still need a replacement draft job rather than per-item regeneration. Broader plan-to-platform destination selection and semantic consistency remain open audit work. No browser, live provider, paid-model evaluation, deployment, send or publication occurred.
