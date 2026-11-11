"use client";

export type OnboardingMessage = { role: "assistant" | "user"; text: string };

export function savedMessages(raw: string | null): OnboardingMessage[] {
  try {
    const value = JSON.parse(raw ?? "null") as { messages?: OnboardingMessage[] } | null;
    if (!Array.isArray(value?.messages)) return [];
    return value.messages.filter(m => m && ["assistant", "user"].includes(m.role) && typeof m.text === "string" && m.text.length <= 2000).slice(-100);
  } catch { return []; }
}

export function ConversationBubble({ role, text }: OnboardingMessage) {
  return <div className={role === "user" ? "ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-brand-800 px-4 py-3 text-white" : "max-w-[95%] rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3 text-ink"}>
    <p className="mb-1 text-xs font-medium opacity-70">{role === "user" ? "You" : "ClimbOS"}</p>
    <p className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{text}</p>
  </div>;
}

export function ConversationHistory({ messages }: { messages: OnboardingMessage[] }) {
  return <>
    {messages.length > 2 ? <details className="text-sm text-ink-2"><summary className="cursor-pointer py-2">Earlier messages</summary><div className="mt-3 space-y-4">{messages.slice(0, -2).map((m, i) => <ConversationBubble key={i} {...m} />)}</div></details> : null}
    {messages.slice(-2).map((m, i) => <ConversationBubble key={`${messages.length}-${i}`} {...m} />)}
  </>;
}
