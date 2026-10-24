import { describe, expect, it } from "vitest";
import { AGENT_ARCHETYPES, agentForAction } from "../../shared/agents/registry";

describe("specialist registry", () => {
  it("maps all 30 requested specialist identities to reusable ClimbOS roles", () => {
    expect(AGENT_ARCHETYPES).toHaveLength(30);
    expect(new Set(AGENT_ARCHETYPES.map((agent) => agent.id)).size).toBe(30);
    expect(AGENT_ARCHETYPES.every((agent) => agent.name && agent.objective && agent.role && agent.defaultActions.length)).toBe(true);
  });

  it("routes coordinator actions to the smallest relevant built-in specialist", () => {
    expect(agentForAction("generate_content", "instagram")?.id).toBe("social_media_marketing");
    expect(agentForAction("generate_content", "email")?.id).toBe("email_marketing");
    expect(agentForAction("research", "", "Compare our competitors")?.id).toBe("competitive_intelligence");
    expect(agentForAction("research", "", "Review customer feedback")?.id).toBe("customer_research");
    expect(agentForAction("analyze_results")?.id).toBe("analytics_attribution");
    expect(agentForAction("note")?.id).toBe("quality_assurance");
    expect(agentForAction("unsupported_action")).toBeNull();
    expect(agentForAction("connect_account")).toBeNull();
  });

  it("routes lifecycle journeys to retention expertise and ordinary newsletters to email marketing", () => {
    expect(agentForAction("generate_content", "email", "Recover abandoned carts with an opted-in email")?.id).toBe("lifecycle_marketing");
    expect(agentForAction("generate_content", "email", "Write a quarterly customer newsletter")?.id).toBe("email_marketing");
    expect(agentForAction("generate_content", "lifecycle_email", "Prepare a renewal and win-back journey")?.id).toBe("lifecycle_marketing");
    expect(agentForAction("research", "", "Investigate repeat purchase and churn")?.id).toBe("customer_retention");
    expect(agentForAction("refresh_plan", "", "Improve activation and onboarding")?.id).toBe("product_growth");
  });

  it("makes every built-in role reachable through a supported action", () => {
    const routed = [
      agentForAction("generate_content", "instagram"),
      agentForAction("generate_content", "", "Press release for our launch"),
      agentForAction("generate_content", "", "Product launch positioning"),
      agentForAction("generate_content", "meta_ad"),
      agentForAction("research", "", "Find affiliate partnerships"),
      agentForAction("generate_content", "email", "Onboarding sequence"),
      agentForAction("research", "", "Upcoming industry conference"),
      agentForAction("generate_content", "blog"),
      agentForAction("generate_content", "", "Brand voice campaign"),
      agentForAction("refresh_plan"),
      agentForAction("research", "", "Diagnose our growth bottleneck"),
      agentForAction("research"),
      agentForAction("research", "", "Compare competitors"),
      agentForAction("research", "", "Prepare a SWOT analysis"),
      agentForAction("refresh_plan", "", "Go-to-market launch"),
      agentForAction("research", "", "Technical SEO and keyword ranking"),
      agentForAction("research", "", "AI search visibility and AEO"),
      agentForAction("research", "", "Review the conversion funnel"),
      agentForAction("research", "", "Analyze sales pipeline objections"),
      agentForAction("find_customers"),
      agentForAction("generate_content", "email"),
      agentForAction("analyze_results", "", "Revenue and profit margin"),
      agentForAction("research", "", "Test pricing willingness to pay"),
      agentForAction("research", "", "Customer interview feedback"),
      agentForAction("research", "", "Customer churn and retention"),
      agentForAction("research", "", "Product adoption and activation"),
      agentForAction("analyze_results"),
      agentForAction("analyze_results", "", "Revenue forecast scenarios"),
      agentForAction("generate_content", "instagram", "Create a visual creative concept"),
      agentForAction("note"),
    ];
    expect(routed.map((agent) => agent?.id).sort()).toEqual(AGENT_ARCHETYPES.map((agent) => agent.id).sort());
  });
});
