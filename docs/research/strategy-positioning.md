# Strategy & Positioning Playbook for the ClimbOS Engine

Research date: 17 Oct 2026. Audience: the people building ClimbOS's CEO / CMO / strategy agents, and the agents themselves (as system-prompt and tool-procedure source material).

This document is written as reusable playbook material. Each section gives (a) what the best practitioners actually do, with sources, (b) a numbered procedure an agent can run from a website plus public research, (c) the output spec, and (d) short good vs. mediocre examples written for this doc. Section 6 is the scoring rubric for judging any strategy or positioning output, including ours.

A note on evidence quality: most 2025-2026 channel data comes from vendors (Ahrefs, Seer, Semrush, ad-tech blogs). Where figures conflict, this doc gives a range and names the source. The agent should hold itself to the same standard (see the "no invented stats" gate in Section 6).

---

## 0. Core principles the engine should internalize

1. **Positioning comes before messaging, and messaging before channels.** Copy cannot fix a weak position; channels amplify whatever message you give them. Every Dunford summary stresses this order ([Wudpecker summary of *Obviously Awesome*](https://wudpecker.io/blog/obviously-awesome-the-guide-to-perfecting-your-product-positioning)).
2. **Start from the customer's alternative, not the competitor list.** The real competitor is often a spreadsheet, an employee, a cheaper local guy, or doing nothing.
3. **Constraints first.** A small business strategy that ignores budget, founder hours, and price point is not a strategy. Balfour's point that "channels do not mold to products" and that price (ARPU) dictates which acquisition costs are survivable is the backbone of channel choice ([Balfour, HubSpot growth framework](https://brianbalfour.com/essays/hubspot-growth-framework-100m)).
4. **Focus beats coverage.** Founders should run two or three kickstart tactics but get world-class at one primary engine ([Lenny Rachitsky, consumer growth series](https://www.lennysnewsletter.com/i/57395431/-seo)); Bullseye tests a few channels cheaply and then concentrates on the winner ([Traction notes, Graham Mann](https://grahammann.net/book-notes/traction-gabriel-weinberg)).
5. **Use customers' words, not ours.** The best copy is assembled from phrases customers already use in reviews and forums ([Joanna Wiebe interview, Wistia](https://wistia.com/learn/marketing/joanna-wiebe-conversion-copywriting)).
6. **Every number has a source or a label.** Either "from [source]", "from your data", or "assumption, to validate in week N".

---

## 1. Positioning and messaging

### 1.1 The frameworks worth using (and what each is for)

| Framework | Use it for | Limits |
|---|---|---|
| **Dunford, *Obviously Awesome*** (5 components: competitive alternatives → unique attributes → value → best-fit customers → market category, plus optional trend) | The backbone. Produces a defensible position from facts. | Needs real knowledge of why customers chose you; the agent must infer this from reviews if there is no interview data. |
| **Dunford, *Sales Pitch*** (setup: insight, alternatives and their trade-offs, "perfect world" criteria; then differentiated value, proof, objections, ask) | Turning a position into a homepage narrative, sales deck or demo script ([Product Andrew summary](https://productandrew.substack.com/p/product-106); [Lenny's podcast outline](https://www.lennysnewsletter.com/p/a-step-by-step-guide-to-crafting)). | Built for B2B sales; adapt the "insight" step for B2C/local (e.g. "most people pick a plumber on price, then pay twice"). |
| **Jobs-to-be-Done / switch interviews, four forces** (Push + Pull must beat Anxiety + Habit) | Understanding *why people switch* and what stalls them. Feeds objection lists and copy ([jobstobedone.org, Four Forces](https://jobstobedone.org/the-four-forces/)). | Real switch interviews need live customers. From public data we can only approximate by coding reviews and forum posts into the four forces. |
| **Raskin strategic narrative** (name a shift in the world → winners and losers → promised land → your capabilities as the path → proof) | Founder-led content, pitch decks, category-adjacent stories ([summary of Raskin's method](https://www.antoinebuteau.com/lessons-from-andy-raskin/)). | Easy to fake. A "shift" must be real and observable, not "AI is changing everything". |
| **StoryBrand** (customer is hero, brand is guide) | Clarity for simple consumer and local offers; useful corrective for "we-we" copy. | Critiques: clunky to turn into day-to-day copy, single-hero arc strains for multi-stakeholder B2B, and the "guide" role can feel overblown for a plumber or bookkeeper ([STFO, "StoryBrand is frustrating"](https://essays.stfo.io/posts/storybrand-is-frustrating-stfo); [Column Content, drawbacks](https://columncontent.com/storybrand-method-drawbacks/)). Use as a copy lens, never as the positioning method. |
| **Category design (*Play Bigger*)** | Rarely appropriate for small businesses. | Evidence base is big-tech success stories ([Goodreads reviews](https://www.goodreads.com/book/show/31327422)); category creation requires educating a market, which small budgets cannot fund. Dunford frames category creation as the highest-risk of three styles ([positioning-style summary](https://smithery.ai/skills/slgoodrich/product-positioning)). |

**Dunford's three positioning styles** (use as a decision in step 7 below):
- *Head-to-head:* win an existing category by being better on a dimension buyers already value. Only sensible if you can credibly be a top choice.
- *Big fish, small pond:* own a subsegment of an existing category where your strengths matter most. **The default recommendation for almost every ClimbOS customer.**
- *Create a new category:* only when no existing frame makes the value obvious and there is budget to educate the market.

### 1.2 Procedure: build a positioning from a website plus public research

**Inputs (required / nice-to-have)**
- Required: the business's website URL; business type; geography (for local); price points; the owner's answer to "who are your 3 favourite customers and why".
- Strongly recommended (ask the owner, 5 questions max): what customers did before buying from you; the last 3 deals you lost and to whom; top reason people say yes; top reason they hesitate; what you will not do.
- Public research: the VoC bank (Section 2) and the competitor teardown (Section 3).

**Steps**

1. **Extract the current claimed position.** From the homepage, pricing page and about page, record verbatim: headline, subhead, category words used, who it says it is for, top 3 claimed benefits, proof shown. Score clarity: could a stranger say what it is, who it is for and why it is better in 10 seconds?
2. **List competitive alternatives** (what the best-fit customer would do if this business vanished). Always include at least one non-product alternative: DIY, spreadsheet, hiring, an incumbent agency, a marketplace (Upwork, Etsy, Amazon), or doing nothing. Source them from reviews ("we switched from…", "before this I used…") and Reddit threads.
3. **List unique attributes** versus those alternatives: features, delivery model, expertise, guarantees, speed, locality, pricing model, founder credibility. Only list attributes with evidence (on site, in reviews, or confirmed by owner). Discard parity features.
4. **Translate attributes into value** with a "so what" chain: attribute → what it enables → why the customer cares (time, money, risk, status, peace of mind). Then cluster into 1-3 value themes.
5. **Ground value in customer evidence.** For each theme, attach 2+ verbatim customer quotes from the VoC bank. A theme with no customer evidence is a hypothesis; label it as such.
6. **Define best-fit customers** as the segment that cares most about those value themes. Use observable traits (company size, trigger event, job role, life situation, location, budget) rather than demographics alone. Name a trigger event (the "push").
7. **Choose a market frame** (category). Test 2-3 candidate frames: does this frame make the value obvious, and does it set price expectations correctly? Pick a positioning style (usually big fish, small pond).
8. **Add a trend only if it is real, observable and makes the value more urgent** (e.g. a regulation change, AI search shifting how buyers research). Optional.
9. **Write the messaging hierarchy:** one-line positioning, homepage headline + subhead options (3 each), 3 value pillars with proof points, objection-handling lines (from Section 2.4), and words to use / avoid (from the VoC bank).
10. **Write the Sales Pitch narrative** (insight → alternatives and their trade-offs → perfect-world criteria → differentiated value → proof → ask) as a homepage section order or a 6-slide deck outline.
11. **Pressure-test.** Run the rubric in Section 6.1. Run a "swap test": replace the company name with its top competitor's. If the copy still works, it is not differentiated; return to step 3.
12. **Specify validation.** Name the cheapest way to test the new message within 2-3 weeks (see Section 4.5): homepage headline test, ad-copy test, cold-email reply rate, or 5 customer calls.

**Output spec (positioning document)**
- Positioning canvas (5 components + trend) with evidence links per line
- Positioning style chosen, with one-sentence rationale and what was rejected
- Best-fit customer profile with trigger event and disqualifiers
- Messaging hierarchy, objection map, VoC phrase bank
- Confidence level per component (High = customer evidence; Medium = inferred from public data; Low = assumption)
- Validation plan

### 1.3 Good vs. mediocre (example business: a 3-person bookkeeping firm in Leeds)

**Mediocre:**
> "Accurate, affordable bookkeeping for small businesses. Our expert team saves you time so you can focus on what you do best."

Fails the swap test (every bookkeeper could say it). No alternative named, no segment, no proof, generic value.

**Great:**
> **Positioning:** For UK tradespeople with 2-10 staff who are still doing the books themselves on Sunday nights (alternative: DIY in a spreadsheet plus a year-end accountant), we are the bookkeeping service built around job-costing and CIS. Unlike a year-end accountant, we close your books monthly and show you which jobs actually made money.
> **Headline option:** "Know which jobs made money, every month, without doing the books on Sunday."
> **Evidence:** 9 of 23 Google reviews mention CIS or subcontractor payments; 4 reviews use "Sunday" or "weekends"; competitors' sites mention CIS only in service lists, never as the lead.
> **Confidence:** Segment = High (reviews); job-costing value = Medium (owner-claimed, two reviews); price sensitivity = Low (to validate).

---

## 2. Customer research from public data (voice of customer)

### 2.1 Sources by business type

| Business type | Highest-signal public sources |
|---|---|
| B2B SaaS | G2, Capterra, TrustRadius (structured "like / dislike / problems solved" fields); competitor reviews mentioning "switched from"; Reddit (r/SaaS plus role subs like r/sysadmin, r/marketing, r/accounting); Hacker News; LinkedIn comments; app-marketplace reviews (Shopify, HubSpot, Slack) |
| B2C app | App Store / Google Play reviews (especially 2-3 star), Reddit, TikTok and YouTube comments, Trustpilot |
| Local service | Google Business Profile reviews (own + top 5 map-pack competitors), Yelp, Nextdoor, Facebook groups, Checkatrade / Angi / Houzz, local subreddits |
| Ecommerce / DTC | Amazon reviews of competing products (3-star reviews are gold: they name the trade-off), Trustpilot, Reddit product subs, TikTok comments, own site reviews |
| Agency / consultant | Clutch, Google reviews, LinkedIn recommendations, Reddit threads complaining about agencies, case studies on competitor sites |
| Creator / coach | YouTube and podcast comments, Reddit, course-platform reviews, testimonials on competitor sales pages, X/Threads replies |

Reddit is also now the most-cited domain across AI answer engines in cross-platform studies ([Peec, March 2026](https://docs.peec.ai/research/most-cited-domains-in-ai-search)), so what Reddit says about a category increasingly shapes what AI assistants say about it. Mining it is both research and reputation monitoring.

### 2.2 Procedure: message mining

Based on Wiebe's method (read everything, highlight repeated and standout phrases, tag, then answer research questions in the customer's own words; [Wistia interview](https://wistia.com/learn/marketing/joanna-wiebe-conversion-copywriting)), adapted for an agent:

1. **Define 5 research questions** before collecting. Default set: What triggered the search? What did they use before? What almost stopped them? What outcome do they describe after? What words do they use for the problem and the category?
2. **Collect 100-300 snippets** across at least 3 source types. Include the business's own reviews, the top 3 competitors' reviews, and 2+ forum threads. Store source URL, date, star rating, and verbatim text. Prefer the last 24 months.
3. **Code each snippet** with: force (Push / Pull / Anxiety / Habit, per [JTBD four forces](https://jobstobedone.org/the-four-forces/)), job or outcome, alternative mentioned, objection, emotion, segment clues (role, size, trigger).
4. **Count and rank** themes by frequency and intensity. Keep the counts; they become evidence ("14 of 87 competitor reviews complain about long contracts").
5. **Extract the phrase bank:** 20-40 verbatim phrases, grouped by theme, each with source. Mark phrases that appear across multiple sources as "high-confidence language".
6. **Build the objection list** (2.4).
7. **Write insights as tensions,** not summaries. Bad: "Customers value good service." Good: "Buyers want a fixed price but distrust quotes that look too low; 6 reviews of competitors mention surprise extras."

### 2.3 Rules for honest VoC
- Never paraphrase inside the phrase bank. Verbatim, with link. (Short excerpts only when republishing externally.)
- Separate the business's own customers from competitors' customers; they are different evidence.
- Flag low sample sizes ("only 11 reviews found; treat as directional").
- Watch for fake or incentivised reviews (bursts of 5-star reviews on one date, generic text).
- Do not infer demographics that are not stated.

### 2.4 Objection list format

| Objection (customer words) | Force | Frequency | Where it appears | Counter (proof, guarantee, copy, offer) |
|---|---|---|---|---|
| "Worried it'll take ages to set up" | Anxiety | 9 | G2 cons, Reddit | Show setup time; "live in 1 day or we do it for you" |
| "Our current spreadsheet works fine" | Habit | 6 | Reddit | Cost-of-status-quo calculator; import in one click |
| "Too expensive for a team our size" | Anxiety / price | 5 | Capterra | Starter tier; ROI example at 3 seats |

Habit and anxiety items should map to concrete reducers: guarantees, trials, migration help, social proof from the same segment, reversible commitments.

---

## 3. Competitor analysis from public web info

### 3.1 Procedure

1. **Build the competitive set in three rings:** (a) direct competitors the customer names in reviews or search results; (b) substitutes / alternatives (DIY, marketplaces, freelancers, in-house hire, an incumbent tool used "well enough"); (c) aspirational or adjacent players who set expectations. Target 3-5 direct plus 2-3 alternatives. For local: the top map-pack results for the 3 highest-intent queries in the service area.
2. **Messaging teardown** for each direct competitor. Capture verbatim: hero headline, subhead, category label, target audience named, top 3 claims, proof types (logos, numbers, reviews, awards), primary CTA, risk reducers (trial, guarantee). Classify the positioning style (head-to-head, niche, category creation) and the main value theme (price, speed, quality, expertise, convenience, specialisation).
3. **Pricing and offer teardown:** model (per seat, usage, flat, project, retainer, per job), entry price, anchor tier, free trial / freemium / free quote, contract length, guarantees, discounts, bundles, lead magnet. Note what is *hidden* ("contact us" pricing is itself a signal).
4. **Channel footprint** (observable evidence only):
   - Search: ranking pages and topics (via search results and any SEO tools available), presence in AI Overviews / AI answers for category queries.
   - Paid: Meta Ad Library and Google Ads Transparency Center (active ads, how long they have run; long-running ads are likely profitable), LinkedIn Ad Library for B2B.
   - Social: posting frequency and engagement per platform, founder-led presence.
   - Marketplaces / directories: G2, Capterra, Clutch, Checkatrade, Amazon, app stores; review count and velocity.
   - Partnerships / integrations, communities, events, newsletter, podcasts.
5. **Review mining of competitors** (Section 2): what their customers love (do not attack this), what they complain about (gap candidates), what words they use.
6. **Map the field** on two axes buyers actually care about (from VoC, not from our imagination), e.g. "done-for-you vs. DIY" and "generalist vs. specialist". Find the empty or weakly held quadrant.
7. **Gap analysis.** List gaps of four kinds: *message gaps* (a value customers mention that no one leads with), *segment gaps* (an underserved segment), *offer gaps* (no one offers a guarantee, fixed price, fast start, monthly option), *channel gaps* (competitors absent from a channel where buyers are, e.g. no one answering in the relevant subreddit or YouTube). Each gap needs evidence and a "why might it be empty" check (sometimes it is empty because it does not work).
8. **Threat note:** what competitor move would hurt most in the next 6 months.

### 3.2 Output: one-page battlecard per competitor
Who they win with, their claim, their proof, their price, their weak spots (from reviews, with counts), how we position against them in one sentence, and a landmine question a buyer can ask.

### 3.3 Good vs. mediocre gap finding
- **Mediocre:** "Competitor X has weak SEO and an outdated website. Opportunity: create better content."
- **Great:** "All 4 direct competitors lead with 'affordable'. 11 of 52 competitor Google reviews complain about no-shows or missed windows; none of the 4 sites offers an arrival-time guarantee. Gap: 'On time or the call-out is free.' Risk: costs us if the schedule slips; pilot on Tuesdays-Thursdays first."

---

## 4. Growth strategy for small businesses with small budgets

### 4.1 Strategic logic before tactics

**Channel-model fit.** Balfour's ARPU ↔ CAC spectrum: low-price products need low-cost, scalable channels (virality, SEO, self-serve paid); high-price products can afford sales, events and outbound. The middle is a "danger zone" where price is too high for cheap channels to close and too low to fund expensive ones; HubSpot Sales fixed this by changing price, not channels ([Balfour](https://brianbalfour.com/essays/hubspot-growth-framework-100m)). The agent should compute rough unit economics first: average order or contract value, gross margin, repeat rate → affordable CAC. If no channel can hit that CAC, the recommendation may be a pricing or offer change, not a channel.

**One engine, a few kickstarts.** Consumer companies that last got world-class at one engine (viral, SEO, or paid) after two or three early kickstart tactics ([Rachitsky](https://www.lennysnewsletter.com/i/57395431/-seo)). Loops compound where funnels deplete, but any working loop eventually saturates, so a growth model has a limited shelf life ([Elena Verna summaries](https://echai.ventures/gtm/gtm-operator-principles/why-does-elena-verna-say-a-growth-model-needs-replacing-roughly-every-18-months)).

**Small-business reality check.** Usually 2-10 hours a week of owner time, under $2k/month of spend, no data team, weak tracking. Strategy must fit that.

### 4.2 Procedure: channel selection

1. **Collect constraints:** monthly budget, weekly hours, skills (writing, camera, sales), price and margin, sales cycle, geography, existing assets (email list, reviews, audience, partners).
2. **Compute affordable CAC** = (first-year gross profit per customer) ÷ target payback multiple. Default: payback under 3 months for SMB-priced SaaS and ecommerce; per-job margin for local services; first-project margin for agencies.
3. **Brainstorm across the Traction 19 channels** ([Traction](https://grahammann.net/book-notes/traction-gabriel-weinberg)): one concrete idea per channel for *this* business, not generic. Add 2026-specific ones: AI answer visibility (GEO), Reddit/community participation, creator partnerships, marketplace listings.
4. **Filter by hard constraints:** remove anything the budget, skills or CAC cannot support. (Example: LinkedIn ads below roughly $1.5-3k/month rarely gather enough data, per practitioner guides such as [ZenABM](https://zenabm.com/blog/spend-on-linkedin-ads-budget-guide); treat as a soft floor.)
5. **Score the survivors** with modified ICE: Impact (1-5, would it move the 90-day goal?), Confidence (1-5, evidence that buyers are there and competitors win there), Ease (1-5, given these hours and skills), plus two gates: **CAC fit** (yes/no) and **Time-to-signal** (weeks to a leading indicator). Use RICE (Reach × Impact × Confidence ÷ Effort, from Intercom's Sean McBride; [Railsware explainer](https://railsware.com/blog/rice-framework/)) when choosing between experiments inside a channel, where reach can be estimated.
6. **Bullseye rings:** outer = all ideas; middle = top 3-5 by score; inner = **1 primary + 1 secondary channel**, plus at most 1 "always-on hygiene" item (e.g. Google Business Profile for local, review collection, basic email capture). Write down why each rejected channel was rejected.
7. **Run cheap tests on the middle ring in the first 2-4 weeks,** then commit the inner ring.
8. **Define kill / scale criteria** per channel in advance.

**Good vs. mediocre channel choice (DTC candle brand, $1,500/month):**
- Mediocre: "Leverage Instagram, TikTok, Pinterest, SEO, email, influencers, Google Shopping and Meta ads for an omnichannel presence."
- Great: "Primary: Meta ads, because AOV is $48 with 65% margin, giving ~$30 affordable CAC on the first order and repeat buyers improve it; 6-10 creative concepts at $40/day. Secondary: 20 micro-creator gifting seeds a month, reused as ad creative. Hygiene: post-purchase email flow. Not now: SEO (12+ month payback, AI Overviews eating informational clicks), Pinterest (no in-house design time), TikTok Shop (fulfilment SLA risk)."

### 4.3 Differences by business type

| Type | Usual primary engines | Typical traps | Key unit-economics question |
|---|---|---|---|
| **B2B SaaS (SMB, <$100/mo)** | Product-led (free trial/freemium + onboarding), integration marketplaces, SEO/comparison pages, founder-led content, review sites | Outbound and LinkedIn ads at a price that cannot carry them; "content" without a distribution plan | Payback on blended CAC; trial→paid rate |
| **B2B SaaS (mid-ticket, $5k+ ACV)** | Founder-led sales + outbound, LinkedIn (organic founder posts, thought-leader ads), partnerships, webinars, review sites | Pure PLG expectations; vanity followers | Pipeline per week; win rate vs. alternatives |
| **B2C app** | Virality/referral loops, ASO, short-form creator content, paid social once retention is proven | Paying to acquire users who churn in week 1 | D1/D7/D30 retention before spend |
| **Local service** | Google Business Profile + reviews, Local Services Ads / search ads, referrals and repeat, partnerships (realtors, property managers), Nextdoor | Social media posting as "marketing"; generic national SEO content | Cost per booked job; review velocity |
| **Ecommerce / DTC** | Meta / TikTok paid with heavy creative testing, creators, email/SMS retention, marketplaces (Amazon, TikTok Shop) | Scaling ads before contribution margin is positive; discount addiction | Contribution margin per order; repeat rate at 90 days |
| **Agency / consultant** | Referrals and network, niche specialisation, founder LinkedIn, case studies, outbound to a tight list, partnerships | Being a generalist; pitching services instead of outcomes | Pipeline from 1-2 niches; close rate; retainer length |
| **Creator / coach** | One content platform done well + email list, collaborations, a low-ticket offer feeding a high-ticket one | Spreading across 5 platforms; no owned list | Email subscribers per week; offer conversion |

### 4.4 90-day plan structure

Use three 30-day phases with one measurable 90-day goal.

- **Days 0-14: Foundation.** Fix positioning and homepage message (Section 1), install measurement (UTMs, conversion events, server-side where possible, a weekly scorecard), fix conversion leaks on the money page (offer, proof, CTA, speed, mobile), set up review collection. Launch 2-3 cheap channel tests.
- **Days 15-45: Test.** Run the 2-3 channel tests with pre-set budgets and kill criteria. Weekly review. By day 45, pick the primary channel.
- **Days 46-90: Commit and compound.** Put 70-80% of effort into the primary channel, 20-30% into the secondary. Build one asset that compounds (a referral loop, a library of winning ad angles, a comparison-page cluster, a partner list).

**Each plan must include:** one North Star goal for 90 days (e.g. "40 booked jobs/month from 22"); 3-5 leading indicators with weekly targets; owner-hours per week by task; budget by month; experiment backlog ranked by score; explicit "not doing" list; risks and assumptions with a validation date; a week-1 checklist the owner can start tomorrow.

### 4.5 Experiment design that works at small sample sizes

Classic A/B testing is mostly unusable for small businesses. Significance math assumes a sample size fixed in advance; peeking and stopping when it "looks significant" makes the reported significance meaningless ([Evan Miller, "How Not To Run an A/B Test"](https://www.evanmiller.org/how-not-to-run-an-ab-test.html)). Sample size depends on baseline rate, minimum detectable effect and power, and at low baselines and traffic that means months.

**What to do instead:**
1. **Test big swings, not tweaks.** Only test changes that could plausibly move the metric 30%+ (new offer, new positioning, new channel, new price), because only large effects are detectable with small samples.
2. **Test higher up the funnel**, where volume exists: ad CTR, cost per lead, email reply rate, landing-page click-through, rather than purchases.
3. **Sequential, not simultaneous,** with care: before/after comparisons are acceptable for big swings if you hold everything else steady and note seasonality. Say "directional" in the readout.
4. **Use ad platforms as message labs.** Run 3-5 headline/angle variants as ads at small budgets; the winning angle informs the homepage.
5. **Smoke tests and fake doors:** a landing page or pre-order for a new offer, measured by sign-ups or deposits.
6. **Qualitative evidence counts:** 5-10 customer conversations, reply sentiment, sales-call objections. At small scale this often beats statistics.
7. **Pre-register every test** in one line: hypothesis, metric, minimum volume, run time, decision rule ("If cost per booked call < $60 after 40 clicks/day for 14 days, scale; if > $120, kill; else iterate once").
8. **Use thresholds, not p-values,** for kill/scale decisions, and say so.

**Experiment card template**
```
Name:            Arrival-time guarantee in Google Ads copy
Hypothesis:      Because 11/52 competitor reviews complain about no-shows,
                 a guarantee will lift booked-call rate.
Metric:          Booked calls / ad clicks (leading); cost per booked job (lagging)
Volume needed:   ≥300 clicks per variant (≈3 weeks at current spend)
Decision rule:   ≥25% relative lift → roll to site + GBP; <10% → drop
Cost / effort:   $0 extra spend, 1 hour
Owner, dates:    Owner; 21 Oct – 11 Nov
```

### 4.6 Leading indicators by type

- **B2B SaaS:** qualified sign-ups/week, activation rate (reached first value), trial→paid, demo-booked rate, reply rate on outbound, pipeline created.
- **B2C app:** install→signup, D1/D7 retention, invites sent per user, K-factor, cost per retained user.
- **Local service:** calls and form fills/week, booked-job rate, GBP actions (calls, directions), new reviews/week, average rating, quote→win rate.
- **Ecommerce:** CTR and thumb-stop rate per creative, add-to-cart rate, contribution margin per order, email capture rate, 60/90-day repeat.
- **Agency/consultant:** conversations started/week, discovery calls booked, proposal→close rate, referral asks made.
- **Creator/coach:** email subs/week, content saves/shares, DM inquiries, low-ticket conversion.

---

## 5. 2025-2026 changes that matter

### 5.1 AI search is shrinking informational clicks
- Pew found users clicked a traditional result in 8% of Google visits with an AI summary vs. 15% without, and clicked links inside the summary in about 1% of visits ([Pew Research, 22 Jul 2025](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/)).
- Seer Interactive measured organic CTR on AI Overview queries falling 61% (1.76% → 0.61%) and paid CTR 68%, June 2024-Sept 2025 ([PPC Land on Seer](https://ppc.land/google-ai-overviews-reduce-organic-ctr-61-paid-traffic-68/)). Ahrefs estimated position-one CTR down 58% on AIO keywords by Dec 2025, up from 34.5% in its April 2025 study ([PPC Land on Ahrefs](https://ppc.land/googles-ai-summaries-now-swallow-58-of-clicks-that-once-went-to-websites/)). Google disputes these findings ([PPC Land](https://ppc.land/google-disputes-pew-study-showing-ai-overviews-reduce-clicks-by-half/)).
- AI Mode reportedly passed 1 billion monthly users about a year after US launch, with queries about 3x longer than traditional ones ([ROI Revolution, June 2026 recap](https://roirevolution.com/blog/june-2026-ai-search-news-recap/)). A preregistered experiment found an AI-Mode-only condition cut publisher click-through by 18.8 points ([Let's Data Science](https://letsdatascience.com/news/study-finds-google-ai-search-reduces-referrals-9881ee58)).
- AI-referred visitors can convert unusually well: on Ahrefs' own site, AI search was about 0.5% of visits but 12.1% of sign-ups (single-site data; [Ahrefs](https://ahrefs.com/blog/ai-search-traffic-conversions-ahrefs/)).

**Implications for strategy**
- Do not recommend "blog SEO" (top-of-funnel informational content) as a primary engine for a small business without strong justification. Bias toward high-intent pages (comparison, alternatives, pricing, "best X for Y", local service pages), original data, and tools.
- Add **AI answer visibility** as a channel: be accurately described where AI engines look. Cross-engine studies put Reddit, YouTube, LinkedIn and Wikipedia among the most-cited domains ([Peec](https://docs.peec.ai/research/most-cited-domains-in-ai-search); [LLM Pulse](https://llmpulse.ai/data-studies/top-cited-domains)); third-party reviews, consistent product facts, and genuine forum presence matter ([ROI Revolution recap of Search Engine Land](https://roirevolution.com/blog/june-2026-ai-search-news-recap/)). Agentic browsing (Chrome auto-browse, May 2026) can fail on sites with unlabeled forms and heavy cookie walls (same source), so site hygiene is now a conversion issue.
- **Local:** studies disagree wildly on AI Overview frequency for local queries (from about 8% to 88% depending on query mix; [Lilach Bullock study](https://www.lilachbullock.com/?p=127878), [ThinkProfits](https://thinkprofits.com/digital-news/maps-pack-still-wins-local-ai-overviews-8-percent/)). The map pack still dominates "near me" queries in the Oct 2026 sample. Google Business Profile completeness and reviews remain the highest-leverage local asset.
- Measure: track AI referrals (chatgpt.com, perplexity.ai, gemini) as a separate source; run a monthly prompt check ("best [category] for [segment] in [city]") and record whether the business is mentioned and how it is described.

### 5.2 Paid platforms: automation up, manual targeting down
- **Meta:** Andromeda, Meta's ad-retrieval engine announced Dec 2024, uses a much larger model to match ads to people ([Meta Engineering](https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/)). Practitioners report detailed targeting now behaves more like a suggestion and that creative diversity (distinct concepts, not minor variants) does the targeting work ([Jon Loomer](https://www.jonloomer.com/meta-andromeda-creative-diversification/)). Detailed targeting *exclusions* were removed during 2025; custom-audience exclusions remain ([Social Media Today](https://www.socialmediatoday.com/news/meta-removes-detailed-targeting-exclusions-from-ad-campaigns/723389/)). **Implication:** for small budgets, fewer campaigns and ad sets, broad audiences, and a steady supply of genuinely different creative angles drawn from the VoC bank. Positioning research becomes ad-creative research.
- **Google:** AI Max for Search adds broad-match and keywordless expansion, text customisation and final-URL expansion to Search campaigns ([Google Ads Help](https://support.google.com/google-ads/answer/15910366)). Local Services Ads are migrating into Google Ads as Performance Max pay-per-lead campaigns from Aug 2026 through 2027, with manual bidding and per-category tCPA going away ([Search Engine Journal](https://www.searchenginejournal.com/google-is-bringing-local-services-ads/582816/)). A Feb 2026 SearchLight study of 888 contractors put average LSA cost per lead around $53 (as reported by [Enrich Labs](https://www.enrichlabs.ai/blog/local-services-ads-complete-guide-2026); vendor data). **Implication:** negative keywords, search-term review and conversion quality (offline conversion import for booked jobs) matter more, because automation optimises toward whatever signal you feed it.
- **LinkedIn:** organic reach fell sharply in 2025 (creator reports estimate roughly 40-50% year on year; company pages reach a small single-digit share of followers; [AuthoredUp](https://authoredup.com/newsletter/linkedin-vanishing-audience), [Digitalworks](https://digitalworks.dk/en/artikler/organic-visibility-on-linkedin-is-under-pressure)). Person-led content and Thought Leader Ads (promoting an employee's post) outperform brand-page posts in practitioner reports ([Elevarus](https://elevarus.com/linkedin-thought-leader-ads-b2b-lead-generation/)). **Implication:** B2B strategies should centre on founder/employee profiles, not the company page.
- **ChatGPT ads:** launched Feb 2026 for large advertisers; self-serve access for smaller US businesses arrived around mid-2026 per trade reports ([Shopifreaks](https://www.shopifreaks.com/openai-expands-chatgpt-advertising-to-small-and-local-businesses-competing-with-google-meta-in-the-space/)). Treat as a small, experimental line until attribution matures.

### 5.3 Privacy and measurement
- Chrome kept third-party cookies (April 2025) and Google then retired most Privacy Sandbox APIs ([Engadget](https://engadget.com/cybersecurity/google-has-killed-privacy-sandbox-130029899.html)). Cookie deprecation is no longer the planning assumption; signal loss still comes from Safari, iOS and consent.
- Safari 26 turned on Advanced Fingerprinting Protection by default; click-ID stripping (gclid, fbclid) applies in Mail, Messages and Private Browsing, with mixed vendor reports for normal browsing, while UTMs are kept ([PPC Land](https://ppc.land/safari-26-tracking-changes-to-impact-marketing-measurement/), [Able CDP](https://www.ablecdp.com/blog/does-safari-strip-click-ids-gclid-fbclid)).
- US state privacy laws keep spreading: Indiana, Kentucky and Rhode Island took effect 1 Jan 2026, taking the total to about 20 states, generally with opt-outs for targeted advertising ([TrustArc](https://trustarc.com/resource/new-in-2026-state-privacy-laws-in-indiana-kentucky-and-rhode-island/)).
- **Implication:** every plan should include UTMs on all links, server-side conversions (Meta Conversions API, Google Enhanced Conversions) where the stack allows, a post-purchase "how did you hear about us?" question, and a weekly scorecard that does not depend on platform attribution alone.

---

## 6. Quality rubrics

Score each criterion 1-5. Anchors describe 1, 3 and 5; 2 and 4 sit between. Hard-fail gates override the score.

### 6.1 Positioning document rubric

| # | Criterion | 1 (poor) | 3 (adequate) | 5 (expert) |
|---|---|---|---|---|
| P1 | **Alternatives** | Only lists named competitors or none | Lists competitors and one generic substitute | Names the real status-quo alternatives with evidence of switching ("switched from…") |
| P2 | **Differentiation** | Parity claims (quality, service, affordable); fails swap test | Some unique attributes, weakly evidenced | Unique attributes tied to value, each evidenced; passes swap test |
| P3 | **Value specificity** | Abstract benefits ("save time") | Outcomes named but not quantified or grounded | Concrete outcomes in customer language, quantified where data exists |
| P4 | **Best-fit segment** | "Small businesses" / "everyone" | Firmographic or demographic segment | Segment by observable traits + trigger event + disqualifiers |
| P5 | **Market frame** | Missing or vague | Category named, no reasoning | Frame chosen from alternatives considered; style (head-to-head / niche / new) justified |
| P6 | **Customer evidence** | None; invented personas | Some quotes, mostly own site | Verbatim VoC across 3+ sources with counts and links |
| P7 | **Messaging usability** | Abstract statements only | Headline plus pillars | Headline options, pillars with proof, objection lines, words to use / avoid, pitch narrative |
| P8 | **Honesty about confidence** | All stated as fact | Some caveats | Confidence per component; validation plan with a date |

Score bands: 34-40 expert; 26-33 usable with edits; below 26 redo.

### 6.2 Growth strategy rubric

| # | Criterion | 1 (poor) | 3 (adequate) | 5 (expert) |
|---|---|---|---|---|
| S1 | **Diagnosis** | Jumps to tactics | Generic SWOT | Names the single biggest constraint (e.g. "message unclear", "no demand capture", "CAC above margin") with evidence |
| S2 | **Constraint fit** | Ignores budget / hours / skills | Mentions budget | Every action sized to stated budget and hours; total adds up |
| S3 | **Unit economics** | None | Mentions CAC or LTV | Computes affordable CAC from price and margin and checks each channel against it |
| S4 | **Focus and prioritization** | 5+ channels, equal weight | 3-4 channels, loose ranking | 1 primary + 1 secondary, scored, with an explicit "not doing" list and reasons |
| S5 | **Business-type fit** | Same playbook for any business | Some tailoring | Channel mix matches business type, price point, buying behaviour and geography |
| S6 | **Specificity / executability** | "Leverage social media" | Named tactics, vague steps | Concrete actions with owner, cadence, assets, first-week checklist |
| S7 | **Measurement** | No metrics or vanity metrics | Lagging metrics only | North Star + leading indicators with weekly targets; tracking setup specified |
| S8 | **Experiment design** | No tests, or A/B tests impossible at this traffic | Tests listed without decision rules | Pre-registered tests sized to real volume, kill / scale thresholds |
| S9 | **Evidence and sourcing** | Invented or unsourced stats | Some sources | Every number sourced or labelled as assumption; uses the business's own data first |
| S10 | **Positioning linkage** | Strategy unrelated to positioning | Mentions positioning | Channels and creative explicitly carry the chosen position and VoC language |
| S11 | **Current-landscape awareness** | Pre-2024 playbook (blog SEO, interest targeting, company-page posting) | Mentions AI search | Adjusts channels for AI search, platform automation and measurement loss |
| S12 | **Risks and sequencing** | None | Lists risks | Sequenced phases, dependencies, risks with mitigations and review dates |

Score bands: 52-60 expert; 40-51 usable; below 40 redo.

### 6.3 Hard-fail gates (any one fails the output)
1. **Invented statistics**, benchmarks or quotes; any number without a source or "assumption" label.
2. **Budget mismatch:** plan requires more spend or hours than stated.
3. **No prioritization:** more than 3 active acquisition channels for a business under ~$50k/month revenue, or no ranking.
4. **Swap-test failure:** the core positioning line works unchanged for a named competitor.
5. **Fabricated customer evidence:** personas, quotes or review counts not traceable to a source.
6. **Unsafe or non-compliant advice:** fake reviews, review gating, scraping in breach of terms, misleading claims, ignoring regulated-industry rules.

### 6.4 Common failure modes of AI-written strategy (and the fix to instruct)

| Failure mode | What it looks like | Fix in the agent prompt / procedure |
|---|---|---|
| Generic advice | "Create valuable content", "engage your audience" | Require every action to name the asset, channel, audience, cadence and metric |
| Invented stats | "73% of consumers prefer…" | Hard gate; only cite fetched sources; else label assumption |
| Channel buffet | 6-10 channels "for omnichannel presence" | Force Bullseye output: 1 primary, 1 secondary, rejected list with reasons |
| Ignoring budget and hours | $5k ad plan for a $500 budget | Constraint table at top; sum check |
| Ignoring price point | Outbound sales for a $19/month product | Affordable-CAC calculation gate |
| Persona fiction | "Marketing Mary, 34, loves yoga" | Segments from observable traits and evidence only |
| Feature-led messaging | Lists features as benefits | Attribute → value → evidence chain (Section 1.2, step 4) |
| Superlative fog | "Best-in-class", "cutting-edge", "seamless" | Banned-word list; replace with proof or specifics |
| Stale playbook | Blog-first SEO, interest targeting, company-page LinkedIn | Section 5 checklist injected as current context |
| Untestable plan | No decision rules; A/B tests on 200 visits/month | Experiment card required with volume and threshold |
| Everything at once | 30 tasks in week 1 | Phase gates; week-1 list of no more than 5 items |
| False certainty | No caveats | Confidence label per claim, validation date |
| Ignoring what already works | Recommends new channels while referrals drive 60% | Step 0: audit current sources of customers before proposing new ones |
| Hollow competitor analysis | "Competitor has weak SEO" | Evidence counts from reviews, ad libraries, pricing pages |

---

## 7. Checklists for the engine

**Before writing any strategy (inputs checklist)**
- [ ] Business type, offer(s), price points, margin estimate
- [ ] Current monthly customers / revenue and where customers come from today
- [ ] Monthly budget and weekly hours; skills available
- [ ] Geography / market
- [ ] 90-day goal in the owner's words
- [ ] Website crawled (home, pricing, about, top service/product pages)
- [ ] VoC bank built (≥100 snippets, ≥3 source types) or noted as thin
- [ ] Competitor set (3-5 direct + 2-3 alternatives) torn down
- [ ] Ad libraries checked for competitors

**Before shipping a positioning doc**
- [ ] Alternatives include a non-product option
- [ ] Every unique attribute has evidence
- [ ] Swap test passed
- [ ] Segment has a trigger event and disqualifiers
- [ ] Phrase bank is verbatim with links
- [ ] Confidence and validation plan included

**Before shipping a growth plan**
- [ ] Affordable CAC computed
- [ ] 1 primary + 1 secondary channel; "not doing" list
- [ ] Budget and hours sum to what was stated
- [ ] North Star + 3-5 leading indicators with weekly targets
- [ ] Each experiment has volume, run time, decision rule
- [ ] Section 5 landscape checks applied (AI search, platform automation, measurement)
- [ ] Week-1 checklist of no more than 5 items
- [ ] No unsourced numbers

---

## 8. Source list (primary and key secondary)

- Dunford positioning summaries: [Wudpecker](https://wudpecker.io/blog/obviously-awesome-the-guide-to-perfecting-your-product-positioning), [Miro template](https://miro.com/templates/april-dunfords-positioning-template/); *Sales Pitch*: [Product Andrew](https://productandrew.substack.com/p/product-106), [Lenny's Podcast](https://www.lennysnewsletter.com/p/a-step-by-step-guide-to-crafting)
- JTBD four forces: [jobstobedone.org](https://jobstobedone.org/the-four-forces/); switch interview overview: [Koji](https://www.koji.so/docs/switch-interviews-jtbd-method)
- Raskin strategic narrative: [Antoine Buteau summary](https://www.antoinebuteau.com/lessons-from-andy-raskin/)
- StoryBrand critiques: [STFO](https://essays.stfo.io/posts/storybrand-is-frustrating-stfo), [Column Content](https://columncontent.com/storybrand-method-drawbacks/)
- Category design: [IndustryWeek on *Play Bigger*](https://www.industryweek.com/leadership/growth-strategies/article/22006449/are-you-different-or-just-better)
- Message mining: [Wistia, Joanna Wiebe](https://wistia.com/learn/marketing/joanna-wiebe-conversion-copywriting)
- Four Fits: [Brian Balfour](https://brianbalfour.com/essays/hubspot-growth-framework-100m)
- Traction / Bullseye: [Graham Mann notes](https://grahammann.net/book-notes/traction-gabriel-weinberg)
- RICE: [Railsware](https://railsware.com/blog/rice-framework/)
- A/B testing pitfalls: [Evan Miller](https://www.evanmiller.org/how-not-to-run-an-ab-test.html)
- AI search: [Pew](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/), [Seer via PPC Land](https://ppc.land/google-ai-overviews-reduce-organic-ctr-61-paid-traffic-68/), [Ahrefs via PPC Land](https://ppc.land/googles-ai-summaries-now-swallow-58-of-clicks-that-once-went-to-websites/), [Ahrefs AI conversions](https://ahrefs.com/blog/ai-search-traffic-conversions-ahrefs/), [Peec citations](https://docs.peec.ai/research/most-cited-domains-in-ai-search), [ROI Revolution June 2026](https://roirevolution.com/blog/june-2026-ai-search-news-recap/)
- Paid platforms: [Meta Andromeda](https://engineering.fb.com/2024/12/02/production-engineering/meta-andromeda-advantage-automation-next-gen-personalized-ads-retrieval-engine/), [Jon Loomer](https://www.jonloomer.com/meta-andromeda-creative-diversification/), [Google AI Max](https://support.google.com/google-ads/answer/15910366), [SEJ on LSA migration](https://www.searchenginejournal.com/google-is-bringing-local-services-ads/582816/), [AuthoredUp on LinkedIn reach](https://authoredup.com/newsletter/linkedin-vanishing-audience), [Shopifreaks on ChatGPT ads](https://www.shopifreaks.com/openai-expands-chatgpt-advertising-to-small-and-local-businesses-competing-with-google-meta-in-the-space/)
- Privacy: [Engadget on Privacy Sandbox](https://engadget.com/cybersecurity/google-has-killed-privacy-sandbox-130029899.html), [PPC Land on Safari 26](https://ppc.land/safari-26-tracking-changes-to-impact-marketing-measurement/), [TrustArc on 2026 state laws](https://trustarc.com/resource/new-in-2026-state-privacy-laws-in-indiana-kentucky-and-rhode-island/)
