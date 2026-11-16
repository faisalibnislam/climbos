import type { CampaignTiming, CampaignTimingContext } from "../../shared/agents/campaignTiming";

export const timingUrl = "https://official.example/holidays/2026";
export const timingClaim = "The local Thanksgiving Friday shopping event is November 27, 2026.";
export const timingFacts = ["We need 14 days to prepare the campaign, 2 days to fulfill additional bookings, and can serve ten additional bookings.", "Owner confirms the business serves the New York metro area."];
export const campaignTimingFixture: CampaignTiming = {
  decision: "proceed",
  proposedWindow: { startDate: "2026-11-20", endDate: "2026-11-27" },
  timezone: "America/New_York",
  timezoneBasis: "Use the workspace timezone for campaign planning; the event source and served area are New York local.",
  timezoneEvidenceRef: null,
  geographyBasis: "Owner confirms the business serves the New York metro area.",
  geographyEvidenceRef: "fact:1",
  moment: { name: "Thanksgiving shopping period", businessReason: "Local buyers may be preparing for seasonal home projects, which fits this service's booking objective.", evidence: [{ basis: "source_reported", reference: timingUrl, sourceUrl: timingUrl, publishedDate: "2026-01-10", eventDate: "2026-11-27", claim: timingClaim }] },
  preparation: { leadTimeDays: 14, deliveryLeadTimeDays: 2, feasible: true, basis: "We need 14 days to prepare the campaign", evidenceRef: "fact:0", deliveryBasis: "2 days to fulfill additional bookings", deliveryEvidenceRef: "fact:0" },
  capacity: { status: "available", basis: "can serve ten additional bookings", evidenceRef: "fact:0" },
  assumptions: [],
  unknowns: [],
  rationale: "The date aligns with a locally relevant buying period, and preparation plus service capacity are confirmed.",
};

export function timingContextFixture(overrides: Partial<CampaignTimingContext> = {}) {
  return {
    today: "2026-10-20",
    timezone: "America/New_York",
    facts: timingFacts,
    researchNotes: `Official calendar: ${timingClaim}\n${timingUrl}`,
    sourceUrls: [timingUrl],
    researchRetrievedAt: Date.now(),
    ...overrides,
  };
}


export function evergreenTimingFixture(): CampaignTiming {
  return {
    decision: "not_relevant", proposedWindow: null, timezone: null,
    timezoneBasis: "No calendar timing applies.", timezoneEvidenceRef: null,
    geographyBasis: "No timing-sensitive geography is needed for this synthetic example.", geographyEvidenceRef: null,
    moment: { name: null, businessReason: "This private workflow test does not depend on a calendar event.", evidence: [] },
    preparation: { leadTimeDays: null, deliveryLeadTimeDays: null, feasible: null, basis: "No event preparation window applies.", evidenceRef: null, deliveryBasis: "No dated delivery is proposed.", deliveryEvidenceRef: null },
    capacity: { status: "unknown", basis: "No capacity data supplied.", evidenceRef: null },
    assumptions: [], unknowns: [], rationale: "The proposed workflow test is evergreen.",
  };
}

/** Synthetic relative calendar used by actual workflow tests; no real holiday claim. */
export function futureCampaignTimingFixture(): CampaignTiming {
  const startDate = new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + 38 * 86400000).toISOString().slice(0, 10);
  const timing = structuredClone(campaignTimingFixture);
  timing.proposedWindow = { startDate, endDate };
  timing.timezoneEvidenceRef = "fact:0"; timing.geographyEvidenceRef = "fact:0";
  timing.moment.name = "Synthetic local booking event";
  timing.moment.evidence[0] = { ...timing.moment.evidence[0], publishedDate: new Date().toISOString().slice(0, 10), eventDate: endDate, claim: `The synthetic local booking event is ${endDate}.` };
  return timing;
}
