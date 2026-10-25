"use client";

import { useId, useRef, type FormEvent, type RefObject } from "react";
import { ArrowUp } from "@/components/icons";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/** Shared, deliberately simple request input. Suggestions only edit the draft. */
export function RequestComposer({
  label, value, onChange, onSubmit, placeholder, suggestions = [], helper,
  submitLabel = "Send request", busy = false, disabled = false, className, inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  suggestions?: readonly string[];
  helper?: string;
  submitLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const id = useId();
  const localRef = useRef<HTMLTextAreaElement>(null);
  const area = inputRef ?? localRef;
  const locked = disabled || busy;
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (value.trim() && !locked) onSubmit();
  };
  return (
    <div className={className}>
      <form onSubmit={submit} aria-busy={busy} className="rounded-[var(--radius-card)] border border-control bg-surface p-4 shadow-[var(--card-shadow)] focus-within:ring-2 focus-within:ring-brand-800 sm:p-5">
        <label htmlFor={id} className="text-ui font-medium text-ink">{label}</label>
        <textarea
          ref={area}
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onInput={(event) => {
            const input = event.currentTarget;
            input.style.height = "auto";
            input.style.height = `${Math.min(input.scrollHeight, 240)}px`;
          }}
          onKeyDown={(event) => {
            // Safari can report the IME confirmation key as keyCode 229 even
            // when isComposing is already false on the final keydown event.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 && window.matchMedia("(pointer: fine)").matches) {
              event.preventDefault();
              submit();
            }
          }}
          rows={3}
          maxLength={4000}
          disabled={locked}
          placeholder={placeholder}
          aria-describedby={helper ? `${id}-help` : undefined}
          className="mt-2 block min-h-24 w-full resize-y bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-3 disabled:cursor-wait"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          {helper ? <p id={`${id}-help`} className="max-w-md text-xs text-ink-3">{helper}</p> : <span />}
          <Button type="submit" disabled={locked || !value.trim()} loading={busy} className="shrink-0">
            {submitLabel}<ArrowUp aria-hidden />
          </Button>
        </div>
      </form>
      {suggestions.length > 0 ? (
        <div role="group" className="mt-3 flex flex-wrap gap-2" aria-label="Suggestions to help you start">
          {suggestions.slice(0, 4).map((suggestion) => (
            <button key={suggestion} type="button" disabled={locked} onClick={() => {
              onChange(value.trim() ? `${value.trimEnd()}\n${suggestion}` : suggestion);
              requestAnimationFrame(() => area.current?.focus());
            }} className={cn("min-h-10 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-left text-ui text-ink-2 hover:border-brand-800 hover:text-ink", locked && "cursor-not-allowed opacity-60")}>
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
