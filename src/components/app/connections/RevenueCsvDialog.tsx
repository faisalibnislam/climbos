"use client";

import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Download } from "@/components/icons"
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, Callout, DataTable, Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger, Label, buttonClasses } from "@/components/ui";
import { formatNumber, plural } from "@/lib/utils";
import { errorMessage } from "../errors";

const MAX_BYTES = 10 * 1024 * 1024;

const COLUMNS: { name: string; required: boolean; help: string }[] = [
  { name: "event_id", required: true, help: "Unique id for the payment (used to skip duplicates)" },
  { name: "occurred_at", required: true, help: "Date and time, e.g. 2026-09-30T14:05:00Z" },
  { name: "customer_id", required: false, help: "Your id for the customer" },
  { name: "order_id", required: false, help: "Your order or invoice number" },
  { name: "currency", required: true, help: "Three-letter code, e.g. USD" },
  { name: "amount", required: true, help: "Amount charged, e.g. 49.00" },
  { name: "refunded_amount", required: false, help: "Amount refunded so far, e.g. 0" },
  { name: "utm_source", required: false, help: "Tracked link source, e.g. google" },
  { name: "utm_medium", required: false, help: "Tracked link medium, e.g. cpc" },
  { name: "utm_campaign", required: false, help: "Tracked link campaign name" },
];

const TEMPLATE =
  COLUMNS.map((c) => c.name).join(",") +
  "\n" +
  "ord_1001,2026-09-30T14:05:00Z,cus_42,1001,USD,49.00,0,google,cpc,autumn-sale\n" +
  "ord_1002,2026-10-01T09:30:00Z,cus_43,1002,USD,120.00,20.00,newsletter,email,october\n";

const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

type ImportResult = { imported: number; errors: { row: number; message: string }[]; fatal?: string; duplicates: number };

/** Upload a revenue CSV. Every row is validated; problems are listed, never guessed. */
export function RevenueCsvDialog({ slug, trigger }: { slug: string; trigger: ReactNode }) {
  const importCsv = useAction(api.connectionActions.importRevenueCsv);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputId = useId();
  const hintId = `${inputId}-hint`;

  function reset() {
    setFile(null);
    setError(null);
    setResult(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setResult(null);
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("This file is larger than 10 MB. Split it into smaller files and upload them one at a time.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const csv = await file.text();
      setResult(await importCsv({ slug, csv }));
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
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Upload a revenue file" description="Use this when your checkout isn't connected. You can upload new files at any time; rows you've already sent are skipped." className="max-w-2xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <h3 className="heading-card">Columns</h3>
            <p className="mt-0.5 text-ui text-ink-3">The first row must contain these column names. Columns marked required must be present.</p>
            <ul className="mt-2 grid gap-x-4 gap-y-1.5 text-ui sm:grid-cols-2">
              {COLUMNS.map((c) => (
                <li key={c.name} className="flex flex-col">
                  <span>
                    <code className="rounded-sm bg-surface-2 px-1 py-0.5 font-mono text-xs text-ink">{c.name}</code>{" "}
                    <span className={c.required ? "font-medium text-ink" : "text-ink-3"}>{c.required ? "required" : "optional"}</span>
                  </span>
                  <span className="text-ink-3">{c.help}</span>
                </li>
              ))}
            </ul>
            <a
              href={TEMPLATE_HREF}
              download="climbos-revenue-template.csv"
              className={buttonClasses({ variant: "link", className: "mt-3" })}
            >
              <Download aria-hidden="true" className="size-4" />
              Download a template (CSV)
            </a>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={inputId}>
              Revenue file
            </Label>
            <p id={hintId} className="text-xs text-ink-3">
              A .csv file, up to 10 MB and 50,000 rows.
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
              <Callout tone={result.errors.length ? "warning" : "success"} live="none" title={`Imported ${plural(result.imported, "new row")}`}>
                {result.duplicates > 0 ? `${plural(result.duplicates, "row")} had already been imported and were skipped. ` : ""}
                {result.errors.length > 0
                  ? `${plural(result.errors.length, "row")} had problems and were not imported — fix them and upload again.`
                  : "Results will update in a moment."}
              </Callout>
            ) : null}
            {result && result.errors.length > 0 ? (
              <DataTable
                caption={`Rows with problems${result.errors.length >= 50 ? " (first 50)" : ""}`}
                columns={[
                  { key: "row", header: "Row", rowHeader: true, cell: (r) => formatNumber(r.row) },
                  { key: "message", header: "Problem" },
                ]}
                rows={result.errors}
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
