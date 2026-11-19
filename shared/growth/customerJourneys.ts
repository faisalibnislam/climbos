/** Elapsed waiting time between owner-reviewed steps; never recipient-local delivery time. */
export const MAX_JOURNEY_STEPS = 5;
export const MAX_JOURNEY_CONTACTS = 200;
export const MAX_CUSTOMER_JOURNEYS = 20;
export function journeyDueAt(anchor: number, delayDays: number): number | null {
  if (!Number.isSafeInteger(anchor) || anchor < 0 || !Number.isInteger(delayDays) || delayDays < 0 || delayDays > 365) return null;
  const due = anchor + delayDays * 86_400_000;
  return Number.isSafeInteger(due) ? due : null;
}
