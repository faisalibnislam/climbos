"use client";

import { Slider as RSlider } from "radix-ui";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sliders (Radix Slider: role="slider", ←/→ step, PageUp/PageDown ×10,
 * Home/End). Always show the value as text next to the label.
 */

interface BaseProps {
  /** Visible label. */
  label: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  /** Turn a value into display text, e.g. (n) => `$${n}`. */
  format?: (n: number) => string;
  /** Labelled ticks under the track. */
  marks?: { value: number; label: string }[];
  disabled?: boolean;
  /** Helper text under the label. */
  hint?: ReactNode;
  className?: string;
}

function Frame({ id, label, hint, valueText, children, marks, min, max, className }: { id: string; label: ReactNode; hint?: ReactNode; valueText: string; children: ReactNode; marks?: BaseProps["marks"]; min: number; max: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={id} className="text-ui font-medium text-ink">
          {label}
        </span>
        <output aria-hidden="true" className="text-ui font-semibold tabular-nums text-ink">
          {valueText}
        </output>
      </div>
      {hint ? <p className="-mt-1 text-xs text-ink-3">{hint}</p> : null}
      {children}
      {marks ? (
        <div aria-hidden="true" className="relative h-4 text-2xs text-ink-3">
          {marks.map((m) => (
            <span
              key={m.value}
              className={cn("absolute whitespace-nowrap tabular-nums", m.value <= min ? "" : m.value >= max ? "-translate-x-full" : "-translate-x-1/2")}
              style={{ left: `${Math.round(((m.value - min) / (max - min)) * 10000) / 100}%` }}
            >
              {m.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const rootCls = "relative flex h-5 w-full touch-none select-none items-center data-[disabled]:opacity-50";
const trackCls = "relative h-1 grow overflow-hidden rounded-full bg-surface-3";
const rangeCls = "absolute h-full rounded-full bg-ink";
const thumbCls =
  "block size-4 cursor-grab rounded-full border-2 border-ink bg-surface shadow-sm transition-[box-shadow] hover:shadow-[0_0_0_4px_var(--line-strong)] active:cursor-grabbing " +
  "focus-visible:rounded-full! focus-visible:outline-offset-2 data-[disabled]:cursor-not-allowed";

export interface SliderProps extends BaseProps {
  value: number;
  onValueChange: (v: number) => void;
  /** Fires once when the user lets go (good for saving). */
  onValueCommit?: (v: number) => void;
}

/** One value on a range: budget, frequency, confidence threshold. */
export function Slider({ label, value, onValueChange, onValueCommit, min = 0, max = 100, step = 1, format = String, marks, disabled, hint, className }: SliderProps) {
  const id = useId();
  return (
    <Frame id={id} label={label} hint={hint} valueText={format(value)} marks={marks} min={min} max={max} className={className}>
      <RSlider.Root
        className={rootCls}
        value={[value]}
        onValueChange={([v]) => onValueChange(v)}
        onValueCommit={([v]) => onValueCommit?.(v)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      >
        <RSlider.Track className={trackCls}>
          <RSlider.Range className={rangeCls} />
        </RSlider.Track>
        <RSlider.Thumb aria-labelledby={id} aria-valuetext={format(value)} className={thumbCls} />
      </RSlider.Root>
    </Frame>
  );
}

export interface RangeSliderProps extends BaseProps {
  value: [number, number];
  onValueChange: (v: [number, number]) => void;
  onValueCommit?: (v: [number, number]) => void;
  /** Smallest gap between the two thumbs, in steps (default 1). */
  minStepsBetween?: number;
  /** Names for the two thumbs (default "Minimum" / "Maximum"). */
  thumbLabels?: [string, string];
}

/** A low and high value: price band, company size, send window. Thumbs can't cross. */
export function RangeSlider({ label, value, onValueChange, onValueCommit, min = 0, max = 100, step = 1, minStepsBetween = 1, format = String, marks, disabled, hint, thumbLabels = ["Minimum", "Maximum"], className }: RangeSliderProps) {
  const id = useId();
  return (
    <Frame id={id} label={label} hint={hint} valueText={`${format(value[0])} – ${format(value[1])}`} marks={marks} min={min} max={max} className={className}>
      <RSlider.Root
        className={rootCls}
        value={value}
        onValueChange={(v) => onValueChange([v[0], v[1]])}
        onValueCommit={(v) => onValueCommit?.([v[0], v[1]])}
        min={min}
        max={max}
        step={step}
        minStepsBetweenThumbs={minStepsBetween}
        disabled={disabled}
      >
        <RSlider.Track className={trackCls}>
          <RSlider.Range className={rangeCls} />
        </RSlider.Track>
        {value.map((v, i) => (
          <RSlider.Thumb key={i} aria-label={thumbLabels[i]} aria-describedby={id} aria-valuetext={format(v)} className={thumbCls} />
        ))}
      </RSlider.Root>
    </Frame>
  );
}
