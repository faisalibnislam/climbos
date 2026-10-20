# BK09 guide: Founding Sales (Kazanjy)

Edition 2026-10-20 · status: proposed reference · not authorization for external actions

Labels used throughout: **Author guidance** (paraphrased advice), **Reported example** (a case or figure the book reports), **Interpretation** (our reading for ClimbOS), **Proposed ClimbOS rule** (not yet in code or skills). Locators are EPUB file plus element range from `epub_full.py`. Finding ids: `a-Fn` = BK09a (Intro, Ch 1–6), `b-Fn` = BK09b (Ch 7–13).

## Source

| Field | Value |
|---|---|
| Title | Founding Sales: The Early Stage Go-to-Market Handbook |
| Author | Peter Kazanjy |
| Publisher, year | Self-published (printed by Ingram/Lightning Source), © 2020; EPUB date 2020-12-07; ASIN B08PMK17Z1; no edition statement |
| ISBN | 978-1-7345051-0-8 (e-book); 978-1-7345051-1-5 (print), verified on part0002.html [19]–[20] |
| Format | EPUB, `docs/reference-books/Founding_Sales_-_Peter_Kazanjy.epub` |
| Extraction quality | Good text. Slides, screenshots, the outreach response graphs (part0010.html [61]–[65]), the churn chart, maturity diagrams and the cadence calendar are images. One source sentence is cut off (part0010.html [193]). Much tooling reflects about 2015. |
| Watermark | OceanofPDF marks present: an "OceanofPDF.com" line at the end of each chapter file and an oceanofpdf.com stub file |

**Coverage**

| Status | Sections |
|---|---|
| Read | Copyright, contents; Introduction; Part I opener; Ch 1–10; Ch 13 (conclusion) |
| Skimmed | Ch 11 hiring (role order, tempo, mock presentation, compensation read; trait lists, sourcing, interviews skimmed); Ch 12 onboarding (cohorts, drilling, early inbound deals, ramp KPIs read; tool provisioning skipped) |
| Skipped | Acknowledgments |
| Unreadable | All images listed above; some Ch 10 subsections are image-only |

## Use this guide for

| Decision | Business types | Stages |
|---|---|---|
| Should the owner sell personally, or hire or outsource selling? | B2B SaaS, agencies, consultancies, B2B local services | pre-launch, early, growing |
| Which accounts to approach without a prospect database, and whom inside them | B2B SaaS, agencies, B2B services | pre-launch, early |
| How to structure outreach, meetings and the first sales call | B2B SaaS, agencies, quote-based local services | early, growing |
| Whether to keep working a deal, and how to read a sales pipeline | agencies, consultancies, sales-led SaaS, quote-based services | early, growing |
| What to trade in a negotiation; whether onboarding cost fits the price | agencies, consultancies, B2B SaaS | early, growing |

**Interpretation:** the book is written for venture-backed B2B tech. Low-price self-serve products, consumer businesses and most ecommerce should route to [BRP-19](../../blog-research/playbooks/BRP-19-sales-touch-fit.json) before any of this applies.

## K1 · Founder-led selling first; when to add sellers (a-K1, b-K8)

- **Decision:** should the owner sell now, or hire, outsource or automate, and which role comes first?
- **Author guidance:** early sales has two stages: first find out whether the offer solves a paid-for pain, then scale. The founder must do the first stage; hired reps sell a proven offer and can't tell a sales failure from a product failure. Unscalable work is fine early (a-F1–F3). Two failure modes: hiring sellers to discover the motion before it works, and the founder keeping deals too long after it does. Readiness means a reliable win rate with consistent deal size and cycle; if win rate is low, fix message, product or price before adding volume (b-F36). Add roles in order of the limit: appointment setting first, more closers when calendars fill, account management when renewals pile up (b-F39, b-F42). Hire a sales leader only after several sellers match the founder (b-F45).

| If | Then (Interpretation) |
|---|---|
| Owner has won no customers through their own conversations | Owner sells; no setter, SDR or agency as the lead play |
| Too few closed decisions, or win rate unstable | Keep founder-led; no hire |
| Stable win rate; calendar under-filled because prospecting eats time | Appointment-setting help first |
| Calendar full of selling meetings | Second closer, or raise price |
| Delivery eats selling time | Delivery or client-success help first (PB-capacity) |
| Value per customer can't cover owner hours | Self-serve route ([BRP-19](../../blog-research/playbooks/BRP-19-sales-touch-fit.json)) |
| Owner has under ~3 hours a week | Warm intros (K5) or inbound (K6) instead of cold outreach |

- **Evidence needed:** owner-won deals; win rate per held meeting over enough decisions; deal value and cycle; owner time split; cost of a hire. **Missing data:** win rate unknown, so keep founder-led and collect.
- **Steps:** compute expected bookings per seller (meetings × win rate × deal value) and cost of sales (seller cost ÷ bookings) in code → compare to the owner's margin room, not a generic band → hire one role → document the motion → review ramp.
- **Cash / labour / capability / measurement:** salary runway for ramp; founder coaching time; documented pitch, objection list and qualification rules; per-seller hold rate, win rate, deal size.
- **Guardrails:** book salary and cost-of-sales bands are dated venture context; employment and contractor law varies. **Stop/review:** a new seller stays well below founder win rate after a set ramp, review onboarding before hiring more.
- **Alternatives:** can't afford a hire, try a freelance setter on trial, partners, or a price rise to free time (PB-capacity, PB-price-increase).

| Proposed ClimbOS rule | Class |
|---|---|
| With no owner-won deals, plans don't lead with hiring a seller, outsourced SDR or setter agency | strategic preference |
| PB-cold-outreach requires owner selling hours (about 3 a week) as well as price and mailbox | missing prerequisite |
| No sales-hire recommendation until a stable founder win rate and evidence that won clients succeed | strategic preference |
| Hire recommendations show bookings and cost of sales computed from the owner's own rates, with ramp as an assumption | economic feasibility |

- **Relation to existing:** *extends* the motion ladder in [book 11](../../../../docs/growth-intelligence/books/11_sales_partnerships.md) §1, [BRP-19](../../blog-research/playbooks/BRP-19-sales-touch-fit.json) (affordability, not who sells), and PB-cold-outreach and PB-capacity in [contracts.ts](../../../../shared/playbooks/contracts.ts) (PB-cold-outreach lines 225–236 have no hours requirement). Proposed home: [growth-strategy](../../../../skills/growth-strategy/SKILL.md), [plays-saas-b2b](../../../../skills/plays-saas-b2b/SKILL.md).
- **Sources:** a-F1 (part0005_split_000.html [55]–[59]); a-F2 (part0005_split_002.html [13]–[23]); a-F3 ([18]); a-F4 ([24]–[25]); b-F36 (part0015_split_001.html [15]–[41]); b-F39 ([52]–[102]); b-F40 ([108]–[215]); b-F42 (part0016.html [26]–[28], [79]–[81], [233]–[268]); b-F45 (part0018.html [15]–[27]).

## K2 · Problem-first sales narrative (a-K2)

- **Decision:** in what order to tell the story, and which proof gaps to fill.
- **Author guidance:** build from problem to solution: the problem, who owns it, what it costs, how it is handled today and why that falls short, what has changed, how the new offer works, proof, then price. The order lets you stop as soon as the buyer rejects the problem (a-F10). The problem owner is whoever is responsible for fixing it, and that role shifts with company size; no owner may mean no fit (a-F11). Cost can be hard (direct cost avoided), soft (opportunity) or directional (a-F12). Today's answer is nothing, a manual process, a service provider or a product; a buyer already paying for one is a good fit signal, and the alternative's strengths should be admitted (a-F13). Prove claims in metrics the buyer already tracks (a-F15).

| If (today's alternative) | Then (Interpretation) |
|---|---|
| Nothing | Prove the cost of the problem first |
| Manual process | Argue time and fragility |
| Service provider | Argue cost and control; admit its strengths |
| Product | Treat as a qualification signal; compare like for like |
| No real, sourced change in the market | Leave the market-change step out |

- **Evidence needed:** problem cost inputs from owner or buyer; known alternatives. **Missing data:** cost line marked "unknown", not estimated.
- **Cash / labour / capability / measurement:** none; owner hour; positioning output; buyers who confirm the problem.
- **Guardrails:** no invented trend; cost line labelled hard or soft and computed in code.

| Proposed ClimbOS rule | Class |
|---|---|
| The pitch narrative includes a cost-of-problem line computed in code from owner or buyer inputs, labelled hard or soft | contextual heuristic |
| Tag each alternative as nothing, process, provider or product; paying for one is a nice-to-have fit signal | contextual heuristic |
| The market-change step stays optional and is cut when no real change exists | strategic preference |

- **Relation to existing:** *versions* step 11 of [positioning](../../../../skills/positioning/SKILL.md) and [book 11](../../../../docs/growth-intelligence/books/11_sales_partnerships.md) §5; keeps positioning step 8's stricter trend rule.
- **Sources:** a-F10 (part0007.html [23]–[28], [205]–[224]); a-F11 ([45]–[56]); a-F12 ([57]–[69]); a-F13 ([70]–[89]); a-F14 ([90]–[98]); a-F15 ([106]–[118]).

## K3 · Database-free target accounts and the right contact (a-K3, a-K4)

- **Decision:** which 50–100 accounts to approach without a database, and whom to contact by an allowed route.
- **Author guidance:** first aim for 50–100 accounts that have the pain, not whoever is easy to reach; demos with poor-fit prospects burn about a week (a-F26). Describe the target as account-level traits that signal demand, both minimum requirements and degree; some are publicly visible, others only learnable by asking (a-F27). Source from one productive place and use others only to enrich; visible paid tiers hint at willingness to pay (a-F28). Start with mid-sized accounts nearby (a-F29). Start from accounts or from people depending on which required trait rules accounts out most cheaply (a-F30). Contact whoever owns the pain and budget; fall back to a complementary decision-maker; look for shared connections only once the account qualifies (a-F31).

| If | Then (Interpretation) |
|---|---|
| The gating trait is a role | Start contact-first |
| The gating trait is a company property | Start account-first |
| A trait can never be observed publicly | Not a filter; ask it in discovery or on a form |
| A trait is observable but not found | Hold the account (fit unknown) |
| The account is a friend | Same fit test |
| 1–10-person company | Contact the owner |
| No reply from the primary contact | One complementary contact, then stop |
| Local business | Owner phone call only after a compliance check |

- **Evidence needed:** public business sources (directories, maps, licence registers, hiring pages, site technology, public ad libraries), each with a source URL. **Missing data:** no compliant source, so no list.
- **Cash / labour / capability / measurement:** none; owner or ClimbOS research time; [prospecting](../../../../skills/prospecting/SKILL.md) skill; accounts found per hour, fit share.
- **Guardrails:** published business addresses only; no personal addresses, guessed patterns beyond the skill's caps, or LinkedIn scraping; one contact at a time per account.

| Proposed ClimbOS rule | Class |
|---|---|
| Each must-have is tagged observable or not; non-observable traits become discovery or form questions | contextual heuristic |
| One primary source per campaign; others only enrich found accounts | strategic preference |
| Visible paid tiers count as a willingness-to-pay nice-to-have, with source URL | contextual heuristic |
| Never source from bought or scraped contact lists without a recorded lawful basis | external requirement |
| Personal (non-business) addresses are never a cold-email route, even when published | external requirement |
| One primary role per account; one complementary role only after the first sequence ends | strategic preference |
| Owner phone outreach needs a call-compliance check (e.g. UK TPS/CTPS, US mobile and autodialer rules) before ClimbOS suggests it | unknown to investigate |

- **Relation to existing:** *extends* [prospecting](../../../../skills/prospecting/SKILL.md) (step 5) and [book 11](../../../../docs/growth-intelligence/books/11_sales_partnerships.md) §2; [jurisdiction-rules](../../../../skills/prospecting/reference/jurisdiction-rules.md) has no phone section. Code already sends only to published addresses ([index.ts](../../../../shared/outbound/index.ts) ~lines 188–209).
- **Sources:** a-F26 (part0009.html [15]–[33]); a-F27 ([34]–[53], [99]–[105]); a-F28 ([43]–[97]); a-F29 ([142]–[149]); a-F30 ([150]–[176]); a-F31 ([178]–[194]); a-F32 ([196]–[221]); a-F37 (part0010.html [83]–[103]).

## K4 · Outreach message structure and sequence (a-K5)

- **Decision:** how to build each message and the sequence, and how much one owner should run.
- **Author guidance:** booking outreach sells the meeting, not the product (a-F33). Assume the pain you prospected for, keep it plain and about the prospect, split value themes one per email across a drip (a-F21). Personalise the first email by hand, follow up in the same thread, end with a break-up note; mix email and calls over about a week (a-F34, a-F41). Tailor proof to the prospect: a one-minute screenshot or a five-minute recording (a-F19).
- **Interpretation, keep:** one value theme per follow-up; personalisation from researched fields; a prospect-specific proof asset offered without a link. **Reject:** open and click tracking; links and meeting asks in step 1; the call-heavy 7-day cadence; very early or late sends; guilt-driven break-ups.

| If | Then (Interpretation) |
|---|---|
| Owner has a connected mailbox, B2B buyers and a price that pays for selling | Owner-mailbox sequence per [cold-outreach](../../../../skills/cold-outreach/SKILL.md) |
| Owner wants Resend or a bought list | Refuse: Resend is never used for cold outreach |
| Owner's own per-step reply data exists | It decides step emphasis, not vendor figures |

- **Cash / labour / capability / measurement:** none; owner review time per step; mailbox connection; replies and booked calls per step (no opens).
- **Guardrails:** no tracking; no booking link before a reply; no deceptive subjects; sensible hours (code window weekdays 8:00–17:00, [sending.ts](../../../../shared/outbound/sending.ts) lines 39–42); owner approves sends.

| Proposed ClimbOS rule | Class |
|---|---|
| Each follow-up carries one value theme or proof item from the positioning hierarchy; no repeats | contextual heuristic |
| Step 2 or 3 may offer a prospect-specific proof asset built from public evidence, without a link | contextual heuristic |
| The first email has no booking link; the link appears only after an interested reply | strategic preference |
| Book response figures are stored as dated vendor examples, never base rates | contextual heuristic |
| A step-1 subject starting "Re:" or "Fwd:", or wording that falsely implies a prior call, is a lint error | external requirement |

- **Relation to existing:** *versions* [cold-outreach](../../../../skills/cold-outreach/SKILL.md) and PB-cold-outreach in [contracts.ts](../../../../shared/playbooks/contracts.ts). Inconsistencies found: PB-cold-outreach says one follow-up (line 234), the skill uses four steps and code allows five; the email footer in [sending.ts](../../../../shared/outbound/sending.ts) (line 75) adds a booking link to every step including step 1 (P2); `lintOutreach` in [specs.ts](../../../../shared/agents/specs.ts) does not catch step-1 "Re:" or links (P2).
- **Sources:** a-F19 (part0008.html [107]–[114]); a-F21 ([307]–[315], [421]); a-F33 (part0010.html [23]–[26]); a-F34 ([53]–[74]); a-F35 ([45]–[48], [87]–[90], [185]); a-F36 ([70]); a-F41 ([179]–[186]).

## K5 · Warm intros through the owner's network (a-K7)

- **Decision:** whether and how to reach already-qualified accounts through people the owner knows.
- **Author guidance:** qualify the account first, then find a shared connection; send them a short reason plus a ready-to-forward note so the target opts in; if the forward goes unanswered, follow up once in the same thread (a-F22).
- **Interpretation:** needs no database, no customers and no budget, so it fits ClimbOS's constraints best of all the book's channels. Differs from PB-referrals, which needs existing customers.
- **Steps:** qualify accounts (K3) → match genuine connections → draft the forwardable note → owner sends → one direct follow-up → stop.
- **Cash / labour / capability / measurement:** none; about 2 owner hours a week; owner's own network knowledge; intros requested, forwarded, meetings.
- **Guardrails:** no tracking pixel on intros; never imply an introduction that didn't happen.

| Proposed ClimbOS rule | Class |
|---|---|
| Add PB-warm-intros (B2B types, owner hours about 2 a week, no customer minimum) | strategic preference |
| An intro email names the intermediary only when the owner confirms they agreed or forwarded | external requirement |
| Processing an owner's exported connection data for outreach needs platform-terms and data-protection review before automation | unknown to investigate |

- **Relation to existing:** *new* as a typed playbook; warm intros are described in [BK05](../../../../docs/growth-engine/book-review/BK05.md) (Ch 6); PB-referrals in [contracts.ts](../../../../shared/playbooks/contracts.ts) is customer-driven.
- **Sources:** a-F22 (part0008.html [423]–[427]; part0010.html [187]–[209]); a-F31 (part0009.html [178]–[194]).

## K6 · Inbound capture and speed to lead (a-K8)

- **Decision:** how to capture demo requests and how fast and how often to respond.
- **Author guidance:** outbound activity creates inbound. Keep one clear request path; ask only for basics plus qualifiers you can't look up; show a phone number; reply automatically, then respond within minutes; make several attempts before moving on; send a hard-qualifier email to likely misfits; qualify the account, not just the lead (a-F42).

| If | Then (Interpretation) |
|---|---|
| Likely fit | Respond within minutes from the owner's channel; offer times |
| Likely misfit | Hard-qualifier email instead of a meeting offer |
| No answer | Follow the lower attempt cap in [sales-follow-up](../../../../skills/sales-follow-up/SKILL.md) |

- **Cash / labour / capability / measurement:** none; owner response time; form and notifications; minutes to first response, contact rate.
- **Guardrails:** each extra form field needs a stated reason; the response-time study is directional only.

| Proposed ClimbOS rule | Class |
|---|---|
| Lead forms ask only for qualifiers not findable from the company domain | contextual heuristic |
| Likely-unqualified inbound gets a hard-qualifier email rather than a meeting offer | contextual heuristic |
| The response-time multiple is shown only as a dated, directional example | contextual heuristic |

- **Relation to existing:** *extends* [sales-follow-up](../../../../skills/sales-follow-up/SKILL.md) and the speed-to-lead play in [plays-local](../../../../skills/plays-local/SKILL.md); mostly *duplicates* existing speed guidance.
- **Sources:** a-F42 (part0010.html [210]–[219]; part0011.html [15]–[96]).

## K7 · Booking and running the first sales meeting (a-K6, b-K1)

- **Decision:** how to turn interest into a held meeting, and how to run it so it ends with a dated next step or a polite exit.
- **Author guidance:** book the slot live, within about a week, ideally two or three days out; send an invite with location and agenda, a reminder that morning, and block time around it (a-F38, a-F40). A sale depends on value, how well the buyer understands it and how much they believe they'll capture it (b-F2). Spend about 15 minutes planning before each demo (b-F4, b-F6). Order: brief rapport, discovery, a few slides, a tailored demo, proof, price, a direct ask; split off a separate discovery call only when the demo is long (b-F7). Match value language to the person: users, managers, executives (b-F8). End early if there is no pain or no ability to pay (b-F13). Founders most often fail by not stating price and not asking (b-F15). After every meeting, agree the next step in writing and deliver your part fast (b-F21).

| If | Then (Interpretation) |
|---|---|
| Demo under ~15 minutes, or fit visible from public facts | One combined meeting |
| Long demo and fit needs questions | Short discovery call first; demo only if qualified |
| No pain or no ability to pay | End politely, give time back, log as unqualified |
| Contact likes it but can't decide | Joint follow-up with the decision-maker; forwardable summary |
| Small-business enquiry asks price early | Give the confirmed range, then frame it against their problem |
| Price per customer can't pay for a live call | No call script; route to [BRP-19](../../blog-research/playbooks/BRP-19-sales-touch-fit.json) alternatives |

- **Evidence needed:** how the lead arrived; public account facts; confirmed price ranges and proof items. **Missing data:** price or proof absent, so mark it as a needed fact; never invent.
- **Cash / labour / capability / measurement:** none; ~15 min prep + call + ~15 min follow-up; short narrative and 1–2 proof items; held, qualified share, next-step-agreed share.
- **Guardrails:** no invented prices, results or customers; no pressure or false urgency; recording only with consent where required; business-relevant public facts only, no personal-profile research. **Review:** the script after every ~10 held meetings.

| Proposed ClimbOS rule | Class |
|---|---|
| Value per meeting = deal value × meeting-to-win rate, computed in code and compared with owner hours × hourly cost | economic feasibility |
| Booking pages offer slots within the next 7–10 days by default | contextual heuristic |
| A call plan ends with one dated next step or an explicit disqualification | contextual heuristic |
| Call plans never include recording or transcription unless the owner confirms consent handling | external requirement |

- **Relation to existing:** *extends* [reply-handling](../../../../skills/reply-handling/SKILL.md), [sales-follow-up](../../../../skills/sales-follow-up/SKILL.md) (step 4 has only a short phone script) and [book 11](../../../../docs/growth-intelligence/books/11_sales_partnerships.md) §3, §5; booking horizon in [index.ts](../../../../shared/outbound/index.ts) is 14 days (P3).
- **Sources:** a-F38 (part0010.html [105]–[116]); a-F40 ([160]–[178]); b-F2 (part0012.html [23]–[32]); b-F4 ([43]–[51]); b-F6 ([52]–[95]); b-F7 ([113]–[118]); b-F8 ([119]–[126]); b-F13 ([207]–[211]); b-F14 ([218]–[238]); b-F15 ([239]–[275]); b-F21 ([389]–[399]).

## K8 · Qualification and objections (b-K2, b-K3)

- **Decision:** whether to keep investing in a deal, and how to answer a specific hesitation.
- **Author guidance:** discovery qualifies and arms the pitch. For new-category offers, strict budget and timeline tests misfire because buyers didn't know the solution existed; weigh pain size, urgency, whether they ever pay for tools, who decides and ability to pay (b-F9, b-F10). Objections show engagement: find the real question, answer with proof, check it landed, return to the close (b-F16). On price, ask how far apart you are: a small gap is negotiation, a large gap is a value disagreement (b-F17). An organisation that never pays for solutions is disqualified, not objecting; otherwise look for spend already on the problem (b-F18). A trial request usually signals a need for more proof; structured pilots only for large deals (b-F19). Repeated objections become an approved answer (b-F20).

| If | Then (Interpretation) |
|---|---|
| No real problem, or never pays for solutions | Disqualify with reason; feed back to targeting |
| Pays for alternatives but has no budget line | Keep; look for existing spend on the problem |
| Contact lacks authority | Keep; joint meeting with the decision-maker |
| Price gap small (author's example ~10%) | Negotiation (K10) within owner limits |
| Price gap large (~50%) | Walk value math with the buyer's own numbers; smaller scope or disqualify |
| Asks for a trial of a setup-heavy offer | Ask what proof settles it; case evidence or a guided session |
| Written channel and the buyer repeats no | Stop; gracious close |

- **Evidence needed:** problem in the buyer's words; materiality; who decides; each field recorded as unknown, reported, verified or contradicted. **Missing data:** too few deals for shares, so review each by hand.
- **Cash / labour / capability / measurement:** none (pilots cost owner time); minutes per deal; a disqualifier list and objection list; unqualified-after-meeting share, objection types per lost deal.
- **Guardrails:** job title doesn't prove authority; never mark a field verified from a similar customer; one evidenced answer per objection in written follow-ups; pilot criteria in writing first. **Review:** an objection heard twice gets an approved answer.

| Proposed ClimbOS rule | Class |
|---|---|
| "No budget line" alone never disqualifies; "never pays for solutions like this" does, unless the owner overrides | contextual heuristic |
| Track "unqualified after a meeting" separately from "lost" | strategic preference |
| Don't recommend discounting to win a buyer whose expected value is low; disqualify | economic feasibility |
| Ask the size of a price gap before answering it | contextual heuristic |
| Structured pilots only when expected deal value covers the owner hours, computed in code | economic feasibility |
| In written follow-ups, one evidenced answer per objection; a repeated no ends the sequence | strategic preference |

- **Relation to existing:** *versions* the light-deal path missing from [book 11](../../../../docs/growth-intelligence/books/11_sales_partnerships.md) §2, §4 and step 6 of [sales-follow-up](../../../../skills/sales-follow-up/SKILL.md) and step 5 of [reply-handling](../../../../skills/reply-handling/SKILL.md).
- **Sources:** b-F9 (part0012.html [132]–[144]); b-F10 ([145]–[156]); b-F16 ([276]–[387]); b-F17 ([329]–[344]); b-F18 ([345]–[359]); b-F19 ([360]–[370]); b-F20 ([372]–[385]); b-F25 (part0013.html [83]–[96]).

## K9 · Stalled deals and pipeline diagnosis (b-K4, b-K5)

- **Decision:** when a deal is dead, and which pipeline step limits revenue: more meetings, or fix conversion, offer, targeting or selling capacity.
- **Author guidance:** agree small commitments step by step; a buyer breaking them is an early warning to name directly (b-F12). Close as lost after a direct no, repeated broken commitments or silence, often after a short clarity email; record the reason (b-F24). Revenue is opportunities × win rate × deal size (b-F3). Every open deal needs a calendared next step; review weekly; when close rates fall the seller is overloaded; flag late-stage deals untouched for a week, stuck for about two weeks, or with no future meeting (b-F26). CRM default stage probabilities are unhelpful early (b-F25).

| If | Then (Interpretation) |
|---|---|
| Two or more broken commitments | One respectful clarity email, owner-approved, then close lost with reason |
| Buyer defers and names a date | Deferred; one check-in on that date |
| Buyer defers without a date, or opts out | No re-contact without permission; suppress on opt-out |
| Hold rate low | Confirmations, reminders, booking qualification |
| Unqualified share high | Tighten who gets a meeting before adding volume |
| Held-to-proposal or proposal-to-won low | Discovery, offer, price or proof; read lost reasons |
| Win rate at owner's own target and calendar has room | Demand binds: add qualified meetings |
| Calendar full and win rate falling | Selling capacity binds: cap meetings, delegate setting or raise price |
| Fewer than ~5 closed decisions | Report counts only, "too few to judge" |

- **Evidence needed:** per period: booked, held, proposals, won, lost, unqualified, average won value, owner meeting capacity, deal dates. **Missing data:** ask for the six counts over 60–90 days; very low volume means review the last 5 won and 5 lost.
- **Cash / labour / capability / measurement:** none; minutes a week; CRM stages with dates and deterministic aggregation.
- **Guardrails:** all arithmetic in code; no stage-default probabilities; book benchmarks never set a verdict; the named constraint is a hypothesis. **Review:** monthly or after 10 new closed decisions.

| Proposed ClimbOS rule | Class |
|---|---|
| An open deal with no future dated next step is flagged as uncovered (no next step) | contextual heuristic |
| Re-engaging a lost or deferred deal needs buyer permission or a recorded lawful basis; no default 60-day re-contact | external requirement |
| For sales-led businesses, diagnosis reads a sales block and names the weakest link in code | missing prerequisite |
| Don't recommend more outreach when win rate per held meeting is below the owner's own target, unless the calendar is empty and the sample adequate | contextual heuristic |
| Owner meeting capacity ≥80% used with falling win rate names selling capacity as the constraint | contextual heuristic |
| The book's win-rate bands are shown only as dated author views; whether any sales-led reference exists is open | unknown to investigate |

- **Relation to existing:** *extends* [book 11](../../../../docs/growth-intelligence/books/11_sales_partnerships.md) §7, §13 and step 8 of [sales-follow-up](../../../../skills/sales-follow-up/SKILL.md). Code gaps: `OwnerFunnel` and `StageReading` in [diagnosis.ts](../../../../shared/agents/diagnosis.ts) (lines 11–26, 39) have no sales block (P1); CRM data in [crm.ts](../../../../convex/crm.ts) (stages lead/talking/booked/won/lost, line 14) never reaches diagnosis via [jobs.ts](../../../../convex/jobs.ts) (P2); deals in [schema.ts](../../../../convex/schema.ts) lack lost reasons, stage history and re-contact permission (P2). No sales-led rows in [base-rates](../../../../skills/growth-plays/reference/base-rates.md).
- **Sources:** b-F3 (part0012.html [33]–[42]); b-F5 ([47], [117]); b-F12 ([191]–[202]); b-F23 (part0013.html [63]); b-F24 ([61]–[77]); b-F25 ([83]–[96]); b-F26 ([97]–[108]).

## K10 · Negotiation levers and payment terms (b-K6)

- **Decision:** what to trade when a ready buyer wants a better deal, and how to set options and payment terms.
- **Author guidance:** the levers are unit price, quantity, term length, payment terms and renewal; an early company should favour cash up front, then term. Concede one step at a time and always trade; price split payments higher; to match a rival's quote, see it and tie the match to signing now (b-F22). Send proposals only to buyers who said they want to buy (b-F15).

| If | Then (Interpretation) |
|---|---|
| Lower unit price wanted | Only for more units, longer term or upfront payment, within owner limits |
| Lower total wanted | Reduce scope or term, not the same scope cheaper |
| Split payments wanted | Price above upfront; owner sets the premium |
| Cheaper competitor cited | Like-for-like comparison; adjust only if the quote is shown and the owner approves |

- **Evidence needed:** list price, floor and margin from [decisions.ts](../../../../shared/analysis/decisions.ts); which terms the owner will vary. **Missing data:** no owner price rules means present list price and ask before any concession.
- **Cash / labour / capability / measurement:** none; owner; margin and price-floor calculators; realised price vs list, share paid upfront.
- **Guardrails:** urgency claims (price rise, limited slots, end dates) only when true and in facts; never below price floor; consumer contracts need a local law check. **Review:** realised discount keeps rising, so review list price and proof.

| Proposed ClimbOS rule | Class |
|---|---|
| Every drafted concession is paired with something the client gives | strategic preference |
| Effective price, payment-term premium and post-concession margin are computed in code against the floor | economic feasibility |
| Urgency statements need a matching fact or the lint blocks them | external requirement |
| Every proposal option is a deliverable offer; no decoys | strategic preference |

- **Relation to existing:** *extends* [book 11](../../../../docs/growth-intelligence/books/11_sales_partnerships.md) §6 and the Never-do list in [sales-follow-up](../../../../skills/sales-follow-up/SKILL.md); payment-term calculator missing from [decisions.ts](../../../../shared/analysis/decisions.ts) (P3).
- **Sources:** b-F15 (part0012.html [239]–[275]); b-F17 ([329]–[344]); b-F22 (part0013.html [16]–[44]).

## K11 · High-touch onboarding, reviews and renewals (b-K7)

- **Decision:** how an agency or B2B firm gets new clients to the promised result and protects renewal, and whether its price can carry that work.
- **Author guidance:** success means delivering what the sale promised; the window right after purchase is the cheapest time to drive adoption (b-F28). Check implementation labour fits the price; heavy setups can carry a one-off fee (b-F29). Start onboarding by restating the buyer's goal, clear setup blockers first, have the user do real work, set measurable homework and book a check-back about two weeks out (b-F30). Monitor value signals, focus on middling users, run periodic success reviews (automated for low-price products) (b-F33). Hold a renewal conversation about six weeks before term end and always ask (b-F34). Early on one person can own all of this (b-F35).

| If | Then (Interpretation) |
|---|---|
| Onboarding labour is a large share of first-period revenue | Setup fee, simpler onboarding or self-serve materials (share computed in code) |
| Value signals low | Helpful check-in; involve the sponsor if one user blocks |
| Low price per client | Automated success summary instead of a meeting |
| Renewal near with issues open | Renewal talk ~6 weeks out; fix plan or short extension (owner choice) |
| One-off consumer jobs | Not this; use review and rebooking flows in [retention-lifecycle](../../../../skills/retention-lifecycle/SKILL.md) |

- **Evidence needed:** what the sale promised; onboarding hours per client; value signals; term and renewal dates. **Missing data:** no usage data means a short monthly check-in email.
- **Cash / labour / capability / measurement:** none to start; hours priced in; client report ([clientReports.ts](../../../../convex/clientReports.ts)) and calendar; onboarded on time, days to first result, renewal rate.
- **Guardrails:** auto-renewal terms and notices follow local law; success reports show measured outcomes only; testimonials only with permission. **Review:** renewal rate falls, so check onboarding completion and first-result timing first.

| Proposed ClimbOS rule | Class |
|---|---|
| Code computes onboarding labour per client and its share of first-period revenue before recommending high-touch onboarding | economic feasibility |
| Every onboarding plan ends with a booked check-back and a measurable first task | contextual heuristic |
| Upsell suggestions are suppressed for clients with open delivery issues | strategic preference |
| Auto-renewal clauses and notice timing are flagged for an owner legal check, never drafted as compliant | external requirement |

- **Relation to existing:** *extends* [retention-lifecycle](../../../../skills/retention-lifecycle/SKILL.md) (automated flows, no high-touch branch), [BRP-07](../../blog-research/playbooks/BRP-07-activation-definition.json) (value received) and PB-activation-repair in [contracts.ts](../../../../shared/playbooks/contracts.ts).
- **Sources:** b-F28 (part0014.html [15]–[34]); b-F29 ([38]–[46]); b-F30 ([47]–[84]); b-F31 ([85]–[115]); b-F33 ([175]–[278]); b-F34 ([279]–[295]); b-F35 ([296]–[330]).

## Dated benchmarks (context only, never thresholds)

| Figure | Context | Date | Why not a threshold |
|---|---|---|---|
| 20–30% win rate called solid for a new solution (a-F8); 10–20% typical, 30% very good (b-F23); 15–30% of first meetings good (b-F37) | Author's practitioner views, US tech B2B | ~2011–2020 | Anecdotal, denominators differ, venture SaaS |
| Demo hold rate ≥80%; 10–20% of meetings missed and rescheduled | Author expectation (b-F5) | ~2010s | No dataset |
| Total sales cost ~20–30% of revenue closed | Author range (b-F37) | ~2010s | Venture SaaS; agency and consulting margins differ |
| Hand-personalised first email 12% vs 5% replies; step 2 highest at 18%; 7-step drip ~15× a single email | Vendor data cited (a-F34) | ~2015 | Vendor-run, unknown denominators, graphs unreadable; conflicts with the skill's vendor figure favouring step 1 |
| Contact rates ~100× lower at 30 minutes than at 5; ~90% reached by six attempts | MIT/InsideSales study and author simplification (a-F42) | ~2007–2011 | Old, vendor co-authored, simplified |
| Open-tracking value | Author practice (a-F35) | pre-2021 | Opens unreliable since Apple Mail Privacy Protection |
| TalentBin price path to $6,000 per seat a year; $5,000 value per demo | Reported examples (a-F16, a-F40) | ~2012–2015 | One company |
| Churn chart: ~$4M vs ~$2.8M vs <$2M MRR at 0%, 2.5%, 5% monthly churn | Hypothetical illustration (b-F28) | 2020 | Inputs not given; not reproducible |
| AE pay ~50/50 base/variable; setters 60/40–70/30 | Author ranges (b-F43) | 2010s San Francisco | Region and era specific |
| 30–50% early rep flameout | Unsourced industry claim (b-F44) | n.d. | No source |
| Zenefits, Square Stand premature scaling | Reported examples (b-F38) | ~2014–2016 | Author's secondhand accounts |

## Disagreements and what decides

**Policy conflicts (book tactic → ClimbOS position):**

| Book tactic | Locator | ClimbOS position | Class |
|---|---|---|---|
| Personal addresses acceptable; guess from naming pattern; email-finder tools | part0009.html [196]–[221] | Published business addresses only; no scraping | external requirement |
| Open and click tracking; call right after an open | part0010.html [45]–[90], [185] | No tracking; measure replies | strategic preference |
| Links and meeting ask in the first email | part0008.html [307]–[315] | Plain text, interest question, no step-1 link | strategic preference |
| Very early or late send times | part0010.html [70] | Weekday business hours | strategic preference |
| Misleading voicemail that pretends to return a call (described, not recommended) | part0010.html [101] | Deceptive; banned | external requirement |
| Logos without asking; publicity rights in fine print; gifts for testimonials | part0008.html [253], [268] | Named customers need permission; paid endorsements need disclosure | external requirement |
| Pushing past requests to call later, holding back price, hinting at the boss | part0010.html [131]–[159] | Permission-based check-ins; give price from facts | strategic preference |
| Claimed price rises or scarce onboarding slots as urgency | part0012.html [327]; part0013.html [35]–[36] (verified) | Only when true and in facts | external requirement |
| Re-contact lost deals after ~60 days by default | part0013.html [61]–[77] | Permission or lawful basis required | external requirement |
| Product model sells crawled personal emails; bought lists disliked only for quality | part0008.html [328]–[383]; part0009.html [97] | Lawful basis required; never via Resend | external requirement |

**Library disagreements:**

| Topic | BK09 | Existing | What decides |
|---|---|---|---|
| Objection persistence | Loop until none remain | One attempt in [sales-follow-up](../../../../skills/sales-follow-up/SKILL.md), [reply-handling](../../../../skills/reply-handling/SKILL.md); book 11 §6 don't assume concealment | Channel: live may cover distinct objections in turn; written gets one; a repeated no is final |
| Price timing | Hold price until value is framed | sales-follow-up answers price in the first reply | Small-business inbound gets the range; complex B2B frames after discovery but never dodges |
| Anchoring and three-option steering | Start high; middle option as target | Book 11 §6: no unusable options | Real, deliverable options only; anchoring is an owner choice with real prices |
| Market-change step | Core to the narrative | Optional in positioning step 8 | Whether a real, sourced change exists |
| Unknown hidden traits | Contact anyway | Prospecting holds unknown-fit accounts | Split observable vs non-observable traits (K3) |
| Highest-reply step | Step 2 (vendor) | Step 1 (skill's vendor) | Owner's own per-step data |
| Follow-up count | Long drip | PB-cold-outreach one follow-up; skill four steps; code up to five | Needs reconciliation inside ClimbOS first |
| Attempts on inbound | About six | sales-follow-up's lower cap | Keep the lower cap |
| Auto-renew by default | Recommended | Owner and legal decision | Law and owner |
| Win-rate benchmarks | 15–30% good | No sales-led rows in base-rates | Owner's own history |

## Not processed or uncertain

- Ch 11–12 were skimmed by design; trait lists, sourcing channels and tool setup were not extracted.
- The pricing material in Ch 2 (a-F16, a-F17) was not turned into a framework; compare with PB-pricing-test and PB-price-increase before use.
- Author arithmetic slips: implementation cost (~$70) implies ~48 working weeks; his short-term pricing example is 1.43× per month against his stated 2–3× rule; a 41.7% cost of sales is rounded to 40%; HIRABL's missed-fee rate is 1 in 500 in Ch 2 and 1 in 300 in Ch 6 (a-F43).
- The BK09b reading record says no ISBN; the copyright page does list two (verified above).
- Phone-compliance rules, connection-data processing and auto-renewal law need legal verification.
- Code line references were checked on 2026-10-20 for `diagnosis.ts`, `contracts.ts`, `sending.ts` and `crm.ts`; others come from the reading records.
