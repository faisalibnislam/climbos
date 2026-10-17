import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import type { api } from "@convex/_generated/api";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import { errorInfo } from "../errors";

export type Dashboard = FunctionReturnType<typeof api.ops.dashboard>;

/** Operators get the raw server message (ops mutations throw plain Errors with useful text). */
export function opsError(err: unknown): string {
  if (err instanceof ConvexError) return errorInfo(err).message;
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/Uncaught Error: (.*?)(\n|$)/);
  return m ? m[1] : msg || "Something went wrong.";
}

export function OpsSection({ id, title, count, children }: { id: string; title: string; count?: number; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 flex flex-col gap-3 rounded-[var(--radius-lg)] border border-line bg-surface p-4 sm:p-5">
      <h2 id={`${id}-h`} className="flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
        {title}
        {count !== undefined ? <Badge tone={count > 0 ? "amber" : "neutral"}>{count > 0 ? `${count} open` : "None open"}</Badge> : null}
      </h2>
      {children}
    </section>
  );
}

