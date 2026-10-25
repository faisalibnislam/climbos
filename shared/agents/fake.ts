import { z } from "zod";
import { turnCostMicros, ZERO_USAGE, type TurnRequest, type TurnResult } from "../ai/types";
import type { RateVersion } from "../economics/rates";

/**
 * Deterministic stand-in for Claude, used only by automated tests of the
 * Engine v2 wiring (never in production: it is enabled solely by the
 * CLIMBOS_FAKE_LLM test variable). It returns schema-valid answers so the
 * job, checkpoint, metering and resume paths can be exercised exactly.
 *
 * Modes (CLIMBOS_FAKE_LLM):
 * - "ship":   the first draft passes review.
 * - "revise": the first draft fails review; the revision passes.
 * - "fail":   every call fails with a provider error.
 */

type JsonSchema = { type?: string | string[]; properties?: Record<string, JsonSchema>; items?: JsonSchema; enum?: unknown[]; anyOf?: JsonSchema[]; required?: string[] };

function sample(s: JsonSchema, marker: string, key = ""): unknown {
  if (s.enum?.length) return s.enum[0];
  if (s.anyOf?.length) return sample(s.anyOf[0], marker, key);
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  switch (type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s.properties ?? {})) {
        // A test double cannot infer which approved offer a draft represents.
        // Omit this optional reference rather than inventing a play name.
        if (k === "approvedOfferPlayName") continue;
        out[k] = sample(v, marker, k);
      }
      return out;
    }
    case "array":
      if (key === "factIndexes" || key.endsWith("FactIndexes") || key.endsWith("SourceUrls") || key === "approvedExamples" || key === "evidenceRefs" || key === "dependencies" || key === "precedentIds") return [];
      return s.items ? [sample(s.items, marker, key)] : [];
    case "number":
    case "integer":
      return key === "priority" ? 1 : key.toLowerCase().includes("index") ? 0 : 1;
    case "boolean":
      return key === "needsOwner" ? false : true;
    default:
      // A real channel keeps autopilot routing testable (it ignores unknown channels).
      if (key === "channel") return "facebook";
      return /url/i.test(key) ? "https://example.com" : `${marker} ${key}`.trim();
  }
}

function rubricIds(system: string): { gates: string[]; criteria: string[] } {
  const gatesBlock = system.split("HARD GATES")[1]?.split("CRITERIA")[0] ?? "";
  const critBlock = system.split("CRITERIA (score")[1]?.split("Ship rule")[0] ?? "";
  return {
    gates: [...gatesBlock.matchAll(/^- ([A-Za-z0-9_]+): /gm)].map((m) => m[1]),
    criteria: [...critBlock.matchAll(/^- ([A-Za-z0-9_]+) /gm)].map((m) => m[1]),
  };
}

export async function fakeTurn(req: TurnRequest, rates: RateVersion): Promise<TurnResult> {
  const mode = process.env.CLIMBOS_FAKE_LLM ?? "ship";
  const usage = { ...ZERO_USAGE, inputTokens: 1000, outputTokens: 500, calls: 1, webSearches: req.webSearch ? 1 : 0 };
  const costMicros = turnCostMicros(req.modelKey, usage, rates);
  if (mode === "fail") return { ok: false, kind: "provider_error", message: "Fake provider error", usage, costMicros, appended: [] };

  const system = req.system.map((b) => b.text).join("\n");
  const lastUser = String(req.messages[req.messages.length - 1]?.content ?? "");
  let output: unknown;
  if (!req.schema) {
    output = "FAKE RESEARCH NOTES\n- Competitor A: example.com\n- Existing comparison page: https://example.com/compare\nSources: https://example.com";
  } else if (system.includes("HARD GATES")) {
    const { gates, criteria } = rubricIds(system);
    const reviewingFirstDraft = lastUser.includes("fake-v1");
    const pass = mode === "ship" || !reviewingFirstDraft;
    output = {
      gates: gates.map((id) => ({ id, pass: pass, note: pass ? "ok" : "fails" })),
      scores: criteria.map((id) => ({ id, score: pass ? 5 : 2, note: "", fix: pass ? "none" : "Make it specific" })),
      strengths: ["clear"],
      fixes: pass ? [] : ["Make it specific"],
      escalation: { reason: "none", evidence: "" },
    };
  } else {
    const marker = lastUser.includes("A senior reviewer assessed your draft") ? "fake-v2" : "fake-v1";
    output = sample(z.toJSONSchema(req.schema) as JsonSchema, marker);
    if (lastUser.includes("COMPETITOR:") && output && typeof output === "object" && "suggestedAction" in output) {
      const proposal = output as { changed?: boolean; summary?: string; bullets?: string[]; soWhat?: string; suggestedAction?: unknown };
      proposal.changed = true;
      proposal.summary = "The competitor added a free migration offer.";
      proposal.bullets = ["Added a free migration offer for new customers."];
      proposal.soWhat = "Check whether migration effort is a concern for your own buyers before responding.";
      proposal.suggestedAction = {
        action: "Test clearer migration support",
        firstStep: "Ask five recent prospects what makes switching feel difficult.",
        successMetric: "Qualified inquiries that mention migration support",
        reviewAfterDays: 14,
        caveat: "One competitor page change does not show that your customers want this offer.",
      };
    }
    // The fake has no source bundle to support SWOT claims. Return an honest
    // empty SWOT instead of fabricating evidence just to exercise the schema.
    const insights = output as { swot?: { strengths?: unknown[]; weaknesses?: unknown[]; opportunities?: unknown[]; threats?: unknown[] }; swotEvidence?: unknown[]; swotMoves?: unknown[] };
    if (insights && typeof insights === "object" && insights.swot && Array.isArray(insights.swotEvidence) && Array.isArray(insights.swotMoves)) {
      insights.swot = { strengths: [], weaknesses: [], opportunities: [], threats: [] };
      insights.swotEvidence = [];
      insights.swotMoves = [];
    }
    // Growth plans: a portfolio that satisfies the deterministic play rules.
    if (output && typeof output === "object" && Array.isArray((output as { plays?: unknown }).plays)) {
      const tmpl = (output as { plays: Record<string, unknown>[] }).plays[0];
      const play = (kind: string, predictability: number, distinctiveness: number) => ({
        ...tmpl,
        name: `${marker} ${kind} play`,
        kind,
        creativeReview: {
          challenge: "Test one customer-facing change without assuming a universal growth convention.",
          conventionBasis: "unknown",
          costOfBreaking: "The change could confuse customers or consume owner time.",
          customerTensionOrAsset: "No customer tension or distinctive asset was verified in this fake scenario.",
          precedentIds: [],
          transferLogic: "No precedent is claimed; validate the mechanism with a small owner-run test.",
          keyDifferences: "This synthetic scenario does not establish similarity to a documented case.",
          hopedCustomerBehavior: "A qualified buyer completes a paid booking.",
          assumptions: ["The selected audience will notice the offer."],
          novelty: "low",
          evidenceStrength: "low",
          businessFit: "low",
          feasibility: "medium",
          risk: "medium",
          reversibleTest: "Run a small, time-boxed test and review the result before scaling.",
          successSignal: "Count verified paid bookings against the established baseline.",
          guardrail: "Monitor customer complaints and owner time.",
          stopCondition: "Stop if customer confusion or workload rises without paid bookings.",
          revisionEvidence: "Revise when measured buyer responses differ from this assumption.",
        },
        // Five lenses (plays lint): positioning on the comparison page, a referral trigger and link, and a funnel play.
        oneLiner: "Comparison page vs Acme for small studios, via a partner newsletter.",
        hook: "Unlike Acme, no per-seat fees for small studios.",
        audience: "Owners of small design studios switching from spreadsheets",
        trigger: "Right after a customer's first booked job",
        mechanic: kind === "bankable" ? "Personal email with a referral link, sent right after a customer's first booked job" : "Onboarding checklist getting new sign-ups to a first booked job, co-promoted locally",
        actionContract: {
          ...(tmpl.actionContract as Record<string, unknown>),
          diagnosis: "The plan needs more booked jobs",
          intendedEffect: "Create additional booked jobs from qualified studio owners",
          evidenceBasis: "assumption",
          evidenceNote: "The test volume is a labeled scenario rather than measured customer evidence.",
          evidenceRefs: [],
          targetOrAsset: "The existing comparison page and its booked-job funnel",
          resourcePlan: "One owner hour per week; no media spend",
          executionCapability: "owner",
          dependencies: [],
          measurement: { metric: "Booked jobs", baseline: "Not measured; count the first 14 days", target: "10 booked jobs", windowDays: 21, source: "Count completed bookings in the booking system" },
        },
        funnel: ["a hundred contacted → replies: low to high [example.com, C]", "replies → booked: about a third [example.com, C]"],
        unit: "booked jobs",
        horizonDays: 90,
        // Numbers that add up and pay back (100 a week × 13 weeks × 10% × 10% ≈ 13).
        model: {
          weeklyReach: 100,
          weeklyReachLow: 70,
          weeklyReachHigh: 130,
          reachSource: { source: "assumption", ref: "", quote: "" },
          steps: [
            { name: "reply", rate: 0.1, low: 0.05, high: 0.15, source: "research", ref: "https://example.com", quote: "Replies run about 10% for warm lists out of 100 delivered messages during 2025.", population: "warm lists", denominator: "100 delivered messages", period: "2025" },
            { name: "paid", rate: 0.1, low: 0.05, high: 0.2, source: "assumption", ref: "", quote: "" },
          ],
          monthlySpendUsd: 0,
          spendSource: { source: "owner", ref: "No ad budget in the brief", quote: "" },
          ownerHoursPerWeek: 1,
          hoursSource: { source: "assumption", ref: "", quote: "" },
        },
        confidence: "medium",
        // A concrete test on an existing, researched asset (plays lint: existing assets first, never data-only).
        assetUsed: "Existing comparison page: https://example.com/compare",
        firstActionToday: "Update the comparison page with the referral offer.",
        timingAssessment: {
          decision: "not_relevant",
          proposedWindow: null,
          timezone: null,
          timezoneBasis: "No calendar timing applies.",
          timezoneEvidenceRef: null,
          geographyBasis: "No timing-sensitive geography or event is needed for this synthetic example.",
          geographyEvidenceRef: null,
          moment: { name: null, businessReason: "This play is an evergreen referral and comparison-page test.", evidence: [] },
          preparation: { leadTimeDays: null, deliveryLeadTimeDays: null, feasible: null, basis: "No event preparation window applies.", evidenceRef: null, deliveryBasis: "Not applicable to this evergreen test.", deliveryEvidenceRef: null },
          capacity: { status: "unknown", basis: "No service-capacity data was supplied.", evidenceRef: null },
          assumptions: [],
          unknowns: [],
          rationale: "The proposed comparison-page change is evergreen and does not depend on a calendar date.",
        },
        // This synthetic play is not an offer experiment; do not fabricate the new commercial inputs.
        offerAssessment: undefined,
        // How visitors reach the page (plays lint: distribution route).
        route: "Partner newsletter test: 10 pitches a week (planned), ~100 visits a week (assumption); $0, 1 owner hour a week.",
        test: "a hundred contacts · small budget · three weeks",
        killIf: "no replies",
        scaleIf: "several replies",
        scores: [4, predictability, 3, 3, 3, 4, 5, distinctiveness],
      });
      (output as { plays: unknown[] }).plays = [play("bankable", 4, 2), play("creative", 3, 4)];
      const option = (title: string, basis: string, ratings: string[]) => ({
        title,
        challengedConvention: "A small studio must rely only on referrals to grow.",
        whyConventionPersists: "Referrals are familiar, low-cost and can arrive from customers who already trust the studio.",
        costOfBreaking: "A new public format could consume delivery time or make the studio's offer harder to understand.",
        businessMechanism: "Use a customer-approved portfolio review as a useful public learning resource, without claiming it proves demand.",
        businessAction: "Create one anonymized process card with customer permission, then share it privately with a few qualified buyers.",
        whyItCouldMatter: "It could make the studio's working method easier for a well-fit buyer to understand before booking.",
        customerBehavior: "A qualified prospect asks a specific question or books a conversation about the process.",
        audienceOrCondition: "Only if past customers consent to share the work and the studio has capacity for a few new projects.",
        evidenceBasis: basis,
        evidenceNote: "This is a synthetic test fixture, not a claim about a real business or customer outcome.",
        evidenceRefs: [],
        precedentIds: [],
        transferLogic: "No precedent is required for this deliberately speculative bold option; test the business's own mechanism directly.",
        keyDifferences: "The studio has a small client base and no evidence yet that prospects want to participate publicly.",
        assumptions: ["Target buyers find the process useful."],
        uncertainties: ["Buyer interest and referral impact are unknown."],
        risks: ["Public work could reveal confidential client details."],
        costAndCapacity: "Start with one owner hour; obtain client permission and anonymize sensitive work.",
        novelty: ratings[0], evidenceStrength: ratings[1], businessFit: ratings[2], feasibility: ratings[3], risk: ratings[4],
        reversibleTest: {
          method: "Ask two past clients to review one anonymized process card before sharing it publicly.",
          metric: "Qualified buyer questions about the method",
          duration: "Two weeks",
          resourceLimit: "One owner hour; no ad spend",
          continueIf: "At least one right-fit buyer asks a substantive follow-up and no privacy concern appears.",
          changeIf: "Reviewers understand the example but buyers do not ask about it.",
          stopIf: "A client objects, confidential detail is exposed, or the work distracts from delivery.",
        },
      });
      (output as { strategyExploration?: unknown }).strategyExploration = {
        grounded: option("Clarify the existing referral handoff", "established_practice", ["low", "medium", "medium", "high", "low"]),
        adjacent: option("Turn project retrospectives into buyer education", "evidence_supported_inference", ["medium", "low", "medium", "medium", "medium"]),
        bold: option("Let prospects commission a tiny public design challenge", "speculative_hypothesis", ["high", "low", "low", "low", "high"]),
      };
      (output as { economics?: unknown }).economics = { revenuePerCustomerMonthUsd: 20, grossMargin: 0.8, monthlyChurn: 0.05, basis: "fake assumptions", sources: { revenue: { source: "research", ref: "https://example.com", quote: "Plans cost $20 per month.", population: "Plans", period: "month" }, margin: { source: "assumption", ref: "", quote: "" }, churn: { source: "assumption", ref: "", quote: "" } } };
    }
    // Growth plan: a dated action, not only measurement, and a route to the page (plan lint: never data-only, distribution).
    const plan = output as { weekOneChecklist?: unknown; diagnosis?: unknown; channels?: { cites?: string[] }[]; audiences?: { cites?: string[] }[]; experiments?: { method?: string; assignmentUnit?: string; assignmentMethod?: string; primaryMetricType?: string; denominator?: string; baselineRate?: number | null; baselineProvenance?: string; baselineEvidenceRefs?: string[]; baselineBasis?: string; minimumMeaningfulEffect?: { value: number | null; unit: string; basis: string }; plannedSamplePerArm?: number | null; plannedSampleBasis?: string; population?: string; durationDays?: number; guardrails?: string[] }[] };
    // A split or holdout test says how many are eligible (plan lint: experiment feasibility).
    if (plan && typeof plan === "object" && "diagnosis" in plan) for (const x of plan.experiments ?? []) if (x && typeof x === "object") {
        // Keep the fake strategy scenario honest: without a measured baseline or MDE, it is an observational pilot, not a powered split.
        x.method = "pre_post_observational";
        x.assignmentUnit = "Not applicable; consecutive observed cohorts";
        x.assignmentMethod = "not_applicable";
        x.primaryMetricType = "binary_rate";
        x.denominator = "eligible people observed in each cohort window";
        x.baselineRate = null;
        x.baselineProvenance = "unknown";
        x.baselineEvidenceRefs = [];
        x.baselineBasis = "Fake scenario has no observed baseline; establish it before interpretation.";
        x.minimumMeaningfulEffect = { value: null, unit: "absolute_rate", basis: "No owner threshold in fake scenario." };
        x.plannedSamplePerArm = null;
        x.plannedSampleBasis = "Observational fake scenario; no powered-sample claim.";
        x.population = "About 1,500 eligible visitors a week (estimate)";
        x.durationDays = 14;
        x.guardrails = ["Unsubscribes stay under 1% (estimate)"];
      }
    // Cites must resolve to a fact or a page the research read; the fake has neither, so it cites nothing.
    if (plan && typeof plan === "object" && "diagnosis" in plan) for (const x of [...(plan.channels ?? []), ...(plan.audiences ?? [])]) if (x && typeof x === "object") x.cites = [];
    if (plan && typeof plan === "object" && Array.isArray(plan.weekOneChecklist) && "diagnosis" in plan) plan.weekOneChecklist = ["Update the comparison page with the referral offer.", "Pitch the comparison page to 10 partner newsletters."];
    // Channel scoring: valid library types and the candidates named in the prompt.
    const cf = output as { types?: unknown; dimensions?: unknown; channels?: unknown; summary?: unknown };
    if (cf && typeof cf === "object" && Array.isArray(cf.types) && Array.isArray(cf.dimensions) && Array.isArray(cf.channels)) {
      const ids = [...lastUser.matchAll(/^([A-Z]\d{2}) · /gm)].map((m) => m[1]).slice(0, 10);
      cf.types = ["b2b_saas"];
      // Neutral text: these reasons flow into later prompts, where a draft marker would confuse the fake reviewer.
      cf.dimensions = [{ key: "customerType", value: "b2b", confidence: "medium", evidence: "scoring evidence" }];
      cf.channels = ids.map((id, i) => ({ id, deltas: [i === 0 ? 10 : 0, 0, 0, 0, 0, 0, 0, 0], reason: "scoring reason", evidence: "scoring evidence", platform: "Google", tactic: "scoring tactic", audience: "scoring audience" }));
      cf.summary = ["scoring summary"];
    }
    // Outbound: three distinct, evidenced prospects and a mergeable sequence.
    const o = output as { prospects?: Record<string, unknown>[]; sequence?: Record<string, unknown>[]; firstLines?: unknown[] };
    if (o && typeof o === "object" && Array.isArray(o.prospects)) {
      const tmpl = o.prospects[0];
      o.prospects = ["alpha", "beta", "gamma"].map((n, i) => {
        const evidenceUrl = `https://${n}.example.com/about`;
        const contentUrl = `https://${n}.example.com/posts/recent`;
        const creatorOutput = "audienceSize" in tmpl;
        const prospect: Record<string, unknown> = { ...tmpl, company: `${marker} ${n}`, website: `https://${n}.example.com`, evidence: [{ url: evidenceUrl, observation: `${marker} observation; 12k followers; English-language tutorials${creatorOutput ? "; UK audience; partnered with Example competitor in September 2025" : ""}.` }, ...(creatorOutput ? [{ url: contentUrl, observation: "Recent tutorial; 3.2k views, 210 likes, 14 comments." }] : [])], publicEmail: "", fit: 80 - i * 10, timing: 60 };
        if ("audienceSize" in tmpl) prospect.audienceSize = { value: "12k followers", sourceUrl: evidenceUrl };
        if ("contentLanguage" in tmpl) prospect.contentLanguage = { value: "English", sourceUrl: evidenceUrl };
        if ("audienceLocation" in tmpl) prospect.audienceLocation = { value: "UK audience", sourceUrl: evidenceUrl };
        if ("competitorCollaborations" in tmpl) prospect.competitorCollaborations = [{ name: "Example competitor", type: "co_created_or_partnered", evidenceUrl, evidenceQuote: "partnered with Example competitor in September 2025", publishedAt: "September 2025" }];
        if ("contentSamples" in tmpl) prospect.contentSamples = [{ url: contentUrl, format: "short_video", views: "3.2k views", likes: "210 likes", comments: "14 comments" }];
        if ("collaborationConcept" in tmpl) prospect.collaborationConcept = "Proposed short tutorial; no agreement implied.";
        return prospect;
      });
    }
    if (o && typeof o === "object" && Array.isArray(o.sequence) && Array.isArray(o.firstLines)) {
      o.sequence = [0, 3].map((day, i) => ({ day, subject: `${marker} note`, body: i === 0 ? `{{firstLine}}\n${marker} body` : `${marker} follow-up`, purpose: "test" }));
      const creatorSourcesText = lastUser.match(/CREATOR CONTENT SOURCE MAP:\n([^\n]+)/)?.[1];
      let creatorSources: Record<string, string[]> = {};
      try {
        const parsed: unknown = creatorSourcesText ? JSON.parse(creatorSourcesText) : {};
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) creatorSources = parsed as Record<string, string[]>;
      } catch {
        creatorSources = {};
      }
      o.firstLines = lastUser.includes("CREATOR CONTENT SOURCE MAP:\n")
        ? Object.entries(creatorSources).map(([company, urls]) => ({ company, line: `${marker} opener grounded in the recent public content`, ...(urls[0] ? { evidenceUrl: urls[0] } : {}) }))
        : ["alpha", "beta", "gamma"].map((n) => ({ company: `${marker.replace("fake-v2", "fake-v1")} ${n}`, line: `${marker} opener for ${n}` }));
    }
  }
  const text = typeof output === "string" ? output : JSON.stringify(output);
  return {
    ok: true,
    output: req.schema ? req.schema.parse(output) : output,
    text,
    appended: [{ role: "assistant", content: text }],
    usage,
    costMicros,
    sources: req.webSearch ? [{ url: "https://example.com", title: "Example" }] : [],
    actualModelId: "fake",
    stopReason: "end_turn",
  };
}
