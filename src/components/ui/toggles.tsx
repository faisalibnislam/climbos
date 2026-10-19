"use client";

import { Checkbox as RCheckbox, Switch as RSwitch } from "radix-ui";
import { Check, Minus } from "@/components/icons"
import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<ComponentProps<typeof RCheckbox.Root>, "children"> {
  /** Visible label. Required for accessibility unless you pass aria-label. */
  label?: ReactNode;
  /** Secondary text under the label (linked via aria-describedby). */
  description?: ReactNode;
}

/** Checkbox with a 44px tap area and built-in label. Supports "indeterminate". */
export function Checkbox({ label, description, id, className, ...props }: CheckboxProps) {
  const auto = useId();
  const cid = id ?? `cb-${auto}`;
  const descId = description ? `${cid}-desc` : undefined;
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className="flex min-h-9 items-center">
        <RCheckbox.Root
          id={cid}
          aria-describedby={descId}
          className="peer grid size-4 place-items-center rounded-[4px] border-[1.5px] border-control bg-surface text-white transition-colors hover:border-brand-700 data-[state=checked]:border-brand-800 data-[state=checked]:bg-brand-800 data-[state=indeterminate]:border-brand-800 data-[state=indeterminate]:bg-brand-800 disabled:opacity-50"
          {...props}
        >
          <RCheckbox.Indicator className="inline-flex">
            {props.checked === "indeterminate" ? (
              <Minus aria-hidden="true" className="size-3" strokeWidth={3} />
            ) : (
              <Check aria-hidden="true" className="size-3" strokeWidth={3} />
            )}
          </RCheckbox.Indicator>
        </RCheckbox.Root>
      </span>
      {label ? (
        <span className="flex min-h-9 flex-col justify-center py-2">
          <label htmlFor={cid} className="cursor-pointer text-ui font-medium text-ink">
            {label}
          </label>
          {description ? (
            <span id={descId} className="mt-0.5 text-ui text-ink-3">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

export interface SwitchProps extends Omit<ComponentProps<typeof RSwitch.Root>, "children"> {
  label: ReactNode;
  description?: ReactNode;
  /** Show the current state as text ("On"/"Off") so it isn't conveyed by position/color alone. */
  showStateText?: boolean;
}

/** On/off toggle for settings that apply immediately. Includes visible state text. */
export function Switch({ label, description, id, className, showStateText = true, ...props }: SwitchProps) {
  const auto = useId();
  const sid = id ?? `sw-${auto}`;
  const descId = description ? `${sid}-desc` : undefined;
  const on = props.checked ?? undefined;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <span className="flex min-h-9 flex-col justify-center">
        <label htmlFor={sid} className="cursor-pointer text-ui font-medium text-ink">
          {label}
        </label>
        {description ? (
          <span id={descId} className="mt-0.5 text-ui text-ink-3">
            {description}
          </span>
        ) : null}
      </span>
      <span className="flex min-h-9 items-center gap-2">
        {showStateText && on !== undefined ? (
          <span aria-hidden="true" className="w-7 text-ui font-medium text-ink-2">
            {on ? "On" : "Off"}
          </span>
        ) : null}
        <RSwitch.Root
          id={sid}
          aria-describedby={descId}
          className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-control bg-surface-3 transition-colors data-[state=checked]:border-brand-800 data-[state=checked]:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          {...props}
        >
          <RSwitch.Thumb className="block size-4 translate-x-[1px] rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[17px]" />
        </RSwitch.Root>
      </span>
    </div>
  );
}
