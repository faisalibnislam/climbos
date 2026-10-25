import { WEBHOOK_EVENTS, type WebhookEvent } from "../webhooks";

/**
 * Business events that may start a specialist run. Runs stay draft-only through the existing scheduled path;
 * a per-specialist cooldown limits how often events can start one.
 */
export const SPECIALIST_EVENTS = ["lead.created", "deal.won", "booking.created", "reply.received", "post.published"] as const satisfies readonly WebhookEvent[];
export type SpecialistEvent = (typeof SPECIALIST_EVENTS)[number];
export const SPECIALIST_EVENT_LABEL: Record<SpecialistEvent, string> = Object.fromEntries(SPECIALIST_EVENTS.map((e) => [e, WEBHOOK_EVENTS[e]])) as Record<SpecialistEvent, string>;
export const DEFAULT_EVENT_COOLDOWN_HOURS = 24;

export function isSpecialistEvent(event: string): event is SpecialistEvent {
  return (SPECIALIST_EVENTS as readonly string[]).includes(event);
}

/** Whether an event may start this specialist now (active, listening for it, and past its cooldown). */
export function eventMayTrigger(agent: { status: string; trigger: string; triggerEvents?: string[]; eventCooldownHours?: number; lastEventRunAt?: number }, event: string, nowMs: number): boolean {
  if (agent.status !== "active" || agent.trigger !== "event" || !agent.triggerEvents?.includes(event)) return false;
  const cooldown = (agent.eventCooldownHours ?? DEFAULT_EVENT_COOLDOWN_HOURS) * 3_600_000;
  return agent.lastEventRunAt === undefined || nowMs - agent.lastEventRunAt >= cooldown;
}
