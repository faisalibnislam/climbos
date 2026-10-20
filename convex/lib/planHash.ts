import { canonicalJson, sha256Hex } from "../../shared/policy";
import type { Doc } from "../_generated/dataModel";

/**
 * The plan's content hash (Book 14 §10): what the owner reviews is what gets
 * approved. Covers every planned field; a channel's run status (paused, active)
 * is operational and left out, so parking a channel doesn't void a review;
 * so is the plan's quality record (code's assessment of the content).
 */
export async function planContentHash(s: Pick<Doc<"strategies">, "summary" | "positioning" | "audiences" | "channels" | "constraints" | "measurementPlan" | "expert">): Promise<string> {
  const content = {
    summary: s.summary,
    positioning: s.positioning,
    audiences: s.audiences,
    channels: s.channels.map(({ status: _status, ...c }) => c),
    constraints: s.constraints,
    measurementPlan: s.measurementPlan,
    // Quality is ClimbOS's assessment of the content, not content the owner reviews.
    expert: s.expert ? { ...s.expert, quality: undefined } : null,
  };
  return `plan:sha256:${await sha256Hex(canonicalJson(JSON.parse(JSON.stringify(content))))}`;
}

/** Older plans were bound to their id and version only. */
export const legacyPlanHash = (s: Pick<Doc<"strategies">, "_id" | "version">) => `strategy:${s._id}:v${s.version}`;
