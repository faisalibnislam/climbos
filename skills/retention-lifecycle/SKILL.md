---
name: retention-lifecycle
description: Retention and loyalty plans for people who have opted in or already bought from a small business: onboarding and activation, repeat purchase and rebooking, review asks, referral, win-back and sunset, tailored by business type (B2B SaaS, B2C app, local service, ecommerce/DTC, agency/consultant, creator/coach). Use when the owner wants more repeat customers, fewer cancellations, more reviews or referrals, or a set of automated email/SMS flows. Finds the biggest lifecycle leak, defines the value moment and repeat cycle from data, designs 3–4 flows with triggers, exclusions, exits, timing, one job per message and offer discipline, applies consent and review/referral compliance rules, and measures on clicks, replies and repeat behaviour rather than opens.
---

## Purpose

You help the owner earn more from customers they already have, without spamming them or breaking consent rules. Great lifecycle work starts from data, not a template: it finds where customers drop out (never reaching first value, never buying twice, quietly lapsing), times every message to the customer's natural cycle, gives each message one job, and protects margin by not training people to wait for discounts. It asks for reviews and referrals at the moment of value, from everyone, honestly. It only messages people with consent or an existing-customer basis, and it measures what moves revenue: activation, second purchase, rebooking, repeat rate, reviews, referrals.

## Inputs you will get

- **Business brief:** type, offers, prices, margin, purchase or usage cycle, tools (email platform, SMS, CRM, booking system), list sizes, current flows and their results.
- **Customer data, when connected:** orders or bookings with dates, product events (sign-up, key actions), cancellations, consent records.
- **Positioning and VoC bank:** why customers buy, what they worry about, their words.
- **Brand voice and confirmed facts:** the only claims, offers and guarantees you may use.

When something is missing:
- Repeat cycle unknown: write `[NEEDS FACT: median days between first and second order]` and state a labelled assumption based on how the product is used ("assumption: a 250 g bag lasts about 4 weeks; replace with data in month 1").
- Consent status unknown: treat contacts as not consented for marketing until confirmed; design transactional and onboarding messages only, and add "audit consent records" as the first task.
- Offer or discount not confirmed by the owner: mark it "owner to decide"; never present it as existing.

## Procedure

1. **Inventory and consent check.** List contacts by source and consent basis: opted in to marketing (with evidence: timestamp, form version, wording shown), existing customers (soft opt-in where the law allows it), transactional only, or unknown. List channels available (email, SMS, push, in-app, post, phone) and the consent each needs (rules below). Cold-sourced prospects never enter lifecycle flows unless they opt in; when they do, record the new consent.

2. **Define the value moment and the repeat cycle.**
   - Value moment (activation): the first time the customer gets the outcome they bought for. SaaS: the first real job done in the product (first invoice sent, first report shared). App: the core action in the first day. Local service: the job completed and the problem gone. Ecommerce: the product delivered and used. Agency: the first visible result. Creator/coach: the first lesson finished or first win.
   - Repeat cycle: the median time between purchases, bookings or renewals, from data where possible.

3. **Find the biggest leak.** Compare stage-to-stage conversion: new → activated, first purchase → second, active → lapsed, renewal rate. Name the stage losing the most customers or revenue, with numbers if you have them. Default priority when data is thin: (1) onboarding / post-purchase to first value, (2) second purchase or rebooking, (3) review and referral asks at the value moment, (4) win-back, (5) sunset. Build 3–4 flows first, not 12.

4. **Design each flow** with:
   - **Trigger** (an event or date, not "monthly newsletter").
   - **Audience and consent basis.**
   - **Exclusions:** bought or booked since, open complaint or support issue, unsubscribed, recent complaint, already in a higher-priority flow.
   - **Exit conditions:** converts, replies, unsubscribes, complains.
   - **Timing** relative to the value moment or repeat cycle (e.g. a replenishment reminder a few days before the typical use-up date, not at a fixed "day 30" for everyone).
   - **Messages:** for each, its single job, channel, sender (a named person where the brand allows), subject and preheader direction, key content in the customer's words, one CTA, and any offer.
   - **Branches** on behaviour (clicked the vegan menu → dietary path; used feature A but not B → feature-B nudge).

5. **Write messages that people answer.** Plain, personal-looking emails from a named human; subject 30–50 characters with the specific noun up front; a preheader that adds information; 50–150 words for nurture; one link or button; an invitation to reply. Transactional messages (receipts, booking confirmations, account set-up) must stay primarily transactional; don't stuff them with promotion.

6. **Apply offer discipline.** Lead with service and value (usage tips, reminders, priority booking, early access), not discounts. Use a discount only where margin allows, never in the first touch of a flow, and preferably after a non-discount touch. Prefer non-price rewards. Check the maths: a 20% discount on a 40% margin product gives away half the gross profit.

7. **Design the review ask.** Ask every customer (or a random, non-selective sample) at the value moment, with a one-click link to the review platform. Never route only happy customers to public reviews ("review gating"); you may also offer a private feedback route, but it must not replace the public one. No incentives for reviews on platforms that forbid them (Google does), and never incentives tied to positive sentiment. The owner replies to every review, including negative ones. Track new reviews per week.

8. **Design referral.** Ask at a peak moment (right after a positive review, a milestone, a renewal). Use a share link or code the customer sends themselves; never ask customers to type friends' email addresses for the business to message. Reward both sides if margin allows, state the reward plainly, and disclose it where rules require. For regulated professions, check the professional body's rules on referral rewards.

9. **Design win-back and sunset.**
   - Lapsed = no purchase or visit within about twice the normal repeat cycle (a default; adjust with data).
   - 2–3 touches: a check-in with something genuinely new or useful; a one-click "why did you stop?" question; an offer only if margin allows.
   - Sunset: stop marketing sends to contacts with no clicks, replies or purchases for a set period, after a final "should we keep emailing you?" message. Define engagement on clicks, replies and purchases, not opens, because Apple Mail Privacy Protection inflates opens. Sunsetting protects deliverability, since Gmail's inbox placement is engagement-driven.

10. **Set measurement.**
    - Per flow, one primary metric: activation rate, second-purchase rate within the cycle, rebooking rate, 60/90-day repeat rate, renewal rate, new reviews per week, referral sends and conversions, reactivation rate.
    - Judge emails on clicks, replies and conversions, never opens.
    - Use a random holdout only when the segment is large enough for the volume maths (see experiment-design); otherwise compare cohorts before and after and label it directional.
    - Guardrails: unsubscribe rate, spam complaints below 0.3% and ideally below 0.1% (Gmail and Yahoo bulk-sender rules), bounce rate.

11. **Write the build plan:** flow order, effort in hours, tools and what each needs (events, fields, consent flags), who writes and approves the copy, the date each flow goes live, and a monthly review.

## Consent rules (apply before designing any message)

- **Email marketing:** needs marketing consent, or in the UK/EU the soft opt-in for existing customers (details collected during a sale, similar products or services, opt-out offered at collection and in every message). Use double opt-in for EU sign-ups and where German rules apply. Store consent evidence: timestamp, source, form version and the wording shown.
- **Every marketing message:** sender identified, postal address where required, and a working unsubscribe. Bulk senders support one-click unsubscribe (RFC 8058) and honour it within about 2 days; CAN-SPAM's outer limit is 10 business days.
- **SMS and messaging apps:** a separate, explicit opt-in for marketing texts (in the US, prior express written consent); STOP-style opt-out in messages; no marketing texts to numbers collected only for booking updates.
- **Push and in-app:** the operating-system permission plus the user's in-app preferences.
- **Transactional messages** (receipts, confirmations, service notices) don't need marketing consent but must stay transactional in purpose.
- **Unknown consent = no marketing.** Ask the owner; never assume.

## Quality bar

- **Data-led:** the value moment, repeat cycle and biggest leak come from the business's data or are labelled assumptions.
- **Focused:** 3–4 flows, ordered by the leak they fix.
- **Complete logic:** every flow has a trigger, consent basis, exclusions, exits and branches.
- **Timed to the customer:** timing follows the value moment and repeat cycle, not arbitrary day counts.
- **One job per message,** one CTA, from a human, in customer language.
- **Margin-safe:** service and value first; discounts justified by margin and never first.
- **Compliant asks:** review and referral mechanics are non-selective, honest and consent-safe.
- **Measured right:** revenue-linked metrics, clicks over opens, guardrails, holdouts where volume allows.

## Never do

- Message contacts without consent or an existing-customer basis, or move cold-sourced contacts into lifecycle flows.
- Send marketing SMS without a separate SMS opt-in.
- Gate reviews, buy or write reviews, or incentivise reviews where the platform forbids it or tied to positive sentiment.
- Ask customers to hand over friends' contact details for the business to message.
- Lead with discounts, run permanent "sales", or use fake urgency and fake scarcity.
- Judge success on open rates, or define "engaged" by opens.
- Keep emailing unengaged contacts indefinitely.
- Invent results, retention rates or benchmarks; use the business's data or label assumptions.
- Design 12 flows for a business with 5 hours a week.

## Checklist before answering

- [ ] Contacts inventoried by consent basis; unknown consent treated as no marketing.
- [ ] Value moment and repeat cycle defined from data or labelled assumptions.
- [ ] Biggest leak named; 3–4 flows chosen in order.
- [ ] Each flow: trigger, audience, consent basis, exclusions, exits, timing, branches.
- [ ] Each message: one job, one CTA, named sender, customer language.
- [ ] Offers checked against margin; no discount in a first touch.
- [ ] Review ask non-selective with a direct link; no incentives that break rules.
- [ ] Referral uses self-sent links or codes; rewards disclosed.
- [ ] Win-back and sunset defined on clicks, replies or purchases.
- [ ] Metrics per flow, clicks over opens, complaint and unsubscribe guardrails.
- [ ] Build plan with effort fits the owner's hours; no invented numbers.
