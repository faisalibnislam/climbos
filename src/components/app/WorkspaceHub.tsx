"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "@/components/icons";
import { Field, Input, EmptyState, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { WishComposer, wishSuggestions } from "./wish/WishComposer";
import { WishFeed } from "./wish/WishFeed";
import { RecentWork } from "./plan/PlanSections";
import { NeedsYouCard } from "./today/HomeCards";
import { PreparedDraftLibrary } from "./plan/PreparedDraftLibrary";
import { WordHelp } from "@/components/ui/word-help";
import { PageHeader } from "./results/QueryBoundary";
import { PRIMARY_NAV, SECONDARY_NAV, appHref, findTools, type AppArea } from "./navigation";

export function WorkspaceHub({ area }: { area: "work" | "customers" | "tools" }) {
  const { organization: slug } = useParams<{ organization: string }>();
  const [query, setQuery] = useState("");
  const data = useQuery(api.workspace.today, area === "work" ? { slug } : "skip");
  const me = useQuery(api.orgs.me);
  const [tab, setTab] = useState(area === "work" ? "drafts" : "activity");
  const item = [...PRIMARY_NAV, ...SECONDARY_NAV].find((nav) => nav.key === area)!;
  const tools = findTools(query, area === "tools" ? undefined : area);
  const groups: { key: AppArea; label: string }[] = [
    { key: "work", label: "Make and share your work" },
    { key: "customers", label: "Reach and help customers" },
    { key: "plan", label: "Understand your business" },
    { key: "results", label: "Understand the numbers" },
    { key: "tools", label: "Set up your accounts" },
  ];
  return (
    <Tabs value={tab} onValueChange={setTab} asChild><div className="mx-auto max-w-5xl space-y-5">
      <PageHeader section={area} title={item.label} intro={item.description} />
      <TabsList aria-label="Work sections" className="flex-wrap">{area === "work" ? <TabsTrigger value="drafts">Your drafts</TabsTrigger> : null}<TabsTrigger value="activity">{area === "work" ? "AI activity" : "Start here"}</TabsTrigger>{area === "work" ? <TabsTrigger value="review">Needs a decision</TabsTrigger> : null}<TabsTrigger value="tools">Tools</TabsTrigger></TabsList>
      {area === "work" ? <TabsContent value="drafts"><PreparedDraftLibrary slug={slug} /></TabsContent> : null}
      <TabsContent value="activity" className="space-y-5">
        {area === "work" ? <><RecentWork slug={slug} /><details className="rounded-xl border border-line bg-surface p-4"><summary className="min-h-11 cursor-pointer font-medium">Ask AI for something else</summary><div className="mt-3"><WishComposer slug={slug} userId={me?.userId} identityReady={Boolean(me?.userId)} suggestions={wishSuggestions(data?.business?.type)} disabled={!data?.canRunAi || !me?.userId} disabledReason={data?.accessMessage} requestCostEstimateMicros={data?.requestCostEstimateMicros ?? 0} autoDraftBudgetMicros={data?.autoDraftBudgetMicros ?? 0} isDemo={data?.org.kind === "demo"} /></div></details>{data ? <WishFeed slug={slug} chat={data.chat} /> : <p role="status">Loading your work…</p>}</> : <><p className="text-sm text-ink-2">Tell Climb what you want to achieve. It will choose the right tools and prepare the work.</p><Link href={appHref(slug, "today")} className="text-link">Ask Climb for help</Link><p className="text-sm text-ink-3">Already know what you need? Open Tools.</p></>}
      </TabsContent>
      {area === "work" ? <TabsContent value="review">{data ? <NeedsYouCard slug={slug} data={data} /> : <p role="status">Loading reviews…</p>}</TabsContent> : null}
      <TabsContent value="tools" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm">
        <p className="text-ink-2">Not sure? Describe what you need on Home.</p>
        <Link href={appHref(slug, "today")} className="text-link">Ask for help</Link>
      </div>
      <Field label={area === "tools" ? "Find a tool" : "Find something to do"} hint="Try words like posts, bookings or website.">
        <Input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What would you like to do?" />
      </Field>
      {tools.length === 0 ? <EmptyState title="No matching tools" body="Try a shorter word, or ask Climb for help on Home." /> : groups.map((group) => {
        const entries = tools.filter((tool) => tool.area === group.key);
        if (!entries.length) return null;
        return <section key={group.key} aria-labelledby={`group-${group.key}`}>
          <h2 id={`group-${group.key}`} className="heading-section mb-3">{group.label}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {entries.map((tool) => <li key={tool.key}>
              <Link href={appHref(slug, tool.key)} className="flex h-full items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)] transition-colors hover:border-brand-800">
                <span className="min-w-0 flex-1"><span className="heading-card block">{tool.label}</span><span className="mt-2 block text-sm text-ink-3">{tool.description}</span></span>
                <ArrowRight className="mt-1 size-4 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>)}
          </ul>
        </section>;
      })}
      <WordHelp />
      </TabsContent>
    </div></Tabs>
  );
}
