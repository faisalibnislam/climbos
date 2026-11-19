import { expect, it } from "vitest";
import { computeProductFunnel, productFunnelBrief, type ProductFunnelDefinition, type ProductFunnelEvent } from "../../shared/growth/productFunnels";
const DAY = 86_400_000, now = Date.UTC(2026, 10, 19, 12);
const definition: ProductFunnelDefinition = { name: "Useful exports", sourceId: "source", scope: "App", entity: "person", entryEvent: "signup", activationEvent: "export", returnEvent: "export", activationDays: 3, returnStartDay: 7, returnEndDay: 14, lookbackDays: 30 };
const event = (contactId: string, event: string, daysAgo: number, id = `${contactId}-${event}-${daysAgo}`): ProductFunnelEvent => ({ contactId, event, occurredAt: now - daysAgo * DAY, eventIdHash: id, outcome: "applied" });
const compute = (events: ProductFunnelEvent[], d = definition) => computeProductFunnel(d, events, { now, totalReceipts: events.length, excludedContacts: 0, excludedEvents: 0 });
it("separates mature activation/return sequences and immature people without treating pending as failure", () => {
  const r = compute([event("a", "signup", 25), event("a", "export", 24), event("a", "export", 15), event("b", "signup", 25), event("b", "export", 25), event("c", "signup", 5), event("c", "export", 4)]);
  expect(r.entered).toBe(3); expect(r.activation).toEqual({ eligible: 2, observed: 1, pending: 1, rate: 0.5 }); expect(r.returnUse).toEqual({ eligible: 2, observed: 1, pending: 1, rate: 0.5 });
  expect(productFunnelBrief([r])).toContain("never verified failure or churn");
});
it("counts explicit account identities once across people and withholds when account IDs are missing", () => {
  const events = [event("a", "signup", 25), event("b", "signup", 24), event("b", "export", 24), event("a", "export", 15)].map(e => ({ ...e, accountHash: "account-1" }));
  expect(compute(events, { ...definition, entity: "account" })).toMatchObject({ entered: 1, activation: { observed: 1 }, returnUse: { observed: 1 } });
  expect(compute([...events, event("c", "signup", 26)], { ...definition, entity: "account" })).toMatchObject({ entered: null, issue: expect.stringContaining("missing explicit account") });
});
it("orders delayed events by occurrence, deduplicates equal events and rejects changed event identities", () => {
  const a = event("a", "signup", 25), b = event("a", "export", 24);
  expect(compute([b, a, b])).toMatchObject({ entered: 1, activation: { observed: 1 } });
  expect(compute([a, { ...a, occurredAt: a.occurredAt + 1 }]).issue).toContain("Conflicting");
});
it("uses exact elapsed windows and requires a distinct later repeat event", () => {
  const entry = event("a", "signup", 25);
  const first = { ...event("a", "export", 22), occurredAt: entry.occurredAt + 3 * DAY };
  expect(compute([entry, first, event("a", "export", 18)]).returnUse.observed).toBe(1); // inclusive day 7
  expect(compute([entry, first, event("a", "export", 11)]).returnUse.observed).toBe(0); // exclusive day 14
  expect(compute([entry, { ...first, occurredAt: first.occurredAt + 1 }]).activation.observed).toBe(0);
});
it("keeps the last possible late-arrival instant pending", () => {
  const e = event("a", "signup", 10);
  expect(compute([e]).activation).toMatchObject({ eligible: 0, pending: 1, rate: null });
  expect(computeProductFunnel(definition, [e], { now: now + 1, totalReceipts: 1, excludedContacts: 0, excludedEvents: 0 }).activation).toMatchObject({ eligible: 1, pending: 0, rate: 0 });
});
it("keeps unavailable evidence separate from zero observed matching events", () => {
  expect(compute([])).toMatchObject({ entered: 0, activation: { rate: null } });
  expect(computeProductFunnel(definition, [], { now, totalReceipts: 1000, excludedContacts: 0, excludedEvents: 0 })).toMatchObject({ entered: null, issue: expect.stringContaining("bound") });
  expect(computeProductFunnel(definition, [], { now, totalReceipts: 0, excludedContacts: 0, excludedEvents: 0, issue: "Source unavailable" })).toMatchObject({ entered: null, issue: "Source unavailable" });
});
it.each([{ activationDays: 0 }, { activationDays: NaN }, { returnStartDay: 1 }, { returnEndDay: 7 }, { lookbackDays: 31 }, { lookbackDays: 20 }, { entryEvent: "export" }])("withholds invalid measurement contracts %j", patch => {
  expect(compute([], { ...definition, ...patch }).issue).toContain("need review");
});
it("does not merge disputed evidence or treat events without entry as known entrants", () => {
  const r = compute([event("a", "signup", 25), { ...event("a", "export", 24), outcome: "conflict" }, event("b", "export", 24)]);
  expect(r.entered).toBe(0); expect(r.excludedEvents).toBe(2);
});
it("uses 30 UTC dates including today, staying inside actual receipt retention", () => {
  const r = compute([event("a", "signup", 30), event("b", "signup", 29)]);
  expect(r.entered).toBe(1); expect(r.from).toBe("2026-10-21");
});
