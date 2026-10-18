"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { FEATURES, type FeatureKey, type LiveConfig } from "@shared/economics";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input, Segmented, Skeleton, toast } from "@/components/ui";
import { errorMessage } from "../errors";

type Num = (c: LiveConfig) => number;
type Set = (c: LiveConfig, n: number) => LiveConfig;

const MONEY: { label: string; get: Num; set: Set }[] = [
  { label: "Starter credits / month", get: (c) => c.packageCredits.starter, set: (c, n) => ({ ...c, packageCredits: { ...c.packageCredits, starter: n } }) },
  { label: "Pro credits / month", get: (c) => c.packageCredits.pro, set: (c, n) => ({ ...c, packageCredits: { ...c.packageCredits, pro: n } }) },
  { label: "$10 top-up credits", get: (c) => c.topupCredits.credits_10, set: (c, n) => ({ ...c, topupCredits: { ...c.topupCredits, credits_10: n } }) },
  { label: "$25 top-up credits", get: (c) => c.topupCredits.credits_25, set: (c, n) => ({ ...c, topupCredits: { ...c.topupCredits, credits_25: n } }) },
  { label: "$50 top-up credits", get: (c) => c.topupCredits.credits_50, set: (c, n) => ({ ...c, topupCredits: { ...c.topupCredits, credits_50: n } }) },
  { label: "Free credits (new accounts)", get: (c) => c.freeCredits, set: (c, n) => ({ ...c, freeCredits: n }) },
];

const LIMITS: { label: string; get: Num; set: Set }[] = [
  { label: "People: Free", get: (c) => c.seats.free, set: (c, n) => ({ ...c, seats: { ...c.seats, free: n } }) },
  { label: "People: Starter", get: (c) => c.seats.starter, set: (c, n) => ({ ...c, seats: { ...c.seats, starter: n } }) },
  { label: "People: Pro", get: (c) => c.seats.pro, set: (c, n) => ({ ...c, seats: { ...c.seats, pro: n } }) },
  { label: "Workspaces: Free", get: (c) => c.workspaces.free, set: (c, n) => ({ ...c, workspaces: { ...c.workspaces, free: n } }) },
  { label: "Workspaces: Starter", get: (c) => c.workspaces.starter, set: (c, n) => ({ ...c, workspaces: { ...c.workspaces, starter: n } }) },
  { label: "Workspaces: Pro", get: (c) => c.workspaces.pro, set: (c, n) => ({ ...c, workspaces: { ...c.workspaces, pro: n } }) },
  { label: "Free results history (days)", get: (c) => c.freeHistoryDays, set: (c, n) => ({ ...c, freeHistoryDays: n }) },
  { label: "Referral credits (each side)", get: (c) => c.referralCredits, set: (c, n) => ({ ...c, referralCredits: n }) },
];

/** Live plans and feature locks: changes apply without a deploy (credit amounts from each account's next renewal). */
export function AdminPlans() {
  const data = useQuery(api.admin.config, {});
  if (!data) return <Skeleton className="h-64 w-full" />;
  return <Editor key={data.updatedAt ?? 0} initial={data.config} canEditMoney={data.canEditMoney} canEditFeatures={data.canEditFeatures} />;
}

function Editor({ initial, canEditMoney, canEditFeatures }: { initial: LiveConfig; canEditMoney: boolean; canEditFeatures: boolean }) {
  const save = useMutation(api.admin.setConfig);
  const [c, setC] = useState(initial);
  const [busy, setBusy] = useState(false);
  const numberField = (f: { label: string; get: Num; set: Set }, disabled: boolean) => (
    <Field key={f.label} label={f.label}>
      <Input inputMode="numeric" disabled={disabled} value={String(f.get(c))} onChange={(e) => setC(f.set(c, Number(e.target.value.replace(/[^0-9]/g, "")) || 0))} />
    </Field>
  );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="heading-page">Plans &amp; locks</h1>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Free or paid</CardTitle>
          <CardDescription>What free accounts can use. Changes apply right away.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(FEATURES) as FeatureKey[]).map((k) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-line p-3">
              <span className="text-ui text-ink">{FEATURES[k]}</span>
              <Segmented
                label={FEATURES[k]}
                options={[
                  { value: "paid", label: "Packages" },
                  { value: "free", label: "Everyone" },
                ]}
                value={c.features[k]}
                onChange={(v) => canEditFeatures && setC({ ...c, features: { ...c.features, [k]: v } })}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Credits</CardTitle>
          <CardDescription>{canEditMoney ? "Apply to new grants: each account's next renewal, new top-ups and new accounts. Prices are set in Polar." : "Only the owner can change credit amounts."}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">{MONEY.map((f) => numberField(f, !canEditMoney))}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Limits</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">{LIMITS.map((f) => numberField(f, !canEditFeatures))}</CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setC(initial)}>
          Reset
        </Button>
        <Button
          loading={busy}
          disabled={!canEditFeatures}
          onClick={async () => {
            setBusy(true);
            try {
              const res = await save({ value: JSON.stringify(c) });
              toast({ tone: "success", title: res.changed.length ? `Saved: ${res.changed.join(", ")}` : "Nothing changed" });
            } catch (e) {
              toast({ tone: "danger", title: errorMessage(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}
