import { describe, expect, it } from "vitest";
import { productLinks, productsFromHtml, safePublicUrl } from "../../shared/net/safeUrl";

describe("safePublicUrl (SSRF guard for customer-supplied URLs)", () => {
  it.each(["https://formkit.app", "http://shop.example.com/products/a?x=1"])("allows %s", (u) => {
    expect(safePublicUrl(u)).not.toBeNull();
  });
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1/admin",
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://172.20.1.1",
    "http://169.254.169.254/latest/meta-data",
    "http://metadata.google.internal",
    "http://[::1]/",
    "file:///etc/passwd",
    "ftp://example.com",
    "https://user:pass@example.com",
    "http://printer.local",
    "not a url",
  ])("blocks %s", (u) => {
    expect(safePublicUrl(u)).toBeNull();
  });
});

describe("product photo discovery", () => {
  const page = `<html><head><title>Gather desk organizer</title>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Gather Desk Organizer","image":["/cdn/gather-1.jpg",{"url":"https://cdn.shop.com/gather-2.jpg"}],"offers":{"price":"129.00","priceCurrency":"USD"}}</script>
  </head><body><a href="/products/gather-walnut">Walnut</a><a href="/products/gather-maple">Maple</a><a href="https://other.com/products/x">x</a><a href="/about">About</a></body></html>`;
  it("reads JSON-LD products with absolute images and price", () => {
    const [p] = productsFromHtml(page, "https://ugmonk.com/products/gather");
    expect(p.name).toBe("Gather Desk Organizer");
    expect(p.price).toBe("129.00 USD");
    expect(p.images).toEqual(["https://ugmonk.com/cdn/gather-1.jpg", "https://cdn.shop.com/gather-2.jpg"]);
  });
  it("falls back to Open Graph", () => {
    const [p] = productsFromHtml(`<meta property="og:title" content="Tin of sardines"><meta property="og:image" content="/img/tin.jpg">`, "https://eatfishwife.com/");
    expect(p).toMatchObject({ name: "Tin of sardines", images: ["https://eatfishwife.com/img/tin.jpg"] });
  });
  it("finds same-site product links only", () => {
    expect(productLinks(page, "https://ugmonk.com/")).toEqual(["https://ugmonk.com/products/gather-walnut", "https://ugmonk.com/products/gather-maple"]);
  });
});
