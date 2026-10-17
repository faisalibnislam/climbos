import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Keyboard key hint, e.g. <Kbd>Esc</Kbd>. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-6 items-center justify-center rounded-[6px] border border-line-strong border-b-2 bg-surface px-1.5 font-mono text-xs text-ink-2",
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

const avatarSizes = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" };

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
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-green-100 font-semibold text-green-900",
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
