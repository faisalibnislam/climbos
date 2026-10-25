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
      if (result.customerIds.length === 0) setProblem("No directly accessible Google Ads accounts were returned for this sign-in.");
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
      toast({ tone: "success", title: "Google Ads account selected", description: `${result.accountLabel} is bound to this workspace.` });
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
      <p className="text-sm text-ink-3">Select the directly accessible advertiser account for this workspace. ClimbOS validates the account against the connected Google sign-in. Manager accounts and their client-account selection are not supported in this flow.</p>
      {selectedAccount ? <p className="text-sm text-ink-2">Selected advertiser ID: <strong className="font-semibold text-ink">{selectedAccount}</strong></p> : null}
      {isDemo ? <Callout tone="info">Demo account settings are synthetic. No Google Ads data is read.</Callout> : null}
      {!isDemo && canManage ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field label="Advertiser customer ID" hint="IDs are returned by Google for this signed-in account. Selecting one binds it to this workspace.">
              <Select
                value={customerId}
                disabled={!accounts || busy !== null}
                onValueChange={setCustomerId}
                placeholder={accounts ? "Choose an advertiser account" : "Load accessible accounts first"}
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
      {accounts?.truncated ? <p className="text-xs text-ink-3">Showing the first 100 directly accessible account IDs. If the intended account is missing, ask the account owner to grant direct access or reduce the number of linked accounts.</p> : null}
      {!canManage && !isDemo ? <p className="text-sm text-ink-3">Only workspace owners and admins can select the advertiser account.</p> : null}
      {problem ? <Callout tone="warning" title="Google Ads setup">{problem}</Callout> : null}
    </section>
  );
}
