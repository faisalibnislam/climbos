import { z } from "zod";

export const RenderChecksSchema = z.object({
  method: z.literal("rendered_dom_sample"),
  checkedAt: z.number().finite(),
  viewport: z.object({ width: z.number().int().positive().max(4000), height: z.number().int().positive().max(4000) }),
  sampledElements: z.number().int().min(0).max(500),
  checks: z.array(z.object({ id: z.string().max(60), state: z.enum(["pass", "review"]), evidence: z.string().max(300) })).max(10),
});
export type RenderChecks = z.infer<typeof RenderChecksSchema>;

/** Self-contained for page.evaluate. A bounded DOM sample, not a WCAG or interaction certification. */
export function inspectRenderedPage(): RenderChecks {
  const elements = Array.from(document.body.querySelectorAll<HTMLElement>("a[href],button,input,select,textarea,img,p,li,label,h1,h2,h3")).slice(0, 500);
  const visible = (el: HTMLElement) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden" && !el.closest('[aria-hidden="true"], [inert]');
  const name = (el: HTMLElement) => el.getAttribute("aria-label")?.trim() || (el.getAttribute("aria-labelledby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim() || ((el as HTMLInputElement).labels ? Array.from((el as HTMLInputElement).labels ?? []).map((label) => label.textContent).join(" ").trim() : "") || el.getAttribute("title")?.trim() || (el.matches("button,a") ? el.textContent?.trim() || Array.from(el.querySelectorAll("img[alt],svg title")).map((child) => child.getAttribute("alt") ?? child.textContent).join(" ").trim() : el.matches('input[type="submit"],input[type="reset"],input[type="button"]') ? (el as HTMLInputElement).value : el.matches('input[type="image"]') ? el.getAttribute("alt") : "");
  const controls = elements.filter((el) => el.matches('button,input:not([type="hidden"]),select,textarea') && visible(el));
  const links = elements.filter((el) => el.matches("a[href]") && visible(el));
  const images = elements.filter((el) => el.matches("img") && visible(el));
  const text = elements.filter((el) => el.matches("p,li,label,h1,h2,h3") && visible(el) && el.textContent?.trim());
  const missingControls = controls.filter((el) => !name(el)).length;
  const missingLinks = links.filter((el) => !name(el)).length;
  const missingAlt = images.filter((el) => !el.hasAttribute("alt")).length;
  const small = text.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12).length;
  const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
  const h1 = elements.filter((el) => el.tagName === "H1" && visible(el)).length;
  return { method: "rendered_dom_sample", checkedAt: Date.now(), viewport: { width: innerWidth, height: innerHeight }, sampledElements: elements.length, checks: [
    { id: "horizontal-overflow", state: overflow ? "review" : "pass", evidence: `Document width ${document.documentElement.scrollWidth}px; viewport ${document.documentElement.clientWidth}px.` },
    { id: "document-language", state: document.documentElement.lang.trim() ? "pass" : "review", evidence: document.documentElement.lang.trim() ? "A document language is declared." : "No document language is declared." },
    { id: "primary-heading", state: h1 === 1 ? "pass" : "review", evidence: `${h1} visible first-level headings in the sample; review the page hierarchy.` },
    { id: "control-names", state: missingControls ? "review" : "pass", evidence: `${missingControls} of ${controls.length} sampled visible form controls have no name detected by this limited check.` },
    { id: "link-names", state: missingLinks ? "review" : "pass", evidence: `${missingLinks} of ${links.length} sampled visible links have no name detected.` },
    { id: "image-alternatives", state: missingAlt ? "review" : "pass", evidence: `${missingAlt} of ${images.length} sampled images have no alt attribute. Empty alt text still needs an editorial check for decorative intent.` },
    { id: "small-text", state: small ? "review" : "pass", evidence: `${small} of ${text.length} sampled visible text elements are below 12px. This is a readability review cue, not a universal accessibility threshold.` },
  ] };
}
