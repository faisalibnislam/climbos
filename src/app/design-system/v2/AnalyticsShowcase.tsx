"use client";

import { useState } from "react";
import { Button, Segmented } from "@/components/ui";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Globe,
  MessageCircle,
  Send,
  Sparkles,
  Target,
  Users,
  Zap,
} from "@/components/icons";
import {
  BigNumber,
  BubbleTimeline,
  CalendarHeat,
  ChartCard,
  ClimbRoute,
  DotBars,
  DotForecast,
  DotGlobe,
  FlowNetwork,
  GoalStaircase,
  PolarRose,
  SegmentStrip,
  StripPlot,
  TargetCapsules,
  TickGauge,
  TickMeter,
} from "@/components/analytics";

/* Demo data, deterministic so the page renders the same on server and client. */
const seeded = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const weekly = (base: number, i: number) =>
  Math.round(base * (0.55 + 0.45 * seeded(i)) + i * base * 0.04);

function SuggestedActions() {
  const items = [
    {
      I: BarChart3,
      t: "Track the four numbers that matter",
      tone: "bg-brand-100 text-brand-800",
    },
    {
      I: Target,
      t: "Close the gap: add a second outreach play",
      tone: "bg-lime/50 text-ink",
    },
    { I: Users, t: "Find 40 more event planners", tone: "bg-cream text-ink" },
    {
      I: MessageCircle,
      t: "Reply to 6 warm leads today",
      tone: "bg-surface-2 text-ink",
    },
    {
      I: Zap,
      t: "Alert me when reply rate drops",
      tone: "bg-orange-100 text-orange-800",
    },
  ];
  return (
    <ChartCard
      title={
        <span className="flex items-center gap-2">
          <Zap className="size-5" /> Suggested actions
        </span>
      }
      tone="cream"
    >
      <ul className="flex flex-col gap-2">
        {items.map(({ I, t, tone }) => (
          <li
            key={t}
            className="flex items-center gap-3 rounded-[var(--radius-control)] bg-surface px-3 py-2.5 text-sm"
          >
            <span
              className={`grid size-7 place-items-center rounded-[var(--radius-control)] ${tone}`}
            >
              <I className="size-4" />
            </span>
            {t}
            <ArrowRight className="ml-auto size-4 text-ink-3" />
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

export function AnalyticsShowcase() {
  const [range, setRange] = useState("30d");
  const [day, setDay] = useState<[number, number]>([8, 9]);
  const periods = Array.from({ length: 28 }, (_, i) => `Oct ${i + 1}`);
  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: the one ink hero + goal capsules */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCard
          tone="ink"
          title="Route to your goal"
          sub="50 paying customers by Dec 31 · each camp is a play"
          actions={
            <Segmented
              label="Route range"
              value={range}
              onChange={setRange}
              options={["30d", "90d", "All"].map((v) => ({
                value: v,
                label: v,
              }))}
            />
          }
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <BigNumber value="62%" delta="↑ 8 pts" onInk hero />
            <p className="max-w-56 text-xs text-white/70">
              of the route covered. At this pace you reach the summit on Dec 18.
            </p>
          </div>
          <ClimbRoute
            goal="50 paying customers"
            progress={0.62}
            milestones={[
              {
                label: "Start",
                at: 0.02,
                kind: "start",
                detail: "Oct 1 · 20 customers",
              },
              {
                label: "Event planners outreach",
                at: 0.28,
                kind: "camp",
                detail: "Play 1 · 11 customers",
              },
              {
                label: "Reply rate dipped",
                at: 0.44,
                kind: "risk",
                detail: "Week 3 · 1.1% (target 2%)",
              },
              { label: "Today", at: 0.62, kind: "now", detail: "31 customers" },
              {
                label: "Wedding fairs",
                at: 0.78,
                kind: "camp",
                detail: "Play 2 · starts Nov 12",
              },
              {
                label: "Holiday rush",
                at: 0.88,
                kind: "risk",
                detail: "Capacity: 40 orders/week",
              },
              {
                label: "50 customers",
                at: 1,
                kind: "goal",
                detail: "Goal · Dec 31",
              },
            ]}
          />
        </ChartCard>
        <div className="grid gap-3">
          <ChartCard title="Relative performance" sub="Paying customers">
            <TargetCapsules past={24} current={31} target={50} />
          </ChartCard>
          <ChartCard title="Reply rate" sub="Cold email, last 4 weeks">
            <TickMeter
              value={0.62}
              label="Toward the 2% target"
              level="Healthy"
            />
          </ChartCard>
        </div>
      </div>

      {/* Row 2: dot KPIs */}
      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            t: "Leads this week",
            v: "184",
            d: "↑ 7.1%",
            g: true,
            tone: "ink" as const,
          },
          {
            t: "Replies",
            v: "23",
            d: "↑ 4.0%",
            g: true,
            tone: "sage" as const,
          },
          {
            t: "Unanswered",
            v: "6",
            d: "↓ 5.1%",
            g: false,
            tone: "lime" as const,
          },
        ].map((k, idx) => (
          <ChartCard key={k.t} title={k.t}>
            <div className="flex items-end justify-between gap-3">
              <BigNumber value={k.v} delta={k.d} good={k.g} />
              <DotBars
                label={k.t}
                tone={k.tone}
                values={Array.from({ length: 14 }, (_, i) =>
                  weekly(10, i + idx * 20),
                )}
              />
            </div>
          </ChartCard>
        ))}
      </div>

      {/* Row 3: forecast + bubble timeline */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title="Lead forecast"
          sub="Leads by play · solid to today, faint dots projected"
          actions={
            <span className="rounded-[var(--radius-badge)] bg-brand-100 px-2 py-1 text-xs text-brand-800">
              Target achieved 91%
            </span>
          }
        >
          <BigNumber value="412" delta="↑ 16% projected" />
          <DotForecast
            periods={periods}
            todayIndex={17}
            unitPerDot={2}
            projectionLabel="+16% growth projected"
            projected={Array.from({ length: 10 }, (_, i) => 52 + i * 2.2)}
            series={[
              {
                label: "Cold email",
                dot: "bg-chart-1",
                values: periods.map((_, i) => weekly(9, i)),
              },
              {
                label: "Instagram",
                dot: "bg-chart-3",
                values: periods.map((_, i) => weekly(6, i + 40)),
              },
              {
                label: "Referrals",
                dot: "bg-chart-4",
                values: periods.map((_, i) => weekly(4, i + 80)),
              },
            ]}
          />
        </ChartCard>
        <ChartCard title="Customers over time" sub="Paying customers">
          <div className="flex flex-1 items-center">
            <BubbleTimeline
              items={[
                { label: "60 days", value: 18 },
                { label: "30 days", value: 24 },
                { label: "Now", value: 31, note: "+7", highlight: true },
                { label: "Target", value: 50 },
              ]}
            />
          </div>
        </ChartCard>
      </div>

      {/* Row 4: staircase + gauge + actions */}
      <div className="grid gap-3 lg:grid-cols-3">
        <ChartCard title="Weekly bookings" sub="Toward 12 a week">
          <BigNumber value="9" unit="this week" delta="3 to goal" />
          <GoalStaircase
            values={[3, 4, 4, 5, 6, 6, 7, 8, 9, 10, 11, 12]}
            goal={12}
            currentIndex={8}
            labels={Array.from({ length: 12 }, (_, i) => `Week ${i + 1}`)}
          />
        </ChartCard>
        <ChartCard title="Plan quality" sub="ClimbOS checks passed">
          <TickGauge
            value={75}
            caption="Good. Add your margin to pass the economics check."
          />
        </ChartCard>
        <SuggestedActions />
      </div>

      {/* Row 5: calendar + rose */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <ChartCard
          title="Best days to send"
          sub="Reply rate by day, last 12 months"
          actions={<CalendarDays className="size-4 text-ink-3" />}
        >
          <CalendarHeat
            label="Reply rate by day"
            selected={day}
            onSelect={(m, d) => setDay([m, d])}
            value={(m, d) => {
              const weekday = (m * 31 + d) % 7;
              return Math.min(
                0.999,
                (weekday >= 1 && weekday <= 3 ? 0.55 : 0.2) +
                  0.45 * seeded(m * 40 + d),
              );
            }}
          />
        </ChartCard>
        <ChartCard title="Play score" sub="Event planners outreach · 8 factors">
          <PolarRose
            label="Play score"
            factors={[
              { label: "Fit", value: 4.6 },
              { label: "Predictable", value: 4.1 },
              { label: "Leverage", value: 3.2 },
              { label: "Speed", value: 3.8 },
              { label: "Compounds", value: 2.4 },
              { label: "Cost", value: 4.4 },
              { label: "Risk", value: 4.8 },
              { label: "Unique", value: 2.9 },
            ]}
          />
        </ChartCard>
      </div>

      {/* Row 6: strip plot + segments */}
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title="Follow-ups by days left"
          sub="Each dot is a lead waiting on you"
          actions={
            <Button variant="secondary" size="sm">
              Follow up all
            </Button>
          }
        >
          <StripPlot
            maxDays={60}
            buckets={[2, 7, 21, 40]}
            items={Array.from({ length: 34 }, (_, i) => {
              const days = Math.round(seeded(i + 7) * 58);
              return {
                label: `Lead ${i + 1}`,
                days,
                tone: days < 2 ? "overdue" : days < 21 ? "soon" : "later",
                detail:
                  days < 2 ? "Reply waiting 3 days" : "Follow-up scheduled",
              } as const;
            })}
          />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-control)] border border-line bg-line sm:grid-cols-4">
            {[
              ["5", "Overdue", "2 added today"],
              ["14", "Due in 7 days", "Mostly cold email"],
              ["9", "Due in 21 days", "No risk"],
              ["6", "Later", "Nurture"],
            ].map(([n, t, s], i) => (
              <div
                key={t}
                className={i === 0 ? "bg-red-100 p-3" : "bg-surface p-3"}
              >
                <p className="text-2xl font-semibold tabular-nums">{n}</p>
                <p className="text-sm">{t}</p>
                <p className="text-xs text-ink-3">{s}</p>
              </div>
            ))}
          </div>
        </ChartCard>
        <ChartCard
          title="Lead quality mix"
          sub="This week's 184 leads, in arrival order"
        >
          <SegmentStrip
            label="Lead quality"
            start="Mon"
            end="Sun"
            states={[
              { label: "Qualified", className: "bg-brand-800", total: "64" },
              { label: "Maybe", className: "bg-brand-200", total: "92" },
              { label: "Not a fit", className: "bg-surface-3", total: "28" },
            ]}
            segments={Array.from({ length: 26 }, (_, i) => ({
              size: 1 + Math.round(seeded(i + 3) * 4),
              state: seeded(i + 11) > 0.62 ? 0 : seeded(i + 19) > 0.25 ? 1 : 2,
            }))}
          />
        </ChartCard>
      </div>

      {/* Row 7: map + flow */}
      <div className="grid gap-3 xl:grid-cols-2">
        <ChartCard
          title="Where leads come from"
          sub="Last 30 days"
          actions={<Globe className="size-4 text-ink-3" />}
        >
          <DotGlobe
            unit="leads"
            home={{ label: "San Francisco", lon: -122.4, lat: 37.8, value: 64 }}
            stats={[["172", "Leads"], ["12.1%", "Growth / mo"], ["46%", "From the US"]]}
            places={[
              { label: "San Francisco", lon: -122.4, lat: 37.8, value: 64 },
              { label: "New York", lon: -74, lat: 40.7, value: 41 },
              { label: "London", lon: -0.1, lat: 51.5, value: 28 },
              { label: "Lisbon", lon: -9.1, lat: 38.7, value: 9 },
              { label: "Dubai", lon: 55.3, lat: 25.2, value: 12 },
              { label: "Sydney", lon: 151.2, lat: -33.9, value: 7 },
              { label: "São Paulo", lon: -46.6, lat: -23.5, value: 11 },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="How a lead moves"
          sub="This week · counts at each stage"
          actions={<Send className="size-4 text-ink-3" />}
        >
          <FlowNetwork
            height={320}
            nodes={[
              {
                id: "find",
                label: "Find",
                count: 320,
                x: 12,
                y: 72,
                tone: "cream",
              },
              {
                id: "draft",
                label: "Draft",
                count: 290,
                x: 28,
                y: 28,
                tone: "white",
              },
              {
                id: "approve",
                label: "Approve",
                count: 260,
                x: 50,
                y: 60,
                tone: "sage",
              },
              {
                id: "send",
                label: "Send",
                count: 254,
                x: 62,
                y: 18,
                tone: "white",
              },
              {
                id: "reply",
                label: "Reply",
                count: 23,
                x: 84,
                y: 40,
                tone: "lime",
              },
              {
                id: "book",
                label: "Book",
                count: 9,
                x: 78,
                y: 82,
                tone: "ink",
              },
            ]}
            edges={[
              ["find", "draft"],
              ["draft", "approve"],
              ["approve", "send"],
              ["send", "reply"],
              ["reply", "book"],
              ["find", "approve"],
            ]}
          />
        </ChartCard>
      </div>
      <p className="flex items-center gap-2 text-xs text-ink-3">
        <Sparkles className="size-3.5" /> All demo data. Every chart has a
        hidden data table, keyboard focus and hover details; motion is off with
        reduced motion.
      </p>
    </div>
  );
}
