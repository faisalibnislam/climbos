"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Archive,
  Bold,
  Bookmark,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Italic,
  LayoutGrid,
  Link2,
  Mail,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  Table2,
  Trash2,
  Underline,
  UserRound,
  Users,
  X,
} from "@/components/icons";
import { Button, Checkbox, IconButton, Input, Label } from "@/components/ui";
import {
  AddButton,
  AsyncButton,
  BackButton,
  BulkAction,
  BulkActionBar,
  ButtonGroup,
  CloseButton,
  CopyButton,
  DropdownButton,
  ExpandButton,
  Fab,
  FormActions,
  KeyCombo,
  RefreshButton,
  RemoveButton,
  RowActions,
  SplitButton,
  ToggleButton,
  ToggleGroup,
  UndoRedo,
  matchesShortcut,
  useHistory,
} from "@/components/ds/actions";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";
import { ButtonContexts } from "../../_kit/signal";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const VARIANTS = ["primary", "secondary", "accent", "ghost", "danger", "link"] as const;
const SIZES = ["sm", "md", "lg"] as const;

export function ActionsContent() {
  return (
    <DocPage eyebrow="Components" title="Buttons & actions" intro="Black for the action that moves work forward, white for everything else, lime for the one thing that matters most.">
      <VariantsSpecimen />
      <IconOnlySpecimen />
      <SplitSpecimen />
      <DropdownSpecimen />
      <FabSpecimen />
      <ToggleSpecimen />
      <LoadingSpecimen />
      <CopySpecimen />
      <BackSpecimen />
      <CloseSpecimen />
      <RefreshSpecimen />
      <ExpandSpecimen />
      <AddRemoveSpecimen />
      <SaveCancelSpecimen />
      <UndoRedoSpecimen />
      <BulkSpecimen />
      <ContextualSpecimen />
      <GroupsSpecimen />
      <ShortcutsSpecimen />
    </DocPage>
  );
}

/* ---------------------------------------------------------------- */

function VariantsSpecimen() {
  return (
    <Specimen title="Button variants" description="Six variants on one height scale. One primary per view; accent (lime) only for upgrade and start.">
      <Stage tone="white">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-y-2 text-left">
            <thead>
              <tr>
                <th className="text-overline w-28 font-normal">Variant</th>
                {SIZES.map((s) => (
                  <th key={s} className="text-overline font-normal">
                    {s}
                  </th>
                ))}
                <th className="text-overline font-normal">Disabled</th>
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((v) => (
                <tr key={v}>
                  <td className="text-ui text-ink-2">{v}</td>
                  {SIZES.map((s) => (
                    <td key={s}>
                      <Button variant={v} size={s}>
                        {v === "danger" ? "Delete play" : v === "accent" ? "Upgrade" : "Approve"}
                      </Button>
                    </td>
                  ))}
                  <td>
                    <Button variant={v} disabled>
                      Approve
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button>
            <Send /> Send campaign
          </Button>
          <Button variant="secondary">
            <Download /> Export
          </Button>
          <Button variant="secondary">
            Next <ChevronRight />
          </Button>
          <Button loading loadingText="Sending…">
            Send
          </Button>
          <Button variant="secondary" loading>
            Export
          </Button>
        </div>
      </Stage>
      <ButtonContexts />
      <Spec
        items={[
          ["Heights", "sm var(--h-sm) · md var(--h-md) · lg var(--h-lg) (follow density)"],
          ["Radius", "--radius-control (3px app) · --radius-cta (7px inside .marketing)"],
          ["Label", "text-ui 13px medium, sentence case; lg 14px"],
          ["Icons", "16px (18px at lg), leading for actions, trailing for direction"],
        ]}
      />
    </Specimen>
  );
}

function IconOnlySpecimen() {
  return (
    <Specimen title="Icon-only button" description="Square, same heights as buttons. aria-label is required and doubles as the tooltip.">
      <Stage tone="white" className="flex flex-wrap items-center gap-6">
        {(["ghost", "secondary", "primary"] as const).map((v) => (
          <div key={v} className="flex items-center gap-1.5">
            <IconButton aria-label="Edit post" icon={<Pencil />} variant={v} size="sm" />
            <IconButton aria-label="Settings" icon={<Settings />} variant={v} />
            <IconButton aria-label="New play" icon={<Plus />} variant={v} size="lg" />
          </div>
        ))}
        <IconButton aria-label="Archive" icon={<Archive />} variant="secondary" disabled />
      </Stage>
      <Spec items={[["Sizes", "32 / 36 / 40 square"], ["Tooltip", "aria-label by default; tooltip={false} inside menu triggers"]]} />
    </Specimen>
  );
}

function SplitSpecimen() {
  const [last, setLast] = useState("Nothing yet");
  return (
    <Specimen title="Split button" description="A default action with close alternatives one click away.">
      <Stage tone="white" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <SplitButton
            onClick={() => setLast("Approved")}
            menuLabel="More approve options"
            actions={[
              { label: "Approve and schedule", icon: <CalendarClock />, onSelect: () => setLast("Approved and scheduled") },
              { label: "Approve all 6", icon: <Users />, onSelect: () => setLast("Approved all 6") },
              { label: "Send back with note", icon: <Pencil />, onSelect: () => setLast("Sent back"), separated: true },
            ]}
          >
            Approve
          </SplitButton>
          <SplitButton
            variant="secondary"
            onClick={() => setLast("Exported CSV")}
            menuLabel="Export formats"
            actions={[
              { label: "Export as PDF", onSelect: () => setLast("Exported PDF") },
              { label: "Copy to Google Sheets", onSelect: () => setLast("Copied to Sheets") },
            ]}
          >
            <Download /> Export CSV
          </SplitButton>
          <SplitButton size="sm" onClick={() => setLast("Published")} actions={[{ label: "Schedule…", onSelect: () => setLast("Scheduled") }]}>
            Publish
          </SplitButton>
        </div>
        <p className="text-xs text-ink-3" aria-live="polite">
          Last action: <span className="text-ink-2">{last}</span>
        </p>
      </Stage>
    </Specimen>
  );
}

function DropdownSpecimen() {
  const [range, setRange] = useState("30d");
  const [source, setSource] = useState("all");
  return (
    <Specimen title="Dropdown button" description="Opens a menu of actions, or picks one value from a short list.">
      <Stage tone="white" className="flex flex-wrap items-center gap-3">
        <DropdownButton
          variant="primary"
          icon={<Plus />}
          menuLabel="Create"
          actions={[
            { label: "Post", icon: <Megaphone />, shortcut: ["P"] },
            { label: "Email campaign", icon: <Mail />, shortcut: ["E"] },
            { label: "Lead", icon: <UserRound />, shortcut: ["L"] },
          ]}
        >
          New
        </DropdownButton>
        <DropdownButton
          actions={[
            { label: "Rename", icon: <Pencil /> },
            { label: "Duplicate", icon: <Copy />, shortcut: ["mod", "D"] },
            { label: "Delete", icon: <Trash2 />, danger: true, separated: true },
          ]}
        >
          Actions
        </DropdownButton>
        <DropdownButton
          variant="soft"
          size="sm"
          aria-label={`Period: ${range}`}
          menuLabel="Period"
          value={range}
          onValueChange={setRange}
          options={[
            { value: "7d", label: "Last 7 days" },
            { value: "30d", label: "Last 30 days" },
            { value: "6m", label: "Last 6 months" },
          ]}
        />
        <DropdownButton
          variant="secondary"
          size="sm"
          menuLabel="Source"
          value={source}
          onValueChange={setSource}
          options={[
            { value: "all", label: "All sources" },
            { value: "google", label: "Google Ads" },
            { value: "email", label: "Cold email" },
          ]}
        />
      </Stage>
    </Specimen>
  );
}

function FabSpecimen() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <Specimen title="Floating action button" description="Mobile and canvas screens only, one per screen. Speed dial for up to four creates.">
      <div className="grid gap-3 md:grid-cols-2">
        <Stage tone="white" label="Speed dial" className="relative h-72 overflow-hidden">
          <ul className="flex flex-col gap-2">
            {["Spring offer post", "Review reply", "Win-back email"].map((t) => (
              <li key={t} className="rounded-[var(--radius-card)] border border-line bg-surface-2 px-3 py-2 text-ui text-ink-2">
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3" aria-live="polite">
            {last ? `Started: ${last}` : "Open the button in the corner."}
          </p>
          <Fab
            position="absolute"
            icon={<Plus />}
            label="Create"
            actions={[
              { label: "New post", icon: <Megaphone />, onSelect: () => setLast("New post") },
              { label: "New lead", icon: <UserRound />, onSelect: () => setLast("New lead") },
              { label: "New campaign", icon: <Mail />, onSelect: () => setLast("New campaign") },
            ]}
          />
        </Stage>
        <Stage label="Single and extended" className="flex flex-wrap items-end gap-4">
          <Fab position="static" icon={<Plus />} label="New post" onClick={() => setLast("New post")} />
          <Fab position="static" extended icon={<Pencil />} label="Write post" onClick={() => setLast("Write post")} />
          <Fab position="static" extended tone="lime" icon={<Send />} label="Launch play" onClick={() => setLast("Launch play")} />
        </Stage>
      </div>
      <Spec items={[["Size", "48px, --radius-cta, shadow-lg"], ["Position", "fixed 24px from the bottom-right; clear of the mobile tab bar"], ["Keys", "Esc closes the speed dial and returns focus"]]} />
    </Specimen>
  );
}

function ToggleSpecimen() {
  const [follow, setFollow] = useState(false);
  const [saved, setSaved] = useState(true);
  const [marks, setMarks] = useState<string[]>(["bold"]);
  const [view, setView] = useState<string[]>(["grid"]);
  return (
    <Specimen title="Toggle button" description="aria-pressed on/off. Pressed reads by fill and weight, not colour alone.">
      <Stage tone="white" className="flex flex-wrap items-center gap-4">
        <ToggleButton pressed={follow} onPressedChange={setFollow} icon={follow ? undefined : <Plus />}>
          {follow ? "Following" : "Follow competitor"}
        </ToggleButton>
        <ToggleButton variant="ghost" pressed={saved} onPressedChange={setSaved} icon={<Bookmark />} aria-label="Save to favourites" />
        <ToggleGroup
          label="Text style"
          iconOnly
          value={marks}
          onValueChange={setMarks}
          items={[
            { value: "bold", label: "Bold", icon: <Bold /> },
            { value: "italic", label: "Italic", icon: <Italic /> },
            { value: "underline", label: "Underline", icon: <Underline /> },
          ]}
        />
        <ToggleGroup
          label="View"
          type="single"
          value={view}
          onValueChange={setView}
          items={[
            { value: "grid", label: "Cards", icon: <LayoutGrid /> },
            { value: "table", label: "Table", icon: <Table2 /> },
          ]}
        />
      </Stage>
    </Specimen>
  );
}

function LoadingSpecimen() {
  return (
    <Specimen title="Loading button" description="Spinner while busy, label kept so width barely moves; a short confirmation after.">
      <Stage tone="white" className="flex flex-wrap items-center gap-3">
        <AsyncButton onClick={() => wait(1400)} loadingText="Drafting plan…" successText="Plan ready">
          Draft my plan
        </AsyncButton>
        <AsyncButton variant="secondary" onClick={() => wait(900)} successText="Synced">
          Sync leads
        </AsyncButton>
        <AsyncButton
          variant="secondary"
          onClick={async () => {
            await wait(900);
            throw new Error("Network");
          }}
          errorText="Failed, try again"
        >
          Connect Google
        </AsyncButton>
        <Button loading size="sm">
          Saving
        </Button>
      </Stage>
      <Spec items={[["State", "aria-busy while running; result announced politely"], ["Confirmation", "1.6s, then back to the label"]]} />
    </Specimen>
  );
}

function CopySpecimen() {
  const link = "https://climbos.app/r/spring-offer?utm_source=instagram";
  return (
    <Specimen title="Copy button" description="Puts a value on the clipboard and confirms with a tick for two seconds.">
      <Stage tone="white" className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-[var(--radius-control)] bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-ink-2">{link}</code>
          <CopyButton value={link} iconOnly label="Copy tracking link" />
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={link} label="Copy link" />
          <CopyButton value="SPRING20" label="Copy code" variant="ghost" />
        </div>
      </Stage>
    </Specimen>
  );
}

function BackSpecimen() {
  return (
    <Specimen title="Back button" description="Top-left of detail pages. A real link when the parent is known.">
      <Stage tone="white" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <BackButton href="#back-button">Campaigns</BackButton>
          <h3 className="heading-card">Spring offer · Instagram</h3>
        </div>
        <div className="flex items-center gap-2 border-t border-line pt-4">
          <BackButton href="#back-button" iconOnly>
            Back to plays
          </BackButton>
          <span className="text-ui font-medium">Win-back email</span>
        </div>
      </Stage>
    </Specimen>
  );
}

function CloseSpecimen() {
  const [banner, setBanner] = useState(true);
  return (
    <Specimen title="Close button" description="Dismisses dialogs, panels, banners and chips. Always labelled.">
      <div className="grid gap-3 md:grid-cols-2">
        <Stage tone="white" className="flex flex-col gap-3">
          {banner ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface-2 p-3">
              <p className="flex-1 text-ui text-ink-2">Your Google Ads account reconnected. Reports update overnight.</p>
              <CloseButton label="Dismiss notice" onClick={() => setBanner(false)} />
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setBanner(true)} className="self-start">
              Show notice again
            </Button>
          )}
          <div className="flex items-center gap-2">
            <CloseButton size="sm" />
            <CloseButton size="md" />
            <CloseButton size="lg" />
          </div>
        </Stage>
        <Stage tone="ink" className="flex items-center justify-between gap-3">
          <span className="text-ui">3 posts selected</span>
          <CloseButton tone="dark" label="Clear selection" />
        </Stage>
      </div>
    </Specimen>
  );
}

function RefreshSpecimen() {
  const [updated, setUpdated] = useState("Updated 14 min ago");
  return (
    <Specimen title="Refresh button" description="Re-fetches data. Freshness sits beside it so people know if they need it.">
      <Stage tone="white" className="flex flex-wrap items-center gap-6">
        <RefreshButton
          lastUpdated={updated}
          onRefresh={async () => {
            await wait(1200);
            setUpdated("Updated just now");
          }}
        />
        <RefreshButton iconOnly label="Refresh leads" onRefresh={() => wait(900)} />
      </Stage>
    </Specimen>
  );
}

function ExpandSpecimen() {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState([true, false, false]);
  const all = sections.every(Boolean);
  const titles = ["Audience", "Budget", "Schedule"];
  return (
    <Specimen title="Expand / collapse button" description="Chevron turns with the state; aria-expanded carries it for screen readers.">
      <div className="grid gap-3 md:grid-cols-2">
        <Stage tone="white">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ui font-medium">Why this play</p>
            <ExpandButton expanded={open} onExpandedChange={setOpen} controls={`${id}-why`}>
              {open ? "Hide" : "Show"}
            </ExpandButton>
          </div>
          <div id={`${id}-why`} hidden={!open} className="mt-2 text-voice text-ink-2">
            Three of your top customers came from local search last month. A review push should lift calls by about a fifth.
          </div>
        </Stage>
        <Stage tone="white" className="flex flex-col gap-1">
          <div className="mb-1 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setSections(sections.map(() => !all))}>
              {all ? "Collapse all" : "Expand all"}
            </Button>
          </div>
          {titles.map((t, i) => (
            <div key={t} className="rounded-[var(--radius-control)] border border-line">
              <div className="flex items-center justify-between pl-3">
                <span className="text-ui font-medium">{t}</span>
                <ExpandButton iconOnly expanded={sections[i]} onExpandedChange={(v) => setSections(sections.map((s, j) => (j === i ? v : s)))} controls={`${id}-s${i}`}>
                  {`${t} details`}
                </ExpandButton>
              </div>
              <p id={`${id}-s${i}`} hidden={!sections[i]} className="border-t border-line px-3 py-2 text-ui text-ink-2">
                {["Homeowners within 10 miles", "$12 a day, capped at $360", "Weekdays, 8am to 6pm"][i]}
              </p>
            </div>
          ))}
        </Stage>
      </div>
    </Specimen>
  );
}

function AddRemoveSpecimen() {
  const [rows, setRows] = useState([
    { id: 1, key: "utm_source", value: "instagram" },
    { id: 2, key: "utm_campaign", value: "spring-offer" },
  ]);
  const next = useRef(3);
  const list = useRef<HTMLDivElement>(null);
  const add = () => {
    const id = next.current++;
    setRows((r) => [...r, { id, key: "", value: "" }]);
    requestAnimationFrame(() => list.current?.querySelector<HTMLInputElement>(`[data-row="${id}"]`)?.focus());
  };
  return (
    <Specimen title="Add / remove button" description="Add sits under the list; remove sits at the end of each row. Destructive removes ask once more.">
      <Stage tone="white" className="flex max-w-xl flex-col gap-2">
        <div ref={list} className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <Input size="sm" aria-label="Parameter" data-row={r.id} value={r.key} placeholder="utm_medium" onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, key: e.target.value } : x)))} className="font-mono text-xs" />
              <Input size="sm" aria-label="Value" value={r.value} placeholder="value" onChange={(e) => setRows(rows.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)))} />
              <RemoveButton itemLabel={r.key || "empty parameter"} onRemove={() => setRows(rows.filter((x) => x.id !== r.id))} icon="x" />
            </div>
          ))}
        </div>
        <AddButton appearance="dashed" onClick={add}>
          Add parameter
        </AddButton>
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
          <span className="text-ui text-ink-2">Delete the whole link set</span>
          <RemoveButton confirm itemLabel="link set" onRemove={() => setRows([])} />
          <AddButton onClick={add}>Add</AddButton>
        </div>
      </Stage>
    </Specimen>
  );
}

function SaveCancelSpecimen() {
  const [saved, setSaved] = useState("Plumbing & heating");
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const dirty = draft !== saved;
  return (
    <Specimen title="Save / cancel buttons" description="Save stays disabled until something changes. Cancel restores the last saved value.">
      <Stage tone="white" className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="biz-cat">Business category</Label>
          <Input
            id="biz-cat"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setStatus(null);
            }}
          />
        </div>
        <FormActions
          dirty={dirty}
          saving={saving}
          status={!dirty && status ? status : undefined}
          onCancel={() => setDraft(saved)}
          onSave={async () => {
            setSaving(true);
            await wait(900);
            setSaved(draft);
            setSaving(false);
            setStatus("Saved just now");
          }}
        />
      </Stage>
      <Spec items={[["Order", "Note left · Cancel (ghost) · Save (primary) right"], ["Sticky", "sticky prop pins it to the bottom of long forms"]]} />
    </Specimen>
  );
}

const CHANNELS = ["Google Ads", "Instagram", "Cold email", "Google reviews", "Facebook"];

function UndoRedoSpecimen() {
  const h = useHistory<string[]>(CHANNELS);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (matchesShortcut(e, ["mod", "Z"])) {
      e.preventDefault();
      h.undo();
    } else if (matchesShortcut(e, ["mod", "shift", "Z"])) {
      e.preventDefault();
      h.redo();
    }
  };
  return (
    <Specimen title="Undo / redo buttons" description="Prefer undo over 'Are you sure?'. Remove a channel, then undo it.">
      <Stage tone="white">
        <div onKeyDown={onKey} className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-ui font-medium">Channels in this play</p>
            <UndoRedo canUndo={h.canUndo} canRedo={h.canRedo} onUndo={h.undo} onRedo={h.redo} />
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {h.value.map((c) => (
              <li key={c} className="inline-flex h-7 items-center gap-1 rounded-[var(--radius-badge)] bg-surface-2 pl-2.5 pr-1 text-xs text-ink-2">
                {c}
                <button type="button" aria-label={`Remove ${c}`} onClick={() => h.set(h.value.filter((x) => x !== c))} className="grid size-5 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-3 hover:text-ink">
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              </li>
            ))}
            {h.value.length === 0 ? <li className="text-xs text-ink-3">No channels. Undo to bring them back.</li> : null}
          </ul>
          <p className="text-xs text-ink-3">
            Keyboard inside this box: <KeyCombo keys={["mod", "Z"]} /> undo · <KeyCombo keys={["mod", "shift", "Z"]} /> redo
          </p>
        </div>
      </Stage>
    </Specimen>
  );
}

const LEADS = [
  { id: "l1", name: "Maya Chen", co: "Chen Dental", stage: "New" },
  { id: "l2", name: "Tom Okafor", co: "Okafor Roofing", stage: "Contacted" },
  { id: "l3", name: "Priya Shah", co: "Bloom Florist", stage: "Booked call" },
  { id: "l4", name: "Leo Martins", co: "Martins Auto", stage: "New" },
];

function BulkSpecimen() {
  const [sel, setSel] = useState<string[]>(["l1", "l3"]);
  const [note, setNote] = useState<string | null>(null);
  const all = sel.length === LEADS.length;
  const act = (verb: string) => {
    setNote(`${verb} ${sel.length} leads`);
    setSel([]);
  };
  return (
    <Specimen title="Bulk action toolbar" description="Appears while rows are selected; the count and Clear are always there.">
      <Stage tone="white" className="flex flex-col gap-3">
        <div className="relative overflow-x-auto">
          <ul className="min-w-[420px] divide-y divide-line rounded-[var(--radius-card)] border border-line">
            <li className="flex items-center gap-2 bg-surface-2 px-3">
              <Checkbox aria-label="Select all leads" checked={all ? true : sel.length ? "indeterminate" : false} onCheckedChange={() => setSel(all ? [] : LEADS.map((l) => l.id))} />
              <span className="text-overline">Lead</span>
            </li>
            {LEADS.map((l) => (
              <li key={l.id} className="flex items-center gap-2 px-3">
                <Checkbox aria-label={`Select ${l.name}`} checked={sel.includes(l.id)} onCheckedChange={(c) => setSel(c ? [...sel, l.id] : sel.filter((x) => x !== l.id))} />
                <span className="flex-1 text-ui font-medium">{l.name}</span>
                <span className="w-32 text-ui text-ink-3">{l.co}</span>
                <span className="w-24 text-xs text-ink-2">{l.stage}</span>
              </li>
            ))}
          </ul>
        </div>
        <BulkActionBar count={sel.length} total={LEADS.length} noun={sel.length === 1 ? "lead" : "leads"} onClear={() => setSel([])} onSelectAll={() => setSel(LEADS.map((l) => l.id))}>
          <BulkAction icon={<Mail />} onClick={() => act("Emailed")}>
            Email
          </BulkAction>
          <BulkAction icon={<UserRound />} onClick={() => act("Assigned")}>
            Assign
          </BulkAction>
          <BulkAction icon={<Archive />} onClick={() => act("Archived")}>
            Archive
          </BulkAction>
          <BulkAction icon={<Trash2 />} danger onClick={() => act("Deleted")}>
            Delete
          </BulkAction>
        </BulkActionBar>
        {note && sel.length === 0 ? <p className="text-xs text-ink-3">{note}. Select rows to see the bar again.</p> : null}
      </Stage>
    </Specimen>
  );
}

function ContextualSpecimen() {
  const [last, setLast] = useState<string | null>(null);
  const posts = ["Spring offer reel", "Five-star review story", "Weekend hours update"];
  return (
    <Specimen title="Contextual action button" description="Quick actions appear on row hover or focus; everything else lives in More. On touch they always show.">
      <Stage tone="white" className="flex flex-col gap-2">
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line">
          {posts.map((p) => (
            <li key={p} className="group/row flex h-[var(--cell-h,40px)] items-center gap-3 pl-3 pr-1 hover:bg-surface-2">
              <span className="flex-1 truncate text-ui">{p}</span>
              <RowActions
                itemLabel={p}
                quick={[
                  { label: "Edit", icon: <Pencil />, onSelect: () => setLast(`Edit · ${p}`) },
                  { label: "Schedule", icon: <CalendarClock />, onSelect: () => setLast(`Schedule · ${p}`) },
                ]}
                menu={[
                  { label: "Duplicate", icon: <Copy />, onSelect: () => setLast(`Duplicate · ${p}`) },
                  { label: "Copy link", icon: <Link2 />, onSelect: () => setLast(`Copy link · ${p}`) },
                  { label: "Delete", icon: <Trash2 />, danger: true, separated: true, onSelect: () => setLast(`Delete · ${p}`) },
                ]}
              />
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-3" aria-live="polite">
          {last ?? "Hover a row or tab into it."}
        </p>
      </Stage>
    </Specimen>
  );
}

function GroupsSpecimen() {
  const [align, setAlign] = useState("left");
  return (
    <Specimen title="Button groups" description="Attached for one control with parts; spaced for separate actions.">
      <Stage tone="white" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-4">
          <ButtonGroup label="Week">
            <Button variant="secondary" size="sm" aria-label="Previous week">
              <ChevronLeft />
            </Button>
            <Button variant="secondary" size="sm">
              This week
            </Button>
            <Button variant="secondary" size="sm" aria-label="Next week">
              <ChevronRight />
            </Button>
          </ButtonGroup>
          <ButtonGroup label="Alignment">
            {[
              ["left", "Align left", <AlignLeft key="l" />],
              ["center", "Align centre", <AlignCenter key="c" />],
              ["right", "Align right", <AlignRight key="r" />],
            ].map(([v, l, icon]) => (
              <Button key={v as string} variant="secondary" size="sm" aria-label={l as string} aria-pressed={align === v} onClick={() => setAlign(v as string)} className="w-8 px-0 aria-pressed:bg-surface-3">
                {icon}
              </Button>
            ))}
          </ButtonGroup>
        </div>
        <ButtonGroup label="Post actions" appearance="spaced">
          <Button variant="ghost">Cancel</Button>
          <Button variant="secondary">Save draft</Button>
          <Button>Publish</Button>
        </ButtonGroup>
      </Stage>
      <Spec items={[["Attached", "secondary only, shared 1px border, one shadow"], ["Spaced", "8px gap; primary last (right)"]]} />
    </Specimen>
  );
}

function ShortcutsSpecimen() {
  const combos: [string, string[]][] = [
    ["Search", ["mod", "K"]],
    ["New post", ["N"]],
    ["Approve", ["mod", "enter"]],
    ["Undo", ["mod", "Z"]],
    ["Redo", ["mod", "shift", "Z"]],
    ["Close", ["esc"]],
    ["Next item", ["J"]],
    ["Previous item", ["K"]],
  ];
  return (
    <Specimen title="Keyboard shortcut indicators" description="⌘ on Mac, Ctrl elsewhere, chosen at runtime. Read as words by screen readers.">
      <div className="grid gap-3 md:grid-cols-2">
        <Stage tone="white">
          <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-ui">
            {combos.map(([label, keys]) => (
              <div key={label} className="contents">
                <dt className="text-ink-2">{label}</dt>
                <dd>
                  <KeyCombo keys={keys} />
                </dd>
              </div>
            ))}
          </dl>
        </Stage>
        <Stage tone="white" className="flex flex-col items-start gap-3">
          <Button variant="secondary" className="w-64 justify-start text-ink-3">
            <Search /> <span className="flex-1 text-left">Search leads, posts…</span> <KeyCombo keys={["mod", "K"]} />
          </Button>
          <Button>
            Approve <KeyCombo keys={["mod", "enter"]} tone="dark" />
          </Button>
          <DropdownButton
            size="sm"
            actions={[
              { label: "Duplicate", icon: <Copy />, shortcut: ["mod", "D"] },
              { label: "Archive", icon: <Archive />, shortcut: ["E"] },
              { label: "Delete", icon: <Trash2 />, shortcut: ["backspace"], danger: true, separated: true },
            ]}
          >
            In menus
          </DropdownButton>
          <KeyCombo keys={["mod", "K"]} size="md" />
        </Stage>
      </div>
      <Spec items={[["Chip", "20px (sm) / 24px (md), --radius-control, text-2xs"], ["Dark", "tone=\"dark\" on ink buttons and tooltips"]]} />
    </Specimen>
  );
}
