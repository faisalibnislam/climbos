"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, Dialog, DialogContent, DatePicker, Field, Textarea, toast } from "@/components/ui";
import { errorMessage } from "../errors";

export function GoalTabs({ slug }: { slug: string }) {
  const data = useQuery(api.goals.list, { slug });
  const select = useMutation(api.goals.select);
  const [editing, setEditing] = useState<{ id?: Id<"goals">; statement: string; deadline?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return <p role="status" className="text-sm text-ink-3">Opening your goals…</p>;
  const current = data.goals.find(g => g.id === data.selectedId);
  return <section aria-label="Your goals" className="space-y-4">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose a goal">
      {data.goals.map(goal => <Button key={goal.id} variant={goal.id === data.selectedId ? "primary" : "secondary"} aria-pressed={goal.id === data.selectedId} disabled={busy || (!data.canEdit && goal.id !== data.selectedId)} className="h-auto max-w-full whitespace-normal break-words text-left" onClick={async () => { if (goal.id === data.selectedId) return; setBusy(true); try { await select({ slug, goalId: goal.id }); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); } }}>{goal.statement}</Button>)}
      {data.canEdit ? <Button variant="link" onClick={() => setEditing({ statement: "" })}>+ Add a goal</Button> : null}
    </div>
    {current ? <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="text-ink-2">{current.deadline ? `Your deadline: ${current.deadline}` : "AI will suggest timing to fit this goal."}</span>{data.canEdit ? <Button variant="link" size="sm" onClick={() => setEditing({ id: current.id, statement: current.statement, deadline: current.deadline ?? undefined })}>Edit goal</Button> : null}</div> : null}
    {data.limited ? <p className="text-sm text-ink-3">Showing your 20 most recent current goals.</p> : null}
    <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent title={editing?.id ? "Edit your goal" : "What would you like to achieve?"} description="Use your own words. AI works out the approach and realistic timing.">{editing ? <GoalForm key={editing.id ?? "new"} slug={slug} initial={editing} onDone={() => setEditing(null)} /> : null}</DialogContent></Dialog>
  </section>;
}

function GoalForm({ slug, initial, onDone }: { slug: string; initial: { id?: Id<"goals">; statement: string; deadline?: string }; onDone: () => void }) {
  const save = useMutation(api.goals.save);
  const [text, setText] = useState(initial.statement);
  const [deadline, setDeadline] = useState(initial.deadline ?? "");
  const [busy, setBusy] = useState(false);
  return <form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await save({ slug, goalId: initial.id, statement: text, deadline: deadline || undefined }); toast({ tone: "success", title: "Goal saved", description: "AI work starts only when you choose to build the recommendation." }); onDone(); } catch (error) { toast({ tone: "danger", title: errorMessage(error) }); } finally { setBusy(false); } }}>
    <Field label="Your goal"><Textarea required minLength={4} maxLength={300} value={text} onChange={e => setText(e.target.value)} placeholder="Help more of the right people try my product" disabled={busy} /></Field>
    {!initial.id ? <div role="group" aria-label="Goal ideas" className="flex flex-wrap gap-2">{["Get more paying customers", "Launch a new product", "Build an audience"].map(s => <Button key={s} type="button" variant="secondary" size="sm" onClick={() => setText(current => current.trim() ? `${current.trimEnd()}\n${s}` : s)}>{s}</Button>)}</div> : null}
    <details><summary className="min-h-11 cursor-pointer text-sm">I have a deadline (optional)</summary><Field label="When does this need to be ready?" hint="AI will flag what can realistically fit, rather than promise the same work faster."><DatePicker value={deadline} onChange={setDeadline} disabled={busy} /></Field></details>
    <p className="text-xs text-ink-3">Saving a goal does not run AI, change spending limits, or share anything.</p>
    <Button type="submit" loading={busy} disabled={text.trim().length < 4}>Save goal</Button>
  </form>;
}
