"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ExternalLink, Plus, X } from "@/components/icons"
import { useState } from "react";
import { Button, Card, CardContent, ColorPicker, Field, Input, Switch, Textarea, toast } from "@/components/ui";
import { errorMessage } from "./errors";

type Form = { title: string; bio: string; color: string; links: { label: string; url: string }[]; collectEmails: boolean; live: boolean };

/** Link in bio editor (one page per workspace). */
export function BioEditor({ slug, defaultTitle, canEdit = true }: { slug: string; defaultTitle: string; canEdit?: boolean }) {
  const data = useQuery(api.bio.get, { slug });
  const save = useMutation(api.bio.save);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  if (data === undefined) return null;
  // Roles that can't edit see the live link only.
  if (!canEdit) {
    return data?.live ? (
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2">
          <p className="heading-card">Link in bio</p>
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 underline-offset-2 hover:underline">
            {data.url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3.5" aria-hidden />
          </a>
          <p className="basis-full text-sm text-ink-3">{data.views} views</p>
        </CardContent>
      </Card>
    ) : null;
  }
  const f: Form = form ?? (data ? { title: data.title, bio: data.bio, color: data.color, links: data.links.map((l) => ({ label: l.label, url: l.url })), collectEmails: data.collectEmails, live: data.live } : { title: defaultTitle, bio: "", color: "#0b5d46", links: [{ label: "Book a call", url: "" }], collectEmails: true, live: true });
  const set = (patch: Partial<Form>) => setForm({ ...f, ...patch });
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="heading-card">Link in bio</p>
          {data?.live ? (
            <a href={data.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand-800 underline-offset-2 hover:underline">
              {data.url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
        <p className="text-sm text-ink-3">One link for your Instagram or TikTok bio. Every button is a tracked link{data ? ` · ${data.views} views` : ""}.</p>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Name">
            <Input value={f.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <ColorPicker label="Colour" value={f.color} onChange={(hex) => set({ color: hex })} />
        </div>
        <Field label="Short bio" optional>
          <Textarea value={f.bio} onChange={(e) => set({ bio: e.target.value })} rows={2} autosize />
        </Field>
        <div className="flex flex-col gap-2">
          {f.links.map((l, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2">
              <Input aria-label={`Button ${i + 1} label`} value={l.label} placeholder="Button text" onChange={(e) => set({ links: f.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <Input aria-label={`Button ${i + 1} link`} value={l.url} placeholder="https://…" onChange={(e) => set({ links: f.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
              <Button size="sm" variant="ghost" aria-label="Remove button" onClick={() => set({ links: f.links.filter((_, j) => j !== i) })}>
                <X aria-hidden />
              </Button>
              {data?.links[i] && data.links[i].url === l.url ? <span className="col-span-3 -mt-1 text-xs text-ink-3">{data.links[i].clicks} click{data.links[i].clicks === 1 ? "" : "s"}</span> : null}
            </div>
          ))}
          {f.links.length < 12 ? (
            <Button size="sm" variant="ghost" className="self-start" onClick={() => set({ links: [...f.links, { label: "", url: "" }] })}>
              <Plus aria-hidden /> Button
            </Button>
          ) : null}
        </div>
        <Switch label="Collect emails" description="Sign-ups go to your Pipeline." checked={f.collectEmails} onCheckedChange={(v) => set({ collectEmails: v })} />
        <Switch label="Live" checked={f.live} onCheckedChange={(v) => set({ live: v })} />
        <Button
          className="self-start"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await save({ slug, ...f, links: f.links.filter((l) => l.label.trim() && l.url.trim()) });
              setForm(null);
              toast({ tone: "success", title: "Link in bio saved" });
            } catch (e) {
              toast({ tone: "danger", title: errorMessage(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
