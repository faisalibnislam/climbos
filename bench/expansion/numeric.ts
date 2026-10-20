/**
 * Deterministic number checks for the expansion cases. A case passes a check
 * when the answer states the expected value in any usual written form:
 * 0.3 / 30% / 30.0%; 21 / $21 / 1,800; for small differences, "1 percentage
 * point" / "1 pp". It never grades reasoning, only whether the right number appears.
 */

export interface NumberResult {
  formula: string;
  expected: number;
  found: boolean;
  /** The written form that matched, when found. */
  as?: string;
}

const trimZeros = (s: string) => (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s);
const fixed = (n: number, d: number) => trimZeros(n.toFixed(d));

/** Written forms a value may take (without surrounding context). */
export function writtenForms(v: number): string[] {
  const forms = new Set<string>();
  const add = (s: string) => forms.add(s);
  if (Number.isInteger(v) || Math.abs(v) >= 1) {
    const r = Math.round(v * 100) / 100;
    add(fixed(r, 2));
    add(r.toLocaleString("en-US", { maximumFractionDigits: 2 }));
  }
  if (Math.abs(v) > 0 && Math.abs(v) < 1) {
    // As a share: 0.3, 0.30, 0.067
    for (const d of [1, 2, 3]) {
      add(fixed(v, d));
      add(v.toFixed(d));
    }
    // As a percent: 30%, 30.0%, 6.7%, 6.67%, 7%
    const pct = v * 100;
    for (const d of [0, 1, 2]) {
      const p = fixed(pct, d);
      add(`${p}%`);
      add(`${p} %`);
      add(`${p} percent`);
      add(`${p} percentage point`);
      add(`${p} pp`);
      add(`${p}pp`);
      add(`${p} points`);
      add(`${p} point`);
    }
  }
  return [...forms].filter((f) => f !== "0" && f !== "0%");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whether `text` states `v` in a usual form, as a whole number token (so 21 doesn't match 210 or 2.1). */
export function statesNumber(text: string, v: number): string | null {
  const t = text.replace(/(\d),(?=\d{3}\b)/g, "$1");
  for (const f of writtenForms(v)) {
    const plain = f.replace(/,/g, "");
    const re = new RegExp(`(?<![\\d.])\\$?${escapeRe(plain)}(?![\\d]|\\.\\d)`, "i");
    if (re.test(t)) return f;
  }
  return null;
}

export function checkNumbers(text: string, checks: { formula: string; expected: number }[]): NumberResult[] {
  return checks.map((c) => {
    const as = statesNumber(text, c.expected);
    return { formula: c.formula, expected: c.expected, found: as !== null, ...(as ? { as } : {}) };
  });
}
