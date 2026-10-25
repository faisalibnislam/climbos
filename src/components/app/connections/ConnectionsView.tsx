"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { Button, Callout, toast } from "@/components/ui";
import { LoadingBlock, PageHeader } from "../results/QueryBoundary";
import { ConnectionCard, type ConnectionsData } from "./ConnectionCard";
import { GROUPS } from "./labels";
import { MailboxSection } from "./MailboxSection";
import { ConnectedProducts } from "./ConnectedProducts";

export function ConnectionsView({ slug }: { slug: string }) {
  const data = useQuery(api.connections.list, { slug });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <PageHeader section="connections" title="Connections" />

      <Suspense fallback={null}>
        <OAuthReturnNotice data={data} />
      </Suspense>

      {data === undefined ? (
        <LoadingBlock label="Loading connections…" lines={4} />
      ) : (
        <>
          {data.isDemo ? (
            <Callout tone="info" title="Demo workspace">
              Synthetic data. Use your own workspace for real accounts.
            </Callout>
          ) : null}
          {!data.canManage && !data.isDemo ? (
            <Callout tone="info" title="View only">
              Only owners and admins can change these.
            </Callout>
          ) : null}

          <MailboxSection slug={slug} />
          <ConnectedProducts slug={slug} canManage={data.canManage} />

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
                {g.key === "publish" ? <ExportOnlyNotice items={items} /> : null}
                {g.key === "data" ? (
                  <Callout tone="info" title="ClimbOS has no contact database">
                    For email lookups, connect a provider you license.
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

/** Names the publish platforms that are drafts-and-export only right now. */
function ExportOnlyNotice({ items }: { items: ConnectionsData["items"] }) {
  const names = items.filter((i) => i.capabilities.some((c) => c.capability.endsWith(".manual_export"))).map((i) => i.name);
  if (names.length === 0) return null;
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return (
    <Callout tone="info" title="Drafts + export only">
      {list}: no verified integration yet. Copy or download drafts.
    </Callout>
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
    if (connected) toast({ tone: "success", title: "Connected" });
    else toast({ tone: "danger", title: "Connection didn't finish", description: "Nothing connected. Try again." });
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
        Some features may still need setup. See its card.
      </Callout>
    );
  }
  return (
    <Callout tone="danger" live="none" title={"The connection didn't finish"} action={dismiss}>
      {failed === "canceled"
        ? "Sign-in canceled. Nothing connected."
        : failed === "expired"
          ? "Link expired. Try again."
          : "Access not granted. Try again and approve every permission."}
    </Callout>
  );
}
