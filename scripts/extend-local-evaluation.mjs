/** Explicitly extend the local allowance inside the existing cumulative $100 ledger. */
import { readFileSync, writeFileSync, existsSync, openSync, closeSync, unlinkSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { localEvaluationAllocation } from '../shared/economics/evaluationBudget.ts';
const dry = process.argv.includes('--dry-run');
if (!dry && !process.argv.includes('--confirm-paid-local')) throw Error('Explicit --confirm-paid-local required.');
const amount = Number(process.argv.find(arg => arg.startsWith('--allocation-usd='))?.split('=')[1]);
const directory = resolve('bench/cache/anthropic-real-2026-11-09');
const file = join(directory, 'budget.json'), lockPath = join(directory, 'budget.lock');
const lock = openSync(lockPath, 'wx', 0o600);
try {
  const ledger = JSON.parse(readFileSync(file, 'utf8'));
  const historicalPath = resolve('bench/cache/strategy-quality-2026-11-09/budget.json');
  const historical = existsSync(historicalPath) ? JSON.parse(readFileSync(historicalPath, 'utf8')).receipts : [];
  const allocation = localEvaluationAllocation(ledger.capMicros, ledger.receipts, historical, amount * 1_000_000);
  if (dry) console.log(JSON.stringify({ dryRun: true, ...allocation }));
  else {
    const state = join(tmpdir(), 'climbos-local-real'), envFile = join(state, 'backend.env');
    const rows = readFileSync(envFile, 'utf8').trim().split(/\r?\n/);
    if (rows.length !== 2 || rows[0] !== 'CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3330' || !/^CONVEX_SELF_HOSTED_ADMIN_KEY=[^\s]+$/.test(rows[1])) throw Error('Refusing a nonlocal deployment.');
    const owner = JSON.parse(readFileSync(join(state, 'owner-login.json'), 'utf8'));
    const label = `local-convex-total-${allocation.allocationMicros}`;
    if (allocation.deltaMicros) {
      ledger.receipts.push({ label, reservedMicros: allocation.deltaMicros, chargedMicros: allocation.deltaMicros, status: 'allocated_to_local_convex', at: new Date().toISOString() });
      const pending = file + '.pending'; writeFileSync(pending, JSON.stringify(ledger, null, 2), { mode: 0o600 }); renameSync(pending, file);
    }
    // Keep this reservation if the backend call fails; an uncertain write never creates extra budget.
    const env = {};
    for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG']) if (process.env[key]) env[key] = process.env[key];
    Object.assign(env, { CONVEX_DEPLOYMENT: '', CONVEX_DEPLOY_KEY: '', CONVEX_SELF_HOSTED_URL: 'http://127.0.0.1:3330', CONVEX_SELF_HOSTED_ADMIN_KEY: rows[1].slice('CONVEX_SELF_HOSTED_ADMIN_KEY='.length), DISABLE_BEACON: '1' });
    const result = execFileSync(process.execPath, [resolve('node_modules/convex/bin/main.js'), 'run', '--env-file', envFile, 'localResearch:increaseEvaluationBudget', JSON.stringify({ ownerEmail: owner.email, allocationMicros: allocation.allocationMicros, authorization: label })], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    console.log(JSON.stringify(allocation)); console.log(result.trim());
  }
} finally { closeSync(lock); unlinkSync(lockPath); }
