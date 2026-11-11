"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Callout, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { PauseAllButton } from "@/components/app/AppShell";
import { PageHeader } from "@/components/app/results/QueryBoundary";
import { WishComposer, wishSuggestions } from "@/components/app/wish/WishComposer";
import { WishFeed } from "@/components/app/wish/WishFeed";
import { IdeaDeck } from "@/components/app/today/IdeaDeck";
import { HomeNextAction, NeedsYouCard, ThisWeekCard } from "@/components/app/today/HomeCards";

/** Home: ask for help in your own words, then what needs you, your plan, and the latest numbers. */
export default function TodayPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.workspace.today, { slug });
  const homeSnapshot = useQuery(api.analytics.homeSnapshot, { slug });
  const me = useQuery(api.orgs.me);
  const [homeTab, setHomeTab] = useState("activity");

  // The review section arrives with the query result. Next's initial hash
  // scroll can run while only loading placeholders exist, especially on phones.
  const ready = data !== undefined;
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    const selectReview = () => {
      if (homeTab !== "attention") setHomeTab("attention");
      frame = requestAnimationFrame(() => {
        const section = document.getElementById("review");
        for (let parent = section?.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
        section?.scrollIntoView({ block: "start" });
        section?.focus({ preventScroll: true });
      });
    };
    const openReview = () => { if (window.location.hash === "#review") selectReview(); };
    // Next Link uses pushState for a same-page hash, which emits no hashchange.
    const followReviewLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank") return;
      const url = new URL(anchor.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.hash === "#review") selectReview();
    };
    openReview();
    window.addEventListener("hashchange", openReview);
    window.addEventListener("popstate", openReview);
    document.addEventListener("click", followReviewLink, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", openReview);
      window.removeEventListener("popstate", openReview);
      document.removeEventListener("click", followReviewLink, true);
    };
  }, [ready, slug, homeTab]);

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
    <div className="home-workspace mx-auto flex max-w-4xl flex-col gap-7">
      <PageHeader section="today" title={data.strategy ? "What’s next?" : "What’s your wish?"} intro={data.strategy ? "Review prepared work or start something new." : "Tell us what you want to achieve."} />

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

      <HomeNextAction slug={slug} data={data} />

      {data.strategy ? <h2 className="heading-section">Start something new</h2> : null}

      <WishComposer
        key={`${slug}:${me?.userId ?? "identity-pending"}`}
        slug={slug}
        userId={me?.userId}
        identityReady={me !== undefined && Boolean(me?.userId)}
        suggestions={wishSuggestions(data.business?.type)}
        disabled={!data.canRunAi || !me?.userId}
        disabledReason={!me?.userId ? "Checking your account…" : !data.canRunAi ? (data.accessMessage ?? null) : null}
        requestCostEstimateMicros={data.requestCostEstimateMicros}
        autoDraftBudgetMicros={data.autoDraftBudgetMicros}
        isDemo={data.org.kind === "demo"}
        onSubmitted={() => setHomeTab("activity")}
      />
      <Tabs value={homeTab} onValueChange={value => { if (value !== "attention" && window.location.hash === "#review") window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); setHomeTab(value); }} className="home-detail-tabs">
        <TabsList aria-label="Workspace views"><TabsTrigger value="activity">Activity</TabsTrigger><TabsTrigger value="attention">Needs you</TabsTrigger><TabsTrigger value="results">Results</TabsTrigger><TabsTrigger value="ideas">Ideas</TabsTrigger></TabsList>
        <TabsContent value="activity">{data.chat.length ? <WishFeed slug={slug} chat={data.chat} /> : <p className="py-6 text-sm text-ink-3">Your requests and AI work will appear here.</p>}</TabsContent>
        <TabsContent value="attention"><NeedsYouCard slug={slug} data={data} /></TabsContent>
        <TabsContent value="results"><ThisWeekCard slug={slug} data={data} snapshot={homeSnapshot} /></TabsContent>
        <TabsContent value="ideas">{suggested.length ? <IdeaDeck slug={slug} cards={suggested} /> : <p className="py-6 text-sm text-ink-3">Your next ideas will build on what we learn.</p>}</TabsContent>
      </Tabs>

      <div className="md:hidden">
        <PauseAllButton slug={slug} paused={Boolean(data.emergencyStop)} variant="large" />
      </div>
    </div>
  );
}
