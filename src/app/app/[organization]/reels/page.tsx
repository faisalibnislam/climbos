"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Clapperboard, Copy, Download, ImagePlus, Trash2 } from "@/components/icons"
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AssetPicker } from "@/components/app/AssetPicker";
import { ClampText } from "@/components/app/results/ClampText";
import { RunProgressCompact } from "@/components/app/content/RunProgress";
import { MessageText } from "@/components/app/content/shared";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { useCostDisplay } from "@/components/app/useCostDisplay";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Badge, Button, Callout, Card, CardContent, ConfirmDialog, EmptyState, Field, Switch, Textarea, toast } from "@/components/ui";

/** Save the video as a file (a plain link would just open it in a new tab: the file is on another domain). */
async function downloadVideo(url: string, name: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const href = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

/** Reels: short vertical videos from your own screenshots and photos, rendered by ClimbOS. */
export default function ReelsPage() {
  const fmt = useCostDisplay();
  const { organization: slug } = useParams<{ organization: string }>();
  const reels = useQuery(api.reels.list, { slug });
  const est = useQuery(api.reels.estimate, { slug });
  const create = useMutation(api.reels.create);
  const remove = useMutation(api.reels.remove);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [clip, setClip] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader section="reels" title="Reels" />
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Field label="What's the reel about?" hint="E.g. “Our autumn menu”">
            <Textarea value={brief} onChange={(e) => setBrief(e.target.value.slice(0, 600))} rows={2} autosize />
          </Field>
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="secondary" className="self-start" onClick={() => setChoosing((c) => !c)} aria-expanded={choosing}>
              <ImagePlus aria-hidden /> {picked.length ? `${picked.length} picked` : "Pick images"}
            </Button>
            {choosing ? <AssetPicker slug={slug} selected={picked} onChange={setPicked} max={8} label="Images" /> : null}
          </div>
          <Switch
            label="AI video hook"
            description={est?.clipsUnlocked ? "4-second AI clip" : "Needs a package"}
            checked={clip && Boolean(est?.clipsUnlocked)}
            disabled={!est?.clipsUnlocked}
            onCheckedChange={setClip}
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              loading={busy}
              disabled={brief.trim().length < 4}
              onClick={async () => {
                setBusy(true);
                try {
                  await create({ slug, brief, clips: clip && est?.clipsUnlocked ? 1 : 0, assetIds: picked.length ? (picked as Id<"assets">[]) : undefined });
                  setBrief("");
                  setPicked([]);
                  setChoosing(false);
                  toast({ tone: "success", title: "Ready in about a minute" });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Clapperboard aria-hidden /> Make reel
            </Button>
            {est ? <span className="text-xs text-ink-3">Up to {fmt.upTo(clip && est.clipsUnlocked ? est.withClipsMicros : est.maxCostMicros)}. Rendering free.</span> : null}
          </div>
        </CardContent>
      </Card>
      {reels === undefined ? (
        <LoadingBlock label="Loading reels…" lines={3} />
      ) : reels.length === 0 ? (
        <EmptyState icon={<Clapperboard />} title="No reels yet" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reels.map((r) => (
            <li key={r.id}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-3">
                  <p className="flex items-center justify-between gap-2">
                    <span className="truncate text-ui font-medium text-ink">{r.title}</span>
                    <Badge tone={r.status === "ready" ? "green" : r.status === "failed" ? "red" : "blue"}>{r.status === "ready" ? `${r.seconds ?? ""}s` : r.status === "failed" ? "Didn't finish" : "Making"}</Badge>
                  </p>
                  {r.status === "working" && r.runId ? <RunProgressCompact slug={slug} runId={r.runId as Id<"workflowRuns">} /> : null}
                  {r.status === "failed" ? <Callout tone="danger"><MessageText text={r.error ?? "Something went wrong."} /></Callout> : null}
                  {r.status === "ready" && r.isDemo ? <Callout tone="info">Demo: no video was rendered.</Callout> : null}
                  {r.url ? (
                    <video src={r.url} controls playsInline className="aspect-[9/16] w-full rounded-lg bg-black" />
                  ) : null}
                  {r.caption ? <ClampText className="whitespace-pre-wrap text-sm text-ink-2">{r.caption}</ClampText> : null}
                  <div className="flex flex-wrap gap-2">
                    {r.artifactId ? (
                      <Button asChild size="sm">
                        <Link href={`/app/${slug}/content/${r.artifactId}`}>Review</Link>
                      </Button>
                    ) : null}
                    {r.url ? (
                      <Button size="sm" variant="secondary" onClick={() => void downloadVideo(r.url!, `${r.title.slice(0, 40).replace(/[^\w\- ]+/g, "")}.mp4`)}>
                        <Download aria-hidden /> Download
                      </Button>
                    ) : null}
                    {r.caption ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await navigator.clipboard.writeText(r.caption!);
                          toast({ tone: "success", title: "Caption copied" });
                        }}
                      >
                        <Copy aria-hidden /> Caption
                      </Button>
                    ) : null}
                    {r.status !== "working" ? (
                      <ConfirmDialog
                        trigger={
                          <Button size="sm" variant="ghost" aria-label={`Delete ${r.title}`}>
                            <Trash2 aria-hidden /> Delete
                          </Button>
                        }
                        title="Delete this reel?"
                        description="Video deleted, post archived. Live posts stay up."
                        confirmLabel="Delete"
                        tone="danger"
                        onConfirm={async () => {
                          try {
                            await remove({ slug, reelId: r.id });
                            toast({ tone: "success", title: "Reel deleted." });
                          } catch (e) {
                            toast({ tone: "danger", title: errorMessage(e) });
                          }
                        }}
                      />
                    ) : null}
                  </div>
                  <p className="text-xs text-ink-3">
                    {relativeTime(r.createdAt)}
                    {r.badge ? " · ClimbOS badge (free plan)" : ""}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
