import { ConvexHttpClient } from "convex/browser";
import { NextResponse, type NextRequest } from "next/server";
import { api } from "@convex/_generated/api";

/**
 * OAuth redirect target for Google, Meta and Instagram. The code and state are
 * handed to Convex with a server-only secret; state is single-use and bound to
 * the workspace and user who started the flow. Tokens never reach the browser.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? url.origin;
  if (providerError || !code || !state) {
    return NextResponse.redirect(new URL(`/app?connection=canceled`, site));
  }
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const secret = process.env.CLIMBOS_SERVER_SECRET;
  if (!convexUrl || !secret) return NextResponse.redirect(new URL(`/app?connection=unavailable`, site));
  try {
    const client = new ConvexHttpClient(convexUrl);
    const res = await client.action(api.connectionActions.completeOAuth, { serverSecret: secret, state, code });
    const dest = res.slug ? `/app/${res.slug}/connections?${res.ok ? `connected=${res.provider}` : "connection=failed"}` : "/app?connection=expired";
    return NextResponse.redirect(new URL(dest, site));
  } catch {
    return NextResponse.redirect(new URL(`/app?connection=failed`, site));
  }
}
