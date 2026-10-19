"use client";

import { useState } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  Clapperboard,
  Gift,
  Globe,
  Home,
  Inbox,
  Mail,
  Megaphone,
  MessageSquare,
  Rocket,
  Smartphone,
  Sparkles,
  Star,
  Store,
  Users,
  Zap,
} from "@/components/icons";
import { Button, Checkbox, Field, Input, Kbd, RadioCards, Segmented, Sheet, Switch, Dialog, DialogContent, DialogFooter, DialogClose, toast } from "@/components/ui";
import {
  ContextualHelp,
  FeatureAnnouncement,
  FeatureSpotlight,
  FeedbackWidget,
  GuidedTooltip,
  HelpTip,
  OnboardingChecklist,
  ProductTour,
  SetupCompletion,
  SetupWizard,
  ShortcutGuide,
  ShortcutList,
  StarterTemplates,
  SupportChat,
  WelcomeScreen,
  WhatsNewPanel,
  useShortcutGuideKey,
  type ChangelogEntry,
  type ChatMessage,
  type ChecklistItem,
  type ShortcutGroup,
} from "@/components/ds/onboarding";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

export function OnboardingContent() {
  return (
    <DocPage eyebrow="Components" title="Onboarding & help" intro="Get people to their first result fast, then stay close with help that appears where it's needed.">
      <Specimen title="Welcome screen" description="One question, a clear start, and what happens next.">
        <WelcomeDemo />
        <Spec items={[["CTA", "Lime, the only lime on the screen"], ["Title", "heading-page (Reckless)"], ["Side", "Cream, timings per step"]]} />
      </Specimen>
      <Specimen title="Setup wizard" description="One topic per step. Finished steps stay clickable.">
        <WizardDemo />
      </Specimen>
      <Specimen title="Onboarding checklist" description="Tick a task or use its button; the next open task expands.">
        <ChecklistDemo />
      </Specimen>
      <Specimen title="Product tour" description="Step popovers over real UI. ← → to step, Esc to end.">
        <TourDemo />
        <Spec items={[["Dim", "50% ink outside the target"], ["Ring", "2px lime"], ["Max", "5 steps; always skippable"]]} />
      </Specimen>
      <Specimen title="Guided tooltip" description="A single hint pinned to one control. The beacon reopens it.">
        <GuidedTooltipDemo />
      </Specimen>
      <Specimen title="Feature spotlight" description="Introduce one new feature in context. One per session.">
        <SpotlightDemo />
      </Specimen>
      <Specimen title="Starter templates">
        <TemplatesDemo />
      </Specimen>
      <Specimen title="Setup completion indicator">
        <CompletionDemo />
      </Specimen>
      <Specimen title="Contextual help">
        <ContextHelpDemo />
      </Specimen>
      <Specimen title="Keyboard shortcut guide" description="Press ? anywhere on this page.">
        <ShortcutDemo />
      </Specimen>
      <Specimen title="What's new panel">
        <WhatsNewDemo />
      </Specimen>
      <Specimen title="Feature announcement">
        <AnnouncementDemo />
      </Specimen>
      <Specimen title="Feedback widget">
        <Stage className="max-w-xl">
          <FeedbackWidget
            onSubmit={async (r) => {
              await new Promise((res) => window.setTimeout(res, 700));
              toast({ title: `Thanks for the ${r}-star rating`, tone: "success" });
            }}
          />
        </Stage>
        <Spec items={[["Rating", "Radio group, arrow keys"], ["Comment", "Optional, prompt adapts to the score"]]} />
      </Specimen>
      <Specimen title="Support chat" description="A mock chat; replies are canned.">
        <SupportChatDemo />
      </Specimen>
    </DocPage>
  );
}

/* ------------------------------------------------------------------ */

function WelcomeDemo() {
  const [goal, setGoal] = useState<string | null>("calls");
  return (
    <Stage className="p-3 sm:p-6">
      <WelcomeScreen
        name="Maya"
        intro="Tell us the one thing you want more of. We'll read your website, check your competitors and draft a 30-day plan you approve."
        question="What do you want more of?"
        choices={[
          { value: "calls", label: "Phone calls", description: "People ringing to book", icon: <Smartphone /> },
          { value: "bookings", label: "Online bookings", description: "Forms and calendars", icon: <CalendarDays /> },
          { value: "reviews", label: "Reviews", description: "Google and Facebook", icon: <Star /> },
          { value: "visits", label: "Walk-ins", description: "Local foot traffic", icon: <Store /> },
        ]}
        value={goal}
        onChange={setGoal}
        onStart={() => toast({ title: "Plan started", description: "We'll show progress as we go.", tone: "success" })}
        onSkip={() => toast({ title: "Skipped. You can finish setup any time." })}
        next={[
          { label: "We read your website and reviews", time: "1 min" },
          { label: "We compare 5 local competitors", time: "1 min" },
          { label: "You approve a 30-day plan", time: "2 min" },
        ]}
      />
    </Stage>
  );
}

const CHANNELS = [
  { id: "google", label: "Google Business Profile" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "email", label: "Email" },
];

function WizardDemo() {
  const [step, setStep] = useState(0);
  const [biz, setBiz] = useState({ name: "Harbor Dental", site: "" });
  const [goal, setGoal] = useState("calls");
  const [channels, setChannels] = useState<string[]>(["google", "instagram"]);
  const [budget, setBudget] = useState<string>("200");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Stage>
        <div className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--card-shadow)]">
          <span className="grid size-10 place-items-center rounded-full bg-lime text-ink">
            <Check aria-hidden="true" className="size-5" />
          </span>
          <h3 className="heading-section">Setup complete</h3>
          <p className="text-sm text-ink-2">
            {biz.name} · {channels.length} channels · ${budget}/month. Your first plan is being drafted.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setDone(false);
              setStep(0);
            }}
          >
            Run the wizard again
          </Button>
        </div>
      </Stage>
    );
  }

  return (
    <Stage className="p-3 sm:p-6">
      <SetupWizard
        step={step}
        onStepChange={setStep}
        busy={busy}
        onFinish={() => {
          setBusy(true);
          window.setTimeout(() => {
            setBusy(false);
            setDone(true);
          }, 1000);
        }}
        steps={[
          {
            key: "business",
            label: "Business",
            title: "About your business",
            description: "We use this to read your site and find competitors.",
            canContinue: biz.name.trim().length > 0,
            content: (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name" error={biz.name.trim() ? undefined : "Add your business name"}>
                  <Input value={biz.name} onChange={(e) => setBiz((b) => ({ ...b, name: e.target.value }))} />
                </Field>
                <Field label="Website" optional hint="Leave blank if you don't have one">
                  <Input value={biz.site} placeholder="harbordental.com" onChange={(e) => setBiz((b) => ({ ...b, site: e.target.value }))} />
                </Field>
              </div>
            ),
          },
          {
            key: "goal",
            label: "Goal",
            title: "Your main goal",
            content: (
              <RadioCards
                aria-label="Main goal"
                value={goal}
                onValueChange={setGoal}
                options={[
                  { value: "calls", title: "More calls", description: "Ads and listings that ring", icon: <Smartphone /> },
                  { value: "bookings", title: "More bookings", description: "Landing pages and follow-ups", icon: <CalendarDays /> },
                  { value: "reviews", title: "More reviews", description: "Ask happy customers", icon: <Star /> },
                  { value: "repeat", title: "Repeat visits", description: "Email and SMS win-backs", icon: <Mail /> },
                ]}
              />
            ),
          },
          {
            key: "channels",
            label: "Channels",
            title: "Where you want to show up",
            description: "Pick at least one. You can connect them later.",
            canContinue: channels.length > 0,
            content: (
              <div className="grid gap-x-6 sm:grid-cols-2">
                {CHANNELS.map((c) => (
                  <Checkbox key={c.id} label={c.label} checked={channels.includes(c.id)} onCheckedChange={(v) => setChannels((l) => (v ? [...l, c.id] : l.filter((x) => x !== c.id)))} />
                ))}
              </div>
            ),
          },
          {
            key: "budget",
            label: "Budget",
            title: "Monthly ad budget",
            description: "Paid to Google and Meta directly. You can change it any time.",
            optional: true,
            content: (
              <div className="flex flex-col gap-2">
                <Segmented
                  label="Monthly ad budget"
                  value={budget}
                  onChange={setBudget}
                  options={[
                    { value: "0", label: "No ads" },
                    { value: "200", label: "$200" },
                    { value: "500", label: "$500" },
                    { value: "1000", label: "$1,000" },
                  ]}
                />
                <p className="text-xs text-ink-3">Most local businesses start at $200.</p>
              </div>
            ),
          },
          {
            key: "review",
            label: "Review",
            title: "Check and finish",
            content: (
              <dl className="grid gap-x-6 gap-y-2 text-ui sm:grid-cols-[140px_1fr]">
                <dt className="text-ink-3">Business</dt>
                <dd className="text-ink">{biz.name}{biz.site ? ` · ${biz.site}` : ""}</dd>
                <dt className="text-ink-3">Goal</dt>
                <dd className="text-ink capitalize">{goal}</dd>
                <dt className="text-ink-3">Channels</dt>
                <dd className="text-ink">{channels.map((c) => CHANNELS.find((x) => x.id === c)?.label).join(", ")}</dd>
                <dt className="text-ink-3">Ad budget</dt>
                <dd className="text-ink">{budget === "0" ? "No ads" : `$${budget}/month`}</dd>
              </dl>
            ),
          },
        ]}
      />
    </Stage>
  );
}

function ChecklistDemo() {
  const [items, setItems] = useState<Omit<ChecklistItem, "onAction">[]>([
    { id: "profile", title: "Add your business details", description: "Name, hours and services.", done: true, time: "2 min" },
    { id: "site", title: "Connect your website", description: "So we can track calls and form fills.", done: true, time: "1 min", actionLabel: "Connect" },
    { id: "google", title: "Connect Google Business Profile", description: "Lets us post updates and reply to reviews.", done: false, time: "1 min", actionLabel: "Connect Google" },
    { id: "plan", title: "Approve your first plan", description: "6 plays drafted from your goals.", done: false, time: "3 min", actionLabel: "Review plan" },
    { id: "team", title: "Invite a teammate", description: "They can approve posts when you're busy.", done: false, time: "1 min", actionLabel: "Invite" },
  ]);
  const [hidden, setHidden] = useState(false);
  const toggle = (id: string, done: boolean) => setItems((l) => l.map((i) => (i.id === id ? { ...i, done } : i)));
  return (
    <Stage className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
      {hidden ? (
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setHidden(false)}>
            Show checklist
          </Button>
        </div>
      ) : (
        <OnboardingChecklist
          items={items.map((i) => ({ ...i, onAction: () => toggle(i.id, true) }))}
          onToggle={toggle}
          onDismiss={() => setHidden(true)}
        />
      )}
      <div className="flex flex-col gap-2">
        <p className="text-overline">Sidebar version</p>
        <SetupCompletion variant="compact" done={items.filter((i) => i.done).length} total={items.length} next={items.find((i) => !i.done)?.title} onNext={() => setHidden(false)} />
      </div>
    </Stage>
  );
}

function MockApp() {
  return (
    <div className="grid min-h-[380px] grid-cols-[48px_minmax(0,1fr)] bg-bg sm:grid-cols-[168px_minmax(0,1fr)]">
      <nav aria-label="Demo app" className="flex flex-col gap-1 border-r border-line bg-surface p-2" data-tour="nav">
        {[
          [Home, "Today"],
          [Zap, "Plays"],
          [Users, "Leads"],
          [Megaphone, "Campaigns"],
          [BarChart3, "Results"],
        ].map(([I, l], n) => {
          const Icon = I as typeof Home;
          return (
            <span key={l as string} className={`flex h-8 items-center gap-2 rounded-[var(--radius-control)] px-2 text-ui ${n === 0 ? "bg-surface-2 font-medium text-ink" : "text-ink-2"}`}>
              <Icon aria-hidden="true" className="size-4 shrink-0" />
              <span className="hidden sm:inline">{l as string}</span>
            </span>
          );
        })}
      </nav>
      <div className="flex min-w-0 flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="heading-card">Today</p>
          <span data-tour="credits" className="inline-flex h-7 items-center gap-1.5 rounded-[var(--radius-badge)] bg-surface px-2 text-xs text-ink-2 shadow-[var(--card-shadow)]">
            <Sparkles aria-hidden="true" className="size-3.5" /> 840 credits
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-tour="kpis">
          {[
            ["Calls", "38"],
            ["Bookings", "21"],
            ["Reviews", "4.7"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-[var(--card-shadow)]">
              <p className="text-xs text-ink-3">{k}</p>
              <p className="text-xl font-semibold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-[var(--card-shadow)]">
          <div className="min-w-0 flex-1">
            <p className="text-ui font-medium text-ink">3 posts need approval</p>
            <p className="text-xs text-ink-3">Scheduled for this week</p>
          </div>
          <span data-tour="approve" className="inline-flex">
            <Button size="sm" tabIndex={-1}>
              Approve all
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}

const TOUR = [
  { target: "nav", title: "Your workspace", body: "Plays, leads and campaigns live here. Today shows what needs you." },
  { target: "kpis", title: "Results at a glance", body: "Calls, bookings and reviews from every channel, updated hourly." },
  { target: "approve", title: "Approve in one click", body: "Nothing goes live without you. Approve all, or open to edit." },
  { target: "credits", title: "Credits", body: "Each AI action uses credits. You get 50 free; top up any time." },
];

function TourDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Stage className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setOpen(true)}>
          <Rocket aria-hidden="true" /> Start tour
        </Button>
        <span className="text-xs text-ink-3">4 steps</span>
      </div>
      <ProductTour
        steps={TOUR}
        open={open}
        onClose={(finished) => {
          setOpen(false);
          if (finished) toast({ title: "Tour finished", description: "Replay it from Help any time.", tone: "success" });
        }}
        className="rounded-[var(--radius-card)] border border-line"
      >
        <MockApp />
      </ProductTour>
    </Stage>
  );
}

function GuidedTooltipDemo() {
  const [open, setOpen] = useState(true);
  const [auto, setAuto] = useState(false);
  return (
    <Stage tone="white" className="min-h-[260px]">
      <div className="flex flex-wrap items-center gap-3">
        <GuidedTooltip
          open={open}
          onOpen={() => setOpen(true)}
          title="Turn on autopilot"
          body="ClimbOS will publish approved plays on schedule. You still approve every post."
          step="Tip"
          tone="ink"
          onClose={() => setOpen(false)}
          primary={{
            label: "Got it",
            onClick: () => setOpen(false),
          }}
        >
          <span className="inline-flex items-center rounded-[var(--radius-control)] border border-line bg-surface px-3">
            <Switch label="Autopilot" checked={auto} onCheckedChange={setAuto} showStateText={false} className="gap-3" />
          </span>
        </GuidedTooltip>
        <Button variant="secondary" size="sm">
          <CalendarDays aria-hidden="true" /> Schedule
        </Button>
      </div>
    </Stage>
  );
}

function SpotlightDemo() {
  const [active, setActive] = useState(false);
  return (
    <Stage className="relative min-h-[300px] overflow-hidden">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setActive(true)} disabled={active}>
            Show spotlight
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-2 shadow-[var(--card-shadow)]">
          <span className="inline-flex h-8 items-center gap-2 px-2 text-ui text-ink-2">
            <Inbox aria-hidden="true" className="size-4" /> Inbox
          </span>
          <span className="inline-flex h-8 items-center gap-2 px-2 text-ui text-ink-2">
            <MessageSquare aria-hidden="true" className="size-4" /> Reviews
          </span>
          <FeatureSpotlight
            active={active}
            title="AI review replies"
            body="Drafts a reply to every new review in your voice. You approve before it posts."
            onTry={() => {
              setActive(false);
              toast({ title: "AI replies turned on", tone: "success" });
            }}
            onDismiss={() => setActive(false)}
          >
            <Button size="sm" variant="secondary" tabIndex={active ? -1 : 0}>
              <Sparkles aria-hidden="true" /> Auto-reply
            </Button>
          </FeatureSpotlight>
        </div>
      </div>
    </Stage>
  );
}

function TemplatesDemo() {
  const [pick, setPick] = useState<string | null>("reviews");
  return (
    <Stage className="flex flex-col gap-4">
      <StarterTemplates
        value={pick}
        onChange={setPick}
        onBlank={() => toast({ title: "Blank play created" })}
        templates={[
          { id: "reviews", title: "Get more reviews", description: "Ask recent customers by text and email, then thank them.", icon: <Star />, includes: "2 emails · 1 SMS · 14 days", tag: "Popular" },
          { id: "launch", title: "Launch an offer", description: "Posts, an email and a small ad around one offer.", icon: <Gift />, includes: "3 posts · 1 email · 1 ad" },
          { id: "winback", title: "Win back customers", description: "Reach people who haven't booked in 6 months.", icon: <Mail />, includes: "3 emails · 21 days" },
          { id: "local", title: "Show up on Google", description: "Weekly Google posts and Q&A from your services.", icon: <Globe />, includes: "4 posts / month" },
          { id: "reels", title: "Short video week", description: "Five reels from your photos with captions.", icon: <Clapperboard />, includes: "5 reels · 5 days", tag: "New" },
        ]}
      />
      <div className="flex justify-end">
        <Button disabled={!pick} onClick={() => toast({ title: "Template applied", tone: "success" })}>
          Use template
        </Button>
      </div>
    </Stage>
  );
}

function CompletionDemo() {
  const [done, setDone] = useState(3);
  const total = 6;
  const nexts = ["Add business details", "Connect website", "Connect Google", "Approve first plan", "Invite a teammate", "Turn on autopilot"];
  return (
    <Stage className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
      <div className="flex flex-col gap-3">
        <SetupCompletion done={done} total={total} next={nexts[done]} onNext={() => setDone((d) => Math.min(total, d + 1))} />
        <SetupCompletion done={total} total={total} />
      </div>
      <div className="flex flex-col gap-2">
        <SetupCompletion variant="compact" done={done} total={total} next={nexts[done]} onNext={() => setDone((d) => Math.min(total, d + 1))} />
        <Button size="sm" variant="ghost" onClick={() => setDone(0)}>
          Reset
        </Button>
      </div>
    </Stage>
  );
}

function ContextHelpDemo() {
  const [tip, setTip] = useState(true);
  return (
    <Stage tone="white" className="flex flex-col gap-5">
      {tip ? (
        <HelpTip title="Tip for Leads" onDismiss={() => setTip(false)}>
          Sort by score to call the hottest leads first. Scores update when someone opens an email or visits your site.
        </HelpTip>
      ) : (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setTip(true)}>
          Show tip again
        </Button>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-ui font-medium text-ink">
            Lead score
            <ContextualHelp topic="Lead score" learnMoreHref="#contextual-help">
              0–100. Combines fit (service, area) and intent (visits, replies). Above 80 means call today.
            </ContextualHelp>
          </span>
          <Input aria-label="Minimum lead score" defaultValue="70" type="number" />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-ui font-medium text-ink">
            Cost per lead
            <ContextualHelp topic="Cost per lead">Ad spend divided by new leads from ads in the same period.</ContextualHelp>
          </span>
          <p className="text-xl font-semibold tabular-nums">$18.40</p>
        </div>
      </div>
    </Stage>
  );
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    title: "General",
    items: [
      { keys: ["⌘", "K"], label: "Search and commands" },
      { keys: ["?"], label: "Show shortcuts" },
      { keys: ["/"], label: "Focus search" },
      { keys: ["Esc"], label: "Close panel" },
    ],
  },
  {
    title: "Go to",
    items: [
      { keys: ["G", "T"], label: "Today" },
      { keys: ["G", "L"], label: "Leads" },
      { keys: ["G", "P"], label: "Plays" },
      { keys: ["G", "C"], label: "Campaigns" },
    ],
  },
  {
    title: "Approvals",
    items: [
      { keys: ["A"], label: "Approve selected" },
      { keys: ["E"], label: "Edit draft" },
      { keys: ["R"], label: "Regenerate" },
    ],
  },
  {
    title: "Lists",
    items: [
      { keys: ["J"], label: "Next row" },
      { keys: ["K"], label: "Previous row" },
      { keys: ["X"], label: "Select row" },
    ],
  },
];

function ShortcutDemo() {
  const [open, setOpen] = useState(false);
  useShortcutGuideKey(() => setOpen(true));
  return (
    <Stage tone="white" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Keyboard shortcuts
        </Button>
        <span className="text-ui text-ink-3">
          or press <Kbd>?</Kbd>
        </span>
      </div>
      <ShortcutList groups={SHORTCUTS.slice(0, 2)} />
      <ShortcutGuide groups={SHORTCUTS} open={open} onOpenChange={setOpen} />
    </Stage>
  );
}

const CHANGELOG: ChangelogEntry[] = [
  { id: "c1", date: "18 Oct", kind: "new", title: "Schedule Reels", body: "Plan short videos alongside posts, with captions written for you.", unread: true },
  { id: "c2", date: "15 Oct", kind: "improved", title: "Faster plan builds", body: "Growth plans now finish in about 90 seconds, down from 4 minutes.", unread: true },
  { id: "c3", date: "11 Oct", kind: "new", title: "Review reply drafts", body: "Every new Google review gets a draft reply to approve." },
  { id: "c4", date: "6 Oct", kind: "fixed", title: "Instagram reconnect loop", body: "Reconnecting no longer asks twice." },
];

function WhatsNewDemo() {
  const [entries, setEntries] = useState(CHANGELOG);
  const unread = entries.filter((e) => e.unread).length;
  const read = (id?: string) => setEntries((l) => l.map((e) => (!id || e.id === id ? { ...e, unread: false } : e)));
  return (
    <Stage className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
      <WhatsNewPanel entries={entries} onMarkAllRead={() => read()} onOpenEntry={read} className="max-w-xl" />
      <div className="flex flex-col items-start gap-2">
        <p className="text-overline">In the top bar</p>
        <Sheet
          title="What's new"
          trigger={
            <Button variant="secondary" aria-label={unread ? `What's new, ${unread} unread` : "What's new"}>
              <Bell aria-hidden="true" /> What&apos;s new
              {unread ? <span className="rounded-[var(--radius-badge)] bg-ink px-1.5 text-2xs font-semibold leading-4 text-white">{unread}</span> : null}
            </Button>
          }
        >
          <WhatsNewPanel entries={entries} onMarkAllRead={() => read()} onOpenEntry={read} className="border-0 shadow-none" />
        </Sheet>
        <Button size="sm" variant="ghost" onClick={() => setEntries(CHANGELOG)}>
          Reset unread
        </Button>
      </div>
    </Stage>
  );
}

function ReelsMedia() {
  return (
    <div aria-hidden="true" className="flex h-full items-end gap-2">
      {[0.62, 0.8, 0.7, 0.92].map((h, i) => (
        <div key={i} className="flex flex-1 flex-col justify-end rounded-[var(--radius-card)] bg-surface p-1.5 shadow-[var(--card-shadow)]" style={{ height: `${Math.round(h * 100)}%`, minHeight: 90 }}>
          <div className="mb-1.5 flex-1 rounded-[3px] bg-surface-3" />
          <div className="h-1.5 w-3/4 rounded-full bg-surface-3" />
          <p className="mt-1 text-2xs text-ink-3">{["Mon", "Tue", "Wed", "Thu"][i]}</p>
        </div>
      ))}
    </div>
  );
}

function AnnouncementDemo() {
  const [shown, setShown] = useState(true);
  const [modal, setModal] = useState(false);
  return (
    <Stage className="flex flex-col gap-3">
      {shown ? (
        <FeatureAnnouncement
          title="Schedule Reels with your posts"
          body="Turn photos into 15-second reels with captions, then schedule them in the same calendar."
          media={<ReelsMedia />}
          ctaLabel="Try Reels"
          onCta={() => toast({ title: "Opening Reels…" })}
          onDismiss={() => setShown(false)}
        />
      ) : (
        <p className="text-sm text-ink-3">Announcement dismissed.</p>
      )}
      <div className="flex flex-wrap gap-2">
        {!shown ? (
          <Button size="sm" variant="ghost" onClick={() => setShown(true)}>
            Show again
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" onClick={() => setModal(true)}>
          Open as modal
        </Button>
      </div>
      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent title="Schedule Reels with your posts" description="New in ClimbOS · 18 Oct">
          <div className="h-40 rounded-[var(--radius-card)] bg-cream p-4">
            <ReelsMedia />
          </div>
          <p className="mt-4 text-sm text-ink-2">Turn photos into 15-second reels with captions, then schedule them alongside posts.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Maybe later</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={() => toast({ title: "Opening Reels…" })}>Try Reels</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Stage>
  );
}

const REPLIES: [RegExp, string][] = [
  [/credit|price|cost|bill/i, "Each AI action uses credits. Starter is $15 for 1,100 credits; you can top up any time from Billing."],
  [/instagram|connect|facebook/i, "Go to Settings → Connections and choose Reconnect. It takes about 30 seconds."],
  [/human|person|call/i, "Sure, I've flagged this for the team. Someone will reply here within 2 hours."],
];

function SupportChatDemo() {
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [n, setN] = useState(0);
  const [msgs, setMsgs] = useState<ChatMessage[]>([{ id: "m0", from: "agent", text: "Hi Maya, I'm Ava from ClimbOS. How can I help?", time: "10:41" }]);
  const send = (text: string) => {
    const k = n + 1;
    setN(k + 1);
    setMsgs((m) => [...m, { id: `u${k}`, from: "me", text, time: "10:42" }]);
    setTyping(true);
    window.setTimeout(() => {
      const reply = REPLIES.find(([re]) => re.test(text))?.[1] ?? "Thanks! I'll look into that. Anything else while I check?";
      setTyping(false);
      setMsgs((m) => [...m, { id: `a${k}`, from: "agent", text: reply, time: "10:42" }]);
    }, 1200);
  };
  return (
    <Stage className="relative min-h-[560px] overflow-hidden">
      <div className="flex max-w-sm flex-col gap-2">
        <p className="text-ui text-ink-2">The launcher sits bottom right on every app page. Open it to chat.</p>
        <p className="text-xs text-ink-3">Try: “How do credits work?” or “Reconnect Instagram”.</p>
      </div>
      <SupportChat
        position="inline"
        agentName="Ava"
        open={open}
        onOpenChange={setOpen}
        unread={open ? 0 : 1}
        messages={msgs}
        typing={typing}
        onSend={send}
        quickReplies={["How do credits work?", "Reconnect Instagram", "Talk to a person"]}
      />
    </Stage>
  );
}
