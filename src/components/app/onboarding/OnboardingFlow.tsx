"use client";

import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Callout, Skeleton } from "@/components/ui";
import { DiscoveryChat } from "./DiscoveryChat";
import { parseOnboardingDraft } from "../draftKeys";

/** Onboarding is one real AI conversation. Legacy stage values are routing metadata only. */
export function OnboardingFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useQuery(api.orgs.me);
  const requested = params.get("workspace");
  const wantNew = params.get("new") === "1";
  const draftId = params.get("draft");
  const draft = useQuery(api.onboardingDrafts.get, draftId ? { draftId: draftId as Id<"onboardingDrafts"> } : "skip");
  const previewToken = params.get("preview");
  const preview = useQuery(api.preview.get, previewToken ? { token: previewToken } : "skip");
  useEffect(() => { if (me === null) router.replace("/sign-in?next=/onboarding"); }, [me, router]);
  if (me === undefined) return <main id="main" className="mx-auto max-w-3xl p-6"><Skeleton className="h-48 w-full" /></main>;
  if (!me) return null;
  if (me.isAnonymous) return <main id="main" className="mx-auto max-w-xl p-6"><Callout title="Sign in to save your conversation"><Button asChild className="mt-3"><Link href="/sign-in?switch=1&next=/onboarding">Sign in</Link></Button></Callout></main>;
  const allowed = me.orgs.filter(org => org.kind === "customer" && ["owner", "admin", "editor"].includes(org.role));
  if (requested && !allowed.some(org => org.slug === requested)) return <main id="main" className="mx-auto max-w-xl p-6"><Callout title="This business isn’t available">Open a business you have access to, or start a new conversation.<Link href="/app" className="ml-2 underline">Open my businesses</Link></Callout></main>;
  const slug = requested ?? (wantNew ? null : allowed.find(org => org.onboardingStep !== "done")?.slug ?? null);
  const stored = draft ? parseOnboardingDraft(draft.payload) : null;
  const prefill = stored?.chat || [preview?.website, preview?.goal].filter(Boolean).join(". ");
  return <DiscoveryChat key={`${me.userId}:${slug ?? "new"}:${params.get("fresh") ?? ""}:${draftId ?? ""}`} slug={slug} userId={me.userId} prefill={prefill} fresh={params.get("fresh") ?? ""} />;
}
