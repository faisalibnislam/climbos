"use client";

import { useRef, useState } from "react";
import { RefreshCw } from "@/components/icons";
import { AreaChart, Button, DonutChart, FunnelChart, ProgressRing } from "@/components/ui";
import {
  CalendarHeat,
  ChartCard,
  ComparisonColumns,
  DotForecast,
  DotMap,
  GoalStaircase,
  TargetCapsules,
  TickGauge,
  TrendBars,
} from "@/components/analytics";
import {
  BubbleChart,
  CHART,
  ChartBrush,
  ChartDateSelector,
  ChartExportAction,
  ChartLegend,
  ChartMetricSelector,
  ChartZoomControls,
  CohortChart,
  ComparisonChart,
  Heatmap,
  Histogram,
  HorizontalBarChart,
  KpiCounter,
  MultiLineChart,
  RadarChart,
  RealtimeChart,
  RetentionChart,
  SankeyDiagram,
  ScatterPlot,
  SrTable,
  StackedBarChart,
  TooltipCard,
  Treemap,
  TrendIndicator,
  WaterfallChart,
  daysBetween,
  presetRange,
  useHiddenSeries,
  type DateRangeValue,
  type ZoomRange,
} from "@/components/ds/charts";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

/* ---------------- Deterministic sample data (same on server and client) ---------------- */

const seeded = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const TODAY = "2026-10-19";
const DAY = 86_400_000;
const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const md = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const mon = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

const DAYS14 = Array.from({ length: 14 }, (_, i) => `Oct ${6 + i}`);
const LEADS14 = DAYS14.map((_, i) => Math.round(16 + 10 * seeded(i + 1) + i * 0.9));
const PREV14 = DAYS14.map((_, i) => Math.round(14 + 9 * seeded(i + 40)));

const WEEKS8 = ["Aug 24", "Aug 31", "Sep 7", "Sep 14", "Sep 21", "Sep 28", "Oct 5", "Oct 12"];
const bySource = (base: number, k: number) => WEEKS8.map((_, i) => Math.round(base * (0.7 + 0.5 * seeded(i * 7 + k)) + i * base * 0.05));
const STACK = [
  { key: "email", label: "Email outreach", values: bySource(22, 1), color: CHART.sage },
  { key: "linkedin", label: "LinkedIn", values: bySource(14, 2), color: CHART.slate },
  { key: "web", label: "Website", values: bySource(10, 3), color: CHART.clay },
  { key: "ref", label: "Referrals", values: bySource(5, 4), color: CHART.ochre },
];

const CHANNELS = [
  { label: "Email outreach", value: 412, previous: 350, meta: "3 plays" },
  { label: "LinkedIn DMs", value: 268, previous: 290, meta: "2 plays" },
  { label: "Website forms", value: 184, previous: 142 },
  { label: "Google reviews", value: 96, previous: 88 },
  { label: "Referrals", value: 61, previous: 40 },
];

const MONTHS12 = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const VISITS = MONTHS12.map((_, i) => Math.round(2400 + i * 260 + 600 * seeded(i + 9)));
const VISITS_PREV = MONTHS12.map((_, i) => Math.round(2100 + i * 120 + 500 * seeded(i + 60)));

const CREDITS = [
  { label: "Outreach plays", value: 820, color: CHART.sage },
  { label: "Social posts", value: 490, color: CHART.slate },
  { label: "Lead search", value: 270, color: CHART.clay },
  { label: "Ads drafts", value: 230, color: CHART.ochre },
];

const GROUPS3 = [
  { key: "email", label: "Email" },
  { key: "social", label: "Social" },
  { key: "ads", label: "Ads" },
];
const CAMPAIGNS = Array.from({ length: 18 }, (_, i) => {
  const g = GROUPS3[i % 3];
  const spend = Math.round(60 + 440 * seeded(i + 100));
  const lift = g.key === "email" ? 0.11 : g.key === "social" ? 0.07 : 0.05;
  return { label: `${g.label} campaign ${Math.floor(i / 3) + 1}`, x: spend, y: Math.round(spend * lift * (0.6 + 0.8 * seeded(i + 200)) + 2), group: g.key };
});

const BUBBLES = [
  { label: "Email outreach", x: 4.2, y: 8.5, size: 860, group: "outreach" },
  { label: "LinkedIn DMs", x: 6.8, y: 12.1, size: 320, group: "outreach" },
  { label: "Google ads", x: 18.5, y: 3.2, size: 540, group: "paid" },
  { label: "Meta ads", x: 14, y: 2.4, size: 410, group: "paid" },
  { label: "Referrals", x: 1.5, y: 22, size: 60, group: "owned" },
  { label: "Instagram", x: 9, y: 5.5, size: 280, group: "owned" },
  { label: "Website chat", x: 2.8, y: 15, size: 140, group: "owned" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, h) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`));
const HEAT = WEEKDAYS.map((_, d) =>
  HOURS.map((_, h) => {
    const base = h < 7 || h > 21 ? 0.4 : 3 + 10 * Math.exp(-((h - 10) ** 2) / 6) + 7 * Math.exp(-((h - 15) ** 2) / 5);
    const day = d < 5 ? 1 : d === 5 ? 0.45 : 0.3;
    return Math.round(base * day + 3 * seeded(d * 24 + h));
  }),
);

const COHORT_WEEKS = ["Sep 7", "Sep 14", "Sep 21", "Sep 28", "Oct 5", "Oct 12"];
const COHORTS = COHORT_WEEKS.map((label, c) => ({
  label,
  size: Math.round(120 + 80 * seeded(c + 300)),
  values: Array.from({ length: 7 }, (_, p) => (p >= 7 - c ? null : p === 0 ? 100 : Math.round(100 * (0.52 + 0.02 * c + 0.04 * seeded(c * 9 + p)) * 0.88 ** (p - 1)))),
}));
const PERIODS7 = Array.from({ length: 7 }, (_, i) => `W${i}`);

const PERIODS12 = Array.from({ length: 12 }, (_, i) => `W${i}`);
const RET = [
  { label: "July", base: 0.5, len: 12 },
  { label: "August", base: 0.54, len: 10 },
  { label: "September", base: 0.58, len: 6 },
  { label: "October", base: 0.63, len: 3 },
].map((c, ci) => ({ label: c.label, values: PERIODS12.map((_, p) => (p >= c.len ? null : p === 0 ? 100 : Math.round(100 * c.base * 0.9 ** (p - 1) + 3 * seeded(ci * 20 + p)))) }));
const RET_AVG = PERIODS12.map((_, p) => {
  const vals = RET.map((c) => c.values[p]).filter((v): v is number => v !== null);
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
});

const WATERFALL = [
  { label: "Opening", value: 1100, kind: "start" as const },
  { label: "Top-up", value: 700, kind: "delta" as const },
  { label: "Outreach", value: -420, kind: "delta" as const },
  { label: "Posts", value: -260, kind: "delta" as const },
  { label: "Lead search", value: -180, kind: "delta" as const },
  { label: "Refund", value: 40, kind: "delta" as const },
  { label: "Closing", value: 0, kind: "total" as const },
];

const RADAR_AXES = ["Website", "Search", "Social", "Reviews", "Outreach", "Ads"];
const RADAR = [
  { key: "you", label: "Your business", values: [72, 48, 81, 66, 58, 35], color: CHART.sage },
  { key: "peers", label: "Similar businesses", values: [60, 55, 62, 58, 45, 50], color: CHART.previous, dashed: true },
];

const TREE_GROUPS = [
  { key: "outreach", label: "Outreach", color: CHART.sage },
  { key: "social", label: "Social", color: CHART.slate },
  { key: "research", label: "Research", color: CHART.clay },
  { key: "ads", label: "Ads", color: CHART.ochre },
];
const TREE = [
  { label: "Cold email: planners", value: 420, group: "outreach" },
  { label: "LinkedIn DMs", value: 260, group: "outreach" },
  { label: "Instagram posts", value: 220, group: "social" },
  { label: "Lead search: venues", value: 200, group: "research" },
  { label: "LinkedIn posts", value: 180, group: "social" },
  { label: "Google ads test", value: 150, group: "ads" },
  { label: "Follow-up sequence", value: 140, group: "outreach" },
  { label: "Reels drafts", value: 90, group: "social" },
  { label: "Meta ads draft", value: 80, group: "ads" },
  { label: "Competitor scan", value: 70, group: "research" },
  { label: "Review replies", value: 60, group: "social" },
];

const SANKEY_NODES = [
  { id: "web", label: "Website", column: 0, color: CHART.sage },
  { id: "li", label: "LinkedIn", column: 0, color: CHART.slate },
  { id: "email", label: "Email", column: 0, color: CHART.clay },
  { id: "ref", label: "Referrals", column: 0, color: CHART.ochre },
  { id: "engaged", label: "Replied", column: 1, color: CHART.ink },
  { id: "dropped", label: "No reply", column: 1, color: CHART.previous },
  { id: "booked", label: "Booked call", column: 2, color: CHART.sage },
  { id: "nurture", label: "Nurture", column: 2, color: CHART.ochre },
  { id: "lost", label: "Lost", column: 2, color: CHART.clay },
];
const SANKEY_LINKS = [
  { source: "web", target: "engaged", value: 120 },
  { source: "web", target: "dropped", value: 180 },
  { source: "li", target: "engaged", value: 90 },
  { source: "li", target: "dropped", value: 60 },
  { source: "email", target: "engaged", value: 140 },
  { source: "email", target: "dropped", value: 210 },
  { source: "ref", target: "engaged", value: 40 },
  { source: "ref", target: "dropped", value: 10 },
  { source: "engaged", target: "booked", value: 110 },
  { source: "engaged", target: "nurture", value: 180 },
  { source: "engaged", target: "lost", value: 100 },
];

const SCORES = Array.from({ length: 240 }, (_, i) => Math.min(99, Math.max(2, Math.round(((seeded(i + 500) + seeded(i + 900) + seeded(i + 1300)) / 3) * 100 + 6))));

const COMPARE = [
  { label: "Planner outreach", current: 18, previous: 12 },
  { label: "Venue follow-up", current: 9, previous: 11 },
  { label: "LinkedIn DMs", current: 14, previous: 10 },
  { label: "Win-back email", current: 22, previous: 24 },
  { label: "Referral ask", current: 31, previous: 19 },
];

const FC_PERIODS = Array.from({ length: 12 }, (_, i) => `Wk ${i + 1}`);
const FC_SERIES = [
  { label: "Outreach", dot: "bg-chart-1", values: FC_PERIODS.slice(0, 7).map((_, i) => Math.round(8 + 6 * seeded(i + 700) + i * 0.6)) },
  { label: "Social", dot: "bg-chart-3", values: FC_PERIODS.slice(0, 7).map((_, i) => Math.round(4 + 4 * seeded(i + 720))) },
  { label: "Referrals", dot: "bg-chart-5", values: FC_PERIODS.slice(0, 7).map((_, i) => Math.round(1 + 3 * seeded(i + 740))) },
];

const GOAL_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GOAL_VALUES = [12, 17, 21, 26, 30, 33, 38, 41, 46, 49, 54, 58];

const PLACES = [
  { label: "Austin", lon: -97.7, lat: 30.3, value: 412 },
  { label: "London", lon: -0.1, lat: 51.5, value: 186 },
  { label: "Toronto", lon: -79.4, lat: 43.7, value: 140 },
  { label: "Sydney", lon: 151.2, lat: -33.9, value: 96 },
  { label: "Berlin", lon: 13.4, lat: 52.5, value: 88 },
  { label: "Dubai", lon: 55.3, lat: 25.2, value: 64 },
  { label: "São Paulo", lon: -46.6, lat: -23.5, value: 52 },
];

const WEEKS12 = Array.from({ length: 12 }, (_, i) => md(utc("2026-07-27") + i * 7 * DAY));
const wave = (base: number, k: number, growth = 0.05) => WEEKS12.map((_, i) => Math.round(base * (0.75 + 0.4 * seeded(i * 3 + k)) + i * base * growth));
const LEGEND_SERIES = [
  { key: "leads", label: "Leads", values: wave(60, 1), color: CHART.sage, area: true },
  { key: "replies", label: "Replies", values: wave(24, 2), color: CHART.slate },
  { key: "booked", label: "Booked calls", values: wave(9, 3, 0.08), color: CHART.clay },
  { key: "prev", label: "Leads, last quarter", values: wave(52, 4, 0.02), color: CHART.previous, dashed: true },
];

const WEEKS16 = Array.from({ length: 16 }, (_, i) => md(utc("2026-06-29") + i * 7 * DAY));
const BOOKED16 = WEEKS16.map((_, i) => Math.round(6 + i * (i > 4 ? 0.9 : 0.25) + 3 * seeded(i + 800) - (i === 9 ? 3 : 0)));

const DAILY90 = Array.from({ length: 90 }, (_, i) => Math.round(120 + 40 * Math.sin(i / 7) + i * 0.8 + 35 * seeded(i + 1000)));
const DAILY90_LABELS = Array.from({ length: 90 }, (_, i) => md(utc(TODAY) - (89 - i) * DAY));

const METRICS = [
  { key: "leads", label: "Leads", base: 30, unit: "" },
  { key: "replies", label: "Replies", base: 9, unit: "" },
  { key: "booked", label: "Booked calls", base: 4, unit: "" },
  { key: "credits", label: "Credits used", base: 120, unit: "" },
].map((m, k) => {
  const cur = DAYS14.map((_, i) => Math.round(m.base * (0.7 + 0.6 * seeded(i + k * 50)) + i * m.base * 0.02));
  const prev = DAYS14.map((_, i) => Math.round(m.base * (0.65 + 0.5 * seeded(i + k * 50 + 25))));
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  return { ...m, cur, prev, total: sum(cur), delta: ((sum(cur) - sum(prev)) / sum(prev)) * 100 };
});

function rangeSeries(v: DateRangeValue) {
  const days = daysBetween(v.from, v.to);
  const start = utc(v.from);
  const bucket = days <= 62 ? 1 : days <= 180 ? 7 : 30;
  const n = Math.ceil(days / bucket);
  const point = (dayIndex: number) => Math.round(bucket * (20 + 8 * Math.sin(dayIndex / 9) + 6 * seeded(dayIndex)));
  const labels: string[] = [];
  const cur: number[] = [];
  const prev: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = start + i * bucket * DAY;
    const di = Math.round(t / DAY);
    labels.push(bucket === 30 ? mon(t) : md(t));
    cur.push(point(di));
    prev.push(Math.round(point(di - days) * 0.88));
  }
  return { labels, cur, prev, unit: bucket === 1 ? "Day" : bucket === 7 ? "Week" : "Month" };
}

/* ---------------- Page ---------------- */

const Card = ChartCard;

export function ChartsContent() {
  const legend = useHiddenSeries();
  const [calSel, setCalSel] = useState<[number, number]>([9, 14]);
  const [round, setRound] = useState(0);
  const [range, setRange] = useState<DateRangeValue>(() => presetRange("30d", TODAY, true));
  const [metric, setMetric] = useState("leads");
  const [zoom, setZoom] = useState<ZoomRange>([60, 90]);
  const radarRef = useRef<SVGSVGElement>(null);

  const rs = rangeSeries(range);
  const m = METRICS.find((x) => x.key === metric) ?? METRICS[0];
  const calValue = (mo: number, d: number) => {
    const t = Date.UTC(2026, mo, d);
    if (t > utc(TODAY)) return 0;
    const wd = new Date(t).getUTCDay();
    return Math.min(0.99, 0.25 + 0.6 * seeded(mo * 31 + d) - (wd === 0 || wd === 6 ? 0.2 : 0));
  };
  const KPIS = [
    { label: "Leads this month", value: round ? 1342 : 1284, delta: round ? "+18%" : "+12%" },
    { label: "Booked calls", value: round ? 71 : 64, delta: round ? "+61%" : "+56%" },
    { label: "Revenue influenced", value: round ? 21250 : 18400, delta: round ? "+9%" : "+4%", money: true },
  ];

  return (
    <DocPage eyebrow="Components" title="Charts & analytics" intro="Flat, calm charts in the Signal palette. Every chart has hover and keyboard tooltips, a hidden data table and a gentle entry.">
      <Specimen title="Bar chart" description="Ghost bars: grey is the previous period, sage this period, ink today.">
        <Stage>
          <Card title="New leads" sub="Last 14 days vs the 14 before">
            <ComparisonColumns values={LEADS14} previous={PREV14} labels={DAYS14} />
          </Card>
        </Stage>
        <Spec items={[["Component", "ComparisonColumns (analytics/compare.tsx)"], ["Compact", "TrendBars for KPI cards"]]} />
      </Specimen>

      <Specimen title="Stacked bar chart" description="Parts of a total per period. Legend items toggle each source.">
        <Stage>
          <Card title="Leads by source" sub="Weekly">
            <StackedBarChart labels={WEEKS8} series={STACK} label="Leads by source per week" categoryLabel="Week" />
          </Card>
        </Stage>
        <Spec items={[["Component", "StackedBarChart (ds/charts/bars.tsx)"], ["Keys", "Arrows read each week; Esc clears"]]} />
      </Specimen>

      <Specimen title="Horizontal bar chart" description="Ranked rows. The grey tick marks last month.">
        <Stage>
          <Card title="Leads by channel" sub="This month">
            <HorizontalBarChart items={CHANNELS} label="Leads by channel" valueLabel="This month" previousLabel="Last month" />
          </Card>
        </Stage>
        <Spec items={[["Component", "HorizontalBarChart"], ["Top row", "Ink; the rest sage"]]} />
      </Specimen>

      <Specimen title="Area chart" description="Trend over time with a flat fill under the main series.">
        <Stage>
          <Card title="Website visits" sub="Last 12 months">
            <AreaChart bare title="Website visits" labels={MONTHS12} categoryLabel="Month" series={[{ key: "visits", label: "This year", values: VISITS, color: CHART.sage }, { key: "prev", label: "Last year", values: VISITS_PREV, color: CHART.previous }]} />
            <ChartLegend items={[{ key: "visits", label: "This year", color: CHART.sage, shape: "line" }, { key: "prev", label: "Last year", color: CHART.previous, shape: "line" }]} />
            <SrTable caption="Website visits by month" columns={["Month", "This year", "Last year"]} rows={MONTHS12.map((l, i) => [l, VISITS[i], VISITS_PREV[i]])} />
          </Card>
        </Stage>
        <Spec items={[["Component", "AreaChart (ui/viz.tsx), bare"], ["Fill", "Flat 8% in Signal (--area-top/bottom)"]]} />
      </Specimen>

      <Specimen title="Donut chart" description="Share of a whole. Hover a slice or a row.">
        <Stage>
          <Card title="Credits by feature" sub="This month">
            <DonutChart bare title="Credits by feature" segments={CREDITS} centerLabel="Credits used" />
            <SrTable caption="Credits by feature" columns={["Feature", "Credits"]} rows={CREDITS.map((c) => [c.label, c.value])} />
          </Card>
        </Stage>
        <Spec items={[["Component", "DonutChart (ui/viz.tsx), bare"], ["Max slices", "5, then group the rest"]]} />
      </Specimen>

      <Specimen title="Scatter plot" description="Two measures per campaign, with a dashed trend line.">
        <Stage>
          <Card title="Spend vs leads" sub="18 campaigns, last 90 days">
            <ScatterPlot points={CAMPAIGNS} groups={GROUPS3} trend label="Campaign spend vs leads" xLabel="Spend" yLabel="Leads" formatX={money} />
          </Card>
        </Stage>
        <Spec items={[["Component", "ScatterPlot (ds/charts/points.tsx)"], ["Keys", "Arrows move left to right"]]} />
      </Specimen>

      <Specimen title="Bubble chart" description="A third measure as bubble area.">
        <Stage>
          <Card title="Channel efficiency" sub="Bubble size is leads">
            <BubbleChart
              points={BUBBLES}
              groups={[{ key: "outreach", label: "Outreach" }, { key: "paid", label: "Paid", color: CHART.clay }, { key: "owned", label: "Owned", color: CHART.slate }]}
              label="Cost per lead vs reply rate by channel"
              xLabel="Cost per lead"
              yLabel="Reply rate"
              sizeLabel="Leads"
              formatX={(n) => `$${n}`}
              formatY={(n) => `${n}%`}
            />
          </Card>
        </Stage>
        <Spec items={[["Component", "BubbleChart"], ["Size", "Area ∝ value (sqrt radius)"]]} />
      </Specimen>

      <Specimen title="Heatmap" description="Two categories against each other, shaded in six sage steps.">
        <Stage>
          <Card title="When people reply" sub="Replies by weekday and hour">
            <Heatmap rows={WEEKDAYS} cols={HOURS} values={HEAT} label="Replies by weekday and hour" unit=" replies" />
          </Card>
        </Stage>
        <Spec items={[["Component", "Heatmap (ds/charts/matrix.tsx)"], ["Keys", "Arrows move cell by cell; up/down change day"]]} />
      </Specimen>

      <Specimen title="Calendar heatmap" description="Activity by day. Click a day to select it.">
        <Stage>
          <Card title="Posting activity" sub={`Selected: ${["Aug", "Sep", "Oct"][calSel[0] - 7]} ${calSel[1]}`}>
            <CalendarHeat months={[7, 8, 9]} value={calValue} selected={calSel} onSelect={(mo, d) => setCalSel([mo, d])} label="Posting activity by day" />
          </Card>
        </Stage>
        <Spec items={[["Component", "CalendarHeat (analytics/calendar.tsx)"], ["Mobile", "Scrolls sideways inside the card"]]} />
      </Specimen>

      <Specimen title="Funnel chart" description="Steps with the share that continues.">
        <Stage>
          <Card title="Outbound funnel" sub="Last 30 days">
            <FunnelChart bare title="Outbound funnel" steps={[{ label: "Prospects found", value: 1240 }, { label: "Contacted", value: 860 }, { label: "Replied", value: 212 }, { label: "Booked call", value: 64 }, { label: "Won", value: 21 }]} />
          </Card>
        </Stage>
        <Spec items={[["Component", "FunnelChart (ui/viz.tsx), bare"]]} />
      </Specimen>

      <Specimen title="Cohort chart" description="Share of each weekly cohort still engaged, week by week.">
        <Stage>
          <Card title="Lead engagement by cohort" sub="% still replying or opening">
            <CohortChart cohorts={COHORTS} periods={PERIODS7} label="Lead engagement by weekly cohort" />
          </Card>
        </Stage>
        <Spec items={[["Component", "CohortChart (ds/charts/matrix.tsx)"], ["Values", "Shown in cells from 420px wide"]]} />
      </Specimen>

      <Specimen title="Retention chart" description="Retention curves per cohort, with the average in ink.">
        <Stage>
          <Card title="Customer retention" sub="% of customers active, by signup month">
            <RetentionChart cohorts={RET} periods={PERIODS12} average={RET_AVG} label="Customer retention by signup month" />
          </Card>
        </Stage>
        <Spec items={[["Component", "RetentionChart (ds/charts/lines.tsx)"], ["Gaps", "Cohorts stop where data ends"]]} />
      </Specimen>

      <Specimen title="Waterfall chart" description="How a balance moved: gains in sage, spend in clay.">
        <Stage>
          <Card title="Credits this month" sub="Opening to closing balance">
            <WaterfallChart steps={WATERFALL} label="Credits this month" />
          </Card>
        </Stage>
        <Spec items={[["Component", "WaterfallChart (ds/charts/bars.tsx)"], ["Steps", "start, delta, total"]]} />
      </Specimen>

      <Specimen title="Radar chart" description="Several scores on one shape, against a grey comparison.">
        <Stage>
          <Card title="Growth health" sub="Score out of 100">
            <RadarChart axes={RADAR_AXES} series={RADAR} label="Growth health by area" />
          </Card>
        </Stage>
        <Spec items={[["Component", "RadarChart (ds/charts/shapes.tsx)"], ["Wedges", "PolarRose (analytics) for a single series"]]} />
      </Specimen>

      <Specimen title="Treemap" description="Squarified tiles: area is credits, colour is play type.">
        <Stage>
          <Card title="Credits by play" sub="This month">
            <Treemap items={TREE} groups={TREE_GROUPS} label="Credits by play" unit=" cr" />
          </Card>
        </Stage>
        <Spec items={[["Component", "Treemap"], ["Labels", "Shown when a tile is big enough; tooltip always"]]} />
      </Specimen>

      <Specimen title="Sankey diagram" description="Where leads come from and where they end up.">
        <Stage>
          <Card title="Lead flow" sub="Last 30 days">
            <SankeyDiagram nodes={SANKEY_NODES} links={SANKEY_LINKS} label="Lead flow from source to outcome" unit=" leads" />
          </Card>
        </Stage>
        <Spec items={[["Component", "SankeyDiagram"], ["Keys", "Arrows read each flow"]]} />
      </Specimen>

      <Specimen title="Histogram" description="Distribution of raw values in equal bins.">
        <Stage>
          <Card title="Lead scores" sub={`${SCORES.length} leads this month`}>
            <Histogram values={SCORES} binSize={10} max={100} threshold={70} thresholdLabel="Hot 70+" label="Lead score distribution" valueLabel="Score" countLabel="Leads" />
          </Card>
        </Stage>
        <Spec items={[["Component", "Histogram"], ["Marks", "Median line, threshold chip"]]} />
      </Specimen>

      <Specimen title="Gauge chart">
        <Stage>
          <Card title="Growth score">
            <TickGauge value={72} label="Growth score" caption="Strong on social; outreach needs a second play." />
          </Card>
        </Stage>
        <Spec items={[["Component", "TickGauge (analytics/goal.tsx)"]]} />
      </Specimen>

      <Specimen title="Progress ring">
        <Stage tone="white">
          <div className="flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-3">
              <ProgressRing value={0.4} label="Setup complete" />
              <span className="text-ui text-ink-2">Setup</span>
            </div>
            <div className="flex items-center gap-3">
              <ProgressRing value={0.72} size={64} label="Monthly goal" color={CHART.ink} />
              <span className="text-ui text-ink-2">Monthly goal</span>
            </div>
            <div className="flex items-center gap-3">
              <ProgressRing value={0.88} size={96} label="Credits used" color={CHART.clay}>
                <span className="text-center text-sm">88%<span className="block text-2xs font-normal text-ink-3">credits</span></span>
              </ProgressRing>
              <span className="text-ui text-ink-2">Credits used</span>
            </div>
          </div>
        </Stage>
        <Spec items={[["Component", "ProgressRing (ui/viz.tsx)"], ["Sizes", "44 / 64 / 96"]]} />
      </Specimen>

      <Specimen title="KPI counter" description="Counts up when it scrolls into view; instant with reduced motion.">
        <Stage tone="white">
          <div className="grid gap-6 sm:grid-cols-3">
            {KPIS.map((k) => (
              <KpiCounter key={k.label} label={k.label} value={k.value} delta={k.delta} format={k.money ? money : undefined} />
            ))}
          </div>
          <Button className="mt-5" variant="secondary" size="sm" onClick={() => setRound((r) => (r ? 0 : 1))}>
            <RefreshCw className="size-4" aria-hidden />
            Refresh numbers
          </Button>
        </Stage>
        <Spec items={[["Component", "KpiCounter (ds/charts/kpi.tsx)"], ["Number", "Hanken semibold, tabular; screen readers get the final value"]]} />
      </Specimen>

      <Specimen title="Trend indicator" description="Arrow and change; colour says good or bad, the word says it too.">
        <Stage tone="white">
          <div className="flex flex-wrap items-center gap-3">
            <TrendIndicator value={12.4} label="vs last month" />
            <TrendIndicator value={-6} label="vs last month" />
            <TrendIndicator value={-8} upIsGood={false} label="cost per lead" />
            <TrendIndicator value={0.2} label="no change" />
            <TrendIndicator value={4.1} size="sm" />
            <TrendIndicator value={-2.5} variant="inline" label="this week" />
          </div>
          <div className="mt-5 flex items-end gap-4">
            <TrendBars values={LEADS14.slice(-8)} previous={PREV14.slice(-8)} label="Leads, last 8 days" />
            <div>
              <p className="text-xs text-ink-3">Leads</p>
              <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums">412 <TrendIndicator value={17.7} size="sm" /></p>
            </div>
          </div>
        </Stage>
        <Spec items={[["Component", "TrendIndicator"], ["Variants", "chip (default), inline; sm, md"], ["upIsGood", "false for costs"]]} />
      </Specimen>

      <Specimen title="Comparison chart" description="This period against the last, per metric.">
        <Stage>
          <Card title="Reply rate by play" sub="October vs September">
            <ComparisonChart items={COMPARE} unit="%" label="Reply rate by play, October vs September" currentLabel="October" previousLabel="September" />
          </Card>
        </Stage>
        <Spec items={[["Component", "ComparisonChart (dumbbell)"], ["Bar colour", "Sage when better, clay when worse"]]} />
      </Specimen>

      <Specimen title="Forecast chart" description="Dots per week by source; faint dots are projected.">
        <Stage>
          <Card title="Leads forecast" sub="One dot = 2 leads">
            <DotForecast series={FC_SERIES} periods={FC_PERIODS} todayIndex={6} projected={[24, 25, 27, 28, 30]} unitPerDot={2} projectionLabel="+134 more" />
          </Card>
        </Stage>
        <Spec items={[["Component", "DotForecast (analytics/dots.tsx)"]]} />
      </Specimen>

      <Specimen title="Goal progress chart">
        <Stage>
          <div className="grid gap-4">
            <Card title="Booked calls to goal" sub="Monthly, goal 55">
              <GoalStaircase values={GOAL_VALUES} goal={55} currentIndex={9} labels={GOAL_MONTHS} />
            </Card>
            <Card title="Where you stand" sub="Monthly leads">
              <TargetCapsules past={220} current={412} target={600} />
            </Card>
          </div>
        </Stage>
        <Spec items={[["Components", "GoalStaircase, TargetCapsules (analytics/goal.tsx)"], ["Hero version", "ClimbRoute on the ink card"]]} />
      </Specimen>

      <Specimen title="Real-time chart" description="A rolling window that updates on an interval. Pause stops it; it starts paused with reduced motion.">
        <Stage>
          <Card title="Right now">
            <RealtimeChart />
          </Card>
        </Stage>
        <Spec items={[["Component", "RealtimeChart (ds/charts/lines.tsx)"], ["Cleanup", "Interval cleared on pause and unmount; skips while the tab is hidden"]]} />
      </Specimen>

      <Specimen title="Geographic map">
        <Stage>
          <Card title="Leads by city" sub="Last 90 days">
            <DotMap places={PLACES} unit="leads" />
          </Card>
        </Stage>
        <Spec items={[["Component", "DotMap (analytics/map-flow.tsx)"], ["3D", "DotGlobe for the hero"]]} />
      </Specimen>

      <Specimen title="Chart legend" description="Click a key to show or hide its series. One series always stays.">
        <Stage>
          <Card title="Pipeline" sub="Weekly">
            <ChartLegend label="Pipeline series" items={LEGEND_SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color, shape: s.dashed ? "dashed" : "line", value: s.values.reduce((t, v) => t + v, 0).toLocaleString("en-US") }))} hidden={legend.hidden} onToggle={legend.toggle} />
            <MultiLineChart labels={WEEKS12} series={LEGEND_SERIES} hidden={legend.hidden} label="Pipeline by week" categoryLabel="Week" />
          </Card>
        </Stage>
        <Spec items={[["Component", "ChartLegend + useHiddenSeries (ds/charts/controls.tsx)"], ["State", "aria-pressed per key"]]} />
      </Specimen>

      <Specimen title="Chart tooltip" description="Title, swatched rows and a short note. Opens on hover and keyboard focus.">
        <Stage>
          <div className="flex flex-wrap items-start gap-4">
            <TooltipCard title="Oct 12" rows={[{ label: "Email outreach", value: "31", color: CHART.sage }, { label: "LinkedIn", value: "18", color: CHART.slate }, { label: "Website", value: "12", color: CHART.clay }]} note="Total 61 leads" />
            <TooltipCard title="Week 6" rows={[{ label: "This month", value: "64", color: CHART.ink, shape: "dot", strong: true }, { label: "Last month", value: "41", color: CHART.previous, shape: "dot" }]} note="+23 vs last month" />
          </div>
          <div className="mt-5 max-w-xl">
            <Card title="Try it" sub="Hover a row, or tab in and use the arrows">
              <HorizontalBarChart items={CHANNELS.slice(0, 3)} label="Leads by channel, top 3" valueLabel="This month" previousLabel="Last month" />
            </Card>
          </div>
        </Stage>
        <Spec items={[["Components", "ChartTooltip (positioned), TooltipCard (static)"], ["Edges", "Stays inside the sides; flips below near the top"]]} />
      </Specimen>

      <Specimen title="Chart annotation" description="Short Reckless notes pinned to points that explain a change.">
        <Stage>
          <Card title="Booked calls" sub="Weekly">
            <div className="pt-6">
              <MultiLineChart
                labels={WEEKS16}
                series={[{ key: "booked", label: "Booked calls", values: BOOKED16, color: CHART.sage, area: true }]}
                notes={[{ index: 5, text: "Referral play on" }, { index: 9, text: "Price test, paused", lift: 58 }]}
                label="Booked calls by week, with notes at weeks 6 and 10"
                categoryLabel="Week"
              />
            </div>
          </Card>
        </Stage>
        <Spec items={[["Component", "ChartAnnotation, or MultiLineChart notes"], ["Type", "text-annotation (Reckless italic 13/18)"]]} />
      </Specimen>

      <Specimen title="Chart date selector" description="Presets, a custom range and compare to the previous period.">
        <Stage>
          <Card title="Visitors" sub={`By ${rs.unit.toLowerCase()}`}>
            <ChartDateSelector value={range} onChange={setRange} today={TODAY} />
            <MultiLineChart
              labels={rs.labels}
              series={[{ key: "cur", label: "This period", values: rs.cur, color: CHART.sage, area: true }, ...(range.compare ? [{ key: "prev", label: "Previous period", values: rs.prev, color: CHART.previous, dashed: true }] : [])]}
              label="Visitors in the selected range"
              categoryLabel={rs.unit}
              animate={false}
            />
          </Card>
        </Stage>
        <Spec items={[["Component", "ChartDateSelector"], ["Dates", "UTC, so server and browser agree"], ["Buckets", "Daily to 62 days, weekly to 180, then monthly"]]} />
      </Specimen>

      <Specimen title="Chart metric selector" description="KPI tabs that switch the chart. Arrow keys move between them.">
        <Stage>
          <ChartCard title="Last 14 days">
            <ChartMetricSelector
              label="Chart metric"
              controls="metric-panel"
              value={metric}
              onChange={setMetric}
              options={METRICS.map((x) => ({ key: x.key, label: x.label, value: x.total.toLocaleString("en-US"), delta: x.delta, upIsGood: x.key !== "credits" }))}
            />
            <div id="metric-panel" role="tabpanel" aria-label={m.label}>
              <MultiLineChart
                labels={DAYS14}
                series={[{ key: "cur", label: m.label, values: m.cur, color: CHART.sage, area: true }, { key: "prev", label: "Previous 14 days", values: m.prev, color: CHART.previous, dashed: true }]}
                label={`${m.label}, last 14 days vs previous`}
                categoryLabel="Day"
                animate={false}
              />
            </div>
          </ChartCard>
        </Stage>
        <Spec items={[["Component", "ChartMetricSelector"], ["Pattern", "tablist; selection follows focus"]]} />
      </Specimen>

      <Specimen title="Chart zoom controls" description="Zoom and pan with the buttons, or drag the window in the brush.">
        <Stage>
          <Card title="Daily visits" sub="Last 90 days">
            <ChartZoomControls total={DAILY90.length} range={zoom} onChange={setZoom} minSpan={7} rangeLabel={`${DAILY90_LABELS[zoom[0]]} – ${DAILY90_LABELS[zoom[1] - 1]} · ${zoom[1] - zoom[0]} days`} />
            <MultiLineChart labels={DAILY90_LABELS.slice(zoom[0], zoom[1])} series={[{ key: "v", label: "Visits", values: DAILY90.slice(zoom[0], zoom[1]), color: CHART.sage, area: true }]} label="Daily visits in the visible range" categoryLabel="Day" />
            <ChartBrush values={DAILY90} range={zoom} onChange={setZoom} label="Visible days" />
          </Card>
        </Stage>
        <Spec items={[["Components", "ChartZoomControls, ChartBrush"], ["Brush keys", "Arrows ±1 day, Page Up/Down a window, Home/End"]]} />
      </Specimen>

      <Specimen title="Chart export action" description="Download the chart's data as CSV, or the chart as a PNG.">
        <Stage>
          <Card title="Channel mix" sub="This quarter" actions={<ChartExportAction filename="channel-mix" columns={["Area", ...RADAR.map((s) => s.label)]} rows={RADAR_AXES.map((a, i) => [a, ...RADAR.map((s) => s.values[i])])} svgRef={radarRef} />}>
            <RadarChart axes={RADAR_AXES} series={RADAR} label="Channel mix this quarter" svgRef={radarRef} />
          </Card>
        </Stage>
        <Spec items={[["Component", "ChartExportAction"], ["CSV", "Blob + object URL, revoked after click"], ["PNG", "SVG to canvas at 2×, CSS variables resolved"]]} />
      </Specimen>
    </DocPage>
  );
}
