"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, DataTable, Field, Input, Select, Skeleton, toast } from "@/components/ui";
import { errorMessage } from "../errors";
import type { AdminMe } from "./AdminFrame";

const price = (n: number) => `$${n < 1 ? n.toFixed(2) : n.toLocaleString()}`;

/**
 * AI models: the default model per tier (every user gets it), every model
 * cheapest first with whether its provider key is set, and the users allowed
 * to choose their own model. Every change is audited.
 */
export function AdminModels({ me }: { me: AdminMe }) {
  const data = useQuery(api.admin.modelSettings, {});
  const setDefault = useMutation(api.admin.setDefaultModel);
  const setChoice = useMutation(api.admin.setUserModelChoice);
  const [email, setEmail] = useState("");
  const canEdit = (me.powers as readonly string[]).includes("features");
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast({ tone: "success", title: "Saved" });
      return true;
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
      return false;
    }
  };
  if (data === undefined) return <Skeleton className="h-64 w-full" />;
  const options = data.options.map((o) => ({ value: o.key, label: `${o.label} · ${o.providerLabel} · ${price(o.inputPerM)} / ${price(o.outputPerM)}${o.available ? "" : " (key missing)"}`, disabled: !o.available }));
  return (
    <div className="flex flex-col gap-6">
      <h1 className="heading-page">AI models</h1>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Default models</CardTitle>
          <CardDescription>Every run uses these unless you let a user choose. If a provider&apos;s key is removed, runs fall back to the built-in OpenAI model.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {data.tiers.map((t) => (
            <Field key={t.tier} label={t.label} hint={`${t.detail}${t.saved && t.saved !== t.effective ? ` Saved ${t.saved} is unavailable, so ${t.effective} is used.` : ""}`}>
              <Select value={t.effective} disabled={!canEdit} onValueChange={(model) => run(() => setDefault({ tier: t.tier, model }))} options={options} aria-label={`${t.label} default model`} />
            </Field>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Providers</CardTitle>
          <CardDescription>Add a key in the Convex dashboard (Settings → Environment variables) to make that provider&apos;s models available. Keys are never shown here.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-3">
            {data.providers.map((p) => (
              <li key={p.provider} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                <span className="flex flex-col">
                  <span className="font-medium text-ink">{p.label}</span>
                  <code className="text-xs text-ink-3">{p.envVar}</code>
                </span>
                <Badge tone={p.configured ? "green" : "neutral"}>{p.configured ? "Connected" : "Not connected"}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Users who can choose a model</CardTitle>
          <CardDescription>Off for everyone by default. An enabled user sees a model picker when starting research, building their plan and creating content. Only connected models are offered, cheapest first.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="User email" className="w-full flex-1 sm:min-w-64">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Button onClick={async () => (await run(() => setChoice({ email, enabled: true }))) && setEmail("")} disabled={!email.trim()}>
                Allow model choice
              </Button>
            </div>
          ) : null}
          {data.grants.length ? (
            <DataTable
              caption="Users who can choose a model"
              rows={data.grants}
              rowKey={(r) => r.userId}
              columns={[
                { key: "email", header: "User", rowHeader: true, cell: (r) => r.email ?? r.name ?? r.userId },
                { key: "since", header: "Since", cell: (r) => new Date(r.updatedAt).toLocaleDateString() },
                { key: "actions", header: "", cell: (r) => (canEdit ? <Button size="sm" variant="ghost" onClick={() => run(() => setChoice({ userId: r.userId, enabled: false }))}>Turn off</Button> : null) },
              ]}
            />
          ) : (
            <p className="text-sm text-ink-2">No users can choose a model yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">All models</CardTitle>
          <CardDescription>Cheapest to most expensive, in USD per million tokens (input / output) at today&apos;s rate version.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            caption="All models"
            rows={data.options}
            rowKey={(r) => r.key}
            columns={[
              { key: "model", header: "Model", rowHeader: true, cell: (r) => r.label },
              { key: "provider", header: "Provider", cell: (r) => r.providerLabel },
              { key: "price", header: "Input / output", cell: (r) => `${price(r.inputPerM)} / ${price(r.outputPerM)}` },
              { key: "status", header: "Status", cell: (r) => <Badge tone={r.available ? "green" : "neutral"}>{r.available ? "Available" : "Key missing"}</Badge> },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
