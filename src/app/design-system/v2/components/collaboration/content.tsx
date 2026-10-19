"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Switch } from "@/components/ui";
import type { Person } from "@/components/ds/accounts/avatar";
import { CommentComposer, CommentList, CommentThread, MentionText, ReactionBar, type CommentData, type Reaction } from "@/components/ds/collaboration/comments";
import { ConflictIndicator, LiveEditingField, PresenceAvatars, SyncStatus, type Collaborator, type SyncState } from "@/components/ds/collaboration/presence";
import { ApprovalWorkflow, AssignmentSelector, VersionHistory, type ApprovalStep, type Version } from "@/components/ds/collaboration/workflow";
import { CopyLinkField, ShareDialog, VisibilityToggle, type SharePerson } from "@/components/ds/collaboration/share";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

const PEOPLE: Person[] = [
  { id: "me", name: "Maya Rahman", role: "Owner", presence: "online" },
  { id: "sam", name: "Sam Okafor", role: "Admin", presence: "online" },
  { id: "lena", name: "Lena Brooks", role: "Member", presence: "away" },
  { id: "diego", name: "Diego Ruiz", role: "Client", presence: "offline" },
  { id: "priya", name: "Priya Nair", role: "Member", presence: "online" },
];
const ME = PEOPLE[0];

const COMMENTS: CommentData[] = [
  { id: "c1", authorId: "sam", body: "Caption feels long for Instagram. Can we cut the second line?", time: "10:12", reactions: [{ emoji: "👍", label: "Thumbs up", by: ["lena"] }] },
  { id: "c2", authorId: "lena", body: "Agree. Also @Maya Rahman should we tag the farm?", time: "10:20", reactions: [] },
];

const THREAD: CommentData = {
  id: "t1",
  authorId: "diego",
  body: "Can the photo show the loaf sliced? Customers ask what’s inside.",
  time: "Yesterday",
  reactions: [{ emoji: "👀", label: "Eyes", by: ["sam", "me"] }],
  replies: [
    { id: "t2", authorId: "sam", body: "Good call. @Lena Brooks can you reshoot Thursday morning?", time: "Yesterday", reactions: [] },
    { id: "t3", authorId: "lena", body: "Yes, before opening. I’ll use the window light.", time: "Yesterday", reactions: [{ emoji: "🎉", label: "Party", by: ["diego"] }] },
    { id: "t4", authorId: "me", body: "Thanks both. Pushing the post to Friday.", time: "9:02", reactions: [] },
  ],
};

const COLLABS: Collaborator[] = [
  { id: "sam", name: "Sam Okafor", color: "var(--chart-3)", activity: "Editing caption" },
  { id: "lena", name: "Lena Brooks", color: "var(--chart-4)", activity: "Viewing" },
  { id: "priya", name: "Priya Nair", color: "var(--chart-5)", activity: "Commenting" },
  { id: "diego", name: "Diego Ruiz", color: "var(--chart-1)", idle: true },
  { id: "ana", name: "Ana Souza", color: "var(--chart-2)", activity: "Viewing" },
];

const SAM_TEXT = "Pumpkin loaf is back. Baked at 6, gone by noon. ";

const VERSIONS: Version[] = [
  { id: "v4", label: "Version 4", authorId: "sam", time: "Today 10:31", summary: "Shorter caption, added hashtags", content: "Pumpkin loaf is back. Baked at 6, gone by noon.\n#tartine #sfbakery" },
  { id: "v3", label: "Autosave", authorId: "me", time: "Today 9:58", summary: "Autosaved while editing", content: "Pumpkin loaf is back! Baked fresh every morning at 6 and usually gone by noon.", auto: true },
  { id: "v2", label: "Version 2", authorId: "me", time: "Yesterday 16:40", summary: "Rewrote opening line", content: "Our pumpkin loaf is back for autumn. Baked fresh every morning." },
  { id: "v1", label: "Version 1", authorId: "lena", time: "Yesterday 11:02", summary: "First draft from the autumn play", content: "Autumn special: pumpkin loaf. Available now." },
];

const APPROVAL: ApprovalStep[] = [
  { id: "a1", label: "Draft ready", approverId: "lena", status: "approved", at: "Yesterday" },
  { id: "a2", label: "Owner review", approverId: "me", status: "pending" },
  { id: "a3", label: "Client sign-off", approverId: "diego", status: "waiting" },
];

const SHARE_PEOPLE: SharePerson[] = [
  { id: "me", name: "Maya Rahman", email: "maya@tartine.co", access: "owner" },
  { id: "sam", name: "Sam Okafor", email: "sam@tartine.co", access: "edit" },
  { id: "diego", name: "Diego Ruiz", email: "diego@olliesgym.com", access: "comment" },
];

export function CollaborationContent() {
  const [comments, setComments] = useState(COMMENTS);
  const [thread, setThread] = useState(THREAD);
  const [mentionLog, setMentionLog] = useState<string[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([
    { emoji: "🎉", label: "Party", by: ["sam", "lena", "priya"] },
    { emoji: "❤️", label: "Heart", by: ["me"] },
  ]);
  const [here, setHere] = useState(COLLABS.slice(0, 4));

  // Live editing: Sam "types" into the caption.
  const [caption, setCaption] = useState("");
  const [samTyping, setSamTyping] = useState(false);
  const [notes, setNotes] = useState("Shoot on Thursday at 8.");
  const pos = useRef(0);
  useEffect(() => {
    if (!samTyping) return;
    pos.current = 0;
    const t = window.setInterval(() => {
      pos.current += 1;
      setCaption(SAM_TEXT.slice(0, pos.current));
      if (pos.current >= SAM_TEXT.length) {
        window.clearInterval(t);
        setSamTyping(false);
      }
    }, 90);
    return () => window.clearInterval(t);
  }, [samTyping]);

  const [versions, setVersions] = useState(VERSIONS);
  const [assignee, setAssignee] = useState<string | null>("lena");
  const [steps, setSteps] = useState(APPROVAL);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [expiry, setExpiry] = useState("7d");

  // Conflict demo
  const [mine, setMine] = useState("Pumpkin loaf is back this weekend.");
  const [sync, setSync] = useState<SyncState>("saved");
  const saveTimer = useRef<number | undefined>(undefined);
  const edit = (v: string) => {
    setMine(v);
    if (sync === "conflict") return;
    setSync("saving");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => setSync("saved"), 700);
  };
  const theirs = "Pumpkin loaf is back. Pre-order for Saturday pickup.";

  return (
    <DocPage eyebrow="Components" title="Collaboration" intro="Teams and clients review plays, posts and reports together. Everything here works in real time.">
      <Specimen title="Comments" description="Flat list on a post or play. Hover a comment for actions.">
        <Stage tone="white" className="max-w-2xl">
          <CommentList comments={comments} onChange={setComments} people={PEOPLE} me={ME} />
        </Stage>
      </Specimen>

      <Specimen title="Threaded comments" description="Replies nest under the root. Older replies fold; resolve collapses the thread.">
        <Stage className="max-w-2xl">
          <CommentThread thread={thread} onChange={setThread} people={PEOPLE} me={ME} />
        </Stage>
      </Specimen>

      <Specimen title="Mentions" description="Type @ to open the list. ↑ ↓ to move, Enter or Tab to insert, Esc to close.">
        <Stage tone="white" className="flex max-w-2xl flex-col gap-4">
          <CommentComposer me={ME} people={PEOPLE.slice(1)} onSend={(b) => setMentionLog((l) => [...l, b])} placeholder="Try: @sa" sendLabel="Send" />
          {mentionLog.length ? (
            <ul className="flex flex-col gap-1.5 border-t border-line pt-3 text-sm">
              {mentionLog.map((b, i) => (
                <li key={i}>
                  <MentionText body={b} people={PEOPLE} />
                </li>
              ))}
            </ul>
          ) : null}
        </Stage>
        <Spec items={[["Pattern", "ARIA combobox on the textarea, listbox of up to 5 people"], ["Stored as", "“@Full Name”, highlighted against the people list"]]} />
      </Specimen>

      <Specimen title="Reactions" description="Your reactions are pressed. The tooltip names who reacted.">
        <Stage tone="white">
          <ReactionBar reactions={reactions} onChange={setReactions} meId="me" people={PEOPLE} />
        </Stage>
      </Specimen>

      <Specimen title="Presence avatars" description="Who’s on this page, ringed in their cursor colour. Idle people fade.">
        <Stage tone="white" className="flex flex-wrap items-center justify-between gap-4">
          <PresenceAvatars people={here} max={4} />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={here.length >= COLLABS.length} onClick={() => setHere(COLLABS.slice(0, here.length + 1))}>
              Someone joins
            </Button>
            <Button size="sm" variant="ghost" disabled={here.length <= 1} onClick={() => setHere(here.slice(0, -1))}>
              Someone leaves
            </Button>
          </div>
        </Stage>
      </Specimen>

      <Specimen title="Live editing indicator" description="The field locks while a teammate types, with their name and colour.">
        <Stage tone="white" className="flex max-w-xl flex-col gap-4">
          <LiveEditingField label="Caption" value={caption} onChange={setCaption} editor={samTyping ? COLLABS[0] : null} multiline />
          <LiveEditingField label="Shoot notes" value={notes} onChange={setNotes} />
          <Button size="sm" variant="secondary" className="self-start" disabled={samTyping} onClick={() => setSamTyping(true)}>
            {samTyping ? "Sam is typing…" : "Let Sam edit the caption"}
          </Button>
        </Stage>
      </Specimen>

      <Specimen title="Version history" description="↑ ↓ to browse. Restoring adds a new version; nothing is lost.">
        <VersionHistory versions={versions} onChange={setVersions} people={PEOPLE} meId="me" />
      </Specimen>

      <Specimen title="Assignment selector">
        <Stage tone="white" className="flex flex-wrap items-center gap-3">
          <span className="text-ui text-ink-3">Reshoot photo</span>
          <AssignmentSelector people={PEOPLE} value={assignee} onChange={setAssignee} meId="me" />
        </Stage>
      </Specimen>

      <Specimen title="Approval workflow" description="Steps run in order. Requesting changes needs a reason and sends it back to the start.">
        <Stage className="max-w-xl">
          <ApprovalWorkflow steps={steps} onChange={setSteps} people={PEOPLE} meId="me" doneText="Scheduled for Fri 9:00 on Instagram and Facebook." />
        </Stage>
      </Specimen>

      <Specimen title="Share dialog">
        <Stage tone="white">
          <ShareDialog itemName="Autumn results report" url="https://app.climbos.com/r/autumn-results-7Hq2" initialPeople={SHARE_PEOPLE} />
        </Stage>
      </Specimen>

      <Specimen title="Public/private toggle" description="Going public asks first.">
        <Stage tone="white" className="flex max-w-xl flex-col gap-3">
          <VisibilityToggle value={visibility} onChange={setVisibility} />
          <Switch label="Public (compact)" description="Same rule, for tight spaces." checked={visibility === "public"} onCheckedChange={(on) => setVisibility(on ? "public" : "private")} />
        </Stage>
      </Specimen>

      <Specimen title="Copy share link">
        <Stage tone="white" className="max-w-xl">
          <CopyLinkField url="https://app.climbos.com/r/autumn-results-7Hq2" expiry={expiry} onExpiryChange={setExpiry} />
        </Stage>
      </Specimen>

      <Specimen title="Conflict resolution indicator" description="Save state in the toolbar. When edits collide, compare and pick.">
        <Stage tone="white" className="flex max-w-2xl flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-ui font-medium">Caption</span>
            <SyncStatus state={sync} />
          </div>
          <input value={mine} onChange={(e) => edit(e.target.value)} aria-label="Caption" className="h-[var(--h-md)] w-full rounded-[var(--radius-field)] border border-control bg-surface px-3 text-ui focus-visible:border-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600" />
          {sync === "conflict" ? (
            <ConflictIndicator
              mine={mine}
              theirs={theirs}
              theirName="Sam Okafor"
              when="1 min ago"
              onResolve={(v) => {
                setMine(v.replace("\n", " "));
                setSync("saved");
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSync("conflict")}>
                Simulate Sam’s save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSync("offline")}>
                Go offline
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-4 border-t border-line pt-3">
            {(["saved", "saving", "offline", "conflict"] as const).map((s) => (
              <SyncStatus key={s} state={s} />
            ))}
          </div>
        </Stage>
      </Specimen>
    </DocPage>
  );
}
