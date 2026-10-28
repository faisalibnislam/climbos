"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { FlaskConical } from "@/components/icons"
import { useState } from "react";
import { Badge, Button, Input, Progress, toast } from "@/components/ui";
import { errorMessage } from "./errors";

/** A/B test card: an approver starts the exact test; no result is applied automatically. */
export function AbTestPanel({ slug, kind, targetId, current, canApprove }: { slug: string; kind: "landing" | "email_subject"; targetId: Id<"landingPages"> | Id<"outboundCampaigns">; current: string; canApprove: boolean }) {
  const tests = useQuery(api.abtests.forTarget, { slug, targetId });
  const startLanding = useMutation(api.abtests.startLanding);
  const startSubject = useMutation(api.abtests.startSubject);
  const stop = useMutation(api.abtests.stop);
  const applyWinner = useMutation(api.abtests.applyWinner);
  const [b, setB] = useState("");
  const [outcomeWindowDays, setOutcomeWindowDays] = useState(kind === "landing" ? 1 : 7);
  const [busy, setBusy] = useState(false);
  if (tests === undefined) return null;
  const active = tests.find((t) => t.status === "running" || t.status === "maturing");
  const last = tests.find((t) => t.status !== "running" && t.status !== "maturing");
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
  const text = (t: NonNullable<typeof active>, key: string) => {
    const v = t.variants.find((x) => x.key === key)?.value ?? "";
    return kind === "landing" ? ((JSON.parse(v) as { headline?: string }).headline ?? "") : v;
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <FlaskConical className="size-4 text-brand-800" aria-hidden /> A/B test the {label}
      </p>
      {active ? (
        <>
          <ul aria-label="Versions" className="flex flex-col gap-2">
          {active.stats.map((s) => (
            <li key={s.key} className="flex flex-col gap-1">
              <p className="flex justify-between gap-2 text-xs text-ink-2">
                <span className="truncate" title={text(active, s.key)}>
                  <strong>{s.key}</strong> · {text(active, s.key)}
                </span>
                <span className="shrink-0 tabular-nums">
                  <strong className="font-semibold text-ink">{s.rate}%</strong> · {s.wins}/{s.trials} outcomes · {s.exposed}/{s.assigned} exposed/assigned
                </span>
              </p>
              <Progress value={Math.min(100, s.rate * (kind === "landing" ? 5 : 3))} label={`Version ${s.key} ${metric}`} />
            </li>
          ))}
          </ul>
          <p className="text-xs text-ink-3">
            {active.note}{" "}
            {active.status === "maturing"
              ? `Collecting results until ${active.maturesAt ? new Date(active.maturesAt).toLocaleString() : "it closes"}.`
              : `Result ready ${active.outcomeWindowDays} day${active.outcomeWindowDays === 1 ? "" : "s"} after the sample fills. Nothing live changes on its own.`}
          </p>
          {canApprove ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => run(() => stop({ slug, id: active.id }))}>
                Stop test; apply nothing
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {last ? (
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
              <Badge tone={last.status === "invalid" ? "amber" : last.winner === "B" && last.status !== "stopped" ? "green" : "neutral"}>
                Last test: {last.status === "invalid" ? "invalid split" : last.status === "stopped" ? "stopped; no version applied" : last.winner === "B" ? "B favored in this sample" : last.winner === "A" && /no clear difference/i.test(last.note) ? "no clear difference; original kept" : last.winner === "A" ? "A favored in this sample" : "no clear difference"}
              </Badge>
              {last.note}
            </p>
          ) : (
            <p className="text-xs text-ink-3">50/50 split by {metric}. Results are signals, not proof.</p>
          )}
          {canApprove && last?.winner === "B" && last.status === "done" && !last.appliedAt ? <Button size="sm" loading={busy} onClick={() => run(() => applyWinner({ slug, id: last.id }))}>Review and apply exact version B</Button> : null}
          {canApprove ? (
            <div className="flex flex-col gap-2">
              <Input value={b} placeholder={`Now: “${current.slice(0, 40)}”`} aria-label={`Second ${label}`} onChange={(e) => setB(e.target.value)} />
              <label className="flex items-center gap-2 text-xs text-ink-2">
                Outcome window (days)
                <Input type="number" min={0} max={30} step={1} value={outcomeWindowDays} aria-label="Outcome window in days" onChange={(e) => setOutcomeWindowDays(Number(e.target.value))} />
              </label>
              <p className="text-xs text-ink-3">Default: 1 day for leads, 7 for replies. Adjust to how long yours take.</p>
              <Button
                size="sm"
                loading={busy}
                disabled={b.trim().length < 3 || !Number.isInteger(outcomeWindowDays) || outcomeWindowDays < 0 || outcomeWindowDays > 30}
                onClick={() =>
                  run(async () => {
                    if (kind === "landing") await startLanding({ slug, pageId: targetId as Id<"landingPages">, headline: b, outcomeWindowDays });
                    else await startSubject({ slug, campaignId: targetId as Id<"outboundCampaigns">, subject: b, outcomeWindowDays });
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
