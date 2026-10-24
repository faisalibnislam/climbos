import { validateResolvedAddresses } from "./website";
import { safePublicUrl } from "../net/safeUrl";
import type { FetchLike } from "./types";

export type WordPressCredentials = { siteUrl: string; username: string; applicationPassword: string };
export type WordPressProbe =
  | { ok: true; siteUrl: string; userId: number; accountName: string }
  | { ok: false; reason: "invalid_site" | "unsafe_host" | "unreachable" | "credentials" | "permission" | "unsupported" };

type ProbeOptions = {
  fetchImpl?: FetchLike;
  resolveHost?: (hostname: string) => Promise<string[]>;
};

/** Normalize a WordPress install URL without accepting credentials, queries, fragments, or non-HTTPS sites. */
export function normalizeWordPressSiteUrl(raw: string): string | null {
  const url = safePublicUrl(raw.trim());
  if (!url || url.protocol !== "https:" || !url.hostname.includes(".") || url.hostname.startsWith("[")) return null;
  if (url.search || url.hash || url.port && url.port !== "443") return null;
  const path = url.pathname.replace(/\/+$/u, "");
  return `${url.origin}${path}`;
}

function basicAuthorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password.replace(/\s+/gu, "")}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

async function readJsonBounded(response: Response, maxBytes = 100_000): Promise<unknown> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; } catch { return null; }
}

/** Probe the exact HTTPS origin with revocable WordPress Application Passwords; redirects are never followed. */
export async function probeWordPressCredentials(credentials: WordPressCredentials, options: ProbeOptions = {}): Promise<WordPressProbe> {
  const siteUrl = normalizeWordPressSiteUrl(credentials.siteUrl);
  const username = credentials.username.trim();
  const password = credentials.applicationPassword.trim();
  if (!siteUrl || !username || username.length > 120 || !password || password.length > 160) return { ok: false, reason: "invalid_site" };
  const site = new URL(siteUrl);
  if (options.resolveHost) {
    const resolved = await options.resolveHost(site.hostname).catch(() => []);
    if (!validateResolvedAddresses(resolved).ok) return { ok: false, reason: "unsafe_host" };
  }
  const endpoint = new URL(`${site.pathname.replace(/\/$/u, "")}/wp-json/wp/v2/users/me`, site.origin);
  endpoint.searchParams.set("context", "edit");
  endpoint.searchParams.set("_fields", "id,name,slug,capabilities");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  let response: Response;
  try {
    response = await (options.fetchImpl ?? ((input, init) => fetch(input, init)))(endpoint.toString(), {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "application/json", Authorization: basicAuthorization(username, password), "User-Agent": "ClimbOS/1.0 WordPress connector" },
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) return { ok: false, reason: "credentials" };
  if (response.status >= 300 && response.status < 400) return { ok: false, reason: "unsupported" };
  if (response.status < 200 || response.status >= 300) return { ok: false, reason: "unreachable" };
  const data = await readJsonBounded(response);
  if (!data || typeof data !== "object") return { ok: false, reason: "unsupported" };
  const user = data as { id?: unknown; name?: unknown; capabilities?: unknown };
  if (typeof user.id !== "number" || typeof user.name !== "string" || !user.capabilities || typeof user.capabilities !== "object") return { ok: false, reason: "unsupported" };
  if ((user.capabilities as Record<string, unknown>).edit_posts !== true) return { ok: false, reason: "permission" };
  return { ok: true, siteUrl, userId: user.id, accountName: user.name.slice(0, 120) };
}
