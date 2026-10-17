import { cn } from "@/lib/utils";

/**
 * ClimbOS mark: a rising mountain path under a small sun, on a blue-violet gradient tile.
 * Matches `public/icon.svg`. Decorative by default; pass `title` to expose it.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <defs>
        <linearGradient id="climbos-mark" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3d5afe" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#climbos-mark)" />
      <path d="M7 23l6.5-9 4 5 3-4L25 23z" fill="#ffffff" />
      <circle cx="22" cy="9.5" r="2.5" fill="#ffd166" />
    </svg>
  );
}

/** Mark + "ClimbOS" wordmark. The text is real text, so it is read by screen readers. */
export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="text-[1.25rem] font-extrabold tracking-tight text-ink">ClimbOS</span>
    </span>
  );
}
