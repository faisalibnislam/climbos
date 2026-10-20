# Expansion source registry

Research date: October 20, 2026. This registry identifies six uploaded book editions, four video sources, six article/training sources, twelve public-case/platform sources, and the original synthesis policy. It preserves access scope rather than treating every reference as equally verified.

## Uploaded editions

| ID | Title | Coverage and metadata |
|---|---|---|
| BK01 | Good Strategy/Bad Strategy | Targeted substantive reading of the cited chapter passages and surrounding context for analytical ClimbOS adaptation; not an exhaustive page-by-page review or reproduction.  |
| BK02 | Monetizing Innovation | Targeted substantive reading of the cited chapter passages and surrounding context for analytical ClimbOS adaptation; not an exhaustive page-by-page review or reproduction. Package metadata title is “Don’t Price the Product; Product the Price” plus a subtitle; the visible title page names Monetizing Innovation. The visible title page was used to identify the book. |
| BK03 | Obviously Awesome | Targeted substantive reading of the cited chapter passages and surrounding context for analytical ClimbOS adaptation; not an exhaustive page-by-page review or reproduction. Supplied text contains 2019-era examples; no claim is made that this is the latest revised edition. |
| BK04 | Testing Business Ideas | Targeted analytical inspection of the cited substantive sections and relevant navigation. Not a claim of exhaustive line-by-line review or independent verification of the books' historical company examples. EPUB creator metadata is Unknown. Visible title/copyright text identifies David J. Bland and Alex Osterwalder.; Text extraction fragments lines and interleaves multi-column/diagram material. No inaccessible visual rating or full experiment catalog is inferred. |
| BK05 | The Mom Test | Targeted analytical inspection of the cited substantive sections and relevant navigation. Not a claim of exhaustive line-by-line review or independent verification of the books' historical company examples. Source locators use EPUB XHTML elements, not a print edition page number. |
| BK06 | Trustworthy Online Controlled Experiments | Targeted analytical inspection of the cited substantive sections and relevant navigation. Not a claim of exhaustive line-by-line review or independent verification of the books' historical company examples. The EPUB splits chapters into many small files; NCX navigation establishes section context.; Some formulas, lists, and visual material are not fully represented by paragraph extraction. No exact missing formula or unseen diagram is reconstructed. |

Book locators are recorded in [sources-a.json](guides/sources-a.json), [sources-b.json](guides/sources-b.json), and [source_registry.json](source_registry.json). They refer to the uploaded edition’s internal paths and element indices. They are not page numbers. No raw source extracts or EPUBs are included.

## Public sources

| ID | Source | Access scope |
|---|---|---|
| V01 | [How To Talk To Users \| Startup School](https://www.youtube.com/watch?v=z1iF1c8w5Lg) | youtube_processor_transcript_and_publisher_description. Transcript retrieved and inspected; audiovisual content not watched; automatic captions may contain errors. |
| V02 | [How to Get Your First Customers \| Startup School](https://www.youtube.com/watch?v=hyYCn_kAngI) | youtube_processor_transcript_and_publisher_description. Transcript retrieved and inspected; audiovisual content not watched; examples and categorical advice not treated as universal evidence. |
| V03 | [Gustaf Alstromer - How to Get Users and Grow](https://www.youtube.com/watch?v=T9ikpoF2GH0) | youtube_processor_transcript_and_official_supporting_page. Transcript retrieved and inspected, including retention, channels and experimentation; historical technical and platform claims not imported as current. |
| V04 | [Get started with app discovery and marketing](https://developer.apple.com/videos/play/tech-talks/110358/) | official_page_transcript. Full official transcript retrieved and inspected; audiovisual content not watched; no timestamps exposed; current limits and platform eligibility require separate verification. |
| ART-01 | [Growth Loops are the New Funnels](https://www.reforge.com/blog/growth-loops) | verified_primary_article_page. Public article; sections on connected growth mechanisms and quantitative modeling. |
| ART-02 | [The Racecar Growth Framework](https://www.reforge.com/blog/racecar-growth-framework) | verified_primary_article_page. Public article; initiative roles and stage-dependent investment priorities. |
| ART-03 | [How to select the next best test from the Experiment Library](https://www.strategyzer.com/library/how-to-select-the-next-best-test-from-the-experiment-library) | verified_primary_article_page. Public article; risk-matched experiment selection and discovery versus validation. |
| ART-04 | [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | verified_primary_article_page. Public article; task/trial grading, regression, capability evaluation, and trace review. |
| ART-05 | [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | verified_primary_article_page. Public article; context selection, retrieval, compaction, and persistent notes. |
| ART-06 | [Google Ads training on Skillshop](https://skillshop.withgoogle.com/googleads/) | verified_public_landing_page_only. Public training landing page only; learning-path descriptions and links. |
| CASE-01-SOURCE | [Bing sitelinks: revenue gain with an initial guardrail failure](https://blogs.bing.com/search-quality-insights/2013/8/Large-Scale-Experimentation-at-Bing/) | primary_page_read. Historical first-party case, as described in public_cases.json. |
| CASE-02-SOURCE | [Power Automate: easier entry did not establish downstream success](https://www.microsoft.com/en-us/research/articles/experimentation-and-the-north-star-metric/) | primary_page_read. Historical first-party case, as described in public_cases.json. |
| CASE-03-SOURCE | [Buffer native versus third-party posting: a reported null difference](https://buffer.com/resources/3rd-party-social-media-tools/) | primary_page_read. Historical first-party case, as described in public_cases.json. |
| CASE-04-SOURCE | [Buffer content refresh month: an informative observational trade-off](https://buffer.com/resources/blog-strategies/) | primary_page_read. Historical first-party case, as described in public_cases.json. |
| CASE-05-SOURCE | [Buffer transparent feedback: an operating practice was reversed](https://buffer.com/resources/transparent-feedback-experiment/) | primary_page_read. Historical first-party case, as described in public_cases.json. |
| CASE-06-SOURCE | [Etsy interleaving: validate a faster measurement method before trusting it](https://www.etsy.com/codeascraft/faster-ml-experimentation-at-etsy-with-interleaving) | primary_page_read. Historical first-party case, as described in public_cases.json. |
| RULE-01-SOURCE | [Google Search](https://developers.google.com/search/docs/essentials) | primary_page_read. Content eligibility combines technical requirements, spam policies, and best practices; meeting them does not guarantee indexing or serving. |
| RULE-02-SOURCE | [Apple product page optimization](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/overview-of-product-page-optimization/) | primary_page_read. The inspected overview scopes native product-page optimization to iOS/iPadOS; Mac availability must not be inferred. |
| RULE-03-SOURCE | [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-10) | primary_page_read. Organization and member publishing use distinct scopes and role conditions; the API requires version headers. |
| RULE-04-SOURCE | [Meta Pages publishing](https://developers.facebook.com/docs/pages-api/posts/) | retrieval_blocked. Direct retrieval failed; this record establishes no current permission, endpoint or rate-limit claim. |
| RULE-05-SOURCE | [Resend sending eligibility](https://resend.com/legal/acceptable-use) | primary_page_read. The inspected policy requires explicit opt-in and prohibits unsolicited cold outreach, purchased lists, and scraped contacts. |
| RULE-06-SOURCE | [Gmail sender requirements](https://support.google.com/mail/answer/81126?hl=en) | primary_page_read. Requirements differ for personal Gmail senders and the bulk-sender category; authentication, transport and unsubscribe obligations need scope-specific checks. |

## Interpretation

Publication time, event period, retrieval time, and policy effective time have different meanings. Unknown fields remain unknown. First-party company stories are source-reported, not independently reanalyzed experiments. A course catalog is not authenticated course access. A transcript supports content analysis but does not establish every historical technical detail as current.

The original engine-policy record points to [RECONCILIATION.md](RECONCILIATION.md). Playbook schemas, evaluation expectations, hypothetical examples, and implementation choices are original proposals. They are not statements by the book authors or empirical ClimbOS results.

For current publishing, sending, spending, indexing, or app-store experiments, verify the action-specific official policy and actual tenant capability. The Meta source remains retrieval-blocked. Customer-language and benchmark templates intentionally contain no invented observations.
