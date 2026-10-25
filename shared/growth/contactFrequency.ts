/**
 * Owner-set contact frequency: a person counts as recently emailed when ClimbOS last emailed them (marketing
 * broadcast or outreach) within the owner's limit, or is in an active outreach sequence. No limit is applied
 * unless the owner sets one.
 */

const DAY = 86_400_000;

export interface ContactHistory { lastMarketingEmailAt?: number; lastOutreachSentAt?: number; activeOutreach: boolean }
export interface FrequencyCheck { recentlyEmailed: number; activeOutreach: number; clearAt: number | null }

export function checkContactFrequency(people: readonly ContactHistory[], limitDays: number | undefined, nowMs: number): FrequencyCheck | null {
  if (!limitDays || !(limitDays > 0)) return null;
  const window = limitDays * DAY;
  let recentlyEmailed = 0;
  let activeOutreach = 0;
  let clearAt: number | null = null;
  for (const p of people) {
    if (p.activeOutreach) {
      activeOutreach++;
      continue;
    }
    const last = Math.max(p.lastMarketingEmailAt ?? 0, p.lastOutreachSentAt ?? 0);
    if (last && nowMs - last < window) {
      recentlyEmailed++;
      clearAt = Math.max(clearAt ?? 0, last + window);
    }
  }
  return { recentlyEmailed, activeOutreach, clearAt };
}

export function frequencyBlockMessage(check: FrequencyCheck, limitDays: number): string | null {
  if (!check.recentlyEmailed && !check.activeOutreach) return null;
  const parts = [
    check.recentlyEmailed ? `${check.recentlyEmailed} ${check.recentlyEmailed === 1 ? "person was" : "people were"} emailed by ClimbOS within your ${limitDays}-day limit` : "",
    check.activeOutreach ? `${check.activeOutreach} ${check.activeOutreach === 1 ? "is" : "are"} in an active outreach sequence` : "",
  ].filter(Boolean);
  const when = check.clearAt ? ` The last of the recent emails clears on ${new Date(check.clearAt).toISOString().slice(0, 10)}.` : "";
  return `In this segment, ${parts.join(" and ")}. Remove them from the segment or wait, then approve again.${when}`;
}
