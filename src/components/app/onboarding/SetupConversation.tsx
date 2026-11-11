"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { fractionDigits } from "@shared/economics/currency";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Callout, Skeleton } from "@/components/ui";
import { RequestComposer } from "@/components/ui/request-composer";
import { errorMessage } from "../errors";
import { useCostDisplay } from "../useCostDisplay";
import { RetryRunIfPossible, RunProgress, RunProgressCompact } from "../content/RunProgress";
import { ConversationBubble, ConversationHistory, savedMessages, type OnboardingMessage } from "./OnboardingChat";

type State = FunctionReturnType<typeof api.orgs.onboardingState>;
type Edit = "goal" | "budget" | "approval" | null;
const ACTIVE = ["cost_reserved", "preparing", "executing"];

export function SetupConversation({ slug, userId, state }: { slug: string; userId: string; state: State }) {
  const prepare = useMutation(api.orgs.prepareOnboardingConversation);
  const setAutonomy = useMutation(api.orgs.setAutonomy);
  const setBudget = useMutation(api.orgs.setAdBudget);
  const generate = useMutation(api.orgs.generatePlan);
  const finish = useMutation(api.orgs.finishOnboarding);
  const router = useRouter();
  const ai = useQuery(api.workspace.aiMode, { slug });
  const aiMode = ai?.mode ?? "basic";
  const planStyle = ai?.expertUnlocked ? "focused" as const : "starter" as const;
  const quote = useQuery(api.workspace.planQuote, ai ? { slug, planStyle, aiMode } : "skip");
  const cost = useCostDisplay();
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [reply, setReply] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Edit>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const attempted = useRef("");
  const storageKey = `climbos:setup-chat:v1:${userId}:${slug}`;
  const canEdit = ["owner", "admin", "editor"].includes(state.role);
  const canManage = ["owner", "admin"].includes(state.role);
  const step = state.org.onboardingStep;
  const needsGoal = step === "goal" && !state.goal && !state.business?.onboardingIntro?.goalStatement;
  const preparing = ["goal", "preferences"].includes(step) && !needsGoal;
  const run = state.strategyRun;
  const running = Boolean(run && ACTIVE.includes(run.status));
  const ready = Boolean(state.strategy && ["needs_approval", "approved"].includes(state.strategy.status));
  const stopped = Boolean(run && ["failed", "canceled", "uncertain"].includes(run.status) && !ready);
  const needsRevision = Boolean(!running && !ready && state.strategy && ["draft", "superseded"].includes(state.strategy.status));
  const knownGoal = state.goal?.statement ?? state.business?.onboardingIntro?.goalStatement;
  const policyText = state.autonomy === "copilot" ? "I’ll prepare drafts for you to publish yourself." : state.autonomy === "bounded_autopilot" ? "I’ll keep the recurring-work rules you already approved." : "I’ll prepare the work. You’ll see it before anything is published or sent.";
  const budget = state.goal?.monthlyAdBudget ?? state.business?.onboardingIntro?.monthlyAdBudget ?? 0;
  const contextText = `Your wish: ${knownGoal ?? "We’ll choose a useful first step together."}\n\n${policyText}\n\n${budget > 0 ? `Your stated ad budget is ${budget} ${state.business?.currency ?? "USD"} a month. This does not launch ads.` : "I’ll start with ways to grow without buying ads."}\n\nAI will choose the timing to fit your goal, using your website research and the details we already have.`;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = sessionStorage.getItem(storageKey);
        const saved = raw ? JSON.parse(raw) as { reply?: unknown } : null;
        setMessages(raw ? savedMessages(raw) : savedMessages(sessionStorage.getItem(`climbos:facts-chat:v1:${userId}:${slug}`)));
        if (typeof saved?.reply === "string") setReply(saved.reply.slice(0, 300));
      } catch { /* Backend goal and approval settings are still preserved. */ }
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey, userId, slug]);
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ messages, reply })); } catch { /* Optional browser storage. */ }
  }, [loaded, storageKey, messages, reply]);

  // This is free state preparation, never model work, publishing, or a spending increase.
  useEffect(() => {
    if (!loaded || !preparing || !canEdit) return;
    const key = `${step}:${state.goal?.id ?? "new"}:${knownGoal ?? ""}`;
    if (attempted.current === key) return;
    attempted.current = key;
    void prepare({ slug, expectedGoalId: state.goal?.id ?? null }).catch(cause => setError(errorMessage(cause)));
  }, [loaded, preparing, canEdit, step, state.goal?.id, knownGoal, prepare, slug]);

  function record(question: string, answer: string) {
    setMessages(prev => [...prev, { role: "assistant", text: question }, { role: "user", text: answer }].slice(-100) as OnboardingMessage[]);
    setReply(""); setEditing(null);
  }
  async function act(work: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { await work(); } catch (cause) { setError(errorMessage(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function saveReply() {
    const text = reply.trim();
    if (!text) return;
    if (editing === "budget") {
      const clean = text.replace(/,/g, "");
      const digits = fractionDigits(state.business?.currency);
      if (!/^\d+(?:\.\d+)?$/.test(clean) || (clean.split(".")[1]?.length ?? 0) > digits || !Number.isFinite(Number(clean)) || Number(clean) > 1_000_000) { setError(`Enter an amount in ${state.business?.currency ?? "USD"}, using up to ${digits} decimal places. Use 0 for no ads.`); return; }
      return act(async () => { await setBudget({ slug, monthlyAdBudget: Number(clean) }); record("What monthly ad budget would you like to allow?", `${clean} ${state.business?.currency ?? "USD"} a month.`); });
    }
    return act(async () => {
      await prepare({ slug, expectedGoalId: state.goal?.id ?? null, statement: text });
      record(needsGoal ? "What would you most like help with?" : "What would you like to change about your goal?", text);
    });
  }
  const start = () => act(async () => {
    if (!quote || !ai || preparing || !state.goal) return;
    await generate({ slug, planStyle, aiMode });
    record(`I can make your plan for up to ${cost.upTo(quote.maxCostMicros)}. Unused credits return.`, "Make my plan.");
  });
  const leave = (path: string) => act(async () => {
    if (canEdit) await finish({ slug });
    router.push(`/app/${slug}/${path}`);
  });

  return <div>
    <h1 className="heading-page">{ready ? "Your plan is ready" : running ? "I’m working on your plan" : "Let’s work on your wish"}</h1>
    {!loaded ? <Skeleton className="mt-6 h-48 w-full" /> : <>
      <div role="log" aria-label="Your onboarding conversation" aria-live="polite" aria-relevant="additions" className="mt-6 space-y-4">
        <ConversationHistory messages={messages} />
        {needsGoal ? <ConversationBubble role="assistant" text={`${state.business?.researchFocus ? `The website research suggests exploring “${state.business.researchFocus.title}”. That’s a suggestion, not a decision about your goal.\n\n` : ""}What would you most like help with? You can also ask me to choose a useful first step.`} /> :
          <ConversationBubble role="assistant" text={ready ? "Your recommendation and next steps are ready to look at. You can discuss or change them before putting anything into action." : running ? "I’m using the research and your wish to prepare a recommendation. I’ll choose suitable milestones and prepare the first pieces of work. You can leave while I work." : stopped ? run?.userMessage ?? "I couldn’t finish the plan. Your answers are saved. We can retry from here." : needsRevision ? "The last draft needs another pass before it is ready. Your goal and answers are saved. I can prepare a new version for you to review." : contextText} />}
      </div>
      {needsGoal || editing === "goal" || editing === "budget" ? <div className="mt-4 space-y-3">
        {editing === "budget" ? <ConversationBubble role="assistant" text={`What monthly ad budget would you like to allow, in ${state.business?.currency ?? "USD"}? Use 0 to keep ads off. This is separate from the AI cost.`} /> : editing === "goal" ? <ConversationBubble role="assistant" text="What would you like to change about your goal?" /> : null}
        <RequestComposer label={editing === "budget" ? "Monthly ad budget" : "Your reply"} value={reply} onChange={setReply} onSubmit={() => void saveReply()} placeholder={editing === "budget" ? "0" : "Tell me what you want to achieve…"} submitLabel="Send reply" maxLength={300} busy={busy || !canEdit} suggestions={needsGoal ? ["Help me choose the best first step.", "I want more customers.", "I want more website visitors.", "I want more sales."] : []} />
        {editing ? <Button variant="ghost" disabled={busy} onClick={() => { setEditing(null); setReply(""); }}>Cancel</Button> : null}
      </div> : null}
      {editing === "approval" ? <div className="mt-4 space-y-3">
        <ConversationBubble role="assistant" text="How would you like to handle publishing?" />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Publishing preference">
          {([ ["review", "Show me before publishing"], ["copilot", "I’ll publish the drafts myself"] ] as const).map(([mode, label]) => <Button key={mode} variant="secondary" disabled={busy} onClick={() => void act(async () => { await setAutonomy({ slug, mode }); record("How would you like to handle publishing?", label); })}>{label}</Button>)}
          <Button variant="ghost" disabled={busy} onClick={() => setEditing(null)}>Keep current setting</Button>
        </div>
      </div> : null}
      {error ? <Callout tone="danger" className="mt-4">{error}{preparing ? <Button className="mt-3" variant="secondary" disabled={busy} onClick={() => void act(() => prepare({ slug, expectedGoalId: state.goal?.id ?? null }))}>Try again</Button> : null}</Callout> : null}
      {preparing && !error ? <p className="mt-4 text-sm text-ink-3" role="status">Carrying your answers forward…</p> : null}
      {running ? <div className="mt-4 rounded-2xl border border-line bg-surface p-4"><RunProgressCompact slug={slug} runId={run!.id} /><details className="mt-3 text-sm text-ink-2"><summary className="cursor-pointer py-2">See what’s happening</summary><RunProgress slug={slug} runId={run!.id} headingLevel="h2" /></details></div> : null}
      {ready ? <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void leave("plan")}>Show my next step</Button>
        <Button disabled={busy} variant="ghost" onClick={() => void leave("today")}>Go to Home</Button>
      </div> : !needsGoal && !preparing && !running && !editing ? <div className="mt-5 space-y-3">
        {stopped && run ? <RetryRunIfPossible slug={slug} runId={run.id} /> : null}
        {state.canRunAi && canEdit ? <>
          <p className="text-xs text-ink-3">{quote ? `Up to ${cost.upTo(quote.maxCostMicros)}. Unused credits return.` : "Checking the AI cost…"}</p>
          <Button disabled={busy || !quote || !ai || !state.goal} loading={busy} onClick={() => void start()}>{stopped || needsRevision ? "Make a new plan" : "Make my plan"}</Button>
        </> : <Callout tone="warning">{state.accessMessage ?? "An owner, admin or editor can start the plan."}{!state.canRunAi ? <Link href={`/app/${slug}/settings/billing`} className="ml-2 underline">See available credits</Link> : null}</Callout>}
        {canEdit && !run && !state.strategy ? <details className="text-sm text-ink-2"><summary className="cursor-pointer py-2">Change something</summary><div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing("goal"); setReply(state.goal?.statement ?? ""); }}>My goal</Button>
          {canManage ? <><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing("budget"); setReply(""); }}>Ad budget</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing("approval")}>Publishing preference</Button></> : null}
        </div></details> : null}
      </div> : null}
      {ready && state.firstWinRunIds?.length ? <details className="mt-5 text-sm text-ink-2"><summary className="cursor-pointer py-2">Work being prepared</summary><div className="mt-2 space-y-3">{state.firstWinRunIds.map(id => <RunProgressCompact key={id} slug={slug} runId={id} />)}</div></details> : null}
    </>}
  </div>;
}
