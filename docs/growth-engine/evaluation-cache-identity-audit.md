# Evaluation result identity — 17 November 2026

## Confirmed gap

The paid strategy harness reused any existing `result` at the same variant path. It did not compare the stored code fingerprint, engine, input, timing clock or model/revision settings. Changing code and accidentally retaining a variant name could silently return old output as if it were the requested evaluation.

## Repair

A local helper hashes case/run identity, selected source fingerprint, engine, full input and serializable agent configuration. Successful records store that identity; reuse requires an exact match. Missing/changed identity or failed/incomplete records stop before another paid call or overwrite. Legacy files remain inspectable via explicit historical comparison stages and are not rewritten. Both the harness and helper join its selected source fingerprint.

The current `acceptance-v6-20261117` process started before this harness-only repair. Its records still carry their original engine/source metadata and are not retroactively upgraded. Production execution, model routing, approvals and schemas are unchanged.

## Verification and limitations

Twenty tests in six files passed (0.664 seconds), covering exact reuse of below-bar results; changed facts, clock, creative query, revision limit, model, source and engine; rejection of legacy/interrupted results without mutation; and existing paid-budget/input safeguards:

```sh
pnpm exec vitest run tests/unit/evaluation-identity.test.ts tests/unit/anthropic-budget.test.ts tests/unit/ai-qa-budget.test.ts tests/unit/evaluation-budget.test.ts tests/unit/industry-evaluation-input.test.ts tests/unit/offline-evaluation-input.test.ts
pnpm typecheck
pnpm exec eslint bench/strategy-quality/evaluationIdentity.ts bench/strategy-quality/anthropicLive.ts tests/unit/evaluation-identity.test.ts
```

Typechecks and lint passed. No test made a provider request. This is strict request/configuration identity, not semantic validation or a full transitive dependency fingerprint. A fresh evaluation clock requires a new variant; result reuse is not new quality evidence. No cap, receipt or uncertainty hold was changed.
