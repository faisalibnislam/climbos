"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Check, ImagePlus, Upload } from "@/components/icons"
import Link from "next/link";
import { useRef, useState } from "react";
import { Button, EmptyState, Skeleton, toast } from "@/components/ui";
import { errorMessage } from "@/components/app/errors";
import { cn } from "@/lib/utils";

type GenUrl = (a: { slug: string }) => Promise<string>;
type SaveUpload = (a: { slug: string; storageId: Id<"_storage">; label: string; kind: "upload"; width?: number; height?: number }) => Promise<Id<"assets">>;

export function imageSize(file: File): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve({});
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload images to the library. Each file is checked (upload accepted, then
 * saved); only saved ones count. Returns the new asset ids and failures.
 */
export async function uploadToLibrary(slug: string, files: File[], genUrl: GenUrl, saveUpload: SaveUpload): Promise<{ saved: Id<"assets">[]; failed: number }> {
  const saved: Id<"assets">[] = [];
  let failed = 0;
  for (const file of files.slice(0, 12)) {
    try {
      const url = await genUrl({ slug });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      const dims = await imageSize(file);
      saved.push(await saveUpload({ slug, storageId, label: file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "), kind: "upload", ...dims }));
    } catch {
      failed++;
    }
  }
  return { saved, failed };
}

/** Pick images from the library (or upload new ones). Single or multiple choice. */
export function AssetPicker({
  slug,
  selected,
  onChange,
  max = 1,
  label = "Choose an image",
}: {
  slug: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  label?: string;
}) {
  const data = useQuery(api.assets.list, { slug });
  const genUrl = useMutation(api.assets.generateUploadUrl);
  const saveUpload = useMutation(api.assets.saveUpload);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange(max === 1 ? [id] : [...selected, id].slice(-max));
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { saved, failed } = await uploadToLibrary(slug, Array.from(files), genUrl, saveUpload);
      if (saved.length) onChange(max === 1 ? [saved[0]] : [...selected, ...saved].slice(-max));
      if (failed) toast({ tone: "danger", title: `${failed} image${failed === 1 ? "" : "s"} didn't upload. Try again.` });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-ui font-medium text-ink">
          {label}
          {max > 1 ? <span className="font-normal text-ink-3"> (up to {max})</span> : null}
        </legend>
        {data?.canEdit ? (
          <Button size="sm" variant="secondary" loading={uploading} loadingText="Uploading…" onClick={() => fileRef.current?.click()}>
            <Upload aria-hidden /> Upload
          </Button>
        ) : null}
      </div>
      {data === undefined ? (
        <Skeleton className="h-24 w-full" />
      ) : data.assets.length === 0 ? (
        <EmptyState
          icon={<ImagePlus />}
          title="No images yet"
          body={
            <>
              Upload one, or capture your site in <Link href={`/app/${slug}/images`}>Images</Link>.
            </>
          }
        />
      ) : (
        <ul className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
          {data.assets.map((a) => {
            const on = selected.includes(a.id);
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  aria-pressed={on}
                  aria-label={`${on ? "Unselect" : "Use"} ${a.product?.name ?? a.label}`}
                  className={cn("relative block aspect-square w-full overflow-hidden rounded-lg border bg-surface-2", on ? "border-brand-800 ring-2 ring-brand-100" : "border-line hover:border-line-strong")}
                >
                  {a.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" loading="lazy" className={cn("size-full", a.kind === "product_photo" ? "object-contain p-1" : "object-cover object-top")} />
                  ) : null}
                  {on ? (
                    <span aria-hidden className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-[5px] bg-brand-800 text-white">
                      <Check className="size-3.5" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple={max > 1} className="sr-only" aria-label="Upload images" tabIndex={-1} onChange={(e) => void upload(e.target.files)} />
    </fieldset>
  );
}
