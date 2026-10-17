---
name: google-ads
description: Builds Google Search campaigns for small businesses. Covers responsive search ad asset sets (15 headlines of 30 characters or fewer, 4 descriptions of 90 or fewer), keyword themes per ad group, negative keywords, assets (sitelinks, callouts, structured snippets, call, location, price), landing-page match, AI Max and Performance Max guardrails, local-service notes and a budget sanity check. Use for any Google Ads Search, Performance Max text or local search campaign draft. Output is always a paused draft that the owner approves before anything spends.
---

## Purpose

A great Google Ads draft is one a senior PPC lead would launch without rewriting. Each ad group is built around one searcher intent. The searcher's words appear in the headlines and again in the landing-page H1. Fifteen headlines each give a different reason to click. Negatives stop obvious waste on day one, every relevant asset is filled, and Google's automation gets guardrails as well as copy. The budget buys enough clicks to learn something. All of it stays paused until the owner approves, never exceeds the stated budget, and promises no results.

## Inputs you will get

- **Confirmed facts**: services or products, prices, offer, service area, opening and phone-answering hours, proof (review count and rating, years trading, licences, guarantees). Only these may appear in ads.
- **Positioning and VOC bank**: the angle, the best-fit buyer, objections, and customers' own words.
- **Goal and conversion action**: calls, form leads, bookings or purchases, and whether tracking exists.
- **Budget**: monthly spend cap. Treat it as a ceiling, not a target.
- **Landing page(s)**: URL, H1, offer, price as shown.
- **Research notes**: SERP and competitor ads (Ads Transparency Center), estimated CPCs if researched, search-term ideas.

When something is missing:
- No proof → write headlines without it and leave the slot as `[NEEDS FACT: Google review count and rating]`.
- No budget → structure the account but leave the budget as `[NEEDS FACT: monthly ad budget]`. Never pick one.
- No CPC data → label any click estimate "assumption, to validate in week 1". Never present a guessed CPC as fact.
- No matching landing page → say so, name the page the ad group needs, and hand off to the landing-pages skill.

## Procedure

1. **Pin down the conversion.** Name exactly what counts (call over 60 seconds, form submit, booked job, purchase). Automation optimises toward whatever signal you feed it, so recommend enhanced conversions or offline import of booked jobs where the stack allows. If no conversion tracking is confirmed, recommend Maximize clicks with a max CPC limit until conversions record reliably, then Maximize conversions.

2. **Run the budget sanity check.**
   - Daily budget = monthly cap ÷ 30.4. Google can spend up to 2× the daily budget on a single day but bills no more than 30.4× the daily budget in a month. Tell the owner this.
   - Expected clicks per day = daily budget ÷ estimated CPC.
   - If that is fewer than about 10 clicks a day, run one campaign with 1–2 ad groups, phrase and exact match only, tight geography and schedule. Never split a small budget across several campaigns.
   - The sum of all daily budgets × 30.4 must be at or under the monthly cap.

3. **Choose keyword themes.** One ad group per intent theme (service × intent), 5–20 tightly related keywords each. Prioritise high intent: service + location, "near me", urgent/emergency, price/cost, and specific product or model names. Use phrase and exact match by default. Broad match and AI Max keywordless matching only make sense with smart bidding and reliable conversion data. Competitor names may be bid on as keywords, but never put a competitor's trademark in ad text.

4. **Build negatives before launch.**
   - A shared campaign list: jobs, careers, salary, apprenticeship, course, training, free, DIY, "how to" (for services), used, second-hand, wholesale, plus wrong locations and services you don't offer.
   - Cross-negatives between ad groups so each query lands in the group whose ad matches it.
   - Negative keywords do not match close variants, so add plurals and common misspellings yourself.

5. **Write 15 headlines per ad group** (30 characters max, spaces included; double-width CJK characters count as 2). Fill these slots:

   | Slot | Count | Example job |
   |---|---|---|
   | Keyword match | 3–4 | The query in natural forms, plus location |
   | Benefit or outcome | 3 | What changes for the searcher |
   | Proof | 2 | Rating, review count, years, licence |
   | Offer or price | 2 | Price from, fixed fee, free quote |
   | Objection handler | 2 | Timing, minimums, area, guarantees |
   | CTA with outcome | 2 | "Book a Same-Day Visit" |

   Every headline must stand alone and read naturally next to any other two. No two headlines may share the same opening words or angle. Keep a few short (under 20 characters) so combinations fit. Use one capitalisation style throughout.

6. **Write 4 descriptions** (90 characters max). Each is a complete thought that works with any headline: one carries proof, one the offer and price, one the main objection, one the CTA. Use 70–90 characters; empty space is wasted reach.

7. **Pin almost nothing.** Default: no pins. Pin only text that must legally show (a disclaimer, a licence number). If you pin, pin 2–3 interchangeable options to that position. Pinning reduces combinations and Ad Strength. When AI Max Final URL expansion picks a different URL, pins are ignored, so required text must also live on every eligible page or that URL must be excluded.

8. **Set display paths**: 2 × 15 characters, keyword then location or offer (/boiler-repair/leeds).

9. **Fill the assets** (see the limits table). At least 4 sitelinks to distinct real pages, at least 4 callouts, 1 structured snippet, a call asset scheduled to the hours phones are answered, a location asset via the linked Business Profile for local firms, price assets only with confirmed prices, promotion assets only for real promotions with real dates.

10. **Write the automation guardrails** (AI Max for Search and Performance Max):
    - Text customization: recommend on only if the website copy is accurate and current. Recommend off for regulated or claim-sensitive businesses (legal, health, finance) and when site prices are out of date.
    - Final URL expansion: list URL exclusions (blog, careers, login, privacy, expired offers, pages for services not in this campaign).
    - Brand inclusions or exclusions, locations of interest, and text guidelines where the campaign type offers them: term exclusions (e.g. "cheap", "guaranteed", competitor names) and plain-language messaging restrictions ("Do not mention same-day service at weekends").
    - Ad Strength is a writing guide, not a ranking input. Don't trade accuracy for "Excellent".

11. **Performance Max (only if asked or ecommerce with a product feed).** Small budgets should prove Search first. Supply 3–15 headlines (30), 1–5 long headlines (90), 2–5 descriptions (90, one of them 60 or fewer), the exact business name (25), real landscape, square and portrait images, and at least one owner-shot vertical video, or Google will auto-build weak video from images. One asset group per theme. Add brand exclusions if brand Search runs separately.

12. **Local service notes.**
    - Location targeting: "Presence: people in or regularly in" your areas, not "interested in". Radius or postcodes must equal the real service area.
    - Ad schedule matches the hours calls are answered. Count calls as conversions above a minimum duration.
    - Put the town in 1–2 headlines and the display path.
    - Local Services Ads are built from the profile, verification and reviews, not ad copy. Your job there is the service list, profile text and a review-request plan. LSA is migrating into Google Ads as pay-per-lead Performance Max campaigns from August 2026 through 2027, with manual bidding and per-category target CPA going away. Flag this to owners who rely on LSA.
    - Some categories need Google certification or advertiser verification before ads serve (financial services in many countries, healthcare, legal, and several US home services such as locksmiths). Flag it; don't assume it's done.

13. **Check landing-page continuity.** The ad group's keyword theme and the ad's main promise appear in the page H1. Price, offer and terms are identical in ad and page. Anything an ad promises must be visible on the page.

14. **Write the launch note.** Everything is created paused. List what the owner must approve: budget, bid strategy, conversion action, text-customization setting, URL exclusions. Add a 30-day plan: review search terms twice a week for the first two weeks, then weekly, adding negatives each time; judge ad groups by cost per conversion or per booked job, not CTR; pre-register the kill/scale rule ("if cost per booked job is under £X after 3 weeks, raise budget 20%; if over £Y, pause the ad group"), with £X and £Y set from the owner's job margin, not invented. Up to 3 RSAs per ad group are allowed; at small budgets run 1–2, and a second RSA must test a different angle, not reworded headlines.

### Limits

| Field | Limit | Notes |
|---|---|---|
| RSA headline | 30 chars, 3–15 | Write 15 |
| RSA description | 90 chars, 2–4 | Write 4 |
| Display path | 15 chars × 2 | Keyword + location/offer |
| Sitelink text | 25 chars | Description lines 35 chars × 2 |
| Callout | 25 chars | 4+ |
| Structured snippet value | 25 chars | Fixed header list, 3+ values |
| Price asset header / description | 25 / 25 chars | Confirmed prices only |
| Business name | 25 chars | Exact name |
| PMax long headline | 90 chars, 1–5 | |
| PMax description | 90 chars, 2–5 | One must be ≤ 60 |

### Editorial policy (Google rejects or limits these)

- No exclamation mark in headlines; at most one in the whole description set, and only if it reads naturally.
- No emoji, no ALL-CAPS words (acronyms like "VAT" are fine), no repeated punctuation, no gimmicky spacing ("F-R-E-E").
- No phone numbers in headlines or descriptions; use the call asset.
- No "click here".
- No "best", "#1", "cheapest" or "leading" unless a third-party source is confirmed and shown on the landing page.
- No competitor trademarks in ad text.

## Quality bar

- Every ad group's keyword theme appears in 3–4 headlines in varied natural forms and in the page H1.
- All 15 headlines pass the "different reason" test: label each with its slot and no slot label repeats beyond the table counts.
- Any 3 headlines + 2 descriptions read as a coherent, grammatical ad.
- Every number in the ads traces to a confirmed fact.
- Headlines use real specifics (price, area, time, rating) rather than adjectives; a competitor could not run them unchanged.
- Negatives exist at launch and cover jobs, DIY, free, wrong places and wrong services for this business.
- Assets are complete: sitelinks point to real, distinct pages; callouts don't repeat headlines.
- The automation settings are stated with a reason, including URL exclusions.
- The budget math is shown and the structure fits it.

## Never do

- Never set anything live, raise a budget, or exceed the stated monthly cap.
- Never promise results ("Get 20 Leads a Week", "Rank #1", "Guaranteed ROI") or imply guarantees the business doesn't offer.
- Never invent ratings, review counts, years, prices, CPCs or search volumes.
- Never write near-duplicate headlines ("Boiler Repair Leeds" / "Leeds Boiler Repair" / "Boiler Repairs in Leeds" as three of 15).
- Never pin by habit, or pin Headline 1 to the keyword "for relevance".
- Never put one RSA in front of several unrelated themes, or send every ad group to the homepage when a matching page exists.
- Never use hype words or AI tells: "Unlock", "Elevate", "Seamless", "Revolutionary", "Solutions", "Look No Further", "Your Trusted Partner".
- Never recommend broad match with no conversion tracking, or Performance Max as the first campaign for a local service with a small budget.

## Checklist before answering

- [ ] Every headline is 30 characters or fewer and every description 90 or fewer, counted exactly.
- [ ] 15 headlines and 4 descriptions per ad group, each tagged with its slot, no near-duplicates.
- [ ] Keyword theme in 3–4 headlines and matching the landing-page H1; offer and price identical to the page.
- [ ] Every number and claim traces to confirmed facts; gaps are `[NEEDS FACT: …]`.
- [ ] No emoji, no "!" in headlines, no caps, no phone numbers, no unsourced superlatives, no competitor trademarks.
- [ ] Pins: none, or only legally required text with 2–3 options.
- [ ] Negative list and cross-negatives included.
- [ ] Sitelinks, callouts, snippet, call/location and display paths filled within limits.
- [ ] AI Max / PMax settings and URL exclusions stated with reasons.
- [ ] Budget math shown; total at or under the cap; campaign marked paused pending owner approval; no promised results.
