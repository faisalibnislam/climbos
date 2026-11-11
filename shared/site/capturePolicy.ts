import { isLoopbackHttpOrigin } from "../policy/localDevelopment";
import { safePublicUrl } from "../net/safeUrl";
/** A local renderer can read only its exact one-time draft URL, never an arbitrary private page. */
export function localDraftCaptureUrl(raw: string, requestOrigin: string): URL | null {
  try {
    const u = new URL(raw);
    return isLoopbackHttpOrigin(requestOrigin) && u.origin === requestOrigin && !u.username && !u.password && /^\/render\/landing-draft\/[a-f0-9]{48}$/.test(u.pathname) && !u.search && !u.hash ? u : null;
  } catch { return null; }
}
export function captureResourceAllowed(raw: string, draft: URL | null): boolean {
  if (safePublicUrl(raw)) return true;
  try {
    const u = new URL(raw);
    return Boolean(draft && !u.username && !u.password && u.origin === draft.origin && ((u.pathname === draft.pathname && !u.search && !u.hash) || u.pathname.startsWith("/_next/static/") || (!u.pathname.startsWith("/api/") && !u.search && /\.(?:png|svg|ico|woff2?)$/.test(u.pathname))));
  } catch { return false; }
}
