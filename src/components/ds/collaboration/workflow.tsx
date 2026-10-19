"use client";

/*
 * Workflow: VersionHistory (list + preview + restore), AssignmentSelector
 * (searchable combobox, single assignee) and ApprovalWorkflow (ordered steps,
 * approve / request changes with a reason, resubmit).
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, CircleCheck, CircleX, Clock, RotateCcw, Search, UserRound, X } from "@/components/icons";
import { Badge, Button, ConfirmDialog, Popover, PopoverContent, PopoverTrigger, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { UserAvatar, type Person } from "../accounts/avatar";

/* ------------------------------------------------------------------ */
/* Version history                                                     */
/* ------------------------------------------------------------------ */

export interface Version {
  id: string;
  label: string;
  authorId: string;
  time: string;
  summary: string;
  content: string;
  /** Autosaves are grouped quieter than named versions. */
  auto?: boolean;
}

export interface VersionHistoryProps {
  versions: Version[];
  onChange: (v: Version[]) => void;
  people: Person[];
  meId: string;
}

/** Newest first. Pick one to preview; restoring adds a new version on top (nothing is lost). */
export function VersionHistory({ versions, onChange, people, meId }: VersionHistoryProps) {
  const [sel, setSel] = useState(versions[0]?.id);
  const [confirm, setConfirm] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const current = versions[0];
  const picked = versions.find((v) => v.id === sel) ?? current;
  const nameOf = (id: string) => (id === meId ? "You" : (people.find((p) => p.id === id)?.name ?? "Someone"));

  const onKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const i = versions.findIndex((v) => v.id === sel);
    const to = e.key === "ArrowDown" ? i + 1 : e.key === "ArrowUp" ? i - 1 : -2;
    if (to === -2 || to < 0 || to >= versions.length) return;
    e.preventDefault();
    setSel(versions[to].id);
    listRef.current?.querySelector<HTMLElement>(`[data-id="${versions[to].id}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="grid overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)] md:grid-cols-[260px_1fr]">
      <ul
        ref={listRef}
        role="listbox"
        aria-label="Versions"
        aria-activedescendant={`ver-${sel}`}
        tabIndex={0}
        onKeyDown={onKey}
        className="max-h-80 overflow-y-auto border-b border-line p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)] md:border-b-0 md:border-r"
      >
        {versions.map((v, i) => (
          <li
            key={v.id}
            id={`ver-${v.id}`}
            data-id={v.id}
            role="option"
            aria-selected={v.id === sel}
            onClick={() => setSel(v.id)}
            className={cn("flex cursor-pointer gap-2.5 rounded-[var(--radius-control)] px-2.5 py-2", v.id === sel ? "bg-surface-2" : "hover:bg-surface-2/60")}
          >
            <span aria-hidden className="relative mt-1.5 flex flex-col items-center">
              <span className={cn("size-2 rounded-full", i === 0 ? "bg-ink" : v.auto ? "bg-surface-3 ring-1 ring-line-strong" : "bg-brand-700")} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-ui font-medium text-ink">
                {v.label}
                {i === 0 ? <Badge tone="green">Current</Badge> : null}
              </span>
              <span className="block truncate text-xs text-ink-3">
                {nameOf(v.authorId)} · {v.time}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex min-w-0 flex-col gap-3 p-[var(--card-p)]">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="heading-card">{picked.label}</p>
            <p className="text-xs text-ink-3">{picked.summary}</p>
          </div>
          {picked.id !== current.id ? (
            <Button size="sm" variant="secondary" onClick={() => setConfirm(true)}>
              <RotateCcw /> Restore this version
            </Button>
          ) : null}
        </div>
        <p className="whitespace-pre-wrap rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm text-ink">{picked.content}</p>
        {picked.id !== current.id && picked.content !== current.content ? (
          <p className="text-xs text-ink-3">
            Differs from current: {Math.abs(current.content.length - picked.content.length)} characters {current.content.length > picked.content.length ? "shorter" : "longer"}.
          </p>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Restore “${picked.label}”?`}
        description="It becomes the current version. The current one stays in history."
        confirmLabel="Restore version"
        onConfirm={() => {
          const v: Version = { id: `v${versions.length + 1}-r`, label: `Restored ${picked.label}`, authorId: meId, time: "Just now", summary: `Restored from ${picked.label}`, content: picked.content };
          onChange([v, ...versions]);
          setSel(v.id);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Assignment selector                                                 */
/* ------------------------------------------------------------------ */

export interface AssignmentSelectorProps {
  people: Person[];
  value: string | null;
  onChange: (id: string | null) => void;
  meId: string;
  label?: string;
}

/** Searchable assignee picker. Type to filter, ↑ ↓ Enter to pick, Esc to close. */
export function AssignmentSelector({ people, value, onChange, meId, label = "Assignee" }: AssignmentSelectorProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const assignee = people.find((p) => p.id === value);
  const matches = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setQ("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && matches[active]) {
      e.preventDefault();
      pick(matches[active].id);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          setActive(0);
          if (!o) setQ("");
        }}
      >
        <PopoverTrigger
          aria-label={`${label}: ${assignee?.name ?? "Unassigned"}`}
          className="inline-flex h-[var(--h-md)] items-center gap-2 rounded-[var(--radius-control)] border border-[var(--btn-2-border)] bg-surface px-2.5 text-ui text-ink shadow-[var(--btn-2-shadow)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          {assignee ? (
            <UserAvatar name={assignee.name} size="xs" />
          ) : (
            <span className="grid size-5 place-items-center rounded-full border border-dashed border-control text-ink-3">
              <UserRound aria-hidden className="size-3" />
            </span>
          )}
          <span className={cn(!assignee && "text-ink-3")}>{assignee?.name ?? "Unassigned"}</span>
          <ChevronDown aria-hidden className="size-4 text-ink-3" />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-1.5">
          <div className="relative mb-1">
            <Search aria-hidden className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder="Search people"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={matches[active] ? `${listId}-${matches[active].id}` : undefined}
              aria-label="Search people"
              className="h-[var(--h-sm)] w-full rounded-[var(--radius-field)] border border-control bg-surface pl-8 pr-2 text-ui outline-none focus-visible:border-brand-700"
            />
          </div>
          <ul id={listId} role="listbox" aria-label="People" className="max-h-56 overflow-y-auto">
            {matches.map((p, i) => (
              <li
                key={p.id}
                id={`${listId}-${p.id}`}
                role="option"
                aria-selected={p.id === value}
                onClick={() => pick(p.id)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-2 py-1.5 text-ui", i === active && "bg-surface-2")}
              >
                <UserAvatar name={p.name} size="sm" presence={p.presence} />
                <span className="flex-1 truncate">
                  {p.name}
                  {p.id === meId ? <span className="text-ink-3"> (you)</span> : null}
                </span>
                {p.id === value ? <Check aria-hidden className="size-4 text-brand-800" /> : null}
              </li>
            ))}
            {!matches.length ? <li className="px-2 py-3 text-center text-xs text-ink-3">No one called “{q}”</li> : null}
          </ul>
          {value ? (
            <button type="button" onClick={() => pick(null)} className="mt-1 flex w-full items-center gap-2 rounded-[var(--radius-control)] border-t border-line px-2 py-1.5 text-ui text-ink-2 hover:bg-surface-2">
              <X aria-hidden className="size-4" /> Unassign
            </button>
          ) : null}
        </PopoverContent>
      </Popover>
      {value !== meId ? (
        <Button size="sm" variant="link" onClick={() => onChange(meId)}>
          Assign to me
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Approval workflow                                                   */
/* ------------------------------------------------------------------ */

export interface ApprovalStep {
  id: string;
  label: string;
  approverId: string;
  status: "approved" | "rejected" | "pending" | "waiting";
  note?: string;
  at?: string;
}

export interface ApprovalWorkflowProps {
  steps: ApprovalStep[];
  onChange: (s: ApprovalStep[]) => void;
  people: Person[];
  meId: string;
  /** What happens after the last approval, e.g. "Scheduled for Thu 9:00". */
  doneText: string;
}

const STEP_TEXT: Record<ApprovalStep["status"], string> = { approved: "Approved", rejected: "Changes requested", pending: "Waiting for review", waiting: "Not started" };

/** Steps run in order. The current reviewer approves or requests changes (with a reason). */
export function ApprovalWorkflow({ steps, onChange, people, meId, doneText }: ApprovalWorkflowProps) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const cur = steps.findIndex((s) => s.status === "pending");
  const rejected = steps.find((s) => s.status === "rejected");
  const allDone = steps.every((s) => s.status === "approved");
  const nameOf = (id: string) => (id === meId ? "You" : (people.find((p) => p.id === id)?.name ?? "Someone"));

  const approve = () =>
    onChange(steps.map((s, i) => (i === cur ? { ...s, status: "approved", at: "Just now", note: undefined } : i === cur + 1 ? { ...s, status: "pending" } : s)));
  const reject = () => {
    onChange(steps.map((s, i) => (i === cur ? { ...s, status: "rejected", at: "Just now", note: note.trim() } : s)));
    setRejecting(false);
    setNote("");
  };
  const resubmit = () => onChange(steps.map((s, i) => ({ ...s, status: i === 0 ? "pending" : "waiting", note: undefined, at: undefined })));

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="heading-card">Approval</h3>
        {allDone ? <Badge tone="green" icon={<CircleCheck />}>Approved</Badge> : rejected ? <Badge tone="red" icon={<CircleX />}>Changes requested</Badge> : <Badge tone="amber" icon={<Clock />}>{`Step ${cur + 1} of ${steps.length}`}</Badge>}
      </div>
      <ol className="flex flex-col">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const isCur = i === cur;
          return (
            <li key={s.id} className="relative flex gap-3 pb-5 last:pb-0" aria-current={isCur ? "step" : undefined}>
              {!last ? <span aria-hidden className={cn("absolute left-[11px] top-7 h-[calc(100%-1.75rem)] w-px", s.status === "approved" ? "bg-brand-600" : "bg-line-strong")} /> : null}
              <span aria-hidden className="relative mt-0.5 grid size-6 shrink-0 place-items-center">
                {s.status === "approved" ? (
                  <CircleCheck className="size-6 fill-brand-800 text-white" />
                ) : s.status === "rejected" ? (
                  <CircleX className="size-6 fill-red-800 text-white" />
                ) : isCur ? (
                  <span className="size-6 rounded-full border-2 border-ink bg-sun" />
                ) : (
                  <span className="size-6 rounded-full border-[1.5px] border-line-strong bg-surface" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ui font-medium text-ink">{s.label}</p>
                <p className="flex items-center gap-1.5 text-xs text-ink-3">
                  <UserAvatar name={people.find((p) => p.id === s.approverId)?.name ?? "?"} size="xs" />
                  {nameOf(s.approverId)} · {STEP_TEXT[s.status]}
                  {s.at ? ` · ${s.at}` : ""}
                </p>
                {s.note ? <p className="mt-1.5 rounded-[var(--radius-control)] bg-red-100/50 px-2.5 py-1.5 text-ui text-ink">“{s.note}”</p> : null}
                {isCur ? (
                  rejecting ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <Textarea aria-label="What needs to change" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="What needs to change?" autoFocus />
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" disabled={!note.trim()} onClick={reject}>
                          Request changes
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" onClick={approve}>
                        <Check /> Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>
                        Request changes
                      </Button>
                    </div>
                  )
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {allDone ? (
        <p role="status" className="flex items-center gap-2 rounded-[var(--radius-control)] bg-sun-soft px-3 py-2 text-ui text-ink">
          <CircleCheck aria-hidden className="size-4 text-green-800" /> {doneText}
        </p>
      ) : null}
      {rejected || allDone ? (
        <Button size="sm" variant="secondary" className="self-start" onClick={resubmit}>
          <RotateCcw /> {rejected ? "Resubmit for approval" : "Start over"}
        </Button>
      ) : null}
    </div>
  );
}
