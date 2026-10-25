"use client";

import { useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CircleDollarSign,
  FileText,
  Globe,
  Inbox,
  Mail,
  Megaphone,
  MessageCircle,
  MousePointerClick,
  Pencil,
  Plus,
  RefreshCw,
  Rocket,
  Send,
  Sparkles,
  Target,
  Users,
  Wand2,
  Zap,
} from "@/components/icons";
import { Badge, Button, IconButton, SocialIcon, Switch } from "@/components/ui";
import {
  ActivityCard,
  CardCarousel,
  CardGrid,
  ContentCard,
  DraggableCardList,
  EmptyStateCard,
  ExpandableCard,
  FeatureCard,
  FramedCard,
  IntegrationCard,
  NotificationCard,
  PricingCard,
  ProfileCard,
  ProjectCard,
  SelectableCards,
  StatusCard,
  SummaryCard,
  TaskCard,
  type DraggableItem,
  type ServiceState,
} from "@/components/ds/containers/cards";
import { Accordion, CollapsibleSection, Container, InspectorPanel, PanelSection, ResizablePanels, SplitView } from "@/components/ds/containers/layout";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";
import { Kpi, Panel } from "../../_kit/signal";

/* Deterministic sample data ------------------------------------------------ */

const HISTORY = (seed: number): ServiceState[] =>
  Array.from({ length: 30 }, (_, i) => ((i * 7 + seed) % 23 === 0 ? "degraded" : (i * 5 + seed) % 29 === 0 ? "down" : "operational"));

const PLAYS = [
  { title: "Win back lapsed regulars", meta: "Email · 214 people" },
  { title: "Weekend brunch promo", meta: "Instagram · 3 posts" },
  { title: "Invite customers to review", meta: "Email · 58 people" },
  { title: "Local SEO refresh", meta: "Website · 4 pages" },
];

const MESSAGES = [
  { id: "m1", title: "Dana Ruiz", sub: "Can we move the tasting to Friday?", meta: "9:41", unread: true, body: "Hi! Loved the menu ideas. Could we move the tasting to Friday at 3pm? Happy to bring the team." },
  { id: "m2", title: "Alex Tomland", sub: "Re: Catering quote for 40", meta: "Mon", unread: true, body: "Thanks for the quote. We'd like to go ahead with the 40-person package. What's the next step?" },
  { id: "m3", title: "Studio Morgan", sub: "Collab post draft", meta: "Sun", body: "Here's our draft caption for the collab post. Let us know if you want any tweaks before it goes out." },
  { id: "m4", title: "Priya Shah", sub: "Thank you!", meta: "Sat", body: "The sourdough class was brilliant. Already booked the next one for my sister." },
];

export function ContainersContent() {
  const [tasks, setTasks] = useState([
    { id: "t1", title: "Approve 3 Instagram posts", due: "Today", assignee: "Maya Rahman", priority: "high" as const, done: false, tags: ["Social"] },
    { id: "t2", title: "Reply to catering lead", due: "Tomorrow", assignee: "Dana Ruiz", priority: "medium" as const, done: false },
    { id: "t3", title: "Upload new menu photos", due: "Fri", priority: "low" as const, done: true },
  ]);
  const [integrations, setIntegrations] = useState({ google: true, instagram: false, email: true });
  const [notes, setNotes] = useState([
    { id: "n1", title: "3 posts need approval", body: "Autopilot drafted this week's posts. Approve to schedule them.", time: "2 min ago", unread: true },
    { id: "n2", title: "New lead from Google", body: "Alex Tomland asked about catering for 40 people.", time: "1 hr ago", unread: false },
  ]);
  const [channels, setChannels] = useState<string[]>(["email", "social"]);
  const [order, setOrder] = useState<DraggableItem[]>(PLAYS.map((p, i) => ({ id: `p${i}`, ...p })));
  const [msg, setMsg] = useState<string | null>("m1");
  const [panelOpen, setPanelOpen] = useState(true);
  const [autopilot, setAutopilot] = useState(true);

  return (
    <DocPage eyebrow="Components" title="Cards & containers" intro="White panels on the sage ground. One job per card, titles in Reckless, numbers in Hanken.">
      <Specimen title="Standard content card" description="Title, a sentence or two, one action.">
        <Stage>
          <CardGrid min={240}>
            <ContentCard eyebrow="Growth plan" title="Lean into weekend brunch" action={<Button variant="secondary" size="sm">Open play <ArrowRight /></Button>}>
              Saturday orders are up 18%. Two posts and a local ad should fill the 10am slot.
            </ContentCard>
            <ContentCard title="Your brand kit" media={<div className="flex h-24 items-end gap-2 bg-cream p-4"><span className="size-8 rounded-full bg-ink" /><span className="size-8 rounded-full bg-sage-ink" /><span className="size-8 rounded-full bg-lime" /></div>}>
              Colours, fonts and voice used in every post and email.
            </ContentCard>
          </CardGrid>
        </Stage>
        <Spec items={[["Padding", "--card-p (20 / 14 compact)"], ["Radius", "--radius-card (5px)"], ["Title", "heading-card (Reckless 17)"]]} />
      </Specimen>

      <Specimen title="KPI card" description="One number, its change and a short trend. Reuses the Signal Kpi.">
        <Stage>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi icon={<Users />} value="1,284" label="New leads" delta="↑ 12.4%" good values={[12, 18, 15, 22, 19, 26, 31]} />
            <Kpi icon={<CalendarCheck />} value="86" label="Calls booked" delta="↑ 5.6%" good values={[6, 8, 7, 9, 11, 10, 12]} />
            <Kpi icon={<CircleDollarSign />} value="$4.20" label="Cost per lead" delta="↑ 3.2%" good={false} values={[3.6, 3.8, 3.7, 4.0, 3.9, 4.1, 4.2]} />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Summary card">
        <Stage>
          <div className="max-w-xl">
            <SummaryCard
              title="This week"
              sub="Mon 12 – Sun 18 Oct"
              items={[
                { label: "Posts published", value: "14", note: "2 waiting" },
                { label: "Emails sent", value: "1,920" },
                { label: "Replies", value: "47", note: "↑ 9 vs last week" },
              ]}
              progress={{ label: "Monthly lead goal", value: 0.68 }}
              footer={<Button variant="link" size="sm">See full report</Button>}
            />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Activity card">
        <Stage>
          <div className="max-w-md">
            <ActivityCard
              action={<Button variant="ghost" size="sm">View all</Button>}
              items={[
                { id: "a1", who: "Autopilot", what: "published “Weekend brunch is back”", when: "10 min ago", icon: <Sparkles /> },
                { id: "a2", who: "Dana Ruiz", what: "replied to your cold email", when: "32 min ago" },
                { id: "a3", who: "Maya Rahman", what: "approved 3 posts", when: "1 hr ago" },
                { id: "a4", who: "Google Ads", what: "spent $18.40 of $25 daily budget", when: "2 hr ago", icon: <Target /> },
              ]}
            />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Profile card">
        <Stage>
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <ProfileCard name="Maya Rahman" role="Owner · Tartine Bakery" online meta="Runs approvals and the weekly plan." stats={[{ label: "Approvals", value: "128" }, { label: "Posts", value: "342" }, { label: "Leads", value: "1.2k" }]} actions={<><Button variant="secondary" size="sm">Message</Button><Button size="sm">View profile</Button></>} />
            <ProfileCard name="Dana Ruiz" role="Lead · Ruiz & Co" online={false} meta="Asked about catering for 40. Replied twice." stats={[{ label: "Score", value: "82" }, { label: "Emails", value: "4" }, { label: "Value", value: "$1.8k" }]} actions={<Button variant="secondary" size="sm">Open lead</Button>} />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Project card" description="Whole card is clickable; the title is the link.">
        <Stage>
          <CardGrid min={260}>
            <ProjectCard name="Holiday pre-orders" description="Email + Instagram push for Christmas cake pre-orders." status={{ label: "On track", tone: "green" }} progress={0.64} due="Due 2 Dec" people={["Maya Rahman", "Dana Ruiz", "Priya Shah", "Alex Tomland"]} />
            <ProjectCard name="Google reviews drive" description="Ask recent customers for reviews by SMS." status={{ label: "At risk", tone: "amber" }} progress={0.22} due="Due 28 Oct" people={["Maya Rahman"]} />
          </CardGrid>
        </Stage>
      </Specimen>

      <Specimen title="Task card" description="Tick to complete.">
        <Stage>
          <div className="flex max-w-md flex-col gap-2">
            {tasks.map((t) => (
              <TaskCard key={t.id} {...t} onDoneChange={(done) => setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done } : x)))} />
            ))}
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Pricing card" description="The featured plan gets the ink frame and the lime CTA.">
        <Stage>
          <div className="grid gap-3 md:grid-cols-3">
            <PricingCard name="Free" price="$0" blurb="Try ClimbOS on one workspace." features={["50 credits", "1 workspace", "Weekly plan"]} cta="Current" current />
            <PricingCard name="Starter" price="$15" blurb="For one small business." features={["1,100 credits / month", "Autopilot posts", "Email outreach"]} cta="Choose Starter" />
            <PricingCard name="Pro" price="$40" blurb="Outbound, ads and approvals for a team." features={["3,000 credits / month", "Cold email + calls booked", "Ad drafts", "Team roles"]} cta="Upgrade to Pro" featured />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Integration card">
        <Stage>
          <CardGrid min={220}>
            <IntegrationCard logo={<SocialIcon network="google" size="lg" />} name="Google Business" description="Reviews, posts and calls from your profile." connected={integrations.google} onToggle={() => setIntegrations((s) => ({ ...s, google: !s.google }))} />
            <IntegrationCard logo={<SocialIcon network="instagram" size="lg" />} name="Instagram" description="Publish posts and reels, read DMs." connected={integrations.instagram} onToggle={() => setIntegrations((s) => ({ ...s, instagram: !s.instagram }))} />
            <IntegrationCard logo={<Mail className="size-5" aria-hidden />} name="Gmail" description="Send outreach from your own inbox." connected={integrations.email} onToggle={() => setIntegrations((s) => ({ ...s, email: !s.email }))} meta="hello@tartine.co" />
          </CardGrid>
        </Stage>
      </Specimen>

      <Specimen title="Feature card">
        <Stage>
          <div className="grid gap-3 md:grid-cols-3">
            <FeatureCard icon={<Wand2 />} title="Posts that sound like you">Autopilot learns your voice from your site and past posts.</FeatureCard>
            <FeatureCard icon={<Send />} title="Outbound on autopilot">Find local businesses, write the email, book the call.</FeatureCard>
            <FeatureCard icon={<Rocket />} title="Plays, not dashboards" tone="cream">Each week you get three moves ranked by expected leads.</FeatureCard>
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Notification card">
        <Stage>
          <div className="flex max-w-md flex-col gap-2">
            {notes.map((n) => (
              <NotificationCard
                key={n.id}
                {...n}
                icon={n.unread ? <Sparkles /> : <Users />}
                action={n.unread ? <Button size="sm" variant="secondary" onClick={() => setNotes((ns) => ns.map((x) => (x.id === n.id ? { ...x, unread: false } : x)))}>Review posts</Button> : null}
                onDismiss={() => setNotes((ns) => ns.filter((x) => x.id !== n.id))}
              />
            ))}
            {notes.length === 0 ? (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setNotes([{ id: "n1", title: "3 posts need approval", body: "Autopilot drafted this week's posts. Approve to schedule them.", time: "2 min ago", unread: true }])}>
                <RefreshCw /> Reset demo
              </Button>
            ) : null}
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Status card">
        <Stage>
          <CardGrid min={240}>
            <StatusCard name="Instagram publishing" state="operational" checked="1 min ago" history={HISTORY(3)} />
            <StatusCard name="Gmail sending" state="degraded" checked="4 min ago" history={HISTORY(11)} />
            <StatusCard name="Meta Ads sync" state="paused" checked="1 hr ago" history={HISTORY(5)} />
          </CardGrid>
        </Stage>
      </Specimen>

      <Specimen title="Empty-state card">
        <Stage>
          <div className="max-w-md">
            <EmptyStateCard icon={<Inbox />} title="No replies yet" body="When a lead replies to outreach, it shows up here." action={<Button size="sm"><Plus /> Start outreach</Button>} />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Expandable card">
        <Stage>
          <div className="flex max-w-xl flex-col gap-2">
            <ExpandableCard title="Why this play?" summary="Expected 12–18 leads this week" defaultOpen>
              Searches for “brunch near me” rose 24% in your area. Competitors posted less this month, and your brunch posts get 2× the saves.
            </ExpandableCard>
            <ExpandableCard title="What it will cost" summary="About 140 credits">
              Three posts (45 credits), one local ad draft (60 credits) and an email to 214 regulars (35 credits).
            </ExpandableCard>
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Selectable card" description="Real checkboxes (or radios with multiple={false}) under card visuals.">
        <Stage>
          <SelectableCards
            legend="Channels for this campaign"
            value={channels}
            onChange={setChannels}
            options={[
              { value: "email", title: "Email", description: "Your list and cold outreach", icon: <Mail /> },
              { value: "social", title: "Social posts", description: "Instagram, Facebook, LinkedIn", icon: <Megaphone /> },
              { value: "ads", title: "Ads", description: "Google and Meta drafts", icon: <Target /> },
            ]}
          />
        </Stage>
      </Specimen>

      <Specimen title="Draggable card" description="Drag the handle, or focus it and press ↑ / ↓.">
        <Stage>
          <div className="max-w-md">
            <DraggableCardList label="Play priority" items={order} onReorder={setOrder} />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Card grid" description="auto-fill tracks with a minimum width; one column on phones.">
        <Stage>
          <CardGrid min={180}>
            {[
              { icon: <Users />, t: "Customers", v: "2,418" },
              { icon: <MessageCircle />, t: "Conversations", v: "312" },
              { icon: <MousePointerClick />, t: "Site clicks", v: "9,870" },
              { icon: <Zap />, t: "Credits left", v: "1,640" },
              { icon: <FileText />, t: "Drafts", v: "7" },
            ].map((c) => (
              <div key={c.t} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
                <span aria-hidden className="grid size-8 place-items-center rounded-[var(--radius-control)] bg-surface-2 text-ink-2 [&_svg]:size-4">{c.icon}</span>
                <span>
                  <span className="block text-lg font-semibold tabular-nums">{c.v}</span>
                  <span className="block text-xs text-ink-3">{c.t}</span>
                </span>
              </div>
            ))}
          </CardGrid>
        </Stage>
        <Spec items={[["Columns", "repeat(auto-fill, minmax(min(<min>px, 100%), 1fr))"], ["Gap", "12px"]]} />
      </Specimen>

      <Specimen title="Card carousel" description="Scroll-snap; swipe on touch, buttons on desktop.">
        <Stage>
          <CardCarousel label="Suggested plays">
            {[
              ["Brunch promo", "3 posts + local ad", "High"],
              ["Review drive", "SMS to 58 customers", "Medium"],
              ["Catering outreach", "Cold email to 40 offices", "High"],
              ["Holiday pre-orders", "Email + Instagram", "Medium"],
              ["Loyalty reminder", "Email to regulars", "Low"],
            ].map(([t, m, p]) => (
              <ContentCard key={t} eyebrow={`${p} impact`} title={t} action={<Button size="sm" variant="secondary">Preview</Button>}>
                {m}
              </ContentCard>
            ))}
          </CardCarousel>
        </Stage>
      </Specimen>

      <Specimen title="Card with header and footer">
        <Stage>
          <div className="max-w-xl">
            <FramedCard
              title="Autopilot settings"
              description="What ClimbOS may do without asking"
              actions={<IconButton aria-label="Edit settings" icon={<Pencil />} size="sm" />}
              footer={<><Button variant="ghost" size="sm">Cancel</Button><Button size="sm">Save</Button></>}
            >
              <Switch label="Publish approved posts" description="Posts go out at the best time for your audience." checked={autopilot} onCheckedChange={setAutopilot} />
            </FramedCard>
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Bordered container" description="Hairline frame for grouping inside a white panel.">
        <Stage tone="white">
          <Container variant="bordered" className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-ui"><span className="font-medium">Sending domain</span> · mail.tartine.co</span>
            <Badge tone="green">Verified</Badge>
          </Container>
          <Container variant="inset" className="mt-3 text-ui text-ink-2">Inset well: tinted, no border. For read-only blocks and previews.</Container>
        </Stage>
      </Specimen>

      <Specimen title="Elevated container" description="Floats over the ground: menus, popovers, focus areas.">
        <Stage>
          <Container variant="elevated" className="max-w-sm">
            <p className="heading-card">Quick add</p>
            <p className="mt-1 text-ui text-ink-2">Create a post, an email or a lead.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm"><Plus /> Post</Button>
              <Button size="sm" variant="secondary">Email</Button>
            </div>
          </Container>
        </Stage>
        <Spec items={[["Shadow", "--shadow-lg"], ["Border", "none"]]} />
      </Specimen>

      <Specimen title="Collapsible section">
        <Stage tone="white">
          <div className="flex flex-col gap-5">
            <CollapsibleSection title="Waiting for approval" count={3} actions={<Button size="sm" variant="ghost">Approve all</Button>}>
              <ul className="flex flex-col gap-1.5 text-ui text-ink-2">
                <li>“Weekend brunch is back” · Instagram</li>
                <li>“Meet our new baker” · Facebook</li>
                <li>“Catering for your next meeting” · Email</li>
              </ul>
            </CollapsibleSection>
            <CollapsibleSection title="Scheduled" count={5} defaultOpen={false}>
              <p className="text-ui text-ink-2">Five posts scheduled between Tue and Sun.</p>
            </CollapsibleSection>
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Accordion" description="↑ ↓ Home End move between headers. One open at a time by default.">
        <Stage>
          <div className="max-w-2xl">
            <Accordion
              defaultOpen={["credits"]}
              items={[
                { id: "credits", title: "How do credits work?", content: "1 credit is about 1 cent of AI and sending cost. A post is around 15 credits; an email to 100 people about 20." },
                { id: "approve", title: "Does anything go out without me?", content: "Only if you turn on autopilot for that channel. Otherwise every post, email and ad waits for approval." },
                { id: "cancel", title: "Can I cancel any time?", content: "Yes. Your plan runs to the end of the billing period, and unused top-up credits stay on your account." },
              ]}
            />
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Panel" description="Signal Panel for dashboard blocks; inspector panel for side details.">
        <Stage>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Panel title="Leads by source" sub="Last 30 days" actions={<Button size="sm" variant="secondary">Export</Button>}>
              <ul className="mt-4 flex flex-col gap-2 text-ui">
                {[["Google Business", 42], ["Cold email", 31], ["Instagram", 18], ["Referral", 9]].map(([s, v]) => (
                  <li key={s} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-ink-2">{s}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2"><span className="block h-full bg-brand-700" style={{ width: `${v}%` }} /></span>
                    <span className="w-10 text-right tabular-nums">{v}%</span>
                  </li>
                ))}
              </ul>
            </Panel>
            {panelOpen ? (
              <InspectorPanel title="Dana Ruiz" sub="Lead · Ruiz & Co" onClose={() => setPanelOpen(false)} footer={<><Button size="sm" variant="ghost">Archive</Button><Button size="sm">Reply</Button></>}>
                <PanelSection title="Contact">
                  <p className="text-ui">dana@ruizco.com</p>
                  <p className="text-ui text-ink-2">+1 (201) 555-0134</p>
                </PanelSection>
                <PanelSection title="Source">
                  <p className="flex items-center gap-2 text-ui"><Globe aria-hidden className="size-4 text-ink-3" /> Cold email · Catering</p>
                </PanelSection>
                <PanelSection title="Next step">
                  <p className="text-ui text-ink-2">Send the 40-person quote by Friday.</p>
                </PanelSection>
              </InspectorPanel>
            ) : (
              <Button variant="secondary" size="sm" className="self-start" onClick={() => setPanelOpen(true)}>Open inspector</Button>
            )}
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Resizable panel" description="Drag the divider, or focus it and use ← → (Shift for 10%), Home, End, Enter.">
        <Stage>
          <ResizablePanels
            label="Resize preview"
            defaultSize={38}
            first={
              <div className="flex flex-col gap-2 p-4">
                <p className="text-overline">Draft</p>
                <p className="text-ui text-ink-2">Weekend brunch is back. Sourdough waffles, seasonal jam and a flat white for $14, Saturdays 9–1.</p>
              </div>
            }
            second={
              <div className="flex h-full flex-col gap-2 bg-surface-2 p-4">
                <p className="text-overline">Preview</p>
                <div className="rounded-[var(--radius-card)] border border-line bg-surface p-3 text-ui">
                  <p className="font-medium">tartinebakery</p>
                  <div className="my-2 h-24 rounded-[3px] bg-cream" />
                  <p className="text-ink-2">Weekend brunch is back. Sourdough waffles, seasonal jam…</p>
                </div>
              </div>
            }
          />
        </Stage>
      </Specimen>

      <Specimen title="Split-view container" description="List and detail side by side; one at a time on phones.">
        <Stage>
          <SplitView
            listLabel="Conversations"
            items={MESSAGES}
            selected={msg}
            onSelect={setMsg}
            renderDetail={(id) => {
              const m = MESSAGES.find((x) => x.id === id)!;
              return (
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="heading-card">{m.title}</h3>
                    <span className="text-xs text-ink-3">{m.meta}</span>
                  </div>
                  <p className="text-ui font-medium">{m.sub}</p>
                  <p className="text-sm text-ink-2">{m.body}</p>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm"><Send /> Reply</Button>
                    <Button size="sm" variant="secondary"><Sparkles /> Draft with AI</Button>
                  </div>
                </div>
              );
            }}
          />
        </Stage>
      </Specimen>
    </DocPage>
  );
}
