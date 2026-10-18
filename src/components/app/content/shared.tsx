"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ConvexError } from "convex/values";
import {
  Archive,
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  Clock,
  FileText,
  Hourglass,
  Pencil,
  Send,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Component, useState, useSyncExternalStore, type ErrorInfo, type ReactNode } from "react";
import { Badge, Button, Callout, SocialIcon } from "@/components/ui";
import { RoleAvatar } from "../RoleAvatar";
import { cn } from "@/lib/utils";
import { ARTIFACT_STATUS, CHANNEL_LABELS, ROLE_META, roleTitle } from "../roles";
import { errorInfo, type AppErrorInfo } from "../errors";

/* ------------------------------------------------------------------ */
/* Time                                                                 */
/* ------------------------------------------------------------------ */

let nowValue = Date.now();
const nowSubscribers = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;

function subscribeNow(cb: () => void) {
  nowValue = Date.now();
  nowSubscribers.add(cb);
  if (!nowTimer) {
    nowTimer = setInterval(() => {
      nowValue = Date.now();
      nowSubscribers.forEach((fn) => fn());
    }, 30_000);
  }
  return () => {
    nowSubscribers.delete(cb);
    if (nowSubscribers.size === 0 && nowTimer) {
      clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}

/**
 * Current time on the client (refreshed every 30s); `null` during server
 * rendering and hydration so date-dependent UI never mismatches.
 */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribeNow,
    () => nowValue,
    () => null,
  );
}

/** The browser's IANA time zone, e.g. "Europe/London". */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time";
  } catch {
    return "your local time";
  }
}

/* ------------------------------------------------------------------ */
/* Roles & permissions                                                  */
/* ------------------------------------------------------------------ */

export type MemberRole = "owner" | "admin" | "editor" | "reviewer" | "viewer";

/** Who can do what, in words owners understand. Mirrors shared/policy PERMISSIONS. */
export const PERMISSION_WHO: Record<string, string> = {
  view: "anyone in the workspace",
  edit: "an Owner, Admin or Editor",
  approve: "an Owner, Admin or Reviewer",
  pause: "an Owner, Admin, Editor or Reviewer",
  resume: "an Owner or Admin",
  manage_team: "an Owner or Admin",
  manage_billing: "the Owner",
  chat: "an Owner, Admin or Editor",
};

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

/** The signed-in user's role and id in this workspace (undefined while loading). */
export function useWorkspaceMember(slug: string) {
  const me = useQuery(api.orgs.me);
  if (me === undefined) return undefined;
  const org = me?.orgs.find((o) => o.slug === slug);
  return { userId: me?.userId ?? null, role: (org?.role ?? null) as MemberRole | null, isDemo: org?.kind === "demo" };
}

/* ------------------------------------------------------------------ */
/* Errors                                                               */
/* ------------------------------------------------------------------ */

export interface ExplainedError extends AppErrorInfo {
  title: string;
  /** Who is allowed, for FORBIDDEN errors. */
  who?: string;
}

/** errorInfo + a friendly title and (for FORBIDDEN) which role is needed. */
export function explainError(err: unknown): ExplainedError {
  const info = errorInfo(err);
  let who: string | undefined;
  if (err instanceof ConvexError && typeof err.data === "object" && err.data) {
    const perm = (err.data as { permission?: string }).permission;
    if (perm) who = PERMISSION_WHO[perm];
  }
  if (info.code === "UNKNOWN" && err instanceof Error && /ArgumentValidationError|does not match validator|Invalid argument/i.test(err.message)) {
    return { code: "NOT_FOUND", message: "We couldn't find that. The link may be wrong or out of date.", title: "Not found" };
  }
  const titles: Record<AppErrorInfo["code"], string> = {
    UNAUTHENTICATED: "Please sign in",
    FORBIDDEN: "Your role can't do this",
    NOT_FOUND: "Not found",
    INVALID: "That didn't work",
    LIMIT_REACHED: "You've reached a monthly limit",
    PAYMENT_REQUIRED: "Billing needs attention",
    PAUSED: "All activity is paused",
    RATE_LIMITED: "Too many requests at once",
    UNAVAILABLE: "Not available right now",
    UNKNOWN: "Something went wrong",
  };
  return { ...info, who, title: titles[info.code] };
}

/** "Ask an admin" for a job over the workspace's approval limit: notifies its owners and admins. */
function AskApproval({ slug, error }: { slug: string; error: unknown }) {
  const ask = useMutation(api.team.requestApproval);
  const [sent, setSent] = useState(false);
  const data = (error instanceof ConvexError ? error.data : {}) as { title?: string; credits?: number };
  if (sent) return <span>Sent. You&apos;ll see it start once they approve.</span>;
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        await ask({ slug, title: data.title ?? "A job", credits: data.credits ?? 0, href: typeof window !== "undefined" ? window.location.pathname : `/app/${slug}/today` });
        setSent(true);
      }}
    >
      Ask an owner or admin
    </Button>
  );
}

/** Inline, announced explanation of a failed request with the right next step. */
export function ErrorCallout({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const params = useParams<{ organization: string }>();
  const slug = params?.organization ?? "";
  const e = explainError(error);
  const billing = `/app/${slug}/settings/billing`;
  let next: ReactNode = null;
  if (e.code === "LIMIT_REACHED" || e.code === "PAYMENT_REQUIRED") {
    next = (
      <Link href={billing}>{e.code === "PAYMENT_REQUIRED" ? "Go to billing" : "See your plan and add capacity"}</Link>
    );
  } else if (e.code === "PAUSED") {
    next = <span>An Owner or Admin can resume activity from the banner at the top of the page.</span>;
  } else if (e.code === "FORBIDDEN" && e.reason === "approval_limit") {
    next = <AskApproval slug={slug} error={error} />;
  } else if (e.code === "FORBIDDEN") {
    next = <span>{e.who ? `This needs ${e.who}. Ask one of them to do it, or to change your role.` : "Ask an Owner or Admin for help."}</span>;
  } else if (e.code === "RATE_LIMITED") {
    next = <span>Wait a minute, then try again.</span>;
  } else if (e.code === "UNAUTHENTICATED") {
    next = <Link href="/sign-in">Sign in</Link>;
  }
  return (
    <Callout
      tone={e.code === "PAUSED" || e.code === "RATE_LIMITED" || e.code === "LIMIT_REACHED" ? "warning" : "danger"}
      live="alert"
      title={e.title}
      className={className}
      action={
        onRetry ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        ) : undefined
      }
    >
      <p>{e.message}</p>
      {next ? <p className="mt-1">{next}</p> : null}
    </Callout>
  );
}

interface BoundaryProps {
  children: ReactNode;
  /** What this section is, for the fallback copy, e.g. "your drafts". */
  label?: string;
  className?: string;
  /** Page-level boundaries render this as the h1 when the page fails to load. */
  pageHeading?: string;
}

interface BoundaryState {
  error: unknown;
  attempt: number;
}

/**
 * Catches errors thrown by Convex `useQuery` (server errors) inside a section
 * and shows a friendly message with a retry that re-subscribes the queries.
 */
export class SectionBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: unknown): Partial<BoundaryState> {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") console.warn("Section failed to load", error, info.componentStack);
  }

  retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    if (this.state.error) {
      return (
        <div className={cn("flex flex-col gap-4", this.props.className)}>
          {this.props.pageHeading ? (
            <h1 className="heading-page">{this.props.pageHeading}</h1>
          ) : null}
          <ErrorCallout error={this.state.error} onRetry={this.retry} />
          {this.props.label ? <p className="sr-only">Couldn&apos;t load {this.props.label}.</p> : null}
        </div>
      );
    }
    return <SectionKey key={this.state.attempt}>{this.props.children}</SectionKey>;
  }
}

function SectionKey({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/* ------------------------------------------------------------------ */
/* Channels, statuses, roles                                            */
/* ------------------------------------------------------------------ */

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

/** Platform mark (decorative) + the channel's name as text. */
export function ChannelTag({ channel, className }: { channel: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ui font-medium text-ink-2", className)}>
      <SocialIcon network={channel} variant="tile" size="md" />
      {channelLabel(channel)}
    </span>
  );
}

const STATUS_ICONS: Record<string, LucideIcon> = {
  draft: Pencil,
  in_review: Hourglass,
  approved: CircleCheck,
  scheduled: Clock,
  publishing: Send,
  published: CircleCheck,
  exported: FileText,
  failed: CircleAlert,
  uncertain: CircleQuestionMark,
  archived: Archive,
};

export function artifactStatusMeta(status: string) {
  return ARTIFACT_STATUS[status] ?? { label: status, tone: "neutral" as const, help: "" };
}

/** Status pill: icon + words + tone. Optionally shows the help text under it. */
export function ArtifactStatus({ status, showHelp = false, className }: { status: string; showHelp?: boolean; className?: string }) {
  const meta = artifactStatusMeta(status);
  const Icon = STATUS_ICONS[status] ?? CircleQuestionMark;
  return (
    <span className={cn("inline-flex min-w-0 flex-col items-start gap-1", className)}>
      <Badge tone={meta.tone} icon={<Icon />}>
        {meta.label}
      </Badge>
      {showHelp && meta.help ? <span className="text-xs text-ink-3">{meta.help}</span> : null}
    </span>
  );
}

/** "🎨 AI Creative Director" with the emoji hidden from screen readers. */
export function RoleName({ role, className }: { role: string | null | undefined; className?: string }) {
  const meta = role ? ROLE_META[role] : undefined;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {meta && role ? <RoleAvatar role={role} size="xs" /> : null}
      <span>{roleTitle(role)}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Meters & money                                                       */
/* ------------------------------------------------------------------ */

const METER_WORDS: Record<string, (n: number) => string> = {
  socialPosts: (n) => `${n} social post${n === 1 ? "" : "s"} from your monthly post allowance`,
  imageAttempts: (n) => `up to ${n} image attempt${n === 1 ? "" : "s"} from your monthly image allowance`,
  deliveredImages: (n) => `${n} finished image${n === 1 ? "" : "s"}`,
  searchCalls: (n) => `${n} web search${n === 1 ? "" : "es"}`,
  scrapeCredits: (n) => `${n} website page read${n === 1 ? "" : "s"}`,
  transactionalEmails: (n) => `${n} notification email${n === 1 ? "" : "s"}`,
  byoMarketingSends: (n) => `${n} marketing email send${n === 1 ? "" : "s"}`,
  analyticsEvents: (n) => `${n} analytics event${n === 1 ? "" : "s"}`,
  supportMinutes: (n) => `${n} support minute${n === 1 ? "" : "s"}`,
};

/** Plain-language list of the monthly limits a job counts against. */
export function describeMeters(meters: Record<string, number | undefined>): string[] {
  return Object.entries(meters)
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([k, n]) => (METER_WORDS[k] ? METER_WORDS[k](n as number) : `${n} × ${k}`));
}

/** Format a major-unit amount (e.g. 25 → "$25.00"). */
export function majorToDisplay(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
