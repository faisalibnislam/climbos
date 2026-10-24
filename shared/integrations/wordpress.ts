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

function escapeHtml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&#39;");
}

/** Render the small Markdown subset used by article drafts, escaping raw HTML and allowing HTTPS links only. */
export function wordpressArticleHtml(markdown: string): string {
  const inline = (value: string) => {
    let safe = escapeHtml(value);
    safe = safe.replace(/\[([^\]]{1,200})\]\((https:\/\/[^\s)]+)\)/gu, (match, label: string, rawUrl: string) => {
      const url = safePublicUrl(rawUrl);
      return url?.protocol === "https:" ? `<a href="${escapeHtml(url.toString())}">${label}</a>` : match;
    });
    safe = safe.replace(/\*\*([^*\n]+)\*\*/gu, "<strong>$1</strong>").replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/gu, "<em>$1</em>");
    return safe;
  };
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const output: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let code: string[] | null = null;
  const closeParagraph = () => {
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (list) output.push(`</${list}>`);
    list = null;
  };
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      closeParagraph(); closeList();
      if (code) { output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`); code = null; }
      else code = [];
      continue;
    }
    if (code) { code.push(line); continue; }
    const heading = /^(#{1,6})\s+(.+?)\s*#*$/u.exec(line);
    const unordered = /^\s*[-*+]\s+(.+)$/u.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/u.exec(line);
    if (!line.trim()) { closeParagraph(); closeList(); continue; }
    if (heading) { closeParagraph(); closeList(); output.push(`<h${heading[1]!.length}>${inline(heading[2]!)}</h${heading[1]!.length}>`); continue; }
    if (unordered || ordered) {
      closeParagraph();
      const nextList = unordered ? "ul" : "ol";
      if (list !== nextList) { closeList(); output.push(`<${nextList}>`); list = nextList; }
      output.push(`<li>${inline((unordered ?? ordered)![1]!)}</li>`);
      continue;
    }
    closeList();
    paragraph.push(line.trim());
  }
  closeParagraph(); closeList();
  if (code) output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return output.join("\n").slice(0, 100_000);
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
