import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all select-none " +
  "disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 " +
  "[&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-800 text-white shadow-[0_1px_2px_rgb(16_24_64/0.1),0_4px_12px_rgb(47_71_224/0.25)] hover:bg-brand-900 active:bg-brand-950",
  secondary: "border border-line bg-surface text-ink shadow-sm hover:border-line-strong hover:bg-surface-2 active:bg-surface-3",
  ghost: "text-ink hover:bg-surface-2 active:bg-surface-3",
  danger: "bg-red-800 text-white shadow-sm hover:bg-[#82190f] active:bg-[#6c140c]",
  link: "text-brand-800 underline underline-offset-4 decoration-brand-800/40 hover:decoration-brand-800 px-0! h-auto! min-h-0",
};

/** Heights keep a 44px minimum touch target for md/lg; sm is for dense desktop UI. */
const sizes: Record<ButtonSize, string> = {
  sm: "h-9 rounded-full px-3.5 text-sm [&_svg]:size-4",
  md: "h-11 rounded-full px-5 text-[0.95rem] [&_svg]:size-[18px]",
  lg: "h-13 rounded-full px-7 text-base [&_svg]:size-5",
};

/** Shared class builder so links and other elements can look like buttons. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}
