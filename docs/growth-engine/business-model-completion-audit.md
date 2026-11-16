# Business viability and pivot workflow: completion audit

Audited 17 November 2026 against the current checkout. This is one part of the 410-requirement completion audit, not a declaration that the product is complete. The original Downloads prompt was not present at its referenced path; the retained numbered requirement inventory and `docs/ClimbOS-Complete-Product-Specification.md` section 4 supplied the acceptance scope.

## Requirements and verdict

| Requirement | Current evidence | Completion verdict |
|---|---|---|
| 2: question business viability | Owner-started business-model check, deterministic first-party signals, model verdict with confidence/limits, deciding test and owner review | Workflow implemented and locally exercised. Accuracy across real businesses and actual viability remain unproven. |
| 9: recognize potentially outdated models | Dated market signals, existing-model description, exactly one grounded/adjacent/bold alternative, original tests and historical reports in future context | Workflow implemented. Detecting real market obsolescence is model judgment, not a deterministic finding or established outcome. |
| 10: distinguish facts and assumptions, as applied to this check | Structured basis labels, citations, unknown economics, first-party calculation labels, source validation, historical-context freshness | Partial: structural/source-membership checks are enforced for new v2 results; semantics, actual economic source support and truth of model-selected evidence labels are not independently established. This audit does not close requirement 10 across the whole application. |
| Protected bold strategy | No matching precedent required; low feasibility/evidence does not remove the bold alternative; separate novelty, evidence, fit, feasibility and risk | Structural preservation covered by tests. Originality and usefulness require held-out real-model evaluation. |
| No consequential side effects | Owner start is metered; result/test mutations retain org permissions and audit history; no price, send, publish or spending authority is granted by a verdict or adoption preference | Scoped tests pass. No external provider action was exercised. |

## Traced path and existing behavior

1. **Start and cost:** `convex/businessModel.ts` exposes estimate/start, requires edit access, checks active runs, reserves the existing job budget and schedules `internal.jobs.businessModelCheck`. The page shows a maximum cost before owner start.
2. **Business inputs:** `convex/jobWrites.ts` loads the workspace/business, confirmed facts, brand, goal, bounded imported payments, owner-entered CRM outcomes and monitored competitor changes. `convex/lib/businessModelEvidence.ts` hashes the same evidence groups used by owner review.
3. **Deterministic signals:** `shared/agents/businessModel.ts` computes comparable same-currency 90-day revenue change when record coverage allows it, repeat purchase, pipeline win/loss summaries and coverage caveats. Direction thresholds are explicitly heuristics; missing data is not decline. Future recorded payments/closes are excluded by the existing paths.
4. **Research and proposal:** `convex/jobs.ts` builds the existing business brief, first-party signals and bounded research request. `shared/agents/specs.ts` supplies the business-model schema, skill routing and retrieved precedent references. A changed snapshot prevents a resumed run from combining incompatible inputs. No new agent/provider was added.
5. **Review:** `shared/agents/runtime.ts` critiques/revises within the existing budget. It intentionally can return its best draft even with unresolved lint errors. That is useful intermediate work, but was not a sufficient result acceptance boundary.
6. **Persistence (repaired):** the job now parses the returned structure and, for real v2 runs, reruns the same spec lint through `lintAgentOutput` using the actual retained research record before marking the result verified. Invalid results fail and cannot become the latest recommendation or strategy context. Intermediate metering/checkpoints are retained; this is not a free retry or an automatic new run.
7. **Owner review:** `businessModel.latest` returns a saved result, input freshness, original alternatives and latest reports. The page uses `BusinessModelCheckView` and `BusinessModelTestHistory`. It now separately exposes the newest failed attempt instead of reverting to “No business model check yet.” An earlier valid report remains available and is explicitly described as earlier.
8. **Outcome and learning:** `recordTest` binds an append-only report to its tenant, original run and test; supports met/missed/unclear/not-run and stale-form protection. `convex/lib/businessModelTests.ts` carries the latest reports for the original tests from a bounded set of checks. `jobWrites` supplies these records and the latest suitable verdict to subsequent strategy/check context. Owner reports and adoption preferences are not causal proof or execution authority.

## Confirmed defects closed

- A nominally passing AI assessment could allow invalid source/fact references, duplicate alternative modes, a number labeled unknown, or a malformed result to finish as verified. Seven initial failing job-boundary tests reproduced this before changes.
- Source normalization incorrectly treated case-sensitive paths/query values, HTTP/HTTPS, www hosts and trailing-slash paths as interchangeable. The validator now preserves those distinctions; URL host casing and same-page fragments remain equivalent.
- A date such as 2026-02-30 passed the previous shape-only date check. Real calendar validation now rejects impossible/empty/malformed dates; undated evidence remains allowed with an explicit limitation.
- A failed attempt disappeared from the dedicated page without an explanation. Its scoped failure message now accompanies any earlier valid report, and a newer successful attempt clears it.

## Verification and limits

See the latest entry in `docs/Verification.md` for exact commands and results. New tests stub only the agent boundary, exercising the actual job, queries and next-plan context without network/model costs. They deliberately return a positive AI review with invalid output; valid, explicitly undated, and bold/no-precedent outputs remain accepted. Tests also cover tenant isolation, preservation of an earlier report, and absence of artifacts, approvals, execution receipts or test outcomes as side effects.

No historical report migration or source revalidation was performed. The schema remains compatible with saved reports. The new final evidence guard applies to real v2 checks; legacy fixture paths receive structure validation only. URL/date validity does not prove source truth, publication date support, customer representativeness, willingness to pay, or commercial effectiveness. Unit-economics fields here are labeled inputs, not a new deterministic business-model comparison calculator. No paid evaluation, browser pass, deployment, live pricing change or publishing occurred in this batch.

## Next acceptance work

Continue the current requirement audit across diagnosis, customer/segment fit, competitor comparison, pricing, maturity and capacity (rows 1, 3–8), following the actual default plan path. Do not mark these complete merely because the dedicated business-model workflow exists. Preserve the rest of the 410 requirements and the later owner specifications; this document narrows only the evidence inspected in this batch, not the overall goal.
