import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "@/components/icons";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Validation message                                                  */
/* ------------------------------------------------------------------ */

export type FieldMessageTone = "error" | "warning" | "success" | "info";

const MESSAGE = {
  error: { Icon: CircleAlert, cls: "text-red-800 font-medium", label: "Error" },
  warning: { Icon: TriangleAlert, cls: "text-amber-800", label: "Warning" },
  success: { Icon: CircleCheck, cls: "text-green-800", label: "Success" },
  info: { Icon: Info, cls: "text-ink-3", label: "Note" },
} as const;

export interface FieldMessageProps {
  tone?: FieldMessageTone;
  /** Link it to the control with aria-describedby. */
  id?: string;
  children: ReactNode;
  className?: string;
}

/** Message under a control. Icon + text, never colour alone. Errors are announced. */
export function FieldMessage({ tone = "error", id, children, className }: FieldMessageProps) {
  const { Icon, cls, label } = MESSAGE[tone];
  return (
    <p id={id} role={tone === "error" ? "alert" : undefined} className={cn("flex items-start gap-1.5 text-ui", cls, className)}>
      <Icon aria-hidden="true" className="mt-px size-4 shrink-0" />
      <span>
        <span className="sr-only">{label}: </span>
        {children}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Character counter                                                   */
/* ------------------------------------------------------------------ */

export interface CharacterCounterProps {
  value: string;
  max: number;
  id?: string;
  /** Start warning at this fraction of max (default 0.9). */
  warnAt?: number;
  className?: string;
}

/** "42 / 280". Turns amber near the limit and red over it; announced only near the limit. */
export function CharacterCounter({ value, max, id, warnAt = 0.9, className }: CharacterCounterProps) {
  const n = [...value].length;
  const over = n > max;
  const near = !over && n >= max * warnAt;
  return (
    <p id={id} className={cn("text-right text-xs tabular-nums", over ? "font-medium text-red-800" : near ? "text-amber-800" : "text-ink-3", className)}>
      <span aria-hidden="true">
        {n} / {max}
      </span>
      <span className="sr-only" aria-live={near || over ? "polite" : "off"}>
        {over ? `${n - max} characters over the limit` : `${max - n} characters left`}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Field description                                                   */
/* ------------------------------------------------------------------ */

/** Helper text for a custom control. Pass the same id to the control's aria-describedby. */
export function FieldDescription({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <p id={id} className={cn("text-xs leading-relaxed text-ink-3 [&_a]:font-medium [&_a]:text-brand-800 [&_a]:underline [&_a]:underline-offset-2", className)}>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Required indicator                                                  */
/* ------------------------------------------------------------------ */

/**
 * Asterisk for required fields, spoken as "required". ClimbOS prefers marking
 * the few optional fields instead; use this when most fields are optional.
 */
export function RequiredMark({ className }: { className?: string }) {
  return (
    <span className={cn("ml-0.5 text-red-800", className)}>
      <span aria-hidden="true">*</span>
      <span className="sr-only"> (required)</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Form sections                                                       */
/* ------------------------------------------------------------------ */

export interface FormSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** `side` puts the title in a left column from md up. */
  layout?: "stacked" | "side";
  className?: string;
}

/** A titled group of fields, separated from the next by a rule. */
export function FormSection({ title, description, children, layout = "side", className }: FormSectionProps) {
  return (
    <section className={cn("grid gap-4 border-t border-line pt-6 first:border-t-0 first:pt-0", layout === "side" && "md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-8", className)}>
      <div className="flex flex-col gap-1">
        <h3 className="heading-card">{title}</h3>
        {description ? <p className="text-xs leading-relaxed text-ink-3">{description}</p> : null}
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

/** Thin labelled rule between groups of fields ("or", "Advanced"). */
export function FormDivider({ children, className }: { children?: ReactNode; className?: string }) {
  if (!children) return <hr className={cn("border-line", className)} />;
  return (
    <div role="separator" aria-label={typeof children === "string" ? children : undefined} className={cn("flex items-center gap-3", className)}>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
      <span className="text-overline">{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}
