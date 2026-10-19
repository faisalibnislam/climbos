import { describe, expect, it } from "vitest";
import { z } from "zod";
import { normalizeNulls } from "../../shared/ai/openai";
import { jsonSchemaFor } from "../../shared/ai/types";

/** REQ-EVID-08 / §5.2: a genuine unknown (null) survives structured-output normalisation. */
const Schema = z.object({
  churn: z.number().nullable(),
  note: z.string().optional(),
  nested: z.object({ margin: z.number().nullable(), label: z.string().optional() }),
  rows: z.array(z.object({ rate: z.number().nullable(), source: z.string().optional() })),
});

describe("structured-output nulls", () => {
  it("keeps required nullable fields as null and drops nulls on optional keys", () => {
    const raw = { churn: null, note: null, nested: { margin: null, label: null }, rows: [{ rate: null, source: null }, { rate: 0, source: "x" }] };
    const parsed = Schema.parse(normalizeNulls(raw, jsonSchemaFor(Schema)));
    expect(parsed).toEqual({ churn: null, nested: { margin: null }, rows: [{ rate: null }, { rate: 0, source: "x" }] });
  });

  it("known zero is kept as zero, never confused with unknown", () => {
    expect(Schema.parse(normalizeNulls({ churn: 0, nested: { margin: 0 }, rows: [] }, jsonSchemaFor(Schema))).churn).toBe(0);
  });
});
