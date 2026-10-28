"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Clapperboard, FileText, ImageIcon, Images, Type, WandSparkles } from "@/components/icons";
import { useEffect, useState } from "react";
import { Button, ConfirmDialog, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { useCostDisplay } from "@/components/app/useCostDisplay";
import type { ArtifactView, VersionView } from "./model";

type Visual = NonNullable<VersionView["visual"]>;

const FORMAT: Record<Visual["format"], { label: string; icon: typeof ImageIcon; hint: string }> = {
  single_image: { label: "Single image", icon: ImageIcon, hint: "One photo or graphic above the post." },
  carousel: { label: "Carousel", icon: Images, hint: "A swipeable set of slides." },
  document: { label: "Document carousel", icon: FileText, hint: "A PDF of slides in the feed." },
  reel: { label: "Short video", icon: Clapperboard, hint: "Film it on your phone. ClimbOS doesn't make video." },
  story: { label: "Story", icon: ImageIcon, hint: "A vertical full-screen image or clip." },
  thread: { label: "Thread", icon: Type, hint: "A series of short posts. Add an image to the first." },
  text: { label: "Text first", icon: Type, hint: "Words lead. A visual is optional." },
};

/** The visual a version suggests: older drafts only stored an image idea, which is a single image brief. */
export function visualOf(version: VersionView): Visual | null {
  if (version.visual) return version.visual;
  return version.imagePrompt?.trim() ? { format: "single_image", brief: version.imagePrompt.trim() } : null;
}

export function visualFormatLabel(format: Visual["format"]): string {
  return FORMAT[format].label;
}

/** What to show with a social draft, and (for still formats) a metered way to make the image. */
export function SuggestedVisual({ slug, artifact, version, canCreate }: { slug: string; artifact: ArtifactView; version: VersionView; canCreate: boolean }) {
  const visual = visualOf(version);
  if (!visual) return <p className="text-sm text-ink-3">No visual suggestion. Add your own image in the editor.</p>;
  const meta = FORMAT[visual.format];
  const Icon = meta.icon;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-900">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{meta.label}</p>
          <p className="text-xs text-ink-3">{meta.hint}</p>
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-ink-3">Brief</p>
        <p className="whitespace-pre-wrap break-words text-sm text-ink">{visual.brief}</p>
      </div>
      {visual.slides?.length ? (
        <div>
          <p className="text-xs font-medium text-ink-3">{visual.format === "document" ? "Pages" : "Slides"}</p>
          <ol className="mt-1 flex flex-col gap-2">
            {visual.slides.map((slide, i) => (
              <li key={i} className="rounded-[var(--radius-control)] border border-line px-3 py-2 text-sm">
                <span className="text-xs text-ink-3">{i + 1}. </span>
                <span className="font-medium text-ink">{slide.heading}</span>
                {slide.body ? <span className="block text-ink-2">{slide.body}</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {visual.videoScript ? (
        <div>
          <p className="text-xs font-medium text-ink-3">Script</p>
          <p className="whitespace-pre-wrap break-words text-sm text-ink">{visual.videoScript}</p>
        </div>
      ) : null}
      {visual.shotList?.length ? (
        <div>
          <p className="text-xs font-medium text-ink-3">Shot list</p>
          <ol className="mt-1 flex flex-col gap-1 text-sm">
            {visual.shotList.map((shot, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-16 shrink-0 text-xs tabular-nums text-ink-3">{shot.timing || `Shot ${i + 1}`}</span>
                <span className="min-w-0 text-ink">{shot.show}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {version.altText ? (
        <div>
          <p className="text-xs font-medium text-ink-3">Alt text</p>
          <p className="text-sm text-ink-2">{version.altText}</p>
        </div>
      ) : null}
      {canCreate && visual.format !== "reel" && !artifact.isDemo ? <CreateImage slug={slug} artifactId={artifact.id} hasImage={Boolean(version.imageUrl)} cover={visual.format === "carousel" || visual.format === "document"} /> : null}
      {artifact.isDemo && visual.format !== "reel" ? <p className="text-xs text-ink-3">Demo: create images in your own workspace.</p> : null}
    </div>
  );
}

function CreateImage({ slug, artifactId, hasImage, cover }: { slug: string; artifactId: Id<"artifacts">; hasImage: boolean; cover: boolean }) {
  const fmt = useCostDisplay();
  const estimate = useQuery(api.postVisuals.imageEstimate, { slug });
  const create = useMutation(api.postVisuals.createImage);
  const [runId, setRunId] = useState<Id<"workflowRuns"> | null>(null);
  const run = useQuery(api.content.runStatus, runId ? { slug, runId } : "skip");
  const working = Boolean(runId) && (!run || !["verified", "failed", "canceled", "uncertain"].includes(run.status));
  const status = run?.status;
  const userMessage = run?.userMessage ?? null;
  useEffect(() => {
    if (status === "verified") toast({ tone: "success", title: userMessage ?? "Image added. Review it before approving." });
    else if (status === "failed" || status === "canceled") toast({ tone: "danger", title: userMessage ?? "The image didn't finish. Try again." });
  }, [status, userMessage]);
  const what = cover ? "cover image" : "image";
  const upTo = estimate ? fmt.upTo(estimate.maxCostMicros) : null;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <ConfirmDialog
        trigger={
          <Button variant="secondary" className="self-start" disabled={working || !estimate} loading={working}>
            <WandSparkles aria-hidden="true" /> {working ? `Creating ${what}…` : hasImage ? `Replace with a new ${what}` : `Create this ${what}`}
          </Button>
        }
        title={`Create the ${what}?`}
        description={
          <>
            Adds an AI illustration as a new version, labelled AI-generated. You approve again before it posts. Need a real photo of your product or people? Take it yourself.
            {upTo ? <span className="mt-2 block font-medium text-ink">Uses up to {upTo}. Unused credits return.</span> : null}
          </>
        }
        confirmLabel={`Create ${what}${upTo ? ` (up to ${upTo})` : ""}`}
        onConfirm={async () => {
          try {
            const { runId: id } = await create({ slug, artifactId });
            setRunId(id);
          } catch (e) {
            toast({ tone: "danger", title: errorMessage(e) });
          }
        }}
      />
      {upTo && !working ? <p className="text-xs text-ink-3">Up to {upTo}. Unused credits return.</p> : null}
    </div>
  );
}
