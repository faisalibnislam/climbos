/** A preview observation is displayed only when its claimed quote is present on the fetched page. */
export function isVerbatimPageQuote(quote: string, pageText: string): boolean {
  const normalizedQuote = quote.replace(/\s+/gu, " ").trim();
  const normalizedPage = pageText.replace(/\s+/gu, " ").trim();
  return normalizedQuote.length >= 24 && normalizedQuote.length <= 300 && normalizedPage.includes(normalizedQuote);
}
