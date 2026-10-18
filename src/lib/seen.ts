/**
 * Count a public page view once per visitor per day (remembered in this
 * browser). Returns true the first time; reloads and revisits return false.
 */
export function firstViewToday(key: string, now = Date.now()): boolean {
  const k = `climbos:seen:${key}`;
  try {
    const last = Number(localStorage.getItem(k) ?? 0);
    if (last && now - last < 86_400_000) return false;
    localStorage.setItem(k, String(now));
    return true;
  } catch {
    // Storage blocked: count it (better than never counting).
    return true;
  }
}
