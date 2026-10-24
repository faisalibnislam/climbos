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
  });
});
