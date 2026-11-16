import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { groupVoiceThemes, type VoiceThemeSource } from "../../shared/reviews/voiceThemes";

/** Shared, read-only sample for owner review and later strategy preparation. */
export async function customerVoice(ctx: QueryCtx, orgId: Id<"organizations">) {
  const now = Date.now();
  const cutoff = now - 180 * 86_400_000;
  const [messageRows, dealRows, feedback] = await Promise.all([
    ctx.db.query("communityMessages").withIndex("by_org_received", q => q.eq("orgId", orgId).gte("receivedAt", cutoff).lte("receivedAt", now))
      .filter(q => q.neq(q.field("isFixture"), true)).order("desc").take(501),
    ctx.db.query("deals").withIndex("by_org_updated", q => q.eq("orgId", orgId)).order("desc").take(251),
    ctx.db.query("voiceThemeFeedback").withIndex("by_org_theme", q => q.eq("orgId", orgId)).collect(),
  ]);
  const messages: VoiceThemeSource[] = messageRows.slice(0, 500).map(message => ({
    id: String(message._id),
    kind: /^review(?::|-url:)/.test(message.externalId) ? "owner-pasted review" : message.kind,
    channel: message.channel, text: message.text, receivedAt: message.receivedAt,
    redact: [message.authorName, message.fromEmail ?? ""],
    ...(message.reviewSourceUrl ? { sourceUrl: message.reviewSourceUrl } : {}),
  }));
  const notes: VoiceThemeSource[] = dealRows.slice(0, 250).flatMap(deal => deal.notes
    .map((note, index) => ({ id: `deal:${deal._id}:${index}:${note.at}`, kind: "owner-entered CRM note", channel: "CRM", text: note.text, receivedAt: note.at, redact: [deal.name, deal.email ?? ""] }))
    .filter(note => Number.isFinite(note.receivedAt) && note.receivedAt >= cutoff && note.receivedAt <= now));
  const all = [...messages, ...notes].sort((a, b) => b.receivedAt - a.receivedAt || a.id.localeCompare(b.id));
  const sources = all.slice(0, 500);
  const byKey = new Map(feedback.map(row => [row.themeKey, row]));
  const themes = groupVoiceThemes(sources).map(theme => {
    const saved = byKey.get(theme.key);
    return { ...theme, suggestedLabel: theme.label,
      status: saved?.status ?? "suggested" as const,
      label: saved?.status === "corrected" ? saved.correctedLabel ?? theme.label : theme.label,
      ownerNote: saved?.note ?? null, reviewedAt: saved?.updatedAt ?? null,
    };
  });
  return { themes, sourceCount: sources.length, windowDays: 180, sampleLimit: 500, minimumRepeatedSources: 2,
    capturedAt: now, limited: messageRows.length > 500 || dealRows.length > 250 || all.length > 500,
    scope: "Up to 500 recent non-demo messages and notes from the 250 most recently updated CRM deals, combined into at most 500 records from the last 180 days. Counts are matching records, not unique customers. Dates are stored receipt or note times, not independently verified publication dates. English phrase matching can group praise, complaints and negated statements together; it does not establish sentiment, prevalence, demand or causation. Pasted reviews and CRM notes are owner-reported; other messages are source-reported, not authenticated customer testimony.",
  };
}
