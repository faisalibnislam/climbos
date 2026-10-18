import { v } from "convex/values";
import { AIRLY_APPS, isAirlyApp, type AirlyApp } from "../shared/airly";
import { planMarkdown, planTasks } from "../shared/airly/plan";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { decryptSecret, encryptSecret } from "./lib/crypto";
import { appError } from "./lib/tenancy";

const AAD = (orgId: string) => `climbos:${orgId}:airly`;

async function call(base: string, token: string, path: string, init: RequestInit = {}) {
  if (process.env.CLIMBOS_FAKE_AIRLY) return fake(path, init);
  const res = await fetch(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    const err = body?.error;
    const message = typeof err === "string" ? err : (err as { message?: string } | undefined)?.message ?? (body?.message as string | undefined) ?? `HTTP ${res.status}`;
    throw new Error(res.status === 401 ? "The token was rejected. Check it's the right one and still active." : res.status === 403 ? `Not allowed: ${message}` : message);
  }
  return body ?? {};
}

/** Test doubles (CLIMBOS_FAKE_AIRLY): the shapes each app returns. */
function fake(path: string, init: RequestInit): Record<string, unknown> {
  if (path === "/forms") return { data: [{ id: "f1", title: "Contact us", status: "published" }] };
  if (path.startsWith("/forms/f1/responses")) {
    const after = Number(/after=(\d+)/.exec(path)?.[1] ?? 0);
    const at = Math.floor(Date.now() / 86_400_000) * 86_400_000 - 86_400_000;
    return after < at ? { data: [{ id: "r1", submittedAtMs: at, submittedAt: new Date(at).toISOString(), complete: true, respondent: { name: "Ana Lopez", email: "ana@x.example", company: "Lopez Dental" }, answers: [{ key: "message", question: "How can we help?", value: "We need more patients" }] }], hasMore: false, next: at } : { data: [], hasMore: false, next: null };
  }
  if (path.startsWith("/bookings")) return { object: "list", data: [{ id: "b1", meeting_name: "Intro call", starts_at: "2030-01-01T10:00:00.000Z", status: "booked", guest_name: "Ben", guest_email: "ben@x.example", created_at: "2029-12-30T10:00:00.000Z" }], has_more: false };
  if (path === "/boards") return { workspace: { id: "w1", name: "Team" }, boards: [{ id: "bd1", name: "Growth", lists: [{ id: "l1", name: "To do" }] }] };
  if (path === "/tasks" && init.method === "POST") return { id: "t1", key: "G-1", title: "x", url: "https://app.taskeni.app/t/1" };
  if (path === "/places") return { data: [{ id: "personal", name: "Personal" }] };
  if (path === "/notes" && init.method === "POST") return { id: "n1", title: "x", url: "https://app.folevi.com/n/1" };
  return {};
}

async function access(ctx: ActionCtx, slug: string) {
  const a = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "manage_connections" });
  if (!a) throw appError("NOT_FOUND", "We couldn't find that workspace.");
  return a;
}

async function tokenFor(ctx: ActionCtx, orgId: Id<"organizations">, app: AirlyApp) {
  const l = await ctx.runQuery(internal.airly.linkFor, { orgId, app });
  if (!l) throw appError("INVALID", `Connect ${AIRLY_APPS[app].name} first.`);
  const token = await decryptSecret({ keyId: l.tokenKeyId, iv: l.tokenIv, ciphertext: l.tokenCiphertext }, AAD(orgId));
  const settings = l.settings ? (JSON.parse(l.settings) as Record<string, string>) : {};
  return { link: l, token, base: settings.base ?? AIRLY_APPS[app].base!, settings };
}

/** Connect an app with the owner's token: verify it with a cheap read, then store it encrypted. */
export const connect = action({
  args: { slug: v.string(), app: v.string(), token: v.string(), base: v.optional(v.string()) },
  handler: async (ctx, a): Promise<{ ok: boolean; message: string }> => {
    const acc = await access(ctx, a.slug);
    if (!isAirlyApp(a.app)) return { ok: false, message: "Unknown app." };
    const meta = AIRLY_APPS[a.app];
    const token = a.token.trim();
    if (!meta.tokenPattern.test(token)) return { ok: false, message: `That doesn't look like a ${meta.name} token. ${meta.tokenHelp}` };
    let base = meta.base;
    if (!base) {
      const b = (a.base ?? "").trim().replace(/\/+$/, "");
      if (!/^https:\/\/[a-z0-9-]+\.convex\.site\/api\/v1$/i.test(b) && !/^https:\/\/[a-z0-9.-]+\/api\/v1$/i.test(b)) return { ok: false, message: "Paste the API base shown next to your token (it ends with /api/v1)." };
      base = b;
    }
    let label = meta.name;
    const settings: Record<string, string> = meta.base ? {} : { base };
    try {
      if (a.app === "formkit") {
        const r = (await call(base, token, "/forms")) as { data?: unknown[] };
        label = `${r.data?.length ?? 0} forms`;
      } else if (a.app === "meetrao") {
        await call(base, token, "/bookings?limit=1");
      } else if (a.app === "taskeni") {
        const r = (await call(base, token, "/boards")) as { workspace?: { name: string }; boards?: { id: string; name: string }[] };
        label = r.workspace?.name ?? "Taskeni";
        if (r.boards?.[0]) settings.board = r.boards[0].id;
      } else {
        const r = (await call(base, token, "/places")) as { data?: { id: string; name: string }[] };
        label = r.data?.map((p) => p.name).join(", ") || "Folevi";
        if (r.data?.[0]) settings.place = r.data[0].id;
      }
    } catch (e) {
      return { ok: false, message: (e as Error).message.slice(0, 200) };
    }
    const sealed = await encryptSecret(token, AAD(acc.orgId));
    await ctx.runMutation(internal.airly.saveLink, { orgId: acc.orgId, userId: acc.userId, app: a.app, sealed, label, settings: JSON.stringify(settings) });
    if (a.app === "formkit" || a.app === "meetrao") {
      const l = await ctx.runQuery(internal.airly.linkFor, { orgId: acc.orgId, app: a.app });
      if (l) await ctx.scheduler.runAfter(0, internal.airlyActions.syncOne, { id: l._id });
    }
    return { ok: true, message: `Connected ${meta.name}.` };
  },
});

export const disconnect = action({
  args: { slug: v.string(), app: v.string() },
  handler: async (ctx, { slug, app }) => {
    const acc = await access(ctx, slug);
    const l = await ctx.runQuery(internal.airly.linkFor, { orgId: acc.orgId, app });
    if (l) await ctx.runMutation(internal.airly.removeLink, { orgId: acc.orgId, id: l._id });
  },
});

/** Taskeni boards / Folevi places to choose from. */
export const options = action({
  args: { slug: v.string(), app: v.string() },
  handler: async (ctx, { slug, app }): Promise<{ id: string; name: string }[]> => {
    const acc = await access(ctx, slug);
    if (app !== "taskeni" && app !== "folevi") return [];
    const t = await tokenFor(ctx, acc.orgId, app);
    if (app === "taskeni") return (((await call(t.base, t.token, "/boards")) as { boards?: { id: string; name: string }[] }).boards ?? []).map((b) => ({ id: b.id, name: b.name }));
    return (((await call(t.base, t.token, "/places")) as { data?: { id: string; name: string }[] }).data ?? []).map((p) => ({ id: p.id, name: p.name }));
  },
});

export const choose = action({
  args: { slug: v.string(), app: v.string(), value: v.string() },
  handler: async (ctx, { slug, app, value }) => {
    const acc = await access(ctx, slug);
    if (app !== "taskeni" && app !== "folevi") return;
    const t = await tokenFor(ctx, acc.orgId, app);
    await ctx.runMutation(internal.airly.setSettings, { id: t.link._id, settings: JSON.stringify({ ...t.settings, [app === "taskeni" ? "board" : "place"]: value.slice(0, 100) }) });
  },
});

/** Pull new Formkit responses or Meetrao bookings for one link. */
export const syncOne = internalAction({
  args: { id: v.id("airlyLinks") },
  handler: async (ctx, { id }): Promise<void> => {
    const l: Doc<"airlyLinks"> | null = await ctx.runQuery(internal.airly.linkById, { id });
    if (!l || (l.app !== "formkit" && l.app !== "meetrao")) return;
    let token: string;
    try {
      token = await decryptSecret({ keyId: l.tokenKeyId, iv: l.tokenIv, ciphertext: l.tokenCiphertext }, AAD(l.orgId));
    } catch {
      await ctx.runMutation(internal.airly.markSync, { id, error: "Reconnect this app." });
      return;
    }
    const base = AIRLY_APPS[l.app].base!;
    try {
      if (l.app === "formkit") {
        const cursors = l.cursor ? (JSON.parse(l.cursor) as Record<string, number>) : {};
        const forms = (((await call(base, token, "/forms")) as { data?: { id: string; title: string; status: string }[] }).data ?? []).slice(0, 30);
        let added = 0;
        for (const f of forms) {
          // First sync starts from the last 30 days.
          const after = cursors[f.id] ?? Date.now() - 30 * 86_400_000;
          const r = (await call(base, token, `/forms/${encodeURIComponent(f.id)}/responses?after=${after}&limit=100`)) as { data?: { id: string; submittedAtMs: number; complete: boolean; respondent?: { name?: string | null; email?: string | null; company?: string | null }; answers?: { question: string; value: unknown }[] }[]; next?: number | null };
          const rows = (r.data ?? []).filter((x) => x.complete !== false);
          if (rows.length) {
            added += (await ctx.runMutation(internal.airly.importLeads, {
              linkId: id,
              items: rows.map((x) => ({
                externalId: x.id,
                name: x.respondent?.name ?? x.respondent?.email ?? "Form response",
                email: x.respondent?.email ?? undefined,
                company: x.respondent?.company ?? undefined,
                subject: `Formkit: ${f.title}`,
                text: (x.answers ?? []).slice(0, 12).map((a) => `${a.question}: ${Array.isArray(a.value) ? a.value.join(", ") : String(a.value ?? "")}`).join("\n") || "New response",
                at: x.submittedAtMs,
                kind: "form" as const,
              })),
            })) as number;
          }
          if (r.next) cursors[f.id] = r.next;
          else if (!cursors[f.id]) cursors[f.id] = after;
        }
        await ctx.runMutation(internal.airly.markSync, { id, cursor: JSON.stringify(cursors), added });
      } else {
        const from = l.cursor ?? new Date(Date.now() - 7 * 86_400_000).toISOString();
        const r = (await call(base, token, `/bookings?from=${encodeURIComponent(from)}&limit=200`)) as { data?: { id: string; meeting_name: string; starts_at: string; status: string; guest_name: string; guest_email: string; created_at?: string }[] };
        const rows = (r.data ?? []).filter((b) => !/cancel/i.test(b.status));
        const added: number = rows.length
          ? await ctx.runMutation(internal.airly.importLeads, {
              linkId: id,
              items: rows.map((b) => ({ externalId: b.id, name: b.guest_name || b.guest_email, email: b.guest_email || undefined, subject: `Meetrao: ${b.meeting_name}`, text: `Booked “${b.meeting_name}” for ${new Date(b.starts_at).toUTCString().slice(0, 22)} UTC.`, at: b.created_at ? Date.parse(b.created_at) : Date.now(), kind: "booking" as const, startAt: Date.parse(b.starts_at) })),
            })
          : 0;
        // Bookings are filtered by start time; keep a week of overlap so moved meetings are seen.
        await ctx.runMutation(internal.airly.markSync, { id, cursor: new Date(Date.now() - 7 * 86_400_000).toISOString(), added });
      }
    } catch (e) {
      await ctx.runMutation(internal.airly.markSync, { id, error: (e as Error).message });
    }
  },
});

export const syncAll = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const targets: { id: Id<"airlyLinks">; app: string }[] = await ctx.runQuery(internal.airly.syncTargets, {});
    for (const t of targets) await ctx.runAction(internal.airlyActions.syncOne, { id: t.id });
    return targets.length;
  },
});

/** Send the current plan's to-dos to the chosen Taskeni board. */
export const sendPlanToTaskeni = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<{ created: number; url: string | null }> => {
    const acc = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "edit" });
    if (!acc) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    const t = await tokenFor(ctx, acc.orgId, "taskeni");
    const plan = await ctx.runQuery(internal.airly.planForExport, { orgId: acc.orgId });
    if (!plan) throw appError("INVALID", "Make a growth plan first.");
    const tasks = planTasks(plan.strategy as never);
    if (!tasks.length) throw appError("INVALID", "This plan has no to-dos to send yet.");
    let created = 0;
    let url: string | null = null;
    for (const task of tasks) {
      const r = (await call(t.base, t.token, "/tasks", { method: "POST", body: JSON.stringify({ board: t.settings.board, title: task.title, description: task.description, assignees: ["me"] }) })) as { url?: string };
      url ??= r.url ?? null;
      created++;
    }
    return { created, url };
  },
});

/** Save the current plan as a Folevi note. */
export const savePlanToFolevi = action({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<{ url: string | null }> => {
    const acc = await ctx.runQuery(internal.access.orgAccessForAction, { slug, permission: "edit" });
    if (!acc) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    const t = await tokenFor(ctx, acc.orgId, "folevi");
    const plan = await ctx.runQuery(internal.airly.planForExport, { orgId: acc.orgId });
    if (!plan) throw appError("INVALID", "Make a growth plan first.");
    const title = `${plan.org.name}: growth plan (${new Date(plan.strategy.createdAt).toISOString().slice(0, 10)})`;
    const r = (await call(t.base, t.token, "/notes", { method: "POST", headers: { "Idempotency-Key": `climbos-plan-${plan.strategy._id}` }, body: JSON.stringify({ title, markdown: planMarkdown(plan.strategy as never, plan.org.name), ...(t.settings.place ? { place: t.settings.place } : {}) }) })) as { url?: string };
    return { url: r.url ?? null };
  },
});

/** Mondays: the weekly report also goes to Folevi as a note, when Folevi is connected. */
export const saveReportToFolevi = internalAction({
  args: { orgId: v.id("organizations"), title: v.string(), markdown: v.string(), key: v.string() },
  handler: async (ctx, { orgId, title, markdown, key }): Promise<void> => {
    const l: Doc<"airlyLinks"> | null = await ctx.runQuery(internal.airly.linkFor, { orgId, app: "folevi" });
    if (!l || l.status !== "connected") return;
    try {
      const token = await decryptSecret({ keyId: l.tokenKeyId, iv: l.tokenIv, ciphertext: l.tokenCiphertext }, AAD(orgId));
      const settings = l.settings ? (JSON.parse(l.settings) as Record<string, string>) : {};
      await call(AIRLY_APPS.folevi.base!, token, "/notes", { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ title: title.slice(0, 200), markdown: markdown.slice(0, 95_000), ...(settings.place ? { place: settings.place } : {}) }) });
    } catch (e) {
      await ctx.runMutation(internal.airly.markSync, { id: l._id, error: `Couldn't save the weekly report: ${(e as Error).message}` });
    }
  },
});
