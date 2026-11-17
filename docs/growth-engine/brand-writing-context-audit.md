# Shared brand guidance in writing — 17 November 2026

## Scope and confirmed behavior

Requirement 45 asks for better respect for brand identity; requirement 44 covers material quality checks. The existing brand editor saves voice, tone words, palette, restrictions, approved examples, social humor/trend preferences and optional inferred edit preferences. Owner/admin consent controls learning; disabling it normally clears learned rules. The main `convex/jobs.ts` business brief already carried most writing settings. Weekly social planning uses that same brief. No new agent, provider, editor or external action is needed.

The audit traced saved `brandProfiles` through the main job brief, `repurpose.context` → `repurposeActions.run`, and `landing.writeContext` → `landing.write`. Repurposing and landing writing previously supplied only voice and learned rules, then clipped the combined text to 600 characters. Tone, restrictions and approved examples were missing from those actual model requests. Inferred rules were called the owner's rules, and their use did not check whether learning remained enabled.

## Implemented

- `shared/agents/contentTasks.ts` supplies one shared brand-writing context to the primary, repurposing and landing writers. It retains settings and examples without the old specialist 600-character clipping. The existing editor bounds still apply.
- Saved settings distinguish owner-confirmed from unconfirmed. Approved examples are style references, not evidence for customer outcomes. Inferred preferences are explicitly labeled and supplied only when `voiceLearningEnabled` is true, including for legacy records that retain rules after consent is off.
- Explicit restrictions take priority over inferred preferences and generic platform recipes. Repurposing's system instruction reinforces this precedence. Social preferences are omitted for landing pages and email-only repurposing; mixed social/email requests scope them to social formats.
- Brand text uses the existing untrusted-data wrapper. Settings cannot authorize publishing or establish commercial facts, trend freshness or asset rights. Missing brand identity stays unknown.
- Specialist queries check the profile's tenant. Existing run, reservation, approval and publication paths remain in place. Engine revision: `v3.126-shared-brand-writing`.

## Verification and limits

The initial two specialist-generation regressions failed because tone settings were absent from the actual model messages. Tests now exercise the scheduled writer paths and capture their model requests; they deliberately return a failed model response, so they establish context delivery rather than generated-copy quality. Main social generation separately tests enabled and disabled learning, while existing calendar tests verify shared voice context and draft-only behavior. Unit tests cover long examples, final restrictions, unknown identity, consent and wrapper boundaries. The final suite and exact commands are recorded in `docs/Verification.md`.

No paid model, provider operation, browser interaction or deployment was performed. A correctly supplied restriction is not proof the model will obey its meaning; representative brand-copy evaluation remains required. Snapshot schemas and historical plans are unchanged, and this batch does not claim a complete audit of every brand-data consumer or all 410 requirements. No unrelated `.gitignore` changes are included.
