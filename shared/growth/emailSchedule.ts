/** An exact reviewed email may wait at most 23 hours, then has one delivery hour.
 * This is an authorization lifetime, not advice about the best time to send. */
export const EMAIL_DELIVERY_WINDOW_MS = 3_600_000;
export function emailDeliveryWindow(scheduledFor: number, now: number, allowanceEndsAt: number) {
  const windowEnd = scheduledFor + EMAIL_DELIVERY_WINDOW_MS;
  if (![scheduledFor, now, allowanceEndsAt, windowEnd].every(Number.isSafeInteger)
    || scheduledFor < now + 60_000 || scheduledFor > now + 23 * EMAIL_DELIVERY_WINDOW_MS
    || windowEnd > allowanceEndsAt) return null;
  return { scheduledFor, windowEnd };
}

/** Reject invalid dates and nonexistent local times instead of silently normalizing them. */
export function localEmailDeliveryTime(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value);
  const [y, m, d, h, minute] = value.split(/[-T:]/).map(Number);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d || date.getHours() !== h || date.getMinutes() !== minute) return null;
  return date.getTime();
}
