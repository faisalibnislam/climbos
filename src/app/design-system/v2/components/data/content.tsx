"use client";

import { useState } from "react";
import { Archive, Bot, Copy, ExternalLink, Mail, Megaphone, Send, Sparkles, Trash2, UserRound } from "@/components/icons";
import { Avatar, Badge, Button, Segmented, toast, type Tone } from "@/components/ui";
import { DataGrid, type CellValue, type DataGridColumn, type RowAction } from "@/components/ds/data/data-grid";
import { ActivityFeed, AuditLog, CodeViewer, DataComparison, DescriptionList, DiffViewer, JsonViewer, KeyValueList, type AuditEntry, type FeedItem } from "@/components/ds/data/display";
import { Pagination } from "@/components/ds/data/pagination";
import { CalendarMonth, GanttChart, GridView, KanbanBoard, ListView, TimelineView, TreeView, type CalendarEvent, type KanbanCard, type TreeNode } from "@/components/ds/data/views";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

/* Deterministic sample data ------------------------------------------------ */

type Status = "New" | "Contacted" | "Replied" | "Booked" | "Lost";
interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  source: string;
  status: Status;
  score: number;
  value: number;
  owner: string;
  last: string;
}

const FIRST = ["Dana", "Alex", "Priya", "Marco", "Lena", "Sam", "Noor", "Theo", "Ivy", "Omar", "Jules", "Rosa"];
const LAST = ["Ruiz", "Tomland", "Shah", "Bianchi", "Okafor", "Lee", "Haddad", "Grant", "Chen", "Farah", "Moreau", "Silva"];
const COMPANIES = ["Ruiz & Co", "Northside Dental", "Studio Morgan", "Bianchi Florals", "Okafor Fitness", "Lee Legal", "Haddad Realty", "Grant Coffee", "Chen Physio", "Farah Tailoring", "Moreau Bistro", "Silva Yoga"];
const SOURCES = ["Cold email", "Google Ads", "Instagram", "Referral", "Website"];
const STATUSES: Status[] = ["New", "Contacted", "Replied", "Booked", "Lost"];
const OWNERS = ["Maya Rahman", "Dana Ruiz", "Theo Grant"];
const STATUS_TONE: Record<Status, Tone> = { New: "blue", Contacted: "neutral", Replied: "amber", Booked: "green", Lost: "red" };

const LEADS: Lead[] = Array.from({ length: 24 }, (_, i) => {
  const f = FIRST[i % 12];
  const l = LAST[(i * 5 + 3) % 12];
  return {
    id: `L${1040 + i}`,
    name: `${f} ${l}`,
    company: COMPANIES[(i * 7) % 12],
    email: `${f.toLowerCase()}@${COMPANIES[(i * 7) % 12].toLowerCase().replace(/[^a-z]+/g, "")}.com`,
    source: SOURCES[(i * 3) % 5],
    status: STATUSES[(i * 2 + (i > 11 ? 1 : 0)) % 5],
    score: 40 + ((i * 37) % 59),
    value: 300 + ((i * 433) % 4200),
    owner: OWNERS[i % 3],
    last: `${1 + ((i * 3) % 27)} Oct`,
  };
});

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

const COLS: DataGridColumn<Lead>[] = [
  { key: "name", header: "Lead", value: (r) => r.name, cell: (r) => <span className="flex min-w-0 flex-col"><span className="truncate font-medium">{r.name}</span><span className="truncate text-xs text-ink-3">{r.company}</span></span>, hideable: false },
  { key: "source", header: "Source", value: (r) => r.source },
  { key: "status", header: "Status", value: (r) => r.status, cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
  { key: "score", header: "Score", value: (r) => r.score, numeric: true },
  { key: "value", header: "Value", value: (r) => r.value, numeric: true, cell: (r) => money(r.value) },
  { key: "owner", header: "Owner", value: (r) => r.owner, cell: (r) => <span className="flex items-center gap-2"><Avatar name={r.owner} size="sm" /><span className="truncate">{r.owner.split(" ")[0]}</span></span> },
  { key: "last", header: "Last contact", value: (r) => Number(r.last.split(" ")[0]), cell: (r) => <span className="tabular-nums text-ink-2">{r.last}</span>, defaultHidden: false },
];

const ACTIONS: RowAction<Lead>[] = [
  { label: "Open lead", icon: <ExternalLink />, onSelect: (r) => toast({ title: `Opened ${r.name}` }) },
  { label: "Send email", icon: <Send />, onSelect: (r) => toast({ title: `Draft email to ${r.name}`, tone: "success" }) },
  { label: "Copy email", icon: <Copy />, onSelect: (r) => toast({ title: `Copied ${r.email}` }) },
  { label: "Archive", icon: <Archive />, separated: true, onSelect: (r) => toast({ title: `Archived ${r.name}` }) },
];

const leadDetail = (r: Lead) => (
  <DescriptionList
    columns={2}
    layout="stacked"
    className="max-w-2xl"
    items={[
      { term: "Email", detail: r.email },
      { term: "Lead ID", detail: <span className="font-mono text-xs">{r.id}</span> },
      { term: "Next step", detail: r.status === "Booked" ? "Prepare for the call" : "Follow up in 2 days" },
      { term: "Notes", detail: `Found via ${r.source.toLowerCase()}. Interested in catering.` },
    ]}
  />
);

function useLeads(n = 24) {
  const [rows, setRows] = useState(() => LEADS.slice(0, n));
  const edit = (id: string, key: string, v: CellValue) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [key]: v } : r)));
  return { rows, setRows, edit };
}

const KANBAN_COLS = [
  { id: "idea", title: "Ideas" },
  { id: "draft", title: "Drafting", limit: 3 },
  { id: "review", title: "Needs approval" },
  { id: "live", title: "Scheduled" },
];

const TREE: TreeNode[] = [
  {
    id: "brand",
    label: "Brand kit",
    meta: "6",
    children: [
      { id: "logos", label: "Logos", meta: "3", children: [{ id: "logo-main", label: "logo-main.svg" }, { id: "logo-mono", label: "logo-mono.svg" }, { id: "favicon", label: "favicon.png" }] },
      { id: "voice", label: "Voice guide.md" },
      { id: "colours", label: "Colours.json" },
    ],
  },
  {
    id: "campaigns",
    label: "Campaigns",
    meta: "4",
    children: [
      { id: "brunch", label: "Weekend brunch", children: [{ id: "b-post", label: "Instagram post.png" }, { id: "b-email", label: "Email.html" }] },
      { id: "holiday", label: "Holiday pre-orders", children: [{ id: "h-brief", label: "Brief.md" }] },
    ],
  },
  { id: "readme", label: "Read me.md" },
];

const EVENTS: CalendarEvent[] = [
  { id: "e1", date: "2026-10-03", title: "Brunch post", tone: "sage" },
  { id: "e2", date: "2026-10-07", title: "Newsletter", tone: "slate" },
  { id: "e3", date: "2026-10-12", title: "Review drive", tone: "clay" },
  { id: "e4", date: "2026-10-16", title: "Call: Dana", tone: "ink" },
  { id: "e5", date: "2026-10-19", title: "Approve posts", tone: "ink" },
  { id: "e6", date: "2026-10-19", title: "Reel", tone: "sage" },
  { id: "e7", date: "2026-10-19", title: "Ad launch", tone: "clay" },
  { id: "e8", date: "2026-10-23", title: "Holiday email", tone: "slate" },
  { id: "e9", date: "2026-10-28", title: "Monthly report", tone: "sage" },
];

const JSON_SAMPLE = {
  id: "play_8f21",
  name: "Weekend brunch",
  status: "needs_approval",
  credits: 140,
  autopilot: false,
  channels: ["instagram", "email", "google_ads"],
  audience: { radiusKm: 5, segments: ["regulars", "lapsed_90d"], size: 214 },
  schedule: { start: "2026-10-24", posts: [{ day: "Sat", time: "09:00" }, { day: "Sun", time: "10:30" }] },
  approvedBy: null,
};

const CODE = `// Approve and schedule this week's posts
import { climbos } from "@climbos/sdk";

const plan = await climbos.plays.get("play_8f21");
for (const post of plan.posts) {
  if (post.status === "needs_approval") {
    await climbos.posts.approve(post.id, { schedule: "best_time" });
  }
}
console.log(\`Scheduled \${plan.posts.length} posts\`);
`;

const DIFF = `@@ -1,7 +1,8 @@
 Weekend brunch is back.
-Sourdough waffles and coffee, Saturdays 9–1.
+Sourdough waffles, seasonal jam and a flat white for $14.
+Saturdays and Sundays, 9–1.

 Book a table or walk in.
-#brunch #bakery
+#brunch #tartine #sfeats
 Link in bio.`;

const AUDIT: AuditEntry[] = [
  { id: "a1", time: "19 Oct 09:41", actor: "Maya Rahman", actorKind: "person", action: "Approved post", target: "Weekend brunch is back", source: "Web · SF" },
  { id: "a2", time: "19 Oct 09:12", actor: "Autopilot", actorKind: "autopilot", action: "Changed budget", target: "Google Ads · Brunch", changes: [{ field: "Daily budget", from: "$20", to: "$25" }, { field: "Radius", from: "3 km", to: "5 km" }] },
  { id: "a3", time: "18 Oct 17:30", actor: "Dana Ruiz", actorKind: "person", action: "Updated role", target: "Theo Grant", source: "iOS", changes: [{ field: "Role", from: "Viewer", to: "Editor" }] },
  { id: "a4", time: "18 Oct 08:00", actor: "ClimbOS", actorKind: "system", action: "Renewed plan", target: "Pro · 3,000 credits", source: "Billing" },
  { id: "a5", time: "17 Oct 14:22", actor: "Maya Rahman", actorKind: "person", action: "Connected", target: "Instagram", source: "Web · SF" },
];

const FEED: FeedItem[] = [
  { id: "f1", day: "Today", time: "9:41", actor: "Autopilot", icon: <Sparkles />, text: <>drafted 3 posts for <span className="font-medium text-ink">Weekend brunch</span></>, kind: "posts" },
  { id: "f2", day: "Today", time: "9:20", actor: "Dana Ruiz", text: "replied to your outreach", quote: "Sounds great. Can we move the tasting to Friday at 3?", kind: "leads" },
  { id: "f3", day: "Today", time: "8:05", actor: "Maya Rahman", text: <>invited <span className="font-medium text-ink">Theo Grant</span> as an editor</>, kind: "team" },
  { id: "f4", day: "Yesterday", time: "17:12", actor: "Google Ads", icon: <Megaphone />, text: "brought in 4 new leads", kind: "leads" },
  { id: "f5", day: "Yesterday", time: "11:30", actor: "Autopilot", icon: <Bot />, text: <>published <span className="font-medium text-ink">Meet our new baker</span> to Instagram</>, kind: "posts" },
];

/* Page ---------------------------------------------------------------------- */

export function DataContent() {
  const full = useLeads(24);
  const editable = useLeads(5);
  const [listSel, setListSel] = useState<string | null>("L1041");
  const [gridSel, setGridSel] = useState<string[]>(["g2"]);
  const [cards, setCards] = useState<KanbanCard[]>([
    { id: "k1", column: "idea", title: "Behind the scenes reel", meta: "Instagram", tag: { label: "Reel", tone: "violet" } },
    { id: "k2", column: "idea", title: "Customer of the month", meta: "Facebook" },
    { id: "k3", column: "draft", title: "Weekend brunch is back", meta: "Instagram · Sat", owner: "Maya Rahman", tag: { label: "Post", tone: "brand" } },
    { id: "k4", column: "draft", title: "Catering for offices", meta: "Email · 40 leads", owner: "Dana Ruiz", tag: { label: "Email", tone: "blue" } },
    { id: "k5", column: "review", title: "Holiday pre-order ad", meta: "Google Ads", owner: "Maya Rahman", tag: { label: "Ad", tone: "orange" } },
    { id: "k6", column: "live", title: "Meet our new baker", meta: "Tue 9:00", tag: { label: "Post", tone: "brand" } },
  ]);
  const [day, setDay] = useState<string | null>("2026-10-19");
  const [treeSel, setTreeSel] = useState<string | null>("voice");
  const [feedKind, setFeedKind] = useState("all");
  const [page, setPage] = useState(3);
  const [pageSize, setPageSize] = useState(10);
  const [simplePage, setSimplePage] = useState(1);

  const dayEvents = EVENTS.filter((e) => e.date === day);

  return (
    <DocPage eyebrow="Components" title="Data display" intro="One table component with every feature opt-in, plus the views that sit beside it.">
      <Specimen title="Data table" description="DataGrid with everything on: search, facet, sort, inline edit, expand, select, columns, row actions and pages.">
        <Stage>
          <DataGrid
            label="Leads"
            rows={full.rows}
            columns={COLS.map((c) => (c.key === "name" || c.key === "value" ? { ...c, editable: true } : c))}
            getRowId={(r) => r.id}
            sortable
            filterable
            facet={{ label: "Statuses", value: (r) => r.status, options: STATUSES }}
            pageSize={6}
            pageSizes={[6, 12, 24]}
            selectable
            bulkActions={(ids, clear) => (
              <Button size="sm" variant="secondary" onClick={() => { toast({ title: `Emailing ${ids.length} leads`, tone: "success" }); clear(); }}>
                <Mail /> Email
              </Button>
            )}
            expandable={leadDetail}
            columnMenu
            rowActions={ACTIONS}
            onCellEdit={full.edit}
          />
        </Stage>
        <Spec items={[["Header", "36px, surface-2, 12px ink-3"], ["Row", "--cell-h (44 / 34 compact)"], ["Numbers", "right-aligned, tabular-nums"], ["Component", "@/components/ds/data/data-grid"]]} />
      </Specimen>

      <Specimen title="Sortable table" description="Click a header: ascending, descending, off. aria-sort on the column; ← → move between headers.">
        <Stage>
          <DataGrid label="Leads by score" rows={LEADS.slice(0, 6)} columns={COLS.slice(0, 5)} getRowId={(r) => r.id} sortable defaultSort={{ key: "score", dir: "desc" }} />
        </Stage>
      </Specimen>

      <Specimen title="Filterable table" description="Search across columns plus one facet.">
        <Stage>
          <DataGrid label="Filterable leads" rows={LEADS.slice(0, 10)} columns={COLS.slice(0, 5)} getRowId={(r) => r.id} filterable facet={{ label: "Sources", value: (r) => r.source, options: SOURCES }} emptyText="No leads match. Try another search." />
        </Stage>
      </Specimen>

      <Specimen title="Paginated table">
        <Stage>
          <DataGrid label="Paged leads" rows={LEADS} columns={COLS.slice(0, 5)} getRowId={(r) => r.id} pageSize={5} pageSizes={[5, 10, 24]} />
        </Stage>
      </Specimen>

      <Specimen title="Editable table" description="Click a cell (or Tab to it and press Enter). Enter saves, Esc cancels, blur saves.">
        <Stage>
          <DataGrid
            label="Editable leads"
            rows={editable.rows}
            columns={[
              { ...COLS[0], cell: undefined, editable: true },
              { key: "company", header: "Company", value: (r) => r.company, editable: true },
              { ...COLS[3], editable: true },
              { ...COLS[4], editable: true },
            ]}
            getRowId={(r) => r.id}
            onCellEdit={editable.edit}
          />
        </Stage>
      </Specimen>

      <Specimen title="Expandable table rows">
        <Stage>
          <DataGrid label="Leads with details" rows={LEADS.slice(0, 4)} columns={COLS.slice(0, 5)} getRowId={(r) => r.id} expandable={leadDetail} />
        </Stage>
      </Specimen>

      <Specimen title="Selectable table rows" description="Header checkbox selects the page (mixed when partial). Bulk bar appears on selection.">
        <Stage>
          <DataGrid
            label="Selectable leads"
            rows={LEADS.slice(0, 5)}
            columns={COLS.slice(0, 5)}
            getRowId={(r) => r.id}
            selectable
            bulkActions={(ids, clear) => (
              <>
                <Button size="sm" variant="secondary" onClick={() => { toast({ title: `Assigned ${ids.length} leads to Maya` }); clear(); }}>
                  <UserRound /> Assign
                </Button>
                <Button size="sm" variant="danger" onClick={() => { toast({ title: `Archived ${ids.length} leads` }); clear(); }}>
                  <Trash2 /> Archive
                </Button>
              </>
            )}
          />
        </Stage>
      </Specimen>

      <Specimen title="Sticky table header" description="The body scrolls; the header stays.">
        <Stage>
          <DataGrid label="All leads" rows={LEADS} columns={COLS} getRowId={(r) => r.id} stickyHeader maxHeight={260} sortable />
        </Stage>
      </Specimen>

      <Specimen title="Column visibility controls" description="Columns menu; the first column can't be hidden.">
        <Stage>
          <DataGrid label="Leads with column menu" rows={LEADS.slice(0, 4)} columns={COLS.map((c) => (c.key === "owner" || c.key === "last" ? { ...c, defaultHidden: true } : c))} getRowId={(r) => r.id} columnMenu />
        </Stage>
      </Specimen>

      <Specimen title="Row actions" description="One … menu per row. Destructive items sit last, after a separator.">
        <Stage>
          <DataGrid label="Leads with actions" rows={LEADS.slice(0, 4)} columns={COLS.slice(0, 4)} getRowId={(r) => r.id} rowActions={ACTIONS} />
        </Stage>
      </Specimen>

      <Specimen title="List view">
        <Stage>
          <ListView
            label="Leads"
            className="max-w-2xl"
            selected={listSel}
            onSelect={setListSel}
            items={LEADS.slice(0, 5).map((r) => ({
              id: r.id,
              title: r.name,
              sub: `${r.company} · ${r.source}`,
              leading: <Avatar name={r.name} />,
              trailing: <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>,
              meta: r.last,
            }))}
          />
        </Stage>
      </Specimen>

      <Specimen title="Grid view" description="Hover (or focus) a tile to select it.">
        <Stage>
          <GridView
            label="Post library"
            selected={gridSel}
            onSelectedChange={setGridSel}
            items={[
              { id: "g1", title: "Weekend brunch", sub: "Instagram · Sat", badge: { label: "Draft", tone: "neutral" }, media: <div className="size-full bg-cream" /> },
              { id: "g2", title: "Meet our new baker", sub: "Facebook · Tue", badge: { label: "Live", tone: "green" }, media: <div className="size-full bg-brand-100" /> },
              { id: "g3", title: "Holiday pre-orders", sub: "Email · 2 Nov", badge: { label: "Review", tone: "amber" }, media: <div className="size-full bg-sun-soft" /> },
              { id: "g4", title: "Sourdough class", sub: "Instagram · Reel", badge: { label: "Live", tone: "green" }, media: <div className="size-full bg-surface-3" /> },
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="Kanban board" description="Drag between columns, or focus a card and press ← / →.">
        <Stage>
          <KanbanBoard label="Content pipeline" columns={KANBAN_COLS} cards={cards} onMove={(id, column) => setCards((cs) => cs.map((c) => (c.id === id ? { ...c, column } : c)))} />
        </Stage>
      </Specimen>

      <Specimen title="Calendar view" description="Month grid, Monday first. Arrows move by day / week, PageUp / PageDown by month.">
        <Stage>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_200px]">
            <CalendarMonth year={2026} month={9} today="2026-10-19" events={EVENTS} selected={day} onSelect={setDay} />
            <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
              <p className="text-overline">{day ? new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "No day"}</p>
              <ul className="mt-2 flex flex-col gap-1.5 text-ui">
                {dayEvents.length ? dayEvents.map((e) => <li key={e.id}>{e.title}</li>) : <li className="text-ink-3">Nothing scheduled.</li>}
              </ul>
            </div>
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Timeline view">
        <Stage>
          <div className="max-w-lg rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--card-shadow)]">
            <TimelineView
              items={[
                { id: "t1", time: "Mon 9:00", title: "Plan ready", body: "3 plays ranked by expected leads." },
                { id: "t2", time: "Mon 9:40", title: "Posts approved", body: "Maya approved 3 of 3." },
                { id: "t3", time: "Tue 10:00", title: "Outreach sending", body: "112 of 214 emails sent.", state: "current" },
                { id: "t4", time: "Fri", title: "Weekly results", state: "upcoming" },
              ]}
            />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Gantt chart" description="Bar = scheduled span, fill = progress, red line = today.">
        <Stage>
          <GanttChart
            label="Holiday campaign schedule"
            days={28}
            today={11}
            dayLabels={(i) => (i % 7 === 0 ? `${["5", "12", "19", "26"][i / 7]} Oct` : null)}
            tasks={[
              { id: "g1", name: "Brief and offer", start: 0, length: 5, progress: 1, owner: "Maya Rahman", tone: "ink" },
              { id: "g2", name: "Post drafts", start: 4, length: 8, progress: 0.75, owner: "Dana Ruiz" },
              { id: "g3", name: "Email sequence", start: 9, length: 9, progress: 0.3, owner: "Theo Grant" },
              { id: "g4", name: "Google Ads", start: 14, length: 12, progress: 0, owner: "Maya Rahman", tone: "clay" },
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="Tree view" description="ARIA tree: ↑ ↓ move, → open / child, ← close / parent, Home / End, Enter selects.">
        <Stage>
          <div className="grid gap-3 sm:grid-cols-[280px_minmax(0,1fr)]">
            <TreeView label="Files" nodes={TREE} defaultExpanded={["brand", "campaigns"]} selected={treeSel} onSelect={setTreeSel} />
            <p className="text-ui text-ink-2">
              Selected: <span className="font-medium text-ink">{treeSel ?? "none"}</span>
            </p>
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Description list">
        <Stage tone="white">
          <DescriptionList
            items={[
              { term: "Business", detail: "Tartine Bakery" },
              { term: "Plan", detail: <span className="flex items-center gap-2">Pro <Badge tone="green">Active</Badge></span> },
              { term: "Credits", detail: "1,640 of 3,000 left · resets 1 Nov" },
              { term: "Approvals", detail: "Posts and ads need approval; emails send automatically." },
              { term: "Owner", detail: <span className="flex items-center gap-2"><Avatar name="Maya Rahman" size="sm" /> Maya Rahman</span> },
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="Key-value pairs" description="Rows for IDs and settings (copyable); inline chips for metadata.">
        <Stage>
          <div className="flex max-w-xl flex-col gap-3">
            <KeyValueList
              items={[
                { k: "Workspace ID", v: "ws_2b9f41c0", copy: true, mono: true },
                { k: "Tracking pixel", v: "px_tartine_8812", copy: true, mono: true },
                { k: "Time zone", v: "America/Los_Angeles" },
                { k: "Region", v: "US West" },
              ]}
            />
            <KeyValueList variant="inline" items={[{ k: "Channel", v: "Instagram" }, { k: "Credits", v: "45" }, { k: "Model", v: "Luna" }, { k: "Run", v: "#8f21", mono: true }]} />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Data comparison" description="Grey is always the previous period; ink is now. Change is coloured by good / bad, not up / down.">
        <Stage>
          <DataComparison
            labels={["Sep", "Oct"]}
            rows={[
              { label: "Leads", a: 182, b: 214 },
              { label: "Calls booked", a: 41, b: 52 },
              { label: "Reply rate", a: 6.8, b: 8.1, format: (n) => `${n}%` },
              { label: "Cost per lead", a: 4.6, b: 4.2, format: (n) => `$${n.toFixed(2)}`, higherIsBetter: false },
              { label: "Unsubscribes", a: 12, b: 15, higherIsBetter: false },
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="JSON viewer">
        <Stage>
          <JsonViewer data={JSON_SAMPLE} label="play_8f21.json" depth={1} className="max-w-2xl" />
        </Stage>
      </Specimen>

      <Specimen title="Code viewer" description="Line numbers, highlighted lines, copy.">
        <Stage>
          <CodeViewer code={CODE} filename="approve-posts.ts" language="TypeScript" highlightLines={[6, 7]} className="max-w-2xl" />
        </Stage>
      </Specimen>

      <Specimen title="Diff viewer" description="Unified diff of a caption edit.">
        <Stage>
          <DiffViewer diff={DIFF} filename="Weekend brunch · caption" className="max-w-2xl" />
        </Stage>
      </Specimen>

      <Specimen title="Audit log" description="Every change by people, Autopilot and the system. Open a row to see before → after.">
        <Stage>
          <AuditLog entries={AUDIT} />
        </Stage>
      </Specimen>

      <Specimen title="Activity feed">
        <Stage>
          <div className="flex max-w-xl flex-col gap-4">
            <Segmented
              label="Filter activity"
              value={feedKind}
              onChange={setFeedKind}
              options={[
                { value: "all", label: "All" },
                { value: "leads", label: "Leads" },
                { value: "posts", label: "Posts" },
                { value: "team", label: "Team" },
              ]}
            />
            <ActivityFeed items={FEED.filter((f) => feedKind === "all" || f.kind === feedKind)} />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Pagination" description="Full (range, numbers, rows per page) and simple (previous / next).">
        <Stage tone="white">
          <div className="flex flex-col gap-6">
            <Pagination page={page} total={248} pageSize={pageSize} onPageChange={setPage} pageSizes={[10, 25, 50]} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} label="Leads pages" />
            <Pagination variant="simple" page={simplePage} total={36} pageSize={12} onPageChange={setSimplePage} label="Posts pages" />
          </div>
        </Stage>
        <Spec items={[["Buttons", "--h-sm, 3px radius"], ["Current", "ink fill, aria-current=page"], ["Window", "1 … p−1 p p+1 … last"]]} />
      </Specimen>
    </DocPage>
  );
}

