/*
 * Small, dependency-free diff for comparing plan versions: lines first (LCS), then words
 * inside lines that changed. Inputs are capped so a huge plan can't stall the page.
 */

export interface WordOp {
  t: "same" | "add" | "del";
  text: string;
}

/** One aligned row of a side-by-side diff. `left`/`right` are null where that side has no line. */
export interface DiffRow {
  kind: "same" | "changed" | "added" | "removed";
  left: WordOp[] | null;
  right: WordOp[] | null;
}

const MAX_CELLS = 250_000;

function lcs<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): [number, number][] {
  if (a.length * b.length > MAX_CELLS) return [];
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = eq(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

/** Word-level diff of two strings (whitespace kept so text reads naturally). */
export function wordDiff(a: string, b: string): { left: WordOp[]; right: WordOp[] } {
  const ta = a.split(/(\s+)/).filter(Boolean);
  const tb = b.split(/(\s+)/).filter(Boolean);
  const pairs = lcs(ta, tb, (x, y) => x === y);
  if (!pairs.length && (ta.length || tb.length)) return { left: [{ t: "del", text: a }], right: [{ t: "add", text: b }] };
  const left: WordOp[] = [];
  const right: WordOp[] = [];
  const push = (arr: WordOp[], t: WordOp["t"], text: string) => {
    const last = arr[arr.length - 1];
    if (last && last.t === t) last.text += text;
    else arr.push({ t, text });
  };
  let i = 0;
  let j = 0;
  for (const [pi, pj] of [...pairs, [ta.length, tb.length] as [number, number]]) {
    while (i < pi) push(left, "del", ta[i++]);
    while (j < pj) push(right, "add", tb[j++]);
    if (pi < ta.length && pj < tb.length) {
      push(left, "same", ta[pi]);
      push(right, "same", tb[pj]);
      i = pi + 1;
      j = pj + 1;
    }
  }
  return { left, right };
}

/** Side-by-side rows: unchanged lines pair up; runs of removed/added lines pair as "changed" with word highlights. */
export function lineDiff(a: string[], b: string[]): DiffRow[] {
  const pairs = lcs(a, b, (x, y) => x === y);
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  const flush = (dels: string[], adds: string[]) => {
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) {
      const d = dels[k];
      const ad = adds[k];
      if (d !== undefined && ad !== undefined) {
        const w = wordDiff(d, ad);
        rows.push({ kind: "changed", left: w.left, right: w.right });
      } else if (d !== undefined) rows.push({ kind: "removed", left: [{ t: "del", text: d }], right: null });
      else if (ad !== undefined) rows.push({ kind: "added", left: null, right: [{ t: "add", text: ad }] });
    }
  };
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    flush(a.slice(i, pi), b.slice(j, pj));
    if (pi < a.length && pj < b.length) rows.push({ kind: "same", left: [{ t: "same", text: a[pi] }], right: [{ t: "same", text: b[pj] }] });
    i = pi + 1;
    j = pj + 1;
  }
  return rows;
}
