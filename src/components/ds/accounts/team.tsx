"use client";

/*
 * Team: UserProfileMenu, TeamMemberList (search, inline role change, row menu),
 * EmailChipsInput and InviteMemberDialog (emails as chips + role + workspaces).
 */
import { useId, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown, Coins, CreditCard, Keyboard, LogOut, Mail, MoreHorizontal, Plus, RefreshCw, Search, Send, Settings, Trash2, UserRound, X } from "@/components/icons";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogFooter,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Kbd,
  Label,
  toast,
} from "@/components/ui";
import { cn, formatNumber, plural } from "@/lib/utils";
import { PRESENCE, UserAvatar, type Presence } from "./avatar";
import { RoleSelector, roleLabel, type Role } from "./roles";

/* ------------------------------------------------------------------ */
/* Profile menu                                                        */
/* ------------------------------------------------------------------ */

export interface UserProfileMenuProps {
  name: string;
  email: string;
  role: Role;
  workspace: string;
  credits: number;
  presence: Presence;
  onPresenceChange: (p: Presence) => void;
  onSignOut?: () => void;
}

/** Account menu from the sidebar footer: who you are, status, credits and account links. */
export function UserProfileMenu({ name, email, role, workspace, credits, presence, onPresenceChange, onSignOut }: UserProfileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full max-w-[260px] items-center gap-3 rounded-[var(--radius-card)] bg-surface p-2.5 text-left shadow-[var(--card-shadow)] hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]"
        >
          <UserAvatar name={name} presence={presence} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-ink-3">{workspace}</span>
          </span>
          <ChevronsUpDown aria-hidden className="size-4 text-ink-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <UserAvatar name={name} size="lg" presence={presence} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-ink-3">{email}</p>
            <Badge className="mt-1">{roleLabel(role)}</Badge>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {(["online", "away", "busy"] as Presence[]).map((p) => (
          <DropdownMenuItem key={p} onSelect={() => onPresenceChange(p)}>
            <span aria-hidden className={cn("size-2 rounded-full", PRESENCE[p].dot)} />
            <span className="flex-1">{PRESENCE[p].label}</span>
            {presence === p ? (
              <>
                <Check aria-hidden className="text-brand-800" />
                <span className="sr-only">(current)</span>
              </>
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<UserRound />}>Profile</DropdownMenuItem>
        <DropdownMenuItem icon={<Settings />}>Account settings</DropdownMenuItem>
        <DropdownMenuItem icon={<CreditCard />}>Billing</DropdownMenuItem>
        <DropdownMenuItem icon={<Coins />}>
          <span className="flex-1">Credits</span>
          <span className="text-xs tabular-nums text-ink-3">{formatNumber(credits)} left</span>
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Keyboard />}>
          <span className="flex-1">Keyboard shortcuts</span>
          <Kbd>?</Kbd>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<LogOut />} onSelect={onSignOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Team member list                                                    */
/* ------------------------------------------------------------------ */

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  workspaces: string[] | "all";
  lastActive: string;
  presence?: Presence;
  invited?: boolean;
}

export interface TeamMemberListProps {
  members: Member[];
  onChange: (members: Member[]) => void;
  /** The signed-in user's id; they can't remove or demote themselves here. */
  meId: string;
}

/** Members table: search, role per row, workspace access, last active, row menu (resend / remove). */
export function TeamMemberList({ members, onChange, meId }: TeamMemberListProps) {
  const [q, setQ] = useState("");
  const [removing, setRemoving] = useState<Member | null>(null);
  const shown = members.filter((m) => `${m.name} ${m.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const setRole = (id: string, role: Role) => onChange(members.map((m) => (m.id === id ? { ...m, role } : m)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Search members</span>
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="pl-8" />
        </label>
        <p className="text-xs text-ink-3">
          {plural(members.filter((m) => !m.invited).length, "member")} · {plural(members.filter((m) => m.invited).length, "pending invite")}
        </p>
      </div>
      <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full min-w-[640px] text-ui">
          <caption className="sr-only">Team members</caption>
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th scope="col" className="h-[var(--cell-h)] px-4 font-medium">Member</th>
              <th scope="col" className="px-3 font-medium">Role</th>
              <th scope="col" className="px-3 font-medium">Workspaces</th>
              <th scope="col" className="px-3 font-medium">Last active</th>
              <th scope="col" className="w-12 px-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const isMe = m.id === meId;
              const who = m.name || m.email;
              return (
                <tr key={m.id} className="border-t border-line first:border-t-0 hover:bg-surface-2/60">
                  <td className="h-[var(--cell-h)] px-4 py-2">
                    <span className="flex items-center gap-2.5">
                      <UserAvatar name={who} presence={m.invited ? undefined : m.presence} size="sm" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-medium text-ink">
                          {m.invited ? m.email : m.name}
                          {isMe ? <Badge>You</Badge> : null}
                          {m.invited ? <Badge tone="amber">Invited</Badge> : null}
                        </span>
                        {!m.invited ? <span className="block text-xs text-ink-3">{m.email}</span> : null}
                      </span>
                    </span>
                  </td>
                  <td className="px-3">
                    {m.role === "owner" || isMe ? (
                      <span className="text-ink-2">{roleLabel(m.role)}</span>
                    ) : (
                      <RoleSelector size="sm" value={m.role} onChange={(r) => setRole(m.id, r)} disabledRoles={["owner"]} hiddenRoles={["staff"]} aria-label={`Role for ${who}`} />
                    )}
                  </td>
                  <td className="px-3 text-ink-2">{m.workspaces === "all" ? "All workspaces" : m.workspaces.join(", ")}</td>
                  <td className="px-3 tabular-nums text-ink-3">{m.lastActive}</td>
                  <td className="px-3">
                    {m.role !== "owner" && !isMe ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger aria-label={`Actions for ${who}`} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]">
                          <MoreHorizontal aria-hidden className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {m.invited ? (
                            <DropdownMenuItem icon={<RefreshCw />} onSelect={() => toast({ title: "Invite resent", description: m.email, tone: "success" })}>
                              Resend invite
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem icon={<Mail />}>Email {m.name.split(" ")[0]}</DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem danger icon={<Trash2 />} onSelect={() => setRemoving(m)}>
                            {m.invited ? "Cancel invite" : "Remove from team"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-3">
                  No one matches “{q}”.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={removing?.invited ? "Cancel this invite?" : `Remove ${removing?.name || "member"}?`}
        description={removing?.invited ? "The invite link stops working." : "They lose access to every workspace now. Their posts and plays stay."}
        confirmLabel={removing?.invited ? "Cancel invite" : "Remove member"}
        cancelLabel="Keep"
        tone="danger"
        onConfirm={() => {
          if (removing) onChange(members.filter((m) => m.id !== removing.id));
          setRemoving(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Email chips + invite dialog                                         */
/* ------------------------------------------------------------------ */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface EmailChipsInputProps {
  value: string[];
  onChange: (emails: string[]) => void;
  id?: string;
  placeholder?: string;
  describedBy?: string;
}

/** Type or paste emails; Enter, comma or space makes a chip, Backspace removes the last. Invalid chips are marked. */
export function EmailChipsInput({ value, onChange, id, placeholder = "name@business.com", describedBy }: EmailChipsInputProps) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return;
    onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (["Enter", ",", " ", "Tab"].includes(e.key) && draft.trim()) {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    add(e.clipboardData.getData("text"));
  };
  return (
    <div className="flex min-h-[var(--h-lg)] flex-wrap items-center gap-1.5 rounded-[var(--radius-field)] border border-control bg-surface px-2 py-1.5 focus-within:border-brand-700 focus-within:outline-2 focus-within:outline-brand-600">
      {value.map((email) => {
        const ok = EMAIL.test(email);
        return (
          <span key={email} className={cn("inline-flex h-6 items-center gap-1 rounded-[var(--radius-badge)] pl-2 pr-0.5 text-xs font-medium", ok ? "bg-surface-2 text-ink" : "bg-red-100 text-red-800")}>
            {ok ? null : <span className="sr-only">Invalid: </span>}
            {email}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== email))} aria-label={`Remove ${email}`} className="grid size-5 place-items-center rounded-[3px] hover:bg-black/5">
              <X aria-hidden className="size-3" />
            </button>
          </span>
        );
      })}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onPaste={onPaste}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={value.length ? "" : placeholder}
        aria-describedby={describedBy}
        className="h-6 min-w-[10ch] flex-1 bg-transparent text-ui outline-none placeholder:text-ink-3"
      />
    </div>
  );
}

export interface InviteMemberDialogProps {
  workspaces: string[];
  onInvite: (emails: string[], role: Role, workspaces: string[]) => void;
  /** Seats left on the plan; inviting more than this is blocked. */
  seatsLeft?: number;
}

/** Invite several people at once with one role and a set of workspaces. */
export function InviteMemberDialog({ workspaces, onInvite, seatsLeft }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [role, setRole] = useState<Role>("member");
  const [ws, setWs] = useState<string[]>(workspaces.slice(0, 1));
  const id = useId();
  const valid = emails.filter((e) => EMAIL.test(e));
  const invalid = emails.length - valid.length;
  const over = seatsLeft !== undefined && valid.length > seatsLeft;
  const reset = () => {
    setEmails([]);
    setRole("member");
    setWs(workspaces.slice(0, 1));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Button onClick={() => setOpen(true)}>
        <Plus /> Invite members
      </Button>
      <DialogContent title="Invite to your team" description="They get an email with a link that works for 7 days.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid.length || invalid || over || !ws.length) return;
            onInvite(valid, role, ws);
            toast({ title: `${plural(valid.length, "invite")} sent`, description: `${roleLabel(role)} · ${ws.join(", ")}`, tone: "success" });
            setOpen(false);
            reset();
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-emails`}>Emails</Label>
            <EmailChipsInput id={`${id}-emails`} value={emails} onChange={setEmails} describedBy={`${id}-hint`} />
            <p id={`${id}-hint`} className={cn("text-xs", invalid || over ? "font-medium text-red-800" : "text-ink-3")}>
              {invalid ? `${plural(invalid, "email")} ${invalid === 1 ? "looks" : "look"} wrong. Fix or remove ${invalid === 1 ? "it" : "them"}.` : over ? `Only ${plural(seatsLeft ?? 0, "seat")} left. Add seats in Billing.` : "Separate with comma, space or Enter. Paste a list works too."}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-ui font-medium">Role</span>
            <RoleSelector value={role} onChange={setRole} disabledRoles={["owner"]} hiddenRoles={["staff"]} className="w-full sm:w-56" />
          </div>
          <fieldset className="flex flex-col">
            <legend className="text-ui font-medium">Workspaces</legend>
            {workspaces.map((w) => (
              <Checkbox key={w} label={w} checked={ws.includes(w)} onCheckedChange={(c) => setWs(c ? [...ws, w] : ws.filter((x) => x !== w))} />
            ))}
          </fieldset>
          <DialogFooter className="mt-2">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid.length || invalid > 0 || over || !ws.length}>
              <Send /> {valid.length ? `Send ${plural(valid.length, "invite")}` : "Send invites"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
