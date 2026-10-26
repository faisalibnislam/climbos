"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Download } from "@/components/icons"
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge, Button, Callout, ConfirmDialog, DataTable, Field, Input, Progress, buttonClasses, toast } from "@/components/ui";
import { errorInfo } from "../errors";
import { formatDateTime, relativeTime } from "../money";
import { LoadingBlock, QueryBoundary } from "../results/QueryBoundary";
import { SettingsHeader } from "./SettingsNav";

/** What an action covers, as short labelled facts ("Deleted: …", "Kept: …"). */
function Covers({ items }: { items: { term: string; detail: string; tone?: "keep" | "gone" }[] }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.term} className="flex flex-col gap-0.5 rounded-lg border border-line px-3 py-2">
          <dt className={it.tone === "gone" ? "text-xs font-medium text-red-800" : "text-xs font-medium text-ink-3"}>{it.term}</dt>
          <dd className="text-ink-2">{it.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

const KIND: Record<string, string> = { export: "Workspace export", delete_contact: "Contact deletion", delete_workspace: "Workspace deletion" };
const STATUS: Record<string, { label: string; tone: "neutral" | "blue" | "green" | "red" }> = {
  pending: { label: "Waiting", tone: "neutral" },
  running: { label: "In progress", tone: "blue" },
  done: { label: "Done", tone: "green" },
  failed: { label: "Didn't finish", tone: "red" },
};

export function PrivacySettings({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col gap-8">
      <SettingsHeader title="Privacy" />
      <QueryBoundary headingLevel="h2">
        <ExportSection slug={slug} />
      </QueryBoundary>
      <DeleteContactSection slug={slug} />
      <DeleteWorkspaceSection slug={slug} />
    </div>
  );
}

function ExportSection({ slug }: { slug: string }) {
  const requests = useQuery(api.settings.privacyRequests, { slug });
  const requestExport = useMutation(api.settings.requestExport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = requests?.some((r) => r.kind === "export" && (r.status === "pending" || r.status === "running"));

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      await requestExport({ slug });
      toast({ title: "Export requested", description: "Link appears below when ready." });
    } catch (err) {
      setError(errorInfo(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="export-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 id="export-heading" className="heading-section">
        Export your data
      </h2>
      <Covers
        items={[
          { term: "You get", detail: "One JSON file" },
          { term: "Never included", detail: "Passwords, keys or tokens" },
        ]}
      />
      <div>
        <Button onClick={onExport} loading={busy} loadingText="Requesting…" disabled={pending}>
          {pending ? "Exporting…" : "Export"}
        </Button>
        {pending ? (
          <div className="flex flex-col gap-1.5">
            <Progress label="Preparing your export" />
            <p className="text-xs text-ink-3">Usually under a minute.</p>
          </div>
        ) : null}
      </div>
      <div aria-live="polite">
        {error ? (
          <Callout tone="danger" live="none" title="Export not requested">
            {error}
          </Callout>
        ) : null}
      </div>
      <h3 className="heading-card mt-2">Requests</h3>
      {requests === undefined ? (
        <LoadingBlock label="Loading requests…" lines={1} />
      ) : (
        <div aria-live="polite">
          <DataTable
            caption="Recent privacy requests"
            hideCaption
            rows={requests}
            rowKey={(r) => r.id}
            emptyText="None yet"
            columns={[
              { key: "kind", header: "Request", rowHeader: true, cell: (r) => KIND[r.kind] ?? r.kind },
              { key: "created", header: "Requested", cell: (r) => <span title={formatDateTime(r.createdAt)}>{relativeTime(r.createdAt)}</span> },
              {
                key: "status",
                header: "Status",
                cell: (r) => {
                  const s = STATUS[r.status] ?? STATUS.pending;
                  return <Badge tone={s.tone}>{s.label}</Badge>;
                },
              },
              {
                key: "result",
                header: "Result",
                cell: (r) =>
                  r.url ? (
                    <a href={r.url} download className={buttonClasses({ variant: "link" })}>
                      <Download aria-hidden="true" className="size-4" />
                      Download
                    </a>
                  ) : (
                    <span className="text-ink-3">{r.note ?? "—"}</span>
                  ),
              },
            ]}
          />
        </div>
      )}
    </section>
  );
}

function DeleteContactSection({ slug }: { slug: string }) {
  const deleteContact = useMutation(api.settings.deleteContact);
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setConfirm(true);
  }

  return (
    <section aria-labelledby="contact-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 id="contact-heading" className="heading-section">
        Delete a person&apos;s details
      </h2>
      <Covers
        items={[
          { term: "Use for", detail: "“Forget me” requests" },
          { term: "Kept", detail: "A hashed address, to block future emails" },
        ]}
      />
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Their email" error={error ?? undefined}>
          <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" variant="danger">
          Delete
        </Button>
      </form>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="danger"
        title="Delete this person's details?"
        description={`Permanently deletes every record for ${email.trim()} and blocks the address. Can't be undone.`}
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          try {
            const res = await deleteContact({ slug, email });
            toast({
              tone: "success",
              title: res.deleted > 0 ? `Deleted ${res.deleted} contact record${res.deleted === 1 ? "" : "s"}` : "No matching contact found",
              description: "Address blocked from future emails.",
            });
            setEmail("");
          } catch (err) {
            setError(errorInfo(err).message);
          }
        }}
      />
    </section>
  );
}

export function DeleteWorkspaceSection({ slug }: { slug: string }) {
  const me = useQuery(api.orgs.me);
  const del = useMutation(api.settings.deleteWorkspace);
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const org = me?.orgs.find((o) => o.slug === slug);
  const canDelete = org?.role === "owner";
  const impact = useQuery(api.settings.deletionImpact, canDelete ? { slug } : "skip");
  const billingNote = impact?.packageEnds ? " Your package ends this billing period." : impact?.sharedPackage ? " Your package stays for other workspaces." : "";
  const matches = org ? typed.trim() === org.name : false;

  return (
    <section id="remove-business" aria-labelledby="delete-ws-heading" className="flex scroll-mt-24 flex-col gap-3 rounded-xl border border-red-500/25 bg-surface p-5">
      <h2 id="delete-ws-heading" className="heading-section text-red-800!">
        Remove this business{org ? `: ${org.name}` : ""}
      </h2>
      <Covers
        items={[
          { term: "Permanently deleted", detail: "Content, contacts and keys", tone: "gone" },
          { term: "Kept for accounting", detail: "Billing and logs" },
        ]}
      />
      {me === undefined ? (
        <LoadingBlock label="Loading workspace…" lines={1} />
      ) : !org ? null : !canDelete ? (
        <p className="text-sm text-ink-3">Owners only.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (matches) setConfirm(true);
            else setError(`Type ${org.name} exactly to continue.`);
          }}
          className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
        >
          <Field label={`Type ${org.name} to confirm`} error={error ?? undefined}>
            <Input autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          <Button type="submit" variant="danger" disabled={!matches}>
            Remove business
          </Button>
        </form>
      )}
      {org ? (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          tone="danger"
          title={`Remove ${org.name}?`}
          description={`Stops everything and permanently deletes content. Can't be undone.${billingNote}`}
          confirmLabel={`Remove ${org.name}`}
          onConfirm={async () => {
            try {
              await del({ slug, confirmName: typed });
              toast({ tone: "success", title: "Workspace deletion started", description: "Content is being removed." });
              router.push("/app");
            } catch (err) {
              setError(errorInfo(err).message);
            }
          }}
        />
      ) : null}
    </section>
  );
}
