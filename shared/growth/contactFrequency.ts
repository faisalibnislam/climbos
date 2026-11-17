/**
 * Owner-set contact frequency: a person counts as recently emailed when ClimbOS last emailed them (marketing
 * broadcast, outreach or review invitation) within the owner's limit, or is in an active outreach sequence. Pending marketing
 * attempts are checked separately against their frozen recipients. No limit is applied
 * unless the owner sets one.
 */

const DAY = 86_400_000;

export interface ContactHistory {
  lastMarketingEmailAt?: number; lastOutreachSentAt?: number; activeOutreach: boolean;
  lastReviewSentAt?: number; activeReview?: boolean; unknownReviewHistory?: boolean;
  /** Latest observation confirming a prior send, an upper bound rather than a send timestamp. */
  reviewObservedAt?: number;
}
export interface FrequencyCheck { recentlyEmailed: number; activeOutreach: number; clearAt: number | null; activeMarketing?: number; unknownMarketingAudience?: boolean; activeReview?: number; recentReviewObservations?: number; unknownReviewHistory?: boolean }

export function checkContactFrequency(people: readonly ContactHistory[], limitDays: number | undefined, nowMs: number): FrequencyCheck | null {
  if (!limitDays || !(limitDays > 0)) return null;
  const window = limitDays * DAY;
  let recentlyEmailed = 0;
  let activeOutreach = 0;
  let clearAt: number | null = null;
  let activeReview = 0;
  let recentReviewObservations = 0;
  let unknownReviewHistory = false;
  for (const p of people) {
    if (p.unknownReviewHistory) unknownReviewHistory = true;
    if (p.activeReview) { activeReview++; continue; }
    if (p.activeOutreach) {
      activeOutreach++;
      continue;
    }
    const last = Math.max(p.lastMarketingEmailAt ?? 0, p.lastOutreachSentAt ?? 0, p.lastReviewSentAt ?? 0);
    if (last && nowMs - last < window) {
      recentlyEmailed++;
      clearAt = Math.max(clearAt ?? 0, last + window);
    }
    if (p.reviewObservedAt && nowMs - p.reviewObservedAt < window) {
      recentReviewObservations++;
      clearAt = Math.max(clearAt ?? 0, p.reviewObservedAt + window);
    }
  }
  return { recentlyEmailed, activeOutreach, clearAt, ...(activeReview ? { activeReview } : {}), ...(recentReviewObservations ? { recentReviewObservations } : {}), ...(unknownReviewHistory ? { unknownReviewHistory } : {}) };
}

export function frequencyBlockMessage(check: FrequencyCheck, limitDays: number): string | null {
  if (check.unknownMarketingAudience) return "ClimbOS cannot verify the recipients of every earlier email attempt that is still unresolved. Check those send results before approving another email under your contact limit.";
  if (check.unknownReviewHistory) return "ClimbOS cannot verify the timing or outcome of earlier review invitations for this recipient list. Check the review invitation history before sending under your contact limit.";
  if (!check.recentlyEmailed && !check.activeOutreach && !check.activeMarketing && !check.activeReview && !check.recentReviewObservations) return null;
  const parts = [
    check.recentlyEmailed ? `${check.recentlyEmailed} ${check.recentlyEmailed === 1 ? "person was" : "people were"} emailed by ClimbOS within your ${limitDays}-day limit` : "",
    check.activeOutreach ? `${check.activeOutreach} ${check.activeOutreach === 1 ? "is" : "are"} in an active outreach sequence` : "",
    check.activeMarketing ? `${check.activeMarketing} ${check.activeMarketing === 1 ? "person is" : "people are"} waiting for a marketing send result` : "",
    check.activeReview ? `${check.activeReview} ${check.activeReview === 1 ? "person has" : "people have"} a queued or unresolved review invitation` : "",
    check.recentReviewObservations ? `${check.recentReviewObservations} prior review invitation(s) were confirmed within your ${limitDays}-day limit; their exact send time is unknown, so the wait uses the observation time conservatively` : "",
  ].filter(Boolean);
  const when = check.clearAt ? ` The dated waiting period clears on ${new Date(check.clearAt).toISOString().slice(0, 10)} (UTC); unresolved attempts still need a result.` : "";
  const next = check.activeMarketing || check.activeReview ? "Check the earlier send result before approving another email to these people." : "Wait or review the recipient list before approving again.";
  return `For this recipient list, ${parts.join(" and ")}. ${next}${when}`;
}
