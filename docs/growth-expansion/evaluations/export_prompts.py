#!/usr/bin/env python3
import json
from pathlib import Path
root=Path(__file__).resolve().parent
data=json.loads((root/'cases.json').read_text())
rows=[]
for case in data['cases']:
    rows.append({'case_id':case['id'],'prompt':'This is a synthetic ClimbOS evaluation. Do not execute external actions.\nTask: '+case['task']+'\nInputs: '+json.dumps(case['inputs'],ensure_ascii=False)+'\nRespond with a diagnosis, relevant evidence, uncertainties, alternatives, next steps, economics if applicable, and stop/review conditions. Do not invent missing facts.'})
(root/'prompts.jsonl').write_text(''.join(json.dumps(r,ensure_ascii=False)+'\n' for r in rows))
print(json.dumps({'exported_prompts':len(rows),'model_calls':0}))
