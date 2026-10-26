"use client";

import { Heart, ImageIcon, MessageCircle } from "@/components/icons"
import type { ReactNode } from "react";
import { SocialIcon } from "@/components/ui";
import { cn } from "@/lib/utils";
import { channelLabel } from "../shared";
import { hostOf, type VersionView } from "./model";
import { visualFormatLabel, visualOf } from "./SuggestedVisual";

const AI_IMAGE_LABEL = "AI-generated illustration";

function ImageBlock({ version, square }: { version: VersionView; square?: boolean }) {
  const extra = version.imageLabel && version.imageLabel.trim().toLowerCase() !== AI_IMAGE_LABEL.toLowerCase() ? version.imageLabel.trim() : null;
  return (
    <figure className="flex flex-col">
      <div className={cn("relative w-full overflow-hidden bg-surface-3", square ? "aspect-square" : "aspect-[1.91/1]")}>
        {version.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed storage URL from Convex
          <img src={version.imageUrl} alt={version.altText ?? ""} className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-ink-3">
            <ImageIcon aria-hidden="true" className="size-10" />
          </div>
        )}
      </div>
      {version.imageUrl ? (
        <figcaption className="bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-2">
          {AI_IMAGE_LABEL}
          {extra ? ` · ${extra}` : ""}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Where the suggested visual goes until there is an image; the brief is under "Suggested visual". */
function VisualPlaceholder({ version }: { version: VersionView }) {
  const visual = visualOf(version);
  if (!visual) return null;
  return (
    <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-dashed border-line bg-surface-2 px-3 py-4 text-ink-3">
      <ImageIcon aria-hidden="true" className="size-5 shrink-0" />
      <span className="text-xs">
        {visual.format === "text" ? "Optional visual" : `Suggested ${visualFormatLabel(visual.format).toLowerCase()}`}: see the brief below.
      </span>
    </div>
  );
}

function Frame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-md overflow-hidden rounded-xl border border-line bg-surface", className)}>{children}</div>;
}

function Hashtags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return <p className="mt-2 break-words text-blue-800">{tags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")}</p>;
}

function AccountRow({ name, sub, channel }: { name: string; sub?: string; channel: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-900">
        {name.replace(/^@/, "").slice(0, 1).toUpperCase() || "Y"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{name}</span>
        {sub ? <span className="block text-xs text-ink-3">{sub}</span> : null}
      </span>
      <SocialIcon network={channel} size="md" />
    </div>
  );
}

/**
 * A light, logo-free approximation of how the draft will look on its channel.
 * It is a preview only; each platform renders text slightly differently.
 */
export function ChannelPreview({ channel, version, accountLabel }: { channel: string; version: VersionView; accountLabel?: string | null }) {
  const account = accountLabel ?? "Your business";
  const body = <p className="whitespace-pre-wrap break-words text-sm text-ink">{version.body}</p>;

  if (channel === "instagram") {
    return (
      <Frame>
        <AccountRow name={account} channel={channel} />
        <ImageBlock version={version} square />
        <div className="flex gap-3 px-3 pt-3 text-ink-2" aria-hidden="true">
          <Heart className="size-5" />
          <MessageCircle className="size-5" />
        </div>
        <div className="px-3 pb-4 pt-2">
          <p className="whitespace-pre-wrap break-words text-sm text-ink">
            <span className="font-semibold">{account} </span>
            {version.body}
          </p>
          <Hashtags tags={version.hashtags} />
        </div>
      </Frame>
    );
  }

  if (channel === "google_search_ad") {
    const host = hostOf(version.destinationUrl) ?? "yourwebsite.com";
    return (
      <Frame className="p-4">
        <div className="flex items-center gap-2 text-ink-3" aria-hidden="true">
          <SocialIcon network="google" size="sm" />
          <span className="text-xs">Search results</span>
        </div>
        <p className="mt-3 text-xs font-semibold text-ink">Sponsored</p>
        <p className="mt-0.5 break-words text-sm text-ink-2">{host}</p>
        <p className="mt-1 break-words text-base font-medium text-blue-800">{version.headline || "Your headline"}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-2">{version.body}</p>
      </Frame>
    );
  }

  if (channel === "email") {
    return (
      <Frame>
        <dl className="border-b border-line px-4 py-3 text-sm">
          <div className="flex gap-2">
            <dt className="text-ink-3">From:</dt>
            <dd className="text-ink">{account}</dd>
          </div>
          <div className="mt-1 flex gap-2">
            <dt className="text-ink-3">Subject:</dt>
            <dd className="break-words font-semibold text-ink">{version.headline || "(no subject yet)"}</dd>
          </div>
        </dl>
        <div className="px-4 py-4">
          {body}
          {version.callToAction ? (
            <span className="mt-4 inline-flex h-9 items-center rounded-lg bg-brand-800 px-4 text-ui font-medium text-white">{version.callToAction}</span>
          ) : null}
        </div>
      </Frame>
    );
  }

  if (channel === "blog" || channel === "website") {
    const host = hostOf(version.destinationUrl) ?? "yourwebsite.com";
    return (
      <Frame className="p-4">
        <p className="text-xs text-ink-3">{host}</p>
        <p className="heading-section mt-1 break-words">{version.headline || "Page title"}</p>
        <div className="mt-3 max-h-96 overflow-y-auto">{body}</div>
      </Frame>
    );
  }

  const isAd = channel === "meta_ad" || channel === "linkedin_ad";
  return (
    <Frame>
      <AccountRow name={account} sub={isAd ? "Sponsored" : channelLabel(channel)} channel={channel} />
      <div className="px-3 pb-3">
        {version.headline && !isAd ? <p className="mb-1 font-semibold text-ink">{version.headline}</p> : null}
        {body}
        <Hashtags tags={version.hashtags} />
      </div>
      {version.imageUrl || channel === "pinterest" || channel === "youtube" || channel === "tiktok" ? (
        <ImageBlock version={version} square={channel === "pinterest"} />
      ) : !isAd && visualOf(version) ? (
        <VisualPlaceholder version={version} />
      ) : null}
      {isAd ? (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface-2 px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-xs text-ink-3">{hostOf(version.destinationUrl) ?? "yourwebsite.com"}</span>
            <span className="block truncate text-sm font-semibold text-ink">{version.headline || "Headline"}</span>
          </span>
          {version.callToAction ? <span className="inline-flex h-8 shrink-0 items-center rounded-lg bg-surface-3 px-3 text-ui font-medium text-ink">{version.callToAction}</span> : null}
        </div>
      ) : null}
    </Frame>
  );
}
