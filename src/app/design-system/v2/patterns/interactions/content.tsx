"use client";

import { useRef, useState } from "react";
import {
  Archive,
  CalendarClock,
  Check,
  Copy,
  Eye,
  Mail,
  MessageCircle,
  MousePointerClick,
  Pencil,
  Plus,
  Redo2,
  Star,
  Trash2,
  Undo2,
  UserRound,
} from "@/components/icons";
import { Badge, Button, Checkbox, Field, IconButton, Input, Kbd, Select, Switch, Textarea, toast } from "@/components/ui";
import {
  AutoSaveStatus,
  ConditionalField,
  CopyButton,
  CopyField,
  Disclosure,
  DragBoard,
  HoverActionsRow,
  InfiniteScroll,
  InlineEdit,
  KeyboardList,
  ReorderableList,
  StepIndicator,
  StickyActionBar,
  useAutoSave,
  useHistory,
  useInterval,
  useMultiSelect,
  useOptimisticList,
  useSteps,
  useUndoShortcuts,
  type BoardColumn,
} from "@/components/ds/interactions";
import { cn } from "@/lib/utils";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

const said = (t: string, tone: "success" | "danger" | "info" = "success") => toast({ title: t, tone, duration: 2200 });
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* Drag and drop                                                       */
/* ------------------------------------------------------------------ */

interface Post {
  id: string;
  title: string;
  channel: string;
}

const BOARD: BoardColumn<Post>[] = [
  { id: "ideas", title: "Ideas", items: [{ id: "a", title: "Meet the bakers", channel: "Instagram" }, { id: "b", title: "Behind the oven", channel: "TikTok" }] },
  { id: "drafts", title: "Drafts", items: [{ id: "c", title: "Spring brunch menu", channel: "Facebook" }, { id: "d", title: "Catering for 40+", channel: "Email" }] },
  { id: "scheduled", title: "Scheduled", items: [{ id: "e", title: "Sourdough Saturday", channel: "Instagram" }] },
];

function DragDemo() {
  const [cols, setCols] = useState(BOARD);
  return (
    <DragBoard
      label="Content board"
      columns={cols}
      onChange={setCols}
      itemName={(p) => p.title}
      renderCard={(p) => (
        <>
          <p className="text-ui font-medium text-ink">{p.title}</p>
          <p className="text-xs text-ink-3">{p.channel}</p>
        </>
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Inline editing                                                      */
/* ------------------------------------------------------------------ */

function InlineDemo() {
  const [name, setName] = useState("Spring launch");
  const [budget, setBudget] = useState("$250");
  const [goal, setGoal] = useState("40 booked calls");
  return (
    <div className="flex flex-col gap-4">
      <InlineEdit label="Campaign name" value={name} onSave={(v) => (setName(v), said("Name saved"))} validate={(v) => (v ? null : "Name can't be empty.")} textClassName="heading-section" />
      <dl className="grid max-w-md grid-cols-[120px_1fr] items-center gap-x-4 gap-y-2 text-ui">
        <dt className="text-ink-3">Weekly budget</dt>
        <dd>
          <InlineEdit label="Weekly budget" value={budget} onSave={setBudget} validate={(v) => (/^\$?\d+(\.\d{1,2})?$/.test(v) ? null : "Use a number, like $250.")} />
        </dd>
        <dt className="text-ink-3">Goal</dt>
        <dd>
          <InlineEdit label="Goal" value={goal} onSave={setGoal} />
        </dd>
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-item selection                                                */
/* ------------------------------------------------------------------ */

const LEADS = [
  { id: "l1", name: "Priya Shah", source: "Google", score: 86 },
  { id: "l2", name: "Ben Ortiz", source: "Instagram", score: 72 },
  { id: "l3", name: "Hana Kim", source: "Referral", score: 64 },
  { id: "l4", name: "Tom Becker", source: "Google", score: 58 },
  { id: "l5", name: "Ama Mensah", source: "Website", score: 51 },
  { id: "l6", name: "Leo Rossi", source: "Email", score: 44 },
];

function SelectionDemo() {
  const sel = useMultiSelect(LEADS.map((l) => l.id));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-9 items-center gap-3 px-3">
        <Checkbox aria-label="Select all leads" checked={sel.headerState} onCheckedChange={() => (sel.headerState === true ? sel.clear() : sel.selectAll())} />
        <span className="text-ui text-ink-2" aria-live="polite">
          {sel.count ? `${sel.count} selected` : "Click, ⌘-click or Shift-click rows"}
        </span>
        {sel.count ? (
          <span className="ml-auto flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => (said(`${sel.count} leads added to campaign`), sel.clear())}>Add to campaign</Button>
            <Button size="sm" variant="ghost" onClick={sel.clear}>Clear</Button>
          </span>
        ) : null}
      </div>
      <ul aria-label="Leads" aria-multiselectable="true" role="listbox" className="flex select-none flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {LEADS.map((l) => {
          const on = sel.isSelected(l.id);
          return (
            <li
              key={l.id}
              role="option"
              aria-selected={on}
              onClick={(e) => sel.click(l.id, e)}
              className={cn("flex h-[var(--cell-h)] cursor-default items-center gap-3 border-b border-line px-3 text-ui last:border-0", on ? "bg-brand-50" : "hover:bg-surface-2/60")}
            >
              <span onClick={(e) => e.stopPropagation()}>
                <Checkbox aria-label={`Select ${l.name}`} checked={on} onClick={(e) => (e.preventDefault(), sel.toggle(l.id, e.shiftKey))} />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
              <span className="w-20 text-ink-3">{l.source}</span>
              <span className="w-8 text-right tabular-nums">{l.score}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Keyboard navigation                                                 */
/* ------------------------------------------------------------------ */

const THREADS = [
  { id: "t1", from: "Priya Shah", subject: "Catering for 120 on the 14th?", time: "9:12" },
  { id: "t2", from: "Google reviews", subject: "New 5-star review from Hana", time: "8:40" },
  { id: "t3", from: "Ben Ortiz", subject: "Do you ship loaves?", time: "Yesterday" },
  { id: "t4", from: "Meetrao", subject: "Call booked: Tom Becker, Fri 2pm", time: "Yesterday" },
  { id: "t5", from: "Leo Rossi", subject: "Gluten-free options?", time: "Mon" },
];

function KeyboardDemo() {
  const [open, setOpen] = useState<string | null>(null);
  const [starred, setStarred] = useState<Set<string>>(new Set(["t2"]));
  const cur = THREADS.find((t) => t.id === open);
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-1">
        <KeyboardList
          label="Inbox"
          items={THREADS}
          textOf={(t) => t.from}
          onOpen={(t) => setOpen(t.id)}
          onToggle={(t) =>
            setStarred((s) => {
              const n = new Set(s);
              if (n.has(t.id)) n.delete(t.id);
              else n.add(t.id);
              return n;
            })
          }
          renderItem={(t) => (
            <div className="flex items-center gap-3 px-3 py-2">
              <Star aria-label={starred.has(t.id) ? "Starred" : undefined} className={cn("size-4 shrink-0", starred.has(t.id) ? "fill-current text-amber-800" : "text-line-strong")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ui font-medium">{t.from}</span>
                <span className="block truncate text-xs text-ink-3">{t.subject}</span>
              </span>
              <span className="text-2xs text-ink-3">{t.time}</span>
            </div>
          )}
        />
      </div>
      <div className="flex flex-col gap-2 text-ui text-ink-2">
        <p className="flex flex-wrap items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> or <Kbd>J</Kbd><Kbd>K</Kbd> move</p>
        <p className="flex flex-wrap items-center gap-1"><Kbd>↵</Kbd> open · <Kbd>X</Kbd> star · letters jump</p>
        <p aria-live="polite" className="mt-2 rounded-[var(--radius-control)] bg-surface p-3 text-ink">{cur ? `Opened: ${cur.subject}` : "Click the list, then use the keys."}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hover-reveal actions                                                */
/* ------------------------------------------------------------------ */

function HoverDemo() {
  const rows = [
    { id: "h1", title: "Sourdough Saturday", meta: "Instagram · Sat 8:00" },
    { id: "h2", title: "Spring brunch menu", meta: "Facebook · Sun 9:00" },
    { id: "h3", title: "Catering for 40+", meta: "Email · Mon 7:30" },
  ];
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-line bg-surface p-1">
      {rows.map((r) => (
        <HoverActionsRow
          key={r.id}
          actions={
            <>
              <IconButton size="sm" aria-label={`Preview ${r.title}`} icon={<Eye />} onClick={() => said(`Preview ${r.title}`)} />
              <IconButton size="sm" aria-label={`Edit ${r.title}`} icon={<Pencil />} onClick={() => said(`Edit ${r.title}`)} />
              <IconButton size="sm" aria-label={`Reschedule ${r.title}`} icon={<CalendarClock />} onClick={() => said(`Reschedule ${r.title}`)} />
              <IconButton size="sm" aria-label={`Archive ${r.title}`} icon={<Archive />} onClick={() => said(`Archived ${r.title}`)} />
            </>
          }
        >
          <p className="truncate text-ui font-medium">{r.title}</p>
          <p className="truncate text-xs text-ink-3">{r.meta}</p>
        </HoverActionsRow>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reorderable lists                                                   */
/* ------------------------------------------------------------------ */

function ReorderDemo() {
  const [steps, setSteps] = useState([
    { id: "s1", title: "Welcome email", delay: "Day 0" },
    { id: "s2", title: "Menu highlights", delay: "Day 2" },
    { id: "s3", title: "Catering offer", delay: "Day 5" },
    { id: "s4", title: "Review request", delay: "Day 9" },
  ]);
  return (
    <div className="max-w-md">
      <ReorderableList
        label="Email sequence"
        items={steps}
        onChange={setSteps}
        itemName={(s) => s.title}
        renderItem={(s) => (
          <span className="flex items-center gap-2">
            <Mail aria-hidden className="size-4 text-ink-3" />
            <span className="min-w-0 flex-1 truncate text-ui font-medium">{s.title}</span>
            <span className="text-xs text-ink-3">{s.delay}</span>
          </span>
        )}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Undo / redo                                                         */
/* ------------------------------------------------------------------ */

const KEYWORDS = ["sourdough", "brunch", "catering", "gluten-free", "croissant"];

function UndoDemo() {
  const h = useHistory(KEYWORDS);
  const scope = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  useUndoShortcuts(h.undo, h.redo, scope);
  return (
    <div ref={scope} tabIndex={-1} className="flex flex-col gap-3 outline-none">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={!h.canUndo} onClick={h.undo}>
          <Undo2 aria-hidden /> Undo{h.canUndo && h.undoLabel ? `: ${h.undoLabel}` : ""}
        </Button>
        <Button size="sm" variant="secondary" disabled={!h.canRedo} onClick={h.redo}>
          <Redo2 aria-hidden /> Redo{h.canRedo && h.redoLabel ? `: ${h.redoLabel}` : ""}
        </Button>
        <span className="text-xs text-ink-3">
          <Kbd>⌘</Kbd> <Kbd>Z</Kbd> / <Kbd>⇧</Kbd> <Kbd>⌘</Kbd> <Kbd>Z</Kbd> while focus is here
        </span>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Target keywords">
        {h.value.map((k) => (
          <li key={k} className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-badge)] bg-surface pl-2.5 pr-1 text-ui shadow-[var(--card-shadow)]">
            {k}
            <button type="button" aria-label={`Remove ${k}`} onClick={() => h.set((v) => v.filter((x) => x !== k), `remove “${k}”`)} className="grid size-5 place-items-center rounded-[var(--radius-control)] text-ink-3 outline-none hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
              <Trash2 aria-hidden className="size-3" />
            </button>
          </li>
        ))}
        {!h.value.length ? <li className="text-ui text-ink-3">No keywords. Undo brings them back.</li> : null}
      </ul>
      <form
        className="flex max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const k = draft.trim().toLowerCase();
          if (!k || h.value.includes(k)) return;
          h.set((v) => [...v, k], `add “${k}”`);
          setDraft("");
        }}
      >
        <Input size="sm" aria-label="New keyword" placeholder="Add a keyword" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <Button size="sm" type="submit"><Plus aria-hidden /> Add</Button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Auto-save                                                           */
/* ------------------------------------------------------------------ */

function AutoSaveDemo() {
  const [text, setText] = useState("Fresh sourdough every Saturday from 8am. Pre-order by Friday to skip the line.");
  const [fail, setFail] = useState(false);
  const failRef = useRef(fail);
  const save = async () => {
    await wait(700);
    if (failRef.current) throw new Error("offline");
  };
  const { status, savedAt, retry } = useAutoSave(text, save, 900);
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-ui font-medium">Business description</p>
        <AutoSaveStatus status={status} savedAt={savedAt} onRetry={retry} />
      </div>
      <Textarea aria-label="Business description" autosize rows={3} value={text} onChange={(e) => setText(e.target.value)} />
      <Switch
        label="Simulate offline"
        description="Saves fail and offer a retry."
        checked={fail}
        onCheckedChange={(v) => {
          failRef.current = v;
          setFail(v);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Optimistic updates                                                  */
/* ------------------------------------------------------------------ */

function OptimisticDemo() {
  const [fail, setFail] = useState(false);
  const failRef = useRef(false);
  const list = useOptimisticList(
    [
      { id: "o1", title: "Sourdough Saturday", approved: false, liked: false },
      { id: "o2", title: "Spring brunch menu", approved: true, liked: true },
      { id: "o3", title: "Meet the bakers", approved: false, liked: false },
    ],
    (item) => said(`Couldn't update “${item.title}”. Undone.`, "danger"),
  );
  const commit = async () => {
    await wait(900);
    if (failRef.current) throw new Error("network");
  };
  return (
    <div className="flex max-w-xl flex-col gap-3">
      <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {list.items.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-ui font-medium">{p.title}</span>
            {list.isPending(p.id) ? <span className="text-2xs text-ink-3">Saving…</span> : null}
            <Button size="sm" variant="ghost" aria-pressed={p.liked} onClick={() => list.mutate(p.id, { liked: !p.liked }, commit)}>
              <Star aria-hidden className={cn(p.liked && "fill-current text-amber-800")} /> {p.liked ? "Starred" : "Star"}
            </Button>
            <Button size="sm" variant={p.approved ? "secondary" : "primary"} aria-pressed={p.approved} onClick={() => list.mutate(p.id, { approved: !p.approved }, commit)}>
              {p.approved ? <><Check aria-hidden /> Approved</> : "Approve"}
            </Button>
          </li>
        ))}
      </ul>
      <Switch
        label="Simulate failure"
        description="The change shows at once, then rolls back with a message."
        checked={fail}
        onCheckedChange={(v) => {
          failRef.current = v;
          setFail(v);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Real-time updates                                                   */
/* ------------------------------------------------------------------ */

const EVENTS = [
  { icon: <UserRound />, text: "New lead from Google: “wedding cake quote”" },
  { icon: <MousePointerClick />, text: "Someone clicked the brunch menu link" },
  { icon: <MessageCircle />, text: "Ben Ortiz replied to your email" },
  { icon: <Star />, text: "New 5-star review on Google" },
  { icon: <CalendarClock />, text: "Call booked for Friday 2pm" },
];

function RealtimeDemo() {
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(true);
  const [seen, setSeen] = useState(0);
  const [visits, setVisits] = useState(128);
  useInterval(
    () => {
      setTick((t) => t + 1);
      setVisits((v) => v + 1 + (v % 3));
    },
    live ? 2500 : null,
  );
  const feed = Array.from({ length: Math.min(tick, 6) }, (_, i) => {
    const n = tick - i;
    return { id: n, ...EVENTS[n % EVENTS.length], age: i === 0 ? "just now" : `${i * 2.5}s ago` };
  });
  const unseen = tick - seen;
  return (
    <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
        <span className="flex items-center gap-2 text-ui text-ink-2">
          <span aria-hidden className={cn("size-2 rounded-full", live ? "bg-green-500 animate-soft-pulse" : "bg-ink-3")} />
          {live ? "Live" : "Paused"}
        </span>
        <p className="text-kpi font-semibold leading-10 tabular-nums">{visits}</p>
        <p className="-mt-2 text-ui text-ink-2">Visitors today</p>
        <Button size="sm" variant="secondary" onClick={() => setLive((v) => !v)}>{live ? "Pause updates" : "Resume"}</Button>
      </div>
      <div className="flex flex-col gap-2">
        {unseen > 0 ? (
          <button type="button" onClick={() => setSeen(tick)} className="self-center rounded-[var(--radius-badge)] bg-ink px-3 py-1 text-xs font-medium text-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            {unseen} new · Mark seen
          </button>
        ) : null}
        <ul aria-label="Live activity" className="flex flex-col gap-1.5">
          {feed.length ? (
            feed.map((e) => (
              <li key={e.id} className={cn("flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2 text-ui animate-fade-up", e.id > seen && "border-brand-200 bg-brand-50")}>
                <span aria-hidden className="inline-flex text-ink-3 [&_svg]:size-4">{e.icon}</span>
                <span className="min-w-0 flex-1 truncate">{e.text}</span>
                <span className="shrink-0 text-2xs text-ink-3">{e.age}</span>
              </li>
            ))
          ) : (
            <li className="text-ui text-ink-3">Waiting for activity…</li>
          )}
        </ul>
        <p className="sr-only" aria-live="polite">{feed[0] ? feed[0].text : ""}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Infinite scrolling                                                  */
/* ------------------------------------------------------------------ */

const FIRST = ["Priya", "Ben", "Hana", "Tom", "Ama", "Leo", "Sara", "Omar", "Ines", "Raj"];
const LAST = ["Shah", "Ortiz", "Kim", "Becker", "Mensah", "Rossi", "Lund", "Haddad", "Silva", "Patel"];
const SRC = ["Google", "Instagram", "Referral", "Website", "Email"];
const lead = (i: number) => ({ id: `il${i}`, name: `${FIRST[i % 10]} ${LAST[(i * 7) % 10]}`, source: SRC[(i * 3) % 5], score: 95 - ((i * 13) % 60) });

function InfiniteDemo() {
  const [items, setItems] = useState(() => Array.from({ length: 15 }, (_, i) => lead(i)));
  const [loading, setLoading] = useState(false);
  const total = 60;
  const loadMore = async () => {
    if (loading || items.length >= total) return;
    setLoading(true);
    await wait(700);
    setItems((xs) => [...xs, ...Array.from({ length: 15 }, (_, i) => lead(xs.length + i))]);
    setLoading(false);
  };
  return (
    <div className="flex max-w-xl flex-col gap-2">
      <p className="text-xs text-ink-3" aria-live="polite">Showing {items.length} of {total} leads</p>
      <InfiniteScroll label="Leads" hasMore={items.length < total} loading={loading} onLoadMore={loadMore} endText="All 60 leads loaded.">
        <ul>
          {items.map((l) => (
            <li key={l.id} className="flex h-[var(--cell-h)] items-center gap-3 border-b border-line px-4 text-ui">
              <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
              <span className="w-20 text-ink-3">{l.source}</span>
              <span className="w-8 text-right tabular-nums">{l.score}</span>
            </li>
          ))}
        </ul>
      </InfiniteScroll>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sticky action bars                                                  */
/* ------------------------------------------------------------------ */

const PROFILE = { name: "Tartine Bakery", phone: "(415) 555-0142", hours: "Tue–Sun, 7am–3pm", website: "tartine.co", about: "Neighbourhood bakery in the Mission since 2002." };

function StickyDemo() {
  const [saved, setSaved] = useState(PROFILE);
  const [form, setForm] = useState(PROFILE);
  const [busy, setBusy] = useState(false);
  const changed = (Object.keys(form) as (keyof typeof form)[]).filter((k) => form[k] !== saved[k]).length;
  const field = (k: keyof typeof form, label: string) => (
    <Field label={label}>
      <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </Field>
  );
  return (
    <div className="h-[380px] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface" tabIndex={0} role="region" aria-label="Business profile form">
      <div className="flex flex-col gap-4 p-5 pb-8">
        <p className="heading-card">Business profile</p>
        <p className="-mt-3 text-xs text-ink-3">Edit any field; the bar appears and follows the scroll.</p>
        {field("name", "Business name")}
        {field("phone", "Phone")}
        {field("hours", "Opening hours")}
        {field("website", "Website")}
        <Field label="About">
          <Textarea rows={4} value={form.about} onChange={(e) => setForm({ ...form, about: e.target.value })} />
        </Field>
      </div>
      <StickyActionBar show={changed > 0} message={`${changed} unsaved ${changed === 1 ? "change" : "changes"}`}>
        <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setForm(saved)}>Discard</Button>
        <Button
          size="sm"
          variant="accent"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await wait(600);
            setSaved(form);
            setBusy(false);
            said("Profile saved");
          }}
        >
          Save changes
        </Button>
      </StickyActionBar>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progressive disclosure / conditional fields                         */
/* ------------------------------------------------------------------ */

function DisclosureDemo() {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Field label="Campaign goal">
        <Select defaultValue="calls" options={[{ value: "calls", label: "Booked calls" }, { value: "visits", label: "Store visits" }]} />
      </Field>
      <Field label="Weekly budget">
        <Input defaultValue="$250" />
      </Field>
      <Disclosure summary="Advanced targeting" hint="· Optional">
        <div className="flex flex-col gap-4">
          <Field label="Radius" hint="How far people travel to you.">
            <Select defaultValue="5" options={[{ value: "2", label: "2 miles" }, { value: "5", label: "5 miles" }, { value: "10", label: "10 miles" }]} />
          </Field>
          <Field label="Exclude keywords" optional>
            <Input placeholder="jobs, recipe" />
          </Field>
        </div>
      </Disclosure>
    </div>
  );
}

function ConditionalDemo() {
  const [discount, setDiscount] = useState(false);
  const [kind, setKind] = useState("percent");
  const [channel, setChannel] = useState("social");
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Field label="Channel">
        <Select value={channel} onValueChange={setChannel} options={[{ value: "social", label: "Social post" }, { value: "email", label: "Email" }, { value: "sms", label: "Text message" }]} />
      </Field>
      <ConditionalField when={channel === "email"}>
        <Field label="Subject line" hint="Shown because the channel is Email.">
          <Input placeholder="Your spring brunch table is ready" />
        </Field>
      </ConditionalField>
      <ConditionalField when={channel === "sms"}>
        <p className="text-xs text-ink-3">Texts include “Reply STOP to opt out”. 160 characters max.</p>
      </ConditionalField>
      <Switch label="Include an offer" checked={discount} onCheckedChange={setDiscount} />
      <ConditionalField when={discount}>
        <div className="flex flex-col gap-4">
          <Field label="Offer type">
            <Select value={kind} onValueChange={setKind} options={[{ value: "percent", label: "Percent off" }, { value: "item", label: "Free item" }]} />
          </Field>
          {kind === "percent" ? (
            <Field label="Discount" hint="Between 5 and 50%.">
              <Input type="number" min={5} max={50} defaultValue={15} />
            </Field>
          ) : (
            <Field label="Free item">
              <Input placeholder="Coffee with any pastry" />
            </Field>
          )}
          <Field label="Code" optional>
            <Input placeholder="SPRING15" />
          </Field>
        </div>
      </ConditionalField>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-step forms                                                    */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: "goal", label: "Goal" },
  { id: "audience", label: "Audience" },
  { id: "budget", label: "Budget" },
  { id: "review", label: "Review" },
];

function MultiStepDemo() {
  const s = useSteps(STEPS);
  const [data, setData] = useState({ goal: "", area: "", budget: "250" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const validate = () => {
    const e: Record<string, string> = {};
    if (s.step.id === "goal" && !data.goal) e.goal = "Pick a goal to continue.";
    if (s.step.id === "audience" && data.area.trim().length < 2) e.area = "Add a town or neighbourhood.";
    if (s.step.id === "budget" && !(Number(data.budget) >= 20)) e.budget = "Minimum is $20 a week.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  if (done)
    return (
      <div className="flex max-w-lg flex-col items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6">
        <Badge tone="green" icon={<Check />}>Draft created</Badge>
        <p className="heading-card">Your campaign is ready for review</p>
        <Button size="sm" variant="secondary" onClick={() => (setDone(false), s.reset(), setData({ goal: "", area: "", budget: "250" }))}>Start again</Button>
      </div>
    );
  return (
    <form
      className="flex max-w-lg flex-col gap-5 rounded-[var(--radius-card)] border border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (s.last) {
          setDone(true);
          said("Campaign draft created");
        } else s.next(validate());
      }}
    >
      <StepIndicator steps={STEPS} index={s.index} visited={s.visited} onGoTo={s.goTo} />
      <div key={s.step.id} className="flex min-h-36 flex-col gap-4 animate-step-in">
        <p className="heading-card">{["What should this campaign get you?", "Who should see it?", "How much per week?", "Check and create"][s.index]}</p>
        {s.step.id === "goal" ? (
          <Field label="Goal" error={errors.goal}>
            <Select value={data.goal || undefined} onValueChange={(v) => setData({ ...data, goal: v })} placeholder="Choose a goal" options={[{ value: "Booked calls", label: "Booked calls" }, { value: "Store visits", label: "Store visits" }, { value: "Google reviews", label: "Google reviews" }]} />
          </Field>
        ) : s.step.id === "audience" ? (
          <Field label="Area" hint="Town, neighbourhood or postcode." error={errors.area}>
            <Input value={data.area} onChange={(e) => setData({ ...data, area: e.target.value })} placeholder="Mission District" />
          </Field>
        ) : s.step.id === "budget" ? (
          <Field label="Weekly budget (USD)" error={errors.budget}>
            <Input type="number" inputMode="numeric" value={data.budget} onChange={(e) => setData({ ...data, budget: e.target.value })} />
          </Field>
        ) : (
          <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-ui">
            <dt className="text-ink-3">Goal</dt><dd>{data.goal}</dd>
            <dt className="text-ink-3">Area</dt><dd>{data.area}</dd>
            <dt className="text-ink-3">Budget</dt><dd className="tabular-nums">${data.budget} / week</dd>
          </dl>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
        <Button type="button" variant="ghost" disabled={s.first} onClick={() => (setErrors({}), s.back())}>Back</Button>
        <span className="text-xs text-ink-3">Step {s.index + 1} of {STEPS.length}</span>
        <Button type="submit">{s.last ? "Create draft" : "Continue"}</Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Copy                                                                */
/* ------------------------------------------------------------------ */

function CopyDemo() {
  return (
    <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
      <CopyField label="Share link" value="https://climbos.app/r/spring-launch-8f2k" />
      <CopyField label="Tracking ID" value="clm_8f2k91ab44" mono />
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <CopyButton text="SPRING15" label="Copy code" />
        <CopyButton text="Fresh sourdough every Saturday from 8am." iconOnly label="Copy caption" />
        <span className="text-xs text-ink-3"><Copy aria-hidden className="mr-1 inline size-3.5" />Button turns to “Copied” for 1.6s and announces it.</span>
      </div>
    </div>
  );
}

export function InteractionsContent() {
  return (
    <DocPage eyebrow="Patterns" title="Interactions" intro="Behaviours that make ClimbOS feel quick and safe: direct manipulation, instant feedback, and an undo for everything.">
      <Specimen title="Drag and drop" description="Drag a card between columns, or focus it, press Space, move with arrows, Space to drop.">
        <Stage><DragDemo /></Stage>
        <Spec items={[["Lifted", "opacity 40% at origin; insertion line in sage"], ["Keyboard", "Space pick up · arrows move · Space drop · Esc cancel"], ["Announce", "polite live region after each move"]]} />
      </Specimen>
      <Specimen title="Inline editing" description="Click to edit. Enter or blur saves, Esc cancels, errors stay inline.">
        <Stage tone="white"><InlineDemo /></Stage>
      </Specimen>
      <Specimen title="Multi-item selection" description="Click selects one, ⌘/Ctrl-click toggles, Shift-click selects a range (rows or checkboxes).">
        <Stage><SelectionDemo /></Stage>
      </Specimen>
      <Specimen title="Keyboard navigation" description="Roving focus: one tab stop for the list, keys inside it.">
        <Stage><KeyboardDemo /></Stage>
      </Specimen>
      <Specimen title="Hover-reveal actions" description="Secondary actions show on hover and keyboard focus; always visible on touch.">
        <Stage><HoverDemo /></Stage>
      </Specimen>
      <Specimen title="Reorderable lists" description="Drag by the handle, or focus the handle and press ↑ ↓. Up/down buttons on hover.">
        <Stage><ReorderDemo /></Stage>
      </Specimen>
      <Specimen title="Undo / redo" description="Every change can be undone. Buttons name what they will revert.">
        <Stage tone="white"><UndoDemo /></Stage>
      </Specimen>
      <Specimen title="Auto-save" description="Saves 0.9s after typing stops. The status line always says where things stand.">
        <Stage tone="white"><AutoSaveDemo /></Stage>
        <Spec items={[["States", "Unsaved · Saving… · Saved at 9:41 · Couldn't save + Retry"]]} />
      </Specimen>
      <Specimen title="Optimistic updates" description="Show the result now, confirm in the background, roll back only what failed.">
        <Stage><OptimisticDemo /></Stage>
      </Specimen>
      <Specimen title="Real-time updates" description="Simulated stream every 2.5s. Pausing stops the interval; new items are marked.">
        <Stage><RealtimeDemo /></Stage>
      </Specimen>
      <Specimen title="Infinite scrolling" description="Loads 15 more when the end of the box comes into view. A Load more button stays for keyboard users.">
        <Stage><InfiniteDemo /></Stage>
      </Specimen>
      <Specimen title="Sticky action bars" description="Appears with the first change and sticks to the bottom of the scroll area.">
        <Stage><StickyDemo /></Stage>
      </Specimen>
      <Specimen title="Progressive disclosure" description="Show the essentials; tuck optional settings behind one toggle.">
        <Stage tone="white"><DisclosureDemo /></Stage>
      </Specimen>
      <Specimen title="Conditional fields" description="Fields appear only when an earlier answer makes them relevant.">
        <Stage tone="white"><ConditionalDemo /></Stage>
      </Specimen>
      <Specimen title="Multi-step forms" description="One question per step, validated before moving on; done steps can be revisited.">
        <Stage><MultiStepDemo /></Stage>
      </Specimen>
      <Specimen title="Copy-to-clipboard feedback">
        <Stage tone="white"><CopyDemo /></Stage>
      </Specimen>
    </DocPage>
  );
}
