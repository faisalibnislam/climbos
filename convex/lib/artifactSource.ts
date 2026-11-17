import { CopyBriefSchema } from "../../shared/agents/specs";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { ArtifactInput } from "../jobWrites";
import { appError, assertSameOrg } from "./tenancy";

/** Load an exact historical version without silently replacing it with current work. */
export async function exactArtifactSource(ctx: QueryCtx, orgId: Id<"organizations">, artifactId: Id<"artifacts">, versionId: Id<"artifactVersions">) {
  const artifact = assertSameOrg(await ctx.db.get(artifactId), orgId, "source draft");
  const version = assertSameOrg(await ctx.db.get(versionId), orgId, "source version");
  if (version.artifactId !== artifact._id) throw appError("INVALID", "The source version does not belong to this draft.");
  return { artifact, version };
}

/** Inherited context is historical evidence, not verification of a new adaptation. */
export async function inheritedArtifactBrief(ctx: QueryCtx, source: Doc<"artifactVersions"> | null, orgId: Id<"organizations">, businessId: Id<"businesses">) {
  const brief = source?.copyBrief;
  const sourceFactIds = [...new Set([...(source?.claimFactIds ?? []), ...(brief?.offerFactIds ?? []), ...(brief?.proofFactIds ?? []), ...(brief?.supportingFactIds ?? [])])];
  const factIds: Id<"businessFacts">[] = [];
  for (const id of sourceFactIds) {
    const fact = await ctx.db.get(id);
    if (fact && fact.orgId === orgId && fact.businessId === businessId) factIds.push(id);
  }
  let copyBrief: ArtifactInput["copyBrief"];
  if (brief) {
    const indexes = (ids: Id<"businessFacts">[]) => ids.map(id => factIds.indexOf(id)).filter(index => index >= 0);
    const { offerFactIds, proofFactIds, supportingFactIds, ...rest } = brief;
    copyBrief = {
      ...rest,
      awarenessStage: CopyBriefSchema.shape.awarenessStage.safeParse(rest.awarenessStage).data ?? "unknown",
      relationshipStage: CopyBriefSchema.shape.relationshipStage.safeParse(rest.relationshipStage).data ?? "unknown",
      offerFactIndexes: indexes(offerFactIds), proofFactIndexes: indexes(proofFactIds), supportingFactIndexes: indexes(supportingFactIds),
      unknowns: [...new Set([...rest.unknowns, "Inherited source brief; adaptation and evidence fit require owner review."])],
    };
  }
  return { factIds, copyBrief };
}
