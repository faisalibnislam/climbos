/**
 * Prompt context that fits a budget without silent cuts: JSON stays valid
 * (trailing list items go first, then the longest strings are shortened) and
 * every drop is reported so the run logs show what the model didn't see.
 */

export interface Fitted {
  text: string;
  /** What was left out, e.g. "plays[3]" or "notes: 8,120 chars". Empty = nothing dropped. */
  dropped: string[];
}

type Json = unknown;

function arrays(v: Json, path: string, out: { path: string; arr: Json[] }[]) {
  if (Array.isArray(v)) {
    out.push({ path, arr: v });
    v.forEach((x, i) => arrays(x, `${path}[${i}]`, out));
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) arrays(x, path ? `${path}.${k}` : k, out);
  }
}

function strings(v: Json, path: string, out: { path: string; set: (s: string) => void; value: string }[], parent?: Record<string, Json> | Json[], key?: string | number) {
  if (typeof v === "string" && parent !== undefined && key !== undefined) out.push({ path, value: v, set: (s) => ((parent as Record<string | number, Json>)[key] = s) });
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}[${i}]`, out, v, i));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) strings(x, path ? `${path}.${k}` : k, out, v as Record<string, Json>, k);
}

/** JSON of `value` within `maxChars`, dropping the last items of the largest lists first. */
export function fitJson(value: Json, maxChars: number, label = ""): Fitted {
  let text = JSON.stringify(value) ?? "null";
  if (text.length <= maxChars) return { text, dropped: [] };
  const copy = JSON.parse(text) as Json;
  const dropped: string[] = [];
  const at = (p: string) => (label ? `${label}.${p}` : p) || label;
  for (let guard = 0; text.length > maxChars && guard < 10_000; guard++) {
    const lists: { path: string; arr: Json[] }[] = [];
    arrays(copy, "", lists);
    const trimmable = lists.filter((l) => l.arr.length > 1).sort((a, b) => JSON.stringify(b.arr).length - JSON.stringify(a.arr).length);
    if (trimmable.length) {
      const l = trimmable[0];
      l.arr.pop();
      dropped.push(at(`${l.path}[${l.arr.length}]`));
    } else {
      const strs: { path: string; set: (s: string) => void; value: string }[] = [];
      strings(copy, "", strs);
      const longest = strs.sort((a, b) => b.value.length - a.value.length)[0];
      if (!longest || longest.value.length < 40) break;
      const keep = Math.floor(longest.value.length / 2);
      longest.set(`${longest.value.slice(0, keep)}…`);
      dropped.push(at(`${longest.path}: ${(longest.value.length - keep).toLocaleString("en-US")} chars`));
    }
    text = JSON.stringify(copy);
  }
  return { text, dropped };
}

/** Plain text within `maxChars`, cut at a line break, with a visible note of what was left out. */
export function fitText(text: string, maxChars: number, label = "text"): Fitted {
  if (text.length <= maxChars) return { text, dropped: [] };
  const room = Math.max(0, maxChars - 60);
  const cut = text.lastIndexOf("\n", room);
  const end = cut > room * 0.6 ? cut : room;
  const left = text.length - end;
  return { text: `${text.slice(0, end)}\n[${left.toLocaleString("en-US")} more characters not shown]`, dropped: [`${label}: ${left.toLocaleString("en-US")} chars`] };
}

/** One log line per trimmed block, so truncation is visible in Convex logs. */
export function reportDropped(where: string, f: Fitted): string {
  if (f.dropped.length) console.warn(`[context-trim] ${where}: dropped ${f.dropped.length} (${f.dropped.slice(0, 8).join("; ")}${f.dropped.length > 8 ? "; …" : ""})`);
  return f.text;
}
