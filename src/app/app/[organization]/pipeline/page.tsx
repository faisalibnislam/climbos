"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArrowRight, Plus, Trash2, Users } from "@/components/icons"
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { StatBlocks } from "@/components/ds/content";
import { Badge, Button, ConfirmDialog, DatePicker, EmptyState, Field, Input, Select, Sheet, Textarea, toast } from "@/components/ui";
import { LossReasonFields } from "@/components/app/pipeline/LossReasonFields";
import { DealTranscripts } from "@/components/app/pipeline/DealTranscripts";
import { DealHistory } from "@/components/app/pipeline/DealHistory";
import { DealQualification } from "@/components/app/pipeline/DealQualification";
import { DealReviewButton } from "@/components/app/pipeline/DealReviewButton";
import { DealAttentionBadges } from "@/components/app/pipeline/DealAttentionBadges";
import { dealValueSummaryLabel, formatDealValue } from "@shared/growth/pipeline";
import { minorToMajor } from "@shared/economics/currency";

/** "1200" or "1200.50" → 1200.5; anything else ("1.2.3") → NaN. */
function parseMoney(s: string): number {
  return /^\d+(\.\d*)?$/.test(s.trim()) ? Number(s.trim()) : NaN;
}

const STAGES = [
  { value: "lead", label: "Possible customer" },
  { value: "talking", label: "In conversation" },
  { value: "booked", label: "Call booked" },
  { value: "won", label: "Sale recorded" },
  { value: "lost", label: "Did not go ahead" },
] as const;
type Stage = (typeof STAGES)[number]["value"];
const NEXT: Partial<Record<Stage, Stage>> = { lead: "talking", talking: "booked", booked: "won" };
const SOURCE: Record<string, string> = { outbound: "Outreach", booking: "Booking page", inbox: "Inbox", manual: "Added by you" };

const money = formatDealValue;

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
        title="Customer progress"
        actions={<AddDeal slug={slug} currency={data?.totals.currency ?? null} />}
      />
      {data && data.deals.length ? (
        <StatBlocks
          stats={[
            { label: "Still in progress", value: data.totals.open },
            { label: "Recorded possible value", value: dealValueSummaryLabel(data.totals.pipeline) },
            { label: "Recorded sale value", value: dealValueSummaryLabel(data.totals.won), tone: data.totals.wonValue ? "good" : "default" },
          ]}
        />
      ) : null}
      {data?.deals.length ? <p className="text-sm text-ink-2">Values are owner-reported, not confirmed payments or a sales forecast. Currencies stay separate; missing or unconfirmed amounts are excluded from recorded subtotals.{data.hasMore ? " Showing the newest 500 records only; older records and values are omitted." : ""}</p> : null}
      {data?.deals.length ? <p className="text-xs text-ink-2">{data.timezone ? `Next-step dates use ${data.timezone}; overdue means the calendar day has passed.` : "Set a valid workspace timezone to assess overdue next steps."} Stage-age labels are review prompts based on elapsed days, not proof that a buyer has lost interest. Timing reflects the latest data check in this view.</p> : null}
      {data === undefined ? (
        <LoadingBlock label="Loading customer progress…" lines={4} />
      ) : data.deals.length === 0 ? (
        <EmptyState icon={<Users />} title="No one here yet" body="Replies and bookings land here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-5">
          {STAGES.map((s) => {
            const col = data.deals.filter((d) => d.stage === s.value);
            const values = data.valuesByStage[s.value];
            return (
              <section key={s.value} aria-label={s.label} className="flex min-w-0 flex-col gap-2 rounded-xl bg-surface-2 p-2">
                <header className="flex flex-col gap-1 px-1">
                  <h2 className="text-sm font-semibold text-ink">
                    {s.label} <span className="font-normal text-ink-3">{col.length}</span>
                  </h2>
                  {col.length ? <span className="break-words text-xs text-ink-3">{dealValueSummaryLabel(values)}</span> : null}
                </header>
                {col.map((d) => (
                  <div key={d.id} className="rounded-lg border border-line bg-surface p-2.5">
                    <button type="button" className="w-full text-left" onClick={() => setOpenId(d.id)}>
                      <span className="block truncate text-sm font-medium text-ink">{d.name}</span>
                      {d.company && d.company !== d.name ? <span className="block truncate text-xs text-ink-3">{d.company}</span> : null}
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                        {d.value !== null ? <span className="font-medium text-ink-2">{money(d.value, d.currency)}</span> : <span>{d.valueNeedsReview ? "Value needs review" : "Value not recorded"}</span>}
                        {d.dueDate ? <span>{d.nextStep ?? "Next"}: {d.dueDate}</span> : <span>{relativeTime(d.updatedAt)}</span>}
                        <DealAttentionBadges attention={d.attention} />
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
      <Sheet open={Boolean(open)} onOpenChange={(o) => !o && setOpenId(null)} title={open?.name ?? "Possible sale"}>
        {open ? <DealPanel key={`${open.id}:${open.currency}`} slug={slug} d={open} canEdit={data?.canEdit === true} timezone={data?.timezone ?? null} onClose={() => setOpenId(null)} /> : <span />}
      </Sheet>
    </div>
  );
}

type Deal = NonNullable<ReturnType<typeof useQuery<typeof api.crm.list>>>["deals"][number];

function DealPanel({ slug, d, timezone, canEdit, onClose }: { slug: string; d: Deal; canEdit: boolean; timezone: string | null; onClose: () => void }) {
  const update = useMutation(api.crm.update);
  const remove = useMutation(api.crm.remove);
  const [value, setValue] = useState(d.value === null ? "" : String(minorToMajor(d.value, d.currency)));
  const [nextStep, setNextStep] = useState(d.nextStep ?? "");
  const [nextAt, setNextAt] = useState(d.dueDate ?? "");
  const [savingDate, setSavingDate] = useState(false);
  const [note, setNote] = useState("");
  const save = (patch: Parameters<typeof update>[0]) => update(patch).catch((e) => toast({ tone: "danger", title: errorMessage(e) }));
  const saveDate = async (date: string) => {
    setSavingDate(true);
    try { await update({ slug, id: d.id, nextStepDate: date || null }); setNextAt(date); }
    catch (error) { toast({ tone: "danger", title: errorMessage(error) }); }
    finally { setSavingDate(false); }
  };
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        {d.company ? (
          <>
            <dt className="text-ink-3">Company</dt>
            <dd className="text-ink">{d.company}</dd>
          </>
        ) : null}
        {d.email ? (
          <>
            <dt className="text-ink-3">Email</dt>
            <dd className="break-all text-ink">{d.email}</dd>
          </>
        ) : null}
        <dt className="text-ink-3">Source</dt>
        <dd className="text-ink">{SOURCE[d.source]}</dd>
      </dl>
      <Field label="Where are you with this person?">
        <Select options={STAGES.map((s) => ({ value: s.value, label: s.label }))} value={d.stage} onValueChange={(v) => save({ slug, id: d.id, stage: v as Stage })} />
      </Field>
      <DealReviewButton id={d.id} name={d.name} onPrepared={onClose} />
      <DealQualification slug={slug} id={d.id} />
      <DealHistory slug={slug} id={d.id} />
      <DealTranscripts slug={slug} id={d.id} />
      {d.stage === "lost" ? <LossReasonFields slug={slug} d={d} canEdit={canEdit} /> : null}
      <Field label={`Possible sale value (${d.currency})`} hint={d.valueNeedsReview ? "An earlier amount has unconfirmed currency units. Enter the correct value to confirm it; no historical amount is guessed." : "An owner-reported sale when you pick Sale recorded; not confirmation of payment."}>
        <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} onBlur={() => {
            if (value === (d.value === null ? "" : String(minorToMajor(d.value, d.currency)))) return;
            if (value && !Number.isFinite(parseMoney(value))) return void toast({ tone: "danger", title: "Use a number, like 1200.50" });
            void save({ slug, id: d.id, value: value ? parseMoney(value) : null, expectedCurrency: d.currency });
          }} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Next step">
          <Input value={nextStep} placeholder="Send proposal" onChange={(e) => setNextStep(e.target.value)} onBlur={() => save({ slug, id: d.id, nextStep: nextStep || null })} />
        </Field>
        <Field label="When">
          <DatePicker id="pipeline-next-step-date" value={nextAt} disabled={savingDate} onChange={saveDate} />
          {nextAt || d.attention.nextStepTimingUnknown ? <Button size="sm" variant="ghost" disabled={savingDate} onClick={() => saveDate("")}>Clear next-step date</Button> : null}
        </Field>
      </div>
      <p className="text-xs text-ink-2">{timezone ? `Calendar date in ${timezone}. Changing this date does not reschedule a booking or send anything.` : "Calendar date only. Overdue status stays unknown until the workspace timezone is confirmed."}{d.nextStepAt !== null ? " The existing appointment time is displayed as a date in the workspace timezone; saving replaces this CRM next step with a calendar date." : ""}</p>
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
        description="Notes and history go too. Can't be undone."
        confirmLabel="Remove"
        tone="danger"
        onConfirm={async () => {
          try {
            await remove({ slug, id: d.id });
            onClose();
          } catch (e) {
            toast({ tone: "danger", title: errorMessage(e) });
          }
        }}
        trigger={
          <Button variant="ghost" size="sm" className="self-start text-red-800">
            <Trash2 aria-hidden /> Remove
          </Button>
        }
      />
      {d.stage === "won" ? <Badge tone="green">Sale recorded {d.value !== null ? money(d.value, d.currency) : "— value unknown"}</Badge> : null}
    </div>
  );
}

function AddDeal({ slug, currency }: { slug: string; currency: string | null }) {
  const create = useMutation(api.crm.create);
  const [open, setOpen] = useState(false);
  const [entryCurrency, setEntryCurrency] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", company: "", email: "", value: "" });
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) {
          if (entryCurrency !== currency) setF(current => ({ ...current, value: "" }));
          setEntryCurrency(currency);
        }
        setOpen(next);
      }}
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
          if (f.value && !Number.isFinite(parseMoney(f.value))) return void toast({ tone: "danger", title: "Use a number, like 1200.50" });
          setBusy(true);
          try {
            await create({ slug, name: f.name, company: f.company || undefined, email: f.email || undefined, value: f.value ? parseMoney(f.value) : undefined, expectedCurrency: entryCurrency ?? undefined });
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
        <Field label={`Possible sale value${entryCurrency ? ` (${entryCurrency})` : ""}`} optional>
          <Input inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        </Field>
        {entryCurrency !== currency ? <p className="text-sm text-ink-2">The business currency changed. Close and reopen this form to enter the value in the new currency.</p> : null}
        <Button type="submit" loading={busy} disabled={!f.name.trim() || Boolean(f.value && (!entryCurrency || entryCurrency !== currency))}>
          Add
        </Button>
      </form>
    </Sheet>
  );
}
