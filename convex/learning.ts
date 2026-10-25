import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type QueryCtx,
} from "./_generated/server";
import {
  boundedPoolContribution,
  comparableLearningSegment,
  LEARN_WINDOW_DAYS,
  learningCounts,
  METRIC_DEFS,
  outreachCohortMature,
  rateLine,
  type Counts,
  type RawLearningInputs,
} from "../shared/growth/learnedMetrics";

/**
 * Loop 2 — learn from results. Weekly, every workspace's real outcomes
 * (replies, bookings, leads, clicks) become rates the planner uses before
 * vendor benchmarks. Pooled rates by business type contain only bounded,
 * rounded counts and require at least 10 contributing workspaces.
 */

const K_ANON = 10;
const DAY = 86_400_000;
const WINDOW = LEARN_WINDOW_DAYS * DAY;
const ORG_PAGE_SIZE = 100;
const ORG_READ_CONCURRENCY = 8;
const MAX_OUTREACH_SENDS = 3000;
const MAX_BOOKINGS = 2000;
const MAX_LANDING_PAGES = 50;
const MAX_CHAT_THREADS = 2000;
const MAX_REVIEW_REQUESTS = 1000;
const MAX_BIO_MESSAGES = 5000;

/** Kept for callers: label and minimum sample per metric (definitions live in shared/growth/learnedMetrics). */
export const METRICS: Record<string, { label: string; minTrials: number }> =
  Object.fromEntries(
    Object.entries(METRIC_DEFS).map(([k, d]) => [
      k,
      { label: d.label, minTrials: d.minTrials },
    ]),
  );

/** Raw counts with each window stated (REQ-LEARN-01): lifetime counters are only divided by lifetime counts. */
async function orgInputs(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  since: number,
): Promise<RawLearningInputs> {
  const outreach: RawLearningInputs["outreach"] = [];
  const unavailableMetrics: string[] = [];
  // Use delivery time, not queue creation time: queued emails can wait, fail, or
  // be sent after the learning window. Only the first successfully sent step
  // starts a prospect's measured cohort.
  const sends = await ctx.db
    .query("outboundSends")
    .withIndex("by_org_sent", (q) =>
      q.eq("orgId", orgId).gte("sentAt", since).lte("sentAt", Date.now()),
    )
    .order("desc")
    .take(MAX_OUTREACH_SENDS + 1);
  if (sends.length > MAX_OUTREACH_SENDS)
    unavailableMetrics.push("outreach_reply", "outreach_qualified_reply", "outreach_booking", "outreach_booked");
  const firstSends = new Map<
    string,
    {
      campaignId: Id<"outboundCampaigns">;
      prospectId: Id<"prospects">;
      sentAt: number;
    }
  >();
  const latestCampaignSend = new Map<string, number>();
  for (const send of sends) {
    if (send.status !== "sent" || send.sentAt === undefined) continue;
    const campaignKey = String(send.campaignId);
    latestCampaignSend.set(
      campaignKey,
      Math.max(latestCampaignSend.get(campaignKey) ?? 0, send.sentAt),
    );
    if (send.step !== 0) continue;
    const key = String(send.prospectId);
    const previous = firstSends.get(key);
    if (!previous || send.sentAt < previous.sentAt)
      firstSends.set(key, {
        campaignId: send.campaignId,
        prospectId: send.prospectId,
        sentAt: send.sentAt,
      });
  }
  const cohorts = new Map<
    string,
    { contacted: number; replied: number; qualified: number; booked: number }
  >();
  for (const send of firstSends.values()) {
    const prospect = await ctx.db.get(send.prospectId);
    if (
      !prospect ||
      prospect.orgId !== orgId ||
      prospect.campaignId !== send.campaignId
    )
      continue;
    const campaign = await ctx.db.get(send.campaignId);
    if (!campaign || campaign.orgId !== orgId) continue;
    if (
      !outreachCohortMature({
        sendingStatus: campaign.sending?.status,
        lastSentAt: campaign.sending?.lastSentAt,
        latestObservedSentAt:
          latestCampaignSend.get(String(send.campaignId)) ?? send.sentAt,
        now: Date.now(),
      })
    )
      continue;
    const cohort = cohorts.get(String(send.campaignId)) ?? {
      contacted: 0,
      replied: 0,
      qualified: 0,
      booked: 0,
    };
    cohort.contacted += 1;
    // Stage is a current-state field. Only its own transition timestamp can
    // show whether the current outcome followed this contact; unrelated edits
    // to the prospect record are not outcome evidence.
    if (
      prospect.stageUpdatedAt !== undefined &&
      prospect.stageUpdatedAt >= send.sentAt
    ) {
      if (["replied", "booked", "won"].includes(prospect.stage))
        cohort.replied += 1;
      if (
        ["replied", "booked", "won"].includes(prospect.stage) &&
        prospect.replyDisposition === "qualified" &&
        prospect.replyDispositionUpdatedAt !== undefined &&
        prospect.replyDispositionUpdatedAt >= send.sentAt
      )
        cohort.qualified += 1;
      if (prospect.stage === "booked" || prospect.stage === "won")
        cohort.booked += 1;
    }
    cohorts.set(String(send.campaignId), cohort);
  }
  outreach.push(...cohorts.values());
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_org_start", (q) =>
      q.eq("orgId", orgId).gte("startAt", since).lte("startAt", Date.now()),
    )
    .take(MAX_BOOKINGS + 1);
  if (bookings.length > MAX_BOOKINGS) unavailableMetrics.push("booking_attended");
  const landing = (
    await ctx.db
      .query("landingPages")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .take(MAX_LANDING_PAGES + 1)
  ).map((p) => ({ views: p.views, leads: p.leads }));
  if (landing.length > MAX_LANDING_PAGES) unavailableMetrics.push("landing_lead");
  const threads = await ctx.db
    .query("chatThreads")
    .withIndex("by_org_last", (q) => q.eq("orgId", orgId).gte("lastAt", since))
    .take(MAX_CHAT_THREADS + 1);
  if (threads.length > MAX_CHAT_THREADS) unavailableMetrics.push("chat_lead");
  const reviewRequests = await ctx.db
    .query("reviewRequests")
    .withIndex("by_org_created", (q) =>
      q.eq("orgId", orgId).gte("createdAt", since),
    )
    .take(MAX_REVIEW_REQUESTS + 1);
  if (reviewRequests.length > MAX_REVIEW_REQUESTS)
    unavailableMetrics.push("review_click");
  const reqs = reviewRequests.filter((r) => r.status === "sent");
  const bioPage = await ctx.db
    .query("bioPages")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .first();
  // Bio views are an all-time counter, so sign-ups are counted all-time too.
  const bioMessages = bioPage
    ? await ctx.db
        .query("communityMessages")
        .withIndex("by_org_received", (q) => q.eq("orgId", orgId))
        .take(MAX_BIO_MESSAGES + 1)
    : [];
  if (bioMessages.length > MAX_BIO_MESSAGES) unavailableMetrics.push("bio_signup");
  const bioSignups = bioMessages.filter((m) => m.channel === "link_in_bio").length;
  return {
    unavailableMetrics,
    outreach,
    bookingOutcomes: bookings
      .filter((b) => b.status === "confirmed" && b.outcome)
      .map((b) => b.outcome!),
    landing,
    chats: {
      total: threads.length,
      withEmail: threads.filter((t) => t.email).length,
    },
    reviews: {
      sent: reqs.length,
      clicked: reqs.filter((r) => r.clickedAt).length,
    },
    bio: bioPage ? { views: bioPage.views, signups: bioSignups } : null,
  };
}

async function orgCounts(
  ctx: QueryCtx,
  orgId: Id<"organizations">,
  since: number,
): Promise<Counts> {
  return learningCounts(await orgInputs(ctx, orgId, since));
}

export const orgIds = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db
      .query("organizations")
      .withIndex("by_kind_created", (q) => q.eq("kind", "customer"))
      .paginate(paginationOpts);
    return {
      ...page,
      page: page.page.filter((org) => !org.deletedAt).map((org) => org._id),
    };
  },
});

export const countsForOrg = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const type = business?.businessType ?? "other";
    const stage = business?.lifecycleStage?.stage ?? null;
    const segment = business
      ? comparableLearningSegment({
          businessType: type,
          lifecycleStage: stage ?? undefined,
          acquisitionDims: business.acquisition?.dims as
            | Record<string, { value?: unknown; source?: unknown } | undefined>
            | undefined,
        })
      : null;
    return {
      type,
      stage,
      segment,
      counts: await orgCounts(ctx, orgId, Date.now() - WINDOW),
    };
  },
});

const rowV = v.object({
  scope: v.string(),
  metric: v.string(),
  workspaces: v.number(),
  trials: v.number(),
  successes: v.number(),
});
const deltaV = v.object({
  scope: v.string(),
  metric: v.string(),
  workspaces: v.number(),
  trials: v.number(),
  successes: v.number(),
});

/** Start or resume the single global learning build. */
export const startRecompute = internalMutation({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db
      .query("learningRateState")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (state?.buildingRunId) {
      const existing = await ctx.db
        .query("learningBuilds")
        .withIndex("by_run", (q) => q.eq("runId", state.buildingRunId!))
        .unique();
      if (existing) {
        await ctx.scheduler.runAfter(
          0,
          existing.phase === "collect"
            ? internal.learning.processPage
            : internal.learning.materializePage,
          { runId: existing.runId },
        );
        return existing.runId;
      }
    }
    const runId = crypto.randomUUID();
    const now = Date.now();
    await ctx.db.insert("learningBuilds", {
      runId,
      phase: "collect",
      orgCursor: null,
      materializeCursor: null,
      snapshotId: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
    if (state)
      await ctx.db.patch(state._id, { buildingRunId: runId, updatedAt: now });
    else
      await ctx.db.insert("learningRateState", {
        key: "global",
        buildingRunId: runId,
        updatedAt: now,
      });
    await ctx.scheduler.runAfter(0, internal.learning.processPage, { runId });
    return runId;
  },
});

/** Commit one organization page and advance its cursor in the same transaction. */
export const commitOrgPage = internalMutation({
  args: {
    runId: v.string(),
    expectedCursor: v.union(v.string(), v.null()),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
    rows: v.array(deltaV),
  },
  handler: async (ctx, { runId, expectedCursor, nextCursor, isDone, rows }) => {
    const build = await ctx.db
      .query("learningBuilds")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .unique();
    if (
      !build ||
      build.phase !== "collect" ||
      build.orgCursor !== expectedCursor
    )
      return false;
    for (const row of rows) {
      const existing = await ctx.db
        .query("learningBuildRates")
        .withIndex("by_run_scope_metric", (q) =>
          q.eq("runId", runId).eq("scope", row.scope).eq("metric", row.metric),
        )
        .unique();
      if (existing)
        await ctx.db.patch(existing._id, {
          workspaces: existing.workspaces + row.workspaces,
          trials: existing.trials + row.trials,
          successes: existing.successes + row.successes,
        });
      else await ctx.db.insert("learningBuildRates", { runId, ...row });
    }
    const now = Date.now();
    await ctx.db.patch(build._id, {
      phase: isDone ? "materialize" : "collect",
      orgCursor: nextCursor,
      materializeCursor: null,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(
      0,
      isDone
        ? internal.learning.materializePage
        : internal.learning.processPage,
      { runId },
    );
    return true;
  },
});

/** Write one staged-rate page to an invisible snapshot and checkpoint atomically. */
export const materializeBuildPage = internalMutation({
  args: { runId: v.string(), expectedCursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { runId, expectedCursor }) => {
    const build = await ctx.db
      .query("learningBuilds")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .unique();
    if (
      !build ||
      build.phase !== "materialize" ||
      build.materializeCursor !== expectedCursor
    )
      return false;
    const page = await ctx.db
      .query("learningBuildRates")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .paginate({ numItems: 200, cursor: expectedCursor });
    const now = Date.now();
    for (const row of page.page) {
      const pooled =
        row.scope.startsWith("type:") ||
        row.scope.startsWith("stage:") ||
        row.scope.startsWith("segment:");
      if (pooled && row.workspaces < K_ANON) continue;
      const existing = await ctx.db
        .query("learnedRates")
        .withIndex("by_snapshot_scope_metric", (q) =>
          q
            .eq("snapshotId", build.snapshotId)
            .eq("scope", row.scope)
            .eq("metric", row.metric),
        )
        .first();
      const doc = {
        snapshotId: build.snapshotId,
        scope: row.scope,
        metric: row.metric,
        workspaces: row.workspaces,
        trials: row.trials,
        successes: row.successes,
        rate: row.trials ? row.successes / row.trials : 0,
        updatedAt: now,
      };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("learnedRates", doc);
    }
    if (!page.isDone) {
      await ctx.db.patch(build._id, {
        materializeCursor: page.continueCursor,
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.learning.materializePage, {
        runId,
      });
      return true;
    }
    const state = await ctx.db
      .query("learningRateState")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const previous = state?.activeSnapshotId;
    if (state)
      await ctx.db.patch(state._id, {
        activeSnapshotId: build.snapshotId,
        buildingRunId: undefined,
        updatedAt: now,
      });
    else
      await ctx.db.insert("learningRateState", {
        key: "global",
        activeSnapshotId: build.snapshotId,
        updatedAt: now,
      });
    await ctx.db.patch(build._id, { phase: "complete", updatedAt: now });
    if (previous && previous !== build.snapshotId)
      await ctx.scheduler.runAfter(0, internal.learning.cleanupSnapshot, {
        snapshotId: previous,
      });
    await ctx.scheduler.runAfter(0, internal.learning.cleanupLegacyRates, {});
    await ctx.scheduler.runAfter(0, internal.learning.cleanupBuild, { runId });
    return true;
  },
});

export const cleanupBuild = internalMutation({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const build = await ctx.db
      .query("learningBuilds")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .unique();
    if (!build || build.phase !== "complete") return;
    const rows = await ctx.db
      .query("learningBuildRates")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .take(250);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 250)
      await ctx.scheduler.runAfter(0, internal.learning.cleanupBuild, {
        runId,
      });
    else await ctx.db.delete(build._id);
  },
});

export const processPage = internalAction({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const build = await ctx.runQuery(internal.learning.buildForRun, { runId });
    if (!build || build.phase !== "collect") return;
    const page = await ctx.runQuery(internal.learning.orgIds, {
      paginationOpts: { numItems: ORG_PAGE_SIZE, cursor: build.orgCursor },
    });
    const delta = new Map<
      string,
      {
        scope: string;
        metric: string;
        workspaces: number;
        trials: number;
        successes: number;
      }
    >();
    for (
      let offset = 0;
      offset < page.page.length;
      offset += ORG_READ_CONCURRENCY
    ) {
      const orgIds = page.page.slice(offset, offset + ORG_READ_CONCURRENCY);
      const results = await Promise.all(
        orgIds.map((orgId) =>
          ctx.runQuery(internal.learning.countsForOrg, { orgId }),
        ),
      );
      for (let index = 0; index < results.length; index++) {
        const { type, stage, segment, counts } = results[index];
        const add = (
          scope: string,
          metric: string,
          x: { trials: number; successes: number },
          workspaces = 1,
        ) => {
          const key = `${scope}|${metric}`;
          const current = delta.get(key) ?? {
            scope,
            metric,
            workspaces: 0,
            trials: 0,
            successes: 0,
          };
          current.workspaces += workspaces;
          current.trials += x.trials;
          current.successes += x.successes;
          delta.set(key, current);
        };
        for (const [metric, x] of Object.entries(counts)) {
          add(`org:${orgIds[index]}`, metric, x);
          if (x.trials < METRICS[metric].minTrials) continue;
          const contribution = boundedPoolContribution(x.trials, x.successes);
          for (const scope of [
            `type:${type}`,
            ...(stage ? [`stage:${type}:${stage}`] : []),
            ...(segment ? [segment.scope] : []),
          ])
            add(scope, metric, contribution);
        }
      }
    }
    await ctx.runMutation(internal.learning.commitOrgPage, {
      runId,
      expectedCursor: build.orgCursor,
      nextCursor: page.isDone ? null : page.continueCursor,
      isDone: page.isDone,
      rows: [...delta.values()],
    });
  },
});

export const buildForRun = internalQuery({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) =>
    ctx.db
      .query("learningBuilds")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .unique(),
});

export const materializePage = internalAction({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const build = await ctx.runQuery(internal.learning.buildForRun, { runId });
    if (build?.phase === "materialize")
      await ctx.runMutation(internal.learning.materializeBuildPage, {
        runId,
        expectedCursor: build.materializeCursor,
      });
  },
});

export const writeRates = internalMutation({
  args: { snapshotId: v.string(), rows: v.array(rowV) },
  handler: async (ctx, { snapshotId, rows }) => {
    const now = Date.now();
    for (const r of rows) {
      const existing = await ctx.db
        .query("learnedRates")
        .withIndex("by_snapshot_scope_metric", (q) =>
          q
            .eq("snapshotId", snapshotId)
            .eq("scope", r.scope)
            .eq("metric", r.metric),
        )
        .first();
      const doc = {
        ...r,
        snapshotId,
        rate: r.trials ? r.successes / r.trials : 0,
        updatedAt: now,
      };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("learnedRates", doc);
    }
  },
});

export const activateSnapshot = internalMutation({
  args: { snapshotId: v.string() },
  handler: async (ctx, { snapshotId }) => {
    const state = await ctx.db
      .query("learningRateState")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const previous = state?.activeSnapshotId;
    if (state)
      await ctx.db.patch(state._id, {
        activeSnapshotId: snapshotId,
        updatedAt: Date.now(),
      });
    else
      await ctx.db.insert("learningRateState", {
        key: "global",
        activeSnapshotId: snapshotId,
        updatedAt: Date.now(),
      });
    if (previous && previous !== snapshotId)
      await ctx.scheduler.runAfter(0, internal.learning.cleanupSnapshot, {
        snapshotId: previous,
      });
    await ctx.scheduler.runAfter(0, internal.learning.cleanupLegacyRates, {});
    return true;
  },
});

export const cleanupSnapshot = internalMutation({
  args: { snapshotId: v.string() },
  handler: async (ctx, { snapshotId }) => {
    const active = await ctx.db
      .query("learningRateState")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (active?.activeSnapshotId === snapshotId) return;
    const rows = await ctx.db
      .query("learnedRates")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", snapshotId))
      .take(250);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 250)
      await ctx.scheduler.runAfter(0, internal.learning.cleanupSnapshot, {
        snapshotId,
      });
  },
});

export const cleanupLegacyRates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("learningRateState")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (!active?.activeSnapshotId) return;
    const rows = await ctx.db
      .query("learnedRates")
      .withIndex("by_snapshot", (q) => q.eq("snapshotId", undefined))
      .take(250);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length === 250)
      await ctx.scheduler.runAfter(0, internal.learning.cleanupLegacyRates, {});
  },
});

/** Weekly entrypoint. Work continues in durable organization and materialization pages. */
export const recompute = internalAction({
  args: {},
  handler: async (ctx): Promise<void> => {
    await ctx.runMutation(internal.learning.startRecompute, {});
  },
});

/** Text block for the planner: this business's own results, then a mature owner-reported stage cohort or broader type pool. */
export const contextFor = internalQuery({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }): Promise<string> => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first();
    const type = business?.businessType ?? "other";
    const stage = business?.lifecycleStage?.stage;
    const segment = business
      ? comparableLearningSegment({
          businessType: type,
          lifecycleStage: stage,
          acquisitionDims: business.acquisition?.dims as
            | Record<string, { value?: unknown; source?: unknown } | undefined>
            | undefined,
        })
      : null;
    const state = await ctx.db
      .query("learningRateState")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    const rate = async (scope: string, metric: string) =>
      state?.activeSnapshotId
        ? ctx.db
            .query("learnedRates")
            .withIndex("by_snapshot_scope_metric", (q) =>
              q
                .eq("snapshotId", state.activeSnapshotId!)
                .eq("scope", scope)
                .eq("metric", metric),
            )
            .first()
        : ctx.db
            .query("learnedRates")
            .withIndex("by_scope_metric", (q) =>
              q.eq("scope", scope).eq("metric", metric),
            )
            .first();
    const lines: string[] = [];
    for (const metric of Object.keys(METRIC_DEFS)) {
      const own = await rate(`org:${orgId}`, metric);
      const segmentPool = segment ? await rate(segment.scope, metric) : null;
      const stagePool = stage
        ? await rate(`stage:${type}:${stage}`, metric)
        : null;
      const pool = stagePool ?? (await rate(`type:${type}`, metric));
      if (own) lines.push(rateLine(metric, "own", own));
      const selectedPool = segmentPool ?? pool;
      if (selectedPool)
        lines.push(
          rateLine(
            metric,
            {
        workspaces: selectedPool.workspaces,
              label: segmentPool
                ? segment!.label
                : stagePool
                  ? `${type} businesses at the owner-reported ${stage} stage`
                  : `${type} businesses (stage not matched)`,
            },
            selectedPool,
          ),
        );
    }
    return lines.length
      ? `RESULTS CLIMBOS HAS MEASURED (counts, not causes; prefer them to vendor benchmarks when the offer and channel match; a small sample's range is wide):\n${lines.join("\n")}`
      : "";
  },
});
