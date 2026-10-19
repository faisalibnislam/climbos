"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  Bell,
  Building2,
  Globe,
  Inbox,
  Mail,
  Megaphone,
  Pause,
  Play,
  RotateCcw,
  Store,
  Upload,
} from "@/components/icons";
import {
  Avatar,
  Button,
  Callout,
  ConfirmDialog,
  dismissToast,
  EmptyState,
  Field,
  IconButton,
  Input,
  Progress,
  ProgressRing,
  Spinner,
  StatusPill,
  StepList,
  Switch,
  Textarea,
  toast,
} from "@/components/ui";
import {
  AlertBanner,
  AutoSaveIndicator,
  CircularProgress,
  ConnectionStatus,
  ErrorState,
  InlineAlert,
  LiveProgress,
  LoadingSpinner,
  MaintenanceState,
  NoResultsState,
  NotificationBadge,
  OnlineIndicator,
  ProcessingStatus,
  RetryAction,
  SkeletonCard,
  SkeletonRows,
  StatusBadge,
  StatusDot,
  StepProgress,
  SyncStatus,
  UnsavedChangesBar,
  UnsavedDot,
  UploadProgress,
  formatTimeLeft,
  stepsFromProgress,
  useOnline,
  useSimulation,
  type AutoSaveState,
  type ConnectionState,
  type SyncState,
  type UploadItem,
} from "@/components/ds/feedback";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export function FeedbackContent() {
  return (
    <DocPage
      eyebrow="Components"
      title="Feedback & status"
      intro="Tell people what is happening, what happened and what to do next. Long jobs always show a bar, time left and steps."
    >
      <Specimen
        title="Toast notification"
        description="Short confirmations that fade after 6 s. Never the only copy of something important."
      >
        <Stage>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                toast({
                  title: "Post scheduled",
                  description: "Goes live Tue 9:00 on Instagram.",
                  tone: "success",
                })
              }
            >
              Success toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: "Plan is rebuilding",
                  description: "We'll tell you when it's ready.",
                })
              }
            >
              Info toast
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: "Couldn't send email",
                  description: "Mailbox disconnected. Reconnect in Settings.",
                  tone: "danger",
                  duration: 0,
                })
              }
            >
              Error toast (stays)
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                const id = toast({ title: "Publishing 3 posts…", duration: 0 });
                await wait(1400);
                dismissToast(id);
                toast({ title: "3 posts published", tone: "success" });
              }}
            >
              Async toast
            </Button>
          </div>
        </Stage>
        <Spec
          items={[
            ["Position", "Bottom right (bottom centre on mobile), max 4"],
            ["Live region", "status; danger uses alert"],
            ["Mount", "<Toaster /> once in the shell"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Alert banner"
        description="Account-wide news across the top of a page. One at a time."
      >
        <AlertBannerDemo />
        <Spec
          items={[
            ["Tones", "info, success, warning, danger, neutral (ink)"],
            ["Height", "Auto, 10px vertical padding"],
            ["Dismiss", "Only for non-blocking news"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Inline alert"
        description="Next to the thing it is about: under a field, inside a card."
      >
        <Stage tone="white" className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <InlineAlert tone="info">Credits reset on 1 Nov.</InlineAlert>
            <InlineAlert tone="success">Domain verified.</InlineAlert>
            <InlineAlert tone="warning">
              Two posts are missing images.
            </InlineAlert>
            <InlineAlert
              tone="danger"
              action={
                <button type="button" className="underline underline-offset-2">
                  Fix
                </button>
              }
            >
              Instagram token expired.
            </InlineAlert>
          </div>
          <Callout tone="warning" title="Ad budget almost spent">
            $42 of $50 used this week. Ads pause at the limit.
          </Callout>
        </Stage>
        <Spec
          items={[
            ["Inline", "13px medium, icon + text, no box"],
            ["Callout", "Boxed, for a paragraph or an action"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Confirmation dialog"
        description="Only for consequential actions. The button says exactly what happens."
      >
        <Stage>
          <div className="flex flex-wrap gap-2">
            <ConfirmDialog
              trigger={<Button>Publish 3 posts</Button>}
              title="Publish 3 posts now?"
              description="They go live on Instagram and Facebook straight away. You can't unpublish from ClimbOS."
              confirmLabel="Publish 3 posts"
              onConfirm={async () => {
                await wait(900);
                toast({ title: "3 posts published", tone: "success" });
              }}
            />
            <ConfirmDialog
              trigger={<Button variant="danger">Delete campaign</Button>}
              tone="danger"
              title="Delete “Autumn tune-up”?"
              description="Its 12 emails and stats are removed for everyone. This can't be undone."
              confirmLabel="Delete campaign"
              onConfirm={async () => {
                await wait(700);
                toast({ title: "Campaign deleted", tone: "success" });
              }}
            />
          </div>
        </Stage>
        <Spec
          items={[
            ["Focus", "Starts on Cancel"],
            ["Confirm", "Shows a spinner until the work settles"],
            ["Never", "“OK” or “Yes”"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Loading spinner"
        description="For waits under 3 s. Longer waits use a progress bar."
      >
        <Stage tone="white" className="grid gap-6 sm:grid-cols-3">
          <div className="flex items-center gap-4 text-ink">
            <Spinner className="text-sm" label="Loading" />
            <Spinner className="text-base" label="Loading" />
            <Spinner className="text-2xl" label="Loading" />
          </div>
          <div className="flex flex-col gap-3">
            <LoadingSpinner label="Loading leads…" />
            <Button loading loadingText="Saving…">
              Save
            </Button>
          </div>
          <div className="rounded-[var(--radius-card)] border border-line">
            <LoadingSpinner block label="Fetching your reviews" />
          </div>
        </Stage>
        <Spec
          items={[
            ["Sizes", "14 / 16 / 24px (follows font size)"],
            ["Text", "Always a visible label"],
            ["Motion", "Stops under reduced motion"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Skeleton loader"
        description="The shape of what's coming, for first loads."
      >
        <SkeletonDemo />
        <Spec
          items={[
            ["Use", "First load only; refreshes keep old content"],
            ["Shapes", "SkeletonCard, SkeletonRows, Skeleton"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Progress bar"
        description="Bar, percentage, time left, current finding and every step."
      >
        <LiveProgressDemo />
        <Stage tone="white" label="Simple bars">
          <div className="grid gap-4 sm:grid-cols-2">
            <Progress label="Importing contacts" value={64} showLabel />
            <Progress label="Waiting for Google" showLabel />
          </div>
        </Stage>
        <Spec
          items={[
            ["Height", "8px track, ink fill"],
            ["Done / failed", "Green / red fill + word"],
            ["Time left", "Rounded, “About 40 s left”"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Circular progress"
        description="Compact progress for cards and tiles."
      >
        <CircularDemo />
        <Spec
          items={[
            ["Sizes", "44 / 56 / 72px"],
            ["Colour", "Ink running, green done"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Step progress"
        description="Where someone is in a multi-step flow."
      >
        <StepProgressDemo />
        <Spec
          items={[
            ["Done", "Ink circle + check, clickable"],
            ["Current", "Lime circle, bold label"],
            ["Vertical", "StepList with status words"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Upload progress"
        description="Per file and overall, with time left, cancel and retry."
      >
        <UploadDemo />
        <Spec
          items={[
            ["Concurrency", "2 files at a time, rest wait"],
            ["Failure", "Keeps the file, offers retry"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Processing status"
        description="Background jobs: state, bar, step and time left."
      >
        <ProcessingDemo />
      </Specimen>

      <Specimen
        title="Sync status"
        description="For data pulled from another tool."
      >
        <SyncDemo />
      </Specimen>

      <Specimen
        title="Connection status"
        description="Integration health with the next step."
      >
        <ConnectionDemo />
      </Specimen>

      <Specimen
        title="Online / offline indicator"
        description="Live from the browser, plus a simulated offline state."
      >
        <OnlineDemo />
      </Specimen>

      <Specimen title="Status badge">
        <Stage tone="white" className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="success">Live</StatusBadge>
            <StatusBadge tone="progress" pulse>
              Running
            </StatusBadge>
            <StatusBadge tone="info">Scheduled</StatusBadge>
            <StatusBadge tone="warning">Needs approval</StatusBadge>
            <StatusBadge tone="danger">Failed</StatusBadge>
            <StatusBadge tone="neutral">Paused</StatusBadge>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill status="ready" />
            <StatusPill status="needs_approval" />
            <StatusPill status="provider_review" />
            <StatusPill status="draft" />
            <StatusPill status="failed" />
          </div>
        </Stage>
        <Spec
          items={[
            ["Height", "24px, radius --radius-badge"],
            ["Rule", "Dot or icon + word, never colour alone"],
          ]}
        />
      </Specimen>

      <Specimen title="Status dot">
        <Stage
          tone="white"
          className="flex flex-wrap items-center gap-6 text-ui text-ink-2"
        >
          {(
            [
              ["success", "Active"],
              ["progress", "Working"],
              ["warning", "Attention"],
              ["danger", "Down"],
              ["info", "Scheduled"],
              ["neutral", "Off"],
            ] as const
          ).map(([t, l]) => (
            <span key={t} className="inline-flex items-center gap-2">
              <StatusDot tone={t} pulse={t === "progress"} /> {l}
            </span>
          ))}
          <span className="inline-flex items-center gap-2">
            <StatusDot size="sm" tone="success" /> <StatusDot tone="success" />{" "}
            <StatusDot size="lg" tone="success" /> Sizes
          </span>
        </Stage>
        <Spec
          items={[
            ["Sizes", "6 / 8 / 10px"],
            ["Pulse", "Live or running only"],
          ]}
        />
      </Specimen>

      <Specimen title="Notification badge">
        <NotificationDemo />
        <Spec
          items={[
            ["Cap", "99+"],
            ["Zero", "Hidden"],
            ["Screen readers", "“3 unread notifications”"],
          ]}
        />
      </Specimen>

      <Specimen
        title="Empty state"
        description="Nothing here yet: say why and offer the first step."
      >
        <Stage className="grid gap-4 md:grid-cols-2">
          <EmptyState
            icon={<Inbox />}
            title="No leads yet"
            body="Leads from your website, ads and calls land here."
            action={<Button>Connect your website</Button>}
          />
          <EmptyState
            icon={<Megaphone />}
            title="No campaigns"
            body="Start from a play and we'll draft it for you."
            action={<Button variant="secondary">Browse plays</Button>}
          />
        </Stage>
      </Specimen>

      <Specimen title="No-results state">
        <NoResultsDemo />
      </Specimen>

      <Specimen title="Error state">
        <ErrorDemo />
      </Specimen>

      <Specimen title="Maintenance state">
        <Stage>
          <MaintenanceState
            until="Back by 14:30 UTC"
            stillWorks="Scheduled posts and ads keep running."
            statusHref="#maintenance-state"
          />
        </Stage>
      </Specimen>

      <Specimen
        title="Retry action"
        description="Auto-retries with backoff, then leaves a manual button. This demo fails once, then works."
      >
        <RetryDemo />
      </Specimen>

      <Specimen
        title="Unsaved changes indicator"
        description="Edit a field to see it."
      >
        <UnsavedDemo />
      </Specimen>

      <Specimen title="Auto-save indicator" description="Type to see it save.">
        <AutoSaveDemo />
        <Stage tone="white" label="All states">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <AutoSaveIndicator state="idle" />
            <AutoSaveIndicator state="editing" />
            <AutoSaveIndicator state="saving" />
            <AutoSaveIndicator state="saved" savedAt="just now" />
            <AutoSaveIndicator state="offline" />
            <AutoSaveIndicator
              state="error"
              onRetry={() => toast({ title: "Saved", tone: "success" })}
            />
          </div>
        </Stage>
      </Specimen>
    </DocPage>
  );
}

/* ------------------------------------------------------------------ */

function AlertBannerDemo() {
  const [shown, setShown] = useState({
    info: true,
    warning: true,
    danger: true,
    neutral: true,
  });
  const hide = (k: keyof typeof shown) =>
    setShown((s) => ({ ...s, [k]: false }));
  const anyHidden = Object.values(shown).some((v) => !v);
  return (
    <Stage className="flex flex-col gap-3 p-0 sm:p-6">
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--card-shadow)]">
        {shown.danger ? (
          <AlertBanner
            tone="danger"
            title="Payment failed."
            action={<Button size="sm">Update card</Button>}
            onDismiss={() => hide("danger")}
          >
            Autopilot pauses on 24 Oct unless the card is updated.
          </AlertBanner>
        ) : null}
        {shown.warning ? (
          <AlertBanner tone="warning" onDismiss={() => hide("warning")}>
            80% of this month&apos;s credits used.
          </AlertBanner>
        ) : null}
        {shown.info ? (
          <AlertBanner
            tone="info"
            action={
              <Button size="sm" variant="secondary">
                See what&apos;s new
              </Button>
            }
            onDismiss={() => hide("info")}
          >
            Reels can now be scheduled from Posts.
          </AlertBanner>
        ) : null}
        {shown.neutral ? (
          <AlertBanner tone="neutral" onDismiss={() => hide("neutral")}>
            You&apos;re viewing Harbor Dental as support (read only).
          </AlertBanner>
        ) : null}
        <div className="p-5 text-sm text-ink-3">Page content…</div>
      </div>
      {anyHidden ? (
        <div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setShown({
                info: true,
                warning: true,
                danger: true,
                neutral: true,
              })
            }
          >
            <RotateCcw aria-hidden="true" /> Show all again
          </Button>
        </div>
      ) : null}
    </Stage>
  );
}

function SkeletonDemo() {
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1600);
  };
  return (
    <Stage className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={loading ? () => setLoading(false) : reload}
        >
          {loading ? "Show content" : "Reload"}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2" aria-busy={loading}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonRows rows={4} />
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-surface-2 text-ink-2">
                  <Store aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <p className="heading-card">Autumn tune-up</p>
                  <p className="text-xs text-ink-3">Email play · 3 steps</p>
                </div>
              </div>
              <p className="text-sm text-ink-2">
                Brings back customers who haven&apos;t booked in 6 months with a
                seasonal offer.
              </p>
              <div>
                <StatusBadge tone="success">Live</StatusBadge>
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
              {["Maya Chen", "Owen Price", "Sara Ali", "Leo Grant"].map(
                (n, i) => (
                  <li
                    key={n}
                    className="flex h-[var(--cell-h)] items-center gap-3 px-3 text-ui"
                  >
                    <Avatar name={n} size="sm" />
                    <span className="text-ink">{n}</span>
                    <span className="ml-auto">
                      <StatusBadge tone={i % 2 ? "info" : "success"}>
                        {i % 2 ? "Contacted" : "New"}
                      </StatusBadge>
                    </span>
                  </li>
                ),
              )}
            </ul>
          </>
        )}
      </div>
    </Stage>
  );
}

const PLAN_STEPS = [
  {
    key: "site",
    label: "Reading your website",
    finding: "18 pages, 4 services",
  },
  {
    key: "reviews",
    label: "Checking reviews and listings",
    finding: "4.6★ from 212 reviews",
  },
  {
    key: "rivals",
    label: "Comparing 5 nearby competitors",
    finding: "2 run Google Ads",
  },
  {
    key: "plan",
    label: "Drafting your 30-day plan",
    finding: "6 plays picked",
  },
];
const FINDINGS = [
  "Found 18 pages",
  "212 reviews read",
  "5 rivals compared",
  "Picking plays",
];

function LiveProgressDemo() {
  const sim = useSimulation(14000);
  const steps = stepsFromProgress(PLAN_STEPS, sim.value, sim.state);
  const cur = Math.min(
    PLAN_STEPS.length - 1,
    Math.floor(sim.value * PLAN_STEPS.length),
  );
  return (
    <Stage tone="white">
      <LiveProgress
        title="Building your growth plan"
        value={sim.value}
        state={sim.state}
        secondsLeft={sim.secondsLeft}
        detail={
          sim.state === "running" || sim.state === "paused"
            ? FINDINGS[cur]
            : sim.state === "done"
              ? "6 plays ready to review"
              : undefined
        }
        steps={steps}
        actions={
          <>
            {sim.state === "running" ? (
              <Button size="sm" variant="secondary" onClick={sim.pause}>
                <Pause aria-hidden="true" /> Pause
              </Button>
            ) : (
              <Button size="sm" onClick={sim.start}>
                <Play aria-hidden="true" />{" "}
                {sim.state === "paused"
                  ? "Resume"
                  : sim.state === "done"
                    ? "Run again"
                    : "Start"}
              </Button>
            )}
            {sim.state !== "idle" ? (
              <Button size="sm" variant="ghost" onClick={sim.reset}>
                Reset
              </Button>
            ) : null}
          </>
        }
      />
    </Stage>
  );
}

function CircularDemo() {
  const sim = useSimulation(8000);
  return (
    <Stage tone="white" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-8">
        <CircularProgress
          value={sim.value}
          label="Generating 4 posts"
          tone={sim.state === "done" ? "done" : "default"}
          meta={
            sim.state === "done"
              ? "Done"
              : sim.state === "idle"
                ? "Not started"
                : formatTimeLeft(sim.secondsLeft)
          }
        />
        <div className="flex items-center gap-3">
          <ProgressRing value={0.25} size={44} label="Profile" />
          <ProgressRing value={0.6} size={56} label="Setup" />
          <ProgressRing
            value={0.9}
            size={72}
            label="Credits used"
            color="var(--chart-4)"
          />
        </div>
      </div>
      <div>
        <Button
          size="sm"
          variant="secondary"
          onClick={sim.state === "running" ? sim.pause : sim.start}
        >
          {sim.state === "running"
            ? "Pause"
            : sim.state === "done"
              ? "Run again"
              : "Start"}
        </Button>
      </div>
    </Stage>
  );
}

const WIZ = ["Business", "Goals", "Channels", "Budget", "Review"];

function StepProgressDemo() {
  const [cur, setCur] = useState(2);
  return (
    <Stage tone="white" className="flex flex-col gap-6">
      <div className="relative overflow-x-auto">
        <StepProgress
          steps={WIZ}
          current={cur}
          onStepClick={setCur}
          className="min-w-[420px]"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={cur === 0}
          onClick={() => setCur((c) => c - 1)}
        >
          Back
        </Button>
        <Button
          size="sm"
          disabled={cur === WIZ.length}
          onClick={() => setCur((c) => Math.min(WIZ.length, c + 1))}
        >
          {cur >= WIZ.length - 1 ? "Finish" : "Next"}
        </Button>
      </div>
      <div className="max-w-sm border-t border-line pt-5">
        <StepList
          steps={WIZ.slice(0, 4).map((w, i) => ({
            key: w,
            label: w,
            status: i < cur ? "done" : i === cur ? "running" : "pending",
          }))}
          className="text-ui"
        />
      </div>
    </Stage>
  );
}

type SimUpload = UploadItem & { failAt?: number };
const SAMPLE_FILES: SimUpload[] = [
  {
    id: "a",
    name: "storefront.jpg",
    size: 2_400_000,
    loaded: 0,
    state: "queued",
    rate: 900_000,
  },
  {
    id: "b",
    name: "menu-autumn.pdf",
    size: 5_100_000,
    loaded: 0,
    state: "queued",
    rate: 1_100_000,
  },
  {
    id: "c",
    name: "team-photo.png",
    size: 3_600_000,
    loaded: 0,
    state: "queued",
    rate: 800_000,
    failAt: 0.55,
  },
  {
    id: "d",
    name: "logo.svg",
    size: 180_000,
    loaded: 0,
    state: "queued",
    rate: 300_000,
  },
];

function UploadDemo() {
  const [files, setFiles] = useState<SimUpload[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = files.some(
    (f) => f.state === "uploading" || f.state === "queued",
  );

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => {
      setFiles((list) => {
        let slots = 2 - list.filter((f) => f.state === "uploading").length;
        return list.map((f) => {
          if (f.state === "queued" && slots > 0) {
            slots--;
            return { ...f, state: "uploading" };
          }
          if (f.state !== "uploading") return f;
          const loaded = Math.min(f.size, f.loaded + (f.rate ?? 500_000) * 0.2);
          if (f.failAt && loaded / f.size >= f.failAt)
            return {
              ...f,
              loaded,
              state: "failed",
              failAt: undefined,
              error: "Connection dropped at 55%",
            };
          return loaded >= f.size
            ? { ...f, loaded, state: "done" }
            : { ...f, loaded };
        });
      });
    }, 200);
    return () => window.clearInterval(id);
  }, [busy]);

  const addReal = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(e.target.files ?? [])].map((f, i) => ({
      id: `${f.name}-${f.size}-${i}-${files.length}`,
      name: f.name,
      size: Math.max(1, f.size),
      loaded: 0,
      state: "queued" as const,
      rate: Math.max(300_000, f.size / 6),
    }));
    setFiles((l) => [...l, ...picked]);
    e.target.value = "";
  };

  return (
    <Stage className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => setFiles(SAMPLE_FILES.map((f) => ({ ...f })))}
        >
          <Upload aria-hidden="true" /> Upload sample files
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
        >
          Choose your own
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={addReal}
        />
        {files.length ? (
          <Button size="sm" variant="ghost" onClick={() => setFiles([])}>
            Clear
          </Button>
        ) : null}
      </div>
      {files.length ? (
        <UploadProgress
          items={files}
          onCancel={(id) => setFiles((l) => l.filter((f) => f.id !== id))}
          onRemove={(id) => setFiles((l) => l.filter((f) => f.id !== id))}
          onRetry={(id) =>
            setFiles((l) =>
              l.map((f) =>
                f.id === id
                  ? { ...f, loaded: 0, state: "queued", error: undefined }
                  : f,
              ),
            )
          }
        />
      ) : (
        <p className="text-sm text-ink-3">
          Files are simulated; nothing leaves your browser.
        </p>
      )}
    </Stage>
  );
}

function ProcessingDemo() {
  const sim = useSimulation(15000);
  const [fixed, setFixed] = useState<"failed" | "processing" | "done">(
    "failed",
  );
  const jobs = [
    { label: "Rewrite 6 service pages", detail: "Matching your tone" },
    { label: "Generate 4 Instagram posts", detail: "Writing captions" },
    { label: "Build lookalike audience", detail: "Scoring 1,240 contacts" },
  ];
  const segment = 15 / jobs.length;
  return (
    <Stage tone="white" className="flex flex-col gap-3">
      <div className="divide-y divide-line">
        {jobs.map((j, i) => {
          const p = Math.min(1, Math.max(0, sim.value * jobs.length - i));
          const state =
            sim.state === "idle"
              ? "queued"
              : p >= 1
                ? "done"
                : p > 0
                  ? "processing"
                  : "queued";
          return (
            <ProcessingStatus
              key={j.label}
              label={j.label}
              state={state}
              progress={p}
              detail={
                state === "processing"
                  ? `Step ${Math.min(3, Math.floor(p * 3) + 1)} of 3 · ${j.detail}`
                  : state === "queued"
                    ? i === 0
                      ? "Waiting to start"
                      : `Starts after “${jobs[i - 1].label}”`
                    : undefined
              }
              eta={
                state === "processing"
                  ? formatTimeLeft((1 - p) * segment)
                  : undefined
              }
            />
          );
        })}
        <ProcessingStatus
          label="Sync Google reviews"
          state={fixed}
          progress={fixed === "processing" ? 0.5 : 0}
          detail={
            fixed === "failed"
              ? "Google didn't respond"
              : fixed === "processing"
                ? "Fetching 212 reviews"
                : "212 reviews synced"
          }
          onRetry={() => {
            setFixed("processing");
            window.setTimeout(() => setFixed("done"), 1500);
          }}
        />
      </div>
      <div>
        <Button
          size="sm"
          variant="secondary"
          onClick={sim.state === "running" ? sim.pause : sim.start}
        >
          {sim.state === "running"
            ? "Pause jobs"
            : sim.state === "done"
              ? "Run again"
              : "Start jobs"}
        </Button>
      </div>
    </Stage>
  );
}

function SyncDemo() {
  const [state, setState] = useState<SyncState>("synced");
  const [last, setLast] = useState("12 min ago");
  const sync = () => {
    setState("syncing");
    window.setTimeout(() => {
      setState("synced");
      setLast("just now");
    }, 1600);
  };
  return (
    <Stage tone="white" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <p className="heading-card">Google Business Profile</p>
        <SyncStatus
          state={state}
          lastSynced={last}
          source="reviews"
          onSync={sync}
        />
      </div>
      <div className="flex flex-col gap-2">
        <SyncStatus
          state="error"
          onSync={() => toast({ title: "Retrying sync" })}
        />
        <SyncStatus
          state="paused"
          onSync={() => toast({ title: "Sync resumed" })}
        />
      </div>
    </Stage>
  );
}

function ConnectionDemo() {
  const [conns, setConns] = useState<
    { name: string; icon: ReactNode; state: ConnectionState; detail: string }[]
  >([
    {
      name: "Google Business Profile",
      icon: <Building2 />,
      state: "connected",
      detail: "Synced 4 min ago",
    },
    {
      name: "Instagram",
      icon: <Globe />,
      state: "attention",
      detail: "Access expired 2 days ago",
    },
    {
      name: "Gmail",
      icon: <Mail />,
      state: "disconnected",
      detail: "Needed to send follow-ups",
    },
  ]);
  const act = (i: number) => {
    const c = conns[i];
    if (c.state === "connected") return toast({ title: `${c.name} settings` });
    setConns((l) =>
      l.map((x, j) =>
        j === i
          ? { ...x, state: "connecting", detail: "Waiting for approval…" }
          : x,
      ),
    );
    window.setTimeout(
      () =>
        setConns((l) =>
          l.map((x, j) =>
            j === i
              ? { ...x, state: "connected", detail: "Connected just now" }
              : x,
          ),
        ),
      1500,
    );
  };
  return (
    <Stage tone="white">
      <div className="divide-y divide-line">
        {conns.map((c, i) => (
          <ConnectionStatus
            key={c.name}
            name={c.name}
            icon={c.icon}
            state={c.state}
            detail={c.detail}
            onAction={() => act(i)}
          />
        ))}
      </div>
    </Stage>
  );
}

function OnlineDemo() {
  const online = useOnline();
  const [sim, setSim] = useState(false);
  const shown = sim ? false : online;
  return (
    <Stage tone="white" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-ui text-ink-2">Your browser:</span>
        <OnlineIndicator />
        <span className="text-ui text-ink-2">Preview:</span>
        <OnlineIndicator online={shown} />
      </div>
      <OnlineIndicator online={shown} variant="banner" />
      <Switch
        label="Simulate offline"
        checked={sim}
        onCheckedChange={setSim}
        className="max-w-xs"
      />
    </Stage>
  );
}

function NotificationDemo() {
  const [n, setN] = useState(3);
  return (
    <Stage tone="white" className="flex flex-wrap items-center gap-6">
      <NotificationBadge count={n} label="unread notifications">
        <IconButton
          aria-label="Notifications"
          icon={<Bell />}
          variant="secondary"
        />
      </NotificationBadge>
      <NotificationBadge count={128} label="unread messages">
        <IconButton aria-label="Inbox" icon={<Inbox />} variant="secondary" />
      </NotificationBadge>
      <NotificationBadge dot label="New activity">
        <Avatar name="Maya Chen" />
      </NotificationBadge>
      <span className="inline-flex items-center gap-2 text-ui text-ink">
        Approvals
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-badge)] bg-ink px-1.5 text-2xs font-semibold tabular-nums text-white">
          {n}
        </span>
      </span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setN((x) => x + 1)}
        >
          Add one
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setN(0)}>
          Mark all read
        </Button>
      </div>
    </Stage>
  );
}

function NoResultsDemo() {
  const [q, setQ] = useState("dentist brooklin");
  return (
    <Stage className="flex flex-col gap-3">
      <Input
        aria-label="Search leads"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-sm"
      />
      <NoResultsState
        query={q || undefined}
        suggestions={["dentist brooklyn", "dental"]}
        onSuggestion={(s) => setQ(s)}
        onClear={() => setQ("")}
      />
    </Stage>
  );
}

function ErrorDemo() {
  const [retrying, setRetrying] = useState(false);
  return (
    <Stage>
      <ErrorState
        reference="ERR-4F2A-91"
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          window.setTimeout(() => {
            setRetrying(false);
            toast({
              title: "Still not loading",
              description: "We've been alerted. Try again in a minute.",
              tone: "danger",
            });
          }, 1200);
        }}
        supportHref="#error-state"
      />
    </Stage>
  );
}

function RetryDemo() {
  const tries = useRef(0);
  const [key, setKey] = useState(0);
  return (
    <Stage tone="white" className="flex flex-col gap-3">
      <RetryAction
        key={key}
        backoff={[3]}
        failedText="Couldn't publish “Autumn offer”."
        action={async () => {
          await wait(800);
          tries.current += 1;
          if (tries.current < 2) throw new Error("fail");
        }}
        onSuccess={() => toast({ title: "Post published", tone: "success" })}
      />
      <div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            tries.current = 0;
            setKey((k) => k + 1);
          }}
        >
          <RotateCcw aria-hidden="true" /> Reset demo
        </Button>
      </div>
    </Stage>
  );
}

const PROFILE = {
  name: "Harbor Dental",
  tagline: "Gentle care in Brooklyn",
  phone: "(718) 555-0142",
};

function UnsavedDemo() {
  const [saved, setSaved] = useState(PROFILE);
  const [draft, setDraft] = useState(PROFILE);
  const [saving, setSaving] = useState(false);
  const count = (Object.keys(draft) as (keyof typeof draft)[]).filter(
    (k) => draft[k] !== saved[k],
  ).length;
  const set = (k: keyof typeof draft) => (e: ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));
  return (
    <Stage className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h3 className="heading-card">Business profile</h3>
          {count ? <UnsavedDot /> : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Business name">
            <Input value={draft.name} onChange={set("name")} />
          </Field>
          <Field label="Tagline">
            <Input value={draft.tagline} onChange={set("tagline")} />
          </Field>
          <Field label="Phone">
            <Input value={draft.phone} onChange={set("phone")} />
          </Field>
        </div>
      </div>
      <UnsavedChangesBar
        count={count}
        sticky={false}
        saving={saving}
        onDiscard={() => setDraft(saved)}
        onSave={() => {
          setSaving(true);
          window.setTimeout(() => {
            setSaved(draft);
            setSaving(false);
            toast({ title: "Profile saved", tone: "success" });
          }, 900);
        }}
      />
    </Stage>
  );
}

function AutoSaveDemo() {
  const [text, setText] = useState(
    "Book your autumn check-up this week and get a free whitening session.",
  );
  const [state, setState] = useState<AutoSaveState>("idle");
  const [fail, setFail] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const save = (shouldFail: boolean) => {
    setState("saving");
    timer.current = window.setTimeout(
      () => setState(shouldFail ? "error" : "saved"),
      700,
    );
  };
  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setState("editing");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(fail), 800);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <Stage tone="white" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="heading-card">Post caption</p>
        <AutoSaveIndicator
          state={state}
          savedAt="just now"
          onRetry={() => save(false)}
        />
      </div>
      <Textarea
        aria-label="Post caption"
        value={text}
        onChange={onChange}
        rows={3}
      />
      <Switch
        label="Simulate a failed save"
        checked={fail}
        onCheckedChange={setFail}
        className="max-w-xs"
      />
    </Stage>
  );
}
