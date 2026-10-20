# Customer discovery that preserves evidence

Source: *The Mom Test*, Rob Fitzpatrick, uploaded EPUB. This guide is an original application to ClimbOS. It is not a replacement for the source book. Exact chapter and internal XHTML locators appear in [sources-b.json](sources-b.json); no print-page numbering is assumed.

## What the source contributes

Fitzpatrick emphasizes conversations about a person's actual circumstances and past events instead of inviting opinions about the founder's idea. He identifies compliments, vague predictions, and unexamined ideas as sources of misleading feedback. Later, when an offer is ready to discuss, he distinguishes real commitments and progress toward a purchase from pleasant but directionless meetings. [BK05-L01, BK05-L02, BK05-L03](sources-b.json)

The book also addresses customer segmentation and the organizational process around interviews. It warns that mixed audiences can produce confusing feedback, and that learning trapped in one person's memory becomes a team bottleneck. The proposed ClimbOS workflow below uses these ideas while adding original evidence contracts, AI review checks, and evaluation rules. [BK05-L04, BK05-L05](sources-b.json)

## Choose the learning task before generating questions

ClimbOS should not offer one generic “customer interview” template for every business. Start with a decision: which segment to prioritize, why trial users fail to activate, which alternative buyers currently use, or why a proposal stalls. Record what evidence could change that decision. An interview cannot answer whether a campaign caused revenue lift, but it may reveal a missing implementation prerequisite that changes the campaign plan.

Choose participants by the buying situation and behavior relevant to the question. Recent purchasers, recent cancellations, stalled evaluators, and nonbuyers provide different views. Preserve those groups instead of averaging their feedback into a single persona. Record recruitment route and incentives because a convenience sample of enthusiastic followers is not a representative market survey.

## A proposed conversation workflow

**Prepare.** Select a small set of consequential learning questions and review known facts first. For a business customer, identify the user's role, buyer, implementation owner, and any separate budget authority without assuming they are the same person. Write a neutral opening that explains the research purpose. Recording and contact details need their own permission handling.

**Reconstruct an episode.** Ask for a recent instance of the task. Establish the trigger, sequence, tools, people, effort, consequence, and outcome. Useful original prompts include: “Walk me through the last time that happened,” “What did you try first?” and “What prevented the next step?” Follow the participant's answer rather than reciting a script.

**Investigate the consequence.** A complaint is not automatically an expensive or urgent problem. Explore what happened because of it, what workaround existed, whether anyone spent money or time, and how the organization prioritized the issue. Preserve the participant's reported amounts as reported values until independently verified.

**Separate discussion modes.** Early discovery seeks context. A later offer discussion can investigate willingness to take a next step. Label the transition so feedback after the pitch does not masquerade as unbiased discovery. Do not make an interview participant buy something to have their experience count as useful evidence.

**Close and review.** Summarize the observation, ask whether anything important was misunderstood, and agree on any appropriate follow-up. Debrief promptly with the team. Keep observation, interpretation, proposed action, and disagreement separate. An analyst's paraphrase should never overwrite the original note.

## Handle weak answers constructively

When someone says “That sounds amazing,” ClimbOS should not count a demand signal. It can suggest asking which current task, if any, makes the idea relevant. When someone says “We would definitely pay,” investigate their actual purchasing process and, if appropriate, propose a concrete offer discussion. The statement may be sincere; sincerity does not establish future behavior.

A feature request is an invitation to investigate the underlying task. Ask what the person tried to accomplish, what failed, and how they solve it now. The product team remains responsible for solution design. Blindly turning every request into roadmap work can create a product that serves several incompatible groups poorly.

## Hypothetical application

An invented time-tracking application receives interview feedback from a freelancer, an agency finance lead, and a construction supervisor. All request “better reports.” The phrase does not establish one shared problem. The freelancer may need invoice preparation, the finance lead may need margin by client, and the supervisor may need proof of attendance.

ClimbOS should create distinct observations tied to their situations. It might recommend focusing the next study on agencies that reconcile project hours before billing, if that fits the owner's strategy and existing customers. This is a research choice, not a conclusion that agencies are automatically the best market. The next interviews should reconstruct actual reconciliation episodes and identify the people responsible.

Suppose three agency participants describe manually merging spreadsheets. That is evidence of a repeated behavior in this sample. It does not prove market prevalence, a specific price, or demand for the proposed application. An offer or pilot can investigate those next. The engine should preserve this limited but useful conclusion rather than writing a broad “customers desperately need automation” claim.

## AI-native implementation

A model can audit proposed questions for leading wording, speculative answers, and multiple questions bundled together. It can classify notes by observation type and suggest unresolved follow-ups. It must cite the supporting note span and retain counterexamples. Generated personas, invented interview quotations, and synthetic participants are not substitutes for customer evidence.

Proposed records include `interviewId`, `participantRole`, `segmentHypothesisId`, `recruitmentRoute`, `consentState`, `episodeDate`, `rawNoteRef`, `observation`, `interpretation`, `evidenceKind`, and `followUpPermission`. Use private tenant-scoped storage for customer material. A public knowledge index should contain general methods, not identifying interview records.

For an offer discussion, store the exact commitment requested, whether it was accepted, any conditions, the promised next step, and its eventual completion. Time, introductions, data access, and payment have different meanings. Do not convert them into a universal numeric purchase probability. A scheduled meeting that never occurs remains incomplete, not an automatically advanced deal.

## Exceptions and reconciliation

Historical behavior is informative but not infallible. Recall can be inaccurate, new products can enable unfamiliar behavior, and a person may not remember a workflow they perform routinely. Observation, artifacts, support records, and later behavioral tests can complement interviews. ClimbOS should recommend corroboration when a consequential decision rests on uncertain recall.

This guide and pricing research are compatible. Asking hypothetical price questions too early can yield weak evidence; examining value, budget, alternatives, and an actual offer later can be useful. The engine should preserve the stage and strength of evidence rather than banning all price discussion or accepting all stated willingness to pay.

## Proposed acceptance tests

- A positive compliment does not increment a measured-demand count.
- A model-created quotation is rejected as customer evidence.
- Mixed segments remain separate until a justified common pattern is established.
- Interview insight contains a traceable note locator and a distinction between observation and interpretation.
- A stalled offer discussion requires an actual buyer step before pipeline advancement.
- Permission to interview never silently becomes permission for a marketing sequence.

The two discovery playbooks in [books-b.json](../playbooks/books-b.json) cover episode-based research and commitment review. They are proposed reference contracts, not permission to contact participants.
