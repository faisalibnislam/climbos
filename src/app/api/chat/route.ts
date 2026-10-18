import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import { ipHash } from "@/lib/server-ip";

/**
 * A website-chat visitor's message. Adds the server secret and a salted IP
 * hash so the backend can rate-limit per visitor, not per made-up id.
 */

const Body = z.object({
  key: z.string().min(4).max(64),
  visitorId: z.string().min(8).max(64),
  text: z.string().max(4000),
  page: z.string().max(300).optional(),
});

function reply(status: number, body: { ok: boolean; message?: string }) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CLIMBOS_SERVER_SECRET;
  if (!convexUrl || !secret) return reply(503, { ok: false, message: "Chat is offline." });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply(400, { ok: false, message: "Please reload the page." });
  try {
    await new ConvexHttpClient(convexUrl).mutation(api.chat.send, { serverSecret: secret, ipHash: ipHash(request, secret), ...parsed.data });
    return reply(200, { ok: true });
  } catch (e) {
    const data = e instanceof ConvexError ? (e.data as { code?: string; message?: string }) : null;
    if (data?.message) return reply(data.code === "RATE_LIMITED" ? 429 : 400, { ok: false, message: data.message });
    return reply(503, { ok: false, message: "We couldn't send that. Please try again." });
  }
}
