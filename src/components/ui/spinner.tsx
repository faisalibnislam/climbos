import { cn } from "@/lib/utils";

export interface SpinnerProps {
  className?: string;
  /** Accessible label. When omitted the spinner is decorative (aria-hidden). */
  label?: string;
}

/**
 * Small circular activity indicator. Pair it with visible text where possible.
 * Under `prefers-reduced-motion` the global CSS stops the rotation.
 */
export function Spinner({ className, label }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex items-center", className)}
    >
      <svg viewBox="0 0 24 24" className="size-[1em] animate-spin" fill="none" focusable="false" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
