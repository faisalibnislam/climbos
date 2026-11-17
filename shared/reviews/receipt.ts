/** A Sent-folder copy is source evidence, not proof of delivery or a submitted review. */
export type SavedReviewMessage = { messageId: string; sender: string; to: string; subject: string; text: string };
type Address = { address?: string | null };
export type ReviewEnvelope = { messageId?: string | null; from?: Address[]; sender?: Address[]; to?: Address[]; cc?: Address[]; bcc?: Address[]; subject?: string | null };
const address = (value?: string | null) => value?.trim().toLowerCase();
const single = (items: Address[] | undefined, expected: string) => items?.length === 1 && address(items[0].address) === address(expected);
// SMTP normalizes line endings and may add one terminal newline; other whitespace is significant.
export const normalizedReviewBody = (text: string) => text.replace(/\r\n/g, "\n").replace(/\n$/, "");
export function matchesReviewEnvelope(expected: SavedReviewMessage, envelope: ReviewEnvelope): boolean {
  return envelope.messageId === expected.messageId && single(envelope.from, expected.sender) && single(envelope.to, expected.to)
    && (!envelope.sender?.length || single(envelope.sender, expected.sender)) && !envelope.cc?.length && !envelope.bcc?.length && envelope.subject === expected.subject;
}
export function matchesReviewText(expected: SavedReviewMessage, actual: string): boolean {
  return normalizedReviewBody(actual) === normalizedReviewBody(expected.text);
}
