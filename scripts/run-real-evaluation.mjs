/** Local paid evaluation queue; each child independently enforces the same durable $100 ledger. */
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
const deadline=Date.now()+60*60*1000;
while(existsSync('bench/cache/anthropic-real-2026-11-09/budget.lock')) { if(Date.now()>deadline) throw Error('Another evaluation is still running; no extra call started.'); await setTimeout(2000); }
async function run(stage,variant,extra=[]) {
 console.log(`START ${stage}/${variant}`);
 await new Promise((resolve,reject)=>{ const child=spawn(process.execPath,['--import','tsx','bench/strategy-quality/anthropicLive.ts','--stage',stage,'--variant',variant,'--confirm-paid',...extra],{stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(`${stage}/${variant} stopped (${code}); saved work and budget holds retained.`))); });
}
// Complete the independent plan judgments before the remaining page drafts.
await run('judge','improved-v2',['--cases','macloving','--horizons','14','--evidence-from','improved-v2']);
await run('judge','improved',['--cases','livoform,folevi','--horizons','14','--evidence-from','improved']);
// Preserve the 12k output-limit failure; finish these pages once with the tested
// full-page output contract. Macloving's completed page is reused.
await run('seo','assets-v4',['--cases','livoform,folevi','--evidence-from','improved']);
console.log('Evaluation queue complete; judgments and actual complete drafts are ready for review.');
