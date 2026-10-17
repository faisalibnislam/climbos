---
name: reply-handling
description: Classify replies to outreach and sales emails (positive, question, objection, not now, not interested, wrong person or referral, unsubscribe, out-of-office or auto-reply, angry or complaint, data request) and draft the right response or no response, with the required actions - stop the sequence, honour opt-outs immediately, reschedule after out-of-office, log referrals for compliance checks - never arguing, always suggesting a sensible next step, and always holding drafts for owner approval. Use whenever a prospect or lead replies to a cold sequence or follow-up.
---

## Purpose

A reply is the moment outreach either becomes a conversation or becomes a complaint. You read each reply the way an experienced, courteous salesperson would: work out exactly what the person wants, do that first, and make the next step easy, or get out of their way gracefully. Great reply handling is fast on positive replies, precise on questions, calm on objections, instant and final on opt-outs, and never defensive. Labels must be accurate, because they drive suppression, rescheduling and the campaign's negative-reply circuit breaker; softening a complaint into "not interested" hides a problem the owner must see. Every draft waits for the owner's approval before it is sent, and every fact in it comes from the confirmed facts or the conversation.

## Inputs you will get

- **The reply**: body, subject, sender address, headers that signal automation (for example `Auto-Submitted`, `Precedence`, out-of-office subjects), language, and when it arrived.
- **The thread**: every message the sender sent, including the CTA the prospect is answering and the footer wording (for example "Reply 'no' and I won't email again").
- **The prospect record**: name, title, company, country, how the email was obtained and its source URL, campaign and step.
- **Sender facts**: offer, prices, proof, availability, the owner's meeting options or booking link, privacy notice URL, postal address.

When something is missing:
- The prospect asks something the facts do not cover (price, integration, availability): answer what you can and write `[NEEDS FACT: …]` for the rest. Never guess.
- No meeting times or booking link in the facts: write `[NEEDS FACT: two meeting slots or booking link]`.
- The reply is ambiguous: choose the more cautious label and say why in the owner note.

## Procedure

1. **Check for automation first.** Automatic headers, "Automatic reply", "Out of office", "Abwesenheitsnotiz", "Réponse automatique", "Fuera de la oficina", "I am currently out", "will be back on", or a ticket-system acknowledgement mean a machine replied. Never draft a reply to an auto-reply.
   - **Out of office:** extract the return date and recommend moving the next step to the return date plus 1 business day. No return date: recommend 5 business days later.
   - **"No longer with the company":** mark the address invalid. If the message names a replacement, log it as a referral candidate (step 6). Do not email the replacement automatically.
   - **Ticket system acknowledgement:** stop the sequence to that address.

2. **Check for opt-out and hostility next. These outrank everything.** Any of these makes the reply an **unsubscribe**, even if it also contains a question: "no" or "stop" in answer to the opt-out line, "remove me", "unsubscribe", "don't email me", "take me off your list", "not interested, stop". Threats to report spam, abuse, legal threats or anger make it **angry/complaint**. Both are written to suppression immediately by the system, before review; your job is to confirm the label and draft the response (usually none).

3. **Check for a data-protection request.** "Where did you get my email?", "What data do you hold on me?", "Delete my data" are legal requests. Draft a truthful answer that names the stored source (for example "your website's contact page, collected on 12 October"), confirms deletion or suppression if asked, and points to the privacy notice. Flag it to the owner as a legal request with a deadline.

4. **Otherwise, classify the human reply** into exactly one primary label, plus any secondary signals:
   - **Positive / interested**: says yes to the CTA, asks for the summary or example, or asks to talk.
   - **Question**: wants information before deciding (price, how it works, who else uses it).
   - **Objection**: pushback but still engaged ("we already have someone", "too expensive", "tried this before").
   - **Not now**: interested in principle, wrong time, with or without a date.
   - **Not interested**: a polite no without asking to stop all contact.
   - **Wrong person / referral**: not their area, or names someone else.
   - **Other / unclear**: anything else; route to the owner with your best reading.

5. **Decide the next step and draft accordingly.** Answer in the same thread, in the prospect's language and spelling, plain text, usually 25-100 words. Lead with what they asked for. One next step per reply. A link is now allowed (a booking link or the resource they asked for), but only one.
   - **Positive:** deliver what the CTA promised first (the two-line summary, the example), then propose the next step: two specific time options in their time zone, or the booking link, with what the call covers and how long it takes. Flag as urgent for the owner.
   - **Question:** answer directly in the first sentence, from the facts. Add one line of proof if it helps. End with a light next step ("Happy to show you on a 15-minute call if useful").
   - **Objection:** acknowledge it in their words, answer once with one proof item or a clarifying question, offer a smaller step. Never argue, never repeat the pitch. If they push back again, close graciously.
   - **Not now:** thank them, confirm the timing they gave, and ask permission to check back then ("Shall I drop you a line in January?"). If they already named a date ("try me in January"), that is permission for one check-in at that date. Without permission, no further contact.
   - **Not interested:** a one-line, gracious close is optional ("Understood, thanks for letting me know. I won't follow up."). Recommend no further outreach from this sender. If the wording leans towards "stop contacting me", label it unsubscribe instead.
   - **Wrong person / referral:** thank them. If they named someone, ask nothing more of them. Log the named person as a new lead that must pass the prospecting compliance checks (jurisdiction, legal form, source) before any contact. A first email to the referred person may mention the referrer only if the referrer actually suggested the contact; it is a new first touch with a full footer.
   - **Unsubscribe:** default to no reply. If the person asked for confirmation, draft one line: "Done, you won't hear from me again." No selling, no "sorry to see you go" pitch.
   - **Angry / complaint:** default to a short, sincere reply the owner can choose to send: a brief apology, confirmation they are removed, and, if they asked, where their address came from. No justification, no debate, no legal argument. Flag to the owner; repeated complaints should trigger a campaign review.

6. **List the actions the system must take.** For every reply, state: sequence stopped (always for a human reply); suppression written (unsubscribe, complaint); reschedule date (out of office, agreed not-now check-in); address marked invalid (left the company); new referral lead to be checked; owner alert (positive, complaint, data request).

7. **Write the owner note.** One or two lines: what the person wants, your label and confidence, any risk (legal request, anger, a question you could not answer), and the `[NEEDS FACT]` items. Every draft is held for owner approval; nothing is sent automatically.

## Quality bar

- The label is right, and the most protective label wins when a reply mixes signals (opt-out beats question; complaint beats not interested).
- Opt-outs are treated as final from the first signal, including a bare "no" in answer to the opt-out line.
- The draft does exactly what the person asked first, then offers one next step; a positive reply gets the promised item and two concrete options or a link.
- Answers to questions use only confirmed facts; unknowns are marked, never smoothed over.
- Objections get one calm, evidenced response and no second push.
- Auto-replies never receive a reply; out-of-office replies produce a correct reschedule date.
- Referrals are logged for compliance checks rather than emailed on the spot.
- Tone is human, brief and gracious, especially on a no.

## Never do

- Never reply to an auto-reply, or let a sequence continue after a human reply.
- Never treat an opt-out as anything else, keep selling after one, or ask "are you sure?".
- Never argue, defend the outreach, lecture on legality or blame the prospect.
- Never downgrade a complaint or threat to "not interested"; it feeds the negative-reply circuit breaker.
- Never invent prices, features, availability, customers or meeting times.
- Never email a referred or replacement contact without compliance checks and owner approval, and never claim a referral that did not happen.
- Never hide or invent the source of someone's data when they ask.
- Never send anything without owner approval.
- Never use pressure, false urgency or guilt in a reply.

## Checklist before answering

- [ ] Automation checked first; no draft for auto-replies; out-of-office return date and reschedule given.
- [ ] Opt-out and complaint signals checked before anything else and labelled accordingly.
- [ ] Exactly one primary label, with confidence and any secondary signals.
- [ ] Required system actions listed (stop, suppress, reschedule, invalid, referral, alert).
- [ ] The draft gives the person what they asked for first, in their language, in 25-100 words.
- [ ] One next step only; meeting proposals have two concrete options or one booking link.
- [ ] Every fact in the draft is in the confirmed facts or the thread; gaps are `[NEEDS FACT: …]`.
- [ ] No arguing, pressure or second push after a no.
- [ ] Data requests answered truthfully with the stored source and flagged to the owner.
- [ ] Draft and owner note are marked for owner approval before sending.
