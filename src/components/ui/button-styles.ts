import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors select-none " +
  "disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 " +
  "[&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[var(--action)] text-[var(--action-ink)] hover:bg-[var(--action-hover)] active:bg-[var(--action-active)]",
  secondary: "border border-[var(--btn-2-border)] bg-[var(--btn-2-bg)] text-ink shadow-[var(--btn-2-shadow)] hover:bg-surface-2 active:bg-surface-3",
  accent: "bg-sun text-ink hover:brightness-95 active:brightness-90",
  ghost: "text-ink hover:bg-surface-2 active:bg-surface-3",
  danger: "bg-red-800 text-white hover:brightness-95 active:brightness-90",
  link: "text-brand-800 underline underline-offset-4 decoration-brand-800/40 hover:decoration-brand-800 px-0! h-auto! min-h-0",
};

/**
 * One control-height scale for buttons, inputs, selects and icon buttons:
 * sm 32px, md 36px, lg 40px (all above the WCAG 2.2 24px target minimum).
 * Labels are 13px medium (text-ui); lg uses 14px.
 */
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-[var(--radius-control)] px-2.5 text-ui [&_svg]:size-4",
  md: "h-9 rounded-[var(--radius-control)] px-3.5 text-ui [&_svg]:size-4",
  lg: "h-10 rounded-[var(--radius-control)] px-4 text-sm [&_svg]:size-[18px]",
};

/** Shared class builder so links and other elements can look like buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}
