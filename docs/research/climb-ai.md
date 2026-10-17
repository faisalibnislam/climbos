# Climb AI: in-app agent panel, point mode and MCP server

Researched 18 Oct 2026 for **Climb AI**: the ClimbOS side-panel agent that understands the current screen, acts on any screen, has a "point mode" for selecting things to ask about, and exposes the workspace to outside agents through MCP.

**Sources.** Primary docs fetched today, linked inline; **UNVERIFIED** marks unconfirmed claims. Search budget ran out early, so Figma AI layer selection, Arc/Dia, Microsoft Copilot, Agentforce and HubSpot Breeze are **not covered** (pages failed to load or lacked the feature).

**MCP versions.**
- **2025-06-18** added structured output, elicitation and resource-indicator auth.
- **2025-11-25** added Client ID Metadata Documents (CIMD), step-up scopes, tool-name rules and URL elicitation.
- **2026-07-28 is the latest.** It is **stateless**: no `initialize`, no `Mcp-Session-Id`, and a new `server/discover`. It adds Multi Round-Trip Requests (`resultType: "input_required"`) in place of server-initiated elicitation, deprecates Dynamic Client Registration (DCR) in favour of CIMD, and adds cache hints on list results ([changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)).
- Stripe's docs already cite 2026-07-28. **Build stateless now**: that works for every version.

---

## 1. Point / select-to-ask in shipped products

| Product | Interaction | How the selection reaches the agent |
|---|---|---|
| **Lovable** ([docs](https://docs.lovable.dev/features/visual-edit)) | "Select elements" button or `S`, then click. **Cmd/Ctrl-click** adds more. | Each element attaches to the chat input as a reference, and one prompt applies to all. Mode switching is blocked until you send or discard. |
| **v0 Design Mode** ([docs](https://v0.app/docs/design-mode)) | The cursor "becomes a selection tool" and elements highlight on hover. Click shows handles plus a design panel. `Cmd/Ctrl+I` toggles, `Esc` deselects. | The prompt box **auto-attaches a screenshot of the element**. Edits stay *pending* (undo/redo/reset, before/after) until **Apply**, which creates a diffable, revertible version. Warns before you leave with unapplied edits. |
| **Figma Make** ([blog](https://www.figma.com/blog/introducing-figma-make/)) | Select an element on the canvas and describe the change. | The selection is the context. |
| **Intercom Copilot** ([help](https://www.intercom.com/help/en/articles/8587194-use-copilot-to-answer-customer-questions)) | **Highlight text, then "Ask Copilot"**, or `⌘K`. Lives in a right-sidebar tab, and `]` hides it. | Uses the open conversation as context and cites its sources. Output goes **"Add to composer"**, never straight out. `Tab` inserts and `Esc` dismisses suggestions. |
| **Notion Agent** ([help](https://www.notion.com/help/notion-agent)) | Right sidebar or floating window. | Defaults to the **current page**, **selected blocks narrow the focus**, and `@` adds context. It has the user's permissions but can't share pages or change permissions. Confirms Gmail sends. Edits can be accepted, discarded or retried ([FAQ](https://www.notion.com/help/notion-ai-faqs)). |
| **Linear Agent** ([docs](https://linear.app/docs/linear-agent)) | `⌘/Ctrl+J` chat with tabs, or `@Linear` in comments. | Uses the item being viewed. Good chats are saved as **skills** and invoked by slash command. |
| **Gemini in Chrome** ([overview](https://gemini.google/overview/gemini-in-chrome/)) | Icon or shortcut, and acts only when invoked. | Current tab, or several tabs together. |

**Patterns to copy**

- Selections become composer chips, so prompts stay short ("make this friendlier").
- The cursor visibly changes; hover outlines snap to meaningful components, not raw DOM nodes.
- Modifier-click multi-selects, one shortcut toggles the mode, `Esc` backs out. Highlight-to-ask is the text version.
- Edits stay safe with Pending/Apply plus versions (v0) or accept/discard/retry (Notion).
- **Accessibility gap.** None of these docs describe a keyboard alternative to pointing. WCAG 2.2 SC 2.5.7 requires any drag, such as a region rectangle, to also work with a single click ([W3C](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)). A full keyboard path is our chance to do better.

---

## 2. Agentic action UX

**What shipped agents do**

- **Chrome's agent:** asks before purchases, payments, **sending messages** and sensitive sites; shows a **work log**; users can **watch, pause, take over or stop** ([Google](https://blog.google/security/architecting-security-for-agentic/)).
- **Claude for Chrome:** asks before **publishing, purchasing or sharing personal data**; access is granted per site ([Claude](https://claude.com/blog/claude-for-chrome)).
- **Stripe MCP:** refunds and outbound payments need human approval via a **review URL**; approval yields a retry token, and requests expire in 24h ([Stripe](https://docs.stripe.com/mcp)).
- **The MCP spec:** hosts SHOULD keep "a human in the loop with the ability to deny tool invocations", show "clear visual indicators when tools are invoked", and show tool inputs before calling ([tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)).

**Act-vs-ask rule.**
- **Act directly** only when the action is internal to ClimbOS, reversible, and inside what the user asked for. Otherwise ask.
- **Act:** drafts, tags, filters, navigation, filling (not submitting) forms.
- **Act, then show a diff with Undo:** edits to existing content, and small batches.
- **Always confirm:** anything that leaves ClimbOS (publish, send, reply, ad spend, invite, export), bulk or destructive changes, and settings.

**What feels magical but trustworthy to non-technical owners**

1. **Live narration in their nouns.** "Looking at your 6 drafts for next week…", shown as collapsible work-log rows.
2. **Show where it works.** Scroll the target into view and pulse an outline on the element being read or changed. Highlighting a real element beats a fake ghost cursor. Never block the user's input.
3. **Preview before commit.** Inline before/after diffs with Apply / Edit / Discard.
4. **Undo everywhere.** Toast plus durable per-message Revert (`artifactVersions`); outbound items wait in a send queue ("Publishing in 30s · Cancel").
5. **Hand back control.** Stop replaces Send while running; any user click or keystroke pauses agent UI actions; runs end with "Done: 3 posts updated · Review".
6. **Honest errors.** Say what failed and what already happened; offer Retry / Do it myself / Undo partial. No success claim without an `actionReceipts` row.
7. **Grounded answers.** Numbers link to their source chart or record.

---

## 3. Context grounding

- **Structured state beats pixels.** Playwright MCP gives models **accessibility snapshots, not screenshots**, for speed and "deterministic tool application" ([repo](https://github.com/microsoft/playwright-mcp)). In our own app we can do better than the a11y tree: each screen publishes semantic context (route, entity IDs, visible items, filters, selection, unsaved drafts, allowed actions).
- **Page-registered tools are being standardized.** **WebMCP** is a W3C community draft from Microsoft and Google authors. A page calls `document.modelContext.registerTool({name, description, inputSchema, execute})` and its own code performs the action. `execute` must **re-validate inputs, authorization and preconditions** ([repo](https://github.com/webmachinelearning/webmcp)). Mirror the shape, but don't depend on browser support.
- **Prior art:** CopilotKit `useFrontendTool` ([docs](https://docs.copilotkit.ai/frontend-tools)); AG-UI streaming with approve/edit/retry interrupts ([AG-UI](https://docs.ag-ui.com/introduction)).
- **Screenshots only where meaning is visual.** For design layers, post previews and charts, send a crop from **our own renderer** plus the layer JSON.
- **Tool design** ([Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)): few workflow-level tools namespaced by resource; readable fields, not bare UUIDs; `response_format` concise|detailed; default pagination and truncation; errors that say how to fix the call; descriptions written for a new hire.
- **The risk tier lives on the server, not in the model.** Annotations from untrusted servers are untrusted, and ChatGPT's docs say "your server must still enforce its own authorization" ([Apps SDK](https://developers.openai.com/apps-sdk/reference)).
- **Streaming.** Stream tokens, step events and **partial results** (each post card appears as it finishes). Over MCP, use progress notifications or the tasks extension.

---

## 4. Security

**OWASP LLM Top 10 2025** ([OWASP](https://genai.owasp.org/llm-top-10/)) items that matter here:

**LLM01 Prompt Injection** (comments, DMs, inbound email, scraped sites, enrichment data and uploads are all attacker-controllable), **LLM02 Sensitive Info Disclosure** (contacts, revenue, cross-tenant), **LLM05 Improper Output Handling** (exfiltration via remote images or links), **LLM06 Excessive Agency**, **LLM07 System Prompt Leakage** (no secrets in prompts) and **LLM10 Unbounded Consumption**.

**The "lethal trifecta"** ([Willison](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)): private data, plus untrusted content, plus external communication, means exfiltration. Classifiers can't reliably stop it, so break the combination. Climb AI has all three, so **every outbound send must pass a human tap showing exact recipients and content.**

**Defenses are still imperfect.**
- Claude for Chrome measured **23.6%** attack success without mitigations and **11.2%** with them. A browser-specific set fell from **35.7% to 0%** ([Claude](https://claude.com/blog/claude-for-chrome)).
- A later update reports about **1%**, which Anthropic calls "meaningful risk" ([Anthropic](https://www.anthropic.com/research/prompt-injection-defenses)).
- Chrome adds an isolated **User Alignment Critic** that sees only action metadata and can veto, **origin sets** that limit what is readable and writable, and a parallel injection classifier ([Google](https://blog.google/security/architecting-security-for-agentic/)).

**Controls for ClimbOS** (detailed in §6):

1. Wrap third-party text in `<untrusted source="…">` delimiters, treat it as data, and strip hidden text from scraped HTML.
2. **Taint escalation.** After a run reads untrusted content, later writes in that run go up one tier. Recipients never come from tool output.
3. **Server-enforced approval.** T3 executes only with a single-use token **bound to a hash of the exact arguments**, minted by the user's tap and expiring. This reuses `approvals` and `autonomyPolicies`, and EngineV2's always-ask gates apply to the agent too.
4. The agent acts **as the user, with the user's role** (`shared/policy`). Every query is indexed by `orgId`.
5. Agent markdown: remote images off, link hosts shown, no workspace data in URLs.
6. Every call is written to `auditEvents` as "Climb AI / MCP client X on behalf of user Y", with argument summaries and no tokens or raw emails.
7. Step, token and daily-T3 caps.
8. Optional cheap critic: sees only {request, action, args}, flags mismatches on the card.

---

## 5. MCP server best practices

**Transport.**
- Streamable HTTP: one endpoint, each JSON-RPC message its own POST, answered as JSON or SSE.
- **Validate `Origin`** (403 if invalid) and authenticate every request. Honour `MCP-Protocol-Version` and return 400 for unsupported versions ([transports](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)).
- In 2026-07-28, cross-call state uses server-minted handles. These **must be bound to the authenticated user** and never treated as auth ([security](https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices)).
- Return tools in a deterministic order. `tools/list` may vary by the caller's scopes.

**Auth** ([authorization](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)):
- **MUSTs:** Protected Resource Metadata (RFC 9728) with a 401 `WWW-Authenticate` challenge; AS metadata (RFC 8414); clients use **PKCE** and **`resource` (RFC 8707)**; the server **validates audience** and **never passes tokens through**; no tokens in query strings; rotating refresh tokens for public clients.
- **Client registration:** CIMD is preferred. DCR is deprecated but common, so support both.
- **Step-up:** use a `WWW-Authenticate scope="…"` challenge. No omnibus scopes, and don't publish every scope up front.
- **Consent page:** names the client, shows scopes and redirect URI, uses CSRF protection, and sets `frame-ancestors`.
- **API keys:** Linear also accepts an API key as Bearer ([Linear](https://linear.app/docs/mcp)). Stripe pairs OAuth with scoped "agent API keys" and stops accepting unrestricted keys on MCP after 30 Nov 2026 ([Stripe](https://docs.stripe.com/mcp)).
- **Convex Auth** handles sign-in but is not an OAuth authorization server. We would build our own, as Next.js route handlers on Convex tables. **UNVERIFIED** that no Convex component already does this.

**Tools** ([tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)):
- **Names:** 1–128 chars of `[A-Za-z0-9_.-]`, unique per server. Aggregating clients prefix them.
- **Annotations:** `readOnlyHint` (default false), `destructiveHint` (default true), `idempotentHint` (default false), `openWorldHint` (default true).
  - **UNVERIFIED** defaults (schema page too large to fetch); confirm when implementing.
  - ChatGPT **requires** read-only, destructive and open-world, and uses `destructiveHint` to gate approval. A private workspace is *not* "open world" ([Apps SDK](https://developers.openai.com/apps-sdk/reference)).
  - Set all four explicitly.
- **Output:** `outputSchema` plus `structuredContent`, with a text mirror.
- **Errors:**
  - Unknown tool or malformed request: JSON-RPC error.
  - Validation, business-rule or upstream failure: `isError: true` with actionable text, so the model can self-correct.
- **Paging and limits:**
  - Opaque `cursor` pagination.
  - Servers **MUST** "validate all tool inputs… rate limit tool invocations… sanitize tool outputs".
- **Asking the user:**
  - Elicitation must not request sensitive info ([elicitation](https://modelcontextprotocol.io/specification/2025-06-18/client/elicitation)).
  - URL elicitation (2025-11-25) or MRTR (2026-07-28) can open our approval page.
  - Client support varies, so Stripe's approval-URL pattern is the robust baseline.

**How SaaS companies shipped remote MCP**

| Company | Endpoint | Auth | Notable |
|---|---|---|---|
| Linear | `mcp.linear.app/mcp` (SSE deprecated) | OAuth 2.1 + DCR; API key | **Read-only endpoint** `/mcp/readonly`, or the `read` scope |
| Notion | hosted ([docs](https://developers.notion.com/docs/mcp)) | OAuth per client | User's permissions; owners manage clients; admins revoke via API |
| Stripe | `mcp.stripe.com` | OAuth per environment; agent keys | Generic `stripe_api_read` / `stripe_api_write` keeps context small; **approval URL for refunds and payouts**; revocable sessions; admin on/off switch |
| HubSpot | `mcp.hubspot.com` ([docs](https://developers.hubspot.com/mcp)) | OAuth 2.0 (moving to 2.1) | CRM read/write; marketing read-only; sensitive props excluded |
| Asana | `mcp.asana.com/v2/mcp` ([docs](https://developers.asana.com/docs/using-asanas-mcp-server)) | OAuth | V1 SSE sunset; admins block clients |
| Atlassian | `mcp.atlassian.com/v2/mcp` ([docs](https://support.atlassian.com/atlassian-rovo-mcp-server/docs/getting-started-with-the-atlassian-remote-mcp-server/)) | OAuth 2.1 or API token | **Risk-tiered meta-tools** `discover` → `executeRead` / `executeWrite` / `executeDestructive` (seen in its live tool instructions) |
| Zapier | `mcp.zapier.com` ([page](https://zapier.com/mcp)) | Zapier-managed | User picks the exposed actions; History logs every call; per-action admin controls |

**Consequential actions over MCP.** Expose `*_request` tools that create a pending approval and return `{status: "pending_approval", approval_url, expires_at}`. The owner approves in ClimbOS, and the agent polls `approvals_get` or retries. Only fully automatic workspaces with `actions:execute` skip this, and the always-ask gates still apply.

---

## 6. Design spec for ClimbOS (builder checklist)

**A. Panel**

1. **Placement.** Right panel, 400px, resizable 360–560px.
   - Pushes content at ≥1280px, overlays below that, and is a full-screen sheet on mobile.
   - `⌘/Ctrl+J` and a top-bar launcher toggle it. Open state and width are saved in `userPreferences`.
2. **Header.** Title, a **context pill** ("On: Posts › Week of 20 Oct", removable), New chat, History, Close.
3. **Body.**
   - Messages, a collapsible **work log**, and **action cards** (diff, confirm, receipt).
   - Empty state: suggestions specific to each screen ("Plan next week's posts", "Why did reach drop?").
4. **Composer.** Chips row (page chip plus selection chips), textarea, **Point** button (crosshair, `⌘/Ctrl+I`), Attach, and Send, which becomes **Stop** while running.
5. **States:** idle · thinking · acting (work log plus on-page outline) · awaiting confirmation (card pinned above the composer) · done (receipt plus Undo) · error (Retry / Do it myself / Undo partial) · out of credits (top-up) · offline.
6. **Navigation.** Chat persists across pages (`chatMessages`); agent navigation is announced ("Opening Leads…") with a Back link.

**B. Point mode**

7. **Pointable components.** Meaningful components are wrapped in `<ClimbTarget kind id label actions>`, which renders `data-climb-target` and registers with a client **context registry** (`getContext()` returns JSON). Only registered targets are pointable.
8. **Enter** (Point button, `⌘/Ctrl+I`, or right-click "Ask Climb AI about this"):
   - The cursor becomes a crosshair with a Climb badge (custom cursor, `crosshair` fallback).
   - A banner reads "Point at anything · Shift-click to add · Esc to exit".
   - The page stays live.
9. **Hover.** A 2px sunrise (#FF9A4D) outline, 4px offset and 8px radius, snapping to the nearest target. A **label tag** names it in user words ("Post · Fall promo · Draft").
10. **Select.**
    - Click selects; **Shift- or Cmd-click** toggles more.
    - Each selection gets a numbered dashed outline that matches a numbered **chip** (icon, label, ×). Hovering a chip highlights its element.
    - A mini menu offers **Ask · Improve · Explain · Fix**, and typing goes straight to the composer.
11. **Region.** Drag a rectangle to select every target it covers. Click and keyboard paths cover WCAG 2.5.7.
12. **Keyboard.**
    - `Tab`/`Shift+Tab` move through targets in reading order, `↑` goes to the parent, `↓` to the first child, and `Enter`/`Space` selects.
    - `aria-live` announces "Post, Fall promo, selected, 2 items". `Esc` clears the hover, then exits.
    - Every card has "⋯ → Ask Climb AI" for touch and screen readers.
13. **Chip payload.** `{kind, id, label, route, fields, actions, bbox}`, plus a renderer PNG crop **only** for design layers and charts. Selections persist until sent; leaving the page warns first.
14. **Special surfaces.** Design-editor layers are targets, and their edits are pending until Apply. A chart point or series is a target carrying its numbers. Table rows and cells are targets.

**C. Confirmation tiers** (server-enforced; the tier is part of each tool's definition)

15. **T0 Read.** Queries, summaries, navigation, highlight. Run freely.
16. **T1 Reversible internal.** Drafts, tags, notes, filters, plan items, and edits to 10 or fewer items. **Act**, show an inline diff, a 10s Undo toast and a durable Revert.
17. **T2 Impactful internal.** Bulk edits over 10 items, soft deletes, brand kit, autonomy or schedule settings. An **inline confirm card** with diff and counts. Undo is still available.
18. **T3 External or irreversible.** Publish or schedule, send email or sequences, DM or comment replies, ad spend, invites, contact export, connect or disconnect channels. The confirm card shows exact recipients, preview, channel, time and cost. Execution needs an **args-bound approval token**, follows the workspace approval mode and always-ask gates, and gets a **30s cancel window**.
19. **T4 Never by agent.** Payment methods, roles and ownership, workspace deletion, API keys, OAuth app connections. **Deep-link** to settings and explain the steps.
20. **Taint rule.** After reading comments, DMs, inbound email, scraped pages or imported CSVs, later writes in the run go up one tier. Recipients never come from untrusted text.
21. **Limits.** 25 steps per run, a token budget per run reserved through `usageReservations`, and Stop always works.
22. **Audit.** Every call writes `auditEvents` (actor `climb_ai` or `mcp:<client>`, on behalf of the user ID, tier, approval ID, receipt). The Activity view gets a "by Climb AI" filter.

**D. Tool list** (one registry, two transports: panel and MCP)

23. **Read (T0):**
    - `workspace_get`, `plan_get`, `goals_list`
    - `posts_list`, `posts_get`, `calendar_get`
    - `campaigns_list`, `leads_search`, `leads_get`
    - `inbox_threads_list` (untrusted-marked)
    - `metrics_query` (named metrics plus date range, no raw queries)
    - `approvals_list`, `activity_list`
24. **Draft (T1):** `posts_draft_create`, `posts_draft_update`, `designs_layer_update`, `sequences_draft_update`, `leads_tag`, `notes_add`.
25. **Request (T2/T3):**
    - `posts_schedule_request`, `posts_publish_request`
    - `emails_send_request`, `replies_send_request`
    - `leads_export_request`, `settings_update_request`
    - These return a pending approval. They execute directly only after an in-panel tap, or for `actions:execute` tokens in fully automatic workspaces.
26. **Panel-only (never over MCP):** `ui_navigate`, `ui_highlight`, `ui_open`, `ui_fill_form` (never submits), `screen_context_get`.
27. **Every tool has** a resource-prefixed snake_case name, title, new-hire description, strict `inputSchema` (`additionalProperties: false`), `outputSchema`, all four annotations, a tier, `response_format` on reads, cursor pagination (20 default, 100 max) and actionable `isError` text.

**E. MCP server, auth and scopes**

28. **Endpoint.** `https://climbos.app/api/mcp`, stateless Streamable HTTP, `Origin` checks, `server/discover`.
    - Supports 2025-06-18, 2025-11-25 and 2026-07-28.
    - A **read-only endpoint** at `/api/mcp/readonly`, as Linear does.
29. **Our own OAuth 2.1 server.**
    - Protected-resource and AS metadata, a 401 challenge.
    - Auth code with PKCE, `resource` audience binding, `iss` in responses.
    - CIMD with DCR fallback.
    - 1h access tokens and rotating refresh tokens.
30. **Consent screen.** Client name, redirect host, a **workspace picker** (one workspace per token) and plain-language scopes. CSRF protection, `frame-ancestors 'none'`. Only owners and admins can grant `actions:execute`.
31. **Scopes** (step-up, never a wildcard):
    - `read`
    - `drafts:write`
    - `actions:request`
    - `actions:execute` (owner or admin, fully automatic workspaces only)
    - `leads:read` (contact PII, kept separate)
32. **Agent tokens** for clients without OAuth: workspace-bound and scope-limited, expiring within 90 days, labelled "Agent", shown once and stored hashed.
33. **Settings → Connected agents.** Lists sessions and tokens (client, scopes, last used) with **Revoke**. Owners get a workspace MCP on/off switch.
34. **Rate limits per token.** About 120 reads per minute, 20 writes per minute, and 50 T3 requests per day. HTTP 429, or `isError` with the retry time. Metered against credits.
35. **Approval flow.** `*_request` returns `approval_url` with a 24h expiry, opened inline via URL elicitation or MRTR where the client supports it. The card says "Requested by Claude Desktop".
36. **Before launch:** MCP Inspector checks on all three spec versions; an **injection eval** (malicious comments, DMs, emails, sites) targeting **zero** T3 executions without a human tap; audit-completeness tests.

---

## Summary: 10 key design decisions

1. **One tool registry, two transports.** The panel agent and the MCP server share the same typed tools, tiers and server checks. Only `ui_*` tools are panel-only.
2. **Structured screen context, not screenshots.** `<ClimbTarget>` registers meaning, IDs and allowed actions. Pixels are used only for design layers and charts, from our renderer.
3. **Point mode** = crosshair, a snapping sunrise outline and labelled targets, turned into numbered composer chips. Shift-click for more, `⌘I` toggles, `Esc` exits, and there is a full keyboard and "⋯ Ask Climb AI" path.
4. **Five server-enforced risk tiers** (T0 read → T4 never). The model never chooses its own permission level.
5. **Act on reversible internal work; confirm anything that leaves ClimbOS.** That means an args-bound single-use approval token and a 30s cancel window.
6. **Undo everywhere.** Toast, durable per-message Revert, soft deletes, versioned artifacts.
7. **Narrate and highlight.** A live work log in the owner's nouns, an outline on what the agent touches, Stop always on, and the user's own input always wins.
8. **All third-party text is hostile.** Untrusted delimiters, taint escalation, no recipients from tool output, no remote images in agent output. This breaks the lethal trifecta at "send".
9. **MCP = stateless Streamable HTTP plus our own OAuth 2.1 AS** (PKCE, RFC 8707 audience, CIMD + DCR). Small step-up scopes, workspace-bound tokens, a read-only endpoint, revocable sessions.
10. **Consequential MCP calls return an approval link instead of executing** (Stripe pattern). Everything is audited as "Climb AI / <client> on behalf of <user>".
