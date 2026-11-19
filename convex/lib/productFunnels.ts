import { computeProductFunnel, type ProductFunnelDefinition } from "../../shared/growth/productFunnels";
import { progressScopeKey } from "../../shared/growth/customerProgress";
import { PRODUCT_EVENT_LIMIT } from "../../shared/growth/productTracking";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Tenant-local source observations; no inference from missing contacts/events or disputed manual reports. */
export async function productFunnelAssessments(ctx: QueryCtx, orgId: Id<"organizations">, now: number) {
  const [definitions, receipts] = await Promise.all([
    ctx.db.query("productFunnels").withIndex("by_org", q => q.eq("orgId", orgId)).take(21),
    ctx.db.query("productEvents").withIndex("by_org", q => q.eq("orgId", orgId)).take(PRODUCT_EVENT_LIMIT + 1),
  ]);
  if (!definitions.length) return [];
  const contacts = new Map<string, { active: boolean; progress: Doc<"contactProgress"> | null }>();
  for (const id of new Set(receipts.map(e => e.contactId))) {
    const contact = await ctx.db.get(id);
    const progress = await ctx.db.query("contactProgress").withIndex("by_org_contact", q => q.eq("orgId", orgId).eq("contactId", id)).take(2);
    contacts.set(id, { active: contact?.orgId === orgId && contact.deletedAt === undefined && progress.length === 1, progress: progress.length === 1 ? progress[0] : null });
  }
  return await Promise.all(definitions.slice(0, 20).map(async row => {
    const source = await ctx.db.get(row.sourceId);
    const definition: ProductFunnelDefinition = { name: row.name, sourceId: row.sourceId, scope: row.scope, entity: row.entity, entryEvent: row.entryEvent, activationEvent: row.activationEvent, returnEvent: row.returnEvent, activationDays: row.activationDays, returnStartDay: row.returnStartDay, returnEndDay: row.returnEndDay, lookbackDays: row.lookbackDays };
    const excluded = new Set<string>(); let excludedEvents = 0;
    const events = receipts.filter(e => {
      if (e.sourceId !== row.sourceId) return false;
      const context = contacts.get(e.contactId), reports = context?.progress?.progress.current.filter(r => progressScopeKey(r.scope) === progressScopeKey(row.scope));
      const current = reports?.length === 1 ? reports[0] : undefined;
      if (!context?.active || !current?.source || current.source.conflict) { excluded.add(e.contactId); excludedEvents++; return false; }
      if (current.tracking && e.occurredAt <= current.tracking.after) { excludedEvents++; return false; }
      return true;
    });
    const issue = definitions.length > 20 ? "Saved definitions exceed the review bound." : !source || source.orgId !== orgId || source.scope !== row.scope || [row.entryEvent, row.activationEvent, row.returnEvent].some(e => !source.mappings.some(m => m.event === e)) ? "The original source or event definitions are unavailable." : undefined;
    return { id: row._id, createdAt: row.createdAt, assessment: computeProductFunnel(definition, events, { now, totalReceipts: receipts.length, excludedContacts: excluded.size, excludedEvents, issue }) };
  }));
}
