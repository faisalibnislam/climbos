# Capabilities and honest boundaries

ClimbOS is an all-in-one AI growth team: ten specialist roles coordinated through one shared business record. **Every claim on the website must match this file.** Status legend:
- **Built**: implemented and tested locally.
- **Fixture**: works against deterministic demo adapters only.
- **Needs setup**: built, but requires credentials or provider approval before real use.
- **Not offered**: deliberately unavailable.

## The ten roles

All text work runs on OpenAI (`shared/agents/routes.ts`, route `openai-2026-10-18`). There's no fallback model: if OpenAI is down, a job pauses and resumes from its checkpoints.

| Role | What it does in ClimbOS |
|---|---|
| 🧠 AI CEO | Goal decomposition, priorities, the growth plan |
| ⚙️ AI COO | Turns chat requests into costed action cards (never executes directly) |
| 📈 AI CMO | Business insights, positioning, channels, experiments |
| 💰 AI CSO | Conversion audits, follow-ups, find customers and outreach |
| 🎨 AI Creative Director | Image briefs and branded images (metered attempts) |
| 📱 AI Social Media Manager | Posts, variants, alt text, calendar, weekly autopilot |
| 🎯 AI Ads Manager | Search and Meta ad drafts within the approved budget |
| 🔍 AI SEO Specialist | Search-intent pages, outlines and drafts |
| 📊 AI Data Analyst | Explains numbers that statistical code computed; extracts business facts |
| 🤝 AI Customer Success Manager | Welcome, retention and lifecycle sequences (opt-in only) |

**Models**

| Mode | Research | Draft / revise | Review |
|---|---|---|---|
| Climb AI Basic (default) | gpt-6-luna | gpt-6-luna; insights, plays and plan write two drafts and keep the stronger | gpt-6-luna |
| Climb AI Expert (paid, chosen by the owner) | gpt-6-luna | gpt-6.1-sol for insights, channel fit, plays, plan, ads and the weekly plan; Luna for everything else | gpt-6-luna |

- **Images:** Gemini image routes. **Video:** Veo 3.1 Lite (`shared/ai/models.ts`).
- **Routing:** deterministic (`shared/agents/routes.ts`). It isn't a round-robin conversation between agents.

## Capability areas

| Area | What works | Status |
|---|---|---|
| A. Business intelligence | Reads the homepage plus up to 4 product, pricing or about pages (respects robots.txt; SSRF-safe). Extracts sourced facts for owner review. Covers audiences, competitors (sourced or flagged "confirm"), positioning, pricing notes, SWOT, customer journey and opportunities. Falls back to a pasted description (labeled "supplied by you"). | Built |
| B. Growth strategy | Prioritized channels with why, deliverables, dependencies, measurement, AI cost and ad spend (capped to the owner's budget). Experiments with hypothesis, population, method, metric, guardrails and stopping rule. Plan approval, refresh and versions. | Built |
| C. Social media | Drafts for Instagram, Facebook, LinkedIn, X, TikTok, Pinterest and YouTube with platform limits. AI images (2 attempts max, labeled). Calendar, scheduling, approvals. **Direct publishing:** Instagram professional accounts, Facebook Pages, LinkedIn and X after OAuth (and provider review where required), following the workspace's approval mode. TikTok, Pinterest and YouTube use export packs (copy/CSV). | Built; direct publishing **needs setup** (provider apps and keys) |
| D. Advertising | Google search and Meta ad drafts. Campaigns created **paused**; activation needs an approval bound to the exact budget, dates and destination. Monthly envelope enforced. Pause-all requests provider pauses and reports confirmed or unknown. ROAS shown separately from ROI. | Built; live **needs setup** (Google Ads developer token at Basic/Standard access; Meta Marketing API access tier) |
| E. Sales engine | Qualification questions and follow-up sequences. **Find customers:** researches fitting companies and keeps only published business emails, with evidence. **Find creators:** public profiles with contact routes. Outreach sends from the owner's own mailbox with warm-up, follow-ups, stop-on-reply and suppressions. Each send is bound to the approved content. No bought contact database. | Built; sending **needs setup** (owner mailbox) |
| F. Content & SEO | Search-intent page briefs and drafts with keywords and internal links. The Search Console adapter exists, but nothing syncs or uses its data yet. No site inventory, content calendar or CMS publishing yet (growth-engine slices S9–S10). | Briefs and drafts built; Search Console **not wired**; publishing **not offered** |
| G. Email marketing | Sequence drafts. Sending runs only through the customer's **own** Resend account, only to consented, unsuppressed contacts, and requires the unsubscribe placeholder. A connected list alone doesn't authorize sending. | Drafts built. The BYO adapter is built and tested with mocks; the in-app send flow (segment preview, scheduled send) is **not wired yet** |
| H. Conversion & revenue | Landing-page conversion audit with page citations. Funnel, attribution (first/last touch, unattributed bucket, reconciliation), revenue import (Stripe read-only key or CSV), deterministic forecasts with backtests, scenario calculator. | Built |

## Platform matrix

| Platform | Read | Publish / write | Notes |
|---|---|---|---|
| Website | Bounded public pages | — | robots.txt, redirects re-validated, private IPs blocked, DNS checked |
| Google Analytics 4 | Visits, sign-ups (key events), daily | — | OAuth (read-only scope) |
| Search Console | Adapter only (not synced yet) | — | OAuth (read-only scope) |
| Google Ads | Campaign metrics | Paused campaign → approved activation → pause | Developer token; Test access can't touch production accounts |
| Meta Ads | Insights | Paused campaign (with spend cap) → approved activation → pause | Marketing API tier Limited/Full; advanced permissions to manage others' accounts |
| Facebook Pages | Page posts | Publish approved posts, then verify by reading back | `pages_manage_posts` review |
| Instagram | Account type, publishing limit | Image posts through the container flow, verified | Business/Creator accounts only; personal accounts show "Unsupported account type" |
| Stripe | Charges, refunds (read-only restricted key) | — | Import only; ClimbOS billing stays on Polar |
| Revenue CSV | Validated rows, duplicates reported | — | Up to 50,000 rows / 10 MB |
| Customer's Resend | Segments, contacts | Broadcasts (consent + unsubscribe enforced) | BYO API key |
| LinkedIn | — | Publish approved posts, verified | OAuth app needed |
| X | — | Publish approved posts, verified | API keys needed |
| TikTok, Pinterest, YouTube | — | Export packs only | No browser automation or password scraping, ever |

## What ClimbOS will never do

- Invent testimonials, customers, statistics, results or a contact list.
- Send, post, publish or spend without the policy and approval checks above.
- Raise an ad budget on its own, or promise an instant zero-spend stop.
- Present an AI-generated image as a real customer or product screenshot.
- Call a forecast "calibrated" without a held-out coverage check, or attach intervals to pure assumptions.
- Add Google and Meta claimed conversions together as total revenue.
