"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { CircleAlert, ImagePlus, Palette } from "@/components/icons"
import { useId, useState } from "react";
import { Button, Callout, Checkbox, Field, Input, Textarea, toast } from "@/components/ui";
import { AssetPicker } from "@/components/app/AssetPicker";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ErrorCallout } from "../shared";
import { bodyLimit, composeSocial, fieldLabels, headlineLimit, isSocial, parseHashtags, type ArtifactView, type TextLimit } from "./model";

function CharCount({ id, value, limit }: { id: string; value: string; limit: TextLimit }) {
  const n = limit.count(value);
  const over = n - limit.limit;
  return (
    <p id={id} className={cn("flex items-center gap-1.5 text-xs tabular-nums", over > 0 ? "font-medium text-red-800" : "text-ink-3")}>
      {over > 0 ? <CircleAlert aria-hidden="true" className="size-3.5" /> : null}
      {limit.label}: {n.toLocaleString("en-US")}/{limit.limit.toLocaleString("en-US")}
      {over > 0 ? ` (${over.toLocaleString("en-US")} over)` : ""}
    </p>
  );
}

/**
 * Editor for the current version. Saving creates a new version and cancels
 * any approval (the backend invalidates approvals bound to the old text).
 */
export function DraftEditor({ slug, artifact, onDone }: { slug: string; artifact: ArtifactView; onDone: () => void }) {
  const cur = artifact.current;
  const edit = useMutation(api.content.edit);
  const labels = fieldLabels(artifact.channel, artifact.kind);
  const showHeadline = labels.showHeadline || Boolean(cur?.headline);
  const showCta = labels.showCta || Boolean(cur?.callToAction);
  const hasImage = Boolean(cur?.imageUrl);

  const [title, setTitle] = useState(artifact.title);
  const [headline, setHeadline] = useState(cur?.headline ?? "");
  const [body, setBody] = useState(cur?.body ?? "");
  const [cta, setCta] = useState(cur?.callToAction ?? "");
  const [url, setUrl] = useState(cur?.destinationUrl ?? "");
  const [tags, setTags] = useState((cur?.hashtags ?? []).join(", "));
  const [alt, setAlt] = useState(cur?.altText ?? "");
  const [removeImage, setRemoveImage] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [choosing, setChoosing] = useState(false);
  const imageAssetId = picked[0] as Id<"assets"> | undefined;
  const canHaveImage = isSocial(artifact.channel) || ["meta_ad", "linkedin_ad", "blog", "website"].includes(artifact.channel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const bodyCountId = useId();
  const headCountId = useId();
  const bLimit = bodyLimit(artifact.channel);
  const hLimit = headlineLimit(artifact.channel);
  const hashtagList = parseHashtags(tags);
  const countedBody = isSocial(artifact.channel) ? composeSocial(body, hashtagList) : body;
  const approvedish = ["approved", "scheduled"].includes(artifact.status);
  const imageKept = Boolean(imageAssetId) || (hasImage && !removeImage);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!body.trim()) e.body = "The text can't be empty.";
    if (url.trim() && !/^https:\/\//i.test(url.trim())) e.url = "Links must start with https://";
    if (imageKept && !alt.trim()) e.alt = "Describe the image.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await edit({
        slug,
        artifactId: artifact.id,
        title: title.trim() || undefined,
        headline: showHeadline ? headline.trim() || undefined : undefined,
        body,
        callToAction: showCta ? cta.trim() || undefined : undefined,
        destinationUrl: url.trim() || undefined,
        hashtags: hashtagList,
        altText: alt.trim() || undefined,
        removeImage: (removeImage && !imageAssetId) || undefined,
        imageAssetId,
      });
      if (res.changed) {
        toast({ tone: "success", title: `Saved as v${res.version}. Needs approval.` });
        onDone();
      } else {
        toast({ tone: "info", title: "No changes to save." });
      }
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Callout tone={approvedish ? "warning" : "info"} title={approvedish ? "Saving cancels approval" : "Needs new approval"}>
        Saves as version {(cur?.version ?? 0) + 1}.
      </Callout>

      <Field label="Internal name">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
      </Field>

      {showHeadline ? (
        <div className="flex flex-col gap-1.5">
          <Field label={labels.headline}>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={500} aria-describedby={hLimit ? headCountId : undefined} />
          </Field>
          {hLimit ? <CharCount id={headCountId} value={headline} limit={hLimit} /> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Field label={labels.body} error={errors.body}>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} autosize maxRows={20} aria-describedby={bLimit ? bodyCountId : undefined} />
        </Field>
        {bLimit ? <CharCount id={bodyCountId} value={countedBody} limit={bLimit} /> : null}
      </div>

      {showCta ? (
        <Field label="Button text" optional>
          <Input value={cta} onChange={(e) => setCta(e.target.value)} maxLength={120} />
        </Field>
      ) : null}

      {isSocial(artifact.channel) || hashtagList.length > 0 ? (
        <Field label="Hashtags" optional hint="Comma-separated">
          <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="smallbusiness, localcoffee" />
        </Field>
      ) : null}

      <Field label="Link" optional error={errors.url}>
        <Input type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
      </Field>

      {canHaveImage ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-ui font-medium text-ink">
              Image{" "}
              <span className="font-normal text-ink-3">
                {imageAssetId ? "· new" : hasImage && !removeImage ? "· current" : artifact.channel === "instagram" ? "· required" : "· optional"}
              </span>
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/studio/${slug}/new?post=${artifact.id}`}>
                  <Palette aria-hidden /> Design
                </Link>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setChoosing((c) => !c)} aria-expanded={choosing}>
                <ImagePlus aria-hidden /> {choosing ? "Done" : hasImage || imageAssetId ? "Change image" : "Add image"}
              </Button>
            </div>
          </div>
          {choosing ? <AssetPicker slug={slug} selected={picked} onChange={setPicked} label="Your images" /> : null}
        </div>
      ) : null}

      {imageKept ? (
        <Field label="Alt text" required error={errors.alt}>
          <Textarea value={alt} onChange={(e) => setAlt(e.target.value)} rows={2} autosize maxLength={1000} />
        </Field>
      ) : null}
      {hasImage && !imageAssetId ? (
        <Checkbox checked={removeImage} onCheckedChange={(v) => setRemoveImage(v === true)} label="Remove image" />
      ) : null}

      {error ? <ErrorCallout error={error} /> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving} loadingText="Saving…">
          Save
        </Button>
      </div>
    </form>
  );
}
