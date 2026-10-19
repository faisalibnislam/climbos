"use client";

import { useState } from "react";
import {
  Archive,
  CalendarClock,
  ChartLine,
  Check,
  Copy,
  Eye,
  Inbox,
  LayoutGrid,
  Mail,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Rocket,
  Send,
  Settings,
  Share2,
  Sparkles,
  Star,
  Trash2,
  UserRound,
  Wallet,
} from "@/components/icons";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  IconButton,
  Input,
  Kbd,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Select,
  Sheet,
  SheetClose,
  Textarea,
  Tooltip,
  toast,
} from "@/components/ui";
import { CommandPalette, type CommandItem } from "@/components/ds/navigation";
import {
  ActionSheet,
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  FullScreenModal,
  HoverCard,
  Lightbox,
  NotificationCenter,
  OnboardingTarget,
  OnboardingTour,
  QuickPreview,
  type LightboxItem,
  type NotificationItem,
} from "@/components/ds/overlays";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

const said = (t: string) => toast({ title: t, tone: "success", duration: 2200 });

/* ------------------------------------------------------------------ */

function ModalDemo() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap gap-3">
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setErr(null);
        }}
      >
        <DialogTrigger asChild>
          <Button>New campaign</Button>
        </DialogTrigger>
        <DialogContent title="New campaign" description="Name it and pick a goal. You can change both later.">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return setErr("Give the campaign a name.");
              setOpen(false);
              said(`“${name.trim()}” created as a draft`);
              setName("");
            }}
          >
            <Field label="Name" error={err ?? undefined}>
              <Input value={name} onChange={(e) => (setName(e.target.value), setErr(null))} placeholder="Spring launch" />
            </Field>
            <Field label="Goal">
              <Select defaultValue="calls" options={[{ value: "calls", label: "Booked calls" }, { value: "visits", label: "Store visits" }, { value: "reviews", label: "Google reviews" }]} />
            </Field>
            <DialogFooter className="mt-2">
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button type="submit">Create draft</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        trigger={<Button variant="secondary">Pause autopilot</Button>}
        title="Pause autopilot?"
        description="Scheduled posts and emails stop until you resume. Nothing is deleted."
        confirmLabel="Pause autopilot"
        tone="danger"
        onConfirm={async () => {
          await new Promise<void>((r) => setTimeout(r, 700));
          said("Autopilot paused");
        }}
      />
    </div>
  );
}

function FullScreenDemo() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("Sourdough Saturday is back. Fresh loaves from 8am, while they last. Pre-order by Friday and skip the line.");
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil aria-hidden /> Open post editor
      </Button>
      <FullScreenModal
        open={open}
        onOpenChange={setOpen}
        title="Edit post · Sourdough Saturday"
        description="Instagram + Facebook · scheduled Sat 8:00"
        actions={
          <>
            <Button variant="secondary" size="sm" className="hidden sm:inline-flex" onClick={() => said("Draft saved")}>Save draft</Button>
            <Button size="sm" onClick={() => (setOpen(false), said("Sent for approval"))}>Send for approval</Button>
          </>
        }
        aside={
          <div className="flex flex-col gap-3 p-5">
            <p className="heading-card">Checks</p>
            {["Brand voice", "Offer is clear", "Link tracked", "Image fits 4:5"].map((c) => (
              <p key={c} className="flex items-center gap-2 text-ui text-ink-2"><Check aria-hidden className="size-4 text-green-800" /> {c}</p>
            ))}
          </div>
        }
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-5 sm:p-8">
          <Field label="Caption" hint={`${text.length} / 2,200`}>
            <Textarea autosize rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="grid aspect-[4/5] max-w-sm place-items-center rounded-[var(--radius-card)] bg-cream p-8 text-center text-2xl font-semibold text-ink">Sourdough Saturday</div>
        </div>
      </FullScreenModal>
    </>
  );
}

function DrawerDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Sheet
        title="Priya Shah"
        description="Hot lead · came from Google search"
        trigger={<Button variant="secondary">Open lead (right)</Button>}
      >
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-ui">
            <dt className="text-ink-3">Email</dt><dd>priya@florist.co</dd>
            <dt className="text-ink-3">Source</dt><dd>Google · “wedding cakes near me”</dd>
            <dt className="text-ink-3">Score</dt><dd className="font-semibold tabular-nums">86</dd>
          </dl>
          <p className="text-voice">Priya asked about a 3-tier cake for 120 guests. Reply today while she&apos;s comparing quotes.</p>
          <div className="mt-2 flex gap-2">
            <SheetClose asChild><Button onClick={() => said("Reply drafted")}>Draft reply</Button></SheetClose>
            <SheetClose asChild><Button variant="secondary">Close</Button></SheetClose>
          </div>
        </div>
      </Sheet>
      <Sheet side="left" title="Filters" trigger={<Button variant="secondary">Filters (left)</Button>}>
        <div className="flex flex-col gap-4">
          <Field label="Status"><Select defaultValue="all" options={[{ value: "all", label: "All leads" }, { value: "hot", label: "Hot" }, { value: "new", label: "New" }]} /></Field>
          <Field label="Source"><Select defaultValue="any" options={[{ value: "any", label: "Any source" }, { value: "google", label: "Google" }, { value: "instagram", label: "Instagram" }]} /></Field>
          <SheetClose asChild><Button onClick={() => said("Filters applied")}>Apply</Button></SheetClose>
        </div>
      </Sheet>
      <Sheet side="bottom" title="Share report" trigger={<Button variant="secondary">Bottom sheet</Button>}>
        <p className="text-sm text-ink-2">Bottom sheets suit phones: short choices within thumb reach.</p>
      </Sheet>
    </div>
  );
}

function PopoverDemo() {
  const [time, setTime] = useState("Sat 8:00");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary"><CalendarClock aria-hidden /> {time}</Button>
        </PopoverTrigger>
        <PopoverContent>
          <p className="mb-2 text-ui font-semibold">Reschedule post</p>
          <div className="grid grid-cols-3 gap-1.5">
            {["Fri 18:00", "Sat 8:00", "Sat 11:00", "Sun 9:00", "Sun 17:00", "Mon 7:30"].map((t) => (
              <PopoverClose asChild key={t}>
                <button type="button" aria-pressed={t === time} onClick={() => setTime(t)} className={`h-8 rounded-[var(--radius-control)] text-ui outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${t === time ? "bg-ink text-white" : "bg-surface-2 hover:bg-surface-3"}`}>
                  {t}
                </button>
              </PopoverClose>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-3">Best time for your audience: Sat 8:00.</p>
        </PopoverContent>
      </Popover>
      <span className="text-ui text-ink-3">Anchored, non-modal. Esc closes and returns focus.</span>
    </div>
  );
}

function TooltipDemo() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <IconButton aria-label="Duplicate" icon={<Copy />} variant="secondary" />
      <IconButton aria-label="Archive" icon={<Archive />} variant="secondary" />
      <Tooltip content="Credits cover AI drafts, images and sends. 1 credit = 1¢." side="right">
        <button type="button" className="rounded-[var(--radius-control)] text-ui text-brand-800 underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">What are credits?</button>
      </Tooltip>
      <Tooltip content={<span className="flex items-center gap-1.5">New campaign <Kbd className="border-white/30 bg-transparent text-white">C</Kbd></span>} side="bottom">
        <Button size="sm"><Plus aria-hidden /> New</Button>
      </Tooltip>
    </div>
  );
}

function DropdownDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary"><MoreHorizontal aria-hidden /> Campaign actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Spring launch</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem icon={<Pencil />} onSelect={() => said("Edit")}>Edit</DropdownMenuItem>
          <DropdownMenuItem icon={<Copy />} onSelect={() => said("Duplicated")}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem icon={<Share2 />} onSelect={() => said("Link copied")}>Share results</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Archive />} onSelect={() => said("Archived")}>Archive</DropdownMenuItem>
        <DropdownMenuItem danger icon={<Trash2 />} onSelect={() => said("Deleted")}>Delete campaign</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContextMenuDemo() {
  const [pinned, setPinned] = useState(true);
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div tabIndex={0} aria-label="Post: Sourdough Saturday. Right-click or press Shift+F10 for actions." className="flex max-w-sm cursor-context-menu items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
          <span aria-hidden className="grid size-12 place-items-center rounded-[var(--radius-control)] bg-cream text-xs font-semibold">IMG</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Sourdough Saturday</span>
            <span className="block text-xs text-ink-3">Scheduled · Sat 8:00 {pinned ? "· Pinned" : ""}</span>
          </span>
          <Badge tone="amber">Needs approval</Badge>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Post</ContextMenuLabel>
        <ContextMenuItem icon={<Check />} shortcut="A" onSelect={() => said("Approved")}>Approve</ContextMenuItem>
        <ContextMenuItem icon={<Pencil />} shortcut="E" onSelect={() => said("Edit")}>Edit caption</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger icon={<CalendarClock />}>Reschedule</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {["Tomorrow 8:00", "Sat 11:00", "Next week"].map((t) => (
              <ContextMenuItem key={t} onSelect={() => said(`Moved to ${t}`)}>{t}</ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuCheckboxItem checked={pinned} onCheckedChange={(v) => setPinned(v === true)}>Pin to Today</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuItem danger icon={<Trash2 />} onSelect={() => said("Deleted")}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

const PALETTE_ITEMS: CommandItem[] = [
  { id: "new-campaign", label: "New campaign", group: "Create", icon: <Plus />, shortcut: ["C"] },
  { id: "new-post", label: "Draft a post", group: "Create", icon: <Sparkles /> },
  { id: "today", label: "Today", group: "Go to", icon: <LayoutGrid />, shortcut: ["G", "T"] },
  { id: "inbox", label: "Inbox", group: "Go to", icon: <Inbox />, shortcut: ["G", "I"] },
  { id: "results", label: "Results", group: "Go to", icon: <ChartLine /> },
  { id: "priya", label: "Priya Shah", group: "Leads", icon: <UserRound />, hint: "Hot lead" },
  { id: "launch", label: "Launch spring offer", group: "Plays", icon: <Rocket />, hint: "Ready" },
  { id: "credits", label: "Buy credits", group: "Account", icon: <Wallet /> },
  { id: "settings", label: "Settings", group: "Account", icon: <Settings /> },
];

function PaletteDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={() => setOpen(true)}>Open command palette</Button>
      <span className="text-ui text-ink-3">In the app: <Kbd>⌘</Kbd> <Kbd>K</Kbd> anywhere.</span>
      <CommandPalette open={open} onOpenChange={setOpen} items={PALETTE_ITEMS} onSelect={(it) => said(it.label)} placeholder="Search or run a command" />
    </div>
  );
}

function ActionSheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}><MoreHorizontal aria-hidden /> Post options</Button>
      <ActionSheet
        open={open}
        onOpenChange={setOpen}
        title="Sourdough Saturday"
        description="Scheduled for Sat 8:00"
        onAction={(id) => said(id)}
        actions={[
          { id: "Approved", label: "Approve and schedule", icon: <Check /> },
          { id: "Edit", label: "Edit caption", icon: <Pencil /> },
          { id: "Sent now", label: "Post now", icon: <Send />, description: "Skips the schedule" },
          { id: "Deleted", label: "Delete post", icon: <Trash2 />, danger: true },
        ]}
      />
    </>
  );
}

function HoverCardDemo() {
  return (
    <p className="text-sm text-ink-2">
      New reply from{" "}
      <HoverCard
        trigger={
          <a href="#hover-card" className="font-medium text-brand-800 underline decoration-brand-800/40 underline-offset-4 outline-none hover:decoration-brand-800 focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">
            Priya Shah
          </a>
        }
      >
        <div className="flex items-start gap-3">
          <Avatar name="Priya Shah" size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Priya Shah</p>
            <p className="text-xs text-ink-3">Priya&apos;s Florist · Mission District</p>
          </div>
          <Badge tone="green">Hot</Badge>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[["86", "Score"], ["3", "Replies"], ["$1.2k", "Est. value"]].map(([v, k]) => (
            <div key={k} className="rounded-[var(--radius-control)] bg-surface-2 py-2">
              <dd className="text-sm font-semibold tabular-nums">{v}</dd>
              <dt className="text-2xs text-ink-3">{k}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-3">Last: “Can you do 120 guests on the 14th?” · 2h</p>
      </HoverCard>{" "}
      about catering.
    </p>
  );
}

const POSTS = [
  { id: "p1", title: "Sourdough Saturday", channel: "Instagram", when: "Sat 8:00", status: "Needs approval", text: "Sourdough Saturday is back. Fresh loaves from 8am, while they last." },
  { id: "p2", title: "Spring brunch menu", channel: "Facebook", when: "Sun 9:00", status: "Scheduled", text: "Our spring brunch menu lands this weekend: rhubarb tarts, pea frittata and more." },
  { id: "p3", title: "Catering for 40+", channel: "Email", when: "Mon 7:30", status: "Draft", text: "Planning an event? We now cater for groups of 40 or more. Reply for a quote." },
  { id: "p4", title: "Meet the bakers", channel: "Instagram", when: "Wed 12:00", status: "Scheduled", text: "Say hi to Sam and Lucía, up at 4am so your croissants are warm." },
];

function QuickPreviewDemo() {
  const [index, setIndex] = useState<number | null>(null);
  return (
    <>
      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {POSTS.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              onKeyDown={(e) => {
                if (e.key === " ") {
                  e.preventDefault();
                  setIndex(i);
                }
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-surface-2/60 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.title}</span>
                <span className="block text-xs text-ink-3">{p.channel} · {p.when}</span>
              </span>
              <span className="hidden text-xs text-ink-3 sm:inline">Space to preview</span>
              <Eye aria-hidden className="size-4 text-ink-3" />
            </button>
          </li>
        ))}
      </ul>
      <QuickPreview
        items={POSTS}
        index={index}
        onIndexChange={setIndex}
        title={(p) => p.title}
        meta={(p) => `${p.channel} · ${p.when} · ${p.status}`}
        render={(p) => (
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <div className="grid aspect-[4/5] place-items-center rounded-[var(--radius-card)] bg-cream p-4 text-center font-semibold">{p.title}</div>
            <p className="text-sm text-ink-2">{p.text}</p>
          </div>
        )}
        footer={(p) => (
          <>
            <Button variant="secondary" size="sm" onClick={() => said(`Open ${p.title}`)}>Open</Button>
            <Button size="sm" onClick={() => said(`Approved ${p.title}`)}>Approve</Button>
          </>
        )}
      />
    </>
  );
}

const TONES = ["bg-cream text-ink", "bg-sage-ink text-white", "bg-brand-100 text-brand-900", "bg-ink text-white", "bg-lime text-ink"];
const SHOTS = ["Sourdough Saturday", "Spring brunch", "Meet the bakers", "Catering for 40+", "Opening hours"];
const MEDIA: LightboxItem[] = SHOTS.map((s, i) => ({
  id: `m${i}`,
  alt: s,
  caption: `Instagram · ${["4:5", "1:1", "4:5", "16:9", "1:1"][i]} · generated ${i + 1}d ago`,
  content: <div className={`grid aspect-[4/5] h-full max-h-[56vh] place-items-center rounded-[var(--radius-card)] p-8 text-center text-3xl font-semibold ${TONES[i]}`}>{s}</div>,
  thumb: <span className={`block size-14 ${TONES[i].split(" ")[0]}`} />,
}));

function LightboxDemo() {
  const [index, setIndex] = useState<number | null>(null);
  return (
    <>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {MEDIA.map((m, i) => (
          <li key={m.id}>
            <button type="button" aria-label={`View ${m.alt}`} onClick={() => setIndex(i)} className={`grid aspect-square w-full place-items-center rounded-[var(--radius-card)] p-2 text-center text-xs font-semibold outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${TONES[i]}`}>
              {m.alt}
            </button>
          </li>
        ))}
      </ul>
      <Lightbox items={MEDIA} index={index} onIndexChange={setIndex} />
    </>
  );
}

const NOTES: NotificationItem[] = [
  { id: "n1", title: "3 posts need your approval", body: "Autopilot drafted this week's posts.", time: "5m", group: "Today", read: false, icon: <Megaphone />, actionLabel: "Review" },
  { id: "n2", title: "Priya Shah replied", body: "“Can you do 120 guests on the 14th?”", time: "2h", group: "Today", read: false, icon: <MessageCircle />, actionLabel: "Reply" },
  { id: "n3", title: "Spring launch beat its goal", body: "42 booked calls vs 35 planned.", time: "6h", group: "Today", read: true, icon: <Star /> },
  { id: "n4", title: "Credits running low", body: "180 left. Top up to keep autopilot running.", time: "Yesterday", group: "Earlier", read: false, icon: <Wallet />, actionLabel: "Top up" },
  { id: "n5", title: "Newsletter sent to 1,204 people", time: "Mon", group: "Earlier", read: true, icon: <Mail /> },
];

function NotificationDemo() {
  const [items, setItems] = useState(NOTES);
  return (
    <div className="flex items-center gap-3">
      <NotificationCenter
        items={items}
        onRead={(id) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)))}
        onReadAll={() => setItems((xs) => xs.map((x) => ({ ...x, read: true })))}
        onAction={(id) => said(items.find((x) => x.id === id)?.actionLabel ?? "Open")}
        onSettings={() => said("Notification settings")}
      />
      <span className="text-ui text-ink-3">{items.filter((i) => !i.read).length} unread</span>
      <Button size="sm" variant="ghost" onClick={() => setItems(NOTES)}>Reset</Button>
    </div>
  );
}

const STEPS = [
  { title: "Welcome to ClimbOS", body: "A two-minute tour of where growth happens. Use ← → or the buttons." },
  { target: "kpi", title: "Your number", body: "Booked calls this month, against the plan. Everything else serves this." },
  { target: "approvals", title: "Approve, then relax", body: "Autopilot drafts posts and emails. Nothing goes out until you approve.", placement: "top" as const },
  { target: "create", title: "Start something new", body: "Campaigns, plays and posts all start here." },
];

function OnboardingDemo() {
  const [step, setStep] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button onClick={() => setStep(0)}>Start tour</Button>
        <span className="text-ui text-ink-3" aria-live="polite">{step === null ? "Tour is off." : `Step ${step + 1} of ${STEPS.length}`}</span>
      </div>
      <OnboardingTour steps={STEPS} step={step} onStepChange={setStep} className="rounded-[8px]">
        <div className="grid gap-4 rounded-[8px] border border-line bg-bg p-4 pb-40 sm:grid-cols-2 sm:p-6 sm:pb-40">
          <OnboardingTarget id="kpi">
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
              <p className="text-ui text-ink-2">Booked calls</p>
              <p className="text-[32px] font-semibold leading-10 tabular-nums">42</p>
              <p className="text-xs text-ink-3">Plan: 35 this month</p>
            </div>
          </OnboardingTarget>
          <div className="flex items-start justify-end">
            <OnboardingTarget id="create">
              <Button><Plus aria-hidden /> Create</Button>
            </OnboardingTarget>
          </div>
          <OnboardingTarget id="approvals" className="sm:col-span-2">
            <div className="flex items-center justify-between rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
              <span className="text-sm">3 posts need approval</span>
              <Badge tone="amber">Waiting</Badge>
            </div>
          </OnboardingTarget>
        </div>
      </OnboardingTour>
    </div>
  );
}

export function OverlaysContent() {
  return (
    <DocPage eyebrow="Components" title="Overlays" intro="Layers above the page. Use the lightest one that does the job: tooltip, popover, drawer, then modal.">
      <Specimen title="Modal dialog" description="Blocks the page for one decision or a short form. Confirm states exactly what happens.">
        <Stage><ModalDemo /></Stage>
        <Spec items={[["Width", "512px max; 448px for confirms"], ["Focus", "trapped; returns to the trigger"], ["Buttons", "explicit verbs, never OK / Yes"]]} />
      </Specimen>
      <Specimen title="Full-screen modal" description="For focused work with its own toolbar: editors, review queues.">
        <Stage><FullScreenDemo /></Stage>
      </Specimen>
      <Specimen title="Side drawer" description="Details and filters without losing the list. Right for records, left for filters, bottom on phones.">
        <Stage><DrawerDemo /></Stage>
      </Specimen>
      <Specimen title="Popover">
        <Stage><PopoverDemo /></Stage>
      </Specimen>
      <Specimen title="Tooltip" description="Short extra hints on hover and focus. Never the only place information lives.">
        <Stage><TooltipDemo /></Stage>
      </Specimen>
      <Specimen title="Dropdown menu">
        <Stage><DropdownDemo /></Stage>
      </Specimen>
      <Specimen title="Context menu" description="Right-click, Shift+F10 or the menu key. Mirrors the row's visible actions.">
        <Stage><ContextMenuDemo /></Stage>
      </Specimen>
      <Specimen title="Command palette" description="The command menu in a modal: one place to go anywhere or do anything.">
        <Stage><PaletteDemo /></Stage>
      </Specimen>
      <Specimen title="Action sheet" description="Phone-first list of actions with a separate Cancel.">
        <Stage><ActionSheetDemo /></Stage>
      </Specimen>
      <Specimen title="Hover card" description="A rich peek on hover or focus. The link still goes to the full page.">
        <Stage tone="white"><HoverCardDemo /></Stage>
      </Specimen>
      <Specimen title="Quick preview" description="Click a row or press Space. ← → step through, Esc returns to the row.">
        <Stage><QuickPreviewDemo /></Stage>
      </Specimen>
      <Specimen title="Lightbox" description="Full-screen media with arrows, counter and thumbnails.">
        <Stage><LightboxDemo /></Stage>
      </Specimen>
      <Specimen title="Notification center">
        <Stage><NotificationDemo /></Stage>
      </Specimen>
      <Specimen title="Onboarding overlay" description="Coach marks: dim the area, lift one target, explain it in one line.">
        <Stage><OnboardingDemo /></Stage>
      </Specimen>
    </DocPage>
  );
}
