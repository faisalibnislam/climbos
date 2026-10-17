---
name: cold-outreach
description: Write cold B2B email sequences for a small business that a top SDR would send under their own name - one sourced, specific observation per prospect, a single concrete offer with proof, an interest-based CTA, 50-90 word plain-text first emails, follow-ups that add something new, an honest close-out, safe personalisation fallbacks and a compliant footer (CAN-SPAM, UK/EU GDPR, PECR, CASL, Spam Act). Use when drafting or revising outreach templates, per-prospect messages, subject lines, follow-up steps or small-volume A/B variants.
---

## Purpose

You write cold emails that a busy owner reads in ten seconds on a phone and thinks: "this person actually looked at my business, and the offer is relevant." Great cold email is short, plain, specific and honest. It opens with one observation the sender can prove with a stored public source, links it to a problem the prospect plausibly has now, offers one concrete outcome backed by real proof, and asks one easy question. Most replies come from the first email (58% in one large vendor dataset), so step 1 carries the weight; follow-ups each add something new and then stop politely. Every message must survive two readers: the prospect, who must never feel tricked, and the spam filter, which punishes links, images, tracking, sameness and volume. Nothing you write may state a fact about the prospect or the sender that is not in the confirmed facts or the prospect's stored sources.

## Inputs you will get

- **Sender facts**: what they sell, the outcome, proof (numbers, named customers they may mention, guarantees, mechanism), the sending person's real name and role, company name, postal address, privacy notice URL, brand voice.
- **Positioning**: best-fit customer, alternatives, value themes, objections.
- **Prospect record** from prospecting: company, domain, country, legal form, contact name and title (or a role address flag), how the email was obtained, evidence with source URLs and dates, a dated trigger, an opener candidate, fit and timing scores, site language.
- **Campaign settings**: goal, number of steps, any test you are asked to run.

When something is missing:
- No proof for the offer: use the mechanism (how it works) instead of a result, and add `[NEEDS FACT: a result for a similar customer the sender may cite]`. Never invent a number, client or testimonial.
- No postal address or sender name: put `[NEEDS FACT: postal address]` or `[NEEDS FACT: sender name and role]` in the footer. The message cannot ship until it is filled.
- No sourced observation for a prospect: do not invent one. Write the firmographic version (industry and place, both sourced), label it "weak personalisation", and recommend more research or dropping the prospect.
- Prospect fails a jurisdiction rule (Germany, Austria, UK sole trader, Canada or Australia with an inferred address): stop and say the prospect is blocked. Do not draft.

## Procedure

1. **Pre-flight the prospect.** Confirm the country rule passes, the contact is not suppressed, and you know whether the address is a person or a role account. Role account: never greet by first name.

2. **Pick the one observation (research to relevance).** From the stored evidence, choose the single most specific fact that connects to a problem the sender solves. Prefer, in order: a dated trigger (new location, hiring, new service, review trend, site change), then a specific website or listing observation, then industry plus place. Test it: Can you point to the source URL? Would the owner nod and say "yes, that's us"? Is it about the business, not the person's private life? Is it neutral, not flattery? Use one observation only.

3. **Build the bridge.** Write the logic in one line before drafting: observation → likely consequence for them → the outcome the sender delivers. Example: "Bookings are phone-only (source) → evening enquiries go to voicemail → the sender's online booking captures them." If the consequence is a guess, phrase it as a question or "often", never as a claim about their numbers.

4. **Choose the offer and proof.** One outcome, stated concretely, with the strongest proof you are allowed: a verifiable number with its source, a named similar customer (only with permission in the facts), a mechanism, a guarantee. One proof point per email. If you only have a mechanism, explain how in one sentence.

5. **Choose the CTA rung.** Use exactly one CTA per email, phrased as a question the prospect can answer in one word.
   - **Rung 1, interest (step 1 default):** "Worth sending the two-line version?" / "Open to seeing how?" / "Should I send the example?"
   - **Rung 2, resource (steps 2-3):** offer something specific and free, without a link: "I wrote up the 3 changes I'd make to your booking page. Want them?"
   - **Rung 3, meeting:** only after the prospect replies with interest (that is reply handling), or if the brief says the prospect asked. No calendar links and no meeting demands in cold steps.

6. **Write the subject line.** 2-5 words, sentence or lower case, specific and boring: "booking page question", "new surgeries in Stockport", "{company} evening enquiries". No "Re:" or "Fwd:" on a first touch, no emojis, no ALL CAPS, no "$", "free" or "!" and no clickbait. Give 2 options.

7. **Write step 1.** Body of 50-90 words, never more than 125 counting greeting and sign-off name (the footer does not count). Shape:
   - Greeting: "Hi {first_name}," for a named person; "Hello," for a role account.
   - Line 1: the observation, stated plainly. Not "I hope this finds you well", not "I came across your website".
   - Line 2: why it matters to them (the bridge).
   - Line 3: the offer and one proof point.
   - Line 4: the CTA question.
   - Sign-off: the real sender's first name, then full name, role and company.
   Plain text only. No links, no images, no attachments, no bold, no bullet lists, no tracking. 3-5 short paragraphs. Match the prospect's language and spelling (UK spelling for UK prospects). Write like a peer who runs a business, at plain reading level.

8. **Write the follow-ups.** Default 4 steps on business days 0, 3, 7 and 14; an optional step 5 at day 30 only when there is real new news. Follow-ups are 25-60 words, sit in the same thread (the "Re:" there is genuine because it replies to your own email), and each must make sense if it is the only one read.
   - **Step 2 (day 3):** a new angle or a different proof point. Never "bumping this" or "just following up".
   - **Step 3 (day 7):** a useful resource tied to their situation, offered without a link: "Want it?" One plain link to the sender's own domain is allowed from step 2 on, but only if it helps.
   - **Step 4 (day 14), close-out:** brief, warm, no guilt and no false finality tricks. "I'll leave it here. If evening bookings become a headache, reply and I'll send the example."
   The system stops the sequence on any reply, bounce or opt-out; never write a step that assumes they did not reply because they were busy.

9. **Define personalisation variables and safe fallbacks.** For every variable you use, state its source and a fallback that is grammatical and true:
   - `first_name`: only for personal addresses, taken from a public source; fallback "Hello,".
   - `company`: short trading name without "Ltd", "LLC" or ALL CAPS; fallback a plain noun ("your clinic").
   - `observation`: no text fallback. If it is missing, the prospect goes back to research or gets the labelled firmographic line.
   - `city` and `trigger`: only from stored sources; otherwise drop the clause and re-read the sentence.
   No message may ship with a visible merge field, an empty clause or "Hi Info".

10. **Write the footer.** It contains: the sender's real name, role and company; the company's postal address; one plain-text opt-out line ("Not relevant? Reply 'no' and I won't email again."). For UK and EU contacts add the Article 14 line: where the work email was found, a pointer to the privacy notice, and how to object. For Canada add a contact method (phone, email or web) next to the mailing address. The system adds the one-click unsubscribe header; the body line is still required. See the footer reference.

11. **Vary structure.** When writing a template used across mailboxes, give 2-3 structural variants (different opening order, a different proof point, a different CTA wording), not just swapped merge fields. Identical bodies across a domain are a filtering signal.

12. **Plan small-volume tests honestly.** At 30 sends a day per mailbox and a 3-5% reply rate, 100 contacts yield about 3-5 replies, so most differences are noise.
   - Test one big swing at a time: angle, offer or CTA rung. Never test word tweaks.
   - Measure replies and positive replies. Never opens: they are unreliable and tracking is off.
   - Pre-register in one line: hypothesis, metric, minimum contacts per variant, decision rule. Call results "directional".
   - Weigh reply content (what objections recur) as evidence alongside the counts.

13. **Hand off replies.** Any reply stops the sequence. Opt-outs and hostile replies are suppressed immediately. Replies are drafted with the reply-handling skill and sent only after owner approval. A customer's first campaign also needs the owner to approve the template and 10 sample messages.

14. **Self-score** against the quality rubric below and revise until it passes.

## Quality bar

Score each dimension 1-5. A message ships only if it averages 4 or more with no dimension below 3, and Accuracy and Compliance must both be 5.

| Dimension | 1 | 3 | 5 |
|---|---|---|---|
| Accuracy | Contains an unverifiable or false claim about the prospect (hallucinated fact, wrong name or company) | All claims plausible but one not traceable to a stored source | Every prospect-specific claim maps to a stored source URL; names and titles verified |
| Relevance | Generic pitch that could go to anyone | Industry-relevant but not specific to this company | Ties a specific observation to a problem this company plausibly has right now |
| Clarity of value | Feature list or jargon; the reader can't say what's offered | Value stated but vague ("grow your business") | One concrete outcome with a number or comparable proof |
| Brevity | Over 150 words or walls of text | 90-130 words | 90 words or fewer (step 1), 60 or fewer (follow-ups), scannable on a phone |
| CTA | Several asks, or a hard meeting demand with a link | Single ask but high-friction | Single, low-friction, interest-based question |
| Tone and honesty | Manipulative (fake urgency, fake "Re:", flattery, pretending to know them) | Neutral but with salesy clichés | Peer to peer, plain, respectful; nothing a recipient would feel tricked by |
| Compliance | Missing opt-out or identity, or a blocked jurisdiction | Opt-out present but footer or notice incomplete | Sender identity, postal address, opt-out, Article 14 line where required, jurisdiction rules passed |

Also expected of expert work:
- The observation would be recognised by the owner and could not be sent to their neighbour unchanged.
- Each follow-up adds a new reason to reply; the sequence reads as a short, polite conversation, not a drip.
- Personalisation degrades safely: every fallback reads naturally.

## Never do

These are the failure modes to test for:
- **Hallucinated personalisation** ("congrats on the Series A" to a bakery). The biggest AI-specific risk. Every personal line needs a stored source.
- Wrong name, merge-field leaks (`{{first_name}}`), "Hi Info", a first name on a role address.
- Over-long emails, more than one CTA, links or images in step 1, attachments, HTML formatting, tracking pixels.
- Deceptive subjects ("Re: our call", "Fwd:" on a first touch), false scarcity or deadlines, implying a prior relationship or a referral that did not happen, fake familiarity ("as we discussed").
- Identical templates across many mailboxes; vary structure, not just merge fields.
- Spam-trap-like targeting: role accounts beyond the rules, stale unverified addresses, competitors or existing customers.
- Language or locale mismatch (English to a French-only business, US spelling to UK prospects).
- AI tells: "I hope this email finds you well", "game-changer", "unlock", "leverage", heavy em-dash and rule-of-three cadence. See the spam and AI-tell reference.
- Follow-ups that only say "bumping this" or "circling back", or guilt-trip ("I guess you're not interested").
- Flattery ("Loved your recent post!"), personal-life references, or anything gathered from LinkedIn scraping.
- Invented proof: numbers, customer names, reviews, awards or "studies show" not in the confirmed facts.
- A fabricated sender persona. The signature is a real person who works for or represents the business.

## Checklist before answering

- [ ] The prospect passed jurisdiction and suppression checks, or you stopped and said why.
- [ ] Exactly one observation per prospect, traceable to a stored source URL, about the business, not flattery.
- [ ] Step 1 body is 50-90 words (125 maximum), plain text, with no links, images or attachments.
- [ ] Follow-ups are 25-60 words, each adds something new, and step 4 is a polite close-out.
- [ ] One interest-based CTA per email; no meeting demand or calendar link in cold steps.
- [ ] Subjects are 2-5 words, honest, with no "Re:"/"Fwd:" on the first touch, no emojis, caps or "$".
- [ ] Every variable has a stated source and a true, grammatical fallback; no merge field can leak.
- [ ] Footer has the real sender name, role, company, postal address and an opt-out line; Article 14 line for UK/EU; contact method for Canada.
- [ ] No invented prospect or sender facts; gaps are marked `[NEEDS FACT: …]`.
- [ ] No banned phrases or AI tells; spelling and language match the prospect.
- [ ] Any test is one big swing, measured on replies, pre-registered and labelled directional.
- [ ] Self-scored against the quality rubric: average 4 or more, nothing below 3, Accuracy and Compliance at 5.
