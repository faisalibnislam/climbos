"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Download } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, Callout, DataTable, Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger, Skeleton } from "@/components/ui";
import { formatNumber, plural } from "@/lib/utils";
import { errorMessage } from "../errors";

const MAX_BYTES = 5 * 1024 * 1024;

const COLUMNS: { name: string; required: boolean; help: string }[] = [
  { name: "email", required: true, help: "Their email address" },
  { name: "first_name", required: false, help: "First name" },
  { name: "last_name", required: false, help: "Last name" },
  { name: "consent", required: false, help: "yes only if they agreed to marketing email" },
  { name: "consent_source", required: false, help: "Where they agreed, e.g. signup form" },
  { name: "consent_date", required: false, help: "When they agreed, e.g. 2026-05-14" },
  { name: "segment", required: false, help: "A group name, e.g. customers or leads" },
];

const TEMPLATE =
  COLUMNS.map((c) => c.name).join(",") +
  "\n" +
  "ana@example.com,Ana,Silva,yes,signup form,2026-05-14,customers\n" +
  "ben@example.com,Ben,Okafor,no,,,leads\n";

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

type ImportResult = { imported: number; updated: number; withConsent: number; withoutConsent: number; invalid: { row: number; message: string }[]; fatal?: string };

/** Upload contacts the business already has. Consent is never assumed. */
export function ContactsCsvDialog({ slug, trigger }: { slug: string; trigger: ReactNode }) {
  const importContacts = useAction(api.marketing.importContacts);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("This file is larger than 5 MB. Split it into smaller files and upload them one at a time.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setResult(await importContacts({ slug, csv: await file.text() }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (busy) return;
        setOpen(v);
        if (!v) {
          setFile(null);
          setError(null);
          setResult(null);
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title="Upload your customer or lead list"
        description="Only people you already have a relationship with. Uploading again updates existing contacts instead of duplicating them."
        className="max-w-2xl"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Callout tone="info" title="Consent is never assumed">
            Only rows with consent = yes <strong>and</strong> a consent source <strong>and</strong> a consent date can receive marketing email. Everyone else is
            imported as a contact for planning only — ClimbOS won&apos;t email them.
          </Callout>
          <div>
            <h3 className="font-semibold text-ink">Columns</h3>
            <p className="text-sm text-ink-3">The first row must contain the column names. Only email is required.</p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {COLUMNS.map((c) => (
                <li key={c.name} className="flex flex-col">
                  <span>
                    <code className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.8125rem] text-ink">{c.name}</code>{" "}
                    <span className={c.required ? "font-medium text-ink" : "text-ink-3"}>{c.required ? "required" : "optional"}</span>
                  </span>
                  <span className="text-ink-3">{c.help}</span>
                </li>
              ))}
            </ul>
            <a
              href={TEMPLATE_HREF}
              download="climbos-contacts-template.csv"
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-brand-800 underline-offset-4 hover:underline"
            >
              <Download aria-hidden="true" className="size-4" />
              Download a template (CSV)
            </a>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-[0.95rem] font-medium text-ink">
              Contact file
            </label>
            <p id={hintId} className="text-sm text-ink-3">
              A .csv file, up to 5 MB and 10,000 rows.
            </p>
            <input
              id={inputId}
              type="file"
              accept=".csv,text/csv"
              aria-describedby={hintId}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError(null);
                setResult(null);
              }}
              className="block w-full rounded-[12px] border border-line-strong bg-surface p-2 text-sm text-ink file:mr-3 file:min-h-9 file:rounded-[10px] file:border-0 file:bg-brand-50 file:px-3 file:font-medium file:text-brand-900"
            />
          </div>

          <div aria-live="polite" className="flex flex-col gap-3">
            {error ? (
              <Callout tone="danger" live="none" title="We couldn't import this file">
                {error}
              </Callout>
            ) : null}
            {result?.fatal ? (
              <Callout tone="danger" live="none" title="Nothing was imported">
                {result.fatal}
              </Callout>
            ) : null}
            {result && !result.fatal ? (
              <Callout tone={result.invalid.length ? "warning" : "success"} live="none" title={`Imported ${plural(result.imported, "new contact")}, updated ${formatNumber(result.updated)}`}>
                {formatNumber(result.withConsent)} can receive marketing email (recorded consent). {formatNumber(result.withoutConsent)} are for planning only.
                {result.invalid.length > 0 ? ` ${plural(result.invalid.length, "row")} need attention — see below.` : ""}
              </Callout>
            ) : null}
            {result && result.invalid.length > 0 ? (
              <DataTable
                caption="Rows that need attention"
                columns={[
                  { key: "row", header: "Row", rowHeader: true, cell: (r) => formatNumber(r.row) },
                  { key: "message", header: "Problem" },
                ]}
                rows={result.invalid}
                rowKey={(r, i) => `${r.row}-${i}`}
              />
            ) : null}
          </div>

          <DialogFooter className="mt-2">
            <DialogClose asChild>
              <Button variant="secondary" disabled={busy}>
                {result ? "Done" : "Cancel"}
              </Button>
            </DialogClose>
            <Button type="submit" loading={busy} loadingText="Checking rows…" disabled={!file}>
              Check and import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** How many people in each segment can actually be emailed. */
export function AudienceSummary({ slug }: { slug: string }) {
  const audience = useQuery(api.marketing.audience, { slug });
  if (audience === undefined) {
    return (
      <div>
        <p role="status" className="sr-only">
          Loading audience…
        </p>
        <Skeleton className="h-16 rounded-[var(--radius)]" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold text-ink-2">Who can be emailed</h4>
      <DataTable
        caption="Contacts by segment and how many can receive marketing email"
        hideCaption
        rows={audience.segments}
        rowKey={(s) => s.segment}
        emptyText="No contacts uploaded yet."
        columns={[
          { key: "segment", header: "Segment", rowHeader: true },
          { key: "total", header: "Contacts", align: "right", cell: (s) => formatNumber(s.total) },
          { key: "consented", header: "Opted in", align: "right", cell: (s) => formatNumber(s.consented) },
          { key: "suppressed", header: "Unsubscribed or blocked", align: "right", cell: (s) => formatNumber(s.suppressed) },
          { key: "sendable", header: "Can be emailed", align: "right", cell: (s) => formatNumber(s.sendable) },
        ]}
      />
      <p className="text-sm text-ink-3">{audience.note}</p>
      {!audience.providerConnected && audience.segments.some((s) => s.sendable > 0) ? (
        <p className="text-sm text-ink-3">To send email, connect your own Resend account under Email marketing.</p>
      ) : null}
    </div>
  );
}
