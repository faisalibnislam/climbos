/** Reserves $10 inside the existing evaluation ledger, then enables real local app calls only. */
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, unlinkSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
if (!process.argv.includes('--confirm-paid-local')) throw Error('This command enables paid local app calls; explicit --confirm-paid-local required.');
const dir=resolve('bench/cache/anthropic-real-2026-11-09'), path=join(dir,'budget.json'), lockPath=join(dir,'budget.lock');
const lock=openSync(lockPath,'wx',0o600);
try {
 const ledger=JSON.parse(readFileSync(path,'utf8'));
 if(ledger.capMicros!==100000000) throw Error('Unexpected authorized budget.');
 const oldPath=resolve('bench/cache/strategy-quality-2026-11-09/budget.json');
 const old=existsSync(oldPath)?JSON.parse(readFileSync(oldPath,'utf8')).receipts.reduce((s,r)=>s+r.chargedMicros,0):0;
 const allocated=ledger.receipts.find(r=>r.label==='local-convex-budget');
 if(!allocated){
  const used=ledger.receipts.reduce((s,r)=>s+r.chargedMicros,0);
  if(used+old+10000000>100000000) throw Error('The $10 local allowance does not fit the remaining authorized budget.');
  ledger.receipts.push({label:'local-convex-budget',reservedMicros:10000000,chargedMicros:10000000,status:'allocated_to_local_convex',at:new Date().toISOString()});
  const pending=path+'.pending';writeFileSync(pending,JSON.stringify(ledger,null,2),{mode:0o600});renameSync(pending,path);
 } else if(allocated.chargedMicros!==10000000) throw Error('Existing local allocation is not the expected fixed ceiling.');
 const state=join(tmpdir(),'climbos-local-real'), envFile=join(state,'backend.env');
 const rows=readFileSync(envFile,'utf8').trim().split(/\r?\n/);
 if(rows.length!==2||rows[0]!=='CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3330'||!/^CONVEX_SELF_HOSTED_ADMIN_KEY=[^\s]+$/.test(rows[1])) throw Error('Refusing a nonlocal deployment.');
 const owner=JSON.parse(readFileSync(join(state,'owner-login.json'),'utf8'));
 const env={};for(const k of ['PATH','HOME','TMPDIR','LANG'])if(process.env[k])env[k]=process.env[k];
 Object.assign(env,{CONVEX_DEPLOYMENT:'',CONVEX_DEPLOY_KEY:'',CONVEX_SELF_HOSTED_URL:'http://127.0.0.1:3330',CONVEX_SELF_HOSTED_ADMIN_KEY:rows[1].slice('CONVEX_SELF_HOSTED_ADMIN_KEY='.length),DISABLE_BEACON:'1'});
 const cli=resolve('node_modules/convex/bin/main.js');
 const result=execFileSync(process.execPath,[cli,'run','--env-file',envFile,'localResearch:setEvaluationBudget',JSON.stringify({ownerEmail:owner.email,allocationMicros:10000000})],{env,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const key=readFileSync('.env.anthropic.local','utf8').match(/^\s*ANTHROPIC_API_KEY\s*=\s*(.+)\s*$/m)?.[1]?.trim().replace(/^(['"])(.*)\1$/,'$2');
 if(!key)throw Error('Saved Anthropic key missing.');
 execFileSync(process.execPath,[cli,'env','set','--env-file',envFile,'ANTHROPIC_API_KEY'],{env,input:key,stdio:['pipe','ignore','pipe']});
 console.log('Enabled Anthropic only on the dedicated local backend. A $10 allowance is reserved inside the overall $100 budget. The shared local app wallet has a fixed $6 credit ceiling, leaving overage headroom. No subscription, ads, email or publishing account configured.');
 console.log(result.trim());
} finally { closeSync(lock);unlinkSync(lockPath); }
