import { ConvexHttpClient } from "convex/browser";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { isBot } from "../../../../shared/links";
import { ipHash } from "@/lib/server-ip";

/** Tracked short link: count the human click (once per person a day), then send them on (with UTM tags). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CLIMBOS_SERVER_SECRET;
  if (!convexUrl || !secret) return NextResponse.redirect(new URL("/", request.url));
  try {
    const url = await new ConvexHttpClient(convexUrl).mutation(api.links.click, { serverSecret: secret, code, human: !isBot(request.headers.get("user-agent") ?? ""), ipHash: ipHash(request, secret) });
    if (url) return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch {
    // Fall through to the home page.
  }
  return NextResponse.redirect(new URL("/", request.url));
}
