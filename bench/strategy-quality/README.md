# Local strategy evaluation

`pnpm strategy:review` exports eight frozen acceptance briefs and the production planning contract without a model or network call. Fixture passes establish wiring only.

`pnpm strategy:quality --confirm-paid --cases livoform` explicitly sends public/synthetic test inputs to the configured OpenAI API. The app/repository remain local; inference occurs remotely. An existing `OPENAI_API_KEY` must be in the environment. Never put a key in command arguments, source files, output artifacts or chat.

The owner authorized a cumulative $2 evaluation on 9 November 2026. The guard permits only official Responses text calls on GPT-6 Luna, standard service, with no tools, images, background work or fallback model. It reserves a conservative maximum before each HTTP call and persists usage receipts. Uncertain calls keep their full reservation. API outages stop the run. The lock prevents simultaneous runs. Cache fingerprints include the case context and core engine/adapter source hash. A saved result is reused; `--retry-failed` can repeat a failed case only if a fresh reservation fits.

Outputs and the cumulative ledger are under ignored `bench/cache/strategy-quality-2026-11-09/`. **Do not delete, reset, lower holds or replace that ledger to create more budget.** Retained uncertain reservations are not known charges. The report must distinguish actual usage charges from reserved/held authorization. The rate assumptions are dated and must be rechecked against official pricing before a different evaluation authorization.

For a comparison, use `--baseline-dir /absolute/path/to/a/read-only/checkout`. Do not connect a baseline to a hosted backend. The runner evaluates one production growth-plays draft with at most one revision and the production critic. It does not reproduce the full production research, source-page verification, channel scorer, strategy synthesis or publishing workflow. Frozen sources are not permission to contact anyone. An AI critic score is not an independent human quality rating or measured business performance.

Current primary references: [Luna model](https://developers.openai.com/api/docs/models/gpt-6-luna), [pricing](https://developers.openai.com/api/docs/pricing), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). The supported schema constraints are now retained for the base models; application parsing still validates every response.


`pnpm strategy:quality --confirm-paid --social` runs two editable posts for each of LinkedIn, Instagram, Facebook, X, TikTok, Pinterest and YouTube using frozen synthetic repair-kit facts and the shared production social task. It uses the same cumulative ledger and cap. No content is published. See [the dated results](RESULTS-2026-11-09.md); passing the schema is not a quality pass.

### Paid result reuse

The Anthropic harness now stores an evaluation identity covering the selected code fingerprint, engine, case/run name, complete input (including evaluation clock and creative retrieval query), and serializable agent settings. An existing variant is reused only when that identity matches. Changed or legacy records fail before a new provider call and remain untouched; choose a new variant for a fresh evaluation. Explicit historical comparison stages still read the named historical record as historical evidence.

This is deliberately strict: a newly constructed current clock changes the identity even on the same date. Reuse is not a fresh validation, and a below-bar result stays below bar. The selected-file fingerprint is not a full dependency manifest or a semantic correctness check. No ledger, cost hold, retry policy or provider authorization is changed.

Independent industry-comparison result reuse also requires an exact identity for the reference mapping, both candidate outputs, held-out questions, case evidence and harness fingerprint. A cached verdict with a different baseline or missing identity is rejected rather than presented as a current comparison. Earlier comparison files remain historical records.

### Owner-selected launch case

The `launch-acceptance` stage uses the dated Livoform public-source pack plus a local owner-report JSON file. Keep actual reports and outputs in ignored `bench/cache/`; never paste private business reports into tracked fixtures. The file shape is `{ "website": "https://livoform.com/", "reportedAt": "YYYY-MM-DD", "statements": ["Owner-provided statement"] }`. A valid report date and at most ten bounded statements are required.

After the owner approves the exact provider/data scope, use `--stage launch-acceptance --cases livoform --plan-style focused --owner-context /absolute/path/to/approved-local-report.json --variant <fresh-variant> --confirm-paid`. Existing budget holds and the cumulative cap remain intact. This stage uses a 14-day initial test; it cannot change a live offer or authorize outreach. See the dated public-launch acceptance audit for inspected-source and cached-page limitations.
