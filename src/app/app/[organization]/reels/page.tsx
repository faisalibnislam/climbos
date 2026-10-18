"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Clapperboard, Copy, Download, ImagePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AssetPicker } from "@/components/app/AssetPicker";
import { RunProgressCompact } from "@/components/app/content/RunProgress";
import { errorMessage } from "@/components/app/errors";
import { microsToCreditsLabel, relativeTime } from "@/components/app/money";
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
      <PageHeader section="reels" title="Reels" intro="Short vertical videos for Instagram Reels, TikTok and YouTube Shorts, made from your own screenshots and photos." />
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Field label="What's the reel about?" hint="E.g. “Show how fast a form goes live” or “Our autumn menu”. Your team picks images from your library and adds a couple only if needed.">
            <Textarea value={brief} onChange={(e) => setBrief(e.target.value.slice(0, 600))} rows={2} autosize />
          </Field>
          <div className="flex flex-col gap-2">
            <Button size="sm" variant="secondary" className="self-start" onClick={() => setChoosing((c) => !c)} aria-expanded={choosing}>
              <ImagePlus aria-hidden /> {picked.length ? `${picked.length} image${picked.length === 1 ? "" : "s"} picked` : "Pick images (optional)"}
            </Button>
            {choosing ? <AssetPicker slug={slug} selected={picked} onChange={setPicked} max={8} label="Images for the reel" /> : null}
          </div>
          <Switch
            label="Open with an AI video clip"
            description={est?.clipsUnlocked ? "A 4-second AI-made shot for the hook (Veo). Rendering stays free." : "Comes with a package."}
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
                  toast({ tone: "success", title: "Making your reel", description: "About a minute." });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Clapperboard aria-hidden /> Make a reel
            </Button>
            {est ? <span className="text-xs text-ink-3">Up to {microsToCreditsLabel(clip && est.clipsUnlocked ? est.withClipsMicros : est.maxCostMicros)}. Rendering is free.</span> : null}
          </div>
        </CardContent>
      </Card>
      {reels === undefined ? (
        <LoadingBlock label="Loading reels…" lines={3} />
      ) : reels.length === 0 ? (
        <EmptyState icon={<Clapperboard />} title="No reels yet" body="Describe one above. Tip: add screenshots and product photos in Images first; real visuals beat stock." />
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
                  {r.status === "failed" ? <Callout tone="danger">{r.error ?? "Something went wrong."}</Callout> : null}
                  {r.status === "ready" && r.isDemo ? <Callout tone="info">Demo: no video was rendered.</Callout> : null}
                  {r.url ? (
                    <video src={r.url} controls playsInline className="aspect-[9/16] w-full rounded-lg bg-black" />
                  ) : null}
                  {r.caption ? <p className="whitespace-pre-wrap text-sm text-ink-2">{r.caption}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {r.artifactId ? (
                      <Button asChild size="sm">
                        <Link href={`/app/${slug}/content/${r.artifactId}`}>Approve and post</Link>
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
                        description="The video is deleted and its post is archived. Anything already posted stays on the platform."
                        confirmLabel="Delete reel"
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
                    {r.badge ? " · Free reels carry a small ClimbOS badge" : ""}
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
