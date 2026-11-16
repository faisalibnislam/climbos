import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { audit } from "./lib/audit";
import { latestPostResult } from "./lib/postResults";
import { postResultValueIssue, postResultWindow } from "../shared/growth/postResults";
import { can } from "../shared/policy";

export const view = query({
  args: { slug: v.string(), artifactId: v.id("artifacts") },
  handler: async (ctx, { slug, artifactId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const artifact = assertSameOrg(await ctx.db.get(artifactId), org._id, "post");
    if (artifact.kind !== "social_post") throw appError("INVALID", "Choose a social post.");
    const version = artifact.currentVersionId ? await ctx.db.get(artifact.currentVersionId) : null;
    const validVersion = version && version.orgId === org._id && version.artifactId === artifact._id;
    const latest = await latestPostResult(ctx, artifact, validVersion ? version : null, Date.now(), org.kind === "demo");
    return { ...latest, timeZone: org.timezone, demo: org.kind === "demo", canReport: can(role, "edit") && artifact.status === "published" && Boolean(validVersion) && !(latest.issue && !latest.report), versionId: validVersion ? version._id : null, versionNumber: validVersion ? version.version : null, contentHash: validVersion ? version.contentHash : null, publicationKnown: artifact.status === "published" };
  },
});

export const history = query({
  args: { slug: v.string(), artifactId: v.id("artifacts"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { slug, artifactId, paginationOpts }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    assertSameOrg(await ctx.db.get(artifactId), org._id, "post");
    const result = await ctx.db.query("postMetrics").withIndex("by_artifact_captured", q => q.eq("artifactId", artifactId)).order("desc").paginate(paginationOpts);
    return { ...result, page: result.page.filter(report => report.orgId === org._id) };
  },
});

export const record = mutation({
  args: {
    slug: v.string(), artifactId: v.id("artifacts"), versionId: v.id("artifactVersions"), contentHash: v.string(), expectedLatestReportId: v.union(v.id("postMetrics"), v.null()),
    fromDate: v.string(), toDate: v.string(), measurementNote: v.string(),
    qualifiedVisits: v.optional(v.number()), signups: v.optional(v.number()), payingCustomers: v.optional(v.number()), activatedCustomers: v.optional(v.number()), retainedCustomers: v.optional(v.number()), customerQuestionsAnswered: v.optional(v.number()), operatingMinutes: v.optional(v.number()),
    impressions: v.optional(v.number()), reach: v.optional(v.number()), likes: v.optional(v.number()), comments: v.optional(v.number()), shares: v.optional(v.number()), saves: v.optional(v.number()), clicks: v.optional(v.number()),
  },
  handler: async (ctx, { slug, artifactId, versionId, contentHash, expectedLatestReportId, fromDate, toDate, measurementNote: rawNote, ...values }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const artifact = assertSameOrg(await ctx.db.get(artifactId), org._id, "post");
    const version = assertSameOrg(await ctx.db.get(versionId), org._id, "post version");
    if (artifact.kind !== "social_post" || artifact.status !== "published") throw appError("INVALID", "Record results after the post's publication is confirmed.");
    if (artifact.currentVersionId !== versionId || version.artifactId !== artifactId || version.contentHash !== contentHash) throw appError("INVALID", "The post version changed. Reload before reporting results.");
    const latest = await ctx.db.query("postMetrics").withIndex("by_artifact_captured", q => q.eq("artifactId", artifactId)).order("desc").first();
    if ((latest?._id ?? null) !== expectedLatestReportId) throw appError("INVALID", "A newer report was saved. Reopen the form and review it before adding a correction.");
    const issue = postResultValueIssue(values);
    if (issue) throw appError("INVALID", issue);
    const measurementNote = rawNote.trim();
    if (measurementNote.length < 8 || measurementNote.length > 1000) throw appError("INVALID", "Explain the measurement source, qualification definitions and any missing data (8–1,000 characters).");
    const now = Date.now();
    let bounds;
    try { bounds = postResultWindow(fromDate, toDate, org.timezone, now); } catch (error) { throw appError("INVALID", (error as Error).message); }
    if (bounds.periodEnd <= version.createdAt) throw appError("INVALID", "The report window ends before this content version existed.");
    const id = await ctx.db.insert("postMetrics", { orgId: org._id, artifactId, artifactVersionId: versionId, artifactVersionNumber: version.version, contentHash, channel: artifact.channel, capturedAt: now, recordedBy: user._id, source: org.kind === "demo" ? "fixture" : "owner", fromDate, toDate, timeZone: org.timezone, ...bounds, measurementNote, ...values });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "post.results_recorded", subjectType: "artifact", subjectId: artifactId, summary: `Recorded a new ${org.kind === "demo" ? "synthetic demo" : "member-reported"} observation for content version ${version.version}; earlier reports retained. No publication or other external action.` });
    return { id };
  },
});
