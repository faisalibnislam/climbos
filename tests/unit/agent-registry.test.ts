import { describe, expect, it } from "vitest";
import { AGENT_ARCHETYPES } from "../../shared/agents/registry";

describe("specialist registry", () => {
  it("maps all 30 requested specialist identities to reusable ClimbOS roles", () => {
    expect(AGENT_ARCHETYPES).toHaveLength(30);
    expect(new Set(AGENT_ARCHETYPES.map((agent) => agent.id)).size).toBe(30);
    expect(AGENT_ARCHETYPES.every((agent) => agent.name && agent.objective && agent.role && agent.defaultActions.length)).toBe(true);
  });
});
