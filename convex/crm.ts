import { initialDealHistory, advanceDealHistory } from "./lib/dealHistory";
import { DEAL_HISTORY_LIMITATIONS } from "../shared/growth/dealHistory";
import { QUALIFICATION_TOPICS, QUALIFICATION_LIMITATIONS, QualificationObservationSchema } from "../shared/growth/dealQualification";
import { validProgressDate } from "../shared/growth/customerProgress";
import { qualificationTopicV, qualificationStateV } from "./lib/dealQualification";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { DEAL_VALUE_VERSION, dealAttention, dealDueDate, dealTimezone, isDealDate, isDealTimestamp, dealValueMinor, dealValueNeedsReview, summarizeDealValues } from "../shared/growth/pipeline";
import { minorToMajor } from "../shared/economics/currency";
import { can, sha256Hex } from "../shared/policy";
import { audit } from "./lib/audit";
import { emitEvent } from "./webhooks";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Mini-CRM: a simple pipeline (lead → talking → booked → won / lost). Rows
 * appear by themselves from outreach replies and bookings; owners add their
 * own too. Won deals with a value count as revenue in Results.
 */

export const STAGES = ["lead", "talking", "booked", "won", "lost"] as const;
type Stage = (typeof STAGES)[number];
const stageV = v.union(v.literal("lead"), v.literal("talking"), v.literal("booked"), v.literal("won"), v.literal("lost"));
const ORDER: Record<Stage, number> = { lead: 0, talking: 1, booked: 2, won: 3, lost: 3 };
const lossReasonV = v.union(v.literal("price"), v.literal("timing"), v.literal("no_need"), v.literal("chose_competitor"), v.literal("no_response"), v.literal("not_a_fit"), v.literal("other"));

async function currencyOf(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">) {
  const currency = (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first())?.currency ?? (await ctx.db.get(orgId))?.currency;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) throw appError("INVALID", "Confirm your business currency before recording a deal value.");
  return currency;
}

function recordedValue(value: number, currency: string) {
  try { return dealValueMinor(value, currency); } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw appError("INVALID", error.message);
  }
}

/** Create or advance the deal for an outreach prospect (never moves a deal backwards or off won/lost). */
export async function syncDealFromProspect(ctx: MutationCtx, p: Doc<"prospects">, stage: Stage, source: Doc<"deals">["source"], note?: string) {
  const now = Date.now();
  const matches = await ctx.db.query("deals").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).take(2);
  if (matches.length > 1) throw appError("INVALID", "Multiple customer records match this prospect. Review them before changing its stage.");
  const existing = matches[0];
  if (existing) {
    assertSameOrg(existing, p.orgId, "deal");
    if (existing.stage === "won" || existing.stage === "lost" || ORDER[stage] <= ORDER[existing.stage]) return existing._id;
    await ctx.db.patch(existing._id, { stage, stageHistory: advanceDealHistory(existing, stage, now, "prospect"), stageChangedAt: now, updatedAt: now, notes: note ? [...existing.notes, { text: note, at: now }] : existing.notes });
    return existing._id;
  }
  return ctx.db.insert("deals", { orgId: p.orgId, stageHistory: initialDealHistory(stage, now, "prospect"), name: p.company, company: p.company, email: p.publicEmail, stage, stageChangedAt: now, source, prospectId: p._id, currency: await currencyOf(ctx, p.orgId), notes: note ? [{ text: note, at: now }] : [], createdAt: now, updatedAt: now });
}

/** A booking from someone who wasn't a prospect: a new "booked" deal. */
export async function dealFromBooking(ctx: MutationCtx, orgId: Id<"organizations">, name: string, company: string | undefined, startAt: number, bookingId?: Id<"bookings">) {
  const now = Date.now();
  return ctx.db.insert("deals", { orgId, stageHistory: initialDealHistory("booked", now, "booking"), name, company, stage: "booked", stageChangedAt: now, source: "booking", currency: await currencyOf(ctx, orgId), notes: [{ text: "Booked a call from your booking page.", at: now }], nextStep: "Call", nextStepAt: startAt, nextStepBookingId: bookingId, createdAt: now, updatedAt: now });
}

/** Exact new link, or an unambiguous legacy prospect link; names are not identity evidence. */
export async function bookingDeal(ctx: QueryCtx | MutationCtx, b: Doc<"bookings">): Promise<Doc<"deals"> | null> {
  if (b.dealId) {
    const deal = await ctx.db.get(b.dealId);
    return deal?.orgId === b.orgId && (!b.prospectId || deal.prospectId === b.prospectId) ? deal : null;
  }
  if (!b.prospectId) return null;
  const prospect = await ctx.db.get(b.prospectId);
  if (prospect?.orgId !== b.orgId) return null;
  const matches = await ctx.db.query("deals").withIndex("by_prospect", q => q.eq("prospectId", b.prospectId)).take(2);
  return matches.length === 1 && matches[0].orgId === b.orgId ? matches[0] : null;
}

/** Link once within booking creation. Only empty or booking-managed next steps follow the appointment queue. */
export async function linkDealBooking(ctx: MutationCtx, bookingId: Id<"bookings">, dealId: Id<"deals">) {
  const b = await ctx.db.get(bookingId);
  if (!b) throw appError("NOT_FOUND", "Booking not found.");
  const deal = assertSameOrg(await ctx.db.get(dealId), b.orgId, "deal");
  if (b.prospectId && deal.prospectId !== b.prospectId) throw appError("INVALID", "This booking does not match the customer record.");
  await ctx.db.patch(b._id, { dealId });
  const emptyStep = !deal.nextStep && deal.nextStepAt === undefined && deal.nextStepDate === undefined;
  const previous = deal.nextStepBookingId ? await ctx.db.get(deal.nextStepBookingId) : null;
  const managedStep = previous?.orgId === b.orgId && previous.dealId === deal._id && deal.nextStep === "Call" && deal.nextStepAt === previous.startAt && deal.nextStepDate === undefined;
  if (deal.stage !== "booked" || (!emptyStep && !managedStep)) return;
  const next = await ctx.db.query("bookings").withIndex("by_org_deal_status_start", q => q.eq("orgId", b.orgId).eq("dealId", dealId).eq("status", "confirmed").gte("startAt", Date.now())).first();
  if (next) await ctx.db.patch(dealId, { nextStep: "Call", nextStepAt: next.startAt, nextStepDate: undefined, nextStepBookingId: next._id, updatedAt: Date.now() });
}

/** A cancellation is an appointment fact. It cannot erase an owner-edited step or another confirmed call. */
export async function bookingCancelled(ctx: MutationCtx, b: Doc<"bookings">, note: string) {
  const now = Date.now();
  const deal = await bookingDeal(ctx, b);
  if (!deal) return;
  const patch: Partial<Doc<"deals">> = { notes: [...deal.notes, { text: `${note} Appointment: ${isDealTimestamp(b.startAt) ? new Date(b.startAt).toISOString() : "date unavailable"}.`, at: now }].slice(-200), updatedAt: now };
  // Older inferred links have no appointment ownership and cannot safely clear a next step.
  let clearedBookedStage = false;
  const otherProspectCall = b.prospectId ? await ctx.db.query("bookings").withIndex("by_org_prospect_status_start", q => q.eq("orgId", b.orgId).eq("prospectId", b.prospectId).eq("status", "confirmed").gte("startAt", now)).first() : null;
  if (b.dealId === deal._id && deal.stage === "booked" && deal.nextStepBookingId === b._id && deal.nextStep === "Call" && deal.nextStepAt === b.startAt && deal.nextStepDate === undefined) {
    const next = await ctx.db.query("bookings").withIndex("by_org_deal_status_start", q => q.eq("orgId", b.orgId).eq("dealId", deal._id).eq("status", "confirmed").gte("startAt", now)).first();
    if (next) Object.assign(patch, { nextStep: "Call", nextStepAt: next.startAt, nextStepDate: undefined, nextStepBookingId: next._id });
    else {
      Object.assign(patch, { nextStep: undefined, nextStepAt: undefined, nextStepDate: undefined, nextStepBookingId: undefined });
      // An older confirmed call may lack a deal id. Do not infer that no appointment remains.
      if (!otherProspectCall) { Object.assign(patch, { stage: "talking", stageChangedAt: now, stageHistory: advanceDealHistory(deal, "talking", now, "booking_cancelled") }); clearedBookedStage = true; }
    }
  }
  await ctx.db.patch(deal._id, patch);
  if (clearedBookedStage && b.prospectId) {
    const p = await ctx.db.get(b.prospectId);
    if (p?.orgId === b.orgId && p.stage === "booked" && !otherProspectCall) await ctx.db.patch(p._id, { stage: "replied", stageUpdatedAt: now, updatedAt: now });
  }
}

function view(d: Doc<"deals">, now: number, timezone: string | null) {
  return { attention: dealAttention(d, now, timezone), dueDate: dealDueDate(d, timezone), nextStepDate: isDealDate(d.nextStepDate) ? d.nextStepDate : null, id: d._id, name: d.name, company: d.company ?? null, email: d.email ?? null, stage: d.stage, source: d.source, value: dealValueNeedsReview(d) ? null : d.valueMinor ?? null, valueNeedsReview: dealValueNeedsReview(d), currency: d.currency, notes: d.notes.slice(-20), nextStep: d.nextStep ?? null, nextStepAt: isDealTimestamp(d.nextStepAt) ? d.nextStepAt : null, lostReason: d.lostReason ?? null, lostReasonNote: d.lostReasonNote ?? null, lostAt: d.lostAt ?? null, stageChangedAt: d.stageChangedAt ?? null, updatedAt: d.updatedAt, createdAt: d.createdAt };
}

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const loaded = await ctx.db.query("deals").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).order("desc").take(501);
    const rows = loaded.slice(0, 500);
    const hasMore = loaded.length > 500;
    const currency = await currencyOf(ctx, org._id);
    const won = summarizeDealValues(rows.filter(d => d.stage === "won"), currency, hasMore);
    const open = rows.filter(d => d.stage !== "won" && d.stage !== "lost");
    const pipeline = summarizeDealValues(open, currency, hasMore);
    const timezone = dealTimezone(org.timezone);
    const observedAt = Date.now();
    return {
      timezone, observedAt,
      deals: rows.map(d => view(d, observedAt, timezone)),
      hasMore,
      valuesByStage: Object.fromEntries(STAGES.map(stage => [stage, summarizeDealValues(rows.filter(d => d.stage === stage), currency, hasMore)])),
      totals: { open: open.length, wonValue: won.totalMinor, pipelineValue: pipeline.totalMinor, currency, won, pipeline },
    };
  },
});

/** Exact selected-record review, independent of the bounded board list. No action or permission is inferred. */
export const detail = query({
  args: { slug: v.string(), id: v.id("deals"), beforeNote: v.optional(v.number()), expectedVersion: v.optional(v.string()) },
  handler: async (ctx, { slug, id, beforeNote, expectedVersion }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const d = assertSameOrg(await ctx.db.get(id), org._id, "deal");
    // Bind pagination to the entire record, including rolling note retention. Millisecond edit times alone are insufficient.
    const version = await sha256Hex(JSON.stringify(d));
    if (beforeNote !== undefined && !expectedVersion) throw appError("INVALID", "Use the version from the first review page when reading earlier notes.");
    if (expectedVersion !== undefined && expectedVersion !== version) throw appError("INVALID", "This deal changed. Read it again before reviewing earlier notes.");
    const end = beforeNote ?? d.notes.length;
    if (!Number.isSafeInteger(end) || end < 0 || end > d.notes.length) throw appError("INVALID", "That note position is not available. Read the deal again.");
    const start = Math.max(0, end - 2);
    const now = Date.now();
    const date = (value: number | undefined, allowFuture = false) => isDealTimestamp(value) && (allowFuture || value <= now) ? new Date(value).toISOString() : null;
    const needsReview = dealValueNeedsReview(d);
    return {
      view: "deal" as const, version, valueUnit: "major_currency_units" as const,
      evidenceKind: "recorded_crm_context" as const, valueEvidenceKind: "owner_reported" as const,
      deal: { id: d._id, name: d.name, company: d.company ?? null, stage: d.stage, source: d.source, currency: d.currency, value: needsReview || d.valueMinor === undefined ? null : minorToMajor(d.valueMinor, d.currency), valueNeedsReview: needsReview, nextStep: d.nextStep ?? null, nextStepAt: date(d.nextStepAt, true), nextStepDate: isDealDate(d.nextStepDate) ? d.nextStepDate : null, timezone: dealTimezone(org.timezone), attention: dealAttention(d, now, org.timezone), stageChangedAt: date(d.stageChangedAt), wonAt: date(d.wonAt), lostAt: date(d.lostAt), lostReason: d.lostReason ?? null, lostReasonNote: d.lostReasonNote ?? null, updatedAt: date(d.updatedAt) },
      notes: d.notes.slice(start, end).map((n, offset) => ({ index: start + offset, text: n.text, recordedAt: date(n.at), basis: n.userId ? "owner_reported" as const : "recorded_context" as const })).reverse(),
      noteCoverage: { stored: d.notes.length, returned: end - start, nextBefore: start > 0 ? start : null, latestPage: end === d.notes.length },
      limitations: "Notes are saved CRM context, not a verified transcript or verbatim buyer statements. Entries without an author may be automated or imported. Dates record entry time, not necessarily conversation time. Earlier history may have been dropped by the 200-note retention limit. Read relevant earlier pages before concluding that evidence is absent. Entry source is not acquisition attribution. Stages, values and notes do not prove qualification, willingness to buy or payment, and are not permission to contact. Missing or invalid dates remain unknown. Review advice does not send, schedule, change this deal or approve anything.",
    };
  },
});

/** Content-bound pagination of recorded transitions; legacy absence is not a reconstructed journey. */
export const stageHistory = query({
  args: { slug: v.string(), id: v.id("deals"), beforeEvent: v.optional(v.number()), expectedVersion: v.optional(v.string()) },
  handler: async (ctx, { slug, id, beforeEvent, expectedVersion }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const d = assertSameOrg(await ctx.db.get(id), org._id, "deal");
    const version = await sha256Hex(JSON.stringify(d));
    if (beforeEvent !== undefined && !expectedVersion) throw appError("INVALID", "Use the original review version before reading earlier history.");
    if (expectedVersion !== undefined && expectedVersion !== version) throw appError("INVALID", "This deal changed. Read its latest history again.");
    const history = d.stageHistory ?? { total: 0, events: [], fromCreation: false };
    const oldest = history.events[0]?.sequence ?? 1;
    const end = beforeEvent ?? history.total + 1;
    if (!Number.isSafeInteger(end) || end < oldest || end > history.total + 1) throw appError("INVALID", "That history position is not retained. Read the latest history again.");
    const selected = history.events.filter(event => event.sequence < end).slice(-20).reverse();
    const first = selected.at(-1)?.sequence ?? oldest;
    return { view: "history" as const, dealId: id, version, total: history.total, retained: history.events.length, fromCreation: history.fromCreation,
      events: selected.map(({ actorId: _actor, ...event }) => event), nextBefore: first > oldest ? first : null, limitations: DEAL_HISTORY_LIMITATIONS };
  },
});

/** Separate bounded review so complete qualification reports never crowd out paginated conversation notes. */
export const qualification = query({
  args: { slug: v.string(), id: v.id("deals"), expectedVersion: v.optional(v.string()) },
  handler: async (ctx, { slug, id, expectedVersion }) => {
    const { org, membership } = await requireOrgAccess(ctx, { slug }, "view");
    const d = assertSameOrg(await ctx.db.get(id), org._id, "deal");
    const version = await sha256Hex(JSON.stringify(d));
    if (expectedVersion !== undefined && expectedVersion !== version) throw appError("INVALID", "This deal changed. Read it again before reviewing its buying context.");
    const record = d.qualification ?? { current: [], history: [], revision: 0 };
    return {
      view: "qualification" as const, dealId: d._id, version, evidenceKind: "owner_reported" as const,
      ...record, unknownTopics: QUALIFICATION_TOPICS.filter(topic => !record.current.some(r => r.topic === topic && r.state !== "unknown")),
      canEdit: can(membership.role, "edit"), limitations: QUALIFICATION_LIMITATIONS,
    };
  },
});

export const recordQualification = mutation({
  args: { slug: v.string(), id: v.id("deals"), expectedRevision: v.number(), topic: qualificationTopicV, state: qualificationStateV, statement: v.string(), sourceLabel: v.string(), observedOn: v.string() },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const d = assertSameOrg(await ctx.db.get(a.id), org._id, "deal");
    const previous = d.qualification ?? { current: [], history: [], revision: 0 };
    if (!Number.isSafeInteger(a.expectedRevision) || a.expectedRevision !== previous.revision) throw appError("INVALID", "Buying context changed. Review the latest reports before saving again.");
    const now = Date.now();
    if (!validProgressDate(a.observedOn, now)) throw appError("INVALID", "Use a real observation date, no later than today (UTC).");
    const parsed = QualificationObservationSchema.safeParse({ ...a, recordedAt: now, revision: previous.revision + 1 });
    if (!parsed.success) throw appError("INVALID", "Add a short observation (3–240 characters) and where it came from (3–160 characters).");
    const report = { ...parsed.data, recordedBy: user._id };
    const current = [...previous.current.filter(r => r.topic !== a.topic), report].sort((a, b) => QUALIFICATION_TOPICS.indexOf(a.topic) - QUALIFICATION_TOPICS.indexOf(b.topic));
    await ctx.db.patch(d._id, { qualification: { current, history: [...previous.history, report].slice(-20), revision: report.revision }, updatedAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "crm.qualification", subjectType: "deal", subjectId: d._id, summary: `Recorded owner-reported buying context: ${a.topic}, ${a.state}, revision ${report.revision}.` });
    return report.revision;
  },
});

export const create = mutation({
  args: { slug: v.string(), name: v.string(), company: v.optional(v.string()), email: v.optional(v.string()), stage: v.optional(stageV), value: v.optional(v.number()), expectedCurrency: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const name = a.name.trim().slice(0, 120);
    if (!name) throw appError("INVALID", "Add a name.");
    const email = a.email?.trim().toLowerCase().slice(0, 200) || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw appError("INVALID", "That email doesn't look right.");
    const currency = await currencyOf(ctx, org._id);
    if (a.value !== undefined && a.expectedCurrency !== undefined && a.expectedCurrency !== currency) throw appError("INVALID", "The business currency changed. Review the displayed currency and enter the amount again.");
    const valueMinor = a.value === undefined ? undefined : recordedValue(a.value, currency);
    const count = (await ctx.db.query("deals").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).take(5001)).length;
    if (count >= 5000) throw appError("LIMIT_REACHED", "The pipeline holds up to 5,000 people. Archive some lost ones first.");
    const now = Date.now();
    const id = await ctx.db.insert("deals", { orgId: org._id, stageHistory: initialDealHistory(a.stage ?? "lead", now, "owner", user._id), stageChangedAt: now, name, company: a.company?.trim().slice(0, 120) || undefined, email, stage: a.stage ?? "lead", source: "manual", valueMinor, valueVersion: DEAL_VALUE_VERSION, currency, notes: [], ...(a.stage === "won" ? { wonAt: now } : a.stage === "lost" ? { lostAt: now } : {}), createdAt: now, updatedAt: now });
    if (a.stage === "won") await syncRevenue(ctx, (await ctx.db.get(id))!);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "crm.created", subjectType: "deal", subjectId: id, summary: `Added ${name} to the pipeline.` });
    await emitEvent(ctx, org._id, "lead.created", { name, company: a.company ?? null, email: email ?? null, source: "manual" });
    return id;
  },
});

export const update = mutation({
  args: {
    slug: v.string(),
    id: v.id("deals"),
    stage: v.optional(stageV),
    value: v.optional(v.union(v.number(), v.null())),
    expectedCurrency: v.optional(v.string()),
    nextStep: v.optional(v.union(v.string(), v.null())),
    nextStepAt: v.optional(v.union(v.number(), v.null())),
    nextStepDate: v.optional(v.union(v.string(), v.null())),
    note: v.optional(v.string()),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
    /** Why a lost deal was lost; only for deals that are (or are moving to) lost. `null` clears it. */
    lostReason: v.optional(v.union(lossReasonV, v.null())),
    lostReasonNote: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const d = await ctx.db.get(a.id);
    assertSameOrg(d, org._id, "deal");
    const now = Date.now();
    const patch: Partial<Doc<"deals">> = { updatedAt: now };
    if (a.name !== undefined && a.name.trim()) patch.name = a.name.trim().slice(0, 120);
    if (a.company !== undefined) patch.company = a.company.trim().slice(0, 120) || undefined;
    if (a.email !== undefined) {
      const email = a.email.trim().toLowerCase().slice(0, 200);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw appError("INVALID", "That email doesn't look right.");
      patch.email = email || undefined;
    }
    if (a.value !== undefined && a.expectedCurrency !== undefined && a.expectedCurrency !== d!.currency) throw appError("INVALID", "The deal currency changed. Review it before saving the value.");
    if (a.value !== undefined) {
      patch.valueMinor = a.value === null ? undefined : recordedValue(a.value, d!.currency);
      patch.valueVersion = DEAL_VALUE_VERSION;
    }
    if (a.nextStep !== undefined) patch.nextStep = a.nextStep?.trim().slice(0, 200) || undefined;
    const changedStep = a.nextStep !== undefined && patch.nextStep !== d!.nextStep;
    const changedInstant = a.nextStepAt !== undefined && ((a.nextStepAt ?? undefined) !== d!.nextStepAt || d!.nextStepDate !== undefined);
    const changedDate = a.nextStepDate !== undefined && ((a.nextStepDate ?? undefined) !== d!.nextStepDate || d!.nextStepAt !== undefined);
    if (changedStep || changedInstant || changedDate || (a.stage !== undefined && a.stage !== d!.stage)) patch.nextStepBookingId = undefined;
    if (a.nextStepDate !== undefined && a.nextStepAt !== undefined) throw appError("INVALID", "Choose either a calendar date or an appointment time, not both.");
    if (a.nextStepDate !== undefined) {
      if (a.nextStepDate !== null && !isDealDate(a.nextStepDate)) throw appError("INVALID", "Choose a valid calendar date, or leave it unknown.");
      patch.nextStepDate = a.nextStepDate ?? undefined;
      patch.nextStepAt = undefined;
    }
    if (a.nextStepAt !== undefined) {
      if (a.nextStepAt !== null && !isDealTimestamp(a.nextStepAt)) throw appError("INVALID", "Choose a valid next-step date, or leave it unknown.");
      patch.nextStepAt = a.nextStepAt ?? undefined;
      patch.nextStepDate = undefined;
    }
    if (a.note?.trim()) patch.notes = [...d!.notes, { text: a.note.trim().slice(0, 2000), at: now, userId: user._id }].slice(-200);
    const finalStage = a.stage ?? d!.stage;
    if (a.stage === "won" && dealValueNeedsReview({ ...d!, ...patch })) throw appError("INVALID", "Confirm the sale value in its currency before recording this sale.");
    if ((a.lostReason || a.lostReasonNote?.trim()) && finalStage !== "lost") throw appError("INVALID", "A loss reason can only be recorded for a lost deal.");
    if (a.lostReason !== undefined) patch.lostReason = a.lostReason ?? undefined;
    if (a.lostReasonNote !== undefined) patch.lostReasonNote = a.lostReasonNote?.trim().slice(0, 240) || undefined;
    if (a.stage && a.stage !== d!.stage) {
      patch.stage = a.stage;
      patch.stageHistory = advanceDealHistory(d!, a.stage, now, "owner", user._id);
      patch.stageChangedAt = now;
      if (a.stage === "lost") patch.lostAt = now;
      // Reopening a lost deal clears its loss record rather than keeping a stale reason.
      if (d!.stage === "lost") Object.assign(patch, { lostAt: undefined, lostReason: undefined, lostReasonNote: undefined });
      if (a.stage === "won") {
        patch.wonAt = now;
        const value = a.value !== undefined ? patch.valueMinor : d!.valueMinor;
        await emitEvent(ctx, org._id, "deal.won", { name: d!.name, company: d!.company ?? null, email: d!.email ?? null, value: value === undefined ? null : minorToMajor(value, d!.currency), currency: d!.currency, evidenceKind: "owner_reported" });
      }
      if (d!.prospectId && (a.stage === "won" || a.stage === "lost")) await ctx.db.patch(d!.prospectId, { stage: a.stage, stageUpdatedAt: now, updatedAt: now });
    }
    await ctx.db.patch(a.id, patch);
    const after = (await ctx.db.get(a.id))!;
    await syncRevenue(ctx, after);
    if (a.value !== undefined && (d!.valueMinor !== after.valueMinor || d!.valueVersion !== after.valueVersion)) await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "crm.value", subjectType: "deal", subjectId: a.id, summary: `Updated owner-reported deal value in ${after.currency}.` });
    if (a.stage && a.stage !== d!.stage) await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "crm.stage", subjectType: "deal", subjectId: a.id, summary: `${after.name}: ${d!.stage} → ${a.stage}.` });
  },
});

export const remove = mutation({
  args: { slug: v.string(), id: v.id("deals") },
  handler: async (ctx, { slug, id }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const d = await ctx.db.get(id);
    assertSameOrg(d, org._id, "deal");
    await ctx.db.delete(id);
    await syncRevenue(ctx, { ...d!, stage: "lost" });
  },
});

/** Retain a sale mirror for compatibility. Its CRM source is owner-reported,
 * excluded by payment readers; the pipeline remains the owner-facing record. */
async function syncRevenue(ctx: MutationCtx, d: Doc<"deals">) {
  const existing = await ctx.db.query("revenueEvents").withIndex("by_org_source_event", (q) => q.eq("orgId", d.orgId).eq("source", "crm").eq("sourceEventId", d._id)).first();
  const counts = d.stage === "won" && (d.valueMinor ?? 0) > 0;
  if (!counts) {
    if (existing) await ctx.db.delete(existing._id);
    return;
  }
  // A note or next-step edit must not silently reinterpret an old amount.
  if (dealValueNeedsReview(d)) return;
  const org = await ctx.db.get(d.orgId);
  const row = { orgId: d.orgId, source: "crm", sourceEventId: d._id, occurredAt: d.wonAt ?? Date.now(), customerRef: d.email ?? d.name, currency: d.currency, amountMinor: d.valueMinor!, refundedMinor: 0, kind: "order" as const, utmSource: d.source === "outbound" ? "climbos_outbound" : d.source === "booking" ? "climbos_booking" : undefined, isFixture: org?.kind === "demo", ingestedAt: Date.now() };
  if (existing) await ctx.db.patch(existing._id, row);
  else await ctx.db.insert("revenueEvents", row);
}
