"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { Button, Callout, toast } from "@/components/ui";
import { LoadingBlock, PageHeader } from "../results/QueryBoundary";
import { ConnectionCard, type ConnectionsData } from "./ConnectionCard";
import { GROUPS } from "./labels";

export function ConnectionsView({ slug }: { slug: string }) {
  const data = useQuery(api.connections.list, { slug });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <PageHeader
        section="connections"
        title="Connections"
        intro="Connect the tools you already use. Each connection lists exactly what ClimbOS can and can't do with it — and why — so there are no surprises."
      />

      <Suspense fallback={null}>
        <OAuthReturnNotice data={data} />
      </Suspense>

      {data === undefined ? (
        <LoadingBlock label="Loading connections…" lines={4} />
      ) : (
        <>
          {data.isDemo ? (
            <Callout tone="info" title="Demo workspace">
              These are demo connections with synthetic data. Create your own workspace to connect real accounts.
            </Callout>
          ) : null}
          {!data.canManage && !data.isDemo ? (
            <Callout tone="info" title="View only">
              You can see every connection, but only owners and admins can connect or disconnect accounts.
            </Callout>
          ) : null}

          {GROUPS.map((g) => {
            const items = data.items.filter((i) => i.group === g.key);
            if (items.length === 0) return null;
            return (
              <section key={g.key} aria-labelledby={`group-${g.key}`} className="flex flex-col gap-3">
                <div>
                  <h2 id={`group-${g.key}`} className="heading-section">
                    {g.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-ink-3">{g.intro}</p>
                </div>
                {g.key === "publish" ? (
                  <Callout tone="info" title="Some platforms use drafts and export packs">
                    LinkedIn, X, TikTok, Pinterest and YouTube don&apos;t have a verified official integration in ClimbOS yet. ClimbOS writes platform-ready posts
                    you can copy or download and post yourself. It never asks for your passwords or uses browser bots.
                  </Callout>
                ) : null}
                {g.key === "data" ? (
                  <Callout tone="info" title="ClimbOS has no contact database">
                    ClimbOS doesn&apos;t sell, include or scrape contact details. It works only with customers and leads you already have and are allowed to contact.
                    Finding new prospects needs a data provider you license yourself.
                  </Callout>
                ) : null}
                <div className="flex flex-col gap-3">
                  {items.map((item) => (
                    <ConnectionCard key={item.provider} slug={slug} item={item} canManage={data.canManage} isDemo={data.isDemo} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/** Explains the result of an OAuth round trip (?connected=<provider> or ?connection=failed). */
function OAuthReturnNotice({ data }: { data: ConnectionsData | undefined }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const connected = params.get("connected");
  const failed = params.get("connection");
  const announced = useRef<string | null>(null);
  const name = connected ? (data?.items.find((i) => i.provider === connected)?.name ?? "Your account") : null;

  useEffect(() => {
    const key = connected ? `ok:${connected}` : failed ? `fail:${failed}` : null;
    if (!key || announced.current === key) return;
    announced.current = key;
    if (connected) toast({ tone: "success", title: "Connected", description: "Check the card below to see what it can do." });
    else toast({ tone: "danger", title: "Connection didn't finish", description: "Nothing was connected. You can try again." });
  }, [connected, failed]);

  if (!connected && !failed) return null;
  const dismiss = (
    <Button variant="secondary" size="sm" onClick={() => router.replace(pathname)}>
      Dismiss
    </Button>
  );
  if (connected) {
    return (
      <Callout tone="success" live="none" title={`${name} is connected`} action={dismiss}>
        The provider confirmed access. Some capabilities may still need setup or approval — each one is listed on its card below.
      </Callout>
    );
  }
  return (
    <Callout tone="danger" live="none" title={"The connection didn't finish"} action={dismiss}>
      {failed === "canceled"
        ? "Sign-in was canceled, so nothing was connected."
        : failed === "expired"
          ? "The connection link expired. Please try connecting again."
          : "The provider didn't grant access, so nothing was connected. Please try again, and make sure you approve every permission ClimbOS asks for."}
    </Callout>
  );
}
