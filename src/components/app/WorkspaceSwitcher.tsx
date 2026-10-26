"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import { ChevronDown, Settings, Sparkles } from "@/components/icons";
import { Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";

type Org = { slug: string; name: string; kind: string; role: string; onboardingStep?: string };

/** Where a business opens: unfinished setup resumes onboarding for the people who can finish it. */
export function workspaceHref(o: Org): string {
  const unfinished = o.kind === "customer" && o.onboardingStep !== "done" && (o.role === "owner" || o.role === "admin");
  return unfinished ? `/onboarding?workspace=${o.slug}` : `/app/${o.slug}/today`;
}

/**
 * Switch between businesses, resume unfinished setups (created workspaces and saved step-one drafts),
 * add a business, or manage and remove them. Shown in the app sidebar and throughout onboarding.
 */
export function WorkspaceSwitcher({ slug, draftId, variant = "sidebar" }: { slug?: string | null; draftId?: string | null; variant?: "sidebar" | "header" }) {
  const me = useQuery(api.orgs.me);
  const drafts = useQuery(api.onboardingDrafts.mine, me && !me.isAnonymous ? {} : "skip");
  const router = useRouter();
  if (!me) return <Skeleton className={variant === "sidebar" ? "h-10 w-full" : "h-9 w-40"} />;
  const orgs = me.orgs as Org[];
  const current = slug ? orgs.find((o) => o.slug === slug) : undefined;
  const currentDraft = draftId ? drafts?.find((d) => d.id === draftId) : undefined;
  const label = current?.name ?? currentDraft?.label ?? (slug ? "…" : "New business");
  const hasBusiness = orgs.some((o) => o.kind === "customer");
  const manageSlug = current?.slug ?? orgs.find((o) => o.kind === "customer" && o.onboardingStep === "done")?.slug ?? orgs.find((o) => o.kind === "customer")?.slug;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Switch business. Current: ${label}`}
          className={cn(
            "flex items-center justify-between gap-2 rounded-[var(--radius-control)] px-2 text-left hover:bg-surface/60",
            variant === "sidebar" ? "h-10 w-full" : "h-9 max-w-64 border border-line bg-surface",
          )}
        >
          <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-lime text-xs font-semibold text-ink">
            {label.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-ui font-medium text-ink">{label}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-3" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} className="w-64">
        <DropdownMenuLabel>Your businesses</DropdownMenuLabel>
        {orgs.length === 0 ? <p className="px-2 py-1.5 text-xs text-ink-3">None yet.</p> : null}
        {orgs.map((o) => {
          const unfinished = workspaceHref(o).startsWith("/onboarding");
          return (
            <DropdownMenuItem key={o.slug} onSelect={() => router.push(workspaceHref(o))}>
              <span className="truncate">{o.name}</span>
              {o.kind === "demo" ? <Badge tone="violet" className="ml-auto">Demo</Badge> : unfinished ? <Badge tone="neutral" className="ml-auto">Setup unfinished</Badge> : null}
            </DropdownMenuItem>
          );
        })}
        {drafts?.length ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Not created yet</DropdownMenuLabel>
            {drafts.map((d) => (
              <DropdownMenuItem key={d.id} onSelect={() => router.push(`/onboarding?${hasBusiness ? "new=1&" : ""}draft=${d.id}`)}>
                <span className="truncate">{d.label}</span>
                <Badge tone="neutral" className="ml-auto">Draft</Badge>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push(hasBusiness ? "/onboarding?new=1" : "/onboarding")}>
          <Sparkles className="size-4" aria-hidden /> Add company or workspace
        </DropdownMenuItem>
        {manageSlug ? (
          <DropdownMenuItem onSelect={() => router.push(`/app/${manageSlug}/settings/workspaces`)}>
            <Settings className="size-4" aria-hidden /> Manage or remove businesses
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
