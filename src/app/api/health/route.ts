import { NextResponse } from "next/server";

/** Liveness + configuration presence (never values). */
export async function GET() {
  const checks = {
    convexUrl: Boolean(process.env.NEXT_PUBLIC_CONVEX_URL),
    serverSecret: Boolean(process.env.CLIMBOS_SERVER_SECRET),
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  };
  const ok = Object.values(checks).every(Boolean);
  return NextResponse.json({ ok, service: "climbos-web", checks, at: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
