"use client";

import { ApprovalLimit, InviteLinks } from "./TeamLinks";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Avatar, Badge, Button, Callout, ConfirmDialog, Field, Input, Meter, Select, buttonClasses, toast } from "@/components/ui";
import { errorInfo } from "../errors";
import { relativeTime } from "../money";
import { LoadingBlock } from "../results/QueryBoundary";
import { SettingsHeader } from "./SettingsNav";

type Team = FunctionReturnType<typeof api.settings.team>;
type Member = Team["members"][number];
type Role = "owner" | "admin" | "editor" | "reviewer" | "viewer";

export const ROLE_NAMES: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  reviewer: "Reviewer",
  viewer: "Viewer",
};

export function TeamSettings({ slug }: { slug: string }) {
  const team = useQuery(api.settings.team, { slug });
  return (
    <div className="flex flex-col gap-8">
      <SettingsHeader title="Team" />
      {team === undefined ? (
        <LoadingBlock label="Loading team…" />
      ) : (
        <>
          <section aria-labelledby="seats-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
            <h2 id="seats-heading" className="heading-section">
              Seats
            </h2>
            <Meter
              label="Seats used"
              used={team.seatsUsed}
              max={team.seatLimit}
              unit="seats"
              fullText="All seats in use."
              footnote={
                <>
                  Shared across workspaces; invites count. <Link className={buttonClasses({ variant: "link" })} href={`/app/${slug}/settings/billing`}>Add seats</Link>
                </>
              }
            />
          </section>

          {team.canManage ? <InviteLinks slug={slug} canInviteAdmins={team.yourRole === "owner"} /> : null}
          {team.canManage ? <ApprovalLimit slug={slug} current={team.creditApprovalLimit} /> : null}
          {team.canManage ? <InviteForm slug={slug} team={team} /> : (
            <Callout tone="info" title="View only">
              You’re {ROLE_NAMES[team.yourRole] ?? team.yourRole}. Owners and admins manage people.
            </Callout>
          )}

          <section aria-labelledby="members-heading" className="flex flex-col gap-3">
            <h2 id="members-heading" className="heading-section">
              People ({team.members.length})
            </h2>
            <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
              {team.members.map((m) => (
                <MemberRow key={m.id} slug={slug} member={m} team={team} />
              ))}
            </ul>
          </section>

          <section aria-labelledby="roles-heading" className="flex flex-col gap-3">
            <h2 id="roles-heading" className="heading-section">
              Roles
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {team.roles.map((r) => (
                <div key={r.key} className="rounded-xl border border-line bg-surface p-4">
                  <dt className="heading-card">{ROLE_NAMES[r.key] ?? r.key}</dt>
                  <dd className="mt-1 text-sm text-ink-2">{r.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      )}
    </div>
  );
}

function roleOptions(team: Team) {
  return team.roles
    .filter((r) => r.key !== "owner" || team.yourRole === "owner")
    .map((r) => ({ value: r.key, label: ROLE_NAMES[r.key] ?? r.key }));
}

function InviteForm({ slug, team }: { slug: string; team: Team }) {
  const invite = useMutation(api.settings.invite);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);
  const full = team.seatsUsed >= team.seatLimit;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await invite({ slug, email, role });
      toast({ tone: "success", title: "Invitation created", description: `Emailing ${email.trim()}. Link lasts 7 days.` });
      setEmail("");
    } catch (err) {
      const info = errorInfo(err);
      setError({ message: info.message, limit: info.code === "LIMIT_REACHED" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="invite-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 id="invite-heading" className="heading-section">
        Invite someone
      </h2>
      {full ? (
        <Callout tone="warning" title="All seats are in use">
          Remove someone or <Link href={`/app/${slug}/settings/billing`}>add seats</Link>.
        </Callout>
      ) : null}
      <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <Field label="Email address" error={error && !error.limit ? error.message : undefined}>
          <Input type="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={full} />
        </Field>
        <Field label="Role">
          <Select value={role} onValueChange={(v) => setRole(v as Role)} options={roleOptions(team)} disabled={full} />
        </Field>
        <Button type="submit" loading={busy} loadingText="Sending…" disabled={full}>
          Invite
        </Button>
      </form>
      <div aria-live="polite">
        {error?.limit ? (
          <Callout tone="warning" live="none" title="Seat limit reached">
            {error.message} <Link href={`/app/${slug}/settings/billing`}>See plans</Link>
          </Callout>
        ) : error ? (
          <p className="sr-only">{error.message}</p>
        ) : null}
      </div>
    </section>
  );
}

function MemberRow({ slug, member, team }: { slug: string; member: Member; team: Team }) {
  const changeRole = useMutation(api.settings.changeRole);
  const remove = useMutation(api.settings.removeMember);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const display = member.name ?? member.email ?? "Unnamed member";
  const ownerLocked = member.role === "owner" && team.yourRole !== "owner";
  const canEdit = team.canManage && !ownerLocked;

  async function onRole(v: string) {
    if (v === member.role) return;
    setBusy(true);
    setError(null);
    try {
      await changeRole({ slug, membershipId: member.id, role: v as Role });
      toast({ tone: "success", title: "Role changed", description: `${display} is now ${ROLE_NAMES[v] ?? v}.` });
    } catch (err) {
      setError(errorInfo(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={display} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">
            {display}
            {member.isYou ? <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span> : null}
          </p>
          {member.name && member.email ? <p className="truncate text-xs text-ink-3">{member.email}</p> : null}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {member.status === "invited" ? (
              <Badge tone="amber">
                Invited{member.inviteExpiresAt ? ` · expires ${relativeTime(member.inviteExpiresAt)}` : ""}
              </Badge>
            ) : (
              <Badge tone="green">Active</Badge>
            )}
          </div>
          {error ? (
            <p role="alert" className="mt-1 text-ui font-medium text-red-800">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <>
            <div className="w-40">
              <Select
                aria-label={`Role for ${display}`}
                value={member.role}
                onValueChange={onRole}
                options={roleOptions(team)}
                disabled={busy}
              />
            </div>
            <ConfirmDialog
              tone="danger"
              title={member.status === "invited" ? `Cancel the invitation for ${display}?` : `Remove ${display}?`}
              description={
                member.status === "invited"
                  ? "The link stops working."
                  : "Access ends now. Past work stays in the activity log."
              }
              confirmLabel={member.status === "invited" ? "Cancel invitation" : `Remove ${display}`}
              onConfirm={async () => {
                try {
                  await remove({ slug, membershipId: member.id });
                  toast({ tone: "success", title: member.status === "invited" ? "Invitation cancelled" : `${display} removed` });
                } catch (err) {
                  setError(errorInfo(err).message);
                }
              }}
              trigger={
                <Button variant="ghost" size="md">
                  {member.status === "invited" ? "Cancel invite" : member.isYou ? "Leave" : "Remove"}
                </Button>
              }
            />
          </>
        ) : (
          <Badge tone="neutral">{ROLE_NAMES[member.role] ?? member.role}</Badge>
        )}
      </div>
    </li>
  );
}
