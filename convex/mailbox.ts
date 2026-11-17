"use node";

import { matchesReviewEnvelope, matchesReviewText, type SavedReviewMessage } from "../shared/reviews/receipt";
import { v } from "convex/values";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { fakeFindSent, fakeMailbox, fakeSend, FakeWorkerCrash } from "../shared/outbound/fakeMailbox";
import { isAutoReply, isOptOutReply, MAILBOX_PRESETS, replyText, SENT_COPY_HOSTS, sendMessageId, smtpOutcome, type MailboxPreset } from "../shared/outbound/sending";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { appError } from "./lib/tenancy";

/**
 * The owner's own mailbox over SMTP (send) and IMAP (replies and bounces),
 * signed in with an app password. Credentials are verified before they're
 * stored (encrypted, like every connection secret) and never returned.
 * Tests replace the transport with CLIMBOS_FAKE_MAILBOX (shared/outbound/fakeMailbox).
 */

interface MailboxSecret {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
}

function transport(s: MailboxSecret) {
  return nodemailer.createTransport({ host: s.smtpHost, port: s.smtpPort, secure: s.smtpPort === 465, auth: { user: s.email, pass: s.password }, connectionTimeout: 15_000, socketTimeout: 30_000 });
}

function imap(s: MailboxSecret, boundedRecovery = false) {
  return new ImapFlow({ host: s.imapHost, port: s.imapPort, secure: true, auth: { user: s.email, pass: s.password }, logger: false, socketTimeout: 30_000, ...(boundedRecovery ? { connectionTimeout: 10_000, maxLineLength: 65536, maxLiteralSize: 32768, maxResponseSize: 65536 } : {}) });
}

/** Connect the owner's mailbox: checks SMTP and IMAP sign-in, then stores the credentials encrypted. */
export const connect = action({
  args: { slug: v.string(), preset: v.string(), email: v.string(), password: v.string(), smtpHost: v.optional(v.string()), smtpPort: v.optional(v.number()), imapHost: v.optional(v.string()), imapPort: v.optional(v.number()) },
  handler: async (ctx, a): Promise<{ ok: boolean; message: string }> => {
    const access = await ctx.runQuery(internal.access.orgAccessForAction, { slug: a.slug, permission: "manage_connections" });
    if (!access) throw appError("NOT_FOUND", "We couldn't find that workspace.");
    if (access.kind === "demo") return { ok: false, message: "Demo workspaces can't connect a real mailbox." };
    const p = MAILBOX_PRESETS[(a.preset in MAILBOX_PRESETS ? a.preset : "custom") as MailboxPreset];
    const secret: MailboxSecret = {
      email: a.email.trim().toLowerCase(),
      password: a.password.replace(/\s+/g, ""),
      smtpHost: (a.smtpHost || p.smtpHost).trim(),
      smtpPort: a.smtpPort || p.smtpPort,
      imapHost: (a.imapHost || p.imapHost).trim(),
      imapPort: a.imapPort || p.imapPort,
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secret.email) || !secret.password || !secret.smtpHost || !secret.imapHost) return { ok: false, message: "Fill in your email, app password and server settings." };
    if (!process.env.CLIMBOS_FAKE_MAILBOX) {
      try {
        await transport(secret).verify();
      } catch {
        return { ok: false, message: "We couldn't sign in to send (SMTP). Check the app password and server settings." };
      }
      const client = imap(secret);
      try {
        await client.connect();
        await client.logout();
      } catch {
        return { ok: false, message: "We could send, but couldn't read replies (IMAP). Check that IMAP is turned on for this mailbox." };
      }
    }
    await ctx.runMutation(internal.connections.storeConnection, {
      orgId: access.orgId,
      userId: access.userId,
      provider: "email_mailbox",
      secret: JSON.stringify(secret),
      secretKind: "api_key",
      scopes: ["send", "read_replies"],
      accountLabel: secret.email,
    });
    return { ok: true, message: `Connected ${secret.email}.` };
  },
});

/**
 * Is this Message-ID in the Sent folder? null = this mailbox can't be checked
 * (its SMTP host doesn't keep a Sent copy, or there's no Sent folder).
 */
async function findSent(s: MailboxSecret, messageId: string): Promise<boolean | null> {
  if (!SENT_COPY_HOSTS.includes(s.smtpHost.trim().toLowerCase())) return null;
  const client = imap(s);
  await client.connect();
  try {
    const sent = (await client.list()).find((b) => b.specialUse === "\\Sent");
    if (!sent) return null;
    const lock = await client.getMailboxLock(sent.path);
    try {
      const hits = await client.search({ header: { "message-id": messageId } }, { uid: true });
      return Array.isArray(hits) && hits.length > 0;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
}

/**
 * Send one queued email from the owner's mailbox, at most once: only the
 * worker holding the lease may claim it, the Message-ID comes from the
 * send's stable key, and an unclear result is checked, never blindly resent.
 */
export const sendOne = internalAction({
  args: { sendId: v.id("outboundSends"), lease: v.optional(v.string()) },
  handler: async (ctx, { sendId, lease }) => {
    const job = await ctx.runQuery(internal.outboundSending.prepareSend, { sendId });
    if (!job) {
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, lease, ok: false, skip: true });
      return;
    }
    if (job.hold) {
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, lease, ok: false, hold: true });
      return;
    }
    const raw = await ctx.runQuery(internal.connections.getSecret, { connectionId: job.connectionId as Id<"connections"> });
    if (!raw) {
      // Mailbox revoked: back in the queue, not retried until it's reconnected.
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, lease, ok: false, hold: true });
      return;
    }
    const secret = JSON.parse(raw.value) as MailboxSecret;
    if (!(await ctx.runMutation(internal.outboundSending.claimSend, { sendId, lease, payloadHash: job.payloadHash, ...(job.abTestId ? { abTestId: job.abTestId } : {}) }))) return;
    const messageId = job.opKey ? sendMessageId(job.opKey, secret.email) : undefined;
    try {
      const info = process.env.CLIMBOS_FAKE_MAILBOX
        ? await fakeSend({ messageId: messageId ?? `<fake-${sendId}@climbos.test>`, to: job.to, subject: job.subject, text: job.text })
        : await transport(secret).sendMail({
            from: secret.email,
            to: job.to,
            subject: job.subject,
            text: job.text,
            ...(messageId ? { messageId } : {}),
            headers: { "List-Unsubscribe": `<${job.unsubscribeUrl}>, <mailto:${secret.email}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
            ...(job.inReplyTo ? { inReplyTo: job.inReplyTo, references: [job.inReplyTo] } : {}),
          });
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, lease, ok: true, messageId: info.messageId ?? messageId });
    } catch (e) {
      // Test only: the worker "dies" after the mailbox took the email; nothing is recorded.
      if (e instanceof FakeWorkerCrash) return;
      const outcome = smtpOutcome(e as { code?: string; responseCode?: number });
      if (outcome === "auth") await ctx.runMutation(internal.connections.markSync, { connectionId: job.connectionId as Id<"connections">, ok: false, error: "Mailbox sign-in failed", expired: true });
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, lease, ok: false, error: (e as Error).message, outcome });
    }
  },
});

/** Before any resend of an uncertain email: look for its Message-ID in the Sent folder. */
export const reconcileOne = internalAction({
  args: { sendId: v.id("outboundSends"), lease: v.optional(v.string()) },
  handler: async (ctx, { sendId, lease }) => {
    const job = await ctx.runQuery(internal.outboundSending.reconcileJob, { sendId, lease });
    if (!job) return;
    const raw = job.opKey && job.connectionId ? await ctx.runQuery(internal.connections.getSecret, { connectionId: job.connectionId }) : null;
    if (!raw || !job.opKey) {
      await ctx.runMutation(internal.outboundSending.recordReconcile, { sendId, lease, found: null });
      return;
    }
    const secret = JSON.parse(raw.value) as MailboxSecret;
    const messageId = sendMessageId(job.opKey, secret.email);
    let found: boolean | null = null;
    try {
      found = process.env.CLIMBOS_FAKE_MAILBOX ? await fakeFindSent(messageId) : await findSent(secret, messageId);
    } catch {
      found = null;
    }
    await ctx.runMutation(internal.outboundSending.recordReconcile, { sendId, lease, found, messageId });
  },
});

/**
 * Every 15 minutes: read mail that arrived since the last check (headers
 * first; full text only for prospects and bounces). Replies stop sequences,
 * bounces suppress, out-of-office replies are ignored.
 */
export const checkReplies = internalAction({
  args: {},
  handler: async (ctx) => {
    if (process.env.CLIMBOS_FAKE_MAILBOX) return 0;
    const targets = await ctx.runQuery(internal.outboundSending.replyCheckTargets, {});
    let checked = 0;
    for (const t of targets) {
      const raw = await ctx.runQuery(internal.connections.getSecret, { connectionId: t.connectionId });
      if (!raw) continue;
      const secret = JSON.parse(raw.value) as MailboxSecret;
      const wanted = new Set(t.emails.map((e) => e.toLowerCase()));
      const replies: { from: string; optOut: boolean; subject?: string; messageId?: string; text?: string; at?: number }[] = [];
      const bounced = new Set<string>();
      const client = imap(secret);
      const isBounce = (from: string, subject: string) => /mailer-daemon|postmaster/i.test(from) || /delivery status notification|undeliverable|delivery failure|returned mail/i.test(subject);
      try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");
        try {
          // IMAP SINCE is day-granular: search a day back, then keep only mail received after the last check.
          const relevant: number[] = [];
          for await (const msg of client.fetch({ since: new Date(t.since - 86_400_000) }, { uid: true, envelope: true, internalDate: true })) {
            const received = msg.internalDate ? new Date(msg.internalDate).getTime() : 0;
            if (received && received < t.since) continue;
            const from = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
            if (wanted.has(from) || isBounce(from, msg.envelope?.subject ?? "")) relevant.push(msg.uid);
          }
          if (relevant.length) {
            for await (const msg of client.fetch(relevant.slice(0, 500), { uid: true, envelope: true, source: { start: 0, maxLength: 20_000 } }, { uid: true })) {
              const from = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
              const subject = msg.envelope?.subject ?? "";
              const text = msg.source ? msg.source.toString("utf8") : "";
              const [head = "", ...rest] = text.split(/\r?\n\r?\n/);
              if (wanted.has(from)) {
                if (isAutoReply(head, subject)) continue;
                const clean = replyText(rest.join("\n\n"));
                replies.push({ from, optOut: isOptOutReply(clean), subject: subject.slice(0, 200), messageId: msg.envelope?.messageId ?? undefined, text: clean.slice(0, 4000), at: msg.envelope?.date ? new Date(msg.envelope.date).getTime() : undefined });
              } else if (isBounce(from, subject)) {
                for (const e of wanted) if (text.toLowerCase().includes(e)) bounced.add(e);
              }
            }
          }
        } finally {
          lock.release();
        }
        await client.logout();
      } catch {
        continue;
      }
      await ctx.runMutation(internal.outboundSending.applyInbox, { campaignId: t.campaignId, replies, bounced: [...bounced], checkedAt: Date.now() });
      checked++;
    }
    return checked;
  },
});

/** Answer an inbox email from the owner's mailbox, threaded under their message. */
export const reply = action({
  args: { slug: v.string(), id: v.id("communityMessages"), text: v.string() },
  handler: async (ctx, { slug, id, text }): Promise<{ ok: boolean; message: string }> => {
    const body = text.trim().slice(0, 8000);
    if (body.length < 2) return { ok: false, message: "Write your reply first." };
    const job = await ctx.runQuery(internal.inbox.prepareReply, { slug, id });
    const raw = await ctx.runQuery(internal.connections.getSecret, { connectionId: job.connectionId });
    if (!raw) return { ok: false, message: "Your mailbox is disconnected. Reconnect it in Connections." };
    const secret = JSON.parse(raw.value) as MailboxSecret;
    if (!process.env.CLIMBOS_FAKE_MAILBOX) {
      try {
        await transport(secret).sendMail({ from: secret.email, to: job.to, subject: job.subject, text: body, ...(job.inReplyTo ? { inReplyTo: job.inReplyTo, references: [job.inReplyTo] } : {}) });
      } catch (e) {
        return { ok: false, message: `Your mailbox didn't send it: ${(e as Error).message.slice(0, 160)}` };
      }
    }
    await ctx.runMutation(internal.inbox.recordReply, { id, userId: job.userId, text: body });
    return { ok: true, message: `Sent to ${job.to}.` };
  },
});

/** Send queued review requests from the owner's mailbox, a few seconds apart. */
export const sendReviewRequests = internalAction({
  args: { ids: v.array(v.id("reviewRequests")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      const job = await ctx.runQuery(internal.reviews.prepareRequest, { id });
      if (!job) {
        await ctx.runMutation(internal.reviews.failUnstartedRequest, { id });
        continue;
      }
      const raw = await ctx.runQuery(internal.connections.getSecret, { connectionId: job.connectionId });
      if (!raw || raw.secretId !== job.credentialId) {
        await ctx.runMutation(internal.reviews.failUnstartedRequest, { id });
        continue;
      }
      const secret = JSON.parse(raw.value) as MailboxSecret;
      if (secret.email.trim().toLowerCase() !== job.sender) continue;
      const claim = await ctx.runMutation(internal.reviews.claimRequest, { id, payloadHash: job.payloadHash, credentialId: raw.secretId });
      if (!claim) { await ctx.runMutation(internal.reviews.failUnstartedRequest, { id }); continue; }
      const messageId = job.messageId;
      try {
        const info = process.env.CLIMBOS_FAKE_MAILBOX
          ? await fakeSend({ messageId, to: job.to, subject: job.subject, text: job.text })
          : await transport(secret).sendMail({ messageId, from: secret.email, to: job.to, subject: job.subject, text: job.text, headers: { "List-Unsubscribe": `<${job.unsubscribeUrl}>, <mailto:${secret.email}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
        await ctx.runMutation(internal.reviews.recordRequest, { id, claimToken: claim.claimToken, outcome: "sent", messageId: info.messageId ?? messageId });
      } catch (e) {
        if (e instanceof FakeWorkerCrash) continue;
        await ctx.runMutation(internal.reviews.recordRequest, { id, claimToken: claim.claimToken, outcome: smtpOutcome(e as { code?: string; responseCode?: number }) === "unclear" ? "uncertain" : "failed" });
      }
      if (process.env.CLIMBOS_FAKE_MAILBOX) continue;
      await new Promise((r) => setTimeout(r, 4_000));
    }
  },
});

/** Only an exact, bounded plain-text Sent copy can confirm this invitation. No mailbox writes. */
async function matchingReviewSent(s: MailboxSecret, expected: SavedReviewMessage): Promise<boolean> {
  const client = imap(s, true);
  const deadline = setTimeout(() => client.close(), 20_000);
  try {
    await client.connect();
    const folders = (await client.list()).filter(folder => folder.specialUse === "\\Sent");
    if (folders.length !== 1) return false;
    const lock = await client.getMailboxLock(folders[0].path, { readOnly: true });
    try {
      const hits = await client.search({ header: { "message-id": expected.messageId } }, { uid: true });
      if (!Array.isArray(hits) || hits.length !== 1) return false;
      const message = await client.fetchOne(hits[0], { envelope: true, bodyStructure: true }, { uid: true });
      if (!message || !message.envelope || !matchesReviewEnvelope(expected, message.envelope) || message.bodyStructure?.type !== "text/plain" || message.bodyStructure.childNodes?.length) return false;
      const body = await client.download(hits[0], message.bodyStructure.part || "1", { uid: true, maxBytes: 32768 });
      if (!body.content || body.meta.contentType !== "text/plain" || body.meta.flowed) { body.content?.destroy(); return false; }
      const chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of body.content) { const b = Buffer.from(chunk); bytes += b.length; if (bytes >= 32768) { body.content.destroy(); return false; } chunks.push(b); }
      return matchesReviewText(expected, Buffer.concat(chunks).toString("utf8"));
    } finally { lock.release(); }
  } finally { clearTimeout(deadline); client.close(); }
}

/** Owner-requested read of the original mailbox. Missing is unknown, never permission to retry. */
export const checkReviewReceipt = action({
  args: { slug: v.string(), id: v.id("reviewRequests"), revision: v.number() },
  handler: async (ctx, args): Promise<{ matched: boolean; message: string }> => {
    const c = await ctx.runQuery(internal.reviews.receiptContext, args);
    const d = c.request.dispatch;
    let matches = false;
    let note = "The original message could not be matched completely. Delivery remains unknown; nothing was resent.";
    if (d && c.dispatchValid && c.request.claimToken) {
      const raw = await ctx.runQuery(internal.connections.getSecret, { connectionId: d.connectionId });
      if (raw && raw.orgId === c.org._id && raw.provider === "email_mailbox" && raw.secretId === d.credentialId) {
        try {
          const secret = JSON.parse(raw.value) as MailboxSecret;
          if (secret.email.trim().toLowerCase() === d.sender) {
            if (process.env.CLIMBOS_FAKE_MAILBOX) {
              const fake = fakeMailbox();
              const copies = fake.sent.filter(m => m.messageId === d.messageId);
              matches = fake.lookup && copies.length === 1 && copies[0].to === d.to && copies[0].subject === d.subject && matchesReviewText(d, copies[0].text);
            } else matches = await matchingReviewSent(secret, d);
          }
        } catch { /* Missing, changed, unsupported or unavailable mailbox evidence remains unknown. */ }
      } else note = "The original mailbox sign-in is unavailable or changed. Delivery remains unknown; nothing was resent.";
    } else note = "This older attempt lacks the saved message and mailbox identity needed for an automatic check. Record what you find manually.";
    return ctx.runMutation(internal.reviews.recordReceiptCheck, { ...args, fingerprint: c.fingerprint, matches, note });
  },
});
