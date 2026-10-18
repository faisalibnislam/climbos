"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Copy, Link2, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Badge, Button, Card, CardContent, EmptyState, Field, Input, Select, Switch, toast } from "@/components/ui";

const CHANNELS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "tiktok", label: "TikTok" },
  { value: "email", label: "Email" },
  { value: "link", label: "Other" },
];

/** Tracked links: short links with UTM tags and real click counts. */
export default function LinksPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.links.list, { slug });
  const create = useMutation(api.links.create);
  const remove = useMutation(api.links.remove);
  const setTracking = useMutation(api.links.setTracking);
  const [url, setUrl] = useState("");
  const [channel, setChannel] = useState("instagram");
  const [campaign, setCampaign] = useState("");
  const [busy, setBusy] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: "success", title: "Link copied" });
    } catch {
      toast({ tone: "info", title: "Link ready", description: text });
    }
  };
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader section="links" title="Links" intro={`Short links that count real clicks (not bots) and tag visits for your analytics.${data ? ` ${data.weekTotal} click${data.weekTotal === 1 ? "" : "s"} in the last 7 days.` : ""}`} />
      {data ? <Switch label="Track links in new drafts" description="Posts and emails get a short link; ads keep your page with UTM tags." checked={data.tracking} onCheckedChange={(on) => setTracking({ slug, on }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))} /> : null}
      <Card>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const made = await create({ slug, url, channel, campaign: campaign || undefined });
                await copy(made.shortUrl);
                setUrl("");
              } catch (err) {
                toast({ tone: "danger", title: errorMessage(err) });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Page to link to">
              <Input value={url} placeholder="https://yoursite.com/offer" onChange={(e) => setUrl(e.target.value)} />
            </Field>
            <Field label="Where you'll share it">
              <Select options={CHANNELS} value={channel} onValueChange={setChannel} />
            </Field>
            <Field label="Campaign" optional>
              <Input value={campaign} placeholder="autumn-sale" onChange={(e) => setCampaign(e.target.value)} />
            </Field>
            <Button type="submit" loading={busy} disabled={url.trim().length < 4}>
              <Link2 aria-hidden /> Make link
            </Button>
          </form>
        </CardContent>
      </Card>
      {data === undefined ? (
        <LoadingBlock label="Loading links…" lines={3} />
      ) : data.links.length === 0 ? (
        <EmptyState icon={<Link2 />} title="No links yet" body="Make one above, or create posts: each draft with a link gets a tracked one." />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{l.label}</p>
                <p className="truncate text-xs text-ink-3">
                  {l.shortUrl.replace(/^https?:\/\//, "")} → {l.url.replace(/^https?:\/\//, "").split("?")[0]}
                </p>
              </div>
              {l.channel ? <Badge tone="neutral">{CHANNELS.find((c) => c.value === l.channel)?.label ?? l.channel}</Badge> : null}
              {l.source === "auto" ? <Badge tone="blue">From a draft</Badge> : null}
              <div className="w-28 text-right">
                <p className="text-sm font-semibold tabular-nums text-ink">{l.clicks.toLocaleString("en-US")} click{l.clicks === 1 ? "" : "s"}</p>
                <p className="text-xs text-ink-3">{l.week} this week{l.lastClickAt ? ` · ${relativeTime(l.lastClickAt)}` : ""}</p>
              </div>
              <Button size="sm" variant="secondary" aria-label="Copy link" onClick={() => copy(l.shortUrl)}>
                <Copy aria-hidden />
              </Button>
              {l.source === "manual" ? (
                <Button size="sm" variant="ghost" aria-label="Delete link" onClick={() => remove({ slug, id: l.id })}>
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
