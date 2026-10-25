---
book: 7
title: App Store Optimization and App Discovery
library: ClimbOS Growth Intelligence Library
research_cutoff: 2026-10-19
status: complete
---

# Book 07 — App Store Optimization and App Discovery

## 1. Optimize for suitable users

App store optimization connects a person's need with an app that can satisfy it. Discovery matters, but downloads are only the beginning. A listing that attracts unsuitable users can increase installation totals while producing poor activation, early abandonment, refunds, and support demand. The commercial objective is sustainable acquisition of people who understand the promise and can experience its value.

Use a complete chain: relevant exposure, understandable promise, installation, successful first use, retained value, and appropriate monetization. Different teams own parts of that chain, but the customer experiences one product. A screenshot promising instant results creates an onboarding obligation. A subtitle promising privacy creates an engineering and disclosure obligation. ASO therefore belongs in product strategy, not only in metadata editing.

For ClimbOS, the central question is which constraint currently limits suitable-user growth. An unknown app may need discovery. A visible app with weak downloads may need a clearer listing. A frequently downloaded app with poor first use may need product repair. A well-loved app with unattractive margins may need pricing or delivery changes. The system should identify that constraint before generating a keyword list.

All examples and numerical scenarios below are hypothetical unless linked to a source. They do not describe measured performance of Faisal's apps, Formkit, or ClimbOS.

## 2. Platform differences are implementation requirements

Do not treat Apple App Store, Mac App Store, Google Play, and direct software distribution as one interchangeable channel. They have different fields, discovery surfaces, reporting, eligibility, commercial rules, and review processes. Store-specific capabilities should be discovered and recorded before a recommendation becomes an execution plan.

Apple's current product page guidance lists a 30-character app name and subtitle, up to ten screenshots, and up to three app previews. Its native product page optimization documentation specifically describes iOS and iPadOS testing. Do not assume that a Mac App Store app receives the same testing capability. [Apple product page guidance](https://developer.apple.com/app-store/product-page/); [Product page optimization overview](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/).

Google Play's metadata policy sets a 30-character title limit and prohibits misleading or irrelevant metadata. Its experimentation surface differs from Apple's. [Google Play metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842?hl=en).

Create a capability record containing store, platform, app identifier, supported territories, locales, available experiment types, authorized roles, and observed reporting routes. Mark unknowns explicitly. A direct-download Mac app may benefit from website SEO and a stronger installation path, but those tasks are not App Store metadata optimization. ClimbOS should route them to the right playbook instead of forcing a store-specific checklist onto every application.

## 3. Research the customer's language

Start keyword research with user situations rather than broad category labels. Ask what triggered the search, what the person already tried, what device and workflow they use, and what outcome matters. A person searching for “paste previous text” may express the same underlying need as someone searching for a clipboard manager, but another person may simply want to recover an accidentally overwritten document.

Collect language from authorized customer interviews, support questions, reviews, product documentation, and available store data. Competitor reviews can reveal unmet needs, but they describe those competitors' audiences and should not be treated as representative market research. A keyword tool's volume or difficulty estimate is a third-party estimate, not an internal store metric.

Build clusters around the task, the user, and the constraint. A hypothetical image utility might serve occasional casual editing, professional batch workflows, or local processing requirements. Each implies different messaging and expectations. Verify actual capabilities before choosing a cluster. If the app cannot process a required file type, attracting that query is a mismatch rather than an opportunity.

For each candidate term, record intent fit, capability evidence, likely audience, competition observations, data source, and confidence. Prioritize terms that accurately describe a valuable job the app performs. Popularity cannot compensate for an unsupported promise.

## 4. Positioning and metadata

Write the app's positioning in one sentence: for a defined user facing a defined situation, the app provides a specific outcome through a credible mechanism. This sentence is an internal decision aid, not necessarily the final subtitle. It helps keep the icon, screenshots, description, onboarding, and purchase experience coherent.

Apple's search guidance identifies metadata relevance and user behavior among its search factors. It limits keywords to 100 characters, discourages redundant or irrelevant terms, and states that promotional text does not affect search ranking. Current search can also use natural language and app tags generated from submitted metadata. [Apple App Store search](https://developer.apple.com/app-store/search/).

Use those facts to make metadata accurate and efficient, not to claim knowledge of ranking weights. A hypothetical clipboard app might choose “Find copied text quickly” as a message to test if the product actually supports that workflow. It should not add “AI writing assistant” solely because that category attracts attention.

Review each metadata field independently for its purpose and jointly for the overall promise. The name should remain identifiable. The subtitle should explain useful value. The description should answer practical questions. Keywords should reflect legitimate discovery intent. Run deterministic length checks using the platform's accepted character interpretation, then validate in the actual submission system rather than trusting a model's manual count.

## 5. Screenshots as a decision sequence

A screenshot set should help someone evaluate the app, not merely display a collection of attractive screens. Begin with the primary outcome and demonstrate the mechanism. Then show the next important benefit, a relevant proof point, and any limitation that materially affects fit. Each image should have one main communication task.

For a hypothetical screen-recording utility, the sequence could demonstrate selecting the capture area, managing a camera overlay, reviewing the recording, and exporting. These examples require actual product support and authentic UI. A polished image implying a nonexistent editor is misleading even if the design looks plausible.

Use readable text at realistic viewing sizes. Check contrast, cropping, language expansion, and whether the interface remains understandable on smaller devices. Display representative content without exposing customer information. If an image uses a simulated account or fictional data, keep it clearly illustrative and avoid presenting invented achievements as customer proof.

ClimbOS can generate a storyboard with a claim ledger for every frame. The review should ask which product evidence supports the claim and whether the screenshot actually demonstrates it. AI image generation may help explore art direction, but final store assets must truthfully represent the app. A final export check should confirm dimensions, file formats, locale, ordering, and the exact app version depicted.

## 6. Icons and preview videos

An icon has a small communication surface. Evaluate recognition, distinctiveness, legibility, and consistency with the product's purpose. Avoid judging only at large presentation size. Put candidate icons beside other apps at realistic size and ask target users what they infer. A beautiful symbol that suggests the wrong category may attract attention while reducing suitable acquisition.

Preview videos should show value quickly and remain understandable without sound. Prefer a short demonstrated task to a dense tour of every control. Capture the real experience and remove unnecessary waiting, while avoiding edits that imply performance or functionality the app cannot deliver. Any quantitative speed claim requires representative evidence and conditions.

A hypothetical local transcription app should not imply instantaneous processing on every Mac if performance depends on hardware, model size, and audio length. A useful preview can show the workflow and explain relevant conditions in the listing. This helps users decide whether the app suits their device and workload.

Test a clear hypothesis. “Showing the completed outcome before the setup screen will improve suitable-user understanding” is more actionable than “make the video premium.” ClimbOS should store the hypothesis, audience, asset version, and success criteria. Production cost matters: if a video consumes the whole month's budget while a simple screenshot correction addresses the primary confusion, choose the smaller intervention first.

## 7. Conversion formulas and denominator discipline

Define each rate before using it. A listing-view-to-install rate equals qualifying installs divided by qualifying listing views for the same population and period. An activation rate equals activated new users divided by eligible new users. A paid conversion rate might use installs, activated users, or trial starters as its denominator; these are different measures and must have different names.

Store-reported conversion may use a provider-defined denominator that differs from a custom product funnel. Preserve the original metric definition and source. Do not relabel a store metric as “product-page conversion” simply because the dashboard needs a familiar title. Likewise, downloads, first-time users, redownloads, and installations on multiple devices should not be merged without a documented rule.

Suppose a hypothetical cohort includes 1,000 new installs, 400 activations, and 40 new paying customers. Activation is 40%; activation-to-paid conversion is 10%; install-to-paid conversion is 4%. If another month brings 1,500 installs but only 30 paying customers, the acquisition volume rose while install-to-paid conversion fell to 2%. The business may be attracting less suitable traffic or experiencing a downstream product issue.

ClimbOS should calculate these rates deterministically, display counts alongside percentages, and return undefined rather than divide by zero. Match cohort windows and allow enough time for delayed purchases before comparing outcomes.

## 8. Design experiments before producing variants

Start with a hypothesis and a decision. Identify the audience, asset, primary metric, meaningful effect, observation window, guardrails, and planned action for each result. If a test cannot change a decision, it may not justify its cost. Avoid producing many creative variants simply because generation is cheap; every extra variant can dilute learning and review attention.

Apple's product page optimization allows randomized treatments of supported assets for eligible iOS and iPadOS apps. Its documentation warns that releasing changed assets or metadata during a test can affect interpretation. [Apple optimization overview](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/).

Current Google Play documentation describes default-graphics and localized experiments, with up to two variants against the current listing. Target metrics include Unique user install clicks, Unique user open clicks, and Unique user pre-registration clicks. Check the live console rather than relying on older retained-installer terminology. [Google Play experiment instructions](https://support.google.com/googleplay/android-developer/answer/12053285?hl=en).

Where a native experiment is unavailable, a sequential change can still inform a decision, but label it observational. Seasonality, paid campaigns, releases, and audience shifts may explain differences. ClimbOS should never render a before-and-after comparison as a randomized winner. In low-volume apps, combine qualitative comprehension tests with cautious operational changes instead of promising statistical certainty the traffic cannot support.

## 9. Interpreting small samples

Small apps face a learning constraint: their traffic may not support precise estimates of modest changes. A treatment with twelve installs from one hundred views and a control with ten from one hundred has a two-point observed difference. It does not establish that the treatment will reliably outperform. The uncertainty is large relative to the apparent gain.

Use the platform's documented inference and reporting appropriately, and keep the raw counts. Do not stop at the first favorable movement. Define a reasonable observation window and document interruptions. Repeatedly checking many variants and selecting a lucky winner can exaggerate the apparent benefit even when each dashboard looks convincing.

A useful commercial threshold can precede formal statistics. If a redesign costs $600 and each incremental suitable installation has an estimated $1 contribution, the project needs approximately 600 incremental suitable installs to recover that cost under those assumptions. If the app receives only twenty listing visits weekly, a small uplift is unlikely to justify an expensive production effort quickly.

For ClimbOS, separate statistical uncertainty from economic uncertainty. A statistically credible download uplift may still be commercially poor if retention falls. Conversely, a low-cost clarity repair can be sensible without a powered test when it corrects an obvious misleading claim. State which kind of decision is being made and what evidence supports it.

## 10. Custom pages and message matching

Custom pages let a team align a destination with a particular audience or campaign, subject to platform support. They should reflect genuinely relevant product uses. A person arriving from a video-editing discussion should see evidence of the workflow that motivated the click, rather than an unrelated generic promise.

Apple now documents assigning relevant keywords to custom product pages so they can appear for selected search intent; it is outdated to describe them as universally link-only. Availability and configuration still need verification for the app and platform. [Apple custom product pages](https://developer.apple.com/app-store/custom-product-pages/); [Apple search guidance](https://developer.apple.com/app-store/search/).

Plan one page for one coherent use case before multiplying variants. Define the audience, promise, supporting assets, entry route, and downstream onboarding. If the app requires users to select a mode or complete prerequisites, make the transition explicit. A message-matched listing cannot compensate for an onboarding flow that loses the intended task.

ClimbOS should store each custom page as a versioned asset bundle with its own evidence, experiment history, and permission scope. Track performance by appropriate entry source where the reporting permits it. Do not compare a high-intent campaign page with a broad default listing and attribute the difference entirely to creative quality; the audiences may differ substantially.

## 11. Ratings, reviews, and product repair

Reviews are both a discovery influence and a source of product evidence. Read them for recurring failure modes, misunderstood promises, moments of satisfaction, and missing capabilities. Separate issue frequency from severity. One severe data-loss report can deserve urgent investigation even if many other reviews are positive.

Do not manufacture reviews, purchase sentiment, or encourage misleading endorsements. Review solicitation should follow current platform rules and use supported mechanisms. A growth system should never reward only happy users for reviewing or punish criticism. Negative feedback can identify a mismatch between the listing and the actual experience.

A hypothetical utility receives repeated complaints that a feature is not free. The first response is to inspect pricing disclosure and onboarding, not to bury the reviews with new promotion. If the listing creates the expectation of unlimited free use while a necessary function requires payment, correcting that expectation may reduce downloads but improve trust and customer quality.

ClimbOS can cluster authorized review data and propose themes with supporting excerpts and dates. It should avoid storing unnecessary personal information and must not treat anonymous reviews as verified operational facts. A reviewer response should acknowledge the issue, explain any verified remedy, and direct the person to an appropriate support channel. Publishing responses remains a separately authorized external action.

## 12. Localization and market readiness

Localization is a business expansion decision. Verify that the app, onboarding, support, payment experience, and required content can serve the target market before translating the listing. A localized promise paired with an untranslated critical workflow can create disappointment and poor retention.

Research local customer language and use cases. Literal translation may miss the phrase people actually use to describe a task. Screenshots can require different examples, typography, date formats, and text lengths. Have a qualified reviewer inspect the complete experience, including error states and purchase disclosures. AI translation can accelerate production, but it should not replace judgment about meaning and fit.

Prioritize markets using expected suitable-user demand, support feasibility, localization cost, contribution economics, and learning value. A large population is not sufficient. A smaller market with clear demand and existing language support may offer a more feasible first test.

For ClimbOS, each locale needs a readiness checklist and maintenance owner. Link localized claims to their source product facts so an upstream change triggers review across all affected languages. Avoid automatically publishing a machine translation when a source description changes; preserve an approval queue and show the exact diff. Maintain a locale-specific measurement view so aggregate improvements do not hide poor performance in one market.

## 13. Pricing and acquisition economics

Evaluate store growth using net contribution, not gross price multiplied by downloads. Relevant costs may include store fees, payment-related deductions, taxes where applicable, refunds, hosting, model inference, support, and content delivery. Actual treatment depends on the platform, program, territory, and business arrangement, so use verified statements and current contracts rather than a universal fee assumption.

A hypothetical app earns $6 net receipts per paid user after specified store deductions. Variable service and support costs average $2 over the chosen period, leaving $4 contribution before acquisition. If 5% of suitable installs become paying users, expected contribution per suitable install is $0.20: 0.05 × $4. An asset change costing $300 needs 1,500 incremental suitable installs to recover its cost under this simplified model.

Subscription projections need retention and a fixed horizon. Do not divide revenue by a tiny observed churn estimate and present the result as a reliable lifetime value. For a young app, use conservative cohort scenarios and include uncertainty about continued usage. Local AI apps may have different infrastructure economics from cloud inference apps, but claims of zero ongoing cost can still ignore support and distribution.

ClimbOS should show the inputs and allow the owner to edit assumptions. Recommendations that exceed budget or lack plausible payback should be revised before approval.

## 14. A complete launch workflow

Before launch, verify that the app delivers its principal promise on supported devices. Prepare truthful metadata, authentic assets, privacy and purchase information, support routes, and a measurement plan. Conduct usability sessions with people resembling the intended audience. Ask them to explain what they expect before installing, then observe whether first use meets that expectation.

Build an asset inventory that ties every screenshot and statement to the submitted version. A late interface change can invalidate a tutorial or visual. Freeze the approved bundle, record review status, and maintain a correction path. Launch timing should allow for uncertainty in review and operational readiness rather than depend on an assumed exact approval date.

In the first observation period, inspect installation problems, crashes, failed purchases, confusing permissions, and support themes before pursuing marginal metadata changes. Suitable acquisition requires a reliable experience. If a severe product issue appears, pause promotion and repair it.

After the product stabilizes, choose one discovery or conversion hypothesis. Keep the intervention small enough to interpret and document other changes. ClimbOS can coordinate this sequence through tasks and notifications, but it must not mark a launch successful merely because metadata was accepted. Completion requires actual availability, verified customer paths, and an observation record appropriate to the launch objective.

## 15. A 60-day Mac app scenario

Imagine a hypothetical direct-download Mac utility with a basic website, one supported workflow, a $500 marketing budget, and no store listing. The correct first action is not to generate Apple keyword metadata. Establish an accurate landing page, a trusted installation explanation, a clear purchase process, and first-use measurement. Verify compatibility claims and current distribution requirements through the applicable engineering workflow.

During the first two weeks, interview five suitable users and observe whether they understand the promise. Suppose several think the app synchronizes across devices when it does not. Correct that misunderstanding in the page and screenshots. The number of downloads may fall, yet the change can improve suitability and reduce support cost.

During weeks three and four, publish a demonstrated workflow and share it through authorized owned channels. Measure completed installations, successful first use, and meaningful continued usage. During the final month, evaluate whether a Mac App Store route is commercially and technically appropriate. The decision includes product constraints, customer preferences, fees, support, and release operations.

ClimbOS should present this as a distribution decision with supporting evidence. If the owner chooses a store launch, create the store-specific preparation plan. If the app remains direct-download, continue website conversion and discovery work. This avoids spending scarce time optimizing a channel the business has not actually selected.

## 16. Decision tree and evaluation criteria

If the app cannot deliver its stated primary outcome reliably, prioritize product repair. If the outcome is reliable but misunderstood, repair positioning and assets. If suitable people understand it but do not install, investigate trust, compatibility, purchase terms, and perceived effort. If installs are suitable but activation is weak, inspect onboarding. If activation is strong but retention or contribution is poor, improve recurring value or economics before scaling exposure.

When discovery is the constraint, select accurate demand clusters and improve the listing or supporting distribution. When conversion is the constraint, test a specific promise or visual sequence. When data is too limited, run comprehension research and instrument the journey. When native testing is unsupported, use an honest observational design rather than inventing a platform capability.

Evaluate each recommendation against seven criteria: fit with the verified product, evidence strength, audience relevance, expected contribution, implementation effort, reversibility, and maintenance burden. Policy and factual failures are hard gates. A compelling estimated uplift does not justify misleading screenshots or unsupported privacy claims.

ClimbOS should return a few feasible next steps with explicit mechanisms. “Rewrite the first screenshot to show the supported outcome because interviews reveal confusion” is useful. “Optimize ASO using AI” lacks the information needed to execute or evaluate the work.

## 17. ClimbOS engineering design

Represent an app separately from the business that owns it. One business can have multiple apps, platforms, locales, versions, distribution channels, and commercial models. Proposed Convex records include app snapshots, capability facts, listing bundles, asset versions, experiments, report imports, approvals, publication actions, and measured cohorts. Tenant isolation applies to every query and background job.

Use deterministic validation for field limits, required assets, locale coverage, arithmetic, and approval binding. Use OpenAI-first models for research synthesis, customer-language clustering, storyboard proposals, and source-bound copy. A model should not select an arbitrary ranking factor weight or invent a search-volume estimate when the input is missing.

The Vercel interface should make the next decision understandable: fix an unsupported claim, approve a listing bundle, supply an app capability, or review a mature experiment. Advanced details can expose raw metrics and evidence. Resend may notify the authorized owner when a review is ready; it is not a default user-acquisition channel for people who installed an app.

Store connections require scoped credentials and action separation. Reading reports does not authorize editing metadata. Before publishing, verify the approved bundle, app identifier, platform, locale, destination, and current permission. Handle ambiguous external timeouts by checking the actual remote state before retrying a submission.

## 18. Machine-readable operating playbooks

The audit playbook prevents a common failure: recommending a feature unavailable on the app's actual platform. Its outputs are proposals, not automatic changes.

```yaml
id: aso.audit.v1
required_inputs:
  - business_snapshot_id
  - app_snapshot_id
  - distribution_channel
steps:
  - id: verify_capabilities
    require_evidence_for: [features, compatibility, pricing, privacy_claims]
  - id: discover_store_support
    outputs: [metadata_fields, experiment_types, reporting_routes]
    on_unknown: manual_verification_task
  - id: diagnose_funnel
    stages: [exposure, listing, installation, activation, retained_value, contribution]
    missing_metrics: preserve_unknown
  - id: propose_actions
    max_actions: 3
    require: [hypothesis, evidence_ids, cost, owner, observation_window]
execution:
  default: draft_only
  publishing_requires: scoped_approval
```

The experiment contract keeps metric definitions attached to results so platform changes do not silently corrupt comparisons.

```json
{
  "id": "aso.experiment.v1",
  "required": ["app_id", "platform", "locale", "hypothesis", "asset_versions", "metric_definition"],
  "design": {"assignment": "verify_native_or_observational", "decision_rule": "declare_before_start"},
  "metric": {"numerator": "required", "denominator": "required", "cohort_window": "required"},
  "guardrails": ["activation", "refunds", "support_issues", "contribution"],
  "result_states": ["running", "more_data_needed", "inconclusive", "decision_ready"],
  "publication": {"automatic": false, "approval_binds_asset_version": true},
  "forbidden": ["invented_volume", "unsupported_capability", "fabricated_reviews", "causal_claim_from_uncontrolled_comparison"]
}
```

Validate these contracts in code and adapt them to the repository's actual architecture. Evaluate with fixtures covering a direct-download app, an iOS app with supported tests, a Mac listing without assumed native testing, a low-volume app, an unsupported feature claim, and a stale approval. The essential invariants are accurate product representation, correct platform routing, honest uncertainty, and controlled external actions.

## 19. Run a useful monthly review

A monthly ASO review should lead to a decision, not simply display charts. Compare the original growth constraint with current evidence. Look at audience suitability, first-use success, retained value, and contribution alongside discovery and downloads. Identify which observations matured and which remain too early to interpret.

Review one major promise against the actual product. If the app changed, the listing may need correction even before a conversion test. Review one customer-language theme and decide whether it implies clearer communication, a product improvement, or a market boundary. Not every requested feature belongs on the roadmap; some reveal that the app is attracting the wrong audience.

Then select the next feasible intervention. Preserve successful assets unless a clear reason supports replacement. Document the hypothesis, exact changes, resource limit, and observation plan. If the data is inconclusive, state whether more observation is worth its opportunity cost. An indefinite experiment can consume attention without improving decisions.

ClimbOS should assemble this review from versioned evidence and measured outcomes. Its value comes from connecting discovery to product truth and business economics. The completed work is an accurate listing, a reliable customer journey, an actionable experiment record, and a clear next decision. A higher ranking, a larger download count, or a model-generated creative bundle is useful only when it contributes to that system.

## References and research boundaries

Sources were inspected on October 19, 2026. No developer console, private app analytics, production listing, or live publication was accessed. Some help pages have no displayed publication date; retrieval does not establish when every capability became available. Platform scope, account eligibility, API support, and current commercial rules require verification during implementation.

- [Apple product page guidance](https://developer.apple.com/app-store/product-page/)
- [Apple App Store search](https://developer.apple.com/app-store/search/)
- [Apple product page optimization overview](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/)
- [Apple custom product pages](https://developer.apple.com/app-store/custom-product-pages/)
- [Google Play metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842?hl=en)
- [Google Play store listing experiments](https://support.google.com/googleplay/android-developer/answer/12053285?hl=en)
