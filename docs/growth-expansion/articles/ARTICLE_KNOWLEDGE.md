# Articles and training: decision knowledge for ClimbOS

Research date: October 20, 2026. Six specified primary-source pages were directly retrieved. Five are public articles; Google Skillshop was inspected at its public training landing page only. No signed-in course, paid program, certification examination, or private course material was accessed or completed.

This document separates brief **source findings** from **proposed ClimbOS rules**. The latter are original application designs, not claims that the publisher recommends this exact implementation. They have not been deployed or commercially validated. Machine-readable counterparts are in [playbooks.json](playbooks.json); source identities and access scope are in [sources.json](sources.json).

## A01. Growth Loops are the New Funnels

**Primary source:** Reforge, July 31, 2018. [Read the article](https://www.reforge.com/blog/growth-loops). Relevant sections: “Using Growth Loops Instead,” “How Growth Loops Change Everything,” and “Putting Loops Into Action.”

**Source finding:** Reforge describes growth as connected cycles whose output can become an input to further growth, joining product, distribution, and monetization. It argues that a funnel alone misses these reinvestment relationships. This is a framework for reasoning, not proof that any proposed loop will compound.

**Proposed ClimbOS rules:** Build a `GrowthMechanism` object with an eligible population, customer action, useful output, distribution step, next eligible population, delay, incremental cost, and supporting evidence. Every arrow needs a mechanism and an observable event. If the engine cannot explain how an output reaches another prospective customer, label the diagram a hypothesis with a missing link. Do not award a compounding-growth label merely because a diagram contains a circular arrow.

Distinguish an activity that repeats through continued spending from an activity that replenishes its own inputs. Both can be useful; they have different cash requirements. Also retain funnel measurements for diagnosing individual transitions. Adopting the loop concept should not erase useful conversion denominators or make every business appear viral.

**Hypothetical application:** A software tool lets a customer publish a useful public artifact. The proposed mechanism is artifact creation, qualified viewing, relevant interest, new account creation, and later artifact creation. Privacy, optional branding, suitability of viewers, and customer benefit all need review. If artifacts remain private, this particular acquisition hypothesis is ineligible; ClimbOS should explore another mechanism instead of demanding exposure of private work.

**Acceptance check:** Give the engine a product with no sharing behavior. It should not invent referrals or public content. Give it evidence of shared artifacts but no viewer-to-customer measurement; it should propose instrumentation and a bounded test rather than forecast exponential growth.

## A02. The Racecar Growth Framework

**Primary source:** Reforge, January 21, 2021. [Read the article](https://www.reforge.com/blog/racecar-growth-framework). Relevant sections: “Step 1: Understanding How Your Product Will Grow” and “Step 2: Avoiding Common Pitfalls.”

**Source finding:** The article distinguishes repeatable growth engines, temporary boosts, efficiency improvements, and the inputs needed to operate them. Its examples and classifications provide a vocabulary for investment timing, not an exhaustive taxonomy for every industry.

**Proposed ClimbOS rules:** Give every proposed initiative a role, target constraint, dependency, expected duration, and continuing resource requirement. Permit multiple roles with an explanation. Avoid rigidly classifying a tactic by platform name: an event can create a temporary lead spike, support customer retention, or initiate a recurring partner relationship depending on its actual mechanism.

Before prioritizing optimization, ask whether there is enough eligible activity for the repair to matter. Before scaling acquisition, ask whether users receive value and whether delivery can absorb demand. Before repeating a successful launch event, ask what must be repeated manually and whether that work is affordable. The recommendation should state which dependency blocks the next investment.

**Hypothetical application:** A new product receives launch-day visits but has almost no baseline demand afterward. ClimbOS should record the launch cohort separately, investigate customer fit and activation, and design a repeatable acquisition test. It should not extrapolate the launch spike across a quarter. Conversely, a business with strong demand but a broken checkout may need the checkout repaired before a new traffic source.

**Acceptance check:** A launch spike and a stable recurring acquisition stream must produce different plans. If the engine recommends the same optimization checklist regardless of stage, the role classifier is not influencing decisions.

## A03. Selecting the next experiment

**Primary source:** David J. Bland, Strategyzer, August 27, 2020. [Read the article](https://www.strategyzer.com/library/how-to-select-the-next-best-test-from-the-experiment-library). Relevant sections: “What are the principles of selecting an experiment?” and “Discovery or validation, what’s the difference?”

**Source finding:** Strategyzer recommends selecting tests according to the uncertainty and constraints, building evidence across experiments, and distinguishing exploratory discovery from tests involving a more concrete value exchange. Its suggested cadence is a heuristic, not a statistical assurance.

**Proposed ClimbOS rules:** Represent the decision before selecting an experiment. Store the alternatives, costly uncertainty, evidence already available, next irreversible commitment, and what result would change the decision. Separate three questions: whether a customer has a problem, whether the proposed offer solves it, and whether a sustainable transaction is possible. A single test may address several questions, but its observations should not be credited to questions it cannot answer.

Filter candidate tests by access, customer risk, capability, cash, labor, ethical suitability, and observation time. Then compare the survivors by discriminating evidence and total commitment. A cheap test that cannot change the decision is not efficient. A more expensive test can be appropriate when it avoids a much larger commitment and its downside is tolerable.

**Hypothetical application:** An owner hears enthusiastic feedback and wants to build a large integration. ClimbOS proposes a clearly disclosed assisted pilot with a realistic workflow and commercial terms, if the business can fulfill it. It records purchase intent, actual commitment, implementation burden, and repeated use separately. It does not present a mock checkout as a completed sale or treat favorable interview comments as validated revenue.

**Acceptance check:** With no traffic, a small recruitment pool, and an imminent product decision, the engine should not automatically select an underpowered multivariant conversion test. It should explain the available learning methods and the limits of each.

## A04. Evaluating the growth agent

**Primary source:** Anthropic, January 9, 2026. [Read the article](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents). Relevant sections: “The structure of an evaluation,” “Types of graders for agents,” and “Going from zero to one.”

**Source finding:** Anthropic treats agent evaluation as testing tasks, trials, execution traces, and resulting outcomes, with different grader types and human calibration. It distinguishes capability evaluation from regression protection and recommends reviewing traces rather than trusting scores alone.

**Proposed ClimbOS rules:** Create two suites: known situations that must remain correct, and difficult situations the engine should improve at handling. Version each fixture's business snapshot, evidence pack, allowed tools, cost ceiling, scoring rubric, and expected state changes. Replay against frozen inputs for an isolated comparison; assess live research separately when freshness is part of the task.

Use deterministic checks for math, schema validity, budget ceilings, forbidden actions, and tenant boundaries. Use reviewer rubrics for diagnosis, alternatives, commercial fit, and usefulness. Do not allow an eloquent plan to offset an invented fact or unauthorized action. Treat disagreement between graders as a signal to inspect the case, not an instruction to average away the problem.

Track cost per acceptable decision and owner correction effort. A cheaper model that produces more repair work may not reduce total service cost. Preserve the existing OpenAI-first runtime unless measured needs justify a change; adopting engineering principles from Anthropic does not require changing providers.

**Hypothetical application:** A candidate prompt recommends spending a $600 ceiling despite evidence that onboarding cannot accept new customers. The fixture should fail the capacity criterion even if the channel plan is polished. A comparison prompt that identifies the constraint and proposes a feasible first intervention should receive credit without requiring one predetermined tactic.

**Acceptance check:** Include at least one valid alternative solution per ambiguous case so graders do not reward memorization. Any production improvement claim requires actual measured results; this pack defines tests, not results.

## A05. Managing decision context

**Primary source:** Anthropic, September 29, 2025; retrieved page metadata reports modification January 6, 2026. [Read the article](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents). Relevant sections: “The anatomy of effective context,” “Context retrieval and agentic search,” and “Context engineering for long-horizon tasks.”

**Source finding:** The article frames context as a limited resource and discusses selective retrieval, compaction, persistent notes, and architecture choices for maintaining useful information over long tasks. It does not establish that one context strategy is optimal for every workload.

**Proposed ClimbOS rules:** Build an explicit evidence packet for each decision stage. Preserve business identity, goal, cash and labor constraints, product eligibility, source qualifiers, unresolved contradictions, and action permissions before allocating space to background theory. Retrieve the appropriate library chapter only after routing by business mechanism and current task. Never treat a high similarity score as permission to ignore an eligibility mismatch.

Test compaction against known critical details. A summary that retains the phrase “email campaign” but drops “no consented audience” changes the decision meaning. A summary that keeps a price but drops its billing period corrupts economics. Store source locators and structured values outside prose so the next stage can retrieve the authoritative record instead of relying on a previous model's wording.

**Hypothetical application:** A pricing analysis needs the verified price period, included usage, support costs, and margin definition. It does not need every historical social-post idea. If a run changes from pricing to social planning, build a new stage packet referencing the same immutable business snapshot rather than indiscriminately extending the previous prompt.

**Acceptance check:** Compare output with and without a long irrelevant document. The engine should still preserve material constraints and evidence references. Record both answer quality and retrieval/processing cost; a shorter context is useful only when it retains the necessary information.

## A06. Google Ads training and measurement readiness

**Primary source:** Google Skillshop, public Google Ads training landing page. [Inspect the training paths](https://skillshop.withgoogle.com/googleads/). Accessed October 20, 2026; no publication date established.

**Source finding:** The landing page advertises self-paced Google Ads training and links Search, Display, Measurement, Video, and Shopping learning paths and certifications. The Measurement description covers Google Ads and Analytics setup and interpretation. This inspection does not establish the content of authenticated lessons or certify completion.

**Proposed ClimbOS rules:** Maintain a capability checklist rather than claiming the AI has taken a course. Before recommending an advertising action, identify the conversion definition, account ownership, measurement implementation, reporting delay, economics, approved destination, spending ceiling, and explicit action permission. An unanswered requirement should become a focused evidence request or a draft-only recommendation.

Keep learning resources separate from runtime policy. A training landing page is useful for identifying an operator's learning path, but current campaign settings, provider requirements, and API permissions need their own direct documentation check. Do not infer an available API operation from a course title or a marketing screenshot.

**Hypothetical application:** An owner wants more trial users, but the only tracked conversion is a pageview. ClimbOS should explain the measurement limitation, define the business-relevant event, and prepare an implementation handoff. A missing conversion signal does not justify inventing historical CPA. If a small exploratory campaign is considered anyway, specify the limited question it can answer, spending bounds, and the uncertainty that remains.

**Acceptance check:** The system must describe its knowledge access honestly: public training paths inspected, courses not completed. It must not claim Google certification, derive account eligibility from educational access, or launch a campaign without the applicable authorization.

## Integration and precedence

Place these guides alongside the existing fourteen-book library. Route A01/A02 to growth-model and channel decisions; A03 to experiment selection; A04/A05 to engine development and evaluation; A06 to advertising readiness and operator training. Do not load all six guides into every runtime call.

For the intended architecture, Convex can hold versioned business snapshots, evidence records, experiment proposals, and run state; Vercel can serve the owner-facing review interface; provider adapters can execute authorized actions. These are proposed design assignments, not repository findings. Resend is not a source of prospect data, and no email list or permission is assumed. Keep sends, publishing, and spending behind explicit server-side eligibility and action checks.

When a framework conflicts with measured constraints, preserve the framework as a hypothesis generator and follow the business evidence. A diagram cannot override a cash limit; a training certificate cannot establish causal lift; a passing evaluation fixture cannot guarantee customer revenue. Recheck volatile platform behavior before execution and record the date and scope of every verification.
