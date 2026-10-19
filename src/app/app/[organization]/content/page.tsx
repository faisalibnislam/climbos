"use client";

import Link from "next/link";
import { Palette } from "@/components/icons"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { PageHeader } from "@/components/app/results/QueryBoundary";
import { AdsPanel } from "@/components/app/content/Campaigns";
import { ContentCalendar } from "@/components/app/content/ContentCalendar";
import { ContentList, FilterChips, filterKeyFromParam } from "@/components/app/content/ContentList";
import { CreateContentDialog } from "@/components/app/content/CreateContentDialog";
import { RepurposeDialog } from "@/components/app/content/RepurposeDialog";
import { SectionBoundary } from "@/components/app/content/shared";

const TABS = ["list", "calendar", "ads"] as const;
type Tab = (typeof TABS)[number];

export default function ContentPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        section="content"
        title="Content"
        intro="Everything your AI team has created. Nothing is posted, sent or spent until you approve it."
        actions={
          <>
            <Button asChild variant="secondary">
              <Link href={`/studio/${slug}/new`}>
                <Palette aria-hidden="true" /> Design studio
              </Link>
            </Button>
            <RepurposeDialog slug={slug} />
            <CreateContentDialog slug={slug} />
          </>
        }
      />
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
      <TabsContent value="list" className="flex flex-col gap-4">
        <h2 className="sr-only">Content list</h2>
        <FilterChips value={filterKey} onChange={(k) => setParams({ status: k === "problems" ? "uncertain" : k })} />
        <ContentList slug={slug} filterKey={filterKey} />
      </TabsContent>
      <TabsContent value="calendar">
        <SectionBoundary label="the calendar">
          <ContentCalendar slug={slug} />
        </SectionBoundary>
      </TabsContent>
      <TabsContent value="ads">
        <SectionBoundary label="your ad campaigns">
          <AdsPanel slug={slug} />
        </SectionBoundary>
      </TabsContent>
    </Tabs>
  );
}
