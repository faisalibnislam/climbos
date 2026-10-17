"use client";

import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { AdsPanel } from "@/components/app/content/Campaigns";
import { ContentCalendar } from "@/components/app/content/ContentCalendar";
import { ContentList, FilterChips, filterKeyFromParam } from "@/components/app/content/ContentList";
import { CreateContentDialog } from "@/components/app/content/CreateContentDialog";
import { SectionBoundary } from "@/components/app/content/shared";

const TABS = ["list", "calendar", "ads"] as const;
type Tab = (typeof TABS)[number];

export default function ContentPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Content</h1>
          <p className="max-w-2xl leading-relaxed text-ink-2">
            Everything your AI team has written. Nothing is posted, sent or spent until someone with approval rights approves it.
          </p>
        </div>
        <CreateContentDialog slug={slug} />
      </header>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ContentTabs slug={slug} />
      </Suspense>
    </div>
  );
}

function ContentTabs({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as Tab) : "list";
  const filterKey = filterKeyFromParam(searchParams.get("status"));

  const setParams = (next: { tab?: Tab; status?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.tab !== undefined) {
      if (next.tab === "list") params.delete("tab");
      else params.set("tab", next.tab);
    }
    if (next.status !== undefined) {
      if (next.status === "all") params.delete("status");
      else params.set("status", next.status);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setParams({ tab: v as Tab })}>
      <TabsList aria-label="Content views">
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
        <TabsTrigger value="ads">Ads</TabsTrigger>
      </TabsList>
      <TabsContent value="list" className="mt-5 flex flex-col gap-5">
        <h2 className="sr-only">Content list</h2>
        <FilterChips value={filterKey} onChange={(k) => setParams({ status: k === "problems" ? "uncertain" : k })} />
        <ContentList slug={slug} filterKey={filterKey} />
      </TabsContent>
      <TabsContent value="calendar" className="mt-5">
        <SectionBoundary label="the calendar">
          <ContentCalendar slug={slug} />
        </SectionBoundary>
      </TabsContent>
      <TabsContent value="ads" className="mt-5">
        <SectionBoundary label="your ad campaigns">
          <AdsPanel slug={slug} />
        </SectionBoundary>
      </TabsContent>
    </Tabs>
  );
}
