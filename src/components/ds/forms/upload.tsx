"use client";

import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { CircleAlert, CircleCheck, FileText, Image as ImageIcon, Upload, X } from "@/components/icons";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface UploadItem {
  id: string;
  file: File;
  /** 0–100 while uploading. */
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

export interface DropZoneProps {
  /** Same syntax as <input accept>, e.g. ".csv,image/*". */
  accept?: string;
  /** Largest file in MB. */
  maxSizeMb?: number;
  multiple?: boolean;
  /** Upload one file; call onProgress(0–100). Reject to show an error on that row. */
  onUpload?: (file: File, onProgress: (pct: number) => void) => Promise<void>;
  /** Called with the accepted files (with or without onUpload). */
  onFiles?: (files: File[]) => void;
  title?: ReactNode;
  /** e.g. "CSV or XLSX, up to 10 MB". */
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 102.4) / 10} KB`;
  return `${Math.round(n / (1024 * 102.4)) / 10} MB`;
}

function acceptsFile(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept.split(",").some((raw) => {
    const a = raw.trim().toLowerCase();
    if (a.startsWith(".")) return name.endsWith(a);
    if (a.endsWith("/*")) return file.type.startsWith(a.slice(0, -1));
    return file.type === a;
  });
}

/**
 * Drag-and-drop upload area with a real "Choose files" button (keyboard and
 * screen-reader path), type and size checks, and a per-file progress list.
 */
export function DropZone({ accept, maxSizeMb, multiple = true, onUpload, onFiles, title = "Drop files here", hint, disabled, className }: DropZoneProps) {
  const inputId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const seq = useRef(0);
  const alive = useRef(true);
  const [over, setOver] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const patch = (id: string, p: Partial<UploadItem>) => alive.current && setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const take = (list: FileList | null) => {
    if (!list || disabled) return;
    const files = [...list].slice(0, multiple ? undefined : 1);
    const ok: File[] = [];
    const bad: string[] = [];
    for (const f of files) {
      if (!acceptsFile(f, accept)) bad.push(`${f.name}: this file type isn't supported`);
      else if (maxSizeMb && f.size > maxSizeMb * 1024 * 1024) bad.push(`${f.name}: larger than ${maxSizeMb} MB`);
      else ok.push(f);
    }
    setRejected(bad);
    if (!ok.length) return;
    onFiles?.(ok);
    const added = ok.map((file) => ({ id: `u${++seq.current}`, file, progress: onUpload ? 0 : 100, status: onUpload ? "uploading" : "done" }) as UploadItem);
    setItems((prev) => (multiple ? [...prev, ...added] : added));
    if (onUpload) {
      for (const it of added) {
        onUpload(it.file, (pct) => patch(it.id, { progress: Math.round(pct) }))
          .then(() => patch(it.id, { progress: 100, status: "done" }))
          .catch((e: unknown) => patch(it.id, { status: "error", error: e instanceof Error ? e.message : "Upload failed" }));
      }
    }
  };

  const drag = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      depth.current++;
      if (!disabled) setOver(true);
    },
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = disabled ? "none" : "copy";
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      take(e.dataTransfer.files);
    },
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        {...drag}
        className={cn(
          "flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed px-6 py-8 text-center transition-colors",
          over ? "border-ink bg-brand-50" : "border-line-strong bg-surface",
          disabled && "opacity-55",
        )}
      >
        <span aria-hidden="true" className={cn("grid size-10 place-items-center rounded-[var(--radius-card)] transition-colors", over ? "bg-ink text-white" : "bg-surface-2 text-ink-2")}>
          <Upload className="size-5" />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="text-ui font-medium text-ink">{over ? "Release to upload" : title}</p>
          {hint ? (
            <p id={hintId} className="text-xs text-ink-3">
              {hint}
            </p>
          ) : null}
        </div>
        <Button variant="secondary" size="sm" disabled={disabled} onClick={() => input.current?.click()} aria-describedby={hint ? hintId : undefined}>
          Choose {multiple ? "files" : "a file"}
        </Button>
        <input
          ref={input}
          id={inputId}
          type="file"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          onChange={(e) => {
            take(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {rejected.length ? (
        <ul role="alert" className="flex flex-col gap-1">
          {rejected.map((r) => (
            <li key={r} className="flex items-start gap-1.5 text-ui font-medium text-red-800">
              <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
              {r}
            </li>
          ))}
        </ul>
      ) : null}
      {items.length ? (
        <ul aria-label="Files" className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {items.map((it) => {
            const Icon = it.file.type.startsWith("image/") ? ImageIcon : FileText;
            return (
              <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                <Icon aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-ui font-medium text-ink">{it.file.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-3">
                      {it.status === "uploading" ? `${it.progress}%` : formatBytes(it.file.size)}
                    </span>
                  </div>
                  {it.status === "uploading" ? (
                    <div role="progressbar" aria-label={`Uploading ${it.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={it.progress} className="h-1 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${it.progress}%` }} />
                    </div>
                  ) : it.status === "error" ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-red-800">
                      <CircleAlert aria-hidden="true" className="size-3.5" /> {it.error}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-green-800">
                      <CircleCheck aria-hidden="true" className="size-3.5" /> Uploaded
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${it.file.name}`}
                  onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))}
                  className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
