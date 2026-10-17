import type { HTMLAttributes, ReactNode } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  Clock,
  FlaskConical,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet" | "brand" | "teal" | "pink" | "orange";

export const toneClasses: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  green: "bg-green-100 text-green-800 border-[#abefc6]",
  amber: "bg-amber-100 text-amber-800 border-[#fedf89]",
  red: "bg-red-100 text-red-800 border-[#fecdca]",
  blue: "bg-blue-100 text-blue-800 border-[#b2ddff]",
  violet: "bg-violet-100 text-violet-800 border-[#d9d6fe]",
  brand: "bg-brand-100 text-brand-900 border-brand-200",
  teal: "bg-teal-100 text-teal-800 border-[#a5f0fc]",
  pink: "bg-pink-100 text-pink-800 border-[#fcceee]",
  orange: "bg-orange-100 text-orange-800 border-[#f9dbaf]",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Optional leading icon (decorative). The badge text must carry the meaning. */
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Compact label. Color is supportive only — the text always states the meaning
 * (e.g. "Needs approval", not just an amber dot).
 */
export function Badge({ tone = "neutral", icon, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-full items-center gap-1 rounded-full border-0 px-2 text-xs font-medium leading-5",
        "[&_svg]:size-3 [&_svg]:shrink-0",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export type StatusKind = "ready" | "needs_approval" | "provider_review" | "uncertain" | "demo" | "failed" | "draft";

const statusMap: Record<StatusKind, { tone: Tone; label: string; Icon: LucideIcon }> = {
  ready: { tone: "green", label: "Ready", Icon: CircleCheck },
  needs_approval: { tone: "amber", label: "Needs approval", Icon: Hourglass },
  provider_review: { tone: "blue", label: "Provider review pending", Icon: Clock },
  uncertain: { tone: "neutral", label: "Outcome uncertain", Icon: CircleQuestionMark },
  demo: { tone: "violet", label: "Demo data", Icon: FlaskConical },
  failed: { tone: "red", label: "Failed", Icon: CircleAlert },
  draft: { tone: "neutral", label: "Draft", Icon: Clock },
};

export interface StatusPillProps extends Omit<BadgeProps, "tone" | "icon" | "children"> {
  status: StatusKind;
  /** Override the default label text (keep it explicit). */
  children?: ReactNode;
}

/** Standard status indicator with a fixed icon + tone + text per state. */
export function StatusPill({ status, children, ...props }: StatusPillProps) {
  const { tone, label, Icon } = statusMap[status];
  return (
    <Badge tone={tone} icon={<Icon />} {...props}>
      {children ?? label}
    </Badge>
  );
}
