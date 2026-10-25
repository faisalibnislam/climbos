"""Build the book-research registry, notes, playbooks, catalog and evaluation fixtures.

Inputs:  reading records (one JSON per book reading, own-words findings and frameworks) from
         $BOOK_READINGS (default: the private scratch folder used during reading; not committed).
Outputs: source_registry.json, notes/<ID>.json, playbooks/BKP-*.json, playbooks/catalog.json,
         evaluations/prompts.json, evaluations/expected.json

Run from the book-research folder: python3 tools/build.py
Standard library only; no network, no model calls. Expected answers are written only to
evaluations/expected.json, never next to the prompts.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
READINGS = os.environ.get("BOOK_READINGS", "/private/tmp/climbos-book-readings/out")
EDITION = "2026-10-20"
READING_IDS = ["BK07", "BK08", "BK09a", "BK09b", "BK10", "BK11", "BK12", "BK13", "BK14", "BK15"]
SHA = {  # SHA-256 prefixes of the supplied files (docs/reference-books/, not committed)
    "BK07": "8d08c05c83874b3e", "BK08": "0266cdb079ddbd78", "BK09a": "525fd2f03e33c6ab", "BK09b": "525fd2f03e33c6ab",
    "BK10": "a3b333155e81cfef", "BK11": "06574135e0b9026a", "BK12": "971e5091d2c43483", "BK13": "51ace5b449b9edab",
    "BK14": "64beff83fb8eefb4", "BK15": "9e11222d6d99a112",
}

# ---- Playbook specs (ClimbOS synthesis; original proposals, not author guidance) ----
# members: framework ids merged (first is primary); versions: existing guidance this playbook versions or extends.
S = []


def spec(**k):
    S.append(k)


spec(id="BKP-01", slug="advantage-ledger", title="Name the advantage growth comes from, and test its barrier",
     members=["BK07-K1", "BK07-K6", "BK07-K2", "BK07-K4", "BK07-K7"],
     versions=["docs/growth-intelligence/books/01_business_strategy_economics.md (section 9, candidate v2)", "docs/growth-engine/book-review/BK01.md (rules 2 and 5)", "shared/agents/decision.ts"],
     business_types=["any"], stages=["early", "growing", "established"],
     decision="Which advantage a plan relies on (a named power, an execution edge, or unknown) and how much upfront spend that advantage can justify.",
     applies=["Plan asks for heavy upfront spend or long payback", "Owner claims a moat or 'unique' position", "Choosing between copying a rival and a different offer path"],
     excludes=["Plans that are cheap, reversible tests (an advantage isn't needed to run them)"],
     inputs=["Named competitors the advantage must hold against", "Evidence for the benefit (margin, price, cost) and the barrier"],
     missing=["No competitor named: advantage 'unknown'; plan stays cheap and reversible.", "Benefit unproven: label 'execution advantage' at most; never tell the owner they have no viable strategy."],
     branches=[{"if": "Benefit and barrier both evidenced against named rivals", "then": "Record the power; longer payback may be justified, still within cash guardrails."}, {"if": "Benefit evidenced, barrier copyable by similar small rivals", "then": "Execution advantage: grow it, but size spend to normal payback."}, {"if": "Neither evidenced", "then": "Advantage unknown; the plan's first step gathers evidence; no moat language in copy."}],
     extra_guardrails=["No exit traps or price rises on locked-in unhappy customers (rejects the author's SAP example as policy).", "Large-company case evidence is not a small-business rule."],
     note="Helmer's barrier-first test replaces the library's equal-weight durability check only when spend depends on durability (RECONCILIATION R01-R03).")

spec(id="BKP-02", slug="follow-on-value", title="Follow-on value and high-touch renewal (switching costs without traps)",
     members=["BK07-K5", "BK09b-K7"],
     versions=["shared/playbooks/contracts.ts PB-lifecycle-email", "docs/growth-expansion/blog-research/playbooks/BRP-03-package-architecture.json", "skills/retention-lifecycle/SKILL.md"],
     business_types=["b2b_saas", "agency", "professional_services", "membership"], stages=["growing", "established"],
     decision="Whether to add follow-on offers, onboarding and success reviews that raise the value of staying, and whether the price can carry that labour.",
     applies=["Customers stay but buy one thing", "High-touch accounts churn after onboarding", "Agency or B2B retainers with renewal dates"],
     excludes=["Activation or first-value problem unsolved (fix that first)", "Lock-in that works by making leaving hard rather than staying valuable"],
     inputs=["Price per account and onboarding hours", "Renewal dates or contract terms", "Customer list with consent for account contact"],
     missing=["No hours data: show the service-cost share as a question, not a number.", "No renewal data: start with a manual review list."],
     branches=[{"if": "Onboarding hours x rate is a large share of first-period price", "then": "Automated or group onboarding for low-price accounts; reserve live reviews for high-value ones."}, {"if": "Customers get repeat value and ask for adjacent work", "then": "Test one follow-on offer with existing customers (owner-approved message)."}, {"if": "Leaving is hard but customers are unhappy", "then": "Not eligible: remove friction, fix value."}],
     extra_guardrails=["Cancelling stays as easy as buying.", "Auto-renewal terms are an owner and legal decision, not a default."],
     note="Overlaps BRP-03 on add-ons; this playbook covers retention labour and renewal, BRP-03 covers package design.")

spec(id="BKP-03", slug="customer-research-v2", title="Customer research: who to learn from, and interviews vs survey",
     members=["BK08-K1", "BK08-K3", "BK12-K6"],
     versions=["shared/playbooks/contracts.ts PB-interviews (candidate v2)", "skills/voc-research/SKILL.md", "docs/growth-intelligence/books/02_research_positioning.md"],
     business_types=["any"], stages=["pre_launch", "early", "growing"],
     decision="Which customers to learn from for a given decision, which method fits the pool size, and how to turn coded answers into one chosen Job.",
     applies=["Messaging, targeting or positioning decisions", "Finding why people stall or leave", "Few customers and no usable analytics"],
     excludes=["No consented way to contact customers (use public sources instead)"],
     inputs=["Customer list with consent to contact", "The decision the research must inform"],
     missing=["Small pool: census of recent best-fit payers; no percentages.", "No customers yet: problem interviews with prospects (PB-interviews, Mom Test rules)."],
     branches=[{"if": "Decision is messaging or targeting", "then": "Recent best-fit payers (about the last 12 months)."}, {"if": "Decision is why people drop off", "then": "Contrast groups: stalled, churned, didn't buy."}, {"if": "Pool large enough for a survey (authors' rule of thumb about 500)", "then": "Short survey plus a few interviews; counts rank themes within the sample only."}],
     extra_guardrails=["Commitments outweigh enthusiasm (Mom Test over interview-scoring rubrics).", "Theme counts are not prevalence estimates."],
     note="Book 02 recruits contrast groups; Forget the Funnel recruits best-fit customers. The decision decides (RECONCILIATION R10).")

spec(id="BKP-04", slug="conversion-diagnosis", title="Diagnose conversion problems before prescribing fixes",
     members=["BK13-K1", "BK13-K2", "BK13-K3", "BK08-K2"],
     versions=["skills/conversion-audit/SKILL.md (candidate v2)", "skills/landing-pages/SKILL.md", "docs/growth-expansion/blog-research/guides/03_voc_conversion_copy.md"],
     business_types=["any with a website or booking flow"], stages=["early", "growing", "established"],
     decision="Which page or flow problem to fix first, found by diagnosis methods that fit the traffic level, with each remedy matched to a diagnosed problem.",
     applies=["Conversion or purchase is the weak link", "Owner wants a page redesign or A/B test", "Low traffic rules out testing"],
     excludes=["Demand or capacity is the binding constraint (fix that first)"],
     inputs=["Funnel numbers for the page or flow", "Access to recent buyers, staff or support logs for diagnosis"],
     missing=["No visitor counts: qualitative diagnosis only; no uplift estimate.", "Expected survey answers below a usable count (computed): use buyer walkthroughs and hallway tests instead."],
     branches=[{"if": "Traffic too low for a survey or test", "then": "Walkthroughs with recent buyers, ask what nearly stopped them, become a customer yourself."}, {"if": "Several problems found", "then": "Rank by page reach x share of mentions, blockers first (ClimbOS scoring, not the authors')."}, {"if": "A remedy matches no diagnosed problem", "then": "Drop it (it adds clutter)."}],
     extra_guardrails=["Reported client uplifts are examples, never forecasts.", "Session recording needs consent where the law requires it."],
     note="Feeds BKP-05 (what to test) and BRP-14 (question order and risk).")

spec(id="BKP-05", slug="landing-split-v2", title="Landing-page or pitch test sized from the owner's baseline",
     members=["BK13-K4", "BK14-K5"],
     versions=["shared/playbooks/contracts.ts PB-landing-split (candidate v2)", "skills/experiment-design/SKILL.md", "docs/growth-expansion/blog-research/playbooks/BRP-21-experiment-trust-gates.json"],
     business_types=["any with a website or sales calls"], stages=["early", "growing", "established"],
     decision="Whether a split test can answer the question at the owner's traffic and baseline, and what to do instead when it can't.",
     applies=["A bold, diagnosed change is ready (BKP-04)", "Owner asks for an A/B test"],
     excludes=["Change is a minor tweak with no diagnosed problem", "Test would need longer than the horizon (computed)"],
     inputs=["Weekly eligible visitors or calls", "Baseline rate of the primary metric", "A minimum change worth detecting (owner-confirmed or labelled heuristic)"],
     missing=["Baseline unknown: fall back to the visitor floor and label it heuristic.", "Too slow: pooled pages, an earlier metric, user tests, or a before/after read labelled observational."],
     branches=[{"if": "Computed duration fits the horizon in whole weeks", "then": "Run the split with a numeric guardrail and a harm stop."}, {"if": "Too slow but change is cheap and reversible", "then": "Ship it with a pre-registered directional read (threshold set before data)."}, {"if": "Founder-led pitch change at a few calls a week", "then": "No statistical test (about 173 calls per version at a 40% baseline and 15-point change); use the trusted-rep judgement test."}],
     extra_guardrails=["Whole weeks, at least 7 days (existing lint).", "An 85-90% threshold only pre-registered for cheap reversible changes and labelled directional (ExP rule otherwise)."],
     note="Replaces PB-landing-split's fixed 700-visitors-a-week floor with a computed feasibility check (backlog CG-15).")

spec(id="BKP-06", slug="customer-value-stages", title="Customer-value stages and the one gap to close",
     members=["BK08-K4", "BK08-K5", "BK08-K6", "BK08-K7", "BK07-K3"],
     versions=["docs/growth-expansion/blog-research/playbooks/BRP-07-activation-definition.json (candidate v2)", "shared/agents/diagnosis.ts", "shared/playbooks/contracts.ts PB-activation-repair"],
     business_types=["saas", "membership", "subscription_commerce", "agency_retainer", "repeat services"], stages=["early", "growing", "established"],
     decision="How to map the customer's journey into value stages, pick one customer-led measure per stage and choose the single gap worth closing, sized in customers.",
     applies=["Recurring or repeat revenue", "Owner tracks only signups and sales"],
     excludes=["One-off purchases where a purchase funnel plus reviews and referrals is enough"],
     inputs=["Counts per stage over the same period", "Definition of first value (value received, not setup)"],
     missing=["Stage counts missing: name the measurement step; no gap ranking.", "Thresholds set by judgement: label them; check against later payment when cohorts allow."],
     branches=[{"if": "Two gaps have similar rates", "then": "Size each by extra customers (eligible x lift x downstream rate), not rate alone."}, {"if": "Expansion is the gap", "then": "Treat upgrades by existing customers as retention, not conversion."}, {"if": "Product or market changed", "then": "Mark the research and stage map stale; refresh before planning."}],
     extra_guardrails=["NPS and CSAT stay out of diagnosis (leading indicators at most).", "Sizing lifts are illustrative, labelled assumptions."],
     note="The book rejects a funnel that ends at purchase, not stage ratios; ClimbOS diagnosis keeps ratios on value stages (RECONCILIATION R09).")

spec(id="BKP-07", slug="stickiness-gate", title="Prove stickiness before scaling acquisition or optimising revenue",
     members=["BK12-K3", "BK15-K4", "BK12-K4", "BK12-K7"],
     versions=["shared/agents/diagnosis.ts (new stageGate field)", "shared/playbooks/contracts.ts PB-paid-search-test, PB-referrals (avoid-if-leak made executable)", "docs/growth-expansion/blog-research/playbooks/BRP-12-paid-test-vs-scale.json"],
     business_types=["any; gate evidence differs by model"], stages=["early", "growing"],
     decision="Whether the business has earned the right to scale paid acquisition or optimise revenue from existing customers, and what to measure first if not.",
     applies=["Owner wants to raise ad spend or add channels", "Recurring business with no churn or cohort reading"],
     excludes=["Capacity binds (delivery first)", "Charging, first-purchase fixes and capped tests (never gated)"],
     inputs=["Activation as value received", "Churn or cohort retention (recurring) or repeat/review/referral signals (one-off)"],
     missing=["Recurring model, no churn: stickiness 'unproven'; paid only as a capped test; churn added to what to measure.", "One-off model: read delivered-value signals, never a churn rate."],
     branches=[{"if": "Stickiness weak or unproven", "then": "Bankable play fixes activation or retention; paid acquisition only as a capped test with no expand step."}, {"if": "Stickiness evidenced and referral base exists", "then": "Referral and word-of-mouth plays rank before paid scale."}, {"if": "Stickiness evidenced and churn-weighted payback within horizon", "then": "Scale paid in steps; compare payback by channel."}],
     extra_guardrails=["Owner can override any gate with a written, logged reason.", "Book benchmarks (e.g. under 5% churn as 'sticky') are dated context, not thresholds."],
     note="A separate gate field, not a ninth constraint or a reordering (BK12 answer; backlog CG-01, CG-03).")

spec(id="BKP-08", slug="one-metric", title="One actionable metric per stage, with a sourced line in the sand",
     members=["BK12-K1", "BK12-K2", "BK12-K5"],
     versions=["shared/agents/specs.ts lintStageMetric", "skills/growth-strategy/SKILL.md (North Star by stage)", "docs/growth-expansion/blog-research/playbooks/BRP-18-cohort-retention.json"],
     business_types=["any"], stages=["early", "growing", "established"],
     decision="Which single metric the plan should move now, how its target is sourced, and how to read it by cohort rather than in aggregate.",
     applies=["Plan names a North Star or target", "Owner reports cumulative or vanity numbers"],
     excludes=["No numbers at all yet (set a baseline period first)"],
     inputs=["The metric's numerator, denominator and period", "Target source: business-model maths, owner baseline, or dated outside figure"],
     missing=["No baseline: first period sets it; no target.", "Cohorts below the minimum: aggregate read labelled weak."],
     branches=[{"if": "Metric is cumulative (total to date, list size)", "then": "Replace with a rate or per-period count."}, {"if": "Ad-funded media business", "then": "Inventory metrics allowed when paired with revenue per 1,000."}, {"if": "Target taken from a book benchmark", "then": "Label it dated outside context; prefer the owner's own baseline."}],
     extra_guardrails=["Each target carries its source tag.", "Averages across cohorts of very different size are not used."],
     note="Duplicates BRP-18 on cohorts; adds the vanity filter and target sourcing.")

spec(id="BKP-09", slug="bullseye-channel-tests", title="Test up to three channels in parallel, then focus on results",
     members=["BK15-K1", "BK15-K2", "BK15-K3", "BK15-K6", "BK15-K7", "BK15-K5"],
     versions=["skills/growth-strategy/SKILL.md step 8 (candidate v2)", "shared/acquisition/scoring.ts select()", "shared/playbooks/contracts.ts PB-paid-search-test", "docs/growth-expansion/blog-research/playbooks/BRP-12-paid-test-vs-scale.json"],
     business_types=["any"], stages=["pre_launch", "early", "growing"],
     decision="Which channels to test now, how cheaply, and when one has earned focus, instead of committing to a primary channel before any result.",
     applies=["No channel has a first-party readout yet", "A working channel's cost is rising (saturation)"],
     excludes=["A channel already works within payback (focus on it; test only as a hedge)"],
     inputs=["Eligible channels from scoring", "Owner hours and cash cap for tests", "Gap to the traction goal"],
     missing=["No goal gap: tests still run; skip the needle check.", "No readout: no channel is 'primary'."],
     branches=[{"if": "Nothing proven", "then": "Up to 3 capped tests in parallel (fewer with under about 5 owner hours a week); choose focus at the readout."}, {"if": "Test is near break-even", "then": "Learning result: one optimisation round with a named lever, owner-set band."}, {"if": "Channel's reachable volume can't cover the goal gap", "then": "Keep it supporting, not primary."}],
     extra_guardrails=["Tests have a spend cap, read date and go band; exempt from scaled-ROI checks, never counted in the forecast total.", "At least one candidate from each eligible channel family (bias check)."],
     note="ClimbOS currently picks a primary from priors (scoring.ts select); this versions that (backlog CG-04, CG-05, CG-21, CG-22).")

spec(id="BKP-10", slug="referral-calibration", title="Referral and word-of-mouth with measured loop maths",
     members=["BK15-K8", "BK11-K5"],
     versions=["shared/playbooks/contracts.ts PB-referrals (candidate v2)", "skills/growth-plays/SKILL.md"],
     business_types=["any with satisfied customers"], stages=["growing", "established"],
     decision="Whether a referral or word-of-mouth play is worth running and how to read its effect without overstating incrementality.",
     applies=["Stickiness evidenced (BKP-07)", "Customer base at or above the referral minimum"],
     excludes=["Retention weak (referrals amplify a leak)", "No consent to contact customers"],
     inputs=["Invites per customer and invite conversion (measured)", "Customer count"],
     missing=["No measured invite rates: no viral claims; K never defaulted.", "Small base: owner asks personally; no programme maths."],
     branches=[{"if": "Measured K below 1", "then": "Seeded total = seed / (1 - K); a multiplier on other channels, not growth on its own."}, {"if": "K at or above 1", "then": "Treat as unproven; re-measure; never forecast unbounded growth."}, {"if": "Negative public reviews", "then": "Keep review work (local reviews matter even though the book downplays negative word of mouth)."}],
     extra_guardrails=["Referred customers aren't all incremental; label the outcome.", "No copied invite text or bought lists."],
     note="Adds loop arithmetic and incrementality labels to PB-referrals (backlog CG-19, CG-39).")

spec(id="BKP-11", slug="sales-pipeline-diagnosis", title="Is the sales pipeline the binding constraint?",
     members=["BK09b-K5", "BK09a-K1", "BK09b-K8", "BK14-K6", "BK12-K8"],
     versions=["shared/agents/diagnosis.ts (new optional sales block)", "docs/growth-intelligence/books/11_sales_partnerships.md", "shared/playbooks/contracts.ts PB-capacity"],
     business_types=["agency", "consulting", "professional_services", "b2b_saas", "quote-based local services"], stages=["early", "growing", "established"],
     decision="Whether meetings, proposals, win rate, no-decision losses or the owner's selling time limit growth, and whether more outreach would help or feed a leak.",
     applies=["Sales-led or quote-based business", "Owner wants more leads or to hire a seller"],
     excludes=["Self-serve purchase with no sales step"],
     inputs=["Meetings booked and held, proposals, won, lost, no-decision, unqualified, over a period", "Owner's maximum meetings a week"],
     missing=["Fewer than about 5 decided deals: counts only, verdict unknown.", "No prior period or target: no verdict (no reliable external sales benchmarks)."],
     branches=[{"if": "Win rate falling or calendar full", "then": "Don't add outreach; fix qualification, proposal or capacity."}, {"if": "Many no-decisions", "then": "Treat 'do nothing' as the main rival; pitch and proposal work."}, {"if": "Founder win rate unstable", "then": "Don't hire a seller yet."}],
     extra_guardrails=["Book win-rate and show-rate figures are dated venture-SaaS context, never verdicts.", "Few accounts means research is a census, not a sample."],
     note="No sales stage exists in diagnosis today (backlog CG-09, CG-10).")

spec(id="BKP-12", slug="cold-outreach-v2", title="Cold outreach without a prospect database",
     members=["BK09a-K3", "BK09a-K4", "BK09a-K5", "BK09a-K6"],
     versions=["shared/playbooks/contracts.ts PB-cold-outreach (candidate v2)", "skills/prospecting/SKILL.md", "skills/cold-outreach/SKILL.md"],
     business_types=["b2b_saas", "agency", "professional_services", "b2b services"], stages=["early", "growing"],
     decision="How the owner builds a lawful account list by hand, finds the right contact, structures messages and books first meetings.",
     applies=["B2B offer with identifiable buyers", "Owner has hours to research and send from their own mailbox"],
     excludes=["No lawful basis for contact in the jurisdiction", "Owner hours below the playbook minimum"],
     inputs=["ICP traits tagged observable or not", "Owner's own mailbox connection", "Owner hours a week"],
     missing=["Traits not observable: become discovery questions, not list filters.", "No reply data: first campaign is step 1 plus one follow-up."],
     branches=[{"if": "First campaign", "then": "Step 1 plus one follow-up; up to 4 steps only after the owner reviews about 100 contacts."}, {"if": "Owner has warm connections at target accounts", "then": "Use BKP-13 first."}, {"if": "Prospect replies with interest", "then": "Book with a lead time of about a week; invite and reminder hygiene."}],
     extra_guardrails=["Owner's mailbox only, never Resend; no bought or scraped lists without lawful basis; no pattern-guessed addresses.", "No 'Re:' on first subjects, no links in step 1, no fake voicemails, no open-tracking triggers."],
     note="Many book tactics conflict with ClimbOS policy and are excluded (see guides/BK09_founding_sales.md).")

spec(id="BKP-13", slug="warm-intros", title="Warm introductions through the owner's network",
     members=["BK09a-K7"], versions=["docs/growth-engine/book-review/BK05.md (warm intros)", "shared/playbooks/contracts.ts PB-referrals"],
     business_types=["b2b", "agency", "professional_services", "high-value local services"], stages=["pre_launch", "early"],
     decision="Whether and how to ask people the owner knows for introductions to target accounts before cold outreach.",
     applies=["No prospect database and no customers yet", "Owner has a professional network"],
     excludes=["Owner unwilling to ask contacts personally"],
     inputs=["Owner's list of contacts (owner-held; not imported without consent)", "Target account list"],
     missing=["No network overlap: go to BKP-12."],
     branches=[{"if": "Contact knows a target buyer", "then": "Owner sends a short forwardable note; one ask per contact."}, {"if": "Friends or past colleagues show interest", "then": "Treat as unqualified until they pass the ICP."}],
     extra_guardrails=["Use of exported connection data needs a lawful basis (unknown to investigate)."],
     note="New candidate PB-warm-intros.")

spec(id="BKP-14", slug="inbound-response", title="Inbound capture and speed to lead",
     members=["BK09a-K8"], versions=["skills/sales-follow-up/SKILL.md", "skills/plays-local/SKILL.md (speed to lead)"],
     business_types=["any with inbound enquiries"], stages=["early", "growing", "established"],
     decision="How inbound forms and first replies should qualify and respond so good leads aren't lost and misfits are redirected politely.",
     applies=["Inbound enquiries arrive by form, email or phone"],
     excludes=["No inbound enquiries yet (demand first)"],
     inputs=["Current form fields", "Response time from enquiry to first reply"],
     missing=["No response-time data: measure for two weeks first."],
     branches=[{"if": "Form asks what could be looked up", "then": "Remove those fields."}, {"if": "Likely misfit", "then": "Hard-qualifier reply that states fit criteria and offers an alternative."}],
     extra_guardrails=["Call and touch counts stay within the sales-follow-up caps.", "Dated lead-response studies are context, not targets."],
     note="Extends existing speed-to-lead guidance.")

spec(id="BKP-15", slug="live-sales-call", title="Live sales call: discover, qualify, demonstrate, handle objections",
     members=["BK09b-K1", "BK09b-K2", "BK09b-K3", "BK14-K4"],
     versions=["skills/sales-follow-up/SKILL.md (new live-call section)", "docs/growth-intelligence/books/11_sales_partnerships.md sections 3-5", "skills/reply-handling/SKILL.md"],
     business_types=["b2b", "agency", "professional_services", "considered consumer purchases"], stages=["early", "growing", "established"],
     decision="How to run a sales call so it ends with qualification and a dated next step, and how to handle price gaps, trial requests and objections.",
     applies=["Considered purchase with a call or meeting step"],
     excludes=["Impulse or self-serve purchases"],
     inputs=["Pitch story (BKP-17)", "Qualification criteria", "Price and proof assets"],
     missing=["No proof assets: say so; no invented logos or results."],
     branches=[{"if": "Small price gap", "then": "Negotiate with trades (BKP-16)."}, {"if": "Large price gap", "then": "Value conversation, or disqualify politely."}, {"if": "'No budget'", "then": "Disqualify only if they never pay for solutions."}, {"if": "Trial request", "then": "Guided session, not open access."}],
     extra_guardrails=["Written follow-ups get one objection attempt; live calls may take distinct objections in turn; a repeated no is final.", "Parity requirements (e.g. SOC 2) go under objections, not value; never raise an objection you can't answer."],
     note="No skill covered the live call before.")

spec(id="BKP-16", slug="deal-follow-through", title="Next steps, stalled deals and negotiation trades",
     members=["BK09b-K4", "BK09b-K6"],
     versions=["docs/growth-intelligence/books/11_sales_partnerships.md sections 6, 7, 13", "skills/sales-follow-up/SKILL.md step 8"],
     business_types=["b2b", "agency", "professional_services"], stages=["early", "growing", "established"],
     decision="When to close a stalled deal as lost, and how to negotiate by trading rather than giving discounts.",
     applies=["Open deals with missed commitments", "Buyer asks for a discount or better terms"],
     excludes=["Deals with no agreed next step yet (run BKP-15 first)"],
     inputs=["Deal history with dated next steps", "Owner's acceptable terms"],
     missing=["No CRM: owner lists open deals and last contact."],
     branches=[{"if": "Two broken commitments", "then": "One clarity email, then close lost with a reason."}, {"if": "Discount requested", "then": "Trade for upfront cash, term or scope; payment-term premium computed in code."}],
     extra_guardrails=["No decoy proposal options; no inflated starting prices; no false urgency.", "Re-contact after loss only with the buyer's permission."],
     note="Rejects the book's steering options and inflated anchors (RECONCILIATION R16).")

spec(id="BKP-17", slug="pitch-storyboard", title="Pitch story for considered purchases",
     members=["BK14-K1", "BK14-K2", "BK14-K3", "BK14-K7", "BK09a-K2"],
     versions=["skills/positioning/SKILL.md step 11 (candidate v2)", "docs/growth-expansion/guides/03_positioning.md (v2 section 'From position to pitch')", "docs/research/strategy-positioning.md"],
     business_types=["b2b", "agency", "professional_services", "large local jobs (short form)"], stages=["early", "growing", "established"],
     decision="Whether the business needs a pitch story, and how to build it from positioning: insight, alternatives as approaches, the agreed ideal, differentiated value, proof, objections, one ask.",
     applies=["Considered purchase where buyers compare approaches", "Positioning exists (even as a thesis)"],
     excludes=["Impulse consumer buys", "Urgent phone-booked local work"],
     inputs=["Positioning components", "The champion's shortlist and alternatives (including do nothing)"],
     missing=["No positioning: do that first (03_positioning).", "Unproven position: pitch is a thesis; review when positioning changes."],
     branches=[{"if": "Large local job (renovation)", "then": "Short 'how to choose' version."}, {"if": "Buyer already knows requirements", "then": "Tailored demo; otherwise lead with strongest differentiators."}, {"if": "Story works on calls", "then": "Reuse on homepage, buyer's guide and onboarding."}],
     extra_guardrails=["The insight is what buyers misunderstand, not 'what changed' or a trend.", "Vision stories suit investors; buyers get a reason to act now, not to wait."],
     note="Versions Obviously Awesome guidance; new material is the storyboard and the applicability gate.")

spec(id="BKP-18", slug="positioning-mode", title="Positioning mode: niche differentiation or category-buyer distinctiveness",
     members=["BK10-K4", "BK10-K8", "BK11-K2", "BK11-K8"],
     versions=["skills/positioning/SKILL.md (mode choice)", "docs/growth-expansion/guides/03_positioning.md", "docs/growth-engine/book-review/BK03.md"],
     business_types=["any"], stages=["early", "growing", "established"],
     decision="Whether to position for a niche segment (Dunford) or for all category buyers with distinctive assets and buying-situation links (Sharp, Romaniuk).",
     applies=["Choosing who to target and how to describe the business"],
     excludes=["Owner has already chosen a target segment for a stated reason (record it; mode is advisory)"],
     inputs=["Category and purchase frequency", "Market size and capacity", "Stage", "How buyers choose (memory in the moment vs comparison)"],
     missing=["Unknown buying mode: default by business type and label it."],
     branches=[{"if": "Consumer repeat-purchase or everyday local service", "then": "Category-buyer mode by default: reach all buyers, link to many buying situations, swap test advisory."}, {"if": "Niche B2B, capacity-limited service or early-stage product", "then": "Niche mode by default; Sharp's laws are contextual heuristics."}, {"if": "New customers come mostly from the biggest rivals", "then": "Normal (duplication of purchase); don't over-target one rival."}],
     extra_guardrails=["Neither author's preference is a hard restriction.", "Brand-science benchmarks are dated consumer-panel data."],
     note="Owner decision: context-dependent (RECONCILIATION R05).")

spec(id="BKP-19", slug="brand-identity-reach", title="Consistent brand cues and reach-first media on small budgets",
     members=["BK11-K3", "BK11-K4", "BK10-K5"],
     versions=["shared/playbooks/contracts.ts PB-social-content", "skills/meta-ads/SKILL.md", "docs/growth-intelligence/books/10_paid_media_cro.md"],
     business_types=["consumer", "local services", "ecommerce"], stages=["growing", "established"],
     decision="How to keep brand cues consistent and early in content and ads, and when to favour reach and continuity over narrow targeting.",
     applies=["Recurring consumer or local business with ongoing content or ads"],
     excludes=["Small niche B2B where reach has a low ceiling"],
     inputs=["Brand assets (name, colours, logo, characters)", "Budget and schedule"],
     missing=["No brand kit: skip asset checks; name the business early."],
     branches=[{"if": "Budget allows continuous presence", "then": "Steady weekly spend beats bursts."}, {"if": "Content varies", "then": "Vary the angle, keep identity cues."}],
     extra_guardrails=["Fame x uniqueness audit needs a survey of category buyers; customer-only surveys are biased.", "Required-response arithmetic is done in code."],
     note="Revises the 'never open with the brand name' rule (RECONCILIATION R07).")

spec(id="BKP-20", slug="physical-availability", title="Physical availability audit: presence, relevance, prominence",
     members=["BK11-K6"], versions=["shared/playbooks/contracts.ts PB-local-listing", "skills/conversion-audit/SKILL.md"],
     business_types=["local services", "retail", "ecommerce"], stages=["any"],
     decision="Where buyers can't find, reach or buy from the business (hours, booking, payment, listings), and which gap to fix first.",
     applies=["Demand diagnosis with low reach", "Local or retail business"],
     excludes=["Instant digital purchase where the site is the only point of sale (use BKP-04)"],
     inputs=["Opening hours, booking and payment options, listings"],
     missing=["No data: owner checklist first."],
     branches=[{"if": "Buyers want to book outside hours", "then": "Online booking before more ads."}, {"if": "Sales and servicing share one channel", "then": "Separate them when capacity allows."}],
     extra_guardrails=["No fake listings or reviews."],
     note="Extends PB-local-listing.")

spec(id="BKP-21", slug="retention-acquisition-balance", title="Retention vs acquisition: ceiling, replacement and penetration",
     members=["BK10-K2", "BK10-K1", "BK10-K3", "BK11-K1"],
     versions=["shared/agents/diagnosis.ts (retention branch, COMPETING.retention)", "skills/retention-lifecycle/SKILL.md", "docs/growth-expansion/blog-research/guides/02_activation_retention_plg.md"],
     business_types=["any repeat-purchase or recurring business"], stages=["growing", "established"],
     decision="How much effort goes to keeping customers vs winning new buyers, using the steady-state ceiling and replacement arithmetic.",
     applies=["Owner asks whether to focus on retention or acquisition", "Growth goal relies on buying frequency alone"],
     excludes=["Capacity full"],
     inputs=["Active customers", "Monthly churn", "New customers per month"],
     missing=["No active count: no ceiling; show the formula only.", "Churn typed by the owner: show source and a wide range."],
     branches=[{"if": "Churn high for the business's size and controllable", "then": "Retention first."}, {"if": "Churn normal for size, growth goal needs more buyers", "then": "Penetration first; keep acquisition at least at replacement."}, {"if": "Plan only raises frequency", "then": "Double-jeopardy flag: growth usually comes mostly from more buyers."}],
     extra_guardrails=["Top 20% of buyers give about half of volume, not 80%; heavy buyers regress.", "No 'retention is 5x cheaper' claims."],
     note="Context-dependent per owner decision (RECONCILIATION R04).")

spec(id="BKP-22", slug="promotion-break-even", title="Price promotion break-even before discounting",
     members=["BK10-K6"], versions=["skills/retention-lifecycle/SKILL.md (offers)", "shared/analysis/decisions.ts (new calculator)"],
     business_types=["ecommerce", "retail", "local services", "consumer subscriptions"], stages=["any"],
     decision="Whether a discount can pay for itself: the sales lift needed is discount / (margin - discount).",
     applies=["Owner proposes a discount or sale"],
     excludes=["Discount at or above margin (always loses)"],
     inputs=["Contribution margin (owner-confirmed)", "Discount"],
     missing=["No margin: refuse the calculation and ask for it."],
     branches=[{"if": "Required lift is large", "then": "Prefer non-price offers."}, {"if": "Promotion mostly reaches existing buyers", "then": "Expect little new-buyer gain."}],
     extra_guardrails=["No fake 'was' prices."],
     note="Book table 10.2 has an arithmetic error at 40% margin and 5% discount (14.3%, not 10%).")

spec(id="BKP-23", slug="loyalty-evaluation", title="Loyalty programmes judged with a holdout",
     members=["BK10-K7"], versions=["skills/plays-local/SKILL.md (#11, #20)", "skills/retention-lifecycle/SKILL.md"],
     business_types=["local services", "retail", "consumer"], stages=["growing", "established"],
     decision="Whether a loyalty card, VIP club or cross-sell programme adds sales, judged against a holdout rather than members vs non-members.",
     applies=["Owner runs or plans a loyalty programme"],
     excludes=["No loyalty programme planned or running"],
     inputs=["Member and non-member counts and visits", "Ability to hold out a group"],
     missing=["No holdout possible: label results 'members already buy more'; no uplift claim."],
     branches=[{"if": "Holdout possible", "then": "Compare members vs holdout on visits per customer."}, {"if": "Loyalty is the only retention play", "then": "Warn; add a retention play that works on value."}],
     extra_guardrails=["Card completion is not extra sales."],
     note="Contradicts the 'evidence strong' rating in plays-local (RECONCILIATION R06).")

spec(id="BKP-24", slug="guarantee-rollout", title="Guarantee design with scenario modelling",
     members=["BK13-K6"], versions=["docs/growth-expansion/blog-research/playbooks/BRP-14-page-question-order-and-risk.json"],
     business_types=["any selling to wary buyers"], stages=["growing", "established"],
     decision="Whether to offer a guarantee for a diagnosed risk, and its break-even invocation rate.",
     applies=["Diagnosis shows risk is a main objection"],
     excludes=["No diagnosed risk (risk reversal isn't a default)"],
     inputs=["Orders per period, contribution kept per order, loss per invoked guarantee"],
     missing=["No loss estimate: grid of scenarios only, labelled."],
     branches=[{"if": "Break-even invocation rate is comfortably above expected", "then": "Pilot on new buyers, with statutory rights unchanged."}],
     extra_guardrails=["Scenario grid, not a forecast.", "Statutory consumer rights are not a 'guarantee'."],
     note="Conditional risk reversal (RECONCILIATION R08).")

spec(id="BKP-25", slug="new-brand-launch", title="Two-stage launch for a new brand, location or product line",
     members=["BK11-K7"], versions=["shared/playbooks/contracts.ts PB-concierge", "skills/positioning/SKILL.md"],
     business_types=["any launching something new"], stages=["pre_launch", "early"],
     decision="How to launch so buyers first learn what category it is, then build memory and availability over time.",
     applies=["New brand, location, product line or variant"],
     excludes=["Established brand in a well-understood category (positioning work instead)"],
     inputs=["Category clarity", "Launch budget and duration"],
     missing=["No budget: owner's own channels only."],
     branches=[{"if": "Category unclear to buyers", "then": "Category-first message before distinctiveness."}],
     extra_guardrails=["Launch-presence duration is a policy decision for the owner, not a book rule."],
     note="Extends PB-concierge.")

spec(id="BKP-26", slug="honest-urgency-readiness", title="Readiness funnels and genuine urgency only",
     members=["BK13-K8", "BK13-K7"], versions=["shared/playbooks/contracts.ts PB-lead-magnet, PB-pricing-test", "skills/lead-magnets/SKILL.md"],
     business_types=["any"], stages=["early", "growing", "established"],
     decision="How to move not-yet-ready buyers toward purchase, and which offer, range or urgency levers are allowed.",
     applies=["Buyers need time or education before buying"],
     excludes=["Impulse purchases where buyers are ready at once"],
     inputs=["Owner-confirmed facts for any deadline, capacity or price claim"],
     missing=["No confirmed fact: no urgency or scarcity claim."],
     branches=[{"if": "Real limit exists (capacity, sale end)", "then": "State it with the confirmed fact."}, {"if": "Sale completes on a partner site", "then": "Track partner-confirmed conversions."}],
     extra_guardrails=["No rolling deadlines, fake countdowns or 'was' prices (book endorses them; ClimbOS policy wins)."],
     note="Backlog CG-07 makes this a deterministic lint.")

spec(id="BKP-27", slug="complex-sale-page", title="Page structure for complex sales",
     members=["BK13-K5"], versions=["skills/landing-pages/SKILL.md", "docs/growth-expansion/blog-research/playbooks/BRP-14-page-question-order-and-risk.json"],
     business_types=["b2b", "high-value consumer"], stages=["growing", "established"],
     decision="How to structure pages when buyers have many objections: an objection table, lower-commitment next steps and detail on demand.",
     applies=["Five or more diagnosed objections", "Long consideration"],
     excludes=["Simple purchases"],
     inputs=["Diagnosed objections and counter-evidence"],
     missing=["No diagnosed objections: BKP-04 first."],
     branches=[{"if": "Buyers not ready for a sales call", "then": "Offer a lower-commitment step."}],
     extra_guardrails=["Accordions never hide required terms."],
     note="Extends landing-pages.")


def norm(s):
    return re.sub(r"\s+", " ", str(s).strip().lower())


def dedup(items):
    seen, out = set(), []
    for x in items:
        k = norm(x if isinstance(x, str) else json.dumps(x, sort_keys=True))
        if k and k not in seen:
            seen.add(k)
            out.append(x)
    return out


def main():
    readings = {}
    for rid in READING_IDS:
        with open(os.path.join(READINGS, f"{rid}.json")) as fh:
            readings[rid] = json.load(fh)
    fw = {f["id"]: (rid, f) for rid, d in readings.items() for f in d["frameworks"]}
    findings = {x["id"]: rid for rid, d in readings.items() for x in d["findings"]}

    # registry
    reg = {"edition": EDITION, "note": "Books supplied by the owner in docs/reference-books/ (not committed). Findings are own-words summaries with locators.", "books": []}
    for rid, d in readings.items():
        b = dict(d["book"])
        b["reading_id"] = rid
        b["sha256_prefix"] = SHA[rid]
        b["file"] = os.path.basename(b.get("file", ""))
        b["coverage"] = d["coverage"]
        b["findings"] = d["findings"]
        reg["books"].append(b)
    write("source_registry.json", reg)

    # notes (frameworks, skill proposals, code gaps); eval answers moved to evaluations/expected.json
    case_ids = {}
    prompts, expected = [], []
    member_of = {m: s["id"] for s in S for m in s["members"]}
    for rid, d in readings.items():
        out = {"reading_id": rid, "book_title": d["book"]["title"], "frameworks": [], "skill_proposals": d["skill_proposals"], "code_gaps": d["code_gaps"]}
        for f in d["frameworks"]:
            g = {k: v for k, v in f.items() if k != "eval_cases"}
            ids = []
            for i, c in enumerate(f["eval_cases"], 1):
                cid = f"EV-{f['id']}-{i}"
                ids.append(cid)
                prompts.append({"id": cid, "playbook": member_of.get(f["id"]), "framework": f["id"], "case_type": c.get("case_type"), "hypothetical": True,
                                "inputs": c.get("prompt_inputs_hypothetical", {}), "task": c.get("task", ""), "status": "not_run_against_engine"})
                expected.append({"id": cid, "expected_behavior": c.get("expected_behavior", []), "hard_failures": c.get("hard_failures", []), "numeric_checks": c.get("numeric_checks", [])})
            g["eval_case_ids"] = ids
            case_ids[f["id"]] = ids
            out["frameworks"].append(g)
        write(f"notes/{rid}.json", out)
    write("evaluations/prompts.json", {"edition": EDITION, "note": "Synthetic, labelled hypothetical. Expected answers are in expected.json; give the engine only this file.", "cases": prompts})
    write("evaluations/expected.json", {"edition": EDITION, "note": "Grading keys for prompts.json. Never shown to the engine under test.", "cases": expected})

    # playbooks
    os.makedirs(os.path.join(ROOT, "playbooks"), exist_ok=True)
    catalog = []
    for s in S:
        mem = [fw[m][1] for m in s["members"]]
        prim = mem[0]
        rules = {}
        for f in mem:
            for r in f.get("proposed_rules", []):
                rules.setdefault(r.get("class", "unknown_to_investigate"), []).append({"rule": r["rule"], "from": f["id"]})
        pb = {
            "id": s["id"], "version": 1, "slug": s["slug"], "title": s["title"], "status": "proposed_reference", "edition": EDITION,
            "origin": "ClimbOS synthesis (original proposal) from the member frameworks; author guidance is cited by finding id, proposed rules are labelled 'proposed'.",
            "decision_task": s["decision"], "business_types": s["business_types"], "lifecycle_stages": s["stages"],
            "applies_when": s["applies"], "exclusions": s["excludes"], "required_inputs": s["inputs"],
            "evidence_requirements": dedup(x for f in mem for x in f.get("evidence_required", [])),
            "missing_data_behavior": s["missing"],
            "decision_branches": s["branches"],
            "implementation_steps": dedup(prim.get("steps", []) + [x for f in mem[1:] for x in f.get("steps", [])[:3]]),
            "dependencies": dedup(x for f in mem for x in f.get("prerequisites", [])),
            "cash_and_labor_requirements": prim.get("requirements", {}),
            "metrics": dedup(x for f in mem for x in f.get("metrics", [])),
            "guardrails": dedup(s.get("extra_guardrails", []) + [x for f in mem for x in f.get("guardrails", [])]),
            "alternatives_when_constrained": dedup(x for f in mem for x in f.get("alternatives", [])),
            "stop_conditions": dedup(x for f in mem for x in f.get("stop_review", [])),
            "review_triggers": dedup(["Owner's numbers or business type change", "A dated benchmark this playbook mentions is superseded"] + [x for f in mem for x in f.get("exceptions_failure_modes", [])[:2]]),
            "rule_classes": rules,
            "versions_existing": s["versions"],
            "reconciliation_note": s["note"],
            "member_frameworks": s["members"],
            "source_references": dedup(r for f in mem for r in f.get("author_refs", [])),
            "hypothetical_evaluation_cases": [c for m in s["members"] for c in case_ids.get(m, [])],
        }
        write(f"playbooks/{s['id']}-{s['slug']}.json", pb)
        catalog.append({"id": s["id"], "title": s["title"], "file": f"{s['id']}-{s['slug']}.json", "frameworks": s["members"], "versions_existing": s["versions"]})
    write("playbooks/catalog.json", {"edition": EDITION, "playbooks": catalog})
    missing = sorted(set(fw) - set(member_of))
    print(f"books {len(readings)} findings {len(findings)} frameworks {len(fw)} playbooks {len(S)} cases {len(prompts)} unassigned {missing}")


def write(rel, obj):
    path = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(obj, fh, indent=1, ensure_ascii=False)
        fh.write("\n")


if __name__ == "__main__":
    main()
