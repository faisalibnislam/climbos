import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Loading placeholder with a gentle shimmer (static under reduced motion). Decorative. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn("skeleton h-4 w-full", className)} {...props} />;
}

export interface EmptyStateProps {
  /** Decorative icon element, e.g. <Inbox />. */
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  /** Primary next step, usually a Button. */
  action?: ReactNode;
  /** Heading level to keep outline order. Default h3. */
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
}

/** Friendly "nothing here yet" panel that always offers a next step. */
export function EmptyState({ icon, title, body, action, headingLevel: H = "h3", className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="mb-1 grid size-10 place-items-center rounded-lg bg-surface-2 text-ink-2 ring-1 ring-line [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <H className="heading-section">{title}</H>
      {body ? <p className="max-w-md text-sm text-ink-3">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export type CalloutTone = "info" | "success" | "warning" | "danger";

const calloutStyles: Record<CalloutTone, { cls: string; Icon: LucideIcon; label: string }> = {
  info: { cls: "border-brand-200/70 bg-brand-50 text-brand-900 [&_.callout-icon]:bg-brand-100 [&_.callout-icon]:text-brand-800", Icon: Info, label: "Note" },
  success: { cls: "border-green-500/25 bg-green-100/60 text-green-800 [&_.callout-icon]:bg-green-100 [&_.callout-icon]:text-green-800", Icon: CircleCheck, label: "Success" },
  warning: { cls: "border-amber-500/30 bg-amber-100/60 text-amber-800 [&_.callout-icon]:bg-amber-100 [&_.callout-icon]:text-amber-800", Icon: TriangleAlert, label: "Warning" },
  danger: { cls: "border-red-500/25 bg-red-100/60 text-red-800 [&_.callout-icon]:bg-red-100 [&_.callout-icon]:text-red-800", Icon: CircleAlert, label: "Problem" },
};

export interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: CalloutTone;
  title?: ReactNode;
  /**
   * "status" (polite) for updates, "alert" (assertive) for urgent errors,
   * "none" for static content that was present on page load. Default: alert for danger, none otherwise.
   */
  live?: "status" | "alert" | "none";
  action?: ReactNode;
}

/** Inline message box (info / success / warning / danger) with icon + text, never color alone. */
export function Callout({ tone = "info", title, live, action, className, children, ...props }: CalloutProps) {
  const { cls, Icon, label } = calloutStyles[tone];
  const resolved = live ?? (tone === "danger" ? "alert" : "none");
  const role = resolved === "none" ? undefined : resolved;
  return (
    <div role={role} className={cn("flex gap-2.5 rounded-xl border px-3.5 py-3", cls, className)} {...props}>
      <span aria-hidden="true" className="callout-icon mt-px grid size-6 shrink-0 place-items-center rounded-md">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <span className="sr-only">{label}: </span>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "text-ink-2 [&_a]:font-medium [&_a]:text-current [&_a]:underline")}>{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

/** Alias of Callout for teams that prefer the "Alert" name. */
export const Alert = Callout;

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  /** Source / freshness / context, e.g. "From Google Analytics · updated 2h ago". */
  sublabel?: ReactNode;
  /** Optional change indicator; include words like "up" / "down", not just arrows. */
  change?: ReactNode;
  className?: string;
}

/** Single number with label and provenance. */
export function Stat({ label, value, sublabel, change, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface p-4", className)}>
      <dt className="text-ui font-medium text-ink-3">{label}</dt>
      <dd className="metric">{value}</dd>
      {change ? <dd className="text-ui font-medium text-ink-2">{change}</dd> : null}
      {sublabel ? <dd className="text-xs text-ink-3">{sublabel}</dd> : null}
    </div>
  );
}

/** Wrap one or more <Stat> in a definition list for correct semantics. */
export function StatGroup({ className, ...props }: HTMLAttributes<HTMLDListElement>) {
  return <dl className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)} {...props} />;
}
