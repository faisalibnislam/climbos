# cold-outreach: proposed revision (BK09a, BK14)

File: `skills/cold-outreach/SKILL.md` (+15% words). Diff: `cold-outreach.diff`. Status: proposal. Not applied, not benched.

## Follow-up count: resolution

| Source | Says |
|---|---|
| `shared/playbooks/contracts.ts` PB-cold-outreach steps | "One follow-up, then stop" (2 emails) |
| Skill (before) | 4 steps, days 0/3/7/14, optional step 5 at day 30 |
| Lint `shared/agents/specs.ts:1487` | 2-5 steps accepted |
| BK09a (Outreach vendor data, c. 2015) | 7-step drips; step 2 replies most |

Proposed: the first campaign (~100 contacts) sends 2 emails, matching the playbook. Up to 4 only after the owner reviews per-step positive replies and complaints and approves. Step 5 removed: a 30-day "news" email to a non-replier is re-contact without permission. Both shapes pass the current lint. Follow-on (not in this diff): version the PB step text to "One follow-up, then stop; up to 3 after owner review of the first 100" and tighten the lint max from 5 to 4.

## Changes

| Change | Refs | Rule class | Why |
|---|---|---|---|
| 58% step-1 figure marked as undated vendor context; the other vendor's figure noted; owner data decides | BK09a-K5, F34 | contextual_heuristic | Two vendor figures disagree; neither is a base rate |
| Market trend / "what changed" is not an observation | BK14-K3, F29 | contextual_heuristic | Trend openers can't differentiate |
| Bridge: the alternative is usually doing nothing; swap test | BK14-K6, BK14-K3 | contextual_heuristic | Same frame as positioning |
| Sequence length gate (2, then up to 4 with owner approval); no step 5 | BK09a-K5; PB-cold-outreach; policy | strategic_preference | Resolves the conflict above |
| Each follow-up gets a value theme or proof not used before | BK09a-K5, F21 | contextual_heuristic | Keeps the book's useful structure |
| Prospect-specific proof asset from public pages, offered without a link, sent on a yes | BK09a-K5, F19 | contextual_heuristic | Strong step-3 resource with no tracking |
| Test maths marked context/assumed; book response rates are dated examples | BK09a-K5 | contextual_heuristic | Benchmarks are context only |
| Calls are not a cold step; point to "Check before calling" | BK09a-K4 | unknown_to_investigate | Phone rules not verified |
| Warm-intro variant: forwardable note; name the intermediary only if confirmed; no tracking; one follow-up | BK09a-K7, F22 | external_requirement (naming) / strategic_preference | Honest referral claims |
| Never-do: list of sales-book tactics we don't use | BK09a-F21, F34-F37, F41 | external_requirement / strategic_preference | Blocks tactics a model may copy from the book |

## Conflicts with policy (policy wins)

- Open/click tracking, "call on open", re-send after open (F21, F35). Rejected; also unreliable since Apple Mail Privacy Protection (2021).
- "Returning your call" and misleading voicemails (F37, which the book describes rather than recommends). Rejected: fake history and fake voicemail.
- Break-up email used to force replies (F34, F41). Rejected as pressure; the honest close-out stays.
- Tracking pixel on a forwarded intro (F22). Rejected.

## Rejected

| Proposal | Reason |
|---|---|
| Meeting ask with booking link in every email (F21) | Keeps the interest-rung CTA; no booking link before a reply |
| 100-200-word templates with claims like "thousands of customers" (F21) | Length rule and claim lint |
| 6-7am / 7-8pm sends (F36) | No data; sensible-hours rule |
| Email + call + voicemail cadence over a week (F41) | Phone unverified; email-only sequence |
| Logos/testimonials without permission (F20) | Named customers only with permission |

## Code gaps noted (not part of this diff)

- `shared/outbound/sending.ts:75` adds "Book a time" to every footer, including step 1, against the skill.
- `convex/outbound.ts:511` keeps up to 5 steps; skill max is now 4.
