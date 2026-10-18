"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useState } from "react";
import { Button, Select, Textarea, toast } from "@/components/ui";
import { errorMessage } from "./errors";
import { relativeTime } from "./money";

type Subject = { slug: string; subjectType: "artifact" | "card" | "run" | "strategy" | "campaign"; subjectId: string; title: string; href: string };

/** Who owns this work, plus team comments with @mentions (type @ and a name). */
export function Discussion(subject: Subject) {
  const { slug, subjectType, subjectId } = subject;
  const comments = useQuery(api.team.comments, { slug, subjectType, subjectId });
  const members = useQuery(api.team.members, { slug });
  const owner = useQuery(api.team.assignment, { slug, subjectType, subjectId });
  const add = useMutation(api.team.addComment);
  const assign = useMutation(api.team.assign);
  const del = useMutation(api.team.deleteComment);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const mentionQuery = /@([\w.-]*)$/.exec(body)?.[1];
  const suggestions = mentionQuery !== undefined ? (members ?? []).filter((m) => m.name.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5) : [];
  return (
    <section aria-label="Team discussion" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="heading-card">Team</h2>
        {members && members.length > 1 ? (
          <Select
            aria-label="Assigned to"
            value={owner?.assigneeId ?? "none"}
            onValueChange={async (v) => {
              try {
                await assign({ ...subject, assigneeId: v === "none" ? null : (v as never) });
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              }
            }}
            options={[{ value: "none", label: "Not assigned" }, ...members.map((m) => ({ value: m.id, label: `Assigned to ${m.name}` }))]}
            className="w-56"
          />
        ) : null}
      </div>
      {comments?.length ? (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-surface-2 p-3 text-sm">
              <p className="flex items-center justify-between gap-2 text-xs text-ink-3">
                <span>
                  <span className="font-medium text-ink">{c.author}</span> · {relativeTime(c.createdAt)}
                </span>
                {c.mine ? (
                  <button type="button" className="hover:underline" onClick={() => del({ slug, commentId: c.id })}>
                    Delete
                  </button>
                ) : null}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-ink-2">{c.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">No comments yet. Type @ to mention a teammate.</p>
      )}
      <div className="relative flex flex-col gap-2">
        <Textarea aria-label="Comment" rows={2} autosize value={body} onChange={(e) => setBody(e.target.value)} placeholder="Comment, or @mention someone" />
        {suggestions.length ? (
          <ul className="absolute bottom-full left-0 z-10 mb-1 w-56 rounded-lg border border-line bg-surface p-1 shadow-md">
            {suggestions.map((m) => (
              <li key={m.id}>
                <button type="button" className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2" onClick={() => setBody(body.replace(/@[\w.-]*$/, `@${m.name} `))}>
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button
          size="sm"
          className="self-end"
          loading={busy}
          disabled={!body.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await add({ ...subject, body });
              setBody("");
            } catch (e) {
              toast({ tone: "danger", title: errorMessage(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Comment
        </Button>
      </div>
    </section>
  );
}
