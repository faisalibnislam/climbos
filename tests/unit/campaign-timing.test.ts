import { describe, expect, it } from "vitest";
import { lintCampaignTiming, type CampaignTiming } from "../../shared/agents/campaignTiming";
import { playsTask } from "../../shared/agents/planTasks";

const url = "https://official.example/holidays/2026";
const claim = "The local Thanksgiving Friday shopping event is November 27, 2026.";
const facts = ["We need 14 days to prepare the campaign, 2 days to fulfill additional bookings, and can serve ten additional bookings.", "Owner confirms the business serves the New York metro area."];
const base: CampaignTiming = {
  decision: "proceed",
  proposedWindow: { startDate: "2026-11-20", endDate: "2026-11-27" },
  timezone: "America/New_York",
  timezoneBasis: "Use the workspace timezone for campaign planning; the event source and served area are New York local.",
  timezoneEvidenceRef: null,
  geographyBasis: "Owner confirms the business serves the New York metro area.",
  geographyEvidenceRef: "fact:1",
  moment: { name: "Thanksgiving shopping period", businessReason: "Local buyers may be preparing for seasonal home projects, which fits this service's booking objective.", evidence: [{ basis: "source_reported", reference: url, sourceUrl: url, publishedDate: "2026-01-10", eventDate: "2026-11-27", claim }] },
  preparation: { leadTimeDays: 14, deliveryLeadTimeDays: 2, feasible: true, basis: "We need 14 days to prepare the campaign", evidenceRef: "fact:0", deliveryBasis: "2 days to fulfill additional bookings", deliveryEvidenceRef: "fact:0" },
  capacity: { status: "available", basis: "can serve ten additional bookings", evidenceRef: "fact:0" },
  assumptions: [],
  unknowns: [],
  rationale: "The date aligns with a locally relevant buying period, and preparation plus service capacity are confirmed.",
};

function context(overrides: Partial<Parameters<typeof lintCampaignTiming>[1]> = {}) {
  return {
    today: "2026-10-20",
    timezone: "America/New_York",
    facts,
    researchNotes: `Official calendar: ${claim}\n${url}`,
    sourceUrls: [url],
    researchRetrievedAt: Date.now(),
    ...overrides,
  };
}

describe("campaign timing recommendations", () => {
  it("allows a locally relevant holiday with supported dates, enough preparation time, and capacity", () => {
    expect(lintCampaignTiming(base, context())).toEqual([]);
  });

  it("rejects proceeding when the event is too close for preparation", () => {
    const tooClose = { ...base, proposedWindow: { startDate: "2026-10-25", endDate: "2026-10-27" }, moment: { ...base.moment, evidence: [{ ...base.moment.evidence[0], eventDate: "2026-10-27", claim: "The local event is October 27, 2026." }] } };
    expect(lintCampaignTiming(tooClose, context({ researchNotes: `The local event is October 27, 2026.\n${url}` })).some((issue) => /lead time exceeds|too close/u.test(issue.message))).toBe(true);
  });

  it("keeps unknown geography and timezone explicit without inventing a local event window", () => {
    const unknown = { ...base, decision: "not_enough_evidence" as const, proposedWindow: null, timezone: null, timezoneBasis: "Business-local timezone unknown; the workspace setting is not enough to identify the served market.", timezoneEvidenceRef: null, geographyBasis: "Served geography and timezone are unknown.", geographyEvidenceRef: null, moment: { name: null, businessReason: "No local event can be selected without audience geography.", evidence: [] }, preparation: { leadTimeDays: null, deliveryLeadTimeDays: null, feasible: null, basis: "Unknown until the owner confirms readiness.", evidenceRef: null, deliveryBasis: "Delivery timing unknown.", deliveryEvidenceRef: null }, capacity: { status: "unknown" as const, basis: "No capacity data is available.", evidenceRef: null }, unknowns: ["served geography", "timezone", "capacity", "preparation lead time"], rationale: "Keep the recommendation geography-neutral until those inputs are known." };
    expect(lintCampaignTiming(unknown, context({ timezone: undefined }))).toEqual([]);
    expect(lintCampaignTiming({ ...unknown, decision: "proceed", proposedWindow: base.proposedWindow, moment: base.moment, preparation: base.preparation, capacity: base.capacity }, context({ timezone: undefined })).some((issue) => /served geography is unknown/u.test(issue.message))).toBe(true);
  });

  it("rejects a named served market that is not grounded in an owner fact or retrieved source", () => {
    const unsupported = { ...base, geographyBasis: "The business serves the Boston metro area.", geographyEvidenceRef: null };
    expect(lintCampaignTiming(unsupported, context()).some((issue) => /served-geography basis/u.test(issue.message))).toBe(true);
    const wrongReference = { ...base, geographyBasis: "The business serves the Boston metro area.", geographyEvidenceRef: "fact:0" };
    expect(lintCampaignTiming(wrongReference, context()).some((issue) => /quote an exact owner fact/u.test(issue.message))).toBe(true);
  });

  it("does not recommend an irrelevant holiday just because it is on the calendar", () => {
    const evergreen = { ...base, decision: "not_relevant" as const, proposedWindow: null, moment: { name: null, businessReason: "This evergreen referral workflow has no holiday-linked customer mechanism.", evidence: [] } };
    expect(lintCampaignTiming(evergreen, context())).toEqual([]);
  });

  it("blocks a proceed recommendation when delivery capacity is constrained", () => {
    const constrained = { ...base, capacity: { status: "constrained" as const, basis: "no additional booking availability", evidenceRef: "fact:0" } };
    expect(lintCampaignTiming(constrained, context({ facts: ["The owner reports no additional booking availability."] })).some((issue) => /known available capacity/u.test(issue.message))).toBe(true);
  });

  it("rejects a capacity label that contradicts its cited evidence", () => {
    const contradiction = { ...base, capacity: { status: "available" as const, basis: "no additional booking availability", evidenceRef: "fact:0" } };
    expect(lintCampaignTiming(contradiction, context({ facts: ["The owner reports no additional booking availability."] })).some((issue) => /labeled available/u.test(issue.message))).toBe(true);
  });

  it("requires no proposed date when evidence is stale or conflicting", () => {
    const stale = { ...base, decision: "not_enough_evidence" as const, proposedWindow: null, preparation: { ...base.preparation, feasible: null } };
    expect(lintCampaignTiming(stale, context({ researchRetrievedAt: Date.now() - 48 * 60 * 60_000 }))).toEqual([]);
    const conflict = { ...stale, moment: { ...stale.moment, evidence: [...stale.moment.evidence, { ...stale.moment.evidence[0], sourceUrl: "https://other.example/dates", reference: "https://other.example/dates", eventDate: "2026-11-28", claim: "The local event is November 28, 2026." }] } };
    expect(lintCampaignTiming(conflict, context({ sourceUrls: [url, "https://other.example/dates"], researchNotes: `${claim}\nThe local event is November 28, 2026.\n${url}\nhttps://other.example/dates` })).some((issue) => /Conflicting source dates/u.test(issue.message))).toBe(false);
    expect(lintCampaignTiming({ ...conflict, proposedWindow: { startDate: "2026-11-20", endDate: "2026-11-28" } }, context({ sourceUrls: [url, "https://other.example/dates"], researchNotes: `${claim}\nThe local event is November 28, 2026.\n${url}\nhttps://other.example/dates` })).some((issue) => /Conflicting event dates cannot support/u.test(issue.message))).toBe(true);
    expect(lintCampaignTiming({ ...conflict, decision: "proceed", proposedWindow: { startDate: "2026-11-20", endDate: "2026-11-28" } }, context({ sourceUrls: [url, "https://other.example/dates"], researchNotes: `${claim}\nThe local event is November 28, 2026.\n${url}\nhttps://other.example/dates` })).some((issue) => /Conflicting source dates/u.test(issue.message))).toBe(true);
    expect(lintCampaignTiming({ ...stale, proposedWindow: { startDate: "2026-11-20", endDate: "2026-11-27" } }, context()).some((issue) => /When timing evidence is insufficient/u.test(issue.message))).toBe(true);
  });

  it("keeps timing advisory and preserves owner approval as the action gate", () => {
    const task = playsTask({ scorecard: "", insights: "", timingContext: { today: "2026-10-20", timezone: "America/New_York" } });
    expect(task).toContain("This is advice only: do not schedule, send, publish, or spend.");
    expect(task).toContain("fits this business’s audience, offer, objective, and channel");
    expect(task).not.toContain("automatically publish");
  });
});
