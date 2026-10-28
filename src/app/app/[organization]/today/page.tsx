"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { Button, Callout, Skeleton } from "@/components/ui";
import { PauseAllButton } from "@/components/app/AppShell";
import { askDraftKey } from "@/components/app/draftKeys";
import { PageHeader } from "@/components/app/results/QueryBoundary";
import { WishComposer, wishSuggestions, type WishComposerHandle } from "@/components/app/wish/WishComposer";
import { WishFeed } from "@/components/app/wish/WishFeed";
import { IdeaDeck } from "@/components/app/today/IdeaDeck";
import { NeedsYouCard, PlanCard, ThisWeekCard } from "@/components/app/today/HomeCards";

/** Home: ask for help in your own words, then what needs you, your plan, and the latest numbers. */
export default function TodayPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.workspace.today, { slug });
  const homeSnapshot = useQuery(api.analytics.homeSnapshot, { slug });
  const composer = useRef<WishComposerHandle>(null);
  const me = useQuery(api.orgs.me);
  useEffect(() => {
    if (!me || !data) return;
    const loadDraft = () => {
      try {
        const key = askDraftKey(slug, me.userId);
        const draft = sessionStorage.getItem(key);
        if (draft) { sessionStorage.removeItem(key); composer.current?.fill(draft); }
      } catch { /* Storage may be unavailable. */ }
    };
    loadDraft();
    window.addEventListener("climbos:compose", loadDraft);
    return () => window.removeEventListener("climbos:compose", loadDraft);
  }, [data, me, slug]);

  // The review section arrives with the query result. Next's initial hash
  // scroll can run while only loading placeholders exist, especially on phones.
  const ready = data !== undefined;
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const openReview = () => {
      if (window.location.hash !== "#review") return;
      frame = requestAnimationFrame(() => {
        const section = document.getElementById("review");
        section?.scrollIntoView({ block: "start" });
        section?.focus({ preventScroll: true });
      });
    };
    openReview();
    window.addEventListener("hashchange", openReview);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openReview);
    };
  }, [ready, slug]);

  if (data === undefined) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    );
  }

  const suggested = data.cards.filter((c) => !data.chat.some((m) => m.cards.some((x) => x.id === c.id)) && (c.status === "proposed" || c.status === "blocked"));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader section="today" title="What can we help with?" />

      {!data.canRunAi && data.accessMessage && (
        <Callout
          tone={data.accessCode === "PAUSED" || data.accessCode === "FLEET_STOP" ? "warning" : "info"}
          title={data.accessCode === "PAYMENT_ISSUE" ? "Payment needs attention" : data.accessCode === "PAUSED" ? "Activity is paused" : "New AI work is on hold"}
          action={
            data.accessCode === "PAUSED" || data.accessCode === "FLEET_STOP" ? undefined : (
              <Button asChild size="sm">
                <Link href={`/app/${slug}/settings/billing`}>See plans</Link>
              </Button>
            )
          }
        >
          {data.accessMessage}
        </Callout>
      )}

      {data.org.kind === "customer" && data.org.onboardingStep !== "done" && (data.role === "owner" || data.role === "admin") && (
        <Callout tone="info" title="Finish setting up" action={<Button asChild size="sm"><Link href={`/onboarding?workspace=${slug}`}>Continue</Link></Button>} />
      )}

      <WishComposer
        key={`${slug}:${me?.userId ?? "identity-pending"}`}
        ref={composer}
        slug={slug}
        userId={me?.userId}
        identityReady={me !== undefined && Boolean(me?.userId)}
        suggestions={wishSuggestions(data.business?.type)}
        disabled={!data.canRunAi || !me?.userId}
        disabledReason={!me?.userId ? "Checking your account…" : !data.canRunAi ? (data.accessMessage ?? null) : null}
        requestCostEstimateMicros={data.requestCostEstimateMicros}
        autoDraftBudgetMicros={data.autoDraftBudgetMicros}
        isDemo={data.org.kind === "demo"}
      />
      <WishFeed slug={slug} chat={data.chat} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NeedsYouCard slug={slug} data={data} />
        <PlanCard slug={slug} data={data} />
        <ThisWeekCard slug={slug} data={data} snapshot={homeSnapshot} />
      </div>

      {suggested.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-ui font-medium text-ink-2">More ideas ({suggested.length})</summary>
          <div className="mt-3">
            <IdeaDeck slug={slug} cards={suggested} />
          </div>
        </details>
      ) : null}

      <div className="md:hidden">
        <PauseAllButton slug={slug} paused={Boolean(data.emergencyStop)} variant="large" />
      </div>
    </div>
  );
}
