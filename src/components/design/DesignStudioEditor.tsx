"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ChevronDown, Download, FileText, ImageDown, Images, Send } from "@/components/icons"
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { DesignDoc } from "@shared/design/types";
import { Button, Dialog, DialogContent, DialogFooter, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EmptyState, Skeleton, Spinner, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";

import type { UploadedAsset } from "./editor/Panels";
import { DesignEditor } from "./editor/DesignEditor";

/** Download a file from storage under a readable name (falls back to opening it). */
async function download(url: string, name: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const href = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function imageSize(file: File): Promise<{ width: number; height: number; url: string }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, url });
    img.onerror = () => resolve({ width: 1000, height: 1000, url });
    img.src = url;
  });
}

/** A saved design in the editor: autosave, workspace photos and logo, downloads, and "Use in post". */
export function DesignStudioEditor({ slug, designId, postId }: { slug: string; designId: Id<"designs">; postId?: string }) {
  const design = useQuery(api.designs.get, { slug, designId });
  const lib = useQuery(api.assets.list, { slug });
  const save = useMutation(api.designs.save);
  const rename = useMutation(api.designs.rename);
  const genUrl = useMutation(api.assets.generateUploadUrl);
  const saveUpload = useMutation(api.assets.saveUpload);
  const exportFiles = useAction(api.designs.exportFiles);
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const pageRef = useRef(0);

  const library: UploadedAsset[] = useMemo(
    () => (lib?.assets ?? []).filter((a) => a.url && a.kind !== "design").map((a) => ({ id: a.id, ref: `asset:${a.id}`, url: a.url!, name: a.label, width: a.width ?? 1000, height: a.height ?? 1000 })),
    [lib],
  );
  const urlMap = useMemo(() => {
    const m: Record<string, string> = { ...(design?.urls ?? {}) };
    for (const a of library) m[a.ref!] = a.url;
    return { ...m, ...localUrls };
  }, [design?.urls, library, localUrls]);
  const resolve = useCallback((src: string) => urlMap[src], [urlMap]);

  const onSave = useCallback(async (doc: DesignDoc) => {
    await save({ slug, designId, doc: JSON.stringify(doc) });
  }, [save, slug, designId]);

  const onUpload = useCallback(
    async (files: File[], kind: "upload" | "logo"): Promise<UploadedAsset[]> => {
      const out: UploadedAsset[] = [];
      for (const file of files.slice(0, 12)) {
        try {
          const meta = await imageSize(file);
          const res = await fetch(await genUrl({ slug }), { method: "POST", headers: { "Content-Type": file.type }, body: file });
          if (!res.ok) throw new Error("Upload failed");
          const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
          const id = await saveUpload({ slug, storageId, label: file.name.replace(/\.[a-z0-9]+$/i, ""), kind, width: meta.width, height: meta.height });
          const ref = `asset:${id}`;
          setLocalUrls((m) => ({ ...m, [ref]: meta.url }));
          out.push({ id, ref, url: meta.url, name: file.name, width: meta.width, height: meta.height });
        } catch (e) {
          toast({ tone: "danger", title: `${file.name}: ${errorMessage(e)}` });
        }
      }
      return out;
    },
    [genUrl, saveUpload, slug],
  );

  const runExport = async (pages: number[], kind: "png" | "pdf") => {
    setExporting(true);
    try {
      const { files } = await exportFiles({ slug, designId, pages, kind });
      for (const f of files) await download(f.url, f.name);
      toast({ tone: "success", title: files.length > 1 ? `Downloaded ${files.length} images` : "Downloaded" });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setExporting(false);
    }
  };

  if (design === undefined) return <Skeleton className="m-6 h-[70vh] rounded-xl" />;
  if (design === null) return <EmptyState className="m-10" headingLevel="h2" title="This design isn't here" body="It may have been deleted." action={<Button asChild><Link href={`/studio/${slug}`}>Back to designs</Link></Button>} />;

  return (
    <>
      <DesignEditor
        key={design.id}
        initial={design.doc}
        title={design.title}
        backHref={`/studio/${slug}`}
        readOnly={!design.canEdit}
        onSave={design.canEdit ? onSave : undefined}
        onTitleChange={design.canEdit ? (title) => void rename({ slug, designId, title }).catch((e) => toast({ tone: "danger", title: errorMessage(e) })) : undefined}
        resolve={resolve}
        library={library}
        onUpload={design.canEdit ? onUpload : undefined}
        headerActions={({ doc, pageIndex }) => {
          pageRef.current = pageIndex;
          return (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary" disabled={exporting}>
                    {exporting ? <Spinner /> : <Download aria-hidden />} Download <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem icon={<ImageDown />} onSelect={() => runExport([pageIndex], "png")}>
                    This page (PNG)
                  </DropdownMenuItem>
                  {doc.pages.length > 1 ? (
                    <DropdownMenuItem icon={<Images />} onSelect={() => runExport(doc.pages.map((_, i) => i), "png")}>
                      All {doc.pages.length} pages (PNG)
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem icon={<FileText />} onSelect={() => runExport(doc.pages.map((_, i) => i), "pdf")}>
                    PDF{doc.pages.length > 1 ? " (all pages)" : ""}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {design.canEdit ? (
                <Button size="sm" onClick={() => setPostOpen(true)}>
                  <Send aria-hidden /> Use in post
                </Button>
              ) : null}
            </>
          );
        }}
      />
      <UseInPostDialog open={postOpen} onOpenChange={setPostOpen} slug={slug} designId={designId} pageIndex={() => pageRef.current} preselect={postId ?? design.artifactId ?? undefined} />
    </>
  );
}

function UseInPostDialog({ open, onOpenChange, slug, designId, pageIndex, preselect }: { open: boolean; onOpenChange: (o: boolean) => void; slug: string; designId: Id<"designs">; pageIndex: () => number; preselect?: string }) {
  const posts = useQuery(api.designs.attachable, open ? { slug } : "skip");
  const attach = useAction(api.designs.useInPost);
  const [picked, setPicked] = useState<string | null>(preselect ?? null);
  const [busy, setBusy] = useState(false);
  const choice = picked ?? preselect ?? null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Use this design in a post" description="The current page becomes the post's image. The post goes back to review.">
        {posts === undefined ? (
          <Skeleton className="h-40 w-full" />
        ) : posts.length === 0 ? (
          <p className="text-sm text-ink-3">No social posts to add it to yet. Create one in Content first.</p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto" role="radiogroup" aria-label="Posts">
            {posts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={choice === p.id}
                  onClick={() => setPicked(p.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${choice === p.id ? "border-brand-600 bg-brand-50" : "border-line hover:bg-surface-2"}`}
                >
                  <span className="truncate text-ink">{p.title}</span>
                  <span className="shrink-0 text-xs capitalize text-ink-3">
                    {p.channel} · {p.status.replace("_", " ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={!choice || busy}
            onClick={async () => {
              if (!choice) return;
              setBusy(true);
              try {
                await attach({ slug, designId, artifactId: choice as Id<"artifacts">, pageIndex: pageIndex() });
                toast({ tone: "success", title: "Added to the post", description: "It's back in review with the new image." });
                onOpenChange(false);
              } catch (e) {
                toast({ tone: "danger", title: errorMessage(e) });
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Spinner /> : null} Add to post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

