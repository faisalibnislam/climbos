"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CalendarCheck, Check, FileText, Inbox, Mail, MessageCircle, Send, Sparkles, Star, Undo2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RunProgressCompact } from "@/components/app/content/RunProgress";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Badge, Button, Card, CardContent, EmptyState, Segmented, Textarea, toast } from "@/components/ui";
import { cn } from "@/lib/utils";

const BOXES = [
  { value: "open" as const, label: "Open" },
  { value: "done" as const, label: "Done" },
];
const ICONS = { email: Mail, booking: CalendarCheck, chat: MessageCircle, review: Star, form: FileText } as Record<string, typeof Mail>;

/** Unified inbox: replies, bookings and chats in one place, with drafted answers. */
export default function InboxPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const [box, setBox] = useState<"open" | "done">("open");
  const items = useQuery(api.inbox.list, { slug, box });
  const [selected, setSelected] = useState<Id<"communityMessages"> | null>(null);
  const markRead = useMutation(api.inbox.markRead);
  const current = items?.find((m) => m.id === selected) ?? items?.[0] ?? null;
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <PageHeader section="inbox" title="Inbox" intro="Replies to your emails, new bookings and chats. Climb AI drafts answers; you send." actions={<Segmented label="Box" options={BOXES} value={box} onChange={(v) => { setBox(v); setSelected(null); }} />} />
      {items === undefined ? (
        <LoadingBlock label="Loading your inbox…" lines={4} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox />} title={box === "open" ? "All caught up" : "Nothing here yet"} body={box === "open" ? "Replies to your outreach and new bookings land here." : "Answered and dismissed messages show here."} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <ul className="flex flex-col gap-1.5" aria-label="Messages">
            {items.map((m) => {
              const Icon = ICONS[m.kind] ?? MessageCircle;
              const active = current?.id === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(m.id);
                      if (!m.read) void markRead({ slug, id: m.id });
                    }}
                    className={cn("flex w-full gap-3 rounded-xl border p-3 text-left transition-colors", active ? "border-brand-700 bg-brand-50" : "border-line bg-surface hover:border-line-strong")}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", m.read ? "text-ink-2" : "font-semibold text-ink")}>{m.from}</span>
                        <span className="shrink-0 text-xs text-ink-3">{relativeTime(m.receivedAt)}</span>
                      </span>
                      <span className="line-clamp-2 text-xs text-ink-3">{m.text}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {current ? current.kind === "chat" ? <ChatDetail key={current.id} slug={slug} m={current} /> : <Detail key={current.id} slug={slug} m={current} /> : null}
        </div>
      )}
    </div>
  );
}

type Item = NonNullable<ReturnType<typeof useQuery<typeof api.inbox.list>>>[number];

function Detail({ slug, m }: { slug: string; m: Item }) {
  const draft = useMutation(api.inbox.draftReply);
  const setStatus = useMutation(api.inbox.setStatus);
  const reply = useAction(api.mailbox.reply);
  const [text, setText] = useState(m.finalReply ?? m.suggestedReply ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [seenDraft, setSeenDraft] = useState(m.suggestedReply);
  // A fresh AI draft arrived: put it in the box (unless the owner already typed).
  if (m.suggestedReply !== seenDraft) {
    setSeenDraft(m.suggestedReply);
    if (m.suggestedReply && !text.trim()) setText(m.suggestedReply);
  }
  const drafting = Boolean(m.draftRunId) && !m.suggestedReply;
  const done = m.status === "replied" || m.status === "dismissed";
  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="heading-card">{m.from}</p>
            <p className="text-xs text-ink-3">
              {m.fromEmail ? `${m.fromEmail} · ` : ""}
              {new Date(m.receivedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <Badge tone={m.status === "replied" ? "green" : m.status === "dismissed" ? "neutral" : "blue"}>{m.status === "replied" ? "Answered" : m.status === "dismissed" ? "Done" : m.kind === "booking" ? "New booking" : "Needs reply"}</Badge>
        </div>
        {m.subject ? <p className="text-sm font-medium text-ink">{m.subject}</p> : null}
        <p className="whitespace-pre-wrap text-sm text-ink-2">{m.text}</p>
        {m.finalReply && m.status === "replied" ? (
          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="mb-1 text-xs font-medium text-ink-3">You replied</p>
            <p className="whitespace-pre-wrap text-sm text-ink-2">{m.finalReply}</p>
          </div>
        ) : null}
        {!done && m.kind !== "booking" ? (
          <div className="flex flex-col gap-2">
            {drafting && m.draftRunId ? <RunProgressCompact slug={slug} runId={m.draftRunId} /> : null}
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} autosize aria-label="Your reply" placeholder={m.canReply ? "Write your reply, or let Climb AI draft it." : m.kind === "review" ? "Draft your reply here, then post it under the review." : "Draft your answer here, then post it on the platform."} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={busy === "draft"} disabled={drafting} onClick={() => run("draft", () => draft({ slug, id: m.id }))}>
                <Sparkles aria-hidden /> {m.suggestedReply ? "Redraft" : "Draft with AI"}
              </Button>
              {m.canReply ? (
                <Button
                  loading={busy === "send"}
                  disabled={text.trim().length < 2}
                  onClick={() =>
                    run("send", async () => {
                      const r = await reply({ slug, id: m.id, text });
                      toast({ tone: r.ok ? "success" : "danger", title: r.message });
                    })
                  }
                >
                  <Send aria-hidden /> Send from my mailbox
                </Button>
              ) : null}
              <Button variant="ghost" loading={busy === "done"} onClick={() => run("done", () => setStatus({ slug, id: m.id, status: m.canReply ? "dismissed" : "replied" }))}>
                <Check aria-hidden /> Mark done
              </Button>
            </div>
            <p className="text-xs text-ink-3">AI drafts use about 1 credit.</p>
          </div>
        ) : (
          <div className="flex gap-2">
            {done ? (
              <Button variant="ghost" size="sm" onClick={() => run("reopen", () => setStatus({ slug, id: m.id, status: "new" }))}>
                <Undo2 aria-hidden /> Reopen
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => run("done", () => setStatus({ slug, id: m.id, status: "dismissed" }))}>
                <Check aria-hidden /> Got it
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** A website chat: the whole conversation, and the owner's reply goes straight back to the visitor. */
function ChatDetail({ slug, m }: { slug: string; m: Item }) {
  const thread = useQuery(api.chat.thread, { slug, inboxId: m.id });
  const reply = useMutation(api.chat.ownerReply);
  const draft = useMutation(api.inbox.draftReply);
  const setStatus = useMutation(api.inbox.setStatus);
  const [text, setText] = useState("");
  const [seenDraft, setSeenDraft] = useState(m.suggestedReply);
  if (m.suggestedReply !== seenDraft) {
    setSeenDraft(m.suggestedReply);
    if (m.suggestedReply && !text.trim()) setText(m.suggestedReply);
  }
  const [busy, setBusy] = useState<string | null>(null);
  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="heading-card">{thread?.email ?? "Website visitor"}</p>
            {thread?.page ? <p className="truncate text-xs text-ink-3">On {thread.page.replace(/^https?:\/\//, "")}</p> : null}
          </div>
          <Badge tone={thread?.humanTookOver ? "green" : thread?.aiOn ? "blue" : "orange"}>{thread?.humanTookOver ? "You're answering" : thread?.aiOn ? "Climb AI answering" : "Waiting for you"}</Badge>
        </div>
        <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto rounded-lg bg-surface-2 p-3">
          {(thread?.messages ?? []).map((x) => (
            <p key={x.id} className={cn("max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-1.5 text-sm", x.role === "visitor" ? "bg-surface text-ink" : x.role === "owner" ? "ml-auto bg-brand-700 text-white" : "ml-auto bg-brand-50 text-ink")}>
              {x.role === "ai" ? <span className="mb-0.5 block text-2xs font-medium text-ink-3">Climb AI</span> : null}
              {x.text}
            </p>
          ))}
        </div>
        {thread ? (
          <>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autosize aria-label="Your reply" placeholder="Reply in the chat. Climb AI steps back once you answer." />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" loading={busy === "draft"} onClick={() => run("draft", () => draft({ slug, id: m.id }))}>
                <Sparkles aria-hidden /> Draft with AI
              </Button>
              <Button loading={busy === "send"} disabled={!text.trim()} onClick={() => run("send", async () => { await reply({ slug, threadId: thread.threadId, text }); setText(""); })}>
                <Send aria-hidden /> Send in chat
              </Button>
              <Button variant="ghost" onClick={() => run("done", () => setStatus({ slug, id: m.id, status: "dismissed" }))}>
                <Check aria-hidden /> Done
              </Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
