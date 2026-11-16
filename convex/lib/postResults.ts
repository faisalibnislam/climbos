import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { postResultEvidenceIssue } from "../../shared/growth/postResults";

export async function latestPostResult(ctx: Pick<QueryCtx, "db">, artifact: Doc<"artifacts">, version: Doc<"artifactVersions"> | null, now: number, demo: boolean) {
  const report = await ctx.db.query("postMetrics").withIndex("by_artifact_captured", q => q.eq("artifactId", artifact._id)).order("desc").first();
  if (!report) return { report: null, issue: null };
  if (report.orgId !== artifact.orgId || report.channel !== artifact.channel) return { report: null, issue: "The latest report does not match this workspace or channel." };
  if (artifact.status !== "published") return { report, issue: "Publication is not confirmed for this post." };
  return { report, issue: postResultEvidenceIssue(report, version && version.orgId === artifact.orgId && version.artifactId === artifact._id ? { id: version._id, contentHash: version.contentHash, createdAt: version.createdAt } : null, now, demo) };
}
