#!/usr/bin/env python3
import copy, json
from pathlib import Path
from jsonschema import Draft202012Validator
ROOT=Path(__file__).resolve().parents[2]
FX=ROOT/'tests/ai-production/fixtures/v2-p1'

def read(rel): return json.loads((ROOT/rel).read_text(encoding='utf-8'))
def fixture(name): return json.loads((FX/name).read_text(encoding='utf-8'))
def validate(schema_rel,value,label):
    schema=read(schema_rel)
    Draft202012Validator.check_schema(schema)
    errors=sorted(Draft202012Validator(schema).iter_errors(value),key=lambda e:list(e.path))
    if errors:
        raise AssertionError(label+'\n'+'\n'.join(f'{list(e.path)}: {e.message}' for e in errors))

def reject(schema_rel,value,label):
    schema=read(schema_rel)
    errors=list(Draft202012Validator(schema).iter_errors(value))
    if not errors: raise AssertionError(label+' unexpectedly passed')

pairs=[
 ('schemas/ai/ai-program.schema.json',fixture('valid-program.json'),'program'),
 ('schemas/ai/ai-layout.schema.json',fixture('valid-layout.json'),'layout'),
 ('schemas/ai/ai-node.schema.json',fixture('valid-node.json'),'node'),
 ('schemas/ai/ai-target-selector.schema.json',fixture('valid-selector.json'),'selector'),
 ('schemas/ai/ai-runtime.schema.json',fixture('valid-runtime.json'),'runtime'),
 ('schemas/ai/ai-trace.schema.json',fixture('valid-trace.json'),'trace'),
 ('schemas/ai/ai-master-snapshot.schema.json',fixture('valid-master-snapshot.json'),'master_snapshot'),
]
for s,v,l in pairs: validate(s,v,l)
exports=[
 ('schemas/exports/ai-ai_nodes.schema.json','valid-node.json'),
 ('schemas/exports/ai-ai_target_selectors.schema.json','valid-selector.json'),
 ('schemas/exports/ai-ai_programs.schema.json','valid-program.json'),
 ('schemas/exports/ai-ai_program_layouts.schema.json','valid-layout.json'),
 ('schemas/exports/ai-ai_program_runtime.schema.json','valid-runtime.json'),
]
for s,f in exports: validate(s,[fixture(f)],s)
legacy_program=read('tests/ai-production/fixtures/valid-program.json')
legacy_layout=read('tests/ai-production/fixtures/valid-layout.json')
reject('schemas/ai/ai-program.schema.json',legacy_program,'V1 program')
reject('schemas/ai/ai-layout.schema.json',legacy_layout,'V1 layout')
invalid=copy.deepcopy(fixture('valid-program.json')); invalid['nodes'][0]['node_type']='target'; invalid['nodes'][0]['master_node_id']='AIT-0001'
reject('schemas/ai/ai-program.schema.json',invalid,'Target node residue')
invalid=copy.deepcopy(fixture('valid-runtime.json')); invalid['instructions'][0]['op']='TARGET'
reject('schemas/ai/ai-runtime.schema.json',invalid,'TARGET runtime residue')
invalid=copy.deepcopy(fixture('valid-trace.json')); invalid['events'][0].pop('origin_part_id')
reject('schemas/ai/ai-trace.schema.json',invalid,'Trace missing origin_part_id')
print('AI_V2_SCHEMA_SELF_VALIDATION_R10_P1_OK schemas=12 v1_reject=2 target_residue_reject=2 origin_required=1')
