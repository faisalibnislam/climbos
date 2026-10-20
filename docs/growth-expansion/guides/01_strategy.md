# Strategy: adapting Rumelt to ClimbOS decisions

Source: Richard Rumelt, *Good Strategy/Bad Strategy*, supplied EPUB, source ID **BK01**. References such as **BK01-L01** resolve to exact internal document paths and extraction-block ranges in `sources-a.json`. This is an analytical adaptation, not an exhaustive summary or a substitute for the book. No page numbering is invented.

## What the source contributes

Rumelt's strategy kernel connects a diagnosis of the challenge, a guiding policy, and coordinated actions. It helps distinguish a strategy from an aspiration, financial target, or disconnected activity list. His discussion of proximate objectives also emphasizes choosing a problem the organization can actually address with its available capabilities. **BK01-L01; BK01-L03**

The book's chain-link discussion explains why strengthening isolated activities may accomplish little when another necessary activity remains inadequate. Its treatment of strategy as a hypothesis connects execution with the creation of organization-specific knowledge. These are conceptual contributions, not promises of a predictable growth uplift. **BK01-L04; BK01-L05**

The sections below translate those ideas into proposed ClimbOS policies. Their schemas, thresholds, workflows, examples, and tests are original implementation recommendations. They should not be attributed to Rumelt as a software specification.

## The engine decision to improve

A plan generator can produce a polished list of SEO, social, advertising, and email tasks without explaining which obstacle matters. ClimbOS should require a causal argument before ranking tactics. The central output is a decision record: what appears to constrain valuable growth, which evidence supports that diagnosis, what competing explanation remains, and why the chosen intervention is more useful than its alternatives.

A diagnosis should be specific enough to be contradicted. “Marketing is weak” cannot guide a test. “Qualified prospects start evaluation but cannot establish whether migration will preserve their records” suggests observable behavior, a research question, and a potential intervention. A model may propose this hypothesis; it must not claim interviews or analytics support it unless those observations exist.

## Proposed strategy workflow

First, freeze the business snapshot and goal definition. Record geography, business mechanism, offer, economics, customer evidence, cash ceiling, team capacity, and operational obligations. Unknown values remain unknown. An owner who cannot provide retention data can still receive useful research and measurement work, but the engine should not justify acquisition spending with an invented lifetime value.

Second, generate a small set of competing diagnoses. Require the strongest supporting observation and strongest counter-observation for each. Distinguish demand, comprehension, activation, repeat value, distribution, delivery, and cash constraints. They are candidate explanations, not a universal funnel order. A seasonal local service, enterprise software business, and perpetual-license Mac app need different operational models.

Third, select a guiding approach. Describe how it is expected to affect the constraint and which activities reinforce it. If the approach is to reduce implementation uncertainty, a relevant set might include a verified migration explanation, a guided evaluation task, and a bounded onboarding offer. A general social-post calendar would need a separate argument to belong in that strategy.

Fourth, sequence dependencies. Mark each task as prerequisite, reinforcing, optional, or conflicting. Check that the same person is not assigned more work than available hours and that a lead-generation target does not exceed service capacity. Avoid interpreting “coherent” as “centralize every decision”: coordination consumes resources and should be proportionate to the dependencies.

Fifth, choose a near-term decision point. Define what observation will support continuing, changing, or stopping the approach. The first objective may be learning enough to resolve the diagnosis, rather than reaching a revenue target immediately. Keep outcome ambition separate from the next feasible operating commitment.

## Hypothetical worked decision

An invented appointment business has 120 inquiries monthly, 40 bookings, and 24 completed appointments. The owner wants more completed services but can deliver only 32 monthly. These are educational inputs, not evidence about a real customer.

Inquiry-to-booking is 40/120, approximately 33.3%. Booking-to-completion is 24/40, or 60%. Existing delivery capacity leaves room for eight additional completed appointments. The engine should investigate booking availability, cancellation patterns, appointment fit, and attendance friction before recommending a large traffic increase. The counts alone do not identify the cause.

Suppose verified follow-up evidence shows customers often misunderstand the preparation requirements. A proposed policy is to improve pre-appointment clarity and confirmation. Coherent actions include a plain-language preparation page, an eligible transactional reminder, and staff handling for questions. The next test measures attendance, cancellations, staff effort, and completed-service contribution. A reminder should only be sent under the business's actual permission and provider eligibility rules.

A change from 24 to 30 completions after implementation would be encouraging, but without an appropriate comparison the engine should describe an observed improvement, not six proven incremental services. It should also check whether the change exceeded capacity or merely moved work between periods.

## Decision branches and exceptions

If the diagnosis depends on evidence that is missing, commission the smallest discriminating observation. If multiple links are weak, test which combination must improve before expecting economic impact. If the business has an immediate cash emergency, explicitly compare short-term cash actions with longer-term positioning; do not pretend one horizon serves every need.

When a learning test has a bounded expected loss, it may still be valuable. A commercial scaling gate requiring positive unit contribution should not automatically prohibit all learning expenditure. Conversely, naming a campaign an experiment does not excuse unlimited spending. Require a loss ceiling, a decision it will inform, and a stopping condition.

A strategic refusal to pursue a segment is not a refusal to learn. ClimbOS can preserve a deferred opportunity with its invalidation trigger: a new capability, changed economics, or new demand evidence. This prevents every new anecdote from restarting the entire plan.

## ClimbOS contracts and integration

Add a proposed `StrategyDecision` record with `snapshotId`, `goalId`, `diagnosisCandidates`, `selectedDiagnosis`, `guidingApproach`, `supportingEvidenceIds`, `counterEvidenceIds`, `coherentActions`, `dependencies`, `deferredWork`, `capacityCheck`, `economicScenarioIds`, and `reviewConditions`.

Use tenant-scoped application records, deterministic arithmetic, and explicit unknowns. Convex can hold the intended state model, while Vercel presents a short owner decision and expandable reasoning. This guide does not establish that either module exists in the current repository. An OpenAI-first model can draft alternatives; trusted code must validate identities, amounts, permissions, and action transitions.

Treat the source framework as stable conceptual knowledge and the proposed decision policy as versioned product behavior. Record which policy produced a recommendation so later outcome evidence can improve the policy without rewriting the source's meaning.

## Proposed acceptance tests

Give the engine an ambitious revenue goal with no diagnosis. It should identify missing evidence and propose competing explanations rather than translate the goal into a channel checklist. Give it a capacity-constrained service business: it should not maximize lead volume without addressing fulfillment. Give it a convincing diagnosis with contradictory observations: it should preserve the contradiction and revise its confidence. Give it a bounded learning experiment with negative immediate contribution: it should evaluate learning value and downside separately from scaling eligibility.

Pass only when the recommendation remains understandable, feasible, and connected to its evidence. Eloquence, report length, and the number of suggested tactics do not establish strategic quality.
