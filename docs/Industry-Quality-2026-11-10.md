# Industry acceptance checks — 10 November 2026

Six explicitly synthetic scenarios exercised the real Anthropic writer/reviewer: education, healthcare, science/technical services, physical retail, ecommerce and a creator business. These records exist only in the isolated local benchmark cache. They were never imported into the real Macloving, Livoform or Folevi workspaces. No customer lists, clinical qualifications, locations, consent, publishing access or measured outcomes were invented as inputs.

The first configuration used the focused Sonnet writer and reviewer with at most one revision. The cheaper starter configuration used the same models, schema, critical gates and score threshold, bounded output, disabled thinking and no automatic revision. Method and reviewer instructions also changed between configurations. This is an end-to-end configuration comparison, not an isolated model test or proof of equivalent quality. The later source/continuity fixes are separately regression-tested and do not retroactively improve these saved outputs.

A separate Sonnet call saw anonymized completed outputs, each scenario and its held-out industry questions. It did not see the writers' critique conversations. Names were shuffled deterministically. Scores and verdicts are AI opinions, not customer validation, legal/clinical review or demonstrated growth. Low scores remain visible.

| Industry | Focused review | Starter review | Independent preference | Actual focused / starter API cost |
|---|---|---|---|---|
| education | gates pass; 3.14/5; below review bar | gates pass; 3.29/5; below review bar | industry-baseline | $0.2556 / $0.1043 |
| healthcare | gates pass; 3.14/5; below review bar | gates pass; 4/5; accepted | industry-starter-v1 | $0.2443 / $0.0860 |
| science and technical B2B | gates pass; 4/5; accepted | gates pass; 3.29/5; below review bar | industry-baseline | $0.2398 / $0.0730 |
| physical retail | gates pass; 3.43/5; below review bar | gate failure; 3.57/5; below review bar | industry-baseline | $0.2414 / $0.0721 |
| ecommerce | gates pass; 3.43/5; below review bar | gates pass; 3/5; below review bar | industry-baseline | $0.2657 / $0.0721 |
| creator business | gates pass; 3.57/5; below review bar | gates pass; 3.43/5; below review bar | industry-baseline | $0.2402 / $0.0717 |

The result does not support calling the cheaper path equally good across industries. Full focused planning remains available. The free path prepares a first reviewed draft within its unchanged credit allowance; critical failures still block approval. Main failure patterns informed the current engine: compare the strongest real alternative without assuming existing contacts; prepare a concrete proposed example; finish anything promised in a pitch; distinguish specific subject fit from access; keep proposed recording cues separate from business results; preserve useful prior work and bounded review feedback on updates.

## education

Both are safe, honest and give usable drafts with no invented facts. B better separates teacher and approver as audiences, addresses payment paperwork and timing, and offers a wider reusable-asset and partnership route; A is tighter and relies on the owner's existing contacts. B edges ahead on the held-out questions.

Test a forwardable sample workshop plus approver summary

The likeliest barrier is school approval of payment, so a teacher-friendly sample and a one-page summary for the approver address the real buying situation using only what we know.

First action: Read the three drafts and change anything that doesn't match your real workshops.

Prepared drafts: Sample workshop outline (proposal for review); One-page summary for the school approver; Forwarding note a teacher can pass on.

Independent observations:

- Does it distinguish teacher/user from school/payer and their purchase timing? industry-starter-v1: 4/5; industry-baseline: 5/5. A names the school approver as a 'second decision-maker' and builds an approver one-pager plus a forwardable note, but has no explicit approver audience entry and little on timing. B lists 'School approvers (head of department or budget holder)' as a separate audience with its own hypothesis, drafts a forwardable approver note, asks what the approver needs 'and by when', and asks for quote/invoice/PO paperwork. It also references the school-term calendar. B treats the payer more fully.
- Does it explore reusable teaching assets, school partnerships and evidence of learning rather than default consumer social ads? industry-starter-v1: 3/5; industry-baseline: 4/5. A centers on a sample lesson outline and approver summary, reusing instructor and materials, and warm teacher intros; it explicitly avoids ads and cold outreach. Evidence of learning is only a caution not to claim outcomes. B reuses lesson materials as a free sample activity, targets teacher communities/subject associations as partnership channels, builds a compounding log and verified partner list, and also avoids ads and multi-network social. Neither develops evidence-of-learning or formal school partnerships deeply, but B's community/association route and reusable assets are broader.
- Does it avoid assumed access to students or permission to collect minors' data? industry-starter-v1: 5/5; industry-baseline: 5/5. Both target only teachers and approvers, send nothing without owner approval, contact only existing relationships (A) or verified communities with checked rules (B), and never involve students or minors' data.

The independent judge reported no critical error in this pair; this is not a guarantee of safety or accuracy.

Remaining improvements:

- Add explicit, safe ways to capture evidence of learning (e.g., teacher-reported classroom use) without involving students' data.
- Explore a school-partnership or department-level offer more concretely.
- Give a clearer timing model for school budget and term cycles.

Generation hashes: 5ab6f9881e603946f53630c0b8bde086dd791226928ce261262127f9d133ed6f; 03f3e70f55463d636320d78b6d84d53df5f25523e6b1c1fef6e4d4624a41b4f0.

## healthcare

Both plans are safe, honest and give the owner usable AI-prepared drafts with zero ad spend and no invented facts. A has a cleaner single-action flow and an explicit capacity fact gap; B adds a 30-second script, explicitly weighs the GP/clinician referral alternative with a reversal rule, and better articulates why it chose its test, giving it a slight edge on referral fit and strategic distinctiveness. Neither fully escapes being a content/checklist play.

Test a return-to-running readiness checklist

It speaks to one real buying moment, a runner unsure whether to restart, costs nothing, and teaches us whether anyone cares before spending time or money.

First action: Read the drafted checklist page, change anything that does not sound like your practice, and approve or reject it.

Prepared drafts: Return-to-running readiness checklist page (proposed draft); 30-second explainer script (proposed, not yet recorded); Note to a local running club or shop (proposed, send only after approval).

Independent observations:

- Does it investigate service geography, clinician trust, referral fit and available appointment capacity? industry-baseline: 4/5; industry-starter-v1: 4/5. A: flags a [NEEDS FACT] on appointment slots, asks owner to confirm service area, requires clinician review of wording, and says partner research is a shortlist only. B: constraints name service area, capacity and clinician approval; assumptions list capacity as unknown; has an explicit notDoing entry weighing GP/clinician referral partnerships and the conditions for reversing that choice, which directly addresses referral fit. A has no explicit referral-fit discussion (only running groups/shops). Both are roughly equal; B edges on referral fit, A edges on the explicit capacity fact-gap.
- Does it avoid invented clinical outcomes, guaranteed recovery, patient stories or permission to contact patients? industry-baseline: 5/5; industry-starter-v1: 5/5. A: 'No outcome claims, testimonials or guarantees', page includes not-a-diagnosis warning, shares only with people already permissioned. B: 'No clinical advice, qualifications, outcomes or availability may be implied', draft is labelled 'proposed', warning signs included, no testimonials. Neither invents outcomes or patient permission.
- Is there a distinct service or referral mechanism, not just a local SEO checklist? industry-baseline: 3/5; industry-starter-v1: 3/5. A: positions a 'return-to-running pathway' (question page, assessment, follow-up) plus a partner shortlist, but the executed move is essentially a content page. B: readiness checklist page plus a 30-second script and partner note, and an explicit decision to defer GP/clinician referral as a stronger alternative; strategicDirection says 'knowledge hub and assessment pathway'. Both lean toward content/SEO; B at least articulates the referral alternative and reversal condition, giving slightly more strategic distinctiveness, but neither delivers a truly distinct mechanism.

The independent judge reported no critical error in this pair; this is not a guarantee of safety or accuracy.

Remaining improvements:

- Include a concrete distinct referral mechanism (e.g., a clinician-to-clinician or GP referral one-pager) as a prepared draft, not just a deferred alternative.
- Add an explicit capacity-confirmation gate before any sharing (A does this better via NEEDS FACT; B should make it a hard prerequisite).
- Offer a differentiating service element (e.g., a named assessment structure or follow-up plan format) that the clinician can confirm, rather than relying on a generic checklist.

Generation hashes: 5ab6f9881e603946f53630c0b8bde086dd791226928ce261262127f9d133ed6f; 03f3e70f55463d636320d78b6d84d53df5f25523e6b1c1fef6e4d4624a41b4f0.

## science and technical B2B

Both plans are honest, synthetic-safe and zero-budget, with usable drafts and no invented claims. A is stronger on the engineer/procurement split, qualification criteria and partner consideration, and offers a lower-friction first action (attach assets to existing inquiries) with explicit decision rules. B is a competent but thinner single-brief approach whose partner channel is only individual contacts.

Test a one-page test request brief for engineers

Owner reports tests need an engineer's spec and purchasing approval, so a brief that serves both removes a likely delay. It needs no budget and no list.

First action: Read the three drafts, delete any test type you do not offer, then approve or edit.

Prepared drafts: Test request brief page copy (proposed); Short note to permissioned contacts (proposed); Feedback call guide (proposed).

Independent observations:

- Does it address technical proof, engineer versus procurement buyer, and qualification? industry-baseline: 5/5; industry-starter-v1: 4/5. A drafts two distinct assets: an engineer brief (part, material, failure to rule out, conditions, pass criteria) and a purchasing approval checklist (written confirmation of tests, samples, deliverables, price exclusions, failure handling), plus a defined 'complete enough to quote' qualification test. B covers both buyers in one brief ('For the engineer... For purchasing...') and has a single audience entry, so procurement is thinner and no separate purchaser asset or qualification criterion exists.
- Does it consider design/manufacturing partners or expert education with a concrete customer mechanism? industry-baseline: 3/5; industry-starter-v1: 2/5. A names contract manufacturers and hardware startup programs as a research-only partner list (up to 5, contact rules checked, no outreach) and offers the brief as the education mechanism attached to inquiry replies. B frames its partnerships channel as warm permissioned intros to individual engineers, not design/manufacturing partners; the mechanism is a one-page brief and feedback calls, with no partner route identified.
- Does it avoid invented certifications, compliance claims and instant ecommerce conversion assumptions? industry-baseline: 5/5; industry-starter-v1: 5/5. Both explicitly exclude certification, turnaround and customer-list claims, label hypotheses as untested, set zero ad spend, and avoid conversion promises. A: 'None have been provided or verified, so none can appear in copy.' B: 'No turnaround or certification claim included; keep it that way.'

The independent judge reported no critical error in this pair; this is not a guarantee of safety or accuracy.

Remaining improvements:

- A: add a concrete partner mechanism beyond research, such as a co-branded spec checklist offered to a verified contract manufacturer, once permission exists.
- B: add a purchasing-specific asset and a clear 'quote-ready' definition, and name design/manufacturing partners as a channel.
- Both: add a fallback inquiry source for when few or no inquiries exist, rather than only widening contacts or carrying forward.

Generation hashes: 5ab6f9881e603946f53630c0b8bde086dd791226928ce261262127f9d133ed6f; 03f3e70f55463d636320d78b6d84d53df5f25523e6b1c1fef6e4d4624a41b4f0.

## physical retail

Both plans are honest, consent-aware, avoid invented facts and conflating online reach with visits. A edges ahead with a lower-burden always-on demo table, a richer tally and decision rules, explicit stop/shrink triggers and a fuller notDoing list. B is clean and has a nice replenishment-reminder idea, but a single scheduled event is a thinner test and its partnership channel is mislabeled.

Hold one small in-store demonstration

It needs no budget, uses a confirmed ability and tests whether nearby buyers will return and accept reminders.

First action: Read the prepared script and sign draft, then choose the product and date.

Prepared drafts: 20-minute demonstration script: Fix one thing in your kitchen; Shop sign and counter invitation; Sign-up sheet wording.

Independent observations:

- Does it connect catchment, purchase occasion, replenishment or local partnerships to the offer? industry-baseline: 3/5; industry-starter-v1: 3/5. A targets 'local people already in or passing the shop' and past buyers, mentions a local partner only after day 90, and ties demos to return visits. B targets 'nearby households' and proposes a kitchen demo that links to a reminder 'before replacement-type purchases' (a replenishment/purchase-occasion idea) in the 90-day horizon. Neither deeply defines the catchment or a real purchase occasion; B's reminder-before-replacement is slightly closer to replenishment, A's repeated tally and demo calendar are slightly more developed.
- Does it check stock and staffing before proposing an event or promotion? industry-baseline: 4/5; industry-starter-v1: 4/5. A lists dependencies 'Staff available on some days', 'Owner picks one product group', states stock/staffing unknown and offers a fallback to 'a few set hours'. B's checksBeforeUse include 'Pick a product that is in stock', 'Confirm who staffs the shop during the session', and a risk mitigation for thin staffing. Both check; both still propose the event as a draft contingent on owner confirmation.
- Does it avoid treating online reach as measured store visits? industry-baseline: 5/5; industry-starter-v1: 5/5. A's invite post is optional and measured by asking each person 'how did you hear about the demo?' on the tally sheet, with paper counts of demos, sales and slips. B uses no online posting at all and measures attendees and sales on a paper sheet. Neither equates reach or impressions with store visits.

The independent judge reported no critical error in this pair; this is not a guarantee of safety or accuracy.

Remaining improvements:

- Define the catchment and a specific purchase or replenishment occasion (e.g. consumables, seasonal swaps) rather than a general demo.
- Add a concrete local partnership test (neighbour cafe, estate agent, community group) with a scoped research step.
- State how repeat purchase will be observed beyond 14 days (e.g. a simple till-based repeat count).
- Include a stock/margin check on the demoed product before committing to the table or night.

Generation hashes: 5ab6f9881e603946f53630c0b8bde086dd791226928ce261262127f9d133ed6f; 03f3e70f55463d636320d78b6d84d53df5f25523e6b1c1fef6e4d4624a41b4f0.

## ecommerce

Both plans are honest, scoped, zero-ad, and avoid invented facts. A is stronger: a more usable drafted guide with a triage section, reader-chosen reminder timing that learns replenishment cadence, and explicit refusal of discounts/bundles pending margin data. B is sound but thinner and more placeholder-driven. Both underdeliver on demonstration content and social formats.

Test one repair guide page with a next-repair reminder

It is free, uses your existing instructions, and tests the repeat-customer idea directly before any spending.

First action: Read the drafted guide page, pick the kit, and fix anything that does not match your product.

Prepared drafts: Repair guide page for one kit (proposal); One-page test brief.

Independent observations:

- Does it consider proof through repair demonstrations, useful instructions and repeat/replenishment needs? industry-baseline: 4/5; industry-starter-v1: 3/5. A builds a full guide wrapper with a 'CHECK FIRST' triage (is the rest of the item working? can you reach the worn part?), embeds the kit's real steps, and offers reader-chosen 3/6/12-month reminders so the repeat cycle is learned rather than guessed; it also frames the list as capturing recurrence timing. B has a thinner draft (generic 'Step 1: Look at the worn part...'), a bracketed placeholder repair time, and a single reminder + tip opt-in. Neither plans an actual demonstration (photo/video) of a repair.
- Does it preserve unknown contribution and returns rather than prescribing discounts or broad ads? industry-baseline: 5/5; industry-starter-v1: 4/5. A states affordable CAC 'Cannot be judged yet', sets $0 ads, and explicitly lists 'Subscriptions, bundles or discounts' and 'Paid ads' in notDoing with margin as the reason. B also says CAC cannot be judged, no ads, and collect profit per order first, but does not explicitly rule out discounts/bundles; its notDoing is mostly about email and social.
- Do social formats demonstrate a real job rather than recite product features? industry-baseline: 2/5; industry-starter-v1: 2/5. Neither plan includes a social channel or social format. A's guide page is job-oriented (steps to fix the item) and A notes a guide gives creators something to show later; B lists 'Broad social posting' as not-doing. Both score low because the question is mostly unaddressed, with A's job-first guide content a marginal edge in spirit.

The independent judge reported no critical error in this pair; this is not a guarantee of safety or accuracy.

Remaining improvements:

- Include an actual demonstration element (photo/short video of the repair) and a short social format showing the real job done, not just a text guide.
- Plan how to get first visitors to the page without ads or unpermissioned contact (e.g., owner-approved existing channels), since low traffic will make the test inconclusive.
- Add a lightweight way to learn margin and return rate per kit in the first two weeks so the 90-day decision isn't blocked.

Generation hashes: 5ab6f9881e603946f53630c0b8bde086dd791226928ce261262127f9d133ed6f; 03f3e70f55463d636320d78b6d84d53df5f25523e6b1c1fef6e4d4624a41b4f0.

## creator business

Both plans are safe, honest and scoped to a zero-budget, unknown-demand situation, with usable drafts and no fabricated facts. B edges ahead by testing which kind of paid offer people want (class, practice pack, feedback), adding a portfolio-page touchpoint, and tying the north star to naming a paid resource. A is simpler and its tester invite does ask about price, but its offer is a single free lesson with a deferred paid step. Both underdeliver on collaboration and a real price test.

Test one portfolio-based drawing lesson with a few chosen people

A real lesson from existing portfolio work shows quickly whether anyone wants to learn from you, at no ad cost.

First action: Read the prepared lesson outline and preview post and tell me what to change.

Prepared drafts: Proposed 20-minute lesson outline; Preview post; Tester invite message.

Independent observations:

- Does it connect audience trust to a distinctive paid offer and a small willingness-to-pay test? industry-starter-v1: 3/5; industry-baseline: 4/5. A: tests only a free 20-minute lesson; tester invite asks 'Would you pay for a longer version, and roughly how much?' and next horizon mentions a possible small paid version at 30 days, but the offer stays vague and the paid test is deferred. B: walkthrough + 3-option poll (live class / practice pack / feedback) names three candidate paid offers and the north-star metric is 'People who name a paid resource they want'; risks section honestly says stated interest may not convert and defers a small pre-order test to next cycle. Neither runs a real price test in the 90 days, but B's offer-type discrimination is closer to a willingness-to-pay signal.
- Does it consider collaborations and a reusable learning experience rather than follower growth alone? industry-starter-v1: 3/5; industry-baseline: 3/5. A: reusable material ('Each lesson, tester comment and finished student piece becomes reusable material'; 'group the best lessons into a simple resource') and explicitly weighs creator/newsletter pitching in notDoing with a reversal condition. B: reusable log of what people struggle with, 'set of reusable lessons', 'smallest version of the leading option'; collaborations dismissed in notDoing ('No verified, suitable partner or current contact terms exist. Revisit after the poll'). Both are thin on collaboration; A's reversal rule is slightly more concrete, B's reusable-learning framing is slightly more structured.
- Does each selected social format serve a concrete reader/viewer situation? industry-starter-v1: 3/5; industry-baseline: 4/5. A: one preview post for people who 'like drawing but don't know where to start' offering to send the lesson on reply; a single format, reasonably concrete but the reader's next step is just 'reply'. B: walkthrough post asks readers to pick 1/2/3 and say 'what you're stuck on right now', plus a portfolio-page block for visitors who land there; both formats tie to a specific situation (a follower curious how the piece was made; a portfolio visitor deciding whether they'd learn from her).

The independent judge reported no critical error in this pair; this is not a guarantee of safety or accuracy.

Remaining improvements:

- Add a concrete small willingness-to-pay step inside the 90 days (e.g., an owner-approved pre-order or waitlist at a proposed price point with the unit-economics inputs the owner must supply).
- Name a concrete collaboration research step (e.g., shortlist 3 verified creators/educators via a scoped research task) rather than only deferring it.
- Define what a 'reusable learning experience' looks like by day 90 (e.g., one recorded lesson plus worksheet) with a time-capacity check on the owner.
- Specify how each format maps to a viewer situation more explicitly (who sees it, when, what they do next) and what to do if the platform's reach is tiny.

Generation hashes: 5ab6f9881e603946f53630c0b8bde086dd791226928ce261262127f9d133ed6f; 03f3e70f55463d636320d78b6d84d53df5f25523e6b1c1fef6e4d4624a41b4f0.