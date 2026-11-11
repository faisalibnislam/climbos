/** Read-only export of the actual local app view. Never starts AI work. */
import {readFileSync,writeFileSync} from 'node:fs';import {join,resolve} from 'node:path';import {tmpdir} from 'node:os';import {ConvexHttpClient} from 'convex/browser';
const state=join(tmpdir(),'climbos-local-real'),config=JSON.parse(readFileSync(join(state,'web.json'),'utf8'));
if(config.NEXT_PUBLIC_CONVEX_URL!=='http://127.0.0.1:3330')throw Error('Only the dedicated loopback backend is allowed.');
const owner=JSON.parse(readFileSync(join(state,'owner-login.json'),'utf8')),client=new ConvexHttpClient(config.NEXT_PUBLIC_CONVEX_URL);
const login=await client.action('auth:signIn',{provider:'dev-password',params:{email:owner.email,password:owner.password,flow:'signIn'}});if(!login.tokens?.token)throw Error('Local sign-in failed.');client.setAuth(login.tokens.token);
for(const id of ['macloving','livoform','folevi']){
 const view=await client.query('workspace:plan',{slug:`real-${id}`});
 writeFileSync(resolve(`bench/cache/anthropic-real-2026-11-09/local-real-${id}-current-plan-view.json`),JSON.stringify(view,null,2));
 const plan=view.strategy;console.log(JSON.stringify({id,status:plan?.status,focused:!!plan?.expert?.focusedMove,quality:plan?.expert?.quality?.state,title:plan?.expert?.focusedMove?.title,drafts:plan?.expert?.preparedWork?.map(w=>({kind:w.kind,target:w.target})),activeRun:view.strategyRun?.status}));
}
