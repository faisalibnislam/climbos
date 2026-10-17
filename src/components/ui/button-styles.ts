import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors select-none " +
  "disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 " +
  "[&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-green-800 text-white shadow-sm hover:bg-green-900 active:bg-green-950",
  secondary: "border border-line-strong bg-surface text-ink shadow-sm hover:bg-surface-2 active:bg-surface-3",
  ghost: "text-ink hover:bg-surface-2 active:bg-surface-3",
  danger: "bg-red-800 text-white shadow-sm hover:bg-[#82190f] active:bg-[#6c140c]",
  link: "text-green-800 underline underline-offset-4 decoration-green-800/40 hover:decoration-green-800 px-0! h-auto! min-h-0",
};

/** Heights keep a 44px minimum touch target for md/lg; sm is for dense desktop UI. */
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 rounded-[10px] px-3 text-sm [&_svg]:size-4",
  md: "h-11 rounded-[12px] px-4.5 text-[0.95rem] [&_svg]:size-[18px]",
  lg: "h-13 rounded-[14px] px-6 text-base [&_svg]:size-5",
};

/** Shared class builder so links and other elements can look like buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}
