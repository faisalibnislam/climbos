"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Copy, MoreHorizontal, Palette, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FORMATS, type DesignFormat } from "@shared/design/types";
import { Button, ConfirmDialog, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, IconButton, Skeleton, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { PageHeader } from "@/components/app/results/QueryBoundary";
import "./design-fonts.css";
import { DesignThumbnail } from "./DesignRenderer";

/** The workspace's saved designs: open, duplicate, delete, or start a new one. */
export function DesignLibrary({ slug }: { slug: string }) {
  const data = useQuery(api.designs.list, { slug });
  const duplicate = useMutation(api.designs.duplicate);
  const archive = useMutation(api.designs.archive);
  const router = useRouter();
  const [deleting, setDeleting] = useState<{ id: Id<"designs">; title: string } | null>(null);
  const label = (f: string) => FORMATS[f as Exclude<DesignFormat, "custom">]?.label ?? f;
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
      <PageHeader
        title="Design studio"
        intro="Image posts, carousels and documents in your brand. Saved here automatically."
        actions={
          data?.canEdit ? (
            <Button asChild>
              <Link href={`/studio/${slug}/new`}>
                <Plus aria-hidden /> New design
              </Link>
            </Button>
          ) : null
        }
      />
      {data === undefined ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i}>
              <Skeleton className="aspect-[4/5] w-full rounded-xl" />
            </li>
          ))}
        </ul>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<Palette />}
          headingLevel="h2"
          title="No designs yet"
          body="Start from a template in your brand colours, then edit anything."
          action={
            data.canEdit ? (
              <Button asChild>
                <Link href={`/studio/${slug}/new`}>
                  <Plus aria-hidden /> New design
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.items.map((d) => (
            <li key={d.id} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-brand-600">
              <Link href={`/studio/${slug}/${d.id}`} className="grid place-items-center bg-surface-2 p-3" aria-label={`Open ${d.title}`}>
                <DesignThumbnail doc={d.cover} width={200} resolve={(src) => d.urls[src] ?? (/^(https?:|data:)/.test(src) ? src : undefined)} className="rounded-md shadow-sm" />
              </Link>
              <div className="flex items-start gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/studio/${slug}/${d.id}`} className="block truncate font-medium text-ink hover:underline">
                    {d.title}
                  </Link>
                  <p className="truncate text-xs text-ink-3">
                    {label(d.format)} · {d.pages} page{d.pages === 1 ? "" : "s"} · {relativeTime(d.updatedAt)}
                  </p>
                </div>
                {data.canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton size="sm" aria-label={`More for ${d.title}`} icon={<MoreHorizontal />} className="text-ink-3 hover:text-ink" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        icon={<Copy />}
                        onSelect={async () => {
                          try {
                            const id = await duplicate({ slug, designId: d.id });
                            router.push(`/studio/${slug}/${id}`);
                          } catch (e) {
                            toast({ tone: "danger", title: errorMessage(e) });
                          }
                        }}
                      >
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem icon={<Trash2 />} danger onSelect={() => setDeleting({ id: d.id, title: d.title })}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="It leaves your library. Posts that already use its image keep it."
        confirmLabel="Delete design"
        tone="danger"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await archive({ slug, designId: deleting.id });
            toast({ tone: "success", title: "Design deleted" });
          } catch (e) {
            toast({ tone: "danger", title: errorMessage(e) });
          }
          setDeleting(null);
        }}
      />
    </div>
  );
}
