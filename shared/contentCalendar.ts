/** Shared identity and merge rules for independently paginated calendar sources. */
export type CalendarItem = {
  id: string;
  artifactId: string | null;
  slotId: string | null;
  title: string;
  channel: string;
  status: string;
  scheduledFor: number;
  autopilot: boolean;
  autopilotStatus: string | null;
  /** Review drafts without a posting time are placed on their creation day. */
  unscheduled?: boolean;
};

export function mergeCalendarItems(...sources: readonly CalendarItem[][]): CalendarItem[] {
  const items = new Map<string, CalendarItem>();
  for (const source of sources) {
    for (const item of source) {
      const key = item.artifactId ?? item.id;
      const previous = items.get(key);
      // A linked slot supplies Autopilot state and a proposed time for an
      // unscheduled draft. Prefer it regardless of which source loads first.
      if (!previous || (item.autopilot && !previous.autopilot)) items.set(key, item);
    }
  }
  return [...items.values()].sort((a, b) => a.scheduledFor - b.scheduledFor || a.id.localeCompare(b.id));
}
