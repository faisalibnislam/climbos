# Anthropic platform research for the ClimbOS AI engine rebuild

Researched 17 Oct 2026. Covers the Claude API, Agent Skills, server tools, caching and batching, agent-loop and eval guidance, Managed Agents and the Agent SDK, Convex limits for long runs, and Gemini.

**Sources.** Anthropic docs (platform.claude.com, fetched today), anthropic.com/engineering, the installed SDK type definitions, Convex docs and component READMEs, and ai.google.dev.

**UNVERIFIED** marks anything I could not confirm from a primary source. Where two official sources disagree, both values are given.

**Installed versions (checked in `node_modules`)**

| Package | Version | Notes |
|---|---|---|
| `@anthropic-ai/sdk` | **0.135.0** | Non-beta `client.messages.create` already has `container` (with `skills`), `output_config` (`effort`, `format`), `thinking` (`adaptive` / `between_tools` / `disabled` / `enabled`), `cache_control`, `inference_geo`, `speed`, `diagnostics`, `service_tier`, `user_profile_id`. `client.skills.*` and `client.skills.versions.*` are stable namespaces. Tool types include `web_search_20250305/20260209/20260318`, `web_fetch_20250910/20260209/20260309/20260318`, `code_execution_20250522/20250825/20260120/20260521`, `memory_20250818`, `computer_toolset_20260801`, `tool_search_tool_{regex,bm25}_20251119`. `context_management` (clearing and compaction) and `toolRunner` are only on `client.beta.messages`. Helpers: `zodOutputFormat` and `jsonSchemaOutputFormat` (`@anthropic-ai/sdk/helpers/zod` and `/json-schema`), plus `betaZodTool`, `betaTool`, `betaMemoryTool` (`/helpers/beta/*`). |
| `@google/genai` | 2.30.0 | |
| `convex` | 1.47.0 | Only `@convex-dev/auth` is installed. Workflow, Workpool, Agent and Action Retrier are **not** installed. |

---

## 1. Current Claude models

### 1.1 IDs, limits and token prices (USD per million tokens, Claude API first-party)

| Model | API id (pinned snapshot, no date suffix) | Context | Max output | Input | Output | 5m cache write | 1h cache write | Cache read | Batch in / out |
|---|---|---|---|---|---|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | 1M | 128K | $10 | $50 | $12.50 | $20 | **$0.25** (0.025x) | $5 / $25 |
| Claude Opus 5.5 (Anthropic's default recommendation) | `claude-opus-5-5` | 1M | 128K | **$4** | **$20** | $5 | $8 | **$0.20** (0.05x) | $2 / $10 |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 1M | 128K | $2 | $10 | $2.50 | $4 | **$0.10** (0.05x) | $1 / $5 |
| Claude Haiku 5.5, prompt ≤100K tokens | `claude-haiku-5-5` | 1M | 128K | $0.10 | $0.50 | $0.125 | $0.20 | $0.01 | $0.05 / $0.25 |
| Claude Haiku 5.5, prompt >100K tokens | (same) | | | $0.50 | $2.50 | $0.625 | $1 | $0.05 | $0.25 / $1.25 |
| Claude Fable 5 (legacy) | `claude-fable-5` | 1M | 128K | $10 | $50 | $12.50 | $20 | $1 | $5 / $25 |
| Claude Opus 5 (legacy) | `claude-opus-5` | 1M | 128K | $5 | $25 | $6.25 | $10 | $0.50 | $2.50 / $12.50 |
| Claude Opus 4.8 (legacy) | `claude-opus-4-8` | 1M | 128K | $5 | $25 | $6.25 | $10 | $0.50 | $2.50 / $12.50 |
| Claude Sonnet 5 (legacy) | `claude-sonnet-5` | 1M | 128K | $2 | $10 | $2.50 | $4 | $0.20 | $1 / $5 |
| Claude Sonnet 4.6 (legacy) | `claude-sonnet-4-6` | 1M | 128K | $3 | $15 | $3.75 | $6 | $0.30 | $1.50 / $7.50 |
| Claude Haiku 4.5 (legacy) | `claude-haiku-4-5` (`claude-haiku-4-5-20251001`) | 200K | 64K | $1 | $5 | $1.25 | $2 | $0.10 | $0.50 / $2.50 |

`claude-mythos-5-1` and `claude-mythos-5` have Fable pricing but are restricted to Project Glasswing, so they are not relevant here.

**Sources:** [pricing](https://platform.claude.com/docs/en/about-claude/pricing), [models overview](https://platform.claude.com/docs/en/models/overview). The SDK `Model` union in 0.135.0 lists every id above.

**Pricing rules that affect metering**

- **Long context:** Claude 4.6 and later models bill the full 1M context at the standard rate (no long-context premium). The exception is Haiku 5.5, which is priced per request by prompt length. Prompt length counts cache reads and writes, so a request over 100K pays the higher rate even if most of it is a cache hit.
- **Tokenizer:** the tokenizer used since Opus 4.7 (all 5.x models) produces about 30% more tokens than Sonnet 4.6 for the same text. Re-baseline with `count_tokens` against the target model.
- **Data residency:** `inference_geo: "us"` multiplies every token category by 1.1x. The default `"global"` costs 1x.
- **Fast mode** (`speed: "fast"` plus beta `fast-mode-2026-02-01`): Opus 5.5 costs $8 / $40. Opus 5 and 4.8 cost $10 / $50. It is not available on Batch, and switching speed invalidates the prompt cache.
- **Tool-use system prompt overhead** (`tool_choice` auto/none): 286 tokens on Opus 5.5, Sonnet 5.5 and Haiku 5.5.
- **Batch output cap:** up to 300K output tokens on Batch for Opus/Sonnet/Haiku 5.x with the beta `output-300k-2026-03-24`. This beta is not in the SDK's beta enum, so pass it as a string.
- **Existing rates file:** `shared/economics/rates.ts` matches these prices for Sonnet 5.5 and Haiku 5.5 (cache read $0.10 / $0.01, 5m write $2.50 / $0.125). It has no **1h write** rate ($4 / $0.20). Add one if we use `ttl: "1h"`, and split `usage.cache_creation.ephemeral_5m_input_tokens` from `ephemeral_1h_input_tokens`.

### 1.2 Thinking and effort

There is no separate price for thinking: thinking tokens are billed as output tokens. `usage.output_tokens_details.thinking_tokens` (SDK `OutputTokensDetails`) reports them, so record them in the meter.

| Model | Thinking config | Default `output_config.effort` | Notes |
|---|---|---|---|
| Fable 5.1 | Always on. Omit `thinking` or send `{type:"adaptive"}`. `disabled` and `budget_tokens` return 400. | `high` | 30-day retention required (no ZDR) |
| Opus 5.5 | Always on. `disabled` and `budget_tokens` return 400 at every effort level. | **`medium`** (set it explicitly) | Effort is the only depth control |
| Sonnet 5.5 | Adaptive by default. `disabled` returns 400; use `{type:"between_tools"}` to turn thinking off (only at effort ≤ `high`, no other fields). | `high` (recalibrated levels) | |
| Haiku 5.5 | Adaptive by default. `disabled` only at effort ≤ `high`. | `medium` | No server-side refusal fallback |

- **Effort levels** are `low | medium | high | xhigh | max` (GA, no beta). They live at `output_config.effort`.
- **Thinking display:** text is **omitted by default** on 5.x models. `thinking: {type:"adaptive", display:"summarized"}` returns summaries.
- **Thinking blocks:** pass them back unchanged when continuing on the same model. "Preserved thinking" binds them to model and conversation, and editing earlier turns invalidates them. Accounts created on or after 2026-08-31 get a 400 on edited history. **Keep our loop append-only.**
- **Sampling params:** `temperature`, `top_p` and `top_k` are removed on Opus 5.x and Fable (400). Non-default values return 400 on Sonnet 5.5 and Haiku 5.5.
- **Prefill:** assistant prefill returns 400 on all 4.6+ models. Use `output_config.format` instead.

### 1.3 Breaking behaviours that shape our loop design

1. **Forced tool use returns 400** on Opus 5.5, Sonnet 5.5 and Fable 5.1 (`tool_choice: {type:"any"}` and `{type:"tool"}`). This also applies to `count_tokens` and Batches. Haiku 5.5 still allows it: the pricing page lists a 406-token overhead for any/tool. **Use `output_config.format` (JSON schema) for structured outputs, not a forced "respond" tool.** `strict: true` on tools keeps tool arguments schema-valid.
2. **`stop_reason: "refusal"`** (HTTP 200, `stop_details.category`, e.g. `cyber`, `bio`, `reasoning_extraction`, `frontier_llm`, `general_harms`) is possible on 5.x models. Check it before reading content.
   - On the Claude API, Opus 5.5 can opt into server-side fallback: `betas: ["server-side-fallback-2026-07-01"]` with `fallbacks: "default"` (beta namespace). Sonnet 5.5 accepts only the `"default"` form. The parameter is rejected on Batches.
3. **Structured outputs and reasoning:** a schema property asking for "reasoning" or "step-by-step thinking" can trigger a `reasoning_extraction` refusal. In critic schemas, ask for a *short explanation* field and leave the reasoning to thinking.
4. **Mid-conversation `{role:"system"}` messages** are supported on Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.1 (no beta). They let you inject operator instructions without rewriting the cached prefix.

### 1.4 Tool and feature support by model (5.x generation)

| Feature | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 | Fable 5.1 |
|---|---|---|---|---|
| `web_search_20260209/20260318` (dynamic filtering) | yes | yes | yes ("Claude 4.6 and later", per the docs) | yes |
| `web_fetch_20260209/20260309/20260318` | yes | yes | yes (same docs statement) | yes |
| Code execution (all 3 current versions) and Agent Skills | yes | yes | yes | yes |
| Structured outputs (`output_config.format`, `strict`) | yes | yes | yes | yes |
| Forced `tool_choice` any/tool | **no (400)** | **no (400)** | yes | **no (400)** |
| Compaction (beta `compact-2026-01-12`), context editing (beta `context-management-2025-06-27`) | yes | yes | yes | yes |
| Task budgets (beta `task-budgets-2026-03-13`, min 20,000) | yes | yes | yes | yes ("confirm at launch") |
| Fast mode | yes | no | no | no |
| Priority Tier | no | no | UNVERIFIED | no |
| Memory tool `memory_20250818` (client-side) | yes | yes | yes | yes |
| Minimum cacheable prefix | 512 | 512 | 512 | 512 |

Haiku 5.5 web-tool support and its 512-token cache minimum are the least certain entries. Check at runtime with `client.models.retrieve(id)` and its `capabilities.server_tools.web_search.supported` field.

### 1.5 Rate limits (Messages API, per org)

| Tier | Monthly spend cap | Opus 5.5 / Sonnet 5.5 / Haiku 5.5 (each its own bucket) RPM / ITPM / OTPM | Fable 5.x (shared bucket) RPM / ITPM / OTPM |
|---|---|---|---|
| Start | $500 | 1,000 / 2,000,000 / 400,000 | 1,000 / 500,000 / 100,000 |
| Build | $1,000 | 5,000 / 5,000,000 / 1,000,000 | 2,000 / 1,500,000 / 300,000 |
| Scale | $200,000 | 10,000 / 10,000,000 / 2,000,000 | 4,000 / 4,000,000 / 800,000 |

- **Cache-aware ITPM:** cache reads do **not** count toward ITPM; only `input_tokens + cache_creation_input_tokens` do. `max_tokens` doesn't count toward OTPM.
- **Bursts:** limits use a token bucket, so short bursts can trip the per-second equivalent.
- **Spend-cap 429:** it has `error.details.error_code: "enforced_spend_limit_reached"` and no `retry-after`. Do not retry it.
- **Headers:** `retry-after` and `anthropic-ratelimit-{requests,tokens,input-tokens,output-tokens}-{limit,remaining,reset}`.
- **New orgs** may start in an "Evaluation" tier below Start.

Source: [rate limits](https://platform.claude.com/docs/en/api/rate-limits).

---

## 2. Agent Skills via the API

### 2.1 What a skill is (progressive disclosure)

A skill is a folder with `SKILL.md` (YAML frontmatter plus a Markdown body) and optional extra files and scripts. Claude loads it in three levels:

| Level | When loaded | Cost | Content |
|---|---|---|---|
| 1. Metadata | Always: added to the system prompt | ~100 tokens per skill | `name` and `description` from frontmatter |
| 2. Instructions | When triggered: Claude runs `cat /skills/<name>/SKILL.md` via bash | Under 5K tokens recommended | SKILL.md body |
| 3+. Resources | As needed | 0 until read; scripts contribute only their output | Other `.md` files, schemas, templates, scripts |

**Frontmatter rules**

- `name`: required, at most 64 characters, `[a-z0-9-]` only, no XML tags, must not contain "anthropic" or "claude".
- `description`: required, non-empty, at most 1024 characters, no XML tags. It must say what the skill does **and when to use it**, because it is the trigger.

**Where skills run.** On the API, skills are copied into the code-execution container at `/skills/{skill-name}/`. The directory name is the SKILL.md `name` for custom skills (or `pptx` and similar for Anthropic skills), not the `skill_01…` id.

**Runtime constraints on the API**

- No network access.
- No runtime package installs.
- Python 3.11, 1 CPU, 5 GiB RAM, 5 GiB disk.
- Preinstalled libraries include pandas-style data tools, openpyxl, python-docx, python-pptx, pypdf, pdfplumber and reportlab.

**Sharing and data:** custom skills are **workspace-wide** (every API key in the workspace can use them). They do not sync with claude.ai or Claude Code. Skills are **not ZDR-eligible**.

**Anthropic-provided skills** (`type: "anthropic"`): `pptx`, `xlsx`, `docx`, `pdf`. Versions are date-based (for example `20251013`) or `latest`. Open-source examples are at github.com/anthropics/skills.

Sources: [Agent Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), [Skills guide](https://platform.claude.com/docs/en/build-with-claude/skills-guide), [engineering post (16 Oct 2025)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills).

### 2.2 Skills API endpoints (GA, no beta header)

| Operation | Endpoint | SDK 0.135.0 |
|---|---|---|
| Create skill | `POST /v1/skills` (multipart `files[]`, optional `display_name` up to 255 chars) | `client.skills.create({ files, display_name? })` → `Skill {id, type:"skill", display_name, latest_version_id, source:{type:"custom"\|"anthropic"\|…}, created_at, updated_at}` |
| List skills | `GET /v1/skills?source=custom` | `client.skills.list({ source })` (cursor pages) |
| Get skill | `GET /v1/skills/{skill_id}` | `client.skills.retrieve(skillId)` |
| Delete skill (and all its versions) | `DELETE /v1/skills/{skill_id}` | `client.skills.delete(skillId)` |
| Create version | `POST /v1/skills/{skill_id}/versions` (multipart `files[]`) | `client.skills.versions.create(skillId, { files })` → `SkillVersion {id:"skver_…", skill_id, name, description, created_at}` |
| List versions | `GET /v1/skills/{skill_id}/versions` | `client.skills.versions.list(skillId)` |
| Get or delete version | `GET` or `DELETE /v1/skills/{skill_id}/versions/{version}` | `client.skills.versions.retrieve(version, { skill_id })` / `.delete(version, { skill_id })` |
| Download version content | `GET /v1/skills/{skill_id}/versions/{version}/content` | (not on Foundry) |

**Upload and versioning**

- All files must share one top-level folder, with `SKILL.md` at its root. Filenames include that folder, for example `linkedin-playbook/SKILL.md`.
- You can upload a zip or individual files. The total must be **under 30 MB uncompressed**.
- **Each version is a full snapshot:** re-upload every file. The SKILL.md `name` must match the existing skill.

**Beta headers**

- **None are required now.** Skills and Files moved to stable `client.skills.*` and `client.files.*`.
- The old `skills-2025-10-02` and `files-api-2025-04-14` betas are still in the SDK enum. The `client.beta.skills` namespace has changed shape; do not use it.
- Code execution needs **no** beta header on any current version. The legacy `code-execution-2025-08-25` header is still accepted.

**Version pinning**

- Production should pin `version: "skver_…"`. `"latest"` (or omitting it) means anyone uploading a new version in the workspace instantly changes production behaviour.
- Version IDs are strings; quote them in JSON and YAML.
- Remove unused skills from the request: the docs say each skill's metadata "impacts performance".

**Multi-tenant note:** because skills are workspace-scoped, per-tenant custom skills would need one workspace per tenant (default limit: 100 workspaces per org). ClimbOS playbooks are global, so one workspace is fine.

**Audit logging:** the Skills guide links an "Audit logging" section. I did not read it; UNVERIFIED.

### 2.3 Using skills in a Messages request

Requirements:
- `container.skills`: at most **20 skills per request**. Each entry is `{type: "anthropic"|"custom", skill_id, version?}`.
- The code execution tool must be in `tools`. The docs' examples use `code_execution_20250825`. Use `code_execution_20260120` or later if the same request also has `web_search/web_fetch_2026xxxx` tools, because those require it.
- Container reuse: read `response.container.id` and send `container: { id, skills }` next time.
  - Containers are checkpointed after about 5 minutes idle and expire **30 days** after creation.
  - The `expires_at` field shows a shorter rolling value.
  - An expired container id returns an error; retry without it.
- Generated files: look for `file_id` inside `bash_code_execution_tool_result.content.content[]` (`bash_code_execution_result`). Download with `client.files.retrieveMetadata(id)` and `client.files.download(id)`.
- Long operations can return `stop_reason: "pause_turn"`. Re-send with the assistant content appended, using the same container and the same tools.

```ts
// convex/ai/skills.ts  ("use node" action or a CI script)
import Anthropic, { toFile } from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";

const client = new Anthropic();

/** Upload (or re-version) a skill folder kept in the repo at skills/<name>/ */
export async function syncSkill(dir: string, existingSkillId?: string) {
  const name = path.basename(dir); // must equal SKILL.md frontmatter `name`
  const files = await Promise.all(
    walk(dir).map(async (abs) =>
      toFile(fs.createReadStream(abs), `${name}/${path.relative(dir, abs)}`), // top-level folder prefix required
    ),
  );
  if (!existingSkillId) {
    const skill = await client.skills.create({ files, display_name: name });
    return { skillId: skill.id, versionId: skill.latest_version_id };
  }
  const v = await client.skills.versions.create(existingSkillId, { files }); // full snapshot
  return { skillId: existingSkillId, versionId: v.id }; // "skver_..."
}

function walk(d: string): string[] {
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );
}
```

```ts
// Messages request that mounts a pinned custom skill + an Anthropic skill
const res = await client.messages.create({
  model: "claude-sonnet-5-5",
  max_tokens: 16000,
  output_config: { effort: "medium" },
  container: {
    skills: [
      { type: "custom", skill_id: "skill_01AbC...", version: "skver_01XyZ..." }, // pinned
      { type: "anthropic", skill_id: "xlsx", version: "latest" },
    ],
  },
  tools: [{ type: "code_execution_20260521", name: "code_execution" }],
  messages: [{ role: "user", content: "Build the Q3 content calendar workbook from the brief below…" }],
});

// Continue a paused turn in the same container
let msg = res;
const history: Anthropic.MessageParam[] = [/* the original user message */];
for (let i = 0; msg.stop_reason === "pause_turn" && i < 5; i++) {
  history.push({ role: "assistant", content: msg.content });
  msg = await client.messages.create({
    model: "claude-sonnet-5-5",
    max_tokens: 16000,
    container: { id: msg.container!.id, skills: [/* same list */] },
    tools: [{ type: "code_execution_20260521", name: "code_execution" }],
    messages: history,
  });
}
```

### 2.4 Code-execution (container) pricing

- **Free** when the request also includes `web_search_20260209+` or `web_fetch_20260209+`. That covers the dynamic-filtering code and any code Claude runs directly.
- **Otherwise**, billed by execution time:
  - Minimum of 5 minutes per execution.
  - **1,550 free container-hours per org per month**, then **$0.05 per container-hour**.
  - Requests that include files are billed even if the tool isn't called, because files are preloaded.
- **Meter:** `usage.server_tool_use.code_execution_requests` appears in the docs JSON. The SDK `ServerToolUsage` type exposes only `web_search_requests` and `web_fetch_requests`, so read the field defensively.

### 2.5 Recommendation for ClimbOS playbooks

**Keep `skills/<name>/SKILL.md` in the repo as the source of truth.** A CI script syncs each skill to `/v1/skills` and stores `{skillId, versionId}` in a Convex table or config. Requests pin `versionId`.

**At runtime, choose per role:**

- **Text-only roles** (research, draft, critique and revise for social posts):
  - Load the SKILL.md body yourself and put it in a cached system block. Expose level-3 references through a cheap client tool, e.g. `read_playbook_file(path)`, or pre-select them in code.
  - This avoids a container, a code-execution tool and possible container-hour billing.
  - It keeps the request compatible with `output_config.format` and prompt caching.
  - It is deterministic and works on every model.
- **Roles that need scripts or file output** (xlsx calendars, pdf reports, image post-processing in Python): use `container.skills`.
- **Unverified combination:** whether `container.skills` plus `output_config.format` in one request is supported. Test before relying on it.

---

## 3. Server tools

### 3.1 Web search

**Versions**

| Version | Adds | Notes |
|---|---|---|
| `web_search_20250305` | Basic search | ZDR-eligible. The only version on Vertex AI. |
| `web_search_20260209` | Dynamic filtering: Claude writes code that filters results before they enter context | Claude 4.6+ models |
| `web_search_20260318` | Same as 20260209, plus `response_inclusion: "full" \| "excluded"` | `"excluded"` drops the nested server_tool_use/result pairs consumed by a completed code-execution call, cutting response size |

- **Dynamic filtering:** on 20260209+, `allowed_callers` defaults to `["code_execution_20260120"]` and the API provisions code execution automatically. **Do not add** your own `code_execution` tool (if you do, it must be `code_execution_20260120` or later). Set `allowed_callers: ["direct"]` to disable filtering; that is required for ZDR and for models without programmatic tool calling.
- **Price:** **$10 per 1,000 searches** (= 10,000 micro-USD per search), plus tokens for result content, which counts as input on this turn and later turns. Failed searches are not billed.
- **Meter:** `usage.server_tool_use.web_search_requests`.
- **Parameters:**
  - `max_uses`: exceeding it returns error `max_uses_exceeded` inside the result.
  - `allowed_domains` **or** `blocked_domains`, never both (400). Bare domains, no scheme. Subdomains are included automatically. Paths are allowed for search (`example.com/blog`). Wildcards only in the path. Request lists must be a subset of the org-level Console list.
  - `user_location: {type:"approximate", city, region, country (ISO-3166 alpha-2), timezone (IANA)}`.
  - `cache_control`, `strict` and `defer_loading` are also accepted (SDK type).
- **Citations:** always on. Text blocks carry `citations[]` of `web_search_result_location {url, title, encrypted_index, cited_text (≤150 chars)}`. Citation fields don't count toward tokens.
  - Results carry `encrypted_content`. **Pass assistant blocks back byte-for-byte**; a modified or missing `encrypted_content` causes a 400.
  - Display rules require showing citations to end users when outputs are shown directly.
- **Errors arrive inside HTTP 200.** `web_search_tool_result.content` is then an object `{type:"web_search_tool_result_error", error_code}` with codes `too_many_requests | invalid_tool_input | max_uses_exceeded | query_too_long | request_too_large | unavailable`. On success, `content` is a list. Branch on `Array.isArray`, as `convex/ai/providers.ts` already does.
- **Org setting:** if an admin disabled web search in the Console, the request fails with 400.
- **Batches:** supported at the same price, with per-org search throttling.
- **Platforms:** not on Bedrock. Vertex has the basic version only.

**Action for our code:** `convex/ai/providers.ts:109` uses `web_search_20250305`. Upgrade to `web_search_20260318` for Sonnet 5.5 and Opus 5.5:
- Dynamic filtering means fewer input tokens.
- Code execution becomes free in the request.
- Keep `response_inclusion: "full"` if we read result URLs from the blocks; `"excluded"` drops the nested results that dynamic filtering consumed.

### 3.2 Web fetch

**Versions:**
- `web_fetch_20250910`: basic.
- `web_fetch_20260209`: dynamic filtering.
- `web_fetch_20260309`: adds `use_cache: false` to bypass the fetch cache.
- `web_fetch_20260318`: adds `response_inclusion`. **No beta header.**

**Pricing:** **no extra charge**, tokens only. Typical sizes: a 10 kB page is about 2,500 tokens, a 100 kB doc about 25,000, a 500 kB PDF about 125,000. Meter: `usage.server_tool_use.web_fetch_requests`.

**Parameters:**
- `max_uses`: failed fetches count, and there is no default cap.
- `allowed_domains` / `blocked_domains`: domain-only matching; an entry with a path never matches a fetch.
- `citations: {enabled: true}`: off by default.
- `max_content_tokens`: approximate cap; applies to text, not PDFs.
- `use_cache` and `response_inclusion`: on the later versions above.
- The SDK type also has `url_sources` (undocumented here; UNVERIFIED).

**Limits:**
- It can only fetch URLs already present in the conversation: user messages, client tool results, or prior search/fetch results. It cannot fetch URLs that appear only in Claude's own output, the system prompt, or code-execution, MCP or tool-search results.
- URLs that appear to contain credentials are refused.
- URL length is at most 250 characters.
- HTML, text and PDF only (PDFs return as base64 documents). **No JavaScript-rendered pages.**
- Results may be cached server-side, and robots.txt and private addresses are blocked.

**Error codes:** `invalid_tool_input, url_too_long, url_not_allowed, url_not_in_prior_context, url_not_accessible, too_many_requests, unsupported_content_type, max_uses_exceeded, unavailable`.

**Security:** there is an exfiltration warning when untrusted input sits alongside sensitive data. Use `allowed_domains` and `max_uses`.

**Platforms:** not on Bedrock or Vertex.

### 3.3 Code execution (summary)

**Versions** (all GA, no beta):
- `code_execution_20250825`: bash and files.
- `code_execution_20260120`: adds REPL state persistence and programmatic tool calling.
- `code_execution_20260521`: same runtime; the tool description tells Claude about the **90-second per-cell** limit in programmatic tool calling.

**Result blocks:** `bash_code_execution_tool_result` and `text_editor_code_execution_tool_result`. **Not ZDR-eligible.** Container specs and pricing are in §2.

### 3.4 Server tools together with structured output

**What the docs confirm:**
- `output_config.format` works with tools.
- The grammar constrains **only Claude's direct output**, not tool calls, tool results or thinking. Claude can search freely and then emit schema-conformant final text.
- It works with streaming, batch and token counting.

**What the docs list as incompatible:**
- **Citations:** `citations.enabled` on documents with `output_config.format` returns 400.
- **Prefill.**

**Unverified:**
- **Web search plus `output_config.format`:** whether always-on web-search citations interact badly with the schema. The repo already sends exactly this combination (`providers.ts:102-110`). Confirm with a live smoke test and keep extracting sources from the `web_search_tool_result` blocks, not from citations.
- **Web fetch with `citations: {enabled: true}`** plus `output_config.format` probably triggers the citations 400. Inferred, not tested; keep fetch citations off in structured calls.

**Recommended shape (decoupled):**
- Research step: tools on, free-form findings, plus a source list you build from result blocks.
- Synthesis step: `output_config.format`, no tools.

A single combined call is acceptable once the smoke test passes.

**Schema limits:**
- `additionalProperties: false` is required on objects.
- Unsupported (400): `minimum/maximum/multipleOf`, `minLength/maxLength`, recursion, and `minItems` above 1.
- Per request: at most 20 strict tools, 24 optional params, 16 union-typed params.
- Compilation timeout is 180 s. Grammars are cached 24 h.
- **Changing `output_config.format` invalidates the prompt cache.**
- Required properties are emitted first.
- Enum casing may differ only in capitalization; compare case-insensitively.
- The SDK helpers (`zodOutputFormat`, `jsonSchemaOutputFormat`) move unsupported constraints into descriptions and validate them client-side.

### 3.5 `pause_turn` and mixed server/client tool turns

- **`pause_turn`:** the server-side loop paused a long turn.
  - Append `{role:"assistant", content: res.content}` **unchanged** and call again with the **same tools**. A paused turn may end on a `server_tool_use` whose tool hasn't run, and omitting that tool gives a 400.
  - Don't add a user message.
  - Cap continuations (e.g. 5).
  - In batches the per-turn iteration limit is higher but can still end in `pause_turn`.
- **Server tool plus client tool in the same parallel group:** `stop_reason` is `"tool_use"` (not `pause_turn`) and the server tool has **not** run.
  - Detect it as a `server_tool_use` id with no matching result block.
  - Reply with a user message containing **only** `tool_result` blocks. Any extra text gives a 400.
  - The next response starts with the deferred server tool's result.

```ts
// Research step: web search + fetch with dynamic filtering, pause_turn loop, metering
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ maxRetries: 2 });

const tools: Anthropic.ToolUnion[] = [
  { type: "web_search_20260318", name: "web_search", max_uses: 8,
    user_location: { type: "approximate", country: "US", timezone: "America/New_York" } },
  { type: "web_fetch_20260318", name: "web_fetch", max_uses: 6, max_content_tokens: 20000 },
];

export async function research(system: Anthropic.TextBlockParam[], brief: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: brief }];
  let totalSearches = 0, totalFetches = 0;
  for (let turn = 0; turn < 6; turn++) {
    const res = await client.messages
      .stream({
        model: "claude-sonnet-5-5",
        max_tokens: 32000,
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },          // auto breakpoint on the growing tail
        system,                                         // stable playbook + role prompt, has its own breakpoint
        tools,
        messages,
      })
      .finalMessage();
    totalSearches += res.usage.server_tool_use?.web_search_requests ?? 0;
    totalFetches += res.usage.server_tool_use?.web_fetch_requests ?? 0;
    messages.push({ role: "assistant", content: res.content }); // byte-for-byte (encrypted_content!)
    if (res.stop_reason === "pause_turn") continue;               // same tools, no new user msg
    if (res.stop_reason === "refusal") throw new Error(`refused: ${res.stop_details?.category}`);
    // collect sources from result blocks (not citations)
    const sources = res.content.flatMap((b) =>
      b.type === "web_search_tool_result" && Array.isArray(b.content)
        ? b.content.map((r) => ({ url: r.url, title: r.title, pageAge: r.page_age }))
        : [],
    );
    return { res, messages, sources, totalSearches, totalFetches };
  }
  throw new Error("research exceeded continuation cap");
}
```

---

## 4. Prompt caching, token counting, Batch API, rate limits

### 4.1 Prompt caching for agent loops

**Mechanics**

- Caching is a **prefix match** in the order `tools` → `system` → `messages`. Any byte change invalidates everything after it.
- At most **4** `cache_control` breakpoints per request.
- Top-level `cache_control: {type:"ephemeral"}` auto-places a breakpoint on the last cacheable block. This is the simplest moving breakpoint for loops.
- Minimum prefix is **512 tokens** on Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.1. Shorter prefixes silently don't cache.
- Caches are isolated **per workspace**.
- **20-block lookback:** a cache hit is found only within about 20 content-block positions before a breakpoint. A single turn that appends more than 20 blocks pushes the previous entry out, and every request rewrites. Put a breakpoint on the latest tool-result turn.

**TTL and pricing**

| TTL | Write cost | Read cost | Break-even |
|---|---|---|---|
| 5m (default) | 1.25x input | 0.1x input (0.05x on Opus 5.5 / Sonnet 5.5, 0.025x on Fable 5.1) | 2 requests |
| 1h (`ttl: "1h"`) | 2x input | same | 3 requests |

- A read refreshes the timer at no cost.
- The TTL runs from the **start** of the request, so a 4-minute generation leaves about 1 minute.

**Choosing a TTL**

| Start-to-start gap between steps sharing a prefix | TTL |
|---|---|
| Under 5 minutes | 5m |
| 5–60 minutes (critique and revise after a long draft, human-in-the-loop pauses, **Batch API runs**) | 1h |
| Over 1 hour | Neither; accept the cold miss or re-warm |

**Things that silently invalidate the cache:**
- Timestamps or UUIDs in the system prompt.
- Non-deterministic JSON key order or tool order.
- Changing `tools`, `output_config.format`, `speed` or a top-level `effort`.
- Editing earlier turns, which also breaks preserved thinking.
- Switching models: caches are model-scoped, so a multi-model cascade gives up cache reuse.

Put volatile content after the last breakpoint, or use mid-conversation `{role:"system"}` messages.

**Server tools:** web search auto-inserts 5-minute cache writes after tool results when caching is on. This is expected.

**Verify** with the usage fields:
- Total prompt = `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`.
- `usage.cache_creation.{ephemeral_5m_input_tokens, ephemeral_1h_input_tokens}` gives the TTL split.
- A healthy loop shows growing reads and small writes.
- Beta `cache-diagnosis-2026-04-07` with `diagnostics: {previous_message_id}` reports where two requests diverged. The beta header must be sent on every request.

**Pre-warming:** `max_tokens: 0` refreshes or writes the cache without output. It doesn't work with `stream: true`, structured outputs or Batches.

**Recommended block layout per role call:**

```text
tools (deterministic order)                          — rarely changes
system[0] = shared ClimbOS operating rules            — cache_control 1h (shared by all roles)
system[1] = role prompt + SKILL.md playbook body      — cache_control 5m/1h
messages  = brand context (stable per org) [breakpoint] → step inputs → growing loop tail [auto breakpoint]
```

### 4.2 Token counting

- **Endpoint:** `POST /v1/messages/count_tokens`. SDK: `client.messages.countTokens({...})` returns `{input_tokens}`.
- **Free**, with a separate rate limit: Start 5,000 / Build 10,000 / Scale 20,000 RPM.
- **Supports** system, client tools, the advisor tool, base64 images and PDFs, and thinking.
- **Errors on** server tools (web search, web fetch, code execution, tool search), MCP, and `url`/`file` image or document sources.
- Counts are an estimate and don't use caching.
- Use it for budgeting before a call. Replace `estimateTokens()`'s 4-chars heuristic for big prompts, since 5.x models use about 30% more tokens.

### 4.3 Batch API (use it for benchmark and eval runs)

- **Discount:** 50% on input and output. It stacks with caching multipliers.
- **Size limits:** at most **100,000 requests or 256 MB** per batch.
- **Timing:** most batches finish within 1 hour. Requests expire unprocessed after **24 h**, and expired requests aren't billed. Results stay available for **29 days**.
- **`custom_id`:** must match `^[a-zA-Z0-9_-]{1,64}$`. Results arrive in **any order**; key by `custom_id`.
- **Supported in batches:** tools, server tools (web search priced the same and throttled), structured outputs, thinking.
- **Not supported:**
  - Fast mode.
  - `fallbacks`.
  - `max_tokens: 0`.
  - Priority. The docs list no support for it; UNVERIFIED.
- **Caching in batches:** use **1h TTL** for shared prefixes, since processing can exceed 5 minutes.
- **Batch rate limits** (shared across models):

| Tier | RPM | Max requests in processing queue | Max requests per batch |
|---|---|---|---|
| Start | 1,000 | 200,000 | 100,000 |
| Build | 2,000 | 300,000 | 100,000 |
| Scale | 4,000 | 500,000 | 100,000 |

```ts
const batch = await client.messages.batches.create({
  requests: cases.map((c) => ({
    custom_id: `bench-${c.id}-${variant}`,
    params: {
      model: "claude-sonnet-5-5",
      max_tokens: 8000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: JudgeSchema } },
      system: [{ type: "text", text: JUDGE_RUBRIC, cache_control: { type: "ephemeral", ttl: "1h" } }],
      messages: [{ role: "user", content: c.prompt }],
    },
  })),
});
// Poll from a Convex cron/scheduled action: client.messages.batches.retrieve(batch.id).processing_status === "ended"
for await (const r of await client.messages.batches.results(batch.id)) {
  if (r.result.type === "succeeded") save(r.custom_id, r.result.message);
}
```

---

## 5. Agent-loop design and evals: Anthropic guidance applied to research → draft → critique → revise

### 5.1 Key points from Anthropic's posts

**"Building effective agents"** (Dec 2024) [link](https://www.anthropic.com/engineering/building-effective-agents)
- Prefer the simplest system that works. Workflows (code-defined paths) beat autonomous agents when the steps are known.
- Patterns: prompt chaining (with code gates), routing, parallelization (sectioning or voting), orchestrator-workers, **evaluator-optimizer**, and autonomous agents.
- Evaluator-optimizer fits when "criteria are clear and feedback measurably improves output".
- Invest in the agent-computer interface: clear tool docs, natural formats, and "poka-yoke" arguments (designed so mistakes are hard to make).

**Multi-agent research system** (Jun 2025) [link](https://www.anthropic.com/engineering/multi-agent-research-system)
- Setup: an orchestrator lead (Opus) with parallel subagents (Sonnet), +90.2% versus a single agent.
- Token usage explained about 80% of performance variance (95% together with tool-call count and model choice). A multi-agent system uses about **15x** chat tokens; a single agent about 4x.
- Scale effort to the task: simple queries get 1 agent and 3–10 calls; comparisons get 2–4 subagents.
- Search broad, then narrow. Give delegated tasks an explicit objective, output format and boundaries.
- A separate CitationAgent attaches sources.
- Evals started with **about 20 real queries**. A single LLM-judge call scored 0–1 plus pass/fail on factual accuracy, citation accuracy, completeness, source quality and tool efficiency.
- Humans caught SEO content-farm bias; prompt rules about source quality fixed it.
- Grade end state for state-changing agents.

**Context engineering** (Sep 2025) [link](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Context is a finite attention budget ("context rot").
- Write system prompts at the right altitude, with few canonical examples.
- Keep tool sets small and non-overlapping.
- Retrieve just in time via references.
- For long tasks use compaction, structured notes (NOTES.md or memory) and sub-agents that return 1–2K-token summaries.

**Writing tools for agents** (Sep 2025) [link](https://www.anthropic.com/engineering/writing-tools-for-agents)
- Consolidate tools around workflows.
- Namespace them (`climbos_brand_get`).
- Return names, not UUIDs.
- Offer a `response_format: concise|detailed` option (concise used about a third of the tokens).
- Paginate and truncate; Claude Code caps tool output at 25K tokens.
- Make errors actionable.
- Improve tools from eval transcripts using held-out sets.

**Harness design for long-running apps** (Mar 2026) [link](https://www.anthropic.com/engineering/harness-design-long-running-apps)
- Keep **planner, generator and evaluator separate**, because agents overrate their own work. A standalone evaluator is easier to tune to be skeptical.
- Calibrate it with few-shot examples and agree "done" criteria up front (sprint contracts).
- Each harness component encodes a model weakness, so re-test it on every model upgrade.

**Managed Agents architecture post** (Apr 2026) [link](https://www.anthropic.com/engineering/managed-agents)
- The session is a durable, append-only event log outside the context window. The harness can crash and resume.
- This maps directly onto Convex tables.

**Advisor strategy and tool** (beta `advisor-tool-2026-03-01`, tool `advisor_20260301` with `{model, max_uses, max_tokens, caching}`)
- A cheap executor consults a stronger advisor mid-turn; the advisor has no tools.
- Docs advice: call it early and again before finishing, and cap advisor output (about 2048 tokens).
- Pairing constraint: a `claude-sonnet-5-5` executor accepts only `claude-opus-5-5`, `claude-opus-5`, `claude-sonnet-5-5`, `claude-fable-5(-1)` or `claude-mythos-*` advisors, and its advice comes back **encrypted** (`advisor_redacted_result`).
- Use it as an alternative to a separate critique call when latency matters.

### 5.2 Recommended loop for ClimbOS roles

Build it as a code-controlled **workflow**: prompt chaining plus evaluator-optimizer. Only the research step is model-driven, through the server-side web-search loop.

1. **Plan and route** (Haiku 5.5, effort `low`, structured output). Classify the job, decide research depth and number of searches (effort scaling), and pick playbook references. If deterministic code can do this, skip the model call.
2. **Research** (Sonnet 5.5, `web_search_20260318` plus `web_fetch_20260318`, effort `medium`, `max_uses` set by the plan).
   - Output is notes plus a source list built from result blocks.
   - Persist notes and sources to the DB and pass **IDs**, not text, downstream (as the multi-agent post and Convex limits both suggest).
   - For wide topics, run 2–4 parallel research sub-calls (sectioning) and merge them.
3. **Draft** (Sonnet 5.5 or Opus 5.5, `output_config.format` = post schema, effort `medium`/`high`).
   - System prompt = role prompt + SKILL.md playbook (cached). Messages = brand context (cached) + research notes.
   - Optionally generate N=2–3 variants (voting) when quality matters more than cost.
4. **Critique** in a **separate call with fresh context**.
   - Prefer a different model from the drafter (e.g. Opus 5.5 judging a Sonnet draft, or vice versa) to reduce self-preference bias.
   - Use a per-criterion rubric (`score 1–5`, `pass`, `short_explanation`, `fix_instruction`), with structured output.
   - Don't add a "reasoning" field (risk of a `reasoning_extraction` refusal); let thinking do the reasoning.
   - Include an "unknown / can't judge" option.
   - Include code-based checks first: length, banned words, link and @-handle validity, hashtags, brand-term rules.
5. **Revise** (same model as the draft).
   - Inputs: draft + critique `fix_instruction`s only.
   - Append to the conversation; don't edit history (preserved thinking, caching).
6. **Stop** when every must-pass criterion passes, after **at most 2 revise rounds**, or when the score doesn't improve. Keep the best-scoring version, not the last one.

### 5.3 Running evals

- **Size:** start with **20–50 real tasks** drawn from failures. Split them into capability evals (low pass rate, used to hill-climb) and regression evals (near 100%, run on every change).
- **Repeat trials:** run several trials per task. Report pass@k for "can it" and **pass^k for consistency**.
- **Grade outcomes, not paths.** Give partial credit. Use separate judge calls per dimension.
- **Calibrate the LLM judge against human labels** before trusting it. Read transcripts: a CORE-Bench score went from 42% to 95% once grader bugs were fixed.
- **Rubric (pointwise) vs pairwise:**
  - Use **rubric/pointwise** scores for tracking over time and as gates inside the loop.
  - Use **pairwise** to decide between two prompt or model variants; it is more sensitive to small quality differences.
  - Pairwise mitigation for position bias: run both orders (A/B and B/A), count a win only if it is consistent, otherwise a tie, and randomize order.
  - Control **length bias** with rubric items about concision and length-matched comparisons.
  - Control **self-preference** with a different judge model.
  - (Sources: Zheng et al. 2023, MT-Bench; the length and self-preference papers are UNVERIFIED citations.)
- **Statistics** ("A statistical approach to model evaluations", Nov 2024):
  - Report the mean ± 1.96·SEM.
  - **Cluster standard errors** by brand or topic.
  - Use **paired differences** when comparing variants on the same tasks.
  - Average several samples per task to cut variance.
  - Run a power analysis before deciding the sample size.
  - Be skeptical of differences under about 3 points.
- **Cost:** run benchmark suites through the **Batch API** (50% off, 1h cache TTL for the shared judge rubric).

---

## 6. Claude Managed Agents and the Claude Agent SDK: tradeoffs against our own loop

**Claude Managed Agents** (beta `managed-agents-2026-04-01`, which the SDK sets on `client.beta.{agents,environments,sessions,vaults,deployments}`)

- **What it is:** Anthropic runs the agent loop *and* hosts a per-session container.
  - You create a versioned **Agent** once (`model`, `system`, `tools`, `mcp_servers`, `skills`), then start **Sessions** that stream events over SSE.
- **Features:**
  - **Outcomes:** `user.define_outcome` with a rubric; a separate grader iterates the agent until the rubric passes or `max_iterations` is reached. This is a managed evaluator-optimizer.
  - Multi-agent rosters.
  - Scheduled deployments.
  - Memory stores (beta `agent-memory-2026-07-22`).
  - Vault credentials.
  - Hard dollar session budgets.
- **Pricing:** model tokens plus **$0.08 per session-hour** while `running`. This replaces container-hour billing. There is no Batch discount.
- **Limits:** 300 create RPM and 1,200 read RPM.

**Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`): Claude Code's harness packaged as a library.
- Built-in Read, Write, Edit, Bash, Grep, WebSearch and WebFetch tools, plus MCP, subagents, hooks and sessions.
- You host it, so it needs a filesystem and long-lived process. That fits Convex actions poorly.

**The SDK's Tool Runner** (`client.beta.messages.toolRunner` + `betaZodTool`) is a thin loop helper over `/v1/messages`.

**Tradeoffs**

| | Own loop (chosen) | Managed Agents | Agent SDK |
|---|---|---|---|
| Control over steps, gates, caching, metering | Full | Partial (event stream) | Hooks |
| Fits Convex (stateless, 10-min Node actions) | Yes, with a workflow/step per call | Yes: hosted runtime; Convex only starts sessions and handles webhooks | Poor (needs a persistent process and filesystem) |
| Per-call micro-USD metering | Exact from `usage` | Session-level (tokens + runtime) | From SDK results |
| Batch API for evals | Yes | No | No |
| Built-in grader loop, long-running sandbox, multi-agent | Build it yourself | Built in | Partly |
| Platform dependency and beta risk | Low (GA Messages API) | Beta | Medium |

**When the alternatives would win:**
- **Managed Agents:** runs longer than about 10 minutes of continuous tool use, file-heavy or code-execution work, scheduled autonomous jobs, or wanting rubric-driven outcomes without building them.
- **Agent SDK:** a coding or filesystem agent on our own servers.

For short, metered, schema-bound content generation, our own loop is the right call.

---

## 7. Convex constraints for long agent runs

Sources: [limits](https://docs.convex.dev/production/state/limits), [runtimes](https://docs.convex.dev/functions/runtimes), [scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions), [Agent component workflows](https://docs.convex.dev/agents/workflows).

### Limits

**Action timeout**
- **Node runtime (`"use node"`): 10 minutes.**
- Default V8 runtime: **30 minutes** per the limits page and the Agent docs. `functions/actions` still says 10 minutes for all actions, so the docs conflict.
- **Design for 10 minutes per step.**
- Queries and mutations get 1 s of user-code time.

**Memory:** Node 512 MiB; V8 64 MiB.

**Sizes**

| Item | Limit |
|---|---|
| Action arguments | 16 MiB (**Node: 5 MiB**) |
| Action return value | 16 MiB |
| Document | 1 MiB |
| Scheduled-function args | 4 MiB each, 16 MiB total per mutation. The scheduling page says 1000 functions / 8 MB total, which conflicts. |
| Concurrent I/O per function | 1000 |

**Concurrency**

| Plan | Queries / mutations | V8 + HTTP actions | Node actions | Scheduled jobs |
|---|---|---|---|---|
| Free / Starter | 16 | 64 | 64 | **8** |
| Professional | 256 | 512 | 256 | 256 |

**Billing**
- Function calls: Free 1M/month; Starter 1M, then $2.20 per extra million; Professional 25M included.
- Action compute: Free/Starter 20 GB-hours/month; Professional 250 GB-hours included.
- My estimate: an 8-minute Node action at 512 MB uses about 0.068 GB-hours. This assumes billing is memory × wall-clock time; UNVERIFIED.

**Per-fetch timeout:** none documented; UNVERIFIED. The action timeout is the only known cap.

### Scheduler

- `ctx.scheduler.runAfter(ms, fn, args)` and `runAt(ts, …)`.
- Scheduling **from a mutation is atomic**. Scheduling from an action is not.
- Scheduled **mutations run exactly once** with auto-retry. Scheduled **actions run at most once** and fail permanently on transient errors; Convex suggests a checking mutation that reschedules.
- At most 1000 scheduled functions per mutation. Results are kept for 7 days. Auth is **not** propagated, so pass the user or org id in the arguments.

### Components (none installed yet)

**`@convex-dev/workflow`**
- Durable, journaled steps (`step.runAction/runMutation/runQuery`), plus `step.sleep`, `awaitEvent`, cancel, restart-from-step and `getStatus`.
- The handler replays, so it **must be deterministic**: put fetch, env and crypto inside steps. Changing step order breaks in-flight workflows.
- Actions aren't retried unless `retryActionsByDefault` or a per-step `retry` is set; retry options are `{maxAttempts, initialBackoffMs, base}`.
- `workpoolOptions.maxParallelism` caps concurrent steps.
- **Step args plus returns: about 1 MB total per workflow execution.** Journal: 8 MiB.
- Cancel doesn't stop a running action. There is no auto-cleanup.

**`@convex-dev/workpool`**
- A queue with `maxParallelism`; `onComplete` is always called.
- Keep total parallelism **at most 20 on Free and at most 100 on Pro** across all pools and workflows.
- `NonRetryableError` stops retries.

**`@convex-dev/action-retrier`**
- Retries idempotent actions with backoff (defaults: 250 ms initial, base 2, 4 failures).

**`@convex-dev/agent`**
- DB-backed threads built on the AI SDK. `saveStreamDeltas: {chunking, throttleMs}` writes stream chunks into the DB for reactive UIs; `DeltaStreamer` does the same for custom loops.
- We are not using the AI SDK, but the delta-to-DB pattern is worth copying.

### Recommended pattern

1. A mutation creates an `aiRuns` row and calls `workflow.start(…)`. Use one workflow per job.
2. Use **one `step.runAction` per LLM call**: plan → research (each `pause_turn` continuation can be its own step) → draft → critique → revise×≤2.
3. Each action:
   - Loads inputs by id.
   - Calls Anthropic with **streaming** and an SDK `timeout` below the action budget (e.g. 8 min Node).
   - Writes throttled text deltas to a `runDeltas` table (about 500 ms).
   - Writes the final message, usage and `costMicros` atomically via `ctx.runMutation`.
   - Returns only ids.
4. Make retries idempotent: key steps by `(runId, stepName, attempt)`, and check whether the step's output already exists before calling the model again.
5. Budget guard: a mutation checks the org's micro-USD budget before each step, so the workflow stops cleanly.
6. Fan-out (parallel research sub-calls, eval suites) goes through `Promise.all` steps or a Workpool. Evals go through the **Batch API**, polled by cron instead of held open in actions.
7. UNVERIFIED but worth testing: `@anthropic-ai/sdk` is fetch-based and may run in the **default V8 runtime**, which would give a 30-minute budget. If it works, long Opus calls can move out of `"use node"`.

### Outbound TCP (SMTP 587 / IMAP 993) from Node actions: UNVERIFIED

- Convex docs say nothing about `net` or `tls` sockets or port restrictions. The V8 runtime exposes only `fetch`.
- Community Discord threads (seen only via search snippets) report Nodemailer trouble under `"use node"`, and a staff remark that Node actions run on AWS Lambda.
- If Node actions do run on Lambda, port 25 is blocked by default while 587, 465 and 993 normally work (inference).
- Long-lived IMAP IDLE doesn't fit a 10-minute, at-most-once action.
- **Before committing to it:** run a 5-minute spike (`tls.connect` to `smtp.example:587` and `imap.example:993`, then `nodemailer` and `imapflow`) in a `"use node"` action.
- **Fallback:** an HTTPS email API (Resend, already a vendor; Gmail or Graph APIs for inbox reads), or a small external worker for IMAP.

Threads: [1](https://discord-questions.convex.dev/m/1266394057475752058), [2](https://discord-questions.convex.dev/m/1178769033705824367), [3](https://discord-questions.convex.dev/m/1344772551339016203).

---

## 8. Gemini (brief)

Prices are per 1M tokens, Standard tier. Batch is 50% off. All ids are present in the `@google/genai` 2.30.0 `Model` union. Sources: [pricing](https://ai.google.dev/gemini-api/docs/pricing) (updated 2026-10-16), [models](https://ai.google.dev/gemini-api/docs/models), [deprecations](https://ai.google.dev/gemini-api/docs/deprecations).

### Image models

| Model id | Status | Price per image (Standard) | Notes |
|---|---|---|---|
| `gemini-nano-banana-2.1` (Nano Banana 2.1) | GA 6 Oct 2026, Google's recommended default | 1K $0.0336, 2K $0.0504, 4K $0.113 | Input $1.50, image output $30/M |
| `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) | GA 30 Jun 2026 | **1K only, $0.0336** | Input $0.25. 65,536 input / 4,096 output tokens. No search grounding or caching. Weak at multi-reference and multi-turn editing. |
| `gemini-3.1-flash-image` (Nano Banana 2) | **Deprecated 6 Oct 2026** | 0.5K $0.045, 1K $0.067, 2K $0.101, 4K $0.151 | |
| `gemini-3-pro-image` (Nano Banana Pro) | GA | 1K or 2K $0.134, 4K $0.24 | `-preview` id shut down 25 Jun 2026 |
| `gemini-2.5-flash-image` | Deprecated | | Shutdown date conflicts between Google pages (UNVERIFIED) |
| Imagen 4 (`imagen-4.0-*`) | **Shut down 17 Aug 2026** | | |

- `imageSize` values need an uppercase K ("1K").
- Image search grounding is available only on Nano Banana 2.1 and 2: 5,000 free per month, then $14 per 1,000.

### Text models

| Model id | Status | Input / output | Notes |
|---|---|---|---|
| `gemini-4-argon` | GA 13 Oct 2026, top model | $2 / $10, rising to **$4 / $20 from 1 Dec 2026** | Context 1,048,576 / output 65,536. Implicit caching only. No free tier. |
| `gemini-3.8-flash` | GA | $0.75 / $3.75, rising to **$1.50 / $7.50 from 1 Jan 2027** | Thinking `low|medium|high`; `minimal` returns an error |
| `gemini-3.5-flash-lite` | Stable | $0.30 / $2.50 | |
| `gemini-3.1-flash-lite` | Stable | $0.25 / $1.50 | |
| `gemini-3.1-pro-preview` | Preview only | $2 / $12 up to 200K, $4 / $18 above | There is no GA Gemini 3.x Pro. |

**Grounding with Google Search** (Gemini 3+): 5,000 free per month, then $14 per 1,000.

**Batch:** 50% off, 24 h target, jobs expire at 48 h.

**Caching:**
- Implicit caching has a 4,096-token minimum on the newer models. Cache reads cost 10% of input.
- Storage costs $0.50–$4.50 per M tokens per hour (no write fee).
- Explicit caching is not available on Gemini 4 Argon.

### Repo impact

- `shared/ai/models.ts`'s premium image route uses `gemini-3.1-flash-image`, which is deprecated. Move it to `gemini-nano-banana-2.1`: 2K costs $0.0504 versus $0.101.
- The standard route (`gemini-3.1-flash-lite-image`, 1K, $0.0336) is current.
- `rates.ts` uses Gemini `cacheWritePerM` = the input price. Google charges storage per hour, not writes. This is harmless while the rate cards assume no caching.
- Plan for the 1 Jan 2027 price change on `gemini-3.8-flash`.

---

## 9. Blockers and action items

1. **Forced `tool_choice` returns 400 on Opus 5.5 and Sonnet 5.5.** Our loop must use `output_config.format` for every structured step. Already the case in `providers.ts`.
2. **Web search plus `output_config.format` in one call** is undocumented either way, and the repo already does it. Add a live smoke test. Keep web-fetch citations off in structured calls.
3. **Opus 5.5 can't disable thinking, and its default effort is `medium`.** Always set `output_config.effort`. Meter `output_tokens_details.thinking_tokens`, which is billed inside `output_tokens`.
4. **Keep the loop append-only:** preserved thinking and prompt caching both break on history edits.
5. **Upgrade web tools** to `web_search_20260318` and `web_fetch_20260318`. Add a 1h cache-write rate to `rates.ts` and a meter for code-execution hours (only charged if code execution runs without web tools).
6. **Skills:** keep them in the repo and sync to `/v1/skills` with pinned `skver_` ids. Inline SKILL.md into cached system prompts for text roles; use `container.skills` only where scripts or files are needed. Skills are **not ZDR** and are workspace-wide.
7. **Convex:** 10-minute Node actions mean one LLM call per durable step. Install `@convex-dev/workflow` (and Workpool for fan-out). Free plan limits: 8 concurrent scheduled jobs and about 20 recommended parallel steps.
8. **SMTP/IMAP from Convex is unverified.** Spike it or use HTTPS email APIs.
9. **Gemini:** migrate the premium image route off the deprecated `gemini-3.1-flash-image`.
