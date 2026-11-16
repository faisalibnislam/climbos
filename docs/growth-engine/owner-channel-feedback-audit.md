# Owner channel feedback in default strategy

17 November 2026. Follow-up to the owner's explicit requirement to retain dismissed/irrelevant platform feedback in future recommendations, and the broader channel-selection audit. This is a bounded runtime repair, not a claim that every generated recommendation respects every preference semantically.

## Existing path and confirmed gaps

`acquisition.setChannelPreference` requires workspace edit access, validates a known library channel, records a rationale, optional source and date, preserves other preferences, and audits the change. The detailed channel scorer already excluded dismissed/irrelevant entries. Planning snapshots also retained the feedback, and later plan approval/start checked whether inputs changed.

The default focused/starter generation branch bypassed that scorer. Its normal business brief did not explicitly provide the saved channel feedback, and its plan validator did not apply the dismissal rule. Thus the stored owner decision was neither explicit guidance nor a deterministic check in the default path.

Actual job tests exposed a second gap: generation saved optional source/date fields in the preference snapshot, but freshness compared it to current preferences with those fields removed. A newly generated plan with feedback could immediately report a changed business profile. A separate red query regression confirmed this with an unchanged owner preference.

## Changes

- Strategy business context includes known channel names, saved preference/rationale/date, and explicit owner-reported/untrusted labeling. It says that preferences are not measured performance, customer demand or execution permission. This reaches the existing writer/reviewer input without another agent or research call.
- `constraintsOf` supplies the saved preferences to shared validation. `channelPreferenceBlock` reuses the existing dismissed/irrelevant rule in both scoring and `lintPlanFit`. Matching is exact library ID or normalized name/key (case, whitespace, hyphen/underscore); it does not fuzzy-match a whole mechanism or audience. Existing strategy channel keys are broad execution categories, so exact library-name matching is the available default-plan identity check.
- `owner_channel_preference` is a hard quality finding naming the affected channel. The owner can clear the existing preference and generate a new plan; nothing clears it automatically. Prefer/avoid/already_using remain soft context.
- Grounded, adjacent and bold exploration remain separate. A speculative alternative can explain the conditions for reconsideration without becoming the immediate selected channel or action authority.
- `channelPreferenceSnapshot` creates the same sorted source/date-preserving records for generation and current-input comparison. Unchanged feedback is fresh; changed recorded evidence still requires refresh. Existing historical documents are not rewritten.

No database schema, provider, UI component or campaign-timing prompt was changed. Engine `v3.122-owner-channel-feedback`.

## Verification

Four new unit regressions failed before adding default-plan validation. All three plan styles now cover dismissal, irrelevant feedback, retained bold options, positive/negative soft preferences, clearing and exact identity matching without fuzzy bans.

Four actual focused/starter generation cases record feedback through the owner mutation, inspect model input and persisted failed quality, reject approval/start, clear feedback, and verify a new passing plan. They assert no action receipts or granted approvals. Another actual query regression first reproduced false staleness, then checks unchanged feedback and a changed source URL, including approval/start refusal after that change. The final commands and results are in Verification.

## Remaining scope

Free-form channel labels or prose can describe a dismissed platform without matching its library identity. The shared context instructs the model to respect the feedback, but semantic compliance and business-quality consistency require further evaluation; this repair does not claim full coverage. A canonical channel reference in broader plan contracts should be assessed alongside platform-fit evidence rather than added as a parallel recommendation subsystem. Owner reports remain unverified; a preferred channel does not become eligible or proven. A changed legacy snapshot with missing source/date information may require refresh; no historical evidence is invented. No live accounts, paid-model evaluation, browser verification or deployment were used for this batch.
