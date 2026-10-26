/**
 * Public review replies must not expose private details (spec section 11):
 * contact details, order references, or wording from the customer's private
 * feedback. Checked in code before a draft is saved; the model is only asked.
 */
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE = /\+?\(?\d[\d\s().-]{5,}\d/g;
const ORDER_REF = /\b(?:order|booking|invoice|ticket|reservation|account|case)\s*(?:number|no\.?|id|#|ref(?:erence)?)\s*[:#]?\s*[A-Z0-9-]{3,}\b|#\d{4,}\b/i;

const words = (text: string) => text.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}']+/gu) ?? [];

function sharedRun(draft: string, source: string, size = 6): boolean {
  const d = words(draft);
  const s = words(source);
  if (d.length < size || s.length < size) return false;
  const runs = new Set<string>();
  for (let i = 0; i + size <= s.length; i++) runs.add(s.slice(i, i + size).join(" "));
  for (let i = 0; i + size <= d.length; i++) if (runs.has(d.slice(i, i + size).join(" "))) return true;
  return false;
}

export function publicReplyPrivacyIssue(draft: string, privateFeedback: string[] = []): string | null {
  if (EMAIL.test(draft)) return "The reply includes an email address. Public replies shouldn't share contact details.";
  if ((draft.match(PHONE) ?? []).some((m) => m.replace(/\D/g, "").length >= 7)) return "The reply includes a phone number. Public replies shouldn't share contact details.";
  if (ORDER_REF.test(draft)) return "The reply includes an order or account reference. Keep those out of public replies.";
  if (privateFeedback.some((text) => sharedRun(draft, text))) return "The reply repeats wording from this customer's private feedback. Keep private feedback private.";
  return null;
}
