import {afterEach,expect,it,vi} from "vitest";
import {api} from "../../convex/_generated/api";
import {asNewUser,setup,makePaid} from "./helpers";
const state=vi.hoisted(()=>({messages:[] as string[]}));
vi.mock("../../shared/agents/fake",async original=>{
  const fakeModule=await original<typeof import("../../shared/agents/fake")>();
  return {...fakeModule,fakeTurn:async(...args:Parameters<typeof fakeModule.fakeTurn>)=>{state.messages.push(JSON.stringify(args[0].messages));return fakeModule.fakeTurn(...args);}};
});
afterEach(()=>{delete process.env.CLIMBOS_ENGINE;delete process.env.CLIMBOS_FAKE_LLM;state.messages=[];});
it("passes the owner's specific SEO request and destination to the actual draft stage",async()=>{
  const t=setup();process.env.CLIMBOS_ENGINE="v2";process.env.CLIMBOS_FAKE_LLM="ship";
  const owner=await asNewUser(t,"seo-request@example.com");const {slug,orgId}=await owner.client.mutation(api.orgs.createWorkspace,{businessName:"Scenario forms",website:"https://business.example/"});await makePaid(t,orgId);
  const brief="Explain hosted links versus custom domains on https://business.example/compare/existing instead of writing another generic homepage.";
  const run=await owner.client.mutation(api.content.generate,{slug,job:"content_seo",brief});await t.finishAllScheduledFunctions(()=>undefined);
  expect(state.messages.some(text=>text.includes(brief))).toBe(true);
  expect(await owner.client.query(api.content.runStatus,{slug,runId:run.runId})).toBeTruthy();
});
