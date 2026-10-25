"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Building2, CalendarDays, Check, Clock, Coins, ExternalLink, Globe, Magic, Pencil, Plus, Sparkles, Target, X, type LucideIcon } from "@/components/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { RequestComposer } from "@/components/ui/request-composer";
import { WordHelp } from "@/components/ui/word-help";
import { Logo } from "@/components/brand/Logo";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  Checkbox,
  Field,
  Input,
  RadioCards,
  Select,
  Skeleton,
  Textarea,
  buttonClasses,
  toast,
  Toaster,
} from "@/components/ui";
import { Scannable } from "@/components/ds/content";
import { cn } from "@/lib/utils";
import { errorInfo, errorMessage } from "../errors";
import { parseIntro, type ParsedIntro } from "./parseIntro";
import { RetryRunIfPossible, RunProgress, RunProgressCompact } from "../content/RunProgress";
import { AiModeChoice, AiModePicker, useAiMode } from "../AiModePicker";
import { microsToCreditsLabel } from "../money";
import { BUSINESS_TYPE_OPTIONS, CURRENCY_OPTIONS, GOAL_KIND_OPTIONS, HORIZON_OPTIONS, REVIEW_DAY_OPTIONS, defaultEvents, goalDefaults } from "./options";


type Step = "business" | "research" | "facts" | "goal" | "preferences" | "plan" | "done";
const STEP_ORDER: Step[] = ["business", "research", "facts", "goal", "preferences", "plan"];
const STEP_LABEL: Record<Step, string> = {
  business: "Business",
  research: "Learn about you",
  facts: "Check details",
  goal: "Choose a goal",
  preferences: "Your control",
  plan: "Next steps",
  done: "Done",
};

/** What the team does at each step, shown beside the form so owners always know what happens next. */
const STEP_HELP: Record<Step, { title: string; roles: string[]; points: string[]; ordered?: boolean }> = {
  business: {
    title: "What happens next",
    roles: ["data_analyst", "cmo", "ceo"],
    points: ["We read your public site", "You check every fact", "You choose what to do next"],
    ordered: true,
  },
  research: {
    title: "Your team is on it",
    roles: ["data_analyst", "cmo"],
    points: ["Reading your business details", "Looking at who you help", "Nothing is published"],
  },
  facts: {
    title: "Why facts matter",
    roles: ["data_analyst"],
    points: ["Only confirmed facts are used", "Fix, remove or add"],
  },
  goal: { title: "Your goal", roles: ["ceo"], points: ["One goal keeps focus", "Change it any time"] },
  preferences: { title: "You stay in control", roles: ["coo"], points: ["Pause all in one click", "Budgets are hard limits"] },
  plan: { title: "Your plan covers", roles: ["ceo", "cmo"], points: ["Who to reach, what to say", "Where to start and what it may cost", "How we measure progress"] },
  done: { title: "All set", roles: ["ceo"], points: [] },
};

const TIMEZONE = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

export function OnboardingFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useQuery(api.orgs.me);
  const previewToken = params.get("preview");
  const preview = useQuery(api.preview.get, previewToken ? { token: previewToken } : "skip");
  const workspaceParam = params.get("workspace");
  const wantNew = params.get("new") === "1";

  const slug = useMemo(() => {
    if (!me) return null;
    if (workspaceParam && me.orgs.some((o) => o.slug === workspaceParam)) return workspaceParam;
    if (wantNew) return null;
    // Only a workspace you own or run: an invited teammate never lands in someone else's setup.
    const unfinished = me.orgs.find((o) => o.kind === "customer" && o.onboardingStep !== "done" && (o.role === "owner" || o.role === "admin"));
    return unfinished?.slug ?? null;
  }, [me, workspaceParam, wantNew]);

  useEffect(() => {
    if (me === null) router.replace("/sign-in?next=/onboarding");
  }, [me, router]);

  if (me === undefined) return <Shell step="business"><Skeleton className="h-64 w-full" /></Shell>;
  if (me === null) return null;
  if (me.isAnonymous) {
    return (
      <Shell step="business">
        <Callout tone="info" title="Create a free account">
          You’re a guest. Sign in to set up yours.
          <div className="mt-3">
            <Button asChild>
              <Link href="/sign-in?switch=1&next=/onboarding">Create a free account</Link>
            </Button>
          </div>
        </Callout>
      </Shell>
    );
  }
  if (workspaceParam && !me.orgs.some((org) => org.slug === workspaceParam && (org.role === "owner" || org.role === "admin"))) {
    return <Shell step="business"><Callout tone="info" title="You cannot set up this business">Ask its owner for help, or <Link href="/app" className="underline">return to your businesses</Link>.</Callout></Shell>;
  }
  if (!slug) {
    return (
      <BusinessStep
        key={`${me.userId}:${wantNew ? "new" : "first"}:${preview?.website ?? "blank"}`}
        additional={wantNew}
        prefillWebsite={preview?.website ?? ""}
        prefillGoal={preview?.goal ?? ""}
        previewToken={preview?.status === "done" ? previewToken : null}
        onCreated={(s) => router.replace(`/onboarding?workspace=${s}`)}
      />
    );
  }
  return <WorkspaceOnboarding slug={slug} />;
}

function Shell({ step, children, slug }: { step: Step; children: ReactNode; slug?: string }) {
  const idx = Math.max(0, STEP_ORDER.indexOf(step));
  const help = STEP_HELP[step];
  return (
    <div className="min-h-dvh bg-bg">
      <Toaster />
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo />
          {slug ? (
            <Link href={`/app/${slug}/today`} className={buttonClasses({ variant: "ghost", size: "sm", className: "text-ink-2" })}>
              Finish later
            </Link>
          ) : null}
        </div>
        <ol className="mx-auto flex max-w-6xl gap-2 px-4 pb-4" aria-label="Setup progress">
          {STEP_ORDER.map((s, i) => (
            <li key={s} className="flex flex-1 flex-col gap-1.5">
              <span className={cn("block h-1.5 rounded-full", i < idx ? "bg-ink" : i === idx ? "bg-sun" : "bg-surface-3")} aria-hidden />
              <span className={cn("hidden text-xs font-medium md:block", i <= idx ? "text-ink" : "text-ink-3")}>
                {i < idx ? <Check className="mr-1 inline size-3.5 text-brand-800" aria-hidden /> : null}
                {STEP_LABEL[s]}
              </span>
              <span className="sr-only">
                {STEP_LABEL[s]}: {i < idx ? "done" : i === idx ? "current step" : "not started"}
              </span>
            </li>
          ))}
        </ol>
      </header>
      <main id="main" className="mx-auto grid max-w-6xl gap-8 px-4 pb-24 pt-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <p className="text-overline">
            Step {idx + 1} of {STEP_ORDER.length} · {STEP_LABEL[step]}
          </p>
          <div className="mt-1">{children}</div>
        </div>
        {help.points.length ? (
          <aside className="hidden h-fit rounded-xl border border-line bg-surface p-5 lg:block" aria-label={help.title}>
            <p className="heading-card">{help.title}</p>
            {(() => {
              const List = help.ordered ? "ol" : "ul";
              return (
                <List className="mt-3 space-y-3">
                  {help.points.map((p, i) => (
                    <li key={p} className="flex gap-2.5 text-sm text-ink-2">
                      <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-800 text-2xs font-semibold tabular-nums text-white">
                        {help.ordered ? i + 1 : <Check className="size-3" />}
                      </span>
                      {p}
                    </li>
                  ))}
                </List>
              );
            })()}
          </aside>
        ) : null}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: business (chat or checklist)                                 */
/* ------------------------------------------------------------------ */

function BusinessStep({
  additional,
  prefillWebsite,
  prefillGoal,
  previewToken,
  onCreated,
}: {
  additional: boolean;
  prefillWebsite: string;
  prefillGoal: string;
  previewToken: string | null;
  onCreated: (slug: string) => void;
}) {
  const [mode, setMode] = useState<"chat" | "form">("chat");
  const [chat, setChat] = useState([prefillWebsite, prefillGoal].filter(Boolean).join(". "));
  const [name, setName] = useState("");
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const creating = useRef(false);
  const [website, setWebsite] = useState(prefillWebsite);
  const [noWebsite, setNoWebsite] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation(api.orgs.createWorkspace);
  const startResearch = useMutation(api.orgs.startResearch);
  const claim = useMutation(api.preview.claim);
  const aiView = useQuery(api.orgs.newWorkspaceAiMode, {});
  const expertUnlocked = Boolean(aiView?.expertUnlocked);
  const [picked, setAiMode] = useState<"basic" | "expert" | null>(null);
  // Paid accounts default to Expert, like the workspace picker; free ones stay on Basic.
  const aiMode: "basic" | "expert" = expertUnlocked ? (picked ?? "expert") : "basic";
  const researchEstimate = aiView?.estimates?.onboarding_research?.[aiMode];
  const researchCost = researchEstimate === undefined
    ? "Research uses credits; the estimate will appear when it is ready."
    : `Research uses up to ${microsToCreditsLabel(researchEstimate)}. We charge only for the work completed; unused reserved credits are returned.`;

  const parsed: ParsedIntro = useMemo(() => parseIntro(chat), [chat]);

  async function submit(fields: { name: string; website?: string; ownerText?: string; parsed?: ParsedIntro }) {
    if (creating.current) return;
    setError(null);
    if (!fields.name.trim()) {
      setError("Add your business name.");
      return;
    }
    if (!fields.website && !fields.ownerText) {
      setError("Add a website or a description.");
      return;
    }
    creating.current = true;
    setBusy(true);
    try {
      const referralCode = /(?:^|;\s*)climbos_ref=([a-z0-9]+)/.exec(document.cookie)?.[1];
      const { slug, orgId } = await create({ businessName: fields.name, website: fields.website, timezone: TIMEZONE, referralCode });
      if (fields.parsed) {
        try {
          sessionStorage.setItem(`climbos:intro:${slug}`, JSON.stringify(fields.parsed));
        } catch {
          // Storage may be unavailable (private mode); the checklist still works.
        }
      } else if (prefillGoal) {
        try {
          sessionStorage.setItem(`climbos:intro:${slug}`, JSON.stringify({ goalStatement: prefillGoal }));
        } catch {}
      }
      if (previewToken) await claim({ token: previewToken, orgId: orgId as Id<"organizations"> }).catch(() => undefined);
      try {
        await startResearch({ slug, website: fields.website, ownerText: fields.ownerText, aiMode });
      } catch (e) {
        // The workspace exists: carry on to it, where research can be started again.
        toast({ tone: "danger", title: errorMessage(e) });
      }
      onCreated(slug);
    } catch (e) {
      setError(errorMessage(e));
      creating.current = false;
      setBusy(false);
    }
  }

  return (
    <Shell step="business">
      <h1 className="heading-page">{additional ? "Tell us about your next business" : "Tell us about your business"}</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-3">Describe what you do and what you need help with. A website is helpful, but you do not need one. We’ll guide you from there.</p>
      {additional ? <p className="mt-2 text-sm text-ink-3">This creates a separate space for this business. Your other businesses keep their own details and accounts.</p> : null}

      {error && <Callout tone="danger" className="mt-6">{error}</Callout>}

      {mode === "chat" ? (
        <div className="mt-6 space-y-4">
          <RequestComposer
            label="Your business and what you need"
            value={chat}
            onChange={setChat}
            onSubmit={() => void submit({ name: nameOverride ?? parsed.businessName ?? name, website: parsed.website, ownerText: chat, parsed })}
            placeholder="My business is called Northstar Bakery. I sell bread and cakes, and I want more local orders."
            submitLabel="Create business & continue"
            busy={busy}
            helper={`Creates your business space and starts research. ${researchCost} You check the details before choosing your next steps.`}
            suggestions={["I want help finding customers.", "I want to sell more.", "I am not sure where to start.", "I do not have a website yet."]}
          />
            {chat.trim().length > 8 && (
              <div className="rounded-xl border border-line bg-surface p-4 text-ui" aria-live="polite">
                <p className="heading-card flex flex-wrap items-center gap-2">
                  <Sparkles className="size-4 text-brand-800" aria-hidden /> What we understood
                </p>
                <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Understood icon={Building2} label="Business" value={nameOverride ?? parsed.businessName} />
                  <Understood icon={Globe} label="Website" value={parsed.website} />
                  <Understood icon={Target} label="Goal" value={parsed.goalStatement} wide />
                  <Understood icon={Coins} label="Ad budget" value={parsed.monthlyAdBudget !== undefined ? `$${parsed.monthlyAdBudget.toLocaleString()} / month` : undefined} />
                  <Understood icon={Clock} label="When would you like to review progress?" value={parsed.horizonDays ? `${parsed.horizonDays} days` : undefined} />
                  <Understood icon={CalendarDays} label="Which day should we review your progress?" value={parsed.reviewDay} />
                </dl>
                <Field label="Name to use for this business" hint="Check this name. You can change it before continuing." className="mt-3">
                  <Input value={nameOverride ?? parsed.businessName ?? name} onChange={(event) => setNameOverride(event.target.value)} placeholder="What is your business called?" autoComplete="organization" />
                </Field>
              </div>
            )}
        </div>
      ) : (
        <Card className="mt-6">
          <CardContent className="space-y-5">
            <Field label="Business name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Formkit" autoComplete="organization" />
            </Field>
            {!noWebsite ? (
              <Field label="Website" hint="We read a few public pages.">
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbusiness.com" inputMode="url" autoComplete="url" />
              </Field>
            ) : (
              <Field label="Describe your business" hint="What you sell, to whom, what’s different.">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} autosize />
              </Field>
            )}
            <Button variant="link" className="whitespace-normal text-left" onClick={() => setNoWebsite((v) => !v)}>
              {noWebsite ? "Use a website" : "No website? Describe it"}
            </Button>
            <div>
              <Button size="lg" loading={busy} loadingText="Setting up…" onClick={() => submit({ name, website: noWebsite ? undefined : website, ownerText: noWebsite ? description : undefined })}>
                Continue
              </Button>
              <p className="mt-2 max-w-[70ch] text-xs text-ink-3">{researchCost}</p>
            </div>
          </CardContent>
        </Card>
      )}
      <Button type="button" variant="link" className="mt-4" onClick={() => {
        if (mode === "chat") {
          setName(nameOverride ?? parsed.businessName ?? name);
          setWebsite(parsed.website ?? website);
          setDescription(chat);
          setNoWebsite(!parsed.website && !website);
          setMode("form");
        } else {
          setChat([name ? `My business is called ${name}.` : "", !noWebsite ? website : "", noWebsite ? description : parsed.goalStatement].filter(Boolean).join(" "));
          setNameOverride(name || null);
          setMode("chat");
        }
      }}>
        {mode === "chat" ? "Prefer a simple form?" : "Describe it in your own words instead"}
      </Button>
      {additional ? <Link href="/app" className="ml-3 text-sm text-ink-3 underline">Back to my businesses</Link> : null}
      {/* Expert unlocks when the owner's account has a paid (or comped) package; new workspaces join that account. */}
      <details className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium text-ink">More options: how much detail to use</summary>
        <div className="mt-4"><AiModeChoice unlocked={expertUnlocked} costs={aiView?.estimates?.onboarding_research} value={aiMode} onChange={setAiMode} label="Analysis detail" /></div>
      </details>
      <div className="mt-6"><WordHelp /></div>
      <p className="mt-6 text-sm text-ink-3">
        <Link href="/demo" className={buttonClasses({ variant: "link" })}>Try the demo first</Link>
      </p>
    </Shell>
  );
}

/** One understood fact as a tile: icon, label, value (or "not mentioned", muted). */
function Understood({ icon: Icon, label, value, wide }: { icon: LucideIcon; label: string; value?: string; wide?: boolean }) {
  return (
    <div className={cn("flex min-w-0 gap-2.5 rounded-lg border border-line px-3 py-2", value ? "bg-surface" : "bg-surface-2", wide && "sm:col-span-2")}>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", value ? "text-brand-800" : "text-ink-3")} />
      <div className="min-w-0">
        <dt className="text-xs text-ink-3">{label}</dt>
        <dd className={cn("break-words", value ? "font-medium text-ink" : "italic text-ink-3")}>{value ?? "not mentioned"}</dd>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Steps 2–6 for an existing workspace                                  */
/* ------------------------------------------------------------------ */

function WorkspaceOnboarding({ slug }: { slug: string }) {
  const state = useQuery(api.orgs.onboardingState, { slug });
  if (state === undefined) return <Shell step="research" slug={slug}><Skeleton className="h-72 w-full" /></Shell>;
  const research = state.research;
  const stopped = research && ["failed", "canceled", "uncertain"].includes(research.status);
  const step: Step =
    state.org.onboardingStep === "done"
      ? "done"
      : (!research && state.org.onboardingStep === "research") || (research && ["cost_reserved", "preparing", "executing"].includes(research.status))
        ? "research"
        : stopped && state.facts.length === 0 && state.org.onboardingStep === "research"
          ? "research"
          : state.org.onboardingStep === "research" || state.org.onboardingStep === "facts" || state.org.onboardingStep === "business"
            ? "facts"
            : (state.org.onboardingStep as Step);

  return (
    <Shell step={step === "done" ? "plan" : step} slug={slug}>
      {step === "research" && <ResearchStep slug={slug} state={state} />}
      {step === "facts" && <FactsStep key={(state.business?.successEvents ?? []).map((e) => e.key).join(",")} slug={slug} state={state} />}
      {step === "goal" && <GoalStep slug={slug} state={state} />}
      {step === "preferences" && <PreferencesStep slug={slug} current={state.autonomy} />}
      {(step === "plan" || step === "done") && <PlanStep slug={slug} state={state} />}
    </Shell>
  );
}

type State = NonNullable<ReturnType<typeof useQuery<typeof api.orgs.onboardingState>>>;

function ResearchStep({ slug, state }: { slug: string; state: State }) {
  const startResearch = useMutation(api.orgs.startResearch);
  const skipResearch = useMutation(api.orgs.skipResearch);
  const [ownerText, setOwnerText] = useState("");
  const [website, setWebsite] = useState(state.business?.website ?? "");
  const [busy, setBusy] = useState(false);
  const research = state.research;
  const failed = research ? ["failed", "canceled", "uncertain"].includes(research.status) : false;
  const v2 = research?.engine === "v2";
  if (!research) {
    // Research never started (e.g. the website was wrong or credits ran out): start it from here.
    const start = async () => {
      setBusy(true);
      try {
        await startResearch({ slug, website: website.trim() || undefined, ownerText: ownerText.trim() || undefined });
      } catch (e) {
        toast({ tone: "danger", title: errorMessage(e) });
      } finally {
        setBusy(false);
      }
    };
    return (
      <div>
        <h1 className="heading-page">Let’s get to know {state.business?.name ?? "your business"}</h1>
        {!state.canRunAi && state.accessMessage ? <Callout tone="warning" className="mt-4">{state.accessMessage}</Callout> : null}
        <Card className="mt-6">
          <CardContent className="space-y-4">
            <Field label="Website">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbusiness.com" inputMode="url" autoComplete="url" />
            </Field>
            <Field label="Or describe your business" optional>
              <Textarea value={ownerText} onChange={(e) => setOwnerText(e.target.value)} rows={4} autosize />
            </Field>
            <div className="flex flex-wrap gap-3">
              <Button loading={busy} loadingText="Starting…" disabled={!website.trim() && !ownerText.trim()} onClick={start}>
                Start
              </Button>
              <Button variant="ghost" onClick={() => skipResearch({ slug }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
                Add facts myself
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div>
      <h1 className="heading-page">
        {failed ? "We need a little help" : `Getting to know ${state.business?.name ?? "your business"}…`}
      </h1>
      {!failed ? (
        <>
          <p className="mt-1 text-sm text-ink-3">
            {v2 ? "About 5–10 min. Safe to leave." : "Under a minute."}
          </p>
          <Card className="mt-6">
            <CardContent>
              <RunProgress slug={slug} runId={research.id} headingLevel="h2" />
            </CardContent>
          </Card>
          {!state.canRunAi && state.accessMessage && <Callout tone="warning" className="mt-4">{state.accessMessage}</Callout>}
        </>
      ) : research?.failureKind === "ai_unavailable" ? (
        <>
          <Callout tone="warning" className="mt-4" title="AI temporarily unavailable">
            Nothing lost, nothing charged. Try again soon.
          </Callout>
          {research ? <RetryRunIfPossible slug={slug} runId={research.id} className="mt-4" /> : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await startResearch({ slug });
                } catch (e) {
                  toast({ tone: "danger", title: errorMessage(e) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Try again
            </Button>
            <Button variant="secondary" onClick={() => skipResearch({ slug }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
              Add facts myself
            </Button>
          </div>
        </>
      ) : (
        <>
          <Callout tone="warning" className="mt-4">{research?.userMessage ?? "We couldn’t finish reading your website."}</Callout>
          {research ? <RetryRunIfPossible slug={slug} runId={research.id} className="mt-4" /> : null}
          <Card className="mt-6">
            <CardContent className="space-y-4">
              <Field label="Describe your business" hint="What you sell, to whom, prices, what’s different.">
                <Textarea value={ownerText} onChange={(e) => setOwnerText(e.target.value)} rows={6} autosize />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await startResearch({ slug, ownerText });
                    } catch (e) {
                      toast({ tone: "danger", title: errorMessage(e) });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Use my description
                </Button>
                <Button variant="ghost" onClick={() => skipResearch({ slug }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
                  Add facts myself
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  product: "Product",
  audience: "Customers",
  pricing: "Pricing",
  brand: "Brand",
  offer: "Offer",
  proof: "Proof",
  competitor: "Competitor",
  other: "Other",
};

/** Facts in category order (product first), keeping their order within each group. */
function groupFacts<F extends { category: string }>(facts: F[]): [string, F[]][] {
  const order = Object.keys(CATEGORY_LABEL);
  const groups = new Map<string, F[]>();
  for (const f of facts) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);
  return [...groups.entries()].sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
}

function FactsStep({ slug, state }: { slug: string; state: State }) {
  const review = useMutation(api.orgs.reviewFact);
  const confirmAll = useMutation(api.orgs.confirmAllFacts);
  const addFact = useMutation(api.orgs.addFact);
  const saveDetails = useMutation(api.orgs.saveBusinessDetails);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newFact, setNewFact] = useState("");
  const [newCategory, setNewCategory] = useState<"product" | "audience" | "offer" | "pricing" | "brand" | "proof" | "other">("product");
  const [businessType, setBusinessType] = useState(state.business?.businessType ?? "other");
  const [currency, setCurrency] = useState(state.business?.currency ?? "USD");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState(state.business?.successEvents ?? []);

  return (
    <div>
      {state.facts.length === 0 || state.facts.every((f) => f.provenance === "owner_supplied") ? (
        <>
          <h1 className="heading-page">{state.facts.length === 0 ? "Tell us the key facts" : "Your key facts"}</h1>
          <p className="mt-1 text-sm text-ink-3">Tell us what you sell, who it is for, and anything customers should know.</p>
        </>
      ) : (
        <>
          <h1 className="heading-page">Is this right?</h1>
          {state.business?.summary ? <Scannable text={state.business.summary} tone="muted" max={3} className="mt-2" /> : null}
        </>
      )}
      {/* Facts grouped by what they're about, so each group can be checked at a glance. */}
      {groupFacts(state.facts).map(([category, facts]) => (
        <section key={category} aria-labelledby={`facts-${category}`} className="mt-6">
          <h2 id={`facts-${category}`} className="heading-card flex items-center gap-2">
            {CATEGORY_LABEL[category] ?? category}
            <span className="text-ui font-normal tabular-nums text-ink-3">{facts.length}</span>
          </h2>
          <ul className="mt-2 space-y-3">
            {facts.map((f) => (
              <li key={f.id}>
                <Card className={cn(f.reviewState === "needs_review" && "border-amber-800/25")}>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {f.provenance === "owner_supplied" ? <Badge tone="blue">From you</Badge> : f.provenance === "demo_fixture" ? <Badge tone="violet">Demo data</Badge> : <Badge tone="neutral">From website</Badge>}
                      {f.confidence === "low" && f.reviewState === "needs_review" && <Badge tone="amber">Please double-check</Badge>}
                      {f.reviewState === "confirmed" || f.reviewState === "edited" ? <Badge tone="green" icon={<Check />}>Confirmed</Badge> : null}
                    </div>
                    {editing === f.id ? (
                      <div className="mt-3 space-y-2">
                        <Field label="Fact">
                          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autosize />
                        </Field>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={async () => { try { await review({ slug, factId: f.id, action: "edit", statement: draft }); setEditing(null); } catch (e) { toast({ tone: "danger", title: errorMessage(e) }); } }}>Save</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-ink">{f.statement}</p>
                    )}
                    {f.sources.length > 0 && (
                      <p className="mt-2 text-xs text-ink-3">
                        Source:{" "}
                        {f.sources.map((s, i) =>
                          s && s.url ? (
                            <a key={i} href={s.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 underline underline-offset-2">
                              {s.title ?? new URL(s.url).hostname} <ExternalLink className="size-3" aria-hidden />
                              <span className="sr-only">(opens in a new tab)</span>
                            </a>
                          ) : (
                            <span key={i}>{s?.title ?? "your description"}</span>
                          ),
                        )}
                      </p>
                    )}
                    {editing !== f.id && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {f.reviewState === "needs_review" && (
                          <Button size="sm" variant="secondary" onClick={() => review({ slug, factId: f.id, action: "confirm" }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
                            <Check className="size-4" aria-hidden /> Correct
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(f.id); setDraft(f.statement); }}>
                          <Pencil className="size-4" aria-hidden /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => review({ slug, factId: f.id, action: "reject" }).catch((e) => toast({ tone: "danger", title: errorMessage(e) }))}>
                          <X className="size-4" aria-hidden /> Not true
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Card className="mt-6">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <Field label="Add a fact" className="flex-1">
            <Input value={newFact} onChange={(e) => setNewFact(e.target.value)} placeholder="e.g. We offer a 14-day free trial" />
          </Field>
          <Field label="About" className="sm:w-44">
            <Select
              value={newCategory}
              onValueChange={(v) => setNewCategory(v as typeof newCategory)}
              options={[
                { value: "product", label: "What we sell" },
                { value: "audience", label: "Who it’s for" },
                { value: "offer", label: "An offer" },
                { value: "pricing", label: "Pricing" },
                { value: "brand", label: "Our brand" },
                { value: "proof", label: "Proof (verifiable)" },
                { value: "other", label: "Something else" },
              ]}
            />
          </Field>
          <Button variant="secondary" onClick={async () => { if (!newFact.trim()) return; try { await addFact({ slug, category: newCategory, statement: newFact }); setNewFact(""); } catch (e) { toast({ tone: "danger", title: errorMessage(e) }); } }}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </CardContent>
      </Card>

      <h2 className="heading-section mt-8">About your business</h2>
      <Card className="mt-4">
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Type of business">
            <Select
              value={businessType}
              onValueChange={(v) => setBusinessType(v as typeof businessType)}
              options={BUSINESS_TYPE_OPTIONS}
            />
          </Field>
          <Field label="Currency">
            <Select value={currency} onValueChange={setCurrency} options={CURRENCY_OPTIONS} />
          </Field>
          <div className="sm:col-span-2">
            <p className="text-ui font-medium text-ink">What counts as success?</p>
            <p className="mt-0.5 text-xs text-ink-3">Untick any that don’t apply.</p>
            <ul className="mt-3 space-y-2">
              {events.map((ev, i) => (
                <li key={ev.key} className="rounded-xl border border-line px-3">
                  <Checkbox
                    id={`ev-${ev.key}`}
                    checked={ev.confirmed}
                    onCheckedChange={(c) => setEvents(events.map((x, j) => (j === i ? { ...x, confirmed: c === true } : x)))}
                    label={ev.label}
                    description={ev.definition}
                  />
                </li>
              ))}
              {events.length === 0 && (
                <li className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
                  None yet.
                  <Button size="sm" variant="secondary" onClick={() => setEvents(defaultEvents(businessType))}>
                    Use common ones
                  </Button>
                </li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await saveDetails({ slug, businessType: businessType as never, currency, timezone: state.business?.timezone ?? TIMEZONE, successEvents: events.map((e) => ({ ...e, confirmed: e.confirmed || events.length === 0 })) });
              await confirmAll({ slug });
            } catch (e) {
              toast({ tone: "danger", title: errorMessage(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Confirm details & continue
        </Button>
        <span className="text-xs text-ink-3">Continuing confirms all remaining details above. Correct or remove anything that is wrong first.</span>
      </div>
    </div>
  );
}

function GoalStep({ slug, state }: { slug: string; state: State }) {
  const setGoal = useMutation(api.orgs.setGoal);
  const intro = useMemo<ParsedIntro>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(`climbos:intro:${slug}`) ?? "{}") as ParsedIntro;
    } catch {
      return {};
    }
  }, [slug]);
  const [kind, setKind] = useState<"more_sales" | "more_customers" | "more_reach" | "custom">(state.goal?.kind ?? intro.goalKind ?? "more_customers");
  const [statement, setStatement] = useState(state.goal?.statement ?? intro.goalStatement ?? "");
  const [horizon, setHorizon] = useState(String(state.goal?.horizonDays ?? intro.horizonDays ?? 90));
  const [budget, setBudget] = useState(String(state.goal?.monthlyAdBudget ?? intro.monthlyAdBudget ?? 0));
  const [reviewDay, setReviewDay] = useState(state.goal?.reviewDay ?? intro.reviewDay ?? "Friday");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = state.business?.name ?? "your business";
  const defaults: Record<string, string> = goalDefaults(name);
  return (
    <div>
      <h1 className="heading-page">What would you like help with first?</h1>
      <p className="mt-2 text-sm text-ink-3">Choose the closest option. You can describe a different goal in your own words and change it later.</p>
      {error && <Callout tone="danger" className="mt-4">{error}</Callout>}
      <RadioCards
        className="mt-6"
        aria-label="Goal"
        value={kind}
        onValueChange={(v) => {
          setKind(v as typeof kind);
          if (!statement || Object.values(defaults).includes(statement)) setStatement(defaults[v] ?? "");
        }}
        options={GOAL_KIND_OPTIONS}
      />
      <Card className="mt-6">
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field label="Goal" className="sm:col-span-2">
            <Textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={2} autosize placeholder={defaults[kind]} />
          </Field>
          <Field label="When would you like to review progress?">
            <Select value={horizon} onValueChange={setHorizon} options={HORIZON_OPTIONS} />
          </Field>
          <Field label={`Most you want to spend on ads each month (${state.business?.currency ?? "USD"})`} hint="Advertising is optional. Enter 0 for no paid ads. This money goes to Google or Meta, separate from ClimbOS.">
            <Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          <Field label="Which day should we review your progress?">
            <Select value={reviewDay} onValueChange={setReviewDay} options={REVIEW_DAY_OPTIONS} />
          </Field>
        </CardContent>
      </Card>
      <Button
        size="lg"
        className="mt-8"
        loading={busy}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            await setGoal({ slug, kind, statement: statement || defaults[kind] || "Grow the business", horizonDays: Number(horizon), monthlyAdBudget: Number(budget || 0), reviewDay });
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Continue
      </Button>
    </div>
  );
}

function PreferencesStep({ slug, current }: { slug: string; current: string }) {
  const setAutonomy = useMutation(api.orgs.setAutonomy);
  const [mode, setMode] = useState(current);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <h1 className="heading-page">Who should publish or send the work?</h1>
      <p className="mt-2 text-sm text-ink-3">ClimbOS prepares the work. Choose how you want to check it before it goes ahead.</p>
      <RadioCards
        className="mt-6"
        columns={1}
        aria-label="Approval style"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "review", title: "Review first (recommended)", description: "You approve each post, email and ad.", icon: "✅" },
          { value: "copilot", title: "Draft only", description: "We prepare the work. You publish and send it yourself.", icon: "🧭" },
          { value: "bounded_autopilot", title: "Approved recurring work", description: "Repeat eligible work only within rules you approve. Needs a paid plan and an owner or admin.", icon: "🛟" },
        ]}
      />
      <Callout tone="info" className="mt-6" title="Always needs you">
        <ul className="mt-1 grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {["First posts", "New ads and audiences", "Budget raises", "Discounts", "Site changes"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <Check aria-hidden className="size-3.5 shrink-0" /> {t}
            </li>
          ))}
        </ul>
      </Callout>
      <Button
        size="lg"
        className="mt-8"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await setAutonomy({ slug, mode: mode as never });
          } catch (e) {
            const info = errorInfo(e);
            toast({ tone: "danger", title: info.message });
          } finally {
            setBusy(false);
          }
        }}
      >
        Continue
      </Button>
    </div>
  );
}

function PlanStep({ slug, state }: { slug: string; state: State }) {
  const generate = useMutation(api.orgs.generatePlan);
  const finish = useMutation(api.orgs.finishOnboarding);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = state.strategyRun;
  const running = Boolean(run && ["cost_reserved", "preparing", "executing"].includes(run.status));
  const ready = state.strategy && (state.strategy.status === "needs_approval" || state.strategy.status === "approved");
  // The last attempt ended without a plan to review: failed, canceled or unconfirmed.
  const stopped = Boolean(run && ["failed", "canceled", "uncertain"].includes(run.status) && !ready && !running);
  // The newest plan was sent back (or replaced) and nothing is building.
  const sentBack = Boolean(!ready && !running && !stopped && state.strategy && (state.strategy.status === "draft" || state.strategy.status === "superseded"));
  const canEdit = state.role === "owner" || state.role === "admin" || state.role === "editor";

  const ai = useAiMode(slug);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await generate({ slug, aiMode: ai.mode });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  /** Finish setup, then open a screen. */
  const leave = async (path: string) => {
    setLeaving(true);
    try {
      if (canEdit) await finish({ slug });
      router.push(`/app/${slug}/${path}`);
    } catch (e) {
      setError(errorMessage(e));
      setLeaving(false);
    }
  };
  const choosing = !state.strategy && !run && state.canRunAi;
  const heading = ready
    ? "Your growth plan is ready"
    : running || busy
      ? "Building your growth plan…"
      : stopped
        ? "Your plan isn’t ready yet"
        : sentBack
          ? "Your plan was sent back"
          : "Build your growth plan";

  return (
    <div>
      <h1 className="heading-page">{heading}</h1>
      {error && <Callout tone="danger" className="mt-4">{error}</Callout>}
      {(choosing || (!ready && !running && !stopped && !sentBack)) && !busy ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col gap-5">
            <p className="text-sm text-ink-3">Channels, plays and a 90-day plan.</p>
            {canEdit ? (
              <>
                <AiModePicker slug={slug} kind="strategy" value={ai.mode} onChange={ai.setMode} />
                <Button size="lg" className="self-start" disabled={!state.canRunAi} onClick={start}>
                  <Magic aria-hidden /> Build my plan
                </Button>
              </>
            ) : (
              <p className="text-sm text-ink-2">Needs an Owner, Admin or Editor.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
      {!state.canRunAi && !ready && state.accessMessage && (
        <Callout tone="warning" className="mt-4" title="Free allowance used up">
          {state.accessMessage}
          <div className="mt-3">
            <Button asChild><Link href={`/app/${slug}/settings/billing`}>Choose a plan</Link></Button>
          </div>
        </Callout>
      )}
      {!ready && (running || busy) && (
        <>
          <p className="mt-1 text-sm text-ink-3">About 10–15 min. Safe to leave.</p>
          <Card className="mt-6">
            <CardContent>
              {run?.id && running ? (
                <RunProgress slug={slug} runId={run.id} headingLevel="h2" />
              ) : (
                <p className="text-sm text-ink-3" aria-live="polite">
                  Starting…
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
      {ready && state.firstWinRunIds?.length ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col gap-3">
            <p className="heading-card">First posts and welcome email drafting</p>
            {state.firstWinRunIds.map((id) => (
              <RunProgressCompact key={id} slug={slug} runId={id} />
            ))}
          </CardContent>
        </Card>
      ) : null}
      {(stopped || sentBack) && !busy && (
        <Callout tone={stopped ? "danger" : "warning"} className="mt-6" title={stopped ? "Plan didn't finish" : "Plan sent back"}>
          {stopped ? (run?.userMessage ?? (run?.status === "canceled" ? "Canceled before it finished." : "Something went wrong.")) : "Build a new version."}
          <div className="mt-3 flex flex-wrap gap-3">
            {stopped && run?.id ? <RetryRunIfPossible slug={slug} runId={run.id} /> : null}
            {canEdit ? (
              <Button variant="secondary" loading={busy} loadingText="Starting…" disabled={!state.canRunAi} onClick={start}>
                {stopped ? "Start over" : "Build again"}
              </Button>
            ) : null}
            <Button variant="secondary" loading={leaving} onClick={() => leave("today")}>
              Go to Today
            </Button>
          </div>
        </Callout>
      )}
      {ready && (
        <>
          <p className="text-trust mt-1">Nothing goes live without you.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" loading={leaving} onClick={() => leave("plan")}>
              See plan
            </Button>
            <Button size="lg" variant="secondary" disabled={leaving} onClick={() => leave("today")}>
              Go to Today
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
