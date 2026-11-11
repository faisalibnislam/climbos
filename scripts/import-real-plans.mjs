/** Imports saved real-model outputs into the dedicated local Convex deployment only. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ConvexHttpClient } from 'convex/browser';
const state = join(tmpdir(), 'climbos-local-real');
const envFile = join(state, 'backend.env');
const rows = readFileSync(envFile, 'utf8').trim().split(/\r?\n/);
if (rows.length !== 2 || rows[0] !== 'CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3330' || !/^CONVEX_SELF_HOSTED_ADMIN_KEY=[^\s]+$/.test(rows[1])) throw Error('Refusing any deployment other than the dedicated real-data loopback instance.');
const client = new ConvexHttpClient('http://127.0.0.1:3330');
const authPath = join(state, 'owner-login.json');
const owner = existsSync(authPath) ? JSON.parse(readFileSync(authPath, 'utf8')) : { email: 'owner@local.climbos', password: randomBytes(24).toString('base64url') };
if (!existsSync(authPath)) {
 await client.action('auth:signIn', { provider: 'dev-password', params: { email: owner.email, password: owner.password, flow: 'signUp' } });
 writeFileSync(authPath, JSON.stringify(owner), { mode: 0o600 });
 console.log('Created the local owner sign-in. Credentials are stored only in the local state directory.');
}
const variant = process.argv[2] ?? 'improved';
const horizonDays=Number(process.argv[3]??14);if(![14,30,90].includes(horizonDays))throw Error('Invalid plan horizon.');
if (!/^[a-z0-9-]{1,40}$/.test(variant)) throw Error('Invalid variant');
const dir = resolve('bench/cache/anthropic-real-2026-11-09');
const ledger = JSON.parse(readFileSync(join(dir, 'budget.json'), 'utf8'));
const safeEnv = {};
for (const key of ['PATH','HOME','TMPDIR','LANG']) if (process.env[key]) safeEnv[key]=process.env[key];
Object.assign(safeEnv, { CONVEX_DEPLOYMENT:'', CONVEX_DEPLOY_KEY:'', CONVEX_SELF_HOSTED_URL:'http://127.0.0.1:3330', CONVEX_SELF_HOSTED_ADMIN_KEY:rows[1].slice('CONVEX_SELF_HOSTED_ADMIN_KEY='.length), DISABLE_BEACON:'1' });
for (const id of ['macloving','livoform','folevi']) {
 const rawFocused=join(dir,`${id}-${variant}-focused-${horizonDays}.json`),recoveredFocused=join(dir,`${id}-${variant}-focused-${horizonDays}-recovered.json`);
 const focusedPath=existsSync(recoveredFocused)?recoveredFocused:rawFocused;
 if(existsSync(focusedPath)) {
  const record=JSON.parse(readFileSync(focusedPath,'utf8')), evidence=JSON.parse(readFileSync(join(dir,`${id}-${variant}-evidence.json`),'utf8'));
  if(!record.result)throw Error(`No complete focused result for ${id}.`);
  const phases=ledger.receipts.filter(r=>r.label.startsWith(`${id}/${variant}/focused-${horizonDays}/`)).map(r=>({label:r.label.split('/').slice(3).join('/'),model:r.model,costMicros:r.actualMicros??0,status:r.status}));
  if(!phases.length||phases.some(p=>p.status!=='completed'))throw Error('All imported phases need completed actual receipts.');
  const payload={ownerEmail:owner.email,name:evidence.name,website:evidence.website,acquisitionType:evidence.type,key:`${variant}-${id}${horizonDays===14?"":`-${horizonDays}`}`,horizonDays,sourceHash:record.sourceHash,costMicros:phases.reduce((sum,p)=>sum+p.costMicros,0),phases,plan:record.result.output,assessment:record.result.assessment,rounds:record.result.rounds,sources:record.input.precomputedResearch.sources,researchNotes:record.input.precomputedResearch.notes,brief:record.input.brief};
  const output=execFileSync(process.execPath,[resolve('node_modules/convex/bin/main.js'),'run','--env-file',envFile,'localResearch:importFocusedPlan',JSON.stringify({payload:JSON.stringify(payload)})],{env:safeEnv,encoding:'utf8',maxBuffer:4000000,stdio:['ignore','pipe','pipe']});
  console.log(`${id}: ${output.trim()}`);continue;
 }
 const playsPath=join(dir,`${id}-${variant}-plays.json`), planPath=join(dir,`${id}-${variant}-plan-${horizonDays}.json`);
 if (!existsSync(playsPath) || !existsSync(planPath)) {console.log(`Waiting for complete ${id}/${variant} outputs.`);continue;}
 const plays=JSON.parse(readFileSync(playsPath,'utf8')), plan=JSON.parse(readFileSync(planPath,'utf8')), evidence=JSON.parse(readFileSync(existsSync(join(dir,`${id}-${variant}-evidence.json`))?join(dir,`${id}-${variant}-evidence.json`):join(dir,`${id}-evidence.json`),'utf8'));
 if(!plays.result || !plan.result) {console.log(`Skipping failed ${id}/${variant}; no replacement data created.`);continue;}
 const phases=ledger.receipts.filter(r=>r.label.startsWith(`${id}/${variant}/plays/`)||r.label.startsWith(`${id}/${variant}/plan-${horizonDays}/`)).map(r=>({label:r.label.split('/').slice(3).join('/'),model:r.model,costMicros:r.actualMicros??0,status:r.status}));
 const payload={ownerEmail:owner.email,name:evidence.name,website:evidence.website,acquisitionType:evidence.type,key:`${variant}-${id}${horizonDays===14?"":`-${horizonDays}`}`,horizonDays,sourceHash:plan.sourceHash,costMicros:phases.reduce((s,r)=>s+r.costMicros,0),phases,plan:plan.result.output,plays:plays.result.output,playsAssessment:plays.result.assessment,planAssessment:plan.result.assessment,playsRounds:plays.result.rounds,planRounds:plan.result.rounds,sources:evidence.sources.map(({url,title})=>({url,title})),researchNotes:plays.input?.precomputedResearch?.notes??evidence.sources.map(s=>`${s.url}\n${s.text}`).join('\n\n'),brief:evidence.limitations};
 const output=execFileSync(process.execPath,[resolve('node_modules/convex/bin/main.js'),'run','--env-file',envFile,'localResearch:importPlan',JSON.stringify({payload:JSON.stringify(payload)})],{env:safeEnv,encoding:'utf8',maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
 console.log(`${id}: ${output.trim()}`);
}
