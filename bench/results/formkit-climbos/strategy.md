# ClimbOS · Formkit · Growth plan

Cost $2.79 · 1062s · Opus score 7/10

---

**Summary:** Sell Pro at the moment free users need it, not through ads. Primary: an upgrade screen when a free user clicks a Pro-only feature. Secondary: cold email to small agencies. Hygiene: a one-off, capped Claude directory listing. Ad spend stays at $0 unless the wall proves too small at the start of week 3. Monthly Pro at $6 cannot fund paid traffic, so any paid traffic leads with yearly Pro or Business.

**Positioning:** Formkit is the form builder for when the form is part of how people see you. Describe a form and AI builds it, even inside Claude or ChatGPT. Pro puts it on your own domain with no badge and sends payments to your own Stripe account, with no cut taken. Every channel leads with 'no cut on payments' and 'looks like yours', not 'free', because Tally and Google Forms are free too.

**Audiences**

## Free users hitting a Pro wall

**Name:** Free users hitting a Pro wall

**Hypothesis:** Users who click payments, own domain or badge removal already want Pro. A clear price plus the no-cut message at that click converts best.

**Evidence:** Free tier is unlimited, and payments with no cut are a Pro value (confirmed facts). Pro is $6/seat/month. Wall-click volume is unknown until analytics is pulled on day 1.

## Small web and marketing agencies

**Name:** Small web and marketing agencies

**Hypothesis:** Agencies building client sites will try chat-built forms in per-client workspaces if we send a working sample in their client's brand.

**Evidence:** Per-client workspaces and Business approvals, templates and audit log come from site insights. Tally's own comparison page points users who want branding and payments to other tools (tally.so/help/tally-a-free-and-powerful-google-forms-alternative).

## People who work inside Claude or ChatGPT

**Name:** People who work inside Claude or ChatGPT

**Hypothesis:** Directory browsers who need a form mid-chat will install Formkit and upgrade when they need payments.

**Evidence:** Formkit builds and publishes forms inside Claude and ChatGPT (confirmed). Tally, Jotform and Typeform also support MCP (tally.so/help/best-mcp-form-builders), so the listing leads with payments, not 'free'.

## People outgrowing Google Forms

**Name:** People outgrowing Google Forms

**Hypothesis:** Searchers for 'google forms alternative' want their own link, drop-off by question and brand control, which Formkit's compare table covers.

**Evidence:** Many vendor roundups compete for the term (paperform.co, clickup.com, zonkafeedback.com). Click costs were not checked, so this audience is reached only if the conditional search test unlocks.

**Channels**

## Play 1: Payment-wall upgrade (primary)

**Key:** conversion_optimization

**Name:** Play 1: Payment-wall upgrade (primary)

**Why:** Free users who click a Pro feature cost $0 to reach and already show intent. Best revenue per owner-hour of any option, and the only route that clears payback on monthly Pro.

**Priority:** 1

**Deliverables**

- In-product upgrade screen on payment field, own domain and badge removal clicks, with yearly price (two months free) shown next to monthly

- One follow-up email, sent once, one hour after a non-upgrade

- Events: pro_feature_click (by feature), upgrade_screen_view, checkout_start, pro_paid (monthly or yearly)

- Weekly wall-click to paid report

**Dependencies**

- About 6 developer hours, one-off

- Analytics access to read Pro-feature clicks

- Email to free users allowed under existing signup terms

**Measurement:** Wall-click to paid rate. Minimum volume: enough wall-clicks for 10 upgrades at 6%. Kill under 3%, scale at 6% or more.

**Suggested Monthly Ad Spend:** 0

## Play 2: Agency client forms by cold email (secondary)

**Key:** sales_outreach

**Name:** Play 2: Agency client forms by cold email (secondary)

**Why:** An agency on 2 Business seats brings 2 × $19 a month, more than six Pro seats, and each client workspace can upgrade on its own. That value can carry personal outreach.

**Priority:** 2

**Deliverables**

- Trigger-based emails in 3 batches, one per trigger list, sized for 10 positive replies at an assumed 4% reply rate

- One follow-up after 4 days

- A working branded enquiry form for each agency that replies, sent within a day

- Reply-to-paid tracker by list

**Dependencies**

- Agency names from Tally's Product Hunt reviews, AlternativeTo and Clutch

- Public business emails from each agency's own site only, no scraping

- Postal address and opt-out line in every email, as US commercial email law requires

**Measurement:** Positive reply rate by list. Kill under about 3% (break-even). Scale at 6% or more with at least 1 paid agency.

**Suggested Monthly Ad Spend:** 0

## Hygiene: Claude Connectors Directory listing (one-off, 10-hour cap)

**Key:** partnerships

**Name:** Hygiene: Claude Connectors Directory listing (one-off, 10-hour cap)

**Why:** A one-time listing in a new directory can keep bringing installs after day 90. It is a capped task, not an ongoing channel.

**Priority:** 3

**Deliverables**

- Submission at claude.ai/directory/manage with screenshots

- Listing copy leading with build-and-publish from chat plus no-cut Stripe payments on Pro

- Tool names matching how users ask: 'create a form', 'event sign-up with limited places', 'take payments'

- ChatGPT app submission only if the scale rule is met

**Dependencies**

- Formkit's Claude integration meets remote MCP server requirements (claude.com/docs/connectors/building/submission)

- Verified OpenAI organisation for the ChatGPT step

- Hard cap of 10 hours in total

**Measurement:** Install-to-Pro after one month live. Kill at 0 Pro after 50 installs, under 3%, or past 10 hours. Submit to ChatGPT only at 6% or more.

**Suggested Monthly Ad Spend:** 0

**Experiments**

## Payment-wall upgrade screen

**Name:** Payment-wall upgrade screen

**Hypothesis:** Showing price, the yearly two-months-free option and 'no cut on payments' at the Pro-feature click turns at least 6% of wall-clicks into paid Pro.

**Population:** Free users who click payments, own domain or badge removal

**Method:** pre_post_observational

**Primary Metric:** Wall-click to paid Pro rate (pro_paid within 7 days of pro_feature_click ÷ wall-clicks), split monthly vs. yearly

**Guardrails**

- Free-user weekly active forms not down more than 10% vs. the two weeks before

- Spam complaints on the follow-up email within Gmail bulk-sender limits

- Refunds or cancellations in the first two weeks after upgrade not above pre-test level

**Duration Days:** 21

**Stopping Rule:** Decide at 21 days, or later if fewer wall-clicks than 10 ÷ 6% have arrived. Under 3% paid: kill and test a yearly-led screen. 3–6%: iterate once on copy. 6% or more: extend the trigger to quizzes, limited places and AI replies. Business thresholds, not significance; directional.

## Agency cold email by trigger list

**Name:** Agency cold email by trigger list

**Hypothesis:** A free branded sample form on reply lifts positive replies above the roughly 3% break-even.

**Population:** Small web and marketing agencies across 3 trigger lists, public business emails only, sized for 10 positive replies at 4%

**Method:** pre_post_observational

**Primary Metric:** Positive reply rate per list

**Guardrails**

- Bounce rate under 2%; pause sends above it

- Negative or spam replies under 1%

- Every email has a postal address and a working opt-out

**Duration Days:** 42

**Stopping Rule:** Read replies at end of week 2, paid conversions at end of week 6. Under about 3% positive: kill, switch list first, then hook. 6% or more with 1 paid agency: repeat the send to the best list. Directional only: each list is far below the size needed to detect a doubling of reply rate.

## Claude directory listing

**Name:** Claude directory listing

**Hypothesis:** Directory installs convert to Pro at 6% or more when the listing leads with payments.

**Population:** Users who install the Formkit connector from the Claude directory

**Method:** pre_post_observational

**Primary Metric:** Install to Pro within one month of install

**Guardrails**

- Total build and listing work 10 hours or less

- Free AI usage per install stays within current free-plan limits

**Duration Days:** 60

**Stopping Rule:** Measure one month after the listing goes live. Kill at 0 Pro after 50 installs, under 3%, or past 10 hours. Scale to ChatGPT at 6% or more with at least 1 Pro.

## Conditional: Google Forms switcher search test

**Name:** Conditional: Google Forms switcher search test

**Hypothesis:** If the wall is too small, high-intent switcher searches can buy free signups at or under $6 each (one month of Pro; assumption).

**Population:** Searchers for 'google forms alternative' and 'tally alternative'; runs only if wall-clicks are under 60 a month

**Method:** pre_post_observational

**Primary Metric:** Ad spend ÷ new free signups with google/cpc source

**Guardrails**

- Spend capped at one fifth of $600 a month

- No spend on FormKit Vue library terms (negatives vue, react, npm, github; weekly search-term review)

- Switcher page and ads lead with yearly Pro, not monthly

**Duration Days:** 30

**Stopping Rule:** Sizing: one fifth of $600 at an assumed $2–6 per click buys only tens of clicks, too few to show 3 Pro, so judge on signups. Check real click cost after the first week of spend; stop if it makes $6 per signup impossible. After one month: over $6 per signup, kill; at or under, keep and track signup-to-Pro.

**Constraints**

- Ad budget: $600/month (owner). Plan spends $0 unless search unlocks at the start of week 3; then one fifth.

- Owner time: about 3 hours/week (assumption, grade D).

- Hours used: owner 1 agency lists + 1 replies and approvals + 1 scorecard = 3 of 3. Developer one-off: 6 (wall) + up to 10 (listing). ClimbOS writes copy, emails and samples.

- Price: Pro $6/seat/month, Business $19/seat/month; yearly gives two months free (confirmed).

- Assumption: gross margin is high (AI and hosting are the main costs). Validate from bills in week 1. If low, even yearly Pro cannot fund paid traffic.

- Assumption: monthly Pro churn about 5% (grade D). Validate from billing in week 1. If higher, push yearly harder on the wall screen.

- Assumption: wall-click volume matches the forecast. Validate on day 1. Under 60 a month unlocks the search test and shifts owner effort to agencies.

- Assumption: 6% of wall-clicks pay. Validate at minimum volume, week 3. Under 3% switches to a yearly-led screen.

- Assumption: 4% agency positive reply rate. Validate at end of week 2. Under 3% switches the trigger list.

- Assumption: about 60 installs in the first 60 live days, 6% to Pro. Validate one month after going live. Under 3% stops the ChatGPT step.

- Assets: unlimited free tier, no-cut Stripe payments, works in Claude and ChatGPT (confirmed). No visible reviews or case studies (site insights).

- Name collision with the FormKit Vue library at formkit.com (research).

**Measurement Plan:** One weekly scorecard sheet, read every Monday, that does not depend on ad-platform attribution. Product events (pro_feature_click by feature, upgrade_screen_view, checkout_start, pro_paid with plan and source) feed it. UTMs on every link: email, listing, switcher page and any ad. A required 'How did you hear about Formkit?' question at signup, with AI referrals (claude.ai, chatgpt.com, perplexity.ai) logged as their own source. If search runs, Google Ads receives signups via Enhanced Conversions. Agency outreach is tracked in a sheet from send through reply, workspace and paid. Each assumption row in the constraints is checked on its validation date.

**First Actions**

## Pull last month's Pro-feature clicks, signups and upgrades

**Title:** Pull last month's Pro-feature clicks, signups and upgrades

**Why:** Wall-click volume decides whether Play 1 reaches minimum volume in 21 days and whether search unlocks.

**Role:** Owner

## Ship the upgrade screen and one-hour follow-up email

**Title:** Ship the upgrade screen and one-hour follow-up email

**Why:** Highest-scoring play, $0 cash, and it uses users you already have.

**Role:** Developer

## Check Claude directory submission requirements

**Title:** Check Claude directory submission requirements

**Why:** Tells us in an hour whether the listing fits its 10-hour cap.

**Role:** Developer

## Screen Tally's Product Hunt reviews for agencies

**Title:** Screen Tally's Product Hunt reviews for agencies

**Why:** Builds the first of three outreach lists for Play 2.

**Role:** Owner

## Set up the weekly scorecard, UTMs and signup source question

**Title:** Set up the weekly scorecard, UTMs and signup source question

**Why:** Every kill or scale call depends on numbers the owner can trust.

**Role:** ClimbOS growth lead

**Diagnosis:** The constraint is monetisation, not traffic: an unlimited free tier puts paid value behind feature walls, and there is no proven pitch at the moment a free user needs Pro. Falsifier: if fewer than about 60 free users a month click a Pro-only feature, the constraint is top-of-funnel signups, and agency outreach plus the conditional search test become primary.

**Affordable Cac:** Pro monthly: $6/seat/month revenue, minus unconfirmed margin and assumed 5% monthly churn. A 3-month payback caps CAC below 3 × $6, and lower after margin. Pro yearly: $6 × 10 months paid upfront, so cash CAC is recovered at once with no year-one churn. Business: $19/seat/month; an agency on 2 seats brings 2 × $19 a month. Offer lever: only $0-cash channels sell monthly Pro; any paid traffic must lead with yearly Pro or Business.

**Not Doing**

## Google Search ads (for now)

**Channel:** Google Search ads (for now)

**Why:** Runs only if wall-clicks are under 60 a month, decided at the start of week 3. One fifth of $600 buys tens of clicks at an assumed $2–6 CPC, too few to show Pro payback.

## Meta ads

**Channel:** Meta ads

**Why:** No click-cost data, and monthly Pro at $6 cannot repay creative testing.

## LinkedIn ads

**Channel:** LinkedIn ads

**Why:** Practitioner guidance puts a useful test above the whole $600 budget (assumption, validate by quote).

## Product Hunt launch

**Channel:** Product Hunt launch

**Why:** Tens of owner hours for mostly free signups (assumption).

## Paid newsletters

**Channel:** Paid newsletters

**Why:** No click-cost data found in research.

## Blog SEO

**Channel:** Blog SEO

**Why:** Third-party studies (Pew, Seer Interactive; disputed by Google) report fewer clicks under AI answers (assumption), and payback is too slow for 90 days.

## Reddit posting

**Channel:** Reddit posting

**Why:** Self-promotion is often banned. Read r/nocode and r/smallbusiness threads, and reply only where Formkit truly fits.

## Organic social

**Channel:** Organic social

**Why:** No evidence buyers pick form builders there, and no hours left.

**North Star**

**Metric:** New paid accounts (Pro + Business) per 90 days

**Baseline:** Unknown. Measured from billing in week 1.

**Target:** Baseline + 6% of 90-day wall-clicks + 1 paying agency + 3 from the directory (all assumptions, grade D). The wall share depends entirely on the unvalidated wall-click volume read on day 1.

**Leading Indicators**

## Item 1

**Metric:** Wall-click to paid Pro rate

**Weekly Target:** 6% or more of the week's wall-clicks

**Source:** Product events: pro_feature_click, pro_paid

## Item 2

**Metric:** Wall-clicks per week

**Weekly Target:** At or above week-1 baseline; under 60 a month triggers the search test

**Source:** Product events: pro_feature_click by feature

## Item 3

**Metric:** Agency positive replies

**Weekly Target:** 4% of each batch (assumption)

**Source:** Outreach tracker sheet

## Item 4

**Metric:** Claude connector installs

**Weekly Target:** About 7 a week once live (assumption)

**Source:** Integration logs plus UTM on listing link

**Phases**

## Foundation

**Name:** Foundation

**Days:** Weeks 1–2

**Focus:** Pull baselines, ship the upgrade screen and events, add the signup source question, submit the Claude listing, send the first agency batch. End of week 2: unlock search only if wall-clicks are under 60 a month.

## Test

**Name:** Test

**Days:** Weeks 3–6

**Focus:** Run each test to its pre-set rule; review weekly. End of week 6: confirm Play 1 as primary or swap in whichever play has the lowest cost per paid account.

## Commit and compound

**Name:** Commit and compound

**Days:** Week 7 to day 90

**Focus:** Most effort on the winner: extend the upgrade trigger to quizzes, limited places and AI replies. The rest on the secondary. Build one lasting asset: agency sample forms reused as templates.

**Week One Checklist**

- Pull last month's Pro-feature clicks by feature, plus signups, upgrades and churn from billing

- Ship the upgrade screen (yearly shown next to monthly), the one-hour follow-up email and the four tracking events

- Check claude.com/docs/connectors/building/submission and start the submission if the integration qualifies

- List agencies and studios from Tally's Product Hunt reviews and send the names to ClimbOS

- Set up the weekly scorecard, UTMs on every link and the 'How did you hear about Formkit?' question

**Risks**

## Item 1

**Risk:** Too few free users hit a Pro wall to reach minimum volume.

**Mitigation:** Check on day 1. Under 60 a month: unlock the capped search test at the start of week 3 and lean on agencies. Validate by day 3.

## Item 2

**Risk:** Tally, Jotform and Typeform already work in Claude, so 'free in chat' is not unique.

**Mitigation:** Listing leads with no-cut Stripe payments and branded forms. Judge by install-to-Pro one month after going live.

## Item 3

**Risk:** If search runs, clicks leak to FormKit Vue library searches.

**Mitigation:** Negatives from day 1, weekly search-term review, and a click-cost check after the first week of spend.

## Item 4

**Risk:** Buyers distrust a newer brand with payments or HR data.

**Mitigation:** Ask early Pro users for honest reviews with no incentive and no gating; link the DPA on key pages. Review at end of week 6.

## Item 5

**Risk:** Cold email breaches law or harms sender reputation.

**Mitigation:** Public business emails only, postal address and opt-out in every email, pause if bounces exceed 2%. Check after batch 1.

**Plays**

## Payment-wall upgrade

**Name:** Payment-wall upgrade

**One Liner:** Pitch Pro at the moment a free user adds a payment field, custom domain or badge removal, then send one follow-up email.

**Kind:** bankable

**Audience:** Formkit free users who click a Pro-only feature (payments, own domain, badge removal) in the builder. The size comes from your own analytics.

**Trigger:** The click on a Pro-only feature, usually a payment field on a booking, quote or event sign-up form.

**Hook:** In-product screen: 'Take payments on this form. Pro is $6 a seat a month. Payments go straight to your own Stripe account, and Formkit takes no cut. Pay yearly and get two months free.' Buttons: Upgrade to Pro / Not now.

Follow-up email, sent once, one hour later, only if the user has not upgraded.
Subject: Your form is one step from taking payments
Body: 'You added a payment field to your form. Payments are a Pro feature: $6 a seat a month, or pay yearly and get two months free. Money goes straight to your own Stripe account, and Formkit takes no cut. Pro also puts your form on your own domain and removes the Formkit badge, so the form looks like yours. Upgrade from your dashboard at formkit.app. Not ready yet? Your forms, responses and members stay unlimited on the free plan.'

**Mechanic:** Offer at the moment of need. It is the same logic as a service plan pitched at the end of a paid visit, which sells far better than one mailed later (assumption, grade D).

**Asset Used:** No cut on Stripe payments, $6 Pro, yearly billing with two months free, and a free user base that is already building forms.

**Funnel**

- Free users who click a Pro-only feature in 90 days: read from analytics on day 1. The forecast assumes about 400 (assumption, grade D).

- See the upgrade screen: nearly all of them, since it shows on every click (own product design; assumption, grade D until tracked).

- Start checkout: low 6%, likely 12%, high 20% (assumption, grade D; no in-product benchmark in this research).

- Complete payment: low 40%, likely 50%, high 65% (assumption, grade D).

- Follow-up email to non-upgraders: counted as upside, not in P50 (assumption, grade D).

- Outcome: about 6% of wall-clicks become Pro, about 24 accounts at P50 (assumption, grade D).

**Unit:** new Pro accounts

**P10:** 8

**P50:** 24

**P90:** 55

**Horizon Days:** 90

**Confidence:** medium

**Biggest Unknown:** How many free users hit a Pro-only feature each month. Your analytics answers this on day 1.

**Test:** Size: 170 wall-clicks (10 ÷ 6% likely wall-to-paid). Budget: $0 cash plus about 6 build hours ($300 at $50/hour; assumption). Break-even: $300 ÷ $58 ≈ 5 Pro accounts, about 3% of 170. Duration: 21 days or 170 wall-clicks. Leading metric: wall-click to paid rate.

**Kill If:** Fewer than 5 paid upgrades (under 3%) after 170 wall-clicks. Then change one thing at a time: lead with the yearly offer, then the copy.

**Scale If:** 10 or more paid upgrades from 170 wall-clicks (6%). Then add the same trigger to quizzes, limited places, AI replies and the free AI cap.

**Scores**

- 5

- 4

- 5

- 4

- 3

- 5

- 5

- 3

**First Action Today:** Pull the last 30 days of free users who clicked a Pro-only feature, split by payments, domain, badge and AI cap.

**Climbos Can Do:** Finalise the screen and email copy, list the tracking events, report the upgrade rate weekly and make the kill or scale call when the test ends.

## Describe it, ship it: agency client forms

**Name:** Describe it, ship it: agency client forms

**One Liner:** Pitch small agencies on building each client's forms by describing them in Claude or ChatGPT, free, inside a separate workspace per client.

**Kind:** creative

**Audience:** Small web and marketing agencies at a visible switch moment. Trigger lists, sized where research found it:
1. Agencies and studios among Tally's Product Hunt reviewers. Roughly 100–160 reviews to screen (producthunt.com/products/tally/reviews). G2 reviewers flag Tally's limited design customization (formbricks.com/blog/tally-alternatives).
2. Agencies weighing agency-focused form tools. Form 'n Go's AlternativeTo page targets agencies and freelancers (alternativeto.net/software/form-n-go). Not sized.
3. Web agencies on Clutch with a recent client site launch (clutch.co). Not sized; assumption.

**Trigger:** A public sign the agency is choosing form tools: a rival review mentioning design limits, a comparison of agency form tools, or a new client site that needs forms.

**Hook:** Subject: Build each client's forms by describing them

'Hi, a quick one for agencies that build sites for clients.

Most client sites need an enquiry, quote or booking form, and someone on your team has to build and manage it. With Formkit, you describe the form in Claude or ChatGPT, and it is built and published from the chat. That works on every plan, including free. Each client gets its own workspace, upgraded on its own, so forms and responses never mix between clients.

When a client needs more: on Pro, forms sit on the client's own domain with no Formkit badge, and payments go to the client's own Stripe account, with no cut taken by Formkit. On Business, forms need approval before they go live, your team shares templates, and every change is kept in an audit log.

Reply with one client's website and we'll send back a working enquiry form in their brand within a day. The free plan has unlimited forms, responses and members, so you can try it on a real client first.

The Formkit team, formkit.app
Not relevant? Reply no and we won't email again.'

**Mechanic:** Trigger-based cold email with a done-for-you sample on reply, plus one follow-up after 4 days (follow-ups add replies; assumption, grade D). The note speaks to the pain and never cites the review.

**Asset Used:** Chat-built and chat-published forms on the free plan, per-client workspaces upgraded separately, and Business approvals, shared templates and audit log.

**Funnel**

- Agencies emailed: 250 across the three trigger lists (10 ÷ likely 4% reply; assumption, grade D).

- Positive reply: low 2%, likely 4%, high 7% (assumption, grade D; cold-email benchmarks not checked in this research).

- Sample sent, then the agency creates a workspace: low 35%, likely 50%, high 65% (assumption, grade D).

- Workspace to paid Pro or Business within 45 days: low 15%, likely 25%, high 40% (assumption, grade D).

- Value per agency: 2 Business seats at $19 is $38 a month, about $365 gross profit in year one (assumption, grade D).

**Unit:** paying agency accounts

**P10:** 0

**P50:** 1

**P90:** 4

**Horizon Days:** 90

**Confidence:** low

**Biggest Unknown:** Whether the free chat-built sample lifts agency replies above typical cold-email rates.

**Test:** Size: 250 sends in 3 batches, one per trigger list. Budget: $0 cash plus about 7 owner hours ($350 at $50/hour; assumption). Break-even: $1.40 per contact ÷ $45.60 value per positive reply (50% × 25% × $365) = 3.1%. Duration: replies by day 14, paid check by day 45. Leading metric: positive reply rate by trigger list.

**Kill If:** Positive reply rate below 3.1% (fewer than 8 of 250). Change one thing next: first the trigger list, then the hook.

**Scale If:** Positive reply rate above 6.1% (16 or more of 250) with at least 1 paid agency. Then send 250 more to the best list and offer a shared template pack.

**Scores**

- 4

- 3

- 2

- 4

- 3

- 5

- 4

- 4

**First Action Today:** On Tally's Product Hunt reviews page, note reviewers who name an agency or studio, and send ClimbOS the company names.

**Climbos Can Do:** Find each agency's public business email on its own site (no scraping of review or directory sites) and personalise and queue the emails. Add your postal address and an unsubscribe line, as US email law requires. Then build sample forms and track replies through to paid.

## Free in Claude: directory listing

**Name:** Free in Claude: directory listing

**One Liner:** List Formkit in the Claude Connectors Directory, then the ChatGPT app directory, leading with build-and-publish from chat on the free plan.

**Kind:** moonshot

**Audience:** People who work inside Claude or ChatGPT and browse the Claude Connectors Directory (claude.com/docs/directory/publish). Typeform, Jotform, Cognito Forms and FormHug publish Claude form-building guides, which shows demand (typeform.com/mcp, jotform.com/help/how-to-create-a-form-in-claude).

**Trigger:** A user in the middle of a chat needs a form: a client intake, an event sign-up or a job application.

**Hook:** Listing description: 'Build and publish forms without leaving Claude. Describe the form you need, such as a client intake, an event sign-up or a job application, and Formkit builds it, publishes it and returns a live link. Works on every Formkit plan, including free, with unlimited forms, responses and members. On Pro, take payments through your own Stripe account; Formkit takes no cut.'

**Mechanic:** Early listing in a new app directory, with tool names that match how users phrase requests: 'create a form', 'event sign-up with limited places', 'take payments'.

**Asset Used:** Chat build-and-publish on every plan including free, combined with no-cut Stripe payments on Pro.

**Funnel**

- Listing approved: low 50%, likely 75%, high 90% (assumption, grade D; review rules are new).

- Connector installs in about 60 live days: low 20, likely 60, high 150 (assumption, grade D; no directory install data in this research).

- Install to Pro within 60 days: low 3%, likely 6%, high 10% (assumption, grade D).

- Outcome: about 3 Pro accounts at P50, against about 9 needed to repay the $500 cap. Payback depends on the listing compounding after day 90 (assumption, grade D).

**Unit:** new Pro accounts

**P10:** 0

**P50:** 3

**P90:** 9

**Horizon Days:** 90

**Confidence:** low

**Biggest Unknown:** Whether Formkit's current Claude integration already qualifies for the directory, or is already listed. Today's first action answers it.

**Test:** Cap: 10 dev or owner hours ($500 at $50/hour; assumption) and $0 ad spend. Break-even: $500 ÷ $58 ≈ 9 Pro accounts. Duration: submit this week, measure 30 days after the listing goes live. Leading metric: install-to-Pro rate, with installs as the volume check.

**Kill If:** Zero Pro after 50 installs, meaning the true rate is below 6% by the rule of three. Also kill if install-to-Pro is under 3% at 30 live days, or the work passes the 10-hour cap.

**Scale If:** Install-to-Pro at or above 6%, with at least 1 Pro and installs on pace for 9 Pro accounts within six months. Then submit the ChatGPT app, add payment and event tools, and announce it to free users.

**Scores**

- 4

- 2

- 4

- 2

- 4

- 5

- 4

- 4

**First Action Today:** Open claude.com/docs/connectors/building/submission and check whether Formkit's Claude integration meets the remote-server requirements.

**Climbos Can Do:** Check submission requirements, draft listing copy and tool names, and track installs and install-to-Pro conversions weekly against the 9-account payback.

**Portfolio Note:** Lead with the upgrade moment, not ads. One Pro seat is worth about $58 gross profit in its first year ($6 × 12 months × an assumed 80% margin; assumption, grade D), so most paid channels cannot pay back.
- **Play 1, bankable (score 90/100):** upgrade free users when they hit a Pro-only feature.
- **Play 2, creative (70/100):** win agencies with chat-built client forms in per-client workspaces.
- **Play 3, moonshot (70/100):** list Formkit in the Claude directory. Distinctiveness is 4, not 5, because Typeform, Jotform, Cognito Forms and FormHug already work with Claude. Formkit's edge is that it works on the free plan.
- **Ad test:** put one fifth of the $600 monthly budget into Google search for 'google forms alternative' and 'tally alternative'. Send clicks to a Google Forms switcher page built from Formkit's compare table.
  - Add negative keywords vue, react, npm and github. FormKit, the Vue library at formkit.com, shares the name.
  - Kill after one month if each new Pro account costs more than $58. Widen to half the budget if it costs under half that and brings at least 3 Pro accounts.
  - Click costs were not checked in this research.
- **Skipped:** Product Hunt (assumption: tens of owner hours for mostly free signups) and paid newsletters (no click-cost data in this research).
- **Scores order:** fit, predictability, revenue per owner-hour, time to signal, compounding, cost, risk safety, distinctiveness.
- **Owner time:** about 3 hours a week at $50/hour (assumption, grade D).
