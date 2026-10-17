import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Keyboard key hint, e.g. <Kbd>Esc</Kbd>. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line-strong bg-surface px-1 font-sans text-2xs font-medium text-ink-3",
        className,
      )}
      {...props}
    />
  );
}

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  /** Decorative separators are hidden from assistive tech (default true). */
  decorative?: boolean;
}

/** Thin dividing line. */
export function Separator({ orientation = "horizontal", decorative = true, className, ...props }: SeparatorProps) {
  return (
    <div
      role={decorative ? "none" : "separator"}
      aria-orientation={decorative ? undefined : orientation}
      className={cn("shrink-0 bg-line", orientation === "horizontal" ? "h-px w-full" : "h-full w-px", className)}
      {...props}
    />
  );
}

/** Content available to screen readers only. */
export function VisuallyHidden({ children, as: Tag = "span" }: { children: ReactNode; as?: "span" | "div" | "h2" | "h3" }) {
  return <Tag className="sr-only">{children}</Tag>;
}

export interface AvatarProps {
  /** Person or brand name; used for alt text and initials. */
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const avatarSizes = { sm: "size-6 text-2xs", md: "size-8 text-xs", lg: "size-10 text-sm" };

/** Round avatar with image, falling back to initials. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-900",
        avatarSizes[size],
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatars may come from any provider domain
        <img src={src} alt={name} className="size-full object-cover" />
      ) : (
        <>
          <span aria-hidden="true">{initials}</span>
          <span className="sr-only">{name}</span>
        </>
      )}
    </span>
  );
}

/** "← Back to …" link at the top of detail pages (client-side navigation). */
export function BackLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex h-8 items-center gap-1 rounded-lg px-2 -ml-2 text-ui font-medium text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink", className)}>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3.5 5.5 8l4.5 4.5" />
      </svg>
      {children}
    </Link>
  );
}
