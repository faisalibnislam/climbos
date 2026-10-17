# Creative-but-Predictable Growth Plays: Frameworks, Base Rates, Scoring

Research date: 17 Oct 2026. Audience: the people building the ClimbOS strategist, planner and critic agents, and the agents themselves (as system-prompt and tool-procedure material).

The owner's brief, in one line: **suggest out-of-the-box strategies, but with predictable results, and never settle for common solutions.**

These two goals look like they conflict. They do not, if the engine follows one rule:

> **Creative = a proven mechanic, applied to a non-obvious audience, asset, or moment.**
> The mechanic carries the predictability (it has a base rate). The audience, asset or timing carries the creativity (competitors are not doing it here).

A new-mover postcard is not creative for a dentist; every dentist does it. The same mechanic sent by an HVAC company to the same new movers, timed for the first heat wave, offering a "first-summer system check" and pitching a maintenance plan at the end of the visit, is creative for HVAC and still has a measurable base rate. Most of this document is about producing plays like that, estimating them honestly, and catching plays that are not.

Related docs: `../strategy-positioning.md` (positioning, Bullseye basics, the "no invented stats" gate) and `../leadgen-cold-email.md` (cold-email mechanics and deliverability). This doc does not repeat them.

### Evidence grades used throughout

Every base rate in this doc carries a grade. The engine must carry the grade into its output.

| Grade | Meaning | Prior strength `k` (see §2.4) |
|---|---|---|
| **A** | Large behavioural dataset with stated method (≥10k units), or a primary first-party case study with numbers | 100 |
| **B** | Vendor aggregate with a stated sample size, or a reputable survey | 50 |
| **C** | Vendor or agency claim without method, or a small case study | 20 |
| **D** | Single anecdote, founder post, or our own assumption | 10 |

Nearly all 2025-2026 channel data comes from vendors who sell the channel. Treat vendor numbers as optimistic and use the lower half of their ranges for planning (the "vendor haircut").

---

## 1. Frameworks for finding non-obvious channels, made runnable

Each framework below has: what it is, the **procedure** an AI planner runs given the business facts (the `BusinessProfile`: offer, price, margin, location or market, ICP, current channels, assets, constraints) and research results, and the **output** it should produce. The planner runs all of them. Each one produces candidate plays, and the rubric in §3 ranks the candidates.

### 1.1 Bullseye (Weinberg & Mares, *Traction*)

**What:** Brainstorm across all channels, rank them into an outer ring (possible), a middle ring (probable) and an inner ring (best three), run cheap tests on the inner ring, then focus on the one that works and repeat when it saturates ([Graham Mann's notes](https://grahammann.net/book-notes/traction-gabriel-weinberg); [Penguin Random House listing](https://www.penguinrandomhouse.com/books/319121/traction-by-gabriel-weinberg-and-justin-mares/9781591848363/)). The authors also tell founders to spend about half their time on traction.

**The 19 traction channels:**

| # | Channel | Modern (2026) form the engine should also consider |
|---|---|---|
| 1 | Targeting blogs | Niche newsletters, Substack/beehiiv writers, YouTube reviewers |
| 2 | Publicity (PR) | Journalist pitches, local press, trade press |
| 3 | Unconventional PR | Stunts, public data releases, "lightning strikes" |
| 4 | Search engine marketing | Google Ads, Local Services Ads, Apple Search Ads |
| 5 | Social and display ads | Meta, TikTok Spark Ads, Reddit, LinkedIn, creator whitelisting |
| 6 | Offline ads | EDDM postcards, door hangers, radio, out-of-home |
| 7 | SEO | Programmatic pages, comparison pages, AI-answer (GEO) visibility |
| 8 | Content marketing | Short video, data reports, teardown series |
| 9 | Email marketing | Lifecycle flows, win-back, newsletters, SMS |
| 10 | Viral marketing | Referral programmes, share loops, invite mechanics |
| 11 | Engineering as marketing | Free tools, calculators, graders, open-source |
| 12 | Business development | Partnerships, co-marketing, integrations, channel partners |
| 13 | Sales | Cold email, LinkedIn, calls, walk-ins |
| 14 | Affiliate programmes | Affiliate codes, creator commissions, referral partners (COIs) |
| 15 | Existing platforms | App marketplaces, Etsy/Amazon, Google Business Profile, Nextdoor, review sites |
| 16 | Trade shows | Vertical expos, farmers' markets, wedding fairs |
| 17 | Offline events | Workshops, clinics, pop-ups, leagues, tastings |
| 18 | Speaking engagements | Podcasts, webinars, chamber talks, meetups |
| 19 | Community building | Discord/Slack, Facebook Groups, Reddit, local clubs |

**Procedure (AI):**
1. For each of the 19 channels, write **one concrete idea** specific to this business (audience + hook + mechanic). An idea that cannot be made specific is dropped, not kept as a vague placeholder. This forced pass is where the non-obvious ideas come from; do not skip channels just because they feel off-category.
2. For each idea, attach a base rate from §2 (or "none, grade D assumption").
3. Score all ideas with the rubric in §3. The top 3 to 5 become the inner ring.
4. For each inner-ring idea, design a test (§2.5) that produces a signal in 2 to 3 weeks for at most 10 to 20% of the monthly budget.
5. Record which channels were rejected and why. The critic checks this list.

**Output:** `bullseye: [{channel, idea, base_rate_ref, score, ring}]` plus `rejected: [{channel, reason}]`.

### 1.2 "Where your customers already gather" map

**What:** Customers already spend attention somewhere. Renting, borrowing or joining that place beats building a new audience.

**Procedure (AI):**
1. From the ICP, list 10 to 20 **named** gathering places across five layers:
   - *Online communities:* specific subreddits, Facebook Groups, Discord servers, Slack communities, forums.
   - *Media they consume:* specific newsletters, podcasts, YouTube channels, local publications.
   - *Physical places:* gyms, schools, coworking spaces, churches, farmers' markets, trade counters.
   - *Tools and platforms they use:* Shopify, HubSpot, Airbnb, Etsy, Google Business Profile, booking apps.
   - *Professionals they already trust:* accountants, realtors, inspectors, wedding planners, HR managers.
2. For each place, record its size (members, subscribers, downloads, foot traffic), activity (posts per week, last episode date), its rules on promotion, and the gatekeeper (moderator, editor, owner).
3. Mark the places where **no competitor is visibly present**. These are the creative candidates.
4. Map each place to a channel from 1.1 (sponsorship, guest appearance, partnership, community participation).

**Output:** `gathering_map: [{place, layer, size, activity, gatekeeper, promo_rules, competitor_presence, url}]`. Without a URL or a name, the entry is invalid.

### 1.3 Jobs-to-be-done triggers (switch moments)

**What:** People buy when a struggle peaks. Moesta's timeline runs first thought, passive looking, active looking, deciding, first use, ongoing use. A trigger event moves someone from passive to active looking ([HBS Working Knowledge, adapted from *Job Moves*, 2024](https://www.library.hbs.edu/working-knowledge/understanding-the-mental-journey-of-job-change); [Antoine Buteau's notes on Moesta](https://www.antoinebuteau.com/lessons-from-bob-moesta/)). Marketing that arrives at the trigger converts far better than marketing that arrives at random. Cold-email vendors report the same effect: high-intent trigger campaigns sit around 10 to 20%+ reply versus low single digits for broad lists ([Instantly](https://instantly.ai/blog/cold-email-reply-rate-benchmarks), grade C).

**Procedure (AI):**
1. List the struggling moments for this offer, in the customer's words (mine reviews, Reddit threads and competitor reviews for phrases like "finally", "fed up", "after X happened").
2. For each moment, find an **observable signal** that shows when it happens:
   - *Life events:* moving house, new baby, wedding, retirement, new job.
   - *Business events:* funding, a hiring post for a role, a new location, a tool migration, a bad review, a compliance deadline.
   - *Calendar events:* tax deadlines, first heat wave, back to school, January resolutions, Q4 gifting.
3. For each signal, name the data source (new-mover lists, job boards, permit filings, Crunchbase, weather forecasts, the calendar).
4. Create a play that reaches people **within the trigger window**, using an offer that solves the specific struggle.

**Output:** `triggers: [{moment, signal, data_source, window_days, offer}]`.

### 1.4 Borrowed audiences

**What:** Someone else already has the attention of your buyers: partners, creators, marketplaces, platforms, professionals. You borrow it in exchange for value (commission, content, a better offer for their audience, reciprocity).

**Procedure (AI):**
1. From the gathering map, pick the owners of audiences (newsletter writers, podcast hosts, creators, complementary businesses, platform marketplaces, centres of influence).
2. For each, answer: what do **they** get? Options are money (sponsorship, affiliate), content (a free expert episode, data), a better offer for their audience (an exclusive discount), or a service upgrade (their customers get something they would otherwise have to provide).
3. Pick the borrowing mechanic: sponsorship, guest appearance, co-hosted event, bundle, integration listing, referral agreement, white-label.
4. Size it as audience × engagement rate × conversion, using §2 base rates.
5. Prefer **complementary-business** borrowing for local businesses. They have trust, low cost and the same customer at a different moment (realtor → mover → cleaner → HVAC → dentist).

**Output:** `borrowed: [{owner, audience_size, value_to_owner, mechanic, est_reach, base_rate_ref}]`.

### 1.5 Unfair-advantage and assets audit

**What:** Every business has assets competitors cannot copy cheaply: a founder story, proprietary data, an existing customer list, a location, relationships, certifications, a kitchen that sits idle at 3pm, a van that drives through 40 neighbourhoods a week.

**Procedure (AI):**
1. Run through a fixed checklist and record evidence for each item:
   - *Founder:* story, credentials, unusual background, audience.
   - *Data:* job histories, prices, outcomes, anonymised trends.
   - *Customers:* list size, last purchase dates, NPS, reviews.
   - *Community:* a club, regulars, local fame.
   - *Location:* foot traffic, a visible storefront, neighbours.
   - *Capacity:* idle hours, equipment, vehicles.
   - *Relationships:* suppliers, partners, past employers.
   - *Proof:* awards, case studies, before/after results.
2. For each asset with evidence, ask: "Which play is possible only because of this asset?"
3. Flag plays that use an asset. They score higher on fit and on distinctiveness.

**Output:** `assets: [{asset, evidence, plays_enabled}]`.

Typical high-value assets the engine misses:
- **Dormant customer lists.** Win-back flows convert 2 to 5% of lapsed recipients, and top programmes reach 5 to 10% ([Eightx](https://eightx.co/blog/average-win-back-reactivation-rate-benchmarks), C).
- **Proprietary job data** turned into a local report, which is unconventional PR.
- **Idle capacity** turned into an event or class.

### 1.6 Counter-positioning

**What:** Adopt a model the incumbent will not copy because copying it would damage their existing business. Helmer's examples are Vanguard against active managers and Netflix against Blockbuster ([Eagle Point Capital summary of *7 Powers*](https://eaglepointcapital.substack.com/p/7-powers-a-summary-of-competitive)). Small businesses can counter-position too: flat pricing against hourly billers, guaranteed arrival windows against "between 8 and 5", a membership against per-visit pricing, no-contract against annual lock-in, a photo-proof guarantee against "trust us".

**Procedure (AI):**
1. List the top 3 competitors' business models: pricing unit, contract terms, channel and promise.
2. For each, find the **thing they profit from that customers hate** (call-out fees, lock-in, upsell pressure, vague timelines, hidden fees).
3. Propose a model that removes it and that the competitor cannot match without cannibalising revenue.
4. Check the unit economics: does this business still make money under the new model?
5. Turn the counter-position into a hook ("No call-out fee, ever. We get paid when it's fixed.") and attach it to a channel play.

**Output:** `counter_positions: [{competitor_model, customer_pain, our_model, why_they_cant_copy, hook, margin_check}]`.

### 1.7 Timing and seasonality hooks

**What:** The same message works much better when the world gives a reason to act now.

**Procedure (AI):**
1. Build a 12-month calendar for the business: demand peaks and troughs (from search trends and the owner's own sales), statutory deadlines, weather, holidays, local events, school terms and industry events.
2. For each peak, plan **6 to 8 weeks ahead**: pre-orders, pre-season bookings, early-bird offers. Most competitors start at the peak.
3. For each trough, design a counter-seasonal offer (off-season maintenance, corporate bookings and gifting, classes).
4. Add "newsjacking" slots: local news, viral trends, a weather event. Keep a ready-made response template for each.

**Output:** `calendar: [{date_window, hook, play, lead_time_weeks}]`.

### 1.8 Growth loops vs funnels (Reforge)

**What:** A funnel needs new spend at the top each time. A loop is a closed system where the output of one cycle becomes the input of the next: a user invites users, content generates searches that generate content, customers generate reviews that generate customers ([Reforge, "Growth Loops are the New Funnels"](https://www.reforge.com/blog/growth-loops)). Loops compound; funnels do not.

**Procedure (AI):**
1. For each candidate play, ask: "Does the output create more input?" Examples:
   - A finished job produces a review, the review improves local ranking, and better ranking brings more jobs.
   - A customer shares a streak card, the card brings new users, and new users share their own cards.
   - Each teardown video produces content, the content brings inbound requests, and requests produce more teardowns.
2. Write the loop as `input → action → output → reinvested as input`, and estimate the **cycle time** and the **multiplier** for each step.
3. If no loop exists, can a small addition create one? Add a review request to every job, a share card to every milestone, or a referral ask to every delivery.
4. Mark plays with a loop as `compounding = 5` in the rubric.

Duolingo's streak, leaderboard and notification work is a strong loop case: the team reports roughly 4.5x DAU growth over four years from those levers plus others ([Lenny's Newsletter, Jorge Mazal](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth), A).

### 1.9 Engineering as marketing

**What:** Build a free tool, calculator, grader, template or open-source utility that your buyer uses in the job before they need you. HubSpot's Website Grader (2006) is the classic case: a free audit that qualified marketing buyers at the start of HubSpot's life ([HubSpot](https://www.hubspot.com/blog/bid/4056/250-000-companies-test-their-internet-marketing-acumen-with-website-grader)).

**Procedure (AI):**
1. List the calculations, checks or decisions the customer makes **before** they buy. Examples: "how much will a new AC cost?", "is my tax notice serious?", "how much flour for 40 people?", "what is my home worth?", "is my email list healthy?".
2. Pick one with search demand (keyword volume) or community demand (repeated forum questions).
3. Specify the smallest useful version. For small businesses this can be a Google Sheet, a one-page calculator or a manual service; ClimbOS should build the tool itself, in line with the build-our-own default.
4. Define the capture point (email to get the result, a "book a check" button) and the expected usage (search volume × CTR × completion).
5. Prefer tools whose output **names the business's service** as the next step.

**Output:** `tools: [{decision, demand_evidence, mvp_spec, capture, est_monthly_users}]`.

### 1.10 Do things that don't scale (Paul Graham)

**What:** Recruit early users by hand, delight them disproportionately, and do manually what you will later automate ([Paul Graham, "Do Things That Don't Scale"](https://www.paulgraham.com/ds.html)). For a small business this means walking into offices with samples, hand-recording 50 personal videos, calling every past customer, or personally fixing a prospect's problem before they pay.

**Procedure (AI):**
1. For each top play, ask: "What would the founder do personally, for 20 people, this week, that a competitor's marketing team never would?"
2. Cap it at 20 to 50 units, so the effort is bounded.
3. Plan to capture **learning** from it (which words got replies, which objections came up) and feed that into the scalable version.
4. Pair it with a scalable follow-on play so the plan does not stop at hand-work.

The engine should treat these as the best **time-to-signal** plays, because response rates on personal effort are many times higher than on broadcast. Personalised video reportedly lifts cold reply from about 4% to 10-16% ([FirstSales](https://firstsales.io/blog/video-cold-email-loom), C).

### 1.11 Category design (use sparingly)

**What:** Define a new problem frame, name the category, and run a concentrated "lightning strike" to claim it ([Play Bigger summary, Antoine Buteau](https://www.antoinebuteau.com/play-bigger-book-summary/)). As `../strategy-positioning.md` notes, this is rarely right for small businesses because educating a market costs money.

**Procedure (AI):** Use only the cheap part: a **named point of view** that reframes the buyer's problem ("The 8-to-5 window is dead: 2-hour arrival or it's free"), plus one concentrated launch moment. Allow full category design only if all of these hold:
- No existing category describes the offer.
- Budget for education exists.
- The founder has a platform.

### 1.12 The creative-play generator (how the frameworks combine)

Run this pipeline for every business. It forces recombination, which is where creativity comes from.

1. **Facts in:** BusinessProfile, unit economics (price, gross margin, LTV and capacity), constraints (budget, founder hours per week) and research results (competitors, reviews, communities).
2. **Generate raw candidates** (aim for 40 to 60):
   - Bullseye: 19 channel ideas.
   - Gathering map: at least 10 places, giving at least 5 ideas.
   - Triggers: at least 5 ideas.
   - Borrowed audiences: at least 5 ideas.
   - Assets: at least 3 ideas.
   - Counter-positions: at least 2 ideas.
   - Calendar: at least 3 ideas.
   - Loops: at least 2 ideas.
   - Tools: at least 2 ideas.
   - Don't-scale: at least 2 ideas.
3. **Recombine.** Build at least 10 combinations of `mechanic × audience × asset × moment`, each drawn from different lists. For example: new-mover mailer (mechanic) × home inspectors (borrowed audience) × "system age" data from the owner's job history (asset) × first heat wave (moment).
4. **Transplant.** For each top mechanic, ask: "Which other industry uses this with a known base rate?" Then borrow that base rate. This is the main source of plays that are both creative and predictable. Examples:
   - Dental new-mover mail → HVAC.
   - SaaS integration marketplace → cleaning company listed in a property-management platform's vendor directory.
   - Course creator's 5-day challenge → gym's 6-week corporate league.
5. **Score** every candidate (§3). Apply the gates.
6. **Assemble the portfolio** (§3.4): 1 bankable play, 1 to 2 creative-proven plays, and at most 1 capped moonshot.
7. **Critic pass** (§4). Rewrite or drop any play that fails the critic.
8. **Output play cards** (schema below).

**Play card schema** (what each recommended play must contain):

```yaml
play:
  name: "Inspector handoff + first-summer system check"
  one_liner: "..."
  audience: {who: "...", where: "named list/place + URL", size: 1200}
  trigger: "moved in < 60 days, first heat wave forecast"
  hook: "the exact offer/line"
  mechanic: "new-mover postcard + inspector voucher + plan pitch at visit end"
  asset_used: "12 years of system-age data from job history"
  frameworks: [triggers, borrowed_audience, transplant]
  forecast:
    funnel: [{step: "cards mailed", n: 500}, {step: "calls", rate: [0.018, 0.045], src: "...", grade: C}, ...]
    outcome_p10_p50_p90: [2, 5, 9]          # e.g. maintenance plans / month
    assumptions: ["data < 1 week old", "..."]
    confidence: medium
  test:
    size: 500 cards
    budget: 260
    duration_days: 21
    leading_metric: "calls per 100 cards"
    kill_if: "< 0.8 calls per 100 cards after 500 cards"
    scale_if: "> 2.0 calls per 100 AND ≥ 1 plan sold"
  score: {fit: 5, predictability: 3, leverage: 3, time_to_signal: 3, compounding: 4, cost: 4, risk: 5, total: 78, distinctiveness: 4}
  first_action_today: "Pull this month's new-mover list for ZIPs 78704, 78745"
```

---

## 2. Estimating results predictably

### 2.1 Base-rate table (cite these; prefer the conservative end)

All rates are per unit stated. "Vendor" means the source sells the channel.

#### Outbound and outreach

| Activity | Base rate (planning range) | Notes | Grade | Source |
|---|---|---|---|---|
| Cold email reply rate (B2B, platform average, 2025 data) | **3.43%** average; top quartile 5.5%; top 10% ≥10.7% | Jan to Dec 2025 platform data. 58% of replies come from step 1 (see `../leadgen-cold-email.md`) | B | [Instantly 2026 benchmarks](https://instantly.ai/blog/cold-email-reply-rate-benchmarks), via [The Digital Bloom](https://thedigitalbloom.com/learn/cold-outbound-reply-rate-benchmarks/) |
| Cold email reply by segment | Legal ~10%; healthcare/medtech 4-6%; manufacturing 4-5%; financial services ~3.4%; SaaS 1.9-3.5% | Secondary breakdown; directionally useful | C | [Cleverly](https://www.cleverly.co/blog/cold-email-benchmarks-by-industry); [Something Inc](https://somethinginc.com/blog/cold-email-response-rates-2026-data/) |
| Cold email, conservative realistic blend | 1-2% of contacts | Large-sample sceptic view (1.59M sends) | C | [Danish Lead Co](https://danishleadco.io/blog/b2b-outbound-benchmarks) |
| Cold email per email *sent* (different denominator) | 0.45% avg; food & beverage 3.47% | Unique replies ÷ all emails sent, including follow-ups | B | Belkins 2026 study, cited by [Instantly](https://instantly.ai/blog/cold-email-reply-rate-benchmarks?lng=en) and [Something Inc](https://somethinginc.com/blog/cold-email-response-rates-2026-data/) |
| Trigger-based / high-intent cold email | 10-20%+ reply | Tight segment, visible trigger, strong placement | C | [Instantly](https://instantly.ai/blog/cold-email-reply-rate-benchmarks) |
| Follow-up effect | 1st follow-up +49% replies; 2nd +9%; 3rd −20% | Stop after 2 follow-ups for most local and SMB work | B | Belkins, via [b2brocket](https://www.b2brocket.ai/blog-posts/cold-b2b-email-stats-effective-series) |
| Personalised video (Loom) outreach | 10-16% reply vs ~4% text | Vendor-adjacent; plan on 2-3x text | C | [FirstSales](https://firstsales.io/blog/video-cold-email-loom) |
| LinkedIn connection acceptance | **28.5%** avg; 30-45% good targeting; <20% means a targeting or profile problem | 13.2M requests, May 2025 to Apr 2026 | B | [Expandi](https://expandi.io/blog/linkedin-outreach-benchmarks); [Salesflow](https://salesflow.io/blog/linkedin-outreach-templates) |
| LinkedIn reply after acceptance | **10.4%** avg (reply to connection note alone: ~3.0%) | Staffing 18.9% | B | [Expandi](https://expandi.io/blog/linkedin-outreach-benchmarks) |
| Journalist pitch response | **2.5-3.5%** per pitch; <150 words 5.89% vs >500 words 1.46% | Propel, ~400k pitches | B | [Everything PR / 5W study](https://everything-pr.com/epr-research-and-5w-release-the-pr-pitch-response-rate-study-2026) |
| Journalist attitudes | 54% seldom or never respond; 86% delete irrelevant pitches; 69% prefer <200 words | Muck Rack surveys | B | [PR Daily](https://www.prdaily.com/by-the-numbers-what-journalists-really-think-of-your-pitches/); [UMN on Muck Rack 2026](https://umarcomm.umn.edu/blog/2026/04/13/pitching-journalists-muck-racks-state-journalism-2026) |
| Podcast guest pitch | Median **5%** acceptance, 17.5% response; **25-35%** to a well-targeted list | Podchaser 2026 report via secondary | C | [FirstSales](https://firstsales.io/blog/podcast-guest-pitch-email) |
| Creator outreach reply, by tier | Nano (1-10k) 40-60%; micro (<100k) 15-25%; macro 5-10%; mega 2-5%; generic templates <2% | All vendor figures; use the low end | C | [Elev8or](https://www.elev8or.io/blog/influencer-outreach-email-templates); [Favikon](https://www.favikon.com/blog/how-to-do-influencer-outreach-templates-and-tips-that-actually-get-replies); [Hubfluence](https://www.hubfluence.io/influencer-outreach) |
| Gifted-product post rate (seeding) | Nano 40-70%; micro 20-35% | Only 19% of marketers see meaningful advocacy (unverified study) | C | [Elev8or seeding guide](https://www.elev8or.io/blog/influencer-gifting-and-product-seeding-guide); [Ecommerce Fastlane](https://ecommercefastlane.com/?p=199034) |
| Partnership / co-marketing cold outreach | Use cold B2B proxy, **3-6%** reply; warm intros much higher (no good benchmark) | No partner-specific dataset exists | C/D | [Apollo](https://www.apollo.io/insights/what-is-a-good-benchmark-for-reply-rates-in-cold-outreach) |
| Centres of influence (CPA, attorney) as a new-client source | 13.9% of new clients (financial advisors); client referrals 54.2% | Proxy for professional services | B | [Cerulli 2025](https://www.cerulli.com/press-releases/financial-advisors-increasingly-leverage-cois-to-capture-new-client-growth) |
| Real-estate expired listings | ~4% of contacted → appointment; top prospectors 5-10%; 30-50% of appointments → listing | Vendor and coach data | C | [PropStream](https://www.propstream.com/real-estate-agent-blog/5-benefits-of-pursuing-expired-listings-as-an-agent); [EstatePass](https://www.estatepass.ai/tools/expired-listing-scripts/guide/) |

#### Reviews, referrals, retention

| Activity | Base rate | Notes | Grade | Source |
|---|---|---|---|---|
| Review requests (all platforms) | Email ~**15** reviews per 100 requests; SMS ~**20** per 100 | Best sourced comparison | B | [GatherUp](https://gatherup.com/blog/sms-vs-email-review-requests/) |
| Contractor review yield | 15-25 reviews per 100 completed jobs is healthy | Vendor | C | [Fera / contractor summary](https://www.fera.ai/features/increase-review-conversions); [Mobile Text Alerts](https://mobile-text-alerts.com/articles/sms-marketing-benchmarks) |
| Google's share of local review research | 83% of consumers use Google for local reviews; 89% expect owners to respond | BrightLocal 2025 | A | [BrightLocal LCRS 2025](https://www.brightlocal.com/research/local-consumer-review-survey-2025/) |
| G2 review campaigns | ~5.7% of contacted users wrote a G2 review (90 of 1,567, chocolate-bar incentive); A/B test: 6 reviews without incentive vs 11 with one | Small samples. Incentives must not depend on star rating | C | [Postal / UserEvidence](https://www.postal.com/blog/customer-advocacy-campaign); [Sendoso](https://sendoso.com/blog/nps-g2-reviews-campaign/); [G2 docs](https://documentation.g2.com/docs/review-campaigns) |
| Referral programme participation (customers who share) | **5-15%** of customers; B2B software 3-7%; health/wellness 10-18% | Definitions vary widely | C | [Rivo](https://www.rivo.io/blog/referral-program-statistics); [Prefinery](https://www.prefinery.com/blog/10-key-referral-program-metrics-to-track-2025/) |
| Referral conversion (e-commerce) | Median 3-5% of referred visitors; top quartile 8%+ | | C | [ReferralCandy](https://www.referralcandy.com/blog/referral-program-benchmarks-whats-a-good-conversion-rate-in-2025) |
| Win-back flow conversion | 2-5% of lapsed recipients buy; top quartile 5-10%. 90-180 days lapsed responds far better than 12+ months | Measure against a holdout | C | [Eightx](https://eightx.co/blog/average-win-back-reactivation-rate-benchmarks) |
| HVAC maintenance plan attach | Average 20-25% of service calls; top shops 30-50%; **35-55%** when pitched at the end of a paid visit vs **1-4%** by cold mailer | Shows how much the moment of the pitch matters | C | [Pipelineon](https://pipelineon.com/blog/hvac-membership-conversion-script/); [Applause](https://www.applausehq.com/blog/hvac-membership-programs) |
| HVAC agreement renewal | 70-80% target; industry average retention ~66% | | C | [Webtonic](https://www.webtonic.io/blog/hvac-lifecycle-and-retention-marketing-statistics/) |

#### Owned and paid media

| Activity | Base rate | Notes | Grade | Source |
|---|---|---|---|---|
| Email campaigns (all industries) | 43.46% open (inflated by Apple MPP), **2.09%** click | 3.6M campaigns, Dec 2024 to Nov 2025 | A | [MailerLite](https://www.mailerlite.com/blog/email-marketing-benchmarks) |
| SMS campaigns (US) | Click "good" 8.9-14.5%; conversion 1.0-2.0%; flows ~10% click | 167k+ Klaviyo customers | A/B | [Klaviyo help centre](https://help.klaviyo.com/hc/en-us/articles/360051110111-Campaign-SMS-and-MMS-benchmarks-) |
| Newsletter sponsorship | ~**2%** CTR of subscribers; CPC **$1-6** (B2B $1.50-8); CPM $15-30 typical, B2B tech up to ~$100 | Judge on CAC, not CPM | B/C | [beehiiv](https://www.beehiiv.com/blog/newsletter-sponsorship-cost); [Passionfroot guide](https://files.tryflowdrive.com/293/file-d1af3435-221b-4da4-b1de-4e3aa34a81b6_Passionfroot-Pricing-Guide.pdf); [Dupple](https://dupple.com/learn/cpm-benchmarks-b2b-newsletters) |
| Affiliate click → sale | **0.5-1%** typical; network average ~0.8%; impact.com reports conversion down 6% YoY in 2025 | | B/C | [Webtonic](https://www.webtonic.io/blog/affiliate-network-statistics); [JoinBrands](https://joinbrands.com/blog/affiliate-marketing-conversion-rates/) |
| Meta lead ads cost per lead (US, Oct 2025) | Median **$27.66**; home improvement $41.26; health & fitness $52.98; dentists $76.71 | LocaliQ data via secondary | B | [LocaliQ](https://localiq.com/blog/facebook-advertising-benchmarks/); [Superscale](https://superscale.ai/learn/facebook-ads-cost/) |
| Google Local Services Ads, HVAC | **$45-85** per lead; ~$51 average, ~44% book rate; urban areas 20-50% higher | | C | [FieldCamp](https://fieldcamp.ai/hvac-software/hvac-advertising/); [Webtonic](https://www.webtonic.io/blog/hvac-google-ads-statistics) |
| Direct mail response | ~4.4% overall; house list 5-9%; prospect list ~2.7-3.2%; triggered (new mover, birthday) 8-14% | ANA/DMA 2025 via secondary; triggered figure is vendor | B/C | [4over4](https://www.4over4.com/statistics/direct-mail-response-rate-benchmarks); [directmail.io](https://directmail.io/direct-mail-response-rate) |
| New-mover mail | 4.47% response with data under 1 week old vs 1.82% older; families choose a dentist within 4-8 weeks of moving | Vendor; data freshness is the key variable | C | [Minuteman Press Boca](https://www.bocaraton.minutemanpress.com/mmpboca_blog/mmpboca_blog.html/article/2026/02/04/new-mover-postcards-how-boca-raton-dentists-capture-patients-before-competitors) |
| USPS EDDM postage | $0.247 per piece retail (July 2025); about $0.26 after July 2026; 1,000 pieces ≈ $373-523 including print | 200-piece minimum per drop | B | [Click2Mail](https://blog.click2mail.com/2025/09/10/usps-postcard-mailing-cost/); [Oppizi](https://oppizi.com/us/en/resources/blog/direct-mail/direct-mail-cost-in-the-us/) |
| In-store / in-person sampling | **10-15%** trial-to-purchase (practitioner); 15-35% (vendor guide) | | C | [Strategy Online](https://strategyonline.ca/?p=17508); [Makai](https://www.makaiinc.com/insights/structured-retail-sampling-pilots-trial-lift) |
| Webinar registrant → live attendee | 57-60% on enterprise platforms with own lists; median ~41.6%; **21-34%** for small operators | | B/C | [MarketingProfs on ON24](https://www.marketingprofs.com/charts/2025/52917/b2b-webinar-benchmarks-conversion-attendance-personalization?e=4); [Konabayev](https://konabayev.com/blog/webinar-marketing-statistics-2026/) |
| 5-day challenge → paid | 15-30% of participants (warm audiences higher) | Vendor; completion and purchase rates often conflated | C | [Passion.io](https://passion.io/blog/how-to-make-money-selling-courses-online); [Membership.io](https://membership.io/blog/the-paid-5-day-challenge-that-converted-at-43-sarah-williams-coaching-week-playbook) |

#### Launch platforms and apps

| Activity | Base rate | Notes | Grade | Source |
|---|---|---|---|---|
| Product Hunt launch | #5 of the day: ~286 visitors, 10 users. #2: ~1,317 visitors in a week, 85 users. #1 of the day (2025): 50+ signups. #1 of the month: 3.9k visitors and a lift in weekly signups | Top 5 gets the daily newsletter feature. B2C and dev-friendly products do best | D (founder reports) | [Commit Club via Hexa/kp](https://kp.substack.com/p/what-does-a-successful-product-hunt); [Peerlist, Flexprice](https://peerlist.io/lipkovskiy/articles/what-it-took-to-get-1-product-of-the-day-on-product-hunt-in-); [Tally](https://blog.tally.so/product-hunt-launch-results/) |
| Show HN front page | ~2.2k-11k unique visitors; ~20-300+ signups | Worth it mainly for developer and technical buyers | D | [KTool / Indie Hackers](https://www.indiehackers.com/post/front-page-of-hn-the-full-postmortem-traffic-lessons-surprises-cbe9e0a7f6); [FounderPhone](https://www.indiehackers.com/product/founderphone/got-to-the-front-page-of-hacker-news--M0RVFlA5X2eugwuvNXT); [Stackmatix](https://www.stackmatix.com/blog/launching-on-hacker-news) |
| GitHub star → paid | 0.5-2% (unsourced); stars older than 3-6 months rarely convert | Stars show curiosity, not purchase intent | D | [Clarm](https://clarm.com/blog/articles/convert-github-stars-to-revenue); [Debugging GTM](https://debugginggtm.substack.com/p/github-stars) |
| Health & fitness app CPI (US) | iOS ~$2.00-5.50; Android ~$1.00-3.00 | 25th-75th percentile, unnamed reports | C | [The Social Outline](https://thesocialoutline.com/blog/cpi-benchmarks-health-fitness-apps) |
| Health & fitness trial → paid | Median 39.9%; top 10% 68.3% | RevenueCat SOSA 2025 via secondary | B | [The Social Outline](https://thesocialoutline.com/blog/cpi-benchmarks-health-fitness-apps) |
| Organic Reddit (B2B test) | ~$600 → 200 conversations → 15% click-through → 10% book a demo (≈74 demo requests in Q1) | Single case. Reddit punishes disguised promotion | D | [ReddVisible](https://reddvisible.beehiiv.com/p/organic-reddit-beats-linkedin-ads-by-300-per-demo) |

**Gaps the engine must not fill with invented numbers:** marketplace-listing share of signups, partnership acceptance rates, local event attendance, and Nextdoor or Facebook Group post conversion have **no reliable public benchmark**. For these, the engine labels the rate "assumption (grade D)", gives a wide range, and makes the first test's job to replace it.

### 2.2 Building a forecast from base rates

Every forecast is a funnel of steps. Each step has a base-rate range, and its source and grade are cited.

```
units_attempted × step_rate_1 × step_rate_2 × ... = outcome
```

Rules:
1. **One step per measurable event**: sent → delivered → replied → positive → meeting → won. Never skip steps, because skipping hides the riskiest assumption.
2. **Use a low/likely/high range for every step.** Likely = the lower half of the vendor range (the vendor haircut). Low = the bottom of the range or the conservative source. High = the top quartile.
3. **Do not multiply all the lows together** to get P10. That compounds into a near-impossible worst case. Instead:
   - *Preferred:* run 2,000 Monte Carlo draws, with each step drawn from a triangular(low, likely, high) distribution. Report P10, P50 and P90 of the outcome. This is cheap to compute in code.
   - *Shortcut:* P50 = the product of the likely values. P10 ≈ P50 × 0.4 and P90 ≈ P50 × 2.0 for three or more uncertain steps; widen further if any step is grade D.
4. **State the outcome in business units** (booked jobs, members, MRR, gross profit), not in vanity units (impressions).
5. **List the assumptions explicitly**, especially the ones the business controls (data freshness, offer strength, follow-up speed).
6. **Confidence label** = the lowest grade among the steps, adjusted for fit. High: all steps A/B and a similar business. Medium: at least one step C. Low: any step D.

**Example (HVAC new-mover mailer):**

| Step | n / rate | Source |
|---|---|---|
| Cards mailed | 500 | |
| Calls (response) | low 1.0%, likely 2.0%, high 4.5% | New-mover vendor data, C |
| Booked check | low 40%, likely 50%, high 65% | LSA book rate ~44% as proxy, C |
| Plan attach at end of visit | low 25%, likely 35%, high 55% | Pipelineon, C |

- **P50** ≈ 500 × 0.02 × 0.5 × 0.35 ≈ **1.75 plans/month**, plus about 5 paid checks.
- Monte Carlo gives roughly **P10 0.8, P90 4.5 plans**.
- **Confidence: medium.**
- **Key assumption:** the list data is under 7 days old.

### 2.3 How to say it (output wording)

Template the engine must use:

> **Expected:** 3-9 booked tune-ups and 1-4 maintenance plans from 500 postcards in 3 weeks (most likely about 5 tune-ups and 2 plans).
> **Why we think so:** new-mover mail draws 1.8-4.5% response when the list is fresh ([source], vendor data, grade C). We plan on 2%. Plans attach at 35-55% when offered at the end of a paid visit ([source], grade C).
> **Confidence:** medium. The biggest unknown is the response rate in your ZIPs.
> **We'll know by:** day 21. Kill if fewer than 4 calls from 500 cards; scale to 2,000 cards a month if at least 10 calls and at least 1 plan.

Never give a single-point promise. Never say "guaranteed". Always give the date by which the forecast will be replaced with real data.

### 2.4 Bayesian updating: why predictability arrives fast

Treat each base rate as a prior, and let the test data take over as it arrives.

- Prior: Beta(α₀ = p₀·k, β₀ = (1−p₀)·k), where p₀ is the planning base rate and k is the prior strength from the grade table (A=100, B=50, C=20, D=10).
- After n attempts with s successes: **posterior mean = (α₀ + s) / (k + n)**.
- Example: cold email, p₀ = 3.4%, grade B (k=50). After 200 sends with 12 replies, the posterior is (1.7 + 12)/(250) = **5.5%**. The forecast has moved most of the way to the observed 6% after only 200 sends.
- Weak priors (C/D) give way to data almost immediately. That is the point: a creative play with a grade-D prior becomes predictable after one small test.
- The engine stores posteriors per business and per play type. Across customers, these become ClimbOS's own grade-A base rates (a proprietary data asset, see §5 note).

### 2.5 Designing the small test (budget, sample size, stop/scale rules)

**Step 1: Pick the leading indicator.** Use the earliest event that predicts revenue: reply rate, call rate, booking rate, click-to-signup. Revenue is the lagging check.

**Step 2: Sample size.** Use the larger of the following.
- **Event rule:** enough units to expect about 10 positive events at the base rate. n ≈ 10 / p.
  - Cold email at 3.4%: ~300 contacts.
  - Podcast pitches at 17.5% response: ~60 pitches.
  - Postcards at 2%: ~500 cards.
  - Creator outreach at 20%: ~50 creators.
  - Journalist pitches at 3%: ~330 pitches. Too many for a small business, so use journalist pitching only with a strong news hook and treat it as a moonshot.
- **Precision rule** (if you need ±m at 95%): n = 3.84 · p(1−p) / m². At p=5% and ±2.5 points: ~290.
- **Kill-fast rule (rule of three):** zero successes in n attempts means the true rate is below 3/n with 95% confidence. To show a channel is below 1%, 300 attempts with zero results is enough. To show it is below 5%, 60 attempts.

**Step 3: Budget.** Test budget = n × cost per unit. Cap each test at 10-20% of the monthly growth budget. Run 2-3 tests in parallel (the Bullseye inner ring). Founder hours count as cost; value them at the owner's stated hourly rate, or $50/hour if unknown.

**Step 4: Economic thresholds.** Before launch, compute from unit economics:
- **Break-even rate** for the leading indicator. r* = cost per unit ÷ (value per positive event), where value per positive event = downstream conversion × gross profit per customer (use 12-month gross profit, not lifetime, for SMBs).
  - Example: cold email costs about $0.10 per contact with tooling and data. A reply is worth 25% (meeting) × 20% (close) × $3,000 gross profit = $150. So r* = 0.07%. Any reply rate above about 0.5% is economic, and the binding constraint is founder time, not money.
  - Example: postcards cost $0.50 each. A call is worth 50% booked × ($400 first-visit gross profit + 35% × $600 plan value) ≈ $305. So r* = 0.16%.
- **Kill threshold** = max(r*, 0.4 × base rate). Below that, the play is broken for this business.
- **Scale threshold** = the lower 80% credible bound above max(r* × 2, 0.8 × base rate), and at least one lagging conversion (sale or booking) observed.

**Step 5: Time-box.** Leading indicators by day 14-21. Lagging check by day 30-45. At most 3 iterations per play, changing one variable at a time (audience, then hook, then offer, then channel), before it is killed.

**Step 6: Decision table** (the engine writes this before launch):

| Observation | Decision |
|---|---|
| 0 successes after 3/kill-threshold units | Kill (or change the audience once) |
| Posterior < kill threshold after n | Iterate one variable; kill after 3 iterations |
| Posterior between kill and scale | Run a second batch of the same size |
| Posterior > scale threshold and ≥1 lagging conversion | Scale 3-5x and add the next Bullseye ring |
| Leading indicator good but lagging zero after 2x n | Funnel problem downstream: fix the offer or follow-up, do not scale |

---

## 3. Scoring rubric for ranking plays

### 3.1 Dimensions (each scored 1-5)

| Dimension | Weight | 1 | 3 | 5 |
|---|---|---|---|---|
| **Fit** | 25% | Audience not verified present; offer generic | Audience present; offer relevant | Named audience verified (URL/list), offer hits a JTBD trigger, uses a business asset |
| **Predictability** | 20% | Assumption only (D) | Grade B base rate, or C plus a similar business | Own historical data, or grade A plus a close analogue |
| **Leverage** (qualified people reached per founder-hour) | 15% | <5 | 25-100 | >1,000 |
| **Time-to-signal** | 10% | >90 days | ≤30 days | ≤7 days |
| **Compounding** | 10% | One-shot | Creates a reusable asset (content, list, partner) | A loop: output feeds input (reviews, referrals, UGC, SEO) |
| **Cost efficiency** (test cost ÷ monthly budget) | 10% | >40% | 5-15% | <2% |
| **Risk safety** | 10% | Legal, platform-ban or brand risk | Manageable risk with a guardrail | No meaningful downside |

**Formula:**

```
Score = 20 × (0.25·Fit + 0.20·Predictability + 0.15·Leverage + 0.10·TimeToSignal
             + 0.10·Compounding + 0.10·Cost + 0.10·Risk)          # 20–100
```

**Gates** (applied before ranking):
- Fit ≤ 2 → reject.
- Risk = 1 → reject. Examples: buying reviews, star-gated incentives, scraping that breaks platform terms, cold SMS without consent.
- Predictability ≤ 2 → allowed only as a capped experiment (≤10% of budget) with a kill rule.
- Missing named audience, hook, number or kill rule → returned to the generator, not scored.

**Distinctiveness (scored separately, 1-5).** This is not in the weighted score, so a creative play does not win just by being creative. It is used for portfolio assembly.
- **1:** every competitor does this. The "swap test" passes: you can paste a competitor's name in and the play is still true.
- **3:** common in other industries, rare in this one (a transplant).
- **5:** depends on an asset or partnership only this business has.

### 3.2 Expected value tie-breaker

For plays within 5 points of each other: **EV₉₀ = P50 gross profit over 90 days − (cash cost + founder hours × hourly rate)**. Prefer the higher EV₉₀, unless the lower one has a much better compounding score.

### 3.3 Worked example: HVAC company (3 vans, $25k/month marketing budget, owner has 5 hrs/week)

| Play | Fit | Pred | Lev | TTS | Comp | Cost | Risk | Score | Distinct. |
|---|---|---|---|---|---|---|---|---|---|
| A. "Run Facebook lead ads" (generic) | 3 | 3 | 4 | 5 | 1 | 2 | 4 | **63** | 1 |
| B. Inspector handoff + new-mover first-summer check | 5 | 3 | 3 | 3 | 4 | 4 | 5 | **78** | 4 |
| C. Maintenance-plan pitch at end of every paid call (tech script + spiff) | 5 | 4 | 3 | 5 | 5 | 5 | 5 | **90** | 2 |
| D. "Post consistently on social media" | 2 | – | – | – | – | – | – | **Gated out** (no audience, hook or number) | 1 |
| E. Local "AC age vs. heat-wave risk" data report pitched to TV weather desks | 4 | 2 | 5 | 3 | 3 | 5 | 5 | **75** (capped experiment) | 5 |

Calculation for B: 20 × (1.25 + 0.6 + 0.45 + 0.3 + 0.4 + 0.4 + 0.5) = 20 × 3.9 = 78.

### 3.4 Portfolio assembly (this is how "creative + predictable" is enforced)

The final plan per business contains:

1. **One bankable play.** Predictability ≥ 4, the highest score. Often an under-used existing lever (C above). It funds confidence.
2. **One or two creative-proven plays.** Distinctiveness ≥ 4 and predictability ≥ 3 (B above). This is what the owner asked for.
3. **At most one moonshot.** Distinctiveness 5, predictability ≤ 2, capped at ≤10% of budget, with a hard kill rule (E above).
4. **Never more than 4 active plays** for a business with fewer than 10 staff. Focus beats coverage.
5. **No two plays in the same channel**, unless one is a direct follow-on.

If no candidate reaches distinctiveness ≥ 4 with predictability ≥ 3, the generator reruns §1.12 step 3 (recombine) and step 4 (transplant) before accepting a generic plan. The critic blocks any plan whose plays all score distinctiveness ≤ 2.

---

## 4. Anti-patterns that make AI strategy generic (and how the critic catches them)

### 4.1 The checks (run on every play card)

| # | Anti-pattern | Example | Critic test | Fix the generator must make |
|---|---|---|---|---|
| 1 | **Channel without audience** | "Post consistently on Instagram" | Is there a named audience with a size and a place (URL, list, ZIP, community)? | Name who, where and how many: "1,200 members of r/AustinFoodies…" |
| 2 | **Activity without hook** | "Start a blog" | Is there a specific angle a stranger would click? | Give the hook and the first 3 titles, with keyword volume |
| 3 | **No number** | "Run Facebook ads to drive leads" | Does it have volume × base rate → outcome, with a source? | Give a funnel with a grade per step |
| 4 | **Swap test passes** | "Leverage social proof to build trust" | Replace the business name with a competitor's. Still true? Then it is generic | Tie it to an asset, location, data point or partner only this business has |
| 5 | **Best-practice soup** | "Optimise SEO, improve UX, engage the community" | More than 3 verbs, no single action | One play, one mechanic, one first action |
| 6 | **Vanity outcome** | "Increase brand awareness / engagement" | Is the outcome in business units (jobs, members, MRR)? | Convert it to a revenue-linked unit |
| 7 | **Invented stats** | "Video gets 1200% more shares" | Is every number linked to a source, or labelled as an assumption? | Cite it or label it "assumption, grade D" |
| 8 | **Ignores constraints** | A $10k/month ad plan for a $2k budget; a daily TikTok plan for a 5-hr/week owner | Does the plan fit the budget and hours? | Rescale or replace it |
| 9 | **Ignores unit economics** | Meta ads at $77 CPL for a $90 cleaning job | Does CAC fit within 12-month gross profit? | Kill it or change the offer to a recurring one |
| 10 | **No test or kill rule** | "Try TikTok and see" | Are size, duration, kill and scale thresholds present? | Add §2.5 thresholds |
| 11 | **Wrong channel for price point** | Outbound sales for a $15 product; viral loops for a $50k contract | Does the leverage per hour match the ARPU? | Swap to a channel matching the price |
| 12 | **Same plan for everyone** | Identical plays for a florist and a SaaS | Compare with recent plans for other businesses: overlap above 50%? | Rerun the generator with assets and triggers forced |
| 13 | **Platform-risk blindness** | Buying reviews, gated review incentives, mass cold SMS, Reddit astroturfing | Is it against platform terms or the law? | Gate out; propose a compliant version |
| 14 | **Timing-free** | "Promote your gifting service" in January | Does it have a trigger or calendar window? | Attach a window and a lead time |
| 15 | **Funnel-only thinking** | Every play needs fresh spend each month | Does any play compound? | Add at least one loop (review, referral or UGC) |
| 16 | **Too many plays** | 12 initiatives for a two-person business | More than 4 active plays? | Cut to the portfolio rule (§3.4) |
| 17 | **Creative but unfalsifiable** | "Go viral with a stunt" | Is the mechanic transplanted from a play with a known base rate, or is it capped as a moonshot? | Attach a base rate or cap it |

### 4.2 Banned phrases (critic flags; allowed only if followed within one sentence by a specific audience, hook and number)

"post consistently", "build a community", "leverage social media", "increase brand awareness", "engage with your audience", "create valuable content", "optimise your SEO", "run targeted ads", "start a blog", "partner with influencers", "go viral", "establish thought leadership", "omnichannel", "drive engagement".

### 4.3 Specificity checklist (a play passes only if all six are present)

1. **Who and where:** a named audience and a named place, with a size.
2. **Hook:** the exact offer or line.
3. **Asset:** what this business has that makes the play work here.
4. **Number:** volume × base rate → outcome range, with sources and grades.
5. **Test:** size, budget, duration, kill and scale rules.
6. **First action today:** something the owner can do in under 30 minutes.

---

## 5. Fifteen worked mini-examples

Each example uses a proven mechanic (base rate attached) on a non-obvious audience, asset or moment. Ranges use the vendor haircut. "Assumption" means no public benchmark exists, so the test's first job is to measure it.

### 1. Bakery: "Friday box" standing orders for offices within 1.5 miles
- **Play:** Walk a free pastry box into 30 offices (dental clinics, law firms, coworking spaces, real-estate brokerages) at 8:30am on a Thursday. Include a card: "Want this every Friday? $45 for 12, delivered by 8:30." Follow up by email on Friday afternoon.
- **Why it fits:** It borrows an audience (office managers buy for 10-50 people). JTBD trigger: Friday morale or the client-meeting spread. Locality is an advantage chains cannot match on freshness. It is a don't-scale play, done by hand.
- **Expected:** In-person sampling converts 10-15% (practitioner) to 15-35% (vendor) to purchase ([Strategy Online](https://strategyonline.ca/?p=17508), [Makai](https://www.makaiinc.com/insights/structured-retail-sampling-pilots-trial-lift), C). 30 boxes give **3-9 first orders**. Assume 25-40% of those become standing orders (grade D), so **1-3 standing accounts**, about $190-580/month recurring, from about $360 of product cost.
- **Test and kill:** 15 boxes in week 1. Kill if 0 orders from 15 (rule of three: true rate below 20%). Otherwise run 15 more with the best-converting office type.
- **Distinctiveness:** 4. Bakeries wait for walk-ins; few prospect offices.

### 2. HVAC: Inspector handoff + new-mover "first-summer system check"
- **Play:** Partner with 5 local home inspectors. Their reports already flag the system's age, so they give buyers a $49 "first-summer check" voucher. In parallel, mail new movers within 7 days of closing. The tech pitches a maintenance plan at the end of every check.
- **Why it fits:** JTBD trigger (a new home, an unknown system). Borrowed audience (inspectors). Transplant from dental new-mover mail. Timing: mail 6 weeks before the first heat wave.
- **Expected:** 500 cards at ~$0.50 all-in = $250. New-mover response is 1.8-4.5% depending on data freshness ([Minuteman Press](https://www.bocaraton.minutemanpress.com/mmpboca_blog/mmpboca_blog.html/article/2026/02/04/new-mover-postcards-how-boca-raton-dentists-capture-patients-before-competitors), C), giving 9-22 calls and 4-12 booked checks. Plan attach at the end of a paid visit is 35-55% vs 1-4% by cold mailer ([Pipelineon](https://pipelineon.com/blog/hvac-membership-conversion-script/), C), so **1-6 plans/month (likely about 2-3)**, each renewing at 70-80%. Inspector referrals are an unbenchmarked upside.
- **Test and kill:** 500 cards plus 5 inspector meetings. Kill the mail if fewer than 4 calls from 500. Keep the inspector channel if at least 1 voucher is redeemed in 30 days.
- **Distinctiveness:** 4.

### 3. B2B SaaS: Job-post-triggered outbound ("cheaper than the hire")
- **Play:** Each week, pull companies that posted a job for the role your product augments (for example "support QA analyst" for a QA tool). Send a 70-90 word email: "Saw you're hiring a QA analyst. Teams like [peer] used [product] to cover 60% of that workload first. Here's a 2-min breakdown for your queue size."
- **Why it fits:** JTBD trigger (budget already approved for the problem). Counter-positioning against hiring.
- **Expected:** Platform average reply is 3.43% and top quartile 5.5% ([Instantly](https://instantly.ai/blog/cold-email-reply-rate-benchmarks), B). Trigger campaigns run 10-20% (C). Plan on 5-10%: 300 contacts give **15-30 replies**. Assume half are positive (D), and meetings at 50% of positives, so 4-8 meetings. Close rate is the owner's own historical rate, or 15-25% (assumption).
- **Test and kill:** 300 contacts over 3 weeks, with at most 2 follow-ups (the third follow-up lowers replies, [Belkins via b2brocket](https://www.b2brocket.ai/blog-posts/cold-b2b-email-stats-effective-series)). Kill or re-target if reply is below 2% with deliverability verified.
- **Distinctiveness:** 3-4.

### 4. Gym: Inter-company 6-week "Strength League" for local employers
- **Play:** Invite HR managers at 10-200 person companies within 3 miles to enter a team (4-10 people) in a 6-week league: weekly sessions, a public leaderboard, a trophy, and a company-paid team fee. At the end, members get a "league alumni" rate.
- **Why it fits:** Borrowed audience (HR owns the wellness budget). Transplant of the course creator's challenge mechanic. Loop: the leaderboard and photos become content, and companies challenge rivals. Timing: January or September.
- **Expected:** 150 HR contacts. On LinkedIn, 28.5% accept and 10.4% reply after accepting ([Expandi](https://expandi.io/blog/linkedin-outreach-benchmarks), B). By email, 3-5%. Together that is about **6-12 conversations**. Assume 2-4 teams join (D), giving 15-40 participants. Challenge-to-paid is 15-30% (vendor, C); haircut to 10-20% for a corporate cohort, so **2-8 new members** plus team fees.
- **Test and kill:** Recruit for 3 weeks. Run the league only if at least 3 teams sign up; otherwise convert the interest into a single company "bootcamp week".
- **Distinctiveness:** 5.

### 5. Agency: 50 personal teardown videos to a hand-picked niche
- **Play:** Choose one niche (for example multi-location dental groups). For each of 50 prospects, record a 3-minute Loom showing 2 specific fixes on their booking page, with numbers. Offer to implement one fix free.
- **Why it fits:** Do things that don't scale. Engineering-as-marketing lite. Each teardown becomes anonymised content (an asset).
- **Expected:** Personalised video reply is 10-16% vs about 4% for text ([FirstSales](https://firstsales.io/blog/video-cold-email-loom), C; haircut to 8-12%). 50 videos give **4-6 replies** and **2-4 calls**. Close at the agency's own rate (assumption 20-30%), so **0-1 clients**, plus 50 reusable teardown insights. The cost is about 25 founder hours.
- **Test and kill:** 25 videos. Kill or re-niche if fewer than 2 replies (true rate likely below 8%).
- **Distinctiveness:** 3. Common among agencies, but rare when tied to a narrow niche with real numbers.

### 6. DTC food brand: Nano-creator seeding inside one use-case community
- **Play:** Do not seed "foodies". Seed 60 nano creators (1-10k followers) in **one** use-case niche where the product solves a job: trail runners for an energy snack, sourdough hobbyists for a flour brand. Give each an affiliate code with 15% commission, and ask for whitelisting rights.
- **Why it fits:** Gathering-place map. Borrowed audience. Loop: UGC feeds ads, and ads bring customers, some of whom become creators.
- **Expected:** Nano reply is 40-60% ([Elev8or](https://www.elev8or.io/blog/influencer-outreach-email-templates), C; plan 35%), so about 21 accept. Post rate for nano is 40-70% (C; plan 45%), giving **about 10 posts (range 6-15)**. Affiliate conversion is 0.5-1% of clicks ([Webtonic](https://www.webtonic.io/blog/affiliate-network-statistics), B/C). Clicks per nano post are unknown (assumption 30-150), so 300-1,500 clicks and **2-15 direct orders**. The real return is **6-15 usable UGC assets** for whitelisted ads.
- **Test and kill:** 60 seeds at about $15 each ($900). The metric is cost per usable UGC asset. Scale if under $100 and at least one ad built from UGC beats the control.
- **Distinctiveness:** 3.

### 7. Habit app: Accountability-partner loop + streak share card
- **Play:** At day 3, ask users to "invite one person to keep you honest". Both streaks become visible to each other, and a shareable card is generated at 7/30/100 days. Measure invites per user and D30 retention for paired vs solo users.
- **Why it fits:** A growth loop rather than a funnel. Duolingo's streak, leaderboard and notification levers contributed to about 4.5x DAU over 4 years ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth), A).
- **Expected:** Referral share rates run 5-15% of users (C; health/wellness 10-18%). For 10,000 new users a month, that is 500-1,500 sharers. Accepted invites are an assumption (20-40%, D), giving **100-600 organic installs/month**. At an iOS CPI of $2-5.50 ([The Social Outline](https://thesocialoutline.com/blog/cpi-benchmarks-health-fitness-apps), C), that is worth **$200-3,300/month** in avoided paid installs before any retention gain. Trial-to-paid median is 39.9% for health and fitness (B).
- **Test and kill:** A 50/50 split of new users for 3 weeks. Ship if the invite rate is at least 5% and paired D30 retention is at least as high as solo.
- **Distinctiveness:** 3.

### 8. Course creator: 30-pitch podcast tour feeding a free 5-day challenge
- **Play:** Pitch 30 shows whose listeners have the exact problem the course solves (searched by episode topic, not show category). Each appearance offers a free 5-day challenge, which ends in the course offer.
- **Why it fits:** Borrowed audience. The challenge creates a JTBD moment (a quick win), and episodes are evergreen.
- **Expected:** Median podcast pitch acceptance is 5%, but 25-35% for a well-targeted list ([FirstSales citing Podchaser](https://firstsales.io/blog/podcast-guest-pitch-email), C; plan 10-20%). 30 pitches give **3-6 bookings**. Signups per episode are unbenchmarked (assumption 20-150). Challenge-to-paid is 15-30% (vendor, C; plan 8-15% from a podcast audience), so **5-60 sales** across the tour.
- **Test and kill:** 30 pitches over 2 weeks. Re-target if fewer than 2 bookings, which means the list is too broad.
- **Distinctiveness:** 3.

### 9. Dentist: Youth-sports mouthguard fitting night + new-mover welcome
- **Play:** Partner with 2 youth leagues (soccer, hockey, lacrosse) for a "custom mouthguard night" at the start of the season: fitting at cost, a family new-patient offer and a league sponsorship banner. Run it alongside a fresh-data new-mover mailer.
- **Why it fits:** Borrowed audience (league parents). Timing: season start. Mailer timing: families choose a dentist within 4-8 weeks of moving (C).
- **Expected:**
  - *Mailer:* 1,000 cards give 18-45 responses (1.8-4.5%, C).
  - *League night:* attendance is unbenchmarked (assumption 10-25% of 200 families, so 20-50), with an assumed 20-40% booking a family exam (D). That is **4-20 new patient families**.
  - *Reviews:* add SMS review requests to every new patient (about 20 reviews per 100, [GatherUp](https://gatherup.com/blog/sms-vs-email-review-requests/), B). This is a loop for local search, where 83% of consumers read Google reviews ([BrightLocal](https://www.brightlocal.com/research/local-consumer-review-survey-2025/), A).
- **Test and kill:** 1 league night plus 1,000 cards. Keep the leagues if cost per new family is at or below the practice's current CAC.
- **Distinctiveness:** 4.

### 10. Accountant: Centres-of-influence referral kit + "IRS notice decoder"
- **Play:** (a) Recruit 10 referral partners (bookkeepers, business bankers, small-business attorneys, payroll providers). Give each a one-page "when to send me a client" kit and a 48-hour response promise. (b) Offer a free service: "Upload your IRS or state notice, get a plain-English explanation in 24 hours." Done manually at first, it is engineering as marketing in a don't-scale form.
- **Why it fits:** Borrowed trust. JTBD trigger: a scary letter is a peak struggling moment. Timing: Jan-Apr and the quarterly estimated-tax deadlines.
- **Expected:** Centres of influence produce 13.9% of new clients for financial advisors ([Cerulli](https://www.cerulli.com/press-releases/financial-advisors-increasingly-leverage-cois-to-capture-new-client-growth), B, a proxy). Cold outreach to 40 professionals at 3-6% reply (C) plus warm chamber intros gives **5-10 partner meetings** and 3-6 active partners (D). Notice-decoder volume depends on distribution (assumption 10-40 uploads/month via partners and local Facebook groups), with **20-40%** converting to paid resolution or ongoing clients (D).
- **Test and kill:** 8 weeks. Keep a partner if they send at least 1 referral per quarter. Keep the decoder if at least 10 uploads/month by month 2.
- **Distinctiveness:** 4.

### 11. Dev tool: Open-source the most useful slice + Show HN + "awesome list" PRs
- **Play:** Extract one standalone utility (a CLI, linter or SDK helper) that solves a common pain without the paid product. Publish it with excellent docs, launch it on Show HN with a technical write-up, and submit it to relevant awesome-lists. The README links to the hosted product for the harder version of the job.
- **Why it fits:** Engineering as marketing. The output (stars, issues, PRs) feeds input (visibility), which is a loop. HN works mainly for technical buyers ([Stackmatix](https://www.stackmatix.com/blog/launching-on-hacker-news)).
- **Expected:** A front-page Show HN draws roughly 2.2k-11k visitors and 20-300+ signups (founder reports, D). Many Show HNs never reach the front page, so plan for a 30-50% chance of a front-page hit (assumption). Star-to-paid is 0.5-2% (D). This play has **low predictability**: run it as the capped moonshot unless the owner has prior launch data.
- **Test and kill:** One Show HN. If buried, allow one relaunch with a different angle after 4+ weeks. Measure signups per 1k visitors.
- **Distinctiveness:** 3.

### 12. Florist: Standing reception arrangements for clinics, hotels and offices + funeral-home partner
- **Play:** Offer a weekly "front desk" arrangement subscription: first week free, cancel anytime, vase swap included. Target dental and medical clinics, boutique hotels and law firms. Separately, offer a local funeral home a same-day sympathy service with a referral fee.
- **Why it fits:** Counter-seasonal recurring revenue that smooths the Valentine's/Mother's Day peaks. Borrowed audiences.
- **Expected:** Walk-in plus email to 60 businesses. Cold email reply is 3-5% (B/C); walk-ins with a free first week are much higher (assumption 10-20%, D). That gives **3-8 trials and 2-5 standing accounts in 60 days**. Ten accounts at £50/week is about £500/week of predictable income ([Floristry Trade Club](https://www.floristrytradeclub.co.uk/post/subscription-flowers-recurring-revenue-for-florists), C). One florist reports wholesale waste falling from 18% to 6% once orders were predictable ([Shopappy](https://shopappy.com/local-retail/small-business-stories/florist-built-recurring-revenue), C).
- **Test and kill:** 30 walk-ins in 2 weeks. Kill the vertical if fewer than 2 trials; try another vertical (hotels instead of clinics).
- **Distinctiveness:** 3-4.

### 13. Coffee roaster: October tasting boxes → Q4 corporate gifting → January office subscription
- **Play:** In early October, send a 3-bag tasting box with a gifting menu (custom labels, the client's logo, a donation per bag) to 40 HR, office and EA contacts. Convert the gifting buyers into office-coffee subscriptions in January.
- **Why it fits:** Timing hook (Q4 gifting is planned in October). Food and beverage is a relatively high-reply cold vertical. Sampling mechanic. Compounding into recurring revenue.
- **Expected:** Food & beverage cold email draws 3.47% unique replies per email sent ([Belkins via Something Inc](https://somethinginc.com/blog/cold-email-response-rates-2026-data/), B). Tasting boxes are a sample, at 10-35% trial-to-purchase (C; plan 10-15%). 40 boxes give **4-6 gifting orders** at an assumed $400-1,500 each (D), so **$1.6k-9k of Q4 revenue**. Assume 20-30% of gifting clients add an office subscription (D).
- **Test and kill:** 20 boxes by October 10. Kill if fewer than 2 orders by November 5.
- **Distinctiveness:** 3-4.

### 14. Real-estate agent: Micro-market report mailer + expired-listing "why it didn't sell" video audit
- **Play:** (a) Each month, mail a 500-home "farm" a one-page report for their street cluster: last 90 days of sales, days on market, and a QR code for "what's my home worth". (b) For each expired listing in the farm, record a 2-minute video comparing its photos, price and days on market with the comps that sold, and offer a relisting plan.
- **Why it fits:** Proprietary data asset (unconventional PR at street scale). JTBD trigger: an expired listing is a peak struggle. Don't-scale video.
- **Expected:**
  - *Mailer:* prospect-list mail draws 2.7-3.2% response ([4over4](https://www.4over4.com/statistics/direct-mail-response-rate-benchmarks), B/C). A neighbourhood farm becomes a "house-like" list over time (5-9%). EDDM costs about $0.25-0.26 per piece plus print. That gives **8-15 valuation requests/month**.
  - *Expireds:* about 4% of contacted expireds become appointments (top prospectors 5-10%), and 30-50% of appointments become listings ([PropStream](https://www.propstream.com/real-estate-agent-blog/5-benefits-of-pursuing-expired-listings-as-an-agent), [EstatePass](https://www.estatepass.ai/tools/expired-listing-scripts/guide/), C). The video should push toward the top band: 25 expireds give **1-2 appointments** and **0.4-1 listings/month**.
- **Test and kill:** 3 monthly drops, because farming compounds. Kill if fewer than 5 total valuation requests after 1,500 pieces.
- **Distinctiveness:** 3.

### 15. Cleaning company: Short-term-rental turnover partnership with a photo-proof guarantee
- **Play:** Approach STR property managers and co-hosts (each controls 10-100 units) with per-turnover pricing, a guaranteed 3-hour window and a 20-photo checkout report sent to the manager before the next check-in. If a guest complaint traces to cleaning, the next clean is free.
- **Why it fits:** Counter-positioning: residential cleaners avoid same-day turnover chaos, and hourly pricing hides quality. Borrowed audience (one manager means many units). Recurring revenue.
- **Expected:** 80 managers via email and LinkedIn. Cold reply is 3-5% (B/C); LinkedIn is 28.5% accept × 10.4% reply (B). That is about **5-10 conversations**. Assume 20-35% win a trial (D), so **1-3 accounts × 10-40 units**, which could fill a team's calendar. Add SMS review requests after residential cleans (about 20 per 100, B) to build the local-search loop.
- **Test and kill:** 80 contacts over 3 weeks. Kill or switch to a different segment (office or post-construction) if fewer than 3 conversations.
- **Distinctiveness:** 4.

---

## 6. Implementation notes for the ClimbOS engine

1. **Store base rates as data, not prose.** Create a `base_rates` table with columns metric, segment, low, likely, high, unit, grade, source_url and as_of. The strategist cites by ID, and the critic checks that every forecast step references an ID or is labelled "assumption".
2. **Generator → scorer → critic → portfolio**, in that order. The critic runs §4.1 and §4.3. A play that fails goes back to the generator with the failed check named, and is rewritten at most twice before it is dropped.
3. **Run tests as first-class objects.** Each recommended play ships with its test spec (§2.5). The ops layer tracks units, successes and the posterior, and fires the kill or scale decision automatically, with owner approval.
4. **Learn across customers.** Posteriors from many ClimbOS businesses become ClimbOS's own grade-A base rates by vertical, which is a proprietary data moat. Store them anonymised and aggregated.
5. **Refresh.** Re-check vendor base rates every 6 months. Cold-email and LinkedIn reply rates have been falling year over year (for example, LinkedIn note reply fell from 3.5% to 2.2% between May 2025 and April 2026, per [Salesflow](https://salesflow.io/blog/linkedin-outreach-templates)).

---

## Sources

Frameworks
- Weinberg & Mares, *Traction*: [Penguin Random House](https://www.penguinrandomhouse.com/books/319121/traction-by-gabriel-weinberg-and-justin-mares/9781591848363/), [Graham Mann notes](https://grahammann.net/book-notes/traction-gabriel-weinberg)
- Reforge, [Growth Loops are the New Funnels](https://www.reforge.com/blog/growth-loops)
- Paul Graham, [Do Things That Don't Scale](https://www.paulgraham.com/ds.html)
- Moesta / JTBD: [HBS Working Knowledge](https://www.library.hbs.edu/working-knowledge/understanding-the-mental-journey-of-job-change), [Antoine Buteau](https://www.antoinebuteau.com/lessons-from-bob-moesta/)
- Helmer counter-positioning: [Eagle Point Capital](https://eaglepointcapital.substack.com/p/7-powers-a-summary-of-competitive)
- Play Bigger: [Antoine Buteau summary](https://www.antoinebuteau.com/play-bigger-book-summary/)
- HubSpot Website Grader: [HubSpot blog](https://www.hubspot.com/blog/bid/4056/250-000-companies-test-their-internet-marketing-acumen-with-website-grader)
- Duolingo: [Lenny's Newsletter](https://www.lennysnewsletter.com/p/how-duolingo-reignited-user-growth)

Base rates: see the inline links in §2.1. The main datasets are [Instantly](https://instantly.ai/blog/cold-email-reply-rate-benchmarks), [Expandi](https://expandi.io/blog/linkedin-outreach-benchmarks), [Everything PR / Propel](https://everything-pr.com/epr-research-and-5w-release-the-pr-pitch-response-rate-study-2026), [GatherUp](https://gatherup.com/blog/sms-vs-email-review-requests/), [MailerLite](https://www.mailerlite.com/blog/email-marketing-benchmarks), [Klaviyo](https://help.klaviyo.com/hc/en-us/articles/360051110111-Campaign-SMS-and-MMS-benchmarks-), [BrightLocal](https://www.brightlocal.com/research/local-consumer-review-survey-2025/), [LocaliQ](https://localiq.com/blog/facebook-advertising-benchmarks/), [Cerulli](https://www.cerulli.com/press-releases/financial-advisors-increasingly-leverage-cois-to-capture-new-client-growth) and [beehiiv](https://www.beehiiv.com/blog/newsletter-sponsorship-cost).
