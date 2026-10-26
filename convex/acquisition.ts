import { v } from "convex/values";
import { minorToMajor } from "../shared/economics/currency";
import { budgetBand, BUSINESS_TYPES, CHANNEL_BY_ID, EXECUTION_LABEL, FAMILIES, typesFromLegacy, TYPE_BY_KEY } from "../shared/acquisition/library";
import {
  DIMENSIONS,
  dimensionsToConfirm,
  FACTOR_LABEL,
  FACTORS,
  profileFrom,
  scoreChannels,
  STATUS_LABEL,

  MULTI_DIMENSIONS,
  dimensionValueLabel,
  type Adjustment,
  type DimensionKey,
  type OwnerChannelPreference,
  type SavedAcquisition,
} from "../shared/acquisition/scoring";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { channelWork } from "../shared/acquisition/makeItHappen";
import { createRunWithReservation } from "./engine";
import { maxJobMicros, planJob } from "./lib/jobPlans";
import { resolveAiMode } from "./lib/aiMode";
import { resolveModelRoute } from "./lib/modelRoute";
import { audit } from "./lib/audit";
import { appError, requireOrgAccess } from "./lib/tenancy";

/**
 * Acquisition Intelligence for owners: which channels fit this business, why,
 * and in what order. Scores are recomputed on every read from the saved profile
 * and the plan's evidence-backed adjustments, so confirming a detail re-ranks
 * channels instantly without another AI run.
 */

export const view = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    const goal = await ctx.db
      .query("goals")
      .withIndex("by_org_status", (q) => q.eq("orgId", org._id).eq("status", "active"))
      .first();
    if (!business || !goal) return null;
    const strategies = await ctx.db
      .query("strategies")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(5);
    const strategy = strategies.find((s) => s.status === "approved") ?? strategies[0] ?? null;
    const planned = strategy?.acquisition ?? null;
    // The business's saved classification (owner confirmations) wins over the plan's snapshot.
    const saved: SavedAcquisition | null = business.acquisition ? { types: business.acquisition.types, typesSource: business.acquisition.typesSource ?? "inferred", dims: business.acquisition.dims, channelPreferences: business.acquisition.channelPreferences } : planned ? { types: planned.profile.types, typesSource: planned.profile.typesSource ?? "inferred", dims: planned.profile.dims } : null;
    const profile = profileFrom({ saved, legacyType: business.businessType, currency: goal.currency ?? business.currency, budgetMinor: goal.monthlyAdBudgetMinor, horizonDays: goal.horizonDays, legacyTypes: typesFromLegacy, priceUsdMonth: business.unitEconomics?.revenuePerCustomerMonthUsd ?? (planned?.profile as { priceUsdMonth?: number } | undefined)?.priceUsdMonth });
    // Apply saved owner limits consistently on the Channels view; connections stay live.
    const connected = planned?.limits ? (await ctx.db.query("connections").withIndex("by_org", (q) => q.eq("orgId", org._id)).take(50)).filter((c) => c.status === "connected").map((c) => c.provider) : null;
    const limits = planned?.limits ? {
      ownerHoursPerWeek: planned.limits.ownerHoursPerWeek ?? undefined,
      newCustomersPerMonth: business.unitEconomics?.newCustomersPerMonth,
      connected,
    } : undefined;
    const rows = scoreChannels(profile, (planned?.adjustments as Adjustment[] | undefined) ?? [], undefined, limits);
    const band = budgetBand(profile.budgetUsd);
    return {
      canEdit: role !== "viewer",
      scored: Boolean(planned),
      summary: planned?.summary ?? [],
      budget: { usd: profile.budgetUsd, band: band.label, approach: band.approach, amount: minorToMajor(goal.monthlyAdBudgetMinor, goal.currency), currency: goal.currency },
      canSetBudget: role !== "viewer",
      types: profile.types.map((k) => ({ key: k, label: TYPE_BY_KEY[k]?.label ?? k, regulated: TYPE_BY_KEY[k]?.regulated ?? null })),
      typesSource: profile.typesSource ?? "inferred",
      availableTypes: BUSINESS_TYPES.map(({ key, label, category, customer, regulated }) => ({ key, label, category, customer, regulated: regulated ?? null })),
      dimensions: (Object.keys(DIMENSIONS) as DimensionKey[]).map((k) => ({
        key: k,
        label: DIMENSIONS[k].label,
        value: profile.dims[k]?.value ?? null,
        values: profile.dims[k] ? (profile.dims[k]!.values?.length ? profile.dims[k]!.values! : [profile.dims[k]!.value]) : [],
        multi: MULTI_DIMENSIONS.has(k),
        valueLabel: profile.dims[k] ? (profile.dims[k]!.values?.length ? profile.dims[k]!.values! : [profile.dims[k]!.value]).map((x) => dimensionValueLabel(k, x)).join(", ") : null,
        confidence: profile.dims[k]?.confidence ?? null,
        source: profile.dims[k]?.source ?? null,
        options: DIMENSIONS[k].values.map((value) => ({ value, label: dimensionValueLabel(k, value) })),
      })),
      toConfirm: dimensionsToConfirm(profile),
      factorLabels: FACTORS.map((f) => ({ key: f, label: FACTOR_LABEL[f] })),
      channels: rows.map((r) => ({
        id: r.id,
        name: r.name,
        family: FAMILIES[r.family],
        exec: r.exec,
        execLabel: EXECUTION_LABEL[r.exec],
        learn: r.learn,
        minMonthly: r.minMonthly,
        paid: r.paid,
        score: r.score,
        factors: FACTORS.map((f) => r.factors[f]),
        status: r.status,
        statusLabel: STATUS_LABEL[r.status],
        why: r.why,
        evidence: r.evidence ?? null,
        evidenceBasis: r.evidenceBasis ?? null,
        evidenceConfidence: r.evidenceConfidence ?? null,
        evidenceDate: r.evidenceDate ?? null,
        sourceUrl: r.sourceUrl ?? null,
        communityRulesUrl: r.communityRulesUrl ?? null,
        communityRulesCheckedAt: r.communityRulesCheckedAt ?? null,
        purpose: r.purpose ?? null,
        measurementPlan: r.measurementPlan ?? null,
        platform: r.platform ?? null,
        tactic: r.tactic ?? null,
        audience: r.audienceName ?? null,
        caution: r.caution ?? null,
        limits: r.limits ?? [],
        ownerPreference: r.ownerPreference ?? null,
      })),
    };
  },
});

/** The owner confirms the business identities that may enable hard channel eligibility. */
export const setTypes = mutation({
  args: { slug: v.string(), types: v.array(v.string()) },
  handler: async (ctx, { slug, types }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    if (types.length < 1 || types.length > 3 || new Set(types).size !== types.length || types.some((type) => !TYPE_BY_KEY[type])) {
      throw appError("INVALID", `Choose 1–3 distinct business types from the ${BUSINESS_TYPES.length} available categories.`);
    }
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) throw appError("NOT_FOUND", "Set up your business first.");
    const prior = business.acquisition;
    await ctx.db.patch(business._id, { acquisition: { types, typesSource: "owner", dims: prior?.dims ?? {}, channelPreferences: prior?.channelPreferences ?? [], updatedAt: Date.now() } });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "acquisition.types_confirmed", subjectType: "business", subjectId: business._id, summary: `Confirmed ${types.length} business type${types.length === 1 ? "" : "s"} for channel eligibility.` });
  },
});

/** The owner confirms or corrects one business detail; channels re-rank on the next read. */
export const setDimension = mutation({
  args: { slug: v.string(), key: v.string(), value: v.string(), values: v.optional(v.array(v.string())) },
  handler: async (ctx, { slug, key, value, values }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const k = key as DimensionKey;
    const allowed = k in DIMENSIONS ? (DIMENSIONS[k].values as readonly string[]) : [];
    const picked = MULTI_DIMENSIONS.has(k) && values?.length ? [...new Set(values)] : [value];
    if (!allowed.length || picked.some((x) => !allowed.includes(x))) throw appError("INVALID", "That isn't one of the options.");
    if (!MULTI_DIMENSIONS.has(k) && values && values.length > 1) throw appError("INVALID", "Pick one answer for this detail.");
    value = picked[0];
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!business) throw appError("NOT_FOUND", "Set up your business first.");
    const prior = business.acquisition ?? { types: typesFromLegacy(business.businessType), dims: {}, updatedAt: 0 };
    const dims = { ...(prior.dims as Record<string, unknown>), [k]: { value, ...(MULTI_DIMENSIONS.has(k) ? { values: picked } : {}), confidence: "high", source: "owner" } };
    await ctx.db.patch(business._id, { acquisition: { types: prior.types, typesSource: prior.typesSource ?? "inferred", dims, channelPreferences: prior.channelPreferences ?? [], updatedAt: Date.now() } });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "acquisition.dimension", subjectType: "business", subjectId: business._id, summary: `${DIMENSIONS[k].label}: ${picked.map((x) => dimensionValueLabel(k, x)).join(", ") || value}` });
  },
});

/** The owner approves ClimbOS's guesses as they stand (all of them, or the listed details); approved guesses count like answers. */
export const approveGuesses = mutation({
  args: { slug: v.string(), keys: v.optional(v.array(v.string())) },
  handler: async (ctx, { slug, keys }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business?.acquisition) throw appError("NOT_FOUND", "There are no guesses to approve yet.");
    const prior = business.acquisition;
    const dims = { ...(prior.dims as Record<string, { value: string; values?: string[]; source: string; confidence: string; evidence?: string }>) };
    const approved: string[] = [];
    for (const [k, d] of Object.entries(dims)) {
      if (!(k in DIMENSIONS) || d?.source !== "inferred" || (keys && !keys.includes(k))) continue;
      dims[k] = { ...d, source: "owner", confidence: "high" };
      approved.push(DIMENSIONS[k as DimensionKey].label);
    }
    if (!approved.length) return { approved: 0 };
    await ctx.db.patch(business._id, { acquisition: { ...prior, dims, updatedAt: Date.now() } });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "acquisition.guesses_approved", subjectType: "business", subjectId: business._id, summary: `Approved ClimbOS's guesses for ${approved.join(", ")}.` });
    return { approved: approved.length };
  },
});

const MAX_CHANNEL_PREFERENCES = 20;

/** Save an owner-reported channel preference as a bounded soft ranking signal. */
export const setChannelPreference = mutation({
  args: { slug: v.string(), channelId: v.string(), preference: v.union(v.literal("prefer"), v.literal("avoid"), v.literal("dismissed"), v.literal("irrelevant"), v.literal("already_using"), v.literal("clear")), rationale: v.optional(v.string()), sourceUrl: v.optional(v.string()) },
  handler: async (ctx, { slug, channelId, preference, rationale, sourceUrl }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    if (!CHANNEL_BY_ID[channelId]) throw appError("INVALID", "Choose a channel from the ClimbOS channel list.");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) throw appError("NOT_FOUND", "Set up your business first.");
    const prior = business.acquisition ?? { types: typesFromLegacy(business.businessType), dims: {}, updatedAt: 0 };
    const channelPreferences = (prior.channelPreferences ?? []).filter((item) => item.channelId !== channelId) as OwnerChannelPreference[];
    if (preference !== "clear") {
      const clean = rationale?.trim().slice(0, 280) ?? "";
      if (clean.length < 8) throw appError("INVALID", "Add a short reason so this owner-reported preference is useful later.");
      const cleanSource = sourceUrl?.trim();
      if (cleanSource && (!/^https:\/\//i.test(cleanSource) || cleanSource.length > 2000)) throw appError("INVALID", "Use a full https:// evidence link or leave it blank.");
      if (channelPreferences.length >= MAX_CHANNEL_PREFERENCES) throw appError("INVALID", `Keep up to ${MAX_CHANNEL_PREFERENCES} channel preferences; clear one before adding another.`);
      channelPreferences.push({ channelId, preference, rationale: clean, evidenceDate: new Date().toISOString().slice(0, 10), ...(cleanSource ? { sourceUrl: cleanSource } : {}) });
    }
    await ctx.db.patch(business._id, { acquisition: { types: prior.types, typesSource: prior.typesSource ?? "inferred", dims: prior.dims, channelPreferences, updatedAt: Date.now() } });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "acquisition.channel_preference", subjectType: "business", subjectId: business._id, summary: preference === "clear" ? `Cleared owner preference for ${CHANNEL_BY_ID[channelId]!.name}.` : `Marked ${CHANNEL_BY_ID[channelId]!.name} as ${preference}; owner-reported rationale saved.` });
  },
});

async function connectedProviders(ctx: QueryCtx, orgId: Id<"organizations">): Promise<string[]> {
  return (await ctx.db.query("connections").withIndex("by_org", (q) => q.eq("orgId", orgId)).take(50)).filter((c) => c.status === "connected").map((c) => c.provider);
}

/** What "Make it happen" will do for a channel and the most it can cost, shown before the owner confirms. */
export const makeItHappenPreview = query({
  args: { slug: v.string(), channelId: v.string() },
  handler: async (ctx, { slug, channelId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "view");
    const channel = CHANNEL_BY_ID[channelId];
    if (!channel) throw appError("INVALID", "Choose a channel from the ClimbOS channel list.");
    const work = channelWork(channel, await connectedProviders(ctx, org._id));
    let maxCostMicros = 0;
    let title: string | null = null;
    if (work.draft) {
      const plan = planJob(work.draft.job, { quantity: "quantity" in work.draft ? work.draft.quantity : undefined, channel: "channel" in work.draft ? work.draft.channel : undefined }, { fixture: org.kind === "demo", mode: await resolveAiMode(ctx, org, work.draft.job) });
      maxCostMicros = maxJobMicros(plan, { fixture: org.kind === "demo", route: await resolveModelRoute(ctx, user._id, undefined) });
      title = plan.title;
    }
    return { channel: channel.name, draftTitle: title, maxCostMicros, todos: work.todos };
  },
});

/** Draft the first work for a channel (into Review work) and add to-dos for the steps only the owner can do. */
export const makeItHappen = mutation({
  args: { slug: v.string(), channelId: v.string() },
  handler: async (ctx, { slug, channelId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const channel = CHANNEL_BY_ID[channelId];
    if (!channel) throw appError("INVALID", "Choose a channel from the ClimbOS channel list.");
    const work = channelWork(channel, await connectedProviders(ctx, org._id));
    let runId: Id<"workflowRuns"> | null = null;
    if (work.draft) {
      const d = work.draft;
      const quantity = "quantity" in d ? d.quantity : undefined;
      const draftChannel = "channel" in d ? d.channel : undefined;
      const aiMode = await resolveAiMode(ctx, org, d.job);
      const plan = planJob(d.job, { quantity, channel: draftChannel }, { fixture: org.kind === "demo", mode: aiMode });
      runId = await createRunWithReservation(ctx, {
        org,
        kind: plan.kind,
        title: `${channel.name}: ${plan.title}`,
        roles: plan.roles,
        input: { channel: draftChannel, quantity, makeItHappen: channelId },
        steps: plan.steps,
        meters: plan.meters,
        createdBy: user._id,
        isFixture: org.kind === "demo",
        aiMode,
        modelRoute: await resolveModelRoute(ctx, user._id, undefined),
      });
      await ctx.scheduler.runAfter(0, internal.jobs.createContent, { runId, job: d.job, ...(draftChannel ? { channel: draftChannel } : {}), ...(quantity ? { quantity } : {}), brief: d.brief });
    }
    const now = Date.now();
    let priority = 1;
    for (const todo of work.todos) {
      await ctx.db.insert("actionCards", {
        orgId: org._id,
        title: todo.title,
        description: todo.description,
        proposedEffect: "A step only you can take. ClimbOS continues once it's done.",
        kind: todo.kind,
        roles: ["coo"],
        payload: JSON.stringify({ channelId }),
        costEstimateMicros: 0,
        externalEffect: false,
        status: "proposed",
        priority: priority++,
        createdAt: now,
        updatedAt: now,
      });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "acquisition.make_it_happen", subjectType: "channel", subjectId: channelId, summary: `Make it happen: ${channel.name}${runId ? " (first drafts started)" : ""}${work.todos.length ? `, ${work.todos.length} to-do${work.todos.length === 1 ? "" : "s"} added` : ""}.` });
    return { runId, todos: work.todos.length };
  },
});
