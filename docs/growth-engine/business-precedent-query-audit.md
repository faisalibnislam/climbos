# Business-specific precedent queries — 17 November 2026

Engine: `v3.151-business-precedent-query`.

## Confirmed gap

The default planner passed its entire generated task into mechanism and goal matching. Instructions about discount alternatives, capacity and creative methods could select examples even when the owner supplied only a vague goal. A direct regression retrieved the travel-guide precedent despite an explicit business query asking for a personalized annual recap.

## Change and path

`convex/jobs.ts` now builds an explicit creative retrieval query from the saved goal, business summary and supplied facts. Generated task instructions, reviewer feedback and proposed drafts do not enter this mechanism query. Existing labelled business context and structured constraints still inform transfer fit. The shared writer/reviewer, strategy-reference validators, business-model validator and saved precedent IDs all use the same input object rather than separately rebuilding incomplete contexts. Input hashes include the query.

An explicitly empty query returns no precedent; older standalone callers without the optional field retain their direct-task behavior. The isolated industry and offline evaluation builders supply their synthetic brief and facts as the query. This does not turn hypothetical inputs or lexical matches into verified evidence.

A vague goal with no mechanism can now retrieve nothing. Grounded, adjacent and bold exploration still runs, and uncited original hypotheses remain eligible. The change does not require a matching precedent, increase the two-record runtime limit, alter the portfolio's separate dimensions, add a provider, or authorize any action.

## Verification

The initial query regression failed by returning CP-015 instead of CP-011. The original integration fixture also exposed that its vague goal had been retrieving cases solely through boilerplate. The revised integration checks use an explicit recap goal for the positive path and separately verify the vague-goal/no-match path, including retained bold exploration and no action receipts. Writer and critic receive complete matching records; CP-011 remains valid through saved-plan validation.

Commands and final results are recorded in `docs/Verification.md`.

## Limits

Retrieval remains lexical and English-centric. Business summaries or facts can contain broad or uncertain descriptions; a match is a candidate analogy, not proof of relevance or causation. Labels, source limits and transfer risks still require review. This is not a semantic retrieval benchmark, evidence of better live recommendations, or full product acceptance. The concurrently running paid v5 evaluation loaded v3.150 before this repair; its results must not be labelled v3.151.
