import { httpRouter } from "convex/server";
import { verifyStandardWebhook, WebhookVerificationError, webhookKeyCandidates } from "../shared/billing";
import { sha256Hex } from "../shared/policy";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { handle as mcpHandle } from "./mcp";

const http = httpRouter();

auth.addHttpRoutes(http);

const MAX_BODY = 1_000_000;

/** ClimbOS MCP server for external agents (also served at climbos.app/api/mcp via a rewrite). */
for (const method of ["POST", "GET", "DELETE"] as const) http.route({ path: "/mcp", method, handler: mcpHandle });

/**
 * Polar webhooks: verify the Standard Webhooks signature on the raw body,
 * store once by webhook id (replays are acknowledged and ignored), then
 * process asynchronously. Responds fast so Polar doesn't retry needlessly.
 */
http.route({
  path: "/webhooks/polar",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.POLAR_WEBHOOK_SECRET;
    if (!secret) return new Response("Billing not configured", { status: 503 });
    const body = await req.text();
    if (body.length > MAX_BODY) return new Response("Payload too large", { status: 413 });
    const id = req.headers.get("webhook-id");
    try {
      await verifyStandardWebhook({
        keys: webhookKeyCandidates(secret),
        id,
        timestamp: req.headers.get("webhook-timestamp"),
        signatureHeader: req.headers.get("webhook-signature"),
        body,
      });
    } catch (e) {
      const status = e instanceof WebhookVerificationError ? 403 : 400;
      return new Response("Invalid signature", { status });
    }
    let type = "unknown";
    try {
      type = (JSON.parse(body) as { type?: string }).type ?? "unknown";
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    const stored = await ctx.runMutation(internal.billing.storeWebhookEvent, { source: "polar", eventId: id!, type, payload: body });
    if (!stored.duplicate) await ctx.scheduler.runAfter(0, internal.billing.processPolarEvent, { webhookId: stored.id });
    return new Response(null, { status: 202 });
  }),
});

/** Resend (Svix-signed) delivery webhooks for ClimbOS platform mail. */
http.route({
  path: "/webhooks/resend",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return new Response("Not configured", { status: 503 });
    const body = await req.text();
    if (body.length > MAX_BODY) return new Response("Payload too large", { status: 413 });
    const id = req.headers.get("svix-id");
    try {
      await verifyStandardWebhook({
        keys: webhookKeyCandidates(secret),
        id,
        timestamp: req.headers.get("svix-timestamp"),
        signatureHeader: req.headers.get("svix-signature"),
        body,
      });
    } catch {
      return new Response("Invalid signature", { status: 403 });
    }
    const event = JSON.parse(body) as { type: string; data?: { email_id?: string; to?: string[] } };
    const stored = await ctx.runMutation(internal.billing.storeWebhookEvent, { source: "resend", eventId: id!, type: event.type, payload: "{}" });
    if (stored.duplicate) return new Response(null, { status: 200 });
    const toHashes = await Promise.all((event.data?.to ?? []).slice(0, 50).map((t) => sha256Hex(t.trim().toLowerCase())));
    await ctx.runMutation(internal.notifications.applyResendEvent, { type: event.type, resendId: event.data?.email_id, toHashes });
    await ctx.runMutation(internal.billing.markWebhook, { id: stored.id, status: "processed" });
    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => new Response(JSON.stringify({ ok: true, service: "climbos-convex", at: new Date().toISOString() }), { headers: { "Content-Type": "application/json" } })),
});

/** One-click unsubscribe (RFC 8058) for outbound emails; mail apps POST here from the List-Unsubscribe header. */
http.route({
  path: "/unsubscribe",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    try {
      await ctx.runMutation(api.outboundSending.unsubscribe, { token });
      return new Response("Unsubscribed", { status: 200 });
    } catch {
      return new Response("Invalid link", { status: 400 });
    }
  }),
});

/** A person opening the one-click link in a browser: show the unsubscribe page (GET never unsubscribes; link scanners open URLs). */
http.route({
  path: "/unsubscribe",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const token = new URL(req.url).searchParams.get("token") ?? "";
    const site = process.env.SITE_URL ?? "https://climbos.app";
    return new Response(null, { status: 302, headers: { Location: `${site}/u/${encodeURIComponent(token)}`, "Cache-Control": "no-store" } });
  }),
});

/** The service worker pulls its notification text here (the endpoint identifies the device). */
http.route({
  path: "/push/pull",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", "Cache-Control": "no-store" };
    try {
      const { endpoint } = (await req.json()) as { endpoint?: string };
      if (!endpoint || endpoint.length > 1000) return new Response(JSON.stringify({ items: [] }), { headers: cors });
      const items = await ctx.runMutation(internal.push.pull, { endpoint });
      return new Response(JSON.stringify({ items }), { headers: cors });
    } catch {
      return new Response(JSON.stringify({ items: [] }), { status: 400, headers: cors });
    }
  }),
});
http.route({
  path: "/push/pull",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" } })),
});

export default http;
