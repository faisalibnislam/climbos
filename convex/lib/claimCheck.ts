import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { evidenceKind } from "../../shared/agents/evidenceKind";
import { factFreshness } from "../../shared/agents/factFreshness";
import { findConflicts } from "../../shared/agents/conflicts";
import { activeBusinessFacts } from "./businessFacts";
import { lintClaims } from "../../shared/agents/lint";

/**
 * Owner edits and owner-written posts skip generation lint, so approval re-runs
 * the same capability, scale, scarcity and deadline checks against the
 * business's current confirmed facts (owner, behaviour or measured only).
 */
export async function unsupportedClaimIssue(ctx: QueryCtx, businessId: Id<"businesses">, texts: (string | undefined)[]): Promise<string | null> {
  const text = texts.filter(Boolean).join("\n");
  if (!text.trim()) return null;
  const now = Date.now();
  const business = await ctx.db.get(businessId);
  if (!business) return "The business evidence is unavailable. Review the workspace before approving this copy.";
  const { facts, limited } = await activeBusinessFacts(ctx, business, 200, false);
  if (limited) return "There are too many active business facts to verify this copy safely. Review and remove outdated or repeated facts in Settings → Business facts before approving.";
  const current = facts.filter(f => !factFreshness(f.category, f.updatedAt, now, f.verifiedAt ?? f.updatedAt).reviewSuggested);
  const entries = current.map(f => ({ id: String(f._id), statement: f.statement, category: f.category }));
  // The detector's normal six-item display cap must not truncate an authorization check.
  const conflicts = findConflicts(entries, Infinity);
  const unsettled = new Set(conflicts.flatMap(c => c.factIds));
  const copyPrefix = "__copy_under_review__";
  // Compare asserted current terms sentence by sentence; former-price claims
  // still go through the existing evidence check, not the current-price comparison.
  const copyEntries = text.split(/[\n!?;]+|\.(?=\s|$)/)
    .map(statement => statement.trim())
    .filter(statement => statement && !/\b(?:was|were|used to|previously|formerly|originally|compare at|valued at)\b/i.test(statement))
    .map((statement, i) => ({ id: `${copyPrefix}${i}`, statement }));
  const copyConflict = findConflicts([...entries, ...copyEntries], Infinity).find(c => c.factIds.some(id => id.startsWith(copyPrefix)));
  if (copyConflict) return `Saved business details disagree with this copy about ${copyConflict.subject}. Review the facts and current wording before approving.`;
  const evidence = current
    .filter(f => !unsettled.has(String(f._id)))
    .filter(f => ["owner", "behavior", "measured"].includes(evidenceKind(f.statement, f.provenance)))
    .map(f => f.statement)
    .join("\n");
  return lintClaims([{ path: "copy", text }], evidence).find(issue => issue.severity === "error")?.message ?? null;
}
