/** Reuses inspected real public evidence and records source corrections; no AI or external write. */
import {readFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {execFileSync} from 'node:child_process';
const state=join(tmpdir(),'climbos-local-real'),envFile=join(state,'backend.env'),rows=readFileSync(envFile,'utf8').trim().split(/\r?\n/);
if(rows.length!==2||rows[0]!=='CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3330'||!/^CONVEX_SELF_HOSTED_ADMIN_KEY=[^\s]+$/.test(rows[1]))throw Error('Only the dedicated real-data loopback profile is allowed.');
const env={};for(const k of ['PATH','HOME','TMPDIR','LANG'])if(process.env[k])env[k]=process.env[k];Object.assign(env,{CONVEX_DEPLOYMENT:'',CONVEX_DEPLOY_KEY:'',CONVEX_SELF_HOSTED_URL:'http://127.0.0.1:3330',CONVEX_SELF_HOSTED_ADMIN_KEY:rows[1].slice('CONVEX_SELF_HOSTED_ADMIN_KEY='.length),DISABLE_BEACON:'1'});
const root=resolve('bench/cache/anthropic-real-2026-11-09'),policy=JSON.parse(readFileSync(join(root,'contact-policy-sources.json'),'utf8')),owner=JSON.parse(readFileSync(join(state,'owner-login.json'),'utf8'));
for(const id of ['macloving','livoform','folevi']){
 const record=JSON.parse(readFileSync(join(root,`${id}-improved-plays.json`),'utf8'));
 const existing=record.input.precomputedResearch;
 const sources=[...existing.sources.filter(s=>!policy[id].some(p=>p.url===s.url)),...policy[id].map(({url,title,productPitchPolicy})=>({url,title,...(productPitchPolicy?{productPitchPolicy}:{})}))].slice(0,50);
 const corrections=policy[id].map(p=>`READ SOURCE ${p.url}\nAccessed ${p.accessedAt}. ${p.text}`).join('\n\n');
 // Corrections come first so an excerpt bound cannot hide an explicit refusal.
 const notes=["INSPECTED FIRST-PARTY SOURCE UPDATE. Public claims only, no contact, product testing, measured demand or action permission.",corrections,existing.notes].join('\n\n').slice(0,30000);
 const result=execFileSync(process.execPath,[resolve('node_modules/convex/bin/main.js'),'run','--env-file',envFile,'localResearch:recordResearchUpdate',JSON.stringify({ownerEmail:owner.email,slug:`real-${id}`,notes,sources})],{env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:1000000});
 console.log(`${id}: ${result.trim()}`);
}
