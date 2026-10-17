"use client";

import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge, Button, Callout, ConfirmDialog, StatusPill, toast } from "@/components/ui";
import { errorInfo } from "../errors";
import { formatDateTime, relativeTime } from "../money";
import { ApiKeyDialog } from "./ApiKeyDialog";
import { AudienceSummary, ContactsCsvDialog } from "./ContactsCsvDialog";
import { CAPABILITY_STATE, CONNECTION_STATUS, isPast, SYNCABLE, type CapabilityState } from "./labels";
import { RevenueCsvDialog } from "./RevenueCsvDialog";

export type ConnectionsData = FunctionReturnType<typeof api.connections.list>;
export type ConnectionItem = ConnectionsData["items"][number];
type Provider = ConnectionItem["provider"];

function isOAuth(m: ConnectionItem["connectMethod"]) {
  return m === "oauth_google" || m === "oauth_meta" || m === "oauth_instagram";
}

export function ConnectionCard({ slug, item, canManage, isDemo }: { slug: string; item: ConnectionItem; canManage: boolean; isDemo: boolean }) {
  const startOAuth = useMutation(api.connections.startOAuth);
  const disconnect = useMutation(api.connections.disconnect);
  const syncNow = useAction(api.connectionActions.syncNow);
  const [busy, setBusy] = useState<"connect" | "sync" | null>(null);
  const [problem, setProblem] = useState<{ title: string; body: string; tone: "warning" | "danger" } | null>(null);

  const conn = item.connection;
  const status = conn ? (CONNECTION_STATUS[conn.status] ?? CONNECTION_STATUS.not_connected) : null;
  const connected = conn?.status === "connected";
  const expired = conn?.expiresAt ? isPast(conn.expiresAt) : false;
  const syncError = conn && "lastSyncError" in conn ? conn.lastSyncError : null;
  const readOnlyReason = isDemo ? "Demo workspaces can't connect real accounts." : !canManage ? "Only owners and admins can change connections." : null;

  async function onConnect() {
    setBusy("connect");
    setProblem(null);
    try {
      const { url } = await startOAuth({ slug, provider: item.provider as Provider });
      window.location.href = url;
    } catch (err) {
      const info = errorInfo(err);
      if (info.code === "UNAVAILABLE" && info.reason === "setup_needed") {
        setProblem({
          tone: "warning",
          title: "ClimbOS hasn't finished setting up this integration yet",
          body: "This is on our side, not yours. Drafts and export packs still work meanwhile, and we'll let you know when connecting is available.",
        });
      } else {
        setProblem({ tone: "danger", title: "We couldn't start connecting", body: info.message });
      }
      setBusy(null);
    }
  }

  async function onSync() {
    setBusy("sync");
    setProblem(null);
    try {
      await syncNow({ slug, provider: item.provider as Provider });
      toast({ title: `${item.name} sync finished`, description: "The last-sync time and any problems are shown on the card." });
    } catch (err) {
      setProblem({ tone: "danger", title: "Sync didn't run", body: errorInfo(err).message });
    } finally {
      setBusy(null);
    }
  }

  const headingId = `conn-${item.provider}`;

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-line bg-surface p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id={headingId} className="text-lg font-semibold text-ink">
            {item.name}
          </h3>
          <p className="mt-0.5 leading-relaxed text-ink-2">{item.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {status ? (
            <Badge tone={status.tone} icon={status.icon}>
              {status.label}
            </Badge>
          ) : item.connectMethod !== "none" ? (
            <Badge tone="neutral">Not connected</Badge>
          ) : null}
          {conn?.isFixture ? <StatusPill status="demo">Demo connection</StatusPill> : null}
        </div>
      </div>

      {conn ? (
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {conn.accountLabel ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-3">Account:</dt>
              <dd className="text-ink">{conn.accountLabel}</dd>
            </div>
          ) : null}
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Last sync:</dt>
            <dd className="text-ink">{conn.lastSyncAt ? relativeTime(conn.lastSyncAt) : "Not synced yet"}</dd>
          </div>
          {conn.expiresAt ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-3">Access:</dt>
              <dd className={expired ? "font-medium text-red-800" : "text-ink"}>
                {expired ? `Expired ${relativeTime(conn.expiresAt)} — renews on next use, or reconnect` : `Valid until ${formatDateTime(conn.expiresAt)}`}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {syncError ? (
        <Callout tone="warning" title="The last sync had a problem">
          {syncError}
        </Callout>
      ) : null}

      <div>
        <h4 className="text-sm font-semibold text-ink-2">What ClimbOS can do</h4>
        <ul className="mt-2 flex flex-col divide-y divide-line rounded-[var(--radius)] border border-line">
          {item.capabilities.map((c) => {
            const s = CAPABILITY_STATE[c.state as CapabilityState] ?? CAPABILITY_STATE.unavailable;
            return (
              <li key={c.capability} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{c.label}</p>
                  {c.reason ? <p className="text-sm leading-relaxed text-ink-2">{c.reason}</p> : null}
                  {c.fix && c.state !== "ready" ? (
                    <p className="text-sm leading-relaxed text-ink-3">
                      <span className="font-medium text-ink-2">What to do:</span> {c.fix}
                    </p>
                  ) : null}
                </div>
                <Badge tone={s.tone} icon={s.icon} className="shrink-0 self-start">
                  {s.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      </div>

      {item.provider === "crm_csv" ? <AudienceSummary slug={slug} /> : null}

      <div aria-live="polite">
        {problem ? (
          <Callout tone={problem.tone} live="none" title={problem.title}>
            {problem.body}
          </Callout>
        ) : null}
      </div>

      <Actions
        slug={slug}
        item={item}
        connected={connected}
        readOnlyReason={readOnlyReason}
        busy={busy}
        onConnect={onConnect}
        onSync={onSync}
        onDisconnect={async () => {
          try {
            await disconnect({ slug, provider: item.provider as Provider });
            toast({ tone: "success", title: `${item.name} disconnected`, description: "Access was removed from ClimbOS." });
          } catch (err) {
            setProblem({ tone: "danger", title: "We couldn't disconnect", body: errorInfo(err).message });
          }
        }}
      />
    </article>
  );
}

function Actions({
  slug,
  item,
  connected,
  readOnlyReason,
  busy,
  onConnect,
  onSync,
  onDisconnect,
}: {
  slug: string;
  item: ConnectionItem;
  connected: boolean;
  readOnlyReason: string | null;
  busy: "connect" | "sync" | null;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => Promise<void>;
}) {
  const p = item.provider;
  const disabled = Boolean(readOnlyReason);
  const buttons: ReactNode[] = [];

  if (isOAuth(item.connectMethod)) {
    buttons.push(
      <Button key="connect" variant={connected ? "secondary" : "primary"} onClick={onConnect} loading={busy === "connect"} loadingText="Opening sign-in…" disabled={disabled}>
        {connected ? "Reconnect" : `Connect ${item.name}`}
      </Button>,
    );
  } else if (item.connectMethod === "api_key" && (p === "email_resend" || p === "stripe_revenue")) {
    buttons.push(
      <ApiKeyDialog
        key="key"
        slug={slug}
        provider={p}
        trigger={
          <Button variant={connected ? "secondary" : "primary"} disabled={disabled}>
            {connected ? "Replace key" : "Connect with a key"}
          </Button>
        }
      />,
    );
  } else if (item.connectMethod === "file_upload" && p === "csv_revenue") {
    buttons.push(
      <RevenueCsvDialog
        key="csv"
        slug={slug}
        trigger={
          <Button variant={connected ? "secondary" : "primary"} disabled={disabled}>
            {connected ? "Upload another file" : "Upload a revenue file"}
          </Button>
        }
      />,
    );
  }

  if (connected && SYNCABLE.has(p)) {
    buttons.push(
      <Button key="sync" variant="secondary" onClick={onSync} loading={busy === "sync"} loadingText="Syncing…" disabled={disabled}>
        <RefreshCw aria-hidden="true" />
        Sync now
      </Button>,
    );
  }

  if (item.connection && item.connection.status !== "revoked" && item.connectMethod !== "none" && p !== "crm_csv") {
    buttons.push(
      <ConfirmDialog
        key="disconnect"
        tone="danger"
        title={`Disconnect ${item.name}?`}
        description={`ClimbOS will ask ${item.name} to revoke its access and will delete the stored key or token. Scheduled work that needs this connection won't run. Numbers already imported stay in your reports. You can reconnect at any time.`}
        confirmLabel={`Disconnect ${item.name}`}
        onConfirm={onDisconnect}
        trigger={
          <Button variant="ghost" disabled={disabled}>
            Disconnect
          </Button>
        }
      />,
    );
  }

  const isManualExport = item.capabilities.some((c) => c.capability.endsWith(".manual_export"));
  if (isManualExport) {
    buttons.push(
      <Button key="export" variant="secondary" asChild>
        <Link href={`/app/${slug}/content`}>
          Open drafts and export packs
          <ArrowRight aria-hidden="true" />
        </Link>
      </Button>,
    );
  }

  if (item.connectMethod === "file_upload" && p === "crm_csv") {
    buttons.push(
      <ContactsCsvDialog
        key="contacts"
        slug={slug}
        trigger={
          <Button variant={item.connection ? "secondary" : "primary"} disabled={disabled}>
            {item.connection ? "Upload another list" : "Upload a contact list"}
          </Button>
        }
      />,
    );
  }

  if (buttons.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex flex-wrap gap-2">{buttons}</div>
      {readOnlyReason && !isManualExport ? <p className="text-sm text-ink-3">{readOnlyReason}</p> : null}
    </div>
  );
}
