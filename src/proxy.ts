import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

/**
 * 1) Optimistic route protection only. Every Convex function independently
 *    verifies identity and tenant membership; this just avoids rendering
 *    protected shells for signed-out visitors.
 * 2) A per-request nonce Content-Security-Policy. Scripts must carry the nonce
 *    (Next.js applies it automatically); network access is limited to ClimbOS,
 *    Convex and the optional analytics host.
 */
const isProtected = createRouteMatcher(["/app(.*)", "/onboarding(.*)", "/ops(.*)", "/studio(.*)"]);
const isSignIn = createRouteMatcher(["/sign-in"]);

function contentSecurityPolicy(nonce: string, embeddable = false, anyImages = false): string {
  const isDev = process.env.NODE_ENV === "development";
  const convex = [process.env.NEXT_PUBLIC_CONVEX_URL, process.env.NEXT_PUBLIC_CONVEX_SITE_URL]
    .filter(Boolean)
    .map((u) => new URL(u!).origin);
  const convexWs = convex.filter((o) => o.endsWith(".convex.cloud")).map((o) => o.replace("https://", "wss://"));
  const posthog = process.env.NEXT_PUBLIC_POSTHOG_KEY
    ? [process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com", "https://us-assets.i.posthog.com", "https://eu-assets.i.posthog.com"]
    : [];
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by React components and charts.
    "style-src 'self' 'unsafe-inline'",
    // Client reports show the agency's own logo from wherever it's hosted.
    `img-src 'self' blob: data: https://*.convex.cloud https://*.r2.cloudflarestorage.com${anyImages ? " https:" : ""}`,
    "font-src 'self' data:",
    `connect-src 'self' ${[...convex, ...convexWs, ...posthog].join(" ")}${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // The website chat panel is embedded on owners' sites; everything else can't be framed.
    embeddable ? "frame-ancestors *" : "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export const proxy = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const authed = await convexAuth.isAuthenticated();
    if (isProtected(request) && !authed) {
      const next = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
      return nextjsMiddlewareRedirect(request, `/sign-in?next=${next}`);
    }
    if (isSignIn(request) && authed && !request.nextUrl.searchParams.has("switch")) {
      return nextjsMiddlewareRedirect(request, "/app");
    }
    if (request.nextUrl.pathname.startsWith("/api/")) return;

    const nonce = btoa(crypto.randomUUID());
    const csp = contentSecurityPolicy(nonce, request.nextUrl.pathname.startsWith("/widget/"), request.nextUrl.pathname.startsWith("/report/"));
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
