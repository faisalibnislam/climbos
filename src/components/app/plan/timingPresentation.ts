import type { CampaignTiming } from "../../../../shared/agents/campaignTiming";

/** Owner-facing wording for the planning decision; stored enum values stay unchanged. */
export function timingDecisionLabel(decision: CampaignTiming["decision"]): string {
  switch (decision) {
    case "proceed": return "Recommended window";
    case "prepare_first": return "Get ready before choosing dates";
    case "defer": return "Wait until a better time";
    case "skip": return "Use a non-seasonal plan";
    case "not_enough_evidence": return "Timing is not clear yet";
    case "not_relevant": return "Dates do not affect this plan";
  }
}

export function timingCapacityLabel(status: CampaignTiming["capacity"]["status"]): string {
  switch (status) {
    case "available": return "Enough room to take on the work";
    case "constrained": return "Available time or stock is limited";
    case "unknown": return "Ability to take on the work is not confirmed";
    case "not_applicable": return "No added service or delivery is needed";
  }
}

/** Format date-only values as calendar dates without applying the viewer's timezone. */
export function formatTimingWindow(window: CampaignTiming["proposedWindow"]): string | null {
  if (!window) return null;
  const start = new Date(`${window.startDate}T00:00:00.000Z`);
  const end = new Date(`${window.endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();
  const month = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
  const day = new Intl.DateTimeFormat("en", { day: "numeric", timeZone: "UTC" });
  const monthDay = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
  const monthDayYear = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  if (sameMonth) return `${month.format(start)} ${day.format(start)}–${day.format(end)}, ${start.getUTCFullYear()}`;
  if (sameYear) return `${monthDay.format(start)} – ${monthDayYear.format(end)}`;
  return `${monthDayYear.format(start)} – ${monthDayYear.format(end)}`;
}

export function timingDurationLabel(days: number | null, noun: string): string {
  return days === null ? `${noun}: not confirmed` : `${noun}: ${days} ${days === 1 ? "day" : "days"}`;
}

