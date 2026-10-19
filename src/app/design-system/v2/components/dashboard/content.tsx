"use client";

import { useState } from "react";
import { CalendarCheck, Coins, Eye, Megaphone, PenTool, Rocket, Search, Target, UserRound, Users } from "@/components/icons";
import { Button, toast } from "@/components/ui";
import {
  AlertsPanel,
  Announcements,
  DateRangeSelector,
  GoalTracking,
  InsightsPanel,
  KpiOverview,
  PendingApprovals,
  QuickActions,
  Recommendations,
  UpcomingTasks,
  WelcomeHeader,
  type Announcement,
  type Approval,
  type DashAlert,
  type DateRange,
  type Insight,
  type Task,
} from "@/components/ds/dashboard/panels";
import { DashboardShare, LastUpdated, RefreshIndicator, WIDGETS, WidgetBoard, WidgetLibrary, WidgetLibraryDialog, type BoardItem } from "@/components/ds/dashboard/widgets";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

const TODAY = "2026-10-19";

const KPIS = [
  { icon: <Users />, value: "128", label: "New leads", delta: "↑ 12%", good: true, values: [8, 10, 9, 12, 14, 13, 17, 19] },
  { icon: <CalendarCheck />, value: "14", label: "Booked calls", delta: "↑ 4", good: true, values: [1, 2, 1, 3, 2, 2, 1, 2] },
  { icon: <Eye />, value: "18.2k", label: "Reach", delta: "↑ 6%", good: true, values: [12, 11, 13, 14, 13, 15, 16, 15] },
  { icon: <Coins />, value: "1,860", label: "Credits used", delta: "↑ 9%", good: false, values: [180, 210, 190, 240, 260, 230, 270, 280] },
];

const GOALS = [
  { id: "g1", label: "20 booked calls", current: 14, target: 20, elapsed: 0.61, due: "31 Oct" },
  { id: "g2", label: "500 Instagram followers", current: 382, target: 500, elapsed: 0.8, due: "31 Oct" },
  { id: "g3", label: "15 new Google reviews", current: 15, target: 15, elapsed: 0.61, due: "31 Oct" },
];

const TASKS: Task[] = [
  { id: "t1", label: "Reply to 2 leads from cold email", due: "Today" },
  { id: "t2", label: "Upload photos of the pumpkin loaf", due: "17 Oct", overdue: true },
  { id: "t3", label: "Confirm Saturday tasting event details", due: "Tomorrow" },
  { id: "t4", label: "Review October results with Sam", due: "Fri" },
  { id: "t5", label: "Connect Google Ads", due: "Done", done: true },
];

const APPROVALS: Approval[] = [
  { id: "a1", network: "instagram", title: "Pumpkin loaf is back (carousel)", when: "Thu 9:00", credits: 12, by: "Autopilot" },
  { id: "a2", network: "email", title: "Cold email: 40 cafés in the Mission", when: "Fri 10:00", credits: 80, by: "Sam Okafor" },
  { id: "a3", network: "facebook", title: "Saturday tasting event ad", when: "Sat 8:00", credits: 30, by: "Autopilot" },
];

const RECS = [
  { id: "r1", title: "Post the Saturday tasting to Google", why: "Event posts on your Business Profile got 3× the calls of regular posts last month.", impact: "≈ 4 more calls", credits: 15 },
  { id: "r2", title: "Follow up with 18 cafés who opened twice", why: "They opened your wholesale email but didn’t reply. A short second note usually lands.", impact: "≈ 2 meetings", credits: 36 },
];

const INSIGHTS: Insight[] = [
  { id: "i1", kind: "working", text: "Behind-the-scenes Reels bring twice the saves of product shots.", trend: [3, 4, 4, 6, 7, 9, 11], metric: "Saves 2.1×" },
  { id: "i2", kind: "working", text: "Tuesday 7 am posts reach the most locals before work.", trend: [5, 6, 5, 7, 8, 8, 9], metric: "Reach +18%" },
  { id: "i3", kind: "not", text: "Facebook ads for catering cost $41 per lead, triple Instagram.", trend: [20, 24, 28, 31, 35, 38, 41], metric: "$41 / lead" },
  { id: "i4", kind: "not", text: "Cold email replies dropped after subject lines got longer.", trend: [9, 8, 8, 6, 5, 4, 4], metric: "Reply 4%" },
];

const ALERTS: DashAlert[] = [
  { id: "al1", level: "warning", title: "Credits at 85% of Ollie’s Gym cap", body: "Autopilot pauses there at 500", time: "1 h ago", action: "Raise cap" },
  { id: "al2", level: "critical", title: "Facebook connection expired", body: "3 scheduled posts can’t publish", time: "2 h ago", action: "Reconnect" },
  { id: "al3", level: "info", title: "Google Ads data is 3 hours behind", body: "Google is slow today; no action needed", time: "3 h ago" },
];

const NEWS: Announcement[] = [
  { id: "n1", title: "Expert drafts for ads", body: "Pro plans now get Expert-written ad copy and growth plans. Same credits, sharper first drafts.", date: "17 Oct", cta: "Try it on an ad" },
  { id: "n2", title: "Agency workspaces: per-client credit caps", date: "10 Oct", body: "", unread: true },
  { id: "n3", title: "Approve posts from the mobile app", date: "2 Oct", body: "", unread: true },
  { id: "n4", title: "Lead finder covers 12 more countries", date: "24 Sep", body: "" },
];

const BOARD: BoardItem[] = [{ id: "leads" }, { id: "calls" }, { id: "reach" }, { id: "channels" }, { id: "credits" }, { id: "reviews", hidden: true }];

export function DashboardContent() {
  const [range, setRange] = useState<DateRange>({ preset: "30d", from: "2026-09-20", to: TODAY, compare: true });
  const [tasks, setTasks] = useState(TASKS);
  const [approvals, setApprovals] = useState(APPROVALS);
  const [alerts, setAlerts] = useState(ALERTS);
  const [news, setNews] = useState(NEWS);
  const [board, setBoard] = useState(BOARD);
  const [lib, setLib] = useState(false);
  const [refreshed, setRefreshed] = useState(0);
  const installed = board.map((b) => b.id);
  const addWidget = (id: string) => {
    setBoard((b) => (b.some((x) => x.id === id) ? b.map((x) => (x.id === id ? { ...x, hidden: false } : x)) : [...b, { id }]));
    toast({ title: `${WIDGETS.find((w) => w.id === id)?.title} added`, description: "It’s at the end of the board.", tone: "success" });
  };

  return (
    <DocPage eyebrow="Components" title="Dashboard" intro="The Today screen’s building blocks. One serif greeting, then numbers, then what needs you.">
      <Specimen title="Welcome header">
        <Stage>
          <WelcomeHeader
            date="Monday, 19 October"
            greeting="Good morning"
            name="Maya"
            summary="Three posts went out and 12 new leads came in this week. Three approvals need you before Thursday."
            actions={
              <>
                <Button variant="secondary">View plan</Button>
                <Button>Review 3 approvals</Button>
              </>
            }
          />
        </Stage>
      </Specimen>

      <Specimen title="Date range selector" description="Presets, a custom range and compare-to-previous. The exact dates are always written out.">
        <Stage tone="white">
          <DateRangeSelector today={TODAY} value={range} onChange={setRange} />
        </Stage>
      </Specimen>

      <Specimen title="KPI overview">
        <Stage>
          <KpiOverview items={KPIS} />
        </Stage>
        <Spec items={[["Number", "Hanken 32/40 semibold, tabular"], ["Change", "Outlined delta pill; bars compare to the previous period"]]} />
      </Specimen>

      <Specimen title="Goal tracking" description="The thin tick is where you should be by today.">
        <Stage className="max-w-2xl">
          <GoalTracking goals={GOALS} />
        </Stage>
      </Specimen>

      <Specimen title="Upcoming tasks">
        <Stage className="max-w-xl">
          <UpcomingTasks tasks={tasks} onChange={setTasks} />
        </Stage>
      </Specimen>

      <Specimen title="Pending approvals">
        <Stage className="max-w-2xl">
          <PendingApprovals items={approvals} onChange={setApprovals} />
          {approvals.length < APPROVALS.length ? (
            <Button size="sm" variant="link" className="mt-3" onClick={() => setApprovals(APPROVALS)}>
              Reset demo
            </Button>
          ) : null}
        </Stage>
      </Specimen>

      <Specimen title="Quick actions">
        <Stage>
          <QuickActions
            actions={[
              { id: "post", label: "New post", Icon: PenTool, shortcut: "N", onRun: () => toast({ title: "New post" }) },
              { id: "leads", label: "Find leads", Icon: Search, shortcut: "L", onRun: () => toast({ title: "Lead finder" }) },
              { id: "camp", label: "Start campaign", Icon: Rocket, shortcut: "C", onRun: () => toast({ title: "New campaign" }) },
              { id: "goal", label: "Set a goal", Icon: Target, onRun: () => toast({ title: "New goal" }) },
              { id: "invite", label: "Invite teammate", Icon: UserRound, onRun: () => toast({ title: "Invite" }) },
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="Recommendations" description="ClimbOS’s next plays, in its own voice, with cost and expected impact.">
        <Stage>
          <Recommendations items={RECS} />
        </Stage>
      </Specimen>

      <Specimen title="Insights panel">
        <Stage className="max-w-2xl">
          <InsightsPanel insights={INSIGHTS} />
        </Stage>
      </Specimen>

      <Specimen title="Alerts panel" description="Most severe first. Icon, word and colour together.">
        <Stage className="max-w-xl">
          <AlertsPanel alerts={alerts} onChange={setAlerts} />
          {alerts.length < ALERTS.length ? (
            <Button size="sm" variant="link" className="mt-3" onClick={() => setAlerts(ALERTS)}>
              Reset demo
            </Button>
          ) : null}
        </Stage>
      </Specimen>

      <Specimen title="Announcements">
        <Stage className="max-w-xl">
          <Announcements items={news} onChange={setNews} />
          {news.length < NEWS.length ? (
            <Button size="sm" variant="link" className="mt-3" onClick={() => setNews(NEWS)}>
              <Megaphone /> Bring back the announcement
            </Button>
          ) : null}
        </Stage>
      </Specimen>

      <Specimen title="Customizable widgets" description="Customize, then drag or use the arrows. Eye hides; hidden widgets wait in the tray.">
        <Stage>
          <WidgetBoard items={board} onChange={setBoard} onAdd={() => setLib(true)} />
          <WidgetLibraryDialog open={lib} onOpenChange={setLib} installed={installed.filter((id) => !board.find((b) => b.id === id)?.hidden)} onAdd={addWidget} />
        </Stage>
      </Specimen>

      <Specimen title="Widget library" description="Adds to the board above.">
        <Stage tone="white">
          <WidgetLibrary installed={installed.filter((id) => !board.find((b) => b.id === id)?.hidden)} onAdd={addWidget} />
        </Stage>
      </Specimen>

      <Specimen title="Dashboard sharing" description="People, a link, and a scheduled PDF snapshot.">
        <Stage tone="white">
          <DashboardShare
            url="https://app.climbos.com/d/tartine-today-K2v9"
            people={[
              { id: "me", name: "Maya Rahman", email: "maya@tartine.co", access: "owner" },
              { id: "sam", name: "Sam Okafor", email: "sam@tartine.co", access: "view" },
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="Refresh indicator" description="Steps, bar and time left while it works.">
        <Stage tone="white" className="flex flex-col gap-3">
          <RefreshIndicator onRefreshed={() => setRefreshed((n) => n + 1)} />
          <LastUpdated key={refreshed} secondsAgo={refreshed ? 0 : 240} at="19 Oct 2026, 08:42" />
        </Stage>
      </Specimen>

      <Specimen title="Last updated timestamp" description="Relative and ticking; the exact time is in the tooltip. Amber once the data is stale.">
        <Stage tone="white" className="flex flex-col gap-2">
          <LastUpdated secondsAgo={20} at="19 Oct 2026, 08:46" />
          <LastUpdated secondsAgo={300} source="Instagram" at="19 Oct 2026, 08:41" />
          <LastUpdated secondsAgo={3 * 3600 + 120} source="Google Ads" at="19 Oct 2026, 05:44" />
        </Stage>
      </Specimen>
    </DocPage>
  );
}
