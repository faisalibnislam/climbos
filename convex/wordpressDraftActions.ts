"use node";

import { lookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { normalizeWordPressSiteUrl, wordpressArticleHtml } from "../shared/integrations/wordpress";
import { validateResolvedAddresses } from "../shared/integrations/website";

function wordpressPinnedFetch(url: string, init: RequestInit | undefined, address: string[]): Promise<Response> {
  const parsed = new URL(url);
  const ip = address[0];
  const family = ip ? isIP(ip) : 0;
  if (parsed.protocol !== "https:" || !ip || !family || !validateResolvedAddresses(address).ok) return Promise.reject(new Error("WordPress requests require a validated public HTTPS address."));
  const headers: Record<string, string> = {};
  new Headers(init?.headers).forEach((value, key) => { headers[key] = value; });
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    const req = httpsRequest(parsed, {
      method: init?.method ?? "GET",
      headers,
      signal: init?.signal ?? undefined,
      timeout: 8_000,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address: ip, family }]);
        else callback(null, ip, family);
      },
    }, (res) => {
      res.on("data", (chunk: Buffer | string) => {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > 100_000) { req.destroy(new Error("WordPress response exceeded its size limit.")); return; }
        chunks.push(bytes);
      });
      res.on("end", () => {
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(res.headers)) {
          if (Array.isArray(value)) value.forEach((part) => responseHeaders.append(key, part));
          else if (typeof value === "string") responseHeaders.set(key, value);
        }
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 502, headers: responseHeaders }));
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end(typeof init?.body === "string" ? init.body : undefined);
  });
}

function authorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password.replace(/\s+/gu, "")}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

async function boundedJson(response: Response): Promise<Record<string, unknown> | null> {
  const size = Number(response.headers.get("content-length"));
  if (Number.isFinite(size) && size > 100_000) return null;
  const body = await response.text();
  if (body.length > 100_000) return null;
  try {
    const value: unknown = JSON.parse(body);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

function postId(value: unknown): string | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? String(value) : typeof value === "string" && /^\d{1,20}$/u.test(value) ? value : null;
}

export const createDraft = internalAction({
  args: { operationId: v.id("wordpressDraftOperations") },
  handler: async (ctx, { operationId }) => {
    let context = await ctx.runQuery(internal.wordpressDrafts.draftContext, { operationId });
    if (!context || context.operation.status !== "pending") return;
    if (!context.safe) {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "failed", summary: context.approvalMessage ?? "The article, approval, or WordPress connection changed before the draft was sent. Review and confirm again." });
      return;
    }
    const secret = await ctx.runQuery(internal.connections.getSecret, { connectionId: context.connection._id });
    if (!secret || secret.provider !== "wordpress" || secret.orgId !== context.org._id) {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "failed", summary: "The WordPress connection is no longer available. Reconnect it and review the article again." });
      return;
    }
    let credentials: { siteUrl?: string; username?: string; applicationPassword?: string };
    try { credentials = JSON.parse(secret.value) as typeof credentials; } catch {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "failed", summary: "The stored WordPress connection could not be read. Reconnect it and try again." });
      return;
    }
    const siteUrl = typeof credentials.siteUrl === "string" ? normalizeWordPressSiteUrl(credentials.siteUrl) : null;
    const username = typeof credentials.username === "string" ? credentials.username.trim() : "";
    const password = typeof credentials.applicationPassword === "string" ? credentials.applicationPassword : "";
    if (!siteUrl || !username || !password || context.connection.externalAccountId !== siteUrl) {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "failed", summary: "The WordPress connection details are incomplete. Reconnect the site before creating a draft." });
      return;
    }
    let addresses: string[];
    try { addresses = (await lookup(new URL(siteUrl).hostname, { all: true, verbatim: true })).map((entry) => entry.address); } catch {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "failed", summary: "The WordPress site could not be reached. Check the site address before trying again." });
      return;
    }
    const addressCheck = validateResolvedAddresses(addresses);
    if (!addressCheck.ok) {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "failed", summary: "The WordPress site resolved to a private or reserved network address. No credentials were sent." });
      return;
    }
    // Recheck tenant, exact approved version, connection and emergency stop immediately before the write.
    context = await ctx.runQuery(internal.wordpressDrafts.draftContext, { operationId });
    if (!context || context.operation.status !== "pending" || !context.safe) {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "failed", summary: context?.approvalMessage ?? "The article approval or connection changed before the WordPress request. No draft was sent." });
      return;
    }
    const root = new URL(siteUrl);
    const endpoint = new URL(`${root.pathname.replace(/\/+$/u, "")}/wp-json/wp/v2/posts`, root.origin);
    const headers = { Accept: "application/json", "Content-Type": "application/json", Authorization: authorization(username, password), "User-Agent": "ClimbOS/1.0 WordPress draft connector" };
    let created: Response;
    try {
      created = await wordpressPinnedFetch(endpoint.toString(), {
        method: "POST",
        redirect: "manual",
        headers,
        signal: AbortSignal.timeout(12_000),
        body: JSON.stringify({ title: context.artifact.title.slice(0, 200), content: wordpressArticleHtml(context.version.body), status: "draft" }),
      }, addresses);
    } catch {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "uncertain", summary: "WordPress did not confirm the request outcome. Check the site's Drafts before trying again." });
      return;
    }
    if (created.status >= 400 && created.status < 500) {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "failed", summary: "WordPress rejected the draft request. Check the connection and article, then confirm another attempt." });
      return;
    }
    if (created.status !== 201) {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "uncertain", summary: "WordPress returned an unexpected response. Check the site's Drafts before trying again." });
      return;
    }
    const createdData = await boundedJson(created);
    const externalPostId = postId(createdData?.id);
    if (!createdData || !externalPostId || createdData.status !== "draft") {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "uncertain", summary: "WordPress may have created the draft, but its ID or status could not be confirmed.", ...(externalPostId ? { externalPostId } : {}) });
      return;
    }
    const readbackUrl = new URL(`${root.pathname.replace(/\/+$/u, "")}/wp-json/wp/v2/posts/${externalPostId}`, root.origin);
    readbackUrl.searchParams.set("context", "edit");
    readbackUrl.searchParams.set("_fields", "id,status,title");
    try {
      const readback = await wordpressPinnedFetch(readbackUrl.toString(), { method: "GET", redirect: "manual", headers, signal: AbortSignal.timeout(8_000) }, addresses);
      const saved = readback.status === 200 ? await boundedJson(readback) : null;
      const savedTitle = saved?.title && typeof saved.title === "object" && !Array.isArray(saved.title)
        ? (saved.title as Record<string, unknown>).raw
        : typeof saved?.title === "string" ? saved.title : null;
      if (!saved || postId(saved.id) !== externalPostId || saved.status !== "draft" || savedTitle !== context.artifact.title.slice(0, 200)) {
        await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "uncertain", externalPostId, summary: "WordPress accepted the request, but read-back could not confirm the saved draft. Check WordPress before trying again." });
        return;
      }
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "verified", externalPostId, summary: "Created a private WordPress draft and confirmed its saved draft status." });
    } catch {
      await ctx.runMutation(internal.wordpressDrafts.finishDraft, { operationId, status: "uncertain", externalPostId, summary: "WordPress accepted the request, but read-back failed. Check WordPress before trying again." });
    }
  },
});
