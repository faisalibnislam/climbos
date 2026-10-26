"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Badge, Button, Callout, Card, CardContent, CardDescription, CardHeader, CardTitle, Select, Skeleton, toast } from "@/components/ui";
import { errorMessage } from "../errors";

/**
 * Platform setup: for each platform, where to create the developer app, the
 * exact redirect URL, scopes and the review each needs, and the Convex env var
 * names with live configured/missing status. Values are never shown.
 */
export function AdminPlatformSetup() {
  const data = useQuery(api.platformSetup.guide, {});
  const setApproval = useMutation(api.platformSetup.setApproval);
  if (data === undefined) return <Skeleton className="h-64 w-full" />;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ tone: "success", title: "Redirect URL copied" });
    } catch {
      toast({ tone: "danger", title: "Couldn't copy. Select the URL and copy it." });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="heading-page">Platform setup</h1>
        <p className="mt-1 max-w-[75ch] text-sm text-ink-3">
          Create each developer app, then add the keys in the Convex dashboard (Settings → Environment variables). This page only shows whether a name is set, never its value. Provider rules last checked {data.verifiedAt}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Redirect URL for every platform</CardTitle>
          <CardDescription>Paste it exactly, with no trailing slash, in each app&apos;s OAuth redirect settings.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-line bg-surface-2 px-2 py-1 text-sm text-ink">{data.redirectUrl}</code>
            <Button size="sm" variant="secondary" onClick={() => copy(data.redirectUrl)}>
              Copy
            </Button>
          </div>
          {!data.siteUrlSet ? <Callout tone="warning">SITE_URL isn&apos;t set on this deployment, so this shows the local default. Set SITE_URL to the public address (for example https://climbos.app).</Callout> : null}
        </CardContent>
      </Card>

      {data.platforms.map((p, index) => (
        <Card key={p.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle as="h2">
                {index + 1}. {p.title}
              </CardTitle>
              <Badge tone={p.ready ? "green" : "neutral"}>{p.ready ? "Keys set" : "Keys missing"}</Badge>
            </div>
            <CardDescription>{p.covers}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <section aria-label={`${p.title} steps`}>
              <h3 className="text-ui font-semibold text-ink">Steps</h3>
              <p className="mt-1 text-sm text-ink-3">
                Create the app at{" "}
                <a className="font-medium text-brand-700 underline" href={p.createAppUrl} target="_blank" rel="noreferrer">
                  {p.createAppUrl.replace(/^https:\/\//, "")}
                </a>
              </p>
              <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-2">
                {p.steps.map((step) => (
                  <li key={step} className="max-w-[80ch]">
                    {step}
                  </li>
                ))}
              </ol>
            </section>

            <section aria-label={`${p.title} environment variables`}>
              <h3 className="text-ui font-semibold text-ink">Convex environment variables</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {p.env.map((e) => (
                  <li key={e.name} className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
                    <span className="flex min-w-0 flex-col">
                      <code className="text-sm font-medium text-ink">{e.name}</code>
                      <span className="text-xs text-ink-3">
                        {e.from}
                        {e.optional ? " · optional" : ""}
                      </span>
                    </span>
                    <Badge tone={e.configured ? "green" : e.optional ? "neutral" : "amber"} className="shrink-0">
                      {e.configured ? "Configured" : "Missing"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label={`${p.title} permissions`}>
              <h3 className="text-ui font-semibold text-ink">Permissions and the review each needs</h3>
              <ul className="mt-2 flex flex-col divide-y divide-line rounded-lg border border-line text-sm">
                {p.scopes.map((s) => (
                  <li key={s.scope} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <span>
                      <code className="font-medium text-ink">{s.scope}</code> <span className="text-ink-2">{s.why}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-3">{s.review}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label={`${p.title} approvals`}>
              <h3 className="text-ui font-semibold text-ink">Approvals</h3>
              <p className="mt-1 text-sm text-ink-3">Record each status here. Business owners then see honest states, such as &ldquo;Connected, but posting needs Meta App Review&rdquo;.</p>
              <ul className="mt-2 flex flex-col gap-3">
                {p.approvals.map((a) => (
                  <li key={a.key} className="flex flex-col gap-2 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex flex-col">
                      <span className="text-ui font-medium text-ink">{a.label}</span>
                      {a.status !== "approved" ? <span className="text-xs text-ink-3">{a.pendingNote}</span> : null}
                    </span>
                    <div className="w-full sm:w-64">
                      <Select
                        aria-label={`${a.label} status`}
                        value={a.status}
                        disabled={!data.canEdit}
                        onValueChange={async (status) => {
                          try {
                            await setApproval({ key: a.key, status });
                            toast({ tone: "success", title: "Saved" });
                          } catch (e) {
                            toast({ tone: "danger", title: errorMessage(e) });
                          }
                        }}
                        options={Object.entries(a.statusLabels).map(([value, label]) => ({ value, label }))}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {p.notes.length ? (
              <Callout tone="info" title="Good to know">
                <ul className="flex list-disc flex-col gap-1 pl-4">
                  {p.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            <p className="text-xs text-ink-3">
              Official docs:{" "}
              {p.docs.map((d, i) => (
                <span key={d.url}>
                  {i ? " · " : ""}
                  <a className="underline" href={d.url} target="_blank" rel="noreferrer">
                    {d.label}
                  </a>
                </span>
              ))}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
