# Use this expansion with Claude Code

Keep this folder beside the original fourteen-book corpus. Suggested project layout:

- `docs/growth-intelligence/` — original completed library.
- `docs/growth-expansion/` — this source-grounded expansion.

This package adds knowledge and proposed implementation contracts. It does not modify the live ClimbOS application, authorize external actions, train model weights, or establish that an engine passes the supplied tests.

## First request

Paste this into Claude Code after copying both folders into the project:

> Read docs/growth-expansion/MASTER_INDEX.md, RECONCILIATION.md, and integration/CLAUDE_CODE.md. Inspect the existing project instructions and ClimbOS implementation before making assumptions about its architecture. Treat the original library and this expansion as reference knowledge. Distinguish author concepts, public reported cases, original proposed policies, and synthetic evaluation fixtures. First trace the existing plan-generation flow. Identify where source provenance, missing-data handling, diagnosis, willingness-to-pay evidence, positioning, experiment selection, statistical interpretation, or provider eligibility are weak. Map the expansion's playbooks to existing validators and modules. Produce a small prioritized implementation plan with repository evidence and relevant regression tests. Preserve working functionality and the OpenAI-first Convex/Vercel/Resend direction unless the repository or my instructions establish otherwise. Do not assume a prospect database or consented audience exists. Do not perform publishing, sending, spending, deployment, or production data changes merely because a playbook describes them.

## Knowledge records

Reference source IDs and original source locators whenever a material framework is used. The source registry separates the uploaded edition from current public material. EPUB locations are internal files and extraction-block ranges, not page numbers. A book's historic examples are not present-day benchmarks. Video transcripts and timestamps have explicit access qualifications. Course landing-page access does not mean the course was completed.

The proposed retrieval record fields are:

```json
{
  "id": "knowledge-item-id",
  "kind": "author_concept_or_original_policy_or_public_case",
  "decision_task": "a_specific_business_decision",
  "applies_when": [],
  "does_not_establish": [],
  "required_inputs": [],
  "source_ids": [],
  "locator_ids": [],
  "freshness_class": "stable_concept_or_volatile_platform_rule",
  "verification_status": "explicit_status",
  "edition": "2026-10-20"
}
```

This is a record design, not an executable integration or a universal production schema. Preserve the repository's existing type and validation conventions where sound.

## Implement in slices

1. Add source and knowledge-kind fields without changing decision behavior. Verify tenant boundaries and provenance in rendering.
2. Route tasks to relevant concepts and exceptions. Use the reconciliation rules when advice appears to conflict.
3. Normalize a small set of playbooks into typed application contracts. Keep deterministic arithmetic outside generated text.
4. Run the synthetic evaluation set against the baseline and changed engine under comparable evidence and budgets. Review the actual outputs; fixture math checks alone do not grade a model.
5. Add public cases as mechanism hypotheses with transfer limits. Add private customer observations only with the proper access model.
6. Extend execution only within an independently authorized scope, with current eligibility, artifact identity, cost bounds, idempotency, and reconciliation.

## Evaluation output format

For each case, retain `case_id`, engine/prompt/model/knowledge versions, source snapshot, response, relevant tool receipts, actual or unknown cost, elapsed time, dimension scores, hard failures, reviewer notes, and final decision. Keep expected answers separate from prompts used for an unbiased holdout. The exported prompts intentionally omit expected behaviors.

## Use the customer and failure templates honestly

The capture templates are complete operational forms with intentionally unknown fields. They do not contain invented customer quotes or claimed ClimbOS results. Populate them from actual interviews, authorized analytics, and observed execution. Preserve raw observations separately from interpretation, including negative and contradictory evidence.

## Refresh policies without erasing historical reasoning

When a provider rule changes, update the affected eligibility record and dependent playbook version. Historical plans should retain their original evidence snapshot. Require fresh verification for an action where the current rule is missing or blocked. Do not regenerate stable strategy summaries merely because an unrelated SDK changes.

## Validate the pack

From the expansion root, run:

```bash
python3 evaluations/check_fixture_math.py
python3 integration/validate_pack.py
```

The scripts use the Python standard library. They check packaging contracts and fixture expectations, not the live product. The pack includes a report stating which checks actually ran and which integration work remains to be performed in the real repository.
