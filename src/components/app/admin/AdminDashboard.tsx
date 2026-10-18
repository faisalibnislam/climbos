"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { AreaChart, BarList, Button, FunnelChart, Skeleton, Stat, StatGroup, toast } from "@/components/ui";
import { formatNumber, formatUsd } from "@/lib/utils";

/** Business dashboard: growth, revenue, AI cost and the onboarding → paid funnel. */
export function AdminDashboard() {
  const d = useQuery(api.admin.dashboard, {});
  const refresh = useMutation(api.admin.refreshDashboardNow);
  if (!d) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="heading-page">Dashboard</h1>
        <span className="flex items-center gap-2 text-sm text-ink-3">
          {d.updatedAt ? `Updated ${new Date(d.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "Not built yet"}
          <Button size="sm" variant="secondary" onClick={() => refresh({}).then(() => toast({ tone: "success", title: "Refreshing" }), () => undefined)}>
            Refresh
          </Button>
        </span>
      </div>
      <StatGroup>
        <Stat label="MRR" value={formatUsd(d.mrrUsd)} sublabel={`${formatNumber(d.paying)} paying · ${formatNumber(d.comps)} comped`} />
        <Stat label="Revenue, 30 days" value={formatUsd(d.revenue30dUsd)} sublabel="Paid orders, after tax and refunds" />
        <Stat label="AI cost, 30 days" value={formatUsd(d.aiCost30dUsd)} sublabel={`${formatNumber(d.creditsUsed30d)} credits used`} />
        <Stat label="Gross margin, 30 days" value={d.grossMargin30d === null ? "—" : `${Math.round(d.grossMargin30d * 100)}%`} sublabel="Revenue minus AI cost" />
        <Stat label="Users" value={formatNumber(d.users)} sublabel={`${formatNumber(d.signups7d)} this week · ${formatNumber(d.signups30d)} this month`} />
        <Stat label="Accounts" value={formatNumber(d.accounts)} />
      </StatGroup>
      <div className="grid gap-4 lg:grid-cols-2">
        <AreaChart title="Sign-ups, last 30 days" labels={d.signupsByDay.map((x) => x.day.slice(5))} series={[{ key: "signups", label: "Sign-ups", values: d.signupsByDay.map((x) => x.count) }]} />
        <FunnelChart title="Onboarding to paid" steps={d.funnel.map((f) => ({ label: f.step, value: f.count }))} />
      </div>
      <BarList title="Paying accounts by package" items={Object.entries(d.byPackage).map(([label, value]) => ({ label, value }))} valueLabel="Accounts" />
    </div>
  );
}
