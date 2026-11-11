import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { appError, requireOrgAccess, requireUser } from "./lib/tenancy";
import { can } from "../shared/policy";
import { createWorkspaceForOwner, applySetGoal, generatePlanForOwner } from "./orgs";
import { createRunWithReservation, estimateRun, type PlannedStep } from "./engine";
import { CLIMB_CONFIG } from "./lib/climbConfig";
import { defaultModelRoute } from "./lib/modelRoute";
import { routeModelKey } from "../shared/ai/modelChoice";
import { currentRateVersion } from "../shared/economics";
import { minorToMajor } from "../shared/economics/currency";
import { parseIntro } from "../shared/onboarding/intro";
import { acknowledgeWebsite, asksOwnerForStrategy, briefForPlan, InterviewReply, interviewGaps, mergeEvidence, ownerPlanningInputs, profileFromJson, shortOwnerReply, type IntakeEvidence, type IntakeProfile } from "../shared/intake/interview";
import { focusedGoal, goalPlans } from "./lib/goals";
import { isPaid } from "./lib/access";

export const INTERVIEW_STEPS: PlannedStep[] = [0, 1].map(() => ({ kind: "model", role: "coo", modelKey: CLIMB_CONFIG.model, inputBudget: 18_000, outputBudget: 3000 }));
const ACTIVE = ["cost_reserved", "preparing", "executing"];

export const quote = query({
  args: {},
  handler: async ctx => {
    await requireUser(ctx);
    const route = await defaultModelRoute(ctx);
    return { maxCostMicros: estimateRun(INTERVIEW_STEPS.map(step => ({ ...step, modelKey: routeModelKey(route, CLIMB_CONFIG.model) })), currentRateVersion().id, { repair: true }).costMicros };
  },
});

async function conversationFor(ctx: MutationCtx, org: Doc<"organizations">, userId: Id<"users">, startKey: string) {
  const existing = await ctx.db.query("intakeConversations").withIndex("by_org_user", q => q.eq("orgId", org._id).eq("userId", userId)).unique();
  if (existing) return existing;
  const now = Date.now();
  const business = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org._id)).first();
  const priorGoal = await focusedGoal(ctx, org);
  const profile: IntakeProfile = {};
  if (business?.website) profile.website = { key: "website", value: business.website, basis: "owner", sourceId: "saved:website", quote: business.website };
  if (priorGoal?.statement) profile.goal = { key: "goal", value: priorGoal.statement, basis: "owner", sourceId: "saved:goal", quote: priorGoal.statement };
  if (business?.lifecycleStage?.provenance === "owner_reported") profile.stage = { key: "stage", value: business.lifecycleStage.stage, basis: "owner", sourceId: "saved:stage", quote: business.lifecycleStage.stage };
  if (business?.unitEconomics?.ownerHoursPerWeek !== undefined) {
    const hours = `${business.unitEconomics.ownerHoursPerWeek} hours per week`;
    profile.resources = { key: "resources", value: hours, basis: "owner", sourceId: "saved:owner-hours", quote: hours };
  }
  const id = await ctx.db.insert("intakeConversations", { orgId: org._id, userId, startKey, profile: JSON.stringify(profile), revision: 0, ready: false, sources: [], createdAt: now, updatedAt: now });
  return (await ctx.db.get(id))!;
}

async function queueReply(ctx: MutationCtx, org: Doc<"organizations">, userId: Id<"users">, conversation: Doc<"intakeConversations">, text: string, requestKey: string) {
  const duplicate = await ctx.db.query("intakeMessages").withIndex("by_conversation_request", q => q.eq("conversationId", conversation._id).eq("requestKey", requestKey)).first();
  if (duplicate) return { slug: org.slug, conversationId: conversation._id, messageId: duplicate._id };
  const active = conversation.activeRunId ? await ctx.db.get(conversation.activeRunId) : null;
  if (active && ACTIVE.includes(active.status)) throw appError("INVALID", "I’m still working on your last message. You can send another when I reply.");
  const clean = text.trim();
  if (!clean || clean.length > 4000) throw appError("INVALID", "Send a message of up to 4,000 characters.");
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey)) throw appError("INVALID", "Please try sending that message again.");
  const recent = await ctx.db.query("intakeMessages").withIndex("by_conversation_created", q => q.eq("conversationId", conversation._id).gt("createdAt", Date.now() - 60_000)).take(20);
  if (recent.filter(m => m.role === "user").length >= 6) throw appError("RATE_LIMITED", "Give me a moment before sending another message.");
  if (active && !ACTIVE.includes(active.status)) {
    const unfinished = await ctx.db.query("intakeMessages").withIndex("by_conversation_created", q => q.eq("conversationId", conversation._id)).order("desc").take(10);
    for (const message of unfinished) if (message.role === "assistant" && message.status === "working" && message.runId === active._id) await ctx.db.patch(message._id, { status: "failed", text: "That reply stopped before it finished. Your message is saved." });
  }
  const runId = await createRunWithReservation(ctx, { org, kind: "climb_chat", title: "Understanding your business", roles: ["coo"], input: { intakeConversationId: conversation._id, revision: conversation.revision + 1 }, steps: INTERVIEW_STEPS, meters: {}, createdBy: userId, isFixture: false });
  const now = Date.now();
  const messageId = await ctx.db.insert("intakeMessages", { orgId: org._id, userId, conversationId: conversation._id, role: "user", text: clean, requestKey, status: "done", runId, createdAt: now });
  const priorMessages = await ctx.db.query("intakeMessages").withIndex("by_conversation_created", q => q.eq("conversationId", conversation._id)).order("desc").take(40);
  const profile = acknowledgeWebsite(profileFromJson(conversation.profile), priorMessages.reverse().filter(m => m.status === "done").map(m => ({ id: String(m._id), role: m.role, text: m.text })));
  const replyId = await ctx.db.insert("intakeMessages", { orgId: org._id, userId, conversationId: conversation._id, role: "assistant", text: "", status: "working", runId, createdAt: now + 1 });
  await ctx.db.patch(conversation._id, { profile: JSON.stringify(profile), activeRunId: runId, revision: conversation.revision + 1, ready: false, phase: "Thinking about your message…", updatedAt: now });
  await ctx.scheduler.runAfter(0, internal.intakeActions.respond, { conversationId: conversation._id, runId, messageId, replyId, revision: conversation.revision + 1 });
  return { slug: org.slug, conversationId: conversation._id, messageId };
}

/** The first wish creates a private business draft, not a fabricated business profile. */
export const start = mutation({
  args: { text: v.string(), requestKey: v.string(), timezone: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.isAnonymous) throw appError("FORBIDDEN", "Sign in to save this conversation.");
    const existing = await ctx.db.query("intakeConversations").withIndex("by_user_start", q => q.eq("userId", user._id).eq("startKey", args.requestKey)).unique();
    if (existing) {
      const org = await ctx.db.get(existing.orgId);
      if (!org || org.deletedAt) throw appError("NOT_FOUND", "This business draft was removed. Start a new conversation.");
      return queueReply(ctx, org, user._id, existing, args.text, args.requestKey);
    }
    const parsed = parseIntro(args.text);
    const acknowledged = acknowledgeWebsite({}, [{ id: "initial-wish", role: "user", text: args.text }]);
    const created = await createWorkspaceForOwner(ctx, { businessName: parsed.businessName ?? "Your business", website: acknowledged.website?.value, timezone: args.timezone });
    const org = (await ctx.db.get(created.orgId))!;
    const conversation = await conversationFor(ctx, org, user._id, args.requestKey);
    return queueReply(ctx, org, user._id, conversation, args.text, args.requestKey);
  },
});

export const send = mutation({
  args: { slug: v.string(), text: v.string(), requestKey: v.string() },
  handler: async (ctx, { slug, text, requestKey }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const conversation = await conversationFor(ctx, org, user._id, requestKey);
    return queueReply(ctx, org, user._id, conversation, text, requestKey);
  },
});

export const view = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const { org, user, role } = await requireOrgAccess(ctx, { slug }, "edit");
    const conversation = await ctx.db.query("intakeConversations").withIndex("by_org_user", q => q.eq("orgId", org._id).eq("userId", user._id)).unique();
    const goal = await focusedGoal(ctx, org);
    const plans = await goalPlans(ctx, org._id, goal?._id, 1);
    const plan = plans[0];
    if (!conversation) return { conversation: null, messages: [], org: { name: org.name, slug }, role, planReady: false, planRun: null, busy: false };
    const messages = await ctx.db.query("intakeMessages").withIndex("by_conversation_created", q => q.eq("conversationId", conversation._id)).order("desc").take(100);
    const active = conversation.activeRunId ? await ctx.db.get(conversation.activeRunId) : null;
    const planRun = conversation.planRunId ? await ctx.db.get(conversation.planRunId) : null;
    return { org: { name: org.name, slug }, role, conversation: { id: conversation._id, revision: conversation.revision, ready: interviewGaps(profileFromJson(conversation.profile)).length === 0, phase: conversation.phase, profile: profileFromJson(conversation.profile), sources: conversation.sources.map(s => ({ url: s.url, title: s.title, status: s.status })) }, messages: messages.reverse().map(m => ({ id: m._id, role: m.role, text: m.text, status: m.status, choices: m.choices ?? [] })), busy: Boolean(active && ACTIVE.includes(active.status)), planReady: Boolean(plan && ["needs_approval", "approved"].includes(plan.status) && plan.runId === conversation.planRunId && conversation.planRevision === conversation.revision), planRun: planRun ? { id: planRun._id, status: planRun.status, userMessage: planRun.userMessage } : null };
  },
});

export const load = internalQuery({
  args: { conversationId: v.id("intakeConversations"), runId: v.id("workflowRuns"), revision: v.number() },
  handler: async (ctx, { conversationId, runId, revision }) => {
    const session = await ctx.db.get(conversationId), run = await ctx.db.get(runId);
    if (!session || !run || session.activeRunId !== runId || session.revision !== revision || session.orgId !== run.orgId || session.userId !== run.createdBy || !ACTIVE.includes(run.status)) return null;
    const org = await ctx.db.get(session.orgId);
    const member = await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", session.orgId).eq("userId", session.userId)).unique();
    if (!org || org.deletedAt || !member || member.status !== "active" || !can(member.role, "edit")) return null;
    const messages = await ctx.db.query("intakeMessages").withIndex("by_conversation_created", q => q.eq("conversationId", conversationId)).order("desc").take(40);
    const business = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org._id)).first();
    const facts = business ? await ctx.db.query("businessFacts").withIndex("by_business", q => q.eq("businessId", business._id)).take(30) : [];
    return { session, run, org, messages: messages.reverse(), saved: { name: business?.name, website: business?.website, summary: business?.summary, goal: (await focusedGoal(ctx, org))?.statement, facts: facts.filter(f => ["confirmed", "edited"].includes(f.reviewState)).map(f => ({ statement: f.statement, provenance: f.provenance })) } };
  },
});

export const claim = internalMutation({
  args: { conversationId: v.id("intakeConversations"), runId: v.id("workflowRuns") },
  handler: async (ctx, { conversationId, runId }) => {
    const session = await ctx.db.get(conversationId);
    if (!session || session.activeRunId !== runId || session.claimedRunId === runId) return false;
    await ctx.db.patch(conversationId, { claimedRunId: runId });
    return true;
  },
});

export const phase = internalMutation({
  args: { conversationId: v.id("intakeConversations"), runId: v.id("workflowRuns"), phase: v.string() },
  handler: async (ctx, { conversationId, runId, phase }) => {
    const session = await ctx.db.get(conversationId);
    if (session?.activeRunId === runId) await ctx.db.patch(conversationId, { phase: phase.slice(0, 120) });
  },
});

export const complete = internalMutation({
  args: { conversationId: v.id("intakeConversations"), runId: v.id("workflowRuns"), replyId: v.id("intakeMessages"), revision: v.number(), output: v.string(), sources: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.conversationId), run = await ctx.db.get(args.runId), reply = await ctx.db.get(args.replyId);
    if (!session || !run || session.activeRunId !== args.runId || session.revision !== args.revision || session.orgId !== run.orgId || session.userId !== run.createdBy || !reply || reply.conversationId !== session._id || reply.runId !== args.runId || reply.role !== "assistant" || reply.status !== "working") return false;
    const org = await ctx.db.get(session.orgId);
    const member = await ctx.db.query("memberships").withIndex("by_org_user", q => q.eq("orgId", session.orgId).eq("userId", session.userId)).unique();
    if (!org || org.deletedAt || !member || member.status !== "active" || !can(member.role, "edit")) return false;
    const output = InterviewReply.parse(JSON.parse(args.output));
    const sources = JSON.parse(args.sources) as Doc<"intakeConversations">["sources"];
    if (!Array.isArray(sources) || sources.length > 4 || sources.some(s => typeof s.url !== "string" || typeof s.text !== "string" || s.text.length > 12000)) throw appError("INVALID", "Website evidence exceeded its bounds.");
    const messages = await ctx.db.query("intakeMessages").withIndex("by_conversation_created", q => q.eq("conversationId", session._id)).order("desc").take(40);
    const evidence: IntakeEvidence[] = [...messages.filter(m => m.role === "user").map(m => ({ id: String(m._id), kind: "owner" as const, text: m.text })), ...sources.filter(s => s.status === "ok").map(s => ({ id: s.url, kind: "website" as const, text: s.text, url: s.url }))];
    const merged = mergeEvidence(profileFromJson(session.profile), output.updates, evidence);
    const gaps = interviewGaps(merged.profile);
    const ready = gaps.length === 0;
    const text = ready ? "I have enough to start. I’ll choose a useful first move and prepare the work." : output.ready || asksOwnerForStrategy(output.reply) ? `One detail will help: could you tell me ${gaps[0]}?` : output.reply;
    await ctx.db.patch(session._id, { profile: JSON.stringify(merged.profile), sources, ready, activeRunId: undefined, phase: undefined, updatedAt: Date.now() });
    await ctx.db.patch(reply._id, { text: shortOwnerReply(text), choices: ready || output.ready || asksOwnerForStrategy(output.reply) ? [] : output.choices.filter(choice => !/^(?:I have a website|I can share (?:the |my )?(?:website|link))\.?$/i.test(choice)), status: "done" });
    const name = merged.profile.name;
    const business = await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org._id)).first();
    if (business) {
      const website = merged.profile.website?.value;
      const realWebsite = website && !["none", "declined"].includes(website) ? website : undefined;
      await ctx.db.patch(business._id, { ...(name && name.basis !== "inferred" && name.basis !== "unknown" ? { name: name.value.slice(0, 80) } : {}), ...(realWebsite ? { website: realWebsite } : {}), updatedAt: Date.now() });
      if (name && name.basis !== "inferred" && name.basis !== "unknown") await ctx.db.patch(org._id, { name: name.value.slice(0, 80) });
    }
    return true;
  },
});

export const fail = internalMutation({
  args: { conversationId: v.id("intakeConversations"), runId: v.id("workflowRuns"), replyId: v.id("intakeMessages"), message: v.string() },
  handler: async (ctx, { conversationId, runId, replyId, message }) => {
    const session = await ctx.db.get(conversationId), reply = await ctx.db.get(replyId);
    if (session?.activeRunId !== runId || !reply || reply.conversationId !== conversationId || reply.status !== "working") return;
    await ctx.db.patch(replyId, { status: "failed", text: message.slice(0, 500) });
    await ctx.db.patch(conversationId, { activeRunId: undefined, phase: undefined });
  },
});

export const beginPlan = mutation({
  args: { slug: v.string(), revision: v.number(), requestKey: v.string() },
  handler: async (ctx, { slug, revision, requestKey }) => {
    const { org, user } = await requireOrgAccess(ctx, { slug }, "edit");
    const session = await ctx.db.query("intakeConversations").withIndex("by_org_user", q => q.eq("orgId", org._id).eq("userId", user._id)).unique();
    if (!session || session.revision !== revision || session.activeRunId) throw appError("INVALID", "Let me finish your latest message before planning.");
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestKey)) throw appError("INVALID", "Please try planning again.");
    if (session.planRunId) {
      const previous = await ctx.db.get(session.planRunId);
      if (session.planRequestKey === requestKey || (session.planRevision === revision && previous && !["failed", "canceled"].includes(previous.status))) return { runId: session.planRunId };
    }
    const profile = profileFromJson(session.profile);
    if (interviewGaps(profile).length) throw appError("INVALID", "We still need a little more business context. Continue the conversation first.");
    const text = profile.goal!.value;
    const parsed = parseIntro(text);
    const active = await focusedGoal(ctx, org);
    const business = (await ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", org._id)).first())!;
    const ownerInputs = ownerPlanningInputs(profile, business.currency);
    const adBudget = ownerInputs.monthlyAdBudget ?? (active ? minorToMajor(active.monthlyAdBudgetMinor, active.currency) : 0);
    if (!active || active.statement !== text || adBudget !== minorToMajor(active.monthlyAdBudgetMinor, active.currency)) await applySetGoal(ctx, { slug, kind: parsed.goalKind ?? "custom", kinds: parsed.goalKinds, statement: text, horizonDays: active?.horizonDays ?? 90, monthlyAdBudget: adBudget });
    const intakeSnapshot = briefForPlan(profile, session.sources.filter(s => s.status === "ok"));
    const result = await generatePlanForOwner(ctx, { slug, planStyle: await isPaid(ctx, org) ? "focused" : "starter", intakeSnapshot });
    await ctx.db.patch(session._id, { planRunId: result.runId, planRevision: revision, planRequestKey: requestKey });
    // Preserve the discovered business in a neutral summary. No website claim becomes a confirmed owner fact.
    await ctx.db.patch(business._id, { discoveryBrief: intakeSnapshot, summary: `${profile.offer!.value}\n${profile.audience!.value}`, ...(ownerInputs.ownerHoursPerWeek !== undefined ? { unitEconomics: { ...business.unitEconomics, ownerHoursPerWeek: ownerInputs.ownerHoursPerWeek, updatedAt: Date.now() } } : {}), researchStatus: session.sources.some(s => s.status === "ok") ? "partial" : "owner_supplied", updatedAt: Date.now() });
    return result;
  },
});
