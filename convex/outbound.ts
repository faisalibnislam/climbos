import { v } from "convex/values";
import { bookingCancelled, dealFromBooking, syncDealFromProspect } from "./crm";
import { notifyOwners } from "./lib/notify";
import { emitEvent } from "./webhooks";
import { manageToken } from "./bookings";
import { featureAllowed, requirePaid } from "./lib/access";
import { cancelQueued } from "./outboundSending";
import type { OutreachOutput, ProspectsOutput } from "../shared/agents/specs";
import { can, sha256Hex } from "../shared/policy";
import { DEFAULT_BOOKING, bookingSlug, domainOf, fixtureOutbound, openSlots, prospectScore, type BookingRules } from "../shared/outbound";
import { citedCreatorFact, creatorIdentity } from "../shared/growth/targets";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { createRunWithReservation } from "./engine";
import { audit } from "./lib/audit";
import { decryptSecret, encryptSecret } from "./lib/crypto";
import { bookingEmail } from "./lib/emailTemplates";
import { planJob } from "./lib/jobPlans";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

/**
 * Outbound: find the people who need the business (public web, evidenced),
 * write the emails, and book the calls on ClimbOS's own booking page.
 * Nothing is sent from here: the owner approves prospects and exports, or
 * (later) sends from a connected mailbox.
 */

const stageValidator = v.union(
  v.literal("suggested"),
  v.literal("approved"),
  v.literal("skipped"),
  v.literal("contacted"),
  v.literal("replied"),
  v.literal("booked"),
  v.literal("won"),
  v.literal("lost"),
);

async function pageFor(ctx: QueryCtx, orgId: Id<"organizations">) {
  return ctx.db
    .query("bookingPages")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
}

function rulesOf(p: Doc<"bookingPages">): BookingRules {
  return { durationMin: p.durationMin, timezone: p.timezone, days: p.days, startHour: p.startHour, endHour: p.endHour, bufferMin: p.bufferMin, noticeHours: p.noticeHours };
}

async function ensurePage(ctx: MutationCtx, org: Doc<"organizations">): Promise<Doc<"bookingPages">> {
  const existing = await pageFor(ctx, org._id);
  if (existing) return existing;
  const now = Date.now();
  let slug = bookingSlug(org.name, org._id);
  if (await ctx.db.query("bookingPages").withIndex("by_slug", (q) => q.eq("slug", slug)).first()) slug = bookingSlug(org.name, `${org._id}${now}`);
  // Live only with a package (the booking page is a paid feature); free accounts can switch it on after upgrading.
  const active = await featureAllowed(ctx, org, "booking_page");
  const id = await ctx.db.insert("bookingPages", { orgId: org._id, slug, title: `Call with ${org.name}`, ...DEFAULT_BOOKING, timezone: org.timezone, active, createdAt: now, updatedAt: now });
  return (await ctx.db.get(id))!;
}

/** The public booking page answers only while it's on and the account still has the feature. */
export async function bookingLive(ctx: QueryCtx, page: Doc<"bookingPages"> | null): Promise<boolean> {
  if (!page?.active) return false;
  const org = await ctx.db.get(page.orgId);
  return Boolean(org && !org.deletedAt && (await featureAllowed(ctx, org, "booking_page")));
}

/* ---------------- Owner-facing API ---------------- */

export const get = query({
  args: { slug: v.string(), campaignId: v.optional(v.id("outboundCampaigns")) },
  handler: async (ctx, { slug, campaignId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const campaigns = await ctx.db
      .query("outboundCampaigns")
      .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(10);
    // A play's target list links here with its campaign (S6); any other workspace's campaign is ignored.
    const asked = campaignId ? await ctx.db.get(campaignId) : null;
    const campaign = (asked && asked.orgId === org._id ? asked : null) ?? campaigns.find((c) => c.status !== "archived") ?? null;
    const prospects = campaign
      ? await ctx.db
          .query("prospects")
          .withIndex("by_campaign", (q) => q.eq("campaignId", campaign._id))
          .collect()
      : [];
    const run = campaign?.runId ? await ctx.db.get(campaign.runId) : null;
    const page = await pageFor(ctx, org._id);
    const now = Date.now();
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_org_start", (q) => q.eq("orgId", org._id).gte("startAt", now - 86_400_000))
      .take(20);
    const all = await ctx.db
      .query("prospects")
      .withIndex("by_org_stage", (q) => q.eq("orgId", org._id))
      .collect();
    const funnel: Record<string, number> = {};
    for (const p of all) funnel[p.stage] = (funnel[p.stage] ?? 0) + 1;
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    return {
      slug: org.slug,
      businessName: (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first())?.name ?? org.name,
      canApprove: can(role, "approve"),
      canEdit: can(role, "edit"),
      canExport: can(role, "export"),
      website: business?.website ?? null,
      businessType: business?.businessType ?? null,
      campaign: campaign
        ? {
            id: campaign._id,
            title: campaign.title,
            kind: campaign.kind ?? "customers",
            status: campaign.status,
            brief: campaign.brief,
            icp: campaign.icp ?? null,
            sequence: campaign.sequence,
            ownerNotes: campaign.ownerNotes,
            excluded: campaign.excluded,
            createdAt: campaign.createdAt,
            run: run ? { id: run._id, status: run.status, message: run.userMessage ?? null } : null,
          }
        : null,
      prospects: prospects
        .sort((a, b) => prospectScore(b) - prospectScore(a))
        .map((p) => ({
          id: p._id,
          company: p.company,
          website: p.website,
          domain: p.domain,
          location: p.location,
          sizeBand: p.sizeBand,
          why: p.why,
          evidence: p.evidence,
          trigger: p.trigger,
          fit: p.fit,
          timing: p.timing,
          contact: p.contact,
          publicEmail: p.publicEmail ?? null,
          audienceSize: p.audienceSize ?? null,
          contentLanguage: p.contentLanguage ?? null,
          collaborationConcept: p.collaborationConcept ?? null,
          check: p.check ?? null,
          firstLine: p.firstLine,
          stage: p.stage,
        })),
      funnel,
      page: page ? { id: page._id, slug: page.slug, title: page.title, durationMin: page.durationMin, days: page.days, startHour: page.startHour, endHour: page.endHour, timezone: page.timezone, active: page.active, live: await bookingLive(ctx, page) } : null,
      bookings: bookings
        .filter((b) => b.status === "confirmed")
        .sort((a, b) => a.startAt - b.startAt)
        .map((b) => ({ id: b._id, name: b.name, company: b.company ?? null, note: b.note ?? null, startAt: b.startAt, endAt: b.endAt, upcoming: b.startAt > now })),
    };
  },
});

/** "Find customers": research prospects and write the emails (nothing is sent). */
export const start = mutation({
  args: { slug: v.string(), who: v.optional(v.string()), where: v.optional(v.string()), count: v.optional(v.number()), kind: v.optional(v.union(v.literal("customers"), v.literal("creators"))) },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const brief = { who: (args.who ?? "").trim().slice(0, 300), where: (args.where ?? "").trim().slice(0, 120), count: Math.max(5, Math.min(Math.round(args.count ?? 15), 30)) };
    const prev = await ctx.db.query("outboundCampaigns").withIndex("by_org_created", (q) => q.eq("orgId", org._id)).order("desc").first();
    const id = await startCampaign(ctx, { org, userId: user._id, brief, auto: false, kind: args.kind });
    return { campaignId: id, pausedSending: Boolean(prev && prev.status !== "archived" && prev.sending?.status === "on") };
  },
});

/** Create a campaign and its research run (also used by wishes). */
export async function startCampaign(
  ctx: MutationCtx,
  p: { org: Doc<"organizations">; userId: Id<"users">; brief: { who: string; where: string; count: number }; auto: boolean; cardId?: Id<"actionCards">; kind?: "customers" | "creators"; customAgentId?: Id<"customAgents">; customAgentParentRunId?: Id<"workflowRuns">; agentArchetypeId?: string; play?: { strategyId: Id<"strategies">; playId: string; name: string } },
): Promise<Id<"outboundCampaigns">> {
  const { org, brief } = p;
  const busy = await ctx.db
    .query("outboundCampaigns")
    .withIndex("by_org_created", (q) => q.eq("orgId", org._id))
    .order("desc")
    .first();
  if (busy?.status === "researching") throw appError("INVALID", "Your team is already searching. It'll be ready in a few minutes.");
  const creators = p.kind === "creators";
  const plan = planJob("outbound", { quantity: brief.count }, { fixture: org.kind === "demo" });
  const runId = await createRunWithReservation(ctx, { org, kind: plan.kind, title: plan.title, roles: plan.roles, input: brief, steps: plan.steps, meters: plan.meters, createdBy: p.userId, isFixture: org.kind === "demo", customAgentId: p.customAgentId, customAgentParentRunId: p.customAgentParentRunId, agentArchetypeId: p.agentArchetypeId });
  const now = Date.now();
  // Older campaigns stay in the pipeline but leave the main view. Their sending pauses (resume it from Send).
  if (busy && busy.status !== "archived") {
    const sending = busy.sending?.status === "on" ? { sending: { ...busy.sending, status: "paused" as const, pausedReason: "archived" as const } } : {};
    await ctx.db.patch(busy._id, { status: "archived", ...sending, updatedAt: now });
    if (sending.sending) await audit(ctx, { orgId: org._id, actorType: "system", action: "outbound.sending_paused", subjectType: "campaign", subjectId: busy._id, summary: "Paused sending: a new search started. Resume it from Send." });
  }
  const campaignId = await ctx.db.insert("outboundCampaigns", {
    orgId: org._id,
    title: p.play ? `Targets: ${p.play.name}`.slice(0, 120) : brief.who ? `Find: ${brief.who}` : creators ? "Find creators" : "Find customers",
    ...(creators ? { kind: "creators" as const } : {}),
    ...(p.play ? { strategyId: p.play.strategyId, playId: p.play.playId } : {}),
    brief,
    status: "researching",
    sequence: [],
    ownerNotes: [],
    excluded: [],
    runId,
    createdBy: p.userId,
    createdAt: now,
    updatedAt: now,
  });
  await ensurePage(ctx, org);
  if (p.cardId) await ctx.db.patch(p.cardId, { status: "running", runId, updatedAt: now });
  await ctx.scheduler.runAfter(0, internal.jobs.findCustomers, { runId, campaignId, cardId: p.cardId });
  await audit(ctx, { orgId: org._id, actorType: p.auto ? "agent" : "user", actorId: p.auto ? undefined : p.userId, action: "outbound.started", subjectType: "outboundCampaign", subjectId: campaignId, summary: `Finding ${brief.count} prospects${brief.who ? `: ${brief.who}` : ""}${brief.where ? ` in ${brief.where}` : ""}` });
  return campaignId;
}

export const setStage = mutation({
  args: { slug: v.string(), prospectIds: v.array(v.id("prospects")), stage: stageValidator },
  handler: async (ctx, { slug, prospectIds, stage }) => {
    // Approving or skipping who gets emailed is an approval; the other stages are pipeline edits.
    const { org, user } = await requireOrgAccess(ctx, { slug }, stage === "approved" || stage === "skipped" ? "approve" : "edit");
    const now = Date.now();
    for (const id of prospectIds.slice(0, 200)) {
      const p = assertSameOrg(await ctx.db.get(id), org._id, "prospect");
      await ctx.db.patch(p._id, {
        ...(p.stage !== stage ? { stage, stageUpdatedAt: now } : {}),
        ...(stage === "contacted" ? { replyDisposition: undefined, replyDispositionUpdatedAt: undefined } : {}),
        updatedAt: now,
      });
      // Leaving the sequence: nothing more goes out.
      if (stage !== "approved" && stage !== "contacted") await cancelQueued(ctx, p._id);
      // Conversations move into the pipeline (CRM) automatically.
      const dealStage = stage === "replied" ? "talking" : stage === "booked" || stage === "won" || stage === "lost" ? stage : null;
      if (dealStage) await syncDealFromProspect(ctx, p, dealStage, "outbound");
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "outbound.stage", subjectType: "prospects", subjectId: String(prospectIds.length), summary: `${prospectIds.length} prospect${prospectIds.length === 1 ? "" : "s"} → ${stage}` });
  },
});

/** Record a human judgment about a reply; generic "replied" stages are never treated as qualified by inference. */
export const setReplyDisposition = mutation({
  args: {
    slug: v.string(),
    prospectId: v.id("prospects"),
    disposition: v.union(v.literal("qualified"), v.literal("not_qualified"), v.literal("unclear")),
  },
  handler: async (ctx, { slug, prospectId, disposition }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const prospect = assertSameOrg(await ctx.db.get(prospectId), org._id, "prospect");
    if (!["replied", "booked", "won"].includes(prospect.stage)) {
      throw appError("INVALID", "Record reply quality after the prospect has replied.");
    }
    const now = Date.now();
    await ctx.db.patch(prospect._id, { replyDisposition: disposition, replyDispositionUpdatedAt: now, updatedAt: now });
    await audit(ctx, {
      orgId: org._id,
      actorType: "user",
      actorId: user._id,
      action: "outbound.reply_disposition",
      subjectType: "prospects",
      subjectId: prospect._id,
      summary: `Recorded a ${disposition.replaceAll("_", " ")} reply outcome for a prospect.`,
    });
  },
});

export const updateFirstLine = mutation({
  args: { slug: v.string(), prospectId: v.id("prospects"), firstLine: v.string() },
  handler: async (ctx, { slug, prospectId, firstLine }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "edit");
    const p = assertSameOrg(await ctx.db.get(prospectId), org._id, "prospect");
    await ctx.db.patch(p._id, { firstLine: firstLine.trim().slice(0, 400), updatedAt: Date.now() });
  },
});

export const updateStep = mutation({
  args: { slug: v.string(), campaignId: v.id("outboundCampaigns"), index: v.number(), subject: v.string(), body: v.string() },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const c = assertSameOrg(await ctx.db.get(a.campaignId), org._id, "campaign");
    if (!c.sequence[a.index]) throw appError("NOT_FOUND", "We couldn't find that email.");
    const sequence = c.sequence.map((s, i) => (i === a.index ? { ...s, subject: a.subject.trim().slice(0, 120), body: a.body.trim().slice(0, 2000) } : s));
    await ctx.db.patch(c._id, { sequence, updatedAt: Date.now() });
  },
});

export const saveBookingPage = mutation({
  args: {
    slug: v.string(),
    title: v.string(),
    durationMin: v.number(),
    days: v.array(v.number()),
    startHour: v.number(),
    endHour: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, a) => {
    const { org } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const page = await ensurePage(ctx, org);
    // Switching the page on needs a package; editing a page that's already on doesn't.
    if (a.active && !page.active) await requirePaid(ctx, org, "booking_page");
    const days = [...new Set(a.days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort();
    const startHour = Math.max(0, Math.min(23, Math.round(a.startHour)));
    const endHour = Math.max(startHour + 1, Math.min(24, Math.round(a.endHour)));
    if (!days.length) throw appError("INVALID", "Pick at least one day.");
    await ctx.db.patch(page._id, {
      title: a.title.trim().slice(0, 80) || page.title,
      durationMin: [15, 20, 30, 45, 60].includes(a.durationMin) ? a.durationMin : 30,
      days,
      startHour,
      endHour,
      active: a.active,
      updatedAt: Date.now(),
    });
  },
});

export const cancelBooking = mutation({
  args: { slug: v.string(), bookingId: v.id("bookings") },
  handler: async (ctx, { slug, bookingId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const b = assertSameOrg(await ctx.db.get(bookingId), org._id, "booking");
    if (b.status === "cancelled") return;
    await ctx.db.patch(b._id, { status: "cancelled" });
    await bookingCancelled(ctx, b, "You cancelled the call.");
    // Tell the guest, with a link to pick another time.
    if (b.startAt > Date.now()) await ctx.scheduler.runAfter(0, internal.bookings.sendCancelled, { bookingId: b._id });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "booking.cancelled", subjectType: "booking", subjectId: b._id, summary: `Cancelled the call with ${b.name}` });
  },
});

/* ---------------- Public booking page ---------------- */

export const publicPage = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const page = await ctx.db
      .query("bookingPages")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!page || !(await bookingLive(ctx, page))) return null;
    const org = await ctx.db.get(page.orgId);
    if (!org) return null;
    const now = Date.now();
    const taken = await ctx.db
      .query("bookings")
      .withIndex("by_page_start", (q) => q.eq("pageId", page._id).gte("startAt", now - 86_400_000))
      .collect();
    return {
      title: page.title,
      businessName: org.name,
      durationMin: page.durationMin,
      timezone: page.timezone,
      slots: openSlots(rulesOf(page), taken.filter((b) => b.status === "confirmed"), now),
    };
  },
});

export const book = mutation({
  args: { slug: v.string(), startAt: v.number(), name: v.string(), email: v.string(), company: v.optional(v.string()), note: v.optional(v.string()), ref: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const page = await ctx.db
      .query("bookingPages")
      .withIndex("by_slug", (q) => q.eq("slug", a.slug))
      .first();
    if (!page || !(await bookingLive(ctx, page))) throw appError("NOT_FOUND", "This booking page isn't available.");
    const name = a.name.trim().slice(0, 80);
    const email = a.email.trim().toLowerCase().slice(0, 200);
    if (!name) throw appError("INVALID", "Please add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw appError("INVALID", "Please add a valid email.");
    const now = Date.now();
    const taken = await ctx.db
      .query("bookings")
      .withIndex("by_page_start", (q) => q.eq("pageId", page._id).gte("startAt", now - 86_400_000))
      .collect();
    const live = taken.filter((b) => b.status === "confirmed");
    if (!openSlots(rulesOf(page), live, now).includes(a.startAt)) throw appError("INVALID", "That time was just taken. Please pick another.");
    const emailHash = await sha256Hex(email);
    // Abuse guard: one person holds at most 2 upcoming calls; a page takes at most 12 bookings a day.
    if (live.filter((b) => b.emailHash === emailHash && b.startAt > now).length >= 2) throw appError("RATE_LIMITED", "You already have calls booked. Reply to the invite to change them.");
    if (taken.filter((b) => b.createdAt > now - 86_400_000).length >= 12) throw appError("RATE_LIMITED", "This page is fully booked today. Please try again tomorrow.");
    const sealed = await encryptSecret(email, `climbos:${page.orgId}:booking`);
    // Link the booking to its prospect: the ?ref in their email's booking link, else their email address.
    const refId = a.ref ? ctx.db.normalizeId("prospects", a.ref) : null;
    const byRef = refId ? await ctx.db.get(refId) : null;
    const prospect = byRef?.orgId === page.orgId ? byRef : await ctx.db.query("prospects").withIndex("by_org_email", (q) => q.eq("orgId", page.orgId).eq("publicEmail", email)).first();
    const id = await ctx.db.insert("bookings", {
      orgId: page.orgId,
      pageId: page._id,
      prospectId: prospect?._id,
      name,
      emailHash,
      emailCiphertext: sealed.ciphertext,
      emailIv: sealed.iv,
      emailKeyId: sealed.keyId,
      company: a.company?.trim().slice(0, 120) || undefined,
      note: a.note?.trim().slice(0, 500) || undefined,
      startAt: a.startAt,
      endAt: a.startAt + page.durationMin * 60_000,
      status: "confirmed",
      createdAt: now,
    });
    await ctx.db.patch(id, { manageTokenHash: await sha256Hex(await manageToken(id)) });
    if (prospect) {
      if (prospect.stage !== "won" && prospect.stage !== "booked") await ctx.db.patch(prospect._id, { stage: "booked", stageUpdatedAt: now, updatedAt: now });
      // They booked: no more follow-ups.
      await cancelQueued(ctx, prospect._id);
      await syncDealFromProspect(ctx, prospect, "booked", "outbound", "Booked a call.");
    } else await dealFromBooking(ctx, page.orgId, name, a.company?.trim().slice(0, 120) || undefined, a.startAt);
    const when = new Date(a.startAt).toLocaleString("en-US", { timeZone: page.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    await ctx.db.insert("communityMessages", { orgId: page.orgId, channel: "booking", kind: "booking", externalId: `booking:${id}`, prospectId: prospect?._id, authorName: a.company ? `${name} (${a.company.trim().slice(0, 60)})` : name, text: `Booked a ${page.durationMin}-minute call for ${when}.${a.note ? `\n\n“${a.note.trim().slice(0, 500)}”` : ""}`, receivedAt: now, status: "new", createdAt: now, updatedAt: now });
    await audit(ctx, { orgId: page.orgId, actorType: "system", action: "booking.created", subjectType: "booking", subjectId: id, summary: `${name}${a.company ? ` (${a.company.trim().slice(0, 60)})` : ""} booked a call` });
    await ctx.scheduler.runAfter(0, internal.outbound.notifyBooking, { bookingId: id });
    await notifyOwners(ctx, page.orgId, `${name} booked a call for ${when}.`, "inbox");
    await emitEvent(ctx, page.orgId, "booking.created", { name, email, company: a.company?.trim() || null, startAt: new Date(a.startAt).toISOString(), minutes: page.durationMin, note: a.note?.trim() || null });
    return { bookingId: id, startAt: a.startAt, endAt: a.startAt + page.durationMin * 60_000 };
  },
});

export const bookingContext = internalQuery({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const b = await ctx.db.get(bookingId);
    if (!b) return null;
    const page = await ctx.db.get(b.pageId);
    const org = await ctx.db.get(b.orgId);
    if (!page || !org) return null;
    const members = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .collect();
    const owners = [];
    for (const m of members.filter((m) => m.status === "active" && (m.role === "owner" || m.role === "admin"))) {
      if (!m.userId) continue;
      const u = await ctx.db.get(m.userId);
      if (u?.email) owners.push(u.email);
    }
    return { booking: b, page, org, owners };
  },
});

export const notifyBooking = internalAction({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, { bookingId }) => {
    const c = await ctx.runQuery(internal.outbound.bookingContext, { bookingId });
    if (!c) return;
    const email = await decryptSecret({ keyId: c.booking.emailKeyId, iv: c.booking.emailIv, ciphertext: c.booking.emailCiphertext }, `climbos:${c.org._id}:booking`);
    const when = new Date(c.booking.startAt).toLocaleString("en-US", { timeZone: c.page.timezone, weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
    const toGuest = bookingEmail({ title: c.page.title, when, minutes: c.page.durationMin, withName: c.org.name, startAt: c.booking.startAt, endAt: c.booking.endAt, note: null, manageUrl: `${process.env.SITE_URL ?? "https://climbos.app"}/book/manage/${await manageToken(c.booking._id)}` });
    await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: c.org._id, to: email, template: "booking_guest", ...toGuest });
    const toOwner = bookingEmail({ title: `${c.booking.name}${c.booking.company ? ` (${c.booking.company})` : ""} booked a call`, when, minutes: c.page.durationMin, withName: c.booking.name, startAt: c.booking.startAt, endAt: c.booking.endAt, note: c.booking.note ?? null });
    for (const to of c.owners) await ctx.runAction(internal.notifications.sendPlatformEmail, { orgId: c.org._id, to, template: "booking_owner", ...toOwner });
  },
});

/* ---------------- Job plumbing ---------------- */

export const campaignContext = internalQuery({
  args: { campaignId: v.id("outboundCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const c = await ctx.db.get(campaignId);
    if (!c) return null;
    const existing = await ctx.db
      .query("prospects")
      .withIndex("by_org_stage", (q) => q.eq("orgId", c.orgId))
      .take(500);
    return { brief: c.brief, kind: c.kind ?? "customers", knownDomains: [...new Set(existing.map((p) => p.domain))].slice(0, 200) };
  },
});

function profileKey(url: string): string {
  try {
    const u = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return "";
  }
}

/** A creator's dedupe key: platform + handle when the profile path names one (REQ-TARGET-03), else the profile path. */
function creatorKey(url: string): { key: string; platform?: string; handle?: string } {
  const id = creatorIdentity(url);
  return id ? { key: id.key, platform: id.platform, handle: id.handle } : { key: profileKey(url) };
}

export const saveResult = internalMutation({
  args: { campaignId: v.id("outboundCampaigns"), prospects: v.any(), outreach: v.any() },
  handler: async (ctx, a) => {
    const c = await ctx.db.get(a.campaignId);
    if (!c) return;
    const found = a.prospects as ProspectsOutput;
    const outreach = a.outreach as OutreachOutput;
    const now = Date.now();
    const lines = new Map(outreach.firstLines.map((f) => [f.company.trim().toLowerCase(), f.line]));
    const seen = new Set<string>();
    let added = 0;
    let merged = 0;
    for (const p of found.prospects) {
      // Creators share platform domains (instagram.com/…): key them by platform + handle instead.
      const ident = c.kind === "creators" ? creatorKey(p.website) : { key: domainOf(p.website) };
      const domain = ident.key;
      if (!domain || seen.has(domain)) continue;
      seen.add(domain);
      // Anyone already in the pipeline (any campaign) stays one record with its stage; a play search links it (REQ-TARGET-06).
      const byKey = (key: string) => ctx.db.query("prospects").withIndex("by_org_domain", (q) => q.eq("orgId", c.orgId).eq("domain", key)).first();
      // Creators saved before platform + handle keys used the bare profile path.
      const existing = (await byKey(domain)) ?? (c.kind === "creators" && profileKey(p.website) !== domain ? await byKey(profileKey(p.website)) : null);
      if (existing) {
        const audienceSize = c.kind === "creators" ? citedCreatorFact(p.audienceSize, p.evidence) : null;
        const contentLanguage = c.kind === "creators" ? citedCreatorFact(p.contentLanguage, p.evidence) : null;
        const playIds = c.playId && !(existing.playIds ?? []).includes(c.playId) ? [...(existing.playIds ?? []), c.playId] : undefined;
        const creatorUpdates = c.kind === "creators" ? {
          ...(audienceSize ? { audienceSize } : {}),
          ...(contentLanguage ? { contentLanguage } : {}),
          ...(typeof p.collaborationConcept === "string" && p.collaborationConcept.trim() ? { collaborationConcept: p.collaborationConcept.trim().slice(0, 240) } : {}),
        } : {};
        if (playIds || Object.keys(creatorUpdates).length) {
          await ctx.db.patch(existing._id, { ...(playIds ? { playIds } : {}), ...creatorUpdates, updatedAt: now });
          merged++;
        }
        continue;
      }
      const audienceSize = c.kind === "creators" ? citedCreatorFact(p.audienceSize, p.evidence) : null;
      const contentLanguage = c.kind === "creators" ? citedCreatorFact(p.contentLanguage, p.evidence) : null;
      await ctx.db.insert("prospects", {
        orgId: c.orgId,
        campaignId: c._id,
        company: p.company.slice(0, 120),
        domain,
        website: p.website.slice(0, 300),
        location: p.location.slice(0, 120),
        sizeBand: p.sizeBand.slice(0, 20),
        why: p.why.slice(0, 400),
        evidence: p.evidence.slice(0, 5).map((e) => ({ url: e.url.slice(0, 500), observation: e.observation.slice(0, 400) })),
        trigger: p.trigger.slice(0, 200),
        fit: Math.max(0, Math.min(100, Math.round(p.fit))),
        timing: Math.max(0, Math.min(100, Math.round(p.timing))),
        contact: p.contact.slice(0, 120),
        publicEmail: p.publicEmail?.trim().toLowerCase() || undefined,
        ...((p as { check?: Doc<"prospects">["check"] }).check ? { check: (p as { check?: Doc<"prospects">["check"] }).check } : {}),
        firstLine: (lines.get(p.company.trim().toLowerCase()) ?? "").slice(0, 400),
        stage: "suggested",
        stageUpdatedAt: now,
        ...(c.playId ? { playIds: [c.playId] } : {}),
        ...("platform" in ident && ident.platform ? { platform: ident.platform, handle: ident.handle } : {}),
        ...(audienceSize ? { audienceSize } : {}),
        ...(contentLanguage ? { contentLanguage } : {}),
        ...(c.kind === "creators" && typeof p.collaborationConcept === "string" && p.collaborationConcept.trim() ? { collaborationConcept: p.collaborationConcept.trim().slice(0, 240) } : {}),
        createdAt: now,
        updatedAt: now,
      });
      added++;
    }
    await ctx.db.patch(c._id, {
      status: "review",
      icp: found.icp,
      sequence: outreach.sequence.slice(0, 5),
      ownerNotes: outreach.ownerNotes.slice(0, 3),
      excluded: found.excluded.slice(0, 30),
      updatedAt: now,
    });
    await audit(ctx, { orgId: c.orgId, actorType: "agent", action: "outbound.ready", subjectType: "outboundCampaign", subjectId: c._id, summary: `Found ${added} prospects${merged ? ` (${merged} already known, linked to this play)` : ""} and wrote a ${outreach.sequence.length}-email sequence` });
    return { added, merged };
  },
});

export const markFailed = internalMutation({
  args: { campaignId: v.id("outboundCampaigns") },
  handler: async (ctx, { campaignId }) => {
    const c = await ctx.db.get(campaignId);
    if (c?.status === "researching") await ctx.db.patch(c._id, { status: "failed", updatedAt: Date.now() });
  },
});

/** Dev/ops only (internal): seed a deterministic example campaign into a workspace for UI review. */
export const seedExample = internalMutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!org) throw appError("NOT_FOUND", "No such workspace.");
    const owner = await ctx.db
      .query("memberships")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!owner?.userId) throw appError("NOT_FOUND", "No member to own the example.");
    const brief = { who: "Agencies that set this up for clients", where: "United Kingdom", count: 8 };
    const now = Date.now();
    const campaignId = await ctx.db.insert("outboundCampaigns", { orgId: org._id, title: "Example", brief, status: "researching", sequence: [], ownerNotes: [], excluded: [], createdBy: owner.userId, createdAt: now, updatedAt: now });
    await ensurePage(ctx, org);
    const { prospects, outreach } = fixtureOutbound({ businessName: org.name, ...brief });
    await ctx.scheduler.runAfter(0, internal.outbound.saveResult, { campaignId, prospects, outreach });
    return campaignId;
  },
});
