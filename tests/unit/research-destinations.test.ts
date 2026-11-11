import {afterEach, expect, it, vi} from "vitest";
import {researchWebsite} from "../../convex/ai/research";
vi.mock("node:dns/promises", async original=>({...await original<typeof import("node:dns/promises")>(),lookup:vi.fn(async()=>[{address:"93.184.216.34",family:4}])}));
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function network(blocked=false){
  const seen:string[]=[];vi.stubEnv("FIRECRAWL_API_KEY","");
  vi.stubGlobal("fetch",vi.fn(async(input:unknown)=>{
    const url=String(input);seen.push(url);
    if(url.endsWith("/robots.txt"))return new Response(`User-agent: ClimbOSBot\n${blocked?"Disallow: /compare/existing":"Allow: /"}`,{headers:{"content-type":"text/plain"}});
    if(url.endsWith("/sitemap.xml"))return new Response("Not found",{status:404});
    const path=new URL(url).pathname;
    return new Response(`<html><title>${path}</title><h1>Published offer</h1><p>Published claims only.</p><a href="/pricing">Pricing</a><a href="/compare">Compare index</a></html>`,{headers:{"content-type":"text/html"}});
  }));return seen;
}
it("reads the owner's exact child page before a generic index, inside the existing page budget",async()=>{
  const seen=network();const result=await researchWebsite("https://business.example/",1,{preferredUrls:["https://business.example/compare/existing"]});
  expect(result.pages.map(page=>page.url)).toEqual(["https://business.example/","https://business.example/compare/existing"]);
  expect(result.pagesFetched).toBe(2);expect(seen).not.toContain("https://business.example/compare");expect(seen).not.toContain("https://business.example/pricing");
});
it("does not widen to offsite, private or query-bearing URLs, and preserves a blocked requested page",async()=>{
  const seen=network(true);const result=await researchWebsite("https://business.example/",1,{preferredUrls:["https://other.example/compare","http://127.0.0.1/admin","https://business.example/private?token=secret","https://business.example/compare/existing"]});
  expect(result.pages[1]).toMatchObject({url:"https://business.example/compare/existing",status:"blocked_by_robots"});expect(result.pagesFetched).toBe(1);
  expect(seen.some(url=>/other\.example|127\.0\.0\.1|token=|\/compare\/existing/.test(url))).toBe(false);
});
