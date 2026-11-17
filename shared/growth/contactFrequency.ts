/**
 * Owner-set contact frequency: a person counts as recently emailed when ClimbOS last emailed them (marketing
 * broadcast or outreach) within the owner's limit, or is in an active outreach sequence. Pending marketing
 * attempts are checked separately against their frozen recipients. No limit is applied
 * unless the owner sets one.
 */

const DAY = 86_400_000;

export interface ContactHistory { lastMarketingEmailAt?: number; lastOutreachSentAt?: number; activeOutreach: boolean }
export interface FrequencyCheck { recentlyEmailed: number; activeOutreach: number; clearAt: number | null; activeMarketing?: number; unknownMarketingAudience?: boolean }

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
  if (check.unknownMarketingAudience) return "ClimbOS cannot verify the recipients of every earlier email attempt that is still unresolved. Check those send results before approving another broadcast under your contact limit.";
  if (!check.recentlyEmailed && !check.activeOutreach && !check.activeMarketing) return null;
  const parts = [
    check.recentlyEmailed ? `${check.recentlyEmailed} ${check.recentlyEmailed === 1 ? "person was" : "people were"} emailed by ClimbOS within your ${limitDays}-day limit` : "",
    check.activeOutreach ? `${check.activeOutreach} ${check.activeOutreach === 1 ? "is" : "are"} in an active outreach sequence` : "",
    check.activeMarketing ? `${check.activeMarketing} ${check.activeMarketing === 1 ? "person is" : "people are"} waiting for a marketing send result` : "",
  ].filter(Boolean);
  const when = check.clearAt ? ` The last of the recent emails clears on ${new Date(check.clearAt).toISOString().slice(0, 10)}.` : "";
  const next = check.activeMarketing ? "Check the earlier send result before approving another email to these people." : "Remove them from the segment or wait, then approve again.";
  return `In this segment, ${parts.join(" and ")}. ${next}${when}`;
}
