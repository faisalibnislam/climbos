"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams } from "next/navigation";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { RefreshCw, Search } from "@/components/icons";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Button, Callout, Card, CardContent, DatePicker, EmptyState, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { useWorkspaceMember } from "@/components/app/content/shared";
import { can } from "@shared/policy";
import { searchConsolePropertyMatchesWebsite } from "@shared/integrations/searchConsole";
import { planAiSearchQueries } from "@shared/aiSearch/queryPlanner";
import { AI_DATA_USE_CONTROLS } from "@shared/seo/readiness";

export default function SearchReadinessPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.siteWatch.searchReadiness, { slug });
  const scan = useMutation(api.siteWatch.scanSearchReadiness);
  const updateFinding = useMutation(api.seoOpportunities.updateFindingState);
  const member = useWorkspaceMember(slug);
  const canEdit = Boolean(member?.role && can(member.role, "edit"));
  const [savingFinding, setSavingFinding] = useState("");
  if (data === undefined) return <LoadingBlock label="Loading search readiness" lines={4} />;
  if (data === null) return <p className="text-sm text-ink-3">Finish onboarding first.</p>;
  const current = data.scan;
  const searchCrawlerChecks = current?.crawlerChecks?.filter((item) => !AI_DATA_USE_CONTROLS.includes(item.crawler as typeof AI_DATA_USE_CONTROLS[number])) ?? [];
  const dataUseChecks = current?.crawlerChecks?.filter((item) => AI_DATA_USE_CONTROLS.includes(item.crawler as typeof AI_DATA_USE_CONTROLS[number])) ?? [];
  const run = () => scan({ slug }).then(() => toast({ tone: "success", title: "Homepage check started" }), (error) => toast({ tone: "danger", title: errorMessage(error) }));
  const changeFindingState = async (runId: string, pageUrl: string, findingId: string, state: "open" | "addressed" | "not_relevant") => {
    const key = `${runId}:${pageUrl}:${findingId}`;
    setSavingFinding(key);
    try {
      await updateFinding({ slug, runId: runId as Id<"workflowRuns">, pageUrl, findingId, state });
      toast({ tone: "success", title: state === "open" ? "Finding reopened" : state === "addressed" ? "Marked addressed" : "Marked not relevant", description: "This is your report. A later website review can check the page again." });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally { setSavingFinding(""); }
  };
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        section="search readiness"
        title="Search readiness"
        intro="Check what search tools and answer systems can read from your homepage."
        actions={data.website && canEdit ? <Button size="sm" variant="secondary" loading={current?.status === "queued"} disabled={current?.status === "queued"} onClick={run}><RefreshCw aria-hidden /> Check homepage</Button> : null}
      />
      <Callout tone="info">Google’s AI search features use the same core search eligibility signals; there is no special markup that guarantees AI citations. These checks read the homepage and robots.txt rules only. They cannot verify indexing, firewall access, rankings, or AI citations.</Callout>
      {!data.website ? (
        <EmptyState icon={<Search />} title="Add your website first" body={<span>Set your business website in <a className="underline underline-offset-2" href={`/app/${slug}/settings/facts`}>Business facts</a>, then run a homepage check.</span>} />
      ) : !current ? (
        <EmptyState icon={<Search />} title="No homepage check yet" body="Run a check to see specific page details and practical next steps." action={canEdit ? <Button onClick={run}><Search aria-hidden /> Check homepage</Button> : undefined} />
      ) : current.status === "queued" ? (
        <Card><CardContent className="flex flex-col gap-2"><h2 className="heading-card">Reading your homepage</h2><p className="text-sm text-ink-2">This usually takes a few seconds. You can stay on this page while the result updates.</p></CardContent></Card>
      ) : current.status === "failed" ? (
        <Card><CardContent className="flex flex-col gap-2"><h2 className="heading-card">We couldn’t read this page</h2><p className="text-sm text-ink-2">{current.error ?? "The homepage could not be checked."}</p>{current.checkedAt ? <p className="text-xs text-ink-3">Attempted {relativeTime(current.checkedAt)}.</p> : null}</CardContent></Card>
      ) : (
        <>
          <Card><CardContent className="flex flex-col gap-2">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="heading-card">Homepage details</h2><a href={current.pageUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-ink-3 underline underline-offset-2">{current.pageUrl}</a></div><p className="shrink-0 text-xs text-ink-3">Checked {current.checkedAt ? relativeTime(current.checkedAt) : "recently"}</p></div>
            <dl className="grid gap-3 pt-2 text-sm sm:grid-cols-2"><div><dt className="text-xs text-ink-3">Page title</dt><dd className="text-ink-2">{current.pageTitle || "Not found"}</dd></div><div><dt className="text-xs text-ink-3">Search description</dt><dd className="text-ink-2">{current.description || "Not found"}</dd></div><div><dt className="text-xs text-ink-3">Headings extracted</dt><dd className="text-ink-2">{current.headingCount ?? 0}</dd></div><div><dt className="text-xs text-ink-3">Structured data types</dt><dd className="text-ink-2">{current.structuredDataTypes?.length ? current.structuredDataTypes.join(", ") : "None detected"}</dd></div><div><dt className="text-xs text-ink-3">Homepage response</dt><dd className="text-ink-2">{current.httpStatus ? `HTTP ${current.httpStatus}` : "Not recorded"}</dd></div><div><dt className="text-xs text-ink-3">Canonical URL</dt><dd className="break-all text-ink-2">{current.canonicalUrl || "Not declared"}</dd></div></dl>
          </CardContent></Card>
          <Card><CardContent className="flex flex-col gap-3">
            <div><h2 className="heading-card">Crawler access signals</h2><p className="mt-1 text-sm text-ink-3">ClimbOS checked the homepage path against the site’s published robots.txt rules.</p></div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-ink-3">robots.txt</dt><dd className="text-ink-2">{current.robotsFileStatus === "available" ? "Retrieved" : current.robotsFileStatus === "not_found" ? "Not found (no published rules at this address)" : "Could not verify"}</dd></div></dl>
            <div><h3 className="text-xs font-semibold text-ink">Search crawler access</h3><dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">{searchCrawlerChecks.map((item) => <div key={item.crawler}><dt className="text-xs text-ink-3">{item.crawler}</dt><dd className="text-ink-2">{current.robotsFileStatus === "unavailable" ? "Unknown" : item.allowed ? "Allowed by robots.txt for homepage" : "Disallowed by robots.txt for homepage"}</dd></div>)}</dl><p className="mt-2 text-xs text-ink-3">Access is only one prerequisite. It does not establish that a provider will crawl, index, or cite the page.</p></div>
            {dataUseChecks.length ? <div><h3 className="text-xs font-semibold text-ink">AI model data-use controls</h3><dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">{dataUseChecks.map((item) => <div key={item.crawler}><dt className="text-xs text-ink-3">{item.crawler}</dt><dd className="text-ink-2">{current.robotsFileStatus === "unavailable" ? "Unknown" : item.allowed ? "Allowed by robots.txt for homepage" : "Disallowed by robots.txt for homepage"}</dd></div>)}</dl><p className="mt-2 text-xs text-ink-3">These provider directives describe data use, not ordinary search visibility. Google-Extended affects some Gemini model training and grounding controls; it does not control Google Search or AI Overviews.</p></div> : null}
            <p className="text-xs text-ink-3">Robots.txt checks do not test firewall rules or actual crawler requests. User initiated fetchers are not represented as general search crawlers.</p>
          </CardContent></Card>
          <section className="flex flex-col gap-3"><div><h2 className="heading-card">What to review</h2><p className="mt-1 text-sm text-ink-3">These checks describe this page only; they are not ranking or citation predictions.</p></div>
            {current.findings?.length ? <ul className="flex flex-col gap-3">{current.findings.map((finding) => <li key={finding.id}><Card><CardContent className="flex flex-col gap-2"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-ink">{finding.title}</h3><span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-3">{finding.level === "attention" ? "Needs attention" : "Review"}</span></div><p className="text-sm text-ink-2">{finding.evidence}</p><p className="text-sm"><span className="font-medium text-ink">Next step: </span><span className="text-ink-2">{finding.nextStep}</span></p></CardContent></Card></li>)}</ul> : <EmptyState icon={<Search />} title="No obvious issues found" body="The checks we ran found a title, description, main heading, readable text, and structured data. This does not guarantee rankings or citations." />}
          </section>
        </>
      )}
      <section className="flex flex-col gap-3">
        <div><h2 className="heading-card">SEO review queue and page inventory</h2><p className="mt-1 text-sm text-ink-3">Page-level details from recent website reviews are saved here. “Needs attention” findings appear before “Review” checks; this reflects the observed check severity, not predicted ranking or traffic impact.</p></div>
        {data.inventory?.length ? data.inventory.map((audit) => (
          <Card key={audit.runId}><CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-semibold text-ink">{audit.pagesRead} pages read · {audit.discoveredCandidates} same-site candidates discovered</h3><p className="mt-1 break-all text-xs text-ink-3">{audit.website}</p></div><span className="shrink-0 text-xs text-ink-3">Reviewed {relativeTime(audit.checkedAt)}</span></div>
            <p className="text-xs text-ink-3">Static HTML metadata observed on {audit.pagesWithStaticHtml} of {audit.pagesSampled} sampled pages. Discovery and sampling do not prove indexing, rankings, or coverage of every site page.</p>
            {audit.pages.length ? <ul className="flex flex-col gap-2">{audit.pages.map((page) => (
              <li key={`${audit.runId}:${page.url}`} className="rounded-lg bg-surface-2 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><a href={page.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-medium text-link">{page.url}</a><p className="mt-1 text-xs text-ink-3">{page.status === "read" ? page.metadataState === "observed" ? "Page read · static HTML observed" : "Page read · static HTML unavailable" : page.status === "blocked_by_robots" ? "Not read · blocked by robots.txt" : "Page read failed"}</p></div><span className="shrink-0 text-xs text-ink-3">{page.findings.length} check{page.findings.length === 1 ? "" : "s"}</span></div>
                {page.metadataState === "observed" ? <p className="mt-2 text-xs text-ink-2">Title: {page.titleLength ?? "not observed"} chars · Description: {page.descriptionLength ?? "not observed"} chars · H1/H2/H3: {page.headingCounts ? `${page.headingCounts.h1}/${page.headingCounts.h2}/${page.headingCounts.h3}` : "not observed"}{page.structuredDataTypes?.length ? ` · Structured data: ${page.structuredDataTypes.join(", ")}` : ""}</p> : null}
                {page.findings.length ? <ul className="mt-2 flex flex-col gap-2">{[...page.findings].sort((a, b) => Number(b.level === "attention") - Number(a.level === "attention")).map((finding, index) => {
                  const key = `${audit.runId}:${page.url}:${finding.id}`;
                  return <li key={`${finding.id}:${index}`} className="border-l-2 border-line pl-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-ink">{finding.title} · {finding.level === "attention" ? "Needs attention" : "Review"}</p>{finding.state !== "open" ? <span className="text-xs text-ink-3">Owner-reported: {finding.state === "addressed" ? "addressed" : "not relevant"}</span> : null}</div>
                    <p className="mt-0.5 text-xs text-ink-3">{finding.evidence} Next step: {finding.nextStep}</p>
                    {canEdit ? <div className="mt-2 flex flex-wrap gap-2">{finding.state === "open" ? <><Button size="sm" variant="secondary" loading={savingFinding === key} disabled={Boolean(savingFinding)} onClick={() => void changeFindingState(audit.runId, page.url, finding.id, "addressed")}>Mark addressed</Button><Button size="sm" variant="ghost" loading={savingFinding === key} disabled={Boolean(savingFinding)} onClick={() => void changeFindingState(audit.runId, page.url, finding.id, "not_relevant")}>Not relevant</Button></> : <Button size="sm" variant="ghost" loading={savingFinding === key} disabled={Boolean(savingFinding)} onClick={() => void changeFindingState(audit.runId, page.url, finding.id, "open")}>Reopen</Button>}</div> : null}
                  </li>;
                })}</ul> : null}
              </li>
            ))}</ul> : <p className="text-sm text-ink-3">The saved review did not return page-level inventory details.</p>}
          </CardContent></Card>
        )) : <EmptyState icon={<Search />} title="No multi-page website review saved" body="Run a website review from your workspace to build a dated sample of page metadata and search-readiness findings here." />}
      </section>
      <AiAnswerObservations slug={slug} canEdit={canEdit} website={data.website} />
    </div>
  );
}

function AiAnswerObservations({ slug, canEdit, website }: { slug: string; canEdit: boolean; website: string | null }) {
  const panels = useQuery(api.aiSearchVisibility.listPanels, { slug });
  const searchConsole = useQuery(api.searchConsole.observations, { slug });
  const matchedProperty = Boolean(searchConsole && website && searchConsolePropertyMatchesWebsite(searchConsole.property, website));
  const querySuggestions = matchedProperty && searchConsole ? planAiSearchQueries(searchConsole.rows) : [];
  const [panelId, setPanelId] = useState<Id<"aiSearchPanels"> | "all">("all");
  const report = useQuery(api.aiSearchVisibility.report, { slug, days: 90, compareToPreviousWindow: true, ...(panelId !== "all" ? { panelId } : {}) });
  const record = useMutation(api.aiSearchVisibility.recordObservation);
  const recordIntervention = useMutation(api.aiSearchVisibility.recordIntervention);
  const createPanel = useMutation(api.aiSearchVisibility.createPanel);
  const [provider, setProvider] = useState("chatgpt");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [panelQueryKey, setPanelQueryKey] = useState("choose");
  const [panelName, setPanelName] = useState("");
  const [panelQuestions, setPanelQuestions] = useState("");
  const [selectedObservedQueries, setSelectedObservedQueries] = useState<string[]>([]);
  const [creatingPanel, setCreatingPanel] = useState(false);
  const [status, setStatus] = useState("answered");
  const [mentioned, setMentioned] = useState("unknown");
  const [sentiment, setSentiment] = useState("unknown");
  const [citations, setCitations] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingIntervention, setSavingIntervention] = useState(false);
  const [changeDate, setChangeDate] = useState(new Date().toISOString().slice(0, 10));
  const [changeKind, setChangeKind] = useState("content");
  const [changeSummary, setChangeSummary] = useState("");
  const [expectedSignal, setExpectedSignal] = useState("");
  const [affectedPages, setAffectedPages] = useState("");
  const selectedPanelQuery = report?.panel?.queries?.find((item) => item.key === panelQueryKey);
  const addObservedQueries = () => {
    const selected = querySuggestions.filter((item) => selectedObservedQueries.includes(item.query)).map((item) => item.query);
    const existing = new Set(panelQuestions.split(/\n+/u).map((item) => item.trim().toLocaleLowerCase("en-US")).filter(Boolean));
    const additions = selected.filter((item) => !existing.has(item.toLocaleLowerCase("en-US")));
    setPanelQuestions([...panelQuestions.split(/\n+/u).map((item) => item.trim()).filter(Boolean), ...additions].join("\n"));
    setSelectedObservedQueries([]);
  };
  const makePanel = async () => {
    setCreatingPanel(true);
    try {
      const queries = panelQuestions.split(/\n+/u).map((item) => item.trim()).filter(Boolean).map((item) => ({
        provider: provider as "chatgpt" | "gemini" | "perplexity" | "google_ai_overview" | "other",
        query: item,
        ...(location.trim() ? { location: location.trim() } : {}),
      }));
      const id = await createPanel({ slug, name: panelName, queries });
      setPanelId(id);
      setPanelQueryKey("choose");
      setPanelName("");
      setPanelQuestions("");
      setSelectedObservedQueries([]);
      toast({ tone: "success", title: "Comparable question panel created" });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally { setCreatingPanel(false); }
  };
  const submit = async (checkedAt: number) => {
    setSaving(true);
    try {
      const answered = status === "answered";
      await record({
        slug,
        ...(panelId !== "all" && selectedPanelQuery ? { panelId, panelQueryKey } : {}),
        provider: (selectedPanelQuery?.provider ?? provider) as "chatgpt" | "gemini" | "perplexity" | "google_ai_overview" | "other",
        query: selectedPanelQuery?.query ?? query,
        ...((selectedPanelQuery?.location ?? location.trim()) ? { location: selectedPanelQuery?.location ?? location.trim() } : {}),
        checkedAt,
        answerStatus: status as "answered" | "no_answer" | "failed",
        brandMention: answered ? mentioned as "yes" | "no" | "unknown" : "unknown",
        sentiment: answered && mentioned === "yes" ? sentiment as "positive" | "neutral" | "negative" | "mixed" | "unknown" : "unknown",
        citedUrls: answered ? citations.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean) : [],
        competitorMentions: answered ? competitors.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean) : [],
        ...(answered && excerpt.trim() ? { answerExcerpt: excerpt.trim() } : {}),
      });
      setQuery(""); setCitations(""); setCompetitors(""); setExcerpt("");
      toast({ tone: "success", title: "AI-search observation saved" });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally { setSaving(false); }
  };
  const submitIntervention = async () => {
    const changedAt = new Date(`${changeDate}T12:00:00`).getTime();
    setSavingIntervention(true);
    try {
      await recordIntervention({
        slug,
        ...(panelId !== "all" ? { panelId } : {}),
        changedAt,
        kind: changeKind as "content" | "technical_seo" | "brand_or_entity" | "off_site" | "other",
        summary: changeSummary,
        expectedSignal,
        pageUrls: affectedPages.split(/[\n,]+/u).map((value) => value.trim()).filter(Boolean),
      });
      setChangeSummary(""); setExpectedSignal(""); setAffectedPages("");
      toast({ tone: "success", title: "Optimization change recorded", description: "Its timing can be compared with later samples; this does not prove causation." });
    } catch (error) {
      toast({ tone: "danger", title: errorMessage(error) });
    } finally { setSavingIntervention(false); }
  };
  const percent = (rate: { rate: number | null } | null) => rate?.rate === null || !rate ? "Not enough labeled answers" : `${Math.round(rate.rate * 100)}% of recorded samples`;
  const percentValue = (value: number | null | undefined) => value === null || value === undefined ? "Not enough labeled answers" : `${Math.round(value * 100)}%`;
  const pointChange = (value: number | null) => value === null ? "Not comparable" : `${value > 0 ? "+" : ""}${Math.round(value * 100)} percentage points`;
  const knownMentionAnswers = report?.observations.filter((item) => item.answerStatus === "answered" && item.brandMention !== "unknown") ?? [];
  const businessMentions = knownMentionAnswers.filter((item) => item.brandMention === "yes").length;
  return (
    <section className="flex flex-col gap-3">
      <div><h2 className="heading-card">AI answer visibility</h2><p className="mt-1 text-sm text-ink-3">Record what you observe when checking the same customer questions in AI search tools. These are your samples, not a complete measure of any platform.</p></div>
      <Callout tone="info">For platform-reported citation data, <a href="https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Bing Webmaster Tools AI Performance</a> reports cited pages and grounding queries. ClimbOS does not currently connect to or import that report automatically. Search Console and website analytics remain separate from these manually observed samples.</Callout>
      <Card><CardContent className="flex flex-col gap-4">
        <div><h3 className="text-sm font-semibold text-ink">Track a consistent question set</h3><p className="mt-1 text-sm text-ink-3">A panel keeps the provider, questions, and market fixed so later checks can be compared. Repeated manual checks are still samples, not a platform-wide visibility rate.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Saved question panel"><Select value={panelId} onValueChange={(value) => { setPanelId(value === "all" ? "all" : value as Id<"aiSearchPanels">); setPanelQueryKey("choose"); }} options={[{ value: "all", label: "All observations" }, ...(panels ?? []).map((item) => ({ value: item.id, label: `${item.name} · ${item.queryCount} questions` }))]} disabled={!canEdit || panels === undefined} /></Field>
          {panelId !== "all" ? <Field label="Question in this panel"><Select value={panelQueryKey} onValueChange={(value) => { setPanelQueryKey(value); const selected = report?.panel?.queries?.find((item) => item.key === value); if (selected) { setProvider(selected.provider); setQuery(selected.query); setLocation(selected.location ?? ""); } }} options={[{ value: "choose", label: "Choose a saved question" }, ...(report?.panel?.queries ?? []).map((item) => ({ value: item.key, label: `${item.provider.replaceAll("_", " ")} · ${item.query}${item.location ? ` · ${item.location}` : ""}` }))]} disabled={!canEdit || !report?.panel} /></Field> : <p className="self-end text-xs text-ink-3">Create a panel below to compare repeat checks of the same questions.</p>}
        </div>
        {canEdit ? <details className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink">Create a question panel</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Panel name"><Input value={panelName} onChange={(event) => setPanelName(event.target.value)} maxLength={120} placeholder="Core buyer questions" /></Field>
            <Field label="Provider for these questions"><Select value={provider} onValueChange={setProvider} options={[{ value: "chatgpt", label: "ChatGPT search" }, { value: "google_ai_overview", label: "Google AI Overview" }, { value: "gemini", label: "Gemini" }, { value: "perplexity", label: "Perplexity" }, { value: "other", label: "Other" }]} /></Field>
            <div className="sm:col-span-2"><Field label="Questions (one per line)"><Textarea value={panelQuestions} onChange={(event) => setPanelQuestions(event.target.value)} rows={4} maxLength={20_000} placeholder={"Best [category] for [buyer]?\nHow does [business] compare with alternatives?"} /></Field></div>
            <div className="sm:col-span-2 rounded-lg border border-line p-3">
              <h4 className="text-sm font-medium text-ink">Start with observed Google searches</h4>
              <p className="mt-1 text-xs text-ink-3">Use exact phrases from this business’s matching Search Console property as starting points. They show Google activity in that property and period, not demand in AI answer tools. Intent labels are keyword-based hints; review and rewrite each phrase as a realistic buyer question before saving.</p>
              {searchConsole === undefined ? <p className="mt-2 text-xs text-ink-3">Loading Search Console observations…</p> : !searchConsole ? <p className="mt-2 text-xs text-ink-3">Connect Search Console and sync a query report to get observed query suggestions.</p> : !matchedProperty ? <p className="mt-2 text-xs text-ink-3">The latest Search Console property does not match the recorded business website, so its queries are not suggested here.</p> : querySuggestions.length ? <>
                <p className="mt-2 text-xs text-ink-3">Property: {searchConsole.property} · {searchConsole.startDate} to {searchConsole.endDate}{searchConsole.truncated ? " · report is truncated" : ""}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {querySuggestions.map((item) => <li key={item.query}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md bg-surface-2 p-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={selectedObservedQueries.includes(item.query)} onChange={(event) => setSelectedObservedQueries((current) => event.target.checked ? [...new Set([...current, item.query])] : current.filter((queryItem) => queryItem !== item.query))} />
                      <span className="min-w-0 flex-1"><span className="block break-words text-ink">{item.query}</span><span className="mt-0.5 block text-xs text-ink-3">{item.intent} intent hint · {item.highestPageImpressions} impressions on the strongest single page · {item.observedPageCount} page{item.observedPageCount === 1 ? "" : "s"}</span></span>
                    </label>
                  </li>)}
                </ul>
                <div className="mt-2"><Button size="sm" variant="secondary" disabled={!selectedObservedQueries.length} onClick={addObservedQueries}>Add selected phrases</Button></div>
              </> : <p className="mt-2 text-xs text-ink-3">No usable query phrases were returned for this property and period.</p>}
            </div>
            <Field label="Market for all questions (optional)"><Input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={160} placeholder="e.g. Dhaka, Bangladesh" /></Field>
            <div className="flex items-end"><Button size="sm" loading={creatingPanel} disabled={!panelName.trim() || !panelQuestions.split(/\n+/u).some((item) => item.trim())} onClick={() => void makePanel()}>Save question panel</Button></div>
          </div>
        </details> : null}
      </CardContent></Card>
      <Card><CardContent className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink">Record one observed answer</h3>
        <div className="grid gap-3 sm:grid-cols-2">
              {selectedPanelQuery ? <p className="text-sm text-ink-2 sm:col-span-2">Recording the saved question: <strong>{selectedPanelQuery.query}</strong> · {selectedPanelQuery.provider.replaceAll("_", " ")}{selectedPanelQuery.location ? ` · ${selectedPanelQuery.location}` : ""}</p> : <>
            <Field label="AI search tool"><Select value={provider} onValueChange={setProvider} options={[{ value: "chatgpt", label: "ChatGPT search" }, { value: "google_ai_overview", label: "Google AI Overview" }, { value: "gemini", label: "Gemini" }, { value: "perplexity", label: "Perplexity" }, { value: "other", label: "Other" }]} disabled={!canEdit} /></Field>
            <Field label="Question you checked"><Input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} placeholder="e.g. Best accounting software for a small design studio" disabled={!canEdit} /></Field>
            <Field label="Location or market (optional)"><Input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={160} placeholder="e.g. Dhaka, Bangladesh" disabled={!canEdit} /></Field>
          </>}
          <Field label="Answer status"><Select value={status} onValueChange={setStatus} options={[{ value: "answered", label: "Answer shown" }, { value: "no_answer", label: "No answer shown" }, { value: "failed", label: "Check failed" }]} disabled={!canEdit} /></Field>
          {status === "answered" ? <>
            <Field label="Was the business mentioned?"><Select value={mentioned} onValueChange={setMentioned} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Not sure" }]} disabled={!canEdit} /></Field>
            {mentioned === "yes" ? <Field label="Mention tone"><Select value={sentiment} onValueChange={setSentiment} options={["positive", "neutral", "negative", "mixed", "unknown"].map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))} disabled={!canEdit} /></Field> : null}
            <Field label="Cited page URLs (one per line)"><Textarea value={citations} onChange={(event) => setCitations(event.target.value)} rows={2} disabled={!canEdit} placeholder="Paste source URLs shown in the answer" /></Field>
            <Field label="Other businesses mentioned (one per line)"><Textarea value={competitors} onChange={(event) => setCompetitors(event.target.value)} rows={2} disabled={!canEdit} placeholder="Names as shown in the answer" /></Field>
            <Field label="Short answer excerpt"><Textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} rows={3} maxLength={6000} disabled={!canEdit} placeholder="Paste enough of the answer to review this observation" /></Field>
          </> : null}
        </div>
        <div><Button size="sm" disabled={!canEdit || (panelId !== "all" ? !selectedPanelQuery : !query.trim()) || (status === "answered" && !excerpt.trim())} loading={saving} onClick={() => void submit(Date.now())}>Save observation</Button></div>
      </CardContent></Card>
      {canEdit ? <Card><CardContent className="flex flex-col gap-4">
        <div><h3 className="text-sm font-semibold text-ink">Log an optimization change</h3><p className="mt-1 text-sm text-ink-3">Record what changed and when, then compare with later checks. This is an owner report, not proof the change caused a visibility difference.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Change date"><DatePicker value={changeDate} max={new Date().toISOString().slice(0, 10)} onChange={(value) => setChangeDate(value ?? "")} /></Field>
          <Field label="Change type"><Select value={changeKind} onValueChange={setChangeKind} options={[{ value: "content", label: "Content update" }, { value: "technical_seo", label: "Technical SEO" }, { value: "brand_or_entity", label: "Brand or entity information" }, { value: "off_site", label: "Off-site mention or profile" }, { value: "other", label: "Other" }]} /></Field>
          <div className="sm:col-span-2"><Field label="What changed"><Textarea value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} rows={2} maxLength={1000} placeholder="e.g. Added a sourced comparison section to the service page" /></Field></div>
          <div className="sm:col-span-2"><Field label="What signal will you watch?"><Input value={expectedSignal} onChange={(event) => setExpectedSignal(event.target.value)} maxLength={500} placeholder="e.g. Whether this page is cited in the saved buyer-question panel" /></Field></div>
          <div className="sm:col-span-2"><Field label="Affected pages (one per line, optional for brand/off-site changes)"><Textarea value={affectedPages} onChange={(event) => setAffectedPages(event.target.value)} rows={2} maxLength={5000} placeholder="https://example.com/page" /></Field></div>
        </div>
        <div><Button size="sm" loading={savingIntervention} disabled={!canEdit || !changeDate || !changeSummary.trim() || !expectedSignal.trim() || (changeKind === "content" || changeKind === "technical_seo") && !affectedPages.trim()} onClick={() => void submitIntervention()}>Save change log</Button></div>
        {report?.interventions?.length ? <ul className="flex flex-col gap-2">{report.interventions.map((item) => <li key={item.id} className="rounded-lg bg-surface-2 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium text-ink">{new Date(item.changedAt).toLocaleDateString()} · {item.kind.replaceAll("_", " ")}</p><span className="text-xs text-ink-3">Owner-reported{item.comparisonWindow ? ` · ${item.comparisonWindow} window` : ""}</span></div><p className="mt-1 text-sm text-ink-2">{item.summary}</p><p className="mt-1 text-xs text-ink-3">Signal to watch: {item.expectedSignal}</p>{item.pageUrls.length ? <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{item.pageUrls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-ink-3 underline underline-offset-2">{url}</a>)}</div> : null}</li>)}</ul> : <p className="text-xs text-ink-3">No owner-reported changes in this comparison window.</p>}
      </CardContent></Card> : null}
      {report === undefined ? <p className="text-sm text-ink-3">Loading recorded observations…</p> : report.observationCount === 0 ? <EmptyState icon={<Search />} title={panelId !== "all" ? "No checks in this panel yet" : "No AI-search observations yet"} body={panelId !== "all" ? "Choose a saved question above, check it in the named tool, and record what the answer shows." : "Save a few results for a consistent set of questions to establish an owner-observed baseline."} /> : <>
        <Card><CardContent className="flex flex-col gap-3"><div><h3 className="text-sm font-semibold text-ink">Recorded sample summary · last {report.windowDays} days</h3><p className="mt-1 text-sm text-ink-3">{report.observationCount} observation{report.observationCount === 1 ? "" : "s"}{report.truncated ? " shown (older samples are not included in this view)" : ""}. The sample is owner-recorded and is not a platform-wide rate.</p></div><dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-ink-3">Answered checks</dt><dd className="text-ink-2">{report.panelSummary.answered} of {report.observationCount}</dd></div><div><dt className="text-xs text-ink-3">Business mentioned</dt><dd className="text-ink-2">{knownMentionAnswers.length ? `${businessMentions} of ${knownMentionAnswers.length} answers with a known mention result` : "No labeled answers yet"}</dd></div><div><dt className="text-xs text-ink-3">Cited own-site answers</dt><dd className="text-ink-2">{report.panelSummary.observedFirstPartyCitationRate ? percent(report.panelSummary.observedFirstPartyCitationRate) : "No website recorded"}</dd></div></dl></CardContent></Card>
        {report.comparison ? <Card><CardContent className="flex flex-col gap-3"><div><h3 className="text-sm font-semibold text-ink">Observed period comparison</h3><p className="mt-1 text-sm text-ink-3">Prior {report.windowDays}-day sample: {report.comparison.baselineObservationCount}; current sample: {report.comparison.currentObservationCount}. Descriptive only; it does not show that a website or content change caused a visibility change.</p></div>{report.comparison.queryChanges.length ? <ul className="flex flex-col gap-2">{report.comparison.queryChanges.slice(0, 10).map((change) => <li key={`${change.provider}:${change.query}:${change.location ?? ""}`} className="rounded-lg bg-surface-2 p-3"><p className="text-sm font-medium text-ink">{change.query}</p><p className="mt-1 text-xs text-ink-3">{change.provider.replaceAll("_", " ")}{change.location ? ` · ${change.location}` : ""}</p><dl className="mt-2 grid gap-2 text-xs sm:grid-cols-3"><div><dt className="text-ink-3">Prior mention rate</dt><dd className="text-ink-2">{percentValue(change.baseline?.brandMentions.rate)}</dd></div><div><dt className="text-ink-3">Current mention rate</dt><dd className="text-ink-2">{percentValue(change.current?.brandMentions.rate)}</dd></div><div><dt className="text-ink-3">Observed change</dt><dd className="text-ink-2">{pointChange(change.brandMentionRateChange)}</dd></div></dl></li>)}</ul> : <p className="text-sm text-ink-3">No question has labeled answers in both periods yet.</p>}{report.comparison.truncated ? <p className="text-xs text-ink-3">The comparison is truncated to the latest recorded samples.</p> : null}</CardContent></Card> : null}
        <div className="flex flex-col gap-2">{report.observations.slice(0, 10).map((item) => <Card key={item.id}><CardContent className="flex flex-col gap-2"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-medium text-ink">{item.provider.replaceAll("_", " ")} · {item.answerStatus.replaceAll("_", " ")}</span><span className="text-xs text-ink-3">{relativeTime(item.checkedAt)}</span></div><p className="text-sm text-ink">{item.query}</p><p className="text-xs text-ink-3">Business mentioned: {item.brandMention}{item.citedUrls.length ? ` · Cited pages: ${item.citedUrls.length}` : " · No citation recorded"}</p><div className="flex flex-wrap gap-x-3 gap-y-1">{item.citedUrls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-ink-3 underline underline-offset-2">{url}</a>)}</div></CardContent></Card>)}</div>
      </>}
    </section>
  );
}
