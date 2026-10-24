import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";

/** Dispatch at most five due, previously fetched source checks per daily tick. */
export const refreshDue = internalAction({
  args: {},
  handler: async (ctx: ActionCtx): Promise<{ eligible: number; queued: number }> => {
    const now = Date.now();
    const due = await ctx.runQuery(internal.knowledge.dueRefreshes, { now, limit: 5 });
    let queued = 0;
    for (const sourceId of due) {
      const claimed = await ctx.runMutation(internal.knowledge.queueDueRefresh, { sourceId, now });
      if (!claimed) continue;
      await ctx.scheduler.runAfter(0, internal.knowledgeActions.refreshSource, { sourceId, scheduled: true });
      queued++;
    }
    return { eligible: due.length, queued };
  },
});
