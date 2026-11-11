# Local ClimbOS audit — 9 November 2026

The owner wants a useful growth adviser: a clear recommendation, a longer-term business direction, creative alternatives, specific distribution opportunities, strong search and social advice, and simple language. Completion is judged against the consolidated product specification with newer owner requirements preserved. This work stays on the local `growth-engine-v2` checkout. No push, deployment, customer contact, publication or advertising spend was performed. The initial audit used no paid AI; the owner later authorized a cumulative $2 OpenAI evaluation using public/synthetic briefs only. The app backend still uses synthetic fixtures locally; see the current completion and AI acceptance records.

## Findings and repairs

| Observed defect | Repair | Evidence and limit |
|---|---|---|
| Channel scoring ran before the strategy's research was available. Its model input could lack the very evidence needed to judge a niche audience. | Await the shared research and supply the same notes and source set to channel scoring and strategy. | `convex/jobs.ts`; `tests/convex/strategy-evidence.test.ts`. Fixture verifies the actual messages, not a real model's judgment. |
| A previous scorecard could be reused after owner preferences or relevant business context changed. Saving inferred classification also lost owner channel preferences. | Hash engine, business brief, owner inputs, goal target, intelligence, research and model route; retain the six-hour expiry. Preserve channel preferences during strategy persistence. | Re-planning integration regression proves changed preferences trigger scoring and survive the save. |
| Creator recommendations conflated paid partnerships with earned coverage. Low subscription price could categorically demote a route that reaches many buyers. | Add R21, earned creator coverage, separately from paid R18. No assumed cash requirement or guaranteed placement; buyer-fit evidence remains necessary. Price advice now names uncertainty about margin, retention and effort. | Earned-creator unit tests cover candidate retrieval, eligibility, source checks and research-first routing. A zero library cash minimum does not mean zero owner effort or free guaranteed coverage. |
| Plans had creative options and execution tasks but no dedicated, persisted longer-term direction. | New plans require ambition, buyer, unmet need, distinctive mechanism, business advantage, first bet, next horizon, assumptions, deliberate omissions and a change-course condition. Save that direction with the plan and show it first. | Schema, citation lint, persistence and rendering tests. Historical plans remain readable without inventing a direction. |
| Different titles could disguise identical grounded, adjacent and bold options. Ambition checks could reward invented numbers. | Reject identical normalized mechanism/action pairs as a hard quality failure. Allow unknown targets when there is no defensible baseline or owner target. | Quality regressions. The duplicate detector is deliberately narrow; it does not detect paraphrases or measure originality. |
| Candidate reviews could end at a score and generic tactic. | New scoring runs require a shortlist of 3–5 concrete decisions: first step, unknowns, setup steps, labeled time allocation or unknown time, smallest check, alternative and change-course condition. The broader candidate comparison stays brief to bound output size. | Production generation schema, sanitizing, persistence/query regression and expanded row UI. These remain proposed judgments; they do not authorize work. |
| The large candidate library appeared before a clear business choice. | Channels now leads with the saved plan's actual choices. Candidate scoring and business classification sit behind a disclosure and use candidate labels. Current owner time, margin, capacity and connections inform displayed limits. | Desktop/mobile browser tests and backend regressions. Editorial scores are not probabilities or measured effects. |
| Search observations already used by the planner were hard for an owner to act on. | Show up to three matched-property page-review candidates with actual query/page/date data. Preparing a review fills an editable Home draft and starts no work. | Synthetic Search Console demo; desktop/mobile test checks preserved draft and unchanged request history. Position 4–20 is a triage rule, not proof that an edit is needed. |
| Creator search existed but was buried in generic outbound sales. | Add a discoverable creator/reviewer entry point and an explicit creator intake, even when an older customer campaign exists. | Navigation and browser tests. No names, audience counts, endorsements or contact permission are invented. |
| YouTube support was absent from parts of channel-to-draft routing. | Route YouTube explicitly alongside the existing seven social destinations. Strengthen editorial and native-format instructions for all seven. | Route tests. TikTok, Pinterest and YouTube remain draft/export paths, with no automatic publishing integration. |
| Home and Plan exposed too much detail at once. | Recommendation and decisions first; chat, request history, numbers, scores and detailed research follow or expand on demand. Navigation uses “Find customers.” | Desktop/mobile browsing, screenshots, accessibility and overflow checks. No usability study with representative owners has been performed. |
| Owners could record test outcomes, but the setup contract was only accessible through the backend. | Add a plain-language test setup form for 2–4 versions, a decision owner, a cash limit, currency, total hours and estimate basis. Running tests keep their original setup locked and allow append-only change notes. | Existing permission/locking regressions and desktop/mobile browser coverage. Saving keeps a test proposed; it authorizes no spend or execution. |
| A prepared request could overwrite an existing draft during restoration, including React Strict Mode's repeated effects. | Restore and combine the tenant/user draft before consuming the handoff; persist the combined draft immediately. | Browser tests cover navigation and same-page command-palette handoffs. |
| Editable tools and confirmations mounted under a temporary identity key. The first account response remounted the app, discarding early search input or closing a just-opened confirmation. | Wait for the first identity result before mounting the workspace. Preserve identity-scoped resets for real account changes. | Existing plain-language browser flow exercises filtering, empty state and navigation; pause/resume checks confirmations. |
| “Local” setup could still target hosted Convex; dev-login checks accepted misleading localhost prefixes. | Add a separate loopback database workflow. Parse exact loopback origins for dev login; derive local WebSocket CSP from actual backend origins. | Local auth unit tests, production build and isolated frontend/backend browser run. The demo launcher clears inherited application credentials. |

## Strategy and content expectations

New planning instructions require a business-specific mechanism before choosing channels. They distinguish source claims, owner reports, measured observations, assumptions, inferences and calculations. Proposed ambition is separate from a forecast. Unconventional ideas remain visible even when evidence, feasibility or execution capability is low; their smallest useful tests and risks stay explicit.

For a Mac app, the creator route should investigate recent Mac-app or relevant workflow coverage, show exact profile/content links when verified, explain the demonstration angle, and distinguish earned editorial coverage, affiliate arrangements and sponsorship. If research has not verified a shortlist, it must say so. Historical Snazzy Labs app videos found during this audit are leads for research, not evidence of current availability, willingness to cover a product, buyer composition or likely results. No current verified shortlist was shipped as a database or hardcoded recommendation.

Search advice should begin with the buyer's task, an actual URL, a missing answer or proof, and the next useful visitor action. G2 should be considered when buyers use the relevant category for comparison. Product Hunt should be considered as a product story, demonstration and activation/learning opportunity. Neither is a mandatory recurring chore. Social briefs should teach, demonstrate, interpret or invite around a real customer situation, with an idea and format suited to each chosen platform.

## Run the isolated demo

Requirements: installed dependencies and a cached Convex local backend binary. The launcher uses `~/.cache/convex/binaries/`, or `CLIMBOS_LOCAL_BACKEND_BINARY` for an explicit binary. It does not download a backend, create a hosted deployment, or edit `.env.local`. See [Convex local-deployment documentation](https://docs.convex.dev/cli/local-deployments) if the binary is missing.

Terminal 1:

```sh
pnpm local:demo backend
```

Terminal 2:

```sh
pnpm local:demo configure
pnpm local:demo sync
pnpm local:demo web
```

Open [the local fixture demo](http://127.0.0.1:3420/demo). Keep both processes running. Convex listens only on `127.0.0.1:3320`, with its HTTP site at port 3321. The frontend listens only on port 3420. State and generated test credentials live in the temporary directory printed by the launcher; credentials are written with mode 0600. Set `CLIMBOS_LOCAL_STATE_DIR` consistently across terminals to use another state directory. Temporary state can be removed by the operating system. Stop processes with Ctrl-C. Re-running configuration preserves its generated encryption/auth keys.

`pnpm local:demo build` makes a production build with local configuration. It clears application environment keys found in repository `.env*` files, inherited service credentials and deployment selection. This is a fixture review environment; paid providers are not configured. Do not add live credentials or real customer data to its state.

## Offline industry review

```sh
pnpm strategy:review prepare
pnpm strategy:review prepare --cases livoform,mac-app --out /tmp/climbos-review
pnpm strategy:review check --cases mac-app --file /absolute/path/to/saved-output.json
```

The command contains no model client or network call. It exports the production planning task and schema with frozen case evidence; it does not reproduce the entire production research/knowledge/budget workflow. Review questions are saved separately from generation inputs. Checking a saved output applies the production schema and deterministic lints and explicitly leaves editorial quality unassessed.

Eight briefs cover Livoform, a Mac utility, education, healthcare, science/technical B2B, physical retail, ecommerce and a creator business. Livoform facts are dated public website claims; the other businesses are synthetic. The initial audit prepared these packs offline. Later authorized API evaluations generated outputs and assessed them with the production AI critic; see the dated acceptance report. The existing libraries' broad industry coverage does not establish expert quality in every industry.

## Verification and remaining work

Current automated results are recorded in [Verification](Verification.md). Fixture checks establish data flow, contracts, arithmetic, permissions, preservation of owner inputs and the exercised UI behavior. They cannot establish that a model now reasons like an experienced growth adviser.

The consolidated specification is **not fully verified as complete**. In particular:

- The authorized live model tests did not meet the quality bar. Independent owner ratings, source entailment, originality and usefulness across industries remain unvalidated; fixture text is not a substitute. Final prompt/contract repairs are regression-tested but have no additional paid quality result.
- Live creator discovery, search/review/launch execution and provider operations require their real research evidence, setup and scoped approval. No business outcomes or growth lift were measured.
- The earlier [spec coverage inventory](growth-engine/spec-coverage.md) and [410-item audit](growth-engine/improvement-requirement-audit.md) contain partial capabilities and dated boundaries. This pass repairs the issues above; it does not relabel all 410 requests complete. Product Hunt, Google Business Profile and G2 now have versioned preparation briefs; they remain manual handoffs with explicit prerequisites rather than live provider execution. Provider capabilities explicitly unavailable in [Capabilities](Capabilities.md) remain unavailable.
- Generated channel decision briefs are only present on new plans. Existing saved plans are preserved; a new plan requires a configured model in a real workspace. The fixture demo is separately seeded and clearly labeled.
- The new engine contract remains in the existing `CLIMBOS_ENGINE=v2` path. The isolated launcher selects it; hosted deployment environment settings were not changed.

## Research used

- [Livoform homepage](https://livoform.com/): source-reported product capabilities and pricing for the frozen acceptance brief, checked 9 November 2026. Example marketing dashboards were not treated as actual performance data.
- [Google Search Console task guidance](https://support.google.com/webmasters/answer/17010961?hl=en): use observed search data to investigate useful improvements; observations do not establish demand or causation.
- [Product Hunt promotion rules](https://help.producthunt.com/en/articles/17734384-5-how-to-promote-your-launch-and-what-to-avoid) and [launch guide](https://help.producthunt.com/en/articles/17350772-launch-guide): launch preparation and participation boundaries.
- [G2 review validity](https://sell.g2.com/review-validity) and [review strategy guidance](https://sell.g2.com/quick-start-guides/build-reviews/build-a-review-strategy-that-works): authentic review collection and neutral invitations.
- Growth-intelligence books 05, 09 and 14: channel mechanisms, customer-question editorial work, and tracing the implemented request before expanding architecture. These are reference guidance, not measured proof of this product's quality.


## Focused tabs continuation

The chosen layout is now applied to Plan, Your work and Results with four primary navigation destinations. Plan separates the active 14/30/90-day cycle from long-term direction and past reviews. Make it happen starts preparation through the existing workflow. Climb AI can ask a scoped choice-based question and wait; it must consult available context before asking. Cycle history, classified learning, source ownership checks and zero-hour manual-work checks are covered by regression tests. See [the implementation record](Specification-Completion-2026-11-09.md) for current behavior and limits, and [Verification](Verification.md) for final checks. This does not establish expert model quality across industries.
