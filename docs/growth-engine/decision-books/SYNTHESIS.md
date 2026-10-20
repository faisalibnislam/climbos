# Cross-book synthesis: decision books

Edition 2026-10-20. This is original synthesis for ClimbOS's decision code. It contains no book text; locators are in [MATRIX.md](MATRIX.md). Each statement below is either the author's position (credited by name) or *our inference*, labelled as such.

## What each book contributes

| Book | Central claims (paraphrased) | Assumptions and scope | Limits for ClimbOS |
|---|---|---|---|
| **Think Bayes** (Downey, 2013 first edition) | A rate seen in few trials is a distribution. With little data the prior decides the answer, so it must be justified. Evidence is how much better one hypothesis predicts the data than another, not whether the data "fit". Decisions use the whole posterior. | Small, well-defined models, with priors from background knowledge. | Its hierarchical chapter models a causal chain, not pooling across businesses. Decision analysis maximises expected gain, which needs probabilities ClimbOS mostly doesn't have. |
| **Algorithms for Decision Making** (Kochenderfer, Wheeler, Wray, MIT Press 2022) | Beta-binomial learning for rates. Value of information: a measurement is worth taking only if some result would change the action. Validate a policy by enumeration, sensitivity and robustness. Joint outcomes must be simulated jointly. Small combinatorial selections can be solved exactly. | A formal model of states, actions and rewards, with usually known utilities. | Sequential, reinforcement-learning, POMDP and multi-agent machinery needs models, rewards and volumes small businesses don't have. Bandits need fast, randomised, comparable feedback. Game theory needs payoffs nobody knows. |
| **Causal Inference: What If** (Hernán & Robins, online edition dated 2026-08-19) | Association isn't causation. An effect needs exchangeability, positivity and a well-defined intervention. Before/after reads are emulated trials, valid only with a defined time zero, eligibility and follow-up. Selection on reporting or survival biases what's learned. Effects of two actions on the same outcome needn't add. | Explicit causal questions and declared assumptions; model-based estimators need many units. | One small business's data can't support IP weighting, the g-formula or g-estimation. What transfers is the discipline: label inference by design, fix time zero, treat missing follow-up as unknown, don't add same-step effects. |
| **Trustworthy Online Controlled Experiments** (Kohavi, Tang, Xu, CUP 2020) | Decide on a fixed horizon set in advance. Check the split (sample-ratio mismatch) before reading any effect. Read the confidence interval against a practical-significance bar. Count everyone assigned. The denominator must be the unit randomised. Guard against harm. Distrust surprising results (Twyman's law). | Large online platforms with thousands of units. | Many owners can't run a powered A/B test. The methods still say when *not* to claim a result, and what to use instead (before/after with assumptions stated, interviews, pilots). |
| **How to Measure Anything** (Hubbard) | **Not supplied.** The file is a different book (see README). | — | Value-of-information logic is grounded in Kochenderfer Ch 6 until the owner's copy arrives. |

## Worked examples that transferred, and why

- **0 of 4 leads paid.** A uniform prior gives P(rate < 15%) = 0.56: too uncertain to call weak (Downey Ch 4, Kochenderfer §4.2). It worked because the reference is a threshold, not a prior.
- **10 → 3 → 1.** P(activation is the weaker link) = 0.59, so the diagnosis is ambiguous, not "measured activation". It worked because both links have their own counts.
- **The prompt's 100 → 12 → 3.** As illustrative arithmetic, +6 points of activation gives 1.5 extra customers and +15 points of purchase gives 1.8. Equal *relative* lifts add equal customers (*our inference*, from Kochenderfer's lookahead). So which link to fix depends on what change is attainable, which only evidence can say.
- **A/B peeking.** Reading after every event picks a winner among identical variants far above the nominal 5%. The readers measured 13–33% under the old rule; the new rule stays under 6% in a seeded test (Kohavi Ch 2, Kochenderfer Ch 15).
- **Overlap.** The old formula discounted the largest play too, so adding a play could lower the total. Enumeration exposed it (Kochenderfer Ch 14).

## Counterexamples: where methods must not be applied

- Benchmarks are never priors for an owner's rate. They are thresholds with a source, grade and scope (references.ts).
- A holdout chosen by a rule or by hand isn't randomised, so it is never "incremental".
- No bandits across channels or plays: options are few, outcomes slow and drifting, costs unequal and assignment non-random (Kochenderfer Ch 15, Kohavi).
- No model-based causal estimators on one business's data (Hernán & Robins Part II).
- No equilibrium analysis of competitor responses (Kochenderfer Part V).

## Conflicts between authors and how they're resolved here

| Conflict | Resolution in code |
|---|---|
| **Kohavi** (frequentist fixed-horizon tests) vs **Downey / Kochenderfer** (Bayesian posteriors) | Randomised tests keep Kohavi's gates (split check, one read, interval vs practical bar). Posteriors are used for small-sample *diagnosis* and *plan-vs-actual* reads, where no test was run. |
| **Kohavi** (intention-to-treat) vs **Hernán & Robins** (per-protocol can be more informative) | Outcomes count everyone assigned. Per-protocol figures are diagnostic only (not built). |
| **Kochenderfer** (maximise expected utility) vs the owner's prompt (don't invent probabilities) | Probability-free tools: dominance (best feasible set plus runner-up), robustness at P10, break-even switch points, customers per point of leverage. |
| **Downey** (priors matter at small n) vs ClimbOS's existing fixed `PRIOR_WEIGHT = 20` on planned rates | Deferred, since no runtime code reads the updated rate. New posteriors use a labelled uniform prior worth 2 observations. |
| **Kohavi** (studies without controls are mostly wrong) vs **Hernán & Robins** (they can be valid under stated conditions) | Before/after stays labelled "observed", with its assumptions; it is never called incremental and never discarded. |

## Dated or out-of-scope material

- **Dated:** platform-specific tooling and examples in Kohavi (2020); the Julia code in Kochenderfer; Think Bayes 1st-edition Python code. None of it is used.
- **Out of scope:** MDP and POMDP solvers, policy gradients, imitation learning, multi-agent equilibria, causal survival estimators, g-methods, deep representations.

## Ideas that improve ClimbOS but were deferred

Each needs a data source or UI ClimbOS doesn't have yet:
- censoring of immature weeks in play results;
- reported-k-of-n plays;
- pre-registered predictions with calibration scoring;
- guardrail metrics at outcome time;
- before/after per-day windows with seasonality;
- delta-method variance for ratio metrics;
- unequal-split sizing;
- channel saturation (acceptance case 11).

See [IMPLEMENTATION.md](IMPLEMENTATION.md) § Remaining.
