#!/usr/bin/env python3
"""Check fixture expectations; does not grade ClimbOS outputs."""
from pathlib import Path
import json, math
p=Path(__file__).resolve().parent
cases={c['id']:c for c in json.loads((p/'cases.json').read_text())['cases']}
actual={}
i=cases['EV03']['inputs'];cost=sum(i[k] for k in ['model_research_cost_usd','email_infra_allocation_usd','variable_support_cost_usd']);c=i['price_usd']-cost
actual['EV03']={'sum_defined_cost':cost,'contribution':c,'contribution_margin':c/i['price_usd']}
i=cases['EV08']['inputs'];a=i['control']['purchases']/i['control']['visitors'];b=i['treatment']['purchases']/i['treatment']['visitors']
actual['EV08']={'control_rate':a,'treatment_rate':b,'absolute_rate_difference':b-a,'relative_rate_change':(b-a)/a}
i=cases['EV12']['inputs'];c=i['net_project_revenue_usd']-i['incremental_delivery_usd'];actual['EV12']={'pre_acquisition_contribution':c,'post_acquisition_contribution':c-i['acquisition_proposal_usd']}
i=cases['EV15']['inputs'];c=i['bundle_price']-sum(v['variable_cost'] for v in i['products'].values());actual['EV15']={'bundle_contribution':c,'bundle_contribution_margin':c/i['bundle_price']}
i=cases['EV20']['inputs'];actual['EV20']={'observed_revenue_change':(i['after_revenue']-i['before_revenue'])/i['before_revenue']}
i=cases['EV31']['inputs'];actual['EV31']={'margin_at_stated_price':(i['stated_monthly_wtp']-i['defined_monthly_variable_cost'])/i['stated_monthly_wtp'],'cost_based_price_floor':i['defined_monthly_variable_cost']/(1-i['target_margin'])}
count=0
for id,values in actual.items():
    for check in cases[id]['numeric_checks']:
        assert math.isclose(values[check['formula']],check['expected'],rel_tol=1e-10,abs_tol=1e-10),(id,check)
        count+=1
print(json.dumps({'numeric_cases':len(actual),'arithmetic_assertions_passed':count,'engine_evaluated':False}))
