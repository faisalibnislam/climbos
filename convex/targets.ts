import { v } from "convex/values";
import { creatorMetricAnomalies, targetBrief, targetKindOf, targetReadiness, TARGET_STATE_LABEL, type PlayText, type TargetKind } from "../shared/growth/targets";
import { prospectScore } from "../shared/outbound";
import { sha256Hex } from "../shared/policy";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { appError, assertSameOrg, requireOrgAccess } from "./lib/tenancy";
import { startCampaign } from "./outbound";
import { expertPlaysOf } from "../shared/agents/planCompatibility";

/**
 * S6 behind the `plan_targets` engine flag (REQ-TARGET-01..06, REQ-UX-02/03):
 * a plan's target-heavy plays get named targets from the existing Find
 * customers / creator search, linked by the play's stable ID. One prospect
 * record per entity across plans; its stage (contacted, declined) is never
 * reset, and suppressed emails never count as contactable.
 */

export const FLAG = "plan_targets";
const hasTargets = (org: Doc<"organizations">) => Boolean(org.engineFlags?.includes(FLAG));

type StoredPlay = PlayText & { id?: string };
const playsOf = (s: Doc<"strategies">): StoredPlay[] => (expertPlaysOf(s.expert) as StoredPlay[]).filter((p) => p && typeof p.name === "string");

async function campaignsOf(ctx: QueryCtx | MutationCtx, orgId: Id<"organizations">) {
  return ctx.db.query("outboundCampaigns").withIndex("by_org_created", (q) => q.eq("orgId", orgId)).order("desc").take(50);
}

/** Why a play's search can't start on its own right now (null when nothing is in the way). */
function blockedBy(active: Doc<"outboundCampaigns"> | null): string | null {
  if (!active) return null;
  if (active.status === "researching") return "Another search is running. Start this one when it finishes.";
  if (active.sending?.status === "on") return "Your current campaign is sending. Starting this search pauses it, so it waits for you.";
  return "Your current search is still open. Starting this one moves it to the archive, so it waits for you.";
}

/** Targets and honest readiness for each target-heavy play in a plan; null when the workspace isn't opted in. */
export const forStrategy = query({
  args: { slug: v.string(), strategyId: v.id("strategies") },
  handler: async (ctx, { slug, strategyId }) => {
    const { org } = await requireOrgAccess(ctx, { slug }, "view");
    if (!hasTargets(org)) return null;
    const s = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    const campaigns = await campaignsOf(ctx, org._id);
    const active = campaigns.find((c) => c.status !== "archived") ?? null;
    const mailbox = await ctx.db.query("connections").withIndex("by_org_provider", (q) => q.eq("orgId", org._id).eq("provider", "email_mailbox")).first();
    const all = await ctx.db.query("prospects").withIndex("by_org_stage", (q) => q.eq("orgId", org._id)).take(1000);
    const out: Record<string, PlayTargets> = {};
    for (const play of playsOf(s)) {
      const kind = targetKindOf(play);
      if (!play.id || !kind) continue;
      // Play IDs carry across plan versions, so a refreshed plan keeps its targets (REQ-TARGET-06).
      const campaign = campaigns.find((c) => c.playId === play.id) ?? null;
      const rows = all.filter((p) => p.playIds?.includes(play.id!));
      const suppressed = new Set<string>();
      for (const p of rows) if (p.publicEmail && (await isSuppressed(ctx, org._id, p.publicEmail))) suppressed.add(p._id);
      const readiness = targetReadiness({
        kind,
        campaign: campaign ? { status: campaign.status } : null,
        waitingReason: campaign ? undefined : (blockedBy(active) ?? undefined),
        targets: rows.map((p) => ({ stage: p.stage, publicEmail: p.publicEmail, suppressed: suppressed.has(p._id) })),
        mailboxConnected: mailbox?.status === "connected",
      });
      out[play.id] = {
        playId: play.id,
        kind,
        state: readiness.state,
        label: TARGET_STATE_LABEL[readiness.state],
        note: readiness.note,
        counts: { found: readiness.found, eligible: readiness.eligible, contactable: readiness.contactable, excluded: readiness.excluded, inRelationship: readiness.inRelationship },
        campaignId: campaign?._id ?? null,
        canStart: s.status === "approved" && (!campaign || campaign.status === "failed" || readiness.state === "none_found") && active?.status !== "researching",
        targets: rows
          .sort((a, b) => prospectScore(b) - prospectScore(a))
          .slice(0, 5)
          .map((p) => ({
            id: p._id,
            name: p.company,
            url: p.website,
            why: p.why,
            evidenceUrl: p.evidence[0]?.url ?? null,
            platform: p.platform ?? null,
            handle: p.handle ?? null,
            audienceSize: p.audienceSize ?? null,
            contentLanguage: p.contentLanguage ?? null,
            audienceLocation: p.audienceLocation ?? null,
            contentSamples: p.contentSamples ?? [],
            creatorMetricAnomalies: p.creatorMetricAnomalies ?? creatorMetricAnomalies(p.contentSamples ?? [], p.updatedAt),
            competitorCollaborations: p.competitorCollaborations ?? [],
            collaborationConcept: p.collaborationConcept ?? null,
            contactRoute: p.publicEmail && !suppressed.has(p._id) ? ("email" as const) : ("none" as const),
            suppressed: suppressed.has(p._id),
            stage: p.stage,
          })),
      };
    }
    return out;
  },
});

export interface PlayTargets {
  playId: string;
  kind: TargetKind;
  state: ReturnType<typeof targetReadiness>["state"];
  label: string;
  note: string;
  counts: { found: number; eligible: number; contactable: number; excluded: number; inRelationship: number };
  campaignId: Id<"outboundCampaigns"> | null;
  canStart: boolean;
  targets: { id: Id<"prospects">; name: string; url: string; why: string; evidenceUrl: string | null; platform: string | null; handle: string | null; audienceSize: { value: string; sourceUrl: string } | null; contentLanguage: { value: string; sourceUrl: string } | null; audienceLocation: { value: string; sourceUrl: string } | null; contentSamples: NonNullable<Doc<"prospects">["contentSamples"]>; creatorMetricAnomalies: NonNullable<Doc<"prospects">["creatorMetricAnomalies"]>; competitorCollaborations: NonNullable<Doc<"prospects">["competitorCollaborations"]>; collaborationConcept: string | null; contactRoute: "email" | "none"; suppressed: boolean; stage: string }[];
}

async function isSuppressed(ctx: QueryCtx, orgId: Id<"organizations">, email: string): Promise<boolean> {
  const hash = await sha256Hex(email.trim().toLowerCase());
  return Boolean(await ctx.db.query("suppressions").withIndex("by_org_email", (q) => q.eq("orgId", orgId).eq("emailHash", hash)).first());
}

/** The owner starts a play's target search from the play card, by plan and play ID (REQ-UX-03). */
export const startForPlay = mutation({
  args: { slug: v.string(), strategyId: v.id("strategies"), playId: v.string() },
  handler: async (ctx, { slug, strategyId, playId }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    if (!hasTargets(org)) throw appError("UNAVAILABLE", "Target search from the plan isn't switched on for this workspace yet.");
    const s = assertSameOrg(await ctx.db.get(strategyId), org._id, "plan");
    if (s.status !== "approved") throw appError("INVALID", "Approve the plan first; then your team finds targets for its plays.");
    const play = playsOf(s).find((p) => p.id === playId);
    if (!play) throw appError("NOT_FOUND", "That play isn't in this plan.");
    const kind = targetKindOf(play);
    if (!kind) throw appError("INVALID", "This play doesn't need a target search.");
    const prev = (await campaignsOf(ctx, org._id)).find((c) => c.status !== "archived");
    const campaignId = await startCampaign(ctx, { org, userId: user._id, brief: targetBrief(play), auto: false, kind, play: { strategyId, playId, name: play.name } });
    return { campaignId, pausedSending: Boolean(prev && prev.sending?.status === "on") };
  },
});

/**
 * Approving a plan starts the first target-heavy play's search (REQ-TARGET-04), within credits.
 * It never archives an open search or pauses sending on its own: then the play waits for the owner.
 */
export async function autoStartPlanTargets(ctx: MutationCtx, p: { org: Doc<"organizations">; strategyId: Id<"strategies">; userId: Id<"users"> }): Promise<{ started: string | null; waiting: string | null }> {
  if (!hasTargets(p.org)) return { started: null, waiting: null };
  const s = await ctx.db.get(p.strategyId);
  if (!s || s.orgId !== p.org._id || s.status !== "approved") return { started: null, waiting: null };
  const campaigns = await campaignsOf(ctx, p.org._id);
  const play = playsOf(s).find((x) => x.id && targetKindOf(x) && !campaigns.some((c) => c.playId === x.id));
  if (!play) return { started: null, waiting: null };
  const reason = blockedBy(campaigns.find((c) => c.status !== "archived") ?? null);
  if (reason) return { started: null, waiting: reason };
  try {
    await startCampaign(ctx, { org: p.org, userId: p.userId, brief: targetBrief(play), auto: true, kind: targetKindOf(play)!, play: { strategyId: s._id, playId: play.id!, name: play.name } });
  } catch (e) {
    const data = (e as { data?: { code?: string; message?: string } }).data;
    const why = data?.code === "LIMIT_REACHED" || data?.code === "PAYMENT_REQUIRED" ? "Not enough credits right now" : (data?.message ?? "Couldn't start");
    await audit(ctx, { orgId: p.org._id, actorType: "system", action: "targets.waiting", subjectType: "strategy", subjectId: s._id, summary: `Targets for "${play.name}" wait: ${why}.` });
    return { started: null, waiting: why };
  }
  return { started: play.name, waiting: null };
}
