"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ExternalLink, Pause, Play, Workflow } from "@/components/icons";
import { useParams } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, QueryBoundary } from "@/components/app/results/QueryBoundary";
import { SettingsHeader } from "@/components/app/settings/SettingsNav";

const STATE_LABEL = { active: "Active", paused: "Paused", not_configured: "Not configured", manual_only: "Manual only" } as const;
const STATE_TONE = { active: "green", paused: "orange", not_configured: "neutral", manual_only: "blue" } as const;

export default function AutomationsSettingsPage() {
  return <QueryBoundary><AutomationsSettings /></QueryBoundary>;
}

function AutomationsSettings() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.automationRegistry.get, { slug });
  const setWebsiteMonitor = useMutation(api.automationRegistry.setWebsiteMonitor);
  const setCompetitorMonitoring = useMutation(api.competitors.setScheduledMonitoring);
  const setScheduledSpecialists = useMutation(api.customAgents.setScheduledEnabled);
  const [busy, setBusy] = useState(false);
  if (data === undefined) return <LoadingBlock label="Loading automations" lines={5} />;
  const emergencyStopped = data.emergencyStopped;

  async function toggleWebsiteMonitor(enabled: boolean) {
    setBusy(true);
    try {
      await setWebsiteMonitor({ slug, enabled });
      toast({ tone: "success", title: enabled ? "Website monitoring resumed" : "Website monitoring paused", description: "Manual checks still work." });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleCompetitorMonitoring(enabled: boolean) {
    setBusy(true);
    try {
      await setCompetitorMonitoring({ slug, enabled });
      toast({ tone: "success", title: enabled ? "Weekly competitor checks resumed" : "Weekly competitor checks paused", description: "Manual checks still work." });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleScheduledSpecialists(enabled: boolean) {
    setBusy(true);
    try {
      await setScheduledSpecialists({ slug, enabled });
      toast({ tone: "success", title: enabled ? "Scheduled specialist runs enabled" : "Scheduled specialist runs paused", description: enabled ? emergencyStopped ? "Pause all still blocks scheduled runs. Manual runs still work." : "Due runs start soon. Manual runs still work." : "Manual runs still work." });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader title="Automations" intro="What runs on a schedule, and how to pause it." />
      {data.emergencyStopped ? <Callout tone="warning" title="Pause all is on">Automations wait until it&apos;s cleared.</Callout> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {data.entries.map((automation) => {
          const siteMonitorEnabled = "siteWatchEnabled" in automation && automation.siteWatchEnabled === true;
          const competitorMonitoringEnabled = "competitorWatchEnabled" in automation && automation.competitorWatchEnabled === true;
          const scheduledSpecialistsEnabled = "scheduledSpecialistsEnabled" in automation && automation.scheduledSpecialistsEnabled === true;
          return (
          <Card key={automation.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3"><span className="mt-0.5 rounded-md bg-surface p-2 text-ink-2"><Workflow aria-hidden className="size-4" /></span><div><CardTitle as="h2">{automation.name}</CardTitle><CardDescription>{automation.summary}</CardDescription></div></div>
                <Badge tone={STATE_TONE[automation.state]}>{STATE_LABEL[automation.state]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Detail label="Trigger" value={automation.trigger} />
              <Detail label="Scope" value={automation.scope} />
              <Detail label="Permission boundary" value={automation.permission} />
              <Detail label="Limits" value={automation.limits} />
              <Detail label="Pause and stop conditions" value={automation.stop} />
              <Detail label="Latest activity" value={automation.lastReceipt ? `${new Date(automation.lastReceipt.at).toLocaleString()} · ${automation.lastReceipt.summary}` : `No recent receipt. ${automation.receipt}`} />
              {automation.lastReceipt?.href ? <Link className="w-fit text-sm font-medium text-accent underline-offset-4 hover:underline" href={`/app/${slug}/${automation.lastReceipt.href}`}>Review latest activity</Link> : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button asChild size="sm" variant="secondary"><Link href={`/app/${slug}/${automation.href}`}>Manage workflow <ExternalLink aria-hidden /></Link></Button>
                {automation.id === "website_change_watch" && data.canManage && automation.state !== "not_configured" ? (
                  <Button size="sm" variant="ghost" loading={busy} onClick={() => void toggleWebsiteMonitor(!siteMonitorEnabled)}>
                    {siteMonitorEnabled ? <><Pause aria-hidden />Pause scheduled checks</> : <><Play aria-hidden />Resume scheduled checks</>}
                  </Button>
                ) : null}
                {automation.id === "competitor_watch" && data.canManage && automation.state !== "not_configured" ? (
                  <Button size="sm" variant="ghost" loading={busy} onClick={() => void toggleCompetitorMonitoring(!competitorMonitoringEnabled)}>
                    {competitorMonitoringEnabled ? <><Pause aria-hidden />Pause weekly checks</> : <><Play aria-hidden />Resume weekly checks</>}
                  </Button>
                ) : null}
                {automation.id === "scheduled_specialists" && data.canManage && "configuredScheduledCount" in automation && automation.configuredScheduledCount > 0 ? (
                  <Button size="sm" variant="ghost" loading={busy} onClick={() => void toggleScheduledSpecialists(!scheduledSpecialistsEnabled)}>
                    {scheduledSpecialistsEnabled ? <><Pause aria-hidden />Pause scheduled runs</> : <><Play aria-hidden />Enable scheduled runs</>}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
      <p className="text-xs text-ink-3">Shows only the most recent activity we keep.</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><h3 className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</h3><p className="mt-1 text-sm leading-5 text-ink-2">{value}</p></div>;
}
