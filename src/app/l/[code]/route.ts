import { ConvexHttpClient } from "convex/browser";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { isBot } from "../../../../shared/links";

/** Tracked short link: count the human click, then send them on (with UTM tags). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return NextResponse.redirect(new URL("/", request.url));
  try {
    const url = await new ConvexHttpClient(convexUrl).mutation(api.links.click, { code, human: !isBot(request.headers.get("user-agent") ?? "") });
    if (url) return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch {
    // Fall through to the home page.
  }
  return NextResponse.redirect(new URL("/", request.url));
}
