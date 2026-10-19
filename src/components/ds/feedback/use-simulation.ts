"use client";

import { useCallback, useEffect, useState } from "react";

export type RunState = "idle" | "running" | "paused" | "done";

/**
 * Drives a fake long-running job for demos and previews: progress 0→1 over
 * `durationMs`, with start / pause / reset. Updates happen in an interval
 * callback (never synchronously in an effect).
 */
export function useSimulation(durationMs: number, tickMs = 200) {
  const [run, setRun] = useState<{ value: number; state: RunState }>({ value: 0, state: "idle" });

  useEffect(() => {
    if (run.state !== "running") return;
    const id = window.setInterval(() => {
      setRun((r) => {
        if (r.state !== "running") return r;
        const value = Math.min(1, r.value + tickMs / durationMs);
        return { value, state: value >= 1 ? "done" : "running" };
      });
    }, tickMs);
    return () => window.clearInterval(id);
  }, [run.state, durationMs, tickMs]);

  const start = useCallback(() => setRun((r) => ({ value: r.state === "done" ? 0 : r.value, state: "running" })), []);
  const pause = useCallback(() => setRun((r) => (r.state === "running" ? { ...r, state: "paused" } : r)), []);
  const reset = useCallback(() => setRun({ value: 0, state: "idle" }), []);

  const secondsLeft = run.state === "done" ? 0 : Math.ceil(((1 - run.value) * durationMs) / 1000);
  return { value: run.value, state: run.state, secondsLeft, start, pause, reset };
}

/** "About 1 min 20 s left" style text. */
export function formatTimeLeft(seconds: number | null | undefined): string {
  if (seconds == null) return "Estimating time…";
  if (seconds <= 0) return "Finishing up";
  if (seconds < 60) return `About ${Math.max(1, Math.round(seconds))} s left`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `About ${m} min ${s} s left` : `About ${m} min left`;
}

/** 1.2 MB / 820 KB style size text. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
