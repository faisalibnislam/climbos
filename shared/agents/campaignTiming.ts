import { z } from "zod";
import type { LintIssue } from "./types";

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const TimingEvidenceSchema = z.object({
  basis: z.enum(["owner_reported", "measured", "source_reported"]),
  reference: z.string().min(1).max(500),
  sourceUrl: z.string().url().nullable(),
  publishedDate: DateSchema.nullable(),
  eventDate: DateSchema.nullable(),
  claim: z.string().min(1).max(500),
});

export const CampaignTimingSchema = z.object({
  decision: z.enum(["proceed", "prepare_first", "defer", "skip", "not_enough_evidence", "not_relevant"]),
  proposedWindow: z.object({ startDate: DateSchema, endDate: DateSchema }).nullable(),
  timezone: z.string().nullable(),
  timezoneBasis: z.string().min(1).max(240),
  timezoneEvidenceRef: z.string().nullable(),
  geographyBasis: z.string().min(1).max(240),
  geographyEvidenceRef: z.string().nullable(),
  moment: z.object({
    name: z.string().nullable(),
    businessReason: z.string().min(1).max(360),
    evidence: z.array(TimingEvidenceSchema).max(3),
  }),
  preparation: z.object({ leadTimeDays: z.number().int().min(0).max(365).nullable(), deliveryLeadTimeDays: z.number().int().min(0).max(365).nullable(), feasible: z.boolean().nullable(), basis: z.string().min(1).max(240), evidenceRef: z.string().nullable(), deliveryBasis: z.string().min(1).max(240), deliveryEvidenceRef: z.string().nullable() }),
  capacity: z.object({ status: z.enum(["available", "constrained", "unknown", "not_applicable"]), basis: z.string().min(1).max(240), evidenceRef: z.string().nullable() }),
  assumptions: z.array(z.string().min(1).max(200)).max(5),
  unknowns: z.array(z.string().min(1).max(200)).max(5),
  rationale: z.string().min(1).max(500),
});

export type CampaignTiming = z.infer<typeof CampaignTimingSchema>;

export function localToday(timezone: string, now = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export interface CampaignTimingContext {
  today: string;
  timezone?: string;
  facts: string[];
  researchNotes: string;
  sourceUrls: string[];
  researchRetrievedAt?: number;
}

function validDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000);
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}

function claimContainsDate(claim: string, isoDate: string): boolean {
  if (claim.includes(isoDate)) return true;
  const monthDate = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi;
  for (const match of claim.matchAll(monthDate)) {
    const parsed = Date.parse(`${match[1]} ${match[2]}, ${match[3]} UTC`);
    if (Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === isoDate) return true;
  }
  return false;
}

/** Domain checks for model-authored timing; all date math uses UTC-anchored local calendar dates. */
export function lintCampaignTiming(timing: CampaignTiming | undefined, context: CampaignTimingContext, path = "timingAssessment"): LintIssue[] {
  if (!timing) return [{ severity: "error", rule: "campaign_timing", message: "Every new growth play needs an explicit timing assessment; use not_relevant when dates do not affect it.", path }];
  const issues: LintIssue[] = [];
  const error = (message: string, suffix = "") => issues.push({ severity: "error", rule: "campaign_timing", message, path: suffix ? `${path}.${suffix}` : path });
  const { proposedWindow: window, moment } = timing;
  if (!validDate(context.today)) error("The application timing context must contain a valid local current date.");
  if (timing.decision !== "not_relevant" && timing.timezone && !validTimezone(timing.timezone)) error("Use a valid IANA timezone or leave it unknown.", "timezone");
  if (timing.decision !== "not_relevant" && context.timezone && timing.timezone !== context.timezone) {
    const ref = timing.timezoneEvidenceRef;
    const factIndex = ref ? /^fact:(\d+)$/.exec(ref)?.[1] : undefined;
    const fact = factIndex === undefined ? undefined : context.facts[Number(factIndex)];
    const source = ref && context.sourceUrls.includes(ref) ? context.researchNotes : undefined;
    const evidenceText = fact ?? source;
    if (!timing.timezone || !ref || !evidenceText?.includes(timing.timezone)) error("A business timezone that differs from the workspace setting needs an exact owner or source reference; otherwise use the workspace timezone as a stated planning basis or leave it unknown.", "timezoneEvidenceRef");
  }
  if (timing.decision !== "not_relevant" && timing.timezone === context.timezone && !timing.timezoneEvidenceRef && !/workspace/i.test(timing.timezoneBasis)) error("When using the workspace timezone without separate business-location evidence, label it as the workspace planning basis.", "timezoneBasis");
  if (timing.timezoneEvidenceRef) {
    const factIndex = /^fact:(\d+)$/.exec(timing.timezoneEvidenceRef)?.[1];
    const fact = factIndex === undefined ? undefined : context.facts[Number(factIndex)];
    const source = context.sourceUrls.includes(timing.timezoneEvidenceRef) ? context.researchNotes : undefined;
    if (!timing.timezone || !(fact ?? source)?.includes(timing.timezone)) error("Timezone evidence must resolve to an owner fact or source that states the timezone.", "timezoneEvidenceRef");
  }
  if (timing.geographyEvidenceRef) {
    const factIndex = /^fact:(\d+)$/.exec(timing.geographyEvidenceRef)?.[1];
    const fact = factIndex === undefined ? undefined : context.facts[Number(factIndex)];
    const source = context.sourceUrls.includes(timing.geographyEvidenceRef) ? context.researchNotes : undefined;
    const evidenceText = fact ?? source;
    if (!evidenceText || !evidenceText.includes(timing.geographyBasis)) error("Served geography must quote an exact owner fact or retrieved source claim.", "geographyEvidenceRef");
  }
  const geographyUnknown = /\b(?:unknown|not supplied|not confirmed)\b/i.test(timing.geographyBasis);
  if (timing.decision === "proceed" && timing.moment.name && geographyUnknown) error("A local or seasonal event cannot proceed while the served geography is unknown.", "geographyBasis");
  if (timing.decision === "proceed" && !geographyUnknown && !timing.geographyEvidenceRef) error("A dated campaign needs a fact or source reference for its served-geography basis.", "geographyEvidenceRef");
  if (timing.decision === "proceed" && !timing.timezone) error("Proceed requires a known timezone for interpreting the proposed local window.", "timezone");
  if (window && (!validDate(window.startDate) || !validDate(window.endDate) || window.endDate < window.startDate)) error("The proposed window must use real calendar dates in chronological order.", "proposedWindow");
  if (timing.decision === "not_relevant") {
    if (window || moment.name || moment.evidence.length) error("A not_relevant assessment cannot claim a dated event or campaign window.");
    return issues;
  }
  if (timing.decision === "proceed" && !window) error("Proceed requires an evidence-supported proposed window.", "proposedWindow");
  if (window && timing.decision === "proceed" && window.startDate < context.today) error("A proceed window cannot start before the current local date.", "proposedWindow.startDate");

  for (const [index, item] of moment.evidence.entries()) {
    const epath = `moment.evidence[${index}]`;
    if (item.basis === "source_reported") {
      if (!item.sourceUrl || !context.sourceUrls.some((url) => url === item.sourceUrl)) error("Cite an exact URL actually retrieved for this plan.", `${epath}.sourceUrl`);
      if (item.reference !== item.sourceUrl) error("The source evidence reference must match its exact source URL.", `${epath}.reference`);
      if (!context.researchNotes.includes(item.claim)) error("The supporting claim must appear verbatim in this run's research notes.", `${epath}.claim`);
      const stale = !context.researchRetrievedAt || context.researchRetrievedAt > Date.now() || Date.now() - context.researchRetrievedAt > 24 * 60 * 60_000;
      if (stale && timing.decision === "proceed") error("Date evidence is missing a fresh retrieval timestamp; do not recommend a dated campaign from stale or undated research.", epath);
      if (stale && window) error("Stale or undated research cannot support a proposed campaign window.", "proposedWindow");
      if (item.publishedDate && !validDate(item.publishedDate)) error("Use a valid publication date or leave it unknown.", `${epath}.publishedDate`);
      if (item.publishedDate && item.eventDate && Number(item.publishedDate.slice(0, 4)) < Number(item.eventDate.slice(0, 4)) - 1 && timing.decision === "proceed") error("The source publication date is too old to support a current event window.", `${epath}.publishedDate`);
    } else {
      const factIndex = /^fact:(\d+)$/.exec(item.reference)?.[1];
      const fact = factIndex === undefined ? undefined : context.facts[Number(factIndex)];
      if (!fact || !fact.includes(item.claim)) error("Owner-reported timing evidence must quote a supplied owner fact using its fact:N reference.", `${epath}.reference`);
    }
    if (item.eventDate && (!validDate(item.eventDate) || !claimContainsDate(item.claim, item.eventDate))) error("An event date must be valid and stated in its cited claim.", `${epath}.eventDate`);
    if (window && item.eventDate && (item.eventDate < window.startDate || item.eventDate > window.endDate)) error("The proposed window must contain the cited event date.", "proposedWindow");
  }

  const eventDates = new Set(moment.evidence.map((item) => item.eventDate).filter((date): date is string => Boolean(date)));
  if (timing.decision === "not_enough_evidence" && window) error("When timing evidence is insufficient, leave the proposed window unset.", "proposedWindow");
  if (eventDates.size > 1) {
    if (timing.decision !== "not_enough_evidence") error("Conflicting source dates require not_enough_evidence and must not be used to time a campaign.", "decision");
    if (window) error("Conflicting event dates cannot support a proposed campaign window.", "proposedWindow");
  }

  let availableDays: number | null = null;
  if (window && validDate(context.today) && validDate(window.startDate)) availableDays = daysBetween(context.today, window.startDate);
  const lead = timing.preparation.leadTimeDays;
  const deliveryLead = timing.preparation.deliveryLeadTimeDays;
  const validateLeadEvidence = (days: number | null, ref: string | null, basis: string, suffix: string, needPreparationTerm: boolean) => {
    if (days === null) return;
    const factIndex = ref ? /^fact:(\d+)$/.exec(ref)?.[1] : undefined;
    const fact = factIndex === undefined ? undefined : context.facts[Number(factIndex)];
    const source = ref && context.sourceUrls.includes(ref) ? context.researchNotes : undefined;
    const evidenceText = fact ?? source;
    if (!ref || !evidenceText) error("Lead times must cite an owner fact or a source actually retrieved for this plan.", `${suffix}.evidenceRef`);
    if (evidenceText && (!evidenceText.includes(basis) || !evidenceText.includes(String(days)) || (needPreparationTerm && !/prepare|preparation|lead time|ready|readiness/i.test(basis)))) error("The lead time and its basis must be supported by the cited evidence.", `${suffix}.leadTimeDays`);
  };
  validateLeadEvidence(lead, timing.preparation.evidenceRef, timing.preparation.basis, "preparation", true);
  validateLeadEvidence(deliveryLead, timing.preparation.deliveryEvidenceRef, timing.preparation.deliveryBasis, "preparation.delivery", false);
  if (deliveryLead === 0 && !/not applicable|no (?:physical )?delivery|digital/i.test(timing.preparation.deliveryBasis)) error("Use zero delivery days only when delivery is explicitly not applicable.", "preparation.deliveryBasis");
  const computedPreparationFeasible = availableDays !== null && lead !== null && deliveryLead !== null ? lead + deliveryLead <= availableDays : null;
  if (timing.preparation.feasible !== computedPreparationFeasible) error("Preparation feasibility must match the deterministic lead-time comparison; leave it unknown when a lead time or window is unknown.", "preparation.feasible");
  if (timing.decision === "proceed") {
    if (lead === null || deliveryLead === null) error("Proceed requires known preparation and delivery lead times; otherwise prepare first.", "preparation.leadTimeDays");
    else if (computedPreparationFeasible !== true) error("Preparation and delivery lead time exceed the days available; do not claim this timing is feasible.", "decision");
    if (timing.preparation.feasible !== true) error("Proceed requires preparation feasibility to be true.", "preparation.feasible");
    if (timing.capacity.status === "unknown" || timing.capacity.status === "constrained") error("Proceed requires known available capacity; unknown or constrained capacity must block the recommendation.", "capacity.status");
    if (timing.capacity.status === "available" && !timing.capacity.evidenceRef) error("Available capacity needs an owner or measured evidence reference.", "capacity.evidenceRef");
    if (timing.moment.name && !moment.evidence.length) error("A dated event or holiday needs current source evidence or a cited owner fact.", "moment.evidence");
    if (timing.moment.name && !moment.evidence.some((item) => item.eventDate)) error("A dated campaign window needs an exact event date supported by the cited evidence.", "moment.evidence");
  }
  if ((lead === null || deliveryLead === null) && timing.decision === "proceed") error("Unknown preparation or delivery time cannot be described as feasible.", "preparation");
  if (computedPreparationFeasible === false && timing.decision === "proceed") error("The date window is too close for the stated preparation and delivery time.", "decision");

  if ((timing.capacity.status === "available" || timing.capacity.status === "constrained") && timing.capacity.evidenceRef) {
    const factIndex = /^fact:(\d+)$/.exec(timing.capacity.evidenceRef)?.[1];
    const fact = factIndex === undefined ? undefined : context.facts[Number(factIndex)];
    const source = context.sourceUrls.includes(timing.capacity.evidenceRef) ? context.researchNotes : undefined;
    const evidenceText = fact ?? source;
    if (!evidenceText || !evidenceText.includes(timing.capacity.basis)) error("Capacity status must cite and quote an owner fact or retrieved source that supports it.", "capacity.evidenceRef");
    if (evidenceText && !/capacity|available|inventory|booking|booking|service|support|fulfil|fulfill|deliver|slots?|hours?|serve|stock/i.test(timing.capacity.basis)) error("Capacity basis must refer to a concrete delivery constraint.", "capacity.basis");
    const saysUnavailable = /\b(no|not|unavailable|sold out|fully booked|at capacity|cannot|can't|filled)\b/i.test(timing.capacity.basis);
    if (timing.capacity.status === "available" && saysUnavailable) error("Capacity is labeled available, but its cited basis says capacity is unavailable.", "capacity.status");
    if (timing.capacity.status === "constrained" && !saysUnavailable && !/only \d+|limited|few remaining|nearly full/i.test(timing.capacity.basis)) error("Capacity is labeled constrained, but its cited basis does not describe a limit.", "capacity.status");
  }
  if (timing.capacity.status === "unknown" && !timing.unknowns.length) error("Unknown capacity must be stated as an uncertainty.", "unknowns");
  if (moment.evidence.some((item) => item.basis === "source_reported" && (!context.researchRetrievedAt || Date.now() - context.researchRetrievedAt > 24 * 60 * 60_000)) && timing.decision === "proceed") error("A dated campaign cannot proceed on stale or undated evidence.", "decision");
  return issues;
}

