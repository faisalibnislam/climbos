"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Check, ImagePlus, Loader2, Monitor, MoreHorizontal, ShoppingBag, Smartphone, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { SCENES, TREATMENTS, type Treatment } from "../../../../../shared/visuals/treatments";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Callout,
  ChoiceChips,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogFooter,
  EmptyState,
  RadioCards,
  FilterChip,
  IconButton,
  SocialIcon,
  networkName,
  toast,
} from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { cn } from "@/lib/utils";
import { useNow } from "@/components/app/content/shared";
import { climbTarget } from "@/components/climb/context";
import { StagedProgress } from "@/components/app/StagedProgress";
import { RunProgressCompact } from "@/components/app/content/RunProgress";
import { uploadToLibrary } from "@/components/app/AssetPicker";

type Data = NonNullable<ReturnType<typeof useQuery<typeof api.assets.list>>>;
type Asset = Data["assets"][number];
type Filter = "all" | "screenshot" | "product_photo" | "upload" | "ai_image";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "screenshot", label: "Screenshots" },
  { value: "product_photo", label: "Products" },
  { value: "upload", label: "Uploads" },
  { value: "ai_image", label: "AI images" },
];

const CHANNELS = ["instagram", "facebook", "linkedin", "x", "pinterest"] as const;

/**
 * Real visuals first: your site's screenshots, your product photos and your
 * uploads. Tick images and ClimbOS writes posts around them.
 */
export default function ImagesPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.assets.list, { slug });
  const [filter, setFilter] = useState<Filter>("all");
  const [picked, setPicked] = useState<string[]>([]);
  const now = useNow();
  if (data === undefined) return <LoadingBlock label="Loading your images" lines={3} />;
  const shown = data.assets.filter((a) => filter === "all" || a.kind === filter || (filter === "upload" && a.kind === "logo"));
  const running = data.jobs.filter((j) => j.status === "running");
  const lastFailed = now !== null ? data.jobs.find((j) => j.status === "failed" && now - j.createdAt < 3_600_000) : undefined;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-24">
      <PageHeader
        eyebrow="Content"
        title="Images"
        intro="Real screenshots and product photos make better posts than stock or AI images. Your team uses these first; AI images are always optional."
      />

      {data.canEdit ? <Sources slug={slug} data={data} /> : null}

      {running.map((j) => (
        <section key={j.id} className="rounded-xl border border-brand-200 bg-surface p-4" aria-live="polite">
          <StagedProgress
            title={j.kind === "capture" ? "Taking screenshots of your site" : "Collecting your product photos"}
            stages={j.stages}
            expected={{ shoot: 25, save: 6, find: 15, download: 25 }}
          />
          <p className="mt-2 text-xs text-ink-3">New images appear below as they arrive. You can leave this page.</p>
        </section>
      ))}
      {data.activeEdits.map((r) => (
        <section key={r.id} className="rounded-xl border border-brand-200 bg-surface p-4">
          <p className="text-ui font-medium text-ink">{r.title}</p>
          <RunProgressCompact slug={slug} runId={r.id as Id<"workflowRuns">} className="mt-1.5" />
        </section>
      ))}
      {lastFailed && !running.length ? <Callout tone="warning" title="That didn't work this time">{lastFailed.message ?? "Try again in a moment."}</Callout> : null}
      {data.failedEdits
        .filter((r) => now !== null && now - r.createdAt < 86_400_000)
        .map((r) => (
          <Callout key={r.id} tone="warning" title={`${r.title} didn't finish`}>
            {r.message ?? "Nothing was added. Try again."}
          </Callout>
        ))}

      <section aria-labelledby="library-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="library-heading" className="heading-section">
            Your library <span className="font-normal text-ink-3">({data.assets.length})</span>
          </h2>
          <ChoiceChips aria-label="Show" value={filter} onValueChange={(v) => setFilter(v as Filter)} options={FILTERS} />
        </div>
        {shown.length === 0 ? (
          <EmptyState icon={<ImagePlus />} title="No images here yet" body="Capture your website, collect product photos or upload your own. Then tick the ones you like and ClimbOS writes posts around them." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((a) => (
              <li key={a.id}>
                <AssetCard
                  slug={slug}
                  asset={a}
                  picked={picked.includes(a.id)}
                  onPick={(on) => setPicked((p) => (on ? [...p, a.id].slice(-6) : p.filter((x) => x !== a.id)))}
                  canEdit={data.canEdit}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {picked.length > 0 ? <PickedBar slug={slug} picked={picked} onClear={() => setPicked([])} /> : null}
    </div>
  );
}

function Sources({ slug, data }: { slug: string; data: Data }) {
  const capture = useMutation(api.assets.captureWebsite);
  const products = useMutation(api.assets.collectProducts);
  const genUrl = useMutation(api.assets.generateUploadUrl);
  const saveUpload = useMutation(api.assets.saveUpload);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const host = (() => {
    try {
      return data.website ? new URL(data.website).hostname.replace(/^www\./, "") : null;
    } catch {
      return null;
    }
  })();

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    await run("upload", async () => {
      const { saved, failed } = await uploadToLibrary(slug, Array.from(files), genUrl, saveUpload);
      if (saved.length) toast({ tone: "success", title: `Added ${saved.length} image${saved.length === 1 ? "" : "s"}` });
      if (failed) toast({ tone: "danger", title: `${failed} image${failed === 1 ? "" : "s"} didn't upload. Try again.` });
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const onTile = (key: string) => {
    if (key === "capture") void run("capture", () => capture({ slug }));
    else if (key === "products") void run("products", () => products({ slug }));
    else fileRef.current?.click();
  };
  const saas = data.businessType === "saas";
  const store = data.businessType === "ecommerce" || data.businessType === "physical_products";
  const tiles = [
    {
      key: "capture",
      icon: Monitor,
      title: "Capture my website",
      body: host ? `Real desktop, mobile and feature screenshots of ${host}.` : "Add your website in settings first.",
      disabled: !host,
      cta: "Capture",
      first: saas,
    },
    {
      key: "products",
      icon: ShoppingBag,
      title: "Get my product photos",
      body: "Your real product images, names and prices from your store.",
      disabled: !host,
      cta: "Collect",
      first: store,
    },
    {
      key: "upload",
      icon: Smartphone,
      title: "Upload screenshots or photos",
      body: "App screens (desktop or phone), product shots, team photos. PNG, JPG or WebP.",
      disabled: false,
      cta: "Upload",
      first: !saas && !store,
    },
  ].sort((a, b) => Number(b.first) - Number(a.first));

  return (
    <section aria-label="Add images" className="grid gap-3 md:grid-cols-3">
      {tiles.map((t) => (
        <div key={t.key} className={cn("flex flex-col gap-3 rounded-xl border bg-surface p-4", t.first ? "border-brand-200" : "border-line")}>
          <div className="flex items-start gap-3">
            <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-lg", t.first ? "bg-brand-800 text-white" : "bg-surface-2 text-ink-2")}>
              <t.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="heading-card flex items-center gap-2">
                {t.title} {t.first ? <Badge tone="brand">Best for you</Badge> : null}
              </p>
              <p className="mt-0.5 text-ui text-ink-3">{t.body}</p>
            </div>
          </div>
          <Button size="sm" variant={t.first ? "primary" : "secondary"} className="self-start" disabled={t.disabled} loading={busy === t.key} onClick={() => onTile(t.key)}>
            {t.key === "upload" ? <Upload aria-hidden /> : null}
            {t.cta}
          </Button>
        </div>
      ))}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="sr-only" aria-label="Upload images" onChange={(e) => void upload(e.target.files)} />
    </section>
  );
}

const VIEW_LABEL: Record<string, string> = { desktop: "Desktop", mobile: "Mobile", section: "Feature", product: "Product", other: "Upload" };

function improvable(a: Asset) {
  return a.kind === "screenshot" || a.kind === "product_photo" || a.kind === "upload";
}

function AssetCard({ slug, asset, picked, onPick, canEdit }: { slug: string; asset: Asset; picked: boolean; onPick: (on: boolean) => void; canEdit: boolean }) {
  const archive = useMutation(api.assets.archive);
  const [improving, setImproving] = useState(false);
  return (
    <>
    {improving ? <ImproveDialog slug={slug} asset={asset} onClose={() => setImproving(false)} /> : null}
    <article {...climbTarget("image", asset.id, `${asset.kind === "screenshot" ? "Screenshot" : asset.kind === "product_photo" ? "Product photo" : "Image"}: ${asset.product?.name ?? asset.label}`)} className={cn("group relative overflow-hidden rounded-xl border bg-surface transition-colors", picked ? "border-brand-800 ring-2 ring-brand-100" : "border-line hover:border-line-strong")}>
      <button type="button" onClick={() => onPick(!picked)} aria-pressed={picked} aria-label={`${picked ? "Unselect" : "Select"} ${asset.label}`} className="block w-full text-left">
        <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
          {asset.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt={asset.label} loading="lazy" className={cn("size-full", asset.kind === "product_photo" ? "object-contain p-2" : "object-cover object-top")} />
          ) : null}
          <span aria-hidden className={cn("absolute left-2 top-2 grid size-5 place-items-center rounded-[5px] border-[1.5px] shadow-sm transition-colors", picked ? "border-brand-800 bg-brand-800 text-white" : "border-white/90 bg-white/80 text-transparent group-hover:border-control")}>
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        </div>
      </button>
      <div className="flex items-start gap-2 p-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-ui font-medium text-ink">{asset.product?.name ?? asset.label}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1">
            <Badge tone={asset.kind === "ai_image" ? "violet" : asset.kind === "product_photo" ? "orange" : asset.kind === "screenshot" ? "blue" : "neutral"}>
              {asset.kind === "ai_image" ? "AI" : asset.kind === "edited" ? "Edited" : (VIEW_LABEL[asset.view ?? "other"] ?? "Image")}
            </Badge>
            {asset.product?.price ? <span className="text-xs text-ink-3">{asset.product.price}</span> : null}
            {asset.illustrative ? <Badge tone="neutral">Sample data</Badge> : null}
          </p>
        </div>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton size="sm" variant="ghost" aria-label="Image options" icon={<MoreHorizontal />} tooltip={false} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {improvable(asset) ? (
                <DropdownMenuItem icon={<Wand2 />} onSelect={() => setImproving(true)}>
                  Improve this image…
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href={`/studio/${slug}/new?asset=${asset.id}`}>Design a post with it</Link>
              </DropdownMenuItem>
              {asset.url ? (
                <DropdownMenuItem asChild>
                  <a href={asset.url} target="_blank" rel="noreferrer">
                    Open full size
                  </a>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem danger icon={<Trash2 />} onSelect={() => archive({ slug, assetId: asset.id as Id<"assets"> }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
                Remove from library
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </article>
    </>
  );
}

function ImproveDialog({ slug, asset, onClose }: { slug: string; asset: Asset; onClose: () => void }) {
  const edit = useMutation(api.assets.editImage);
  const options = (Object.keys(TREATMENTS) as Treatment[]).filter((t) => TREATMENTS[t].for.includes(asset.kind as "screenshot" | "product_photo" | "upload"));
  const [treatment, setTreatment] = useState<Treatment>(options[0]);
  const [scene, setScene] = useState<string>(SCENES[0]);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Improve this image" description="Your team edits a copy; the original stays in your library.">
        <div className="flex flex-col gap-4">
          <RadioCards aria-label="Treatment" value={treatment} onValueChange={(v) => setTreatment(v as Treatment)} options={options.map((t) => ({ value: t, title: TREATMENTS[t].label, description: TREATMENTS[t].description }))} />
          {treatment === "lifestyle_scene" ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-ui font-medium text-ink">Where should it be?</legend>
              <ChoiceChips aria-label="Scene" value={scene} onValueChange={setScene} options={SCENES.map((s) => ({ value: s, label: s.replace(/^(on|in) (a )?/, "").replace(/^./, (c) => c.toUpperCase()) }))} />
            </fieldset>
          ) : null}
          {treatment === "sample_data" ? <p className="text-xs text-ink-3">The new image is labelled &ldquo;Sample data&rdquo; so it&apos;s never mistaken for real results.</p> : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await edit({ slug, assetId: asset.id as Id<"assets">, treatment, scene: treatment === "lifestyle_scene" ? scene : undefined });
                toast({ tone: "success", title: "Working on it", description: "The new image appears in your library in about a minute." });
                onClose();
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Wand2 aria-hidden /> Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Sticky bar for checked images: pick a network and go. */
function PickedBar({ slug, picked, onClear }: { slug: string; picked: string[]; onClear: () => void }) {
  const make = useMutation(api.assets.makePosts);
  const router = useRouter();
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("instagram");
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-16 z-30 px-4 lg:bottom-6 lg:left-60">
      <div role="region" aria-label="Selected images" className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-lg">
        <p className="text-ui font-medium text-ink">
          {picked.length} image{picked.length === 1 ? "" : "s"} selected
        </p>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Post to">
          {CHANNELS.map((c) => (
            <FilterChip key={c} pressed={channel === c} onPressedChange={() => setChannel(c)} icon={<SocialIcon network={c} size="sm" variant={channel === c ? "mark" : "mark"} />}>
              <span className="sr-only sm:not-sr-only">{networkName(c)}</span>
            </FilterChip>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClear}>
            Clear
          </Button>
          <Button
            size="sm"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const { runId } = await make({ slug, assetIds: picked as Id<"assets">[], channel });
                onClear();
                router.push(`/app/${slug}/work/${runId}`);
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            <Sparkles aria-hidden /> Make {picked.length} post{picked.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </div>
  );
}
