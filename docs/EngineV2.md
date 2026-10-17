# ClimbOS Engine v2: expert agents, skills, lead generation and outreach

Status: in progress (started 17 Oct 2026). Research inputs: `docs/research/strategy-positioning.md`, `channel-content.md`, `leadgen-cold-email.md`, `anthropic-platform.md`.

## Goals (owner decisions, 17 Oct 2026)

- **Best-in-class output.** Every role produces work a top consultant, copywriter or channel specialist would sign off on. Quality comes first; prices are reset afterwards, with the 30% stressed-margin gate still enforced.
- **Our own agent loop** inside Convex, so cost ledger, approvals, tenancy and recovery keep working. Each agent runs research → draft → critique → revise.
- **Skills in both places.** The expert playbooks live in this repo (`skills/`), versioned and tested. They are also published to the Anthropic Skills API.
- **Benchmark decides.** A fixed benchmark of real businesses scores old against new output, blind. A change ships when it wins. Models are chosen per task by benchmark (Opus 5.5 vs Sonnet 5.5; Gemini stays for extraction and images).
- **Lead generation in scope:**
  - inbound capture (lead magnets, landing pages, nurture);
  - prospect discovery from public web data;
  - outreach sequences;
  - Hunter.io on a platform account;
  - an operator CSV contact database with in-house enrichment and targeting.
- **Cold email in scope:** customer mailboxes (SMTP/IMAP with app passwords; Microsoft via OAuth/Graph) and dedicated sending domains, with an in-house warm-up and deliverability system.

## Constraints found in research (they change the design)

| Constraint | Consequence |
|---|---|
| Resend's AUP bans cold email; climbos.app also carries sign-in codes | Cold mail never touches Resend. Code-level separation: the outreach send path cannot import the Resend adapter. |
| Warm-up "engagement pools" breach Google's AUP (GMass precedent) and would put Google OAuth for every customer at risk | Warm-up = **smart ramp**: a volume schedule, real-traffic nudges, ClimbOS-owned seed-inbox placement tests and automatic circuit breakers. No peer engagement pool. |
| A shared contact database used across customers likely makes ClimbOS a data broker (CA Delete Act/DROP; VT, TX, OR registries) and the GDPR controller | Build the guardrails: provenance and lawful basis per record, a global objection list, jurisdiction rules (block DE/AT; CA/AU verbatim-published only; UK sole traders blocked), DROP deletion job, Art. 14 notice line, privacy notice and opt-out page. **Cross-customer sharing sits behind an ops launch switch** that stays off until registration and counsel review are done. Until then, data is used within the workspace that imported or looked it up, plus operator-curated lists. |
| Hunter's licence may not allow pooling results across customers | Hunter results are cached per requesting workspace. They join the shared pool only after Hunter confirms in writing (an ops flag). |
| Convex Node actions: outbound SMTP 587/465 and IMAP 993 work (verified 17 Oct 2026); port 25 is blocked; 10-minute action limit | Sending and reply polling (every 5 min, by UID) run in Convex. No IMAP IDLE (polling instead). In-house RCPT-probe verification is deferred to a separate VPS with port 25 open; Hunter's verifier comes first. |
| Microsoft 365 basic SMTP AUTH turns off by default at the end of Dec 2026 | Microsoft mailboxes connect with OAuth (Graph `Mail.Send` / `Mail.Read`). This needs an Entra app plus publisher verification (owner setup). |
| Gmail OAuth with reply reading needs CASA (a paid annual assessment) | Google Workspace connects with an **app password** over SMTP/IMAP in v1. One-click Google connect follows once CASA is done. |
| Claude 5.x rejects forced tool_choice and prefill; JSON-schema output works with web_search_20260318 and web_fetch_20260318 in one call (verified live) | Every structured step uses `output_config.format`. Research uses the server tools. web_fetch only accepts URLs already in context, so URLs are passed in or found by search first. |

## Agent runtime (`shared/agents/`, Convex adapter in `convex/agents/`)

A code-controlled workflow following Anthropic's evaluator-optimizer pattern. Planner, generator and evaluator are separate, because agents overrate their own work.

1. **Plan** (deterministic). Pick the skill(s), research depth, search and fetch budget, variants and the revise limit from the job kind and plan tier.
2. **Research** (Claude with web_search + web_fetch). Uses competitor URLs, review sites, forums and ad libraries. Writes structured notes plus a source list, persisted as a checkpoint; later phases receive IDs and condensed notes.
3. **Draft** (model chosen by benchmark). The system prompt is the role charter plus the skill playbook, cached. Then come the brand brief, confirmed facts and research notes. Structured output per schema.
4. **Lint** (deterministic). Character limits, banned phrases, hashtag rules, unsourced numbers, `[NEEDS FACT]` markers, CTA count.
5. **Critique** (a separate call with fresh context, ideally a different model). Scores the per-format rubric 1–5 with pass/fail gates and fix instructions. No "reasoning" field.
6. **Revise.** Up to 2 rounds, appended to the conversation. Stops when all gates pass and the average is at least 4 with nothing below 3, or when the score stops improving. The best-scoring version is kept, not the last one.

Every phase is a checkpointed `workflowSteps` row with a worst-case reservation. Phases run in chained actions, so no single action comes near the 10-minute limit. Costs, approvals, emergency stop and recovery are unchanged.

## Skills (`skills/<id>/`)

`SKILL.md` (frontmatter `name`, `description`) holds the procedure. It is accompanied by `rubric.md`, `examples.md` (good vs bad) and optional `reference/*.md`. `pnpm skills:build` compiles them into `shared/skills/generated.ts` for inline use (cached system blocks). `pnpm skills:publish` syncs them to `/v1/skills` and pins version ids in `skills/registry.json`. Text roles use the inline copy, which is cheaper, compatible with structured output and needs no container. Roles that need scripts or files use `container.skills`.

Initial set:
- **Strategy:** voc-research, competitor-teardown, positioning, growth-strategy, experiment-design.
- **Content:** copy-fundamentals, linkedin, instagram, facebook, x, tiktok, google-ads, meta-ads, landing-pages, lifecycle-email, seo-pages, lead-magnets.
- **Sales:** prospecting, cold-outreach, sales-follow-up.
- **Operations:** conversion-audit, retention.
- Plus a judge rubric per format.

## Benchmark (`bench/`)

- **Cases:** 12+ real public businesses across B2B SaaS, B2C app, local service, ecommerce, agency and creator, each with a goal and constraints.
- **Tasks:** strategy, positioning, social (per channel), ads, landing page, email sequence, SEO page, cold outreach.
- **Judging:**
  - Opus 5.5 grades each rubric pointwise (gates plus 1–5 scores).
  - Pairwise comparisons run in both orders; a win counts only if consistent.
  - The judge model differs from the drafter where possible, to limit self-preference bias.
- **Statistics:** report mean ± 1.96·SEM and paired differences per case. Runs go through the Batch API (50% off).
- **Baseline:** the current v1 engine prompts. Results are saved to `bench/results/<date>-<label>.md` and summarised in `docs/Verification.md`.

## Lead generation and outreach

- **Data model (platform-scoped, ops-only writes):**
  - `leadImports` (CSV file, mapping, lawful basis attestation, source);
  - `leadCompanies` (domain, name, industry, size, country, legal form, enrichment fields, sources);
  - `leadPeople` (name, title, seniority, company, country, sources);
  - `leadEmails` (address, status from pattern/hunter/verified/invalid/catch-all, confidence, evidence);
  - `leadPhones`;
  - `leadObjections` (global objection and suppression list keyed by hashed email/domain);
  - `leadJurisdictionRules`;
  - `leadDropSync`.
- **Workspace-scoped:** `prospectLists`, `prospects` (a snapshot of a lead plus fit score, why-fit and opener sources), `hunterCache`.
- **Enrichment pipeline:**
  - website (bounded fetcher / Firecrawl), schema.org and meta, DNS MX;
  - pattern inference from known emails per domain, at most 3 candidates;
  - Hunter verifier/finder with caching (finder and verifier 90 days, domain search 30 days);
  - confidence score, then jurisdiction gate.
- **Targeting:** ICP filters (industry, size, country, title, seniority) plus an AI fit score against the workspace's positioning, with reasons and sources.
- **Outreach agents:**
  - The prospect finder reads public web pages only; no LinkedIn scraping.
  - The writer grounds every personal line in a stored source.
  - A rubric gate checks every message.
  - Each customer's first campaign needs the owner to approve the template and 10 sample messages.

## Sending system

- **Mailboxes:** SMTP/IMAP with app password (encrypted, AAD-bound like other secrets), or Microsoft OAuth/Graph. Health is checked at connect and daily.
- **Scheduler:**
  - a Convex cron leases due sends;
  - per-mailbox token bucket: default 30/day (hard cap 50), 3–9 minutes jitter, recipient business hours Mon–Fri, at most 100/day per domain;
  - plain text, tracking off, no links in step 1;
  - RFC 8058 List-Unsubscribe headers pointing to a Convex HTTP action; the opt-out is processed synchronously into the global objection list;
  - the customer's postal address goes in the footer.
- **Replies:** IMAP poll by UID. Threading via Message-ID / In-Reply-To / References. Messages are classified as reply, auto-reply, bounce (DSN) or unsubscribe request. Any reply stops the sequence for that prospect.
- **Circuit breakers:**

  | Trigger | Action |
  |---|---|
  | Hard bounce >2% over the last 100 sends | Pause the campaign |
  | Hard bounce >3% | Pause the mailbox |
  | Any 5.7.x policy block | Pause the mailbox for 72 h |
  | Negative replies >1% | Pause and re-review |
  | Seed placement <70% | Pause the mailbox |

  The ops fleet stop also stops all sending.
- **Smart ramp (warm-up):**
  - starts at 5/day and rises along a schedule to the steady state only while health holds;
  - weekly seed placement tests against ClimbOS-owned seed inboxes across Gmail, Outlook and Yahoo (read-only);
  - domain age gate of 14 days.
- **Dedicated domains:** one tenant per customer, owned by the customer. Domain purchase and DNS (SPF, DKIM, DMARC, MX, tracking CNAME) are automated where the registrar API allows; mailbox creation is guided. The default is 2 domains × 3 mailboxes, with the cost passed through.

## Content design system (image and video posts)

Owner decisions (17 Oct 2026):
- **Video types:** all four (motion-graphic templates, AI-generated clips, edited customer footage, AI voiceover/avatar).
- **Editor:** chosen by research.
- **Rendering:** a separate render worker is approved.
- **Vendors:** Google plus specialist image and video models and a background-removal API are allowed.

Research: `docs/research/design-video.md`.

- **Designs are documents, not flat images.** Each post is a layered scene (background, photos, text, logo, shapes) on the workspace's brand kit, in an open JSON format. AI writes **typed edit operations** that code validates and applies; it never writes raw editor JSON. New designs come from ~15 layout templates per format. Claude picks and fills them, a rule checker and a vision critic score 3 variants, and the best is shown.
- **Editor:** Polotno SDK (React 19, open JSON, server rendering). Fallback: react-konva. *Blocked on* Polotno's quote and written confirmation that the "competing editor" licence clause doesn't apply to ClimbOS.
- **Point-and-comment edits:**
  - A click maps to the layer underneath.
  - Layer changes (text, colour, size, layout) are edit operations.
  - Pixel changes mask the object (SAM), edit a crop with the image model and paste back through our own mask, so pixels outside the region stay identical.
- **Images:** `gemini-nano-banana-2.1` (the current `gemini-3.1-flash-image` premium route is deprecated); Recraft/Ideogram for text-heavy or vector work. Never bake headline text into AI images; text is a layer.
- **Video:** Remotion templates with an in-app player and simple editor, rendered on a worker (Vercel Sandbox first, then Remotion Lambda).
  - Voiceover: Gemini TTS; captions from speech-to-text aligned to the script.
  - Music: licensed (Lyria or Epidemic partner API).
  - AI b-roll: Gemini Omni Flash, sold as top-up credits because of cost. *Blocked on* the Remotion licence: free for ≤3 people, otherwise $100/month minimum.
- **Uploads:** customer photos, videos, logos and finished designs go to R2 with presigned uploads, vision-tagged and reusable by AI, with rights metadata.
- **Publishing specs:** one master export per format; Instagram API JPEG-only and ≤10 carousel items; TikTok direct posting needs an app audit.

## Social media autopilot (core product)

Owner decisions (17 Oct 2026):
- **What it does:** autopilot plans and creates each week's posts (copy, designs, videos), publishes within rules, manages the community and learns from results.
- **Approval modes:** every workspace chooses one:
  - **Always ask:** every post needs one tap.
  - **Trust ladder:** starts at always-ask. After about 10 approvals with few edits it offers to auto-publish routine posts; new themes, claims, offers and anything flagged still ask.
  - **Fully automatic:** anything that passes every gate publishes, and the owner reviews afterwards.
- **Platforms:** Instagram and Facebook, LinkedIn, TikTok, X, YouTube (Shorts) and Pinterest. Snapchat was added by the owner.

Design:
- **Weekly loop (cron per workspace):**
  1. Read the plan, last week's results and the content library.
  2. The Social Media Manager agent drafts the week's calendar (themes, formats, best times per platform).
  3. Content and design agents create the posts.
  4. Quality gates run: lint, the critic, the claims check and the brand kit.
  5. Each post routes by approval mode.
  6. Approved posts are scheduled through the existing approval-bound publish pipeline (idempotent receipts, reconcile-before-retry).
- **Gates that always ask, whatever the mode:**
  - first post on a channel;
  - new offers, discounts or prices;
  - health, finance or legal claims;
  - anything with [NEEDS FACT];
  - a critic score below the bar;
  - mentions of real people or customers;
  - paid boosts;
  - after any complaint spike.
- **Community management:**
  - Ingest comments and DMs through platform webhooks or polling where the API allows.
  - Classify each one: question, praise, complaint, lead, spam, abuse or crisis.
  - Draft replies with the reply-handling and brand-voice skills.
  - Auto-send only low-risk replies (thanks, FAQ answers) in automatic modes.
  - Hide spam (where the API allows); flag complaints and leads to the owner.
  - Never argue; never handle refunds or legal matters.
- **Learn and adapt:**
  - Pull per-post metrics (reach, saves, shares, comments, clicks, follows).
  - Score posts against the workspace's own baseline.
  - Shift the format, topic and time mix with a bandit-style allocation: 70% proven, 30% exploration.
  - Explain the changes in plain words on Results.
- **Platform realities:**
  - Meta app review covers Instagram and Facebook publishing and comments.
  - LinkedIn needs Community Management API approval for pages, and personal profiles are limited.
  - TikTok direct posting needs an audit; until then posts are uploaded as private drafts.
  - X posting is paid API (≥ ~$200/mo, owner decision when enabled).
  - YouTube Data API is free (quota).
  - Pinterest API is free with app review.
  - Snapchat needs Public Profile/Story publishing through Snap Kit/Marketing API partner access; to confirm.
  - Each platform shows its honest capability state until its approval exists, and falls back to "export pack + reminder" when it can't post.

## UI direction ("Bright", from 17 Oct 2026)

Instantly-style: a friendly, organised, visual interface.
- **Type and colour:** Plus Jakarta Sans; a vivid blue brand with blue-violet gradients.
- **Icons:** colourful icon tiles for sections, channels and every AI teammate.
- **Components:** stat cards; pill buttons and tabs.
- **Layout:** a grouped sidebar; a gradient goal banner; a chat-style onboarding input with example chips; a gradient landing hero with the live preview.

WCAG 2.2 AA is kept (the axe suite runs on every change). Remaining screens follow the same system: content detail and the post editor, results, connections, settings, and the new Leads/Outreach/Designs areas.

## Progress

| Area | Status |
|---|---|
| Research (strategy, content, lead gen, platform, design/video) | Done |
| Skills (24 playbooks + rubrics) | Done |
| Agent runtime, Claude turn layer, lint, specs | Done |
| Convex integration (`CLIMBOS_ENGINE=v2`) | Done, off by default |
| Benchmark harness | Done; first runs under way |
| Bright UI | Shell, Today, onboarding, landing, content list done |
| Design system, Social autopilot, Lead data platform, Outreach, Reprice | Not started |

## Phases

1. **Foundation:** provider upgrade (Opus 5.5, effort/thinking, prompt caching, 2026 web tools, pause_turn), agent runtime, skills build/publish, benchmark harness and baseline.
2. **Skills content** for every role, with lint rules and judge rubrics.
3. **Wire every job to the runtime.** New outputs: positioning doc, VoC bank, competitor battlecards, channel-native content. Update the UI.
4. **Benchmark iteration:** model choice per task; ship winners.
5. **Lead data platform:** ops CSV import, enrichment, Hunter, jurisdiction rules, objection list, ICP targeting, prospect finder, Leads UI.
6. **Outreach:** mailboxes, scheduler, sequences, reply/bounce handling, unsubscribe, circuit breakers, smart ramp, seed tests, dedicated-domain provisioning.
7. **Reprice** from measured costs (economics gate, pricing page, Polar products).

## Owner actions that unlock parts of this

| Item | What it unlocks |
|---|---|
| Hunter.io platform key (`HUNTER_API_KEY`) | Lead finding and verification |
| Written OK from Hunter to pool results | Lead finding and verification |
| Data-broker registration (CA $6k/yr, VT, TX, OR) | Turning on cross-customer sharing |
| Counsel review of the LIA / privacy notice | Turning on cross-customer sharing |
| Microsoft Entra app + publisher verification | Microsoft mailbox connect |
| Google CASA (later) | One-click Gmail connect with reply reading |
| A seed-inbox set (e.g. 10 Gmail, 10 Outlook, 5 Yahoo, read-only app passwords) | Placement tests |
| Registrar API token | Automated dedicated-domain purchase |
