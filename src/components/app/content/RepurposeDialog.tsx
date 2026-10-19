"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Repeat2 } from "@/components/icons"
import { useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogTrigger, Field, Input, Textarea, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import { RunDrafts } from "./RunDrafts";
import { RunProgressCompact } from "./RunProgress";

const FORMATS = [
  { value: "linkedin", label: "LinkedIn post" },
  { value: "x", label: "X thread" },
  { value: "instagram", label: "Instagram caption" },
  { value: "facebook", label: "Facebook post" },
  { value: "email", label: "Newsletter email" },
  { value: "video", label: "Short video script" },
] as const;
type Format = (typeof FORMATS)[number]["value"];

/** One piece in, drafts for every channel out. Pass artifactId to repurpose an existing draft. */
export function RepurposeDialog({ slug, artifactId, trigger }: { slug: string; artifactId?: Id<"artifacts">; trigger?: React.ReactNode }) {
  const start = useMutation(api.repurpose.start);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [formats, setFormats] = useState<Set<Format>>(new Set(["linkedin", "x", "instagram", "email"]));
  const [runId, setRunId] = useState<Id<"workflowRuns"> | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setRunId(null);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Repeat2 aria-hidden /> Repurpose
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title="Repurpose" description="One piece in, a draft per channel.">
        {runId ? (
          <div className="flex flex-col gap-3">
            <RunProgressCompact slug={slug} runId={runId} />
            <RunDrafts slug={slug} runId={runId} onOpen={() => setOpen(false)} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {artifactId ? null : (
              <>
                <Field label="Link" optional>
                  <Input value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
                </Field>
                <Field label="Or paste text" optional>
                  <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autosize />
                </Field>
              </>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {FORMATS.map((f) => (
                <Checkbox
                  key={f.value}
                  label={f.label}
                  checked={formats.has(f.value)}
                  onCheckedChange={(on) => {
                    const next = new Set(formats);
                    if (on) next.add(f.value);
                    else next.delete(f.value);
                    setFormats(next);
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-ink-3">About {Math.max(1, Math.round(formats.size * 0.6))} credit{formats.size > 1 ? "s" : ""}.</p>
          </div>
        )}
        <DialogFooter>
          {runId ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <Button
              loading={busy}
              disabled={formats.size === 0 || (!artifactId && !url.trim() && text.trim().length < 80)}
              onClick={async () => {
                setBusy(true);
                try {
                  setRunId(await start({ slug, artifactId, url: url.trim() || undefined, text: text.trim() || undefined, formats: [...formats] }));
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Repeat2 aria-hidden /> Make {formats.size} draft{formats.size === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
