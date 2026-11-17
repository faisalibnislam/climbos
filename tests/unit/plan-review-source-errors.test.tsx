import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanReviewCard } from "../../src/components/app/plan/PlanActions";
import type { Id } from "../../convex/_generated/dataModel";
import type { AgentQuality } from "../../shared/agents/quality";

vi.mock("convex/react", () => ({ useMutation: vi.fn(() => vi.fn()), useQuery: vi.fn() }));

const agent = (errors: Record<string, number>): AgentQuality => ({ agentId: "growth_strategy", shipped: false, gatesPassed: true, average: 4, rounds: 1, researchSources: null, errors });
const render = (errors: Record<string, number>) => renderToStaticMarkup(<PlanReviewCard slug="test" strategyId={"strategy" as Id<"strategies">} version={1} canApprove prepared quality={{ state: "provisional", reasons: ["An older review left a minor finding."], agents: [agent(errors)] }} />);

describe("saved strategy source errors in owner review", () => {
  it("explains the current block instead of offering approval for an old provisional label", () => {
    const html = render({ exploration_evidence: 1 });
    expect(html).toContain("AI needs to fix this draft");
    expect(html).toContain("A recorded check still blocks this draft.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Use this plan/);
    expect(html).toContain("Send back");
  });
  it("keeps provisional original ideas with no citation errors available for owner review", () => {
    const html = render({});
    expect(html).toContain("Ready to use this plan?");
    expect(html).not.toContain("A recorded check still blocks this draft.");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Use this plan/);
  });
});
