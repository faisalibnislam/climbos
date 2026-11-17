# Retention recommendation evidence — 17 November 2026

## Audit route and existing behavior

Read the master-index lifecycle route and relevant Book 08 sections on relationship evidence, state transitions, triggers, exits and outcome measurement. Traced `businessFacts` → `jobWrites` context → `jobs.agentInput` source classes → `simplePlanJob` → `retentionSpec` / `RetentionPlanSchema` → `workflowRuns.output` and the existing generic `OutputView`. Existing contacts/consent/suppression and marketing-send approval remain separate. Outbound mailbox sequences also exist separately; they are not customer lifecycle event enrollment.

The engine already asks for a specific offering, customer-value signal, timing trigger, evidence quotes, comparison and stop/continue rules. However, its retention validator accepted any owner/measured/source label without comparing recorded provenance. Non-expansion retention returned before checking outcomes or decision rules. The schema required an integer observation window even when unknown. The job saved returned output as verified without a final schema/lint check, although the shared runner can retain a draft that has exhausted corrections.

Four unit regressions reproduced evidence-label inflation, unknown provenance treated as measured, rejected unknown windows and skipped retention outcome checks. Three actual-job regressions showed malformed, mislabeled and outcome-free recommendations being saved as verified despite the test's deliberately passing model review.

## Changes

- Reuse `referenceEvidenceBasis` and trusted `factEvidenceBases`: owner reports remain owner-reported, published claims source-reported, and missing provenance unknown. Words such as analytics or measured inside a report do not change its source class.
- Check explicitly reported claim excerpts and outcome/comparison/decision rules on ordinary retention as well as expansion plays. Explicit inferred/assumed validation hypotheses remain available; this is not a novelty filter.
- `observationWindowDays` now accepts null. Unknown windows require an owner input or stated uncertainty. The writer is instructed to ask for the needed period and to treat numeric periods as proposals to confirm, not schedules. Existing numeric values remain compatible.
- `simplePlanJob` parses retention output before recording it. Real v2 retention work then reruns the shared output validator using the same input and returned research metadata. A passing AI assessment cannot waive a hard evidence error. Failed output is not saved as verified advice and its action card is not marked done.
- The existing owner work-output renderer handles the structured result and owner-input/unknown lists; unknown scalar values remain a dash. Failure explanations use the existing work-progress path. No new UI, schema table, agent, provider, scheduling or sending action.
- Engine revision: `v3.129-retention-evidence-validation`.

## Verification and remaining work

Tests cover correct owner/measured/source labels, absent provenance, invalid reported excerpts, explicit hypotheses, null windows, ordinary-retention outcome rules, final generation/persistence rejection and no created artifacts/approvals/action receipts. Commands and results are recorded in Verification. Fixture/legacy compatibility remains explicit: all retention outputs receive schema parsing; the final evidence gate is applied to real v2 runs. Historic completed outputs are unchanged.

Quote matching and source-class agreement do not prove semantic truth, causal impact, actual per-customer progress or native-language quality. Numeric periods are not independently verified against every business buying cycle. Current source-note matching is bounded and not a universal source-attribution check. No paid model, browser, provider operation, deployment, enrollment or email send was exercised.

Customer lifecycle event ingestion, explicit entry/exit state, enrollment, per-recipient progress checks and event-triggered marketing sequences remain unfinished scope. Current contacts/segments do not establish completion of a customer's product milestone, and outbound prospect sequences must not be relabeled as that capability. The original 410 requirements and later owner specifications remain incomplete.

## Later 17 November update — structured owner observations

The later [customer-progress batch](customer-progress-evidence-audit.md) adds scoped, dated manual observations to the existing contacts UI and actual retention writer, with original-input checkpoints and saved evidence references. The prior statement about no structured customer progress describes this audit’s starting point. Automatic event ingestion, entry/exit evaluation, enrollment and per-recipient dispatch checks remain unfinished.
