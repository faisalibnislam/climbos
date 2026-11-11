"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button, Callout, Skeleton } from "@/components/ui";
import { RequestComposer } from "@/components/ui/request-composer";
import { errorMessage } from "../errors";
import { factAnswerKey, nextFactQuestion } from "./factConversation";
import { ConversationBubble as Bubble } from "./OnboardingChat";

type State = FunctionReturnType<typeof api.orgs.onboardingState>;
type Message = { role: "assistant" | "user"; text: string };
type Chat = { messages: Message[]; skipped: string[]; reply: string };
const EMPTY_CHAT: Chat = { messages: [], skipped: [], reply: "" };

function readChat(raw: string | null): Chat {
  try {
    const value = JSON.parse(raw ?? "null") as Chat | null;
    if (!value || !Array.isArray(value.messages) || !Array.isArray(value.skipped) || typeof value.reply !== "string") return EMPTY_CHAT;
    return { messages: value.messages.filter(m => m && ["assistant", "user"].includes(m.role) && typeof m.text === "string" && m.text.length <= 2000).slice(-100), skipped: value.skipped.filter(s => typeof s === "string").slice(-300), reply: value.reply.slice(0, 400) };
  } catch { return EMPTY_CHAT; }
}

export function FactsConversation({ slug, userId, state }: { slug: string; userId: string; state: State }) {
  const answerCheck = useMutation(api.orgs.answerOnboardingCheck);
  const addFact = useMutation(api.orgs.addFact);
  const finish = useMutation(api.orgs.finishFactConversation);
  const [chat, setChat] = useState<Chat>(EMPTY_CHAT);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lock = useRef(false);
  const latest = useRef<HTMLDivElement>(null);
  const storageKey = `climbos:facts-chat:v1:${userId}:${slug}`;
  const question = nextFactQuestion(state.facts, chat.skipped, state.business?.name ?? "your business");
  const selected = question.facts.find(f => f.id === selectedId) ?? (question.facts.length === 1 ? question.facts[0] : null);
  const currentText = [question.text, ...question.facts.map(f => f.statement)].join("\n\n");

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setChat(readChat(sessionStorage.getItem(storageKey))); } catch { /* Optional browser storage. */ }
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify(chat)); } catch { /* Server-side fact answers are still saved. */ }
  }, [chat, loaded, storageKey]);
  useEffect(() => {
    if (chat.messages.length) latest.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat.messages.length]);

  function record(reply: string, skipped: string[] = []) {
    setChat(prev => ({ messages: [...prev.messages, { role: "assistant", text: currentText }, { role: "user", text: reply }].slice(-100) as Message[], skipped: [...new Set([...prev.skipped, ...skipped])], reply: "" }));
    setChanging(false); setSelectedId(null); setError(null);
  }
  async function save(action: "confirm" | "reject" | "edit") {
    if (lock.current || (action !== "confirm" && !selected)) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const facts = action === "confirm" ? question.facts : [selected!];
      await answerCheck({ slug, facts: facts.map(f => ({ id: f.id as Id<"businessFacts">, statement: f.statement })), answer: action, ...(action === "edit" ? { replacement: chat.reply.trim() } : {}) });
      record(action === "confirm" ? "That’s right." : action === "reject" ? `That isn’t true: ${selected!.statement}` : `Here’s the correction: ${chat.reply.trim()}`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function send() {
    if (question.kind === "check") return save("edit");
    if (lock.current || !chat.reply.trim() || !["product", "audience"].includes(question.kind)) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await addFact({ slug, category: question.kind as "product" | "audience", statement: chat.reply.trim() });
      record(chat.reply.trim());
    } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function continueSetup() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await finish({ slug }); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  const skip = () => record("I’m not sure. Let’s leave this open.", question.kind === "check" ? question.facts.map(factAnswerKey) : [question.key]);

  return <div>
    <h1 className="heading-page">Let’s talk about {state.business?.name ?? "your business"}</h1>
    {!loaded ? <Skeleton className="mt-6 h-48 w-full" /> : <>
      <div role="log" aria-label="Conversation about your business" aria-live="polite" aria-relevant="additions" className="mt-6 space-y-4">
        {chat.messages.length > 4 ? <details className="text-sm text-ink-2"><summary className="cursor-pointer py-2">Earlier messages</summary><div className="mt-3 space-y-4">{chat.messages.slice(0, -4).map((m, i) => <Bubble key={i} {...m} />)}</div></details> : null}
        {chat.messages.slice(-4).map((m, i) => <Bubble key={`${chat.messages.length}-${i}`} {...m} />)}
        <div ref={latest}><Bubble role="assistant" text={currentText} /></div>
      </div>
      {question.kind === "check" && !changing && <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Your answer">
        <Button disabled={busy} onClick={() => void save("confirm")}>That’s right</Button>
        <Button disabled={busy} variant="secondary" onClick={() => { setChanging(true); setError(null); }}>Change something</Button>
        <Button disabled={busy} variant="ghost" onClick={skip}>I’m not sure</Button>
      </div>}
      {question.kind === "check" && changing && <div className="mt-4 space-y-3">
        {question.facts.length > 1 ? <fieldset disabled={busy}><legend className="text-sm font-medium">Which part should we change?</legend><div className="mt-2 space-y-2">{question.facts.map(f => <label key={f.id} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm"><input type="radio" name="detail-to-change" className="mt-1" checked={selectedId === f.id} onChange={() => { setSelectedId(f.id); setChat(c => ({ ...c, reply: "" })); }} />{f.statement}</label>)}</div></fieldset> : null}
        {selected ? <>
          <RequestComposer label="What should I know instead?" value={chat.reply} onChange={reply => setChat(c => ({ ...c, reply }))} onSubmit={() => void send()} placeholder="Tell me the right details…" submitLabel="Send correction" maxLength={400} busy={busy} />
          <Button disabled={busy} variant="ghost" onClick={() => void save("reject")}>This isn’t true — leave it out</Button>
        </> : null}
        <Button disabled={busy} variant="ghost" onClick={() => { setChanging(false); setSelectedId(null); }}>Cancel</Button>
      </div>}
      {(question.kind === "product" || question.kind === "audience") ? <div className="mt-4">
        <RequestComposer label="Your reply" value={chat.reply} onChange={reply => setChat(c => ({ ...c, reply }))} onSubmit={() => void send()} placeholder={question.kind === "product" ? "We make… / We help people…" : "We mainly help…"} submitLabel="Send reply" maxLength={400} busy={busy} />
        <Button className="mt-2" disabled={busy} variant="ghost" onClick={skip}>I’m not sure yet</Button>
      </div> : null}
      {question.kind === "check" && <details className="mt-4 text-xs text-ink-3"><summary className="cursor-pointer py-2">Where did this come from?</summary><ul className="mt-2 space-y-2">{question.facts.map(f => {
        const original = state.facts.find(s => s.id === f.id);
        return <li key={f.id}><p>{f.provenance === "owner_supplied" ? "Your message" : f.provenance === "demo_fixture" ? "Demo data" : "Website research — awaiting your confirmation"}</p>{original?.sources.map((source, i) => source && source.url && /^https?:\/\//i.test(source.url) ? <a key={i} href={source.url} target="_blank" rel="noopener noreferrer" className="mr-2 underline">{source.title ?? source.url}<span className="sr-only"> (opens in a new tab)</span></a> : null)}</li>;
      })}</ul></details>}
      {error ? <Callout tone="danger" className="mt-4">{error}</Callout> : null}
      <div className="mt-6 border-t border-line pt-4"><Button variant={question.kind === "ready" ? "primary" : "ghost"} disabled={busy} loading={busy && question.kind === "ready"} onClick={() => void continueSetup()}>{question.kind === "ready" ? "Continue" : "Use what we know and continue"}</Button>{question.kind !== "ready" ? <p className="mt-1 text-xs text-ink-3">Anything you haven’t confirmed stays unconfirmed.</p> : null}</div>
    </>}
  </div>;
}
