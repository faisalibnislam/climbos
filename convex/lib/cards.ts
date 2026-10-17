import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { createRunWithReservation } from "../engine";
import { audit } from "./audit";
import { planJob, type JobKind } from "./jobPlans";

/** Which job an action card kind runs. */
export function jobForAction(kind: string, channel: string): JobKind | null {
  if (kind === "refresh_plan") return "strategy";
  if (kind === "research") return "conversion_audit";
  if (kind === "analyze_results") return "explain_results";
  if (kind !== "generate_content") return null;
  if (channel === "email") return "content_email";
  if (channel === "google_search_ad" || channel === "meta_ad" || channel === "ads") return "content_ads";
  if (channel === "blog" || channel === "website" || channel === "seo") return "content_seo";
  return "content_social";
}

/** Kinds a wish may start on its own: they only prepare drafts, plans or analysis. */
export const AUTO_RUN_KINDS = new Set(["generate_content", "refresh_plan", "research", "analyze_results"]);
/** Most a single wish may spend without a second tap (µUSD of AI allowance). */
export const WISH_AUTO_BUDGET_MICROS = 3_000_000;

export type CardPayload = { job?: string; channel?: string; quantity?: number; brief?: string };

/**
 * Start exactly the job an action card describes, with the owner's brief.
 * Throws the same app errors as createRunWithReservation (limits, pause).
 */
export async function startCardRun(
  ctx: MutationCtx,
  p: { org: Doc<"organizations">; card: Doc<"actionCards">; userId: Id<"users">; auto: boolean },
): Promise<Id<"workflowRuns"> | null> {
  const { org, card } = p;
  const payload = JSON.parse(card.payload) as CardPayload;
  const job = jobForAction(card.kind, payload.channel ?? "") ?? (payload.job as never);
  if (!job) return null;
  const images = job === "content_social" ? 1 : 0;
  const plan = planJob(job, { quantity: payload.quantity, images, channel: payload.channel }, { fixture: org.kind === "demo" });
  const runId = await createRunWithReservation(ctx, { org, kind: plan.kind, title: card.title || plan.title, roles: plan.roles, input: payload, steps: plan.steps, meters: plan.meters, createdBy: p.userId, isFixture: org.kind === "demo" });
  await ctx.db.patch(card._id, { status: "running", runId, updatedAt: Date.now() });
  const brief = payload.brief?.slice(0, 1500) || undefined;
  if (job === "content_social" || job === "content_ads" || job === "content_email" || job === "content_seo") {
    await ctx.scheduler.runAfter(0, internal.jobs.createContent, { runId, job, channel: payload.channel || undefined, quantity: payload.quantity, images, brief, cardId: card._id });
  } else if (job === "strategy") {
    await ctx.scheduler.runAfter(0, internal.jobs.buildStrategy, { runId });
  } else if (job === "conversion_audit") {
    await ctx.scheduler.runAfter(0, internal.jobs.conversionAudit, { runId, cardId: card._id });
  } else if (job === "explain_results") {
    await ctx.scheduler.runAfter(0, internal.workspace.startExplain, { runId, cardId: card._id });
  } else if (job === "retention_plan" || job === "sales_sequence") {
    await ctx.scheduler.runAfter(0, internal.jobs.simplePlanJob, { runId, task: job, cardId: card._id });
  }
  await audit(ctx, {
    orgId: org._id,
    actorType: p.auto ? "agent" : "user",
    actorId: p.auto ? undefined : p.userId,
    action: p.auto ? "card.auto_started" : "card.approved",
    subjectType: "actionCard",
    subjectId: card._id,
    summary: `${p.auto ? "Started from your wish" : "Started"}: ${card.title}`,
  });
  return runId;
}
