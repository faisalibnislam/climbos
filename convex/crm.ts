import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
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

async function currencyOf(ctx: MutationCtx, orgId: Id<"organizations">) {
  return (await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", orgId)).first())?.currency ?? "USD";
}

/** Create or advance the deal for an outreach prospect (never moves a deal backwards or off won/lost). */
export async function syncDealFromProspect(ctx: MutationCtx, p: Doc<"prospects">, stage: Stage, source: Doc<"deals">["source"], note?: string) {
  const now = Date.now();
  const existing = await ctx.db.query("deals").withIndex("by_prospect", (q) => q.eq("prospectId", p._id)).first();
  if (existing) {
    if (existing.stage === "won" || existing.stage === "lost" || ORDER[stage] <= ORDER[existing.stage]) return existing._id;
    await ctx.db.patch(existing._id, { stage, updatedAt: now, notes: note ? [...existing.notes, { text: note, at: now }] : existing.notes });
    return existing._id;
  }
  return ctx.db.insert("deals", { orgId: p.orgId, name: p.company, company: p.company, email: p.publicEmail, stage, source, prospectId: p._id, currency: await currencyOf(ctx, p.orgId), notes: note ? [{ text: note, at: now }] : [], createdAt: now, updatedAt: now });
}

/** A booking from someone who wasn't a prospect: a new "booked" deal. */
export async function dealFromBooking(ctx: MutationCtx, orgId: Id<"organizations">, name: string, company: string | undefined, startAt: number) {
  const now = Date.now();
  await ctx.db.insert("deals", { orgId, name, company, stage: "booked", source: "booking", currency: await currencyOf(ctx, orgId), notes: [{ text: "Booked a call from your booking page.", at: now }], nextStep: "Call", nextStepAt: startAt, createdAt: now, updatedAt: now });
}

/** A cancelled call: its deal goes back to "talking" and its prospect back to "replied". */
export async function bookingCancelled(ctx: MutationCtx, b: Doc<"bookings">, note: string) {
  const now = Date.now();
  const deal = b.prospectId
    ? await ctx.db.query("deals").withIndex("by_prospect", (q) => q.eq("prospectId", b.prospectId)).first()
    : (await ctx.db.query("deals").withIndex("by_org_stage", (q) => q.eq("orgId", b.orgId).eq("stage", "booked")).take(200)).find((d) => d.source === "booking" && d.name === b.name && d.nextStepAt === b.startAt);
  if (deal?.stage === "booked") await ctx.db.patch(deal._id, { stage: "talking", nextStep: undefined, nextStepAt: undefined, notes: [...deal.notes, { text: note, at: now }], updatedAt: now });
  const p = b.prospectId ? await ctx.db.get(b.prospectId) : null;
  if (p?.stage === "booked") await ctx.db.patch(p._id, { stage: "replied", updatedAt: now });
}

function view(d: Doc<"deals">) {
  return { id: d._id, name: d.name, company: d.company ?? null, email: d.email ?? null, stage: d.stage, source: d.source, value: d.valueMinor ?? null, currency: d.currency, notes: d.notes.slice(-20), nextStep: d.nextStep ?? null, nextStepAt: d.nextStepAt ?? null, updatedAt: d.updatedAt, createdAt: d.createdAt };
}

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db.query("deals").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).order("desc").take(500);
    const won = rows.filter((d) => d.stage === "won");
    return {
      deals: rows.map(view),
      totals: { open: rows.filter((d) => !["won", "lost"].includes(d.stage)).length, wonValue: won.reduce((s, d) => s + (d.valueMinor ?? 0), 0), pipelineValue: rows.filter((d) => !["won", "lost"].includes(d.stage)).reduce((s, d) => s + (d.valueMinor ?? 0), 0), currency: rows[0]?.currency ?? "USD" },
    };
  },
});

export const create = mutation({
  args: { slug: v.string(), name: v.string(), company: v.optional(v.string()), email: v.optional(v.string()), stage: v.optional(stageV), value: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: a.slug }, "edit");
    const name = a.name.trim().slice(0, 120);
    if (!name) throw appError("INVALID", "Add a name.");
    const email = a.email?.trim().toLowerCase().slice(0, 200) || undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw appError("INVALID", "That email doesn't look right.");
    if (a.value !== undefined && !Number.isFinite(a.value)) throw appError("INVALID", "Enter the value as a number, like 1200 or 1200.50.");
    const count = (await ctx.db.query("deals").withIndex("by_org_updated", (q) => q.eq("orgId", org._id)).take(5001)).length;
    if (count >= 5000) throw appError("LIMIT_REACHED", "The pipeline holds up to 5,000 people. Archive some lost ones first.");
    const now = Date.now();
    const id = await ctx.db.insert("deals", { orgId: org._id, name, company: a.company?.trim().slice(0, 120) || undefined, email, stage: a.stage ?? "lead", source: "manual", valueMinor: a.value !== undefined ? Math.max(0, Math.round(a.value * 100)) : undefined, currency: await currencyOf(ctx, org._id), notes: [], createdAt: now, updatedAt: now });
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
    nextStep: v.optional(v.union(v.string(), v.null())),
    nextStepAt: v.optional(v.union(v.number(), v.null())),
    note: v.optional(v.string()),
    name: v.optional(v.string()),
    company: v.optional(v.string()),
    email: v.optional(v.string()),
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
    if (a.value !== undefined && a.value !== null && !Number.isFinite(a.value)) throw appError("INVALID", "Enter the value as a number, like 1200 or 1200.50.");
    if (a.value !== undefined) patch.valueMinor = a.value === null ? undefined : Math.max(0, Math.round(a.value * 100));
    if (a.nextStep !== undefined) patch.nextStep = a.nextStep?.trim().slice(0, 200) || undefined;
    if (a.nextStepAt !== undefined) patch.nextStepAt = a.nextStepAt ?? undefined;
    if (a.note?.trim()) patch.notes = [...d!.notes, { text: a.note.trim().slice(0, 2000), at: now, userId: user._id }].slice(-200);
    if (a.stage && a.stage !== d!.stage) {
      patch.stage = a.stage;
      if (a.stage === "won") {
        patch.wonAt = now;
        await emitEvent(ctx, org._id, "deal.won", { name: d!.name, company: d!.company ?? null, email: d!.email ?? null, value: (patch.valueMinor ?? d!.valueMinor ?? 0) / 100, currency: d!.currency });
      }
      if (d!.prospectId && (a.stage === "won" || a.stage === "lost")) await ctx.db.patch(d!.prospectId, { stage: a.stage, updatedAt: now });
    }
    await ctx.db.patch(a.id, patch);
    const after = (await ctx.db.get(a.id))!;
    await syncRevenue(ctx, after);
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

/** Won deals with a value are revenue in Results (one event per deal, kept in step with edits). */
async function syncRevenue(ctx: MutationCtx, d: Doc<"deals">) {
  const existing = await ctx.db.query("revenueEvents").withIndex("by_org_source_event", (q) => q.eq("orgId", d.orgId).eq("source", "crm").eq("sourceEventId", d._id)).first();
  const counts = d.stage === "won" && (d.valueMinor ?? 0) > 0;
  if (!counts) {
    if (existing) await ctx.db.delete(existing._id);
    return;
  }
  const row = { orgId: d.orgId, source: "crm", sourceEventId: d._id, occurredAt: d.wonAt ?? Date.now(), customerRef: d.email ?? d.name, currency: d.currency, amountMinor: d.valueMinor!, refundedMinor: 0, kind: "order" as const, utmSource: d.source === "outbound" ? "climbos_outbound" : d.source === "booking" ? "climbos_booking" : undefined, isFixture: false, ingestedAt: Date.now() };
  if (existing) await ctx.db.patch(existing._id, row);
  else await ctx.db.insert("revenueEvents", row);
}
