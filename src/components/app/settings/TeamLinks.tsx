"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button, Field, Input, Select, toast } from "@/components/ui";
import { errorMessage } from "../errors";

/** Shareable invite links (role, expiry, max uses). The link is shown once. */
export function InviteLinks({ slug, canInviteAdmins }: { slug: string; canInviteAdmins: boolean }) {
  const links = useQuery(api.team.inviteLinks, { slug });
  const create = useMutation(api.team.createInviteLink);
  const revoke = useMutation(api.team.revokeInviteLink);
  const [role, setRole] = useState<"admin" | "editor" | "reviewer" | "viewer">("editor");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  return (
    <section aria-labelledby="links-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 id="links-heading" className="heading-section">
        Invite link
      </h2>
      <p className="text-sm text-ink-3">Anyone with the link can join as the role you pick, up to 10 people, for 7 days. Seats still apply.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Joins as" className="w-48">
          <Select
            value={role}
            onValueChange={(v) => setRole(v as typeof role)}
            options={[
              ...(canInviteAdmins ? [{ value: "admin", label: "Admin" }] : []),
              { value: "editor", label: "Editor" },
              { value: "reviewer", label: "Reviewer" },
              { value: "viewer", label: "Viewer" },
            ]}
          />
        </Field>
        <Button
          onClick={async () => {
            try {
              const { token } = await create({ slug, role, days: 7, maxUses: 10 });
              setFresh(`${window.location.origin}/invite/${token}`);
              setCopied(false);
            } catch (e) {
              toast({ tone: "danger", title: errorMessage(e) });
            }
          }}
        >
          Create link
        </Button>
      </div>
      {fresh ? (
        <div className="flex items-center gap-2">
          <Input readOnly value={fresh} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(fresh);
              setCopied(true);
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : null}
      {links?.filter((l) => l.active).length ? (
        <ul className="flex flex-col gap-1 text-sm text-ink-2">
          {links
            .filter((l) => l.active)
            .map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2">
                <span>
                  {l.role} link · {l.uses}/{l.maxUses} used · expires {new Date(l.expiresAt).toLocaleDateString()}
                </span>
                <Button size="sm" variant="ghost" onClick={() => revoke({ slug, linkId: l.id })}>
                  Turn off
                </Button>
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Team rule: jobs above N credits need an owner or admin to start them. */
export function ApprovalLimit({ slug, current }: { slug: string; current: number | null }) {
  const set = useMutation(api.team.setCreditApprovalLimit);
  const [value, setValue] = useState(current === null ? "" : String(current));
  return (
    <section aria-labelledby="limit-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 id="limit-heading" className="heading-section">
        Big jobs need approval
      </h2>
      <p className="text-sm text-ink-3">Editors draft freely; jobs over this many credits need an owner or admin to start them. Leave empty for no limit.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Credits" className="w-40">
          <Input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))} placeholder="No limit" />
        </Field>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await set({ slug, credits: value === "" ? null : Number(value) });
              toast({ tone: "success", title: "Saved" });
            } catch (e) {
              toast({ tone: "danger", title: errorMessage(e) });
            }
          }}
        >
          Save
        </Button>
      </div>
    </section>
  );
}
