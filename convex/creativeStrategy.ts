import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { sha256Hex } from "../shared/policy";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

const MODES = ["grounded", "adjacent", "bold"] as const;
type Mode = (typeof MODES)[number];
type Exploration = Record<Mode, { title?: unknown }>;

function optionFor(strategy: { expert?: { strategyExploration?: unknown } }, mode: Mode): Record<string, unknown> | null {
  const exploration = strategy.expert?.strategyExploration;
  if (!exploration || typeof exploration !== "object") return null;
  const option = (exploration as Exploration)[mode];
  return option && typeof option === "object" ? option as Record<string, unknown> : null;
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

/** Only this tenant's recent owner decisions are reusable; they are guidance, never outcome proof. */
export async function creativeStrategyLearningBrief(ctx: QueryCtx, orgId: Id<"organizations">): Promise<string> {
  const rows = await ctx.db.query("strategyExplorationFeedback")
    .withIndex("by_org_strategy", (q) => q.eq("orgId", orgId))
    .order("desc").take(20);
  const lines = rows.slice(0, 8).map((row) => {
    const evidenceLabel = row.outcomeEvidence.replaceAll("_", "-");
    const result = row.testState === "observed"
      ? `reported observation (${evidenceLabel}): ${row.outcomeNote ?? ""}`
      : `test state: ${row.testState}; outcome evidence: ${row.outcomeEvidence}${row.testState === "unknown" ? "; outcome remains unknown" : ""}`;
    return `- ${row.mode} option “${row.optionTitle}”: owner decision ${row.decision}; ${result}${row.ownerEdit ? `; owner edit: ${row.ownerEdit}` : ""}`;
  });
  // Plan rejections already retain their note in the tenant-owned approval record.
  // Reuse only those explicit notes, and verify the approval belongs to this exact
  // strategy and tenant before making the preference available to future runs.
  const plans = await ctx.db.query("strategies").withIndex("by_org", (q) => q.eq("orgId", orgId)).order("desc").take(20);
  let planNotes = 0;
  for (const plan of plans) {
    if (planNotes >= 5 || !plan.approvalId) continue;
    const approval = await ctx.db.get(plan.approvalId);
    if (!approval || approval.orgId !== orgId || approval.status !== "rejected" || approval.subjectType !== "strategy" || approval.subjectId !== String(plan._id)) continue;
    const note = approval.decisionNote?.trim();
    if (!note) continue;
    lines.push(`- Growth plan v${plan.version} sent back: owner-reported rationale: ${note.slice(0, 500)} (preference only; reassess if current evidence or constraints differ)`);
    planNotes += 1;
  }
  if (!lines.length) return "";
  return `Tenant-scoped strategy learning (captured ${new Date(Date.now()).toISOString().slice(0, 10)}; owner decisions and rejection notes are preference signals, not proof of business performance):\n${lines.join("\n")}\nUse only as this business owner's prior preference and reported learning. Recheck current facts, goal and constraints before applying a prior rejection; a changed situation may justify reconsideration. Keep unknown outcomes unknown, match test conditions before reusing a result, and never treat selection as approval to execute.`;
}
