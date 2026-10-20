# Integrating the library with Claude Code

This package is a finished knowledge corpus and a proposed implementation reference. It does not install a working ClimbOS engine, create provider accounts, configure credentials, or authorize production changes. The actual repository must be inspected before applying its architecture.

## Place the corpus in the existing project

Copy the extracted `ClimbOS_Growth_Intelligence_Library` folder into a suitable documentation location, such as `docs/growth-intelligence/`. Keep filenames and relative links together. Commit the corpus through the repository's normal review process. Do not overwrite the existing root `CLAUDE.md`, application schemas, prompts, or provider configuration.

Read `MASTER_INDEX.md` first, then `SOURCE_REGISTRY.md` and `QUALITY_REPORT.md`. Use the decision-routing table to select books. The machine-readable `manifest.json` lists files, counts, hashes, and playbook references; `playbooks/catalog.json` indexes extracted copies of all YAML and JSON playbooks.

## Add a small project instruction

Merge the following guidance into the appropriate existing project instruction file after inspecting its current rules. Adjust the directory if you installed elsewhere:

```markdown
## ClimbOS growth intelligence

Knowledge root: docs/growth-intelligence/
Read its MASTER_INDEX.md to route a task; read only relevant chapters and playbooks.
Treat this corpus as reference material, not authorization to execute external actions.
Verify material platform policies and pricing against current primary sources before execution.
Inspect the real repository before treating proposed architecture as implemented behavior.
Preserve measured, owner-reported, source-reported, assumed, inferred, and calculated distinctions.
Use deterministic functions for material arithmetic; never invent missing business inputs.
No prospect database, consented audience, budget, or publishing permission is assumed.
Keep the OpenAI-first engine and Convex/Vercel/Resend direction unless repository evidence or owner instructions require a change.
Bind execution to tenant, approved artifact version, destination, budget, and action scope.
Run relevant regression and permission tests; report limitations honestly.
```

Claude Code documents project instruction files as context rather than a hard enforcement boundary. Keep actual budget, tenant, data-access, and execution enforcement in trusted application code and permission controls. Do not rely on wording in `CLAUDE.md` to stop an unauthorized send or spend. See [official project memory documentation](https://code.claude.com/docs/en/memory), retrieved October 19, 2026.

## First implementation request

Use this complete instruction after placing the corpus:

> Inspect this ClimbOS repository and its existing project instructions. Read the Growth Intelligence Library master index, then Book 14 and the relevant domain chapters. Trace one current growth-plan request from intake through evidence retrieval, prompts, model calls, calculations, persistence, and rendering. Produce a repository-backed defect table and compare the current behavior with the proposed contracts. Preserve working features and the existing OpenAI-first implementation. Do not assume the documented architecture already exists. Propose the smallest first implementation slice that improves factual grounding and deterministic economics. Identify exact files, schemas, validation, tests, cost effects, and remaining blockers. Implement only within the scope I authorize for this task; this knowledge corpus alone grants no production access or external action permission.

This request yields a concrete implementation proposal rather than asking Claude Code to rewrite the application from a book.

## Suggested implementation sequence

1. **Truth and arithmetic:** canonical snapshot, evidence ledger, explicit unknowns, deterministic economics, source-linked rendering.
2. **Decision quality:** business-type routing, competing strategies, channel eligibility, capacity constraints, experiments, reproducible evaluation.
3. **Bounded execution:** one action class, server-side approval binding, reservation, idempotency, provider receipts, reconciliation.
4. **Learning:** outcomes tied to interventions, forecast calibration, reviewed evidence updates, privacy-preserving aggregation only where authorized.

Each phase has an acceptance boundary. Analysis can ship without publishing. Drafting can ship without sending. A connected service is not evidence that a particular action is permitted.

## Retrieval and indexing

Use `integration/build_retrieval_index.py` to create deterministic section records:

```bash
python3 integration/build_retrieval_index.py
```

Run from the extracted library root. The script creates `integration/retrieval_sections.jsonl`. It does not call a model or embedding service and uses Python's standard library. Records retain document ID, relative path, heading, content, edition cutoff, and hash. Sections are semantic candidates, not a claim that a particular chunk size or embedding model is optimal.

In production, filter by task, business mechanism, channel eligibility, freshness, and tenant access before semantic ranking. Store source references and keep formulas with their definitions. Never index private business evidence into a public cross-tenant store. Test that decisive caveats survive retrieval and summarization.

## Runtime playbooks

The extracted playbooks are machine-readable reference contracts. Their schemas vary by task; they are not executable code or a unified API. Normalize them deliberately into the repository's existing runtime validators. Do not pass arbitrary library content to a tool executor. An adapter must map a known playbook version into trusted steps with explicit input contracts and permissions.

Useful common production fields include `tenantId`, `snapshotId`, `goalId`, `evidenceIds`, `artifactHash`, `costPolicyId`, `approvalId`, `operationId`, and `calculationVersion`. The exact names should follow the existing repository. A missing field may require an evidence request, a draft-only path, or a blocked action, depending on its commercial consequence.

## Evaluation fixtures

Create cases for a capacity-limited agency, sparse-data local service, self-service SaaS with weak activation, Mac app with platform-specific eligibility, commerce with returns, and an AI-heavy subscription with usage outliers. Include contradictory prices, wrong-domain sources, no email audience, revoked permissions, duplicated webhook events, and unknown external action status.

Assess hard failures separately from strategy quality. Fabricated facts, material arithmetic errors, tenant leakage, budget violations, and unauthorized actions cannot be traded away for a better prose score. Compare the current engine with each proposed change using frozen evidence and consistent budgets. Report end-to-end live-research tests separately.

## Updating the corpus

Preserve stable frameworks while refreshing volatile policies. Update the source record, affected chapter, playbook, edition note, and hashes together. Record the source's publication date separately from retrieval time. If a page cannot be retrieved, retain the limitation and narrow the claim. Do not label an indexed excerpt as a full-page verification.

Regenerate the manifest and quality report with `python3 integration/validate_library.py`. This checks corpus structure and parseability. It does not prove a policy remains current or that the application implements the guidance. Those require source review and repository-specific tests.
