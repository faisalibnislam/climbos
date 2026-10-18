"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight, Plus, Trash2, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Badge, Button, ConfirmDialog, DatePicker, EmptyState, Field, Input, Select, Sheet, Textarea, toast } from "@/components/ui";

/** "1200" or "1200.50" → 1200.5; anything else ("1.2.3") → NaN. */
function parseMoney(s: string): number {
  return /^\d+(\.\d{0,2})?$/.test(s.trim()) ? Number(s.trim()) : NaN;
}

const STAGES = [
  { value: "lead", label: "Lead" },
  { value: "talking", label: "Talking" },
  { value: "booked", label: "Call booked" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
] as const;
type Stage = (typeof STAGES)[number]["value"];
const NEXT: Partial<Record<Stage, Stage>> = { lead: "talking", talking: "booked", booked: "won" };
const SOURCE: Record<string, string> = { outbound: "Outreach", booking: "Booking page", inbox: "Inbox", manual: "Added by you" };

const money = (minor: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);

/** Mini-CRM: everyone you're talking to, from first reply to won. */
export default function PipelinePage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.crm.list, { slug });
  const update = useMutation(api.crm.update);
  const [openId, setOpenId] = useState<Id<"deals"> | null>(null);
  const open = data?.deals.find((d) => d.id === openId) ?? null;
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <PageHeader
        section="pipeline"
        title="Pipeline"
        intro={data ? `${data.totals.open} open · ${money(data.totals.pipelineValue, data.totals.currency)} in play · ${money(data.totals.wonValue, data.totals.currency)} won. Replies and bookings land here by themselves.` : "Replies and bookings land here by themselves."}
        actions={<AddDeal slug={slug} />}
      />
      {data === undefined ? (
        <LoadingBlock label="Loading your pipeline…" lines={4} />
      ) : data.deals.length === 0 ? (
        <EmptyState icon={<Users />} title="No one here yet" body="When someone replies to your outreach or books a call, they show up here. You can add people yourself too." />
      ) : (
        <div className="grid gap-3 md:grid-cols-5">
          {STAGES.map((s) => {
            const col = data.deals.filter((d) => d.stage === s.value);
            const total = col.reduce((sum, d) => sum + (d.value ?? 0), 0);
            return (
              <section key={s.value} aria-label={s.label} className="flex min-w-0 flex-col gap-2 rounded-xl bg-surface-2 p-2">
                <header className="flex items-baseline justify-between px-1">
                  <h2 className="text-sm font-semibold text-ink">
                    {s.label} <span className="font-normal text-ink-3">{col.length}</span>
                  </h2>
                  {total ? <span className="text-xs text-ink-3">{money(total, data.totals.currency)}</span> : null}
                </header>
                {col.map((d) => (
                  <div key={d.id} className="rounded-lg border border-line bg-surface p-2.5">
                    <button type="button" className="w-full text-left" onClick={() => setOpenId(d.id)}>
                      <span className="block truncate text-sm font-medium text-ink">{d.name}</span>
                      {d.company && d.company !== d.name ? <span className="block truncate text-xs text-ink-3">{d.company}</span> : null}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                        {d.value ? <span className="font-medium text-ink-2">{money(d.value, d.currency)}</span> : null}
                        {d.nextStepAt ? <span>{d.nextStep ?? "Next"}: {new Date(d.nextStepAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : <span>{relativeTime(d.updatedAt)}</span>}
                      </span>
                    </button>
                    {NEXT[d.stage] ? (
                      <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={() => update({ slug, id: d.id, stage: NEXT[d.stage] }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
                        {STAGES.find((x) => x.value === NEXT[d.stage])!.label} <ArrowRight aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpenId(null)} title={open?.name ?? "Deal"}>
        {open ? <DealPanel key={open.id} slug={slug} d={open} onDeleted={() => setOpenId(null)} /> : <span />}
      </Sheet>
    </div>
  );
}

type Deal = NonNullable<ReturnType<typeof useQuery<typeof api.crm.list>>>["deals"][number];

function DealPanel({ slug, d, onDeleted }: { slug: string; d: Deal; onDeleted: () => void }) {
  const update = useMutation(api.crm.update);
  const remove = useMutation(api.crm.remove);
  const [value, setValue] = useState(d.value ? String(d.value / 100) : "");
  const [nextStep, setNextStep] = useState(d.nextStep ?? "");
  const [nextAt, setNextAt] = useState(d.nextStepAt ? new Date(d.nextStepAt).toISOString().slice(0, 10) : "");
  const [note, setNote] = useState("");
  const save = (patch: Parameters<typeof update>[0]) => update(patch).catch((e) => toast({ tone: "danger", title: errorMessage(e) }));
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-ink-3">
        {d.company ? `${d.company} · ` : ""}
        {d.email ? `${d.email} · ` : ""}
        {SOURCE[d.source]}
      </p>
      <Field label="Stage">
        <Select options={STAGES.map((s) => ({ value: s.value, label: s.label }))} value={d.stage} onValueChange={(v) => save({ slug, id: d.id, stage: v as Stage })} />
      </Field>
      <Field label={`Deal value (${d.currency})`} hint="Won deals with a value count as revenue in Results.">
        <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))} onBlur={() => {
            if (value && !Number.isFinite(parseMoney(value))) return void toast({ tone: "danger", title: "Enter the value as a number, like 1200 or 1200.50." });
            void save({ slug, id: d.id, value: value ? parseMoney(value) : null });
          }} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Next step">
          <Input value={nextStep} placeholder="Send proposal" onChange={(e) => setNextStep(e.target.value)} onBlur={() => save({ slug, id: d.id, nextStep: nextStep || null })} />
        </Field>
        <Field label="When">
          <DatePicker value={nextAt} onChange={(v) => { setNextAt(v ?? ""); save({ slug, id: d.id, nextStepAt: v ? Date.parse(`${v}T09:00:00`) : null }); }} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-ink">Notes</p>
        {d.notes.length ? (
          <ul className="flex flex-col gap-2">
            {[...d.notes].reverse().map((n, i) => (
              <li key={i} className="rounded-lg bg-surface-2 p-2 text-sm text-ink-2">
                <span className="whitespace-pre-wrap">{n.text}</span>
                <span className="mt-1 block text-xs text-ink-3">{relativeTime(n.at)}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} autosize aria-label="Add a note" placeholder="Add a note" />
        <Button size="sm" variant="secondary" disabled={!note.trim()} onClick={async () => { await save({ slug, id: d.id, note }); setNote(""); }}>
          Add note
        </Button>
      </div>
      <ConfirmDialog
        title={`Remove ${d.name}?`}
        description="Their notes and history in the pipeline go too. This can't be undone."
        confirmLabel="Remove from pipeline"
        tone="danger"
        onConfirm={async () => {
          try {
            await remove({ slug, id: d.id });
            onDeleted();
          } catch (e) {
            toast({ tone: "danger", title: errorMessage(e) });
          }
        }}
        trigger={
          <Button variant="ghost" size="sm" className="self-start text-red-800">
            <Trash2 aria-hidden /> Remove from pipeline
          </Button>
        }
      />
      {d.stage === "won" ? <Badge tone="green">Won {d.value ? money(d.value, d.currency) : ""}</Badge> : null}
    </div>
  );
}

function AddDeal({ slug }: { slug: string }) {
  const create = useMutation(api.crm.create);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", company: "", email: "", value: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      title="Add someone"
      trigger={
        <Button size="sm">
          <Plus aria-hidden /> Add
        </Button>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (f.value && !Number.isFinite(parseMoney(f.value))) return void toast({ tone: "danger", title: "Enter the value as a number, like 1200 or 1200.50." });
          setBusy(true);
          try {
            await create({ slug, name: f.name, company: f.company || undefined, email: f.email || undefined, value: f.value ? parseMoney(f.value) : undefined });
            setF({ name: "", company: "", email: "", value: "" });
            setOpen(false);
          } catch (err) {
            toast({ tone: "danger", title: errorMessage(err) });
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Name" required>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Company" optional>
          <Input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
        </Field>
        <Field label="Email" optional>
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Deal value" optional>
          <Input inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value.replace(/[^0-9.]/g, "") })} />
        </Field>
        <Button type="submit" loading={busy} disabled={!f.name.trim()}>
          Add to pipeline
        </Button>
      </form>
    </Sheet>
  );
}
