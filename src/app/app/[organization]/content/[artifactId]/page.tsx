"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Archive, ArchiveRestore, ArrowLeft, Ellipsis, Pencil } from "lucide-react";
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
import { FactsList, FlaggedClaims, ReceiptsTimeline, VersionHistory } from "@/components/app/content/detail/HistoryPanels";
import { EmailSendPanel, isEmailKind } from "@/components/app/content/detail/EmailSendPanel";
import { PublishPanel } from "@/components/app/content/detail/PublishPanel";
import { UncertainPanel } from "@/components/app/content/detail/UncertainPanel";
import { isCampaignAd, type ArtifactView } from "@/components/app/content/detail/model";
import { ArtifactStatus, ChannelTag, ErrorCallout, RoleName, SectionBoundary, useNow, useWorkspaceMember } from "@/components/app/content/shared";

export default function ContentDetailPage() {
  const { organization: slug, artifactId } = useParams<{ organization: string; artifactId: string }>();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Link
        href={`/app/${slug}/content`}
        className="inline-flex min-h-11 items-center gap-2 self-start text-[0.95rem] font-medium text-brand-800 underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Back to content
      </Link>
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
          <h2 id={id} className="text-lg font-semibold text-ink">
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
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const cur = artifact.current;
  const locked = ["publishing", "published"].includes(artifact.status);
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
            {artifact.canEdit && artifact.status === "archived" ? <RestoreButton slug={slug} artifact={artifact} /> : null}
            {artifact.canEdit && artifact.status !== "archived" ? <MoreMenu slug={slug} artifact={artifact} /> : null}
          </div>
        </div>
        <h1 className="break-words font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{artifact.title}</h1>
        <ArtifactStatus status={artifact.status} showHelp />
        <p className="text-sm text-ink-3">
          Created by <RoleName role={artifact.createdByRole} className="text-ink-2" />
          {now ? (
            <>
              {" · "}
              <time dateTime={new Date(artifact.createdAt).toISOString()}>{formatDateTime(artifact.createdAt)}</time>
              {" · updated "}
              {relativeTime(artifact.updatedAt, now)}
            </>
          ) : null}
        </p>
        {artifact.isDemo ? <p className="text-sm text-violet-800">Demo workspace: publishing is simulated. Nothing is really posted, sent or spent.</p> : null}
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
            <p className="-mt-2 text-sm text-ink-3">An approximation of how it will look. Each platform displays text slightly differently.</p>
            {cur ? <ChannelPreview channel={artifact.channel} version={cur} accountLabel={artifact.publishTarget?.accountLabel} /> : <p className="text-ink-3">No text yet.</p>}
            {locked ? <p className="text-sm text-ink-3">Published content can&apos;t be edited.</p> : null}
          </Section>

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

          <Section id="receipts-heading" title="What happened">
            <ReceiptsTimeline receipts={artifact.receipts} now={now} />
          </Section>

          <Section id="facts-heading" title="Facts this draft relies on">
            <FactsList facts={artifact.facts} />
          </Section>
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
        description="It goes back to your active list as a draft. It needs a new approval before it can go anywhere."
        confirmLabel="Restore as draft"
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
    <h2 ref={ref} tabIndex={-1} className="text-lg font-semibold text-ink outline-none">
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
        description={`It's hidden from active lists${artifact.status === "scheduled" ? ", won't be sent at its scheduled time" : ""} and any approval is cancelled. Nothing already posted is removed from the platform.`}
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
      />
      {error ? (
        <div className="basis-full">
          <ErrorCallout error={error} />
        </div>
      ) : null}
    </>
  );
}
