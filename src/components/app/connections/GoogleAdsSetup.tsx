"use client";

import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Badge, Button, Callout, Field, Select, toast } from "@/components/ui";
import { errorMessage } from "../errors";

/** Explicitly bind one verified advertiser account to this workspace. */
export function GoogleAdsSetup({ slug, connected, canManage, isDemo, selectedAccount }: {
  slug: string;
  connected: boolean;
  canManage: boolean;
  isDemo: boolean;
  selectedAccount: string | null;
}) {
  const loadAccounts = useAction(api.connectionActions.availableGoogleAdsAccounts);
  const selectAccount = useAction(api.connectionActions.selectGoogleAdsAccount);
  const [accounts, setAccounts] = useState<{ ids: string[]; truncated: boolean } | null>(null);
  const [customerId, setCustomerId] = useState(selectedAccount ?? "");
  const [busy, setBusy] = useState<"load" | "save" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (!connected) return null;

  async function load() {
    setBusy("load");
    setProblem(null);
    try {
      const result = await loadAccounts({ slug });
      if (!result.ok) throw new Error(result.message);
      setAccounts({ ids: result.customerIds, truncated: result.truncated });
      if (selectedAccount && result.customerIds.includes(selectedAccount)) setCustomerId(selectedAccount);
      else if (!customerId && result.customerIds.length === 1) setCustomerId(result.customerIds[0]!);
      if (result.customerIds.length === 0) setProblem("This sign-in has no Google Ads accounts with direct access.");
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!customerId) return;
    setBusy("save");
    setProblem(null);
    try {
      const result = await selectAccount({ slug, customerId });
      setAccounts(null);
      toast({ tone: "success", title: "Google Ads account selected", description: `${result.accountLabel} is linked to this workspace.` });
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-4" aria-labelledby="google-ads-account-heading">
      <div className="flex flex-wrap items-center gap-2">
        <h4 id="google-ads-account-heading" className="text-ui font-semibold text-ink">Google Ads account</h4>
        <Badge tone="blue">Read and campaign access</Badge>
      </div>
      <p className="text-sm text-ink-3">Pick the ad account for this workspace. Manager accounts aren&apos;t supported.</p>
      {selectedAccount ? <p className="text-sm text-ink-2">Selected account ID: <strong className="font-semibold text-ink">{selectedAccount}</strong></p> : null}
      {isDemo ? <Callout tone="info">Demo only. No Google Ads data is read.</Callout> : null}
      {!isDemo && canManage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field label="Ad account ID" hint="From your Google sign-in.">
              <Select
                value={customerId}
                disabled={!accounts || busy !== null}
                onValueChange={setCustomerId}
                placeholder={accounts ? "Choose an account" : "Load accounts first"}
                options={(accounts?.ids ?? []).map((id) => ({ value: id, label: id }))}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" loading={busy === "load"} loadingText="Loading…" onClick={load}>Load accounts</Button>
            <Button disabled={!customerId || customerId === selectedAccount} loading={busy === "save"} loadingText="Selecting…" onClick={save}>Select account</Button>
          </div>
        </div>
      ) : null}
      {accounts?.truncated ? <p className="text-xs text-ink-3">Showing the first 100. Missing yours? Ask its owner for direct access.</p> : null}
      {!canManage && !isDemo ? <p className="text-sm text-ink-3">Only owners and admins can choose this.</p> : null}
      {problem ? <Callout tone="warning" title="Google Ads setup">{problem}</Callout> : null}
    </section>
  );
}
