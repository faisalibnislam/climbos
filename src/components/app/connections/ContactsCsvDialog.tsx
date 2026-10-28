"use client";

import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Download } from "@/components/icons"
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, Callout, DataTable, Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger, Label, Skeleton, buttonClasses } from "@/components/ui";
import { formatNumber, plural } from "@/lib/utils";
import { errorMessage } from "../errors";

const MAX_BYTES = 5 * 1024 * 1024;

const COLUMNS: { name: string; required: boolean; help: string }[] = [
  { name: "email", required: true, help: "" },
  { name: "first_name", required: false, help: "" },
  { name: "last_name", required: false, help: "" },
  { name: "consent", required: false, help: "yes = agreed to marketing" },
  { name: "consent_source", required: false, help: "e.g. signup form" },
  { name: "consent_date", required: false, help: "e.g. 2026-05-14" },
  { name: "segment", required: false, help: "e.g. customers" },
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
      setError("Over 5 MB. Split it and upload in parts.");
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
        title="Upload contacts"
        description="People you already know. Re-uploads update, never duplicate."
        className="max-w-2xl"
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Callout tone="info" title="Consent is never assumed">
            <p>Marketing email only with all three:</p>
            <ul className="mt-1 list-disc pl-5">
              <li>
                <code className="font-mono text-xs">consent</code> = yes
              </li>
              <li>a source</li>
              <li>a date</li>
            </ul>
            <p className="mt-1">Others: planning only.</p>
          </Callout>
          <div>
            <h3 className="heading-card">Columns</h3>
            <p className="mt-0.5 text-ui text-ink-3">Row 1 = column names.</p>
            <ul className="mt-2 grid gap-x-4 gap-y-1.5 text-ui sm:grid-cols-2">
              {COLUMNS.map((c) => (
                <li key={c.name} className="flex flex-col">
                  <span>
                    <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">{c.name}</code>{" "}
                    <span className={c.required ? "font-medium text-ink" : "text-ink-3"}>{c.required ? "required" : "optional"}</span>
                  </span>
                  {c.help ? <span className="text-ink-3">{c.help}</span> : null}
                </li>
              ))}
            </ul>
            <a
              href={TEMPLATE_HREF}
              download="climbos-contacts-template.csv"
              className={buttonClasses({ variant: "link", className: "mt-3" })}
            >
              <Download aria-hidden="true" className="size-4" />
              Template (CSV)
            </a>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>
              Contact file
            </Label>
            <p id={hintId} className="text-xs text-ink-3">
              .csv · max 5 MB, 10,000 rows
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
              className="block w-full rounded-lg border border-line-strong bg-surface p-1 text-ui text-ink file:mr-3 file:h-8 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface-2 file:px-2.5 file:text-ui file:font-medium file:text-ink hover:file:bg-surface-3"
            />
          </div>

          <div aria-live="polite" className="flex flex-col gap-3">
            {error ? (
              <Callout tone="danger" live="none" title="Couldn't import">
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
                {formatNumber(result.withConsent)} can get marketing email · {formatNumber(result.withoutConsent)} planning only.
                {result.invalid.length > 0 ? ` ${plural(result.invalid.length, "row")} need fixing.` : ""}
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
            <Button type="submit" loading={busy} loadingText="Checking…" disabled={!file}>
              Import
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
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-ui font-semibold text-ink-2">Who can be emailed</h4>
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
      <p className="text-xs text-ink-3">{audience.note}</p>
      {!audience.providerConnected && audience.segments.some((s) => s.sendable > 0) ? (
        <p className="text-xs text-ink-3">To send, connect Resend (Email marketing).</p>
      ) : null}
    </div>
  );
}
