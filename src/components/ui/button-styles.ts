import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all select-none " +
  "disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 " +
  "[&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-800 text-white hover:bg-brand-900 active:bg-brand-950",
  secondary: "border border-line-strong bg-[#fdfdfd] text-ink hover:bg-surface-2 active:bg-surface-3",
  accent: "bg-sun text-ink hover:brightness-95 active:brightness-90",
  ghost: "text-ink hover:bg-surface-2 active:bg-surface-3",
  danger: "bg-red-800 text-white shadow-sm hover:bg-[#82190f] active:bg-[#6c140c]",
  link: "text-brand-800 underline underline-offset-4 decoration-brand-800/40 hover:decoration-brand-800 px-0! h-auto! min-h-0",
};

/** Compact SaaS sizes (32/36/40px), all above the WCAG 2.2 24px target minimum. */
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-lg px-2.5 text-[13px] [&_svg]:size-4",
  md: "h-9 rounded-lg px-3.5 text-[13px] [&_svg]:size-4",
  lg: "h-10 rounded-lg px-4 text-sm [&_svg]:size-[18px]",
};

/** Shared class builder so links and other elements can look like buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}
