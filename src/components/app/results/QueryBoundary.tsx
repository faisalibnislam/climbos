"use client";

import { Component, type ReactNode } from "react";
import { CircleAlert, Clock, CreditCard, Lock, PlugZap, SearchX, WifiOff } from "@/components/icons"
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
  UNAUTHENTICATED: { title: "Sign in again", icon: <Lock />, body: "Your session ended." },
  FORBIDDEN: { title: "No access", icon: <Lock /> },
  NOT_FOUND: { title: "Not found", icon: <SearchX /> },
  INVALID: { title: "Something looks wrong", icon: <CircleAlert /> },
  LIMIT_REACHED: { title: "Plan limit reached", icon: <CircleAlert /> },
  PAYMENT_REQUIRED: { title: "Needs an active plan", icon: <CreditCard /> },
  PAUSED: { title: "Activity is paused", icon: <PlugZap /> },
  RATE_LIMITED: { title: "Too many requests", icon: <Clock />, body: "Wait a minute, then retry." },
  UNAVAILABLE: { title: "Unavailable right now", icon: <WifiOff /> },
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
    <div role="alert" className={cn("flex flex-col items-center gap-2 rounded-xl border border-line bg-surface px-6 py-10 text-center", className)}>
      <span aria-hidden="true" className="mb-1 grid size-10 place-items-center rounded-lg bg-surface-2 text-ink-2 ring-1 ring-line [&_svg]:size-5">
        {copy.icon}
      </span>
      <H className="heading-section">{copy.title}</H>
      <p className="max-w-md text-sm text-ink-3">{info.message || copy.body}</p>
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
            <Link href="/app">Go to workspace</Link>
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
        <Skeleton key={i} className={cn("h-24 rounded-xl", i === 0 && "h-10 w-1/2")} />
      ))}
    </div>
  );
}

/** Explain the task before asking someone to interpret business terminology. */
const PAGE_GUIDANCE: Record<string, string> = {
  plan: "What to focus on next.",
  content: "Draft posts, emails and ads. You check each one first.",
  pipeline: "Track people from first contact to sale.",
  outbound: "Find businesses to contact. You review every message.",
  visibility: "What search tools can read on your site.",
  "business-model": "Is the way you make money still working?",
  competitors: "See what similar businesses offer.",
  reviews: "Read feedback and draft replies. Imported reviews don't sync to public sites.",
  results: "Recorded visits, inquiries and sales. Missing data isn't zero.",
  connections: "Connect accounts and see what each can do.",
  pages: "ClimbOS-hosted pages that collect inquiries.",
  images: "Make and reuse pictures. Check them before sharing.",
  reels: "Prepare short videos.",
  inbox: "Read messages and draft replies.",
  chat: "Chat for your website visitors (not your Climb assistant).",
};

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
        {eyebrow ? <div className="mb-1 text-overline">{eyebrow}</div> : null}
        <h1 className="heading-page">{title}</h1>
        {section && PAGE_GUIDANCE[section] ? <p className="mt-2 max-w-2xl text-sm text-ink-3">{PAGE_GUIDANCE[section]}</p> : null}
        {intro ? <p className="mt-1 max-w-2xl text-sm text-ink-3">{intro}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** A "no data yet" panel with a next step. */
export function MissingData({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return <EmptyState title={title} body={body} action={action} headingLevel="h3" icon={<PlugZap />} />;
}
