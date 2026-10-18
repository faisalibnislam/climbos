"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { AreaChart, BarList, FunnelChart, Skeleton, Stat, StatGroup } from "@/components/ui";
import { formatNumber, formatUsd } from "@/lib/utils";

/** Business dashboard: growth, revenue, AI cost and the onboarding → paid funnel. */
export function AdminDashboard() {
  const d = useQuery(api.admin.dashboard, {});
  if (!d) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="heading-page">Dashboard</h1>
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
