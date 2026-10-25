import catalog from "./industryBusinessCatalog.generated.json";

export type IndustryBusinessType = (typeof catalog)[number];
export const INDUSTRY_BUSINESS_TYPES: readonly IndustryBusinessType[] = catalog;
const byName = new Map(catalog.map((business) => [business.name.toLocaleLowerCase("en-US"), business]));
const byId = new Set(catalog.map((business) => business.id));

export function industryBusinessTypeByName(name: string): IndustryBusinessType | undefined {
  return byName.get(name.trim().toLocaleLowerCase("en-US"));
}

export function isIndustryBusinessTypeId(id: string): boolean {
  return byId.has(id);
}
