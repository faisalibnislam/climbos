import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { STRATEGY_LEARNING_CONTEXT_CHARS } from "../shared/agents/context";
import { sha256Hex } from "../shared/policy";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

const MODES = ["grounded", "adjacent", "bold"] as const;
type Mode = (typeof MODES)[number];
type Exploration = NonNullable<NonNullable<Doc<"strategies">["expert"]>["strategyExploration"]>;

function optionFor(strategy: Doc<"strategies">, mode: Mode): Exploration[Mode] | null {
  return strategy.expert?.strategyExploration?.[mode] ?? null;
}

export const feedbackForStrategy = query({
  args: { slug: v.string(), strategyId: v.id("strategies") },
  handler: async (ctx, { slug, strategyId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    const results: Record<string, unknown> = {};
    for (const mode of MODES) {
      const row = await ctx.db.query("strategyExplorationFeedback")
        .withIndex("by_strategy_mode", (q) => q.eq("strategyId", strategyId).eq("mode", mode))
        .order("desc").first();
      if (row?.orgId === org._id) results[mode] = {
        decision: row.decision,
        ownerEdit: row.ownerEdit ?? "",
        ownerEditHash: row.ownerEditHash ?? null,
        optionHash: row.optionHash,
        strategyStatusAtFeedback: row.strategyStatusAtFeedback,
        testState: row.testState,
        outcomeNote: row.outcomeNote ?? "",
        outcomeEvidence: row.outcomeEvidence,
        createdAt: row.createdAt,
        retiredAt: row.retiredAt ?? null,
      };
    }
    return { canEdit: role === "owner" || role === "admin" || role === "editor", feedback: results };
  },
});

export const recordFeedback = mutation({
  args: {
    slug: v.string(),
    strategyId: v.id("strategies"),
    mode: v.union(...MODES.map((mode) => v.literal(mode))),
    decision: v.union(v.literal("considering"), v.literal("selected"), v.literal("rejected"), v.literal("edited")),
    ownerEdit: v.optional(v.string()),
    testState: v.union(v.literal("not_started"), v.literal("designed"), v.literal("executed"), v.literal("observed"), v.literal("unknown")),
    outcomeNote: v.optional(v.string()),
    outcomeEvidence: v.union(v.literal("measured"), v.literal("owner_reported"), v.literal("source_reported"), v.literal("inferred"), v.literal("unknown")),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const strategy = assertSameOrg(await ctx.db.get(args.strategyId), org._id, "plan");
    const option = optionFor(strategy, args.mode);
    if (!option || typeof option.title !== "string") throw appError("INVALID", "This plan has no saved strategy option to review.");
    if (args.ownerEdit && args.ownerEdit.length > 2_000) throw appError("INVALID", "Keep the owner edit under 2,000 characters.");
    if (args.outcomeNote && args.outcomeNote.length > 1_500) throw appError("INVALID", "Keep the outcome note under 1,500 characters.");
    if (args.decision === "edited" && !args.ownerEdit?.trim()) throw appError("INVALID", "Describe the version you changed so the original and your edit stay distinguishable.");
    if (args.testState === "observed" && !args.outcomeNote?.trim()) throw appError("INVALID", "Add the observed result, or mark the outcome unknown.");
    if (args.testState === "unknown" && args.outcomeEvidence !== "unknown") throw appError("INVALID", "Unknown outcomes must keep their evidence status as unknown.");
    if (args.testState !== "observed" && args.outcomeEvidence !== "unknown") throw appError("INVALID", "Label outcome evidence only after an outcome is recorded.");
    const optionHash = await sha256Hex(JSON.stringify(option));
    const ownerEdit = args.ownerEdit?.trim() || undefined;
    const ownerEditHash = ownerEdit ? await sha256Hex(ownerEdit) : undefined;
    const now = Date.now();
    await ctx.db.insert("strategyExplorationFeedback", {
      orgId: org._id,
      strategyId: args.strategyId,
      mode: args.mode,
      optionTitle: option.title,
      optionHash,
      optionSnapshot: option,
      strategyStatusAtFeedback: strategy.status,
      decision: args.decision,
      ...(ownerEdit ? { ownerEdit, ownerEditHash } : {}),
      testState: args.testState,
      ...(args.outcomeNote?.trim() ? { outcomeNote: args.outcomeNote.trim() } : {}),
      outcomeEvidence: args.outcomeEvidence,
      createdBy: user._id,
      createdAt: now,
    });
    await audit(ctx, {
      orgId: org._id,
      actorType: "user",
      actorId: user._id,
      action: "strategy_exploration.feedback",
      subjectType: "strategy",
      subjectId: args.strategyId,
      summary: `Recorded ${args.decision} feedback for the ${args.mode} option “${option.title.slice(0, 80)}” (test: ${args.testState}; evidence: ${args.outcomeEvidence}).`,
    });
    return { createdAt: now, optionHash };
  },
});

/** Feedback and send-back notes older than this stop guiding plans; owners can also retire them sooner. */
export const LEARNING_MAX_AGE_DAYS = 365;
type UseReason = "included" | "retired" | "expired" | "invalid_date" | "superseded" | "unverified" | "context_limit";
function dateReason(createdAt: number | undefined, retiredAt: number | undefined, now: number): UseReason | null {
  if (retiredAt !== undefined) return "retired";
  if (createdAt === undefined || !Number.isFinite(createdAt) || createdAt > now || createdAt < 0) return "invalid_date";
  return now - createdAt > LEARNING_MAX_AGE_DAYS * 86_400_000 ? "expired" : null;
}

/** One selection feeds both owner inspection and generation. Whole records only. */
async function learningSelection(ctx: QueryCtx, orgId: Id<"organizations">) {
  const now = Date.now();
  const [candidateFeedback, candidateApprovals] = await Promise.all([
    ctx.db.query("strategyExplorationFeedback").withIndex("by_org_created", q => q.eq("orgId", orgId)).order("desc").take(81),
    ctx.db.query("approvals").withIndex("by_org_subject_status_decided", q => q.eq("orgId", orgId).eq("subjectType", "strategy").eq("status", "rejected")).order("desc").take(41),
  ]);
  const limited = candidateFeedback.length > 80 || candidateApprovals.length > 40;
  const prefix = `Tenant-scoped strategy learning (captured ${new Date(now).toISOString().slice(0, 10)}; owner decisions and rejection notes are preference signals, not proof of business performance):\n`;
  const suffix = "\nBounded sample: latest 80 feedback reports and 40 strategy rejections; at most 8 option reports and 5 rejection notes, with complete records within the context budget. Superseded, retired, stale, untraceable and over-budget records are omitted. Outcome evidence labels are owner declarations, not independent verification. Original tests are proposals, not proof they ran unchanged. Recheck current facts, goal and constraints; match original test conditions before reusing a result. Changed conditions may justify reconsideration; a prior rejection never bans bold exploration. Never treat selection as approval to execute.";
  let remaining = STRATEGY_LEARNING_CONTEXT_CHARS - prefix.length - suffix.length;
  const lines: string[] = [];
  function include(line: string, count: number, cap: number): boolean {
    if (count >= cap || line.length + 1 > remaining) return false;
    lines.push(line);
    remaining -= line.length + 1;
    return true;
  }
  const seen = new Set<string>();
  const feedback = [];
  let includedFeedback = 0;
  for (const row of candidateFeedback.slice(0, 80)) {
    const key = `${row.strategyId}:${row.mode}`;
    let reason: UseReason | null = seen.has(key) ? "superseded" : dateReason(row.createdAt, row.retiredAt, now);
    // Mark before eligibility checks: retiring the latest report never revives an older one.
    seen.add(key);
    if (!reason) {
      const plan = await ctx.db.get(row.strategyId);
      const option = row.optionSnapshot ?? (plan ? optionFor(plan, row.mode) : null);
      if (!plan || plan.orgId !== orgId || !option || await sha256Hex(JSON.stringify(option)) !== row.optionHash) {
        reason = "unverified";
      } else {
        const result = row.testState === "observed"
          ? `reported observation (${row.outcomeEvidence.replaceAll("_", "-")}): ${row.outcomeNote ?? ""}`
          : `test state: ${row.testState}; outcome evidence: unknown; no observed result`;
        const original = { audience: option.audienceOrCondition, mechanism: option.businessMechanism, action: option.businessAction, assumptions: option.assumptions, risks: option.risks, test: option.reversibleTest };
        const line = `- ${row.mode} option “${row.optionTitle}” (plan ${row.strategyId}, option ${row.optionHash}, report ${row._id}, recorded ${new Date(row.createdAt).toISOString()}): owner decision ${row.decision}; ${result}${row.ownerEdit ? `; owner edit (not verified execution): ${row.ownerEdit}` : ""}; original proposal and test conditions: ${JSON.stringify(original)}`;
        reason = include(line, includedFeedback, 8) ? "included" : "context_limit";
        if (reason === "included") includedFeedback++;
      }
    }
    feedback.push({ id: row._id, mode: row.mode, optionTitle: row.optionTitle, decision: row.decision, testState: row.testState, outcomeNote: row.outcomeNote ?? null, createdAt: row.createdAt, retired: row.retiredAt !== undefined, used: reason === "included", reason });
  }
  const planNotes = [];
  let includedNotes = 0;
  for (const approval of candidateApprovals.slice(0, 40)) {
    const strategyId = ctx.db.normalizeId("strategies", approval.subjectId);
    const plan = strategyId ? await ctx.db.get(strategyId) : null;
    const note = approval.decisionNote?.trim();
    if (!plan || plan.orgId !== orgId || plan.approvalId !== approval._id || !note) continue;
    let reason = dateReason(approval.decidedAt, plan.rejectionNoteRetiredAt, now);
    if (!reason) {
      const line = `- Growth plan v${plan.version} (${plan._id}) sent back at ${new Date(approval.decidedAt!).toISOString()}: owner-reported rationale: ${note} (preference only; reassess if current evidence or constraints differ)`;
      reason = include(line, includedNotes, 5) ? "included" : "context_limit";
      if (reason === "included") includedNotes++;
    }
    planNotes.push({ strategyId: plan._id, version: plan.version, note, createdAt: approval.decidedAt ?? null, retired: plan.rejectionNoteRetiredAt !== undefined, used: reason === "included", reason });
  }
  return { feedback, planNotes, limited, brief: lines.length ? prefix + lines.join("\n") + suffix : "" };
}

export const learningSources = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const { feedback, planNotes, limited } = await learningSelection(ctx, org._id);
    return { canEdit: role === "owner" || role === "admin" || role === "editor", maxAgeDays: LEARNING_MAX_AGE_DAYS, feedback, planNotes, limited };
  },
});

/** Stop (or resume) one piece of feedback guiding future plans; the record itself is kept. */
export const setFeedbackRetired = mutation({
  args: { slug: v.string(), feedbackId: v.id("strategyExplorationFeedback"), retired: v.boolean() },
  handler: async (ctx, { slug, feedbackId, retired }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const row = assertSameOrg(await ctx.db.get(feedbackId), org._id, "feedback");
    await ctx.db.patch(row._id, retired ? { retiredAt: Date.now(), retiredBy: user._id } : { retiredAt: undefined, retiredBy: undefined });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: retired ? "strategy_learning.retired" : "strategy_learning.restored", subjectType: "strategy", subjectId: row.strategyId, summary: `${retired ? "Retired" : "Restored"} feedback on the ${row.mode} option “${row.optionTitle.slice(0, 80)}”.` });
  },
});

export const setPlanNoteRetired = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), retired: v.boolean() },
  handler: async (ctx, { slug, strategyId, retired }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const plan = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    await ctx.db.patch(plan._id, { rejectionNoteRetiredAt: retired ? Date.now() : undefined });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: retired ? "strategy_learning.retired" : "strategy_learning.restored", subjectType: "strategy", subjectId: plan._id, summary: `${retired ? "Retired" : "Restored"} the send-back note on plan v${plan.version}.` });
  },
});

/** Only this tenant's recent, unretired owner decisions are reusable; they are guidance, never outcome proof. */
export async function creativeStrategyLearningBrief(ctx: QueryCtx, orgId: Id<"organizations">): Promise<string> {
  return (await learningSelection(ctx, orgId)).brief;
}
