import type { NextConfig } from "next";

/**
 * Cache Components is intentionally off: almost every ClimbOS route depends on
 * the signed-in session (Convex Auth reads its cookie in the root layout), and
 * data is reactive from Convex on the client. See docs/Architecture.md.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/**
 * OAuth sign-in (Google) runs on climbos.app instead of the raw Convex host:
 * CUSTOM_AUTH_SITE_URL on the Convex deployment points Convex Auth here, and
 * these rewrites proxy the two OAuth paths to the deployment's HTTP actions.
 * Google's redirect URI is then https://climbos.app/api/auth/callback/google.
 */
const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The capture worker (/api/render/*) drives a real browser; keep it out of the bundle.
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  async rewrites() {
    if (!convexSiteUrl) return [];
    return [
      { source: "/api/auth/signin/:path*", destination: `${convexSiteUrl}/api/auth/signin/:path*` },
      { source: "/api/auth/callback/:path*", destination: `${convexSiteUrl}/api/auth/callback/:path*` },
      // ClimbOS MCP server (stateless JSON-RPC), served from the Convex deployment.
      { source: "/api/mcp", destination: `${convexSiteUrl}/mcp` },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.convex.cloud" }],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
