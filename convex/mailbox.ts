"use node";

import { v } from "convex/values";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { isOptOutReply, MAILBOX_PRESETS, replyText, type MailboxPreset } from "../shared/outbound/sending";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction } from "./_generated/server";
import { appError } from "./lib/tenancy";

/**
 * The owner's own mailbox over SMTP (send) and IMAP (replies and bounces),
 * signed in with an app password. Credentials are verified before they're
 * stored (encrypted, like every connection secret) and never returned.
 * Tests replace the transport with CLIMBOS_FAKE_MAILBOX.
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

function imap(s: MailboxSecret) {
  return new ImapFlow({ host: s.imapHost, port: s.imapPort, secure: true, auth: { user: s.email, pass: s.password }, logger: false, socketTimeout: 30_000 });
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

/** Send one queued email from the owner's mailbox. */
export const sendOne = internalAction({
  args: { sendId: v.id("outboundSends") },
  handler: async (ctx, { sendId }) => {
    const job = await ctx.runQuery(internal.outboundSending.prepareSend, { sendId });
    if (!job) {
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, ok: false, skip: true });
      return;
    }
    const raw = await ctx.runQuery(internal.connections.getSecret, { connectionId: job.connectionId as Id<"connections"> });
    if (!raw) {
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, ok: false, error: "Mailbox disconnected" });
      return;
    }
    const secret = JSON.parse(raw.value) as MailboxSecret;
    if (process.env.CLIMBOS_FAKE_MAILBOX) {
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, ok: true, messageId: `<fake-${sendId}@climbos.test>` });
      return;
    }
    try {
      const info = await transport(secret).sendMail({
        from: secret.email,
        to: job.to,
        subject: job.subject,
        text: job.text,
        headers: { "List-Unsubscribe": `<${job.unsubscribeUrl}>, <mailto:${secret.email}?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        ...(job.inReplyTo ? { inReplyTo: job.inReplyTo, references: [job.inReplyTo] } : {}),
      });
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, ok: true, messageId: info.messageId });
    } catch (e) {
      await ctx.runMutation(internal.outboundSending.recordSend, { sendId, ok: false, error: (e as Error).message });
    }
  },
});

/** Every 15 minutes: read new mail since each campaign started; replies stop sequences, bounces suppress. */
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
      try {
        await client.connect();
        const lock = await client.getMailboxLock("INBOX");
        try {
          const since = new Date(t.since - 86_400_000);
          for await (const msg of client.fetch({ since }, { envelope: true, source: { start: 0, maxLength: 20_000 } })) {
            const from = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
            const text = msg.source ? msg.source.toString("utf8") : "";
            if (wanted.has(from)) {
              const body = text.split(/\r?\n\r?\n/).slice(1).join("\n\n");
              const clean = replyText(body);
              replies.push({ from, optOut: isOptOutReply(clean), subject: msg.envelope?.subject?.slice(0, 200), messageId: msg.envelope?.messageId ?? undefined, text: clean.slice(0, 4000), at: msg.envelope?.date ? new Date(msg.envelope.date).getTime() : undefined });
            } else if (/mailer-daemon|postmaster/i.test(from) || /delivery status notification|undeliverable|delivery failure|returned mail/i.test(msg.envelope?.subject ?? "")) {
              for (const e of wanted) if (text.toLowerCase().includes(e)) bounced.add(e);
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
        await ctx.runMutation(internal.reviews.recordRequest, { id, ok: false, error: "Mailbox disconnected" });
        continue;
      }
      if (process.env.CLIMBOS_FAKE_MAILBOX) {
        await ctx.runMutation(internal.reviews.recordRequest, { id, ok: true });
        continue;
      }
      const raw = await ctx.runQuery(internal.connections.getSecret, { connectionId: job.connectionId });
      if (!raw) {
        await ctx.runMutation(internal.reviews.recordRequest, { id, ok: false, error: "Mailbox disconnected" });
        continue;
      }
      const secret = JSON.parse(raw.value) as MailboxSecret;
      try {
        await transport(secret).sendMail({ from: secret.email, to: job.to, subject: job.subject, text: job.text });
        await ctx.runMutation(internal.reviews.recordRequest, { id, ok: true });
      } catch (e) {
        await ctx.runMutation(internal.reviews.recordRequest, { id, ok: false, error: (e as Error).message });
      }
      await new Promise((r) => setTimeout(r, 4_000));
    }
  },
});
