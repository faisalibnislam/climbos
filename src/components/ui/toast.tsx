"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "info" | "success" | "danger";

export interface ToastItem {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  tone: ToastTone;
  /** ms before auto-dismiss; 0 keeps it until closed. */
  duration: number;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Dismiss a toast by id. */
export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

/**
 * Show a lightweight notification. Requires a single <Toaster /> mounted in the
 * layout. Keep toasts for confirmations; never put the only copy of important
 * information in a toast.
 */
export function toast(input: { title: ReactNode; description?: ReactNode; tone?: ToastTone; duration?: number }): number {
  const id = nextId++;
  const duration = input.duration ?? 6000;
  items = [...items.slice(-3), { id, title: input.title, description: input.description, tone: input.tone ?? "info", duration }];
  emit();
  if (duration > 0 && typeof window !== "undefined") window.setTimeout(() => dismissToast(id), duration);
  return id;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getSnapshot = () => items;
const empty: ToastItem[] = [];
const getServerSnapshot = () => empty;

const toneIcon = { info: Info, success: CircleCheck, danger: CircleAlert };
const toneCls = { info: "text-blue-800", success: "text-brand-800", danger: "text-red-800" };

/** Renders queued toasts in a polite live region (bottom of the screen). Mount once. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {list.map((t) => {
        const Icon = toneIcon[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "danger" ? "alert" : "status"}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[12px] border border-line bg-surface p-4 shadow-lg animate-fade-up"
          >
            <Icon aria-hidden="true" className={cn("mt-0.5 size-5 shrink-0", toneCls[t.tone])} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-sm text-ink-2">{t.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="-m-2 grid size-11 shrink-0 place-items-center rounded-md text-ink-3 hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
