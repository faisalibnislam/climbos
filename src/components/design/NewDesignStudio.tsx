"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FORMATS, type DesignFormat } from "@shared/design/types";
import { Checkbox, Spinner, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { PageHeader } from "@/components/app/results/QueryBoundary";

/** Pick a size; the design is created in the workspace's brand, saved, and opened in the editor. */
export function NewDesignStudio({ slug, postId }: { slug: string; postId?: string }) {
  const create = useMutation(api.designs.create);
  const router = useRouter();
  const [carousel, setCarousel] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const start = async (format: Exclude<DesignFormat, "custom">) => {
    setBusy(format);
    try {
      const id = await create({ slug, format, carousel, artifactId: postId ? (postId as Id<"artifacts">) : undefined });
      router.replace(`/studio/${slug}/${id}${postId ? `?post=${postId}` : ""}`);
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
      setBusy(null);
    }
  };
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-8">
      <PageHeader title="Create a design" intro={postId ? "Choose a size. The post's first line becomes the headline." : "Choose a size. It opens in your brand colours; change anything inside the editor."} />
      <Checkbox checked={carousel} onCheckedChange={(v) => setCarousel(v === true)} label="Make it a carousel (cover, 3 points, ending)" />
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {Object.values(FORMATS).map((f) => (
          <li key={f.id}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => start(f.id as Exclude<DesignFormat, "custom">)}
              className="flex w-full flex-col items-center gap-3 rounded-xl border border-line bg-surface p-5 text-center transition-colors hover:border-brand-600 hover:bg-surface-2 disabled:opacity-60"
            >
              <span aria-hidden="true" className="grid place-items-center rounded-sm border-2 border-ink/70 bg-surface-2" style={{ width: 64 * Math.min(1, f.width / f.height), height: 64 * Math.min(1, f.height / f.width) }}>
                {busy === f.id ? <Spinner /> : null}
              </span>
              <span className="heading-card">{f.label}</span>
              <span className="text-xs text-ink-3">
                {f.width}×{f.height}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
