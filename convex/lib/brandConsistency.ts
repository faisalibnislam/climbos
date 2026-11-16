import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { BRAND_PATTERN_KEYS, brandPatterns, designTokens, type BrandObservation, type BrandPatternKey, type BrandSource } from "../../shared/agents/brandConsistency";
import { sha256Hex } from "../../shared/policy";

/** Saved same-tenant sources only; draft assets are explicitly unapproved for publication. */
export async function brandConsistencyMap(ctx: QueryCtx, orgId: Id<"organizations">) {
  const [business, pages, designs] = await Promise.all([
    ctx.db.query("businesses").withIndex("by_org", q => q.eq("orgId", orgId)).first(),
    ctx.db.query("landingPages").withIndex("by_org", q => q.eq("orgId", orgId)).order("desc").take(31),
    ctx.db.query("designs").withIndex("by_org_updated", q => q.eq("orgId", orgId)).order("desc").take(31),
  ]);
  const brand = business ? await ctx.db.query("brandProfiles").withIndex("by_business", q => q.eq("businessId", business._id)).first() : null;
  const approved = brand?.orgId === orgId && brand.ownerConfirmedAt !== undefined;
  const rules = approved ? { confirmedAt: brand.ownerConfirmedAt!, voice: brand.voice, toneWords: brand.toneWords, colors: brand.colors, doNots: brand.doNots } : null;
  const rulesHash = await sha256Hex(JSON.stringify(rules));
  const observations: Partial<Record<BrandPatternKey, BrandObservation[]>> = {};
  const add = (key: BrandPatternKey, source: BrandSource, values: string[]) => { (observations[key] ??= []).push({ source, values }); };
  let incomplete = 0;
  for (const page of pages.slice(0, 30)) {
    if (page.status !== "live") continue;
    if (page.publishedVersion === undefined || !page.publishedContent || !page.publishedColor) { incomplete++; continue; }
    const snapshot = { content: page.publishedContent, color: page.publishedColor, title: page.publishedTitle ?? page.title };
    const hash = await sha256Hex(JSON.stringify(snapshot));
    const source: BrandSource = { kind: "page", id: page._id, title: snapshot.title, version: `Published v${page.publishedVersion}`, approval: "published_version", updatedAt: page.updatedAt, hash };
    if (/^#[0-9a-f]{6}$/i.test(snapshot.color)) add("page_accent", source, [snapshot.color.toLowerCase()]);
    try { const cta = JSON.parse(snapshot.content)?.ctaLabel; if (typeof cta === "string" && cta.trim()) add("page_cta", source, [cta.trim().slice(0, 160)]); } catch { incomplete++; }
  }
  for (const design of designs.slice(0, 30)) {
    if (design.archived) continue;
    const hash = await sha256Hex(design.doc);
    const source: BrandSource = { kind: "design", id: design._id, title: design.title, version: `Saved snapshot ${hash.slice(0, 12)}`, approval: "saved_draft", updatedAt: design.updatedAt, hash };
    const tokens = designTokens(design.doc);
    if (tokens.limited) incomplete++;
    add("design_background", source, tokens.background);
    add("design_fonts", source, tokens.fonts);
    add("design_colors", source, tokens.colors);
  }
  const patterns = await Promise.all(brandPatterns(observations, rules?.colors ?? []).map(async pattern => ({ ...pattern,
    fingerprint: await sha256Hex(JSON.stringify({ key: pattern.key, rulesHash, observations: pattern.observations.map(row => ({ id: row.source.id, hash: row.source.hash, version: row.source.version, values: row.values })).sort((a, b) => a.id.localeCompare(b.id)) })),
  })));
  const history = (await Promise.all(BRAND_PATTERN_KEYS.map(key => ctx.db.query("brandPatternDecisions").withIndex("by_org_key_at", q => q.eq("orgId", orgId).eq("key", key)).order("desc").take(5)))).flat();
  return { rules, patterns, limited: pages.length > 30 || designs.length > 30 || incomplete > 0,
    scope: "Up to 30 newest hosted-page records and 30 most recently updated saved designs. Only live pages with explicit published snapshots are compared. Design assets remain drafts. External sites, image pixels, rendered layout and accessibility are not inspected here.",
    decisions: history.map(({ _id, key, state, note, at, fingerprint, snapshot }) => ({ id: _id, key, state, note, at, snapshot, current: patterns.some(pattern => pattern.key === key && pattern.fingerprint === fingerprint) })),
  };
}

export async function brandConsistencyBrief(ctx: QueryCtx, orgId: Id<"organizations">) {
  // Do not pay for source collection on workspaces that have never reviewed a pattern.
  const exists = await ctx.db.query("brandPatternDecisions").withIndex("by_org_key_at", q => q.eq("orgId", orgId)).first();
  if (!exists) return "";
  const map = await brandConsistencyMap(ctx, orgId);
  const latest = BRAND_PATTERN_KEYS.map(key => map.decisions.find(d => d.key === key)).filter(d => d !== undefined).sort((a, b) => b.at - a.at);
  const records = latest.map(d => ({ key: d.key, state: d.state, note: d.note, at: d.at, current: d.current, sources: d.current ? map.patterns.find(p => p.key === d.key)?.observations.slice(0, 3).map(o => ({ kind: o.source.kind, id: o.source.id, version: o.source.version, hash: o.source.hash, values: o.values.slice(0, 3).map(value => value.slice(0, 80)) })) : "Source or brand context changed; review again. Do not apply this prior decision as a current rule." }));
  let size = 0;
  const decisions = records.filter(record => { const n = JSON.stringify(record).length; if (size + n > 8_000) return false; size += n; return true; });
  return JSON.stringify({ scope: `${map.scope} Advice context samples at most three exact sources and three shortened values per decision within an 8,000-character record budget; do not extend a decision to an unlisted source. Full snapshots remain in the brand map.`, limited: map.limited || decisions.length < records.length, decisions });
}
