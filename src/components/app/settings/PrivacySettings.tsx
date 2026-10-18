"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Badge, Button, Callout, ConfirmDialog, DataTable, Field, Input, Progress, buttonClasses, toast } from "@/components/ui";
import { errorInfo } from "../errors";
import { formatDateTime, relativeTime } from "../money";
import { LoadingBlock, QueryBoundary } from "../results/QueryBoundary";
import { SettingsHeader } from "./SettingsNav";

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
      <SettingsHeader title="Privacy" intro="Download everything in this workspace, remove a person's details, or delete the workspace." />
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
      toast({ title: "Export requested", description: "It will appear below with a download link when it's ready." });
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
      <p className="text-sm text-ink-2">
        One JSON file with your business profile, plans, content, results and activity. Passwords, keys and connection tokens are never included.
      </p>
      <div>
        <Button onClick={onExport} loading={busy} loadingText="Requesting…" disabled={pending}>
          {pending ? "Export in progress…" : "Request an export"}
        </Button>
        {pending ? (
          <div className="flex flex-col gap-1.5">
            <Progress label="Preparing your export" />
            <p className="text-xs text-ink-3">Collecting your workspace data into one file. Usually under a minute; the download link appears below.</p>
          </div>
        ) : null}
      </div>
      <div aria-live="polite">
        {error ? (
          <Callout tone="danger" live="none" title="Export wasn't requested">
            {error}
          </Callout>
        ) : null}
      </div>
      <h3 className="heading-card mt-2">Recent requests</h3>
      {requests === undefined ? (
        <LoadingBlock label="Loading requests…" lines={1} />
      ) : (
        <div aria-live="polite">
          <DataTable
            caption="Recent privacy requests"
            hideCaption
            rows={requests}
            rowKey={(r) => r.id}
            emptyText="No requests yet."
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
      <p className="text-sm text-ink-2">
        Use this when a customer or lead asks to be forgotten. Their contact record and consent history are deleted. A one-way fingerprint of the address is kept so
        they&apos;re never emailed again.
      </p>
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Their email address" error={error ?? undefined}>
          <Input type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" variant="danger">
          Delete their details
        </Button>
      </form>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        tone="danger"
        title="Delete this person's details?"
        description={`Every contact record for ${email.trim()} in this workspace will be permanently deleted, and the address will be blocked from future emails. This can't be undone.`}
        confirmLabel="Delete permanently"
        onConfirm={async () => {
          try {
            const res = await deleteContact({ slug, email });
            toast({
              tone: "success",
              title: res.deleted > 0 ? `Deleted ${res.deleted} contact record${res.deleted === 1 ? "" : "s"}` : "No matching contact found",
              description: "The address is now blocked from future emails.",
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

function DeleteWorkspaceSection({ slug }: { slug: string }) {
  const me = useQuery(api.orgs.me);
  const del = useMutation(api.settings.deleteWorkspace);
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const org = me?.orgs.find((o) => o.slug === slug);
  const canDelete = org?.role === "owner";
  const impact = useQuery(api.settings.deletionImpact, canDelete ? { slug } : "skip");
  const billingNote = impact?.packageEnds ? " Your package will end at the end of this billing period." : impact?.sharedPackage ? " Your package stays active for your other workspaces." : "";
  const matches = org ? typed.trim() === org.name : false;

  return (
    <section aria-labelledby="delete-ws-heading" className="flex flex-col gap-3 rounded-xl border border-red-500/25 bg-surface p-5">
      <h2 id="delete-ws-heading" className="heading-section text-red-800!">
        Delete this workspace
      </h2>
      <p className="text-sm text-ink-2">
        Everything stops straight away. Your business profile, plans, content, results, contacts and connections (including stored keys) are then permanently
        deleted. Billing records, usage costs and the activity log are kept, as required for accounting, with personal details minimized.
      </p>
      {me === undefined ? (
        <LoadingBlock label="Loading workspace…" lines={1} />
      ) : !org ? null : !canDelete ? (
        <p className="text-sm text-ink-3">Only an owner can delete the workspace.</p>
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
          <Field label={`Type the workspace name to confirm: ${org.name}`} error={error ?? undefined}>
            <Input autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          <Button type="submit" variant="danger" disabled={!matches}>
            Delete workspace
          </Button>
        </form>
      )}
      {org ? (
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          tone="danger"
          title={`Delete ${org.name}?`}
          description={`All activity stops now and the workspace's content is permanently deleted. This can't be undone.${billingNote}`}
          confirmLabel={`Delete ${org.name}`}
          onConfirm={async () => {
            try {
              await del({ slug, confirmName: typed });
              toast({ tone: "success", title: "Workspace deletion started", description: "Everything is stopped. Content is being removed now." });
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
