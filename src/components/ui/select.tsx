"use client";

import { Select as RSelect } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { controlClasses, useFieldControl } from "./field";

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentProps<typeof RSelect.Root>, "children"> {
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  className?: string;
}

/**
 * Accessible single-choice dropdown (Radix Select). Inside a <Field> it is
 * labelled and described automatically; otherwise pass `aria-label`.
 */
export function Select({
  options,
  placeholder = "Choose…",
  id,
  className,
  "aria-label": ariaLabel,
  "aria-describedby": describedBy,
  required,
  ...rootProps
}: SelectProps) {
  const wiring = useFieldControl({ id, required, "aria-describedby": describedBy });
  return (
    <RSelect.Root required={wiring.required} {...rootProps}>
      <RSelect.Trigger
        id={wiring.id}
        aria-label={ariaLabel}
        aria-describedby={wiring["aria-describedby"]}
        aria-invalid={wiring["aria-invalid"]}
        className={cn(
          controlClasses,
          "flex h-11 items-center justify-between gap-2 text-left data-[placeholder]:text-ink-3",
          className,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown aria-hidden="true" className="size-4 text-ink-3" />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-[min(24rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[8px] border border-line bg-surface shadow-lg"
        >
          <RSelect.Viewport className="p-1.5">
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex min-h-11 cursor-pointer select-none items-center rounded-[8px] py-2 pl-9 pr-3 text-[0.95rem] text-ink outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-brand-50 data-[highlighted]:text-brand-900"
              >
                <RSelect.ItemIndicator className="absolute left-3 inline-flex">
                  <Check aria-hidden="true" className="size-4 text-brand-800" />
                </RSelect.ItemIndicator>
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
