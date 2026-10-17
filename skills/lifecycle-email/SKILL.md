---
name: lifecycle-email
description: Writes lifecycle email sequences for opted-in contacts of small businesses. Covers welcome and lead nurture, trial and app onboarding, post-purchase, win-back and re-engagement, and sunset or breakup emails. Each email has one idea and one CTA, a subject and preheader, a named sender and a plain-text-leaning body. Includes triggers, cadence, branches and exits, consent checks, deliverability basics (SPF, DKIM, DMARC, one-click unsubscribe, complaint limits) and metrics based on clicks, replies and conversions rather than opens. Use for any automated email flow or nurture sequence. Not for cold outreach.
---

## Purpose

Great lifecycle email reads like a short note from a real person at the business, arriving at the moment it is useful. Each email in a sequence has one distinct job matched to where the reader is: deliver what they asked for, get them to first value, answer the objection that stalls them, show proof, make the offer, or ask whether to stop. Sends are triggered by behaviour, contacts leave as soon as they convert, the mail authenticates and unsubscribes cleanly, and success is measured in clicks, replies and conversions. It only ever goes to people who opted in or with whom the business has a lawful relationship.

## Inputs you will get

- **Trigger and audience**: what puts someone in the flow (signup, magnet download, trial start, first order, no order in N days), the signup source, and the consent recorded.
- **Goal**: the conversion that ends the sequence (first order, activation event, paid upgrade, repeat purchase, reply).
- **Confirmed facts**: offer, prices, onboarding steps, the product's activation milestone, guarantees, proof, real deadlines.
- **Sender**: the named person the mail comes from and a reply-to address someone reads.
- **VOC and objections**: why people stall or don't buy.
- **ESP capabilities**: branching, exit conditions, merge fields and their fallbacks.

When something is missing:
- No consent or lawful basis recorded → don't write the flow for that audience; say what consent is needed.
- No named sender → sign as "The <Business> team". Never invent a person, and never leave a placeholder.
- No customer story → build the proof email on the mechanism, a demo or the guarantee instead. Never leave a placeholder.
- No real deadline → no deadline. Offer emails can stand on value.

## Procedure

1. **Confirm the lane and consent.** Lifecycle email is for opted-in or existing-customer contacts only, never cold or purchased lists.
   - EU and UK: consent, or (UK PECR) the soft opt-in for existing customers about similar products where an opt-out was offered at collection. Use double opt-in for EU signups, especially Germany.
   - US (CAN-SPAM): an opt-out model, but still mail only people who signed up or bought.
   - Canada (CASL): express consent, or implied consent from a purchase, which lasts 2 years.
   - Keep transactional mail (receipts, password resets, delivery notices) free of promotion so it stays transactional.

2. **Pick the sequence type and its jobs.**

   | Type | Trigger | Email jobs in order | Exit |
   |---|---|---|---|
   | Welcome / lead nurture | Signup, magnet, sample request | Deliver + set expectations → first quick win or reaction → main objection → proof → offer → breakup/preference | Purchase or booking |
   | Onboarding (SaaS, app) | Trial or account start | One email per step to the activation event, triggered by what they haven't done → value recap → trial-end notice | Activation, then paid |
   | Post-purchase (ecommerce) | First order | Order expectations → how to use or care → review request after use → replenish or cross-sell timed to use | Repeat order |
   | Win-back (lapsed customer) | No order in a window set from the buying cycle | What's new or changed → reason to return (offer only if real) → preference or stop | Order or opt-down |
   | Re-engagement / sunset | No clicks in a set window | "Still want these?" with one-click keep → final notice → suppress | Click to stay, or suppressed |

   Write the window ("no order in 60 days") from the owner's buying cycle and label it an assumption if it isn't confirmed.

3. **Set cadence from the job, not the calendar.** Default nurture rhythm: immediately, +1 day, +3, +7, +14, +30. Onboarding emails fire on behaviour (e.g. "day 2 and no project created"). If a trial converts to paid automatically, send a notice before the first charge giving the date, amount and how to cancel.

4. **Define branches and exits.** Exit immediately on the goal conversion. Suppress anyone who replies "stop" or unsubscribes. Branch on clicks (a click on the vegan menu moves them to the dietary path). Don't send the same contact two flows at once; set a priority order.

5. **Write each email** using the anatomy below:
   - **Job**: one line saying what this email must achieve and the metric that shows it worked.
   - **Subject**: 2 options, 30–50 characters, the specific noun first, honest. Curiosity is fine; deception is not.
   - **Preheader**: 40–90 characters that add new information, never repeat the subject.
   - **From**: a named person plus the business ("Priya at Loaf & Ladder"), with a reply-to that is read.
   - **First line**: about the reader or their situation. Never "I hope this finds you well".
   - **Body**: 50–150 words for nurture; up to about 200 for instructional onboarding. One idea, short paragraphs.
   - **One CTA**: a single link or button with descriptive text ("Reorder for 14 people", not "Click here").
   - **P.S.**: optional, for a secondary point or a reply prompt ("Reply with any allergies and I'll check").
   - **Personalisation**: only fields the business really has, each with a fallback.

6. **Keep it plain-text-leaning.** Mostly text, at most one image that isn't load-bearing, alt text on images, no image-only emails, 1–3 links in total including the CTA, no URL shorteners. Plain, personal-looking emails from a named human perform best for small senders.

7. **State deliverability requirements** for the owner or ESP setup:
   - SPF and DKIM on the sending domain, aligned with the From domain, plus a DMARC record (p=none to start).
   - Send from the business's own domain through the ESP, never from a free mailbox address such as gmail.com.
   - One-click unsubscribe (List-Unsubscribe and List-Unsubscribe-Post headers, RFC 8058) plus a visible unsubscribe link in the body, honoured within 48 hours (Gmail) and 2 days (Yahoo).
   - Spam complaints kept under 0.1% and never reaching 0.3%.
   - A physical postal address in the footer (CAN-SPAM).
   - Sunset contacts who stop engaging rather than mailing them forever.

8. **Write the measurement plan.** Track per email: click rate, reply count, conversions and revenue per recipient, unsubscribe and complaint rates. Ignore open rate as a success metric, because Apple Mail Privacy Protection inflates it. Automated flows have averaged about 5.6% click rate in Klaviyo data cited secondhand; treat that as directional, not a target to promise. Name the one test worth running (a different email-3 objection, or a different offer), not subject-line tweaks on small lists.

### Limits and targets

| Element | Target |
|---|---|
| Subject | 30–50 chars, key noun first |
| Preheader | 40–90 chars, adds information |
| Body (nurture) | 50–150 words |
| Body (onboarding how-to) | Up to ~200 words |
| Links | One CTA; 1–3 links total |
| Unsubscribe | One-click header + body link; honoured ≤ 48 h |
| Spam complaints | < 0.1%; never 0.3% |

## Quality bar

- Every email has a distinct job matched to the stage; no two emails make the same pitch.
- Exits on conversion and branches on behaviour are specified.
- Each email sounds like a named person wrote it to one reader, and invites a reply where useful.
- One CTA per email, with outcome-specific link text.
- Subjects are specific and honest; preheaders add information.
- Every fact, number, story and deadline traces to confirmed facts.
- Consent basis, authentication, one-click unsubscribe and postal address are covered.
- Success metrics are clicks, replies and conversions, never opens.

## Never do

- Never write sequences for contacts without consent or a lawful basis, or for bought or scraped lists. Cold outreach belongs to a different skill and lane.
- Never use deceptive subjects: fake "Re:" or "Fwd:", fake personal notes, false urgency, invented deadlines.
- Never write "Dear Valued Customer", "I hope this email finds you well", "Just checking in", "Don't miss out!", or hype vocabulary (unlock, elevate, revolutionary, exclusive VIP).
- Never pack several offers or links of equal weight into one email.
- Never send image-only or heavily designed promotional layouts as the default.
- Never invent customer stories, reviews, open or click rates, or results.
- Never hide or delay the unsubscribe, or require login to unsubscribe.
- Never set open-rate targets or judge a sequence on opens.

## Checklist before answering

- [ ] Audience consent or lawful basis stated; no cold or purchased contacts.
- [ ] Sequence map: trigger, timing per email, branches, exit on conversion, priority versus other flows.
- [ ] Each email: one job, 2 subject options (30–50 chars), preheader (40–90 chars, adds info), named sender, one CTA.
- [ ] Bodies 50–150 words (onboarding how-to up to ~200), first line about the reader, plain-text-leaning.
- [ ] Every fact, story and deadline traces to confirmed facts, and the emails are complete as written (no placeholders).
- [ ] No deceptive subjects, fake urgency, banned phrases or emoji clutter.
- [ ] SPF/DKIM/DMARC, one-click unsubscribe + body link, postal address and sunset rule noted.
- [ ] Metrics are clicks, replies, conversions, unsubscribes and complaints, not opens.
- [ ] Trial auto-renew notice included where the trial converts to paid.
