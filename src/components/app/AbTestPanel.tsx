"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { FlaskConical } from "@/components/icons"
import { useState } from "react";
import { Badge, Button, Input, Progress, toast } from "@/components/ui";
import { errorMessage } from "./errors";

/** A/B test card: start a challenger, watch the numbers, keep the winner (auto-applied when clear). */
export function AbTestPanel({ slug, kind, targetId, current, canEdit }: { slug: string; kind: "landing" | "email_subject"; targetId: Id<"landingPages"> | Id<"outboundCampaigns">; current: string; canEdit: boolean }) {
  const tests = useQuery(api.abtests.forTarget, { slug, targetId });
  const startLanding = useMutation(api.abtests.startLanding);
  const startSubject = useMutation(api.abtests.startSubject);
  const stop = useMutation(api.abtests.stop);
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  if (tests === undefined) return null;
  const running = tests.find((t) => t.status === "running");
  const last = tests.find((t) => t.status !== "running");
  const label = kind === "landing" ? "headline" : "subject line";
  const metric = kind === "landing" ? "leads per view" : "reply rate";
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const text = (t: NonNullable<typeof running>, key: string) => {
    const v = t.variants.find((x) => x.key === key)?.value ?? "";
    return kind === "landing" ? ((JSON.parse(v) as { headline?: string }).headline ?? "") : v;
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <FlaskConical className="size-4 text-brand-800" aria-hidden /> A/B test the {label}
      </p>
      {running ? (
        <>
          <ul aria-label="Versions" className="flex flex-col gap-2">
          {running.stats.map((s) => (
            <li key={s.key} className="flex flex-col gap-1">
              <p className="flex justify-between gap-2 text-xs text-ink-2">
                <span className="truncate" title={text(running, s.key)}>
                  <strong>{s.key}</strong> · {text(running, s.key)}
                </span>
                <span className="shrink-0 tabular-nums">
                  <strong className="font-semibold text-ink">{s.rate}%</strong> · {s.wins}/{s.trials}
                </span>
              </p>
              <Progress value={Math.min(100, s.rate * (kind === "landing" ? 5 : 3))} label={`Version ${s.key} ${metric}`} />
            </li>
          ))}
          </ul>
          <p className="text-xs text-ink-3">{running.note} Winner auto-applied.</p>
          {canEdit ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => run(() => stop({ slug, id: running.id, keep: "A" }))}>
                Stop, keep A
              </Button>
              <Button size="sm" variant="ghost" onClick={() => run(() => stop({ slug, id: running.id, keep: "B" }))}>
                Stop, use B
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {last ? (
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <Badge tone={last.winner === "B" ? "green" : "neutral"}>Last test: {last.winner === "B" ? "B won" : "A kept"}</Badge>
              {last.note}
            </p>
          ) : (
            <p className="text-xs text-ink-3">50/50 split by {metric}. Winner kept.</p>
          )}
          {canEdit ? (
            <div className="flex gap-2">
              <Input value={b} placeholder={`Now: “${current.slice(0, 40)}”`} aria-label={`Second ${label}`} onChange={(e) => setB(e.target.value)} />
              <Button
                size="sm"
                loading={busy}
                disabled={b.trim().length < 3}
                onClick={() =>
                  run(async () => {
                    if (kind === "landing") await startLanding({ slug, pageId: targetId as Id<"landingPages">, headline: b });
                    else await startSubject({ slug, campaignId: targetId as Id<"outboundCampaigns">, subject: b });
                    setB("");
                  })
                }
              >
                Start test
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
