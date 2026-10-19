"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Mail, Megaphone, PanelLeft, Pause, Play, RotateCcw, Sparkles, Store } from "@/components/icons";
import {
  AIActionPreview,
  AIAgentStatus,
  AIApprovalRequest,
  AIAssistantPanel,
  AIAutomationToggle,
  AIChat,
  AICommandBar,
  AIConfidence,
  AIContentPreview,
  AICostBreakdown,
  AIExecutionLogs,
  AIExecutionTimeline,
  AIFeedbackControls,
  AIInsights,
  AIMemoryControls,
  AIModelSelector,
  AIPromptInput,
  AIPromptTemplates,
  AIReasoningSummary,
  AIRegenerateButton,
  AISourceCitations,
  AISuggestionCard,
  AITaskQueue,
  AIToolPermissions,
  AIUsageTracker,
  AIAnomalyAlert,
  formatSeconds,
  type AgentState,
  type AutomationMode,
  type ChatMessage,
  type LogLine,
  type ModelTier,
  type StepStatus,
  type TimelineStep,
} from "@/components/ds/ai";
import { Button, Skeleton, toast } from "@/components/ui";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

const CHAT: ChatMessage[] = [
  { id: "u0", role: "user", text: "Why did class bookings drop last week?" },
  {
    id: "a0",
    role: "assistant",
    text: "Bookings fell from 18 to 11. Your Instagram posts skipped Saturday, and that’s when most people book. The class page also lost its “Book now” button after Tuesday’s menu update.",
    model: "luna",
    credits: 2,
    time: "9:14",
  },
];

const PANEL_CHAT: ChatMessage[] = [
  { id: "p0", role: "assistant", text: "This week has 4 drafts waiting. The Saturday reel is the one that matters most.", model: "luna", credits: 1, time: "9:20" },
];

const COMMANDS = [
  { id: "c1", label: "Draft 3 posts for this week", hint: "Instagram and Facebook, in your voice", credits: 6 },
  { id: "c2", label: "Find 20 local leads", hint: "Offices within 2 miles that order catering", credits: 24 },
  { id: "c3", label: "Write a win-back email", hint: "To guests who haven’t booked in 60 days", credits: 4 },
  { id: "c4", label: "Check my Google profile", hint: "Hours, photos, reviews to answer", credits: 3 },
  { id: "c5", label: "Explain this week’s results", hint: "Plain-English summary with sources", credits: 9 },
];

const PLAN: { id: string; label: string; secs: number; model: ModelTier; credits: number; findings: string[] }[] = [
  { id: "s1", label: "Read tartinebakery.com", secs: 3, model: "luna", credits: 2, findings: ["12 pages, menu and class schedule found", "No booking link on the home page"] },
  { id: "s2", label: "Check Google profile and reviews", secs: 4, model: "luna", credits: 3, findings: ["4.7 stars from 312 reviews", "8 recent reviews mention classes"] },
  { id: "s3", label: "Scan 6 nearby competitors", secs: 5, model: "luna", credits: 4, findings: ["3 now sell sourdough", "None run classes"] },
  { id: "s4", label: "Plan growth plays", secs: 6, model: "sol", credits: 18, findings: ["5 plays ranked by bookings per credit"] },
  { id: "s5", label: "Draft the first 3 posts", secs: 5, model: "sol", credits: 14, findings: ["3 drafts ready"] },
  { id: "s6", label: "Send drafts to Approvals", secs: 1, model: "luna", credits: 0, findings: [] },
];
const TOTAL = PLAN.reduce((s, p) => s + p.secs, 0);

const STARTS = PLAN.map((_, i) => PLAN.slice(0, i).reduce((s, p) => s + p.secs, 0));

/** Step states and credits spent at time t (seconds). */
function snapshot(t: number): { steps: TimelineStep[]; credits: number } {
  const rows = PLAN.map((p, i) => {
    const start = STARTS[i];
    const end = start + p.secs;
    const status: StepStatus = t >= end ? "done" : t >= start ? "running" : "queued";
    const frac = status === "done" ? 1 : status === "running" ? (t - start) / p.secs : 0;
    const step: TimelineStep = {
      id: p.id,
      label: p.label,
      model: p.model,
      status,
      time: status === "done" ? `${p.secs}.0s` : status === "running" ? `${(t - start).toFixed(1)}s` : undefined,
      findings: p.findings.slice(0, Math.floor(frac * p.findings.length)),
    };
    return { step, credits: Math.round(p.credits * frac) };
  });
  return { steps: rows.map((r) => r.step), credits: rows.reduce((s, r) => s + r.credits, 0) };
}

/** Simulated run: ticks every 100ms while playing. Starts paused mid-run so SSR shows a live state. */
function useSimulatedRun() {
  const [tenths, setTenths] = useState(98);
  const [playing, setPlaying] = useState(false);
  const total = TOTAL * 10;
  const active = playing && tenths < total;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTenths((t) => Math.min(total, t + 1)), 100);
    return () => window.clearInterval(id);
  }, [active, total]);
  const t = tenths / 10;
  const { steps, credits } = snapshot(t);
  const done = tenths >= total;
  return {
    steps,
    progress: (tenths / total) * 100,
    secondsLeft: TOTAL - t,
    credits,
    playing: active,
    done,
    toggle: () => {
      if (done) setTenths(0);
      setPlaying(done ? true : !playing);
    },
  };
}

const LOGS: LogLine[] = [
  { t: "09:14:02.118", level: "info", source: "researcher", msg: "run started · plan=first-week · model=luna" },
  { t: "09:14:02.402", level: "debug", source: "fetch", msg: "GET https://tartinebakery.com 200 (284ms)" },
  { t: "09:14:03.951", level: "info", source: "researcher", msg: "found 12 pages, 1 menu, 1 class schedule" },
  { t: "09:14:04.007", level: "warn", source: "researcher", msg: "no booking link on / (checked header, hero, footer)" },
  { t: "09:14:06.330", level: "debug", source: "places", msg: "profile loaded · 312 reviews · rating 4.7" },
  { t: "09:14:09.812", level: "error", source: "competitors", msg: "maps quota hit for 1 of 6 shops · retry in 30s" },
  { t: "09:14:40.019", level: "info", source: "competitors", msg: "retry ok · 6 of 6 shops scanned" },
  { t: "09:14:46.500", level: "info", source: "planner", msg: "switched to sol for planning · est 18 credits" },
  { t: "09:14:52.771", level: "info", source: "planner", msg: "5 plays ranked · top: Saturday class reel" },
  { t: "09:14:57.204", level: "info", source: "writer", msg: "3 drafts → approvals · spent 41 credits" },
];

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function AIContent() {
  const run = useSimulatedRun();
  const [agents, setAgents] = useState<Record<string, AgentState>>({ writer: "waiting", outreach: "paused" });
  const [model, setModel] = useState<ModelTier>("sol");
  const [compactModel, setCompactModel] = useState<ModelTier>("luna");
  const [auto, setAuto] = useState(true);
  const [mode, setMode] = useState<AutomationMode>("approve");
  const [panelOpen, setPanelOpen] = useState(true);
  const researcherState: AgentState = run.done ? "idle" : run.playing ? "working" : "paused";
  const runningStep = useMemo(() => run.steps.find((s) => s.status === "running"), [run.steps]);

  return (
    <DocPage eyebrow="Components" title="AI" intro="ClimbOS researches, plans and drafts, then waits for you. Every AI surface shows what it’s doing, what it costs and what it found.">
      <Specimen title="AI chat interface" description="Replies speak in Reckless (text-voice). New replies type out; reduced motion shows them at once.">
        <AIChat initial={CHAT} />
        <Spec items={[["Reply", "text-voice, AIMark avatar, model · credits · time"], ["You", "surface-2 bubble, text-sm"], ["Keys", "Enter sends, Shift+Enter new line"]]} />
      </Specimen>

      <Specimen title="AI prompt input" description="Attachments, model picker, cost estimate and send.">
        <Stage>
          <div className="mx-auto flex max-w-xl flex-col gap-4">
            <AIPromptInput
              initialAttachments={["tartine-menu.pdf", "storefront.jpg"]}
              onSend={(t, a, m) => toast({ title: "Sent to ClimbOS", description: `${t.slice(0, 48)}${a.length ? ` · ${a.length} files` : ""} · ${m === "sol" ? "Sol" : "Luna"}` })}
            />
            <AIPromptInput canUseSol={false} placeholder="Starter plan: Sol is locked in the model menu" onSend={() => toast({ title: "Sent" })} />
          </div>
        </Stage>
        <Spec items={[["Min height", "36px, grows to 160px"], ["Focus", "border turns ink"], ["Send", "disabled until there is text"]]} />
      </Specimen>

      <Specimen title="AI command bar" description="Type to filter. Anything that isn’t a command becomes a request.">
        <Stage>
          <AICommandBar className="mx-auto max-w-xl" commands={COMMANDS} />
        </Stage>
      </Specimen>

      <Specimen title="AI assistant panel" description="Docked to the right of any page. Knows what you’re looking at.">
        <Stage className="p-0 sm:p-0">
          <div className="flex h-[540px] overflow-hidden rounded-[var(--radius-card)]">
            <div className="hidden min-w-0 flex-1 flex-col gap-3 p-5 sm:flex">
              <div className="flex items-center justify-between">
                <h3 className="heading-card">Posts</h3>
                <Button size="sm" variant="secondary" onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen}>
                  <PanelLeft aria-hidden className="rotate-180" />
                  {panelOpen ? "Hide assistant" : "Ask ClimbOS"}
                </Button>
              </div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
                  <Skeleton className="size-10 animate-none" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-1/2 animate-none" />
                    <Skeleton className="h-3 w-1/3 animate-none" />
                  </div>
                </div>
              ))}
            </div>
            {panelOpen ? (
              <AIAssistantPanel
                className="w-full sm:w-[340px] sm:shrink-0"
                context="Posts"
                messages={PANEL_CHAT}
                suggestions={["Which draft first?", "Make Saturday’s shorter", "Best time to post?"]}
                onClose={() => setPanelOpen(false)}
              />
            ) : (
              <div className="grid flex-1 place-items-center sm:hidden">
                <Button size="sm" onClick={() => setPanelOpen(true)}>
                  Ask ClimbOS
                </Button>
              </div>
            )}
          </div>
        </Stage>
        <Spec items={[["Width", "340px; full width under 640px"], ["Context chip", "Looking at: <page>"]]} />
      </Specimen>

      <Specimen title="AI suggestion card">
        <div className="grid gap-3 md:grid-cols-2">
          <AISuggestionCard title="Post a Saturday class reel" why="Saturday is when 60% of your bookings happen, and reels of the starter get your most saves." impact="+6–9 bookings a week" confidence={0.82} credits={9} />
          <AISuggestionCard title="Answer 14 unreplied reviews" why="Replying lifts how often Google shows you. Most of these are short thank-yous I can draft." impact="+4% profile views" confidence={0.58} credits={6} />
        </div>
      </Specimen>

      <Specimen title="AI-generated insights">
        <AIInsights
          updated="9:14"
          insights={[
            { id: "i1", metric: "Class bookings", delta: "−39%", good: false, body: "The class page lost its Book now button on Tuesday. Bookings dropped the same day.", action: "Restore the button" },
            { id: "i2", metric: "Saturday saves", delta: "+112%", good: true, body: "Reels of the starter get twice the saves of photos. Keep one every Saturday.", action: "Plan the next reel" },
            { id: "i3", metric: "Catering leads", delta: "+5", good: true, body: "Five offices on Valencia St opened your email twice. Worth a follow-up this week." },
          ]}
        />
      </Specimen>

      <Specimen title="AI action preview" description="What will change, before it changes.">
        <AIActionPreview
          title="Update your Google profile description"
          target="Google Business Profile · Tartine Bakery"
          before="Tartine is a bakery in San Francisco. We sell bread and pastries. Open daily."
          after="Tartine is a neighbourhood bakery in the Mission. Fresh sourdough daily, and weekend bread classes you can book online."
        />
      </Specimen>

      <Specimen title="AI execution timeline" description="Bar, time left, each step with model and time, and what it found as it finds it.">
        <AIExecutionTimeline
          title="Research and first-week plan"
          steps={run.steps}
          progress={run.progress}
          secondsLeft={run.secondsLeft}
          credits={run.credits}
          actions={
            <Button size="sm" variant="secondary" onClick={run.toggle}>
              {run.done ? <RotateCcw aria-hidden /> : run.playing ? <Pause aria-hidden /> : <Play aria-hidden />}
              {run.done ? "Run again" : run.playing ? "Pause" : "Resume"}
            </Button>
          }
        />
        <Spec items={[["Statuses", "Done · Running · Queued · Waiting for you · Failed · Skipped"], ["Findings", "Appear under the step as they arrive"]]} />
      </Specimen>

      <Specimen title="AI task queue" description="Reorder, pause or cancel before a task starts.">
        <AITaskQueue
          initial={[
            { id: "q1", title: "Research and first-week plan", agent: "Researcher", model: "sol", credits: 41, eta: "18s", status: "running", progress: 64 },
            { id: "q2", title: "Find 20 local catering leads", agent: "Outreach", model: "luna", credits: 24, eta: "1m", status: "queued" },
            { id: "q3", title: "Draft win-back email", agent: "Writer", model: "luna", credits: 4, eta: "3m", status: "queued" },
            { id: "q4", title: "Weekly results summary", agent: "Analyst", model: "sol", credits: 9, eta: "—", status: "paused" },
          ]}
        />
      </Specimen>

      <Specimen title="AI agent status">
        <div className="grid gap-3 md:grid-cols-3">
          <AIAgentStatus
            name="Researcher"
            role="Reads your site, reviews and rivals"
            state={researcherState}
            task={runningStep ? runningStep.label : run.done ? "Finished the first-week plan" : "Paused mid-run"}
            progress={run.progress}
            secondsLeft={run.secondsLeft}
            lastAction={run.done ? "Done just now" : `${formatSeconds(run.secondsLeft)} left`}
            onToggle={run.done ? undefined : run.toggle}
          />
          <AIAgentStatus name="Writer" role="Drafts posts and emails" state={agents.writer} task="3 drafts wait for your approval" lastAction="Waiting 12m" onToggle={() => setAgents({ ...agents, writer: agents.writer === "paused" ? "waiting" : "paused" })} />
          <AIAgentStatus name="Outreach" role="Finds and emails local leads" state={agents.outreach} task="Paused by you yesterday" lastAction="Last ran 18h ago" onToggle={() => setAgents({ ...agents, outreach: agents.outreach === "paused" ? "working" : "paused" })} />
        </div>
        <Spec items={[["States", "Working (pulsing dot) · Idle · Needs you · Paused · Stopped"], ["Rule", "State is always written, never colour only"]]} />
      </Specimen>

      <Specimen title="AI reasoning summary" description="Collapsed by default. One sentence first, detail on demand.">
        <Stage tone="white">
          <AIReasoningSummary
            defaultOpen
            meta="14 sources · 38s"
            summary="Your classes sell out when people see them on Saturday morning, and no rival offers them. A reel puts the one thing only you have in front of the people most likely to book."
            points={["60% of bookings land Saturday 8–11am", "Reels get 2.1× the saves of photos on your account", "None of the 6 nearby bakeries run classes", "Costs about 9 credits to draft and schedule"]}
          />
        </Stage>
      </Specimen>

      <Specimen title="AI confidence indicator" description="Five segments plus the word. Low confidence also changes the text colour.">
        <Stage tone="white">
          <div className="grid gap-6 sm:grid-cols-3">
            <AIConfidence value={0.86} />
            <AIConfidence value={0.62} />
            <AIConfidence value={0.31} />
          </div>
          <div className="mt-5 flex flex-wrap gap-5 border-t border-line pt-4">
            <AIConfidence value={0.86} variant="inline" />
            <AIConfidence value={0.62} variant="inline" />
            <AIConfidence value={0.31} variant="inline" />
          </div>
        </Stage>
        <Spec items={[["High", "≥ 75%"], ["Medium", "50–74%"], ["Low", "< 50%: say what would raise it"]]} />
      </Specimen>

      <Specimen title="AI model selector" description="Luna is Basic on every plan. Sol is Expert on paid plans. Cost per draft is always shown.">
        <AIModelSelector value={model} onChange={setModel} />
        <AIModelSelector value="luna" onChange={() => undefined} canUseSol={false} onUpgrade={() => toast({ title: "Pro unlocks Sol", description: "$39 a month, 3,000 credits." })} />
        <Stage>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-3">Compact, inside a prompt bar:</span>
            <AIModelSelector variant="compact" value={compactModel} onChange={setCompactModel} />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="AI automation toggle">
        <AIAutomationToggle
          className="max-w-lg"
          label="Social autopilot"
          description="Plans and drafts 3 posts a week from your plays."
          on={auto}
          onOnChange={setAuto}
          mode={mode}
          onModeChange={setMode}
          dailyCap={40}
          nextRun="Mon 9:00"
        />
      </Specimen>

      <Specimen title="AI approval request" description="Approve, edit then approve, or reject with a reason.">
        <AIApprovalRequest
          className="max-w-xl"
          agent="Writer"
          action="Post this to Instagram?"
          channel="Instagram"
          when="Sat 9:00"
          credits={9}
          draft="Saturday bread class has 4 seats left. Learn to shape a country loaf, take your starter home. Book from the link in bio."
          note="Mentions seat count. It updates if more people book before 9:00."
        />
      </Specimen>

      <Specimen title="AI content preview" description="The draft as it will look on each channel, with the character limit.">
        <AIContentPreview
          business="Tartine Bakery"
          variants={[
            { channel: "Instagram", limit: 2200, body: "Saturday bread class: 4 seats left\nShape a country loaf and take your starter home.", tags: "#sourdough #missionsf #bakingclass" },
            { channel: "Facebook", limit: 500, body: "Our Saturday bread class has 4 seats left. Shape a country loaf, take your own starter home, and leave with flour on your sleeves. Book online." },
            { channel: "Email", limit: 300, subject: "4 seats left this Saturday", body: "Hi Maya, our bread class is nearly full. Want one of the last seats?" },
          ]}
        />
      </Specimen>

      <Specimen title="AI regenerate button" description="Pick a tone, regenerate, and step through versions.">
        <Stage>
          <AIRegenerateButton
            className="max-w-xl"
            versions={[
              "Saturday bread class has 4 seats left. Book from the link in bio.",
              "Only 4 seats left for Saturday’s bread class. Grab one before they go.",
              "Want to bake your own sourdough? Saturday’s class has 4 seats.",
              "Last call: 4 seats in Saturday’s bread class.",
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="AI prompt templates">
        <AIPromptTemplates
          onUse={(t) => toast({ title: `Template loaded: ${t.title}` })}
          templates={[
            { id: "t1", title: "Week of posts", prompt: "Plan and draft 3 posts for this week from my top plays, in my voice.", category: "Social", credits: 6, icon: <Megaphone /> },
            { id: "t2", title: "Win-back email", prompt: "Email past customers who haven’t visited in 60 days with one reason to come back.", category: "Email", credits: 4, icon: <Mail /> },
            { id: "t3", title: "Explain my results", prompt: "Summarise what changed this week and why, with sources.", category: "Insights", credits: 9, icon: <BarChart3 /> },
            { id: "t4", title: "Local lead list", prompt: "Find 20 offices within 2 miles that order catering, with a contact.", category: "Outreach", credits: 24, icon: <Store /> },
            { id: "t5", title: "Ad test", prompt: "Write two ad versions for my best play and a $5/day test plan.", category: "Social", credits: 9, icon: <Sparkles /> },
          ]}
        />
      </Specimen>

      <Specimen title="AI usage tracker">
        <AIUsageTracker
          className="max-w-xl"
          used={2410}
          total={3000}
          resetsOn="1 Nov"
          daily={[62, 80, 44, 120, 96, 70, 40, 88, 150, 132, 74, 90, 110, 61]}
          byAgent={[
            { name: "Researcher", credits: 820 },
            { name: "Writer", credits: 760 },
            { name: "Outreach", credits: 540 },
            { name: "Analyst", credits: 290 },
          ]}
        />
      </Specimen>

      <Specimen title="AI cost breakdown">
        <AICostBreakdown
          className="max-w-xl"
          title="Research and first-week plan"
          budget={60}
          lines={PLAN.filter((p) => p.credits > 0).map((p) => ({ step: p.label, model: p.model, credits: p.credits }))}
        />
        <Spec items={[["Rate", "1 credit = 1¢"], ["Luna", "~2 credits a draft"], ["Sol", "~9 credits a draft"]]} />
      </Specimen>

      <Specimen title="AI anomaly alert">
        <AIAnomalyAlert
          className="max-w-xl"
          title="Ad spend is 3× normal today"
          unit="$"
          expected={[8, 14]}
          series={[11, 9, 12, 10, 13, 12, 9, 11, 14, 10, 12, 11, 13, 36]}
          explanation="Your Meta ad started showing outside San Francisco at 6am. Clicks from there don’t book. Pausing stops spend now; I can fix the area and restart it."
        />
      </Specimen>

      <Specimen title="AI source citations" description="Numbered refs in the text link to the list. Hover or focus a ref to find its source.">
        <Stage tone="white">
          <AISourceCitations
            text="Three nearby bakeries now sell sourdough[1][2], but none run classes[3]. Your reviews mention classes more than any product[4], so that’s the angle for ads."
            sources={[
              { id: 1, title: "Bread & Butter: Menu", domain: "breadbutter.sf", date: "Oct 12" },
              { id: 2, title: "Mission Loaf on Google Maps", domain: "maps.google.com", date: "Oct 15" },
              { id: 3, title: "Scan of 6 local bakery websites", domain: "climbos.app", date: "Today" },
              { id: 4, title: "Your Google reviews, last 90 days", domain: "business.google.com", date: "Today" },
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="AI feedback controls" description="Yes is one click. No asks why, in a few chips.">
        <Stage tone="white">
          <AIFeedbackControls />
        </Stage>
      </Specimen>

      <Specimen title="AI memory controls" description="See what ClimbOS remembers. Forget anything, with undo.">
        <AIMemoryControls
          className="max-w-xl"
          initial={[
            { id: "m1", text: "Closed on Mondays", source: "From your Google profile" },
            { id: "m2", text: "No emojis in emails", source: "You said this on Oct 3" },
            { id: "m3", text: "Classes are the main offer", source: "Learned from 6 approvals" },
            { id: "m4", text: "Owner signs off as Liz", source: "From your emails" },
          ]}
        />
      </Specimen>

      <Specimen title="AI tool permissions" description="Per tool: allow, ask each time, or deny. Arrow keys move between options.">
        <AIToolPermissions
          className="max-w-2xl"
          tools={[
            { id: "web", name: "Read websites", detail: "Your site and public pages", risk: "low" },
            { id: "reviews", name: "Reply to reviews", detail: "Google and Yelp", risk: "public" },
            { id: "social", name: "Publish posts", detail: "Instagram and Facebook", risk: "public" },
            { id: "email", name: "Send emails", detail: "From hello@tartinebakery.com", risk: "public" },
            { id: "ads", name: "Change ad budgets", detail: "Up to $20 a day", risk: "spend" },
          ]}
          initial={{ web: "allow", reviews: "ask", social: "ask", email: "ask", ads: "deny" }}
        />
      </Specimen>

      <Specimen title="AI execution logs" description="Monospace, with level filters. Debug is off by default.">
        <AIExecutionLogs lines={LOGS} />
      </Specimen>
    </DocPage>
  );
}
