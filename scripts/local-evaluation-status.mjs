/** Read-only actual usage/status snapshot from the dedicated local backend. No AI calls. */
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
const state=join(tmpdir(),'climbos-local-real'),envFile=join(state,'backend.env'),rows=readFileSync(envFile,'utf8').trim().split(/\r?\n/);
if(rows.length!==2||rows[0]!=='CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3330'||!/^CONVEX_SELF_HOSTED_ADMIN_KEY=[^\s]+$/.test(rows[1]))throw Error('Only the dedicated real-data loopback profile is allowed.');
const env={};for(const k of ['PATH','HOME','TMPDIR','LANG'])if(process.env[k])env[k]=process.env[k];Object.assign(env,{CONVEX_DEPLOYMENT:'',CONVEX_DEPLOY_KEY:'',CONVEX_SELF_HOSTED_URL:'http://127.0.0.1:3330',CONVEX_SELF_HOSTED_ADMIN_KEY:rows[1].slice('CONVEX_SELF_HOSTED_ADMIN_KEY='.length),DISABLE_BEACON:'1'});
const data=table=>JSON.parse(execFileSync(process.execPath,[resolve('node_modules/convex/bin/main.js'),'data',table,'--env-file',envFile,'--format','json','--limit','1000'],{env,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16000000}));
const root=resolve('bench/cache/anthropic-real-2026-11-09');
const ids=new Set(readdirSync(root).filter(n=>/^local-real-.*-run\.json$/.test(n)).map(n=>JSON.parse(readFileSync(join(root,n),'utf8')).runId));
const runs=data('workflowRuns').filter(r=>ids.has(r._id)),steps=data('workflowSteps'),usage=data('usageEvents').filter(r=>ids.has(r.runId));
const snapshot={at:new Date().toISOString(),providerMicros:usage.filter(r=>['model_call','search_call'].includes(r.type)).reduce((s,r)=>s+r.costMicros,0),runs:runs.map(r=>({id:r._id,status:r.status,isFixture:r.isFixture,error:r.error,providerMicros:r.providerMicros,steps:steps.filter(s=>s.runId===r._id).map(s=>({label:s.label,status:s.status,error:s.error})),models:[...new Set(usage.filter(u=>u.runId===r._id).map(u=>u.model).filter(Boolean))]})),usage:usage.map(u=>({runId:u.runId,model:u.model,type:u.type,costMicros:u.costMicros,inputTokens:u.inputTokens,outputTokens:u.outputTokens,reasoningTokens:u.reasoningTokens}))};
writeFileSync(join(root,'local-backend-usage.json'),JSON.stringify(snapshot,null,2));console.log(JSON.stringify({providerDollars:snapshot.providerMicros/1e6,runs:snapshot.runs},null,2));
