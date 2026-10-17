"use client";

import { useId, useRef, useState, type ChangeEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFieldControl } from "./field";

export interface FileInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
  /** Button text, e.g. "Choose CSV". */
  buttonLabel?: ReactNode;
  /** Shown when nothing is chosen, e.g. "CSV up to 10 MB". */
  hint?: ReactNode;
}

/**
 * File picker that looks like the rest of the controls: a 36px secondary
 * button plus the chosen file name. The native input stays in the DOM (and
 * is the focus target), so keyboard and screen-reader use is unchanged.
 */
export function FileInput({ buttonLabel = "Choose file", hint, className, onChange, id, required, "aria-describedby": describedBy, ...props }: FileInputProps) {
  const wiring = useFieldControl({ id, required, "aria-describedby": describedBy });
  const auto = useId();
  const inputId = wiring.id ?? `file-${auto}`;
  const ref = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <label
        htmlFor={inputId}
        className="relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3.5 text-ui font-medium text-ink transition-colors hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600"
      >
        <Upload aria-hidden="true" className="size-4" />
        {buttonLabel}
        <input
          ref={ref}
          type="file"
          className="sr-only"
          {...wiring}
          id={inputId}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const files = e.target.files;
            setName(files && files.length ? (files.length === 1 ? files[0].name : `${files.length} files`) : null);
            onChange?.(e);
          }}
          {...props}
        />
      </label>
      <span className="min-w-0 truncate text-ui text-ink-3" aria-live="polite">
        {name ?? hint ?? "No file chosen"}
      </span>
    </div>
  );
}
