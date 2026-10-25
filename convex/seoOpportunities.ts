import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, requireOrgAccess } from "./lib/tenancy";
import { extractSiteInventory } from "../shared/seo/inventory";

/** Record an owner-reported disposition for one finding from a saved website review. */
export const updateFindingState = mutation({
  args: {
    slug: v.string(),
    runId: v.id("workflowRuns"),
    pageUrl: v.string(),
    findingId: v.string(),
    state: v.union(v.literal("open"), v.literal("addressed"), v.literal("not_relevant")),
  },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgAccess(ctx, { slug: args.slug }, "edit");
    const business = await ctx.db.query("businesses").withIndex("by_org", (q) => q.eq("orgId", org._id)).first();
    const run = await ctx.db.get(args.runId);
    if (!business?.website || !run || run.orgId !== org._id || run.kind !== "conversion_audit" || run.status !== "verified" || run.isFixture || typeof run.output !== "string") {
      throw appError("NOT_FOUND", "That website review is no longer available.");
    }
    const inventory = extractSiteInventory({ output: run.output, runId: String(run._id), checkedAt: run.finishedAt ?? run.updatedAt, website: business.website });
    const page = inventory?.pages.find((item) => item.url === args.pageUrl);
    const finding = page?.findings.find((item) => item.id === args.findingId);
    if (!page || !finding) throw appError("INVALID", "Choose a finding from the saved review for this website.");

    const existing = await ctx.db.query("seoOpportunityStates")
      .withIndex("by_org_run_page_finding", (q) => q.eq("orgId", org._id).eq("runId", args.runId).eq("pageUrl", page.url).eq("findingId", finding.id))
      .first();
    let stateId = existing?._id;
    if (args.state === "open") {
      if (existing) await ctx.db.delete(existing._id);
    } else if (existing) {
      await ctx.db.patch(existing._id, { state: args.state, updatedBy: user._id, updatedAt: Date.now() });
    } else {
      stateId = await ctx.db.insert("seoOpportunityStates", {
        orgId: org._id,
        runId: args.runId,
        pageUrl: page.url,
        findingId: finding.id,
        state: args.state,
        updatedBy: user._id,
        updatedAt: Date.now(),
      });
    }
    if (args.state === "open" && !existing) return { state: "open" as const };
    await audit(ctx, {
      orgId: org._id,
      actorType: "user",
      actorId: String(user._id),
      action: `seo.finding.${args.state}`,
      subjectType: "website_finding",
      subjectId: String(stateId ?? existing?._id ?? args.runId),
      summary: `${args.state === "open" ? "Reopened" : args.state === "addressed" ? "Marked addressed" : "Marked not relevant"}: ${finding.title} on ${page.url}`,
    });
    return { state: args.state };
  },
});
