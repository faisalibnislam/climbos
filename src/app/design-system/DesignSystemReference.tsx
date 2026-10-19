"use client";

import { useState, type ReactNode } from "react";
import { Bell, CalendarCheck, CalendarDays, Check, Eye, Inbox, MailOpen, MessageSquareReply, MoreHorizontal, Plus, Search, Send, Sparkles, Trash2, Users } from "@/components/icons"
import {
  Avatar,
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CellStack,
  Checkbox,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  IconTile,
  Input,
  Kbd,
  Meter,
  Progress,
  RadioCards,
  Select,
  Skeleton,
  Stat,
  StatGroup,
  StatusPill,
  StepList,
  Switch,
  Table,
  TableFrame,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  toast,
  Toaster,
  Tooltip,
  Tr,
  type Tone,
  AreaChart,
  BarList,
  DonutChart,
  FunnelChart,
  Heatmap,
  NetworkLabel,
  ProgressRing,
  SocialIcon,
  StatTrend,
  ColorPicker,
  DatePicker,
  DateTimePicker,
} from "@/components/ui";
import { PageHeader } from "@/components/app/results/QueryBoundary";

const TONES: Tone[] = ["neutral", "brand", "green", "amber", "red", "blue", "violet", "teal", "pink", "orange"];

const SWATCHES: { name: string; varName: string; note: string }[] = [
  { name: "bg", varName: "--bg", note: "Ground" },
  { name: "surface", varName: "--surface", note: "Panels" },
  { name: "surface-2", varName: "--surface-2", note: "Subtle fill" },
  { name: "surface-3", varName: "--surface-3", note: "Strong fill" },
  { name: "ink", varName: "--ink", note: "Text" },
  { name: "ink-2", varName: "--ink-2", note: "Secondary" },
  { name: "ink-3", varName: "--ink-3", note: "Meta" },
  { name: "brand-800", varName: "--brand-800", note: "Pine" },
  { name: "brand-100", varName: "--brand-100", note: "Pine tint" },
  { name: "sun", varName: "--sun", note: "Highlight" },
  { name: "sun-soft", varName: "--sun-soft", note: "Highlight tint" },
];

const TYPE: { cls: string; label: string; sample: string }[] = [
  { cls: "heading-page", label: "heading-page · Reckless Neue 28/36", sample: "Your growth plan" },
  { cls: "heading-section", label: "heading-section · Inter 16/24 600", sample: "This week's posts" },
  { cls: "heading-card", label: "heading-card · Inter 14/20 600", sample: "LinkedIn · Tuesday 9:00" },
  { cls: "text-xl font-semibold tracking-tight", label: "dialog title · Inter 18/26 600", sample: "Approve this post?" },
  { cls: "text-base", label: "text-base · 15/24 long-form", sample: "ClimbOS researches your business, plans the week and drafts every post for your approval." },
  { cls: "text-sm", label: "text-sm · 14/20 body", sample: "Approve it and it goes out at the planned time." },
  { cls: "text-ui", label: "text-ui · 13/18 controls, tables", sample: "Scheduled for Tue, Oct 21 at 9:00" },
  { cls: "text-xs text-ink-3", label: "text-xs · 12/16 captions", sample: "Updated 2 minutes ago" },
  { cls: "text-overline", label: "text-overline · 11/16 caps", sample: "Grow" },
  { cls: "metric", label: "metric · 28/32 (Reckless Neue in Summit, Inter 600 in Signal)", sample: "1,284" },
];

/** Type labels in the Signal theme (Reckless titles, Hanken body). */
const SIGNAL_TYPE_LABELS: Record<string, string> = {
  "heading-page": "heading-page · Reckless 36/40",
  "heading-section": "heading-section · Reckless 24/30",
  "heading-card": "heading-card · Reckless 17/22",
  "text-xl font-semibold tracking-tight": "dialog title · Reckless 22/28 (heading-dialog)",
  "text-base": "text-base · Hanken 15/24 long-form",
  "text-sm": "text-sm · Hanken 14/20 body",
  "text-ui": "text-ui · Hanken 13/18 controls, tables",
  "text-xs text-ink-3": "text-xs · Hanken 12/16 captions",
  "text-overline": "text-overline · Hanken 11/16 caps",
  metric: "metric · Hanken 600 28/32 (KPIs)",
};

const NETWORKS = ["instagram", "facebook", "linkedin", "x", "tiktok", "youtube", "pinterest", "snapchat", "threads", "google"];

const ROWS = [
  { name: "Tartine Bakery", email: "hello@tartine.example", channel: "Instagram", posts: 4, status: "Scheduled" },
  { name: "Bell Brothers", email: "ops@bell.example", channel: "Facebook", posts: 3, status: "Needs your OK" },
  { name: "Plausible", email: "team@plausible.example", channel: "LinkedIn", posts: 5, status: "Published" },
];

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line pt-8">
      <h2 className="heading-section">{title}</h2>
      {intro ? <p className="mt-1 max-w-2xl text-sm text-ink-3">{intro}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 py-3 sm:grid-cols-[160px_1fr] sm:items-center">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Swatch names and notes for the proposed "Signal" theme (/design-system/v2). */
const SIGNAL_SWATCHES: typeof SWATCHES = [
  { name: "bg", varName: "--bg", note: "Stone ground" },
  { name: "surface", varName: "--surface", note: "Panels" },
  { name: "surface-2", varName: "--surface-2", note: "Subtle fill" },
  { name: "surface-3", varName: "--surface-3", note: "Strong fill" },
  { name: "ink", varName: "--ink", note: "Text, primary actions" },
  { name: "ink-2", varName: "--ink-2", note: "Secondary" },
  { name: "ink-3", varName: "--ink-3", note: "Meta" },
  { name: "brand-800", varName: "--brand-800", note: "Sage" },
  { name: "brand-100", varName: "--brand-100", note: "Sage tint" },
  { name: "sun", varName: "--sun", note: "Lime accent" },
  { name: "sun-strong", varName: "--sun-strong", note: "Lime for marks" },
  { name: "sun-soft", varName: "--sun-soft", note: "Lime tint" },
];

export function DesignSystemReference({ theme }: { theme?: "signal" } = {}) {
  const swatches = theme === "signal" ? SIGNAL_SWATCHES : SWATCHES;
  const [mode, setMode] = useState("trust");
  const [channel, setChannel] = useState("linkedin");
  const [day, setDay] = useState("");
  const [when, setWhen] = useState("");
  const [color, setColor] = useState("#0b5d46");
  const [auto, setAuto] = useState(true);
  return (
    <div className="min-h-dvh bg-bg">
      <Toaster />
      <main className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <PageHeader
          eyebrow="ClimbOS · Signal"
          title={theme === "signal" ? "Components" : "Design system"}
          intro="Every token and component the product uses. If a screen needs something that isn't here, add it here first (docs/DesignSystem.md)."
          actions={
            <>
              <Button variant="secondary">Secondary</Button>
              <Button>
                <Plus /> Primary
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-10">
          <Section id="colour" title="Colour" intro="Sage-grey ground, white panels, pine for action, sunrise for small highlights. Status colours are soft fills with deep inks.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {swatches.map((s) => (
                <div key={s.name} className="overflow-hidden rounded-xl border border-line bg-surface">
                  <div className="h-14 border-b border-line" style={{ background: `var(${s.varName})` }} />
                  <div className="p-2.5">
                    <div className="text-ui font-medium">{s.name}</div>
                    <div className="text-xs text-ink-3">{s.note}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {TONES.map((t) => (
                <Badge key={t} tone={t}>
                  {t}
                </Badge>
              ))}
            </div>
          </Section>

          <Section id="type" title="Type" intro="Three families, one scale. Reckless Neue for page titles, big numbers and marketing headlines, Inter for everything you read and click.">
            <div className="divide-y divide-line rounded-xl border border-line bg-surface px-5">
              {TYPE.map((t) => (
                <div key={t.cls} className="grid gap-1 py-4 sm:grid-cols-[240px_1fr] sm:items-baseline">
                  <div className="text-xs text-ink-3">{theme === "signal" ? SIGNAL_TYPE_LABELS[t.cls] ?? t.label : t.label}</div>
                  <div className={t.cls === "text-xl font-semibold tracking-tight" && theme === "signal" ? "heading-dialog" : t.cls}>{t.sample}</div>
                </div>
              ))}
              <div className="marketing grid gap-1 py-4 sm:grid-cols-[240px_1fr] sm:items-baseline">
                <div className="text-xs text-ink-3">marketing h2 · Reckless Neue</div>
                <h2 className="text-4xl">Drop your link. Get booked calls.</h2>
              </div>
            </div>
          </Section>

          <Section id="buttons" title="Buttons" intro="One height scale for every control: 32 / 36 / 40px. One primary button per view.">
            <div className="rounded-xl border border-line bg-surface px-5 divide-y divide-line">
              <Row label="Variants (md)">
                <Button>Approve post</Button>
                <Button variant="secondary">Edit</Button>
                <Button variant="ghost">Skip</Button>
                <Button variant="accent">
                  <Sparkles /> Ask your team
                </Button>
                <Button variant="danger">
                  <Trash2 /> Delete
                </Button>
                <Button variant="link">View receipt</Button>
              </Row>
              <Row label="Sizes">
                <Button size="sm">Small 32</Button>
                <Button size="md">Medium 36</Button>
                <Button size="lg">Large 40</Button>
              </Row>
              <Row label="Icon buttons">
                <IconButton aria-label="Search" icon={<Search />} size="sm" />
                <IconButton aria-label="Notifications" icon={<Bell />} />
                <IconButton aria-label="More" icon={<MoreHorizontal />} variant="secondary" size="lg" />
              </Row>
              <Row label="States">
                <Button loading>Saving</Button>
                <Button disabled>Disabled</Button>
                <Tooltip content="Sends at the planned time">
                  <Button variant="secondary">
                    <Send /> With tooltip
                  </Button>
                </Tooltip>
              </Row>
            </div>
          </Section>

          <Section id="forms" title="Forms" intro="Visible labels, hints under the label, errors under the control. Controls are 36px with 6px corners.">
            <Card>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <Field label="Website" hint="We read your public pages only.">
                  <Input placeholder="yourbusiness.com" />
                </Field>
                <Field label="Channel">
                  <Select
                    value={channel}
                    onValueChange={setChannel}
                    options={[
                      { value: "linkedin", label: "LinkedIn" },
                      { value: "instagram", label: "Instagram" },
                      { value: "facebook", label: "Facebook" },
                    ]}
                  />
                </Field>
                <Field label="Start date" hint="Our own calendar. Arrow keys move, Enter picks.">
                  <DatePicker value={day} onChange={setDay} />
                </Field>
                <Field label="Schedule for">
                  <DateTimePicker value={when} onChange={setWhen} />
                </Field>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ui font-medium text-ink">Brand colour</span>
                  <ColorPicker label="Brand colour" value={color} onChange={setColor} />
                </div>
                <Field label="Company name" error="Add your company name so posts sound like you.">
                  <Input defaultValue="" />
                </Field>
                <Field label="Always ask me about" optional>
                  <Textarea placeholder="Prices, new products, anything about our team" />
                </Field>
                <div className="flex flex-col gap-1">
                  <Checkbox label="Email me a weekly summary" defaultChecked />
                  <Checkbox label="Include results from ads" description="Only when an ad account is connected." />
                </div>
                <Switch label="Autopilot" description="Posts go out on schedule within your rules." checked={auto} onCheckedChange={setAuto} />
              </CardContent>
            </Card>
            <div className="mt-4">
              <RadioCards
                aria-label="Autopilot mode"
                value={mode}
                onValueChange={setMode}
                columns={3}
                options={[
                  { value: "ask", title: "Always ask", description: "You approve every post." },
                  { value: "trust", title: "Trust ladder", description: "Earns auto-posting per channel after 5 clean approvals." },
                  { value: "auto", title: "Fully auto", description: "Posts within your rules; sensitive ones still wait." },
                ]}
              />
            </div>
          </Section>

          <Section id="tables" title="Tables" intro="36px header with 12px labels, 44px rows with 13px text, numbers right-aligned.">
            <div className="flex flex-col gap-4">
              <DataTable
                caption="Accounts"
                rows={ROWS}
                rowKey={(r) => r.name}
                columns={[
                  { key: "name", header: "Business", cell: (r) => <CellStack primary={r.name} secondary={r.email} />, sortValue: (r) => r.name },
                  { key: "channel", header: "Channel", sortValue: (r) => r.channel },
                  { key: "posts", header: "Posts this week", align: "right", sortValue: (r) => r.posts },
                  {
                    key: "status",
                    header: "Status",
                    cell: (r) => <Badge tone={r.status === "Published" ? "green" : r.status === "Scheduled" ? "blue" : "amber"}>{r.status}</Badge>,
                  },
                ]}
              />
              <TableFrame>
                <Table>
                  <THead>
                    <tr>
                      <Th>Composed table</Th>
                      <Th>When</Th>
                      <Th numeric>Reach</Th>
                      <Th className="w-12">
                        <span className="sr-only">Actions</span>
                      </Th>
                    </tr>
                  </THead>
                  <TBody>
                    {["Why your furnace filter matters", "3 signs your AC is oversized"].map((t, i) => (
                      <Tr key={t} interactive>
                        <Td>
                          <CellStack primary={t} secondary="Facebook · teach" />
                        </Td>
                        <Td className="text-ink-3">{i ? "Thu 1:00 PM" : "Tue 9:00 AM"}</Td>
                        <Td numeric>{i ? "—" : "2,140"}</Td>
                        <Td>
                          <IconButton aria-label="More" icon={<MoreHorizontal />} size="sm" />
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </TableFrame>
            </div>
          </Section>

          <Section id="networks" title="Networks" intro="Real platform marks in brand colours. Text always names the network too.">
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-4">
                {NETWORKS.map((n) => (
                  <NetworkLabel key={n} network={n} className="text-ui text-ink-2" />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {NETWORKS.map((n) => (
                  <Tooltip key={n} content={n}>
                    <span tabIndex={0} className="rounded-lg">
                      <SocialIcon network={n} variant="tile" size="lg" labelled />
                    </span>
                  </Tooltip>
                ))}
              </div>
            </div>
          </Section>

          <Section id="data" title="Data visualisation" intro="Hover or use arrow keys for exact values; every chart can switch to a table.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTrend label="Reach" value="18.2k" delta={14} trend={[9, 11, 10, 13, 12, 15, 18]} sublabel="Meta insights · last 7 days" help="People who saw at least one post." />
              <StatTrend label="Replies" value="46" delta={6} trend={[4, 6, 5, 7, 6, 8, 10]} sublabel="All channels" />
              <StatTrend label="Booked calls" value="7" delta={40} trend={[0, 1, 1, 2, 1, 3, 2]} sublabel="Outbound · 30 days" />
              <StatTrend label="Unsubscribes" value="0.4%" delta={-12} upIsGood={false} trend={[0.6, 0.5, 0.5, 0.45, 0.5, 0.42, 0.4]} sublabel="Cold email" />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <AreaChart
                className="lg:col-span-2"
                title="Reach and engagement"
                description="Both rose after carousels replaced single images in week 3."
                source="Source: Meta insights · demo data"
                categoryLabel="Week"
                labels={["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7", "Wk 8"]}
                series={[
                  { key: "reach", label: "Reach", values: [3200, 3500, 4100, 5200, 5900, 6100, 7300, 8100] },
                  { key: "eng", label: "Engagements", values: [210, 240, 380, 520, 610, 590, 720, 860] },
                ]}
              />
              <DonutChart
                title="Posts by channel"
                source="Last 30 days · demo data"
                centerLabel="posts"
                segments={[
                  { label: "Instagram", value: 14, icon: <SocialIcon network="instagram" size="sm" /> },
                  { label: "LinkedIn", value: 9, icon: <SocialIcon network="linkedin" size="sm" /> },
                  { label: "Facebook", value: 6, icon: <SocialIcon network="facebook" size="sm" /> },
                  { label: "X", value: 3, icon: <SocialIcon network="x" size="sm" /> },
                ]}
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <FunnelChart
                title="Outbound: website to booked calls"
                source="Last 30 days · demo data"
                steps={[
                  { label: "Prospects found", value: 1240, icon: <Users /> },
                  { label: "Emailed", value: 860, icon: <Send /> },
                  { label: "Opened", value: 412, icon: <MailOpen /> },
                  { label: "Replied", value: 58, icon: <MessageSquareReply /> },
                  { label: "Booked calls", value: 14, icon: <CalendarCheck /> },
                ]}
              />
              <Heatmap
                title="When your audience engages"
                description="Darker means more engagement per post."
                source="Instagram · demo data"
                rows={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
                columns={["8a", "10a", "12p", "2p", "4p", "6p", "8p"]}
                values={[
                  [2, 4, 6, 3, 2, 5, 7],
                  [3, 5, 8, 4, 3, 6, 9],
                  [2, 4, 7, 5, 3, 7, 8],
                  [3, 6, 9, 6, 4, 8, 10],
                  [1, 3, 5, 4, 3, 4, 5],
                  [0, 1, 3, 4, 5, 6, 6],
                  [0, 1, 2, 3, 4, 6, 5],
                ]}
              />
              <BarList
                title="Top posts"
                valueLabel="Engagements"
                source="Last 30 days · demo data"
                items={[
                  { label: "Why your furnace filter matters", meta: "Facebook · teach", value: 412, icon: <SocialIcon network="facebook" size="sm" /> },
                  { label: "3 signs your AC is oversized", meta: "Instagram · carousel", value: 356, icon: <SocialIcon network="instagram" size="sm" /> },
                  { label: "What a tune-up actually checks", meta: "LinkedIn · document", value: 198, icon: <SocialIcon network="linkedin" size="sm" /> },
                  { label: "Winter checklist", meta: "Pinterest · pin", value: 121, icon: <SocialIcon network="pinterest" size="sm" /> },
                ]}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4">
              <ProgressRing value={0.6} label="Trust ladder, LinkedIn">3/5</ProgressRing>
              <ProgressRing value={1} label="Trust ladder, Facebook" color="var(--sun-strong)" />
              <span className="flex items-center gap-1.5 text-ui text-ink-3">
                <Eye className="size-4" aria-hidden="true" /> Rings show progress toward a goal, like the trust ladder.
              </span>
            </div>
          </Section>

          <Section id="surfaces" title="Cards, stats and status">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Card title</CardTitle>
                  <CardDescription>Flat panel, hairline border, 8px corners.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <StatusPill status="ready" />
                  <StatusPill status="needs_approval" />
                  <StatusPill status="failed" />
                  <StatusPill status="demo" />
                </CardContent>
                <CardFooter>
                  <Button size="sm">Open</Button>
                  <Button size="sm" variant="ghost">
                    Later
                  </Button>
                </CardFooter>
              </Card>
              <Card>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <IconTile icon={CalendarDays} tone="brand" />
                    <IconTile icon={Inbox} tone="amber" />
                    <IconTile icon={Check} tone="green" solid />
                    <Avatar name="Faisal Islam" />
                    <Kbd>⌘K</Kbd>
                  </div>
                  <Progress label="Drafting posts" value={60} showLabel />
                  <Meter label="AI allowance" used={7.2} max={10} unit="USD" />
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <StepList
                    steps={[
                      { key: "a", label: "Read your website", status: "done" },
                      { key: "b", label: "Plan the week", status: "running" },
                      { key: "c", label: "Draft posts", status: "pending" },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
            <StatGroup className="mt-4">
              <Stat label="Posts this week" value="12" change="Up 3 from last week" sublabel="From ClimbOS" />
              <Stat label="Replies waiting" value="4" sublabel="Instagram and Facebook" />
              <Stat label="Booked calls" value="7" change="Up 2" sublabel="Outbound · last 30 days" />
              <Stat label="Reach" value="18.2k" sublabel="Meta insights · 2h ago" />
            </StatGroup>
          </Section>

          <Section id="feedback" title="Messages and empty states">
            <div className="grid gap-3 lg:grid-cols-2">
              <Callout tone="info" title="Autopilot plans on Fridays">
                Next week&apos;s posts are planned Friday morning, so you can review them over the weekend.
              </Callout>
              <Callout tone="success" title="Connected">
                Instagram is ready to post.
              </Callout>
              <Callout tone="warning" title="One fact needed">
                Add your opening hours so the post can mention them.
              </Callout>
              <Callout tone="danger" title="Couldn't publish">
                Facebook asked us to reconnect the page.
              </Callout>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <EmptyState icon={<Inbox />} title="No replies yet" body="Comments and messages from connected accounts show up here with a suggested reply." action={<Button size="sm">Connect Instagram</Button>} />
              <Card>
                <CardContent className="flex flex-col gap-3">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton />
                  <Skeleton className="w-4/5" />
                  <Skeleton className="h-24 rounded-xl" />
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section id="overlays" title="Tabs, menus and overlays">
            <div className="flex flex-wrap items-start gap-4">
              <Tabs defaultValue="week">
                <TabsList>
                  <TabsTrigger value="week">This week</TabsTrigger>
                  <TabsTrigger value="next">Next week</TabsTrigger>
                  <TabsTrigger value="inbox">Inbox</TabsTrigger>
                </TabsList>
                <TabsContent value="week" className="text-sm text-ink-3">
                  Segmented tabs: 32px track, 28px tabs.
                </TabsContent>
                <TabsContent value="next" className="text-sm text-ink-3">
                  Next week&apos;s plan.
                </TabsContent>
                <TabsContent value="inbox" className="text-sm text-ink-3">
                  Replies.
                </TabsContent>
              </Tabs>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    Menu <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Post</DropdownMenuLabel>
                  <DropdownMenuItem icon={<Send />}>Post now</DropdownMenuItem>
                  <DropdownMenuItem icon={<CalendarDays />}>Reschedule</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem danger icon={<Trash2 />}>
                    Skip this slot
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">Open dialog</Button>
                </DialogTrigger>
                <DialogContent title="Approve 3 posts?" description="They go out at their planned times. You can still edit until then.">
                  <p className="text-sm text-ink-2">Tue 9:00 LinkedIn, Wed 11:00 Instagram, Thu 1:00 Facebook.</p>
                  <DialogFooter>
                    <Button variant="ghost">Cancel</Button>
                    <Button>Approve all</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <ConfirmDialog
                trigger={<Button variant="secondary">Confirm dialog</Button>}
                title="Turn off autopilot?"
                description="Scheduled posts stay scheduled. Nothing new is planned."
                confirmLabel="Turn off"
                tone="danger"
                onConfirm={() => void toast({ title: "Autopilot is off", description: "Nothing new will be planned.", tone: "info" })}
              />
              <Button variant="secondary" onClick={() => toast({ title: "Post approved", description: "Goes out Tue at 9:00.", tone: "success" })}>
                Show toast
              </Button>
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
}
