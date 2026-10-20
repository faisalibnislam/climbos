"""Build the blog-research registry, playbooks, catalog and evaluation cases.

Inputs: notes/{GU,EV,CH,DS,EXP}.json (source-grounded research notes, own words)
        notes/raw_fetch_log.json (raw-page fetch used to verify findings)
Outputs: source_registry.json, playbooks/*.json, playbooks/catalog.json, evaluations/cases.json

Run from the blog-research folder: python3 tools/build.py
Standard library only; no network, no model calls.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTES = os.path.join(ROOT, "notes")
FAMILIES = ["GU", "EV", "CH", "DS", "EXP"]
EDITION = "2026-10-20"

SOURCE_META = {
    "GU": {"publication": "Growth Unhinged", "author": "Kyle Poyar", "home": "https://www.growthunhinged.com/", "retrieved_from_note": "Read from the publisher's legacy Substack archive (kylepoyar.substack.com); growthunhinged.com (beehiiv since 2026-01-12) returned a bot check to every tool and was not bypassed."},
    "EV": {"publication": "Elena's Growth Scoop", "author": "Elena Verna", "home": "https://www.elenaverna.com/", "retrieved_from_note": "Public posts read in full; paid posts only to the paywall."},
    "CH": {"publication": "Copyhackers blog", "author": "Copyhackers (per-article authors)", "home": "https://copyhackers.com/blog/", "retrieved_from_note": "Public articles and tutorial transcripts; no courses or gated downloads accessed."},
    "DS": {"publication": "For Entrepreneurs", "author": "David Skok", "home": "https://www.forentrepreneurs.com/saas-metrics-2/", "retrieved_from_note": "Pages read; formulas and charts embedded as images could not be read."},
    "EXP": {"publication": "Microsoft Experimentation Platform articles", "author": "Microsoft ExP team (per-article authors)", "home": "https://www.microsoft.com/en-us/research/group/experimentation-platform-exp/articles/", "retrieved_from_note": "Public research articles read in full."},
}

# Playbook decisions authored for ClimbOS (proposed policy, not author guidance).
# concepts: research concepts merged into this playbook; extends: existing ClimbOS guidance it versions.
SPECS = [
    dict(id="BRP-01", slug="credit-allowance", title="Credit allowance with heavy-user limits", concepts=["GU-C1"],
         business_types=["saas", "ai_product", "agency_productized", "any business selling variable-cost work"], lifecycle_stages=["growing", "established"],
         extends=["docs/growth-expansion/guides/02_monetization.md (heavy-use scenario)", "shared/analysis/decisions.ts margin/price_floor"],
         missing_data=["No per-customer cost data: recommend metering first; no allowance numbers.", "Cost distribution unknown: present the decision as a hypothesis and ask for the top-10% cost share."],
         branches=[{"if": "Cost per customer is flat and low", "then": "Keep a simple plan; credits add confusion."}, {"if": "Top-decile customers drive a large share of cost", "then": "Allowance with top-ups; check margin at full use."}, {"if": "Buyers can't predict their usage", "then": "Plan tiers with a fair-use cap instead of raw credits; test comprehension."}],
         dependencies=["Usage metering per customer", "Billing that supports top-ups"], cash_labor={"cash": "Billing tool changes; none required to analyse", "labor": "Owner 2-4 h to review cost data", "tools": "Billing/metering export"}),
    dict(id="BRP-02", slug="charging-model", title="Choose the billing unit (per seat, flat, usage, per job, per result)", concepts=["GU-C2"],
         business_types=["saas", "ai_product", "agency", "professional_services"], lifecycle_stages=["early", "growing"],
         extends=["docs/growth-expansion/guides/02_monetization.md (compare charging models)", "shared/playbooks/contracts.ts PB-pricing-test"],
         missing_data=["No outcome definition or attribution method: outcome pricing is not eligible; offer base + bonus or per job.", "Fewer than a handful of customers: start with a simple fixed offer."],
         branches=[{"if": "Result is measurable, attributable and the owner can carry delivery cost", "then": "Outcome or success pricing may be tested."}, {"if": "Work is discrete and countable", "then": "Per-job pricing."}, {"if": "Neither", "then": "Flat or seat pricing with an add-on for heavy work."}],
         dependencies=["Written outcome definition (for outcome pricing)", "Cash reserve to wait for outcome payments"], cash_labor={"cash": "Outcome pricing delays revenue; the owner must fund delivery until results land", "labor": "Owner decision; 1-2 h", "tools": "None to decide"}),
    dict(id="BRP-03", slug="package-architecture", title="Tiers, add-ons and one expansion lever at a time", concepts=["GU-C3"],
         business_types=["saas", "ai_product", "membership", "agency_productized"], lifecycle_stages=["growing", "established"],
         extends=["shared/playbooks/contracts.ts PB-pricing-test (candidate v2)", "docs/growth-engine/book-review/BK02.md (Ch 10/11)"],
         missing_data=["No plan-choice data: one offer plus one add-on; uptake assumptions labelled.", "Segments can't be told apart: don't add tiers."],
         branches=[{"if": "Most buyers pick the middle and the top tier is near zero", "then": "Revisit tier boundaries before adding anchors."}, {"if": "A capability helps only some customers and isn't needed for the core promise", "then": "Add-on."}, {"if": "The entry plan can't deliver its own promise", "then": "Move the capability down; don't gate it."}],
         dependencies=["Billing that supports add-ons or tiers"], cash_labor={"cash": "None to test on new buyers", "labor": "Owner 2-3 h; support load per extra plan", "tools": "Pricing page edit"}),
    dict(id="BRP-04", slug="free-access-model", title="Free plan vs free trial vs reverse trial", concepts=["GU-C4", "EV-C4"],
         business_types=["saas", "mobile_app", "desktop_app", "digital_products"], lifecycle_stages=["early", "growing"],
         extends=["skills/growth-plays/reference/base-rates.md (free plan 2-5%, no-card trial 15-25%)", "shared/agents/diagnosis.ts (trial reference)"],
         missing_data=["No visitor counts: compare models qualitatively; no per-visitor estimate.", "Two weak references disagree near the observed rate: verdict 'unknown', not 'weak'."],
         branches=[{"if": "Value is felt within days and acquisition matters", "then": "Reverse trial (full access, then a useful free tier)."}, {"if": "Free users cost real money to serve and there's no cap", "then": "Time-limited trial, not freemium."}, {"if": "Value needs weeks", "then": "Freemium or a long trial; judge on paid per 1,000 visitors."}],
         dependencies=["A free tier useful on its own (reverse trial)", "Abuse controls for repeat accounts"], cash_labor={"cash": "Serving cost of free users", "labor": "Product/billing change", "tools": "Plan gating in the product"}),
    dict(id="BRP-05", slug="outcome-first-ai-messaging", title="Lead with the outcome, not the AI label", concepts=["GU-C5"],
         business_types=["any"], lifecycle_stages=["pre_launch", "early", "growing", "established"],
         extends=["skills/landing-pages/SKILL.md", "shared/agents/lint.ts lintClaims", "docs/growth-engine/book-review/BK02.md (Ch 10)"],
         missing_data=["Audience AI-affinity unknown: default to outcome-first; AI as supporting detail."],
         branches=[{"if": "Mainstream buyers", "then": "Outcome headline; 'AI' only as how-it-works detail."}, {"if": "Audience explicitly seeks AI tools", "then": "AI may appear earlier; still state the outcome."}, {"if": "Disclosure is required", "then": "Disclose plainly; lead with the benefit."}],
         dependencies=["A stated customer outcome (owner-confirmed or from VOC research, BRP-13)", "Deterministic claim lint (shared/agents/lint.ts) after drafting"], cash_labor={"cash": "None", "labor": "Copy change", "tools": "None"}),
    dict(id="BRP-06", slug="price-increase", title="Raise prices plan by plan, with proof of added value", concepts=["GU-C6"],
         business_types=["saas", "membership", "agency", "local_services", "ecommerce"], lifecycle_stages=["growing", "established"],
         extends=["shared/playbooks/contracts.ts PB-capacity (price increase as a capacity response)", "docs/growth-engine/book-review/BK02.md (Ch 8, 12)"],
         missing_data=["No value record since the last price: build the case first; no increase yet.", "Churn sensitivity unknown: show break-even churn; ask the owner to judge."],
         branches=[{"if": "Value, delivery or communication is the problem", "then": "Fix that first; no increase."}, {"if": "Unlimited or flat top plan attracts heavy users", "then": "Change limits before a large price jump."}, {"if": "Value grew and costs rose", "then": "Raise the core plan for new buyers first; existing customers only with notice and owner authorisation."}],
         dependencies=["Contract and notice terms", "A record of added value"], cash_labor={"cash": "None", "labor": "Owner decision + customer notices", "tools": "Billing change"}),
    dict(id="BRP-07", slug="activation-definition", title="Count activation at value received, not setup finished", concepts=["EV-C1"],
         business_types=["saas", "mobile_app", "desktop_app", "digital_products"], lifecycle_stages=["early", "growing", "established"],
         extends=["shared/agents/diagnosis.ts OwnerFunnel.activated", "shared/playbooks/contracts.ts PB-activation-repair (candidate v2)", "docs/growth-intelligence/books/08_email_lifecycle.md §2"],
         missing_data=["Owner reports setup completion as 'activated': label activationKind 'setup' and lower the diagnosis basis to partial.", "No observable value event: first step defines and instruments it."],
         branches=[{"if": "activationKind is value or habit", "then": "Use the count in diagnosis as measured."}, {"if": "activationKind is setup or unknown", "then": "Diagnosis partial; define the value event first."}, {"if": "Team product", "then": "Activation may be counted at team level."}],
         dependencies=["Event tracking for the value event"], cash_labor={"cash": "None", "labor": "1-2 h to define; instrumentation time", "tools": "Product analytics or a manual count"}),
    dict(id="BRP-08", slug="churn-split", title="Split churn by type and timing before choosing a retention fix", concepts=["EV-C2"],
         business_types=["saas", "membership", "subscription_commerce", "agency_retainer"], lifecycle_stages=["growing", "established"],
         extends=["shared/agents/diagnosis.ts (retention branch, COMPETING.retention)", "new candidates PB-payment-recovery and PB-cancel-flow"],
         missing_data=["No billing access: ask the owner to list the last 10-20 cancellations by reason and month.", "Activation unmeasured: payment recovery may run but can't be the only play."],
         branches=[{"if": "Failed payments are a material share of churn", "then": "Payment recovery (retries, card updates) as a quick fix."}, {"if": "Most cancels happen early", "then": "Route to activation repair."}, {"if": "Cancels cluster near renewal", "then": "Cancel flow with pause, downgrade and a reason question (never obstruct cancelling)."}],
         dependencies=["Billing data or a cancellation list"], cash_labor={"cash": "Possibly a dunning tool", "labor": "2-4 h analysis", "tools": "Billing export"}),
    dict(id="BRP-09", slug="win-back", title="Win back churned customers with something new", concepts=["EV-C3"],
         business_types=["saas", "membership", "subscription_commerce", "local_services"], lifecycle_stages=["growing", "established"],
         extends=["shared/playbooks/contracts.ts PB-lifecycle-email (lapsed moment)", "docs/growth-intelligence/books/08_email_lifecycle.md §6"],
         missing_data=["No consent to contact past customers: not eligible; never cold-email them.", "No change since they left: not eligible."],
         branches=[{"if": "Churned base is large relative to new signups and value shipped since", "then": "A short win-back naming the specific change."}, {"if": "Still on the free tier", "then": "In-product prompt first."}, {"if": "Very few churned customers", "then": "A personal note from the owner."}],
         dependencies=["Consented contacts", "A specific product change to name"], cash_labor={"cash": "None", "labor": "1-2 h", "tools": "Email tool with consent records"}),
    dict(id="BRP-10", slug="signup-profiling", title="Short signup profiling to test 'wrong-fit signups'", concepts=["EV-C5"],
         business_types=["saas", "mobile_app", "digital_products"], lifecycle_stages=["early", "growing"],
         extends=["shared/agents/diagnosis.ts COMPETING.activation", "shared/playbooks/contracts.ts PB-activation-repair"],
         missing_data=["No segment data: add 1-3 closed questions; the next diagnosis reads activation in the target segment."],
         branches=[{"if": "A question won't change a segment, message or route", "then": "Don't ask it."}, {"if": "Some signups merit a human and the owner has stated capacity", "then": "Route them to a call."}, {"if": "Personal-use signups", "then": "Skip company questions."}],
         dependencies=["Editable signup flow"], cash_labor={"cash": "None", "labor": "Product change", "tools": "Signup form"}),
    dict(id="BRP-11", slug="conversion-path-split", title="Split 'conversion' into pricing-page reach, pricing to checkout, checkout to paid", concepts=["EV-C6"],
         business_types=["saas", "digital_products", "ecommerce"], lifecycle_stages=["growing", "established"],
         extends=["shared/agents/diagnosis.ts (conversion branch)", "shared/playbooks/contracts.ts PB-pricing-test"],
         missing_data=["No pricing-path counts: first step collects them; meanwhile a heuristic pricing-page review only.", "Too few pricing-page visitors: heuristic review, no rate comparison."],
         branches=[{"if": "Few active users see pricing", "then": "Contextual upgrade prompts at the moment of need."}, {"if": "Pricing to checkout is weakest", "then": "Package/price test (PB-pricing-test)."}, {"if": "Checkout to paid is weakest", "then": "Fix checkout failures (payment methods, errors, surprises)."}],
         dependencies=["Analytics on pricing page and checkout"], cash_labor={"cash": "None", "labor": "1-3 h", "tools": "Analytics"}),
    dict(id="BRP-12", slug="paid-test-vs-scale", title="Keep a capped paid test separate from scaling paid", concepts=["EV-C7"],
         business_types=["any"], lifecycle_stages=["early", "growing", "established"],
         extends=["shared/playbooks/contracts.ts PB-paid-search-test (candidate v2: intent field)"],
         missing_data=["Retention unmeasured: 'scale' not eligible; a capped learning test only.", "No conversion tracking: neither."],
         branches=[{"if": "Retention measured, conversion tracked, landing page checked", "then": "'scale' may be recommended within the cap."}, {"if": "Otherwise and a budget exists", "then": "'learning_test' with a hard cap and a stated limit: it can't show scaled returns."}, {"if": "No budget", "then": "Cheaper channels first."}],
         dependencies=["Conversion tracking", "A checked landing page"], cash_labor={"cash": "Owner's capped ad budget", "labor": "1-2 h a week", "tools": "Ad account (owner-approved), tracking"}),
    dict(id="BRP-13", slug="voc-mining-and-survey", title="Voice of customer: adjacent reviews, buyer surveys and thank-you polls", concepts=["CH-C1", "CH-C2"],
         business_types=["any"], lifecycle_stages=["pre_launch", "early", "growing", "established"],
         extends=["skills/voc-research/SKILL.md", "shared/playbooks/contracts.ts PB-interviews", "docs/growth-expansion/guides/05_customer_discovery.md"],
         missing_data=["Few own reviews: mine adjacent-outcome reviews as a separate pool, confidence capped at medium.", "Fewer than ~10 likely respondents: 3-5 interviews instead of a survey.", "No lawful basis to contact customers: public sources only."],
         branches=[{"if": "Own customers exist and consent allows research messages", "then": "Short survey (6-10 questions) or a one-question post-purchase poll, owner-approved."}, {"if": "No customers yet", "then": "Adjacent-outcome review mining."}, {"if": "A single striking quote", "then": "Label it single-source; themes need frequency."}],
         dependencies=["Owner approval for any survey send"], cash_labor={"cash": "None", "labor": "Owner approves questions; ClimbOS codes answers", "tools": "Survey form; review sources within their terms"}),
    dict(id="BRP-14", slug="page-question-order-and-risk", title="Page order: match the arrival, answer questions in order, one dominant risk", concepts=["CH-C3", "CH-C5"],
         business_types=["any"], lifecycle_stages=["early", "growing", "established"],
         extends=["skills/landing-pages/SKILL.md", "skills/copy-fundamentals/SKILL.md", "shared/agents/lint.ts lintClaims"],
         missing_data=["No VOC to tell which risk dominates: ask the owner one question; label it owner judgement.", "Reducer not offered by the business (e.g. a guarantee): owner note only, never in copy."],
         branches=[{"if": "Most-aware traffic on a short offer", "then": "Offer, terms, CTA."}, {"if": "Problem-aware traffic", "then": "Follow the prospect's question order; each proof once."}, {"if": "Dominant risk is will-it-work / worth-it / approval", "then": "Demo / guarantee + same-type proof / named peers, near the CTA."}],
         dependencies=["VOC bank (BRP-13)"], cash_labor={"cash": "None", "labor": "Copy drafting", "tools": "Page editor"}),
    dict(id="BRP-15", slug="copy-critic-sweeps", title="Critic passes: clarity, so-what, matched proof", concepts=["CH-C4"],
         business_types=["any"], lifecycle_stages=["pre_launch", "early", "growing", "established"],
         extends=["shared/agents/lint.ts (deterministic layer stays first)", "skills/copy-fundamentals/SKILL.md (proof hierarchy)"],
         missing_data=["No proof available for a claim: flag it; the writer softens or drops it."],
         branches=[{"if": "Very short asset", "then": "One combined check."}, {"if": "Proof type doesn't fit the claim", "then": "Warn proof_type_mismatch with claim and proof types."}, {"if": "Benefit with no reader result", "then": "Warn missing_consequence."}],
         dependencies=["Deterministic lint passes first"], cash_labor={"cash": "Model tokens only", "labor": "None for owner", "tools": "Critic prompt/rubric"}),
    dict(id="BRP-16", slug="email-audit-and-onboarding", title="Audit an existing email flow before rewriting; next-step onboarding", concepts=["CH-C6", "CH-C7"],
         business_types=["saas", "membership", "ecommerce", "local_services"], lifecycle_stages=["growing", "established"],
         extends=["skills/lifecycle-email/SKILL.md", "shared/playbooks/contracts.ts PB-lifecycle-email"],
         missing_data=["Fewer than ~100 recipients per email: audit structure only, not performance.", "No event data: time-based emails, labelled as such; no usage recap."],
         branches=[{"if": "An existing flow is connected", "then": "Map it, find contacts with no next step, mark each email protect / fix / queue, then rewrite."}, {"if": "No flow", "then": "Write fresh per lifecycle-email."}, {"if": "Inactive trial users with event data", "then": "One 'where did you get stuck?' email and a usage recap."}],
         dependencies=["Email tool connection", "Event data for behaviour triggers"], cash_labor={"cash": "None", "labor": "2-4 h review", "tools": "Email tool"}),
    dict(id="BRP-17", slug="unit-economics-definitions", title="Unit economics: fully loaded cost per customer, labelled payback, revenue churn and expansion, no uncapped LTV", concepts=["DS-C1", "DS-C2", "DS-C3", "DS-C5"],
         business_types=["any recurring business", "saas", "membership", "agency_retainer"], lifecycle_stages=["early", "growing", "established"],
         extends=["shared/agents/economics.ts (cacFull other=0, single churn)", "shared/analysis/decisions.ts", "docs/growth-intelligence/books/01_business_strategy_economics.md §6-7", "docs/growth-intelligence/books/12_analytics_forecasting_pricing.md"],
         missing_data=["Churn unknown: value and payback stay null (current behaviour).", "Non-media costs unknown: ask; label CAC as excluding them.", "Expansion unknown: assume none and say so."],
         branches=[{"if": "Small customers churn more than large", "then": "Revenue churn below customer churn: use revenue churn for value."}, {"if": "Expansion revenue exists", "then": "Add a capped-horizon expansion term."}, {"if": "Someone quotes LTV or 3x", "then": "Replace with 12-month value; benchmarks carry era and basis."}],
         dependencies=["Owner unit economics", "Billing data for revenue churn"], cash_labor={"cash": "None", "labor": "Owner answers 2-4 questions", "tools": "Billing export (optional)"}),
    dict(id="BRP-18", slug="cohort-retention", title="Use cohort survival instead of one churn rate when billing data exist", concepts=["DS-C4"],
         business_types=["saas", "membership", "subscription_commerce"], lifecycle_stages=["growing", "established"],
         extends=["convex/analytics.ts computeCohorts", "shared/attribution/cohorts.ts", "shared/agents/economics.ts"],
         missing_data=["Fewer than 3 cohorts with 3+ complete months, or cohorts under ~20 customers: show counts, keep single churn labelled assumed."],
         branches=[{"if": "Cohort minimum met", "then": "Observed survival replaces monthly churn, tagged measured."}, {"if": "Annual contracts before first renewal", "then": "Don't infer churn yet."}],
         dependencies=["Payments connection"], cash_labor={"cash": "None", "labor": "None", "tools": "Billing integration"}),
    dict(id="BRP-19", slug="sales-touch-fit", title="Match the sales motion to what a customer is worth", concepts=["DS-C6"],
         business_types=["b2b_saas", "agency", "professional_services", "consulting"], lifecycle_stages=["early", "growing"],
         extends=["shared/acquisition/scoring.ts price fit", "shared/playbooks/contracts.ts PB-cold-outreach (price_min)"],
         missing_data=["No measured CAC for the motion: use the CAC-aware price floor as a check, labelled heuristic.", "Price unknown: motion fit is unknown."],
         branches=[{"if": "12-month value covers a human sale", "then": "Outreach or demos may fit."}, {"if": "It doesn't", "then": "Self-serve and low-touch channels; human help only for top segments."}, {"if": "The play has its own measured CAC", "then": "Use playMaths, not the heuristic."}],
         dependencies=["Owner price and margin"], cash_labor={"cash": "None to decide", "labor": "Owner sales hours if chosen", "tools": "None"}),
    dict(id="BRP-20", slug="cash-trough", title="Show the cash low point and the upfront-payment lever", concepts=["DS-C7"],
         business_types=["any recurring business"], lifecycle_stages=["early", "growing"],
         extends=["shared/agents/economics.ts lockedNumbers (no cash line today)", "docs/growth-intelligence/books/12_analytics_forecasting_pricing.md (cash timing)"],
         missing_data=["Acquisition cost or contribution unknown: no trough shown; ask for them.", "Owner's cash reserve unknown: show the trough and ask whether it's affordable."],
         branches=[{"if": "Trough deeper than the owner's stated reserve", "then": "Slow spend, ask for upfront or annual payment, or stage the plays."}, {"if": "Paid upfront with contribution at or above CAC", "then": "No trough."}],
         dependencies=["Spend plan", "Unit economics"], cash_labor={"cash": "The trough itself", "labor": "None", "tools": "None"}),
    dict(id="BRP-21", slug="experiment-trust-gates", title="Trust gates before reading a test: split check, significant read, guardrails", concepts=["EXP-C1", "EXP-C2", "EXP-C3"],
         business_types=["any business running a split test"], lifecycle_stages=["growing", "established"],
         extends=["shared/analysis/decisions.ts sampleRatio/compareRates", "shared/growth/experimentOutcome.ts inferenceOf/outcomeLine", "shared/agents/specs.ts lintExperimentFeasibility (PEEKING)"],
         missing_data=["Per-arm counts unknown: no effect read; label 'attributed' if a platform reports it.", "Planned split unknown: ask before any read.", "No guardrails set: the test can't be marked 'met'."],
         branches=[{"if": "Split check fails (p < 0.001)", "then": "Block; diagnose by stage."}, {"if": "Split check warns (p < 0.01)", "then": "Hide winner wording until checked."}, {"if": "Valid split but not significant", "then": "'No reliable difference', never 'about N incremental'."}, {"if": "A guardrail is breached", "then": "Block 'met'; harm stops are allowed early."}],
         dependencies=["Per-arm counts", "Planned allocation", "1-3 guardrails with a numeric harm bound"], cash_labor={"cash": "None", "labor": "Owner enters counts", "tools": "Split tool or manual split"}),
    dict(id="BRP-22", slug="experiment-duration-and-metric", title="Whole weeks, a week-by-week view, and a metric that can move", concepts=["EXP-C4", "EXP-C5"],
         business_types=["any business running a split test"], lifecycle_stages=["growing", "established"],
         extends=["shared/agents/specs.ts lintExperimentFeasibility (fixed 10%->15% baseline)", "shared/analysis/decisions.ts sampleSize"],
         missing_data=["Primary metric baseline unknown: keep the generous default and suggest a higher-volume step.", "No weekly counts: no novelty check; label it."],
         branches=[{"if": "durationDays < 7", "then": "Error for split/holdout tests."}, {"if": "Primary outcome too rare to read in time", "then": "Primary = nearest feasible funnel step; outcome kept as a guardrail."}, {"if": "Week-1 effect much larger than later weeks", "then": "Caution: possible novelty (a label, not a verdict at small n)."}],
         dependencies=["Baseline for the primary metric when known"], cash_labor={"cash": "None", "labor": "None", "tools": "Weekly counts per arm"}),
    dict(id="BRP-23", slug="split-dry-run", title="A one-week dry run of an owner-built split before the first test", concepts=["EXP-C6"],
         business_types=["any business running its first manual split"], lifecycle_stages=["early", "growing"],
         extends=["shared/growth/diagnostics.ts (tracking check)", "docs/growth-expansion/guides/06_experimentation.md (A/A)"],
         missing_data=["Rare events: judge the dry run on the split and event parity, not on a p-value."],
         branches=[{"if": "Platform-native split with exposed counts", "then": "Skip the dry run; still run the split check."}, {"if": "Owner-built split (two lists, alternating pages, staff assignment)", "then": "7-day dry run: identical arms, pass = split check + same events logged in both."}],
         dependencies=["A way to assign and count arms"], cash_labor={"cash": "None", "labor": "A week of delay", "tools": "The split mechanism"}),
]


def load():
    fams = {}
    for f in FAMILIES:
        with open(os.path.join(NOTES, f"{f}.json")) as fh:
            fams[f] = json.load(fh)
    with open(os.path.join(NOTES, "raw_fetch_log.json")) as fh:
        raw = json.load(fh)
    return fams, raw


def uniq(items):
    out, seen = [], set()
    for x in items:
        k = json.dumps(x, sort_keys=True) if not isinstance(x, str) else x.strip().lower()
        if k not in seen:
            seen.add(k)
            out.append(x)
    return out


def main():
    fams, raw = load()
    # ---- source registry ----
    articles, not_read, finding_ids, concepts = [], [], set(), {}
    for f, d in fams.items():
        meta = SOURCE_META[f]
        for a in d["articles"]:
            log = raw.get(a["id"], {})
            articles.append({
                "id": a["id"], "family": f, "publication": meta["publication"], "title": a["title"], "author": a["author"],
                "canonical_url": a["canonical_url"], "retrieved_from": log.get("url", a["canonical_url"]),
                "published": a.get("published"), "updated": a.get("updated"), "retrieved_at": a.get("retrieved_at", EDITION),
                "access": a["access"], "access_notes": a.get("access_notes", ""), "sections_read": a.get("sections_read", []),
                "raw_text_check": {"fetched": "error" not in log and not log.get("blocked", False), "words": log.get("words"), "method": "raw HTML fetched with the standard library; finding numbers and key terms matched against the page text (see VALIDATION.md)"},
                "findings": a.get("findings", []),
            })
            finding_ids.update(x["id"] for x in a.get("findings", []))
        for n in d.get("not_read", []):
            not_read.append({"family": f, **n})
        for c in d.get("concepts", []):
            concepts[c["id"]] = {**c, "family": f}
    registry = {"edition": EDITION, "kind": "blog_research_source_registry", "families": {f: SOURCE_META[f] for f in FAMILIES}, "articles": articles, "not_read": not_read,
                "formulas": fams["DS"].get("formulas", []), "worked_examples": fams["DS"].get("worked_examples", []), "experiment_check_gaps": fams["EXP"].get("climbos_check_gaps", [])}
    with open(os.path.join(ROOT, "source_registry.json"), "w") as fh:
        json.dump(registry, fh, indent=1, ensure_ascii=False)

    # ---- playbooks ----
    os.makedirs(os.path.join(ROOT, "playbooks"), exist_ok=True)
    catalog, cases = [], []
    case_n = 0
    for s in SPECS:
        cs = [concepts[c] for c in s["concepts"]]
        refs = uniq([r for c in cs for r in c.get("author_refs", [])])
        evals = []
        for c in cs:
            sc = c.get("eval_scenario") or {}
            case_n += 1
            cid = f"BR-EV{case_n:02d}"
            evals.append({"id": cid, "label": "hypothetical", "inputs_hypothetical": sc.get("inputs_hypothetical", {}), "expected_behavior": sc.get("expected_behavior", []), "hard_failure": sc.get("hard_failure", [])})
            cases.append({"id": cid, "playbook": s["id"], "concept": c["id"], "origin": "original_synthetic_case", "status": "not_run_against_engine", "task": c["decision"], "inputs_hypothetical": sc.get("inputs_hypothetical", {}), "expected_behaviors": sc.get("expected_behavior", []), "hard_failures": sc.get("hard_failure", []), "source_refs": c.get("author_refs", []), "actual_output": None, "observed_result": None})
        pb = {
            "id": s["id"], "version": 1, "slug": s["slug"], "title": s["title"], "status": "proposed_reference", "edition": EDITION,
            "decision_task": " / ".join(uniq([c["decision"] for c in cs])),
            "business_types": s["business_types"], "lifecycle_stages": s["lifecycle_stages"],
            "applies_when": uniq([x for c in cs for x in c.get("applies_when", [])]),
            "exclusions": uniq([x for c in cs for x in c.get("avoid_when", [])]),
            "required_inputs": uniq([x for c in cs for x in c.get("prerequisites", [])]),
            "evidence_requirements": uniq([x for c in cs for x in c.get("evidence_required", [])]),
            "missing_data_behavior": s["missing_data"],
            "alternatives_when_constrained": uniq([x for c in cs for x in c.get("alternatives", [])]),
            "decision_branches": s["branches"],
            "implementation_steps": uniq([x for c in cs for x in c.get("steps", [])]),
            "dependencies": s["dependencies"],
            "cash_and_labor_requirements": s["cash_labor"],
            "metrics": uniq([x for c in cs for x in c.get("metrics", [])]),
            "guardrails": uniq([x for c in cs for x in c.get("guardrails", [])]),
            "observation_window": " / ".join(uniq([c.get("observation_window", "") for c in cs if c.get("observation_window")])),
            "stop_conditions": uniq([x for c in cs for x in c.get("stop_review", [])]),
            "review_triggers": ["Owner corrects an input this playbook relies on", "A metric or guardrail crosses its bound", "The underlying source or platform rule changes"],
            "climbos_location": " / ".join(uniq([c.get("climbos_location", "") for c in cs])),
            "extends_existing": s["extends"],
            "source_references": refs,
            "concepts": s["concepts"],
            "guidance_layers": {
                "author_guidance": refs,
                "interpretation": [c.get("interpretation", "") for c in cs],
                "proposed_climbos_rule": [c.get("proposed_rule", "") for c in cs],
                "disagreements": [c.get("disagreements", "") for c in cs if c.get("disagreements")],
            },
            "hypothetical_evaluation_cases": evals,
            "notes": "Proposed reference contract. Not executable; does not authorize publishing, sending or spending. Numbers in source references are dated author figures, never forecasts.",
        }
        with open(os.path.join(ROOT, "playbooks", f"{s['id']}-{s['slug']}.json"), "w") as fh:
            json.dump(pb, fh, indent=1, ensure_ascii=False)
        catalog.append({"id": s["id"], "title": s["title"], "file": f"{s['id']}-{s['slug']}.json", "concepts": s["concepts"], "extends_existing": s["extends"], "business_types": s["business_types"], "status": "proposed_reference"})
    with open(os.path.join(ROOT, "playbooks", "catalog.json"), "w") as fh:
        json.dump({"edition": EDITION, "kind": "blog_research_playbook_catalog", "count": len(catalog), "playbooks": catalog}, fh, indent=1, ensure_ascii=False)
    with open(os.path.join(ROOT, "evaluations", "cases.json"), "w") as fh:
        json.dump({"edition": EDITION, "case_origin": "original_synthetic", "execution_status": "not_run_against_engine", "note": "Hypothetical inputs. Expected behaviours are proposed evaluator judgments, not author requirements.", "cases": cases}, fh, indent=1, ensure_ascii=False)
    print(f"{len(articles)} articles, {len(not_read)} not read, {len(catalog)} playbooks, {len(cases)} cases")


if __name__ == "__main__":
    main()
