/**
 * The test mailbox (CLIMBOS_FAKE_MAILBOX): nothing leaves the process. It
 * keeps what was "sent" so tests can count hand-offs, finds messages by
 * Message-ID like a Sent folder, and plays failures from a queue:
 * - crash_after_send: the email goes out, then the worker dies before recording it;
 * - timeout_after_send: the email goes out, but the answer is lost (looks like a timeout);
 * - reject: the server refuses it (550);
 * - auth: the mailbox password no longer works.
 */

export type FakeMailboxFault = "crash_after_send" | "timeout_after_send" | "reject" | "auth";

export interface FakeSent {
  messageId: string;
  to: string;
  subject: string;
  text: string;
}

interface FakeMailboxState {
  sent: FakeSent[];
  faults: FakeMailboxFault[];
  /** false = like a custom SMTP host with no Sent copy to look up. */
  lookup: boolean;
}

const KEY = "__climbosFakeMailbox";

export function fakeMailbox(): FakeMailboxState {
  const g = globalThis as unknown as Record<string, FakeMailboxState | undefined>;
  return (g[KEY] ??= { sent: [], faults: [], lookup: true });
}

export function resetFakeMailbox(opts: { lookup?: boolean; faults?: FakeMailboxFault[] } = {}) {
  const m = fakeMailbox();
  m.sent = [];
  m.faults = [...(opts.faults ?? [])];
  m.lookup = opts.lookup ?? true;
}

/** Thrown when a fault simulates the worker dying mid-send: nothing gets recorded. */
export class FakeWorkerCrash extends Error {}

export async function fakeSend(msg: FakeSent): Promise<{ messageId: string }> {
  const m = fakeMailbox();
  const fault = m.faults.shift();
  if (fault === "auth") throw Object.assign(new Error("Invalid login"), { code: "EAUTH", responseCode: 535 });
  if (fault === "reject") throw Object.assign(new Error("Mailbox unavailable"), { code: "EENVELOPE", responseCode: 550 });
  m.sent.push(msg);
  if (fault === "crash_after_send") throw new FakeWorkerCrash("worker died");
  if (fault === "timeout_after_send") throw Object.assign(new Error("Timeout"), { code: "ETIMEDOUT" });
  return { messageId: msg.messageId };
}

export async function fakeFindSent(messageId: string): Promise<boolean | null> {
  const m = fakeMailbox();
  return m.lookup ? m.sent.some((s) => s.messageId === messageId) : null;
}
