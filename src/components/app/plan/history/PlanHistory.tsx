"use client";

/*
 * Plan version history: a version picker by the title, a bar while viewing an older
 * version, a side-by-side compare with word highlights, and restore (whole plan or
 * chosen parts) as a new version that waits for approval.
 */
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpDown, Check, ChevronDown, History, RotateCcw, X } from "@/components/icons";
import { Badge, Button, Checkbox, Dialog, DialogContent, DialogFooter, Input, Popover, PopoverContent, PopoverTrigger, Select, Skeleton, Switch, Tooltip, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { formatDateTime } from "@/components/app/money";
import { cn } from "@/lib/utils";
import { PLAN_PARTS, describeParts, type PlanPartKey } from "../../../../../shared/planParts";
import { lineDiff, type DiffRow, type WordOp } from "./diff";
import { comparePlans, compareSavedDecisions, type ComparableExperiment, type ComparablePlan, type PartComparison } from "./parts";
import { DecisionChangesSummary } from "./DecisionChangesSummary";

type Version = NonNullable<ReturnType<typeof useQuery<typeof api.planHistory.versions>>>[number];

const STATUS: Record<string, { label: string; tone: "amber" | "neutral" | "red" | "green" }> = {
  needs_approval: { label: "Needs approval", tone: "amber" },
  draft: { label: "Sent back", tone: "red" },
  approved: { label: "Approved", tone: "green" },
  superseded: { label: "Replaced", tone: "neutral" },
};

function shortDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Tags shown on a version wherever it appears. */
export function VersionTags({ v, withStatus = true }: { v: Pick<Version, "isLatest" | "inUse" | "status">; withStatus?: boolean }) {
  const st = STATUS[v.status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {v.isLatest ? <Badge tone="brand">Latest</Badge> : null}
      {v.inUse ? (
        <Badge tone="green" icon={<Check />}>
          In use
        </Badge>
      ) : null}
      {withStatus && st && v.status !== "approved" ? <Badge tone={st.tone}>{st.label}</Badge> : null}
    </span>
  );
}

export function usePlanVersions(slug: string) {
  return useQuery(api.planHistory.versions, { slug });
}

/** "Version 4 · Latest ▾": opens every version with date, status, why it changed and who approved it. */
export function VersionPicker({ versions, viewingId, onView, onCompare, slug, canEdit = false }: { versions: Version[]; viewingId: string | null; onView: (id: Id<"strategies">) => void; onCompare: () => void; slug?: string; canEdit?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = versions.find((v) => v.id === viewingId) ?? versions[0];
  if (!current) return null;
  const many = versions.length > 1;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-[var(--h-sm)] items-center gap-2 rounded-[var(--radius-control)] border border-[var(--btn-2-border)] bg-[var(--btn-2-bg)] px-2.5 text-ui font-medium text-ink shadow-[var(--btn-2-shadow)] hover:bg-surface-2"
          aria-label={`Version ${current.version}${current.name ? `, ${current.name}` : ""}. Open version history`}
        >
          <History aria-hidden className="size-4 text-ink-3" />
          Version {current.version}
          {current.name ? <span className="max-w-48 truncate text-ink-2">· {current.name}</span> : null}
          {/* One version: no tags (owner, 2026-10-19). */}
          {many ? <VersionTags v={current} /> : null}
          <ChevronDown aria-hidden className="size-3.5 text-ink-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(26rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <p className="text-overline">Version history</p>
          <span className="text-xs tabular-nums text-ink-3">{versions.length}</span>
        </div>
        <ol className="max-h-[60vh] overflow-y-auto p-1" aria-label="Plan versions">
          {versions.map((v) => {
            const selected = v.id === current.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => {
                    onView(v.id);
                    setOpen(false);
                  }}
                  className={cn("flex w-full items-start gap-3 rounded-[var(--radius-control)] px-2.5 py-2 text-left transition-colors hover:bg-surface-2", selected && "bg-surface-2")}
                >
                  <span className={cn("mt-0.5 grid h-6 min-w-8 place-items-center rounded-[var(--radius-badge)] px-1 text-xs font-semibold tabular-nums", v.inUse ? "bg-brand-800 text-white" : v.isLatest ? "bg-lime text-ink" : "bg-surface-3 text-ink-2")}>v{v.version}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {v.name ? <span className="max-w-full truncate text-ui font-medium text-ink">{v.name}</span> : null}
                      <span className="text-ui text-ink-2">{formatDateTime(v.createdAt)}</span>
                      {many ? <VersionTags v={v} /> : null}
                    </span>
                    <Tooltip content={v.reason}>
                      <span className="mt-0.5 block truncate text-ui text-ink">{v.reason}</span>
                    </Tooltip>
                    {v.approvedBy || v.wasApproved ? (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-green-800">
                        <Check aria-hidden className="size-3" />
                        Approved{v.approvedBy ? ` by ${v.approvedBy}` : ""}
                        {v.approvedAt ? ` · ${shortDate(v.approvedAt)}` : ""}
                      </span>
                    ) : null}
                  </span>
                  {selected ? <Check aria-hidden className="mt-1 size-4 text-ink" /> : null}
                </button>
              </li>
            );
          })}
        </ol>
        {canEdit && slug ? <VersionNameForm key={`${current.id}:${current.name ?? ""}`} slug={slug} version={current} /> : null}
        {many ? (
          <div className="border-t border-line p-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => {
                setOpen(false);
                onCompare();
              }}
            >
              <ArrowUpDown aria-hidden /> Compare versions
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** Name the version on screen, e.g. "Spring launch". A label only: the plan and its approval don't change. */
function VersionNameForm({ slug, version }: { slug: string; version: Version }) {
  const rename = useMutation(api.planHistory.renameVersion);
  const [name, setName] = useState(version.name ?? "");
  const [busy, setBusy] = useState(false);
  const changed = name.trim() !== (version.name ?? "");
  return (
    <form
      className="flex items-end gap-2 border-t border-line p-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!changed) return;
        setBusy(true);
        try {
          await rename({ slug, strategyId: version.id, name });
          toast({ tone: "success", title: name.trim() ? `Version ${version.version} named` : "Name removed" });
        } catch (err) {
          toast({ tone: "danger", title: errorMessage(err) });
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-ink-2">
        Name for version {version.version}
        <Input value={name} maxLength={60} placeholder="For example: Spring launch" onChange={(e) => setName(e.target.value)} disabled={busy} className="h-8" />
      </label>
      <Button type="submit" size="sm" variant="secondary" disabled={busy || !changed}>
        {busy ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}

/** Shown while an older version is on screen: read-only, with compare, restore and a way back. */
export function OlderVersionBar({ version, latest, canEdit, onBack, onCompare, onRestore }: { version: Version; latest: Version; canEdit: boolean; onBack: () => void; onCompare: () => void; onRestore: () => void }) {
  return (
    <div role="region" aria-label="Viewing an older version" className="sticky top-14 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-card)] border border-line bg-cream px-4 py-2.5 shadow-[var(--card-shadow)]">
      <History aria-hidden className="size-4 text-ink-2" />
      <p className="flex flex-wrap items-center gap-2 text-ui text-ink">
        <span className="font-medium">Viewing v{version.version}</span>
        <span className="text-ink-2">{shortDate(version.createdAt)} · read-only</span>
        <VersionTags v={version} />
      </p>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onCompare}>
          <ArrowUpDown aria-hidden /> Compare with v{latest.version}
        </Button>
        {canEdit ? (
          <Button size="sm" variant="secondary" onClick={onRestore}>
            <RotateCcw aria-hidden /> Restore
          </Button>
        ) : null}
        <Button size="sm" onClick={onBack}>
          Back to latest <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function usePlanSide(slug: string, id: Id<"strategies"> | null) {
  const data = useQuery(api.workspace.plan, id ? { slug, strategyId: id } : "skip");
  return useMemo(() => {
    if (!data?.strategy) return data === undefined ? undefined : null;
    return { plan: data.strategy as unknown as ComparablePlan, experiments: data.experiments as ComparableExperiment[] };
  }, [data]);
}

function useRestore(slug: string, onDone: (id: Id<"strategies">) => void) {
  const restore = useMutation(api.planHistory.restore);
  const [busy, setBusy] = useState(false);
  const run = async (fromId: Id<"strategies">, parts: PlanPartKey[]) => {
    setBusy(true);
    try {
      const r = await restore({ slug, fromId, parts });
      toast({ tone: "success", title: `Version ${r.version} created`, description: "Waiting for your approval." });
      onDone(r.strategyId);
      return true;
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}

/** Pick parts of an older version to bring back; parts that differ from the latest are marked. */
export function RestoreDialog({ slug, from, latest, open, onOpenChange, onRestored }: { slug: string; from: Version; latest: Version; open: boolean; onOpenChange: (o: boolean) => void; onRestored: (id: Id<"strategies">) => void }) {
  const a = usePlanSide(slug, open ? from.id : null);
  const b = usePlanSide(slug, open ? latest.id : null);
  const parts = useMemo(() => (a && b ? comparePlans(a.plan, a.experiments, b.plan, b.experiments) : null), [a, b]);
  const [picked, setPicked] = useState<Set<PlanPartKey> | null>(null);
  const chosen = picked ?? new Set(parts?.filter((p) => p.changed).map((p) => p.key) ?? []);
  const { run, busy } = useRestore(slug, (id) => {
    onOpenChange(false);
    setPicked(null);
    onRestored(id);
  });
  const all = chosen.size === PLAN_PARTS.length;
  const toggle = (k: PlanPartKey) => {
    const n = new Set(chosen);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    setPicked(n);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={`Restore from v${from.version}`} className="max-w-md">
        {!parts ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {PLAN_PARTS.slice(0, 5).map((p) => (
              <Skeleton key={p.key} className="h-8" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-ui text-ink-2">{parts.filter((p) => p.changed).length} parts differ from v{latest.version}</p>
              <Button size="sm" variant="ghost" onClick={() => setPicked(all ? new Set() : new Set(PLAN_PARTS.map((p) => p.key)))}>
                {all ? "Clear" : "Whole plan"}
              </Button>
            </div>
            <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line">
              {parts.map((p) => (
                <li key={p.key} className="flex items-center gap-3 px-3">
                  <Checkbox checked={chosen.has(p.key)} onCheckedChange={() => toggle(p.key)} label={p.label} className="flex-1" />
                  {p.changed ? <Badge tone="amber">Different</Badge> : <span className="text-xs text-ink-3">Same</span>}
                </li>
              ))}
            </ul>
            <p className="text-trust text-sm">Creates v{latest.version + 1} for your approval. Nothing changes until you approve.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!chosen.size || !parts} onClick={() => run(from.id, [...chosen])}>
            <RotateCcw aria-hidden /> {all ? "Restore whole plan" : `Restore ${chosen.size || ""} part${chosen.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Words({ ops, side }: { ops: WordOp[]; side: "left" | "right" }) {
  return (
    <>
      {ops.map((o, i) =>
        o.t === "same" ? (
          <span key={i}>{o.text}</span>
        ) : side === "left" ? (
          <del key={i} className="rounded-[2px] bg-red-100 text-red-800 decoration-red-800/50">
            {o.text}
          </del>
        ) : (
          <ins key={i} className="rounded-[2px] bg-green-100 text-green-800 no-underline">
            {o.text}
          </ins>
        ),
      )}
    </>
  );
}

function DiffCell({ ops, side, kind }: { ops: WordOp[] | null; side: "left" | "right"; kind: DiffRow["kind"] }) {
  if (!ops) return <div className="hidden bg-surface-2/60 md:block" aria-hidden />;
  const indent = ops[0]?.text.startsWith("  ");
  const tint = kind === "same" ? "" : side === "left" ? "bg-red-100/40" : "bg-green-100/40";
  return (
    <div className={cn("px-3 py-1.5 text-ui leading-5 text-ink", tint, indent && "pl-7 text-ink-2")}>
      {kind === "removed" || kind === "added" ? (
        <span className={cn("mr-1.5 inline-block w-3 font-semibold", side === "left" ? "text-red-800" : "text-green-800")} aria-hidden>
          {side === "left" ? "−" : "+"}
        </span>
      ) : null}
      <Words ops={ops} side={side} />
    </div>
  );
}

function PartDiff({ part, leftLabel, rightLabel, selectable, selected, onToggle }: { part: PartComparison; leftLabel: string; rightLabel: string; selectable: boolean; selected: boolean; onToggle: () => void }) {
  const [open, setOpen] = useState(true);
  const rows = useMemo(() => lineDiff(part.left, part.right), [part]);
  const adds = rows.filter((r) => r.kind === "added" || r.kind === "changed").length;
  const dels = rows.filter((r) => r.kind === "removed" || r.kind === "changed").length;
  const id = `cmp-${part.key}`;
  return (
    <section aria-labelledby={id} className={cn("overflow-hidden rounded-[var(--radius-card)] border bg-surface shadow-[var(--card-shadow)]", selected ? "border-ink" : "border-line")}>
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown aria-hidden className={cn("size-4 text-ink-3 transition-transform motion-reduce:transition-none", !open && "-rotate-90")} />
          <h3 id={id} className="heading-card">
            {part.label}
          </h3>
          {part.changed ? (
            <span className="flex items-center gap-1.5 text-xs tabular-nums">
              <span className="rounded-[var(--radius-badge)] bg-red-100 px-1.5 text-red-800">−{dels}</span>
              <span className="rounded-[var(--radius-badge)] bg-green-100 px-1.5 text-green-800">+{adds}</span>
            </span>
          ) : (
            <span className="text-xs text-ink-3">No change</span>
          )}
        </button>
        {selectable && part.changed ? <Checkbox checked={selected} onCheckedChange={onToggle} label={`Use ${leftLabel}`} /> : null}
      </header>
      {open && part.changed ? (
        <div className="border-t border-line">
          <div className="grid grid-cols-1 border-b border-line bg-surface-2 text-xs font-medium text-ink-3 md:grid-cols-2">
            <span className="px-3 py-1.5">{leftLabel}</span>
            <span className="hidden border-l border-line px-3 py-1.5 md:block">{rightLabel}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 md:[&>*:nth-child(even)]:border-l md:[&>*:nth-child(even)]:border-line">
            {rows.map((r, i) => (
              <RowPair key={i} row={r} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RowPair({ row }: { row: DiffRow }) {
  return (
    <>
      <DiffCell ops={row.left} side="left" kind={row.kind} />
      <DiffCell ops={row.right} side="right" kind={row.kind} />
    </>
  );
}

/** Side-by-side compare of two versions, with part-by-part restore from the older one. */
export function PlanCompare({ slug, versions, initialLeft, initialRight, canEdit, onClose, onRestored }: { slug: string; versions: Version[]; initialLeft: Id<"strategies">; initialRight: Id<"strategies">; canEdit: boolean; onClose: () => void; onRestored: (id: Id<"strategies">) => void }) {
  const [leftId, setLeftId] = useState<Id<"strategies">>(initialLeft);
  const [rightId, setRightId] = useState<Id<"strategies">>(initialRight);
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [selected, setSelected] = useState<Set<PlanPartKey>>(new Set());
  const a = usePlanSide(slug, leftId);
  const b = usePlanSide(slug, rightId);
  const L = versions.find((v) => v.id === leftId);
  const R = versions.find((v) => v.id === rightId);
  const latest = versions[0];
  const parts = useMemo(() => (a && b ? comparePlans(a.plan, a.experiments, b.plan, b.experiments) : null), [a, b]);
  const decisionChanges = useMemo(() => (a && b ? compareSavedDecisions(a.plan, b.plan) : null), [a, b]);
  const changed = parts?.filter((p) => p.changed) ?? [];
  // Parts can be restored from the left side when the right side is the latest version.
  const selectable = canEdit && Boolean(L && R && R.isLatest && !L.isLatest);
  const { run, busy } = useRestore(slug, (id) => {
    setSelected(new Set());
    onRestored(id);
  });
  const options = versions.map((v) => ({ value: v.id, label: `v${v.version}${v.name ? ` ${v.name}` : ""} · ${shortDate(v.createdAt)}${v.isLatest ? " · Latest" : ""}${v.inUse ? " · In use" : ""}` }));
  const label = (v?: Version) => (v ? `v${v.version}${v.name ? ` (${v.name})` : ""}${v.isLatest ? " (latest)" : ""}` : "");
  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 shadow-[var(--card-shadow)]">
        <h2 id="compare-heading" className="heading-section mr-2">
          Compare
        </h2>
        <Select aria-label="Older version" value={leftId} onValueChange={(v) => setLeftId(v as Id<"strategies">)} options={options} className="w-52" />
        <Tooltip content="Swap sides">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Swap sides"
            onClick={() => {
              setLeftId(rightId);
              setRightId(leftId);
              setSelected(new Set());
            }}
          >
            <ArrowUpDown aria-hidden className="rotate-90" />
          </Button>
        </Tooltip>
        <Select aria-label="Newer version" value={rightId} onValueChange={(v) => setRightId(v as Id<"strategies">)} options={options} className="w-52" />
        <div className="ml-auto flex items-center gap-4">
          <Switch label="Only changes" checked={onlyChanges} onCheckedChange={setOnlyChanges} showStateText={false} />
          <Button size="sm" variant="secondary" onClick={onClose}>
            <X aria-hidden /> Close
          </Button>
        </div>
      </div>

      {!parts ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" role="status">
            <span className="text-ui text-ink-2">
              <span className="font-semibold text-ink tabular-nums">{changed.length}</span> of {parts.length} parts changed
            </span>
            {parts.map((p) => (
              <a key={p.key} href={`#cmp-${p.key}`} className={cn("rounded-[var(--radius-badge)] px-2 py-0.5 text-xs", p.changed ? "bg-amber-100 text-amber-800" : "bg-surface-3 text-ink-3")}>
                {p.label}
              </a>
            ))}
          </div>
          <DecisionChangesSummary changes={decisionChanges} beforeLabel={label(L)} afterLabel={label(R)} />
          {!changed.length ? (
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-8 text-center">
              <p className="heading-empty">These versions match</p>
            </div>
          ) : null}
          {(onlyChanges ? changed : parts).map((p) => (
            <PartDiff
              key={p.key}
              part={p}
              leftLabel={label(L)}
              rightLabel={label(R)}
              selectable={selectable}
              selected={selected.has(p.key)}
              onToggle={() =>
                setSelected((s) => {
                  const n = new Set(s);
                  if (n.has(p.key)) n.delete(p.key);
                  else n.add(p.key);
                  return n;
                })
              }
            />
          ))}
        </>
      )}

      {selectable && selected.size > 0 && L && latest ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-ink px-4 py-3 text-white shadow-lg" role="region" aria-label="Restore selected parts">
          <RotateCcw aria-hidden className="size-4" />
          <p className="text-ui">
            Restore <span className="font-semibold">{describeParts([...selected])}</span> from v{L.version}
            <span className="text-white/70"> → new v{latest.version + 1}, needs approval</span>
          </p>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant="accent" loading={busy} onClick={() => run(L.id, [...selected])}>
              Restore
            </Button>
          </div>
        </div>
      ) : null}
      {selectable && L ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-3">
          <ArrowLeft aria-hidden className="size-3.5" /> Tick parts to bring back from {label(L)}.
        </p>
      ) : null}
    </section>
  );
}
