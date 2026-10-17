"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  Badge,
  Button,
  Callout,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTrigger,
  Field,
  RadioCards,
  Select,
  Skeleton,
  SocialIcon,
  Textarea,
} from "@/components/ui";
import { microsToDisplay } from "../money";
import { ErrorCallout, RoleName, SectionBoundary, artifactStatusMeta, channelLabel, describeMeters, useWorkspaceMember } from "./shared";
import { RunProgress } from "./RunProgress";

type Job = "content_social" | "content_ads" | "content_email" | "content_seo";
type SocialChannel = "instagram" | "facebook" | "linkedin" | "x" | "tiktok" | "pinterest" | "youtube";

const JOB_OPTIONS = [
  { value: "content_social", title: "Social posts", description: "Captions (and optional images) for one social channel.", icon: "📱" },
  { value: "content_ads", title: "Ads", description: "Search and social ad copy. Nothing runs or spends until you approve a campaign.", icon: "🎯" },
  { value: "content_email", title: "Email sequence", description: "A short series of emails for your customers.", icon: "✉️" },
  { value: "content_seo", title: "SEO page", description: "A web page written to be found on search engines.", icon: "🔍" },
];

const SOCIAL_CHANNELS: { value: SocialChannel; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "tiktok", label: "TikTok" },
  { value: "pinterest", label: "Pinterest" },
  { value: "youtube", label: "YouTube" },
];

const BRIEF_MAX = 1500;

/** "Create content" button + dialog: choose → see estimate → confirm → live progress. */
export function CreateContentDialog({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSession((s) => s + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Sparkles aria-hidden="true" /> Create content
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Create content"
        description="Your AI team writes drafts. Nothing is posted, sent or spent until you approve it."
        className="max-w-2xl"
      >
        <CreateContentForm key={session} slug={slug} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateContentForm({ slug, onClose }: { slug: string; onClose: () => void }) {
  const member = useWorkspaceMember(slug);
  const generate = useMutation(api.content.generate);
  const [job, setJob] = useState<Job>("content_social");
  const [channel, setChannel] = useState<SocialChannel>("instagram");
  const [quantity, setQuantity] = useState(3);
  const [images, setImages] = useState(0);
  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [runId, setRunId] = useState<Id<"workflowRuns"> | null>(null);

  const isSocial = job === "content_social";
  const effectiveImages = isSocial ? Math.min(images, quantity) : 0;
  const canEdit = member?.role ? ["owner", "admin", "editor"].includes(member.role) : undefined;

  if (runId) {
    return (
      <div className="flex flex-col gap-5">
        <RunProgress
          slug={slug}
          runId={runId}
          done={
            <SectionBoundary label="the new drafts">
              <NewDrafts slug={slug} runId={runId} onOpen={onClose} />
            </SectionBoundary>
          }
        />
        <p className="text-sm text-ink-3">You can close this window. The team keeps working and new drafts appear in your content list.</p>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </div>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await generate({
        slug,
        job,
        channel: isSocial ? channel : job === "content_email" ? "email" : job === "content_seo" ? "blog" : undefined,
        quantity: isSocial ? quantity : undefined,
        images: isSocial ? effectiveImages : undefined,
        brief: brief.trim() ? brief.trim() : undefined,
      });
      setRunId(res.runId);
    } catch (e) {
      setError(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {canEdit === false ? (
        <Callout tone="info" title="Only some roles can create content">
          Creating drafts needs an Owner, Admin or Editor. You can still review and approve drafts if you&apos;re a Reviewer.
        </Callout>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-ui font-medium text-ink">What should the team create?</legend>
        <RadioCards
          aria-label="What should the team create?"
          value={job}
          onValueChange={(v) => setJob(v as Job)}
          options={JOB_OPTIONS}
          columns={2}
        />
      </fieldset>

      {isSocial ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Channel">
            <Select
              value={channel}
              onValueChange={(v) => setChannel(v as SocialChannel)}
              options={SOCIAL_CHANNELS.map((c) => ({
                value: c.value,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <SocialIcon network={c.value} size="sm" />
                    {c.label}
                  </span>
                ),
              }))}
            />
          </Field>
          <Field label="How many posts?" hint="Between 1 and 6.">
            <Select
              value={String(quantity)}
              onValueChange={(v) => setQuantity(Number(v))}
              options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} post${n === 1 ? "" : "s"}` }))}
            />
          </Field>
          <Field
            label="Include images?"
            className="sm:col-span-2"
            hint="Each image may use up to 2 image attempts from your monthly allowance (a retry if the first one isn't usable). Images are labeled “AI-generated illustration”."
          >
            <Select
              value={String(images)}
              onValueChange={(v) => setImages(Number(v))}
              options={[
                { value: "0", label: "No images" },
                { value: "1", label: "1 image" },
                { value: "2", label: "2 images", disabled: quantity < 2 },
              ]}
            />
          </Field>
        </div>
      ) : null}

      <Field
        label="Anything the team should know?"
        optional
        hint="For example: a product to feature, an offer, or a tone to use. Leave it empty to let the team follow your plan."
      >
        <Textarea value={brief} onChange={(e) => setBrief(e.target.value.slice(0, BRIEF_MAX))} rows={3} autosize maxRows={8} maxLength={BRIEF_MAX} />
      </Field>
      <p className="-mt-4 text-right text-xs tabular-nums text-ink-3">
        {brief.length} / {BRIEF_MAX} characters
      </p>

      <SectionBoundary label="the cost estimate">
        <EstimatePanel slug={slug} job={job} quantity={isSocial ? quantity : undefined} images={isSocial ? effectiveImages : undefined} />
      </SectionBoundary>

      {error ? <ErrorCallout error={error} /> : null}

      <DialogFooter className="mt-0">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting} loadingText="Starting…" disabled={canEdit === false}>
          Create drafts
        </Button>
      </DialogFooter>
    </form>
  );
}

function NewDrafts({ slug, runId, onOpen }: { slug: string; runId: Id<"workflowRuns">; onOpen: () => void }) {
  const drafts = useQuery(api.content.byRun, { slug, runId });
  if (drafts === undefined) return <Skeleton className="h-16 w-full" />;
  if (drafts.length === 0) {
    return (
      <Callout tone="info" live="status" title="Finished">
        No drafts were created this time. <Link href={`/app/${slug}/content?status=in_review`} onClick={onOpen}>See drafts waiting for approval</Link>
      </Callout>
    );
  }
  return (
    <Callout tone="success" live="status" title={`See the ${drafts.length} draft${drafts.length === 1 ? "" : "s"}`}>
      <p>Nothing has been posted. Open each one to check, edit and approve it.</p>
      <ul className="mt-2 flex flex-col gap-1">
        {drafts.map((d) => (
          <li key={d.id}>
            <Link href={`/app/${slug}/content/${d.id}`} onClick={onOpen} className="inline-flex min-h-9 items-center gap-2">
              {d.title}
              <span className="font-normal text-ink-3">· {channelLabel(d.channel)} · {artifactStatusMeta(d.status).label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Callout>
  );
}

function EstimatePanel({ slug, job, quantity, images }: { slug: string; job: Job; quantity?: number; images?: number }) {
  const est = useQuery(api.content.estimate, { slug, job, quantity, images });
  return (
    <section aria-labelledby="estimate-heading" className="rounded-lg border border-line bg-surface-2 p-4" aria-live="polite" aria-busy={est === undefined}>
      <h3 id="estimate-heading" className="heading-card">
        Before you start
      </h3>
      {est === undefined ? (
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3 text-sm text-ink-2">
          <p>
            <span className="font-semibold text-ink">{est.title}.</span> Uses up to <span className="font-semibold text-ink">{microsToDisplay(est.maxCostMicros)}</span> of
            your monthly AI capacity. Unused capacity is returned when the job finishes.
          </p>
          <div>
            <p className="font-medium text-ink">Counts against</p>
            <ul className="mt-1 list-disc pl-5">
              <li>Your monthly AI capacity</li>
              {describeMeters(est.meters).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink">Who works on it</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {est.roles.map((r) => (
                <li key={r}>
                  <Badge>
                    <RoleName role={r} />
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
