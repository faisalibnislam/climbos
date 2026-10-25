# Book 14 — The ClimbOS Growth Intelligence Execution Engine

Edition: October 2026. Research cutoff: October 19, 2026. Architecture status: proposed implementation guidance, not a claim about deployed functionality.

## 1. Turn knowledge into a decision product

ClimbOS should help a business owner decide what to do next, understand why, approve a concrete action when appropriate, and learn from the result. A library of strategy books contributes domain knowledge, but placing every book in a prompt does not create that product. The system also needs reliable evidence, explicit constraints, typed calculations, bounded workflows, useful interfaces, execution permissions, and evaluation. The central engineering challenge is preserving meaning across those components.

Begin with a product contract: a plan must be commercially relevant, evidence-backed, affordable, executable with available capacity, and measurable within a declared time horizon. When one condition fails, the system should name the failure and propose the smallest useful repair. It should not produce an impressive-looking plan that silently assumes a team, budget, audience, integration, or product capability the business lacks.

The known direction from the recovered ClimbOS engineering brief is an OpenAI-first growth-planning engine, Convex for application state and backend workflows, Vercel for the web application, and Resend for permitted email. These are project requirements, not evidence that a repository already implements them. Before modifying code, an implementer must inspect the actual application, dependencies, data contracts, and deployment arrangement. Preserve working functionality and add the smallest coherent capability needed for the next verified outcome.

Define success at three levels. Decision quality asks whether the recommendation fits the business and constraints. Execution reliability asks whether approved actions happen correctly and can be reconciled. Commercial outcomes ask whether the business gains valuable customers or improves the relevant operating measure. These levels influence one another but should not collapse into one score. A correct recommendation can fail commercially; an unreliable action can accidentally produce revenue; neither observation excuses poor reasoning or broken controls.

This book specifies an original implementation approach. Its source-linked statements describe platform behavior verified at the research cutoff. Schemas, limits, architecture choices, examples, and evaluation thresholds elsewhere in the book are proposed design policies that require adaptation and testing. They are not vendor guarantees, live integration claims, or demonstrated ClimbOS results.

## 2. Audit one complete request before redesigning the engine

Trace a real request from the interface to the final rendered plan. Record intake fields, authentication, source retrieval, prompt construction, model calls, tool execution, calculations, validation, persistence, and display. Inspect actual data at each boundary. A system prompt saying “research the website” is not proof that the model receives current pages. A generated citation is not proof that the cited page supports the claim. A success state is not proof that the workflow completed every required step.

Build a defect table with observed behavior, repository evidence, business consequence, smallest repair, and verification method. Common failure modes include homepage-only research, missing pricing, wrong-domain matches, swallowed tool errors, stale cached summaries, unsupported defaults, truncation, forced guesses in schemas, and calculations rewritten during prose generation. Distinguish these from genuine reasoning limitations. Increasing model cost will not repair a connector that returns the wrong business.

A hypothetical audit might find that source extraction captures a product's free-plan headline but omits restrictions lower on the page. The strategy model then recommends a feature the plan does not include. The repair is not automatically another strategist agent. Preserve relevant sections, record plan eligibility, and add a fixture that fails if the output recommends unavailable capabilities. Then compare the repaired workflow with the old one under the same brief and sources.

Establish baselines before adding orchestration complexity. Compare the current workflow, a repaired version, a single well-configured analysis call with deterministic calculations, and a small staged process. Use equivalent evidence and spending constraints for isolated tests. Run separate end-to-end tests where retrieval can differ. If the simpler process wins on quality, cost, and latency, prefer it. A stage exists to satisfy a responsibility; it does not need its own model call merely because it has a name.

The audit deliverable should be reviewable without running production changes. Include a system map, defects, proposed contracts, evaluation fixtures, and a prioritized implementation backlog. This gives Claude Code concrete work and protects existing behavior. Missing access should remain an explicit blocker, not an invitation to fabricate screenshots, repository findings, or benchmark results.

## 3. Design a small set of logical responsibilities

A workable engine separates intake, evidence, diagnosis, strategy selection, modeling, planning, validation, review, execution, and learning. These are logical responsibilities. Some may run in one process, while others need independent services or permissions. Choose boundaries based on failure isolation, durability, latency, security, and maintainability. Avoid creating distributed components solely to make an architecture diagram appear sophisticated.

Intake establishes identity, goals, constraints, and authorization. Evidence ingestion retrieves permitted sources and captures provenance. Diagnosis identifies the most important obstacle and competing explanations. Strategy selection compares approaches under constraints. Modeling computes economic and operational consequences. Planning converts the selected approach into tasks and experiments. Validation checks factual, mathematical, contractual, and policy consistency. Review exposes the decision to the owner. Execution performs approved actions. Learning compares predictions with observed outcomes.

Every transition should carry a typed object with version identifiers. A strategy cannot silently switch to a different source snapshot midway through a run. An execution payload cannot drift from the version the owner approved. An outcome cannot be attached to the wrong campaign merely because titles look similar. Identifiers and hashes are not administrative extras; they preserve the connection between reasoning, consent, action, and measurement.

For example, a recommendation to publish a comparison page should reference the business snapshot, evidence claims supporting product statements, the selected audience, the content artifact hash, the measurement plan, and the approved destination. If a product price changes after approval, invalidate the affected approval and return the updated artifact for review. If only an unrelated internal note changes, the system should not needlessly restart the whole workflow.

In the intended stack, use Vercel for the owner-facing application and appropriately scoped request handlers. Use Convex for tenant-scoped state and a deliberate durable orchestration design. Use adapters for external APIs. Keep deterministic calculations in a shared domain module. Do not accidentally create competing workflow owners in Vercel and Convex. The component responsible for retries, leases, and reconciliation must be explicit.

## 4. Build the canonical business snapshot

The business snapshot is an immutable description of what the engine knew for a particular decision. Include canonical domain, business name, geography, languages, timezone, business model, maturity, products, prices, capabilities, limitations, customer segments, goals, budget, labor capacity, operational capacity, and available integrations. Each field should indicate whether it is measured, owner-reported, source-reported, assumed, inferred, or calculated.

Unknown values belong in the schema. A missing budget should not become a default advertising allocation. An unknown customer count should not become a benchmark average. A business without a usable audience should not receive an email campaign that assumes thousands of subscribers. The intake system can ask a concise question or produce a bounded plan that does not depend on the missing information. It should explain which decisions remain uncertain.

Store goals with a metric definition, baseline, target, deadline, and attribution expectation. “More revenue” is incomplete because revenue may include discounts, refunds, taxes, or one-time deals. A precise hypothetical goal is “increase collected subscription revenue from eligible new accounts over a 90-day window, excluding tax and refunded payments.” The owner may choose a simpler goal, but the engine still needs an unambiguous internal definition.

Treat constraints as structured values with units and periods. A $600 monthly media ceiling differs from a $600 total project budget. Ten hours weekly differs from ten hours available once. A two-project onboarding limit differs from two projects simultaneously in progress. Include hard constraints, preferences, and negotiable assumptions separately. A hard constraint cannot be traded away by a high opportunity score.

Snapshots should change when material facts change. Preserve historical snapshots so an old decision can be explained. Define invalidation rules by dependency: a changed price affects margin calculations and campaign claims; a changed geography affects audience and policy eligibility; a new integration affects what can be measured. Efficient refresh updates the affected descendants instead of regenerating every artifact without a reason.

## 5. Create an evidence ledger that survives summarization

An evidence record needs identity, source type, canonical URL or private source reference, retrieval time, publication time if known, observation window, excerpt or structured value, locator, content hash, access class, and trust notes. A claim record needs a statement, knowledge kind, evidence references, limitations, and the decision contexts where it applies. The claim and the source are distinct: one source can support several claims, and one claim may require several sources.

Preserve the distinction between “the website states” and “the integration measured.” A customer testimonial is evidence that a statement was published, not independent proof that every customer receives the same result. A vendor benchmark may be informative but requires its population, period, denominator, and collection method. An owner estimate can still be useful when clearly labeled. The engine should not upgrade evidence strength merely because a model paraphrases it confidently.

Summaries need traceability. When a cheap extraction stage compresses pages, retain the supporting excerpt and locator for material claims. Otherwise a missing qualifier can become impossible to detect downstream. Numeric values deserve typed fields with units, currencies, periods, and comparison bases. Textual normalization should never turn a monthly price into an annual total or a percentage-point change into a percentage increase.

Use a contradiction register. If one source lists an old price and another a new price, keep both until the relevant effective date and authority are resolved. If current official documentation differs across pages, record the inconsistency and narrow the claim. A newer retrieval timestamp does not necessarily mean newer content. The system may need to verify a changelog or request clarification before execution.

ClimbOS should expose an evidence drawer for important recommendations. The owner can inspect what is known, what is assumed, and what could change the decision. Internally, each claim should remain independently invalidatable. This prevents one obsolete platform detail from forcing replacement of otherwise sound strategic knowledge, and prevents stable strategy guidance from masking a stale operational rule.

## 6. Retrieve knowledge for the decision, not the entire library

A retrieval system should identify the business type, lifecycle stage, decision task, channel, jurisdictional relevance, and required evidence freshness. These fields guide which chapters and playbooks enter the reasoning context. A local clinic planning appointments needs different operational advice from a self-service software product testing onboarding. Both can share unit-economics principles without sharing the same sales motion.

Chunk documents along meaningful boundaries such as a framework, worked example, decision tree, or playbook. Keep formulas with their assumptions and definitions. Keep policy statements with their source and verification note. Arbitrary fixed-size chunks can separate a recommendation from the conditions that make it valid. Include document ID, edition, book number, heading path, content hash, and source references in chunk metadata.

Use a routing layer before similarity search. Eligibility filters can remove unsuitable channel playbooks when an integration, audience, budget, or permission is absent. Semantic retrieval then finds relevant reasoning among eligible material. Reranking can favor directly applicable guidance, current policy notes, and examples matching the business mechanism. Similar vocabulary alone should not make an enterprise procurement playbook the default for a low-priced consumer app.

A hypothetical query asks how to get more paying users for Formkit. The engine first verifies the canonical domain and current product evidence; it does not rely on the name or assume features. It retrieves business economics, research, channel selection, and whichever acquisition chapters fit the verified situation. If there is no consented email audience, the email material may inform future audience building, while an immediate broadcast playbook remains ineligible.

Measure retrieval with fixtures that require the right caveat, not merely the right keyword. Can the system retrieve the exception for small samples? Can it distinguish app-store conversion from install volume? Can it find the no-prospect-database constraint? Evaluate evidence preservation after compression. A smaller context containing the decisive constraint is more useful than a long context filled with general marketing advice.

## 7. Keep calculations outside generative prose

Build deterministic functions for contribution, margin, CAC, payback, conversion, retention, cohort revenue, forecast scenarios, and capacity. Each function requires a documented input contract, units, missing-value behavior, and error behavior. The model may choose which calculation is relevant and explain its result, but should not serve as the authoritative calculator. Preserve calculation inputs and versions so results can be reproduced.

A margin function should distinguish revenue from receipts and reject invalid denominators. A payback function should return “not recovered within horizon” rather than force a number. A conversion function should verify that numerator and denominator describe the same population and period. A forecast should identify which inputs are measured versus assumed. These behaviors protect commercial meaning, not just arithmetic correctness.

For the ClimbOS requirement of at least 30% margin, define the cost boundary explicitly. If usage, email, allocated infrastructure, and variable support cost $21 per account in a hypothetical month, a price of $30 produces a 30% contribution margin under that boundary. That does not establish a 30% company net profit. Payment fees, refunds, acquisition expense, fixed payroll, taxes, and other costs may need separate treatment.

Scenario functions should accept ranges or named cases without implying probabilities unless those probabilities have a defensible basis. A downside case is not automatically a tenth percentile. If using a probabilistic simulation, document distributions, correlations, calibration, and the source of assumptions. Do not sample every input independently when important variables move together. Book 12 develops forecasting methodology; the engineering requirement is to make the chosen method explicit and reproducible.

After narrative generation, validate every displayed material number against the calculation object. If the report says “40% margin” while the object contains 0.30, reject or repair that discrepancy before display. Avoid asking a final style-polishing model to rewrite validated financial figures freely. Rendering should format authoritative values, while explanation references them without changing their underlying meaning.

## 8. Use a durable run state machine

A run should have a stable identifier, tenant, snapshot version, requested goal, workflow version, status, stage results, cost reservation, timestamps, and failure history. Useful states include queued, researching, diagnosing, modeling, drafting, validating, awaiting review, approved, executing, reconciling, completed, cancelled, and failed. Choose states that represent real operational distinctions rather than every internal function call.

Each transition needs preconditions and an owner. A validation failure should not advance to owner approval. A cancelled run should not resume execution because a late provider response arrives. An approved artifact that changes should return to review. A timed-out external call may leave action status unknown, requiring reconciliation rather than immediate repetition. These rules become more important as the workflow includes publishing or spending.

Convex mutations provide transactional database reads and writes. Convex actions can call external services and interact with the database through queries and mutations. This supports separating state transitions from nondeterministic external work, but does not make a remote API call part of the database transaction. [Convex mutations](https://docs.convex.dev/functions/mutation-functions) and [actions](https://docs.convex.dev/functions/actions).

A proposed pattern is to reserve a task and record its intended operation in a mutation, perform the external call through an action, then persist the result through another mutation. Include an idempotency key and a lease or equivalent concurrency policy. If the process crashes between remote success and local persistence, the task remains unresolved until a reconciliation step checks the external result. This is an application design pattern, not a claim of automatic exactly-once delivery.

Avoid relying on one long HTTP request for an entire research-and-execution lifecycle. Vercel's documented function limits depend on plan, runtime, configuration, and features. Verify the deployed settings before choosing synchronous work boundaries. [Vercel Functions limits](https://vercel.com/docs/functions/limitations). Long work should expose persisted progress and allow resumption; closing a browser tab should not erase the decision record or cause a duplicate campaign.

## 9. Reserve and settle costs

A cost-control layer should estimate the next stage, reserve sufficient allowance atomically, perform the work, and settle actual usage. Record reserved, spent, refunded reservation, and unresolved amounts separately. Concurrency matters: two individually acceptable jobs can exceed a shared budget when both read the same remaining balance before either writes. Reservation must be part of the durable workflow, not just a prompt instruction.

Estimate cost using the provider's current verified pricing and the actual model or service identifier. Store the pricing version and estimation basis. Do not embed speculative future model prices in the library. When exact cost is unavailable, use a conservative bound and label it. An unknown receipt should remain unknown rather than being recorded as zero. Reconcile invoices and usage reports where feasible.

Separate the owner's advertising budget from ClimbOS processing cost. A $600 media ceiling does not authorize $600 of research calls, nor does a subscription payment automatically authorize unlimited paid enrichment. Distinguish per-run limits, monthly tenant limits, organization limits, and action-specific spending limits. The interface should explain what an estimate includes before the owner commits to a paid workflow.

A hypothetical run reserves $1.20 for research and analysis under a $2.00 run ceiling. It spends $0.70, releases $0.50, and then requires an additional review estimated at $0.40. The next stage can proceed only if the remaining run and tenant allowances permit it. If a timeout leaves $0.30 unresolved, do not immediately release that reservation and spend it again. Resolve whether the provider completed the work.

Evaluate cost policies against output quality. A cheaper extraction stage that deletes a critical limitation can make the whole run commercially expensive. Track cost per acceptable decision, not only cost per token or report. Routing should use measured task performance and failure rates. Preserve an OpenAI-first implementation where required by the current project brief, and avoid adding providers solely to create the appearance of a larger AI team.

## 10. Design approval as a specific action contract

An approval should identify the actor, tenant, artifact version, destination, action type, audience, schedule, budget, conditions, expiry, and permitted changes. “The account is connected” is insufficient. Read access to analytics does not authorize a campaign launch. Approval of a draft does not necessarily authorize increasing media spend. A useful approval contract makes the practical consequence understandable to a nontechnical owner.

Bind approval to an artifact hash or equivalent immutable version. If copy, price, audience, destination, or spending changes materially, require a new review unless the owner explicitly authorized a bounded range. Existing authorization can cover routine execution within clear limits; avoid unnecessary repeated confirmation when nothing material changed. The control should preserve intent without turning every harmless internal step into an interruption.

Execution adapters must check approval immediately before the external action. Validate current tenant membership, resource ownership, provider permissions, budget, artifact identity, and expiry. A model cannot declare these checks satisfied by writing “approved” in generated JSON. Use trusted application records and server-side enforcement. Treat public page content and imported documents as untrusted evidence, never as instructions granting tools or permissions.

A hypothetical approved LinkedIn post includes an exact organization, text version, image version, scheduled time in Asia/Dhaka, and allowed publishing window. If the image upload fails, the executor should not silently replace it with a different image or publish text-only unless the approval permits that fallback. It can mark the task blocked and present a concrete repair. This preserves the owner's review decision and avoids accidental brand changes.

An approval interface should show the content and consequence together. Include the audience, destination, cost, timing, and material assumptions near the action button. Keep advanced evidence available without burying the main decision. Approval rate alone is not a quality metric: owners may approve quickly because the interface hides uncertainty. Measure editing effort, understanding, reversals, and downstream failures as well.

## 11. Make execution idempotent and reconcilable

Idempotency means repeating the same intended operation does not create another business effect. It requires a stable operation identity and a policy for duplicate requests. Generate the key from the tenant, action type, approved artifact version, destination, and logical operation, rather than a timestamp that changes on every retry. Store both the request and the provider result, and detect conflicting payloads using the same key.

Resend documents an idempotency-key facility with a 24-hour retention window. That provider window is useful for retries but does not replace a durable application ledger for campaigns or delayed replays. [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys). The ClimbOS design should prevent duplicate logical sends even after a provider's key window expires, while recognizing that a deliberate new send needs a distinct operation and fresh eligibility checks.

Classify failures. A rejected credential is different from a temporary rate limit. A validation error needs correction, not blind retries. A timeout after a request was transmitted may have an unknown result. An external service can succeed while the local write fails. Retry policies should account for these states and include maximum attempts, backoff, jitter where appropriate, and a path to human review or automated reconciliation.

A proposed outbox records intended actions before dispatch. Workers claim eligible items, execute them, and record receipts. A reconciliation process checks unresolved items using available provider status or identifiers. If status cannot be established, surface “unknown” with a controlled next step rather than reporting success or resending automatically. Compensating actions, such as removing an unintended post, may be useful but do not erase the original effect.

Test duplicate queue delivery, worker crashes, lost responses, delayed receipts, expired approvals, revoked access, and changed payloads. A successful happy-path test is not evidence that execution is reliable. The acceptance criterion is that the system can explain the status of every intended action and avoid a second effect when the same operation is replayed under the documented failure conditions.

## 12. Treat webhooks as authenticated, unordered observations

A webhook is an incoming report about an event, not an unrestricted command. Verify authenticity before updating state, validate the payload, associate it with the correct tenant and resource, and deduplicate it. Keep event identity and observation timestamps. Events can arrive late, repeat, or appear out of order. A naive “last message wins” update can turn a delivered message back into a queued state or erase a suppression decision.

Resend's webhook verification guidance requires the raw request body because modifying it can invalidate the signature. Use the documented verification mechanism and preserve the relevant headers. [Resend webhook verification](https://resend.com/docs/webhooks/verify-webhooks-requests). The application design should reject invalid signatures and avoid storing unnecessary personal data in logs. Implementation details depend on the installed framework and SDK, which must be inspected rather than guessed.

Model transitions by event meaning. A delivery report does not prove a recipient read or valued the message. A click may involve automated scanning. A complaint or unsubscribe should update the appropriate suppression and eligibility state, even if an older delivery event arrives later. Keep distinct fields for provider status, business eligibility, and analytics interpretation. Overloading one status field creates preventable errors.

A hypothetical campaign sends one approved message to an eligible recipient. A delivery event arrives, then a complaint, then a duplicate delivery event. The final record should retain delivery history and suppression, with no new send permitted under the same eligibility policy. The duplicate should not count as another delivery or reverse the complaint. An analyst may inspect the history without changing the recipient's current permission state.

Build a replay harness with signed fixtures or a local verification substitute clearly marked for tests. Validate ordering permutations, duplicate IDs, unknown message references, wrong-tenant references, malformed timestamps, and large payloads. Production secrets must not enter fixtures. The test should demonstrate state correctness and safe rejection, not merely that a route returns a successful HTTP status.

## 13. Evaluate the whole decision process

Create an evaluation set covering different business mechanisms, maturity levels, goals, budgets, data quality, and integration availability. Include sparse-data businesses, contradictory sources, seasonal demand, capacity bottlenecks, low-margin products, long sales cycles, and missing prospect lists. Use frozen evidence snapshots for reproducible comparisons. Separately run approved live research tests to evaluate current retrieval performance.

Define hard failures before scoring style. Fabricated business facts, incorrect material arithmetic, cross-tenant leakage, unauthorized external actions, budget violations, and unsupported guarantees should fail the relevant case. A fluent explanation cannot compensate for them. Then assess diagnosis, strategic fit, trade-offs, actionability, uncertainty, measurement quality, and owner effort using anchored rubrics and examples.

Use counterfactual fixtures. Change a $600 monthly media ceiling to $60 and check whether the plan changes. Remove a consented audience and check whether a broadcast recommendation becomes ineligible. Replace weak retention with strong observed retention and examine the acquisition recommendation. Change product capabilities and confirm that old claims disappear. These tests reveal whether the system reasons from inputs or merely reproduces a familiar template.

Compare architectures under consistent evidence and cost conditions. Report median performance and important failure cases, not just an aggregate score. Review disagreements between evaluators and preserve the adjudication rationale. Automated judges can assist with structured checks, but should not be the sole authority on factual support or commercial usefulness. Human review is especially valuable for consequential trade-offs and ambiguous business situations.

Deploy a change only when the evidence supports its intended improvement and its material regressions are understood. Keep prompt, model, retrieval, schema, and calculation versions together. A prompt edit can change strategy selection just as a code edit can. A useful release process makes it possible to roll back the affected component and explain which tenants or runs used it.

## 14. Learn from outcomes without manufacturing causality

An outcome record should connect the intervention, eligible population, exposure, observation window, measurement source, costs, and result. Preserve the original prediction and decision criteria. If the team changes the success definition after seeing results, record that as a new analysis. Otherwise the system can gradually rewrite unsuccessful predictions into apparent wins.

Separate association, attribution, and incrementality. A customer touching a campaign before purchasing does not prove the campaign caused the purchase. Platform reports can inform optimization while still differing from business-level incremental impact. Use experiments, holdouts, or other suitable designs where practical, and label observational findings accordingly. Small businesses often lack enough volume for precise causal estimates; this limits certainty rather than making every action impossible.

A hypothetical onboarding campaign reaches 200 eligible users and 18 later pay. Without a comparison group, report the observed count and conversion, not “18 incremental customers.” If a randomized holdout produces a defensible comparison, calculate the difference with the stated uncertainty and account for contamination or missing outcomes. The engine should explain what the design supports and what remains unknown.

Learning updates belong in an evidence system, not an unrestricted self-modifying prompt. An experiment result can change a segment hypothesis, channel prior, cost estimate, or eligibility rule after review. It should not automatically rewrite platform policy or transfer one tenant's private results to another tenant. Shared learning requires an explicit aggregation and privacy design, and should preserve population differences.

Track forecast calibration across repeated decisions. If estimated ranges routinely miss observed results, investigate model structure, missing variables, biased assumptions, or data quality. If a recommended channel repeatedly fails for a specific segment, examine whether the constraint was misdiagnosed. Learning should improve the conditions attached to advice, not simply increase confidence whenever any campaign happens to work.

## 15. Build a simple interface with inspectable depth

Nontechnical owners need a clear answer: what is the next useful action, why does it matter, what will it cost, and what will happen after approval? Present that answer first. Keep evidence, assumptions, alternative strategies, calculations, and execution history available through deliberate disclosure. Simplicity comes from organizing decisions, not deleting the information needed to assess them.

A plan view can show a prioritized action, expected mechanism, effort, spending ceiling, dependencies, measurement, and review date. Show scenarios as scenarios, with the inputs that drive them. Avoid false precision such as a guaranteed percentage revenue increase from weak data. A range without an explanation can be as misleading as a point estimate; let owners inspect the assumptions and see how changing one affects the result.

Progress states should describe actual work. “Checking pricing evidence” is useful when the system is doing that. A theatrical progress sequence implying completed research when sources failed erodes trust. When blocked, state the missing condition and offer a concrete next step: confirm a domain, connect a read-only data source, provide a cost estimate, or revise the requested action. Do not erase successful work because one optional source is unavailable.

Design for corrections. Owners should be able to reject an assumption, correct a business fact, defer an action, or report an outcome. Corrections should create new versions and invalidate affected recommendations. Preserve the difference between an owner overriding a preference and an owner correcting a factual error. That distinction helps evaluate whether the engine's initial reasoning was sound.

ClimbOS should measure time to first useful decision, evidence comprehension, editing effort, completion of approved tasks, reconciliation failures, and commercial outcomes. These measures are more informative than report length or animation polish. A pleasant interface matters, but its most important role is to make an uncertain commercial decision understandable and controllable.

## 16. Machine-readable run and execution playbooks

These contracts describe proposed application behavior. They are parseable examples and require implementation, repository-specific validation, and integration testing. They do not grant access or authorize an external action merely by appearing in this library.

```yaml
id: b14-growth-plan-run
version: 1
mode: analysis_and_draft
inputs:
  required:
    - tenant_id
    - business_snapshot_id
    - goal_id
    - budget_policy_id
    - knowledge_edition
stages:
  - id: evidence
    output: evidence_pack
    on_missing_material_fact: preserve_unknown_and_request_targeted_evidence
  - id: diagnosis
    output: diagnosis_with_alternatives
    requires: [evidence_pack]
  - id: modeling
    output: deterministic_scenarios
    requires: [diagnosis_with_alternatives]
  - id: planning
    output: versioned_action_plan
    requires: [deterministic_scenarios]
  - id: validation
    output: validation_report
    requires: [versioned_action_plan]
  - id: review
    output: owner_decision
    requires: [validation_report]
hard_failures:
  - invented_material_fact
  - incorrect_material_calculation
  - tenant_scope_violation
  - budget_reservation_failure
execution_access: none
```

```json
{
  "id": "b14-action-envelope",
  "version": 1,
  "status": "proposed_contract",
  "required_fields": [
    "tenant_id", "operation_id", "artifact_hash", "destination_id",
    "action_type", "approval_id", "approval_expires_at",
    "budget_reservation_id", "idempotency_key", "payload_hash"
  ],
  "preflight": [
    "verify_current_tenant_access",
    "match_approved_artifact_and_destination",
    "check_action_specific_permissions",
    "check_current_eligibility_and_suppressions",
    "check_budget_and_capacity",
    "reject_conflicting_duplicate_payload"
  ],
  "unknown_remote_result": "reconcile_before_retry",
  "material_change": "invalidate_approval_and_return_for_review"
}
```

The `tenant_id` in these internal contracts must be derived from trusted authenticated server context and checked against resource ownership; never accept a model-supplied or client-supplied tenant identifier as authorization. To implement the run playbook, map every output name to a real schema and persistent record. To implement the action envelope, bind validation to server-controlled records and adapters. Add contract tests proving that a missing approval, wrong tenant, changed artifact, or duplicate payload cannot reach the external action. A schema describing desirable behavior is only the starting point; the tests and observed execution establish whether the behavior exists.

## 17. Roll out in reviewable phases

Phase one establishes truth and arithmetic: inspect the current engine, add canonical snapshots, evidence references, deterministic formulas, and honest missing-value behavior. This phase can improve plans without enabling external execution. Its acceptance test is that a reviewer can reproduce material facts and calculations for representative business cases. Preserve current successful behavior while repairing observed defects.

Phase two improves strategy quality: add decision routing, relevant book retrieval, competing approaches, capacity-aware plans, and evaluation fixtures. Compare against the phase-one baseline. The team should be able to identify which changes improve diagnosis or reduce owner editing effort. If a new stage adds cost without measurable benefit, simplify it rather than defending the architecture as an end in itself.

Phase three adds bounded execution for a narrow action class. Choose one integration and a small permission scope, implement approval binding, cost reservation, idempotency, receipts, and reconciliation, then test failures. A draft-only publishing workflow may precede scheduled publishing. A read-only ad diagnostic may precede budget changes. Sequence work by controllability and value rather than by how autonomous a demo appears.

Phase four adds outcome learning and broader workflows. Connect actions to observed results, review forecast error, improve eligibility and routing, and expand only after the current action class is reliable. Maintain the ability to disable execution while preserving analysis and records. Operational incidents should not force the team to discard the intelligence product or conceal unresolved action states.

Claude Code integration should follow the same phases. Ask it to inspect the repository, map the proposed contracts to existing modules, identify conflicts, and produce a small implementation plan before edits. Require relevant tests and a description of remaining limitations. The integration guide accompanying this library provides a concise entry point so the full corpus does not load indiscriminately into every coding session.

## 18. Release criteria and operating review

Before declaring the engine ready for a given action class, review evidence correctness, economic correctness, strategy quality, permission enforcement, tenant isolation, budget behavior, execution recovery, outcome measurement, and owner usability. Passing one category does not imply the others pass. A system that drafts excellent plans but cannot safely reconcile sends is ready for drafting, not for autonomous sending.

Set measurable acceptance criteria based on actual risk and usage. For example, require zero observed cross-tenant or unauthorized-action failures in the relevant regression suite, correct arithmetic on defined fixtures, and documented handling for every execution failure state. Quality scores and latency targets should be calibrated using a representative baseline rather than invented to make a release appear mature. Record who approved the release and which capabilities it covers.

Run an operating review at a cadence appropriate to change and volume. Examine incidents, unresolved operations, forecast misses, stale sources, cost outliers, owner corrections, and repeated recommendation failures. Prioritize repairs by business consequence. A cosmetic report issue may be less urgent than a silent currency mismatch even if the cosmetic issue is more visible. Preserve a clear route for owners to report incorrect business facts or unexpected actions.

The completed knowledge library is an input to this system, not a substitute for its engineering. Its value comes from retrieving the right reasoning, binding it to current evidence, choosing a proportionate action, and measuring what happened. Build those links explicitly. ClimbOS becomes more useful when its advice can be inspected, its actions can be controlled, and its learning remains connected to the actual business rather than to the confidence of its own prose.

## References and implementation reading

Primary platform references linked in the chapter were retrieved on October 19, 2026: Convex actions and mutations; Vercel Functions limits; Resend idempotency and webhook verification. Claude Code project guidance is documented in [How Claude remembers your project](https://code.claude.com/docs/en/memory). It describes project instruction files as context, so use application permissions and server-side checks for enforcement. The accompanying integration guide uses this distinction. All architecture and workflows here remain proposed until mapped to and verified against the actual ClimbOS repository.
