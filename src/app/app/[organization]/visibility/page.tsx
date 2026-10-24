"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RefreshCw, Search } from "@/components/icons";
import { errorMessage } from "@/components/app/errors";
import { relativeTime } from "@/components/app/money";
import { LoadingBlock, PageHeader } from "@/components/app/results/QueryBoundary";
import { Button, Callout, Card, CardContent, EmptyState, Field, Input, Select, Textarea, toast } from "@/components/ui";
import { useWorkspaceMember } from "@/components/app/content/shared";
import { can } from "@shared/policy";

export default function SearchReadinessPage() {
  const { organization: slug } = useParams<{ organization: string }>();
  const data = useQuery(api.siteWatch.searchReadiness, { slug });
  const scan = useMutation(api.siteWatch.scanSearchReadiness);
  const member = useWorkspaceMember(slug);
  const canEdit = Boolean(member?.role && can(member.role, "edit"));
  if (data === undefined) return <LoadingBlock label="Loading search readiness" lines={4} />;
  if (data === null) return <p className="text-sm text-ink-3">Finish onboarding first.</p>;
  const current = data.scan;
  const run = () => scan({ slug }).then(() => toast({ tone: "success", title: "Homepage check started" }), (error) => toast({ tone: "danger", title: errorMessage(error) }));
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
          <Card><CardContent className="flex flex-col gap-3"><div><h2 className="heading-card">Crawler access signals</h2><p className="mt-1 text-sm text-ink-3">ClimbOS checked the homepage path against the site’s published robots.txt rules.</p></div><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-ink-3">robots.txt</dt><dd className="text-ink-2">{current.robotsFileStatus === "available" ? "Retrieved" : current.robotsFileStatus === "not_found" ? "Not found (no published rules at this address)" : "Could not verify"}</dd></div>{current.crawlerChecks?.map((item) => <div key={item.crawler}><dt className="text-xs text-ink-3">{item.crawler}</dt><dd className="text-ink-2">{current.robotsFileStatus === "unavailable" ? "Unknown" : item.allowed ? "Allowed by robots.txt for homepage" : "Disallowed by robots.txt for homepage"}</dd></div>)}</dl><p className="text-xs text-ink-3">A robots.txt allowance does not prove that a crawler can reach the site through its firewall or that the page is indexed or cited. OAI-SearchBot is OpenAI’s search crawler; GPTBot is a separate training crawler.</p></CardContent></Card>
          <section className="flex flex-col gap-3"><div><h2 className="heading-card">What to review</h2><p className="mt-1 text-sm text-ink-3">These checks describe this page only; they are not ranking or citation predictions.</p></div>
            {current.findings?.length ? <ul className="flex flex-col gap-3">{current.findings.map((finding) => <li key={finding.id}><Card><CardContent className="flex flex-col gap-2"><div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold text-ink">{finding.title}</h3><span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink-3">{finding.level === "attention" ? "Needs attention" : "Review"}</span></div><p className="text-sm text-ink-2">{finding.evidence}</p><p className="text-sm"><span className="font-medium text-ink">Next step: </span><span className="text-ink-2">{finding.nextStep}</span></p></CardContent></Card></li>)}</ul> : <EmptyState icon={<Search />} title="No obvious issues found" body="The checks we ran found a title, description, main heading, readable text, and structured data. This does not guarantee rankings or citations." />}
          </section>
        </>
      )}
      <AiAnswerObservations slug={slug} canEdit={canEdit} />
    </div>
  );
}

function AiAnswerObservations({ slug, canEdit }: { slug: string; canEdit: boolean }) {
  const report = useQuery(api.aiSearchVisibility.report, { slug, days: 90 });
  const record = useMutation(api.aiSearchVisibility.recordObservation);
  const [provider, setProvider] = useState("chatgpt");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState("answered");
  const [mentioned, setMentioned] = useState("unknown");
  const [sentiment, setSentiment] = useState("unknown");
  const [citations, setCitations] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const answered = status === "answered";
      await record({
        slug,
        provider: provider as "chatgpt" | "gemini" | "perplexity" | "google_ai_overview" | "other",
        query,
        ...(location.trim() ? { location: location.trim() } : {}),
        checkedAt: Date.now(),
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
  const percent = (rate: { rate: number | null } | null) => rate?.rate === null || !rate ? "Not enough labeled answers" : `${Math.round(rate.rate * 100)}% of recorded samples`;
  const knownMentionAnswers = report?.observations.filter((item) => item.answerStatus === "answered" && item.brandMention !== "unknown") ?? [];
  const businessMentions = knownMentionAnswers.filter((item) => item.brandMention === "yes").length;
  return (
    <section className="flex flex-col gap-3">
      <div><h2 className="heading-card">AI answer visibility</h2><p className="mt-1 text-sm text-ink-3">Record what you observe when checking the same customer questions in AI search tools. These are your samples, not a complete measure of any platform.</p></div>
      <Callout tone="info">For platform-reported citation data, <a href="https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Bing Webmaster Tools AI Performance</a> reports cited pages and grounding queries. ClimbOS does not currently connect to or import that report automatically. Search Console and website analytics remain separate from these manually observed samples.</Callout>
      <Card><CardContent className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-ink">Record one observed answer</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="AI search tool"><Select value={provider} onValueChange={setProvider} options={[{ value: "chatgpt", label: "ChatGPT search" }, { value: "google_ai_overview", label: "Google AI Overview" }, { value: "gemini", label: "Gemini" }, { value: "perplexity", label: "Perplexity" }, { value: "other", label: "Other" }]} disabled={!canEdit} /></Field>
          <Field label="Question you checked"><Input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={500} placeholder="e.g. Best accounting software for a small design studio" disabled={!canEdit} /></Field>
          <Field label="Location or market (optional)"><Input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={160} placeholder="e.g. Dhaka, Bangladesh" disabled={!canEdit} /></Field>
          <Field label="Answer status"><Select value={status} onValueChange={setStatus} options={[{ value: "answered", label: "Answer shown" }, { value: "no_answer", label: "No answer shown" }, { value: "failed", label: "Check failed" }]} disabled={!canEdit} /></Field>
          {status === "answered" ? <>
            <Field label="Was the business mentioned?"><Select value={mentioned} onValueChange={setMentioned} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unknown", label: "Not sure" }]} disabled={!canEdit} /></Field>
            {mentioned === "yes" ? <Field label="Mention tone"><Select value={sentiment} onValueChange={setSentiment} options={["positive", "neutral", "negative", "mixed", "unknown"].map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))} disabled={!canEdit} /></Field> : null}
            <Field label="Cited page URLs (one per line)"><Textarea value={citations} onChange={(event) => setCitations(event.target.value)} rows={2} disabled={!canEdit} placeholder="Paste source URLs shown in the answer" /></Field>
            <Field label="Other businesses mentioned (one per line)"><Textarea value={competitors} onChange={(event) => setCompetitors(event.target.value)} rows={2} disabled={!canEdit} placeholder="Names as shown in the answer" /></Field>
            <Field label="Short answer excerpt"><Textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} rows={3} maxLength={6000} disabled={!canEdit} placeholder="Paste enough of the answer to review this observation" /></Field>
          </> : null}
        </div>
        <div><Button size="sm" disabled={!canEdit || !query.trim() || (status === "answered" && !excerpt.trim())} loading={saving} onClick={() => void submit()}>Save observation</Button></div>
      </CardContent></Card>
      {report === undefined ? <p className="text-sm text-ink-3">Loading recorded observations…</p> : report.observationCount === 0 ? <EmptyState icon={<Search />} title="No AI-search observations yet" body="Save a few results for a consistent set of questions to establish an owner-observed baseline." /> : <>
        <Card><CardContent className="flex flex-col gap-3"><div><h3 className="text-sm font-semibold text-ink">Recorded sample summary · last {report.windowDays} days</h3><p className="mt-1 text-sm text-ink-3">{report.observationCount} observation{report.observationCount === 1 ? "" : "s"}{report.truncated ? " shown (older samples are not included in this view)" : ""}. The sample is owner-recorded and is not a platform-wide rate.</p></div><dl className="grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-ink-3">Answered checks</dt><dd className="text-ink-2">{report.panelSummary.answered} of {report.observationCount}</dd></div><div><dt className="text-xs text-ink-3">Business mentioned</dt><dd className="text-ink-2">{knownMentionAnswers.length ? `${businessMentions} of ${knownMentionAnswers.length} answers with a known mention result` : "No labeled answers yet"}</dd></div><div><dt className="text-xs text-ink-3">Cited own-site answers</dt><dd className="text-ink-2">{report.panelSummary.observedFirstPartyCitationRate ? percent(report.panelSummary.observedFirstPartyCitationRate) : "No website recorded"}</dd></div></dl></CardContent></Card>
        <div className="flex flex-col gap-2">{report.observations.slice(0, 10).map((item) => <Card key={item.id}><CardContent className="flex flex-col gap-2"><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-medium text-ink">{item.provider.replaceAll("_", " ")} · {item.answerStatus.replaceAll("_", " ")}</span><span className="text-xs text-ink-3">{relativeTime(item.checkedAt)}</span></div><p className="text-sm text-ink">{item.query}</p><p className="text-xs text-ink-3">Business mentioned: {item.brandMention}{item.citedUrls.length ? ` · Cited pages: ${item.citedUrls.length}` : " · No citation recorded"}</p><div className="flex flex-wrap gap-x-3 gap-y-1">{item.citedUrls.map((url) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-ink-3 underline underline-offset-2">{url}</a>)}</div></CardContent></Card>)}</div>
      </>}
    </section>
  );
}
