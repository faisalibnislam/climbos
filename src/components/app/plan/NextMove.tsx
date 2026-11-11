"use client";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import type { PlayView } from "./ExpertPlan";

/** Preparation goes through the existing scoped request flow; this button grants no publishing permission. */
export function NextMove({ slug, strategyId, play, summary, canEdit, stale, onDetails }: { slug: string; strategyId: Id<"strategies">; play?: Pick<PlayView, "id" | "name" | "oneLiner" | "firstActionToday" | "climbosCanDo">; summary: string; canEdit: boolean; stale: boolean; onDetails: () => void }) {
  const start = useMutation(api.workspace.startPlay);
  const send = useMutation(api.workspace.sendChat);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const prepared = play?.id === "focused";
  return <section aria-labelledby="next-move-heading" className="space-y-3 rounded-xl border border-brand-200 bg-brand-50 p-5">
    <p className="text-overline">Your next step</p><h2 id="next-move-heading" className="heading-section">{play?.name ?? summary}</h2>
    {play ? <><p className="text-sm text-ink-2">{play.oneLiner}</p><p className="text-sm"><strong>Start here: </strong>{play.firstActionToday}</p></> : null}
    <div className="flex flex-wrap gap-2">{play && (canEdit || prepared) ? <Button loading={busy} disabled={stale && !prepared} onClick={async () => {
      if (prepared) { const section = document.getElementById("prepared-work"); const first = section?.querySelector("details"); if (first) first.open = true; section?.focus({ preventScroll: true }); section?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      setBusy(true); try {
        if (play.id) await start({ slug, strategyId, playId: play.id });
        else await send({ slug, text: `Prepare a draft for this suggested move: ${play.name}. ${play.oneLiner}. First step: ${play.firstActionToday}. Check current plan and facts first. Do not publish, send or spend.` });
        router.push(`/app/${encodeURIComponent(slug)}/work`);
      } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); }
    }}>{play.id === "focused" ? "Review prepared drafts" : "Make it happen"}</Button> : null}<Button variant="secondary" onClick={onDetails}>Why this plan?</Button></div>
    {prepared ? <details className="text-sm"><summary className="min-h-9 cursor-pointer text-ink-2">What AI can do next</summary><p className="py-2 text-ink-2">{play?.climbosCanDo}</p></details> : play?.climbosCanDo ? <p className="text-sm text-ink-2"><strong>AI can prepare: </strong>{play.climbosCanDo}</p> : <p className="text-xs text-ink-3">ClimbOS checks what it can prepare and shows any missing setup. A request does not mean the work is already done.</p>}
    <p className="text-xs text-ink-3">Drafts stay private until you choose to share them. Sending, publishing and ad spending need separate permission.</p>
  </section>;
}
