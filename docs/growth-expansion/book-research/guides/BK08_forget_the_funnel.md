# BK08 guide: Forget the Funnel (Laudi and Suellentrop)

Edition 2026-10-20 · status: proposed reference · not authorization for external actions

Labels used throughout: **Author guidance** (paraphrased advice), **Reported example** (a case or figure the book reports), **Interpretation** (our reading for ClimbOS), **Proposed ClimbOS rule** (not yet in code or skills). Locators are EPUB file plus element range from `epub_full.py`; file names are shortened from `OEBPS/Georgiana-Laudi_Forget-the-Funnel_PRODUCTION_v104-N.xhtml` to `v104-N`.

## Source

| Field | Value |
|---|---|
| Title | Forget the Funnel |
| Authors | Georgiana Laudi, Claire Suellentrop |
| Edition | First Edition (copyright page, v104-18 [13]) |
| Publisher, year | Elevate LP per OPF metadata (the package also holds a Lioncrest logo image), 2023 |
| ISBN | 978-1-5445-4224-9 |
| Format | EPUB, `docs/reference-books/Forget_the_Funnel_-_Georgiana_Laudi_Claire_Suellentrop.epub` |
| Extraction quality | Good. Nine figures are images and were not read. Tables come out as duplicated cells; the X marks in the Ch 5 job-criteria table can't be assigned to columns. The companion workbook is external and not in the file. |
| Watermark | OceanofPDF marks present: an "OceanofPDF.com" line at the end of each XHTML file and an oceanofpdf.com file in the package |

**Coverage**

| Status | Sections |
|---|---|
| Read | Copyright, dedication, contents; Foreword; Ch 1–10; part dividers; acknowledgments; about the authors |
| Skimmed | Advance praise (endorsements only) |
| Skipped | External workbook (not in file, not fetched) |
| Unreadable | Figures 1.1, 1.2, 5.1–5.4, 6.1, 6.2, 7.1, 10.1 (images); Ch 5 criteria-table column marks |

## Use this guide for

| Decision | Business types | Stages |
|---|---|---|
| Whom to research, and by interview or survey | SaaS, agencies, apps, recurring local services | early, growing, established |
| What to learn when there are no or few good customers | all, esp. pre-launch SaaS and apps | pre-launch, early, pivot |
| Which customer Job to build messaging and onboarding around | SaaS, agencies, apps, ecommerce | early, growing, plateau |
| Which stages to measure, and what counts as each | SaaS, apps, subscriptions; one-off businesses with care | growing, established |
| Which stage-to-stage gap to fix first | all with stage counts | growing, established |

## The title vs ClimbOS's funnel diagnosis

- **Author guidance:** the classic funnel ends at purchase, uses the same generic stages for every business, and rewards business-side moments (signups, paid counts) rather than the customer getting value. For recurring revenue the relationship is better pictured as a loop (F1, F18, F31).
- **Interpretation:** the book does not drop sequential stages. Ch 8 picks the gap where many people reach one point and few reach the next, which is stage-to-stage arithmetic on value milestones. ClimbOS has already moved this way: activation counts value received, not setup ([diagnosis.ts](../../../../shared/agents/diagnosis.ts) lines 17–23; [BRP-07](../../blog-research/playbooks/BRP-07-activation-definition.json)).
- **What decides the framing (Interpretation):** (1) revenue model: recurring or repeat revenue needs post-purchase stages, while one-off jobs are served by a purchase funnel plus a review or referral step; (2) observable data: ClimbOS can only diagnose what the owner can count, so counts are the floor; (3) the decision: choosing a stage needs ratios either way. Fixed stage keys let code compare stages; the business's own milestone names can be shown on top.

## K1 · Who to learn from, and by which method

- **Decision:** whom to recruit for research, and interviews, a survey or both.
- **Author guidance:** learn from your best customers: they felt the problem, pay without hesitation, have an ongoing need, clearly got the result, and started paying recently enough to remember life before (ideally 3–6 months, at most about a year). Ask what happened in sequence, not opinions, with open questions. Large pools start with a survey, small ones with interviews (F6, F7, F8). Old research goes stale as products and markets change; usage data shows what, not why (F10).
- **Interpretation:** this sample is right for "attract more of the best" decisions and wrong for diagnosing a leak, where contrast pools are needed.

| If | Then |
|---|---|
| Decision is what to say, whom to target or which Job to serve | Recruit best-fit recent payers (Author guidance) |
| Decision is why people stall, don't buy or churn | Recruit stalled, churned and non-buying pools, kept separate; best-fit only as comparison (Interpretation, from book 02 §5) |
| Large best-fit pool | Short open-ended survey, then interviews (Author guidance; size cut-off is the authors' heuristic) |
| Small pool or time for one method | Interviews until no new struggle themes appear |
| No best-fit customers yet | K2 audience research, labelled hypotheses |

- **Evidence needed:** paying customers with start dates; a value-received signal per customer; a consent basis to contact them; a named decision. **Missing data:** no list or consent, so K2 or public review mining; under 10 best customers, run 3–5 interviews plus reviews and label it thin.
- **Steps:** state the decision → filter the pool → count it and choose method → ask for the sequence (old way, trigger, search, choice, the moment they were sure, what changed) → keep raw answers with counts.
- **Cash / labour / capability / measurement:** none (optional incentives); 5–10 owner hours for 10–15 interviews; contact list, form or calendar; invited, responded, usable.
- **Guardrails:** no synthetic respondents or invented quotes; research invites carry no promotion; owner approves every send from the owner's own channel. **Stop/review:** survey under 10 usable answers after 14 days, switch to interviews; answers scattered across many Jobs after about 10, narrow the segment.

| Proposed ClimbOS rule | Class |
|---|---|
| PB-interviews v2 picks the pool from the decision type: best-fit for targeting and messaging, contrast pools for leak diagnosis | strategic preference |
| The survey size cut-off and response rate are shown as author heuristics; plans use the owner's list size and state the assumed rate | contextual heuristic |
| Participants started paying within about 12 months; older customers form a separate pool | contextual heuristic |
| No research send without a recorded consent basis and owner approval | external requirement |

- **Relation to existing:** *versions* PB-interviews in [contracts.ts](../../../../shared/playbooks/contracts.ts) (lines 76–92: no participant-selection rule, no survey branch). Contrast rule from [book 02](../../../../docs/growth-intelligence/books/02_research_positioning.md) §5; episode method in [05_customer_discovery](../../guides/05_customer_discovery.md); survey practice in CH-C2 of [03_voc_conversion_copy](../../blog-research/guides/03_voc_conversion_copy.md).
- **Sources:** F6 (v104-6 [122–133]); F7 (v104-6 [137–220]); F8 (v104-6 [231–269]); F9 (v104-6 [13–75], [274–283]); F10 (v104-6 [77–95]).

## K2 · Future-customer research: visitor survey and audience research

- **Decision:** what to lead with and what blocks signup, when own-customer evidence is thin.
- **Author guidance:** with no or too few best customers (new product, pivot), use audience research: target-market interviews, subscriber surveys, competitor review mining, social listening. Treat results as hypotheses because respondents' fit is unknown (F11). An on-site survey reaches people already trying to solve the problem; a handful of questions covers where they are in their search, what they use now and dislike, what matters most, and what holds them back. Expect junk answers and slow collection on low traffic (F12).
- **Applies when:** steady traffic and owner permission to add a site survey. **Not when:** traffic is too low to reach a target within weeks.

| If | Then (Interpretation) |
|---|---|
| Steady site traffic | Short on-site survey, kept off checkout and signup forms |
| Low traffic or new market | Audience research via [voc-research](../../../../skills/voc-research/SKILL.md); target-market interviews |
| Best-fit customers also exist | K1 first; the visitor survey adds message order and blockers |

- **Evidence needed:** traffic level; public places the audience talks; a privacy notice covering answers. **Missing data:** no site edit access, so ask 5 recent inquirers the same questions by reply.
- **Steps:** write the decision → estimate days to the response target in code from traffic and an explicit assumed rate → launch with owner approval → code answers → order page sections by the top priorities; place blockers near the call to action.
- **Cash / labour / capability / measurement:** build-own snippet first; low after setup; site script access; responses per week, signup rate on surveyed vs other pages.
- **Guardrails:** answers labelled "prospect, fit unknown", never pooled with customer evidence; no personal data required. **Stop/review:** signup rate on survey pages drops, move or remove it; projected time to target over about 8 weeks, switch to audience research.

| Proposed ClimbOS rule | Class |
|---|---|
| voc-research gets a "site visitor" pool with its own N and a confidence ceiling of Medium | strategic preference |
| Days-to-target is computed in code from owner traffic and a stated assumed rate; over ~8 weeks routes to audience research | economic feasibility |
| Installing a survey on the owner's site is an external action needing owner approval | external requirement |

- **Relation to existing:** *extends* [voc-research](../../../../skills/voc-research/SKILL.md) (public sources only, lines 10–21), CH-C1, CH-C2 and CH-C5 in [03_voc_conversion_copy](../../blog-research/guides/03_voc_conversion_copy.md), and [BRP-13](../../blog-research/playbooks/BRP-13-voc-mining-and-survey.json). No repo file covers a pre-purchase on-site survey. Message order feeds [landing-pages](../../../../skills/landing-pages/SKILL.md).
- **Sources:** F11 (v104-7 [72–110]); F12 (v104-7 [115–177], [219]); F13 (v104-7 [13–60], [182–195]).

## K3 · Job statements from coded research, then pick one Job

- **Decision:** which customer Job to build messaging, channels and onboarding around first.
- **Author guidance:** a Job is the struggle that pushed someone to seek an outcome, written as a when / help me / so I can statement (F14). Tag every answer for struggle, motivation and outcome, one dimension at a time; count struggles; for each top struggle, look only at those respondents and count their motivations and outcomes; write two or three statements (F15). Serve one Job at a time, chosen on commercial pull (urgency, willingness to pay, retention and expansion potential), cost to serve, whether those buyers can be reached, and strategic fit (F16).

| If | Then (Interpretation) |
|---|---|
| One struggle dominates and scores well | Choose it; park the others |
| The most frequent Job is worse on payment, retention or reach than another | Show both; frequency is one input; owner decides |
| Respondents mix segments with different buying processes | Code segments separately first |
| Fewer than 3 respondents share a struggle | Signal only, no Job statement |

- **Evidence needed:** coded answers with respondent ids; per-Job signals on the criteria. **Missing data:** no research means code the owner's notes on 5 best clients, labelled owner-reported; tiny samples stay hypotheses and can be tested as message variants.
- **Steps:** tag → count struggles as n of N → cross-tab motivations and outcomes within each top struggle → write statements in customer words → score each Job with evidence or "unknown" → pick one, log the runner-up.
- **Cash / labour / capability / measurement:** none; 2–4 hours to code 15–50 answers (model-assisted, owner-checked); a coding view; counts with denominators.
- **Guardrails:** every count shows n of N and pool; statement words trace to quotes; counts rank themes within the sample and are never reported as market share. **Review:** chosen Job's messaging moves neither signup nor first-value rate in the window; or the trigger changes.

| Proposed ClimbOS rule | Class |
|---|---|
| voc-research outputs 2–3 Job statements from the within-struggle cross-tab, each with n of N, plus one recommended Job and the runner-up | strategic preference |
| Theme shares and conditional shares are computed in code from coded rows | missing prerequisite |
| A Job statement needs a struggle seen in at least 3 respondents from one pool | contextual heuristic |
| When the most frequent Job is not best on payment, retention or reach, show both | strategic preference |

- **Relation to existing:** *extends* steps 5–9 of [voc-research](../../../../skills/voc-research/SKILL.md) (four-forces coding stays; anxieties feed objections) and step 6 of [positioning](../../../../skills/positioning/SKILL.md); compare the importance profile in [book 02](../../../../docs/growth-intelligence/books/02_research_positioning.md) §7–8. No repo file has Job statements or a one-Job choice.
- **Sources:** F14 (v104-8 [35–128]); F15 (v104-8 [132–381]); F16 (v104-8 [403–449]); F17 (v104-8 [13–100], [507–515]).

## K4 · Experience map vs ClimbOS funnel stages

- **Decision:** which stages to measure for this business and where purchase sits.
- **Author guidance:** map the chosen Job's experience in three phases (struggling, evaluating, growing with the product), each described by what the customer thinks, does and feels; split phases into milestones where feelings shift. Evaluation varies most between enterprise and small-business buyers (F19).
- **Interpretation, mapping to [diagnosis.ts](../../../../shared/agents/diagnosis.ts) stages:** problem recognised → reach; interest → lead; first value → activation; value fully realised → activation (value kind) or purchase; ongoing value → retention; growing value (upgrade, referral, review) → **no stage today**.

| If | Then (Interpretation) |
|---|---|
| Recurring or repeat revenue | Measure all three phases; post-purchase stages are required |
| One-off purchase (emergency repair, single big job) | Purchase funnel plus review or referral step |
| Owner has only visitor, lead and customer counts | Diagnose with existing stages, activation as value received; instrument one value milestone as a first step |
| Enterprise buyer | Expect extra evaluation milestones (stakeholders, security, multi-user setup) |

- **Evidence needed:** a chosen Job; answers tagged think/do/feel; which events are observable. **Missing data:** stages without data are marked unmeasured, not guessed; owner can hand-mark a sample of recent customers.
- **Cash / labour / capability / measurement:** none; about a half-day workshop equivalent, drafted by ClimbOS; K1/K2 research; at least one value event per phase over time.
- **Guardrails:** each milestone cites research rows; no generic stage set pasted in. **Review:** research older than ~12 months or product changed.

| Proposed ClimbOS rule | Class |
|---|---|
| For recurring types, diagnosis reports retention and, when supplied, an expansion reading; missing post-purchase numbers go in "missing" | missing prerequisite |
| Owner-facing labels use the business's milestone names where defined; code keeps fixed stage keys | strategic preference |
| One-off purchase businesses keep the purchase funnel | contextual heuristic |

- **Relation to existing:** *extends* `OwnerFunnel` and `StageReading` in [diagnosis.ts](../../../../shared/agents/diagnosis.ts) (lines 11–26, 39: no expansion stage or input, P2), lifecycle states in [book 08](../../../../docs/growth-intelligence/books/08_email_lifecycle.md) §2 and step 2 of [retention-lifecycle](../../../../skills/retention-lifecycle/SKILL.md).
- **Sources:** F1 (v104-3 [199–208]; v104-15 [21–44]); F18 (v104-10 [23], [50–74]); F19 (v104-10 [87–232], [476–776]); F20 (v104-10 [13–44]); F31 (v104-15 [44]).

## K5 · A customer-value KPI per milestone

- **Decision:** which metric represents each stage, and which metrics plans target.
- **Author guidance:** metrics shape behaviour, so tie them to customer success (F21). Logins are not value for products that work in the background; measure the action that shows the customer got what they wanted (F22). Lagging metrics report results; leading ones can be acted on (F23). Each milestone KPI is trackable, marks a real step forward and shows the work was done: count new unique visitors rather than total traffic, set first-value and full-value thresholds from what customers said was valuable, repeat the value KPI per period for ongoing value, and add an upgrade, review or referral for growing value (F24). Benchmark before choosing work (F25).

| If | Then (Interpretation) |
|---|---|
| Product works in the background | Value KPI is the outcome event, never logins |
| Enough cohort volume | Validate: people who reach the KPI must pay or retain clearly more than those who don't |
| Too few users | Keep the threshold as a labelled hypothesis; owner marks 10–20 recent signups |
| Top-of-journey metric | New unique visitors, excluding logged-in customers |

- **Evidence needed:** customer value statements mapped to features or service elements; per-customer event data; later paid or retained outcome. **Missing data:** weekly owner counts from an admin view; for services, milestones are "job delivered", "problem gone", "rebooked".
- **Cash / labour / capability / measurement:** none to low; event or manual count setup; analytics or admin export; cohorts by signup date.
- **Guardrails:** rates computed in code with denominators; no vanity events; any milestone lift paired with a downstream paid or retained outcome. **Stop/review:** reachers don't pay or retain better, move the definition; nearly everyone reaches it, it is setup, move it later.

| Proposed ClimbOS rule | Class |
|---|---|
| BRP-07 v2 extends the value-event definition to every milestone, including ongoing and growing value | strategic preference |
| A threshold is "validated" only when reachers' later paid or retained rate beats non-reachers' in the same cohort; else "hypothesis" | missing prerequisite |
| The owner's visitors input asks for new unique visitors excluding logged-in customers | missing prerequisite |
| NPS and CSAT may be reported but never used as a milestone KPI or diagnosis input | contextual heuristic |

- **Relation to existing:** activation part *duplicates* [BRP-07](../../blog-research/playbooks/BRP-07-activation-definition.json) (stricter, as it validates against payment); the full ladder *versions* it (candidate BRP-07 v2). Related: EV-C1 in [02_activation_retention_plg](../../blog-research/guides/02_activation_retention_plg.md); [book 08](../../../../docs/growth-intelligence/books/08_email_lifecycle.md) §2, §9. Code gap: `visitors` wording in [diagnosis.ts](../../../../shared/agents/diagnosis.ts) lines 13–14 doesn't exclude logins (P3).
- **Sources:** F21 (v104-11 [13–45]); F22 (v104-11 [48–66]); F23 (v104-11 [75–125]); F24 (v104-11 [127–611]); F25 (v104-11 [640–651]).

## K6 · Pick one success gap and close it

- **Decision:** which stage-to-stage gap to fix first, and which few projects to run on it.
- **Author guidance:** a success gap is a mismatch between what ideal customers need and what the experience gives them. Find gaps by walking each milestone as the customer would; pick one, typically where many reach a milestone and few reach the next and a modest lift has an outsized effect, also weighing payoff, existing resources, short-term action and a clear path (F26). Shortlist a few projects deliverable in weeks or months, park ideas for other gaps, measure with the milestone KPI, and schedule recurring checks (F27).

| If | Then (Interpretation) |
|---|---|
| Many reach a milestone, few reach the next | Candidate gap; size it in code |
| Two gaps are close | Prefer the one actionable in weeks with existing people and tools |
| Walk-through finds a mismatch but counts show no drop | Hypothesis or service fix, not the binding constraint |
| Diagnosis constraint is delivery | No demand-side projects; capacity overrides |

- **Evidence needed:** counts per milestone in a period; value per new customer (owner-supplied); walk-through notes. **Missing data:** owner hand-checks the last 20 signups through each milestone; low volume means whole-week before/after, labelled directional.
- **Steps:** walk each milestone (search, ads, homepage, signup, first use, emails, renewal) → list mismatches → compute stage counts and rates → size each candidate gap → pick one, park the rest → 2–4 projects → measure KPI plus downstream paid or retained.
- **Cash / labour / capability / measurement:** usually none to low; owner time; edit access to site, onboarding or email; whole-week cohorts or a split when volume allows.
- **Guardrails:** lift claims carry window, cohort and comparison; book uplifts never used as forecasts; lifecycle email only to consented contacts, and Resend never for cold sends. **Stop/review:** no change after planned weeks, the cause was elsewhere; milestone up but paid flat, look at offer or price.

| Proposed ClimbOS rule | Class |
|---|---|
| When two measured gaps compete, code reports added customers and contribution for the same point lift at each stage, next to the rate comparison | economic feasibility |
| Plans include a "walk the journey" step whose mismatches are labelled hypotheses | contextual heuristic |
| Book case uplifts appear only as labelled reported examples | strategic preference |

- **Relation to existing:** *extends* the weakest-link logic in [diagnosis.ts](../../../../shared/agents/diagnosis.ts) lines 130–138 (rate-only choice at 134, P3), PB-activation-repair in [contracts.ts](../../../../shared/playbooks/contracts.ts), and the expected-contribution formula in [book 08](../../../../docs/growth-intelligence/books/08_email_lifecycle.md) §3; §17 there warns counts describe but don't diagnose.
- **Sources:** F26 (v104-13 [113–170]); F27 (v104-13 [172–273]); F28 (v104-13 [13–101], [281–298]).

## K7 · Keep plans tied to the Job; refresh triggers

- **Decision:** how plans stay tied to the chosen Job, and when to redo research.
- **Author guidance:** every plan and brief names the Job, milestone and KPI it supports; targets go on the new KPIs (F29). Iterate by returning to a parked Job or rerunning for an underserved segment (F30). The team-roles chapter assumes a small cross-functional team (F5).

| If | Then (Interpretation) |
|---|---|
| Solo owner | ClimbOS facilitates; skip team roles |
| Team of 5+ | Name a champion and an accountable decision-maker |
| Product, price, segment or market changed, or research older than ~12 months | Refresh research for the Job |
| First gap bridged and stable | Return to a parked Job or new segment |

- **Cash / labour / capability / measurement:** none; a short recurring review; plan records with milestone tags; KPI per milestone over time.
- **Guardrails:** tags checked by code, not trusted from prose. **Review:** over half the plays target milestones other than the chosen gap.

| Proposed ClimbOS rule | Class |
|---|---|
| Each play carries a milestone tag and Job id; lint flags plans whose bankable play is off the chosen gap | strategic preference |
| Research older than 12 months, or predating a price or product change, is shown as stale | contextual heuristic |
| `playStage` maps "upgrade" to conversion, so an upsell to existing customers can pass the fit lint; split trial-to-paid from existing-customer upgrades | missing prerequisite |

- **Relation to existing:** *extends* `lintDiagnosisFit` and `playStage` in [diagnosis.ts](../../../../shared/agents/diagnosis.ts) (lines 154–175; upgrade mapping P2) and [decision.ts](../../../../shared/agents/decision.ts).
- **Sources:** F2 (v104-3 [60–107]); F5 (v104-4 [77–204]); F29 (v104-14 [70–125]); F30 (v104-14 [129–141]).

## Dated benchmarks (context only, never thresholds)

| Figure | Context | Date | Why not a threshold |
|---|---|---|---|
| Survey a best-customer pool of 500+, assuming 10–15% response, aiming for 25–50 good answers; else 10–15 interviews | Authors' rule of thumb (F8) | 2023 | No data; response depends on list, channel and relationship; text and table disagree on the boundary |
| Participants started paying 3–6 months ago, at most ~12 | Author guidance (F6) | 2023 | Recall heuristic, not measured |
| Most cross-functional teams dysfunctional without a system | Secondary HBR citation (F5) | 2015 | Secondhand, organisational, not about growth outcomes |
| Unbounce ~900% revenue growth; Calendly to $4M ARR | Reported examples (F3, F20) | ~2010s | Self-reported, no counterfactual |
| Sprout Social $2.1M expansion ARR in six months | Reported example (F4) | n.d. | Single company, no control |
| Autobooks signup rate 14% → 23% | Reported example (F9) | n.d. | 30-day window, consultants involved |
| Alistair +89% trial signups, +40% trial-to-paid | Reported example (F17) | n.d. | Self-reported |
| Tiller +237% page value; Paytouch 980 restaurants | Reported examples (F13) | COVID era | Page value is an attribution metric, not revenue |
| SparkToro free-to-paid doubled; Life Lapse 9.42% → 18.19%; CareerCake lead-to-call 30 days → 3 | Reported examples (F28) | n.d. | Short windows, no controls; the CareerCake "90% velocity" figure is really a 90% cut in time |

## Disagreements and what decides

| Topic | BK08 | Existing library | What decides |
|---|---|---|---|
| Whom to interview | Best-fit recent payers only | [Book 02](../../../../docs/growth-intelligence/books/02_research_positioning.md) §5 recruits for contrast; [guide 05](../../guides/05_customer_discovery.md) any recent episode | Decision type: messaging vs leak diagnosis |
| Activation threshold | Set by judgment from research | [BRP-07](../../blog-research/playbooks/BRP-07-activation-definition.json) checks against later payment | Cohort volume: validate when possible |
| NPS and CSAT | Listed as leading indicators | Not used in diagnosis | Keep out of diagnosis |
| Theme counts | Used to rank and choose | Book 02 §7: counts are not prevalence | Rank within sample only |
| Job statement | Struggle, motivation, outcome | [voc-research](../../../../skills/voc-research/SKILL.md) four forces | Keep both; anxieties feed objections |
| Funnel | Forget it | Funnel diagnosis in [diagnosis.ts](../../../../shared/agents/diagnosis.ts) | Revenue model, observable data, decision (see above) |
| Gap choice | Largest revenue effect | Lowest rate wins | Show sizing when volumes differ a lot; keep rate rule as default |
| Team setup | Cross-functional roles | Mostly solo owners | Team size |

## Not processed or uncertain

- Publisher is ambiguous (OPF says Elevate LP; the package holds a Lioncrest logo).
- Figures and the Ch 5 criteria-table marks were not read; nothing above depends on them.
- The workbook (scripts, survey best practices, survey effect on conversion) was not seen.
- Method numbers (pool size, response rate, sample targets) are the authors' heuristics.
- Code line references were checked on 2026-10-20 for `diagnosis.ts` and `contracts.ts`; recheck before code work.
- Survey consent and privacy rules per jurisdiction were not researched.
