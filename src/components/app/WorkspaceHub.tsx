"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "@/components/icons";
import { Field, Input, EmptyState } from "@/components/ui";
import { WordHelp } from "@/components/ui/word-help";
import { PageHeader } from "./results/QueryBoundary";
import { PRIMARY_NAV, appHref, findTools, type AppArea } from "./navigation";

export function WorkspaceHub({ area }: { area: "work" | "customers" | "tools" }) {
  const { organization: slug } = useParams<{ organization: string }>();
  const [query, setQuery] = useState("");
  const item = PRIMARY_NAV.find((nav) => nav.key === area)!;
  const tools = findTools(query, area === "tools" ? undefined : area);
  const groups: { key: AppArea; label: string }[] = [
    { key: "work", label: "Make and share your work" },
    { key: "customers", label: "Reach and help customers" },
    { key: "plan", label: "Understand your business" },
    { key: "results", label: "Understand the numbers" },
    { key: "tools", label: "Set up your accounts" },
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader section={area} title={item.label} intro={item.description} />
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
    </div>
  );
}
