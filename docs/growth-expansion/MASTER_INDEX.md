# ClimbOS knowledge expansion

Edition: October 20, 2026. This expansion accompanies the original fourteen-book Growth Intelligence Library. It adds analytical adaptations of the six uploaded books, transcript-backed video knowledge, article and training guidance, original operational collections, and an evaluation pack.

## What is included

| Collection | Delivered content | Evidence boundary |
|---|---|---|
| Uploaded books | Six original application guides and twelve reference playbooks | Targeted substantive source reading; 36 exact EPUB locators; edition and layout caveats retained. |
| Videos | Four source cards, practical notes, and four reference playbooks | All four transcripts retrieved; publisher chapter timestamps where exposed; no claim of audiovisual playback. |
| Articles and training | Five article adaptations, one training-resource guide, and six reference playbooks | Five public articles read; Google Skillshop public landing page inspected, private courses not completed. |
| Business types | Six original operational playbooks | Proposed decision guidance for SaaS, Mac apps, agencies, ecommerce, local services, and marketplaces. |
| Public cases and failures | Six first-party reported cases | Includes negative, mixed, null, and validation outcomes; historical reports with transfer and causal limits. |
| Customer language and benchmarks | Capture processes, data contracts, and learning taxonomy | No invented interviews, testimonials, customer benchmarks, or measured ClimbOS results. |
| Platform rules | Six dated eligibility records | Actual account eligibility remains unknown; Meta retrieval blocked and explicitly unresolved. |
| Evaluation | 32 original synthetic cases, reviewer rubric, prompts, and math checks | Fixtures are unrun against the engine; fourteen expected-arithmetic assertions passed. |

There are **28 new machine-readable reference playbooks**. They require application implementation and evaluation; they do not authorize external action. The original library’s 28 playbooks remain a separate unchanged collection.

## Book application guides

| Source | Adaptation | Main engine contribution |
|---|---|---|
| Richard Rumelt, *Good Strategy/Bad Strategy* | [Strategy](guides/01_strategy.md) | Diagnosis, coherent actions, constraints, and feasible objectives. |
| Madhavan Ramanujam and Georg Tacke, *Monetizing Innovation* | [Monetization](guides/02_monetization.md) | Early price evidence, segmentation, packaging, cost and value compatibility. |
| April Dunford, *Obviously Awesome* | [Positioning](guides/03_positioning.md) | Alternatives, verified capabilities, customer value, and market context. |
| David J. Bland and Alexander Osterwalder, *Testing Business Ideas* | [Testing ideas](guides/04_testing_ideas.md) | Match a business assumption to a feasible discriminating experiment. |
| Rob Fitzpatrick, *The Mom Test* | [Customer discovery](guides/05_customer_discovery.md) | Behavioral evidence, neutral interviews, and concrete commitments. |
| Ron Kohavi, Diane Tang, and Ya Xu, *Trustworthy Online Controlled Experiments* | [Experimentation](guides/06_experimentation.md) | Measurement trust, appropriate analysis, guardrails, and decision quality. |

Read [RECONCILIATION.md](RECONCILIATION.md) before combining the frameworks. It resolves twelve practical tensions, including stated willingness to pay versus behavior, positioning before customers exist, growth loops versus bottlenecks, and experimentation in low-volume businesses.

## Videos, articles, and operational knowledge

- [Video knowledge and source access](videos/VIDEO_KNOWLEDGE.md), [video sources](videos/sources.json), and [video playbooks](videos/playbooks.json).
- [Articles and training](articles/ARTICLE_KNOWLEDGE.md), [article sources](articles/sources.json), and [article playbooks](articles/playbooks.json).
- [Business-type playbooks](collections/BUSINESS_TYPE_PLAYBOOKS.md) and [machine-readable versions](collections/business_type_playbooks.json).
- [Public case collection](collections/PUBLIC_CASES.md) and [case records](collections/public_cases.json).
- [Customer language capture](collections/CUSTOMER_LANGUAGE_CAPTURE.md).
- [Platform rules](collections/PLATFORM_RULES.md) and [rule records](collections/platform_rules.json).
- [Learning and failure collections](collections/LEARNING_COLLECTIONS.md) and [benchmark capture template](collections/benchmark_capture.json).

## Implement and evaluate

Start with [Claude Code instructions](integration/CLAUDE_CODE.md). Use [the evaluation guide](evaluations/README.md) and [32 synthetic cases](evaluations/cases.json) to compare the actual baseline with any proposed changes. The [prompt exporter](evaluations/export_prompts.py) prepares prompts without leaking expected answers into them. The [fixture calculator](evaluations/check_fixture_math.py) checks expected arithmetic without calling a model.

Use [the playbook catalog](playbooks/catalog.json) to locate all 28 new contracts. Book playbooks are in [books-a.json](playbooks/books-a.json) and [books-b.json](playbooks/books-b.json). These are original ClimbOS applications, not copied proprietary templates or complete source-book catalogs.

## Sources and verification

See [SOURCE_REGISTRY.md](SOURCE_REGISTRY.md), [source_registry.json](source_registry.json), [QUALITY_REPORT.md](QUALITY_REPORT.md), and [manifest.json](manifest.json). The book registry keeps actual uploaded-file hashes and internal locators. The bundle contains original analysis and metadata, not redistributed EPUBs or full extracted source text.

Observed facts, author concepts, public source reports, hypothetical examples, original proposed policies, and synthetic evaluation expectations are distinct knowledge kinds. Keep those labels when indexing. Current platform sources determine execution feasibility; historical teaching provides concepts, not present-day account permissions.

## Recommended implementation order

1. Add evidence provenance and unknown-value behavior.
2. Improve diagnosis, positioning, and monetization decisions.
3. Match experiments to uncertainty, traffic, economics, and observation time.
4. Introduce retrieval of relevant rules together with exceptions and limitations.
5. Compare the real engine on the synthetic suite and a separately held-out set.
6. Populate customer and failure collections from actual permissioned observations.
7. Extend execution only after its specific authorization, provider eligibility, budgets, and failure recovery are verified.

The package was authored as knowledge for ClimbOS. It is not evidence that a deployed application implements the proposed features or that it achieves a commercial uplift.

## Addition: blog and article research (2026-10-20)

[blog-research/](blog-research/README.md) adds source-grounded knowledge from Growth Unhinged (pricing, packaging, AI monetization), Elena's Growth Scoop (activation, retention, product-led growth), Copyhackers (voice of customer, conversion copy, email), For Entrepreneurs (subscription economics) and Microsoft's Experimentation Platform (trustworthy experimentation).

- 43 article records with access scope: [source_registry.json](blog-research/source_registry.json).
- Five guides: [blog-research/guides/](blog-research/guides/).
- 23 proposed playbooks: [blog-research/playbooks/catalog.json](blog-research/playbooks/catalog.json).
- Reconciliation with this library: [blog-research/RECONCILIATION.md](blog-research/RECONCILIATION.md).
- 33 synthetic cases: [blog-research/evaluations/cases.json](blog-research/evaluations/cases.json).
- An implementation backlog: [blog-research/BACKLOG.md](blog-research/BACKLOG.md).
- A validation report: [blog-research/VALIDATION.md](blog-research/VALIDATION.md).

Paywalled, blocked and unread items are listed in its README.
