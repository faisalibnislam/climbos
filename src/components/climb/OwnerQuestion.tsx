"use client";
import { useId, useState } from "react";
import type { OwnerQuestion } from "@shared/climb/ownerQuestion";
import { Button, Textarea } from "@/components/ui";
export type QuestionAnswer = { optionIds: string[]; notSure: boolean; other?: string };
export function OwnerQuestionCard({ question, disabled, onAnswer }: { question: OwnerQuestion & { status: "pending" | "answered"; answerText?: string }; disabled?: boolean; onAnswer: (answer: QuestionAnswer) => Promise<void> }) {
  const name = useId();
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [useOther, setUseOther] = useState(false);
  const [busy, setBusy] = useState(false);
  if (question.status === "answered") return <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm"><p className="font-medium">{question.title}</p><p className="mt-2 whitespace-pre-line text-ink-2">{question.answerText}</p></div>;
  const answer = async (value: QuestionAnswer) => { setBusy(true); try { await onAnswer(value); } finally { setBusy(false); } };
  return <form className="space-y-3 rounded-xl border border-brand-200 bg-surface p-3" onSubmit={(event) => { event.preventDefault(); void answer({ optionIds: selected, notSure: false, ...(useOther ? { other } : {}) }); }}>
    <fieldset disabled={busy || disabled} className="space-y-2"><legend className="mb-1 font-semibold">{question.title}</legend><p className="pb-1 text-xs text-ink-3">{question.reason} {question.kind === "multiple" ? "Choose all that fit." : "Choose one."}</p>
      {question.options.map((option) => <label key={option.id} className="flex min-h-11 cursor-pointer items-start gap-2 rounded-lg border border-line px-3 py-2 text-sm"><input className="mt-1" type={question.kind === "multiple" ? "checkbox" : "radio"} name={name} checked={selected.includes(option.id)} onChange={(event) => { if (question.kind === "single") { setSelected([option.id]); setUseOther(false); } else setSelected(event.target.checked ? [...selected, option.id] : selected.filter((id) => id !== option.id)); }} />{option.label}</label>)}
      {question.allowOther ? <label className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm"><input type={question.kind === "multiple" ? "checkbox" : "radio"} name={name} checked={useOther} onChange={(event) => { setUseOther(event.target.checked); if (question.kind === "single") setSelected([]); }} />Something else</label> : null}
      {useOther ? <label className="block text-sm">Your answer<Textarea className="mt-1" maxLength={1200} value={other} onChange={(event) => setOther(event.target.value)} required /></label> : null}
    </fieldset>
    <div className="flex flex-wrap gap-2"><Button type="submit" size="sm" loading={busy} disabled={disabled || (!selected.length && !(useOther && other.trim()))}>Continue</Button><Button type="button" variant="secondary" size="sm" disabled={busy || disabled} onClick={() => void answer({ optionIds: [], notSure: true })}>I’m not sure</Button></div>
  </form>;
}
