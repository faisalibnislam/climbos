import { v } from "convex/values";
import { budgetBand, BUSINESS_TYPES, CHANNEL_BY_ID, EXECUTION_LABEL, FAMILIES, typesFromLegacy, TYPE_BY_KEY } from "../shared/acquisition/library";
import {
  DIMENSIONS,
  dimensionsToConfirm,
  FACTOR_LABEL,
  FACTORS,
  profileFrom,
  scoreChannels,
  STATUS_LABEL,
  VALUE_LABEL,
  type Adjustment,
  type DimensionKey,
  type OwnerChannelPreference,
  type SavedAcquisition,
} from "../shared/acquisition/scoring";
import { mutation, query } from "./_generated/server";
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
      budget: { usd: profile.budgetUsd, band: band.label, approach: band.approach },
      types: profile.types.map((k) => ({ key: k, label: TYPE_BY_KEY[k]?.label ?? k, regulated: TYPE_BY_KEY[k]?.regulated ?? null })),
      typesSource: profile.typesSource ?? "inferred",
      dimensions: (Object.keys(DIMENSIONS) as DimensionKey[]).map((k) => ({
        key: k,
        label: DIMENSIONS[k].label,
        value: profile.dims[k]?.value ?? null,
        valueLabel: profile.dims[k] ? (VALUE_LABEL[profile.dims[k]!.value] ?? profile.dims[k]!.value) : null,
        confidence: profile.dims[k]?.confidence ?? null,
        source: profile.dims[k]?.source ?? null,
        options: DIMENSIONS[k].values.map((value) => ({ value, label: VALUE_LABEL[value] ?? value })),
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
  args: { slug: v.string(), key: v.string(), value: v.string() },
  handler: async (ctx, { slug, key, value }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const k = key as DimensionKey;
    if (!(k in DIMENSIONS) || !(DIMENSIONS[k].values as readonly string[]).includes(value)) throw appError("INVALID", "That isn't one of the options.");
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();
    if (!business) throw appError("NOT_FOUND", "Set up your business first.");
    const prior = business.acquisition ?? { types: typesFromLegacy(business.businessType), dims: {}, updatedAt: 0 };
    const dims = { ...(prior.dims as Record<string, unknown>), [k]: { value, confidence: "high", source: "owner" } };
    await ctx.db.patch(business._id, { acquisition: { types: prior.types, typesSource: prior.typesSource ?? "inferred", dims, channelPreferences: prior.channelPreferences ?? [], updatedAt: Date.now() } });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "acquisition.dimension", subjectType: "business", subjectId: business._id, summary: `${DIMENSIONS[k].label}: ${VALUE_LABEL[value] ?? value}` });
  },
});

const MAX_CHANNEL_PREFERENCES = 20;

/** Save an owner-reported channel preference as a bounded soft ranking signal. */
export const setChannelPreference = mutation({
  args: { slug: v.string(), channelId: v.string(), preference: v.union(v.literal("prefer"), v.literal("avoid"), v.literal("clear")), rationale: v.optional(v.string()) },
  handler: async (ctx, { slug, channelId, preference, rationale }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    if (!CHANNEL_BY_ID[channelId]) throw appError("INVALID", "Choose a channel from the ClimbOS channel list.");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    if (!business) throw appError("NOT_FOUND", "Set up your business first.");
    const prior = business.acquisition ?? { types: typesFromLegacy(business.businessType), dims: {}, updatedAt: 0 };
    const channelPreferences = (prior.channelPreferences ?? []).filter((item) => item.channelId !== channelId) as OwnerChannelPreference[];
    if (preference !== "clear") {
      const clean = rationale?.trim().slice(0, 280) ?? "";
      if (clean.length < 8) throw appError("INVALID", "Add a short reason so this owner-reported preference is useful later.");
      if (channelPreferences.length >= MAX_CHANNEL_PREFERENCES) throw appError("INVALID", `Keep up to ${MAX_CHANNEL_PREFERENCES} channel preferences; clear one before adding another.`);
      channelPreferences.push({ channelId, preference, rationale: clean });
    }
    await ctx.db.patch(business._id, { acquisition: { types: prior.types, typesSource: prior.typesSource ?? "inferred", dims: prior.dims, channelPreferences, updatedAt: Date.now() } });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "acquisition.channel_preference", subjectType: "business", subjectId: business._id, summary: preference === "clear" ? `Cleared owner preference for ${CHANNEL_BY_ID[channelId]!.name}.` : `Marked ${CHANNEL_BY_ID[channelId]!.name} as ${preference}; owner-reported rationale saved.` });
  },
});
