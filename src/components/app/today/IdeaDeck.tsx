"use client";

/*
 * Ideas as a swipeable card deck: one full idea at a time (nothing cut off), the next ones
 * peeking behind. Swipe right or ✓ to do it, left or ✕ for not now; ← / → keys too.
 * Notes ("Got it") are free; jobs show their credit cap before you commit.
 */
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { Check, CircleDashed, Lightbulb, Magic, ShieldCheck, X } from "@/components/icons";
import { Badge, Button, toast } from "@/components/ui";
import { Scannable } from "@/components/ds/content";
import { errorMessage } from "@/components/app/errors";
import { microsToCreditsLabel } from "@/components/app/money";
import { RoleAvatar } from "@/components/app/RoleAvatar";
import { roleTitle } from "@/components/app/roles";
import { cn } from "@/lib/utils";
import { actionCardSetupHref, actionCardStartLabel } from "@/components/app/ActionCardStatus";

export interface IdeaCard {
  id: string;
  title: string;
  description: string;
  proposedEffect: string;
  kind: string;
  roles: string[];
  costEstimateMicros: number;
  externalEffect: boolean;
  status: string;
  blockedReason: string | null;
}

const THRESHOLD = 110;

function prefersReduced() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

function CardFace({ card }: { card: IdeaCard }) {
  const role = card.roles[0] ?? "coo";
  const note = card.kind === "note";
  const blocked = card.status === "blocked";
  return (
    <div className="flex flex-col gap-4 p-[var(--card-p)]">
      <div className="flex items-center gap-2.5">
        <RoleAvatar role={role} size="sm" />
        <span className="min-w-0 flex-1 truncate text-xs text-ink-3">{roleTitle(role)}</span>
        {blocked ? (
          <Badge tone="amber" icon={<CircleDashed />}>
            Needs setup
          </Badge>
        ) : note ? (
          <Badge tone="neutral" icon={<Lightbulb />}>
            Note
          </Badge>
        ) : (
          <Badge tone="brand" icon={<Magic />}>
            {card.costEstimateMicros > 0 ? `Up to ${microsToCreditsLabel(card.costEstimateMicros)}` : "Free"}
          </Badge>
        )}
      </div>
      <h3 className="heading-card text-ink">{card.title}</h3>
      {card.description && card.description !== card.title ? <Scannable text={card.description} max={4} tone="muted" /> : null}
      {card.proposedEffect ? (
        <div className="rounded-[var(--radius-control)] bg-surface-2 px-3 py-2">
          <p className="text-overline mb-1">What happens</p>
          <Scannable text={card.proposedEffect} max={3} />
        </div>
      ) : null}
      {blocked && card.blockedReason ? <p className="rounded-[var(--radius-control)] bg-amber-100 px-3 py-2 text-ui text-amber-800">{card.blockedReason}</p> : null}
      {card.externalEffect && !note ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-3">
          <ShieldCheck aria-hidden className="size-3.5 text-brand-800" /> This prepares it for your review. Nothing goes live.
        </p>
      ) : null}
    </div>
  );
}

export function IdeaDeck({ slug, cards }: { slug: string; cards: IdeaCard[] }) {
  const router = useRouter();
  const run = useMutation(api.workspace.runCard);
  const dismiss = useMutation(api.workspace.dismissCard);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<null | "left" | "right">(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; id: number } | null>(null);

  const deck = cards.filter((c) => !gone.has(c.id));
  const top = deck[0];
  const total = cards.length;
  const position = total - deck.length + 1;

  const decide = async (dir: "left" | "right") => {
    if (!top || busy) return;
    const setupHref = actionCardSetupHref(slug, top.kind);
    if (dir === "right" && setupHref) {
      router.push(setupHref);
      return;
    }
    if (dir === "right" && top.status === "blocked") {
      toast({ tone: "info", title: "Needs setup first", description: top.blockedReason ?? undefined });
      setDx(0);
      return;
    }
    setBusy(true);
    setLeaving(dir);
    const id = top.id;
    const wait = prefersReduced() ? 0 : 220;
    try {
      await Promise.all([
        dir === "right" ? run({ slug, cardId: id as Id<"actionCards"> }) : dismiss({ slug, cardId: id as Id<"actionCards"> }),
        new Promise((r) => setTimeout(r, wait)),
      ]);
      setGone((g) => new Set(g).add(id));
      if (dir === "right") toast({ tone: "success", title: top.kind === "note" ? "Noted" : "On it", description: top.kind === "note" ? undefined : "Your team started. Follow it in Latest work." });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setLeaving(null);
      setDx(0);
      setBusy(false);
    }
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (busy || (e.target as HTMLElement).closest("button, a")) return;
    start.current = { x: e.clientX, id: e.pointerId };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (start.current?.id === e.pointerId) setDx(e.clientX - start.current.x);
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    if (start.current?.id !== e.pointerId) return;
    start.current = null;
    setDragging(false);
    if (dx > THRESHOLD) void decide("right");
    else if (dx < -THRESHOLD) void decide("left");
    else setDx(0);
  };

  if (!top) {
    return total ? (
      <div className="flex flex-col items-center gap-1 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface/60 px-6 py-8 text-center">
        <Check aria-hidden className="size-5 text-brand-800" />
        <p className="heading-empty">All ideas handled</p>
      </div>
    ) : null;
  }

  const x = leaving === "right" ? 640 : leaving === "left" ? -640 : dx;
  const rot = Math.max(-12, Math.min(12, x / 22));
  const yes = Math.min(1, Math.max(0, dx / THRESHOLD));
  const no = Math.min(1, Math.max(0, -dx / THRESHOLD));
  const note = top.kind === "note";

  return (
    <div
      className="flex flex-col gap-3 outline-none"
      tabIndex={0}
      role="group"
      aria-roledescription="card deck"
      aria-label={`Idea ${position} of ${total}. Right arrow to ${note ? "mark as read" : actionCardStartLabel(top.kind, top.externalEffect).toLowerCase()}, left arrow for not now.`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          void decide("right");
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          void decide("left");
        }
      }}
    >
      <div className="relative pb-4">
        {/* Next cards peeking behind */}
        {deck.slice(1, 3).map((c, i) => (
          <div
            key={c.id}
            aria-hidden
            className="absolute inset-x-0 top-0 h-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)] transition-transform duration-200 motion-reduce:transition-none"
            style={{ transform: `translateY(${(i + 1) * 8}px) scale(${1 - (i + 1) * 0.035})`, zIndex: 2 - i, opacity: 1 - (i + 1) * 0.25 }}
          />
        ))}
        <div
          key={top.id}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={cn(
            "relative z-10 touch-pan-y cursor-grab select-none overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-[var(--card-shadow)] active:cursor-grabbing",
            dx > 20 ? "border-brand-700" : dx < -20 ? "border-line-strong" : "border-line",
            !dragging && "transition-transform duration-200 ease-out motion-reduce:transition-none",
          )}
          style={{ transform: `translateX(${x}px) rotate(${rot}deg)` }}
        >
          {/* Swipe labels */}
          <span aria-hidden className="pointer-events-none absolute right-4 top-4 z-10 rounded-[var(--radius-badge)] border-2 border-brand-800 bg-lime px-2 py-0.5 text-xs font-semibold tracking-wide text-ink" style={{ opacity: yes, transform: "rotate(8deg)" }}>
            {actionCardStartLabel(top.kind, top.externalEffect).toUpperCase()}
          </span>
          <span aria-hidden className="pointer-events-none absolute left-4 top-4 z-10 rounded-[var(--radius-badge)] border-2 border-ink-3 bg-surface px-2 py-0.5 text-xs font-semibold tracking-wide text-ink-2" style={{ opacity: no, transform: "rotate(-8deg)" }}>
            NOT NOW
          </span>
          <CardFace card={top} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={() => void decide("left")} disabled={busy} aria-label="Not now">
          <X aria-hidden /> Not now
        </Button>
        <span className="flex-1 text-center text-xs tabular-nums text-ink-3" aria-live="polite">
          {position} / {total}
        </span>
        <Button onClick={() => void decide("right")} loading={busy && leaving === "right"} disabled={busy || top.status === "blocked"}>
          <Check aria-hidden /> {actionCardStartLabel(top.kind, top.externalEffect)}
        </Button>
      </div>
    </div>
  );
}
