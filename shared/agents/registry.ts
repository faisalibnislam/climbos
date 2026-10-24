import type { RoleKey } from "../economics/roles";

/** Stable role catalogue: several owner-facing specialists may share one priced execution role. */
export interface AgentArchetype {
  id: string;
  name: string;
  objective: string;
  role: RoleKey;
  defaultActions: readonly string[];
}

export const AGENT_ACTIONS = [
  "generate_content", "refresh_plan", "research", "analyze_results", "schedule_content",
  "ad_change", "email_send", "connect_account", "set_up_autopilot", "find_customers", "note",
] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

const allDraftActions: readonly AgentAction[] = ["generate_content", "refresh_plan", "research", "analyze_results", "schedule_content", "ad_change", "email_send", "find_customers", "note"];
const researchActions: readonly AgentAction[] = ["research", "analyze_results", "note"];

/** The 30 specialized identities requested in Issues 381–410 map to reusable priced ClimbOS roles. */
export const AGENT_ARCHETYPES: readonly AgentArchetype[] = Object.freeze([
  { id: "social_media_marketing", name: "Social Media Marketing Agent", objective: "Plan, draft, and learn from social content.", role: "social_media_manager", defaultActions: ["generate_content", "research", "analyze_results", "note"] },
  { id: "pr_communications", name: "PR & Communications Agent", objective: "Prepare accurate public announcements and communications.", role: "creative_director", defaultActions: ["generate_content", "research", "note"] },
  { id: "product_marketing", name: "Product Marketing Agent", objective: "Clarify product positioning, differentiation, and adoption.", role: "cmo", defaultActions: ["refresh_plan", "research", "generate_content", "note"] },
  { id: "performance_marketing", name: "Performance Marketing Agent", objective: "Improve paid campaign plans using budget and conversion evidence.", role: "ads_manager", defaultActions: ["ad_change", "research", "analyze_results", "note"] },
  { id: "partnership_marketing", name: "Partnership Marketing Agent", objective: "Find and prepare relevant partnership opportunities.", role: "cso", defaultActions: ["find_customers", "research", "note"] },
  { id: "lifecycle_marketing", name: "Lifecycle Marketing Agent", objective: "Improve opt-in onboarding, engagement, and retention journeys.", role: "customer_success_manager", defaultActions: ["email_send", "research", "analyze_results", "note"] },
  { id: "field_marketing", name: "Field Marketing Agent", objective: "Plan useful local campaigns, events, and community activity.", role: "cmo", defaultActions: ["research", "generate_content", "note"] },
  { id: "content_marketing", name: "Content Marketing Agent", objective: "Plan useful, evidence-led educational content.", role: "seo_specialist", defaultActions: ["generate_content", "research", "analyze_results", "note"] },
  { id: "brand_marketing", name: "Brand Marketing Agent", objective: "Keep positioning and customer-facing messaging consistent.", role: "creative_director", defaultActions: ["generate_content", "refresh_plan", "note"] },
  { id: "chief_growth_strategist", name: "Chief Growth Strategist", objective: "Coordinate priorities around the owner's growth goal.", role: "ceo", defaultActions: ["refresh_plan", "research", "analyze_results", "note"] },
  { id: "business_diagnosis", name: "Business Diagnosis Agent", objective: "Identify the best-supported business bottleneck and unknowns.", role: "data_analyst", defaultActions: ["research", "analyze_results", "note"] },
  { id: "market_research", name: "Market Research Agent", objective: "Investigate market demand using traceable sources.", role: "data_analyst", defaultActions: ["research", "note"] },
  { id: "competitive_intelligence", name: "Competitive Intelligence Agent", objective: "Compare alternatives and threats with sourced evidence.", role: "cmo", defaultActions: ["research", "analyze_results", "note"] },
  { id: "swot_strategic_analysis", name: "SWOT & Strategic Analysis Agent", objective: "Build a source-backed assessment of strengths, gaps, opportunities, and risks.", role: "ceo", defaultActions: ["research", "analyze_results", "refresh_plan", "note"] },
  { id: "gtm_strategy", name: "GTM Strategy Agent", objective: "Plan a measurable launch or market-entry path.", role: "cmo", defaultActions: ["refresh_plan", "research", "generate_content", "note"] },
  { id: "seo_intelligence", name: "SEO Intelligence Agent", objective: "Find technical and content improvements for organic search.", role: "seo_specialist", defaultActions: ["research", "analyze_results", "generate_content", "note"] },
  { id: "aeo_geo_intelligence", name: "AEO/GEO Intelligence Agent", objective: "Assess answer-search content readiness without promising citations.", role: "seo_specialist", defaultActions: ["research", "analyze_results", "generate_content", "note"] },
  { id: "conversion_optimization", name: "Conversion Optimization Agent", objective: "Find and prioritize measurable improvements to conversion paths.", role: "cmo", defaultActions: ["research", "analyze_results", "generate_content", "note"] },
  { id: "sales_intelligence", name: "Sales Intelligence Agent", objective: "Summarize buyer signals, objections, and pipeline risks.", role: "cso", defaultActions: ["research", "analyze_results", "find_customers", "note"] },
  { id: "lead_intelligence", name: "Lead Intelligence Agent", objective: "Prepare evidenced prospect research and qualification.", role: "cso", defaultActions: ["find_customers", "research", "note"] },
  { id: "email_marketing", name: "Email Marketing Agent", objective: "Prepare useful email for people the business may contact.", role: "customer_success_manager", defaultActions: ["email_send", "research", "analyze_results", "note"] },
  { id: "revenue_intelligence", name: "Revenue Intelligence Agent", objective: "Explain revenue and profitability patterns from available measurements.", role: "data_analyst", defaultActions: ["analyze_results", "refresh_plan", "note"] },
  { id: "pricing_strategy", name: "Pricing Strategy Agent", objective: "Evaluate pricing options without inventing willingness-to-pay evidence.", role: "cmo", defaultActions: ["research", "analyze_results", "refresh_plan", "note"] },
  { id: "customer_research", name: "Customer Research Agent", objective: "Organize customer needs and feedback into testable insights.", role: "data_analyst", defaultActions: ["research", "analyze_results", "note"] },
  { id: "customer_retention", name: "Customer Retention Agent", objective: "Identify measurable ways to help customers stay and return.", role: "customer_success_manager", defaultActions: ["research", "analyze_results", "email_send", "note"] },
  { id: "product_growth", name: "Product Growth Agent", objective: "Improve activation and product adoption from available evidence.", role: "cmo", defaultActions: ["research", "analyze_results", "refresh_plan", "note"] },
  { id: "analytics_attribution", name: "Analytics & Attribution Agent", objective: "Check metric definitions, data quality, and channel attribution.", role: "data_analyst", defaultActions: ["analyze_results", "research", "note"] },
  { id: "forecasting", name: "Forecasting Agent", objective: "Explain bounded scenarios and uncertainty from measured inputs.", role: "data_analyst", defaultActions: ["analyze_results", "refresh_plan", "note"] },
  { id: "marketing_creative", name: "Marketing Creative Agent", objective: "Create on-brand campaign concepts and useful variants.", role: "creative_director", defaultActions: ["generate_content", "research", "note"] },
  { id: "quality_assurance", name: "Quality Assurance Agent", objective: "Check evidence, accuracy, policy, and readiness before approval.", role: "coo", defaultActions: ["research", "analyze_results", "note"] },
]);

export const AGENT_ARCHETYPE_BY_ID = new Map(AGENT_ARCHETYPES.map((agent) => [agent.id, agent]));
export const READ_ONLY_ACTIONS = researchActions;
export const DRAFT_ACTIONS = allDraftActions;
