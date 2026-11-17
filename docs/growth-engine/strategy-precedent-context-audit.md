# Precedents in the default strategy path — 17 November 2026

Engine: `v3.148-strategy-precedent-context`.

## Confirmed gaps

The creative precedent entry point selected records for `growth_plays` and business-model work, or when a task contained an older exact heading. The current starter/focused `growth_strategy` task used different wording. It generated the protected three-option portfolio, and saved retrieved IDs, but the writer and critic never received the precedent records. Three failing regressions reproduced the disconnected default path and a second issue: the critic cut supplied precedent text at 3,200 characters, sometimes before the first record's source and transfer limitations.

## Repair and actual path

Existing tenant-scoped strategy input → `runAgent` → `creativePrecedentsForAgent` → existing mechanism/constraint retrieval (at most two records) → writer and critic → schema/lint/quality → saved strategy and owner review.

- `growth_strategy` now receives the existing library independently of task headings, covering starter, focused and detailed strategy agents.
- The reviewer receives the same complete selected records as the writer, including source URLs, dates, causal limits, transfer risks and reversible tests. The record-count bound remains two; no second research agent or provider is introduced.
- No-match retrieval still invites original hypotheses. An uncited bold idea remains eligible; a missing precedent is not an execution gate. Citation validation and owner approval are unchanged.
- The live evaluation's selected-file fingerprint now includes the two creative precedent modules for future runs. It remains a selected-file fingerprint, not a full dependency manifest.

## Verification

Three red unit/runtime cases preceded the repair. **307 tests in nine files passed (14.43 seconds)**:

```sh
pnpm exec vitest run tests/unit/agent-escalation.test.ts tests/unit/creative-precedents.test.ts tests/unit/strategy-exploration.test.ts tests/unit/plan-quality.test.ts tests/unit/anthropic-budget.test.ts tests/convex/focused-plan.test.ts tests/convex/plan-approval.test.ts tests/convex/marketing-authorization.test.ts tests/convex/tenancy.test.ts
```

The real Convex job fixtures verify starter/focused writer and critic context, matching saved retrieved IDs, an uncited bold option, passing deterministic fixture quality and no action receipts. Runtime tests inspect both records' complete source and limitation text for focused and detailed agents. Application/Convex typecheck, changed-file ESLint and diff checks passed. Additional safety and prompt-cost checks: **14 tests in two files passed (2.98 seconds)**.

## Costs and limits

Complete records add input tokens; this is not a cost-free change. The existing per-call provider claim calculates a reservation from actual request size and refuses calls beyond the stored run cap. The 40k-token initial input envelope, output ceilings, revision allowance and models are unchanged. Current long selected pairs can exceed 13–17k characters; the old 3,200-character reviewer limit was not an honest complete-record bound.

Retrieval is still lexical and can be influenced by generic task instructions. A retrieved analogy is a research aid, not proof of customer fit, causal outcomes or strategic quality. The ongoing `acceptance-v4-20261117` paid process loaded `v3.147` before this change; its results remain pre-fix evidence and must not be described as validating this repair. No live-model improvement is claimed by the fixture passes. No external business action or deployment. Full scope remains incomplete.
