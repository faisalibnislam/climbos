import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";

function findingsFromRun(run: { kind?: string; output?: string }): unknown[] {
  if (run.kind !== "conversion_audit" || !run.output) return [];
  try {
    const output = JSON.parse(run.output) as { designCritic?: { findings?: unknown[] } };
    return Array.isArray(output.designCritic?.findings) ? output.designCritic.findings : [];
  } catch {
    return [];
  }
}

function screenshotTimeFromRun(run: { output?: string }): number | undefined {
  if (!run.output) return undefined;
  try {
    const output = JSON.parse(run.output) as { auditCoverage?: { website?: { visualReview?: { capturedAt?: unknown } } } };
    const value = output.auditCoverage?.website?.visualReview?.capturedAt;
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export const feedback = query({
  args: { slug: v.string(), runId: v.id("workflowRuns") },
  handler: async (ctx, { slug, runId }) => {
    const { org, role } = await requireOrgAccess(ctx, { slug }, "view");
    const run = assertSameOrg(await ctx.db.get(runId), org._id, "audit");
    if (run.kind !== "conversion_audit") throw appError("INVALID", "Review feedback is only available for website audits.");
    const findings = findingsFromRun(run);
    const rows = await ctx.db.query("designFindingReviews").withIndex("by_org_run", (q) => q.eq("orgId", org._id).eq("runId", runId)).take(20);
    const screenshots = await ctx.db.query("websiteAuditScreenshots").withIndex("by_org_run_view", (q) => q.eq("orgId", org._id).eq("runId", runId)).take(2);
    return { canEdit: role === "owner" || role === "admin" || role === "editor", rows: rows.filter((row) => row.findingIndex < findings.length).map((row) => {
      const finding = findings[row.findingIndex] as { directions?: { id?: string; name?: string }[] };
      const selectedDirection = finding.directions?.find((direction) => direction.id === row.selectedDirectionId);
      return { findingIndex: row.findingIndex, status: row.status, note: row.note ?? "", sourceUrl: row.sourceUrl ?? "", evidenceRef: row.evidenceRef ?? `${runId}:${row.findingIndex}`, viewport: row.viewport ?? null, screenshotCapturedAt: row.screenshotCapturedAt ?? null, selectedDirectionId: selectedDirection?.id ?? null, selectedDirectionName: selectedDirection?.name ?? null, selectedDirectionAt: row.selectedDirectionAt ?? null, updatedAt: row.updatedAt };
    }), screenshots: await Promise.all(screenshots.filter((shot) => shot.expiresAt > Date.now()).map(async (shot) => ({
      view: shot.view,
      pageUrl: shot.pageUrl,
      width: shot.width,
      height: shot.height,
      capturedAt: shot.capturedAt,
      url: await ctx.storage.getUrl(shot.storageId),
    }))) };
  },
});

/** Internal only: saves a render-worker screenshot for the exact tenant-owned audit run. */
export const saveScreenshot = internalMutation({
  args: {
    orgId: v.id("organizations"),
    runId: v.id("workflowRuns"),
    pageUrl: v.string(),
    view: v.union(v.literal("desktop"), v.literal("mobile")),
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
    capturedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.orgId !== args.orgId || run.kind !== "conversion_audit") throw appError("INVALID", "Screenshot must belong to a website audit in the same workspace.");
    let page: URL;
    try { page = new URL(args.pageUrl); } catch { throw appError("INVALID", "Screenshot source URL is invalid."); }
    if (page.protocol !== "https:" || page.username || page.password || !Number.isSafeInteger(args.width) || !Number.isSafeInteger(args.height) || args.width < 1 || args.height < 1 || args.width > 4096 || args.height > 4096 || !Number.isFinite(args.capturedAt)) {
      throw appError("INVALID", "Screenshot metadata is invalid.");
    }
    const existing = await ctx.db.query("websiteAuditScreenshots").withIndex("by_org_run_view", (q) => q.eq("orgId", args.orgId).eq("runId", args.runId).eq("view", args.view)).first();
    if (existing) {
      await ctx.storage.delete(existing.storageId).catch(() => undefined);
      await ctx.db.patch(existing._id, { pageUrl: args.pageUrl, storageId: args.storageId, width: args.width, height: args.height, capturedAt: args.capturedAt, expiresAt: args.capturedAt + 30 * 86_400_000 });
    } else {
      await ctx.db.insert("websiteAuditScreenshots", { ...args, expiresAt: args.capturedAt + 30 * 86_400_000 });
    }
  },
});

export const selectDirection = mutation({
  args: { slug: v.string(), runId: v.id("workflowRuns"), findingIndex: v.number(), directionId: v.string() },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const run = assertSameOrg(await ctx.db.get(args.runId), org._id, "audit");
    if (run.kind !== "conversion_audit") throw appError("INVALID", "Design directions can only be chosen from a website audit.");
    if (!Number.isSafeInteger(args.findingIndex) || args.findingIndex < 0 || args.findingIndex >= 12) throw appError("INVALID", "Choose a finding from this audit.");
    const findings = findingsFromRun(run);
    if (args.findingIndex >= findings.length) throw appError("INVALID", "That finding is not present in this audit.");
    const finding = findings[args.findingIndex] as { directions?: { id?: string; name?: string }[] };
    const direction = finding.directions?.find((candidate) => candidate.id === args.directionId);
    if (!direction?.id || !direction.name) throw appError("INVALID", "That design direction is not part of this finding.");
    const now = Date.now();
    const existing = await ctx.db.query("designFindingReviews").withIndex("by_org_run_finding", (q) => q.eq("orgId", org._id).eq("runId", args.runId).eq("findingIndex", args.findingIndex)).first();
    const decision = { selectedDirectionId: direction.id, selectedDirectionBy: user._id, selectedDirectionAt: now, updatedBy: user._id, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, decision);
    else {
      const viewport: "desktop" | "mobile" | undefined = (finding as { visualEvidence?: { view?: unknown } }).visualEvidence?.view === "desktop" || (finding as { visualEvidence?: { view?: unknown } }).visualEvidence?.view === "mobile" ? (finding as { visualEvidence: { view: "desktop" | "mobile" } }).visualEvidence.view : undefined;
      const sourceUrl = typeof (finding as { sourceUrl?: unknown }).sourceUrl === "string" ? (finding as { sourceUrl: string }).sourceUrl.slice(0, 500) : undefined;
      await ctx.db.insert("designFindingReviews", { orgId: org._id, runId: args.runId, findingIndex: args.findingIndex, evidenceRef: `${args.runId}:${args.findingIndex}`, ...(sourceUrl ? { sourceUrl } : {}), ...(viewport ? { viewport } : {}), screenshotCapturedAt: screenshotTimeFromRun(run), ...decision });
    }
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: "design_finding.direction_selected", subjectType: "workflowRun", subjectId: args.runId, summary: `Selected design direction "${direction.name.slice(0, 80)}" for finding ${args.findingIndex + 1} in website audit ${args.runId}.` });
    return { selectedDirectionId: direction.id, selectedDirectionName: direction.name, selectedAt: now };
  },
});

export const setFeedback = mutation({
  args: {
    slug: v.string(),
    runId: v.id("workflowRuns"),
    findingIndex: v.number(),
    status: v.union(v.literal("accepted"), v.literal("dismissed"), v.literal("deferred"), v.literal("resolved"), v.literal("reopened"), v.literal("corrected"), v.literal("needs_information")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const run = assertSameOrg(await ctx.db.get(args.runId), org._id, "audit");
    if (!Number.isSafeInteger(args.findingIndex) || args.findingIndex < 0 || args.findingIndex >= 12) throw appError("INVALID", "Choose a finding from this audit.");
    if (args.status === "corrected" && !args.note?.trim()) throw appError("INVALID", "Add the correction so the team knows what to change.");
    const note = args.note?.trim().slice(0, 500) || undefined;
    if (args.note && args.note.length > 1000) throw appError("INVALID", "Keep the note under 1,000 characters.");
    const findings = findingsFromRun(run);
    if (run.kind !== "conversion_audit" || args.findingIndex >= findings.length) throw appError("INVALID", "That finding is not present in this audit.");

    const existing = await ctx.db.query("designFindingReviews").withIndex("by_org_run_finding", (q) => q.eq("orgId", org._id).eq("runId", args.runId).eq("findingIndex", args.findingIndex)).first();
    if (args.status === "reopened" && (!existing || (existing.status !== "resolved" && existing.status !== "dismissed"))) throw appError("INVALID", "Only a resolved or dismissed finding can be reopened.");
    const now = Date.now();
    const finding = findings[args.findingIndex] as { sourceUrl?: unknown; visualEvidence?: { view?: unknown } };
    const sourceUrl = typeof finding.sourceUrl === "string" ? finding.sourceUrl.slice(0, 500) : undefined;
    const viewport: "desktop" | "mobile" | undefined = finding.visualEvidence?.view === "desktop" || finding.visualEvidence?.view === "mobile" ? finding.visualEvidence.view : undefined;
    const screenshotCapturedAt = screenshotTimeFromRun(run);
    const row = { status: args.status, ...(note ? { note } : { note: undefined }), ...(sourceUrl ? { sourceUrl } : {}), evidenceRef: `${args.runId}:${args.findingIndex}`, ...(viewport ? { viewport } : {}), ...(screenshotCapturedAt !== undefined ? { screenshotCapturedAt } : {}), updatedBy: user._id, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("designFindingReviews", { orgId: org._id, runId: args.runId, findingIndex: args.findingIndex, ...row });
    await audit(ctx, { orgId: org._id, actorType: "user", actorId: user._id, action: `design_finding.${args.status}`, subjectType: "workflowRun", subjectId: args.runId, summary: `Updated finding ${args.findingIndex + 1} in website audit ${args.runId} to ${args.status}.` });
    return { status: args.status, note: note ?? "", updatedAt: now };
  },
});
