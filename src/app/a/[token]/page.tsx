"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { CircleCheck, CircleSlash, Clock } from "@/components/icons"
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button, Card, CardContent, Skeleton } from "@/components/ui";

/**
 * Landing page for one-tap email links. Opening it never changes anything
 * (mail scanners pre-fetch links); the owner confirms with the button.
 */
export default function EmailActionPage() {
  const { token } = useParams<{ token: string }>();
  const info = useQuery(api.emailActions.preview, { token });
  const consume = useMutation(api.emailActions.consume);
  const [done, setDone] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center bg-bg px-4 py-10">
      <Logo markClassName="size-6" />
      <Card className="mt-8 w-full max-w-md">
        <CardContent className="flex flex-col gap-4 p-6">
          {info === undefined ? (
            <>
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-16" />
            </>
          ) : done ? (
            <>
              <h1 className="heading-page flex items-center gap-2">{done.ok ? "Done" : "Nothing changed"}</h1>
              <p className="flex items-start gap-2 text-sm text-ink-2">
                {done.ok ? <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-800" /> : <CircleSlash aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />}
                {done.message}
              </p>
              {"slug" in info && info.slug ? (
                <Button asChild variant="secondary">
                  <Link href={`/app/${info.slug}/today`}>Open ClimbOS</Link>
                </Button>
              ) : null}
            </>
          ) : info.state === "invalid" ? (
            <>
              <h1 className="heading-page">This link doesn&apos;t work</h1>
              <p className="text-sm text-ink-2">It may be incomplete. Open ClimbOS to review your posts.</p>
              <Button asChild variant="secondary">
                <Link href="/app">Open ClimbOS</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-overline">
                {info.orgName} · {info.channel}
              </p>
              <h1 className="heading-page">{info.kind === "stop_post" ? "Stop this post?" : "Approve this post?"}</h1>
              <div className="rounded-lg border border-line bg-surface-2/60 p-3">
                <p className="heading-card">{info.title}</p>
                {info.when ? (
                  <p className="mt-1 flex items-center gap-1.5 text-ui text-ink-3">
                    <Clock aria-hidden className="size-3.5" /> Planned for {info.when}
                  </p>
                ) : null}
              </div>
              {info.state === "ready" ? (
                <>
                  <p className="text-sm text-ink-2">
                    {info.kind === "stop_post" ? "It goes back to your review list and won't post until you approve it again." : "It goes out at its planned time (or waits for you to post it, for channels ClimbOS can't post to)."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={info.kind === "stop_post" ? "danger" : "primary"}
                      loading={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          setDone(await consume({ token }));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {info.kind === "stop_post" ? "Stop it" : "Approve"}
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href={`/app/${info.slug}/content/${info.artifactId}`}>Review in ClimbOS</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-ink-2">
                  {info.state === "used" ? "This link was already used." : info.state === "expired" ? "This link has expired." : info.kind === "stop_post" ? "It isn't scheduled any more, so there's nothing to stop." : "It has already been handled."}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <p className="mt-6 max-w-md text-center text-xs text-ink-3">Links in ClimbOS emails work once and expire. Opening one never changes anything until you press the button.</p>
    </main>
  );
}
