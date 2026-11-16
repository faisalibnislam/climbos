# Growth-plan diagnosis and prioritization: completion audit

17 November 2026. This continues the 410-item audit after the business-model acceptance review. Reference scope: numbered rows 1–10 in `improvement-requirement-audit.md`, section 4 of the complete product specification, and relevant sections of growth-intelligence Books 01 and 14. Reference books are not evidence that runtime features exist.

## Requirement reconciliation

| Row | Requirement | Current implementation inspected | What is not yet proven |
|---|---|---|---|
| 1 | Do not treat the existing website as unquestioned truth | Research prompt separates website claims, commercial evidence and quoted site findings; `lintInsightSources` checks commercial references and rejects own-site claims as independent demand evidence. Main plans receive existing research plus confirmed facts. | Complete rendered-site judgment, independent market validity and actual correctness of model interpretation are not established by source checks. |
| 2 | Assess business viability | Dedicated current-model check and first-party signals, saved judgment and alternative tests; see `business-model-completion-audit.md`. Main-plan demand concerns use commercial assessment, current model judgment and owner-reported no-customer/pre-launch state. | Broad real-business viability accuracy remains unproven. A model judgment is not independently measured demand. |
| 3 | Identify the growth constraint | `strategyDiagnosis` in `convex/jobs.ts` feeds `diagnose` with owner funnel, churn, remaining capacity, goal pace and buying-cycle assumptions. The same calculation reaches starter/focused/detailed input. Focused persistence retains `constraintDiagnosis`. `diagnosis.ts` preserves conflicts, sparse samples, competing explanations and next measurement. | The observation is not a causal finding. General semantic alignment of every focused recommendation to the supported constraint is not deterministically established; the detailed play fit checker is not a complete business-reasoning evaluator. |
| 4 | Challenge the target audience | Insights retain evidence-labeled needs, objections, buying motivations and channel preferences; business-model segment fit has separate dimensions; focused plans retain proposed audiences and evidence. | General wrong-segment detection, representative research and segment-level outcome calibration remain unproven. A stored audience profile does not establish product-market fit. |
| 5 | Evaluate competitors | Insights perform independent competitor research and retain direct/adjacent alternatives, sourced comparisons and optional battlecards. Saved source-labeled research and monitored changes reach the main plan. | Source membership does not prove fair comparisons, customer preference, comprehensive market coverage or a competitive advantage. No fresh external research was run in this batch. |
| 6 | Challenge weak pricing | `offerAssessment.ts` compares promotion/non-price mechanisms and positioning/conversion/retention/capacity/no-change alternatives. It calculates contribution and break-even from supplied prices/costs, leaving missing cost categories unknown. Focused plans reuse that optional assessment and public-copy consistency checks. | Price elasticity, optimal pricing and causal response to an offer are not established. The assessment is relevant only when an offer decision is actually proposed. |
| 7 | Understand business maturity | `orgs.ts` stores owner-reported stages with provenance and audit; `lifecycle.ts` supplies distinct guidance for validation, launch, traction, growth, maturity and possible decline. Unknown stage is explicit. Main-plan constraints preserve demand concerns. | Stage is an owner report, not independent performance evidence. The paid-first gap described below is now repaired; broad stage-appropriate recommendation quality still needs evaluation. |
| 8 | Consider business capacity | Owner inputs include remaining customer capacity and weekly growth time. Zero remaining customer capacity becomes a supported delivery constraint. Detailed forecast checks and offer/timing checks compare available inputs; unknowns remain explicit. | All operational resource types and every natural-language task are not comprehensively modeled. Focused plans do not invent portfolio forecasts simply to calculate a limit. |
| 9 | Recognize outdated business models | See the dedicated business-model audit and original-test learning path. | Detection accuracy and pivot effectiveness remain unproven. |
| 10 | Separate facts from assumptions | Typed fact/source classes, date/context snapshots, deterministic calculations and unknown values are used by these paths; offer/timing basis checks also reach focused plans. | Label correctness and semantic source support are not universally guaranteed. No complete evidence-truth classifier or causal validation is claimed. |

All ten broad requirements remain partial at the requested product scope. This table identifies real implementation and residual acceptance work; it does not replace the other 400 requirements or later owner specifications.

## Representative current path

Owner business/stage/funnel/economics and goal → tenant-scoped `jobWrites.jobContext` plus stored/retrieved research → `jobs.strategyDiagnosis` and `constraintsOf` → starter/focused strategy spec and existing writer/reviewer loop → quality state and `jobWrites.saveStrategy` → owner plan review, including diagnosis/offer panels → `workspace.decidePlan`/`startPlay` quality, freshness and approval boundaries → original experiment reports and learning for subsequent plans.

The detailed route additionally builds scored channel candidates and play economics. A focused plan is a different output contract, not an empty detailed forecast. Its channels are sorted by ascending priority on persistence. Strategic grounded/adjacent/bold exploration remains distinct from immediate spend or execution.

## Confirmed gaps repaired

1. `lintDemandGate` existed for detailed plays but was absent from starter/focused lint. An explicit monthly ad allocation could therefore lead a focused plan even when its input said demand was not validated.
2. `demand_gate` was not in `HARD_RULES`; a deterministic error alone could be reduced to a non-blocking quality state. A failing unit regression demonstrated `planQuality` returning passed for this error.

Focused plans now reuse the same demand policy through their channel contract. The smallest priority value denotes the leading recommendation; all ties are treated as primary, and input array order cannot turn a primary paid channel into a supporting test. Primary explicit positive ad spend with a supplied demand concern is a hard failure. Supporting paid spend retains the existing review warning and is not removed. New quality states carry an owner-readable reason and fix; normal approval/start controls refuse the failed plan. Grounded/adjacent/bold ideas remain visible and unchanged.

## Evidence and remaining limits

The initial unit run failed three new cases for the missing focused/starter checks and hard quality gate. Actual workflow tests use the existing model-turn fake with the real writer/reviewer, saved plan and permission path. A pre-launch owner report plus an ad budget large enough for the proposed spend isolates demand from budget failure. Both starter and focused attempts retain bold options but fail quality and cannot be approved or started. A supporting paid test remains in the saved channel list and its warning reaches review. No external action or approved execution is produced by recommendation generation.

Exact test commands/results are recorded in the newest `docs/Verification.md` entry. No schema, UI component, provider, agent or campaign-timing prompt was added or replaced. No paid model evaluation, browser check, external spend or deployment occurred. Historical saved quality states were not migrated; regenerate older plans before treating them as having passed these new checks. This guard uses explicit suggested ad spend and supplied demand concerns; it is not a semantic detector for every possible paid tactic or a claim that absence of a concern validates demand.

## Next reconciliation work

Continue with owner understanding and progressive disclosure (rows 11–20), then remaining evidence/intelligence requirements. Carry forward the unresolved recommendation-alignment and real-model quality work above; do not silently mark it complete or suppress ambitious strategy to make narrow tests pass.
