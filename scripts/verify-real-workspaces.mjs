/** Read-only browser checks of the dedicated real-data loopback workspace. No AI or external actions. */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const state=join(tmpdir(),'climbos-local-real');
const config=JSON.parse(readFileSync(join(state,'web.json'),'utf8'));
if(config.NEXT_PUBLIC_SITE_URL!=='http://127.0.0.1:3430'||config.NEXT_PUBLIC_CONVEX_URL!=='http://127.0.0.1:3330')throw Error('Only the dedicated real-data loopback profile is allowed.');
const owner=JSON.parse(readFileSync(join(state,'owner-login.json'),'utf8'));
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1366,height:900}});const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));const checks=[];
try{
 await page.goto(config.NEXT_PUBLIC_SITE_URL+'/dev-login?next=/app/real-macloving/plan');
 await page.getByLabel('Email',{exact:true}).fill(owner.email);await page.getByLabel('Password',{exact:true}).fill(owner.password);
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(/\/app\/real-macloving\/plan/,{timeout:45000});await page.getByRole('tab',{name:'Next steps',exact:true}).waitFor({timeout:45000});
 for(const business of ['macloving','livoform','folevi']){
  for(const route of ['plan','today','work','results']){
   await page.goto(`${config.NEXT_PUBLIC_SITE_URL}/app/real-${business}/${route}`);
   await page.getByRole('heading',{level:1}).first().waitFor({timeout:30000});
   if(await page.getByText('Demo data',{exact:true}).count())throw Error('Fixture content reached the real workspace.');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1);if(overflow)throw Error(`${business}/${route} overflows`);
   if(route==='plan'){
    const tab=page.getByRole('tab',{name:'Next steps',exact:true});await tab.waitFor();if(await tab.getAttribute('aria-selected')!=='true')throw Error('Plan does not open on Next steps.');
    await page.getByRole('tab',{name:'Why this plan',exact:true}).click();await page.getByRole('heading',{name:'Where your business could go',exact:true}).waitFor();
    await tab.click();
    const reviewDrafts=page.getByRole('button',{name:'Review prepared drafts',exact:true});await reviewDrafts.waitFor();await reviewDrafts.click();
    const starter=page.locator('#prepared-work details').first();if(!await starter.evaluate(el=>el.open))throw Error('Prepared drafts did not open directly.');await starter.locator('summary').click();
    checks.push(`${business}/prepared work: opens an existing draft before plan approval, without a new AI request`);
    await page.getByRole('tab',{name:'Why this plan',exact:true}).click();await page.getByRole('button',{name:'Update my plan',exact:true}).click();
    const dialog=page.getByRole('alertdialog');await dialog.locator('summary').filter({hasText:'AI settings (optional)'}).click();
    await dialog.getByRole('combobox').filter({hasText:'Simple next step and prepared drafts'}).waitFor();
    await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
    checks.push(`${business}/plan settings: focused contract selected by default; quote shown without starting work`);
    await tab.click();await page.evaluate(()=>window.scrollTo(0,0));
    const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();const serious=axe.violations.filter(v=>['serious','critical'].includes(v.impact));if(serious.length)throw Error(JSON.stringify(serious.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,summary:n.failureSummary}))}))));
    await page.screenshot({path:resolve(`bench/cache/anthropic-real-2026-11-09/real-${business}-desktop.png`),fullPage:true});
   }
   checks.push(`${business}/${route}: real data, page loaded, no horizontal overflow`);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.goto(config.NEXT_PUBLIC_SITE_URL+'/app/real-macloving/plan');await page.getByRole('tab',{name:'Next steps',exact:true}).waitFor();
 if(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1))throw Error('Mobile plan overflows.');
 const mobileAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();if(mobileAxe.violations.some(v=>['serious','critical'].includes(v.impact)))throw Error('Mobile accessibility findings remain.');
 await page.screenshot({path:resolve('bench/cache/anthropic-real-2026-11-09/real-macloving-mobile.png'),fullPage:true});checks.push('mobile plan: no overflow or serious/critical accessibility findings');
 if(errors.length)throw Error(JSON.stringify(errors));writeFileSync('bench/cache/anthropic-real-2026-11-09/real-ui-checks.json',JSON.stringify({at:new Date().toISOString(),checks,pageErrors:errors,paidCalls:0,externalWrites:0},null,2));console.log(`Passed ${checks.length} real-workspace browser checks; no paid calls or external writes.`);
}catch(error){
 if(page.url().includes('/app/')||page.url().includes('/sign-in')){writeFileSync('/tmp/climbos-real-ui-failure.txt',page.url()+'\n'+await page.locator('body').innerText());await page.screenshot({path:'/tmp/climbos-real-ui-failure.png',fullPage:true});}
 throw error;
}finally{await browser.close();}
