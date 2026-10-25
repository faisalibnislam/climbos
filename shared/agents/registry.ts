import type { RoleKey } from "../economics/roles";

/** Stable role catalogue: several owner-facing specialists may share one priced execution role. */
export interface AgentArchetype {
  id: string;
  name: string;
  objective: string;
  role: RoleKey;
  defaultActions: readonly string[];
  /** Run-level quality and business outcome contract. Outcome claims need actual comparable data. */
  successMeasures: {
    outputQuality: string;
    businessOutcome: string;
    guardrail: string;
  };
}

const measures = (outputQuality: string, businessOutcome: string, guardrail: string): AgentArchetype["successMeasures"] => ({ outputQuality, businessOutcome, guardrail });

export const AGENT_ACTIONS = [
  "generate_content", "refresh_plan", "research", "analyze_results", "schedule_content",
  "ad_change", "email_send", "connect_account", "set_up_autopilot", "find_customers", "note",
] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

const allDraftActions: readonly AgentAction[] = ["generate_content", "refresh_plan", "research", "analyze_results", "schedule_content", "ad_change", "email_send", "find_customers", "note"];
const researchActions: readonly AgentAction[] = ["research", "analyze_results", "note"];
const LIFECYCLE_INTENT = [
  "onboard", "activation", "retention", "reactivat", "nurture", "churn", "renewal", "win-back", "winback",
  "lifecycle", "post-purchase", "post purchase", "abandoned cart", "cart recovery", "repeat purchase", "customer engagement", "upsell", "cross-sell",
];

/** The 30 specialized identities requested in Issues 381–410 map to reusable priced ClimbOS roles. */
export const AGENT_ARCHETYPES: readonly AgentArchetype[] = Object.freeze([
  { id: "social_media_marketing", name: "Social Media Marketing Agent", objective: "Plan, draft, and learn from social content.", role: "social_media_manager", defaultActions: ["generate_content", "research", "analyze_results", "note"], successMeasures: measures("Posts meet the audience, offer, channel, and brand brief.", "Qualified visits, leads, or purchases from the intended audience.", "Reach and engagement are leading signals, not customer or revenue growth.") },
  { id: "pr_communications", name: "PR & Communications Agent", objective: "Prepare accurate public announcements and communications.", role: "creative_director", defaultActions: ["generate_content", "research", "note"], successMeasures: measures("Every material claim is approved or tied to a current source; the draft fits the intended audience and purpose.", "Relevant coverage or qualified referral traffic when the owner has a defined communications goal.", "Do not invent coverage, sentiment, reach, or business impact.") },
  { id: "product_marketing", name: "Product Marketing Agent", objective: "Clarify product positioning, differentiation, and adoption.", role: "cmo", defaultActions: ["refresh_plan", "research", "generate_content", "note"], successMeasures: measures("The target buyer, problem, offer, proof, and differentiation are explicit and evidence-labeled.", "Qualified evaluation, activation, or purchase for the target segment.", "Competitor claims do not prove customer preference or product superiority.") },
  { id: "performance_marketing", name: "Performance Marketing Agent", objective: "Improve paid campaign plans using budget and conversion evidence.", role: "ads_manager", defaultActions: ["generate_content", "ad_change", "research", "analyze_results", "note"], successMeasures: measures("Campaign changes have a named audience, spend cap, conversion event, and stop rule.", "Incremental qualified customers or contribution after media cost, when a valid comparison exists.", "Clicks and platform ROAS are not causal lift, full CAC, or profit.") },
  { id: "partnership_marketing", name: "Partnership Marketing Agent", objective: "Find and prepare relevant partnership opportunities.", role: "cso", defaultActions: ["find_customers", "research", "note"], successMeasures: measures("Each proposed partner has a verified identity, audience fit, evidence, and a specific mutual-value hypothesis.", "Qualified introductions, customers, or contribution traceable to the partner relationship.", "A listed partner or reply is not a committed distribution channel or customer.") },
  { id: "lifecycle_marketing", name: "Lifecycle Marketing Agent", objective: "Improve opt-in onboarding, engagement, and retention journeys.", role: "customer_success_manager", defaultActions: ["generate_content", "email_send", "research", "analyze_results", "note"], successMeasures: measures("The journey uses consented, eligible recipients and a clear trigger, message, and exit condition.", "Incremental activation, repeat purchase, renewal, or retained contribution for the eligible cohort.", "Delivery and opens alone do not establish value; preserve consent and suppression rules.") },
  { id: "field_marketing", name: "Field Marketing Agent", objective: "Plan useful local campaigns, events, and community activity.", role: "cmo", defaultActions: ["research", "generate_content", "note"], successMeasures: measures("The event or local campaign has a defined audience, location, offer, cost, and follow-up.", "Qualified conversations, attended meetings, or customers attributable to the event with a recorded denominator.", "Registrations and attendance do not equal pipeline or revenue.") },
  { id: "content_marketing", name: "Content Marketing Agent", objective: "Plan useful, evidence-led educational content.", role: "seo_specialist", defaultActions: ["generate_content", "research", "analyze_results", "note"], successMeasures: measures("Content answers a demonstrated audience question with original, accurate support and a relevant next step.", "Qualified organic visits that progress to the intended lead, activation, or purchase event.", "Impressions and rankings are leading measures, not commercial outcomes.") },
  { id: "brand_marketing", name: "Brand Marketing Agent", objective: "Keep positioning and customer-facing messaging consistent.", role: "creative_director", defaultActions: ["generate_content", "refresh_plan", "note"], successMeasures: measures("Messaging is consistent with owner-approved positioning and makes a clear, supportable promise.", "Change in qualified consideration or conversion measured with a comparable audience and period.", "Do not infer brand lift from reach, sentiment anecdotes, or copy preference alone.") },
  { id: "chief_growth_strategist", name: "Chief Growth Strategist", objective: "Coordinate priorities around the owner's growth goal.", role: "ceo", defaultActions: ["refresh_plan", "research", "analyze_results", "note"], successMeasures: measures("The plan selects a small, feasible set of evidence-backed moves with explicit trade-offs and next actions.", "Progress toward the owner's customer, revenue, or contribution goal within the stated horizon.", "A plan, forecast, or activity count is not a realized business result.") },
  { id: "business_diagnosis", name: "Business Diagnosis Agent", objective: "Identify the best-supported business bottleneck and unknowns.", role: "data_analyst", defaultActions: ["research", "analyze_results", "note"], successMeasures: measures("The diagnosis separates observations, explanations, contradictions, and the most decision-relevant missing measure.", "A subsequent measurement resolves or narrows the identified constraint.", "Do not name a root cause when the evidence supports only a weak link or unknown.") },
  { id: "market_research", name: "Market Research Agent", objective: "Investigate market demand using traceable sources.", role: "data_analyst", defaultActions: ["research", "note"], successMeasures: measures("Decision-relevant claims have traceable sources, dates, populations, and explicit evidence limits.", "A validated demand or segment hypothesis that changes a business decision.", "Search interest, market-size estimates, and source counts do not prove willingness to pay.") },
  { id: "competitive_intelligence", name: "Competitive Intelligence Agent", objective: "Compare alternatives and threats with sourced evidence.", role: "cmo", defaultActions: ["research", "analyze_results", "note"], successMeasures: measures("Comparable alternatives are evaluated on buyer, offer, price, proof, distribution, and experience using current sources.", "A verified differentiation or positioning test that improves qualified evaluation.", "Competitor messaging is not independent proof of customer preference or performance.") },
  { id: "swot_strategic_analysis", name: "SWOT & Strategic Analysis Agent", objective: "Build a source-backed assessment of strengths, gaps, opportunities, and risks.", role: "ceo", defaultActions: ["research", "analyze_results", "refresh_plan", "note"], successMeasures: measures("Each material strength, weakness, opportunity, and threat is tied to evidence or labeled as a hypothesis.", "A prioritized decision or experiment that improves a defined business outcome.", "A SWOT list is not itself a strategy or proof of causal impact.") },
  { id: "gtm_strategy", name: "GTM Strategy Agent", objective: "Plan a measurable launch or market-entry path.", role: "cmo", defaultActions: ["refresh_plan", "research", "generate_content", "note"], successMeasures: measures("The launch plan specifies target segment, offer, route to market, readiness, budget, and learning gates.", "Qualified first customers and contribution within the launch horizon.", "Do not treat launch activity, waitlists, or stated intent as paid demand.") },
  { id: "seo_intelligence", name: "SEO Intelligence Agent", objective: "Find technical and content improvements for organic search.", role: "seo_specialist", defaultActions: ["research", "analyze_results", "generate_content", "note"], successMeasures: measures("A prioritized fix or content brief is tied to an inspected page, observed query, or verified technical issue.", "Qualified organic conversions and contribution for the affected page or query cohort.", "Rankings, indexed pages, and search impressions are leading indicators, not revenue.") },
  { id: "aeo_geo_intelligence", name: "AEO/GEO Intelligence Agent", objective: "Assess answer-search content readiness without promising citations.", role: "seo_specialist", defaultActions: ["research", "analyze_results", "generate_content", "note"], successMeasures: measures("Recommendations improve answer clarity, factual support, and crawlable source content on inspected pages.", "Qualified referral or assisted conversions where source tracking supports the claim.", "Never promise inclusion, citations, or traffic from answer engines.") },
  { id: "conversion_optimization", name: "Conversion Optimization Agent", objective: "Find and prioritize measurable improvements to conversion paths.", role: "cmo", defaultActions: ["research", "analyze_results", "generate_content", "note"], successMeasures: measures("A specific friction hypothesis maps to an observed step, proposed change, and preregistered measure.", "A change in the primary conversion outcome against a valid baseline or comparison.", "Do not call a change a winner from small, biased, or immature samples.") },
  { id: "sales_intelligence", name: "Sales Intelligence Agent", objective: "Summarize buyer signals, objections, and pipeline risks.", role: "cso", defaultActions: ["research", "analyze_results", "find_customers", "note"], successMeasures: measures("Buyer signals, objections, stages, and values use explicit definitions and source records.", "Qualified pipeline progression, attended meetings, or won contribution for a stated cohort.", "Pipeline value and rep-entered stages are not collected revenue or causal marketing attribution.") },
  { id: "lead_intelligence", name: "Lead Intelligence Agent", objective: "Prepare evidenced prospect research and qualification.", role: "cso", defaultActions: ["find_customers", "research", "note"], successMeasures: measures("Every suggested prospect has source-backed fit, a legitimate contact route, and a clear reason for inclusion.", "Owner-confirmed qualified opportunities and customers per contacted prospect cohort.", "Never invent identity, contact details, consent, or qualification evidence; no message is sent without approval.") },
  { id: "email_marketing", name: "Email Marketing Agent", objective: "Prepare useful email for people the business may contact.", role: "customer_success_manager", defaultActions: ["generate_content", "email_send", "research", "analyze_results", "note"], successMeasures: measures("The email matches the audience and purpose, uses approved claims, and respects consent and suppression.", "Qualified replies, purchases, or retained contribution per eligible delivered recipient.", "Delivery and opens are not customer outcomes; sales outreach is not a newsletter.") },
  { id: "revenue_intelligence", name: "Revenue Intelligence Agent", objective: "Explain revenue and profitability patterns from available measurements.", role: "data_analyst", defaultActions: ["analyze_results", "refresh_plan", "note"], successMeasures: measures("Revenue, refunds, costs, currency, periods, and customer counts reconcile to declared sources.", "Decision quality on retained contribution, profitable customer mix, and goal progress.", "Revenue growth alone is not healthy growth; do not fill missing costs with guessed values.") },
  { id: "pricing_strategy", name: "Pricing Strategy Agent", objective: "Evaluate pricing options without inventing willingness-to-pay evidence.", role: "cmo", defaultActions: ["research", "analyze_results", "refresh_plan", "note"], successMeasures: measures("Each option states its target buyer, value basis, margin impact, and a reversible test.", "Contribution per eligible buyer and conversion, measured across comparable groups or periods.", "Do not call a price optimal or willingness-to-pay validated without customer evidence.") },
  { id: "customer_research", name: "Customer Research Agent", objective: "Organize customer needs and feedback into testable insights.", role: "data_analyst", defaultActions: ["research", "analyze_results", "note"], successMeasures: measures("Themes preserve verbatim evidence, cohort, sample size, and disagreement without overstating prevalence.", "A follow-up test that validates a need or changes offer, product, or segment decisions.", "Interview frequency is not market prevalence; anecdotes remain qualitative evidence.") },
  { id: "customer_retention", name: "Customer Retention Agent", objective: "Identify measurable ways to help customers stay and return.", role: "customer_success_manager", defaultActions: ["refresh_plan", "research", "analyze_results", "email_send", "note"], successMeasures: measures("A retention action targets a defined customer cohort, trigger, reason, and eligible contact path.", "Incremental renewal, repeat purchase, or retained contribution against a comparable cohort.", "Do not infer churn causes from aggregate loss counts or contact customers without permission.") },
  { id: "product_growth", name: "Product Growth Agent", objective: "Improve activation and product adoption from available evidence.", role: "cmo", defaultActions: ["research", "analyze_results", "refresh_plan", "note"], successMeasures: measures("Activation means the owner's defined first value, not setup completion; the change and cohort are explicit.", "More eligible new users reach first value and later paid or retained outcome.", "Signups or feature usage alone do not prove customer value or retention.") },
  { id: "analytics_attribution", name: "Analytics & Attribution Agent", objective: "Check metric definitions, data quality, and channel attribution.", role: "data_analyst", defaultActions: ["analyze_results", "research", "note"], successMeasures: measures("Metrics state numerator, denominator, period, currency, coverage, source, and attribution method.", "A decision uses reconciled, sufficiently complete measurement with uncertainty stated.", "Association and platform reporting are not causal lift; missing tags are not zero impact.") },
  { id: "forecasting", name: "Forecasting Agent", objective: "Explain bounded scenarios and uncertainty from measured inputs.", role: "data_analyst", defaultActions: ["analyze_results", "refresh_plan", "note"], successMeasures: measures("Scenarios reproduce from tagged inputs and distinguish owner data, assumptions, ranges, and unknowns.", "Forecast calibration against later comparable actuals, tracked by horizon and outcome.", "A scenario range is not a confidence interval or promise unless calibrated evidence supports that claim.") },
  { id: "marketing_creative", name: "Marketing Creative Agent", objective: "Create on-brand campaign concepts and useful variants.", role: "creative_director", defaultActions: ["generate_content", "research", "note"], successMeasures: measures("Concepts are on-brand, distinct, audience-relevant, and fact-checked against approved evidence.", "The chosen concept improves the campaign's primary qualified response or purchase measure in a valid test.", "Aesthetic preference or engagement does not establish commercial lift.") },
  { id: "quality_assurance", name: "Quality Assurance Agent", objective: "Check evidence, accuracy, policy, and readiness before approval.", role: "coo", defaultActions: ["research", "analyze_results", "note"], successMeasures: measures("All critical claims, calculations, permissions, dependencies, and execution states pass explicit checks.", "Fewer escaped material errors or unsafe actions, tracked against reviewed work.", "A passed checklist does not prove strategy effectiveness or authorize execution.") },
]);

export function archetypeInstruction(agent: AgentArchetype): string {
  const m = agent.successMeasures;
  return `BUILT-IN SPECIALIST: ${agent.name}\nObjective: ${agent.objective}\nRole: ${agent.role}.\nSuccess contract — output quality: ${m.outputQuality}\nBusiness outcome: ${m.businessOutcome}\nGuardrail: ${m.guardrail}\nUse the relevant existing ClimbOS capabilities; do not imply tools or data were used unless the workflow actually provides them. Use only available measurements with their source, cohort, period, and denominator; if the business outcome cannot be measured from available data, name the next measurement instead of inventing a baseline, target, or result. A success contract guides evaluation and does not authorize external actions.`;
}

export const AGENT_ARCHETYPE_BY_ID = new Map(AGENT_ARCHETYPES.map((agent) => [agent.id, agent]));
export const READ_ONLY_ACTIONS = researchActions;
export const DRAFT_ACTIONS = allDraftActions;

/** Assign each coordinator-approved action to the smallest matching built-in specialist. */
export function agentForAction(kind: string, channel = "", brief = ""): AgentArchetype | null {
  const normalizedChannel = channel.trim().toLowerCase();
  const normalizedBrief = brief.toLowerCase();
  const mentions = (...terms: string[]) => terms.some((term) => normalizedBrief.includes(term));
  const lifecycleIntent = mentions(...LIFECYCLE_INTENT);
  const productActivationIntent = mentions("product adoption", "activation", "onboarding", "product led", "user activation");
  let id: string | undefined;
  if (kind === "refresh_plan") {
    if (mentions("go to market", "go-to-market", "launch", "market entry")) id = "gtm_strategy";
    else if (mentions("diagnos", "root cause", "biggest problem", "business weakness")) id = "business_diagnosis";
    else if (mentions("price", "packaging", "monetiz")) id = "pricing_strategy";
    else if (productActivationIntent) id = "product_growth";
    else if (lifecycleIntent) id = "customer_retention";
    else id = "chief_growth_strategist";
  }
  else if (kind === "generate_content") {
    if (["email", "lifecycle_email"].includes(normalizedChannel)) id = lifecycleIntent ? "lifecycle_marketing" : "email_marketing";
    else if (["google_search_ad", "meta_ad", "ads"].includes(normalizedChannel)) id = "performance_marketing";
    else if (["blog", "website", "seo"].includes(normalizedChannel)) id = mentions("aeo", "geo", "answer engine", "ai search") ? "aeo_geo_intelligence" : mentions("technical seo", "search console", "ranking") ? "seo_intelligence" : "content_marketing";
    else if (mentions("press release", "media pitch", "public announcement", "crisis response")) id = "pr_communications";
    else if (mentions("product launch", "positioning", "product messaging")) id = "product_marketing";
    else if (mentions("brand voice", "brand awareness", "brand campaign")) id = "brand_marketing";
    else if (mentions("creative concept", "visual concept", "creative variant")) id = "marketing_creative";
    else id = "social_media_marketing";
  } else if (kind === "research") {
    if (mentions("competitor", "competitive", "alternative", "comparison")) id = "competitive_intelligence";
    else if (mentions("aeo", "geo", "answer engine", "ai search visibility")) id = "aeo_geo_intelligence";
    else if (mentions("technical seo", "search console", "keyword", "search ranking")) id = "seo_intelligence";
    else if (mentions("pricing", "price", "packaging", "willingness to pay")) id = "pricing_strategy";
    else if (mentions("sales", "deal", "pipeline", "buyer signal", "objection")) id = "sales_intelligence";
    else if (productActivationIntent) id = "product_growth";
    else if (lifecycleIntent) id = "customer_retention";
    else if (mentions("conversion", "landing page", "funnel", "checkout")) id = "conversion_optimization";
    else if (mentions("customer", "interview", "review", "feedback", "satisfaction")) id = "customer_research";
    else if (mentions("product", "positioning", "differentiation")) id = "product_marketing";
    else if (mentions("partnership", "affiliate", "co-marketing", "distribution partner")) id = "partnership_marketing";
    else if (mentions("event", "conference", "webinar", "local campaign")) id = "field_marketing";
    else if (mentions("brand", "messaging", "reputation", "press")) id = "brand_marketing";
    else if (mentions("diagnos", "root cause", "business weakness", "bottleneck")) id = "business_diagnosis";
    else if (mentions("swot", "strategic analysis", "strengths and weaknesses")) id = "swot_strategic_analysis";
    else id = "market_research";
  } else if (kind === "analyze_results") {
    if (mentions("forecast", "revenue projection", "scenario")) id = "forecasting";
    else if (mentions("revenue", "profit", "margin", "unit economics")) id = "revenue_intelligence";
    else if (mentions("sales", "deal", "pipeline", "buyer signal")) id = "sales_intelligence";
    else if (mentions("retention", "churn", "renewal")) id = "customer_retention";
    else if (mentions("paid campaign", "ad spend", "roas", "cost per acquisition")) id = "performance_marketing";
    else id = "analytics_attribution";
  } else if (kind === "find_customers") id = mentions("partner", "affiliate", "co-marketing") ? "partnership_marketing" : "lead_intelligence";
  else if (kind === "schedule_content") id = "social_media_marketing";
  else if (kind === "ad_change") id = "performance_marketing";
  else if (kind === "email_send") id = "email_marketing";
  else if (kind === "note") id = "quality_assurance";
  const candidate = id ? AGENT_ARCHETYPE_BY_ID.get(id) ?? null : null;
  return candidate?.defaultActions.includes(kind as AgentAction) ? candidate : null;
}
