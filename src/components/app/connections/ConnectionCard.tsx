"use client";

import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { ArrowRight, Contact, CreditCard, FileSpreadsheet, Globe, RefreshCw, UserSearch, type LucideIcon } from "@/components/icons"
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Badge, Button, Callout, ConfirmDialog, IconTile, SocialIcon, StatusPill, toast, type Tone } from "@/components/ui";

/** Real network marks for social/ad/analytics providers; neutral icon tiles for the rest. */
const PROVIDER_NETWORK: Record<string, string> = {
  website: "website",
  ga4: "google",
  search_console: "google",
  google_ads: "google",
  google_business_profile: "google",
  meta_ads: "facebook",
  facebook_pages: "facebook",
  instagram: "instagram",
  email_resend: "email",
  linkedin: "linkedin",
  x: "x",
  tiktok: "tiktok",
  pinterest: "pinterest",
  youtube: "youtube",
};
const PROVIDER_VISUAL: Record<string, { icon: LucideIcon; tone: Tone }> = {
  stripe_revenue: { icon: CreditCard, tone: "violet" },
  csv_revenue: { icon: FileSpreadsheet, tone: "green" },
  crm_csv: { icon: Contact, tone: "teal" },
  enrichment: { icon: UserSearch, tone: "brand" },
};

function ProviderMark({ provider }: { provider: string }) {
  const network = PROVIDER_NETWORK[provider];
  if (network) return <SocialIcon network={network} variant="tile" size="xl" />;
  const v = PROVIDER_VISUAL[provider] ?? { icon: Globe, tone: "neutral" as Tone };
  return <IconTile icon={v.icon} tone={v.tone} size="md" className="size-9" />;
}
import { errorInfo } from "../errors";
import { formatDateTime, relativeTime } from "../money";
import { AccountChooser, ACCOUNT_KIND } from "./AccountChooser";
import { ApiKeyDialog } from "./ApiKeyDialog";
import { AudienceSummary, ContactsCsvDialog } from "./ContactsCsvDialog";
import { CAPABILITY_STATE, CONNECTION_STATUS, isPast, SYNCABLE, type CapabilityState } from "./labels";
import { RevenueCsvDialog } from "./RevenueCsvDialog";
import { SearchConsoleSetup } from "./SearchConsoleSetup";
import { GoogleAdsSetup } from "./GoogleAdsSetup";
import { WordPressConnectDialog } from "./WordPressConnectDialog";

export type ConnectionsData = FunctionReturnType<typeof api.connections.list>;
export type ConnectionItem = ConnectionsData["items"][number];
type Provider = ConnectionItem["provider"];

function isOAuth(m: ConnectionItem["connectMethod"]) {
  return m === "oauth_google" || m === "oauth_meta" || m === "oauth_instagram" || m === "oauth_linkedin" || m === "oauth_x";
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
  const readOnlyReason = isDemo ? "Demo: no real accounts." : !canManage ? "Owners and admins only." : null;

  async function onConnect(variant?: "linkedin_pages") {
    setBusy("connect");
    setProblem(null);
    try {
      const { url } = await startOAuth({ slug, provider: item.provider as Provider, ...(variant ? { variant } : {}) });
      window.location.href = url;
    } catch (err) {
      const info = errorInfo(err);
      if (info.code === "UNAVAILABLE" && info.reason === "setup_needed") {
        setProblem({
          tone: "warning",
          title: "Not available yet",
          body: "Our side, not yours. Drafts and exports still work.",
        });
      } else {
        setProblem({ tone: "danger", title: "Couldn't connect", body: info.message });
      }
      setBusy(null);
    }
  }

  async function onSync() {
    setBusy("sync");
    setProblem(null);
    try {
      await syncNow({ slug, provider: item.provider as Provider });
      toast({ title: `${item.name} synced` });
    } catch (err) {
      setProblem({ tone: "danger", title: "Sync didn't run", body: errorInfo(err).message });
    } finally {
      setBusy(null);
    }
  }

  const headingId = `conn-${item.provider}`;

  return (
    <article aria-labelledby={headingId} className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <ProviderMark provider={item.provider} />
          <div className="min-w-0">
            <h3 id={headingId} className="heading-card">
              {item.name}
            </h3>
            <p className="mt-0.5 text-ui text-ink-3">{item.description}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {status ? (
            <Badge tone={status.tone} icon={status.icon}>
              {status.label}
            </Badge>
          ) : item.connectMethod !== "none" ? (
            <Badge tone="neutral">Not connected</Badge>
          ) : null}
          {conn?.isFixture ? <StatusPill status="demo">Demo</StatusPill> : null}
        </div>
      </div>

      {connected && item.choice ? (
        <ConnectedAccount
          slug={slug}
          item={item}
          disabled={Boolean(readOnlyReason)}
          onSignIn={(variant) => void onConnect(variant)}
        />
      ) : null}

      {conn ? (
        <dl className="grid gap-x-6 gap-y-1 text-ui sm:grid-cols-2">
          {conn.accountLabel && !(connected && item.choice) ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-3">Account:</dt>
              <dd className="text-ink">{conn.accountLabel}</dd>
            </div>
          ) : null}
          <div className="flex gap-1.5">
            <dt className="text-ink-3">Last sync:</dt>
            <dd className="text-ink">{conn.lastSyncAt ? relativeTime(conn.lastSyncAt) : "Never"}</dd>
          </div>
          {conn.expiresAt ? (
            <div className="flex gap-1.5">
              <dt className="text-ink-3">Access:</dt>
              <dd className={expired ? "font-medium text-red-800" : "text-ink"}>
                {expired ? `Expired ${relativeTime(conn.expiresAt)} · renews on use` : `Valid until ${formatDateTime(conn.expiresAt)}`}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {syncError ? (
        <Callout tone="warning" title="Last sync failed">
          {syncError}
        </Callout>
      ) : null}

      <div>
        <h4 className="flex items-baseline gap-2 text-ui font-semibold text-ink-2">
          Can do{" "}
          <span className="text-xs font-normal tabular-nums text-ink-3">
            {item.capabilities.filter((c) => c.state === "ready").length}/{item.capabilities.length} ready
          </span>
        </h4>
        <ul className="mt-2 flex flex-col divide-y divide-line rounded-xl border border-line">
          {item.capabilities.map((c) => {
            const s = CAPABILITY_STATE[c.state as CapabilityState] ?? CAPABILITY_STATE.unavailable;
            return (
              <li key={c.capability} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-ui font-medium text-ink">{c.label}</p>
                  {c.reason || (c.fix && c.state !== "ready") ? (
                    <dl className="mt-1 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-2 gap-y-1 text-ui">
                      {c.reason ? (
                        <>
                          <dt className="text-xs font-medium leading-5 text-ink-3">Why</dt>
                          <dd className="max-w-[70ch] text-ink-2">{c.reason}</dd>
                        </>
                      ) : null}
                      {c.fix && c.state !== "ready" ? (
                        <>
                          <dt className="text-xs font-medium leading-5 text-ink-3">Fix</dt>
                          <dd className="max-w-[70ch] font-medium text-ink">{c.fix}</dd>
                        </>
                      ) : null}
                    </dl>
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
      {item.provider === "search_console" ? (
        <SearchConsoleSetup
          slug={slug}
          connected={connected}
          canManage={canManage}
          isDemo={isDemo || Boolean(conn?.isFixture)}
          selectedProperty={"externalAccountId" in (conn ?? {}) ? conn?.externalAccountId ?? null : null}
        />
      ) : null}
      {item.provider === "google_ads" ? (
        <GoogleAdsSetup
          slug={slug}
          connected={connected}
          canManage={canManage}
          isDemo={isDemo || Boolean(conn?.isFixture)}
          selectedAccount={conn?.externalAccountId ?? null}
        />
      ) : null}

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
            const res = await disconnect({ slug, provider: item.provider as Provider });
            toast({
              tone: "success",
              title: `${item.name} disconnected`,
              description: res?.manualStep ?? (res?.revokedAtProvider ? `ClimbOS asked ${item.name} to revoke its access and is deleting the stored key.` : "The stored key was deleted."),
            });
          } catch (err) {
            setProblem({ tone: "danger", title: "Couldn't disconnect", body: errorInfo(err).message });
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
  onConnect: (variant?: "linkedin_pages") => void;
  onSync: () => void;
  onDisconnect: () => Promise<void>;
}) {
  const p = item.provider;
  const disabled = Boolean(readOnlyReason);
  const buttons: ReactNode[] = [];

  if (isOAuth(item.connectMethod)) {
    buttons.push(
      <Button key="connect" variant="secondary" onClick={() => onConnect()} loading={busy === "connect"} loadingText="Opening…" disabled={disabled} aria-label={`${connected ? "Reconnect" : "Connect"} ${item.name}${p === "linkedin" && !connected ? " profile" : ""}`}>
        {connected ? "Reconnect" : p === "linkedin" && item.pagesSignIn ? "Connect profile" : "Connect"}
      </Button>,
    );
    if (p === "linkedin" && !connected && item.pagesSignIn) {
      buttons.push(
        <Button key="connect-page" variant="secondary" onClick={() => onConnect("linkedin_pages")} disabled={disabled || busy === "connect"} aria-label="Connect a LinkedIn Page">
          Connect a Page
        </Button>,
      );
    }
  } else if (item.connectMethod === "api_key" && (p === "email_resend" || p === "stripe_revenue")) {
    buttons.push(
      <ApiKeyDialog
        key="key"
        slug={slug}
        provider={p}
        trigger={
          <Button variant="secondary" disabled={disabled}>
            {connected ? "Replace key" : "Add key"}
          </Button>
        }
      />,
    );
  } else if (item.connectMethod === "wordpress_app_password" && p === "wordpress") {
    buttons.push(
      <WordPressConnectDialog
        key="wordpress"
        slug={slug}
        trigger={<Button variant="secondary" disabled={disabled}>{connected ? "Replace Application Password" : "Connect WordPress"}</Button>}
      />,
    );
  } else if (item.connectMethod === "file_upload" && p === "csv_revenue") {
    buttons.push(
      <RevenueCsvDialog
        key="csv"
        slug={slug}
        trigger={
          <Button variant="secondary" disabled={disabled}>
            {connected ? "Upload more" : "Upload CSV"}
          </Button>
        }
      />,
    );
  }

  if (connected && SYNCABLE.has(p)) {
    buttons.push(
      <Button key="sync" variant="secondary" onClick={onSync} loading={busy === "sync"} loadingText="Syncing…" disabled={disabled}>
        <RefreshCw aria-hidden="true" />
        Sync
      </Button>,
    );
  }

  if (item.connection && item.connection.status !== "revoked" && item.connectMethod !== "none" && p !== "crm_csv") {
    buttons.push(
      <ConfirmDialog
        key="disconnect"
        tone="danger"
        title={`Disconnect ${item.name}?`}
        description="Revokes access and deletes the key. Scheduled work using it stops. Imported numbers stay."
        confirmLabel="Disconnect"
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
          Drafts
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
          <Button variant="secondary" disabled={disabled}>
            {item.connection ? "Upload more" : "Upload list"}
          </Button>
        }
      />,
    );
  }

  if (buttons.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="flex flex-wrap gap-2">{buttons}</div>
      {readOnlyReason && !isManualExport ? <p className="text-xs text-ink-3">{readOnlyReason}</p> : null}
    </div>
  );
}

/** "Connected: <Page name>" with what it is, and Change (pick another Page, profile or location). */
function ConnectedAccount({ slug, item, disabled, onSignIn }: { slug: string; item: ConnectionItem; disabled: boolean; onSignIn: (variant?: "linkedin_pages") => void }) {
  const conn = item.connection!;
  const needed = Boolean(item.choice?.needed);
  const kind = conn.accountType ? ACCOUNT_KIND[conn.accountType] : undefined;
  return (
    <div className="flex flex-col gap-3">
      {needed ? (
        <Callout tone="warning" title={`Choose your ${item.choice!.noun}`}>
          {conn.accountLabel ? `${conn.accountLabel}. ` : ""}ClimbOS won&apos;t publish or read anything until you pick one.
        </Callout>
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-2 text-ui">
          <span className="text-ink-3">Connected:</span>
          <span className="font-semibold text-ink">{conn.accountLabel ?? item.name}</span>
          {kind ? <span className="text-ink-3">· {kind}</span> : null}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <AccountChooser key={`${conn.externalAccountId ?? "none"}-${needed}`} slug={slug} item={item} disabled={disabled} autoOpen={needed} onSignIn={onSignIn} />
      </div>
    </div>
  );
}
