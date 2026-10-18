"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/** Links to the drafts a job created, shown once they exist. */
export function RunDrafts({ slug, runId, onOpen }: { slug: string; runId: Id<"workflowRuns">; onOpen?: () => void }) {
  const drafts = useQuery(api.content.byRun, { slug, runId });
  if (!drafts?.length) return null;
  return (
    <ul className="flex flex-col gap-1.5" aria-label="New drafts">
      {drafts.map((d) => (
        <li key={d.id}>
          <Link href={`/app/${slug}/content/${d.id}`} onClick={onOpen} className="inline-flex items-center gap-1.5 text-ui font-medium text-brand-800 underline-offset-2 hover:underline">
            Open “{d.title}” <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
