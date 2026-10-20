#!/usr/bin/env python3
"""Build indexes and check packaging contracts; does not evaluate a live engine."""
from pathlib import Path
import hashlib,json,re,zipfile,xml.etree.ElementTree as E
ROOT=Path(__file__).resolve().parents[1]
DATE='2026-10-20'
def load(path):return json.loads((ROOT/path).read_text())
def dump(path,obj):(ROOT/path).write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def records(obj,key):return obj if isinstance(obj,list) else obj[key]
def main():
 errors=[];sources=[];locators={};checked_books=0;checked_locators=0
 for name in ['guides/sources-a.json','guides/sources-b.json','videos/sources.json','articles/sources.json','collections/sources.json']:
  for s in records(load(name),'sources'):
   record=dict(s);record['registry_record_file']=name
   record['kind']='uploaded_book' if s['id'].startswith('BK') else 'public_source'
   sources.append(record)
   for loc in s.get('locators',[]):
    if loc['id'] in locators:errors.append('duplicate locator '+loc['id'])
    locators[loc['id']]=dict(loc,book_id=s['id'])
   if record['kind']=='uploaded_book':
    file=ROOT.parent/'upload'/s['original_filename']
    if file.exists():
     if sha(file)!=s['sha256']:errors.append('source hash mismatch '+s['id'])
     else:checked_books+=1
     with zipfile.ZipFile(file) as z:
      for loc in s['locators']:
       try:
        dom=E.fromstring(z.read(loc['epub_path']));els=list(dom.iter())
        assert 0<=loc['block_start']<=loc['block_end']<len(els)
        for endpoint in [loc['block_start'],loc['block_end']]:
         assert els[endpoint].tag.rsplit('}',1)[-1] in ['h1','h2','h3','h4','p','li','td','figcaption']
        checked_locators+=1
       except Exception as exc:errors.append(f"invalid locator {loc['id']}: {exc}")
 sources.append({'id':'ENGINE_POLICY','title':'Original ClimbOS reconciliation and execution policy proposals','kind':'original_policy','registry_record_file':'RECONCILIATION.md','verification_status':'proposed_not_empirically_validated','publication_date':DATE})
 ids=[s['id'] for s in sources]
 if len(set(ids))!=len(ids):errors.append('duplicate source ids')
 source_ids=set(ids);known_refs=source_ids|set(locators)
 case_data=load('collections/public_cases.json');known_refs|={c['id'] for c in case_data['cases']}
 dump('source_registry.json',{'edition':DATE,'sources':sources,'locator_count':len(locators),'locators':list(locators.values()),'source_types_separate':True})
 catalog=[]
 for name in ['playbooks/books-a.json','playbooks/books-b.json','videos/playbooks.json','articles/playbooks.json','collections/business_type_playbooks.json']:
  for p in records(load(name),'playbooks'):
   for k in ['id','applies_when','required_inputs','steps','outputs','stop_conditions','status']:
    if k not in p or not p[k]:errors.append(f'{name}: missing {k}')
   if not p.get('task') and not p.get('title'):errors.append('missing task '+p['id'])
   for ref in p.get('evidence_refs',[]):
    if ref not in known_refs:errors.append('unresolved evidence reference '+ref)
   catalog.append({'id':p['id'],'task':p.get('task',p.get('title')),'path':name,'source_refs':p.get('evidence_refs',[]),'authorship':'original_climbos_application','status':p['status'],'execution_permission':'none_from_this_document'})
 if len({p['id'] for p in catalog})!=len(catalog):errors.append('duplicate playbook IDs')
 dump('playbooks/catalog.json',{'count':len(catalog),'status':'reference_contracts_require_implementation','playbooks':catalog})
 fixtures=load('evaluations/cases.json')['cases']
 if len(fixtures)!=32 or len({x['id'] for x in fixtures})!=32:errors.append('expected32unique fixtures')
 for c in fixtures:
  if c['status']!='not_run_against_engine' or c['actual_output'] is not None or c['observed_result'] is not None:errors.append('fixture falsely marked run '+c['id'])
  for ref in c['source_concepts']:
   if ref not in source_ids:errors.append('unresolved fixture source '+ref)
  if not c['expected_behaviors'] or not c['hard_failures']:errors.append('incomplete fixture '+c['id'])
 for p in ROOT.rglob('*.json'):
  try:json.loads(p.read_text())
  except Exception as exc:errors.append(f'{p.name} invalid JSON {exc}')
 for p in ROOT.rglob('*.md'):
  text=p.read_text()
  for target in re.findall(r'\]\(([^\s)]+)\)',text):
   if '://' in target or target.startswith('#'):continue
   if not (p.parent/target.split('#')[0]).exists():errors.append(f'{p.relative_to(ROOT)} broken link {target}')
  for lang,code in re.findall(r'```(json)\n(.*?)\n```',text,re.S):
   try:json.loads(code)
   except Exception as exc:errors.append(f'{p.name} invalid JSON fence {exc}')
 for p in (ROOT/'guides').glob('*.md'):
  for ref in set(re.findall(r'BK\d{2}-L\d{2}',p.read_text())):
   if ref not in locators:errors.append('unknown guide locator '+ref)
 source_urls=set()
 for s in sources:
  for key in ['url','supporting_url']:
   if s.get(key):source_urls.add(s[key])
 summary={'edition':DATE,'book_guides':len(list((ROOT/'guides').glob('*.md'))),'uploaded_books':sum(s['kind']=='uploaded_book' for s in sources),'book_locators':len(locators),'source_hashes_verified':checked_books,'locator_ranges_verified':checked_locators,'videos':len(load('videos/sources.json')['sources']),'article_training_sources':len(load('articles/sources.json')['sources']),'business_type_playbooks':len(load('collections/business_type_playbooks.json')['playbooks']),'public_cases':len(case_data['cases']),'platform_rules':len(load('collections/platform_rules.json')['rules']),'new_playbooks':len(catalog),'synthetic_evaluation_cases':len(fixtures),'public_source_urls':len(source_urls),'engine_evaluation_performed':False,'errors':errors}
 dump('validation.json',summary)
 # Hash all deliverable files except generated manifest and quality report to avoid self-reference.
 files=[]
 for p in sorted(ROOT.rglob('*')):
  if p.is_file() and p.name not in ['manifest.json','QUALITY_REPORT.md'] and '__pycache__' not in p.parts:
   files.append({'path':p.relative_to(ROOT).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)})
 dump('manifest.json',{'edition':DATE,'package_status':'validated' if not errors else 'validation_failed','scope':summary,'files':files})
 report=['# Expansion quality report','',f'Edition and research date: {DATE}. Status: **'+('passed packaging validation' if not errors else 'validation errors')+'**.','',
  f"Six book guides, {summary['book_locators']} EPUB locators, four transcript-backed video guides, six article/training sources, six business-type playbooks, six public cases, six platform-rule records, {len(catalog)} new reference playbooks, and32synthetic evaluation cases.", '',
  '## Checks actually performed','',
  f"- Original uploaded EPUB hashes verified: {checked_books}.",f"- EPUB locator path and XML element-range checks: {checked_locators}.",'- JSON files, Markdown JSON examples, playbook required fields, evidence references, local links, unique IDs, and source-reference resolution checked.','- Six synthetic numerical scenarios checked by a separate deterministic script with14arithmetic assertions.','- No live ClimbOS engine, model benchmark, authenticated training course, publishing action, paid ad experiment, or customer integration was run.','',
  '## Evidence and access limits','',
  'Book reading was targeted to the substantive passages used in the guides and their context. It was not an exhaustive page-by-page editorial audit. EPUB metadata and layout issues are recorded in the book registry. Internal file/element locators are not print page numbers, and figures were not reconstructed from fragmented text.','',
  'Video transcripts were retrieved; audiovisual playback was not claimed. Publisher chapter timestamps were retained where exposed; missing timestamps remain null. Five public article pages and the Google Skillshop public landing page were inspected; private lessons, exams, and course completion were not accessed.','',
  'Public cases are first-party reports with stated methodological and transfer limits, not independently reanalyzed customer outcomes. Customer-language and benchmark forms intentionally contain unknown fields. Meta policy retrieval was blocked and remains unresolved; dependent execution requires current verification.','',
  '## Proposed versus observed','',
  'All playbooks, schemas, evaluation expectations, and engine integration rules are proposed original ClimbOS applications. The32evaluation cases are synthetic and unrun. Fixture checks establish internal consistency only. The source registry distinguishes uploaded author concepts, public reported evidence, and original policies.','',
  '## Validation errors','']
 report += ['- '+x for x in errors] if errors else ['None.']
 (ROOT/'QUALITY_REPORT.md').write_text('\n'.join(report).replace('and32','and 32').replace('with14','with 14').replace('The32','The 32')+'\n')
 print(json.dumps(summary))
 if errors:raise SystemExit(1)
if __name__=='__main__':main()
