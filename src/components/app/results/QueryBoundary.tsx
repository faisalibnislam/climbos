"use client";

import { Component, type ReactNode } from "react";
import { CircleAlert, Clock, CreditCard, Lock, PlugZap, SearchX, WifiOff } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { errorInfo, type AppErrorInfo } from "../errors";

/**
 * Shared page states for Results, Connections, Settings and Ops.
 * Convex `useQuery` throws on server errors, so every screen is wrapped in a
 * QueryBoundary that turns the error code into a calm, specific message.
 */

const STATE_COPY: Record<AppErrorInfo["code"], { title: string; icon: ReactNode; body?: string }> = {
  UNAUTHENTICATED: { title: "Please sign in again", icon: <Lock />, body: "Your session ended. Sign in to keep going." },
  FORBIDDEN: { title: "You don't have access to this", icon: <Lock /> },
  NOT_FOUND: { title: "We couldn't find that", icon: <SearchX /> },
  INVALID: { title: "Something doesn't look right", icon: <CircleAlert /> },
  LIMIT_REACHED: { title: "You've reached a plan limit", icon: <CircleAlert /> },
  PAYMENT_REQUIRED: { title: "This needs an active plan", icon: <CreditCard /> },
  PAUSED: { title: "Activity is paused", icon: <PlugZap /> },
  RATE_LIMITED: { title: "Too many requests right now", icon: <Clock />, body: "Please wait a minute and try again." },
  UNAVAILABLE: { title: "This isn't available right now", icon: <WifiOff /> },
  UNKNOWN: { title: "Something went wrong", icon: <CircleAlert /> },
};

export function ErrorState({
  error,
  onRetry,
  headingLevel = "h2",
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
}) {
  const info = errorInfo(error);
  const copy = STATE_COPY[info.code] ?? STATE_COPY.UNKNOWN;
  const H = headingLevel;
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-line bg-surface px-6 py-10 text-center", className)}>
      <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-surface-2 text-ink-2 [&_svg]:size-6">
        {copy.icon}
      </span>
      <H className="text-lg font-semibold text-ink">{copy.title}</H>
      <p className="max-w-md leading-relaxed text-ink-2">{info.message || copy.body}</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {info.code === "UNAUTHENTICATED" ? (
          <Button asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        ) : null}
        {onRetry && info.code !== "FORBIDDEN" && info.code !== "NOT_FOUND" && info.code !== "UNAUTHENTICATED" ? (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
        {info.code === "FORBIDDEN" || info.code === "NOT_FOUND" ? (
          <Button variant="secondary" asChild>
            <Link href="/app">Go to your workspace</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

interface BoundaryState {
  error: unknown;
  key: number;
}

/** Catches errors thrown by Convex queries below it and shows a specific state with a retry. */
export class QueryBoundary extends Component<{ children: ReactNode; headingLevel?: "h1" | "h2" | "h3" }, BoundaryState> {
  state: BoundaryState = { error: null, key: 0 };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error };
  }

  reset = () => this.setState((s) => ({ error: null, key: s.key + 1 }));

  render() {
    if (this.state.error) {
      return <ErrorState error={this.state.error} onRetry={this.reset} headingLevel={this.props.headingLevel ?? "h1"} />;
    }
    return <div key={this.state.key}>{this.props.children}</div>;
  }
}

/** Accessible loading placeholder for a whole page section. */
export function LoadingBlock({ label, lines = 3, className }: { label: string; lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p role="status" className="sr-only">
        {label}
      </p>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-24 rounded-[var(--radius-lg)]", i === 0 && "h-10 w-1/2")} />
      ))}
    </div>
  );
}

/** Page title block: one h1 per page, optional intro and right-side actions. */
export function PageHeader({
  title,
  intro,
  actions,
  eyebrow,
  section,
}: {
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  /** App section whose icon tile is shown next to the title. */
  section?: string;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0" data-section={section}>
        {eyebrow ? <div className="mb-1 text-[13px] text-ink-3">{eyebrow}</div> : null}
        <h1 className="text-[28px] leading-9 text-ink">{title}</h1>
        {intro ? <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-ink-3">{intro}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** A "no data yet" panel with a next step. */
export function MissingData({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return <EmptyState title={title} body={body} action={action} headingLevel="h3" icon={<PlugZap />} />;
}
