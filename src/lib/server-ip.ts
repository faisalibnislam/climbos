import { createHash } from "node:crypto";

/** The visitor's IP from the proxy headers (Vercel sets x-forwarded-for). Server-only. */
export function clientIp(request: Request): string {
  const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Salted SHA-256 of the IP: the backend only ever sees this, for rate limits and click dedupe. */
export function ipHash(request: Request, secret: string): string {
  return createHash("sha256").update(`${clientIp(request)}:${secret}`).digest("hex");
}
