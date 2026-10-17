"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Check, ExternalLink, MessageSquareText, Pencil, Plus, ListChecks, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  Field,
  Input,
  RadioCards,
  Select,
  Skeleton,
  StepList,
  Textarea,
  toast,
  Toaster,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { errorInfo, errorMessage } from "../errors";
import { ROLE_META } from "../roles";
import { parseIntro, type ParsedIntro } from "./parseIntro";

type Step = "business" | "research" | "facts" | "goal" | "preferences" | "plan" | "done";
const STEP_ORDER: Step[] = ["business", "research", "facts", "goal", "preferences", "plan"];
const STEP_LABEL: Record<Step, string> = {
  business: "Your business",
  research: "Understanding it",
  facts: "Check the facts",
  goal: "Your goal",
  preferences: "How you approve",
  plan: "Your plan",
  done: "Done",
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
    const unfinished = me.orgs.find((o) => o.kind === "customer" && o.onboardingStep !== "done");
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
        <Callout tone="info" title="Create a free account to save your business">
          You're browsing as a guest (demo). Sign in with your email to set up your own workspace.
          <div className="mt-3">
            <Button asChild>
              <Link href="/sign-in?switch=1&next=/onboarding">Create a free account</Link>
            </Button>
          </div>
        </Callout>
      </Shell>
    );
  }
  if (!slug) {
    return (
      <BusinessStep
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
  return (
    <div className="min-h-dvh bg-bg">
      <Toaster />
      <header className="border-b border-line bg-surface/70">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Logo />
          {slug ? (
            <Link href={`/app/${slug}/today`} className="text-sm font-medium text-ink-2 underline-offset-2 hover:underline">
              Save and finish later
            </Link>
          ) : null}
        </div>
        <ol className="mx-auto flex max-w-3xl gap-1.5 px-4 pb-4" aria-label="Setup progress">
          {STEP_ORDER.map((s, i) => (
            <li key={s} className="flex-1">
              <span className={cn("block h-1.5 rounded-full", i < idx ? "bg-green-700" : i === idx ? "bg-green-600" : "bg-surface-3")} aria-hidden />
              <span className="sr-only">
                {STEP_LABEL[s]}: {i < idx ? "done" : i === idx ? "current step" : "not started"}
              </span>
            </li>
          ))}
        </ol>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        <p className="text-sm font-medium text-green-800">
          Step {idx + 1} of {STEP_ORDER.length} · {STEP_LABEL[step]}
        </p>
        <div className="mt-2">{children}</div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1: business (chat or checklist)                                 */
/* ------------------------------------------------------------------ */

function BusinessStep({
  prefillWebsite,
  prefillGoal,
  previewToken,
  onCreated,
}: {
  prefillWebsite: string;
  prefillGoal: string;
  previewToken: string | null;
  onCreated: (slug: string) => void;
}) {
  const [mode, setMode] = useState<"chat" | "form">("chat");
  const [chat, setChat] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState(prefillWebsite);
  const [noWebsite, setNoWebsite] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useMutation(api.orgs.createWorkspace);
  const startResearch = useMutation(api.orgs.startResearch);
  const claim = useMutation(api.preview.claim);

  useEffect(() => {
    if (prefillWebsite) {
      setWebsite(prefillWebsite);
      setMode("form");
    }
  }, [prefillWebsite]);

  const parsed: ParsedIntro = useMemo(() => parseIntro(chat), [chat]);

  async function submit(fields: { name: string; website?: string; ownerText?: string; parsed?: ParsedIntro }) {
    setError(null);
    if (!fields.name.trim()) {
      setError("Please tell us your business name.");
      return;
    }
    if (!fields.website && !fields.ownerText) {
      setError("Add your website, or describe your business in a few sentences.");
      return;
    }
    setBusy(true);
    try {
      const { slug, orgId } = await create({ businessName: fields.name, website: fields.website, timezone: TIMEZONE });
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
      await startResearch({ slug, website: fields.website, ownerText: fields.ownerText });
      onCreated(slug);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Shell step="business">
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">Let's meet your business</h1>
      <p className="mt-3 max-w-xl text-lg text-ink-2">
        Your AI growth team starts by reading your website. You'll check everything before it's used.
      </p>

      <div className="mt-6 inline-flex rounded-[12px] border border-line bg-surface p-1" role="tablist" aria-label="How do you want to start?">
        <button role="tab" aria-selected={mode === "chat"} onClick={() => setMode("chat")} className={cn("flex min-h-10 items-center gap-2 rounded-[9px] px-3 text-sm font-medium", mode === "chat" ? "bg-green-800 text-white" : "text-ink-2")}>
          <MessageSquareText className="size-4" aria-hidden /> Just tell us
        </button>
        <button role="tab" aria-selected={mode === "form"} onClick={() => setMode("form")} className={cn("flex min-h-10 items-center gap-2 rounded-[9px] px-3 text-sm font-medium", mode === "form" ? "bg-green-800 text-white" : "text-ink-2")}>
          <ListChecks className="size-4" aria-hidden /> Step by step
        </button>
      </div>

      {error && <Callout tone="danger" className="mt-6">{error}</Callout>}

      {mode === "chat" ? (
        <Card className="mt-6">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <Field label="Tell us about your business and what you want" hint='For example: "We are Formkit (formkit.app). Help us get more paying customers in the next 90 days. I can spend $600 a month on ads and review content on Fridays."'>
              <Textarea value={chat} onChange={(e) => setChat(e.target.value)} rows={5} autosize placeholder="Type a few sentences…" />
            </Field>
            {chat.trim().length > 8 && (
              <div className="rounded-[12px] border border-line bg-surface-2 p-4 text-sm" aria-live="polite">
                <p className="font-medium text-ink">Here's what we understood (you can change all of it later):</p>
                <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                  <Understood label="Business" value={parsed.businessName} />
                  <Understood label="Website" value={parsed.website} />
                  <Understood label="Goal" value={parsed.goalStatement} />
                  <Understood label="Ad budget" value={parsed.monthlyAdBudget !== undefined ? `$${parsed.monthlyAdBudget.toLocaleString()} / month` : undefined} />
                  <Understood label="Time frame" value={parsed.horizonDays ? `${parsed.horizonDays} days` : undefined} />
                  <Understood label="Review day" value={parsed.reviewDay} />
                </dl>
                {!parsed.businessName && (
                  <Field label="Business name" className="mt-3">
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Formkit" />
                  </Field>
                )}
              </div>
            )}
            <Button
              size="lg"
              loading={busy}
              loadingText="Setting up your team…"
              onClick={() =>
                submit({
                  name: parsed.businessName ?? name,
                  website: parsed.website,
                  ownerText: parsed.website ? undefined : chat,
                  parsed,
                })
              }
            >
              <Sparkles className="size-5" aria-hidden /> Start
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="mt-6">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <Field label="Business name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Formkit" autoComplete="organization" />
            </Field>
            {!noWebsite ? (
              <Field label="Website" hint="We read a few public pages (like your homepage and pricing). We respect sites that ask robots not to read them.">
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="yourbusiness.com" inputMode="url" autoComplete="url" />
              </Field>
            ) : (
              <Field label="Describe your business" hint="What you sell, who buys it, and anything that makes you different. We'll mark this as information you supplied.">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} autosize />
              </Field>
            )}
            <button type="button" className="text-sm font-medium text-green-800 underline underline-offset-2" onClick={() => setNoWebsite((v) => !v)}>
              {noWebsite ? "I have a website after all" : "No website, or it's private? Describe your business instead"}
            </button>
            <div>
              <Button size="lg" loading={busy} loadingText="Setting up your team…" onClick={() => submit({ name, website: noWebsite ? undefined : website, ownerText: noWebsite ? description : undefined })}>
                Continue
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <p className="mt-6 text-sm text-ink-3">
        Want to look around first? <Link href="/demo" className="font-semibold text-green-800 underline underline-offset-2">Open the Formkit demo</Link>
      </p>
    </Shell>
  );
}

function Understood({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-ink-3">{label}:</dt>
      <dd className={value ? "text-ink" : "text-ink-3 italic"}>{value ?? "not mentioned"}</dd>
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
  const step: Step =
    state.org.onboardingStep === "done"
      ? "done"
      : !research || ["cost_reserved", "preparing", "executing"].includes(research.status)
        ? "research"
        : research.status === "failed" && state.facts.length === 0
          ? "research"
          : state.org.onboardingStep === "research" || state.org.onboardingStep === "facts" || state.org.onboardingStep === "business"
            ? "facts"
            : (state.org.onboardingStep as Step);

  return (
    <Shell step={step === "done" ? "plan" : step} slug={slug}>
      {step === "research" && <ResearchStep slug={slug} state={state} />}
      {step === "facts" && <FactsStep slug={slug} state={state} />}
      {step === "goal" && <GoalStep slug={slug} state={state} />}
      {step === "preferences" && <PreferencesStep slug={slug} current={state.autonomy} />}
      {(step === "plan" || step === "done") && <PlanStep slug={slug} state={state} />}
    </Shell>
  );
}

type State = NonNullable<ReturnType<typeof useQuery<typeof api.orgs.onboardingState>>>;

function ResearchStep({ slug, state }: { slug: string; state: State }) {
  const startResearch = useMutation(api.orgs.startResearch);
  const [ownerText, setOwnerText] = useState("");
  const [busy, setBusy] = useState(false);
  const research = state.research;
  const failed = research?.status === "failed";
  const steps = [
    { key: "read", label: "Reading your website", match: "Read your website" },
    { key: "profile", label: `${ROLE_META.data_analyst.emoji} ${ROLE_META.data_analyst.title} is pulling out the facts`, match: "Understand the business" },
    { key: "insights", label: `${ROLE_META.cmo.emoji} ${ROLE_META.cmo.title} is studying your customers and competitors`, match: "Business insights" },
  ].map((s) => {
    const st = research?.steps.find((x) => x.label === s.match);
    const status = st ? (st.status === "succeeded" ? "done" : st.status === "running" ? "running" : st.status === "failed" ? "failed" : "pending") : "pending";
    return { key: s.key, label: s.label, status: status as "pending" | "running" | "done" | "failed" };
  });
  return (
    <div>
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
        {failed ? "We need a little help" : `Getting to know ${state.business?.name ?? "your business"}…`}
      </h1>
      {!failed ? (
        <>
          <p className="mt-3 text-lg text-ink-2">This usually takes under a minute. You'll check everything before anything is used.</p>
          <Card className="mt-6">
            <CardContent className="p-6" aria-live="polite">
              <StepList steps={steps} />
            </CardContent>
          </Card>
          {!state.canRunAi && state.accessMessage && <Callout tone="warning" className="mt-4">{state.accessMessage}</Callout>}
        </>
      ) : (
        <>
          <Callout tone="warning" className="mt-4">{research?.userMessage ?? "We couldn't finish reading your website."}</Callout>
          <Card className="mt-6">
            <CardContent className="space-y-4 p-6">
              <Field label="Describe your business in a few sentences" hint="What you sell, who buys it, prices if you're happy to share, and what makes you different. We'll label these facts as supplied by you.">
                <Textarea value={ownerText} onChange={(e) => setOwnerText(e.target.value)} rows={6} autosize />
              </Field>
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
                Continue with my description
              </Button>
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

function FactsStep({ slug, state }: { slug: string; state: State }) {
  const review = useMutation(api.orgs.reviewFact);
  const confirmAll = useMutation(api.orgs.confirmAllFacts);
  const addFact = useMutation(api.orgs.addFact);
  const saveDetails = useMutation(api.orgs.saveBusinessDetails);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newFact, setNewFact] = useState("");
  const [businessType, setBusinessType] = useState(state.business?.businessType ?? "other");
  const [currency, setCurrency] = useState(state.business?.currency ?? "USD");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState(state.business?.successEvents ?? []);
  useEffect(() => setEvents(state.business?.successEvents ?? []), [state.business?.successEvents]);

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">Is this right?</h1>
      <p className="mt-3 text-lg text-ink-2">
        {state.business?.summary ?? "Here's what we found."} Fix anything that's wrong. Only confirmed facts are used in your content.
      </p>
      <ul className="mt-6 space-y-3">
        {state.facts.map((f) => (
          <li key={f.id}>
            <Card className={cn(f.reviewState === "needs_review" && "border-amber-800/25")}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone="neutral">{CATEGORY_LABEL[f.category] ?? f.category}</Badge>
                  {f.provenance === "owner_supplied" ? <Badge tone="blue">Supplied by you</Badge> : f.provenance === "demo_fixture" ? <Badge tone="violet">Demo data</Badge> : <Badge tone="neutral">From your website</Badge>}
                  {f.confidence === "low" && f.reviewState === "needs_review" && <Badge tone="amber">Low confidence — please check</Badge>}
                  {f.reviewState === "confirmed" || f.reviewState === "edited" ? <Badge tone="green" icon={<Check />}>Confirmed</Badge> : null}
                </div>
                {editing === f.id ? (
                  <div className="mt-3 space-y-2">
                    <Field label="Edit this fact">
                      <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} autosize />
                    </Field>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={async () => { try { await review({ slug, factId: f.id, action: "edit", statement: draft }); setEditing(null); } catch (e) { toast({ tone: "danger", title: errorMessage(e) }); } }}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-[17px] leading-relaxed text-ink">{f.statement}</p>
                )}
                {f.sources.length > 0 && (
                  <p className="mt-2 text-sm text-ink-3">
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
      <Card className="mt-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <Field label="Add something we missed" className="flex-1">
            <Input value={newFact} onChange={(e) => setNewFact(e.target.value)} placeholder="e.g. We offer a 14-day free trial" />
          </Field>
          <Button variant="secondary" onClick={async () => { if (!newFact.trim()) return; try { await addFact({ slug, category: "other", statement: newFact }); setNewFact(""); } catch (e) { toast({ tone: "danger", title: errorMessage(e) }); } }}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </CardContent>
      </Card>

      <h2 className="mt-10 font-display text-2xl text-ink">A few details</h2>
      <Card className="mt-4">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Type of business">
            <Select
              value={businessType}
              onValueChange={(v) => setBusinessType(v as typeof businessType)}
              options={[
                { value: "saas", label: "Software / app (subscriptions)" },
                { value: "ecommerce", label: "Online store" },
                { value: "services", label: "Services (bookings, clients)" },
                { value: "physical_products", label: "Physical products" },
                { value: "other", label: "Something else" },
              ]}
            />
          </Field>
          <Field label="Currency" hint="Used for budgets and results.">
            <Select value={currency} onValueChange={setCurrency} options={["USD", "EUR", "GBP", "CAD", "AUD", "INR", "SGD", "AED"].map((c) => ({ value: c, label: c }))} />
          </Field>
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-ink">What counts as a valuable customer action?</p>
            <p className="text-sm text-ink-3">We'll measure success with these. Untick anything that doesn't apply. Times use {state.business?.timezone ?? TIMEZONE}.</p>
            <ul className="mt-3 space-y-2">
              {events.map((ev, i) => (
                <li key={ev.key} className="flex items-start gap-3 rounded-[10px] border border-line p-3">
                  <input
                    id={`ev-${ev.key}`}
                    type="checkbox"
                    className="mt-1 size-5 accent-green-800"
                    checked={ev.confirmed}
                    onChange={(e) => setEvents(events.map((x, j) => (j === i ? { ...x, confirmed: e.target.checked } : x)))}
                  />
                  <label htmlFor={`ev-${ev.key}`} className="text-sm">
                    <span className="font-medium text-ink">{ev.label}</span> — <span className="text-ink-2">{ev.definition}</span>
                  </label>
                </li>
              ))}
              {events.length === 0 && <li className="text-sm text-ink-3">We'll suggest these once research finishes. You can add them later in Settings.</li>}
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
          Looks right — continue
        </Button>
        <span className="text-sm text-ink-3">Any facts still unchecked will be marked as confirmed.</span>
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
  const defaults: Record<string, string> = {
    more_customers: `Help ${name} get more paying customers.`,
    more_sales: `Help ${name} sell more to the right people.`,
    more_reach: `Help more of the right people discover ${name}.`,
    custom: "",
  };
  return (
    <div>
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">What would you like to achieve?</h1>
      <p className="mt-3 text-lg text-ink-2">Pick one to start. You can change it anytime.</p>
      {error && <Callout tone="danger" className="mt-4">{error}</Callout>}
      <RadioCards
        className="mt-6"
        aria-label="Goal"
        value={kind}
        onValueChange={(v) => {
          setKind(v as typeof kind);
          if (!statement || Object.values(defaults).includes(statement)) setStatement(defaults[v] ?? "");
        }}
        options={[
          { value: "more_customers", title: "More customers", description: "New people signing up or buying", icon: "🙋" },
          { value: "more_sales", title: "More sales", description: "More revenue, including from existing customers", icon: "💰" },
          { value: "more_reach", title: "More reach", description: "More of the right people knowing you exist", icon: "📣" },
          { value: "custom", title: "Something else", description: "Describe it in your own words", icon: "✏️" },
        ]}
      />
      <Card className="mt-6">
        <CardContent className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Your goal in a sentence" className="sm:col-span-2">
            <Textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={2} autosize placeholder={defaults[kind]} />
          </Field>
          <Field label="Time frame">
            <Select value={horizon} onValueChange={setHorizon} options={[{ value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "90", label: "90 days" }, { value: "180", label: "6 months" }, { value: "365", label: "1 year" }]} />
          </Field>
          <Field label={`Monthly ad budget (${state.business?.currency ?? "USD"})`} hint="Paid directly to Google or Meta, never to ClimbOS. 0 means no ads. Ads always need your approval.">
            <Input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          <Field label="When do you like to review work?" hint="We'll have drafts ready before then.">
            <Select value={reviewDay} onValueChange={setReviewDay} options={["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((d) => ({ value: d, label: d }))} />
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
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">How hands-on do you want to be?</h1>
      <p className="mt-3 text-lg text-ink-2">Whatever you choose, nothing goes live, gets sent or spends money without the safeguards below.</p>
      <RadioCards
        className="mt-6"
        columns={1}
        aria-label="Approval style"
        value={mode}
        onValueChange={setMode}
        options={[
          { value: "review", title: "Review before anything goes live (recommended)", description: "Your team drafts everything. You approve each post, email and ad before it goes out.", icon: "✅" },
          { value: "copilot", title: "Copilot", description: "Your team drafts and suggests. You publish and send everything yourself.", icon: "🧭" },
          { value: "bounded_autopilot", title: "Bounded Autopilot", description: "Only work you've pre-approved (for example a weekly post calendar) runs within the accounts, times and budget you set. New channels, audiences, ads and budget increases still come to you. Available on Growth and above.", icon: "🛟" },
        ]}
      />
      <Callout tone="info" className="mt-6" title="Always your call">
        The first post on any channel, new ads, new audiences, budget increases, discounts and website changes always need your approval. You can press <strong>Pause all activity</strong> at any time.
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
  const [error, setError] = useState<string | null>(null);
  const run = state.strategyRun;
  const running = run && ["cost_reserved", "preparing", "executing"].includes(run.status);
  const ready = state.strategy && (state.strategy.status === "needs_approval" || state.strategy.status === "approved");

  const started = useRef(false);
  useEffect(() => {
    if (started.current || state.strategy || state.strategyRun || !state.canRunAi) return;
    started.current = true;
    setBusy(true);
    generate({ slug })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setBusy(false));
  }, [state.strategy, state.strategyRun, generate, slug, state.canRunAi]);

  return (
    <div>
      <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">{ready ? "Your growth plan is ready" : "Building your growth plan…"}</h1>
      {error && <Callout tone="danger" className="mt-4">{error}</Callout>}
      {!state.canRunAi && !ready && state.accessMessage && (
        <Callout tone="warning" className="mt-4" title="Your free starter allowance is used up">
          {state.accessMessage}
          <div className="mt-3">
            <Button asChild><Link href={`/app/${slug}/settings/billing`}>Choose a plan</Link></Button>
          </div>
        </Callout>
      )}
      {!ready && (running || busy) && (
        <Card className="mt-6">
          <CardContent className="p-6" aria-live="polite">
            <StepList
              steps={[
                { key: "ceo", label: `${ROLE_META.ceo.emoji} ${ROLE_META.ceo.title} is setting priorities for your goal`, status: "running" },
                { key: "cmo", label: `${ROLE_META.cmo.emoji} ${ROLE_META.cmo.title} is choosing channels and experiments`, status: "pending" },
                { key: "costs", label: "Estimating costs and how we'll measure it", status: "pending" },
              ]}
            />
          </CardContent>
        </Card>
      )}
      {run?.status === "failed" && !ready && (
        <Callout tone="danger" className="mt-6" title="The plan didn't finish">
          {run.userMessage ?? "Something went wrong."}
          <div className="mt-3">
            <Button onClick={() => generate({ slug }).catch((e) => setError(errorMessage(e)))}>Try again</Button>
          </div>
        </Callout>
      )}
      {ready && (
        <>
          <p className="mt-3 text-lg text-ink-2">Review it, approve it, and your team gets to work. Nothing goes live without you.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={async () => {
                await finish({ slug });
                router.push(`/app/${slug}/plan`);
              }}
            >
              See my plan
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={async () => {
                await finish({ slug });
                router.push(`/app/${slug}/today`);
              }}
            >
              Go to Today
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
