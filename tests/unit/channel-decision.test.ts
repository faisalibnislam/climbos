import { describe, expect, it } from "vitest";
import { channelDecisionFrom, type ChannelDecision } from "../../shared/acquisition/channelDecision";
import { adjustmentsFrom, scoreChannels, scorecardText } from "../../shared/acquisition/scoring";

const decision: ChannelDecision = { firstStep: "Inspect a recent workflow demonstration before proposing coverage.", unknowns: ["Audience fit and editorial interest are not verified."], setupSteps: ["Prepare a working demonstration before contacting anyone."], ownerHoursPerWeek: null, effortBasis: "unknown", smallestCheck: "Compare one creator's coverage with the buyer's actual task.", changeCourseIf: "The coverage is generic technology news with no relevant workflow.", alternative: "Compare a specialist user community after checking its participation rules." };

describe("channel advice preserves decisions and uncertainty", () => {
  it("keeps time unknown unless the allocation is explicitly labeled", () => {
    expect(channelDecisionFrom(decision)).toEqual(decision);
    expect(channelDecisionFrom({ ...decision, ownerHoursPerWeek: 3 })).toBeUndefined();
    expect(channelDecisionFrom({ ...decision, effortBasis: "planned" })).toBeUndefined();
    expect(channelDecisionFrom({ ...decision, ownerHoursPerWeek: 3, effortBasis: "planned" })).toMatchObject({ ownerHoursPerWeek: 3, effortBasis: "planned" });
    expect(channelDecisionFrom({ ...decision, unknowns: [] })).toBeUndefined();
    expect(channelDecisionFrom(undefined)).toBeUndefined();
  });
  it("carries the concrete check through sanitizing and ranking, without assuming channel fit", () => {
    const row = { id: "R21", deltas: [0, 0, 0, 0, 0, 0, 0, 0], reason: "Check the proposed workflow fit.", evidence: "No verified audience evidence supplied.", platform: "YouTube", tactic: "Earned workflow coverage", audience: "Mac workflow users", decisionBrief: decision };
    const adjustments = adjustmentsFrom({ channels: [{ ...row, decisionBrief: undefined }], decisions: [{ id: "R21", decisionBrief: decision }] }, { sourceUrls: [] });
    const ranked = scoreChannels({ types: ["desktop_app"], budgetUsd: 0, horizonDays: 90, dims: {} }, adjustments).find((channel) => channel.id === "R21");
    expect(ranked?.decisionBrief).toEqual(decision);
    expect(ranked?.status).toBe("not_now");
    expect(scorecardText([ranked!])).toContain(decision.smallestCheck);
    expect(scorecardText([ranked!])).toContain("weekly owner hours: unknown (unknown)");
  });
});
