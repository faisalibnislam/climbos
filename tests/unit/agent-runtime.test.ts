import { describe, expect, it } from "vitest";
import { ALTERNATIVE_DRAFT_ANGLE, CRITIC_RULES } from "../../shared/agents/runtime";

describe("alternative agent draft angle", () => {
  it("encourages original strategic options without inventing business scale", () => {
    expect(ALTERNATIVE_DRAFT_ANGLE).toContain("more original, higher-upside angle");
    expect(ALTERNATIVE_DRAFT_ANGLE).toContain("grounded, adjacent, and bold options");
    expect(ALTERNATIVE_DRAFT_ANGLE).toContain("do not suppress a bold idea");
    expect(ALTERNATIVE_DRAFT_ANGLE).toContain("Do not invent audience sizes");
    expect(ALTERNATIVE_DRAFT_ANGLE).toContain("leave them unknown or label them as assumptions to test");
    expect(ALTERNATIVE_DRAFT_ANGLE).toContain("state the gap instead of fabricating scale");
    expect(ALTERNATIVE_DRAFT_ANGLE).not.toContain("audiences in the thousands");
    expect(ALTERNATIVE_DRAFT_ANGLE).not.toContain("numbers that add up to the goal");
  });

  it("does not reward fabricated numeric targets when evidence is missing", () => {
    expect(CRITIC_RULES).toContain("Do not penalize a plan for leaving an unsupported volume or target unknown");
    expect(CRITIC_RULES).toContain("define the smallest useful measurement");
    expect(CRITIC_RULES).not.toContain("with no committed volume or target, scores low");
  });
});
