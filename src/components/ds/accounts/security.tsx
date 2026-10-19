"use client";

/*
 * Security: SecuritySettings (2FA with setup dialog, login alerts, team 2FA,
 * recovery codes), ApiKeyManager (masked keys, create once-shown, revoke),
 * ConnectedAccounts (connect / reconnect / disconnect) and SessionManager.
 */
import { useId, useState, type ReactNode } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Monitor,
  Plus,
  QrCode,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
} from "@/components/icons";
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  Field,
  Input,
  Select,
  SocialIcon,
  Switch,
  toast,
} from "@/components/ui";
import { cn } from "@/lib/utils";

/** Copy text and flip a "copied" flag for 1.6s. */
export function useCopied() {
  const [copied, setCopied] = useState(false);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard can be blocked; the visible state still confirms the action */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return { copied, copy };
}

function Row({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-3.5 first:border-t-0 first:pt-0">
      <div className="min-w-0 flex-1 basis-60">
        <p className="text-ui font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-3">{body}</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Security settings                                                   */
/* ------------------------------------------------------------------ */

const RECOVERY = ["7KQ2-M9XD", "P4LT-8WRZ", "C6NB-2HVA", "X9FE-5JQT", "R3MU-7YKP", "H8DS-4GWN"];

/** Account security panel. Turning 2FA on runs a short setup; turning it off asks first. */
export function SecuritySettings({ isOwner = true }: { isOwner?: boolean }) {
  const [twoFa, setTwoFa] = useState(false);
  const [setup, setSetup] = useState(false);
  const [code, setCode] = useState("");
  const [confirmOff, setConfirmOff] = useState(false);
  const [alerts, setAlerts] = useState(true);
  const [teamTwoFa, setTeamTwoFa] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const codeOk = /^\d{6}$/.test(code);

  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="heading-card">Security</h3>
        {twoFa ? (
          <Badge tone="green" icon={<ShieldCheck />}>
            Protected
          </Badge>
        ) : (
          <Badge tone="amber" icon={<TriangleAlert />}>
            2FA off
          </Badge>
        )}
      </div>
      <Row title="Two-factor authentication" body="A code from your authenticator app at every sign-in.">
        <Switch label={<span className="sr-only">Two-factor authentication</span>} checked={twoFa} onCheckedChange={(on) => (on ? setSetup(true) : setConfirmOff(true))} />
      </Row>
      <Row title="Password" body="Last changed 3 months ago.">
        <Button size="sm" variant="secondary">
          <Lock /> Change password
        </Button>
      </Row>
      <Row title="Sign-in alerts" body="Email me when someone signs in from a new device.">
        <Switch label={<span className="sr-only">Sign-in alerts</span>} checked={alerts} onCheckedChange={setAlerts} />
      </Row>
      {isOwner ? (
        <Row title="Require 2FA for the team" body="Members without 2FA are asked to set it up at next sign-in.">
          <Switch label={<span className="sr-only">Require 2FA for the team</span>} checked={teamTwoFa} onCheckedChange={setTeamTwoFa} />
        </Row>
      ) : null}
      <Row title="Recovery codes" body="Use one if you lose your phone. Each works once.">
        <Button size="sm" variant="ghost" onClick={() => setShowCodes((v) => !v)} aria-expanded={showCodes} disabled={!twoFa}>
          {showCodes ? <EyeOff /> : <Eye />} {showCodes ? "Hide" : "Show"} codes
        </Button>
      </Row>
      {showCodes && twoFa ? (
        <ul aria-label="Recovery codes" className="mt-1 grid grid-cols-2 gap-1.5 rounded-[var(--radius-control)] bg-surface-2 p-3 font-mono text-xs tabular-nums sm:grid-cols-3">
          {RECOVERY.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}

      <Dialog
        open={setup}
        onOpenChange={(o) => {
          setSetup(o);
          if (!o) setCode("");
        }}
      >
        <DialogContent title="Turn on two-factor" description="Scan with Google Authenticator, 1Password or similar, then enter the 6-digit code.">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!codeOk) return;
              setTwoFa(true);
              setSetup(false);
              setCode("");
              toast({ title: "Two-factor is on", description: "Save your recovery codes somewhere safe.", tone: "success" });
            }}
          >
            <div className="flex items-center gap-4">
              <span role="img" aria-label="QR code for your authenticator app" className="grid size-28 shrink-0 place-items-center rounded-[var(--radius-control)] border border-line bg-surface-2">
                <QrCode aria-hidden className="size-16 text-ink" />
              </span>
              <p className="text-xs text-ink-3">Can’t scan? Enter this setup key: <span className="font-mono text-ink">JBSW Y3DP EHPK 3PXP</span></p>
            </div>
            <Field label="6-digit code" error={code.length === 6 && !codeOk ? "Numbers only." : undefined}>
              <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))} placeholder="123456" className="max-w-40 font-mono tracking-[0.3em]" />
            </Field>
            <DialogFooter className="mt-0">
              <Button type="button" variant="secondary" onClick={() => setSetup(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!codeOk}>
                Verify and turn on
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Turn off two-factor?"
        description="Anyone with your password could sign in. Recovery codes stop working."
        confirmLabel="Turn off 2FA"
        cancelLabel="Keep it on"
        tone="danger"
        onConfirm={() => {
          setTwoFa(false);
          setShowCodes(false);
        }}
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* API keys                                                            */
/* ------------------------------------------------------------------ */

export interface ApiKey {
  id: string;
  name: string;
  /** Last 4 characters only; the full key is never stored in the client. */
  last4: string;
  mode: "live" | "test";
  scope: "read" | "write";
  created: string;
  lastUsed: string;
  revoked?: boolean;
}

/** "sk_live_••••3f9a" */
export const maskKey = (k: Pick<ApiKey, "mode" | "last4">) => `sk_${k.mode}_••••${k.last4}`;

/** Deterministic fake key body for demos (no randomness at render). */
function fakeKeyBody(seed: string) {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  let h = 2166136261;
  let out = "";
  for (let i = 0; i < 28; i++) {
    h = Math.imul(h ^ (seed.charCodeAt(i % seed.length) + i), 16777619) >>> 0;
    out += abc[h % abc.length];
  }
  return out;
}

export interface ApiKeyManagerProps {
  keys: ApiKey[];
  onChange: (keys: ApiKey[]) => void;
}

/** List, create and revoke API keys. A new key is shown once, then only its last 4. */
export function ApiKeyManager({ keys, onChange }: ApiKeyManagerProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiKey["scope"]>("read");
  const [mode, setMode] = useState<ApiKey["mode"]>("live");
  const [created, setCreated] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const { copied, copy } = useCopied();
  const formId = useId();

  const close = () => {
    setOpen(false);
    setName("");
    setScope("read");
    setMode("live");
    setCreated(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-3">Keys act as your account. Keep them on your server, never in a browser.</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Create key
        </Button>
      </div>
      <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full min-w-[620px] text-ui">
          <caption className="sr-only">API keys</caption>
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th scope="col" className="h-[var(--cell-h)] px-4 font-medium">Name</th>
              <th scope="col" className="px-3 font-medium">Key</th>
              <th scope="col" className="px-3 font-medium">Access</th>
              <th scope="col" className="px-3 font-medium">Last used</th>
              <th scope="col" className="px-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className={cn("border-t border-line first:border-t-0", k.revoked && "text-ink-3")}>
                <td className="h-[var(--cell-h)] px-4">
                  <span className="flex items-center gap-2">
                    <KeyRound aria-hidden className="size-4 text-ink-3" />
                    <span className={cn("font-medium", k.revoked ? "line-through" : "text-ink")}>{k.name}</span>
                    {k.mode === "test" ? <Badge tone="violet">Test</Badge> : null}
                  </span>
                  <span className="block pl-6 text-xs text-ink-3">Created {k.created}</span>
                </td>
                <td className="px-3 font-mono text-xs">{maskKey(k)}</td>
                <td className="px-3">{k.scope === "write" ? "Read & write" : "Read only"}</td>
                <td className="px-3 tabular-nums">{k.revoked ? <Badge tone="red">Revoked</Badge> : k.lastUsed}</td>
                <td className="px-3 text-right">
                  {!k.revoked ? (
                    <Button size="sm" variant="ghost" className="text-red-800" onClick={() => setRevoking(k)}>
                      Revoke
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <DialogContent title={created ? "Copy your key now" : "Create API key"} description={created ? "You won’t see it again. Store it in your server’s secrets." : "Name it after where it will run."}>
          {created ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-2 p-2 pl-3">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-ink">{created}</code>
                <Button size="sm" variant="secondary" onClick={() => copy(created)}>
                  {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <span aria-live="polite" className="sr-only">{copied ? "Key copied" : ""}</span>
              <DialogFooter className="mt-2">
                <Button onClick={close}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              id={formId}
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                const body = fakeKeyBody(`${name}-${keys.length}`);
                const full = ["sk", mode, body].join("_");
                onChange([{ id: `k${keys.length + 1}-${body.slice(0, 4)}`, name: name.trim(), last4: body.slice(-4), mode, scope, created: "today", lastUsed: "Never" }, ...keys]);
                setCreated(full);
              }}
            >
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier sync" autoFocus />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Access">
                  <Select value={scope} onValueChange={(v) => setScope(v as ApiKey["scope"])} options={[{ value: "read", label: "Read only" }, { value: "write", label: "Read & write" }]} />
                </Field>
                <Field label="Mode">
                  <Select value={mode} onValueChange={(v) => setMode(v as ApiKey["mode"])} options={[{ value: "live", label: "Live" }, { value: "test", label: "Test (no credits used)" }]} />
                </Field>
              </div>
              <DialogFooter className="mt-2">
                <Button type="button" variant="secondary" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!name.trim()}>
                  Create key
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(o) => !o && setRevoking(null)}
        title={`Revoke “${revoking?.name ?? ""}”?`}
        description="Anything using this key stops working right away. This can’t be undone."
        confirmLabel="Revoke key"
        tone="danger"
        onConfirm={() => {
          if (revoking) onChange(keys.map((k) => (k.id === revoking.id ? { ...k, revoked: true } : k)));
          setRevoking(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connected accounts                                                  */
/* ------------------------------------------------------------------ */

export interface Connection {
  id: string;
  network: string;
  label: string;
  /** What it's used for, one line. */
  use: string;
  status: "connected" | "expired" | "off";
  account?: string;
}

/** Sign-in and channel connections. Expired tokens ask to reconnect; disconnect asks first. */
export function ConnectedAccounts({ connections, onChange }: { connections: Connection[]; onChange: (c: Connection[]) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [dropping, setDropping] = useState<Connection | null>(null);
  const connect = (c: Connection) => {
    setBusy(c.id);
    window.setTimeout(() => {
      onChange(connections.map((x) => (x.id === c.id ? { ...x, status: "connected", account: x.account ?? "@tartinebakery" } : x)));
      setBusy(null);
      toast({ title: `${c.label} connected`, tone: "success" });
    }, 900);
  };
  return (
    <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
      {connections.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <SocialIcon network={c.network} variant="tile" size="md" />
          <div className="min-w-0 flex-1 basis-48">
            <p className="flex flex-wrap items-center gap-1.5 text-ui font-medium text-ink">
              {c.label}
              {c.status === "connected" ? <Badge tone="green">Connected</Badge> : c.status === "expired" ? <Badge tone="amber" icon={<TriangleAlert />}>Needs reconnect</Badge> : null}
            </p>
            <p className="truncate text-xs text-ink-3">{c.status !== "off" && c.account ? `${c.account} · ${c.use}` : c.use}</p>
          </div>
          {c.status === "connected" ? (
            <Button size="sm" variant="ghost" onClick={() => setDropping(c)}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" variant={c.status === "expired" ? "primary" : "secondary"} loading={busy === c.id} loadingText="Connecting…" onClick={() => connect(c)}>
              {c.status === "expired" ? "Reconnect" : "Connect"}
            </Button>
          )}
        </li>
      ))}
      <ConfirmDialog
        open={dropping !== null}
        onOpenChange={(o) => !o && setDropping(null)}
        title={`Disconnect ${dropping?.label ?? ""}?`}
        description="Scheduled posts and syncs for this account pause until you reconnect."
        confirmLabel="Disconnect"
        tone="danger"
        onConfirm={() => {
          if (dropping) onChange(connections.map((x) => (x.id === dropping.id ? { ...x, status: "off" } : x)));
          setDropping(null);
        }}
      />
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export interface Session {
  id: string;
  device: "desktop" | "mobile";
  name: string;
  place: string;
  lastActive: string;
  current?: boolean;
}

/** Where you're signed in. Sign out one session, or every other one. */
export function SessionManager({ sessions, onChange }: { sessions: Session[]; onChange: (s: Session[]) => void }) {
  const others = sessions.filter((s) => !s.current);
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
        {sessions.map((s) => {
          const Icon = s.device === "mobile" ? Smartphone : Monitor;
          return (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-surface-2 text-ink-2">
                <Icon aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-ui font-medium text-ink">
                  {s.name}
                  {s.current ? <Badge tone="green">This device</Badge> : null}
                </p>
                <p className="text-xs text-ink-3">
                  {s.place} · {s.current ? "Active now" : s.lastActive}
                </p>
              </div>
              {!s.current ? (
                <Button size="sm" variant="ghost" onClick={() => onChange(sessions.filter((x) => x.id !== s.id))}>
                  Sign out
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {others.length ? (
        <ConfirmDialog
          trigger={
            <Button variant="secondary" size="sm" className="self-start">
              Sign out of {others.length} other {others.length === 1 ? "session" : "sessions"}
            </Button>
          }
          title="Sign out everywhere else?"
          description="Every device except this one has to sign in again."
          confirmLabel="Sign out others"
          onConfirm={() => onChange(sessions.filter((s) => s.current))}
        />
      ) : (
        <Callout tone="success">Only this device is signed in.</Callout>
      )}
    </div>
  );
}
