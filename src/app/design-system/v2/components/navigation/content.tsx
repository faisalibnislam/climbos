"use client";

import { useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  ChartLine,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  Inbox,
  LayoutGrid,
  Link2,
  ListChecks,
  Mail,
  Megaphone,
  MessageCircle,
  Mountain,
  Plug,
  Plus,
  ReceiptText,
  Rocket,
  Search,
  Settings,
  ShoppingBag,
  SlidersHorizontal,
  Sparkle,
  Store,
  Table2,
  Target,
  UserRound,
  Users,
  UsersRound,
  Zap,
  ImageIcon,
} from "@/components/icons";
import { Badge, Button, IconButton, Segmented, toast } from "@/components/ui";
import {
  AccountSwitcher,
  AppLauncher,
  Breadcrumbs,
  CollapsibleSidebar,
  CommandMenu,
  DeviceFrame,
  Favorites,
  GlobalSearch,
  MobileBottomNav,
  MobileNavDrawer,
  NavBadge,
  NestedNav,
  OrganizationSwitcher,
  PrimarySidebar,
  ProjectSwitcher,
  RecentPages,
  SecondarySidebar,
  SideNavGroup,
  SideNavItem,
  SidebarFooter,
  TabNav,
  TopBar,
  ViewSwitcher,
  WorkspaceSwitcher,
  type CommandItem,
  type NavSection,
  type PageLink,
} from "@/components/ds/navigation";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";
import { UpsellCard, Wordmark } from "../../_kit/signal";

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

const SECTIONS: NavSection[] = [
  {
    id: "grow",
    label: "Grow",
    items: [
      { id: "today", label: "Today", icon: <LayoutGrid /> },
      { id: "plan", label: "Growth plan", icon: <Target /> },
      { id: "customers", label: "Customers", icon: <UsersRound /> },
      { id: "campaigns", label: "Campaigns", icon: <Megaphone />, badge: 3 },
      { id: "inbox", label: "Inbox", icon: <MessageCircle />, badge: 12, badgeTone: "attention" },
    ],
  },
  {
    id: "measure",
    label: "Measure",
    items: [
      { id: "results", label: "Results", icon: <ChartLine /> },
      { id: "attribution", label: "Attribution", icon: <Search />, badge: "New", badgeTone: "new" },
    ],
  },
  {
    id: "settings",
    label: "Workspace settings",
    collapsible: true,
    defaultOpen: false,
    items: [
      { id: "general", label: "General", icon: <SlidersHorizontal /> },
      { id: "connections", label: "Connections", icon: <Zap /> },
      { id: "integrations", label: "Integrations", icon: <Plug /> },
      { id: "tracking", label: "Tracking", icon: <Link2 /> },
      { id: "autopilot", label: "Autopilot", icon: <Sparkle /> },
      { id: "team", label: "Team & roles", icon: <Users /> },
    ],
  },
];

const WORKSPACES = [
  { id: "tartine", label: "Tartine Bakery", meta: "Local business · Pro", icon: <Store /> },
  { id: "northside", label: "Northside Physio", meta: "Clinic · Starter", icon: <Building2 /> },
  { id: "loom", label: "Loom & Thread", meta: "Online store · Pro", icon: <ShoppingBag /> },
];

const ORGS = [
  { id: "maya", label: "Maya Rahman", meta: "Personal · 3 workspaces", badge: <Badge>Pro</Badge> },
  { id: "brightside", label: "Brightside Agency", meta: "Agency · 14 workspaces", badge: <Badge tone="brand">Agency</Badge> },
];

const PROJECTS = [
  { id: "spring", label: "Spring launch", meta: "Campaign · Live" },
  { id: "reviews", label: "Google reviews push", meta: "Play · Running" },
  { id: "newsletter", label: "Monthly newsletter", meta: "Campaign · Draft" },
  { id: "winback", label: "Win-back offer", meta: "Campaign · Paused" },
  { id: "ads", label: "Local search ads", meta: "Play · Needs approval" },
];

const ACCOUNTS = [
  { id: "maya", name: "Maya Rahman", email: "maya@tartine.co" },
  { id: "maya-agency", name: "Maya at Brightside", email: "maya@brightside.agency" },
];

const APPS = [
  { id: "climbos", name: "ClimbOS", blurb: "Growth", icon: <Mountain /> },
  { id: "formkit", name: "Formkit", blurb: "Forms", icon: <ClipboardList />, connected: true },
  { id: "meetrao", name: "Meetrao", blurb: "Booking", icon: <CalendarDays />, connected: true },
  { id: "involets", name: "Involets", blurb: "Invoices", icon: <ReceiptText /> },
  { id: "taskeni", name: "Taskeni", blurb: "Tasks", icon: <ListChecks /> },
  { id: "folevi", name: "Folevi", blurb: "Docs", icon: <FileText /> },
];

const COMMANDS: CommandItem[] = [
  { id: "new-campaign", label: "New campaign", group: "Create", icon: <Plus />, shortcut: ["C"] },
  { id: "new-post", label: "Draft a post", group: "Create", icon: <ImageIcon />, keywords: ["social", "instagram"] },
  { id: "new-play", label: "Start a play", group: "Create", icon: <Rocket /> },
  { id: "go-today", label: "Go to Today", group: "Go to", icon: <LayoutGrid />, shortcut: ["G", "T"] },
  { id: "go-inbox", label: "Go to Inbox", group: "Go to", icon: <Inbox />, shortcut: ["G", "I"] },
  { id: "go-results", label: "Go to Results", group: "Go to", icon: <ChartLine />, shortcut: ["G", "R"] },
  { id: "approve", label: "Review pending approvals", group: "Actions", icon: <ListChecks />, hint: "4 waiting" },
  { id: "credits", label: "Buy credits", group: "Actions", icon: <CreditCard /> },
  { id: "settings", label: "Workspace settings", group: "Actions", icon: <Settings />, keywords: ["preferences"] },
];

const SEARCH_ITEMS: CommandItem[] = [
  { id: "l1", label: "Priya Shah", group: "Leads", icon: <UserRound />, hint: "Hot lead" },
  { id: "l2", label: "Priya's Florist", group: "Leads", icon: <Store />, hint: "Replied" },
  { id: "l3", label: "Ben Ortiz", group: "Leads", icon: <UserRound />, hint: "New" },
  { id: "c1", label: "Spring launch", group: "Campaigns", icon: <Megaphone />, hint: "Live" },
  { id: "c2", label: "Spring brunch menu", group: "Campaigns", icon: <Megaphone />, hint: "Draft" },
  { id: "p1", label: "Sourdough Saturday reel", group: "Posts", icon: <ImageIcon />, hint: "Scheduled" },
  { id: "p2", label: "Spring opening hours", group: "Posts", icon: <ImageIcon />, hint: "Published" },
  { id: "m1", label: "Re: catering for 40", group: "Inbox", icon: <Mail />, hint: "2h" },
];

const RECENT: PageLink[] = [
  { id: "r1", label: "Spring launch", meta: "Campaign · 5m", icon: <Megaphone /> },
  { id: "r2", label: "Results · last 30 days", meta: "Report · 1h", icon: <ChartLine /> },
  { id: "r3", label: "Priya Shah", meta: "Lead · 3h", icon: <UserRound /> },
  { id: "r4", label: "Connections", meta: "Settings · Yesterday", icon: <Zap /> },
];

const NESTED = [
  { id: "overview", label: "Overview", icon: <LayoutGrid /> },
  {
    id: "spring",
    label: "Spring launch",
    icon: <Megaphone />,
    children: [
      { id: "spring-brief", label: "Brief" },
      {
        id: "spring-channels",
        label: "Channels",
        children: [
          { id: "spring-email", label: "Email · 3 steps" },
          { id: "spring-social", label: "Social · 8 posts", badge: 2 },
          { id: "spring-ads", label: "Search ads" },
        ],
      },
      { id: "spring-results", label: "Results" },
    ],
  },
  {
    id: "newsletter",
    label: "Monthly newsletter",
    icon: <Mail />,
    children: [
      { id: "nl-draft", label: "Draft" },
      { id: "nl-audience", label: "Audience" },
    ],
  },
  { id: "archive", label: "Archived", icon: <FileText /> },
];

const said = (t: string) => toast({ title: t, tone: "success", duration: 2200 });

function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex overflow-hidden rounded-[8px] border border-line bg-bg ${className}`}>{children}</div>;
}

function PageStub({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="hidden min-w-0 flex-1 flex-col gap-4 p-5 sm:flex">
      <div>
        <p className="heading-page">{title}</p>
        {sub ? <p className="text-sm text-ink-2">{sub}</p> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]" />
        ))}
      </div>
    </div>
  );
}

const pageTitle = (id: string) => SECTIONS.flatMap((s) => s.items).find((i) => i.id === id)?.label ?? id;

/* ------------------------------------------------------------------ */
/* Specimens                                                           */
/* ------------------------------------------------------------------ */

function PrimarySidebarDemo() {
  const [active, setActive] = useState("today");
  const [ws, setWs] = useState("tartine");
  return (
    <Frame className="h-[720px]">
      <PrimarySidebar
        sections={SECTIONS}
        active={active}
        onSelect={setActive}
        header={
          <>
            <div className="px-1 py-1">
              <Wordmark />
            </div>
            <WorkspaceSwitcher options={WORKSPACES} value={ws} onChange={setWs} onCreate={() => said("New workspace started")} />
          </>
        }
        footer={<UpsellCard />}
      />
      <PageStub title={pageTitle(active)} sub="Click any item; Workspace settings folds." />
    </Frame>
  );
}

function SecondarySidebarDemo() {
  const [page, setPage] = useState("profile");
  const groups = [
    { label: "Business", items: [{ id: "profile", label: "Business profile", description: "Name, hours, locations" }, { id: "brand", label: "Brand voice", description: "Tone, words to avoid" }, { id: "offers", label: "Offers" }] },
    { label: "Workspace", items: [{ id: "members", label: "Members", badge: <NavBadge>4</NavBadge> }, { id: "billing", label: "Billing & credits" }, { id: "notifications", label: "Notifications" }, { id: "danger", label: "Delete workspace" }] },
  ];
  const all = groups.flatMap((g) => g.items);
  return (
    <Frame className="h-[460px]">
      <PrimarySidebar collapsed sections={[{ id: "s", items: SECTIONS[2].items.slice(0, 1).concat(SECTIONS[0].items.slice(0, 3)) }]} active="general" header={<span className="grid size-10 place-items-center rounded-[3px] bg-lime"><Store className="size-[18px]" aria-hidden /></span>} />
      <SecondarySidebar title="Settings" groups={groups} active={page} onSelect={setPage} searchable />
      <div className="hidden min-w-0 flex-1 p-5 md:block">
        <p className="heading-section">{all.find((i) => i.id === page)?.label}</p>
        <p className="mt-1 text-sm text-ink-2">The second column lists a section&apos;s own pages.</p>
      </div>
    </Frame>
  );
}

function CollapsibleDemo() {
  const [active, setActive] = useState("results");
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Frame className="h-[620px]">
      <CollapsibleSidebar
        sections={SECTIONS.slice(0, 2)}
        active={active}
        onSelect={setActive}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        brand={<Wordmark size="sm" />}
        brandCollapsed={<span className="grid size-10 place-items-center rounded-[3px] bg-lime"><Store className="size-[18px]" aria-hidden /></span>}
        footer={<SidebarFooter name="Maya Rahman" role="Owner" credits={820} creditsMax={1100} collapsed={collapsed} />}
      />
      <PageStub title={pageTitle(active)} sub={collapsed ? "Rail: hover an icon for its name." : "Fold to a 68px rail with the panel button."} />
    </Frame>
  );
}

function TopBarDemo() {
  const [project, setProject] = useState("spring");
  const [account, setAccount] = useState("maya");
  return (
    <div className="overflow-hidden rounded-[8px] border border-line">
      <TopBar
        left={
          <>
            <ProjectSwitcher options={PROJECTS} value={project} onChange={setProject} onCreate={() => said("New project")} />
            <span aria-hidden className="text-ink-3">/</span>
            <Breadcrumbs className="hidden md:block" items={[{ id: "ch", label: "Channels" }, { id: "social", label: "Social posts" }]} onNavigate={(id) => said(`Open ${id}`)} />
          </>
        }
        center={<GlobalSearch className="hidden lg:block" items={SEARCH_ITEMS} recent={["catering", "spring"]} onOpen={(it) => said(`Open ${it.label}`)} />}
        right={
          <>
            <span className="hidden items-center gap-1 rounded-[var(--radius-badge)] bg-surface px-2 py-1 text-xs font-medium tabular-nums text-ink-2 shadow-[var(--card-shadow)] sm:inline-flex">820 credits</span>
            <IconButton aria-label="Notifications" icon={<Bell />} size="sm" />
            <AppLauncher apps={APPS} current="climbos" onOpen={(id) => said(`Open ${id}`)} />
            <AccountSwitcher accounts={ACCOUNTS} value={account} onChange={setAccount} onSignOut={() => said("Signed out")} />
          </>
        }
      />
      <div className="h-28 bg-bg" />
    </div>
  );
}

function GroupsDemo() {
  const [active, setActive] = useState("customers");
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="flex w-full max-w-[248px] flex-col gap-3">
        {SECTIONS.map((s) => (
          <SideNavGroup key={s.id} label={s.label} collapsible defaultOpen={s.id !== "settings"}>
            {s.items.map((it) => (
              <SideNavItem key={it.id} item={{ ...it, badge: undefined }} active={active === it.id} onSelect={setActive} />
            ))}
          </SideNavGroup>
        ))}
      </div>
      <Spec items={[["Header", "13px ink-3, chevron toggles (aria-expanded)"], ["Divider", "1px line above each labelled group"], ["Order", "Daily work first, settings last"], ["Max", "7 items per group"]]} />
    </div>
  );
}

function TabNavDemo() {
  const [tab, setTab] = useState("posts");
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "posts", label: "Posts", count: 8 },
    { id: "emails", label: "Emails", count: 3 },
    { id: "ads", label: "Ads" },
    { id: "results", label: "Results" },
    { id: "settings", label: "Settings" },
  ];
  return (
    <div className="flex flex-col gap-4">
      <TabNav items={tabs} value={tab} onChange={setTab} label="Campaign sections" />
      <p className="text-sm text-ink-2">Showing {tabs.find((t) => t.id === tab)?.label.toLowerCase()} for Spring launch.</p>
    </div>
  );
}

function SegmentedDemo() {
  const [range, setRange] = useState("30d");
  const [view, setView] = useState<"list" | "grid" | "board">("list");
  const [ch, setCh] = useState("all");
  return (
    <div className="flex flex-wrap items-center gap-6">
      <Segmented label="Time range" value={range} onChange={setRange} options={["7d", "30d", "3m", "1y"].map((v) => ({ value: v, label: v }))} />
      <Segmented label="Channel" value={ch} onChange={setCh} options={[{ value: "all", label: "All" }, { value: "social", label: "Social" }, { value: "email", label: "Email" }]} />
      <ViewSwitcher label="View" value={view} onChange={setView} options={[{ value: "list", label: "List", icon: <Table2 /> }, { value: "grid", label: "Grid", icon: <LayoutGrid /> }, { value: "board", label: "Board", icon: <ListChecks /> }]} />
      <span className="text-ui text-ink-3">
        {range} · {ch} · {view}
      </span>
    </div>
  );
}

function CommandMenuDemo() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
      <CommandMenu items={COMMANDS} onSelect={(it) => setLast(it.label)} placeholder="Search commands" />
      <div className="flex flex-col gap-2 text-ui text-ink-2">
        <p className="text-overline">Last run</p>
        <p aria-live="polite" className="text-ink">{last ?? "Nothing yet. Try “inbox” then Enter."}</p>
      </div>
    </div>
  );
}

function FavRecentDemo({ show }: { show: "recent" | "favorites" }) {
  const [recent, setRecent] = useState(RECENT);
  const [favs, setFavs] = useState([
    { id: "f1", label: "Spring launch", icon: <Megaphone />, starred: true },
    { id: "f2", label: "Results · this month", icon: <ChartLine />, starred: true },
    { id: "f3", label: "Inbox · hot leads", icon: <Inbox />, starred: true },
    { id: "f4", label: "Google Business profile", icon: <Globe />, starred: false },
  ]);
  const toggle = (id: string) => setFavs((f) => f.map((x) => (x.id === id ? { ...x, starred: !x.starred } : x)));
  if (show === "recent")
    return (
      <div className="w-full max-w-sm">
        <RecentPages items={recent} onOpen={(id) => said(`Open ${RECENT.find((r) => r.id === id)?.label}`)} onClear={() => setRecent([])} />
        {!recent.length ? <Button variant="secondary" size="sm" className="ml-2.5 mt-2" onClick={() => setRecent(RECENT)}>Restore sample</Button> : null}
      </div>
    );
  return (
    <div className="grid w-full gap-6 sm:grid-cols-2">
      <Favorites items={favs} onOpen={(id) => said(`Open ${favs.find((f) => f.id === id)?.label}`)} onToggle={toggle} />
      <div className="flex flex-col gap-1">
        <p className="text-overline px-2.5">All pages</p>
        {favs.map((f) => (
          <div key={f.id} className="flex items-center justify-between px-2.5 py-1 text-ui">
            <span>{f.label}</span>
            <Button size="sm" variant="ghost" aria-pressed={f.starred} onClick={() => toggle(f.id)}>
              {f.starred ? "Starred" : "Star"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SwitchersDemo({ kind }: { kind: "workspace" | "org" | "project" | "account" | "apps" }) {
  const [ws, setWs] = useState("tartine");
  const [org, setOrg] = useState("maya");
  const [project, setProject] = useState("spring");
  const [account, setAccount] = useState("maya");
  if (kind === "workspace")
    return (
      <div className="flex flex-wrap items-start gap-8">
        <div className="w-[240px]">
          <WorkspaceSwitcher options={WORKSPACES} value={ws} onChange={(id) => (setWs(id), said(`Switched to ${WORKSPACES.find((w) => w.id === id)?.label}`))} onCreate={() => said("New workspace")} />
        </div>
        <WorkspaceSwitcher collapsed options={WORKSPACES} value={ws} onChange={setWs} />
      </div>
    );
  if (kind === "org") return <OrganizationSwitcher options={ORGS} value={org} onChange={(id) => (setOrg(id), said(`Switched to ${ORGS.find((o) => o.id === id)?.label}`))} onCreate={() => said("New organization")} />;
  if (kind === "project")
    return (
      <div className="flex items-center gap-1 text-ui">
        <span className="text-ink-3">Tartine Bakery</span>
        <span aria-hidden className="text-ink-3">/</span>
        <ProjectSwitcher options={PROJECTS} value={project} onChange={setProject} onCreate={() => said("New project")} />
      </div>
    );
  if (kind === "account")
    return (
      <div className="flex items-center gap-3">
        <AccountSwitcher
          accounts={ACCOUNTS}
          value={account}
          onChange={(id) => (setAccount(id), said(`Signed in as ${ACCOUNTS.find((a) => a.id === id)?.email}`))}
          onAdd={() => said("Add account")}
          onSignOut={() => said("Signed out")}
          links={[{ id: "profile", label: "Profile & security", icon: <UserRound />, onSelect: () => said("Profile") }, { id: "billing", label: "Billing", icon: <CreditCard />, onSelect: () => said("Billing") }]}
        />
        <span className="text-ui text-ink-2">{ACCOUNTS.find((a) => a.id === account)?.email}</span>
      </div>
    );
  return <AppLauncher apps={APPS} current="climbos" onOpen={(id) => said(`Open ${APPS.find((a) => a.id === id)?.name}`)} />;
}

function BadgesDemo() {
  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
      <div className="flex flex-wrap items-center gap-3">
        <NavBadge>3</NavBadge>
        <NavBadge tone="attention">12</NavBadge>
        <NavBadge tone="new">New</NavBadge>
        <NavBadge tone="dot" label="Unread" />
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex w-[220px] flex-col gap-0.5">
          {SECTIONS[0].items.slice(3).concat(SECTIONS[1].items.slice(1)).map((it) => (
            <SideNavItem key={it.id} item={it} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {SECTIONS[0].items.slice(3).map((it) => (
            <SideNavItem key={it.id} item={it} collapsed />
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileBottomDemo() {
  const [tab, setTab] = useState("today");
  const items = [
    { id: "today", label: "Today", icon: <LayoutGrid /> },
    { id: "inbox", label: "Inbox", icon: <Inbox />, badge: 4 },
    { id: "create", label: "Create", icon: <Plus /> },
    { id: "results", label: "Results", icon: <ChartLine /> },
    { id: "more", label: "More", icon: <Settings /> },
  ];
  return (
    <DeviceFrame>
      <div className="flex-1 overflow-y-auto p-4">
        <p className="heading-section">{items.find((i) => i.id === tab)?.label}</p>
        <p className="mt-1 text-sm text-ink-2">Five destinations at most. Labels stay visible.</p>
      </div>
      <MobileBottomNav items={items} active={tab} onSelect={setTab} />
    </DeviceFrame>
  );
}

function MobileDrawerDemo() {
  const [active, setActive] = useState("today");
  const [ws, setWs] = useState("tartine");
  return (
    <DeviceFrame>
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-2">
        <MobileNavDrawer
          sections={SECTIONS}
          active={active}
          onSelect={setActive}
          header={
            <>
              <div className="px-1 pt-1"><Wordmark size="sm" /></div>
              <WorkspaceSwitcher options={WORKSPACES} value={ws} onChange={setWs} />
            </>
          }
          footer={<SidebarFooter name="Maya Rahman" role="Owner" credits={820} creditsMax={1100} />}
        />
        <span className="text-sm font-medium">{pageTitle(active)}</span>
      </div>
      <div className="flex-1 p-4 text-sm text-ink-2">Tap the menu. Picking a page closes the drawer and returns focus.</div>
    </DeviceFrame>
  );
}

export function NavigationContent() {
  const [crumbs] = useState([
    { id: "home", label: "Tartine Bakery" },
    { id: "campaigns", label: "Campaigns" },
    { id: "spring", label: "Spring launch" },
    { id: "channels", label: "Channels" },
    { id: "social", label: "Social posts" },
    { id: "post", label: "Sourdough Saturday reel" },
  ]);
  const [nested, setNested] = useState("spring-social");
  return (
    <DocPage title="Navigation" eyebrow="Components" intro="How people move around ClimbOS: one calm sidebar, clear context switchers and a keyboard-first command menu.">
      <Specimen title="Primary sidebar" description="Sits on the ground; the current page lifts to white. Groups follow the job: grow, measure, settings.">
        <PrimarySidebarDemo />
        <Spec items={[["Width", "248px · rail 68px"], ["Item", "var(--h-lg), 3px radius, 14px label"], ["Active", "white surface + card shadow + medium weight (not colour alone)"], ["Lime", "workspace tile and the one upsell CTA only"]]} />
      </Specimen>

      <Specimen title="Secondary sidebar" description="A white second column for a section's own pages, with an optional filter.">
        <SecondarySidebarDemo />
      </Specimen>

      <Specimen title="Collapsible sidebar" description="Folds to an icon rail; names move to tooltips and stay in the accessible name.">
        <CollapsibleDemo />
        <Spec items={[["Toggle", "PanelLeftClose / PanelLeftOpen, aria-expanded"], ["Rail badges", "become a dot with screen-reader text"]]} />
      </Specimen>

      <Specimen title="Top navigation bar" description="Context on the left, search in the middle, account and apps on the right.">
        <TopBarDemo />
        <Spec items={[["Height", "56px, sticky, the only place with backdrop blur"], ["Order", "project · breadcrumbs | search | credits · alerts · apps · account"]]} />
      </Specimen>

      <Specimen title="Navigation groups">
        <Stage>
          <GroupsDemo />
        </Stage>
      </Specimen>

      <Specimen title="Nested navigation" description="Parents disclose children; the branch with the current page starts open.">
        <Stage tone="white" className="max-w-sm">
          <NestedNav items={NESTED} active={nested} onSelect={setNested} label="Campaigns" />
        </Stage>
      </Specimen>

      <Specimen title="Breadcrumbs" description="Last crumb is the current page. Past four, the middle folds into a menu.">
        <Stage tone="white" className="flex flex-col gap-4">
          <Breadcrumbs items={crumbs.slice(0, 3)} onNavigate={(id) => said(`Open ${id}`)} />
          <Breadcrumbs items={crumbs} onNavigate={(id) => said(`Open ${id}`)} />
        </Stage>
      </Specimen>

      <Specimen title="Tab navigation" description="Section tabs inside a record. Counts sit in a pill; the current tab is underlined in ink.">
        <Stage tone="white">
          <TabNavDemo />
        </Stage>
      </Specimen>

      <Specimen title="Segmented controls" description="Two to five peers that swap a view in place.">
        <Stage>
          <SegmentedDemo />
        </Stage>
      </Specimen>

      <Specimen title="Command menu" description="Inline, filterable and grouped. Reused by the palette, AI command bar and pickers.">
        <Stage>
          <CommandMenuDemo />
        </Stage>
        <Spec items={[["Keys", "↑ ↓ Home End to move, Enter to run, Esc clears then closes"], ["Pattern", "combobox + listbox with aria-activedescendant"]]} />
      </Specimen>

      <Specimen title="Global search" description="Recent searches when empty, results grouped by type while typing.">
        <Stage className="min-h-[360px]">
          <GlobalSearch items={SEARCH_ITEMS} recent={["catering", "spring menu", "priya"]} onOpen={(it) => said(`Open ${it.label}`)} onSearchAll={(q) => said(`All results for “${q}”`)} />
        </Stage>
      </Specimen>

      <Specimen title="Recent pages">
        <Stage tone="white">
          <FavRecentDemo show="recent" />
        </Stage>
      </Specimen>

      <Specimen title="Favorites">
        <Stage tone="white">
          <FavRecentDemo show="favorites" />
        </Stage>
      </Specimen>

      <Specimen title="Workspace switcher" description="One workspace per business. Expanded and rail versions.">
        <Stage>
          <SwitchersDemo kind="workspace" />
        </Stage>
      </Specimen>

      <Specimen title="Organization switcher" description="The billing account above workspaces (personal or agency).">
        <Stage>
          <SwitchersDemo kind="org" />
        </Stage>
      </Specimen>

      <Specimen title="Project switcher" description="Jump between campaigns and plays from the top bar. Filterable.">
        <Stage>
          <SwitchersDemo kind="project" />
        </Stage>
      </Specimen>

      <Specimen title="Account switcher">
        <Stage>
          <SwitchersDemo kind="account" />
        </Stage>
      </Specimen>

      <Specimen title="App launcher" description="Connected apps in one grid. Arrow keys move across it.">
        <Stage>
          <SwitchersDemo kind="apps" />
        </Stage>
      </Specimen>

      <Specimen title="Navigation badges" description="Count, needs attention, new and dot. The number is always readable text.">
        <Stage>
          <BadgesDemo />
        </Stage>
      </Specimen>

      <Specimen title="Sidebar footer" description="Credits left and the signed-in person; an avatar in the rail.">
        <Stage className="flex flex-wrap items-end gap-8">
          <div className="w-[224px]">
            <SidebarFooter name="Maya Rahman" role="Owner" credits={820} creditsMax={1100} onSignOut={() => said("Signed out")} onCredits={() => said("Open credits")} />
          </div>
          <SidebarFooter collapsed name="Maya Rahman" role="Owner" credits={820} creditsMax={1100} />
        </Stage>
      </Specimen>

      <Specimen title="Mobile bottom navigation">
        <Stage>
          <MobileBottomDemo />
        </Stage>
      </Specimen>

      <Specimen title="Mobile navigation drawer">
        <Stage>
          <MobileDrawerDemo />
        </Stage>
      </Specimen>
    </DocPage>
  );
}
