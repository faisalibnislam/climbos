"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Globe } from "@/components/icons";
import { Avatar, Button } from "@/components/ui";
import { StatusBadge, NoResultsState, type StatusTone } from "@/components/ds/feedback";
import {
  ActiveFilterCounter,
  AdvancedSearch,
  AssigneeFilter,
  ClearFiltersButton,
  DateRangeFilter,
  EMPTY_ADVANCED,
  FilterBuilder,
  FilterChips,
  FilterDropdown,
  FilterSidebar,
  GroupByControl,
  RecentSearches,
  SavedSearches,
  SavedViews,
  SearchCombobox,
  SearchField,
  SortDirectionToggle,
  SortDropdown,
  StatusFilter,
  UNASSIGNED,
  applyConditions,
  groupRows,
  inRange,
  matchesAdvanced,
  matchesQuery,
  rangeLabel,
  shortDate,
  sortRows,
  type ActiveChip,
  type AdvancedQuery,
  type Condition,
  type DateRange,
  type FilterFieldDef,
  type Match,
  type SavedSearch,
  type SortDir,
} from "@/components/ds/filters";
import { DocPage, Spec, Specimen, Stage } from "../../_kit/doc";

/* ------------------------------------------------------------------ */
/* Sample data                                                         */
/* ------------------------------------------------------------------ */

type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";
type Source = "website" | "google" | "instagram" | "referral" | "calls";

interface Lead {
  id: string;
  name: string;
  company: string;
  city: string;
  status: LeadStatus;
  owner: string | null;
  source: Source;
  score: number;
  value: number;
  created: string;
}

const L = (id: string, name: string, company: string, city: string, status: LeadStatus, owner: string | null, source: Source, score: number, value: number, created: string): Lead => ({ id, name, company, city, status, owner, source, score, value, created });

const LEADS: Lead[] = [
  L("l1", "Lena Ortiz", "Harbor Dental", "Brooklyn", "new", "maya", "website", 86, 4200, "2026-10-18"),
  L("l2", "Marcus Bell", "Bell Plumbing", "Queens", "contacted", "owen", "google", 72, 1800, "2026-10-16"),
  L("l3", "Priya Shah", "Glow Skin Studio", "Brooklyn", "qualified", "sara", "instagram", 91, 3600, "2026-10-14"),
  L("l4", "Tom Reyes", "Reyes Roofing", "Jersey City", "new", null, "google", 54, 9500, "2026-10-19"),
  L("l5", "Ana Costa", "Costa Bakery", "Brooklyn", "won", "maya", "referral", 88, 1200, "2026-10-02"),
  L("l6", "Jamal Wright", "Wright Fitness", "Harlem", "contacted", "sara", "instagram", 63, 2400, "2026-10-11"),
  L("l7", "Chloe Martin", "Martin Law", "Manhattan", "lost", "owen", "website", 41, 7000, "2026-09-24"),
  L("l8", "Ben Okafor", "Okafor Auto Repair", "Bronx", "qualified", "maya", "calls", 79, 2900, "2026-10-09"),
  L("l9", "Sofia Lind", "Lind Florist", "Queens", "new", null, "instagram", 67, 800, "2026-10-17"),
  L("l10", "Daniel Kim", "Kim Family Dental", "Queens", "contacted", "maya", "google", 83, 5100, "2026-10-07"),
  L("l11", "Grace Hall", "Hall Pet Grooming", "Brooklyn", "won", "sara", "website", 76, 950, "2026-09-28"),
  L("l12", "Omar Haddad", "Cedar Cafe", "Manhattan", "new", "owen", "referral", 58, 1500, "2026-10-13"),
  L("l13", "Ruth Adler", "Adler Accounting", "Hoboken", "qualified", null, "calls", 70, 6200, "2026-10-04"),
  L("l14", "Leo Grant", "Grant HVAC", "Bronx", "lost", "owen", "google", 35, 8800, "2026-09-20"),
];

const TODAY = "2026-10-19";

const STATUS: Record<LeadStatus, { label: string; tone: StatusTone; dot: string }> = {
  new: { label: "New", tone: "info", dot: "bg-chart-3" },
  contacted: { label: "Contacted", tone: "progress", dot: "bg-brand-700" },
  qualified: { label: "Qualified", tone: "warning", dot: "bg-amber-500" },
  won: { label: "Won", tone: "success", dot: "bg-green-800" },
  lost: { label: "Lost", tone: "neutral", dot: "bg-ink-3" },
};
const SOURCES: Record<Source, string> = { website: "Website", google: "Google Ads", instagram: "Instagram", referral: "Referral", calls: "Calls" };
const PEOPLE: Record<string, string> = { maya: "Maya Chen", owen: "Owen Price", sara: "Sara Ali" };

const countBy = (f: (l: Lead) => string | null) => LEADS.reduce<Record<string, number>>((a, l) => ({ ...a, [f(l) ?? UNASSIGNED]: (a[f(l) ?? UNASSIGNED] ?? 0) + 1 }), {});
const STATUS_COUNTS = countBy((l) => l.status);
const SOURCE_COUNTS = countBy((l) => l.source);
const OWNER_COUNTS = countBy((l) => l.owner);

const STATUS_OPTIONS = (Object.keys(STATUS) as LeadStatus[]).map((s) => ({ value: s, label: STATUS[s].label, count: STATUS_COUNTS[s] ?? 0, dot: STATUS[s].dot }));
const SOURCE_OPTIONS = (Object.keys(SOURCES) as Source[]).map((s) => ({ value: s, label: SOURCES[s], count: SOURCE_COUNTS[s] ?? 0 }));
const OWNER_OPTIONS = Object.keys(PEOPLE).map((p) => ({ value: p, label: PEOPLE[p], count: OWNER_COUNTS[p] ?? 0 }));
const PEOPLE_OPTIONS = Object.keys(PEOPLE).map((p) => ({ value: p, name: PEOPLE[p], count: OWNER_COUNTS[p] ?? 0, me: p === "maya" }));

const searchText = (l: Lead) => `${l.name} ${l.company} ${l.city} ${SOURCES[l.source]} ${STATUS[l.status].label}`;
const fieldText = (l: Lead, field: string) => (field === "company" ? l.company : field === "name" ? l.name : field === "city" ? l.city : searchText(l));

const SUGGESTIONS = [...new Set([...LEADS.map((l) => l.company), ...LEADS.map((l) => l.city), "Dental", "Roofing", "Plumbing", "Cafe"])];

const BUILDER_FIELDS: FilterFieldDef[] = [
  { key: "company", label: "Company", type: "text" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS.map(({ value, label }) => ({ value, label })) },
  { key: "owner", label: "Owner", type: "select", options: OWNER_OPTIONS.map(({ value, label }) => ({ value, label })) },
  { key: "source", label: "Source", type: "select", options: SOURCE_OPTIONS.map(({ value, label }) => ({ value, label })) },
  { key: "score", label: "Score", type: "number" },
  { key: "value", label: "Deal value", type: "number" },
  { key: "created", label: "Created", type: "date" },
];
const getField = (l: Lead, k: string) => l[k as keyof Lead];

/** Shared status / source / owner facets used by several demos. */
function useFacets(init: { status?: string[]; source?: string[]; owner?: string[] } = {}) {
  const [status, setStatus] = useState<string[]>(init.status ?? []);
  const [source, setSource] = useState<string[]>(init.source ?? []);
  const [owner, setOwner] = useState<string[]>(init.owner ?? []);
  const apply = (rows: Lead[]) =>
    rows.filter((l) => (!status.length || status.includes(l.status)) && (!source.length || source.includes(l.source)) && (!owner.length || owner.includes(l.owner ?? UNASSIGNED)));
  const count = (status.length ? 1 : 0) + (source.length ? 1 : 0) + (owner.length ? 1 : 0);
  const clear = () => {
    setStatus([]);
    setSource([]);
    setOwner([]);
  };
  const chips: ActiveChip[] = [
    status.length ? { id: "status", field: "Status", value: status.map((s) => STATUS[s as LeadStatus].label).join(", "), onRemove: () => setStatus([]) } : null,
    source.length ? { id: "source", field: "Source", value: source.map((s) => SOURCES[s as Source]).join(", "), onRemove: () => setSource([]) } : null,
    owner.length ? { id: "owner", field: "Owner", value: owner.map((o) => (o === UNASSIGNED ? "Unassigned" : PEOPLE[o])).join(", "), onRemove: () => setOwner([]) } : null,
  ].filter((c): c is ActiveChip => c !== null);
  return { status, setStatus, source, setSource, owner, setOwner, apply, count, clear, chips };
}

/* ------------------------------------------------------------------ */
/* Result preview                                                      */
/* ------------------------------------------------------------------ */

function LeadRow({ l, q }: { l: Lead; q?: string }) {
  return (
    <li className="grid h-[var(--cell-h)] grid-cols-[minmax(0,1.6fr)_96px_minmax(0,1fr)_48px_56px] items-center gap-3 px-3 text-ui">
      <span className="min-w-0 truncate">
        <span className="font-medium text-ink">{q ? <Mark text={l.company} q={q} /> : l.company}</span>
        <span className="text-ink-3"> · {l.name}, {l.city}</span>
      </span>
      <span>
        <StatusBadge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</StatusBadge>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-ink-2">
        {l.owner ? <Avatar name={PEOPLE[l.owner]} size="sm" className="size-5" /> : <span className="text-ink-3">Unassigned</span>}
        <span className="truncate">{l.owner ? PEOPLE[l.owner].split(" ")[0] : ""}</span>
      </span>
      <span className="text-right tabular-nums text-ink">{l.score}</span>
      <span className="text-right text-xs tabular-nums text-ink-3">{shortDate(l.created)}</span>
    </li>
  );
}

function Mark({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase().trim());
  if (!q.trim() || i < 0) return <>{text}</>;
  const n = q.trim().length;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[2px] bg-lime px-px text-ink">{text.slice(i, i + n)}</mark>
      {text.slice(i + n)}
    </>
  );
}

function LeadList({ rows, limit = 4, q, groups, onClear }: { rows: Lead[]; limit?: number; q?: string; groups?: [string, Lead[]][]; onClear?: () => void }) {
  const [all, setAll] = useState(false);
  const max = all ? rows.length : limit;
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <p className="text-xs text-ink-3">
        <span className="font-semibold tabular-nums text-ink">{rows.length}</span> of {LEADS.length} leads
      </p>
      {!rows.length ? (
        <NoResultsState query={q || undefined} onClear={onClear} className="py-6" />
      ) : (
        <div className="relative overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <div className="min-w-[560px]">
            <div className="grid h-8 grid-cols-[minmax(0,1.6fr)_96px_minmax(0,1fr)_48px_56px] items-center gap-3 border-b border-line px-3 text-2xs font-medium uppercase tracking-wide text-ink-3">
              <span>Lead</span>
              <span>Status</span>
              <span>Owner</span>
              <span className="text-right">Score</span>
              <span className="text-right">Created</span>
            </div>
            {groups ? (
              groups.map(([g, list]) => (
                <div key={g}>
                  <p className="flex h-7 items-center gap-2 border-b border-line bg-surface-2 px-3 text-xs font-semibold text-ink">
                    {g} <span className="font-normal tabular-nums text-ink-3">{list.length}</span>
                  </p>
                  <ul className="divide-y divide-line border-b border-line last:border-b-0">
                    {list.slice(0, all ? undefined : 2).map((l) => (
                      <LeadRow key={l.id} l={l} q={q} />
                    ))}
                  </ul>
                  {!all && list.length > 2 ? <p className="border-b border-line px-3 py-1 text-2xs text-ink-3">+{list.length - 2} more</p> : null}
                </div>
              ))
            ) : (
              <ul className="divide-y divide-line">
                {rows.slice(0, max).map((l) => (
                  <LeadRow key={l.id} l={l} q={q} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      {rows.length > limit || (groups && groups.some(([, l]) => l.length > 2)) ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="self-start text-xs font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline">
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      ) : null}
    </div>
  );
}

function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function FiltersContent() {
  return (
    <DocPage eyebrow="Components" title="Filters & search" intro="Find the right leads fast. Every control below filters the same 14 sample leads.">
      <Specimen title="Local search" description="Filters the list it sits above as you type. Esc clears.">
        <LocalSearchDemo />
        <Spec items={[["Height", "var(--h-md); sm for toolbars"], ["Match", "Every word, any field"], ["Announce", "Result count, politely"]]} />
      </Specimen>
      <Specimen title="Search suggestions" description="Type “de” or “qu”. ↑ ↓ move, Enter picks, Esc closes.">
        <SuggestionsDemo />
        <Spec items={[["Pattern", "ARIA combobox + listbox"], ["Max", "6 suggestions, match in bold"]]} />
      </Specimen>
      <Specimen title="Recent searches" description="Focus the box with it empty, or pick a chip.">
        <RecentDemo />
      </Specimen>
      <Specimen title="Saved searches" description="Named queries with live counts.">
        <SavedSearchDemo />
      </Specimen>
      <Specimen title="Advanced search" description="Structured fields that map to search-box syntax.">
        <AdvancedDemo />
      </Specimen>
      <Specimen title="Filter dropdown" description="One button per field; multi-select with counts.">
        <DropdownDemo />
        <Spec items={[["Set", "Ink border + value or count"], ["Search", "Shown when > 6 options"]]} />
      </Specimen>
      <Specimen title="Filter sidebar" description="Facets beside a list, for heavy filtering.">
        <SidebarDemo />
      </Specimen>
      <Specimen title="Filter chips" description="Every active filter as a removable chip.">
        <ChipsDemo />
      </Specimen>
      <Specimen title="Multi-filter builder" description="Field, operator and value rows joined by and / or.">
        <BuilderDemo />
        <Spec items={[["Operators", "By field type: text, number, select, date"], ["Unfinished rows", "Ignored until a value is set"]]} />
      </Specimen>
      <Specimen title="Date range filter">
        <DateDemo />
        <Spec items={[["Presets", "Today, 7 days, 30 days, this month, custom"], ["Dates", "ISO strings, UTC"]]} />
      </Specimen>
      <Specimen title="Status filter">
        <StatusDemo />
      </Specimen>
      <Specimen title="Assignee filter">
        <AssigneeDemo />
      </Specimen>
      <Specimen title="Sort dropdown">
        <SortDemo />
      </Specimen>
      <Specimen title="Sort direction control">
        <DirectionDemo />
      </Specimen>
      <Specimen title="Group-by control">
        <GroupDemo />
      </Specimen>
      <Specimen title="Saved views" description="Change a filter to see the edited dot, then reset, update or save as new.">
        <ViewsDemo />
      </Specimen>
      <Specimen title="Clear filters">
        <ClearDemo />
      </Specimen>
      <Specimen title="Active filter counter" description="Shows how many filters are on and opens the panel.">
        <CounterDemo />
      </Specimen>
    </DocPage>
  );
}

/* ------------------------------------------------------------------ */
/* Demos                                                               */
/* ------------------------------------------------------------------ */

function LocalSearchDemo() {
  const [q, setQ] = useState("");
  const rows = LEADS.filter((l) => matchesQuery(searchText(l), q));
  return (
    <Stage className="flex flex-col gap-3">
      <SearchField label="Search leads" placeholder="Search leads, companies, cities" value={q} onChange={setQ} resultCount={rows.length} className="max-w-sm" />
      <LeadList rows={rows} q={q} onClear={() => setQ("")} />
    </Stage>
  );
}

function SuggestionsDemo() {
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const rows = LEADS.filter((l) => matchesQuery(searchText(l), query));
  return (
    <Stage className="flex flex-col gap-3">
      <SearchCombobox label="Search leads" placeholder="Try “dental”" value={value} onChange={(v) => { setValue(v); if (!v) setQuery(""); }} onSearch={setQuery} suggestions={SUGGESTIONS} className="max-w-sm" />
      <LeadList rows={rows} q={query} onClear={() => { setValue(""); setQuery(""); }} />
    </Stage>
  );
}

function RecentDemo() {
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(["Brooklyn", "Kim Family Dental", "Roofing"]);
  const run = (q: string) => {
    setValue(q);
    setQuery(q);
    if (q.trim()) setRecent((r) => [q, ...r.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5));
  };
  const rows = LEADS.filter((l) => matchesQuery(searchText(l), query));
  return (
    <Stage className="flex flex-col gap-4">
      <SearchCombobox
        label="Search leads"
        value={value}
        onChange={(v) => { setValue(v); if (!v) setQuery(""); }}
        onSearch={run}
        suggestions={SUGGESTIONS}
        recent={recent}
        onRemoveRecent={(q) => setRecent((r) => r.filter((x) => x !== q))}
        onClearRecent={() => setRecent([])}
        className="max-w-sm"
      />
      <RecentSearches items={recent} onPick={run} onRemove={(q) => setRecent((r) => r.filter((x) => x !== q))} onClear={() => setRecent([])} />
      <LeadList rows={rows} q={query} onClear={() => run("")} />
    </Stage>
  );
}

function SavedSearchDemo() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ id: string; name: string; query: string }[]>([
    { id: "s1", name: "Brooklyn leads", query: "brooklyn" },
    { id: "s2", name: "Dentists", query: "dental" },
    { id: "s3", name: "From Google Ads", query: "google ads" },
  ]);
  const withCounts: SavedSearch[] = saved.map((s) => ({ ...s, count: LEADS.filter((l) => matchesQuery(searchText(l), s.query)).length }));
  const rows = LEADS.filter((l) => matchesQuery(searchText(l), q));
  return (
    <Stage className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <SavedSearches
        items={withCounts}
        activeId={active}
        onRun={(s) => {
          setQ(s.query);
          setActive(s.id);
        }}
        onDelete={(id) => setSaved((l) => l.filter((s) => s.id !== id))}
        currentQuery={q.trim()}
        onSave={(name) => {
          const id = `s${saved.length + 1}-${name}`;
          setSaved((l) => [...l, { id, name, query: q.trim() }]);
          setActive(id);
        }}
      />
      <div className="flex min-w-0 flex-col gap-3">
        <SearchField label="Search leads" value={q} onChange={(v) => { setQ(v); setActive(null); }} />
        <LeadList rows={rows} q={q} onClear={() => setQ("")} />
      </div>
    </Stage>
  );
}

function AdvancedDemo() {
  const [a, setA] = useState<AdvancedQuery>({ ...EMPTY_ADVANCED, any: "dental bakery", none: "kim" });
  const rows = LEADS.filter((l) => matchesAdvanced(fieldText(l, a.field), a));
  return (
    <Stage className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
        <AdvancedSearch
          value={a}
          onChange={setA}
          onReset={() => setA(EMPTY_ADVANCED)}
          fields={[
            { value: "company", label: "Company" },
            { value: "name", label: "Contact" },
            { value: "city", label: "City" },
          ]}
        />
      </div>
      <LeadList rows={rows} onClear={() => setA(EMPTY_ADVANCED)} />
    </Stage>
  );
}

const CITY_OPTIONS = [...new Set(LEADS.map((l) => l.city))].map((c) => ({ value: c, label: c, count: LEADS.filter((l) => l.city === c).length }));

function DropdownDemo() {
  const f = useFacets();
  const [city, setCity] = useState<string[]>([]);
  return (
    <Stage className="flex flex-col gap-3">
      <Toolbar>
        <FilterDropdown label="Status" options={STATUS_OPTIONS} selected={f.status} onChange={f.setStatus} />
        <FilterDropdown label="Source" icon={<Globe aria-hidden="true" />} options={SOURCE_OPTIONS} selected={f.source} onChange={f.setSource} />
        <FilterDropdown label="City" options={CITY_OPTIONS} selected={city} onChange={setCity} />
      </Toolbar>
      <LeadList
        rows={f.apply(LEADS).filter((l) => !city.length || city.includes(l.city))}
        onClear={() => {
          f.clear();
          setCity([]);
        }}
      />
    </Stage>
  );
}

function SidebarDemo() {
  const [value, setValue] = useState<Record<string, string[]>>({ source: ["website", "google"] });
  const rows = LEADS.filter((l) => (["status", "source", "owner"] as const).every((k) => !value[k]?.length || value[k].includes(k === "owner" ? (l.owner ?? UNASSIGNED) : l[k])));
  return (
    <Stage className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <FilterSidebar
        groups={[
          { key: "status", label: "Status", options: STATUS_OPTIONS.map((o) => ({ ...o, icon: <span aria-hidden="true" className={`size-2 rounded-full ${o.dot}`} /> })) },
          { key: "source", label: "Source", options: SOURCE_OPTIONS },
          { key: "owner", label: "Owner", options: [...OWNER_OPTIONS, { value: UNASSIGNED, label: "Unassigned", count: OWNER_COUNTS[UNASSIGNED] ?? 0 }] },
        ]}
        value={value}
        onChange={setValue}
      />
      <LeadList rows={rows} limit={6} onClear={() => setValue({})} />
    </Stage>
  );
}

function ChipsDemo() {
  const f = useFacets({ status: ["new", "contacted"], source: ["instagram", "google", "website"] });
  return (
    <Stage className="flex flex-col gap-3">
      <Toolbar>
        <FilterDropdown label="Status" options={STATUS_OPTIONS} selected={f.status} onChange={f.setStatus} />
        <FilterDropdown label="Source" options={SOURCE_OPTIONS} selected={f.source} onChange={f.setSource} />
        <AssigneeFilter people={PEOPLE_OPTIONS} selected={f.owner} onChange={f.setOwner} unassignedCount={OWNER_COUNTS[UNASSIGNED]} />
      </Toolbar>
      <FilterChips chips={f.chips} onClearAll={f.clear} />
      <LeadList rows={f.apply(LEADS)} onClear={f.clear} />
    </Stage>
  );
}

let seq = 10;
function BuilderDemo() {
  const [conditions, setConditions] = useState<Condition[]>([
    { id: "c1", field: "score", op: "gt", value: "60" },
    { id: "c2", field: "status", op: "is_not", value: "lost" },
    { id: "c3", field: "owner", op: "is_not_empty", value: "" },
  ]);
  const [match, setMatch] = useState<Match>("and");
  const rows = applyConditions(LEADS, conditions, match, getField);
  return (
    <Stage className="flex flex-col gap-4">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-[var(--card-p)] shadow-[var(--card-shadow)]">
        <FilterBuilder fields={BUILDER_FIELDS} conditions={conditions} onChange={setConditions} match={match} onMatchChange={setMatch} newId={() => `c${++seq}`} />
      </div>
      <LeadList rows={rows} onClear={() => setConditions([])} />
    </Stage>
  );
}

function DateDemo() {
  const [range, setRange] = useState<DateRange>({ preset: "7d", from: "2026-10-13", to: TODAY });
  const rows = LEADS.filter((l) => inRange(l.created, range));
  return (
    <Stage className="flex flex-col gap-3">
      <Toolbar>
        <DateRangeFilter value={range} onChange={setRange} today={TODAY} />
        <span className="text-xs text-ink-3">Today is {shortDate(TODAY)} in this demo · {rangeLabel(range)}</span>
      </Toolbar>
      <LeadList rows={sortRows(rows, "desc", (l) => l.created)} onClear={() => setRange({ preset: "any", from: "", to: "" })} />
    </Stage>
  );
}

function StatusDemo() {
  const [sel, setSel] = useState<string[]>(["qualified"]);
  return (
    <Stage className="flex flex-col gap-3">
      <StatusFilter options={STATUS_OPTIONS} selected={sel} onChange={setSel} total={LEADS.length} />
      <LeadList rows={LEADS.filter((l) => !sel.length || sel.includes(l.status))} onClear={() => setSel([])} />
    </Stage>
  );
}

function AssigneeDemo() {
  const [sel, setSel] = useState<string[]>(["maya"]);
  return (
    <Stage className="flex flex-col gap-3">
      <Toolbar>
        <AssigneeFilter people={PEOPLE_OPTIONS} selected={sel} onChange={setSel} unassignedCount={OWNER_COUNTS[UNASSIGNED]} />
      </Toolbar>
      <LeadList rows={LEADS.filter((l) => !sel.length || sel.includes(l.owner ?? UNASSIGNED))} onClear={() => setSel([])} />
    </Stage>
  );
}

const SORTS = [
  { value: "score", label: "Score", dirLabels: ["Lowest first", "Highest first"] as [string, string] },
  { value: "value", label: "Deal value", dirLabels: ["Smallest first", "Largest first"] as [string, string] },
  { value: "created", label: "Created", dirLabels: ["Oldest first", "Newest first"] as [string, string] },
  { value: "company", label: "Company", dirLabels: ["A to Z", "Z to A"] as [string, string] },
];
const sortKey = (k: string) => (l: Lead) => (k === "score" ? l.score : k === "value" ? l.value : k === "created" ? l.created : l.company);

function SortDemo() {
  const [key, setKey] = useState("score");
  const [dir, setDir] = useState<SortDir>("desc");
  return (
    <Stage className="flex flex-col gap-3">
      <Toolbar>
        <SortDropdown options={SORTS} value={key} onChange={setKey} dir={dir} onDirChange={setDir} />
      </Toolbar>
      <LeadList rows={sortRows(LEADS, dir, sortKey(key))} />
    </Stage>
  );
}

function DirectionDemo() {
  const [key, setKey] = useState("created");
  const [dir, setDir] = useState<SortDir>("desc");
  const labels = SORTS.find((s) => s.value === key)?.dirLabels;
  return (
    <Stage className="flex flex-col gap-3">
      <Toolbar>
        <SortDropdown options={SORTS} value={key} onChange={setKey} />
        <SortDirectionToggle dir={dir} onChange={setDir} labels={labels} />
        <SortDirectionToggle dir={dir} onChange={setDir} labels={labels} showLabel={false} />
      </Toolbar>
      <LeadList rows={sortRows(LEADS, dir, sortKey(key))} />
    </Stage>
  );
}

function GroupDemo() {
  const [g, setG] = useState("status");
  const rows = sortRows(LEADS, "desc", (l) => l.score);
  const groups =
    g === "none"
      ? undefined
      : groupRows(rows, (l) => (g === "status" ? STATUS[l.status].label : g === "source" ? SOURCES[l.source] : l.owner ? PEOPLE[l.owner] : "Unassigned"));
  return (
    <Stage className="flex flex-col gap-3">
      <Toolbar>
        <GroupByControl
          value={g}
          onChange={setG}
          options={[
            { value: "status", label: "Status" },
            { value: "source", label: "Source" },
            { value: "owner", label: "Owner" },
          ]}
        />
      </Toolbar>
      <LeadList rows={rows} groups={groups} />
    </Stage>
  );
}

interface ViewState {
  status: string[];
  owner: string[];
  minScore: number;
}
const sameView = (a: ViewState, b: ViewState) => a.minScore === b.minScore && a.status.join() === b.status.join() && a.owner.join() === b.owner.join();
const viewRows = (v: ViewState) => LEADS.filter((l) => l.score >= v.minScore && (!v.status.length || v.status.includes(l.status)) && (!v.owner.length || v.owner.includes(l.owner ?? UNASSIGNED)));

function ViewsDemo() {
  const [views, setViews] = useState<{ id: string; name: string; state: ViewState }[]>([
    { id: "all", name: "All leads", state: { status: [], owner: [], minScore: 0 } },
    { id: "mine", name: "My leads", state: { status: [], owner: ["maya"], minScore: 0 } },
    { id: "hot", name: "Hot", state: { status: ["new", "contacted", "qualified"], owner: [], minScore: 80 } },
    { id: "unassigned", name: "Unassigned", state: { status: [], owner: [UNASSIGNED], minScore: 0 } },
  ]);
  const [active, setActive] = useState("all");
  const [cur, setCur] = useState<ViewState>(views[0].state);
  const activeView = views.find((v) => v.id === active) ?? views[0];
  const modified = !sameView(cur, activeView.state);
  const rows = viewRows(cur);
  return (
    <Stage className="flex flex-col gap-3">
      <SavedViews
        views={views.map((v) => ({ id: v.id, name: v.name, count: viewRows(v.state).length }))}
        activeId={active}
        modified={modified}
        onSelect={(id) => {
          setActive(id);
          setCur(views.find((v) => v.id === id)?.state ?? views[0].state);
        }}
        onReset={() => setCur(activeView.state)}
        onUpdate={() => setViews((vs) => vs.map((v) => (v.id === active ? { ...v, state: cur } : v)))}
        onSaveAs={(name) => {
          const id = `v-${views.length}-${name}`;
          setViews((vs) => [...vs, { id, name, state: cur }]);
          setActive(id);
        }}
        onDelete={(id) => setViews((vs) => vs.filter((v) => v.id !== id))}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <StatusFilter options={STATUS_OPTIONS} selected={cur.status} onChange={(status) => setCur((c) => ({ ...c, status }))} />
        <AssigneeFilter people={PEOPLE_OPTIONS} selected={cur.owner} onChange={(owner) => setCur((c) => ({ ...c, owner }))} unassignedCount={OWNER_COUNTS[UNASSIGNED]} />
      </div>
      <LeadList rows={rows} />
    </Stage>
  );
}

function ClearDemo() {
  const f = useFacets({ status: ["new"], source: ["instagram", "website"] });
  const [q, setQ] = useState("");
  const total = f.count + (q ? 1 : 0);
  return (
    <Stage className="flex flex-col gap-3">
      <Toolbar>
        <SearchField size="sm" label="Search leads" value={q} onChange={setQ} className="w-48" />
        <FilterDropdown label="Status" options={STATUS_OPTIONS} selected={f.status} onChange={f.setStatus} />
        <FilterDropdown label="Source" options={SOURCE_OPTIONS} selected={f.source} onChange={f.setSource} />
        <ClearFiltersButton
          count={total}
          onClear={() => {
            f.clear();
            setQ("");
          }}
        />
      </Toolbar>
      <LeadList rows={f.apply(LEADS).filter((l) => matchesQuery(searchText(l), q))} q={q} onClear={() => { f.clear(); setQ(""); }} />
    </Stage>
  );
}

function CounterDemo() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<Record<string, string[]>>({ status: ["new", "qualified"], owner: ["maya"] });
  const count = Object.values(value).filter((v) => v.length).length;
  const rows = useMemo(
    () => LEADS.filter((l) => (["status", "source", "owner"] as const).every((k) => !value[k]?.length || value[k].includes(k === "owner" ? (l.owner ?? UNASSIGNED) : l[k]))),
    [value],
  );
  return (
    <Stage className="flex flex-col gap-3">
      <Toolbar>
        <ActiveFilterCounter count={count} pressed={open} onClick={() => setOpen((o) => !o)} />
        <ActiveFilterCounter count={0} />
        {count ? (
          <Button size="sm" variant="ghost" onClick={() => setValue({})}>
            Clear
          </Button>
        ) : null}
      </Toolbar>
      <div className={open ? "grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]" : ""}>
        {open ? (
          <FilterSidebar
            groups={[
              { key: "status", label: "Status", options: STATUS_OPTIONS },
              { key: "source", label: "Source", options: SOURCE_OPTIONS },
              { key: "owner", label: "Owner", options: OWNER_OPTIONS },
            ]}
            value={value}
            onChange={setValue}
          />
        ) : null}
        <LeadList rows={rows} onClear={() => setValue({})} />
      </div>
    </Stage>
  );
}
