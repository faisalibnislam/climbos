# Testing business assumptions before scaling

Source: *Testing Business Ideas*, David J. Bland and Alex Osterwalder, uploaded EPUB. This is an original ClimbOS adaptation, not a reproduction of the book or its experiment catalog. Source locators are in [sources-b.json](sources-b.json). Block numbers identify extracted XHTML elements in this exact file; they are not printed page numbers.

## What the source contributes

The book frames an idea as a collection of assumptions that should become testable hypotheses. It prioritizes assumptions whose importance is high and whose field evidence is weak. It distinguishes desirability, feasibility, and viability risk, then connects evidence, interpretation, and a decision about continuing, changing, or abandoning an idea. These concepts inform this guide; the data contracts, workflow rules, and tests below are proposed ClimbOS policies. [BK04-L01, BK04-L02, BK04-L04](sources-b.json)

The uploaded edition has substantial layout fragmentation. Text from columns and diagrams sometimes interleaves. The author names were verified in the internal title and copyright text because the EPUB metadata says “Unknown.” This guide relies on readable prose and labels whose context could be established; it does not infer unseen experiment ratings or reproduce diagram contents.

## The decision ClimbOS should help make

The useful question is “Which uncertainty should we reduce before making the next commitment?” A founder asking for more acquisition may really need evidence that a particular customer can complete setup, that delivering the promise is affordable, or that the buyer controls a budget. Marketing activity should follow the relevant uncertainty. The engine should resist selecting an attractive experiment merely because it can generate the assets quickly.

Create an assumption record containing the claim, affected business decision, customer segment, observation window, evidence references, consequence if false, and next commitment. Separate a customer-demand assumption from a delivery-cost assumption. One concierge pilot can provide observations about both, but success on one does not prove the other. A buyer's satisfaction does not demonstrate a scalable margin, and cheap delivery does not demonstrate demand.

## A proposed selection workflow

1. **Name the next commitment.** Identify the action being considered: building a feature, purchasing inventory, increasing spend, or hiring delivery capacity. Record the reversible portion and the obligations it creates.
2. **List necessary assumptions.** Ask what must be true about customer desire, access, delivery, and economics. Give each assumption one main claim so conflicting observations can be interpreted.
3. **Identify the decisive weak assumption.** Compare the consequence of being wrong with the strength and relevance of current evidence. Do not assign a spurious probability simply because the interface requires a confidence field.
4. **Choose a test that observes the missing thing.** Interviews investigate context; a comprehension test investigates interpretation; a pilot investigates use and delivery; a purchase decision investigates a specific commercial commitment. None establishes every part of the business model.
5. **Specify the result before collecting it.** Define eligibility, metric, observation window, costs, acceptable outcome, and what an ambiguous result means. Thresholds are owner-approved decision policies, not universal rules from the source.
6. **Review evidence and decide.** Preserve raw observations separately from interpretation. Continue, revise, stop, or collect better evidence, with a written reason and a date.

The source's discussion of evidence distinguishes stated opinions from observed behavior and considers evidence strength in relation to the hypothesis. ClimbOS should preserve that relationship rather than implement a universal rule that “a payment always beats an interview.” A payment can answer whether someone accepted an offer; an interview can reveal why the offer was misunderstood. [BK04-L03](sources-b.json)

## Hypothetical application

An invented appointment-management product considers spending $600 on ads. Its owner believes small service firms want automated reminders, can complete setup unaided, and will generate enough contribution to cover acquisition. These are three hypotheses, not one.

Suppose five qualified firms agree to an explicitly disclosed assisted pilot. Three complete setup only after the founder cleans their contact data. Four find reminders useful. The correct result is not “80% demand validated.” The observations suggest usefulness in a selected assisted group and expose a setup dependency. They do not measure a representative conversion rate, autonomous onboarding, or incremental revenue.

A next experiment might compare two understandable setup instructions with eligible new users while recording founder interventions. Alternatively, the owner may test a paid implementation offer if high-touch service fits the intended business. ClimbOS should show the resulting business-model choice: fix self-service setup or price and deliver assistance. Increasing ad volume immediately could amplify the unresolved constraint.

## AI-native implementation

Use a model to extract assumptions from a proposed plan and link each to source evidence. Ask it to generate at least one plausible reason the current interpretation is wrong. A deterministic eligibility layer checks budget, available population, delivery capacity, and permissions. A planner proposes a test; a reviewer verifies that the test can observe the hypothesis it claims to address.

Store `assumptionId`, `snapshotId`, `commitmentId`, `riskType`, `claim`, `evidenceIds`, `method`, `eligibilityDefinition`, `decisionCriteria`, and `invalidationTriggers`. Use explicit statuses such as `unexamined`, `supported_in_scope`, `contradicted_in_scope`, and `inconclusive`. Avoid a global `validated: true` flag. Support is specific to the tested segment, offer, channel, and time.

Convex can hold the proposed records and transitions; the real repository determines how those are implemented. Vercel can expose an owner review flow. Model calls remain OpenAI-first under the existing project direction. Draft preparation does not authorize publishing, recruiting participants, sending email, or spending. Resend remains subject to its current policy and recipient eligibility.

## Exceptions and reconciliation

A strong founder conviction is not useless, but it should be represented as a hypothesis or owner judgment rather than converted into measured evidence. A qualitative test can be enough to reject a plainly confusing message without claiming a population-level effect. A small pilot can justify a small next commitment even when statistical precision is unavailable. Evidence requirements should increase with the irreversibility and cost of the decision.

This method complements *The Mom Test*: discovery improves the quality of the initial hypothesis, while a later experiment investigates a behavioral or economic commitment. It also complements controlled experimentation: not every uncertainty is ready for an A/B test. Selection, sparse traffic, service variability, and unreliable instrumentation may make other learning methods more useful first.

## Proposed acceptance tests

- Given a plan with demand, onboarding, and margin assumptions, the engine creates separate records and does not mark all supported from a single purchase.
- Given an interview quote praising a future product, it records interest rather than observed purchase behavior.
- Given an assisted pilot, it preserves assistance cost and avoids describing the result as self-service validation.
- Given an ambiguous result, it offers a bounded follow-up or a cautious decision with uncertainty; it does not invent success.
- Given a segment or offer change, it identifies which prior evidence needs reassessment.

Two structured reference playbooks—assumption selection and evidence-to-decision review—are included in [books-b.json](../playbooks/books-b.json). They require runtime validation and integration; they are not an executable experiment platform.
