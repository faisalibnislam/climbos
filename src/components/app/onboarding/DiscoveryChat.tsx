"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Button, Callout, Skeleton, Toaster } from "@/components/ui";
import { RequestComposer } from "@/components/ui/request-composer";
import { ConversationBubble } from "./OnboardingChat";
import { WorkspaceSwitcher } from "../WorkspaceSwitcher";
import { RunProgressCompact } from "../content/RunProgress";
import { useCostDisplay } from "../useCostDisplay";
import { errorMessage } from "../errors";

const ACTIVE = ["cost_reserved", "preparing", "executing"];

/** A single real AI conversation. No staged form, fake replies, or automatic planning. */
export function DiscoveryChat({ slug, userId, prefill = "", fresh = "" }: { slug: string | null; userId: string; prefill?: string; fresh?: string }) {
  const state = useQuery(api.intake.view, slug ? { slug } : "skip");
  const chatQuote = useQuery(api.intake.quote, {});
  const ai = useQuery(api.workspace.aiMode, slug ? { slug } : "skip");
  const planStyle = ai?.expertUnlocked ? "focused" as const : "starter" as const;
  const planQuote = useQuery(api.workspace.planQuote, slug && ai ? { slug, planStyle } : "skip");
  const start = useMutation(api.intake.start);
  const send = useMutation(api.intake.send);
  const beginPlan = useMutation(api.intake.beginPlan);
  const finish = useMutation(api.orgs.finishOnboarding);
  const router = useRouter();
  const cost = useCostDisplay();
  const [text, setText] = useState(prefill);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"chat" | "plan">("chat");
  const pending = useRef(false);
  const textRef = useRef(text);
  const request = useRef<{ text: string; key: string } | null>(null);
  const planRequest = useRef<{ revision: number; key: string } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const follows = useRef(true);
  const draftKey = `climbos:intake-draft:v1:${userId}:${slug ?? `new:${fresh}`}`;
  const messages = state?.messages ?? [];
  const latestMessageText = messages.at(-1)?.text;
  const busy = sending || Boolean(state?.busy);
  const planRunning = Boolean(state?.planRun && ACTIVE.includes(state.planRun.status));
  const ready = Boolean(state?.conversation?.ready);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { const saved = sessionStorage.getItem(draftKey); if (saved !== null) { setText(saved.slice(0, 4000)); textRef.current = saved.slice(0, 4000); } } catch { /* Server messages are durable even without browser storage. */ }
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [draftKey]);
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(draftKey, text); } catch { /* The conversation still works. */ }
  }, [text, loaded, draftKey]);
  useEffect(() => {
    if (follows.current && list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length, latestMessageText, state?.conversation?.phase]);

  const changeText = (value: string) => { textRef.current = value; setText(value); };
  async function submit(value = textRef.current) {
    const clean = value.trim();
    if (!clean || pending.current || state?.busy || !loaded) return;
    pending.current = true; setSending(true); setError(null); follows.current = true; setMode("chat");
    const key = request.current?.text === clean ? request.current.key : crypto.randomUUID();
    request.current = { text: clean, key };
    try {
      const result = slug ? await send({ slug, text: clean, requestKey: key }) : await start({ text: clean, requestKey: key, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      const remainder = textRef.current.trim() === clean ? "" : textRef.current;
      changeText(remainder);
      request.current = null;
      if (!slug) {
        try { sessionStorage.setItem(`climbos:intake-draft:v1:${userId}:${result.slug}`, remainder); sessionStorage.removeItem(draftKey); } catch { /* The first wish is already saved on the backend. */ }
        router.replace(`/onboarding?workspace=${result.slug}`);
      }
    } catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setSending(false); }
  }
  async function plan() {
    if (!slug || !state?.conversation || !ready || busy || planRunning || !planQuote || pending.current) return;
    if (textRef.current.trim()) { setError("Send your latest message first so I can include it in the plan."); return; }
    pending.current = true; setSending(true); setError(null);
    const key = planRequest.current?.revision === state.conversation.revision ? planRequest.current.key : crypto.randomUUID();
    planRequest.current = { revision: state.conversation.revision, key };
    try { await beginPlan({ slug, revision: state.conversation.revision, requestKey: key }); planRequest.current = null; setMode("plan"); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { pending.current = false; setSending(false); }
  }
  async function openPlan() {
    if (!slug || pending.current) return;
    pending.current = true; setSending(true); setError(null);
    try { await finish({ slug }); router.push(`/app/${slug}/plan`); }
    catch (cause) { setError(errorMessage(cause)); pending.current = false; setSending(false); }
  }
  const last = messages.at(-1);
  const initial = !slug || (state !== undefined && messages.length === 0);
  const suggestions = last?.role === "assistant" && last.status === "done" ? last.choices : initial ? ["I want more customers.", "Help me launch my business.", "I want more website visitors.", "Help me figure out where to start."] : [];

  return <div className="discovery-shell flex h-dvh min-h-[420px] flex-col bg-bg">
    <Toaster />
    <header className="shrink-0 border-b border-line bg-surface"><div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
      <Link href="/app" aria-label="ClimbOS home"><Logo /></Link>
      <div className="flex items-center gap-2">
        <WorkspaceSwitcher slug={slug ?? undefined} variant="header" />
      </div>
    </div></header>
    <main id="main" className={`mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 ${initial ? "justify-center pb-16" : ""}`}>
      <div ref={list} onScroll={event => { const el = event.currentTarget; follows.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }} className={initial ? "flex-none pb-6" : "min-h-0 flex-1 overflow-y-auto py-8 [scrollbar-gutter:stable]"}>
        {!loaded || (slug && state === undefined) ? <Skeleton className="h-40 w-full" /> : initial ? <div className="pb-2"><h1 className="heading-page text-center">What&apos;s your wish?</h1></div> : <div role="log" aria-label="Your conversation with ClimbOS" aria-live="polite" aria-relevant="additions text" className="space-y-4">
          <h1 className="sr-only">Your conversation with ClimbOS</h1>
          {messages.map(message => <div key={message.id}>
            {message.status === "working" ? <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-2" role="status">{state?.busy ? state.conversation?.phase ?? "Thinking…" : "The reply stopped. Your messages are saved."}</div> : <ConversationBubble role={message.role} text={message.text} />}
            {message.status === "failed" || (message.status === "working" && !state?.busy) ? <Button size="sm" variant="ghost" className="mt-2" disabled={busy} onClick={() => void submit("Please retry your reply to my previous message.")}>Try again</Button> : null}
          </div>)}
        </div>}
        {state?.planReady ? <div className="mt-5 space-y-3">{state.conversation ? <ConversationBubble role="assistant" text="Your plan is ready. Let’s put the first step to work." /> : null}<Button disabled={busy} onClick={() => void openPlan()}>{state.conversation ? "Open my plan" : "Open existing plan"}</Button></div> : (planRunning || mode === "plan") && state?.planRun ? <div className="mt-5 space-y-3"><ConversationBubble role="assistant" text={planRunning ? "I’m preparing your plan. You can keep chatting while I work." : state.planRun.userMessage ?? "The plan needs another look. Your conversation and business details are saved."} /><RunProgressCompact slug={slug!} runId={state.planRun.id} />{!planRunning ? <Button variant="secondary" disabled={busy || !ready} onClick={() => { setMode("chat"); }}>Back to our conversation</Button> : null}</div> : null}
        {ready && !state?.planReady && !planRunning && !busy ? <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4"><Button disabled={!planQuote} onClick={() => void plan()}>Make my plan</Button><p className="text-xs text-ink-3">{planQuote ? `Up to ${cost.upTo(planQuote.maxCostMicros)}. Unused credits return.` : "Checking the planning cost…"}</p></div> : null}
        {state?.conversation?.sources.length ? <details className="mt-5 text-xs text-ink-3"><summary className="cursor-pointer py-2">Website pages checked</summary><ul className="mt-2 space-y-2">{state.conversation.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{source.title ?? source.url}<span className="sr-only"> (opens in a new tab)</span></a>{source.status !== "ok" ? " — couldn’t read this page" : ""}</li>)}</ul></details> : null}
        {error ? <Callout tone="danger" className="mt-4">{error}</Callout> : null}
      </div>
      <div className="shrink-0 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <RequestComposer label="Your message" value={text} onChange={changeText} onSubmit={() => void submit()} placeholder={initial ? "Tell me what you’d like to achieve…" : "Reply, ask a question, or add anything else…"} submitLabel="Send" busy={busy} editableWhileBusy disabled={!loaded || !chatQuote} helper={chatQuote ? `Each AI reply uses up to ${cost.upTo(chatQuote.maxCostMicros)}. Unused credits return.` : "Checking the AI cost…"} suggestions={suggestions} />
      </div>
    </main>
  </div>;
}
