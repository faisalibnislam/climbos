import { describe, expect, it } from "vitest";
import { StrategyExplorationSchema } from "../../shared/agents/specs";
import { playsTask } from "../../shared/agents/planTasks";

const option = (title: string, ratings: [string, string, string, string, string]) => ({
  title,
  challengedConvention: "A category assumes customers only want familiar product launches.",
  whyConventionPersists: "Familiar launches are easier to explain and forecast.",
  costOfBreaking: "An unfamiliar format could confuse buyers or waste a small team's time.",
  businessMechanism: "Invite a tiny group of qualified customers to shape one original offer prototype.",
  businessAction: "Prepare a private prototype and ask a few consented buyers to react before any public release.",
  whyItCouldMatter: "Participation could surface a valuable job customers have not described in the usual feedback form.",
  customerBehavior: "A buyer offers a concrete use case, objection, or commitment to try the prototype.",
  audienceOrCondition: "Only if the business has permission to contact these customers and can safely fulfill a test.",
  evidenceBasis: "speculative_hypothesis",
  evidenceNote: "There is no business-specific evidence yet; this option is a hypothesis to test.",
  evidenceRefs: [],
  precedentIds: [],
  transferLogic: "No close precedent is claimed; the mechanism should be tested directly with this audience.",
  keyDifferences: "The small business's audience, capacity, and offer differ from documented large-company examples.",
  assumptions: ["A few customers will spend time on this."],
  uncertainties: ["The test may not reveal behavior beyond the participants."],
  risks: ["The prototype could create expectations the business cannot meet."],
  costAndCapacity: "One owner hour; no paid media; no delivery commitment.",
  novelty: ratings[0],
  evidenceStrength: ratings[1],
  businessFit: ratings[2],
  feasibility: ratings[3],
  risk: ratings[4],
  reversibleTest: {
    method: "Show a private mockup to three consented target buyers before building anything.",
    metric: "Qualified buyers who identify a concrete use case and next step",
    duration: "One week",
    resourceLimit: "One owner hour; no external publishing or spend",
    continueIf: "At least one target buyer describes a concrete use case and agrees to a scoped follow-up.",
    changeIf: "Buyers understand the concept but describe a different use case.",
    stopIf: "No target buyer finds it relevant or any privacy or fulfillment concern appears.",
  },
});

describe("protected strategy exploration", () => {
  it("accepts a bold option with no precedent and low evidence, fit, and feasibility", () => {
    const parsed = StrategyExplorationSchema.safeParse({
      grounded: option("Use current customer evidence", ["low", "high", "high", "high", "low"]),
      adjacent: option("Transfer a different feedback format", ["medium", "medium", "medium", "medium", "medium"]),
      bold: option("Reverse the usual launch order", ["high", "low", "low", "low", "high"]),
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.bold.precedentIds).toEqual([]);
      expect(parsed.data.bold.evidenceStrength).toBe("low");
      expect(parsed.data.bold.businessFit).toBe("low");
      expect(parsed.data.bold.feasibility).toBe("low");
      expect(parsed.data.bold.novelty).toBe("high");
    }
  });

  it("instructs growth planning to keep the three modes outside execution scoring", () => {
    const task = playsTask({ scorecard: "", insights: "", horizonDays: 60 });
    expect(task).toContain("grounded, adjacent, and bold");
    expect(task).toContain("no direct precedent");
    expect(task).toContain("Do not assign a single score");
    expect(task).toContain("why it persists");
    expect(task).toContain("key differences");
    expect(task).toContain("continue/change/stop evidence");
    expect(task).not.toContain("do not force filler when diagnosis or business fit does not support one");
  });

  it.each([
    ["balanced", "default balanced range"],
    ["conventional", "more conventional overall portfolio"],
    ["surprising", "more surprising options"],
    ["ambitious", "more ambitious options"],
  ] as const)("honors the %s creativity preference without dropping bold", (creativeRange, expected) => {
    const task = playsTask({ scorecard: "", insights: "", creativeRange });
    expect(task).toContain(expected);
    expect(task).toContain("Always return the grounded, adjacent, and bold exploration modes");
    expect(task).toContain("Never omit or hide bold because of those ratings");
  });
});
