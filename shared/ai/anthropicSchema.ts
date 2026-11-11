import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

type Schema = Record<string, unknown>;
/** Native Claude optional fields stay optional. Unsupported bounds become instructions;
 * the original application Zod schema still enforces every bound after generation. */
export function claudeSchema(schema: unknown): Schema {
  const original = schema as Schema;
  const transformed = jsonSchemaOutputFormat(original as Parameters<typeof jsonSchemaOutputFormat>[0]).schema as Schema;
  // The installed SDK moves enum/const into descriptions. Both are supported by
  // the API: retain these finite choices in the actual grammar, not just prose.
  const retainChoices = (source: unknown, target: unknown) => {
    if (!source || !target || typeof source !== "object" || typeof target !== "object") return;
    const a = source as Schema, b = target as Schema;
    for (const key of ["enum", "const"]) if (key in a) b[key] = a[key];
    for (const key of ["properties", "$defs", "definitions"]) {
      const children = a[key] as Schema | undefined, output = b[key] as Schema | undefined;
      if (children && output) for (const name of Object.keys(children)) retainChoices(children[name], output[name]);
    }
    if (a.items && b.items) retainChoices(a.items, b.items);
    for (const key of ["anyOf", "allOf", "oneOf"]) {
      const variants = a[key], output = b[key === "oneOf" ? "anyOf" : key];
      if (Array.isArray(variants) && Array.isArray(output)) variants.forEach((child, i) => retainChoices(child, output[i]));
    }
  };
  retainChoices(original, transformed);
  return transformed;
}

/** API limits apply to the combined strict tool and output schemas, not each separately. */
export function claudeSchemaComplexity(schema: unknown): { optional: number; unions: number } {
  let optional = 0, unions = 0;
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const s = value as Schema;
    if (s.properties && typeof s.properties === "object") {
      const required = new Set(Array.isArray(s.required) ? s.required : []);
      for (const [key, child] of Object.entries(s.properties)) { if (!required.has(key)) optional++; visit(child); }
    }
    if (Array.isArray(s.type) || Array.isArray(s.anyOf) || Array.isArray(s.oneOf)) unions++;
    for (const key of ["$defs", "definitions"]) if (s[key] && typeof s[key] === "object") for (const child of Object.values(s[key])) visit(child);
    if (s.items) visit(s.items);
    for (const key of ["anyOf", "allOf", "oneOf"]) if (Array.isArray(s[key])) for (const child of s[key]) visit(child);
  };
  visit(schema); return { optional, unions };
}

/** Large strategy documents use validated JSON instructions instead of a grammar the API rejects.
 * The original application schema remains authoritative; invalid output is never persisted. */
export function claudeCanConstrain(schemas: unknown[], strictTools = 0): boolean {
  const counts = schemas.map(claudeSchemaComplexity);
  // Complex nested plan grammars can exceed the API's internal limit even below its explicit counts.
  // The live 5.2k plan schema was rejected; keep grammar constraints for small schemas only.
  return schemas.reduce<number>((sum, schema) => sum + JSON.stringify(schema).length, 0) <= 4000 && strictTools <= 20 && counts.reduce((sum, c) => sum + c.optional, 0) <= 24 && counts.reduce((sum, c) => sum + c.unions, 0) <= 16;
}
