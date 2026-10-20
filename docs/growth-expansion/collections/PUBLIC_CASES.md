# Public cases and failure evidence

Six directly inspected first-party reports. These are source-reported cases, not independently verified performance claims or a representative success-rate sample. Exact reported context, intervention, outcome, dates, and limitations are recorded in [public_cases.json](public_cases.json). Three include negative outcomes; one reports a null difference. A later revision in a case can work even when its first version failed.

## How to use cases in the engine

Retrieve a case because its mechanism, constraints, or failure mode resembles the decision. Do not copy its numerical effect into a forecast. Before transfer, compare customer task, starting conditions, business model, traffic, measurement, execution capacity, and observation horizon. A company publishing a success is a selected observation. Company-authored failures are also selected and incomplete.

## CASE-01 — Bing sitelinks: revenue gain with an initial guardrail failure

[First-party report](https://blogs.bing.com/search-quality-insights/2013/8/Large-Scale-Experimentation-at-Bing/). Published 2013-08-08; read October 20, 2026. Classification: `negative_guardrail_then_revised_positive`. Evidence design: `source_reported_randomized_experiment`.

**Original ClimbOS application:** Require a commercial outcome plus customer-experience guardrails. If one fails, preserve the mechanism hypothesis, inspect the cause, and test a revised design rather than shipping from revenue alone.

**Transfer check:** Company-authored retrospective, not independently reanalyzed. Raw data, uncertainty intervals, exact sample and complete guardrail definitions unavailable here. Search-ad geometry and population do not establish results for a small SaaS landing page.

## CASE-02 — Power Automate: easier entry did not establish downstream success

[First-party report](https://www.microsoft.com/en-us/research/articles/experimentation-and-the-north-star-metric/). Published 2023-09-05; read October 20, 2026. Classification: `negative_downstream_outcome`. Evidence design: `source_reported_randomized_experiment`.

**Original ClimbOS application:** Track the same eligible cohort through recommendation acceptance, completed setup, executed task, and useful outcome. Do not optimize ClimbOS for owners clicking Generate or approving drafts while execution quality falls.

**Transfer check:** Actual data are redacted and funnel description is historical. Conditional funnel rates require care; the report is not a complete reusable dataset. Saving is itself a proxy, not proof of realized workflow value or revenue.

## CASE-03 — Buffer native versus third-party posting: a reported null difference

[First-party report](https://buffer.com/resources/3rd-party-social-media-tools/). Published 2018-01-09; read October 20, 2026. Classification: `reported_null_difference`. Evidence design: `limited_field_comparison_not_equivalence_proof`.

**Original ClimbOS application:** Treat publishing-method penalties as a testable hypothesis. Verify current technical eligibility separately, then compare suitable content and business outcomes; do not encode a universal platform penalty or universal equivalence.

**Transfer check:** Vendor has a commercial interest in third-party publishing. Content was not identical; schedule execution had misses. Small per-platform samples and no equivalence margin established here. Historical results do not certify October 2026 algorithms or every tool.

## CASE-04 — Buffer content refresh month: an informative observational trade-off

[First-party report](https://buffer.com/resources/blog-strategies/). Published 2015-08-11; read October 20, 2026. Classification: `mixed_observational_result`. Evidence design: `before_after_observation`.

**Original ClimbOS application:** Compare create, update, redistribute, and retire options for existing assets. Require inventory and workload evidence, channel-specific effects, and downstream outcomes before treating reduced publishing as a repeatable strategy.

**Transfer check:** No randomized counterfactual. Multiple interventions and possible seasonality. Existing content inventory was a major starting asset. Traffic changes do not establish incremental customers, contribution, or saved labor.

## CASE-05 — Buffer transparent feedback: an operating practice was reversed

[First-party report](https://buffer.com/resources/transparent-feedback-experiment/). Published 2015-08-17; read October 20, 2026. Classification: `reported_operational_failure`. Evidence design: `qualitative_first_party_retrospective`.

**Original ClimbOS application:** Design correction channels around psychological and practical access. Offer private owner correction and permissioned research channels; do not assume every observation should be shared across a tenant or across customers.

**Transfer check:** A participant narrative without a controlled comparison. No quantified productivity or commercial effect established. Not evidence that transparency fails in general. Employee-feedback setting differs from customer research.

## CASE-06 — Etsy interleaving: validate a faster measurement method before trusting it

[First-party report](https://www.etsy.com/codeascraft/faster-ml-experimentation-at-etsy-with-interleaving). Published 2022-08-08; read October 20, 2026. Classification: `measurement_validation`. Evidence design: `source_reported_production_validation`.

**Original ClimbOS application:** Before trusting a new retrieval ranking or evaluator, test identical alternatives, bias, and latency. Use paired ranking comparisons only for eligible ranking tasks, and retain separate end-to-end business-quality evaluation.

**Transfer check:** Method is suited to ordered result sets, not arbitrary interface changes. Preference measurement does not replace every business-outcome experiment. Published speed improvements are not adopted as ClimbOS forecasts. Engineering report, not an independently replicated study.

## Store negative learning precisely

Use distinct statuses for a rejected mechanism, ineffective implementation, invalid measurement, inadequate sample, incomplete execution, and a pending outcome window. A failed validation does not prove the underlying idea is worthless. A null finding does not prove equivalence. A positive leading metric does not establish a positive customer or economic outcome.

A future tenant-specific case should preserve the original prediction, exposure, eligible population, actual implementation, observed outcome window, costs, and counterevidence. Permit an owner to correct it. Never transfer private customer material into a shared case library without the required rights and aggregation controls.
