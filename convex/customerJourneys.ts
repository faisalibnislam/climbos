import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { audit } from "./lib/audit";
import { customerProgressRuleV } from "./lib/customerProgress";
import { checkedJourneyStep, refreshJourney } from "./lib/customerJourneys";
import { normalizeProgressRule } from "../shared/growth/customerProgress";
import { journeyDueAt, MAX_CUSTOMER_JOURNEYS, MAX_JOURNEY_CONTACTS, MAX_JOURNEY_STEPS } from "../shared/growth/customerJourneys";
import { selectedEmail, splitSequence } from "./marketing";
import { can } from "../shared/policy";

export const list = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, membership } = await requireOrgAccess(ctx, { slug }, "view");
    const journeys = await ctx.db.query("customerJourneys").withIndex("by_org", q => q.eq("orgId", org._id)).take(MAX_CUSTOMER_JOURNEYS + 1);
    const items = await Promise.all(journeys.slice(0, MAX_CUSTOMER_JOURNEYS).map(async journey => {
      const entries = await ctx.db.query("journeyContacts").withIndex("by_journey", q => q.eq("journeyId", journey._id)).take(MAX_JOURNEY_CONTACTS + 1);
      const counts = { active: 0, held: 0, exited: 0, completed: 0 };
      for (const e of entries) counts[e.status]++;
      return { ...journey, counts, due: journey.steps.map((_, i) => entries.filter(e => e.status === "active" && e.stepIndex === i && e.dueAt <= Date.now()).length), limited: entries.length > MAX_JOURNEY_CONTACTS };
    }));
    return { items, canManage: can(membership.role, "manage_connections"), omitted: journeys.length > MAX_CUSTOMER_JOURNEYS };
  },
});

export const draftOptions = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const artifacts = await ctx.db.query("artifacts").withIndex("by_org_updated", q => q.eq("orgId", org._id)).order("desc").take(101);
    const options = await Promise.all(artifacts.slice(0, 100).filter(a => (a.kind === "email" || a.kind === "email_sequence") && a.currentVersionId && ["draft", "in_review", "approved"].includes(a.status)).map(async a => {
      const version = await ctx.db.get(a.currentVersionId!);
      if (!version || version.orgId !== org._id || version.artifactId !== a._id || version.version !== a.currentVersion) return [];
      const count = a.kind === "email" ? 1 : splitSequence(version.body).length;
      return Array.from({ length: count }, (_, emailIndex) => {
        const email = selectedEmail(a, version, emailIndex);
        return email?.text.trim() ? { artifactId: a._id, artifactVersionId: version._id, emailIndex, title: `${a.title} · ${email?.subject}`.slice(0, 200) } : null;
      }).filter(x => x !== null);
    }));
    return { options: options.flat(), limited: artifacts.length > 100 };
  },
});

const stepV = v.object({ artifactId: v.id("artifacts"), artifactVersionId: v.id("artifactVersions"), emailIndex: v.number(), delayDays: v.number() });
export const create = mutation({
  args: { slug: v.string(), name: v.string(), segment: v.string(), rule: customerProgressRuleV, steps: v.array(stepV) },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "manage_connections");
    const name = args.name.trim(), segment = args.segment.trim(), rule = normalizeProgressRule(args.rule);
    if (!name || name.length > 120 || !segment || segment.length > 100 || !rule || args.steps.length < 1 || args.steps.length > MAX_JOURNEY_STEPS) throw appError("INVALID", "Name the follow-up, choose its customer-progress rule and add 1–5 email steps.");
    const existing = await ctx.db.query("customerJourneys").withIndex("by_org", q => q.eq("orgId", org._id)).take(MAX_CUSTOMER_JOURNEYS);
    if (existing.length >= MAX_CUSTOMER_JOURNEYS) throw appError("LIMIT_REACHED", "This workspace supports 20 saved follow-ups, including archived history.");
    const steps = [];
    for (const s of args.steps) {
      const artifact = assertSameOrg(await ctx.db.get(s.artifactId), org._id, "email draft");
      const version = assertSameOrg(await ctx.db.get(s.artifactVersionId), org._id, "email version");
      if (artifact.currentVersionId !== version._id || version.artifactId !== artifact._id || version.version !== artifact.currentVersion || !["draft", "in_review", "approved"].includes(artifact.status) || !Number.isInteger(s.emailIndex) || s.emailIndex < 0 || journeyDueAt(Date.now(), s.delayDays) === null) throw appError("INVALID", "Choose a current email draft and an explicit waiting time of 0–365 days for each step.");
      const email = selectedEmail(artifact, version, s.emailIndex);
      if (!email?.text.trim()) throw appError("INVALID", "The selected email is empty or unavailable.");
      steps.push({ ...s, title: email.subject.slice(0, 200) });
    }
    const now = Date.now();
    const id = await ctx.db.insert("customerJourneys", { orgId: org._id, name, segment, rule, steps, status: "draft", revision: 1, createdBy: user._id, trackingOwnerId: user._id, createdAt: now, updatedAt: now, nextCheckAt: now });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "customer_journey.created", summary: `Saved follow-up “${name}” with ${steps.length} version-bound step(s). Tracking has not started; no send was approved.` });
    return id;
  },
});

export const setStatus = mutation({
  args: { slug: v.string(), journeyId: v.id("customerJourneys"), revision: v.number(), status: v.union(v.literal("active"), v.literal("paused"), v.literal("archived")) },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "manage_connections");
    const journey = assertSameOrg(await ctx.db.get(args.journeyId), org._id, "follow-up");
    if (journey.revision !== args.revision || journey.status === "archived") throw appError("INVALID", "This follow-up changed or was archived. Refresh its review.");
    if (journey.status === args.status) return;
    // Taking responsibility is explicit on resume; a revoked creator cannot retain authority.
    const updated = { ...journey, status: args.status, revision: journey.revision + 1, trackingOwnerId: args.status === "active" ? user._id : journey.trackingOwnerId, updatedAt: Date.now() };
    await ctx.db.patch(journey._id, { status: updated.status, revision: updated.revision, trackingOwnerId: updated.trackingOwnerId, updatedAt: updated.updatedAt });
    if (updated.status === "active") await refreshJourney(ctx, updated);
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `customer_journey.${args.status}`, summary: `Follow-up “${journey.name}” ${args.status}. Earlier step approvals no longer apply. No email was sent.` });
  },
});

export const refresh = mutation({
  args: { slug: v.string(), journeyId: v.id("customerJourneys") },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAccess(ctx, { slug: args.slug }, "manage_connections");
    await refreshJourney(ctx, assertSameOrg(await ctx.db.get(args.journeyId), org._id, "follow-up"));
  },
});

/** Safe deep-link resolution: unknown, cross-workspace and obsolete links never fall back to an ordinary send. */
export const stepReview = query({
  args: { slug: v.string(), journey: v.string(), stepIndex: v.number(), artifactId: v.id("artifacts") },
  handler: async (ctx, args) => {
    const { org } = await requireOrgAccess(ctx, { slug: args.slug }, "view");
    const id = ctx.db.normalizeId("customerJourneys", args.journey);
    const journey = id ? await ctx.db.get(id) : null;
    if (!journey || journey.orgId !== org._id) return { ready: false as const, message: "This follow-up is unavailable in this workspace." };
    const ref = { journeyId: journey._id, revision: journey.revision, stepIndex: args.stepIndex };
    try {
      const { step } = await checkedJourneyStep(ctx, org._id, ref, journey.segment, journey.rule);
      if (step.artifactId !== args.artifactId) return { ready: false as const, message: "Open the saved email from this follow-up's step list." };
      return { ready: true as const, ref, name: journey.name, segment: journey.segment, rule: journey.rule, emailIndex: step.emailIndex };
    } catch { return { ready: false as const, message: "This follow-up is paused, needs an audience check, or its saved draft changed. Review it in Customers before sending." }; }
  },
});

export const checkDue = internalMutation({
  args: { journeyId: v.id("customerJourneys") },
  handler: async (ctx, { journeyId }) => { const journey = await ctx.db.get(journeyId); if (journey) await refreshJourney(ctx, journey); },
});
export const tick = internalMutation({
  args: {},
  handler: async ctx => {
    const due = await ctx.db.query("customerJourneys").withIndex("by_due", q => q.eq("status", "active").lte("nextCheckAt", Date.now())).take(10);
    for (const journey of due) {
      await ctx.db.patch(journey._id, { nextCheckAt: Date.now() + 15 * 60_000 });
      await ctx.scheduler.runAfter(0, internal.customerJourneys.checkDue, { journeyId: journey._id });
    }
    if (due.length === 10) await ctx.scheduler.runAfter(1000, internal.customerJourneys.tick, {});
  },
});
