# ClimbOS product roadmap: what a best-in-class AI growth team needs

**Who it's for.** A non-technical small-business owner: a bakery, an HVAC company, a two-person SaaS, an agency. They have no marketer, little time, and a phone in their hand. They hire ClimbOS to get more customers, not to "do marketing".

**The promises** (see memory and EngineV2.md):
1. A plan that's right for their business.
2. Social media that runs itself, within rules they set.
3. "Drop your website link. Our AI finds the people who need your product, writes the emails and books the calls."
4. Content that looks designed.
5. Proof that it worked.

**How to judge a feature.** Does it help keep a promise, remove owner effort, build trust, or prove ROI? Anything else waits.

## Gap analysis

| # | Gap | Why it matters | Promise | Decision |
|---|---|---|---|---|
| 1 | **Unified Inbox** for social comments and DMs, outbound email replies, website leads and reviews, each with AI triage and a suggested reply | Replies are where customers come from. Owners lose leads across five apps. | 2, 3 | **Build now.** One model (`inbox` threads) fed by community, outbound and capture. |
| 2 | **Own booking pages** with availability, buffers, ICS invites, reminders and no-show follow-up | "Books the calls" is impossible without them. Built in-house, no Calendly needed. | 3 | **Build now** (part of outbound). |
| 3 | **Leads pipeline (mini-CRM)**: New → Contacted → Replied → Booked → Won/Lost, with source and value | Turns activity into outcomes, which the owner needs to see. | 3, 5 | **Build now.** |
| 4 | **Tracked links**: auto-UTM plus our own short links on every post, email and ad | Without attribution there's no ROI story and no learning loop. | 5 | **Build now.** `/l/:code` redirect with click logging. |
| 5 | **Safety window** for autopilot: "Goes out at 9:00. Stop it?", with a 2-hour heads-up by email and a one-click stop | The trust that makes "fully auto" acceptable. | 2 | **Build now.** |
| 6 | **One-tap approvals from email** (signed, expiring, single-use links) plus a daily "needs your OK" email | Owners approve on their phone between jobs. | 2 | **Build now.** |
| 7 | **Link-in-bio page and lead-capture form** (embeddable), hosted by ClimbOS | Inbound capture was requested. Every Instagram business needs one. Feeds the pipeline and attribution. | 3, 5 | **Build now.** |
| 8 | **Weekly CEO report**: what happened, what we learned, what's next, decisions needed, with charts, in-app and by email | The "AI team" should report like a team. It drives retention. | 5 | **Build now** on the chart kit. |
| 9 | **Reviews**: request reviews from consenting customers (email), reply drafts, a reviews widget | Reviews are the #1 growth lever for local businesses. | 2, 5 | **Next.** Requests and drafts now; Google Business Profile API once approved. |
| 10 | **Brand kit and voice learning**: logo, colours, fonts and sample posts, plus learning from owner edits | Content that "sounds like us" and looks on-brand. The edits learning already feeds the planner. | 1, 4 | **Build now** (brand settings → design studio and agents). |
| 11 | **Competitor watch**: weekly diff of competitors' sites, offers and ads (Meta Ad Library), plus alerts | Keeps the strategy current, and owners love it. | 1 | **Next.** Uses the research agent. |
| 12 | **Content language** setting (any language) and locale-aware dates and currency | Many small businesses aren't English-first. | 2, 4 | **Build now** (a setting passed to every agent). |
| 13 | **Asset library**: uploads and generated media, tagged and reusable across studio and posts | Customer uploads were requested. Avoids re-uploading. | 4 | **Next** (with R2 uploads). |
| 14 | **Repurposing**: turn one long piece (blog, video, podcast) into a week of posts | The cheapest high-quality content. | 2, 4 | **Next.** |
| 15 | **Experiments**: A/B hooks and subject lines, with the winner fed back | Makes the learning loop measurable. | 5 | **Next.** |
| 16 | **PWA + push notifications** | Phone-first owners. | 2 | **Later.** |
| 17 | **Agency mode**: client workspaces, white-label reports | A second market. | — | **Later.** |
| 18 | **Website chat widget** answering from confirmed facts and capturing leads | A natural extension of capture. | 3 | **Later.** Needs careful guardrails. |

## Build order

1. Design system and UI audit (in progress).
2. Social autopilot: planner, routing, trust ladder (in progress). Add the safety window (#5) and email approvals (#6).
3. Outbound: ICP → prospects → sequences → replies → **booking pages (#2)**. Leads pipeline (#3) and Inbox (#1) are shared foundations.
4. Tracked links (#4), link-in-bio and capture form (#7), weekly CEO report (#8).
5. Brand kit (#10), content language (#12).
6. Reviews (#9), competitor watch (#11), assets (#13), repurposing (#14), experiments (#15).

Each item ships with tests, appears in `/design-system` if it adds UI patterns, and is listed in the morning report.
