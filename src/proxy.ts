import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

/**
 * Optimistic route protection only. Every Convex function independently
 * verifies identity and tenant membership; this just avoids rendering
 * protected shells for signed-out visitors.
 */
const isProtected = createRouteMatcher(["/app(.*)", "/onboarding(.*)", "/ops(.*)"]);
const isSignIn = createRouteMatcher(["/sign-in"]);

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
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
