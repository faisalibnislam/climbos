"""Render the five source-grounded guides from notes/*.json plus hand-written framing.

Run from the blog-research folder after build.py: python3 tools/guides.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FRAMING = {
    "GU": dict(
        file="01_pricing_packaging_ai_monetization.md",
        title="Pricing, packaging and AI monetization (Growth Unhinged)",
        intro="Kyle Poyar's newsletter is the strongest public source on how software companies are moving from seats to usage, credits and outcome pricing. For ClimbOS it matters twice: owners ask how to price their own offers, and ClimbOS itself sells credits. Most practical sections of these posts sit behind the paid tier; what's below comes from the public parts of eight posts (two read in full).",
        durable=[
            "Charge in a unit that tracks the value the customer gets and the cost you carry; check the fit before optimising the number.",
            "Averages hide heavy users: test any allowance or unlimited plan against its most expensive customers.",
            "Every plan and add-on needs a one-sentence reason for who it is for.",
            "Compare free-access models on paid customers per visitor, not on conversion rates with different denominators.",
            "Mainstream buyers respond to outcomes, not to the 'AI' label.",
        ],
        dated=[
            "Survey shares of companies using usage or credit pricing (2022-2025, venture-backed SaaS samples).",
            "Reported conversion gaps between free plans, trials and reverse trials (single-vendor or anecdotal).",
            "Claims that model costs will fall 10-100x (forecast, vendor-sourced).",
        ],
        trust="Two posts are sponsored by a usage-billing vendor (Metronome) and one guest author sells outcome-based billing; treat advocacy for those models as interested. Numbers are dated survey or rule-of-thumb figures for venture-backed software and are never used as small-business benchmarks.",
    ),
    "EV": dict(
        file="02_activation_retention_plg.md",
        title="Activation, retention and product-led growth (Elena's Growth Scoop)",
        intro="Elena Verna writes from running growth at large self-serve software companies. Her most useful contribution for ClimbOS is conditional: she says when a tactic applies and when it doesn't. Eight public posts were read in full; the requested starting post on retention techniques, and three others, are paywalled past their introduction.",
        durable=[
            "Activation is the moment a user gets value, not the moment setup is finished.",
            "Churn has types and timing (failed payment, early cancel, renewal cancel); each needs a different fix.",
            "Pick the free-access model (trial, freemium, reverse trial) deliberately and judge it against a reference for that model.",
            "Paid acquisition is fuel for a working engine, not the engine itself; a capped test answers a different question from scaling.",
            "Ask only onboarding questions whose answers change a route or message.",
        ],
        dated=[
            "Her conversion and churn targets (e.g. freemium and trial ranges, first-term churn, payment-recovery shares), stated from experience without source, sample or period.",
            "Budget and traffic thresholds for 'investing in paid' (startup context).",
            "Product examples (SurveyMonkey, Miro, Canva, Lovable) as observed at the time.",
        ],
        trust="Two retention posts are sponsored by Churnkey, which is also a cited data source. Examples come from large software companies; applying them to small businesses is ClimbOS's interpretation, labelled as such.",
    ),
    "CH": dict(
        file="03_voc_conversion_copy.md",
        title="Voice of customer, conversion copy, offers and email (Copyhackers)",
        intro="Copyhackers is the most process-oriented public source on conversion copywriting: mining customer language, ordering a page by the prospect's questions, editing for believability and risk, and auditing email flows. Eight articles and tutorial transcripts were read; paid courses and gated templates were not accessed.",
        durable=[
            "Write from customers' own words, ranked by how often a theme recurs.",
            "The top of a page must match the message that brought the visitor; the body answers the prospect's questions in their order.",
            "Proof must fit the claim it supports; one proof per place.",
            "Diagnose the single biggest risk a buyer feels and put the matching reducer near the call to action.",
            "Audit a running email flow before rewriting it; protect what works.",
        ],
        dated=[
            "Reported copy-test uplifts on single pages (one business, one period).",
            "An open-rate red-flag threshold for day-zero emails (opens are unreliable; ClimbOS doesn't judge on them).",
            "Percentages from a 127-trial onboarding-email review (one analyst's sample, 2024).",
        ],
        trust="Uplifts are reported cases, not forecasts. One shortcut (search-operator review scraping) may break site terms and is not adopted.",
    ),
    "DS": dict(
        file="04_subscription_economics.md",
        title="Subscription economics: cost per customer, payback, churn, cash (For Entrepreneurs)",
        intro="David Skok's SaaS metrics pages (mostly 2009-2016) remain the clearest definitions of cost per customer, payback, churn types and the cash trough. ClimbOS's payback and 12-month value formulas already agree with his gross-margin version; the gaps are in what goes into them. Seven pages were read; formulas and charts embedded as images were not readable.",
        durable=[
            "Cost per customer is fully loaded: media, people and other acquisition costs in the same period.",
            "Payback should use gross margin; churn-weighted payback is longer and must be labelled.",
            "Customer churn, revenue churn and expansion are different numbers; expansion can make net churn negative.",
            "Cohorts beat one blended churn rate once data exist.",
            "Fast growth deepens the cash trough before it pays back; upfront or annual payment shrinks it.",
            "The sales motion must be affordable at the price (sales-complexity fit).",
        ],
        dated=[
            "LTV at least 3x CAC (assumes simple LTV and gross margin of 80%+; Skok later said it needs revision).",
            "Payback under 12 months, best 5-7 (2009-2011; later relaxed for well-funded companies).",
            "Net revenue churn red flags and NRR targets (venture-backed and public SaaS).",
            "A 10% discount rate (2016 cost of capital).",
        ],
        trust="Rules of thumb are venture-backed SaaS norms of their time; ClimbOS keeps formulas and drops the thresholds as pass/fail gates. Worked examples here are recomputed by the validator.",
    ),
    "EXP": dict(
        file="05_trustworthy_experimentation.md",
        title="Trustworthy experimentation (Microsoft Experimentation Platform)",
        intro="Microsoft's ExP articles (2020-2024) describe how a large experimentation platform keeps results trustworthy: checks before, during and after a test, sample-ratio-mismatch diagnosis, alerting, A/A tests, metric sensitivity and external validity. They extend the Kohavi book review (BK06) with operational detail. Eight articles were read in full.",
        durable=[
            "Check the split before reading any effect; diagnose a mismatch by stage.",
            "Only a valid, significant comparison earns causal wording.",
            "Guardrails are harm limits set in advance; stopping early for harm is allowed, stopping early on a win is not.",
            "Run whole weeks and look at results by week (novelty, spikes).",
            "Choose a metric that can move in the time available; keep the business outcome as a guardrail.",
            "Validate a new split mechanism with a dry run before trusting it.",
        ],
        dated=[
            "ExP's p < 0.0005 split threshold and alert priorities (Microsoft-scale volumes).",
            "Effect drift figures from specific Microsoft products.",
        ],
        trust="Written for very high traffic; several practices (simulated A/A p-value studies, variance reduction) don't transfer to small businesses. ClimbOS adopts the logic, not the scale assumptions.",
    ),
}


def bullets(xs):
    return "\n".join(f"- {x}" for x in xs) if xs else "- (none recorded)"


def main():
    with open(os.path.join(ROOT, "playbooks", "catalog.json")) as fh:
        cat = json.load(fh)["playbooks"]
    by_concept = {c: p for p in cat for c in p["concepts"]}
    with open(os.path.join(ROOT, "evaluations", "cases.json")) as fh:
        cases = {c["concept"]: c["id"] for c in json.load(fh)["cases"]}
    for fam, fr in FRAMING.items():
        with open(os.path.join(ROOT, "notes", f"{fam}.json")) as fh:
            d = json.load(fh)
        out = [f"# {fr['title']}", "", f"Edition 2026-10-20. Source family `{fam}`. Original synthesis with attribution; no article text reproduced. Records: [source_registry.json](../source_registry.json), notes: [notes/{fam}.json](../notes/{fam}.json).", "", fr["intro"], "", "## Articles read", "", "| ID | Title | Author | Published | Access |", "|---|---|---|---|---|"]
        for a in d["articles"]:
            out.append(f"| {a['id']} | [{a['title']}]({a['canonical_url']}) | {a['author']} | {a.get('published') or 'not stated'} | {a['access']} |")
        out += ["", "## Durable principles vs dated material", "", "**Durable (author ideas, adopted with conditions):**", bullets(fr["durable"]), "", "**Dated or context-bound (kept as labelled references, never as universal thresholds):**", bullets(fr["dated"]), "", f"**How far to trust it:** {fr['trust']}", ""]
        for c in d["concepts"]:
            pb = by_concept.get(c["id"])
            refs = ", ".join(c.get("author_refs", []))
            out += [
                f"## {c['id']}: {c['name']}",
                "",
                f"**Decision it helps make.** {c['decision']}",
                "",
                "**Applies when**", bullets(c.get("applies_when", [])), "",
                "**Avoid when**", bullets(c.get("avoid_when", [])), "",
                "**Evidence and prerequisites**", bullets(c.get("evidence_required", []) + c.get("prerequisites", [])), "",
                "**Steps**", "\n".join(f"{i + 1}. {s}" for i, s in enumerate(c.get("steps", []))), "",
                "**When data, traffic, budget or integrations are missing**", bullets(c.get("alternatives", [])), "",
                "**Metrics**", bullets(c.get("metrics", [])), "",
                "**Guardrails**", bullets(c.get("guardrails", [])), "",
                f"**Observation window.** {c.get('observation_window', 'n/a')}", "",
                "**Stop or review when**", bullets(c.get("stop_review", [])), "",
                f"**Where it belongs in ClimbOS.** {c.get('climbos_location', '')}", "",
                f"**Author guidance (source findings):** {refs or 'none'}. See the findings in [source_registry.json](../source_registry.json).", "",
                f"**Interpretation (ours):** {c.get('interpretation', '')}", "",
                f"**Proposed ClimbOS rule:** {c.get('proposed_rule', '')}", "",
                f"**Overlap with existing guidance:** {c.get('overlaps_existing', '')}", "",
                f"**Disagreements and what decides them:** {c.get('disagreements', '') or 'none recorded'}", "",
                f"**Playbook:** {('[' + pb['id'] + '](../playbooks/' + pb['file'] + ')') if pb else 'none'} · **Evaluation case:** {cases.get(c['id'], 'none')} ([cases.json](../evaluations/cases.json))", "",
            ]
        nr = d.get("not_read", [])
        out += ["## Not read or excluded", "", bullets([f"{n.get('url', '')}: {n.get('reason', '')}" for n in nr]), ""]
        with open(os.path.join(ROOT, "guides", fr["file"]), "w") as fh:
            fh.write("\n".join(out))
        print("wrote", fr["file"], len("\n".join(out).split()), "words")


if __name__ == "__main__":
    main()
