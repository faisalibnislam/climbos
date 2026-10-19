"use client";

/*
 * Sharing: CopyLinkField (read-only link + copy + expiry), VisibilityToggle
 * (private / public with a confirm before going public) and ShareDialog
 * (invite by email, per-person access, general access, copy link).
 */
import { useState, type ReactNode } from "react";
import { Check, Copy, Globe, Lock, Share2, Trash2, Users } from "@/components/icons";
import { Button, ConfirmDialog, Dialog, DialogContent, DialogTrigger, RadioCards, Select, toast } from "@/components/ui";
import { cn, plural } from "@/lib/utils";
import { UserAvatar, type Person } from "../accounts/avatar";
import { EmailChipsInput } from "../accounts/team";
import { useCopied } from "../accounts/security";

export type ShareAccess = "view" | "comment" | "edit";
export type GeneralAccess = "restricted" | "workspace" | "link";

const ACCESS_OPTIONS = [
  { value: "view", label: "Can view" },
  { value: "comment", label: "Can comment" },
  { value: "edit", label: "Can edit" },
];

/** Read-only link with a copy button that confirms in place (and to screen readers). */
export function CopyLinkField({ url, expiry, onExpiryChange, label = "Share link" }: { url: string; expiry?: string; onExpiryChange?: (v: string) => void; label?: string }) {
  const { copied, copy } = useCopied();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-ui font-medium text-ink">{label}</span>
      <div className="flex flex-wrap gap-2">
        <div className="flex min-w-0 flex-1 basis-56 items-center rounded-[var(--radius-field)] border border-control bg-surface-2">
          <input readOnly value={url} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="h-[var(--h-md)] min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-ink-2 outline-none" />
          <Button size="sm" variant={copied ? "secondary" : "primary"} className="m-0.5" onClick={() => copy(url)}>
            {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        {onExpiryChange ? (
          <Select
            aria-label="Link expires"
            value={expiry}
            onValueChange={onExpiryChange}
            className="w-36"
            options={[
              { value: "never", label: "Never expires" },
              { value: "7d", label: "Expires in 7 days" },
              { value: "30d", label: "Expires in 30 days" },
            ]}
          />
        ) : null}
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}

/** Private or public. Going public asks first because anyone with the link can see it. */
export function VisibilityToggle({ value, onChange, what = "report" }: { value: "private" | "public"; onChange: (v: "private" | "public") => void; what?: string }) {
  const [ask, setAsk] = useState(false);
  return (
    <>
      <RadioCards
        aria-label="Visibility"
        value={value}
        onValueChange={(v) => (v === "public" ? setAsk(true) : onChange("private"))}
        options={[
          { value: "private", title: "Private", description: "Only people in this workspace.", icon: <Lock className="size-5" /> },
          { value: "public", title: "Public", description: "Anyone with the link can view. Read-only.", icon: <Globe className="size-5" /> },
        ]}
      />
      <ConfirmDialog
        open={ask}
        onOpenChange={setAsk}
        title={`Make this ${what} public?`}
        description="Anyone with the link can view it, including people outside your team. You can switch back any time."
        confirmLabel="Make public"
        onConfirm={() => onChange("public")}
      />
    </>
  );
}

export interface SharePerson extends Person {
  access: ShareAccess | "owner";
}

export interface ShareDialogProps {
  itemName: string;
  url: string;
  initialPeople: SharePerson[];
  /** Extra section, e.g. a scheduled email digest for dashboards. */
  extra?: ReactNode;
  /** Single focusable element that opens the dialog (default: secondary Share button). */
  trigger?: ReactNode;
}

const GENERAL: Record<GeneralAccess, { Icon: typeof Lock; title: string; body: string }> = {
  restricted: { Icon: Lock, title: "Restricted", body: "Only people added here." },
  workspace: { Icon: Users, title: "Tartine Bakery workspace", body: "Everyone in the workspace can view." },
  link: { Icon: Globe, title: "Anyone with the link", body: "No sign-in needed. View only." },
};

/** Share an item: invite by email, set access per person, choose general access and copy the link. */
export function ShareDialog({ itemName, url, initialPeople, extra, trigger }: ShareDialogProps) {
  const [people, setPeople] = useState(initialPeople);
  const [emails, setEmails] = useState<string[]>([]);
  const [access, setAccess] = useState<ShareAccess>("view");
  const [general, setGeneral] = useState<GeneralAccess>("workspace");
  const { copied, copy } = useCopied();
  const G = GENERAL[general];

  const invite = () => {
    const valid = emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && !people.some((p) => p.email === e));
    if (!valid.length) return;
    setPeople([...people, ...valid.map((e, i) => ({ id: `sh-${people.length + i}`, name: e.split("@")[0].replace(/[._]/g, " "), email: e, access }))]);
    setEmails([]);
    toast({ title: `Shared with ${plural(valid.length, "person", "people")}`, tone: "success" });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Share2 /> Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={`Share “${itemName}”`} className="max-w-xl">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="min-w-0 flex-1">
              <EmailChipsInput value={emails} onChange={setEmails} placeholder="Add people by email" />
            </div>
            <div className="flex gap-2">
              <Select aria-label="Access for new people" value={access} onValueChange={(v) => setAccess(v as ShareAccess)} options={ACCESS_OPTIONS} className="w-36" />
              <Button onClick={invite} disabled={!emails.length}>
                Share
              </Button>
            </div>
          </div>

          <section aria-label="People with access">
            <p className="text-overline mb-1">People with access</p>
            <ul className="flex flex-col">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <UserAvatar name={p.name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ui font-medium capitalize text-ink">{p.name}</span>
                    {p.email ? <span className="block truncate text-xs text-ink-3">{p.email}</span> : null}
                  </span>
                  {p.access === "owner" ? (
                    <span className="text-ui text-ink-3">Owner</span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Select aria-label={`Access for ${p.name}`} value={p.access} onValueChange={(v) => setPeople(people.map((x) => (x.id === p.id ? { ...x, access: v as ShareAccess } : x)))} options={ACCESS_OPTIONS} className="h-[var(--h-sm)] w-32" />
                      <button type="button" aria-label={`Remove ${p.name}`} onClick={() => setPeople(people.filter((x) => x.id !== p.id))} className="grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-surface-2 hover:text-red-800">
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="General access" className="flex flex-col gap-2">
            <p className="text-overline">General access</p>
            <div className="flex items-center gap-3">
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)]", general === "link" ? "bg-sun-soft text-ink" : "bg-surface-2 text-ink-2")}>
                <G.Icon aria-hidden className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Select
                  aria-label="General access"
                  value={general}
                  onValueChange={(v) => setGeneral(v as GeneralAccess)}
                  className="h-[var(--h-sm)] w-auto border-transparent px-1 font-medium shadow-none hover:bg-surface-2"
                  options={(Object.keys(GENERAL) as GeneralAccess[]).map((k) => ({ value: k, label: GENERAL[k].title }))}
                />
                <p className="px-1 text-xs text-ink-3">{G.body}</p>
              </div>
            </div>
          </section>

          {extra}

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="secondary" onClick={() => copy(url)}>
              {copied ? <Check /> : <Copy />} {copied ? "Link copied" : "Copy link"}
            </Button>
            <span aria-live="polite" className="text-xs text-ink-3">
              {plural(people.length, "person", "people")} · {G.title.toLowerCase()}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
