import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { evidenceKind } from "../../shared/agents/evidenceKind";
import { factFreshness } from "../../shared/agents/factFreshness";
import { lintClaims } from "../../shared/agents/lint";

/**
 * Owner edits and owner-written posts skip generation lint, so approval re-runs
 * the same capability, scale, scarcity and deadline checks against the
 * business's current confirmed facts (owner, behaviour or measured only).
 */
export async function unsupportedClaimIssue(ctx: MutationCtx, businessId: Id<"businesses">, texts: (string | undefined)[]): Promise<string | null> {
  const text = texts.filter(Boolean).join("\n");
  if (!text.trim()) return null;
  const now = Date.now();
  const facts = await ctx.db.query("businessFacts").withIndex("by_business", (q) => q.eq("businessId", businessId)).take(200);
  const evidence = facts
    .filter((f) => (f.reviewState === "confirmed" || f.reviewState === "edited") && !factFreshness(f.category, f.updatedAt, now, f.verifiedAt ?? f.updatedAt).reviewSuggested)
    .filter((f) => ["owner", "behavior", "measured"].includes(evidenceKind(f.statement, f.provenance)))
    .map((f) => f.statement)
    .join("\n");
  return lintClaims([{ path: "copy", text }], evidence).find((issue) => issue.severity === "error")?.message ?? null;
}
