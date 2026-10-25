import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

type LandingPage = Doc<"landingPages">;
type VersionKind = "generated" | "edited" | "restored" | "experiment" | "measurement" | "legacy";

/** Save a new immutable draft revision, preserving legacy live content before its first edit. */
export async function recordLandingVersion(
  ctx: MutationCtx,
  page: LandingPage,
  value: { title: string; color: string; content: string; designMeasurementPlan?: LandingPage["designMeasurementPlan"] },
  kind: VersionKind,
  actorId?: Doc<"users">["_id"],
) {
  const currentVersion = page.version ?? 0;
  const now = Date.now();

  // Legacy rows have no revision history. Preserve their current page as version 0
  // before replacing its editable content, and freeze it if it is already public.
  if (page.content && page.version === undefined) {
    const legacy = await ctx.db.query("landingPageVersions").withIndex("by_page_version", (q) => q.eq("pageId", page._id).eq("version", 0)).first();
    if (!legacy) {
      await ctx.db.insert("landingPageVersions", {
        orgId: page.orgId,
        pageId: page._id,
        version: 0,
        title: page.title,
        color: page.color,
        content: page.content,
        kind: "legacy",
        createdAt: page.updatedAt,
      });
    }
  }

  const version = currentVersion + 1;
  await ctx.db.insert("landingPageVersions", {
    orgId: page.orgId,
    pageId: page._id,
    version,
    title: value.title,
    color: value.color,
    content: value.content,
    kind,
    ...(Object.hasOwn(value, "designMeasurementPlan") ? value.designMeasurementPlan ? { designMeasurementPlan: value.designMeasurementPlan } : {} : page.designMeasurementPlan ? { designMeasurementPlan: page.designMeasurementPlan } : {}),
    ...(actorId ? { actorId } : {}),
    createdAt: now,
  });

  await ctx.db.patch(page._id, {
    ...value,
    designMeasurementPlan: Object.hasOwn(value, "designMeasurementPlan") ? value.designMeasurementPlan : page.designMeasurementPlan,
    version,
    ...(page.status === "live" && page.publishedContent === undefined && page.content
      ? { publishedContent: page.content, publishedColor: page.color, publishedTitle: page.title, publishedVersion: currentVersion }
      : {}),
    updatedAt: now,
  });
  return version;
}
