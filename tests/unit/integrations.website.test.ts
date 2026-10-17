import { describe, expect, it } from "vitest";
import {
  extractPageContent,
  firecrawlScrapeRequest,
  getCrawlDelaySec,
  isAllowedRedirect,
  isPathAllowed,
  parseFirecrawlScrapeResponse,
  safeFetchPage,
  validateResearchUrl,
  validateResolvedAddresses,
} from "../../shared/integrations/website";
import type { FetchLike } from "../../shared/integrations/types";

describe("validateResearchUrl (SSRF)", () => {
  const blocked = [
    "ftp://example.com/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "http://localhost/",
    "http://LOCALHOST./admin",
    "http://foo.localhost/",
    "http://printer.local/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://intranet/",
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0.0.0.0/",
    "http://10.1.2.3/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.0.1/",
    "http://100.127.255.254/",
    "http://224.0.0.1/",
    "http://255.255.255.255/",
    "http://198.18.0.1/",
    "http://[::1]/",
    "http://[::]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:a9fe:a9fe]/",
    "http://[fc00::1]/",
    "http://[fd12:3456::1]/",
    "http://[fe80::1]/",
    "http://[ff02::1]/",
    "http://[64:ff9b::7f00:1]/",
    "http://[2001:db8::1]/",
    "http://user:pass@example.com/",
    "http://user@example.com/",
    "http://example.com:8080/",
    "https://example.com:22/",
  ];
  for (const url of blocked) {
    it(`blocks ${url}`, () => {
      expect(validateResearchUrl(url).ok).toBe(false);
    });
  }

  it("allows normal public URLs and normalizes them", () => {
    const r = validateResearchUrl("HTTPS://Example.COM:443/Path?q=1#frag");
    expect(r).toEqual({ ok: true, url: "https://example.com/Path?q=1", hostname: "example.com" });
    expect(validateResearchUrl("http://shop.example.co.uk/products/1").ok).toBe(true);
    expect(validateResearchUrl("https://example.com./").ok).toBe(true);
    expect(validateResearchUrl("http://8.8.8.8/").ok).toBe(true);
    expect(validateResearchUrl("http://[2606:4700:4700::1111]/").ok).toBe(true);
    expect(validateResearchUrl("https://bücher.de/").ok).toBe(true);
  });

  it("validateResolvedAddresses rejects any private address (DNS rebinding)", () => {
    expect(validateResolvedAddresses(["93.184.216.34"]).ok).toBe(true);
    expect(validateResolvedAddresses(["93.184.216.34", "10.0.0.5"]).ok).toBe(false);
    expect(validateResolvedAddresses(["::ffff:192.168.0.1"]).ok).toBe(false);
    expect(validateResolvedAddresses(["169.254.169.254"]).ok).toBe(false);
    expect(validateResolvedAddresses([]).ok).toBe(false);
    expect(validateResolvedAddresses(["not-an-ip"]).ok).toBe(false);
  });

  it("isAllowedRedirect re-validates each hop and caps at 3", () => {
    expect(isAllowedRedirect("https://example.com/a", "/b", 1).ok).toBe(true);
    expect(isAllowedRedirect("https://example.com/a", "http://169.254.169.254/", 1).ok).toBe(false);
    expect(isAllowedRedirect("https://example.com/a", "http://example.com/b", 1).ok).toBe(false); // downgrade
    expect(isAllowedRedirect("https://example.com/a", "https://example.org/", 4).ok).toBe(false);
  });

  it("safeFetchPage refuses a redirect into a private range", async () => {
    const fetchImpl: FetchLike = async (url) =>
      url === "https://example.com/"
        ? new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } })
        : new Response("secret");
    const res = await safeFetchPage({ url: "https://example.com/", fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.body).toBe("");
  });

  it("safeFetchPage enforces resolved-address checks", async () => {
    const fetchImpl: FetchLike = async () => new Response("<p>hi</p>");
    const res = await safeFetchPage({ url: "https://rebind.example.com/", fetchImpl, resolveHost: async () => ["10.0.0.1"] });
    expect(res.ok).toBe(false);
    const ok = await safeFetchPage({ url: "https://example.com/", fetchImpl, resolveHost: async () => ["93.184.216.34"] });
    expect(ok.ok).toBe(true);
    expect(ok.body).toContain("hi");
  });
});

describe("robots.txt", () => {
  const robots = [
    "# comment",
    "User-agent: *",
    "Disallow: /private",
    "Allow: /private/public",
    "Crawl-delay: 2",
    "",
    "User-agent: ClimbOSBot",
    "User-agent: OtherBot",
    "Disallow: /no-climbos",
    "Disallow: /*.pdf$",
    "Allow: /no-climbos/ok",
    "Disallow: /tie",
    "Allow: /tie",
    "Disallow:",
  ].join("\n");

  it("uses the specific ClimbOSBot group over *", () => {
    expect(isPathAllowed(robots, "ClimbOSBot", "/private")).toBe(true); // * group not used
    expect(isPathAllowed(robots, "climbosbot/1.0", "/no-climbos/page")).toBe(false);
    expect(isPathAllowed(robots, "ClimbOSBot", "/no-climbos/ok/x")).toBe(true);
    expect(isPathAllowed(robots, "ClimbOSBot", "/files/a.pdf")).toBe(false);
    expect(isPathAllowed(robots, "ClimbOSBot", "/files/a.pdf?x=1")).toBe(true);
    expect(isPathAllowed(robots, "ClimbOSBot", "/tie")).toBe(true); // Allow wins ties
    expect(isPathAllowed(robots, "ClimbOSBot", "/robots.txt")).toBe(true);
  });

  it("falls back to * group with longest match", () => {
    expect(isPathAllowed(robots, "SomeBot", "/private/x")).toBe(false);
    expect(isPathAllowed(robots, "SomeBot", "/private/public/x")).toBe(true);
    expect(isPathAllowed(robots, "SomeBot", "/")).toBe(true);
    expect(getCrawlDelaySec(robots, "SomeBot")).toBe(2);
  });

  it("allows everything when robots.txt is empty and blocks when Disallow: /", () => {
    expect(isPathAllowed("", "ClimbOSBot", "/anything")).toBe(true);
    expect(isPathAllowed("User-agent: *\nDisallow: /", "ClimbOSBot", "/x")).toBe(false);
    expect(isPathAllowed("User-agent: *\nDisallow: /%7Euser", "ClimbOSBot", "/~user/page")).toBe(false);
  });
});

describe("extractPageContent", () => {
  const html = `<!doctype html><html><head>
    <title>Acme &amp; Co — Climbing Shoes</title>
    <meta name="description" content="Best shoes &quot;ever&quot;">
    <meta property="og:title" content="Acme OG">
    <meta property="og:image" content="https://cdn.example.com/a.jpg">
    <style>.x{color:red}</style>
    <script>var secret = "do not leak";</script>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Rock Shoe","offers":{"@type":"Offer","price":"129.99","priceCurrency":"usd","availability":"https://schema.org/InStock"}}</script>
    </head><body>
    <h1>Shoes</h1><h2>Best <em>sellers</em></h2>
    <p>Hello&nbsp;world &#x2014; caf&eacute; &#169;</p>
    <!-- hidden comment -->
    <noscript>enable js</noscript>
    <a href="/about">About</a> <a href="https://example.com/about#team">About again</a>
    <a href="https://other.com/">Other</a> <a href="javascript:alert(1)">bad</a> <a href="mailto:a@b.c">mail</a>
    </body></html>`;

  it("extracts title, meta, og, headings, same-origin links, JSON-LD prices and text", () => {
    const page = extractPageContent(html, "https://example.com/shoes");
    expect(page.title).toBe("Acme & Co — Climbing Shoes");
    expect(page.metaDescription).toBe('Best shoes "ever"');
    expect(page.og["og:title"]).toBe("Acme OG");
    expect(page.headings).toEqual([
      { level: 1, text: "Shoes" },
      { level: 2, text: "Best sellers" },
    ]);
    expect(page.links).toEqual([{ url: "https://example.com/about", text: "About" }]);
    expect(page.jsonLdPrices).toEqual([{ name: "Rock Shoe", price: "129.99", currency: "USD", availability: "https://schema.org/InStock", type: "Offer" }]);
    expect(page.text).toContain("Hello world —");
    expect(page.text).not.toContain("secret");
    expect(page.text).not.toContain("color:red");
    expect(page.text).not.toContain("hidden comment");
    expect(page.text).not.toContain("enable js");
  });

  it("caps text length and link count", () => {
    const big = `<body>${"<p>word </p>".repeat(20_000)}${Array.from({ length: 80 }, (_, i) => `<a href="/p${i}">p${i}</a>`).join("")}</body>`;
    const page = extractPageContent(big, "https://example.com/");
    expect(page.text.length).toBeLessThanOrEqual(40_000);
    expect(page.truncated).toBe(true);
    expect(page.links.length).toBe(50);
  });
});

describe("firecrawl", () => {
  it("builds a v2 scrape request with markdown format", () => {
    const req = firecrawlScrapeRequest({ apiKey: "fc-test", url: "https://example.com/x#y" });
    expect(req.url).toBe("https://api.firecrawl.dev/v2/scrape");
    expect(req.method).toBe("POST");
    expect(req.headers.Authorization).toBe("Bearer fc-test");
    const body = JSON.parse(req.body) as { url: string; formats: string[] };
    expect(body.url).toBe("https://example.com/x");
    expect(body.formats).toEqual(["markdown"]);
  });
  it("refuses private URLs", () => {
    expect(() => firecrawlScrapeRequest({ apiKey: "k", url: "http://10.0.0.1/" })).toThrow();
  });
  it("parses responses", () => {
    expect(parseFirecrawlScrapeResponse({ success: true, data: { markdown: "# Hi", metadata: { title: "Hi" } } })).toEqual({ ok: true, markdown: "# Hi", title: "Hi", truncated: false });
    expect(parseFirecrawlScrapeResponse({ success: false, error: "nope" })).toEqual({ ok: false, error: "nope" });
  });
});
