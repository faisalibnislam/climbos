"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Badge, Button, Callout, Field, Select, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import { relativeTime } from "../money";

/** Owner-facing property selection and the latest bounded, read-only Search Console snapshot. */
export function SearchConsoleSetup({ slug, connected, canManage, isDemo, selectedProperty }: {
  slug: string;
  connected: boolean;
  canManage: boolean;
  isDemo: boolean;
  selectedProperty: string | null;
}) {
  const history = useQuery(api.searchConsole.history, { slug });
  const listSites = useAction(api.connectionActions.availableSearchConsoleSites);
  const selectSite = useAction(api.connectionActions.selectSearchConsoleSite);
  const [sites, setSites] = useState<Array<{ siteUrl: string; permissionLevel: string }> | null>(null);
  const [siteUrl, setSiteUrl] = useState(selectedProperty ?? "");
  const [snapshotId, setSnapshotId] = useState<Id<"searchConsoleSnapshots"> | null>(null);
  const [busy, setBusy] = useState<"load" | "save" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const currentHistory = history?.filter((item) => item.property === selectedProperty) ?? [];
  const activeSnapshotId = snapshotId && currentHistory.some((item) => item.id === snapshotId) ? snapshotId : currentHistory[0]?.id ?? null;
  const observations = useQuery(api.searchConsole.snapshot, activeSnapshotId ? { slug, snapshotId: activeSnapshotId } : "skip");

  if (!connected) return null;

  async function loadSites() {
    setBusy("load");
    setProblem(null);
    try {
      const result = await listSites({ slug });
      if (!result.ok) throw new Error(result.message);
      setSites(result.sites);
      if (!siteUrl && result.sites.length === 1) setSiteUrl(result.sites[0]!.siteUrl);
      if (result.sites.length === 0) setProblem("No Search Console properties are available to this Google account.");
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveSite() {
    if (!siteUrl) return;
    setBusy("save");
    setProblem(null);
    try {
      await selectSite({ slug, siteUrl });
      setSites(null);
      toast({ tone: "success", title: "Search Console property selected", description: "The first 90-day snapshot is syncing." });
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  const rows = observations?.rows.slice().sort((a, b) => b.clicks - a.clicks).slice(0, 8) ?? [];

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4" aria-labelledby="search-console-data-heading">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 id="search-console-data-heading" className="text-ui font-semibold text-ink">Search performance</h4>
      {observations ? <Badge tone="blue">Read only</Badge> : null}
        </div>
        <p className="mt-1 text-sm text-ink-3">Select the exact property ClimbOS should read. It requests search queries and pages only; it cannot edit your Google Search Console account.</p>
      </div>

      {isDemo ? <Callout tone="info">Demo data is synthetic. Connect Search Console in a real workspace to load a live property.</Callout> : null}
      {!isDemo && canManage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Google Search Console property" hint={selectedProperty ? `Current property: ${selectedProperty}` : "Choose from properties returned by your connected Google account."}>
              <Select
                value={siteUrl}
                disabled={!sites || busy !== null}
                onValueChange={setSiteUrl}
                placeholder={sites ? "Choose a property" : "Load properties first"}
                options={(sites ?? []).map((site) => ({ value: site.siteUrl, label: `${site.siteUrl} · ${site.permissionLevel.replace(/_/g, " ")}` }))}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" loading={busy === "load"} loadingText="Loading…" onClick={loadSites}>Load properties</Button>
            <Button disabled={!siteUrl || siteUrl === selectedProperty} loading={busy === "save"} loadingText="Selecting…" onClick={saveSite}>Select property</Button>
          </div>
        </div>
      ) : null}
      {!canManage && !isDemo ? <p className="text-sm text-ink-3">Only workspace owners and admins can select a property.</p> : null}
      {problem ? <Callout tone="warning" title="Search Console setup">{problem}</Callout> : null}

      {currentHistory.length > 1 ? (
        <Field label="Saved snapshots" hint="Up to three completed rolling 90-day snapshots are kept. Windows overlap, so changes are descriptive rather than causal.">
          <Select
            value={activeSnapshotId ?? currentHistory[0]!.id}
            onValueChange={(value) => setSnapshotId(value as Id<"searchConsoleSnapshots">)}
            options={currentHistory.map((item) => ({ value: item.id, label: `${item.startDate} to ${item.endDate} · synced ${relativeTime(item.fetchedAt)}` }))}
          />
        </Field>
      ) : null}
      {observations && observations.property === selectedProperty ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-2">
            <span className="font-medium">{observations.startDate} to {observations.endDate}</span>
            {" · "}{observations.rowCount.toLocaleString()} query/page rows
            {" · "}synced {relativeTime(observations.fetchedAt)}
          </p>
          {observations.truncated ? <Callout tone="warning">Google returned a capped result set. These top rows do not represent every query or page.</Callout> : null}
          {rows.length ? (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <thead className="bg-surface-3 text-xs uppercase tracking-wide text-ink-3">
                  <tr><th className="px-3 py-2">Search query</th><th className="px-3 py-2 text-right">Clicks</th><th className="px-3 py-2 text-right">Impressions</th><th className="px-3 py-2 text-right">CTR</th><th className="px-3 py-2 text-right">Avg. position</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((row) => (
                    <tr key={`${row.query}\0${row.page}`}>
                      <td className="max-w-[22rem] px-3 py-2"><span className="block truncate" title={`${row.query} — ${row.page}`}>{row.query}</span><span className="block truncate text-xs text-ink-3" title={row.page}>{row.page}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.clicks.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.impressions.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{(row.ctr * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-ink-3">No query/page rows were returned for this finalized window yet.</p>}
          <p className="text-xs text-ink-3">Google may omit low-volume queries. These are property and date-window observations, not total market demand or proof that search caused a business result.</p>
        </div>
      ) : selectedProperty ? <p className="text-sm text-ink-3">The first snapshot is syncing or no finalized snapshot has completed yet.</p> : <p className="text-sm text-ink-3">Choose a property to start a bounded 90-day read-only sync.</p>}
    </section>
  );
}
