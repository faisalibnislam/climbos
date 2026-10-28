import { Checkbox, Field, Segmented } from "@/components/ui";
import { SPECIALIST_EVENTS, SPECIALIST_EVENT_LABEL, type SpecialistEvent } from "@shared/agents/specialistEvents";

type Trigger = "manual" | "daily" | "weekly" | "event";

/** One line describing when a specialist runs. */
export function triggerSummary(agent: { trigger: Trigger; triggerEvents?: string[]; eventCooldownHours?: number | null }): string {
  if (agent.trigger === "manual") return "Runs when you ask";
  if (agent.trigger !== "event") return `Runs ${agent.trigger}`;
  const events = (agent.triggerEvents ?? []).map((e) => SPECIALIST_EVENT_LABEL[e as SpecialistEvent]?.toLowerCase() ?? e);
  return `Runs after: ${events.join("; ") || "no events chosen"} (at most once every ${agent.eventCooldownHours ?? 24} hours)`;
}

/** When a specialist runs: on request, on a schedule, or after chosen business events (draft-only, rate-limited). */
export function SpecialistTriggerFields({ trigger, onTrigger, events, onEvents, cooldown, onCooldown }: { trigger: Trigger; onTrigger: (t: Trigger) => void; events: string[]; onEvents: (e: string[]) => void; cooldown: number; onCooldown: (h: number) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="When it runs" hint="Drafts only, within your budget caps. Pause any time in Automations.">
        <Segmented label="When it runs" value={trigger} onChange={onTrigger} options={[{ value: "manual", label: "When I ask" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "event", label: "After an event" }]} />
      </Field>
      {trigger === "event" ? (
        <>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-ui font-medium text-ink">Start after</legend>
            {SPECIALIST_EVENTS.map((event) => (
              <Checkbox key={event} label={SPECIALIST_EVENT_LABEL[event]} checked={events.includes(event)} onCheckedChange={(checked) => onEvents(checked ? [...new Set([...events, event])] : events.filter((e) => e !== event))} />
            ))}
          </fieldset>
          <Field label="At most once every">
            <Segmented label="At most once every" value={cooldown} onChange={onCooldown} options={[{ value: 6, label: "6 hours" }, { value: 24, label: "1 day" }, { value: 72, label: "3 days" }, { value: 168, label: "1 week" }]} />
          </Field>
        </>
      ) : null}
    </div>
  );
}
