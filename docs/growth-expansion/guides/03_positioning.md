# Positioning: connecting alternatives, evidence, and customer value

Source: April Dunford, *Obviously Awesome*, supplied EPUB, source ID **BK03**. Locator IDs resolve in `sources-a.json`; they refer to this supplied edition, not necessarily a later edition. This is an original ClimbOS adaptation and does not reproduce the full positioning workshop or proprietary canvas.

## What the source contributes

Dunford's process connects the alternatives buyers perceive with distinctive attributes, the value those attributes enable, the customers who care, and a market context that makes the value understandable. The book cautions that tightening positioning depends on having enough customer evidence to recognize a meaningful pattern. It also distinguishes a market context from an optional trend layered onto it. **BK03-L01–L07**

The source treats positioning as something shared across the business and translated into sales and marketing activity, rather than merely a slogan. The implementation below is a proposed ClimbOS design, with its own schemas, examples, decision gates, and evaluation tests. **BK03-L08–L09**

## The engine decision to improve

A model can generate attractive hero copy before establishing who should recognize the product and why. ClimbOS should separate positioning decisions from copy production. The owner needs an evidence-backed account of which buying situation is being prioritized, what customers would do without the product, which differences matter, and which expectations a category creates.

Do not equate an impressive feature list with differentiated value. A capability can be objectively unusual but irrelevant to the intended buyer. Conversely, a modest capability may be decisive in a particular workflow. Positioning analysis should preserve that relationship instead of ranking features by technical novelty or the number of times they appear on a website.

## Proposed evidence workflow

First, identify a candidate customer group using available purchase, retention, usage, support, and interview evidence. Explain the selection method. Happy customers can reveal where a product fits, but an analysis containing only enthusiastic survivors may omit buyers who were misled, unable to implement, or outside the proposed segment. Keep those cases available as counterevidence.

Second, investigate actual alternatives. Ask what the customer used before, considered during evaluation, or would do if the product disappeared. Include manual work, internal tools, hired services, doing nothing, and delaying the decision when those are real alternatives. A competitor selected because it ranks for the same keyword is a hypothesis, not established buyer context.

Third, maintain a comparative capability ledger. Record the product claim, evidence, comparison scope, verification date, and the alternative being compared. “Better support” or “easier” needs a defined basis. If comparison evidence is missing, soften the claim or propose a test. Never fabricate a competitor limitation to make the product sound distinctive.

Fourth, connect each supported capability to a customer consequence. Describe the task affected, the mechanism, the necessary conditions, and the evidence of importance. A model may propose a benefit hypothesis, but it must label an unmeasured time-saving estimate as an assumption. Different segments may care about the same feature for different reasons.

Fifth, compare market frames. For each candidate, record the expectations it creates, its relevance to customer language, the capabilities the product satisfies, and the gaps it risks concealing. Choosing a familiar category can improve understanding while attracting unsuitable comparisons. Inventing a category can create an expensive education burden. The right decision depends on evidence, resources, and commercial goals.

Finally, translate the selected position into a sales explanation, message hierarchy, landing page, and onboarding promise. Keep all artifacts tied to the same positioning version. A clever headline is not enough if onboarding reveals a different product or the sales team promises a different outcome.

## Hypothetical worked example

Consider an invented desktop application that performs document comparison locally. Its verified capabilities in this scenario are offline comparison, local processing, and a review view. These features do not describe any actual product in the user's portfolio.

Research might show that a candidate segment reviews sensitive documents while traveling. Their alternatives could include manual side-by-side review and an approved cloud tool. Local processing could matter because of customer data-handling requirements; offline use could matter because connectivity is unreliable. Those are separate value mechanisms, and neither automatically means the product is more secure or faster overall.

A candidate position is a desktop document-comparison utility for teams that need to review files offline under their own data controls. Before publishing it, the engine should verify supported formats, operating-system compatibility, processing behavior, and whether the product actually meets the relevant workflow. It should not promote “compliant with every privacy regulation” or “never uploads anything” without adequate evidence.

Test comprehension with representative participants. Ask what they believe the product does, whom it suits, what alternatives they would compare it with, and what they expect after purchase. If they expect collaborative cloud editing that the app lacks, the chosen wording or category is misleading. A landing-page conversion change alone cannot explain whether the misunderstanding was resolved or merely attracted a different audience.

## Decision branches and exceptions

If customer evidence is too weak to support a pattern, keep multiple provisional positions and prioritize discovery. A new business still needs working language, but that language should not be presented as validated market truth. Distinguish a temporary communication hypothesis from a settled strategic position.

If the strongest differentiator matters only after purchase, investigate how it influences renewal or referrals and whether buyers can understand its value during evaluation. Do not hide important retention value merely because it is not the first acquisition hook. Conversely, do not lead with an obscure operational detail that buyers cannot connect to their current decision.

If a new competitor appears, assess whether target customers consider it relevant and whether their expectations changed. Do not automatically reposition whenever a competitor launches. If a trend such as AI makes the message less clear, retain the concrete product context and treat trend language as optional. “AI-native” cannot substitute for explaining what the product helps the customer accomplish.

## ClimbOS integration and guardrails

Create a proposed `PositioningVersion` containing `segmentHypothesisId`, `customerEvidenceIds`, `alternativeGroups`, `capabilityClaims`, `valueMechanisms`, `marketFrames`, `selectedFrame`, `excludedExpectations`, `messageHierarchy`, and `reviewTriggers`. Record verified capabilities separately from planned roadmap items.

Each generated asset should reference this version plus its own claim evidence. A changed product capability, segment, or comparison claim should invalidate affected copy rather than silently update published material. Models can draft alternatives and summarize customer language; trusted application logic must control tenant access, evidence identity, artifact versions, and publishing permissions.

Keep the interface simple: show who the product is for, why they would care, and what the current position is based on. Make alternatives, weak claims, and counterevidence inspectable. This supports an owner who wants to challenge the recommendation without reading the entire source corpus.

## Proposed acceptance tests

Give the engine no happy-customer evidence: it should propose provisional language and research, not claim a validated segment. Provide a technically distinctive feature with no customer relevance: it should seek a value link. Provide a manual status quo but no named competitor: it should retain the manual alternative. Provide a broad AI slogan that obscures the product: it should repair the explanation. Provide a strong acquisition message that promises an unavailable capability: it should fail claim validation.

Evaluate accurate comprehension, segment fit, claim support, and consistency across artifacts. Revenue and conversion still matter, but they require suitable measurement and cannot retroactively justify an unsupported product claim.
