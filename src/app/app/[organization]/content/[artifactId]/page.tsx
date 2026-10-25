"use client";

import { Discussion } from "@/components/app/Discussion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Archive, ArchiveRestore, ArrowLeft, Ellipsis, ExternalLink, Pencil } from "@/components/icons"
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Skeleton,
  toast,
} from "@/components/ui";
import { formatDateTime, relativeTime } from "@/components/app/money";
import { AdCampaignPanel } from "@/components/app/content/detail/AdCampaignPanel";
import { ApprovalPanel } from "@/components/app/content/detail/ApprovalPanel";
import { ChannelPreview } from "@/components/app/content/detail/ChannelPreview";
import { DraftEditor } from "@/components/app/content/detail/DraftEditor";
import { RepurposeDialog } from "@/components/app/content/RepurposeDialog";
import { TrendEvidenceNote } from "@/components/app/content/TrendEvidenceNote";
import { TranslateDialog } from "@/components/app/content/TranslateDialog";
import { FactsList, FlaggedClaims, ReceiptsTimeline, VersionHistory } from "@/components/app/content/detail/HistoryPanels";
import { EmailSendPanel, isEmailKind } from "@/components/app/content/detail/EmailSendPanel";
import { PublishPanel } from "@/components/app/content/detail/PublishPanel";
import { UncertainPanel } from "@/components/app/content/detail/UncertainPanel";
import { isCampaignAd, type ArtifactView } from "@/components/app/content/detail/model";
import { ArtifactStatus, ChannelTag, ErrorCallout, NoteList, SectionBoundary, useNow, useWorkspaceMember } from "@/components/app/content/shared";

export default function ContentDetailPage() {
  const { organization: slug, artifactId } = useParams<{ organization: string; artifactId: string }>();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2.5 self-start text-ink-2 hover:text-ink">
        <Link href={`/app/${slug}/content`}>
          <ArrowLeft aria-hidden="true" /> Content
        </Link>
      </Button>
      <SectionBoundary pageHeading="This content isn't available" label="this content">
        <ArtifactDetail slug={slug} artifactId={artifactId as Id<"artifacts">} />
      </SectionBoundary>
    </div>
  );
}

function Section({ id, title, children, action }: { id: string; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={id} className="heading-section">
            {title}
          </h2>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ArtifactDetail({ slug, artifactId }: { slug: string; artifactId: Id<"artifacts"> }) {
  const artifact = useQuery(api.content.get, { slug, artifactId });
  const member = useWorkspaceMember(slug);
  const now = useNow();
  const [editing, setEditing] = useState(false);

  if (artifact === undefined) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <h1 className="sr-only">Loading content</h1>
        <span className="sr-only" role="status">
          Loading…
        </span>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const cur = artifact.current;
  // Uncertain posts are settled first (It was posted / It wasn't posted), then edited.
  const locked = ["publishing", "published", "uncertain"].includes(artifact.status);
  const canEditNow = artifact.canEdit && !locked && Boolean(cur);
  const isAd = isCampaignAd(artifact.channel);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ChannelTag channel={artifact.channel} />
          <div className="flex items-center gap-2">
            {canEditNow && !editing ? (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" /> Edit
              </Button>
            ) : null}
            {artifact.canEdit && !editing ? <RepurposeDialog slug={slug} artifactId={artifact.id} /> : null}
            {artifact.canEdit && !editing ? <TranslateDialog slug={slug} artifactId={artifact.id} /> : null}
            {artifact.canEdit && artifact.status === "archived" ? <RestoreButton slug={slug} artifact={artifact} /> : null}
            {artifact.canEdit && !["archived", "publishing", "uncertain"].includes(artifact.status) ? <MoreMenu slug={slug} artifact={artifact} /> : null}
          </div>
        </div>
        <h1 className="heading-page break-words">{artifact.title}</h1>
        <ArtifactStatus status={artifact.status} showHelp />
        {now ? (
          <p className="text-xs text-ink-3">
            <time dateTime={new Date(artifact.createdAt).toISOString()}>{formatDateTime(artifact.createdAt)}</time>
            {" · updated "}
            {relativeTime(artifact.updatedAt, now)}
          </p>
        ) : null}
        {artifact.isDemo ? <p className="text-sm text-violet-800">Demo: publishing is simulated.</p> : null}
      </header>

      {artifact.status === "uncertain" ? <UncertainPanel slug={slug} artifact={artifact} /> : null}
      {cur ? <FlaggedClaims claims={cur.unsupportedClaims} /> : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {editing && canEditNow ? (
            <Card>
              <CardContent className="flex flex-col gap-4">
                <FocusHeading>Edit draft</FocusHeading>
                <DraftEditor key={cur?.id} slug={slug} artifact={artifact} onDone={() => setEditing(false)} />
              </CardContent>
            </Card>
          ) : null}

          <Section id="preview-heading" title="Preview">
            {artifact.reel?.videoUrl ? (
              <video src={artifact.reel.videoUrl} controls playsInline className="aspect-[9/16] w-full max-w-xs rounded-lg bg-black" />
            ) : artifact.reel ? (
              <p className="text-sm text-ink-3">Demo: no video.</p>
            ) : null}
            {cur ? <ChannelPreview channel={artifact.channel} version={cur} accountLabel={artifact.publishTarget?.accountLabel} /> : <p className="text-sm text-ink-3">No text yet.</p>}
            {locked ? <p className="text-sm text-ink-3">{artifact.status === "uncertain" ? "Check if it posted before editing." : "Published content can't be edited."}</p> : null}
          </Section>

          {cur?.copyBrief || cur?.contentAngle ? (
            <Section id="intent-heading" title="Why this draft">
              <Card>
                <CardContent className="flex flex-col gap-3">
                  {cur.contentAngle ? <div><p className="text-xs font-medium text-ink-3">Writing angle</p><p className="text-sm text-ink">{cur.contentAngle}</p></div> : null}
                  {cur.copyBrief ? (
                    <>
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div><dt className="text-xs text-ink-3">Intended reader</dt><dd className="text-ink">{cur.copyBrief.reader}</dd></div>
                        <div><dt className="text-xs text-ink-3">Objective</dt><dd className="text-ink">{cur.copyBrief.objective}</dd></div>
                        {cur.copyBrief.approvedOfferPlayName ? <div className="sm:col-span-2"><dt className="text-xs text-ink-3">Plan item used</dt><dd className="text-ink">{cur.copyBrief.approvedOfferPlayName}</dd></div> : null}
                        <div className="sm:col-span-2"><dt className="text-xs text-ink-3">Core idea</dt><dd className="text-ink">{cur.copyBrief.centralIdea}</dd></div>
                      </dl>
                      {cur.copyBrief.supportingSourceUrls.some((url) => /^https?:\/\//i.test(url)) ? (
                        <div>
                          <p className="text-xs font-medium text-ink-2">Sources attached to this draft</p>
                          <ul className="mt-1 flex flex-col gap-1">
                            {cur.copyBrief.supportingSourceUrls.filter((url) => /^https?:\/\//i.test(url)).map((url) => (
                              <li key={url}>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-sm text-brand-800 underline-offset-2 hover:underline">
                                  {url}<ExternalLink aria-hidden="true" className="size-3 shrink-0" />
                                  <span className="sr-only">(opens in a new tab)</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1 text-xs text-ink-3">These are the source URLs the draft records. Check the page and date before treating a trend as current.</p>
                        </div>
                      ) : null}
                      {cur.copyBrief.trendEvidence ? <TrendEvidenceNote evidence={cur.copyBrief.trendEvidence} /> : null}
                      {cur.copyBrief.unknowns.length ? (
                        <div className="rounded-[var(--radius-control)] bg-amber-100 p-2.5">
                          <p className="text-xs font-semibold text-amber-900">Still unknown</p>
                          <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">{cur.copyBrief.unknowns.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</ul>
                        </div>
                      ) : null}
                      <p className="text-xs text-ink-3">This explains how the draft was framed. It does not establish that a trend fits, that a claim is true, or that the post will perform.</p>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </Section>
          ) : null}

          <Section id="versions-heading" title="Version history">
            <VersionHistory artifact={artifact} myUserId={member?.userId ?? null} now={now} />
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section id="approval-heading" title="Approval">
            <ApprovalPanel slug={slug} artifact={artifact} now={now} />
          </Section>

          {isAd ? (
            <Section id="campaign-heading" title="Ad campaign">
              <SectionBoundary label="ad campaigns">{now !== null ? <AdCampaignPanel slug={slug} artifact={artifact} now={now} /> : <Skeleton className="h-32 w-full" />}</SectionBoundary>
            </Section>
          ) : isEmailKind(artifact.kind) ? (
            <Section id="sending-heading" title="Sending">
              <SectionBoundary label="email sending">
                <EmailSendPanel slug={slug} artifact={artifact} />
              </SectionBoundary>
            </Section>
          ) : (
            <Section id="publishing-heading" title="Publishing">
              <SectionBoundary label="publishing options">
                <PublishPanel slug={slug} artifact={artifact} now={now} />
              </SectionBoundary>
            </Section>
          )}

          <Section id="receipts-heading" title="Activity">
            <ReceiptsTimeline receipts={artifact.receipts} now={now} />
          </Section>

          <Section id="facts-heading" title="Facts used">
            <FactsList facts={artifact.facts} />
          </Section>

          <Discussion slug={slug} subjectType="artifact" subjectId={artifact.id} title={artifact.title} href={`/app/${slug}/content/${artifact.id}`} />
        </div>
      </div>
    </div>
  );
}

function RestoreButton({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const unarchive = useMutation(api.content.unarchive);
  const [error, setError] = useState<unknown>(null);
  return (
    <>
      <ConfirmDialog
        trigger={
          <Button variant="secondary">
            <ArchiveRestore aria-hidden="true" /> Restore
          </Button>
        }
        title="Restore this?"
        description="Returns as a draft. Needs new approval."
        confirmLabel="Restore"
        onConfirm={async () => {
          setError(null);
          try {
            await unarchive({ slug, artifactId: artifact.id });
            toast({ tone: "success", title: "Restored as a draft." });
          } catch (e) {
            setError(e);
          }
        }}
      />
      {error ? (
        <div className="basis-full">
          <ErrorCallout error={error} />
        </div>
      ) : null}
    </>
  );
}

/** h2 that takes focus once when it appears (so keyboard users land in the editor). */
function FocusHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h2 ref={ref} tabIndex={-1} className="heading-section outline-none">
      {children}
    </h2>
  );
}

function MoreMenu({ slug, artifact }: { slug: string; artifact: ArtifactView }) {
  const archive = useMutation(api.content.archive);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label="More actions" icon={<Ellipsis />} variant="secondary" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem icon={<Archive />} onSelect={() => setOpen(true)}>
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Archive this?"
        description="Live posts stay up."
        confirmLabel="Archive"
        tone="danger"
        onConfirm={async () => {
          setError(null);
          try {
            await archive({ slug, artifactId: artifact.id });
            toast({ tone: "success", title: "Archived." });
          } catch (e) {
            setError(e);
          }
        }}
      >
        <NoteList items={["Hidden from lists", ...(artifact.status === "scheduled" ? ["Won't be sent"] : []), "Approval cancelled"]} />
      </ConfirmDialog>
      {error ? (
        <div className="basis-full">
          <ErrorCallout error={error} />
        </div>
      ) : null}
    </>
  );
}
