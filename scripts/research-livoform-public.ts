/** Targeted fresh public pages, SSRF/robots checked. No AI, accounts or external writes. */
import {lookup} from 'node:dns/promises';
import {writeFileSync,existsSync,readFileSync} from 'node:fs';
import {safeFetchPage,extractPageContent} from '../shared/integrations/website';
import {PageFetcher} from '../shared/ai/pageFetch';
async function main(){
const urls=process.argv.length>2 ? process.argv.slice(2) : ['https://livoform.com/','https://livoform.com/compare/tally','https://livoform.com/templates','https://livoform.com/use-cases','https://livoform.com/pricing','https://tally.so/pricing','https://tally.so/experts'];
const fetcher=new PageFetcher({maxUses:urls.length,maxContentTokens:4500,allowedDomains:['livoform.com','tally.so'],resolveHost:async host=>(await lookup(host,{all:true})).map(row=>row.address)});
const prefix='bench/cache/anthropic-real-2026-11-09/';
const sources: Record<string,unknown>[] = existsSync(prefix+'livoform-fresh-source-pages.json')?JSON.parse(readFileSync(prefix+'livoform-fresh-source-pages.json','utf8')).sources:[];
const technical: {url:string;[key:string]:unknown}[] = existsSync(prefix+'livoform-technical-pages.json')?JSON.parse(readFileSync(prefix+'livoform-technical-pages.json','utf8')).pages:[];
for(const [index,url] of urls.entries()){
 const text=await fetcher.run({call_id:`source-${index}`,arguments:JSON.stringify({url})});
 const source=fetcher.fetched.find(s=>s.url===url);
 if(!source){console.log(`Not read: ${url}`);continue;}
 const oldIndex=sources.findIndex(row=>row.url===url);if(oldIndex>=0)sources.splice(oldIndex,1);
 sources.push({...source,accessedAt:new Date().toISOString(),text});
 if(new URL(url).hostname==='livoform.com'){
  const result=await safeFetchPage({url,resolveHost:async host=>(await lookup(host,{all:true})).map(row=>row.address),maxBytes:2000000,timeoutMs:15000});
  if(result.ok){const page=extractPageContent(result.body,result.finalUrl,{maxLinks:200});const oldPage=technical.findIndex(row=>row.url===url);if(oldPage>=0)technical.splice(oldPage,1);technical.push({url,finalUrl:result.finalUrl,page});}
 }console.log(`Read: ${url} (${text.length} characters)`);
}
writeFileSync('bench/cache/anthropic-real-2026-11-09/livoform-technical-pages.json',JSON.stringify({at:new Date().toISOString(),pages:technical},null,2));
writeFileSync('bench/cache/anthropic-real-2026-11-09/livoform-fresh-source-pages.json',JSON.stringify({at:new Date().toISOString(),sources},null,2));

}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
