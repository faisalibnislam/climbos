import { createHash } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import { normalizeWebsite } from "@/components/marketing/website";

/**
 * Starts an anonymous landing-page preview. The visitor's IP is never sent to
 * the backend in clear text — only a salted SHA-256 hash used for rate limits.
 * Runs on the default Node.js runtime (Cache Components disallows `runtime`).
 */

const Body = z.object({
  website: z.string().trim().min(3).max(300),
  goal: z.string().trim().max(300).default(""),
});

type Failure = { ok: false; reason: "rate_limited" | "unavailable" | "invalid"; message: string };

function fail(status: number, reason: Failure["reason"], message: string) {
  return Response.json({ ok: false, reason, message } satisfies Failure, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: Request) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CLIMBOS_SERVER_SECRET;
  if (!convexUrl || !secret) {
    return fail(503, "unavailable", "Live previews aren't available right now. Try the demo instead.");
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail(400, "invalid", "Please enter your website and try again.");
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return fail(400, "invalid", "Please enter a website address (like formkit.app) and a short goal.");
  }
  const site = normalizeWebsite(parsed.data.website);
  if (!site.ok) return fail(400, "invalid", site.message);

  const ipHash = createHash("sha256").update(`${clientIp(request)}:${secret}`).digest("hex");

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(api.preview.startFromServer, {
      serverSecret: secret,
      ipHash,
      website: site.value,
      goal: parsed.data.goal,
    });
    if (result.ok) {
      return Response.json({ ok: true, token: result.token }, { headers: { "Cache-Control": "no-store" } });
    }
    return fail(result.reason === "rate_limited" ? 429 : 503, result.reason, result.message);
  } catch (error) {
    console.error("[api/preview] failed to start preview", error instanceof Error ? error.message : "unknown error");
    return fail(503, "unavailable", "Live previews aren't available right now. Try the demo instead.");
  }
}
