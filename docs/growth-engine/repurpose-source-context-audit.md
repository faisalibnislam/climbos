# Repurposing source constraints — 17 November 2026

## Traced path and confirmed gaps

The audit followed `RepurposeDialog` → `repurpose.start` → scheduled `repurposeActions.run` → `repurpose.context` → `repurpose.save` → `insertArtifact` → content review/edits → `content.decide` and shared approval checks. This implements the cross-channel offer consistency requirement and contributes to requirement 44's material validation scope and specification sections 6.4, 9 and 13.

Existing behavior already required edit permission, checked the source artifact tenant, reserved model work, generated private drafts and used normal later approval. However, an existing-artifact request retained only text. It discarded exact source identity, offer snapshots and structured trend evidence. The new artifact therefore lacked metadata needed by the existing offer and trend approval checks. Missing formats were filtered out and duplicate formats silently deduplicated while the job was marked verified.

Four initial regressions reproduced missing source binding, accepted wrong prices, accepted unsupported scarcity and mixed artifact/web sources. They failed before the implementation.

## Changes

- Start pins `sourceArtifactId` and `sourceVersionId` in the existing workflow input, verifies tenant and artifact/version relationship, and rejects mixing an existing artifact with another text/web source. No schema migration is needed.
- The actual writer resolves the pinned version, even if the owner edits the source while the work is queued. It receives the original offer constraints, selected play and historical source brief as untrusted data. Source text now uses the existing wrapper sanitizer.
- Persistence independently resolves the same source. It checks the complete normalized output batch against existing offer lint before inserting any artifacts or tracking links. Prices, eligibility, mechanisms and urgency use the existing bounded validator; no new promotion subsystem is introduced.
- New drafts retain the source's offer snapshot, selected play and copy brief, including original trend observation/retrieval dates. Fact references are retained only where the fact still belongs to this tenant/business; unavailable references are omitted. The adapted channel/format is updated, unknown enum values remain unknown, and the brief explicitly requires owner review of adaptation/evidence fit. Existing dates are never refreshed merely by rewriting.
- Source content approval, schedule, assets and action authority are not inherited. Every new artifact remains in review. Edits retain the constraints through the existing content workflow; stale trend evidence continues to prevent approval.
- Generation and persistence both require exactly one usable result for each requested format. Missing, duplicate, unexpected or empty results fail without a partial batch. Source lookup or persistence failures leave a failed run with an owner-readable explanation rather than a falsely verified result.
- Engine revision: `v3.127-repurpose-source-context`.

## Verification and limitations

The final focused suite includes source version pinning during edits, tenant/version isolation, deleted-source failure, unchanged trend dates and approval blocking, wrong price/scarcity rejection, independent batch validation, edit-time offer checks and incomplete-format handling. See Verification for commands and results.

These are deterministic persistence, context and authorization checks with mocked model output. No real model, live provider, browser interaction, paid evaluation or deployment was used. Existing source links and excerpts do not prove semantic truth, present-day eligibility or business impact. The inherited brief is labeled historical; it does not establish that every sentence in an adaptation is supported. Offer lint remains bounded to its recognized language. Legacy jobs that never saved source identity cannot recover that missing provenance automatically. Pasted text and webpage requests do not acquire an approved plan's offer authority or structured trend evidence. The full requirement set remains incomplete.
