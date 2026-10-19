"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Copy, MessageCircle } from "@/components/icons"
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
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
      <PageHeader section="chat" title="Website chat" intro={w ? `${data.stats.week} chats this week · ${data.stats.leads} left their email. Chats land in your Inbox.` : "A chat bubble on your site. Climb AI answers from your business facts and passes anything it can't answer to you."} />
      {!w ? (
        <EmptyState icon={<MessageCircle />} title="Add chat to your website" body="Takes a minute: create it, then paste one line into your site." action={<Button loading={busy} onClick={() => run(() => setup({ slug }), "Chat created")}>Create website chat</Button>} />
      ) : (
        <>
          {!data.aiAnswers ? (
            <Callout tone="info" title="Messages only on Free">
              Visitors can message you and leave their email. AI answers come with a package. <Link href={`/app/${slug}/settings/billing`}>See packages</Link>
            </Callout>
          ) : null}
          <Card>
            <CardContent className="flex flex-col gap-3">
              <p className="heading-card">1. Paste this before &lt;/body&gt; on your site</p>
              <code className="block overflow-x-auto whitespace-nowrap rounded-lg bg-surface-2 p-3 text-xs">{w.snippet}</code>
              <Button
                size="sm"
                variant="secondary"
                className="self-start"
                onClick={() => navigator.clipboard.writeText(w.snippet).then(() => toast({ tone: "success", title: "Copied" }), () => undefined)}
              >
                <Copy aria-hidden /> Copy
              </Button>
              <p className="text-xs text-ink-3">WordPress: Appearance → Theme file editor → footer, or any “insert scripts” plugin. Webflow, Wix, Squarespace and Shopify all have a “custom code” box.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-4">
              <p className="heading-card">2. Make it yours</p>
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
                <span className="text-xs text-ink-3">The bubble on your site uses data-color in the snippet.</span>
              </div>
              <a href={`/widget/${w.key}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-800 underline-offset-2 hover:underline">
                Try the chat panel
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
