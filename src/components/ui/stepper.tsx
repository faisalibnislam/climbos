import type { ReactNode } from "react";
import { Circle, CircleCheck, CircleX } from "@/components/icons"
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export type StepStatus = "pending" | "running" | "done" | "failed";

export interface StepItem {
  key: string;
  label: ReactNode;
  status: StepStatus;
  /** Optional detail line under the label. */
  detail?: ReactNode;
  /** Optional nested phases shown under a running or finished step. */
  substeps?: { key: string; label: ReactNode; status: StepStatus; meta?: ReactNode }[];
}

const statusText: Record<StepStatus, string> = {
  pending: "Waiting",
  running: "In progress",
  done: "Done",
  failed: "Didn't finish",
};

/**
 * Live progress list. Each step shows an icon AND a status word
 * (Waiting / In progress / Done / Didn't finish) — never color alone.
 * Wrap in your own aria-live region if updates should be announced.
 */
export function StepList({ steps, className }: { steps: StepItem[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0" aria-current={s.status === "running" ? "step" : undefined}>
            {!last ? (
              <span
                aria-hidden="true"
                className={cn("absolute left-[11px] top-7 h-[calc(100%-1.75rem)] w-px", s.status === "done" ? "bg-brand-600" : "bg-line-strong")}
              />
            ) : null}
            <span aria-hidden="true" className="relative mt-0.5 grid size-6 shrink-0 place-items-center">
              {s.status === "done" ? (
                <CircleCheck className="size-6 fill-brand-800 text-white" />
              ) : s.status === "failed" ? (
                <CircleX className="size-6 fill-red-800 text-white" />
              ) : s.status === "running" ? (
                <span className="grid size-6 place-items-center rounded-full bg-brand-100 text-brand-800">
                  <Spinner className="text-base" />
                </span>
              ) : (
                <Circle className="size-6 text-line-strong" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "leading-snug",
                  s.status === "pending" ? "text-ink-3" : "text-ink",
                  s.status === "running" && "font-semibold",
                )}
              >
                {s.label}
              </span>
              <span
                className={cn(
                  "text-sm",
                  s.status === "failed" ? "font-medium text-red-800" : s.status === "done" ? "text-brand-800" : "text-ink-3",
                )}
              >
                {statusText[s.status]}
                {s.detail ? <> · {s.detail}</> : null}
              </span>
              {s.substeps?.length ? (
                <ol className="mt-2 flex flex-col gap-1.5" aria-label="Phases">
                  {s.substeps.map((x) => (
                    <li key={x.key} className="flex items-center gap-2 text-sm" aria-current={x.status === "running" ? "step" : undefined}>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          x.status === "done" ? "bg-brand-700" : x.status === "running" ? "animate-soft-pulse bg-sun" : x.status === "failed" ? "bg-red-800" : "bg-line-strong",
                        )}
                      />
                      <span className={cn(x.status === "pending" ? "text-ink-3" : "text-ink-2", x.status === "running" && "font-medium text-ink")}>{x.label}</span>
                      <span className="sr-only">{statusText[x.status]}</span>
                      {x.meta ? <span className="ml-auto tabular-nums text-xs text-ink-3">{x.meta}</span> : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Alias: some screens call this a Stepper. */
export const Stepper = StepList;
