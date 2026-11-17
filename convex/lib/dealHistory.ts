import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { DealStage } from "../../shared/growth/dealHistory";

export const dealStageV = v.union(v.literal("lead"), v.literal("talking"), v.literal("booked"), v.literal("won"), v.literal("lost"));
const sourceV = v.union(v.literal("owner"), v.literal("prospect"), v.literal("booking"), v.literal("booking_cancelled"), v.literal("inbound"));
export const dealStageHistoryV = v.object({
  total: v.number(), fromCreation: v.boolean(), events: v.array(v.object({
    sequence: v.number(), from: v.union(dealStageV, v.null()), to: dealStageV, at: v.number(), source: sourceV, actorId: v.optional(v.id("users")),
  })),
});
type History = NonNullable<Doc<"deals">["stageHistory"]>;
type Source = History["events"][number]["source"];
export function initialDealHistory(to: DealStage, at: number, source: Source, actorId?: Id<"users">): History {
  return { total: 1, fromCreation: true, events: [{ sequence: 1, from: null, to, at, source, ...(actorId ? { actorId } : {}) }] };
}
/** Called only with a genuine state transition. Never reconstruct missing historical events. */
export function advanceDealHistory(deal: Pick<Doc<"deals">, "stage" | "stageHistory">, to: DealStage, at: number, source: Source, actorId?: Id<"users">): History | undefined {
  if (to === deal.stage) return deal.stageHistory;
  const previous = deal.stageHistory ?? { total: 0, fromCreation: false, events: [] };
  const event = { sequence: previous.total + 1, from: deal.stage, to, at, source, ...(actorId ? { actorId } : {}) };
  return { total: event.sequence, fromCreation: previous.fromCreation, events: [...previous.events, event].slice(-100) };
}
