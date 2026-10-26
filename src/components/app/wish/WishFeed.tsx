"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CircleCheck, CircleX, Lightbulb, Plug, Sparkles, Zap } from "@/components/icons"
import Link from "next/link";
import { useState } from "react";
import { Button, Skeleton, SocialIcon, Tooltip, networkOf, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { useCostDisplay } from "@/components/app/useCostDisplay";
import { RoleAvatar } from "@/components/app/RoleAvatar";
import { roleTitle } from "@/components/app/roles";
import { cn } from "@/lib/utils";
import { RetryRunIfPossible, RunProgressCompact } from "@/components/app/content/RunProgress";
import { climbTarget } from "@/components/climb/context";
import { wishesFrom } from "./pairing";
import { Prose } from "@/components/ds/content";
import { ActionCardStatus, actionCardSetupHref, actionCardStartLabel, actionCardStatusExplanation } from "@/components/app/ActionCardStatus";
import { wishProgressKind, WISH_PROGRESS_LABELS } from "./progress";

type Today = NonNullable<ReturnType<typeof useQuery<typeof api.workspace.today>>>;
type ChatMessage = Today["chat"][number];
type CardView = ChatMessage["cards"][number];

interface Wish {
  ask: ChatMessage;
  answer: ChatMessage | null;
}

export function WishFeed({ slug, chat }: { slug: string; chat: ChatMessage[] }) {
  const [showAll, setShowAll] = useState(false);
  const wishes = wishesFrom(chat);
  if (wishes.length === 0) return null;
  const shown = showAll ? wishes : wishes.slice(0, 3);
  return (
    <section aria-labelledby="wishes-heading" className="flex flex-col gap-3">
      <h2 id="wishes-heading" className="heading-section">
        Your requests
      </h2>
      <ol className="flex flex-col gap-3" aria-live="polite" aria-relevant="additions text">
        {shown.map((w) => (
          <li key={w.ask.id}>
            <WishCard slug={slug} wish={w} />
          </li>
        ))}
      </ol>
      {wishes.length > 3 ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show ${wishes.length - 3} earlier`}
        </Button>
      ) : null}
    </section>
  );
}

function WishCard({ slug, wish }: { slug: string; wish: Wish }) {
  const { ask, answer } = wish;
  const thinking = ask.status === "thinking" && !answer;
  const failed = ask.status === "failed" && !answer?.cards.length;
  const cards = answer?.cards ?? [];
  const progress = wishProgressKind(cards, thinking, failed);
  const positiveResolution = progress === "completed" || progress === "ready_for_review";
  return (
    <article {...climbTarget("wish", ask.id, ask.text)} className="overflow-hidden rounded-xl border border-line bg-surface">
      <header className="flex items-start gap-3 border-b border-line bg-surface-2/60 px-4 py-3">
        <span aria-hidden className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", thinking ? "bg-sun-soft text-sun-strong" : positiveResolution ? "bg-brand-100 text-brand-800" : "bg-surface-3 text-ink-2")}>
          {thinking ? <Sparkles className="size-4 animate-soft-pulse" /> : positiveResolution ? <CircleCheck className="size-4" /> : <Zap className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">
            <span className="sr-only">You asked: </span>“{ask.text}”
          </p>
          <p className="mt-0.5 text-xs text-ink-3">
            {relativeTime(ask.createdAt)}
            {progress ? ` · ${WISH_PROGRESS_LABELS[progress]}` : ""}
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-3 px-4 py-3">
        {thinking ? (
          ask.runId ? (
            <RunProgressCompact slug={slug} runId={ask.runId as Id<"workflowRuns">} />
          ) : (
            <div className="flex flex-col gap-2" aria-busy="true">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-9" />
            </div>
          )
        ) : failed ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-red-800">{answer?.text ?? "That didn't work. Try again in a moment."}</p>
            <TryWishAgain slug={slug} text={ask.text} />
          </div>
        ) : answer ? (
          <>
            {cards.length > 0 ? (
              <ol className="flex flex-col divide-y divide-line rounded-lg border border-line">
                {cards.map((c) => (
                  <li key={c.id}>
                    <StepRow slug={slug} card={c} />
                  </li>
                ))}
              </ol>
            ) : null}
            {cards.length > 0 ? <AnswerNote text={answer.text} /> : <Prose text={answer.text} max={3} tone="muted" className="text-sm" />}
          </>
        ) : null}
      </div>
    </article>
  );
}

/** The team's note on a wish: one line, or bullets with the first one shown. */
function AnswerNote({ text }: { text: string }) {
  return <Prose text={text} max={1} tone="muted" className="text-sm" />;
}

/** Send the same wish again (a new job; the failed one stays in the history). */
function TryWishAgain({ slug, text }: { slug: string; text: string }) {
  const send = useMutation(api.workspace.sendChat);
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await send({ slug, text });
        } catch (e) {
          toast({ tone: "danger", title: errorMessage(e) });
        } finally {
          setBusy(false);
        }
      }}
    >
      Try again
    </Button>
  );
}

function resultHref(slug: string, card: CardView): string | null {
  if (card.job === "strategy") return `/app/${slug}/plan`;
  if (card.job === "outbound") return `/app/${slug}/outbound`;
  if (card.runId) return `/app/${slug}/work/${card.runId}`;
  return null;
}

function StepRow({ slug, card }: { slug: string; card: CardView }) {
  const fmt = useCostDisplay();
  const run = useMutation(api.workspace.runCard);
  const dismiss = useMutation(api.workspace.dismissCard);
  const [busy, setBusy] = useState(false);
  const role = card.roles[0] ?? "coo";
  const network = card.channel ? networkOf(card.channel) : null;
  const href = resultHref(slug, card);
  const setupHref = actionCardSetupHref(slug, card.kind);
  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Tooltip content={roleTitle(role)}>
          <span tabIndex={0} className="rounded-full">
            <RoleAvatar role={role} size="xs" />
          </span>
        </Tooltip>
        {network ? <SocialIcon network={network} size="sm" /> : card.kind === "note" ? <Lightbulb aria-hidden className="size-4 text-amber-800" /> : null}
        <div className="min-w-0 flex-1">
          <Tooltip content={card.description}>
            <p tabIndex={0} className="truncate text-ui font-medium text-ink">{card.title}</p>
          </Tooltip>
          {actionCardStatusExplanation(card.status, card.externalEffect, card.kind) ? <p className="text-xs text-ink-3">{actionCardStatusExplanation(card.status, card.externalEffect, card.kind)}</p> : null}
          {card.status === "running" && card.runId ? <RunProgressCompact slug={slug} runId={card.runId as Id<"workflowRuns">} className="mt-1.5" /> : card.status === "blocked" || (card.status === "proposed" && card.blockedReason) ? <p className="truncate text-xs text-ink-3">{card.blockedReason}</p> : null}
          {card.status === "failed" && card.runId ? <RetryRunIfPossible slug={slug} runId={card.runId as Id<"workflowRuns">} className="mt-1.5" /> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
        <ActionCardStatus status={card.status} externalEffect={card.externalEffect} kind={card.kind} />
        {card.status === "running" ? (
          null
        ) : card.status === "done" ? (
          href ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={href}>
                <CircleCheck aria-hidden className="text-brand-800" /> See result
              </Link>
            </Button>
          ) : (
            null
          )
        ) : card.status === "failed" ? (
          card.runId ? (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/app/${slug}/work/${card.runId}`}>
                <CircleX aria-hidden className="text-red-800" /> See why
              </Link>
            </Button>
          ) : (
            null
          )
        ) : card.status === "rejected" ? (
          null
        ) : setupHref && card.status === "proposed" ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={setupHref}>
              {card.kind === "connect_account" ? <Plug aria-hidden /> : null}
              {actionCardStartLabel(card.kind, card.externalEffect)}
            </Link>
          </Button>
        ) : card.status === "proposed" ? (
          <>
            {card.costEstimateMicros > 0 ? <span className="text-xs tabular-nums text-ink-3">up to {fmt.upTo(card.costEstimateMicros)}</span> : null}
            <Button
              size="sm"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await run({ slug, cardId: card.id as Id<"actionCards"> });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {actionCardStartLabel(card.kind, card.externalEffect)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dismiss({ slug, cardId: card.id as Id<"actionCards"> }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
              Not now
            </Button>
          </>
        ) : card.status === "blocked" ? (
          null
        ) : null}
      </div>
    </div>
  );
}

/** The step the specialist is on right now, live. */
export function WishFeedSkeleton() {
  return <Skeleton className="h-40 rounded-xl" />;
}
