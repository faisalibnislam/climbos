"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Copy, MessageCircle } from "@/components/icons"
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { StatBlocks } from "@/components/ds/content";
import { Button, Callout, Card, CardContent, ColorPicker, EmptyState, Field, Input, Switch, toast } from "@/components/ui";

/** Website chat: one script tag; Climb AI answers from your facts and hands over to you. */
export default function ChatSetupPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.chat.settings, { slug });
  const setup = useMutation(api.chat.setup);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast({ tone: "success", title: ok });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  if (data === undefined) return <LoadingBlock label="Loading website chat…" lines={3} />;
  const w = data.widget;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader section="chat" title="Website chat" />
      {w ? (
        <StatBlocks
          className="-mt-3"
          stats={[
            { label: "Chats this week", value: data.stats.week.toLocaleString("en-US") },
            { label: "Emails collected", value: data.stats.leads.toLocaleString("en-US") },
          ]}
        />
      ) : null}
      {!w ? (
        <EmptyState icon={<MessageCircle />} title="Add chat to your site" body="AI answers from your facts." action={<Button loading={busy} onClick={() => run(() => setup({ slug }), "Chat created")}>Create chat</Button>} />
      ) : (
        <>
          {!data.aiAnswers ? (
            <Callout tone="info" title="Messages only on Free">
              AI answers need a package. <Link href={`/app/${slug}/settings/billing`}>See packages</Link>
            </Callout>
          ) : null}
          <Card>
            <CardContent className="flex flex-col gap-3">
              <h2 className="heading-card flex items-center gap-2">
                <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-[var(--radius-badge)] bg-brand-100 text-2xs font-semibold tabular-nums text-brand-900">1</span>
                <span className="sr-only">Step 1: </span>
                Paste before &lt;/body&gt;
              </h2>
              <code className="block overflow-x-auto whitespace-nowrap rounded-lg bg-surface-2 p-3 text-xs">{w.snippet}</code>
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => navigator.clipboard.writeText(w.snippet).then(() => toast({ tone: "success", title: "Copied" }), () => undefined)}
              >
                <Copy aria-hidden /> Copy
              </Button>
              <p className="text-xs text-ink-3">Use your site’s “custom code” or footer box.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-4">
              <h2 className="heading-card flex items-center gap-2">
                <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-[var(--radius-badge)] bg-brand-100 text-2xs font-semibold tabular-nums text-brand-900">2</span>
                <span className="sr-only">Step 2: </span>
                Make it yours
              </h2>
              <Switch label="Chat is on" checked={w.enabled} onCheckedChange={(on) => run(() => setup({ slug, enabled: on }))} />
              <Field label="Greeting">
                <div className="flex gap-2">
                  <Input value={greeting ?? w.greeting} onChange={(e) => setGreeting(e.target.value)} />
                  <Button variant="secondary" disabled={greeting === null} loading={busy} onClick={() => run(() => setup({ slug, greeting: greeting ?? "" }), "Saved")}>
                    Save
                  </Button>
                </div>
              </Field>
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink-2">Colour</span>
                <ColorPicker label="Chat colour" value={w.color} onChange={(hex) => run(() => setup({ slug, color: hex }))} />
                <span className="text-xs text-ink-3">Re-copy the snippet after changing.</span>
              </div>
              <a href={`/widget/${w.key}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-800 underline-offset-2 hover:underline">
                Preview chat
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
