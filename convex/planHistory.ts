import { planContentHash } from "./lib/planHash";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { activePolicyVersion } from "./jobWrites";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { approvalHash } from "../shared/policy";
import { PLAN_PARTS, PLAN_PART_KEYS, describeParts, type PlanPartKey } from "../shared/planParts";

const DAY = 24 * 60 * 60 * 1000;
const MAX_VERSIONS = 50;

type SnapshotSummary = Record<string, unknown> & { snapshotId?: string };

/** Describe only recorded input changes between two plan snapshots; don't infer causation from plan text. */
function changedPlanningInputs(previous: Strategy, current: Strategy): string[] {
  const before = previous.expert?.snapshot as SnapshotSummary | undefined;
  const after = current.expert?.snapshot as SnapshotSummary | undefined;
  if (!before || !after) return [];
  const same = (key: string) => JSON.stringify(before[key] ?? null) === JSON.stringify(after[key] ?? null);
  const changes: string[] = [];
  if (!same("goalInput") || previous.goalId !== current.goalId || !same("goal") || !same("horizonDays") || !same("monthlyAdBudget")) changes.push("goal or budget");
  if (!same("businessProfile") || !same("businessLifecycleStage") || !same("businessFunnel")) changes.push("business profile or operating data");
  if (!same("businessFactVersions") || !same("staleFactIds") || !same("contradictions")) changes.push("business facts");
  if (!same("ownerEconomics")) changes.push("unit economics");
  if (!same("growthCashTiming")) changes.push("growth cash timing");
  if (!same("brandProfile") || !same("ownerChannelPreferences")) changes.push("brand or channel preferences");
  if (!same("businessResearchAt") || !same("sourceUrls") || !same("marketChangeVersions") || !same("knowledgeReferences")) changes.push("research or market evidence");
  if (!same("capabilities")) changes.push("connected capabilities");
  if (!changes.length && before.snapshotId !== after.snapshotId) changes.push("other recorded planning inputs");
  return changes;
}

async function userName(ctx: QueryCtx, id: Id<"users"> | undefined): Promise<string | null> {
  if (!id) return null;
  const u = await ctx.db.get(id);
  return u ? (u.name ?? u.email ?? null) : null;
}

/** Every plan version, newest first, with why it changed and who approved it. */
export const versions = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    const rows = await ctx.db
      .query("strategies")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(MAX_VERSIONS);
    const asc = [...rows].sort((a, b) => a.version - b.version);
    const approvals = new Map<string, Doc<"approvals"> | null>();
    for (const s of asc) approvals.set(s._id, s.approvalId ? await ctx.db.get(s.approvalId) : null);
    const latestVersion = asc[asc.length - 1]?.version ?? 0;
    const out = [];
    for (let i = 0; i < asc.length; i++) {
      const s = asc[i];
      const prev = i > 0 ? asc[i - 1] : null;
      const prevApproval = prev ? approvals.get(prev._id) : null;
      const approval = approvals.get(s._id) ?? null;
      let reason: string;
      if (s.restoredFrom) reason = `Restored ${describeParts(s.restoredFrom.parts)} from v${s.restoredFrom.version}`;
      else if (!prev) reason = "First plan";
      else if (prevApproval?.status === "rejected") reason = prevApproval.decisionNote?.trim() ? `Sent back: ${prevApproval.decisionNote.trim()}` : `v${prev.version} sent back`;
      else {
        const run = s.runId ? await ctx.db.get(s.runId) : null;
        const by = await userName(ctx, run?.createdBy);
        const changes = changedPlanningInputs(prev, s);
        if (prev.goalId !== s.goalId && !changes.includes("goal or budget")) changes.unshift("goal or budget");
        reason = changes.length
          ? `Refreshed after recorded changes to ${changes.slice(0, 3).join(", ")}`
          : by ? `Refreshed by ${by}; no material input change is recorded` : "Refresh requested; no material input change is recorded";
      }
      const approved = approval?.status === "approved";
      out.push({
        id: s._id,
        version: s.version,
        status: s.status,
        createdAt: s.createdAt,
        isLatest: s.version === latestVersion,
        inUse: s.status === "approved",
        /** Approved at some point (in use now, or replaced by a later approval). */
        wasApproved: approved,
        sentBack: approval?.status === "rejected",
        reason: reason.slice(0, 160),
        approvedBy: approved ? await userName(ctx, approval?.decidedBy) : null,
        approvedAt: approved ? (approval?.decidedAt ?? null) : null,
      });
    }
    return out.reverse();
  },
});

type Strategy = Doc<"strategies">;
type Expert = NonNullable<Strategy["expert"]>;

/**
 * Restore a whole older version, or some of its parts, as a new version that needs approval.
 * The newest version is the base; the chosen parts come from `fromId`. Nothing changes for the
 * team until the owner approves the new version.
 */
export const restore = mutation({
  args: { slug: v.string(), fromId: v.id("strategies"), parts: v.array(v.string()) },
  handler: async (ctx, { slug, fromId, parts }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const from = assertSameOrg(await ctx.db.get(fromId), org._id, "plan");
    const keys = PLAN_PART_KEYS.filter((k) => parts.includes(k));
    if (!keys.length) throw appError("INVALID", "Pick at least one part to restore.");
    const recent = await ctx.db
      .query("strategies")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .order("desc")
      .take(MAX_VERSIONS);
    const base = recent[0];
    if (!base) throw appError("INVALID", "There's no plan to restore into.");
    if (base._id === from._id) throw appError("INVALID", "This is already the latest version.");

    const take = new Set<PlanPartKey>(keys);
    const pick = <T>(part: PlanPartKey, field: (s: Strategy) => T): T => field(take.has(part) ? from : base);
    // Expert detail: start from the base, then copy each chosen part's fields from the older version.
    let expert: Expert | undefined = base.expert ? { ...base.expert } : from.expert ? { ...from.expert } : undefined;
    if (expert) {
      for (const p of PLAN_PARTS) {
        if (!take.has(p.key) || !p.expert.length) continue;
        for (const f of p.expert) {
          const val = (from.expert as Record<string, unknown> | undefined)?.[f];
          if (val === undefined) delete (expert as Record<string, unknown>)[f];
          else (expert as Record<string, unknown>)[f] = val;
        }
      }
      if (!expert.diagnosis && !expert.northStar) expert = from.expert && take.size === PLAN_PARTS.length ? from.expert : expert;
      if (expert && take.has("plays")) expert.version = from.expert?.version ?? 0;
    }
    // Restored channels start over: they become active again only when this version is approved.
    const channels = pick("channels", (s) => s.channels).map((c) => {
      const { cardId: _card, ...rest } = c;
      return { ...rest, status: c.status === "parked" ? ("parked" as const) : ("proposed" as const) };
    });

    // Versions still waiting are replaced by this one, as with a refresh.
    for (const p of recent) if (p.status === "draft" || p.status === "needs_approval") await ctx.db.patch(p._id, { status: "superseded" });

    const now = Date.now();
    const version = base.version + 1;
    const strategyId = await ctx.db.insert("strategies", {
      orgId: org._id,
      businessId: base.businessId,
      goalId: base.goalId,
      ...(base.acquisition ? { acquisition: base.acquisition } : {}),
      version,
      status: "needs_approval",
      summary: pick("summary", (s) => s.summary),
      positioning: pick("positioning", (s) => s.positioning),
      audiences: pick("audiences", (s) => s.audiences),
      channels,
      constraints: pick("basics", (s) => s.constraints),
      measurementPlan: pick("basics", (s) => s.measurementPlan),
      ...(expert ? { expert } : {}),
      reviewDate: new Date(now + 14 * DAY).toISOString().slice(0, 10),
      sourceFactIds: [...new Set([...base.sourceFactIds, ...(take.size ? from.sourceFactIds : [])])].slice(0, 40),
      generationCostMicros: 0,
      restoredFrom: { version: from.version, parts: keys },
      createdAt: now,
    });

    const expSource = take.has("experiments") ? from : base;
    const experiments = (
      await ctx.db
        .query("experiments")
        .withIndex("by_org", (q) => q.eq("orgId", org._id))
        .order("desc")
        .take(200)
    ).filter((e) => e.strategyId === expSource._id);
    for (const e of experiments.slice(0, 4)) {
      // A new version starts the test fresh: its results stay with the version that ran it.
      const { _id, _creationTime, resultNote: _note, analyses: _analyses, ...rest } = e;
      await ctx.db.insert("experiments", { ...rest, strategyId, status: "proposed", createdAt: now });
    }

    // Same approval binding as a refreshed plan.
    const policyVersion = await activePolicyVersion(ctx, org._id);
    const saved = await ctx.db.get(strategyId);
    const hash = saved ? await planContentHash(saved) : `strategy:${strategyId}:v${version}`;
    const expiresAt = now + 14 * DAY;
    const binding = { orgId: org._id, subjectType: "strategy", subjectId: strategyId, actionKind: "approve_plan", contentHash: hash, scope: {}, policyVersion, expiresAt };
    const approvalId = await ctx.db.insert("approvals", {
      orgId: org._id,
      subjectType: "strategy",
      subjectId: strategyId,
      actionKind: "approve_plan",
      title: `Growth plan v${version}`,
      contentHash: hash,
      scope: {},
      costEstimateMicros: 0,
      policyVersion,
      approvalHash: await approvalHash(binding),
      status: "pending",
      expiresAt,
      createdAt: now,
    });
    await ctx.db.patch(strategyId, { approvalId });
    await audit(ctx, {
      orgId: org._id,
      actorType: "user",
      actorId: user._id,
      action: "plan.restored",
      subjectType: "strategy",
      subjectId: strategyId,
      summary: `Restored ${describeParts(keys)} from growth plan v${from.version} as v${version}.`,
    });
    return { strategyId, version };
  },
});
