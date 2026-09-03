const assert=require('assert');
const fs=require('fs');
const path=require('path');
const validator=require('../studio/data-exchange/data-exchange-integrity-validator.js');
global.GKSDataExchangeIntegrityValidator=validator;
const dx=require('../studio/data-exchange/data-exchange-core.js');
const gate=require('../studio/data-exchange/full-import-gate.js');

function validProject(){return {
  schema_version:'4.0.0-draft',project:{id:'PRJ-DEMO',name:'Demo',updated_at:'R1'},decisions:[],entities:[],history:[],
  chapters:[{id:'CHP-0001',title:'Chapter',sections:[{id:'SEC-0001',title:'Section',scenes:[{id:'SCN-0001',title:'Scene',dialogues:[{id:'DLG-0001',speaker:'A',text:'Hello'}]}]}]}],
  quests:[{id:'QST-0001',name:'Quest',boxes:[],prerequisite_ids:[],next_quest_ids:[],required_flags:[],set_flags:[]}],
  events:[{id:'EVT-0001',name:'Event',required_flags:[],set_flags:[]}],flags:[{id:'FLG-0001',name:'Flag'}],
  characters:[],organizations:[],terms:[],relationships:[],timeline:[],battle_tests:[],battle_snapshots:[],tags:[{id:'TAG-0001',name:'Tag'}],tag_categories:[],ai_programs:[],ai_program_layouts:[],ai_program_runtime:[],
  masters:{stats:[{id:'STA-0001',name:'STR'}],jobs:[],skills:[],equipment:[],mods:[],monsters:[],status_effects:[],tablets:[],ai_searches:[],ai_conditions:[],ai_target_selectors:[],ai_actions:[],maps:[],exploration_outcomes:[],reward_tables:[],adventure_settings:[{id:'ADV-0001',name:'Default'}]}
}}

(async()=>{
  const good=validProject();
  let report=gate.validateBase(good);assert.equal(report.ok,true,JSON.stringify(report.issues));
  const bad=JSON.parse(JSON.stringify(good));bad.quests[0].id='QST-CH01-SEC01';report=gate.validateBase(bad);assert.equal(report.ok,false);assert(report.issues.some(x=>x.code==='invalid_id'&&x.path==='quests[0].id'));
  const badNested=JSON.parse(JSON.stringify(good));badNested.chapters[0].sections={};report=gate.validateBase(badNested);assert.equal(report.ok,false);assert(report.issues.some(x=>x.code==='invalid_type'&&x.path.includes('sections')));
  const noName=JSON.parse(JSON.stringify(good));noName.events[0].name='';report=gate.validateBase(noName);assert.equal(report.ok,false);assert(report.issues.some(x=>x.code==='required'&&x.path==='events[0].name'));

  const legacyTarget=JSON.parse(JSON.stringify(good));legacyTarget.masters.ai_targets=[{id:'AIT-0001'}];report=gate.validateBase(legacyTarget);assert.equal(report.ok,false);assert(report.issues.some(x=>x.code==='legacy_ai_targets_forbidden'));
  const v2=JSON.parse(JSON.stringify(good));v2.ai_programs=[{id:'AIP-0001',schema_version:'2.0.0',data_version:'DV'}];v2.ai_program_layouts=[{layout_id:'AIL-0001',program_id:'AIP-0001',schema_version:'2.0.0',data_version:'DV'}];v2.ai_program_runtime=[{program_id:'AIP-0001',schema_version:'2.0.0',data_version:'DV'}];report=gate.validateBase(v2);assert.equal(report.ok,true,JSON.stringify(report.issues));
  const fix=gate.aiFixPackage({input:bad,report,sourceFilename:'bad.json',inputType:'project'});assert.equal(fix.schema,'gk.ai-fix-full-import.v1');assert.equal(fix.id_contract.game_data.quest,'QST');assert(fix.input_data);

  const partialRoot={schema_version:'4.0.0-draft',project:{id:'PRJ-DEMO',updated_at:'R1'},tags:[],masters:{monsters:[{id:'MON-0001',name:'M',tags:[],params:{}}],skills:[],jobs:[],equipment:[],mods:[],stats:[],status_effects:[],tablets:[],ai_searches:[],ai_conditions:[],ai_target_selectors:[],ai_actions:[],maps:[],exploration_outcomes:[],adventure_settings:[]}};
  const env=await dx.buildEnvelope({rootData:partialRoot,dataset:'monsters',ids:['MON-0001'],dependencyMode:'none',studioVersion:'TEST'});
  const invalid=JSON.parse(JSON.stringify(env));invalid.datasets.monsters[0].id='MON-DEMO';invalid.metadata.base_hash='';invalid.metadata.record_hashes={monsters:{}};invalid.metadata.package_hash='';
  const dry=await dx.dryRunImport({rootData:partialRoot,envelope:invalid});assert.equal(dry.ok,false);assert(dry.summary.invalid>=1);assert((dry.integrity?.issues||[]).some(x=>x.code==='invalid_id'));

  const html=fs.readFileSync(path.resolve(__dirname,'../studio/index.html'),'utf8');
  for(const marker of ['JSON全件読込','full-import-gate.js?v=2','buildFullImportGateReport','buildMultiProjectImportGateReport','importAllProjectsPackage','exportFullImportAiFix','buildMasterIdReferenceAudit(candidate)','buildGameDataIdReferenceAudit(candidate)','runValidation(options={})','1件でもERRORがあれば登録0件'])assert(html.includes(marker),marker+' missing');
  assert(!html.includes("createBackup('before-import');data=obj;normalizeData();persist('json imported')"),'legacy direct full-project overwrite must be removed');
  assert(!html.includes('const dt=new DataTransfer();dt.items.add(f)'),'full-project multi-package handoff must not depend on DataTransfer on iPhone Safari');
  assert(html.includes('currentProjectId=memoryCurrentBefore;data=memoryDataBefore;'),'multi-project rollback must restore in-memory state as well as storage');
  console.log('PASS R10 P2 full JSON preflight gate + V2 AI dataset contract + strict partial ID gate');
})().catch(e=>{console.error(e);process.exit(1)});
