"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldContextValue {
  id: string;
  hintId?: string;
  errorId?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Returns the props a control needs to be wired to its surrounding <Field>:
 * id, aria-describedby (hint + error), aria-invalid and required.
 * Use it inside custom controls; Input/Textarea/SelectTrigger call it for you.
 */
export function useFieldControl(own: { id?: string; "aria-describedby"?: string; required?: boolean } = {}) {
  const ctx = useContext(FieldContext);
  const describedBy = [own["aria-describedby"], ctx?.hintId, ctx?.errorId].filter(Boolean).join(" ") || undefined;
  return {
    id: own.id ?? ctx?.id,
    "aria-describedby": describedBy,
    "aria-invalid": ctx?.invalid ? (true as const) : undefined,
    required: own.required ?? ctx?.required ?? undefined,
  };
}

export const controlClasses =
  "w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink " +
  "placeholder:text-ink-3 transition-colors hover:border-[#aeb6c9] " +
  "focus-visible:border-brand-700 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-600 " +
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3 " +
  "aria-[invalid=true]:border-red-800";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Adds a visible "(optional)" marker. Prefer marking optional fields over required ones. */
  optional?: boolean;
}

/** Form label. Always pair visible labels with inputs (never rely on placeholder). */
export function Label({ className, optional, children, ...props }: LabelProps) {
  return (
    <label className={cn("text-[13px] font-medium text-ink", className)} {...props}>
      {children}
      {optional ? <span className="ml-1.5 font-normal text-ink-3">(optional)</span> : null}
    </label>
  );
}

export interface FieldProps {
  label: ReactNode;
  /** Helper text shown under the label and linked via aria-describedby. */
  hint?: ReactNode;
  /** Error text; marks the control aria-invalid and is announced. */
  error?: ReactNode;
  optional?: boolean;
  required?: boolean;
  /** Override the generated control id. */
  id?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Label + hint + error wrapper. Child controls (Input, Textarea, Select)
 * automatically receive id, aria-describedby and aria-invalid.
 */
export function Field({ label, hint, error, optional, required = false, id, className, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? `field-${autoId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return (
    <FieldContext.Provider value={{ id: controlId, hintId, errorId, invalid: Boolean(error), required }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <Label htmlFor={controlId} optional={optional}>
          {label}
        </Label>
        {hint ? (
          <p id={hintId} className="text-xs leading-relaxed text-ink-3">
            {hint}
          </p>
        ) : null}
        {children}
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium text-red-800">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/** Single-line text input (44px tall). Auto-wires to a surrounding <Field>. */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, id, required, "aria-describedby": describedBy, ...props },
  ref,
) {
  const wiring = useFieldControl({ id, required, "aria-describedby": describedBy });
  return <input ref={ref} className={cn(controlClasses, "h-9", className)} {...wiring} {...props} />;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Grow with content up to `maxRows` (default 12). */
  autosize?: boolean;
  maxRows?: number;
}

/** Multi-line text input with optional autosize. Auto-wires to a surrounding <Field>. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, id, required, autosize = false, maxRows = 12, rows = 3, onInput, "aria-describedby": describedBy, ...props },
  forwardedRef,
) {
  const wiring = useFieldControl({ id, required, "aria-describedby": describedBy });
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el || !autosize) return;
    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 24;
    const max = lineHeight * maxRows + 24;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [autosize, maxRows]);

  useLayoutEffect(() => {
    resize();
  }, [resize, props.value]);

  return (
    <textarea
      ref={(node) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      }}
      rows={rows}
      className={cn(controlClasses, "min-h-11 py-2.5 leading-relaxed", autosize && "resize-none", className)}
      onInput={(e) => {
        resize();
        onInput?.(e);
      }}
      {...wiring}
      {...props}
    />
  );
});
