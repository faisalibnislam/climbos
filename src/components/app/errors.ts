import { ConvexError } from "convex/values";

export type AppErrorInfo = {
  code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "LIMIT_REACHED" | "PAYMENT_REQUIRED" | "PAUSED" | "RATE_LIMITED" | "UNAVAILABLE" | "UNKNOWN";
  message: string;
};

/** Turn any thrown error into a plain-language message with a stable code. */
export function errorInfo(err: unknown): AppErrorInfo {
  if (err instanceof ConvexError) {
    const data = err.data as { code?: AppErrorInfo["code"]; message?: string } | string;
    if (typeof data === "string") return { code: "UNKNOWN", message: data };
    return { code: data.code ?? "UNKNOWN", message: data.message ?? "Something went wrong." };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/Unauthenticated|Please sign in/i.test(msg)) return { code: "UNAUTHENTICATED", message: "Please sign in to continue." };
  if (/Failed to fetch|network/i.test(msg)) return { code: "UNAVAILABLE", message: "We couldn't reach ClimbOS. Check your connection and try again." };
  return { code: "UNKNOWN", message: "Something went wrong. Please try again." };
}

export function errorMessage(err: unknown): string {
  return errorInfo(err).message;
}
