/** Product freshness policy, not a universal lifetime for memes or trends. */
export const MAX_CURRENT_TREND_AGE_MS = 30 * 86_400_000;

type TrendBrief = {
  trendEvidence?: { sourceUrl: string; observationDate: string; observation: string };
  supportingSourceUrls: string[];
};

/** Recheck saved, version-bound evidence without inventing a new observation. */
export function trendFreshnessIssue(brief: TrendBrief | undefined, now: number, scheduledFor?: number): string | null {
  const evidence = brief?.trendEvidence;
  if (!evidence) return null; // Evergreen and legacy drafts do not assert structured trend evidence.
  const date = evidence.observationDate;
  const observedAt = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(observedAt)
    || new Date(observedAt).toISOString().slice(0, 10) !== date) {
    return "The trend observation date is invalid. Refresh its research before approving or posting.";
  }
  if (!evidence.observation.trim() || !brief.supportingSourceUrls.includes(evidence.sourceUrl)) {
    return "The trend observation needs its saved supporting source. Refresh its research before approving or posting.";
  }
  if (!Number.isFinite(now) || (scheduledFor !== undefined && !Number.isFinite(scheduledFor))) {
    return "The posting time is invalid. Choose a valid time before approving or posting.";
  }
  // Observations have day precision. Use UTC days consistently with generation lint.
  const today = Math.floor(now / 86_400_000) * 86_400_000;
  if (observedAt > today) return "The trend observation is dated in the future. Correct its source date before approving or posting.";
  const postingDay = Math.floor(Math.max(now, scheduledFor ?? now) / 86_400_000) * 86_400_000;
  if (postingDay - observedAt > MAX_CURRENT_TREND_AGE_MS) {
    return "This trend evidence exceeds ClimbOS's 30-day window at the posting time. Refresh the research and review a new draft, or use an evergreen idea.";
  }
  return null;
}
